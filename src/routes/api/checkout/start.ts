// GET /api/checkout/start?plan=lite|starter|scale
//
// Pay-first onboarding entry point. No session required — this is what
// pricing CTAs on the landing page link to. We create a Dodo checkout
// session (Dodo collects email + payment) and 302 the browser to it.
// Post-payment, /dashboard/billing/success creates the user, the
// workspace, and a session via the magic-link verify endpoint.

import { createFileRoute } from '@tanstack/react-router'
import DodoPayments from 'dodopayments'

import { env } from '#/env'
import {
  ApiError,
  apiError,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import {
  PRODUCT_ID_TO_SLUG,
  productIdForPlan,
  type PlanId,
} from '#/lib/billing/plans'

const VALID_PLANS: ReadonlySet<PlanId> = new Set(['lite', 'starter', 'scale'])

// Exported so tests can call the handler directly without going
// through TanStack's route registration.
export async function handle(request: Request): Promise<Response> {
  try {
    if (!env.DODO_PAYMENTS_API_KEY) {
      throw new ApiError(503, 'billing not configured', 'not_configured')
    }

    const url = new URL(request.url)
    const planParam = url.searchParams.get('plan') as PlanId | null
    if (!planParam || !VALID_PLANS.has(planParam)) {
      throw new ApiError(400, 'invalid plan', 'bad_plan')
    }
    const plan = planParam

    const productId = productIdForPlan(plan, env.DODO_PAYMENTS_ENV)
    if (!productId) {
      throw new ApiError(400, 'unknown plan', 'bad_plan')
    }
    const productSlug = PRODUCT_ID_TO_SLUG[productId] ?? ''

    const dodo = new DodoPayments({
      bearerToken: env.DODO_PAYMENTS_API_KEY,
      environment:
        env.DODO_PAYMENTS_ENV === 'live_mode' ? 'live_mode' : 'test_mode',
    })

    // Pinned to the canonical apex on production; on previews / local
    // we self-derive from the request so the return URL points back at
    // the same host the user just left.
    const baseUrl =
      env.BETTER_AUTH_URL && env.BETTER_AUTH_URL.length > 0
        ? env.BETTER_AUTH_URL
        : url.origin
    // Dodo replaces {CHECKOUT_SESSION_ID} in the return_url with the
    // actual session id, so the success handler can call
    // `checkoutSessions.retrieve(cs)` and trust the verified email.
    const returnUrl = `${baseUrl}/dashboard/billing/success?cs={CHECKOUT_SESSION_ID}`

    const resp = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      // No customer pre-set — Dodo collects email at the hosted form.
      metadata: {
        slug: productSlug,
        plan,
        // Marker for the webhook reducer to know this came through the
        // pay-first path; useful later for analytics if needed.
        flow: 'pay_first',
      },
      return_url: returnUrl,
    })
    const checkoutUrl =
      (
        resp as unknown as {
          checkout_url?: string
          payment_link?: string
          url?: string
        }
      ).checkout_url ??
      (resp as unknown as { payment_link?: string }).payment_link ??
      (resp as unknown as { url?: string }).url
    if (!checkoutUrl) {
      throw new ApiError(502, 'dodo checkout missing url', 'dodo_error')
    }
    return Response.redirect(checkoutUrl, 302)
  } catch (err) {
    return apiError(err)
  }
}

const startCheckout = withRequestMetrics('/api/checkout/start', handle)

export const Route = createFileRoute('/api/checkout/start')({
  server: {
    handlers: {
      GET: async ({ request }) => startCheckout(request),
    },
  },
})
