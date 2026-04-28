// GET /api/admin/integrations/:id/slack-channels?domain=<d>
// Decrypts the stored Slack bot token and lists channels for the
// integrations-page picker.

import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { getIntegration } from '#/db/client'
import {
  b64ToBytes,
  decryptCredentials,
  deriveWorkspaceKey,
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
import { IntegrationCredsSchema } from '#/schema/integration'
import { listSlackChannels } from '#/integrations-core/slack/channels'

async function handle(request: Request, integrationId: string): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { workspace, db } = await requireAdminWorkspace(request)

    const integration = await getIntegration(db, workspace.id, integrationId)
    if (!integration) throw new ApiError(404, 'no integration', 'no_integration')
    if (integration.kind !== 'slack') {
      throw new ApiError(400, 'not a slack integration', 'wrong_kind')
    }

    const masterKey = b64ToBytes(env.INTEGRATIONS_ENCRYPTION_KEY)
    const wsKey = await deriveWorkspaceKey(masterKey, workspace.id)
    const decrypted = await decryptCredentials<unknown>(
      wsKey,
      integration.credentials,
    )
    const creds = IntegrationCredsSchema.safeParse(decrypted)
    if (!creds.success || creds.data.kind !== 'slack') {
      throw new ApiError(500, 'bad creds on file', 'bad_creds')
    }

    const channels = await listSlackChannels(creds.data.access_token)
    return json({ channels }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const listChannels = withRequestMetrics(
  '/api/admin/integrations/:id/slack-channels',
  handle,
)

export const Route = createFileRoute(
  '/api/admin/integrations/$id/slack-channels',
)({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request, params }) =>
        listChannels(request as Request, params.id),
    },
  },
})
