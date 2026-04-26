// DELETE /api/admin/members/:memberId?domain=<d>
// Remove a member from the workspace's org. Owner cannot be removed
// here (Better Auth refuses); ownership transfer is a separate flow.

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

async function handle(request: Request, memberId: string): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const url = new URL(request.url)
    const domain = normalizeDomain(url.searchParams.get('domain'))
    if (!domain) throw new ApiError(400, 'bad domain', 'bad_domain')
    if (!memberId) throw new ApiError(400, 'bad member id', 'bad_id')
    const db = makeDb(env.DB)
    const workspace = await getWorkspaceByDomain(db, domain)
    if (!workspace) throw new ApiError(404, 'no workspace', 'no_workspace')
    await requireAdmin(request, workspace)
    if (!workspace.betterAuthOrgId) {
      throw new ApiError(409, 'workspace not claimed', 'no_org')
    }

    await auth.api
      .removeMember({
        body: {
          memberIdOrEmail: memberId,
          organizationId: workspace.betterAuthOrgId,
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
