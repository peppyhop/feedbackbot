// POST /api/onboard/claim-email
// Skip DNS for the first claim when the signed-in user's email
// matches the workspace's domain. Same logic as the auto-claim path
// in rename.ts, but reachable independently — for customers stuck
// at verify-DNS who renamed their workspace before the auto-claim
// shipped, or who initially declined the email-match path on the
// claim dashboard.
//
// Body: { workspace_id: string }
//
// Auth: caller must be a member of the workspace's org and have
// emailVerified=true. Strict TLDs (edu/gov/mil) and freemail
// domains are excluded — those still require DNS proof.

import { createFileRoute } from '@tanstack/react-router'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { env } from '#/env'
import { makeDb, writeAudit } from '#/db/client'
import { member, user, workspaces } from '#/db/schema'
import { sameRegistrableDomain } from '#/lib/domain'
import { isFreemail, isStrict } from '#/lib/blocklist'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireSession } from '#/lib/admin-auth'
import { addTurnstileHostname } from '#/lib/turnstile-admin'

const ClaimSchema = z.object({
  workspace_id: z.string().min(1),
})

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const body = ClaimSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!body.success) throw new ApiError(400, 'bad body', 'bad_body')

    const { userId } = await requireSession(request)
    const db = makeDb(env.DB)

    const rows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, body.data.workspace_id))
      .limit(1)
    const ws = rows[0]
    if (!ws) throw new ApiError(404, 'no workspace', 'no_workspace')
    if (ws.state === 'claimed') {
      // Idempotent: already claimed is fine, just say so.
      return json(
        { workspace_id: ws.id, claimed: true, already: true },
        { headers: cors },
      )
    }
    if (ws.state !== 'pending') {
      throw new ApiError(
        409,
        `workspace not pending (${ws.state})`,
        'bad_state',
      )
    }
    if (!ws.betterAuthOrgId) {
      throw new ApiError(409, 'no org attached', 'no_org')
    }

    // Caller must be a member of this workspace's org.
    const memberships = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, ws.betterAuthOrgId),
          eq(member.userId, userId),
        ),
      )
      .limit(1)
    if (memberships.length === 0) {
      throw new ApiError(403, 'not a member', 'not_member')
    }

    // Pull the user's email + verified flag.
    const userRows = await db
      .select({ email: user.email, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    const userEmail = userRows[0]?.email ?? null
    const emailVerified = userRows[0]?.emailVerified ?? false
    if (!userEmail) {
      throw new ApiError(403, 'no email on session', 'no_email')
    }
    if (!emailVerified) {
      throw new ApiError(403, 'email not verified', 'email_not_verified')
    }

    const userDomain = userEmail.split('@')[1] ?? ''
    if (!sameRegistrableDomain(userDomain, ws.domain)) {
      throw new ApiError(
        403,
        'email domain does not match workspace',
        'email_mismatch',
      )
    }

    // Strict TLDs + freemail still require DNS — same gates as
    // rename.ts auto-claim and dashboard claim-paths report.
    const blockedTld = await isStrict(env.BLOCKLIST_KV, ws.domain).catch(
      () => false,
    )
    if (blockedTld) {
      throw new ApiError(
        403,
        'restricted TLD requires DNS verification',
        'restricted_tld',
      )
    }
    const freemail = await isFreemail(env.BLOCKLIST_KV, ws.domain).catch(
      () => false,
    )
    if (freemail) {
      throw new ApiError(
        403,
        'freemail domain not allowed',
        'freemail',
      )
    }

    const now = Date.now()
    await db
      .update(workspaces)
      .set({ state: 'claimed', claimedAt: now })
      .where(eq(workspaces.id, ws.id))

    await writeAudit(db, {
      workspaceId: ws.id,
      action: 'workspace.claim.email_match',
      actorUserId: userId,
      metadata: {
        domain: ws.domain,
        method: 'email_match',
        user_email: userEmail,
        via: 'claim-email-endpoint',
      },
    })

    // Best-effort: add the domain to the Turnstile widget's
    // hostname allowlist so the customer's site can mint tokens.
    const turnstileOk = await addTurnstileHostname(ws.domain, env)
    if (!turnstileOk) {
      console.warn('turnstile hostname add failed', { domain: ws.domain })
    }

    return json(
      { workspace_id: ws.id, claimed: true, already: false },
      { headers: cors },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const claimEmail = withRequestMetrics('/api/onboard/claim-email', handle)

export const Route = createFileRoute('/api/onboard/claim-email')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      POST: async ({ request }) => claimEmail(request),
    },
  },
})
