// POST /api/signup/start-checkout
// Payment-first onboarding entry point. The client calls this after
// establishing a Better Auth session (anonymous is fine) via
// POST /api/auth/sign-in/anonymous.
//
// Body: { email: string, plan: 'lite' | 'starter' | 'scale' }
//
// Steps:
//   1. Create a Better Auth organization for the session's user.
//   2. Create a placeholder workspace pointing at that org.
//   3. Create a Dodo checkout session with reference_id=workspace.id
//      and metadata={ workspace_id, plan_slug, email } so the webhook
//      reducer can attribute the subscription back to this workspace.
//   4. Return the checkout URL; the client redirects window.location.

import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { customAlphabet } from 'nanoid'
import DodoPayments from 'dodopayments'

import { env } from '#/env'
import { auth } from '#/lib/auth'
import { makeDb } from '#/db/client'
import { workspaces, member } from '#/db/schema'
import { newId } from '#/db/ids'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import {
  PRODUCT_ID_TO_SLUG,
  productIdForPlan,
  type PlanId,
} from '#/lib/billing/plans'

const shortId = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 10)

const StartSchema = z.object({
  email: z.string().email(),
  plan: z.enum(['lite', 'starter', 'scale']),
})

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    if (!env.DODO_PAYMENTS_API_KEY) {
      throw new ApiError(503, 'billing not configured', 'not_configured')
    }

    const body = StartSchema.safeParse(
      await request.json().catch(() => null),
    )
    if (!body.success) {
      throw new ApiError(400, 'invalid body', 'bad_body')
    }
    const { email, plan } = body.data

    const session = await auth.api
      .getSession({ headers: request.headers })
      .catch(() => null)
    if (!session?.user) {
      throw new ApiError(401, 'sign in first', 'no_session')
    }
    const userId = session.user.id

    const productId = productIdForPlan(plan as PlanId, env.DODO_PAYMENTS_ENV)
    if (!productId) {
      throw new ApiError(400, 'unknown plan', 'bad_plan')
    }
    // Dodo product slug (e.g. "feedbackbot-starter") — distinct from
    // our internal PlanId. The webhook reducer reads `metadata.slug`
    // and maps back to a PlanId via SLUG_TO_PLAN.
    const productSlug = PRODUCT_ID_TO_SLUG[productId]

    const db = makeDb(env.DB)
    const now = Date.now()

    // 1. Better Auth organization.
    const orgSlug = `pending-${shortId()}`
    const orgRes = (await auth.api.createOrganization({
      headers: request.headers,
      body: { name: orgSlug, slug: orgSlug },
    })) as { id?: string } | null
    const orgId = orgRes?.id
    if (!orgId) {
      throw new ApiError(500, 'failed to create organization', 'org_create')
    }

    // Better Auth typically seeds the creator as a member; guarantee it.
    try {
      await db.insert(member).values({
        id: `mem_${shortId()}`,
        organizationId: orgId,
        userId,
        role: 'owner',
        createdAt: new Date(now),
      })
    } catch {
      // already inserted by the plugin — ignore duplicate PK / conflict.
    }

    // 2. Placeholder workspace.
    const workspaceId = newId.workspace()
    const placeholderDomain = `pending-${shortId()}.feedbackbot.internal`
    await db.insert(workspaces).values({
      id: workspaceId,
      domain: placeholderDomain,
      state: 'pending',
      verificationToken: newId.verificationToken(),
      betterAuthOrgId: orgId,
      settings: '{}',
      ticketCount: 0,
      createdAt: now,
      claimedAt: null,
      plan: 'free',
      subscriptionId: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      dodoCustomerId: null,
    })

    // 3. Dodo checkout session.
    const dodo = new DodoPayments({
      bearerToken: env.DODO_PAYMENTS_API_KEY,
      environment:
        env.DODO_PAYMENTS_ENV === 'live_mode' ? 'live_mode' : 'test_mode',
    })

    // Pinned to the canonical apex on production; on preview / local
    // stages env.BETTER_AUTH_URL is empty and we self-derive from the
    // current request so Dodo's return URL points back at the same
    // host the user just left.
    const baseUrl =
      env.BETTER_AUTH_URL && env.BETTER_AUTH_URL.length > 0
        ? env.BETTER_AUTH_URL
        : new URL(request.url).origin
    const returnUrl = `${baseUrl}/dashboard/billing/success?workspace_id=${workspaceId}&email=${encodeURIComponent(email)}`

    let checkoutUrl: string
    try {
      const resp = await dodo.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email, name: email.split('@')[0] || 'user' },
        metadata: {
          workspace_id: workspaceId,
          // Key name `slug` matches what webhook-reducer.ts reads.
          slug: productSlug ?? '',
          email,
          user_id: userId,
        },
        return_url: returnUrl,
      })
      const urlFromResp = (
        resp as unknown as {
          checkout_url?: string
          payment_link?: string
          url?: string
        }
      )
      checkoutUrl =
        urlFromResp.checkout_url ??
        urlFromResp.payment_link ??
        urlFromResp.url ??
        ''
      if (!checkoutUrl) {
        throw new Error('checkout session missing url')
      }
    } catch (err) {
      // Roll back the workspace so a retry gets a clean slate.
      await db.delete(workspaces).where(eq(workspaces.id, workspaceId))
      throw new ApiError(
        502,
        `dodo checkout failed: ${(err as Error).message}`.slice(0, 400),
        'dodo_error',
      )
    }

    return json(
      { url: checkoutUrl, workspace_id: workspaceId },
      { headers: cors },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const startCheckout = withRequestMetrics('/api/signup/start-checkout', handle)

export const Route = createFileRoute('/api/signup/start-checkout')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      POST: async ({ request }) => startCheckout(request),
    },
  },
})
