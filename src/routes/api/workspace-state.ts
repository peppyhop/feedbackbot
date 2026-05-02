import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { getWorkspaceByDomain, makeDb } from '#/db/client'
import { normalizeDomain } from '#/lib/domain'
import { isFreemail, isStrict } from '#/lib/blocklist'
import { verifyDomainTxt, verifyRecordName, verifyRecordValue } from '#/lib/dns'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import type { WorkspaceStateResponse } from '#/schema/claim'
import { sameRegistrableDomain } from '#/lib/domain'
import { auth } from '#/lib/auth'

// GET /api/workspace-state?domain=<domain>
// Returns what claim paths are available + the DNS token to publish.

const getState = withRequestMetrics('/api/workspace-state', handle)

export const Route = createFileRoute('/api/workspace-state')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request }) => getState(request),
    },
  },
})

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const url = new URL(request.url)
    const domain = normalizeDomain(url.searchParams.get('domain'))
    if (!domain) throw new ApiError(400, 'bad domain', 'bad_domain')

    const db = makeDb(env.DB)
    const workspace = await getWorkspaceByDomain(db, domain)
    if (!workspace) throw new ApiError(404, 'no workspace', 'no_workspace')

    // Email-match eligibility for the signed-in user (if any).
    const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
    let emailMatchAvailable = false
    let emailMatchReason: string | undefined
    const userEmail = session?.user?.email ?? null
    const emailVerified = session?.user?.emailVerified ?? false

    if (!userEmail) {
      emailMatchReason = 'sign in required'
    } else if (!emailVerified) {
      emailMatchReason = 'email not verified'
    } else if (await isFreemail(env.BLOCKLIST_KV, domain)) {
      emailMatchReason = 'freemail domain'
    } else if (await isStrict(env.BLOCKLIST_KV, domain)) {
      emailMatchReason = 'restricted domain (edu/gov/mil)'
    } else {
      const userDomain = userEmail.split('@')[1] ?? ''
      if (!sameRegistrableDomain(userDomain, domain)) {
        emailMatchReason = 'email domain mismatch'
      } else {
        emailMatchAvailable = true
      }
    }

    const dnsCheck = await verifyDomainTxt(domain, workspace.verificationToken)

    const response: WorkspaceStateResponse = {
      workspace: {
        id: workspace.id,
        domain: workspace.domain,
        state: workspace.state as 'pending' | 'claimed' | 'suspended',
        ticket_count: workspace.ticketCount,
        turnstile_synced_at: workspace.turnstileSyncedAt ?? null,
      },
      claim_paths: {
        email_match: {
          available: emailMatchAvailable,
          reason: emailMatchReason,
        },
        dns_txt: {
          record_name: verifyRecordName(domain),
          record_value: verifyRecordValue(workspace.verificationToken),
          verified: dnsCheck.verified,
        },
      },
    }
    return json(response, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}
