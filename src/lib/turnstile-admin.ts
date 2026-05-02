// Cloudflare Turnstile admin — programmatically add hostnames to
// our widget's allowlist whenever a customer verifies a new
// domain. Lets the widget work cross-origin without us managing
// the hostname list by hand.
//
// Auth: a Cloudflare API token scoped to "Account > Turnstile >
// Edit" only. Set CF_API_TOKEN, CF_ACCOUNT_ID, and the widget's
// site key (CF_TURNSTILE_WIDGET_ID — same string as the public
// site key baked into the widget bundle).
//
// Failure handling: callers receive a structured result. Both
// success and failure are visible in:
//   - the audit log (caller writes a workspace.turnstile.sync row)
//   - Sentry (final failure → captureMessage)
//   - workspaces.turnstile_synced_at (set on success only)
// The cron reconciler + dashboard banner key off the NULL column.

import { Sentry } from '#/lib/sentry'

const CF_BASE = 'https://api.cloudflare.com/client/v4'

interface CfWidget {
  domains?: Array<string>
}

interface CfApiResponse<T> {
  success: boolean
  result?: T
  errors?: Array<{ code: number; message: string }>
}

interface AdminEnv {
  CF_API_TOKEN?: string
  CF_ACCOUNT_ID?: string
  CF_TURNSTILE_WIDGET_ID?: string
}

export type FailureReason =
  | 'not_configured'
  | 'auth_failed'
  | 'widget_not_found'
  | 'rate_limited'
  | 'cf_api_error'
  | 'network_error'

export type TurnstileSyncResult =
  | { ok: true; hostnames: Array<string>; alreadyPresent: boolean }
  | { ok: false; reason: FailureReason; details: unknown }

export function turnstileAdminConfigured(env: AdminEnv): boolean {
  return Boolean(
    env.CF_API_TOKEN && env.CF_ACCOUNT_ID && env.CF_TURNSTILE_WIDGET_ID,
  )
}

const RETRY_DELAYS_MS = [1000, 2000, 4000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(base: number): number {
  return base + Math.floor(Math.random() * Math.min(base, 500))
}

// HTTP status → reason classification. Determines whether a retry
// is worth attempting and which `reason` we surface.
function classify(status: number): { reason: FailureReason; retry: boolean } {
  if (status === 401 || status === 403) {
    return { reason: 'auth_failed', retry: false }
  }
  if (status === 404) {
    return { reason: 'widget_not_found', retry: false }
  }
  if (status === 429) {
    return { reason: 'rate_limited', retry: true }
  }
  if (status >= 500) {
    return { reason: 'cf_api_error', retry: true }
  }
  return { reason: 'cf_api_error', retry: false }
}

async function cfFetch(
  url: string,
  init: RequestInit,
): Promise<
  { ok: true; data: unknown } | { ok: false; status: number; body: unknown }
> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => null)
  if (res.ok) return { ok: true, data: body }
  return { ok: false, status: res.status, body }
}

