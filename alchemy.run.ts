// Infra-as-code for FeedbackBot. Declares every Cloudflare resource
// the app + queue consumers need, wires bindings, and deploys.
//
// PLAN.md §9, adjusted per DECISIONS.md 2026-04-22:
//   - Single Worker for SSR + /api/* (DECISIONS #6)
//   - Separate Worker each for classify + fanout queue consumers
//   - Workers AI binding for the Gemma 4 classifier
//
// Stages (per DECISIONS.md 2026-04-25):
//   pnpm exec alchemy deploy --stage local-test   # one-off local
//   pnpm exec alchemy deploy --stage pr-123       # CI per-PR preview
//   pnpm exec alchemy deploy --stage production   # bound to apex
// Production attaches the custom domain + GitHub OAuth + canonical
// BETTER_AUTH_URL. All other stages get a workers.dev URL only and
// have GitHub OAuth zeroed out (its callback URL is fixed at the
// apex and would 404).

import alchemy from 'alchemy'
import {
  Ai,
  AnalyticsEngineDataset,
  D1Database,
  DurableObjectNamespace,
  KVNamespace,
  Queue,
  R2Bucket,
  TanStackStart,
  Worker,
} from 'alchemy/cloudflare'
import { CloudflareStateStore } from 'alchemy/state'

import { blocklistSeedData } from './src/seed/blocklist/seed.ts'

const app = await alchemy('feedbackbot', {
  // Encrypts secret bindings in the alchemy state file.
  // See https://alchemy.run/concepts/secret/#encryption-password
  password: process.env.ALCHEMY_PASSWORD,
  // When ALCHEMY_STATE_TOKEN is set we persist resource state in a
  // Cloudflare-hosted Durable Object (auto-deployed by Alchemy as
  // `alchemy-state-service`). This is required for CI so concurrent
  // deploys don't race over local filesystem state. Local devs without
  // the token fall back to the default `.alchemy/` filesystem store.
  stateStore: process.env.ALCHEMY_STATE_TOKEN
    ? (scope) =>
        new CloudflareStateStore(scope, {
          stateToken: alchemy.secret(process.env.ALCHEMY_STATE_TOKEN),
        })
    : undefined,
})

// ── Stage-aware constants ───────────────────────────────────────
const STAGE = app.stage
const IS_PRODUCTION = STAGE === 'production'

// Per-PR preview stages get a pretty subdomain. The regex is strict
// (`pr-` + digits) so personal sandbox stages (`local-test`,
// `dirghaprasad`, etc.) never accidentally claim a preview hostname.
const IS_PR_PREVIEW = /^pr-\d+$/.test(STAGE)
const PREVIEW_HOST = IS_PR_PREVIEW
  ? `${STAGE}.preview.usefeedbackbot.com`
  : null

const PROD_HOST = 'usefeedbackbot.com'
const PROD_ORIGIN = `https://${PROD_HOST}`

// Production pins BETTER_AUTH_URL to the canonical apex; previews
// leave it empty so Better Auth derives the origin from each request
// (so cookies + magic-link emails reflect the preview's URL).
const BETTER_AUTH_URL_VAL = IS_PRODUCTION ? PROD_ORIGIN : ''

// ── Secrets ──────────────────────────────────────────────────────
// Required secrets fail the deploy if unset. Optional ones become
// empty-string bindings so the app doesn't crash on startup (the
// consumers — GitHub OAuth, Slack OAuth, Sentry — treat empty as
// "feature disabled").

const BETTER_AUTH_SECRET = alchemy.secret.env('BETTER_AUTH_SECRET')
const INTEGRATIONS_ENCRYPTION_KEY = alchemy.secret.env(
  'INTEGRATIONS_ENCRYPTION_KEY',
)
const HMAC_SECRET_SEED = alchemy.secret.env('HMAC_SECRET_SEED')

function optionalSecret(name: string) {
  return alchemy.secret(process.env[name] ?? '', name)
}

