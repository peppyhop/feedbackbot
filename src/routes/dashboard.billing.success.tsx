import { createFileRoute, redirect } from '@tanstack/react-router'
import { customAlphabet } from 'nanoid'
import DodoPayments from 'dodopayments'

import { env } from '#/env'
import { makeDb } from '#/db/client'
import { verification } from '#/db/schema'
import { seoMeta } from '#/lib/seo'
import {
  PRODUCT_ID_TO_SLUG,
  planFromSlug,
  type PlanId,
} from '#/lib/billing/plans'
import { upsertPaidWorkspace } from '#/lib/billing/upsert-paid-workspace'

const verificationId = customAlphabet(
  '23456789abcdefghjkmnpqrstuvwxyz',
  16,
)
// Magic-link tokens use the same alphabet better-auth's magic-link
// plugin uses (a-zA-Z 32 chars) — we're feeding the same verify
// endpoint so the format must match.
const magicLinkToken = customAlphabet(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  32,
)

// Token TTL matches the magic-link plugin default (5 min).
const MAGIC_LINK_TTL_MS = 5 * 60 * 1000

type DodoCheckoutSession = {
  payment_status?: string | null
  status?: string | null
  customer?: { email?: string | null } | null
  customer_email?: string | null
  subscription_id?: string | null
  product_cart?: Array<{ product_id?: string }>
  metadata?: Record<string, unknown> | null
  next_billing_date?: string | null
}

export const Route = createFileRoute('/dashboard/billing/success')({
  validateSearch: (raw: Record<string, unknown>) => ({
    cs: typeof raw.cs === 'string' ? raw.cs : undefined,
    // Backwards-compat with Dodo configs that still send the old query
    // shape. Either is OK; we prefer `cs` going forward.
    workspace_id:
      typeof raw.workspace_id === 'string' ? raw.workspace_id : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
  }),
  loader: async ({ location }) => {
    const search = location.search as {
      cs?: string
      workspace_id?: string
      status?: string
    }

    // Legacy redirect path: previous Dodo callbacks sent
    // ?workspace_id=…&status=…. Hand off to /onboard/{ws} so existing
    // checkout sessions in flight don't 404 mid-deploy.
    if (search.workspace_id) {
      const failed =
        search.status &&
        search.status !== 'active' &&
        search.status !== 'succeeded'
      throw redirect({
        to: '/onboard/$workspaceId',
        params: { workspaceId: search.workspace_id },
        search: { failed: failed ? search.status : undefined },
      })
    }

    if (!search.cs) {
      throw redirect({ to: '/' })
    }

    if (!env.DODO_PAYMENTS_API_KEY) {
      throw redirect({ to: '/' })
    }

    const dodo = new DodoPayments({
      bearerToken: env.DODO_PAYMENTS_API_KEY,
      environment:
        env.DODO_PAYMENTS_ENV === 'live_mode' ? 'live_mode' : 'test_mode',
    })
    const session = (await dodo.checkoutSessions.retrieve(
      search.cs,
    )) as unknown as DodoCheckoutSession

    const status = session.payment_status ?? session.status ?? ''
    if (status && status !== 'active' && status !== 'succeeded') {
      // Payment failed — there's no workspace to send them to. Land
      // on the home page with a query param so the landing /onboard
      // PaymentFailed component (or future UI) can pick it up.
      throw redirect({
        to: '/',
        hash: 'pricing',
        search: { failed: status },
      })
    }

    const email =
      session.customer?.email?.toLowerCase() ??
      session.customer_email?.toLowerCase()
    const subscriptionId = session.subscription_id ?? null
    if (!email || !subscriptionId) {
      // Dodo gave us a paid session without the fields we need to
      // attribute it. Fall back to the homepage; the webhook will
      // fire and they can sign in via magic-link to recover.
      throw redirect({ to: '/' })
    }

    // Resolve the plan: prefer the slug in metadata (set in
    // /api/checkout/start), fall back to product_id lookup.
    const metadata = session.metadata ?? {}
    const metaSlug =
      typeof metadata.slug === 'string' && metadata.slug
        ? metadata.slug
        : null
    const productId = session.product_cart?.[0]?.product_id ?? null
    const fallbackSlug = productId ? PRODUCT_ID_TO_SLUG[productId] : null
    const plan: PlanId = planFromSlug(metaSlug ?? fallbackSlug)
    const customerId =
      session.customer && typeof session.customer === 'object'
        ? ((session.customer as { customer_id?: string }).customer_id ?? null)
        : null
    const nextBillingDate =
      typeof session.next_billing_date === 'string'
        ? Date.parse(session.next_billing_date)
        : null
    const currentPeriodEnd = Number.isFinite(nextBillingDate)
      ? (nextBillingDate as number)
      : null

    const db = makeDb(env.DB)
    const { workspaceId } = await upsertPaidWorkspace(db, {
      email,
      plan,
      subscriptionId,
      customerId,
      currentPeriodEnd,
    })

    // Mint a magic-link verification value directly so the user can
    // be signed in via better-auth's verify endpoint without an
    // email round-trip. The format mirrors the magic-link plugin's
    // own writes (storeToken: 'plain', value contains email + name +
    // attempt counter).
    const token = magicLinkToken()
    const now = Date.now()
    await db.insert(verification).values({
      id: `vrf_${verificationId()}`,
      identifier: token,
      value: JSON.stringify({ email, name: '', attempt: 0 }),
      expiresAt: new Date(now + MAGIC_LINK_TTL_MS),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })

    const baseUrl =
      env.BETTER_AUTH_URL && env.BETTER_AUTH_URL.length > 0
        ? env.BETTER_AUTH_URL
        : new URL(location.href, 'https://placeholder').origin
    const callbackPath = `/onboard/${workspaceId}`
    const verifyUrl = new URL('/api/auth/magic-link/verify', baseUrl)
    verifyUrl.searchParams.set('token', token)
    verifyUrl.searchParams.set('callbackURL', callbackPath)

    throw redirect({ href: verifyUrl.toString(), reloadDocument: true })
  },
  head: () => ({
    meta: seoMeta({
      path: '/dashboard/billing/success',
      title: 'Finishing up',
      noindex: true,
    }),
  }),
})
