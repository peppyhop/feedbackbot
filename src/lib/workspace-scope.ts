// Helpers that resolve a Request to a workspace under different
// scoping rules. Centralised so every route that ingests via the
// widget (Origin-keyed) or admin (?domain= + session) gets the
// same error semantics.

import type { DB } from '#/db/client'
import { getWorkspaceByDomain } from '#/db/client'
import type { Workspace } from '#/db/schema'
import { ApiError } from '#/lib/http'
import { domainFromHeader } from '#/lib/domain'

// Public widget endpoints (/api/ticket, /api/vote, /api/comment,
// /api/widget-config) all key off the request's Origin/Referer to
// derive the workspace. This wraps that lookup with the same 400/404
// semantics every caller needs, so they stop repeating the same six
// lines of boilerplate.
export async function getWorkspaceFromOrigin(
  db: DB,
  request: Request,
): Promise<Workspace> {
  const domain = domainFromHeader(
    request.headers.get('origin'),
    request.headers.get('referer'),
  )
  if (!domain) throw new ApiError(400, 'bad origin', 'bad_origin')
  const ws = await getWorkspaceByDomain(db, domain)
  if (!ws) throw new ApiError(404, 'no workspace', 'no_workspace')
  return ws
}
