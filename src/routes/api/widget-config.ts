// GET /api/widget-config
// Public — called by widget bundle on init. Reads the workspace plan
// (resolved from Origin/Referer header → registrable domain) and
// returns the entitlement flags the widget needs (currently just
// `remove_branding`). Heavily cached at the edge — plan changes
// propagate within minutes, not seconds.

import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { getWorkspaceByDomain, makeDb } from '#/db/client'
import { domainFromHeader } from '#/lib/domain'
import {
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { entitlementsFor } from '#/lib/billing/entitlements'

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const domain = domainFromHeader(
      request.headers.get('origin'),
      request.headers.get('referer'),
    )
    if (!domain) {
      // Unknown caller — return safe defaults (watermark on).
      return json(
        { remove_branding: false, plan: null },
        { headers: cors },
      )
    }
    const db = makeDb(env.DB)
    const workspace = await getWorkspaceByDomain(db, domain)
    const ent = entitlementsFor(workspace?.plan ?? 'free')
    return json(
      {
        plan: workspace?.plan ?? null,
        remove_branding: ent.remove_branding,
      },
      {
        headers: {
          ...cors,
          // 5 min browser, 30 min edge — fast plan-flip propagation
          // without hammering D1 on every widget bootstrap.
          'cache-control': 'public, max-age=300, s-maxage=1800',
        },
      },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const getWidgetConfig = withRequestMetrics('/api/widget-config', handle)

export const Route = createFileRoute('/api/widget-config')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request }) => getWidgetConfig(request),
    },
  },
})
