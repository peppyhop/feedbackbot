// DELETE /api/admin/invitations/:invitationId?domain=<d>
// Cancel a pending invitation. Frees a seat for re-invite.

import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { auth } from '#/lib/auth'
import { getWorkspaceByDomain, makeDb } from '#/db/client'
import { normalizeDomain } from '#/lib/domain'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdmin } from '#/lib/admin-auth'

async function handle(
  request: Request,
  invitationId: string,
): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const url = new URL(request.url)
    const domain = normalizeDomain(url.searchParams.get('domain'))
    if (!domain) throw new ApiError(400, 'bad domain', 'bad_domain')
    if (!invitationId) throw new ApiError(400, 'bad invitation id', 'bad_id')
    const db = makeDb(env.DB)
    const workspace = await getWorkspaceByDomain(db, domain)
    if (!workspace) throw new ApiError(404, 'no workspace', 'no_workspace')
    await requireAdmin(request, workspace)

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