export async function addTurnstileHostname(
  domain: string,
  env: AdminEnv,
): Promise<TurnstileSyncResult> {
  if (!turnstileAdminConfigured(env)) {
    return { ok: false, reason: 'not_configured', details: null }
  }
  const widgetUrl =
    `${CF_BASE}/accounts/${env.CF_ACCOUNT_ID}` +
    `/challenges/widgets/${env.CF_TURNSTILE_WIDGET_ID}`
  const auth = { authorization: `Bearer ${env.CF_API_TOKEN}` }

  let lastErr: Extract<TurnstileSyncResult, { ok: false }> | null = null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(jitter(RETRY_DELAYS_MS[attempt - 1]!))
    }
    try {
      // 1) GET current hostnames.
      const getRes = await cfFetch(widgetUrl, { headers: auth })
      if (!getRes.ok) {
        const { reason, retry } = classify(getRes.status)
        lastErr = { ok: false, reason, details: getRes.body }
        if (!retry) break
        continue
      }
      const data = getRes.data as CfApiResponse<CfWidget>
      if (!data.success) {
        // Application-level rejection from CF — non-retryable.
        lastErr = { ok: false, reason: 'cf_api_error', details: data.errors }
        break
      }
      const widget = (data.result ?? {}) as Record<string, unknown> & CfWidget
      const current = new Set(widget.domains ?? [])
      if (current.has(domain)) {
        return {
          ok: true,
          hostnames: Array.from(current),
          alreadyPresent: true,
        }
      }
      current.add(domain)

      // 2) PUT with the updated domains.
      //
      // Cloudflare's Turnstile API doesn't accept PATCH for token
      // auth (returns 10405) — full PUT only. Body shape is a
      // strict allowlist: round-tripping the entire GET response
      // gets rejected because GET includes server-generated
      // fields PUT doesn't accept (sitekey, secret, created_on,
      // modified_on, etc.). Whitelist only the writable fields
      // documented for the update endpoint — anything we don't
      // pass is preserved server-side AFAICT, but `name` and
      // `mode` are de-facto required so we always carry them.
      const writableKeys = [
        'name',
        'mode',
        'domains',
        'bot_fight_mode',
        'clearance_level',
        'region',
        'offlabel',
        'ephemeral_id',
      ] as const
      const putBody: Record<string, unknown> = {}
      for (const key of writableKeys) {
        if (key in widget) putBody[key] = widget[key]
      }
      putBody.domains = Array.from(current)

      const putRes = await cfFetch(widgetUrl, {
        method: 'PUT',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify(putBody),
      })
      if (!putRes.ok) {
        const { reason, retry } = classify(putRes.status)
        lastErr = { ok: false, reason, details: putRes.body }
        if (!retry) break
        continue
      }
      const putData = putRes.data as CfApiResponse<CfWidget>
      if (!putData.success) {
        lastErr = {
          ok: false,
          reason: 'cf_api_error',
          details: putData.errors,
        }
        break
      }
      return {
        ok: true,
        hostnames: putData.result?.domains ?? Array.from(current),
        alreadyPresent: false,
      }
    } catch (err) {
      // Network errors are retryable.
      lastErr = {
        ok: false,
        reason: 'network_error',
        details: err instanceof Error ? err.message : String(err),
      }
    }
  }

  const failure = lastErr ?? {
    ok: false as const,
    reason: 'cf_api_error' as const,
    details: 'unknown',
  }
  try {
    Sentry.captureMessage('turnstile-admin: hostname add failed', {
      level: 'error',
      extra: {
        domain,
        reason: failure.reason,
        details: failure.details,
      },
    })
  } catch {
    // Sentry not initialized in tests / local dev — don't mask the
    // underlying failure.
  }
  return failure
}

// Operator-only: GET the current widget config so we can see the
// allowlist + diagnose why an add failed (token scope, wrong
// widget id, etc.). Used by /api/admin/turnstile-debug.
export async function getTurnstileWidget(
  env: AdminEnv,
): Promise<
  | { ok: true; widget: unknown }
  | { ok: false; reason: FailureReason; details: unknown }
> {
  if (!turnstileAdminConfigured(env)) {
    return { ok: false, reason: 'not_configured', details: null }
  }
  const widgetUrl =
    `${CF_BASE}/accounts/${env.CF_ACCOUNT_ID}` +
    `/challenges/widgets/${env.CF_TURNSTILE_WIDGET_ID}`
  try {
    const res = await cfFetch(widgetUrl, {
      headers: { authorization: `Bearer ${env.CF_API_TOKEN}` },
    })
    if (!res.ok) {
      return { ok: false, reason: classify(res.status).reason, details: res.body }
    }
    return { ok: true, widget: res.data }
  } catch (err) {
    return {
      ok: false,
      reason: 'network_error',
      details: err instanceof Error ? err.message : String(err),
    }
  }
}
