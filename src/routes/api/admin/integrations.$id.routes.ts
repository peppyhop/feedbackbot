// PUT /api/admin/integrations/:id/routes?domain=<d>
// Replaces all routes for this integration with the supplied set.
// Body: { routes: [{ticket_type, config}] }

import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import {
  deleteRoutesForIntegration,
  getIntegration,
  insertRoute,
  listRoutesForIntegration,
} from '#/db/client'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdminWorkspace } from '#/lib/admin-auth'
import { ClassificationKindSchema } from '#/schema/ticket'

const RoutesReplaceSchema = z.object({
  routes: z.array(
    z.object({
      ticket_type: ClassificationKindSchema.exclude(['spam']),
      config: z.record(z.string(), z.unknown()).default({}),
    }),
  ),
})

async function loadContext(request: Request, integrationId: string) {
  const { workspace, db } = await requireAdminWorkspace(request)
  const integration = await getIntegration(db, workspace.id, integrationId)
  if (!integration) throw new ApiError(404, 'no integration', 'no_integration')
  return { db, workspace, integration }
}

async function handleGet(request: Request, id: string): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { db, workspace, integration } = await loadContext(request, id)
    const rows = await listRoutesForIntegration(
      db,
      workspace.id,
      integration.id,
    )
    return json(
      {
        routes: rows.map((r) => ({
          id: r.id,
          ticket_type: r.ticketType,
          config: safeParse(r.config),
          enabled: r.enabled === 1,
        })),
      },
      { headers: cors },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

async function handlePut(request: Request, id: string): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { db, workspace, integration } = await loadContext(request, id)
    const body = RoutesReplaceSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')

    await deleteRoutesForIntegration(db, workspace.id, integration.id)
    for (const r of body.data.routes) {
      await insertRoute(db, {
        workspaceId: workspace.id,
        integrationId: integration.id,
        ticketType: r.ticket_type,
        config: JSON.stringify(r.config),
      })
    }

    return json({ ok: true, count: body.data.routes.length }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const getRoutes = withRequestMetrics(
  '/api/admin/integrations/:id/routes',
  handleGet,
)
const putRoutes = withRequestMetrics(
  '/api/admin/integrations/:id/routes',
  handlePut,
)

export const Route = createFileRoute('/api/admin/integrations/$id/routes')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request, params }) =>
        getRoutes(request as Request, params.id),
      PUT: async ({ request, params }) =>
        putRoutes(request as Request, params.id),
    },
  },
})

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
