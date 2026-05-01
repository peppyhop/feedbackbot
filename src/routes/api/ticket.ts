import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import {
  createPendingWorkspace,
  getWorkspaceByDomain,
  insertTicket,
  makeDb,
} from '#/db/client'
import { shouldBlockIngestionDomain } from '#/lib/blocklist'
import { daySaltFor, ipHash } from '#/lib/crypto'
import { domainFromHeader, sameRegistrableDomain } from '#/lib/domain'
import { ApiError, apiError, corsHeadersFor, getClientIp, json, optionsResponse } from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { checkIpRate } from '#/do/rate-limiter'
import { checkWorkspaceRate } from '#/do/workspace-limiter'
import {
  TicketSubmitSchema,
  type TicketSubmitResponse,
} from '#/schema/ticket'
import { buildUploadUrl, mintScreenshotToken } from '#/lib/screenshot-token'
import { verifyTurnstile } from '#/lib/turnstile'

const postTicket = withRequestMetrics('/api/ticket', handleSubmit)

export const Route = createFileRoute('/api/ticket')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      POST: async ({ request }) => postTicket(request),
    },
  },
})

async function handleSubmit(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    // 1. Origin / Referer → registrable domain.
    const domain = domainFromHeader(
      request.headers.get('origin'),
      request.headers.get('referer'),
    )
    if (!domain) {
      throw new ApiError(400, 'missing origin or referer', 'bad_origin')
    }

    // 2. Blocklist guard (freemail + disposable).
    if (await shouldBlockIngestionDomain(env.BLOCKLIST_KV, domain)) {
      throw new ApiError(403, 'origin blocked', 'blocked_origin')
    }

    // 3. Parse + validate body.
    const raw = await request.json().catch(() => null)
    const parsed = TicketSubmitSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ApiError(400, 'invalid body', 'bad_body')
    }
    const body = parsed.data
    // honeypot: real users never fill this.
    if (body.honeypot) {
      // Silent success — don't tell bots why.
      return json(
        { ticket_id: 'tkt_dev_null', workspace_state: 'pending' } as TicketSubmitResponse,
        { headers: cors },
      )
    }

    // 4. IP hash (rotates daily; no raw IP in DB).
    const ip = getClientIp(request)
    const hash = await ipHash(ip, daySaltFor(new Date(), env.HMAC_SECRET_SEED))

    // 4a. Turnstile gate. Bypass when secret is unset so local dev
    // and any not-yet-configured stage stay functional. When it's
    // set, every submission must carry a fresh token (single-use
    // server-side — no caching, no retries).
    //
    // Token-hostname rebind: the siteverify response includes the
    // hostname where the challenge was solved. We MUST compare it
    // to the request's Origin, otherwise an attacker with their
    // own verified workspace could mint a token from their own
    // domain and replay it with a forged Origin to attack any
    // other customer's workspace (since every verified customer's
    // domain is on the same Cloudflare allowlist).
    if (env.TURNSTILE_SECRET) {
      if (!body.turnstile_token) {
        throw new ApiError(
          403,
          'turnstile token required',
          'turnstile_required',
        )
      }
      const verify = await verifyTurnstile(
        body.turnstile_token,
        ip,
        env.TURNSTILE_SECRET,
      )
      if (!verify.ok) {
        console.warn('turnstile rejected', {
          codes: verify.codes,
          domain,
        })
        throw new ApiError(403, 'turnstile failed', 'turnstile_failed')
      }
      if (!sameRegistrableDomain(verify.hostname, domain)) {
        console.warn('turnstile hostname mismatch', {
          token_hostname: verify.hostname,
          request_domain: domain,
        })
        throw new ApiError(
          403,
          'turnstile hostname mismatch',
          'turnstile_hostname_mismatch',
        )
      }
    }

    // 5. IP rate limit.
    const ipCheck = await checkIpRate(env.RATE_LIMITER, hash)
    if (!ipCheck.allowed) {
      throw new ApiError(429, 'rate limited', 'rate_limited')
    }

    // 6. Workspace lookup or create (pending state).
    const db = makeDb(env.DB)
    const workspace =
      (await getWorkspaceByDomain(db, domain)) ??
      (await createPendingWorkspace(db, domain))

    // 7. Workspace-level rate + monthly + pending caps. Plan-aware:
    //    the workspace's plan determines the cap (free / starter /
    //    scale → see src/lib/billing/entitlements.ts).
    const wsCheck = await checkWorkspaceRate(env.WORKSPACE_LIMITER, workspace.id, {
      state: workspace.state as 'pending' | 'claimed' | 'suspended',
      plan: workspace.plan,
      currentTotal: workspace.ticketCount,
    })
    if (!wsCheck.allowed) {
      throw new ApiError(429, `workspace limit: ${wsCheck.reason}`, 'rate_limited')
    }

    // 8. Screenshot two-step: mint an R2 key + HMAC-signed URL now,
    // the widget PUTs the PNG to that URL in a second request.
    let screenshotKey: string | null = null
    let screenshotUploadUrl: string | undefined
    if (body.want_screenshot_upload) {
      screenshotKey = `${workspace.id}/${crypto.randomUUID()}.png`
      const token = await mintScreenshotToken(
        env.HMAC_SECRET_SEED,
        'put',
        screenshotKey,
      )
      screenshotUploadUrl = buildUploadUrl(
        new URL(request.url).origin,
        screenshotKey,
        token,
      )
    }

    // 9. Insert ticket + bump workspace counter atomically.
    const ticket = await insertTicket(db, {
      workspaceId: workspace.id,
      message: body.message,
      pageUrl: body.page_url ?? null,
      userAgent: body.user_agent ?? request.headers.get('user-agent') ?? null,
      email: body.email && body.email.length > 0 ? body.email : null,
      ipHash: hash,
      screenshotKey,
    })

    // 10. Enqueue classify job.
    await env.CLASSIFY_QUEUE.send({
      ticket_id: ticket.id,
      workspace_id: workspace.id,
    })

    const response: TicketSubmitResponse = {
      ticket_id: ticket.id,
      workspace_state: workspace.state as 'pending' | 'claimed',
      screenshot_upload_url: screenshotUploadUrl,
      screenshot_key: screenshotKey ?? undefined,
    }
    return json(response, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

