import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { getTicket, insertVote, makeDb } from '#/db/client'
import { daySaltFor, ipHash } from '#/lib/crypto'
import { voteFingerprint, VOTE_COOKIE, VOTE_COOKIE_MAX_AGE, newAnonCookieId } from '#/lib/fingerprint'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  getClientIp,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { getWorkspaceFromOrigin } from '#/lib/workspace-scope'
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

async function handleVote(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const body = VoteSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')

    const db = makeDb(env.DB)
    const workspace = await getWorkspaceFromOrigin(db, request)

    const ticket = await getTicket(db, workspace.id, body.data.ticket_id)
    if (!ticket) throw new ApiError(404, 'no ticket', 'no_ticket')

    // Fingerprint = cookieId + ipHash (HMAC'd with server seed).
    const cookie = readCookie(request, VOTE_COOKIE) ?? newAnonCookieId()
    const ip = getClientIp(request)
    const hash = await ipHash(ip, daySaltFor(new Date(), env.HMAC_SECRET_SEED))
    const fp = await voteFingerprint({
      cookieId: cookie,
      ipHash: hash,
      hmacSeed: env.HMAC_SECRET_SEED,
    })

    const result = await insertVote(db, workspace.id, ticket.id, fp)

    const response: VoteResponse = {
      upvotes: result.upvotes,
      voted: result.inserted,
    }
    const res = json(response, { headers: cors })
    // Persist anon cookie for 1y if newly minted.
    if (!readCookie(request, VOTE_COOKIE)) {
      res.headers.append(
        'set-cookie',
        `${VOTE_COOKIE}=${cookie}; Max-Age=${VOTE_COOKIE_MAX_AGE}; Path=/; SameSite=None; Secure; HttpOnly`,
      )
    }
    return res
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=')
  }
  return null
}
