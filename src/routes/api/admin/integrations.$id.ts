// PATCH /api/admin/integrations/:id?domain=<d>  → update name/enabled (creds re-encrypted if provided)
// DELETE /api/admin/integrations/:id?domain=<d>  → remove integration + cascading routes

import { createFileRoute } from '@tanstack/react-router'
import { eq, and } from 'drizzle-orm'

import { env } from '#/env'
import { getIntegration } from '#/db/client'
import { integrations } from '#/db/schema'
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
import { IntegrationPatchSchema } from '#/schema/integration'

async function loadContext(request: Request, integrationId: string) {
  const { workspace, db } = await requireAdminWorkspace(request)
  const integration = await getIntegration(db, workspace.id, integrationId)
  if (!integration) throw new ApiError(404, 'no integration', 'no_integration')
  return { db, workspace, integration }
}

async function handlePatch(request: Request, id: string): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { db, workspace, integration } = await loadContext(request, id)
    const body = IntegrationPatchSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')

    const updates: Partial<{
      name: string
      enabled: number
      credentials: string
    }> = {}
    if (body.data.name !== undefined) updates.name = body.data.name
    if (body.data.enabled !== undefined) {
      updates.enabled = body.data.enabled ? 1 : 0
    }
    if (body.data.creds) {
      const masterKey = b64ToBytes(env.INTEGRATIONS_ENCRYPTION_KEY)
      const wsKey = await deriveWorkspaceKey(masterKey, workspace.id)
      updates.credentials = await encryptCredentials(wsKey, body.data.creds)
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(integrations)
        .set(updates)
        .where(
          and(
            eq(integrations.workspaceId, workspace.id),
            eq(integrations.id, integration.id),
          ),
        )
    }

    return json({ ok: true }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

async function handleDelete(request: Request, id: string): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { db, workspace, integration } = await loadContext(request, id)
    await db
      .delete(integrations)
      .where(
        and(
          eq(integrations.workspaceId, workspace.id),
          eq(integrations.id, integration.id),
        ),
      )
    // integration_routes cascades via FK ON DELETE CASCADE.
    return json({ ok: true }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const patchOne = withRequestMetrics('/api/admin/integrations/:id', handlePatch)
const deleteOne = withRequestMetrics(
  '/api/admin/integrations/:id',
  handleDelete,
)

export const Route = createFileRoute('/api/admin/integrations/$id')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      PATCH: async ({ request, params }) =>
        patchOne(request as Request, params.id),
      DELETE: async ({ request, params }) =>
        deleteOne(request as Request, params.id),
    },
  },
})
