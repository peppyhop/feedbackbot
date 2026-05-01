import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { getTicket, insertVote, makeDb } from '#/db/client'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { getWorkspaceFromOrigin } from '#/lib/workspace-scope'
import { requireSession } from '#/lib/admin-auth'
import { VoteSchema, type VoteResponse } from '#/schema/vote'

const postVote = withRequestMetrics('/api/vote', handleVote)

export const Route = createFileRoute('/api/vote')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      POST: async ({ request }) => postVote(request),
    },
  },
})

// Voting requires a Better Auth session. By the time a visitor is
// browsing the public roadmap, the auth ask is reasonable: they've
// already invested enough to navigate to the board, and gating
// here kills the spam vector that the earlier anon
// cookie+IP-fingerprint pipeline tried to paper over.
async function handleVote(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { userId } = await requireSession(request)

    const body = VoteSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')

    const db = makeDb(env.DB)
    const workspace = await getWorkspaceFromOrigin(db, request)

    const ticket = await getTicket(db, workspace.id, body.data.ticket_id)
    if (!ticket) throw new ApiError(404, 'no ticket', 'no_ticket')

    const result = await insertVote(db, workspace.id, ticket.id, userId)

    const response: VoteResponse = {
      upvotes: result.upvotes,
      voted: result.inserted,
    }
    return json(response, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}
