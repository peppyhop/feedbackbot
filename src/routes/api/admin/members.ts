// GET  /api/admin/members?domain=<d>  → list members + pending invites
// POST /api/admin/members?domain=<d>  → invite a new member, enforces
//                                      the seat cap from entitlements

import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

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
import { entitlementsFor } from '#/lib/billing/entitlements'

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'admin']).default('member'),
})

async function loadWorkspaceWithOrg(request: Request) {
  // requireAdminWorkspace already guarantees betterAuthOrgId is set
  // (it throws not_claimed otherwise) — the cast here just narrows
  // for callers that need the orgId in their type signature.
  const { workspace, db } = await requireAdminWorkspace(request)
  return { db, workspace, orgId: workspace.betterAuthOrgId as string }
}

// Better Auth's listMembers + listInvitations both 200 with potentially-
// undefined shapes; flatten + count the pending rows here so handleList
// and handleInvite stay focused on their seat-cap / response logic.
async function loadMemberAndInviteCounts(
  request: Request,
  orgId: string,
): Promise<{
  members: Array<unknown>
  pendingInvitations: Array<unknown>
}> {
  const [members, invitations] = await Promise.all([
    auth.api
      .listMembers({ query: { organizationId: orgId }, headers: request.headers })
      .catch(() => null),
    auth.api
      .listInvitations({
        query: { organizationId: orgId },
        headers: request.headers,
      })
      .catch(() => null),
  ])
  const memberRows =
    (members as { members?: Array<unknown> } | null)?.members ?? []
  const pendingRows =
    (invitations as Array<unknown> | null)?.filter((row) => {
      const status = (row as { status?: string }).status
      return status === 'pending'
    }) ?? []
  return { members: memberRows, pendingInvitations: pendingRows }
}

async function handleList(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { workspace, orgId } = await loadWorkspaceWithOrg(request)
    const ent = entitlementsFor(workspace.plan)
    const { members: m, pendingInvitations: i } =
      await loadMemberAndInviteCounts(request, orgId)

    return json(
      {
        plan: workspace.plan,
        seats: { used: m.length + i.length, max: ent.max_seats },
        members: m.map((row) => {
          const r = row as {
            id: string
            userId: string
            role: string
            createdAt: number
            user?: { email?: string; name?: string }
          }
          return {
            id: r.id,
            user_id: r.userId,
            email: r.user?.email ?? null,
            name: r.user?.name ?? null,
            role: r.role,
            created_at: r.createdAt,
          }
        }),
        pending_invitations: i.map((row) => {
          const r = row as {
            id: string
            email: string
            role: string
            expiresAt: number
            createdAt?: number
          }
          return {
            id: r.id,
            email: r.email,
            role: r.role,
            expires_at: r.expiresAt,
            created_at: r.createdAt ?? null,
          }
        }),
      },
      { headers: cors },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

async function handleInvite(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { workspace, orgId } = await loadWorkspaceWithOrg(request)
    const body = InviteSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')
    const ent = entitlementsFor(workspace.plan)

    // Seat-cap enforcement: count existing members + pending invites,
    // reject before Better Auth creates the invitation row.
    const { members, pendingInvitations } = await loadMemberAndInviteCounts(
      request,
      orgId,
    )
    if (members.length + pendingInvitations.length >= ent.max_seats) {
      throw new ApiError(
        402,
        `${workspace.plan} plan allows ${ent.max_seats} seat(s); you've used ${members.length + pendingInvitations.length}. Upgrade to add more.`,
        'plan_seat_limit',
      )
    }

    const created = await auth.api
      .createInvitation({
        body: {
          email: body.data.email,
          role: body.data.role,
          organizationId: orgId,
        },
        headers: request.headers,
      })
      .catch((e: unknown) => {
        // Better Auth surfaces "already a member", "duplicate email"
        // etc. as APIError — bubble its message up.
        const msg = e instanceof Error ? e.message : 'invite failed'
        throw new ApiError(400, msg, 'invite_failed')
      })

    return json({ invitation: created }, { headers: cors, status: 201 })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const getMembers = withRequestMetrics('/api/admin/members', handleList)
const postInvite = withRequestMetrics('/api/admin/members', handleInvite)

export const Route = createFileRoute('/api/admin/members')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request }) => getMembers(request),
      POST: async ({ request }) => postInvite(request),
    },
  },
})
