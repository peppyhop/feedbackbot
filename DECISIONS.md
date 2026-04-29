# Decisions Log

Non-obvious choices made during the build. Append-only; update an entry
only to mark it superseded (don't rewrite history).

---

## 2026-04-22 — Plan.md §15 open questions resolved

Answers locked before starting implementation. See Plan.md §15 for the
original framing.

### 1. Classifier LLM: Workers AI Gemma 4

- **Model:** `@cf/google/gemma-4-26b-a4b-it`
- 256k context, vision + reasoning, native JSON mode (`response_format`
  with `json_object` / `json_schema`), function calling. Priced
  $0.10/M input + $0.30/M output.
- Chosen over Llama 3.3 70B (original Plan.md suggestion) and Claude
  Haiku (external hop). On-platform, cheap, JSON mode reliable enough
  for the classifier's 4-label output.
- **Binding:** `AI` (Workers AI binding) in the app worker.

### 2. Screenshot capture: html2canvas, lazy-loaded

- Widget core bundle stays < 8kb gzipped (Plan.md §16).
- `import('html2canvas')` only fires when the user toggles the
  screenshot checkbox — most submissions never pay the ~45kb cost.
- Rejected `getDisplayMedia` because the tab-picker prompt is the
  wrong UX for bug reports.

### 3. Public board route: `/b/$domain`

- Prefix avoids collisions with marketing routes (`/`, `/pricing`,
  `/login`, etc.). Matches Plan.md recommendation.

### 4. Magic-link email: Cloudflare EmailSender (via Alchemy)

- **Resource:** `EmailSender()` from
  `alchemy/cloudflare`. Binds as `EMAIL` on the worker; send via
  `env.EMAIL.send({ from, to, subject, text, html })`.
- **Safety rails:** set `allowedSenderAddresses` to
  `noreply@feedback.dev` and scope `allowedDestinationAddresses` in
  non-prod environments.
- **Caveats:** Cloudflare Email Service is in **beta** and requires the
  **Workers Paid plan**. Revisit if delivery quality drops or beta
  status blocks a launch.
- **Wiring:** Better Auth's `magicLink` plugin takes a `sendMagicLink`
  callback — thin wrapper calls `env.EMAIL.send(...)`. No Resend or
  Postmark SDK.

### 5. DNS TXT verification: `_feedback.<domain>`

- Record: `feedback-verify=<token>` on `_feedback.<domain>`.
- Avoids polluting the root TXT record (SPF/DMARC live there and
  owners are protective of it).
- Verified via DoH to `1.1.1.1/dns-query` as Plan.md §11 specifies.

### 6. Single Worker for app + API

- TanStack Start's generated Worker serves SSR + `/api/*` server
  routes. API and dashboard run together.
- Queue consumers (`classify`, `fanout`) remain **separate workers**
  bound via queue producers — blast-radius isolation where it
  actually matters (a classifier crash can't take down the
  dashboard).
- Supersedes Plan.md §9's "app + api as separate workers" note.

---

## 2026-04-22 — Repo layout: keep TanStack CLI scaffold

- Stay with the single-app layout under `src/` that
  `create-tanstack-app` generated.
- **Supersedes Plan.md §10** (pnpm workspace with `apps/{api,app,widget}`
  + `packages/{schema,db,ui}`).
- Adapted paths:
  - API routes → `src/routes/api/**` (TanStack Start server routes).
  - DB client + migrations → `src/db/**`.
  - Shared Zod schemas → `src/schema/**`.
  - Shared UI components → `src/components/**`.
  - Queue consumer workers → `src/workers/{classify,fanout}.ts`
    (built as separate Worker entries via Alchemy, not part of the
    main app bundle).
  - Widget → `src/widget/**` with its own `vite.config.ts`, produces
    hashed bundle uploaded to R2 / CDN.
- CLAUDE.md's golden rule #2 (workspace-scoped query helpers) still
  applies; the helper module lives at `src/db/client.ts`.

---

## 2026-04-22 — Error tracker: @sentry/cloudflare (not toucan-js)

- Plan.md §12 recommends `toucan-js`, but the library was archived by
  its author in 2024 and is no longer maintained.
- Switching to `@sentry/cloudflare`, Sentry's official Workers SDK.
  Installs and wires in Task #22 (observability) — not needed before.
- Supersedes Plan.md §12's error-tracking note.

---

## 2026-04-23 — React Compiler wired via @rolldown/plugin-babel

- Scaffold originally used `viteReact({ babel: { plugins: ['babel-plugin-react-compiler'] } })`.
- `@vitejs/plugin-react@6.0.0` (released 2026-03-12) removed the
  `babel` option entirely and moved to a preset pattern that requires
  `@rolldown/plugin-babel` as a separate plugin:
  ```ts
  import react, { reactCompilerPreset } from '@vitejs/plugin-react'
  import babel from '@rolldown/plugin-babel'
  // plugins: [react(), babel({ presets: [reactCompilerPreset()] })]
  ```
- Installed `@rolldown/plugin-babel`, wired per the release notes.
  Compiler runtime hooks visible in the built client chunks — verified
  by grepping `react-compiler-runtime` in `dist/client/assets/*.js`
  after `pnpm build`.

---

## 2026-04-26 — Custom preview subdomain `pr-N.preview.usefeedbackbot.com` (continued)

**Cert provisioning timing:** first-time TLS cert on a fresh `pr-N` hostname takes ~5–10 min to go from `initializing → pending_validation → active`. Cloudflare uses Google CA via DNS-01 TXT validation. PR comments now include a one-line warning so reviewers know to wait + refresh if they hit a TLS handshake error on the first click.

**Known issue — `preview-teardown.yml` didn't fire on `gh pr close`:** Closing PR #2 via `gh pr close --delete-branch` did NOT trigger the `pull_request:closed` workflow run. The workflow is registered + active and fired correctly for PR #1 (closed via `gh pr merge --delete-branch`). Likely race between the `closed` event and the branch deletion. Workaround for now: run `pnpm exec alchemy destroy --stage pr-N` locally if a teardown is missed. Investigation deferred until it recurs in production usage.

---

## 2026-04-26 — Custom preview subdomain `pr-N.preview.usefeedbackbot.com`

- **Why:** workers.dev URLs in PR comments are noisy and unrelated-looking; preview links that share the apex with production feel like a first-class part of the product.
- **Cost:** $0/month additional. Cloudflare Workers Custom Domains auto-issues a per-hostname Advanced Certificate, free with Workers. No Advanced Certificate Manager subscription needed.
- **Mechanism:** `alchemy.run.ts` detects `pr-\d+` stages via regex and attaches `${stage}.preview.usefeedbackbot.com` as the worker's domain (`adopt: true` for idempotency). The `console.log` block now prints the public custom-domain URL instead of `mainApp.url` (which still returns workers.dev even when a domain is attached) so the PR-comment grep picks the right one.
- **Carve-outs:** stages that don't match `pr-\d+` (e.g. `local-test`, the legacy `dirghaprasad`) keep the workers.dev URL — personal sandboxes don't claim shared `*.preview.usefeedbackbot.com` hostnames.
- **No DNS pre-config:** `preview.usefeedbackbot.com` is not its own zone. Cloudflare Workers handles per-hostname DNS + cert provisioning automatically when the binding is created. Teardown via `alchemy destroy` removes both.

---

## 2026-04-25 — Per-PR preview environments + auto-deploy production

- **Goal:** Vercel-style preview URLs on every PR + auto-deploy on merge to `main`.
- **Mechanism:** Alchemy stages. `--stage <name>` suffixes every Cloudflare resource and stores state under the same name. CI runs `alchemy deploy --stage pr-<num>` on PR open/sync and `alchemy destroy --stage pr-<num>` on close.
- **State store:** `CloudflareStateStore` (Durable-Object-backed, auto-deployed worker `alchemy-state-service`) used when `ALCHEMY_STATE_TOKEN` is in the env. CI sets it; local dev falls back to filesystem.
- **Stage-aware behaviour in `alchemy.run.ts`:**
  - Custom domain `usefeedbackbot.com` attached **only** when `STAGE === 'production'`.
  - `BETTER_AUTH_URL` set to `https://usefeedbackbot.com` only on production. Previews leave it empty so Better Auth + `/api/signup/start-checkout` derive the origin from `request.url`.
  - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are zeroed on previews because the OAuth App's callback URL is fixed at the apex. The `/login` page hides the GitHub button when `/api/auth-state` reports `github_enabled: false`.
- **Caveats** (also surfaced on the PR comment):
  1. **GitHub OAuth** doesn't work on previews — magic-link only.
  2. **Dodo billing webhooks** still land on the prod URL. Preview checkouts redirect successfully but the `subscription.active` event hits prod, where the new `workspace_deleted` audit guard logs it instead of mutating anyone's plan. To E2E-test billing on a preview, register a per-stage webhook in the Dodo dashboard manually.
  3. **Existing local stage `dirghaprasad`** is now orphan-equivalent — it loses the apex domain to the new `production` stage on the first prod deploy. Resources can be destroyed via `alchemy destroy --stage dirghaprasad --yes` once the cutover is verified.
- **Files:** `alchemy.run.ts`, `src/routes/api/auth-state.ts` (new), `src/routes/api/signup/start-checkout.ts` (origin fallback), `src/routes/login.tsx` (GitHub-button gate), `package.json` (deploy scripts), `.github/workflows/{preview,preview-teardown,production}.yml` (new).

---

## 2026-04-24 — Magic-link email: swap Cloudflare EmailSender → Unosend

- **Supersedes** 2026-04-22 #4 (Cloudflare EmailSender for magic-link delivery).
- The `SendEmail` binding is hard-limited to verified destinations by
  design ([CF docs](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/)) —
  not a general-purpose sender. First real user hit a 500 with
  "destination address is not a verified address".
- Swapped to Unosend (free tier 5,000/mo, same REST shape as Resend
  but cheaper at scale). Adapter is `src/lib/mailer.ts`; all future
  transactional email goes through `sendMail()`.
- Dropped the `EmailSender()` resource from `alchemy.run.ts` and the
  `EMAIL` binding from `env.ts`. Email Routing can (and should) be
  disabled in the Cloudflare Dashboard — its auto-managed SPF record
  at the zone apex would conflict with Unosend's SPF otherwise (SPF
  is one-per-domain).

