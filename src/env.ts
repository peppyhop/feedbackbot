// Typed Cloudflare env bindings. Shape must match alchemy.run.ts
// output (Task #4). All Worker-side code accesses bindings through
// this module so the shape is a single source of truth.

import { env as _env } from 'cloudflare:workers'

export interface Env {
  // D1
  DB: D1Database

  // KV
  BLOCKLIST_KV: KVNamespace
  ANALYTICS_KV: KVNamespace
  CACHE_KV: KVNamespace

  // R2
  SCREENSHOTS: R2Bucket

  // Queues (producers only — consumers live in separate workers)
  CLASSIFY_QUEUE: Queue<{ ticket_id: string; workspace_id: string }>
  FANOUT_QUEUE: Queue<{ ticket_id: string; workspace_id: string; attempt?: number }>

  // Durable Objects
  RATE_LIMITER: DurableObjectNamespace
  WORKSPACE_LIMITER: DurableObjectNamespace
  CLAIM_LOCK: DurableObjectNamespace

  // Workers AI (Gemma 4) — DECISIONS.md 2026-04-22 #1
  AI: Ai

  // Analytics Engine
  ANALYTICS?: AnalyticsEngineDataset

  // Secrets
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
  INTEGRATIONS_ENCRYPTION_KEY: string // base64-encoded 32 bytes
  HMAC_SECRET_SEED: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  SENTRY_DSN?: string
  SLACK_CLIENT_ID?: string
  SLACK_CLIENT_SECRET?: string
  DODO_PAYMENTS_API_KEY?: string
  DODO_PAYMENTS_WEBHOOK_SECRET?: string
  DODO_PAYMENTS_ENV?: 'test_mode' | 'live_mode'
  // Resend — transactional sender for magic links + future
  // notifications. Verified domain configured at resend.com.
  RESEND_API_KEY?: string
  RESEND_FROM?: string // "FeedbackBot <noreply@usefeedbackbot.com>"
  // Cloudflare Turnstile — gates /api/ticket. Unset → graceful
  // bypass (same pattern as Dodo). Public site key is baked into
  // the widget bundle, not here.
  TURNSTILE_SECRET?: string
  // Cloudflare API access for managing the Turnstile widget's
  // hostname allowlist. On every successful domain verification
  // we PATCH the widget to add the new hostname so the customer's
  // site can mint Turnstile tokens cross-origin. Token scope:
  // Account > Turnstile > Edit (only).
  CF_API_TOKEN?: string
  CF_ACCOUNT_ID?: string
  // Same string as the public site key in the widget bundle.
  CF_TURNSTILE_WIDGET_ID?: string
}

// Typed view of the ambient env provided by cloudflare:workers.
export const env = _env as unknown as Env

// Minimal local types for bindings that don't ship with
// @cloudflare/workers-types as precisely as we want.

export interface Ai {
  run(
    model: string,
    input: {
      messages: Array<{ role: string; content: string }>
      response_format?: {
        type: 'json_schema' | 'json_object'
        json_schema?: unknown
      }
      max_tokens?: number
      temperature?: number
    },
  ): Promise<{
    response?: string
    // Some models return `result` or other wrapping; normalize in
    // the caller.
    [k: string]: unknown
  }>
}

