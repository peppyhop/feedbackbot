import { createFileRoute } from '@tanstack/react-router'

import { listTickets } from '#/db/client'
import {
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdminWorkspace } from '#/lib/admin-auth'
import { ClassificationKindSchema, TicketStatusSchema } from '#/schema/ticket'

const getAdminTickets = withRequestMetrics('/api/admin/tickets', handleList)

export const Route = createFileRoute('/api/admin/tickets')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request }) => getAdminTickets(request),
    },
  },
})

async function handleList(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { workspace, db } = await requireAdminWorkspace(request)
    const url = new URL(request.url)

    const statusParam = url.searchParams.get('status')
    const classParam = url.searchParams.get('classification')
    const statusResult = statusParam ? TicketStatusSchema.safeParse(statusParam) : null
    const classResult = classParam ? ClassificationKindSchema.safeParse(classParam) : null

    const tickets = await listTickets(db, workspace.id, {
      status: statusResult?.success ? statusResult.data : undefined,
      classification: classResult?.success ? classResult.data : undefined,
    })

    return json({ tickets }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}