---

## 2026-04-23 — Billing: Dodo Payments via Better Auth adapter

- **Plugin**: `@dodopayments/better-auth` on the server, wiring the
  `checkout`, `portal`, and `webhooks` sub-plugins. All three mount
  under `/api/auth/dodopayments/*`, so the Better Auth handler that
  already exists covers them without a new route file.
- **Billing scope**: per-workspace (org), not per-user. Checkout
  session is created with `reference_id = workspace.id` and
  `metadata.workspace_id = workspace.id`; the webhook reducer
  resolves workspace from `metadata.workspace_id`, falling back to
  `reference_id`, then a lookup by `subscription_id`.
- **Slug mapping**: `src/lib/billing/plans.ts` maps Dodo product
  slugs → internal plan ids (`free | pro | business`). Add a product
  in the Dodo Dashboard, paste its slug into `SLUG_TO_PLAN`, and the
  webhook handler will pick it up.
- **Idempotency**: `webhook_events` table keyed by `webhook-id`
  header. Plugin verifies signature; reducer checks the row exists
  before applying. Every event writes a row (success or `error`
  column populated).
- **Client bundle**: intentionally NOT using `dodopaymentsClient`
  from `@dodopayments/better-auth` because the package ships a
  single `.` export that drags the server plugin (+ dodopayments
  SDK, ~900kB) into the browser chunk. The billing page calls
  `/api/auth/dodopayments/checkout-session` and
  `/api/auth/dodopayments/customer/portal` directly via fetch —
  the client bundle stays ~7kB.
