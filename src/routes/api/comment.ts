import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import {
  getTicket,
  insertComment,
  makeDb,
} from '#/db/client'
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
import { CommentSchema } from '#/schema/comment'

const postComment = withRequestMetrics('/api/comment', handleComment)

export const Route = createFileRoute('/api/comment')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      POST: async ({ request }) => postComment(request),
    },
  },
})

// Public commenting requires a Better Auth session — same
// reasoning as voting (DECISIONS.md 2026-04-29). Anon comments
// would be a spam vector with no upside; by the time someone
// wants to comment they've already invested enough to sign in.
async function handleComment(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { userId } = await requireSession(request)

    const body = CommentSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')

    const db = makeDb(env.DB)
    const workspace = await getWorkspaceFromOrigin(db, request)
    // Only claimed workspaces accept public comments — prevents a
    // pending workspace's future owner getting a flood of spam.
    if (workspace.state !== 'claimed') {
      throw new ApiError(403, 'workspace not claimed', 'not_claimed')
    }

    const ticket = await getTicket(db, workspace.id, body.data.ticket_id)
    if (!ticket) throw new ApiError(404, 'no ticket', 'no_ticket')

    const comment = await insertComment(db, {
      workspaceId: workspace.id,
      ticketId: ticket.id,
      message: body.data.message,
      authorUserId: userId,
      authorName: body.data.author_name ?? null,
      source: 'web',
    })

    return json({ comment }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}
