import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import {
  getWorkspaceByDomain,
  makeDb,
  markWorkspaceClaimed,
  writeAudit,
} from '#/db/client'
import { normalizeDomain } from '#/lib/domain'
import { verifyDomainTxt } from '#/lib/dns'
import { daySaltFor, ipHash } from '#/lib/crypto'
import { acquireClaimLock } from '#/do/claim-lock'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  getClientIp,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { VerifyDomainSchema, type VerifyDomainResponse } from '#/schema/claim'
import { auth } from '#/lib/auth'
import { requireSession } from '#/lib/admin-auth'
import { addTurnstileHostname } from '#/lib/turnstile-admin'

const postVerify = withRequestMetrics('/api/verify-domain', handle)

export const Route = createFileRoute('/api/verify-domain')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      POST: async ({ request }) => postVerify(request),
    },
  },
})

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const body = VerifyDomainSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')
    const domain = normalizeDomain(body.data.domain)
    if (!domain) throw new ApiError(400, 'bad domain', 'bad_domain')

    const { userId } = await requireSession(request)
    const db = makeDb(env.DB)
    const workspace = await getWorkspaceByDomain(db, domain)
    if (!workspace) throw new ApiError(404, 'no workspace', 'no_workspace')

    const check = await verifyDomainTxt(domain, workspace.verificationToken)
    const response: VerifyDomainResponse = {
      verified: check.verified,
      checked_record: `_feedback.${domain}`,
      found_values: check.found,
    }

    if (!check.verified) return json(response, { headers: cors })

    // DNS verified — register the domain with Cloudflare Turnstile
    // so the widget can mint tokens cross-origin from the
    // customer's site. Awaited (not fire-and-forget) because Worker
    // pending promises are cancelled at response time without
    // waitUntil. Adds ~2 round-trips of latency to a once-per-
    // workspace call; helper logs and returns false on failure so
    // verification still completes — the widget will 403 from this
    // hostname until reconciled.
    const turnstileOk = await addTurnstileHostname(domain, env)
    if (!turnstileOk) {
      console.warn('turnstile hostname add failed', { domain })
    }

    // DNS verified — transition workspace to claimed. First caller
    // wins owner; subsequent claim-attempts via email-match add
    // themselves as members (handled in a different endpoint).
    if (workspace.state === 'pending') {
      const lock = await acquireClaimLock(env.CLAIM_LOCK, domain, userId)
      console.log('verify-domain.claim-lock', {
        domain,
        user_id: userId,
        acquired: lock.acquired,
        owner_user_id: lock.owner_user_id,
      })
      if (lock.acquired) {
        // Payment-first flow pre-creates the org at signup, so reuse
        // it if present. Widget-first flow has no org yet — create.
        let orgId = workspace.betterAuthOrgId
        if (!orgId) {
          const org = await auth.api
            .createOrganization({
              body: { name: domain, slug: domain },
              headers: request.headers,
            })
            .catch((e: unknown) => {
              console.error('createOrganization failed', e)
              return null
            })
          if (!org?.id) {
            throw new ApiError(500, 'org creation failed', 'org_failed')
          }
          orgId = org.id
        }
        await markWorkspaceClaimed(db, workspace.id, orgId)

        const ip = getClientIp(request)
        const hash = await ipHash(ip, daySaltFor(new Date(), env.HMAC_SECRET_SEED))
        await writeAudit(db, {
          workspaceId: workspace.id,
          action: 'workspace.claim.dns',
          actorUserId: userId,
          actorIpHash: hash,
          metadata: { domain, method: 'dns' },
        })
      } else if (lock.owner_user_id !== userId) {
        // Lock held by a different user (usually an orphan anonymous
        // user from before the magic-link merge). Claim the workspace
        // anyway if the current user is a member of its org.
        const orgId = workspace.betterAuthOrgId
        if (orgId) {
          await markWorkspaceClaimed(db, workspace.id, orgId)
          const ip = getClientIp(request)
          const hash = await ipHash(
            ip,
            daySaltFor(new Date(), env.HMAC_SECRET_SEED),
          )
          await writeAudit(db, {
            workspaceId: workspace.id,
            action: 'workspace.claim.dns.lock-bypass',
            actorUserId: userId,
            actorIpHash: hash,
            metadata: { domain, method: 'dns', prior_lock_owner: lock.owner_user_id },
          })
        }
      }
    }

    return json(response, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}
