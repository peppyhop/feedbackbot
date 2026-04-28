// DELETE /api/admin/invitations/:invitationId?domain=<d>
// Cancel a pending invitation. Frees a seat for re-invite.

import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdminWorkspace } from '#/lib/admin-auth'

async function handle(
  request: Request,
  invitationId: string,
): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    if (!invitationId) throw new ApiError(400, 'bad invitation id', 'bad_id')
    await requireAdminWorkspace(request)

    await auth.api
      .cancelInvitation({
        body: { invitationId },
        headers: request.headers,
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'cancel failed'
        throw new ApiError(400, msg, 'cancel_failed')
      })

    return json({ cancelled: true, id: invitationId }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const deleteInvitation = withRequestMetrics(
  '/api/admin/invitations/:id',
  handle,
)

export const Route = createFileRoute(
  '/api/admin/invitations/$invitationId',
)({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      DELETE: async ({ request, params }) =>
        deleteInvitation(request as Request, params.invitationId),
    },
  },
})
