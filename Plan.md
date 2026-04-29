# Feedback Platform — Phase 1 MVP Plan

Zero-signup feedback collection with AI classification and webhook-based fan-out, running on Cloudflare.

---

## 1. Goals & non-goals

**Goals**
- Widget installs with a single `<script>` tag, zero configuration.
- Tickets flow immediately; workspace is auto-created from request headers.
- Admin claims ownership via email-domain match or DNS TXT.
- Every ticket is AI-classified as `bug | query | feature | spam`.
- Each classification fans out through customer-configured webhooks (Slack, Discord, Linear, generic).
- Public board per verified workspace with voting and comments.

**Explicit non-goals for Phase 1**
- No RAG / AI query answering.
- No research agents for feature requests.
- No coding-agent handoff.
- No SCIM, no per-workspace SSO UI (plugin is wired, UI is deferred).
- No billing, pricing page is static marketing only.
- No passkeys, no 2FA.
- No end-user notifications back to feedback submitters.

---

## 2. Scope summary

| Area | In scope | Deferred |
|---|---|---|
| Ingestion | Widget, auto-workspace, spam guards, rate limiting | Geo blocking, CAPTCHA |
| Claim | Email-match, DNS TXT, invitations | SSO self-service UI, SCIM |
| Storage | D1 tickets/votes/comments, R2 screenshots | Vector similarity |
| AI | Classification only | Research, dedup, summarization of threads |
| Fan-out | Generic webhook, Slack | Discord, Linear, GitHub, Jira, Email, inbound replies |
| Dashboard | Ticket list, detail, status, kanban | Analytics beyond counts |
| Public board | Submit, vote, comment, roadmap view | Moderation tools, theming |
| Auth | Better Auth + Magic Link + GitHub + Org plugin | SSO UI, 2FA, passkeys |

---

## 3. System architecture

```
                          ┌─────────────────────────────┐
   Customer's website     │  cdn.feedback.dev/widget.js │
   <script src=...>──────▶│  (Preact, ~6kb gzipped)     │
                          │  lazy-loads html2canvas     │
                          └──────────────┬──────────────┘
                                         │ POST /api/ticket
                                         ▼
                          ┌─────────────────────────────┐
                          │  api.feedback.dev Worker    │
                          │  - Origin/Referer parse     │
                          │  - PSL normalize (tldts)    │
                          │  - Blocklist check          │
                          │  - Rate-limit DO            │
                          │  - Insert ticket (D1)       │
                          │  - Enqueue classify job     │
                          └──────┬─────────────┬────────┘
                                 │             │
                       D1 write  ▼             ▼ Queue: ticket.created
                          ┌────────────┐  ┌───────────────────────┐
                          │ Cloudflare │  │ Classify Consumer     │
                          │    D1      │  │ - LLM call (Workers   │
                          └────────────┘  │   AI or Claude Haiku) │
                                          │ - Update ticket       │
                                          │ - Enqueue fanout job  │
                                          └──────────┬────────────┘
                                                     │ Queue: ticket.fanout
                                                     ▼
                                          ┌───────────────────────┐
                                          │ Fan-out Consumer      │
                                          │ - Load routes for     │
                                          │   workspace + type    │
                                          │ - HMAC sign payload   │
                                          │ - POST to each target │
                                          │ - Log delivery        │
                                          │ - Retry via DLQ       │
                                          └───────────────────────┘

        ┌──────────────────────────────────────┐
        │  app.feedback.dev (TanStack Start)   │
        │  - /dashboard/[domain]               │
        │  - /b/[domain] (public board)        │
        │  - Better Auth endpoints             │
        │  - Server functions for CRUD         │
        └──────────────────────────────────────┘
                │
                ▼  Cloudflare Workers runtime
        ┌──────────────────────────────────────┐
        │  D1 • KV • R2 • Queues • DO • DoH    │
        └──────────────────────────────────────┘
```

---

## 4. Data model

### 4.1 D1 tables (owned by us)

