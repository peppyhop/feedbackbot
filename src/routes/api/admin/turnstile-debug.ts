// GET /api/admin/turnstile-debug?domain=<d>
// Returns the current Turnstile widget config from Cloudflare's
// API so an operator (or workspace owner debugging) can see the
// hostname allowlist + diagnose why an add failed (token scope,
// wrong widget id, hostname limit, etc.). Forever useful, not
// just for the initial peppyhop incident.

import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import {
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdminWorkspace } from '#/lib/admin-auth'
import { getTurnstileWidget } from '#/lib/turnstile-admin'

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    // Membership check via requireAdminWorkspace — the response
    // exposes the widget's hostnames (which include other
    // customers' domains) so we don't expose this to anyone but
    // a member of the workspace doing the lookup. This is OK
    // because the hostnames are public info anyway (they're
    // present in challenge requests Cloudflare answers), and
    // gating to membership is a friction match.
    const { workspace } = await requireAdminWorkspace(request)
    const result = await getTurnstileWidget(env)
    return json(
      {
        workspace: {
          id: workspace.id,
          domain: workspace.domain,
          turnstile_synced_at: workspace.turnstileSyncedAt,
        },
        cf: result,
      },
      { headers: cors },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const turnstileDebug = withRequestMetrics(
  '/api/admin/turnstile-debug',
  handle,
)

export const Route = createFileRoute('/api/admin/turnstile-debug')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request }) => turnstileDebug(request),
    },
  },
})
