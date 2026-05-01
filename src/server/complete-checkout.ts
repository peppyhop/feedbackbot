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
import type { Env } from '#/env'
import { makeDb, type DB } from '#/db/client'
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

type DodoSubscription = {
  status?: string | null
  customer?: { email?: string | null; customer_id?: string | null } | null
  customer_email?: string | null
  subscription_id?: string | null
  product_id?: string | null
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
  subscription_id: z.string().min(1),
  // Dodo also appends ?email= but we don't trust it — we re-read the
  // email from the verified subscription object below.
  email: z.string().optional(),
  status: z.string().optional(),
})

// Subset of the DodoPayments client we actually call. Lets tests
// inject a stub without depending on the real SDK shape.
export type DodoClient = {
  subscriptions: {
    retrieve(id: string): Promise<unknown>
  }
}

// Pulled out of the createServerFn wrapper so tests can drive it
// with stubbed deps (env / db / dodo). The wrapper below plumbs in
// the real ones — env binding, makeDb(env.DB), real DodoPayments.
export async function runCompleteCheckout(opts: {
  data: { subscription_id: string; email?: string; status?: string }
  env: Pick<Env, 'BETTER_AUTH_URL' | 'DODO_PAYMENTS_API_KEY' | 'DODO_PAYMENTS_ENV'>
  db: DB
  dodo: DodoClient
}): Promise<CompleteCheckoutResult> {
  const subscriptionId = opts.data.subscription_id

  if (!opts.env.DODO_PAYMENTS_API_KEY) {
    return { kind: 'redirect', url: '/' }
  }

  // Verify the subscription via Dodo's API. Doing this server-side
  // is the trust anchor: we don't believe ?status=active or ?email=
  // from the redirect URL on its own (those can be forged) — the
  // API call confirms the subscription exists, is on our account,
  // and yields the canonical email + product.
  const subscription = (await opts.dodo.subscriptions.retrieve(
    subscriptionId,
  )) as unknown as DodoSubscription

  const status = subscription.status ?? ''
  if (status && status !== 'active' && status !== 'succeeded') {
    return {
      kind: 'redirect',
      url: `/?failed=${encodeURIComponent(status)}#pricing`,
    }
  }

  const email =
    subscription.customer?.email?.toLowerCase() ??
    subscription.customer_email?.toLowerCase() ??
    null
  if (!email) {
    // Subscription verified but missing email — bail to homepage,
    // the webhook will retry on its own.
    return { kind: 'redirect', url: '/' }
  }

  const metadata = subscription.metadata ?? {}
  const metaSlug =
    typeof metadata.slug === 'string' && metadata.slug
      ? metadata.slug
      : null
  const productId = subscription.product_id ?? null
  const fallbackSlug = productId ? PRODUCT_ID_TO_SLUG[productId] : null
  const plan: PlanId = planFromSlug(metaSlug ?? fallbackSlug)
  const customerId =
    subscription.customer && typeof subscription.customer === 'object'
      ? (subscription.customer.customer_id ?? null)
      : null
  const nextBillingDate =
    typeof subscription.next_billing_date === 'string'
      ? Date.parse(subscription.next_billing_date)
      : null
  const currentPeriodEnd = Number.isFinite(nextBillingDate)
    ? (nextBillingDate as number)
    : null

  // Prefer the subscription_id from the verified API response over
  // the URL param: the URL is user-controllable, the API response
  // is the authoritative identity. They should match in practice
  // (the SDK call IS keyed by the URL's id), but if they ever
  // disagree the verified one wins.
  const verifiedSubscriptionId = subscription.subscription_id ?? subscriptionId

  const { workspaceId } = await upsertPaidWorkspace(opts.db, {
    email,
    plan,
    subscriptionId: verifiedSubscriptionId,
    customerId,
    currentPeriodEnd,
  })

  // Mint a magic-link verification value directly so the user can
  // be signed in via better-auth's verify endpoint without an email
  // round-trip. Format mirrors the magic-link plugin's own writes
  // (storeToken: 'plain', value contains email + name + attempt).
  const token = magicLinkToken()
  const now = Date.now()
  await opts.db.insert(verification).values({
    id: `vrf_${verificationId()}`,
    identifier: token,
    value: JSON.stringify({ email, name: '', attempt: 0 }),
    expiresAt: new Date(now + MAGIC_LINK_TTL_MS),
    createdAt: new Date(now),
    updatedAt: new Date(now),
  })

  const baseUrl =
    opts.env.BETTER_AUTH_URL && opts.env.BETTER_AUTH_URL.length > 0
      ? opts.env.BETTER_AUTH_URL
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
}

export const completeCheckout = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<CompleteCheckoutResult> => {
    const dodo = new DodoPayments({
      bearerToken: env.DODO_PAYMENTS_API_KEY ?? '',
      environment:
        env.DODO_PAYMENTS_ENV === 'live_mode' ? 'live_mode' : 'test_mode',
    })
    return runCompleteCheckout({
      data,
      env,
      db: makeDb(env.DB),
      dodo,
    })
  })
