// GET /api/admin/deliveries?domain=<d>&status=&integration_id=&since=
// Lists recent deliveries with integration name + ticket snippet for
// the admin UI.

import { createFileRoute } from '@tanstack/react-router'
import { and, eq, inArray } from 'drizzle-orm'

import {
  listDeliveries,
  type DeliveryStatus,
} from '#/db/client'
import { integrations, tickets } from '#/db/schema'
import {
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdminWorkspace } from '#/lib/admin-auth'

const DELIVERY_STATUSES: ReadonlyArray<DeliveryStatus> = [
  'pending',
  'delivered',
  'failed',
  'dead',
]

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { workspace, db } = await requireAdminWorkspace(request)
    const url = new URL(request.url)

    const rawStatus = url.searchParams.get('status')
    const status = DELIVERY_STATUSES.includes(rawStatus as DeliveryStatus)
      ? (rawStatus as DeliveryStatus)
      : undefined
    const integrationId = url.searchParams.get('integration_id') ?? undefined
    const sinceRaw = url.searchParams.get('since')
    const since = sinceRaw ? Number(sinceRaw) : undefined

    const deliveries = await listDeliveries(db, workspace.id, {
      status,
      integrationId,
      since: Number.isFinite(since) ? since : undefined,
      limit: 200,
    })

    // Batch-hydrate integrations + tickets — one query per type
    // regardless of how many deliveries reference them.
    const integrationIds = Array.from(new Set(deliveries.map((d) => d.integrationId)))
    const ticketIds = Array.from(new Set(deliveries.map((d) => d.ticketId)))

    const [integrationRows, ticketRows] = await Promise.all([
      integrationIds.length
        ? db
            .select({
              id: integrations.id,
              kind: integrations.kind,
              name: integrations.name,
            })
            .from(integrations)
            .where(
              and(
                eq(integrations.workspaceId, workspace.id),
                inArray(integrations.id, integrationIds),
              ),
            )
        : Promise.resolve([]),
      ticketIds.length
        ? db
            .select({
              id: tickets.id,
              message: tickets.message,
              classification: tickets.classification,
            })
            .from(tickets)
            .where(
              and(
                eq(tickets.workspaceId, workspace.id),
                inArray(tickets.id, ticketIds),
              ),
            )
        : Promise.resolve([]),
    ])

    const integrationById = new Map(integrationRows.map((r) => [r.id, r]))
    const ticketById = new Map(ticketRows.map((r) => [r.id, r]))

    return json(
      {
        deliveries: deliveries.map((d) => ({
          id: d.id,
          integration: integrationById.get(d.integrationId) ?? null,
          ticket: ticketById.get(d.ticketId)
            ? {
                id: d.ticketId,
                message: ticketById.get(d.ticketId)!.message.slice(0, 240),
                classification: ticketById.get(d.ticketId)!.classification,
              }
            : { id: d.ticketId, message: null, classification: null },
          status: d.status,
          attempts: d.attempts,
          last_error: d.lastError,
          response_code: d.responseCode,
          request_body: d.requestBody,
          response_body: d.responseBody,
          created_at: d.createdAt,
          delivered_at: d.deliveredAt,
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

const listAdminDeliveries = withRequestMetrics(
  '/api/admin/deliveries',
  handle,
)

export const Route = createFileRoute('/api/admin/deliveries')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request }) => listAdminDeliveries(request),
    },
  },
})