// Google OAuth: passed through to every stage. The Google Cloud
// OAuth client only registers the production redirect URI; preview
// deploys use the better-auth oAuthProxy plugin to bounce through
// production before redirecting back to the preview origin. See
// src/lib/auth.ts for the proxy setup.
const GOOGLE_CLIENT_ID = optionalSecret('GOOGLE_CLIENT_ID')
const GOOGLE_CLIENT_SECRET = optionalSecret('GOOGLE_CLIENT_SECRET')
const SLACK_CLIENT_ID = optionalSecret('SLACK_CLIENT_ID')
const SLACK_CLIENT_SECRET = optionalSecret('SLACK_CLIENT_SECRET')
const SENTRY_DSN = optionalSecret('SENTRY_DSN')
const DODO_PAYMENTS_API_KEY = optionalSecret('DODO_PAYMENTS_API_KEY')
const DODO_PAYMENTS_WEBHOOK_SECRET = optionalSecret(
  'DODO_PAYMENTS_WEBHOOK_SECRET',
)
const DODO_PAYMENTS_ENV = process.env.DODO_PAYMENTS_ENV ?? 'test_mode'
const RESEND_API_KEY = optionalSecret('RESEND_API_KEY')
// Cloudflare Turnstile — gates /api/ticket. Unset → graceful
// bypass. Site key (public) is read separately by the widget
// build via VITE_FB_TURNSTILE_SITEKEY.
const TURNSTILE_SECRET = optionalSecret('TURNSTILE_SECRET')
// Cloudflare API access for managing the Turnstile widget's
// hostname allowlist on every domain verification. Token scope:
// Account > Turnstile > Edit (only).
const CF_API_TOKEN = optionalSecret('CF_API_TOKEN')
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? ''
const CF_TURNSTILE_WIDGET_ID = process.env.CF_TURNSTILE_WIDGET_ID ?? ''
// `||` not `??` — an unset GitHub secret resolves to an empty string
// (not undefined), so `??` would let "" through and we'd POST
// `from: ""` to Resend (422 "domain is invalid"). Falsy fallback
// catches both undefined and empty.
const RESEND_FROM =
  process.env.RESEND_FROM || 'FeedbackBot <noreply@usefeedbackbot.com>'

// ── Storage ──────────────────────────────────────────────────────

// `adopt: true` on every resource: a previously-failed deploy can
// leave Cloudflare-side resources orphaned (created but not in
// alchemy state). Adopt-on-conflict makes subsequent runs
// idempotent — they take ownership instead of erroring.

const db = await D1Database('feedback-db', {
  migrationsDir: './src/db/migrations',
  adopt: true,
})

const screenshots = await R2Bucket('feedback-screenshots', { adopt: true })

// Seed the blocklist KV at deploy time so freemail/disposable/strict
// lookups work before any cron ever runs. Idempotent — same keys
// just overwrite on redeploy (the seeder is currently hand-curated).
const seed = blocklistSeedData()
const blocklistValues: Array<{ key: string; value: string }> = [
  { key: 'version', value: new Date().toISOString() },
  ...seed.freemail.map((d) => ({ key: `freemail:${d}`, value: '1' })),
  ...seed.disposable.map((d) => ({ key: `disposable:${d}`, value: '1' })),
  ...seed.strict.map((d) => ({ key: `strict:${d}`, value: '1' })),
]

const blocklistKv = await KVNamespace('blocklist-kv', {
  values: blocklistValues,
  adopt: true,
})
const analyticsKv = await KVNamespace('analytics-kv', { adopt: true })
const cacheKv = await KVNamespace('cache-kv', { adopt: true })

// ── Queues ───────────────────────────────────────────────────────

const fanoutDlq = await Queue('fanout-dlq', { adopt: true })

const classifyQueue = await Queue<{
  ticket_id: string
  workspace_id: string
}>('classify-queue', { adopt: true })

const fanoutQueue = await Queue<{
  ticket_id: string
  workspace_id: string
  attempt?: number
}>('fanout-queue', { adopt: true })

// ── Workers AI (Gemma 4) ─────────────────────────────────────────

const ai = Ai()

// ── Analytics Engine (per-request metrics) ───────────────────────

const analytics = AnalyticsEngineDataset('fb-analytics', {
  dataset: 'feedbackbot_events',
})

// ── Durable Objects ──────────────────────────────────────────────
// Hosted on a dedicated "dos" Worker because TanStack Start's build
// pipeline doesn't let us inject extra exports into the main
// worker bundle.
//
// Two sets of namespace declarations:
//   - "host" versions (no scriptName) attached to dos-worker —
//     these register the new-class migration with Cloudflare.
//   - "ref" versions (scriptName → dosWorker.name) attached to the
//     main app + any other consumers that need to call the DOs.

const APP_WORKER_ID = 'feedbackbot-app'

const hostRateLimiter = DurableObjectNamespace('rate-limiter-host', {
  className: 'RateLimiter',
  sqlite: true,
})
const hostWorkspaceLimiter = DurableObjectNamespace('workspace-limiter-host', {
  className: 'WorkspaceLimiter',
  sqlite: true,
})
const hostClaimLock = DurableObjectNamespace('claim-lock-host', {
  className: 'ClaimLock',
  sqlite: true,
})

const dosWorker = await Worker('dos-worker', {
  entrypoint: 'src/workers/dos.ts',
  compatibility: 'node',
  adopt: true,
  bindings: {
    RATE_LIMITER: hostRateLimiter,
    WORKSPACE_LIMITER: hostWorkspaceLimiter,
    CLAIM_LOCK: hostClaimLock,
  },
})

