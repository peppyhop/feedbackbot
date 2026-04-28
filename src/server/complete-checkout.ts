// Server function called from /dashboard/billing/success's loader.
// Pulls the verified Dodo session, materializes the user + workspace
// (idempotent on subscription_id), writes a magic-link verification
// row, and returns the URL the loader should redirect the browser
// to. The loader can't import env / DodoPayments / Drizzle directly
// because the route file gets bundled for the client too — wrapping
// in createServerFn keeps all of that on the server.

import { createServerFn } from '@tanstack/react-start'
import { customAlphabet } from 'nanoid'
import { z } from 'zod'
import DodoPayments from 'dodopayments'

import { env } from '#/env'
import { makeDb } from '#/db/client'
import { verification } from '#/db/schema'
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
const magicLinkToken = customAlphabet(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  32,
)

const MAGIC_LINK_TTL_MS = 5 * 60 * 1000

type DodoCheckoutSession = {
  payment_status?: string | null
  status?: string | null
  customer?: { email?: string | null; customer_id?: string | null } | null
  customer_email?: string | null
  subscription_id?: string | null
  product_cart?: Array<{ product_id?: string }>
  metadata?: Record<string, unknown> | null
  next_billing_date?: string | null
}

export type CompleteCheckoutResult =
  | {
      kind: 'redirect'
      // Final destination — typically /api/auth/magic-link/verify?…
      // but can also be /onboard/{ws}?failed=… or /.
      url: string
    }

const InputSchema = z.object({
  cs: z.string().min(1),
})

export const completeCheckout = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<CompleteCheckoutResult> => {
    const cs = data.cs

    if (!env.DODO_PAYMENTS_API_KEY) {
      return { kind: 'redirect', url: '/' }
    }

    const dodo = new DodoPayments({
      bearerToken: env.DODO_PAYMENTS_API_KEY,
      environment:
        env.DODO_PAYMENTS_ENV === 'live_mode' ? 'live_mode' : 'test_mode',
    })
    const session = (await dodo.checkoutSessions.retrieve(
      cs,
    )) as unknown as DodoCheckoutSession

    const status = session.payment_status ?? session.status ?? ''
    if (status && status !== 'active' && status !== 'succeeded') {
      // Payment failed — there's no workspace to send them to. Land
      // on the homepage pricing section with a query param so future
      // UI can pick it up.
      return {
        kind: 'redirect',
        url: `/?failed=${encodeURIComponent(status)}#pricing`,
      }
    }

    const email =
      session.customer?.email?.toLowerCase() ??
      session.customer_email?.toLowerCase() ??
      null
    const subscriptionId = session.subscription_id ?? null
    if (!email || !subscriptionId) {
      // Dodo paid us but didn't return the fields we need to attribute
      // it. Fall back to the homepage; the webhook will fire and the
      // user can sign in via magic-link to recover.
      return { kind: 'redirect', url: '/' }
    }

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
        ? (session.customer.customer_id ?? null)
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
    // be signed in via better-auth's verify endpoint without an email
    // round-trip. Format mirrors the magic-link plugin's own writes
    // (storeToken: 'plain', value contains email + name + attempt).
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
        : null
    const callbackPath = `/onboard/${workspaceId}`
    // When BETTER_AUTH_URL isn't set (preview / local), return a
    // relative URL so the browser stays on whatever origin it just
    // landed on — the verify endpoint is registered at /api/auth/...
    // on every stage.
    const verifyPath = `/api/auth/magic-link/verify?token=${encodeURIComponent(
      token,
    )}&callbackURL=${encodeURIComponent(callbackPath)}`
    const url = baseUrl ? `${baseUrl}${verifyPath}` : verifyPath
    return { kind: 'redirect', url }
  })