- **Graceful degradation**: missing `DODO_PAYMENTS_API_KEY` or
  webhook secret at boot → plugin is omitted from Better Auth and
  the billing page shows a "not configured" banner. Matches how
  GitHub OAuth is treated (empty-string secrets = feature off).
- **Entitlements**: deliberately unchanged in this pass. The
  `plan` column is stored on workspaces but nothing reads it yet —
  tier-based rate limits and feature gates are a follow-up once
  pricing is set.


---

## 2026-04-29 — Widget delivery: single-file IIFE, not module + manifest

Rolled back the previous "ESM loader → manifest.json → hashed bundle"
indirection. It had four cascading bugs (snippet pointed at
`/widget.js` but build emitted `/widget/loader.js`; the loader was
ESM but the snippet uses a classic `<script>` tag; Vite `define`
substitution doesn't replace tokens inside string literals so the
manifest URL was never baked; the fallback URL pointed at a domain
we don't own).

**Now**: `vite.widget.config.ts` emits one IIFE bundle straight to
`public/widget.js`. No loader, no manifest, no per-deploy chunk
hash coordination. The bundle is 26kB raw / 9.7kB gzipped (well
under any feedback-widget budget).

**html2canvas**: dynamic-imported from
`https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm` at screenshot
time. jsDelivr's `+esm` endpoint serves with permissive CORS, so
the cross-origin module-import dance just works without us standing
up our own CORS for `/widget/*`. Pinned to 1.4.1 so the browser
caches it across customer sites.

**Origin detection**: the IIFE captures `document.currentScript.src`
synchronously at the top of its body (before `defer`'d execution
returns control) and stashes the origin on
`window.__FEEDBACKBOT_ORIGIN__`. `src/widget/api.ts` reads that
back to construct API URLs — so the widget's API calls always go
to the host the script was served from, regardless of which
customer domain it's embedded on.

**Trade-off accepted**: every bundle change invalidates the same
URL (no content-hash cache busting). Acceptable for now — we set a
short Cache-Control on `/widget.js` and a long one on the bundle
contents only once we move to a CDN subdomain. That's deferred.