const rateLimiter = DurableObjectNamespace('rate-limiter', {
  className: 'RateLimiter',
  scriptName: dosWorker.name,
  sqlite: true,
})
const workspaceLimiter = DurableObjectNamespace('workspace-limiter', {
  className: 'WorkspaceLimiter',
  scriptName: dosWorker.name,
  sqlite: true,
})
const claimLock = DurableObjectNamespace('claim-lock', {
  className: 'ClaimLock',
  scriptName: dosWorker.name,
  sqlite: true,
})

// ── Queue consumer Workers (separate from app) ───────────────────

await Worker('classify-worker', {
  entrypoint: 'src/workers/classify.ts',
  compatibility: 'node',
  adopt: true,
  bindings: {
    DB: db,
    AI: ai,
    FANOUT_QUEUE: fanoutQueue,
    ANALYTICS: analytics,
    HMAC_SECRET_SEED,
    INTEGRATIONS_ENCRYPTION_KEY,
  },
  eventSources: [
    { queue: classifyQueue, settings: { batchSize: 10, maxRetries: 3 } },
  ],
})

await Worker('cron-worker', {
  entrypoint: 'src/workers/cron.ts',
  compatibility: 'node',
  adopt: true,
  bindings: {
    DB: db,
    ANALYTICS_KV: analyticsKv,
  },
  // Daily at 05:00 UTC — quiet window worldwide.
  crons: ['0 5 * * *'],
})

await Worker('fanout-worker', {
  entrypoint: 'src/workers/fanout.ts',
  compatibility: 'node',
  adopt: true,
  bindings: {
    DB: db,
    SCREENSHOTS: screenshots,
    INTEGRATIONS_ENCRYPTION_KEY,
    HMAC_SECRET_SEED,
    BETTER_AUTH_URL: BETTER_AUTH_URL_VAL,
    ANALYTICS: analytics,
  },
  eventSources: [
    {
      queue: fanoutQueue,
      settings: {
        batchSize: 5,
        maxRetries: 5,
        deadLetterQueue: fanoutDlq.name,
      },
    },
  ],
})

// ── Main app Worker (SSR + /api/*) ───────────────────────────────

export const mainApp = await TanStackStart(APP_WORKER_ID, {
  compatibility: 'node',
  adopt: true,
  // Custom domain attachment:
  //   - production → usefeedbackbot.com
  //   - pr-N stages → pr-N.preview.usefeedbackbot.com (auto-issued
  //     SSL via Workers' per-hostname Advanced Cert; Cloudflare
  //     manages the AAAA record)
  //   - other stages (local-test, etc.) → workers.dev URL only
  // `adopt: true` makes attachment idempotent — claims an existing
  // binding instead of failing with "already exists".
  domains: IS_PRODUCTION
    ? [{ domainName: PROD_HOST, adopt: true }]
    : PREVIEW_HOST
      ? [{ domainName: PREVIEW_HOST, adopt: true }]
      : undefined,
  bindings: {
    // storage
    DB: db,
    BLOCKLIST_KV: blocklistKv,
    ANALYTICS_KV: analyticsKv,
    CACHE_KV: cacheKv,
    SCREENSHOTS: screenshots,

    // queues (producers only — app enqueues, consumer workers
    // handle delivery)
    CLASSIFY_QUEUE: classifyQueue,
    FANOUT_QUEUE: fanoutQueue,

    // durable objects
    RATE_LIMITER: rateLimiter,
    WORKSPACE_LIMITER: workspaceLimiter,
    CLAIM_LOCK: claimLock,

    // AI + email
    AI: ai,

    // analytics
    ANALYTICS: analytics,

    // canonical origin — Better Auth reads this, fanout uses it for
    // signed screenshot URLs. Empty on previews → Better Auth + the
    // /api/signup/start-checkout helper derive the origin from
    // request.url at runtime.
    BETTER_AUTH_URL: BETTER_AUTH_URL_VAL,

    // secrets
    BETTER_AUTH_SECRET,
    INTEGRATIONS_ENCRYPTION_KEY,
    HMAC_SECRET_SEED,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    SLACK_CLIENT_ID,
    SLACK_CLIENT_SECRET,
    SENTRY_DSN,
    DODO_PAYMENTS_API_KEY,
    DODO_PAYMENTS_WEBHOOK_SECRET,
    DODO_PAYMENTS_ENV,
    RESEND_API_KEY,
    RESEND_FROM,
    TURNSTILE_SECRET,
    CF_API_TOKEN,
    CF_ACCOUNT_ID,
    CF_TURNSTILE_WIDGET_ID,
  },
})

// `mainApp.url` returns the workers.dev URL even when a custom
// domain is attached. For PR comments and operator visibility, we
// want the public custom-domain URL when one exists.
const publicUrl = IS_PRODUCTION
  ? `https://${PROD_HOST}`
  : PREVIEW_HOST
    ? `https://${PREVIEW_HOST}`
    : mainApp.url

console.log({
  stage: STAGE,
  app: publicUrl,
})

await app.finalize()
