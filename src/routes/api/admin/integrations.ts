// GET  /api/admin/integrations?domain=<d>    → list
// POST /api/admin/integrations?domain=<d>    → create (encrypt creds)

import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import {
  insertIntegration,
  insertRoute,
  listIntegrations,
} from '#/db/client'
import {
  b64ToBytes,
  deriveWorkspaceKey,
  encryptCredentials,
} from '#/lib/crypto'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdminWorkspace } from '#/lib/admin-auth'
import { IntegrationCreateSchema } from '#/schema/integration'
import { entitlementsFor } from '#/lib/billing/entitlements'

async function handleList(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { db, workspace } = await requireAdminWorkspace(request)
    const rows = await listIntegrations(db, workspace.id)
    // Never return credentials — even encrypted.
    const safe = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      enabled: r.enabled === 1,
      createdAt: r.createdAt,
    }))
    return json({ integrations: safe }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

async function handleCreate(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { db, workspace } = await requireAdminWorkspace(request)
    const body = IntegrationCreateSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')

    // Plan gate — refuse if the workspace already has the maximum
    // number of integrations for its tier.
    const ent = entitlementsFor(workspace.plan)
    const existing = await listIntegrations(db, workspace.id)
    if (existing.length >= ent.max_integrations) {
      throw new ApiError(
        402,
        `${workspace.plan} plan allows up to ${ent.max_integrations} integration(s); upgrade to add more`,
        'plan_limit',
      )
    }

    const masterKey = b64ToBytes(env.INTEGRATIONS_ENCRYPTION_KEY)
    const wsKey = await deriveWorkspaceKey(masterKey, workspace.id)
    const encrypted = await encryptCredentials(wsKey, body.data.creds)

    const integration = await insertIntegration(db, {
      workspaceId: workspace.id,
      kind: body.data.creds.kind,
      name: body.data.name,
      encryptedCredentials: encrypted,
    })

    for (const r of body.data.routes) {
      await insertRoute(db, {
        workspaceId: workspace.id,
        integrationId: integration.id,
        ticketType: r.ticket_type,
        config: JSON.stringify(r.config),
      })
    }

    return json(
      {
        integration: {
          id: integration.id,
          kind: integration.kind,
          name: integration.name,
          enabled: integration.enabled === 1,
          createdAt: integration.createdAt,
        },
      },
      { headers: cors, status: 201 },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const getIntegrations = withRequestMetrics(
  '/api/admin/integrations',
  handleList,
)
const postIntegration = withRequestMetrics(
  '/api/admin/integrations',
  handleCreate,
)

export const Route = createFileRoute('/api/admin/integrations')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request }) => getIntegrations(request),
      POST: async ({ request }) => postIntegration(request),
    },
  },
})
