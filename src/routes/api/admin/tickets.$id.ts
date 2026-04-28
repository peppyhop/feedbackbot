// GET / PATCH / DELETE a single ticket under a workspace.
//   GET    → { ticket, comments }
//   PATCH  → update status/classification override
//   DELETE → soft-delete (sets status='closed' and clears fanout-path
//            meta; we keep the row for audit history)

import { createFileRoute } from '@tanstack/react-router'

import {
  getTicket,
  listComments,
  patchTicket,
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
import { TicketPatchSchema } from '#/schema/ticket'

async function loadContext(request: Request, ticketId: string) {
  const { workspace, db } = await requireAdminWorkspace(request)
  const ticket = await getTicket(db, workspace.id, ticketId)
  if (!ticket) throw new ApiError(404, 'no ticket', 'no_ticket')
  return { db, workspace, ticket }
}

async function handleGet(request: Request, ticketId: string): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { db, workspace, ticket } = await loadContext(request, ticketId)
    const comments = await listComments(db, workspace.id, ticket.id)
    return json({ ticket, comments }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

async function handlePatch(
  request: Request,
  ticketId: string,
): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { db, workspace, ticket } = await loadContext(request, ticketId)
    const body = TicketPatchSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')
    await patchTicket(db, workspace.id, ticket.id, body.data)
    return json({ ok: true }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

async function handleDelete(
  request: Request,
  ticketId: string,
): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { db, workspace, ticket } = await loadContext(request, ticketId)
    await patchTicket(db, workspace.id, ticket.id, { status: 'closed' })
    return json({ ok: true }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const getOne = withRequestMetrics('/api/admin/tickets/:id', handleGet)
const patchOne = withRequestMetrics('/api/admin/tickets/:id', handlePatch)
const deleteOne = withRequestMetrics('/api/admin/tickets/:id', handleDelete)

export const Route = createFileRoute('/api/admin/tickets/$id')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request, params }) => getOne(request as Request, params.id),
      PATCH: async ({ request, params }) =>
        patchOne(request as Request, params.id),
      DELETE: async ({ request, params }) =>
        deleteOne(request as Request, params.id),
    },
  },
})