```sql
-- Core workspace state
CREATE TABLE workspaces (
  id                  TEXT PRIMARY KEY,              -- ws_<nanoid>
  domain              TEXT NOT NULL UNIQUE,          -- eTLD+1 normalized
  state               TEXT NOT NULL,                 -- 'pending' | 'claimed' | 'suspended'
  verification_token  TEXT NOT NULL,                 -- for DNS TXT
  better_auth_org_id  TEXT,                          -- set on claim
  settings            TEXT NOT NULL DEFAULT '{}',    -- JSON
  ticket_count        INTEGER NOT NULL DEFAULT 0,    -- cheap cap check
  created_at          INTEGER NOT NULL,
  claimed_at          INTEGER
);
CREATE INDEX ws_state_idx ON workspaces(state);

-- Tickets
CREATE TABLE tickets (
  id                  TEXT PRIMARY KEY,              -- tkt_<nanoid>
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id),
  message             TEXT NOT NULL,
  page_url            TEXT,
  user_agent          TEXT,
  email               TEXT,
  screenshot_key      TEXT,                          -- R2 key
  ip_hash             TEXT,                          -- sha256(ip + salt)
  status              TEXT NOT NULL DEFAULT 'open',  -- open|planned|in_progress|completed|closed
  classification      TEXT,                          -- bug|query|feature|spam (primary)
  classification_meta TEXT,                          -- JSON: {confidence, secondary, summary, title}
  upvotes             INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX tkt_ws_idx ON tickets(workspace_id, created_at DESC);
CREATE INDEX tkt_ws_status_idx ON tickets(workspace_id, status);
CREATE INDEX tkt_ws_class_idx ON tickets(workspace_id, classification);

-- Comments
CREATE TABLE comments (
  id            TEXT PRIMARY KEY,
  ticket_id     TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  author_user_id TEXT,                               -- null = anonymous public
  author_name   TEXT,                                -- for anon
  message       TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'web',        -- web|integration
  created_at    INTEGER NOT NULL
);
CREATE INDEX cmt_ticket_idx ON comments(ticket_id, created_at);

-- Votes (dedup via fingerprint)
CREATE TABLE votes (
  id           TEXT PRIMARY KEY,
  ticket_id    TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  fingerprint  TEXT NOT NULL,                       -- signed cookie + ip_hash composite
  created_at   INTEGER NOT NULL,
  UNIQUE(ticket_id, fingerprint)
);

-- Integrations (per workspace)
CREATE TABLE integrations (
  id             TEXT PRIMARY KEY,                  -- int_<nanoid>
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id),
  kind           TEXT NOT NULL,                     -- 'slack' | 'webhook' | ...
  name           TEXT NOT NULL,                     -- user-facing label
  credentials    TEXT NOT NULL,                     -- encrypted blob
  enabled        INTEGER NOT NULL DEFAULT 1,
  created_at     INTEGER NOT NULL
);

-- Routing: which classifications go to which integration
CREATE TABLE integration_routes (
  id              TEXT PRIMARY KEY,
  integration_id  TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  ticket_type     TEXT NOT NULL,                    -- bug|query|feature
  config          TEXT NOT NULL,                    -- JSON, integration-specific (e.g. channel)
  enabled         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX route_ws_type_idx ON integration_routes(workspace_id, ticket_type, enabled);

-- Outbound delivery log
CREATE TABLE integration_deliveries (
  id              TEXT PRIMARY KEY,                 -- dlv_<nanoid>
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  integration_id  TEXT NOT NULL,
  ticket_id       TEXT NOT NULL,
  status          TEXT NOT NULL,                    -- pending|delivered|failed|dead
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  request_body    TEXT,
  response_code   INTEGER,
  response_body   TEXT,
  created_at      INTEGER NOT NULL,
  delivered_at    INTEGER
);
CREATE INDEX dlv_ws_idx ON integration_deliveries(workspace_id, created_at DESC);

-- Audit log (claim events, role changes, integration edits)
CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  actor_user_id TEXT,
  actor_ip_hash TEXT,
  action        TEXT NOT NULL,                      -- e.g. 'workspace.claim.dns'
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL
);
CREATE INDEX audit_ws_idx ON audit_log(workspace_id, created_at DESC);
```

