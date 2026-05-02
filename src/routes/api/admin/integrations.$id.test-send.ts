// POST /api/admin/integrations/:id/test-send?domain=<d>
//
// Sends a synthetic OutboundTicketPayload to the integration's
// configured destination (with the same HMAC signing the real
// fanout uses) and returns the response status + body. Lets a
// customer verify their endpoint BEFORE a real ticket lands.
//
// The synthetic payload uses ticket id `tkt_test_<hex>` and a
// `delivery.id` of `dlv_test_<hex>` so receivers can either
// recognize-and-ignore or treat it like a real one. We do NOT
// write a row to integration_deliveries — this is a probe, not
// real customer activity.

import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { getIntegration } from '#/db/client'
import { b64ToBytes, deriveWorkspaceKey, decryptCredentials } from '#/lib/crypto'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdminWorkspace } from '#/lib/admin-auth'
import { getDispatcher } from '#/integrations-core/registry'
import {
  IntegrationCredsSchema,
  type IntegrationCreds,
  type OutboundTicketPayload,
} from '#/schema/integration'

function buildSyntheticPayload(domain: string): OutboundTicketPayload {
  const id = Math.random().toString(36).slice(2, 10)
  return {
    event: 'ticket.created',
    workspace: { id: 'ws_test', domain },
    ticket: {
      id: `tkt_test_${id}`,
      message:
        'This is a test delivery from FeedbackBot. If you can read this, your webhook is wired up correctly.',
      page_url: `https://${domain}/`,
      email: null,
      created_at: Date.now(),
      classification: {
        primary: 'feature',
        secondary: [],
        confidence: 1,
        summary: 'test delivery',
        suggested_title: 'FeedbackBot test event',
      },
    },
    delivery: { id: `dlv_test_${id}`, attempt: 0 },
  }
}

async function handle(request: Request, integrationId: string): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { workspace, db } = await requireAdminWorkspace(request)
    const integration = await getIntegration(db, workspace.id, integrationId)
    if (!integration) throw new ApiError(404, 'no integration', 'no_integration')

    const masterKey = b64ToBytes(env.INTEGRATIONS_ENCRYPTION_KEY)
    const wsKey = await deriveWorkspaceKey(masterKey, workspace.id)
    const credsPlain = await decryptCredentials(wsKey, integration.credentials)
    // Validate the decrypted shape — don't trust DB-stored blobs blindly.
    const credsParsed = IntegrationCredsSchema.safeParse(credsPlain)
    if (!credsParsed.success) {
      throw new ApiError(500, 'bad creds shape', 'bad_creds')
    }
    const creds: IntegrationCreds = credsParsed.data

    const dispatcher = getDispatcher(integration.kind as IntegrationCreds['kind'])
    const payload = buildSyntheticPayload(workspace.domain)
    const result = await dispatcher.dispatch({
      creds,
      // routeConfig is integration-kind specific; for webhook it's
      // ignored, for slack the dispatcher requires a channel — but
      // a test-send for slack would need the channel param too.
      // Surface that as a "configure routes first" error rather
      // than 500'ing.
      routeConfig: {},
      payload,
      hmacSeed: env.HMAC_SECRET_SEED,
    })

    return json(
      {
        ok: result.ok,
        response_code: result.responseCode,
        response_body: result.responseBody,
        error: result.error ?? null,
      },
      { headers: cors },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const testSend = withRequestMetrics(
  '/api/admin/integrations/:id/test-send',
  handle,
)

export const Route = createFileRoute('/api/admin/integrations/$id/test-send')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      POST: async ({ request, params }) =>
        testSend(request as Request, params.id),
    },
  },
})
