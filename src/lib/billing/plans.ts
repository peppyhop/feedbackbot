// Single source of truth for the plan catalogue. Slug is what the
// Dodo product carries; PlanId is our internal enum; productId is
// the Dodo product primary key. We keep BOTH the test-mode and
// live-mode product ID maps here and select one at runtime based on
// `env.DODO_PAYMENTS_ENV` — preview deploys hit the test products,
// production hits the live ones, and the webhook reducer can resolve
// either via PRODUCT_ID_TO_SLUG.

export type PlanId = 'free' | 'lite' | 'starter' | 'scale'

export const SLUG_TO_PLAN: Record<string, PlanId> = {
  'feedbackbot-lite': 'lite',
  'feedbackbot-starter': 'starter',
  'feedbackbot-scale': 'scale',
}

export const PLAN_LABEL: Record<PlanId, string> = {
  free: 'Locked',
  lite: 'Lite',
  starter: 'Starter',
  scale: 'Scale',
}

// Test-mode Dodo product IDs (used by previews + local dev).
// Created 2026-04-24.
const TEST_PRODUCT_IDS: Record<string, string> = {
  'feedbackbot-lite': 'pdt_0NdRpkVc0SEz3JvRfDphZ',
  'feedbackbot-starter': 'pdt_0NdNiXopUStGE5cemK9PG',
  'feedbackbot-scale': 'pdt_0NdNiXttlTeFfTwrGujIy',
}

// Live-mode Dodo product IDs (production only).
// Created 2026-04-25.
const LIVE_PRODUCT_IDS: Record<string, string> = {
  'feedbackbot-lite': 'pdt_0NdSaJbxPPvZTgimQG9K5',
  'feedbackbot-starter': 'pdt_0NdSaJh6EYt27jmqLt7UZ',
  'feedbackbot-scale': 'pdt_0NdSaJkh6lS6SLXxsDjvY',
}

// Reverse lookup spanning both environments. Used by the webhook
// reducer to map a `product_id` on an incoming Dodo event back to the
// slug, regardless of which environment the event came from.
export const PRODUCT_ID_TO_SLUG: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(TEST_PRODUCT_IDS).map(([slug, id]) => [id, slug]),
  ),
  ...Object.fromEntries(
    Object.entries(LIVE_PRODUCT_IDS).map(([slug, id]) => [id, slug]),
  ),
}

function idsFor(envMode: string | undefined): Record<string, string> {
  return envMode === 'live_mode' ? LIVE_PRODUCT_IDS : TEST_PRODUCT_IDS
}

// Shape consumed by Better Auth's checkout({ products }) plugin.
export function planProductsFor(
  envMode: string | undefined,
): Array<{ slug: string; productId: string }> {
  return Object.entries(idsFor(envMode)).map(([slug, productId]) => ({
    slug,
    productId,
  }))
}

export function productIdForPlan(
  planId: PlanId,
  envMode: string | undefined,
): string | null {
  const slug = Object.entries(SLUG_TO_PLAN).find(([, id]) => id === planId)?.[0]
  if (!slug) return null
  return idsFor(envMode)[slug] ?? null
}

export function planFromSlug(slug: string | null | undefined): PlanId {
  if (!slug) return 'free'
  return SLUG_TO_PLAN[slug] ?? 'free'
}
