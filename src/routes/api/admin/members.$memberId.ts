// DELETE /api/admin/members/:memberId?domain=<d>
// Remove a member from the workspace's org. Owner cannot be removed
// here (Better Auth refuses); ownership transfer is a separate flow.

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

async function handle(request: Request, memberId: string): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    if (!memberId) throw new ApiError(400, 'bad member id', 'bad_id')
    const { workspace } = await requireAdminWorkspace(request)

    await auth.api
      .removeMember({
        body: {
          memberIdOrEmail: memberId,
          organizationId: workspace.betterAuthOrgId as string,
        },
        headers: request.headers,
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'remove failed'
        throw new ApiError(400, msg, 'remove_failed')
      })

    return json({ removed: true, member_id: memberId }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const deleteMember = withRequestMetrics('/api/admin/members/:id', handle)

export const Route = createFileRoute('/api/admin/members/$memberId')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      DELETE: async ({ request, params }) =>
        deleteMember(request as Request, params.memberId),
    },
  },
})
