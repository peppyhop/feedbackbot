// Shared "is this user a member of the workspace?" check used by
// every /api/admin/* handler. Centralized so workspace-scoping is
// enforced identically across routes.

import { env } from '#/env'
import { auth } from '#/lib/auth'
import { ApiError } from '#/lib/http'
import { getWorkspaceByDomain, makeDb, type DB } from '#/db/client'
import { normalizeDomain } from '#/lib/domain'
import type { Workspace } from '#/db/schema'

export type AdminContext = {
  userId: string
  workspace: Workspace
}

// Lightweight "is anyone signed in?" guard. Used by routes that
// scope by something other than the workspace-domain query (e.g.
// rename takes a workspace_id in the body, verify-domain looks the
// workspace up by domain) but still need a 401 on unauthenticated
// callers.
export async function requireSession(
  request: Request,
): Promise<{ userId: string }> {
  const session = await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null)
  if (!session?.user) {
    throw new ApiError(401, 'sign in required', 'unauth')
  }
  return { userId: session.user.id }
}

export async function requireAdmin(
  request: Request,
  workspace: Workspace,
): Promise<AdminContext> {
  const session = await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null)
  if (!session?.user) {
    throw new ApiError(401, 'sign in required', 'unauth')
  }
  if (!workspace.betterAuthOrgId) {
    throw new ApiError(403, 'workspace not claimed', 'not_claimed')
  }
  const members = await auth.api
    .listMembers({
      query: { organizationId: workspace.betterAuthOrgId },
      headers: request.headers,
    })
    .catch(() => null)
  const isMember =
    !!members &&
    Array.isArray(members.members) &&
    members.members.some(
      (m: { userId?: string }) => m.userId === session.user.id,
    )
  if (!isMember) {
    throw new ApiError(403, 'not a member', 'not_member')
  }
  return { userId: session.user.id, workspace }
}

// One-stop guard for every /api/admin/* route: parse `?domain=`,
// look up the workspace, check the caller is a signed-in member.
// Returns the live workspace row, the caller's userId, and a DB
// handle each route would otherwise have to construct itself.
//
// Routes used to repeat this six-line preamble; centralising it here
// means every admin route enforces workspace_id scoping identically
// (CLAUDE.md golden rule #2). Test coverage lives next door —
// admin-auth.test.ts pins down all six failure modes plus the happy
// path before a single route gets refactored to call this.
export async function requireAdminWorkspace(
  request: Request,
): Promise<{ workspace: Workspace; userId: string; db: DB }> {
  const url = new URL(request.url)
  const domain = normalizeDomain(url.searchParams.get('domain'))
  if (!domain) throw new ApiError(400, 'bad domain', 'bad_domain')
  const db = makeDb(env.DB)
  const workspace = await getWorkspaceByDomain(db, domain)
  if (!workspace) throw new ApiError(404, 'no workspace', 'no_workspace')
  const ctx = await requireAdmin(request, workspace)
  return { workspace, userId: ctx.userId, db }
}