### 4.2 Better Auth tables

Managed by Better Auth migrations: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `ssoProvider` (from `@better-auth/sso`, even though UI is deferred, the schema is in so we don't migrate later).

### 4.3 KV namespaces

- `BLOCKLIST_KV` — `freemail:<domain>`, `disposable:<domain>`, `strict:<domain>`, with a single `version` key to cache-bust. Seeded at deploy.
- `ANALYTICS_KV` — daily rollups: `stats:<ws_id>:<yyyy-mm-dd>` → `{tickets, by_type, top_pages}`.
- `CACHE_KV` — workspace lookups by domain, short TTL.

### 4.4 R2 buckets

- `feedback-screenshots` — path `ws_<id>/tkt_<id>/screenshot.png`.

### 4.5 Durable Object classes

- `RateLimiter` — one DO per IP (hashed), sliding window, 20 submissions/hour.
- `WorkspaceLimiter` — one DO per workspace, per-workspace ticket cap for pending state and rate ceiling on claimed state.
- `ClaimLock` — one DO per workspace domain, serializes claim attempts (prevents race between two same-domain users).

### 4.6 Queues

- `classify-queue` — `{ ticket_id, workspace_id }`. Consumer calls LLM, writes classification, then enqueues fan-out.
- `fanout-queue` — `{ ticket_id, workspace_id }`. Consumer loads routes and dispatches.
- `fanout-dlq` — failed deliveries after retries, inspected via admin tooling.

---

## 5. Worker route map

### 5.1 Public ingestion (no auth)

```
POST   /api/ticket                 Submit feedback (rate-limited, spam-guarded)
POST   /api/vote                   Vote on ticket (fingerprint dedup)
POST   /api/comment                Public comment on ticket
GET    /api/public/tickets         Public board data (cached)
```

### 5.2 Claim & verification

```
POST   /api/verify-domain          Trigger DNS TXT lookup for current workspace
GET    /api/workspace-state        Returns pending/claimed + what's needed
```

### 5.3 Authenticated admin (Better Auth session required)

```
GET    /api/admin/tickets          List tickets with filters
PATCH  /api/admin/tickets/:id      Update status/classification override
DELETE /api/admin/tickets/:id      Soft-delete spam
GET    /api/admin/integrations     List configured integrations
POST   /api/admin/integrations     Create (encrypts creds)
PATCH  /api/admin/integrations/:id Update config/routes
DELETE /api/admin/integrations/:id Remove
GET    /api/admin/deliveries       Delivery log
POST   /api/admin/invite           Create org invitation
```

### 5.4 Auth

```
/api/auth/*                        Better Auth handler (mounts Magic Link, GitHub, Org, SSO)
```

### 5.5 Widget & static

```
GET    /widget.js                  Single-file IIFE bundle. html2canvas
                                   lazy-loads from a public CDN at
                                   screenshot time so the main bundle
                                   stays small without per-customer
                                   CORS plumbing.
```

All routes return JSON except the last two. Origin/Referer parsing happens in a shared middleware before per-route logic.

---

## 6. Claim flow state machine

```
                 widget first fires
                       │
                       ▼
                 ┌───────────┐
                 │  pending  │  (ticket_count capped at 100, board hidden)
                 └─────┬─────┘
                       │
        ┌──────────────┼──────────────────┐
        │              │                  │
 email-match       DNS verify          invite accept
 (guarded)         success             (only on claimed)
        │              │                  │
        └──────┬───────┘                  │
               ▼                          │
         ┌──────────┐                     │
         │ claimed  │◀────────────────────┘ (add member)
         └──────────┘
           │
           │ owner triggers
           ▼
     ┌─────────────┐
     │ suspended   │  (future: billing hold, abuse)
     └─────────────┘
```

**Guards on email-match path** (all must pass):
1. User email is verified in Better Auth.
2. Email eTLD+1 equals workspace eTLD+1 after PSL normalization.
3. Workspace domain not in `freemail` blocklist.
4. Workspace domain not in `strict` blocklist (edu, gov, mil).
5. Claim lock acquired (DO) — first valid claimant becomes owner, subsequent become members.

**On successful claim:**
- Create Better Auth organization with `slug = domain`, `name = domain`.
- Link via `workspaces.better_auth_org_id`.
- Add user as `owner` (first claimant) or `member` (subsequent).
- Write `audit_log` row with method and IP hash.
- Optionally offer "purge pre-claim tickets" button.

---

## 7. Widget specification

### 7.1 Stack
- **Preact** + **htm** (no JSX build step needed for embedding, but we use Vite/esbuild to bundle with terser and brotli pre-compression).
- Core bundle target: **< 8kb gzipped**, achieved by excluding html2canvas from the initial load.
- html2canvas loaded via `import()` only when user clicks "attach screenshot."

### 7.2 Delivery

- `https://cdn.feedback.dev/widget.js` → short cache, small loader that reads a version and imports the hashed bundle.
- `https://cdn.feedback.dev/widget.<hash>.js` → immutable, long cache (1 year).
- Enables safe rollouts without invalidating customer caches.

### 7.3 Behavior

1. On load, widget appends a floating button to `<body>` (Shadow DOM rooted, so host CSS can't leak in).
2. On click, opens modal with: message textarea (required), email (optional), attach screenshot toggle.
3. Submit posts to `https://api.feedback.dev/api/ticket` with:
   ```json
   {
     "message": "...",
     "page_url": "window.location.href",
     "user_agent": "navigator.userAgent",
     "email": "optional",
     "honeypot": "",
     "screenshot_data_url": "data:image/png;..."
   }
   ```
4. Domain is NOT sent. Server derives from Origin/Referer.
5. Screenshot, if present, is uploaded separately via pre-signed R2 URL returned from a two-step submit (step 1 gets ticket id + upload URL, step 2 uploads to R2 from browser).

### 7.4 Hardening

- Shadow DOM isolation.
- No global leaks; widget runs in an IIFE.
- Feature-detects before using modern APIs.
- Fails silently if offline or rate-limited (shows "try again later" without revealing 429).
- CSP-safe: no inline eval, no external fonts, inlines all styles.

---

## 8. Classification & fan-out pipeline

### 8.1 Classification consumer

On `classify-queue` message:

1. Load ticket.
2. Build prompt with message, page_url, user_agent snippet.
3. Call LLM (start with **Workers AI** Llama 3.3 70B; switch to **Claude Haiku** via API if quality is insufficient). Single JSON-mode call:
   ```
   {
     "primary_type": "bug|query|feature|spam",
     "secondary_types": [...],
     "confidence": 0.0-1.0,
     "summary": "<60 chars",
     "suggested_title": "<80 chars",
     "reasoning": "<200 chars"
   }
   ```
4. Update `tickets.classification` + `classification_meta`.
5. If `primary_type != spam`, enqueue `fanout-queue` message.
6. Spam tickets stay in DB, hidden from boards, excluded from fan-out.

### 8.2 Fan-out consumer

On `fanout-queue` message:

1. Load ticket + classification.
2. Query `integration_routes WHERE workspace_id = ? AND ticket_type = ? AND enabled = 1`.
3. For each route, load integration, decrypt credentials, build payload:
   ```json
   {
     "event": "ticket.created",
     "workspace": { "id", "domain" },
     "ticket": { "id", "message", "page_url", "email", "created_at",
                 "classification": { "primary", "secondary", "confidence",
                                     "summary", "suggested_title" },
                 "screenshot_url": "signed R2 url, optional" },
     "delivery": { "id", "attempt" }
   }
   ```
4. Sign with HMAC-SHA256 using per-integration secret.
5. POST with 10s timeout; if non-2xx or timeout, retry (Queues native retry, exponential backoff, max 5 attempts, then DLQ).
6. Write row to `integration_deliveries` with outcome.

### 8.3 Slack first-party integration

Slack is a `kind='slack'` integration where `credentials` is an encrypted OAuth token. The fan-out consumer detects Slack and formats a Block Kit message instead of raw JSON, posting via `chat.postMessage`. Config per route includes the target channel id.

---

## 9. Infrastructure — Alchemy config

Alchemy (`alchemy.run`) provisions all of the following. Single `alchemy.run.ts` at repo root:

- **Workers**: `api` (edge API + ingestion), `app` (TanStack Start SSR), `widget-cdn` (static), `queue-classify`, `queue-fanout` (consumers can be separate workers or bound to `api` via queue bindings).
- **D1**: `feedback-db`, with migrations in `db/migrations/` run via Alchemy's migration hook.
- **R2**: `feedback-screenshots`.
- **KV**: `BLOCKLIST_KV`, `ANALYTICS_KV`, `CACHE_KV`.
- **Queues**: `classify-queue`, `fanout-queue`, `fanout-dlq`.
- **Durable Objects**: `RateLimiter`, `WorkspaceLimiter`, `ClaimLock`.
- **Secrets** (from environment or Alchemy state): `BETTER_AUTH_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY`, `HMAC_SECRET_SEED`, `GITHUB_OAUTH_*`, `RESEND_API_KEY` (for magic links), `WORKERS_AI_TOKEN` or `ANTHROPIC_API_KEY`.
- **DNS**: zones + records for `feedback.dev`, `api.feedback.dev`, `cdn.feedback.dev`, `app.feedback.dev`.
- **Routes**: map workers to the four subdomains.

---

## 10. Folder structure

```
/
├── alchemy.run.ts                 # IaC entry
├── package.json                   # pnpm workspace root
├── pnpm-workspace.yaml
├── apps/
│   ├── api/                       # Cloudflare Worker: ingestion + admin API
│   │   ├── src/
│   │   │   ├── index.ts           # router
│   │   │   ├── routes/
│   │   │   │   ├── ticket.ts
│   │   │   │   ├── vote.ts
│   │   │   │   ├── comment.ts
│   │   │   │   ├── verify-domain.ts
│   │   │   │   ├── admin/
│   │   │   │   └── public/
│   │   │   ├── middleware/
│   │   │   │   ├── origin-parse.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   ├── auth.ts
│   │   │   │   └── cors.ts
│   │   │   ├── lib/
│   │   │   │   ├── domain.ts      # PSL normalize
│   │   │   │   ├── blocklist.ts
│   │   │   │   ├── crypto.ts      # HMAC, integration creds
│   │   │   │   ├── dns.ts         # DoH verification
│   │   │   │   └── fingerprint.ts
│   │   │   ├── do/
│   │   │   │   ├── rate-limiter.ts
│   │   │   │   ├── workspace-limiter.ts
│   │   │   │   └── claim-lock.ts
│   │   │   ├── queue/
│   │   │   │   ├── classify.ts
│   │   │   │   └── fanout.ts
│   │   │   ├── integrations/
│   │   │   │   ├── index.ts       # registry
│   │   │   │   ├── slack.ts
│   │   │   │   └── webhook.ts
│   │   │   └── auth.ts            # Better Auth config
│   │   └── wrangler.toml          # Alchemy-generated or hand-written
│   │
│   ├── app/                       # TanStack Start dashboard + public board
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── __root.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   ├── pricing.tsx
│   │   │   │   ├── b/
│   │   │   │   │   └── $domain.tsx       # public board
│   │   │   │   └── dashboard/
│   │   │   │       └── $domain/
│   │   │   │           ├── index.tsx
│   │   │   │           ├── tickets.tsx
│   │   │   │           ├── tickets.$id.tsx
│   │   │   │           ├── integrations.tsx
│   │   │   │           ├── settings.tsx
│   │   │   │           └── claim.tsx     # DNS verification UI
│   │   │   ├── server/                   # server functions
│   │   │   ├── components/
│   │   │   └── lib/auth-client.ts
│   │   └── app.config.ts
│   │
│   └── widget/                    # Preact embed
│       ├── src/
│       │   ├── index.ts           # IIFE entry
│       │   ├── loader.ts          # short-cache bootstrap
│       │   ├── ui/
│       │   │   ├── button.tsx
│       │   │   ├── modal.tsx
│       │   │   └── form.tsx
│       │   ├── screenshot.ts      # lazy html2canvas
│       │   └── api.ts
│       ├── vite.config.ts
│       └── dist/                  # hashed bundles uploaded to R2/CDN
│
├── packages/
│   ├── schema/                    # shared Zod schemas + TS types
│   ├── db/
│   │   ├── migrations/            # SQL files, numbered
│   │   └── client.ts              # D1 query helpers
│   └── ui/                        # shared React components (shadcn-style)
│
└── infra/
    └── dns/                       # zone files if manually managed
```

---

## 11. Security & abuse controls

**At ingestion**
- Reject if no Origin and no Referer header.
- Reject if Origin domain on freemail/disposable blocklists.
- Honeypot field: any non-empty `honeypot` rejects silently.
- Rate limit 20 tickets/IP/hour (DO sliding window).
- Rate limit 1000 tickets/workspace/hour (WorkspaceLimiter DO).
- Pending workspaces capped at 100 tickets until claimed.
- `ip_hash = sha256(ip || daily_salt)` for analytics without storing raw IP.

**At claim**
- Email verified, PSL match, blocklist guards (section 6).
- DNS TXT verification via Cloudflare DNS over HTTPS to `1.1.1.1/dns-query`, check `_feedback.<domain>` TXT record for `feedback-verify=<token>`.
- Claim lock DO prevents race.
- Every claim event written to audit log with method + IP hash.

**At fan-out**
- Per-integration HMAC secret, payload signed with `X-Feedback-Signature: sha256=<hex>`.
- Include `X-Feedback-Timestamp`; receivers reject >5min drift.
- Integration credentials encrypted at rest with AES-GCM using workspace-scoped key derived from master key via HKDF.

**General**
- CSRF via Better Auth's built-in token for state-changing admin routes.
- All admin endpoints check `member.organizationId == workspace.better_auth_org_id`.
- D1 queries always include `workspace_id` in WHERE — enforced at the query helper layer, not per-route.

---

## 12. Observability

- **Workers logs** shipped via `tail` to a Logpush destination (R2 bucket) for retention.
- **Analytics Engine** dataset for per-request metrics: route, status, duration, workspace_id.
- **Error tracking**: Sentry-compatible via `toucan-js` (works in Workers).
- **Daily rollup Cron Trigger**: aggregates ticket counts per workspace into `ANALYTICS_KV`.
- **Delivery dashboard**: admin view over `integration_deliveries` with retry/redrive button (re-enqueue to fan-out-queue).

---

## 13. Execution sequence

Rough ordering; adjust for team size.

**Week 1 — Foundation**
- Alchemy config skeleton, all resources provisioned in a dev account.
- D1 schema migrations written and applied.
- Better Auth installed with Organization + Magic Link + GitHub + SSO plugins (UI deferred, schema in).
- Blocklists seeded in KV (import PSL private domains + curated freemail + disposable lists).
- Health check worker deployed; DNS configured for all subdomains.

**Week 2 — Ingestion**
- `POST /api/ticket` with Origin parsing, PSL normalization, blocklist check.
- Auto-workspace creation in `pending` state.
- Rate-limit DOs (RateLimiter + WorkspaceLimiter + ClaimLock).
- Honeypot, spam guards, ip_hash.
- `fingerprint` helper and `/api/vote` endpoint.
- Dummy widget (plain HTML form) end-to-end for testing.

**Week 3 — Widget**
- Preact + htm widget with Shadow DOM.
- Loader + hashed bundle deploy pipeline (Vite → R2 → CDN rule).
- Screenshot via lazy html2canvas + pre-signed R2 upload.
- Cross-site testing on 3 real third-party hosts.

**Week 4 — Claim flow**
- TanStack Start app scaffolded, Better Auth wired.
- `/dashboard/$domain/claim` UI with email-match detection.
- `_feedback.<domain>` DNS TXT verification via DoH.
- Claim state machine, audit logging.
- Invitation flow via Better Auth org plugin.

**Week 5 — Dashboard + public board**
- Ticket list with filters (status, classification).
- Ticket detail with comments, status updates.
- Kanban view over statuses.
- Public board `/b/$domain` with voting, top tickets, roadmap columns.

**Week 6 — Classification + fan-out**
- Classify queue consumer + LLM call (start Workers AI, swap if needed).
- Integrations table + encryption helpers.
- Fan-out consumer, HMAC signing, delivery log.
- Generic webhook integration.
- Slack integration (OAuth + Block Kit).
- Admin UI to add/configure integrations and per-type routes.

**Week 7 — Hardening**
- End-to-end tests (Vitest + Workers local dev).
- Error tracking hooked up.
- Daily rollup cron.
- Admin "redrive DLQ" tool.
- Docs site: install snippet, customization, webhook spec.

**Week 8 — Beta**
- Internal dogfooding on feedback.dev itself.
- 5–10 friendly beta workspaces.
- Monitor + iterate.

Realistic for a two-engineer team; solo needs 10–12 weeks.

---

## 14. Deferred with forward-compat hooks

Each of these is designed in so we don't have to refactor later.

- **Vector similarity / dedup** — add Vectorize namespace per workspace; classify consumer embeds and stores. Dedup check runs before fan-out. Hook: `ticket_embeddings` table and vector index, empty for now.
- **More integrations** — `integrations.kind` is an enum; add new kinds by writing a new file in `apps/api/src/integrations/`.
- **Inbound replies** — add `ticket_messages` table with `direction` column from day one; `comments` becomes a filtered view over it.
- **Research agent** — Cloudflare Workflow triggered from fan-out consumer on `feature` classification when workspace opts in.
- **Per-workspace SSO UI** — plugin already installed, just add `/dashboard/$domain/settings/sso` screen that calls `authClient.sso.register()`.
- **Billing** — wire Stripe via Better Auth's Stripe plugin when first paying customer emerges. Plan limits already enforced in workspace settings JSON.
- **End-user notifications** — add `email` column to tickets (done), add a notify worker later that emails on status changes.

---

## 15. Open questions to resolve before build

1. **LLM choice for classification**: Workers AI (cheap, on-platform) vs. Claude Haiku (better quality, external API). Decision affects cold-start + cost model. Recommend benchmarking both in week 6.
2. **Screenshot strategy**: native `getDisplayMedia` (tiny, needs permission) vs. html2canvas (heavy, works everywhere). Recommend html2canvas with lazy load for MVP, revisit.
3. **Public board route**: `/b/$domain` vs `/$domain`. `/b/` prefix avoids route collisions with marketing pages. Recommend `/b/`.
4. **Email deliverability**: Resend vs. Postmark vs. SES for magic links. Recommend Resend for simplicity.
5. **DNS TXT record location**: `_feedback.<domain>` vs. root TXT. Recommend `_feedback.<domain>`.
6. **Does the dashboard run in the same Worker as the API?** TanStack Start generates a worker; could merge with API or keep separate. Recommend separate to isolate blast radius and allow independent scaling.

---

## 16. Success criteria for Phase 1

- Widget installs with one script tag, submits ticket end-to-end in < 500ms p95.
- Cold start on `/api/ticket` under 100ms p95 (relaxed from 50ms target; realistic).
- Widget core bundle < 8kb gzipped (html2canvas excluded).
- 10 internal test workspaces operating through classify → fan-out to Slack without manual intervention.
- Admin can claim, configure 2+ integrations, and view delivery log for their workspace.
- Zero raw IPs in the database.
- All admin data access scoped by `workspace_id` (enforced by audit of query helpers).

---

*This plan is the backbone for Phase 1. Data model and route map are stable; specific implementations will evolve during the build. Revisit this doc at the end of each week and update the "Open questions" and "Deferred" sections with decisions made.*
