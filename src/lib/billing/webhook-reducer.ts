// Maps Dodo webhook payloads to workspace subscription state.
// The Better Auth dodopayments plugin verifies the signature before
// handing us the parsed payload — we only need to reduce events →
// DB writes and keep an idempotency/audit trail.

import { eq } from 'drizzle-orm'

import { env } from '#/env'
import { makeDb } from '#/db/client'
import { webhookEvents, workspaces } from '#/db/schema'
import {
  PRODUCT_ID_TO_SLUG,
  planFromSlug,
  type PlanId,
} from '#/lib/billing/plans'
import { upsertPaidWorkspace } from '#/lib/billing/upsert-paid-workspace'

type DodoPayload = {
  business_id?: string
  type: string
  timestamp?: string
  data?: Record<string, unknown> & { payload_type?: string }
}

type DodoHeaders = {
  'webhook-id'?: string
  'webhook-timestamp'?: string
}

// Resolve workspace_id from the event payload. We write it into
// `metadata` when creating the checkout session, but also fall back
// to reference_id (legacy) and finally a lookup by subscription_id
// when the event belongs to an existing subscription.
async function resolveWorkspaceId(
  db: ReturnType<typeof makeDb>,
  data: Record<string, unknown> | undefined,
): Promise<string | null> {
  if (!data) return null
  const metadata = (data.metadata ?? {}) as Record<string, unknown>
  if (typeof metadata.workspace_id === 'string') return metadata.workspace_id

  if (typeof data.reference_id === 'string') return data.reference_id

  const subId =
    typeof data.subscription_id === 'string' ? data.subscription_id : null
  if (subId) {
    const row = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.subscriptionId, subId))
      .limit(1)
    return row[0]?.id ?? null
  }
  return null
}

function subscriptionFields(data: Record<string, unknown>) {
  const productId = typeof data.product_id === 'string' ? data.product_id : null
  // Prefer metadata.slug (set at checkout time); fall back to
  // product_id → slug via PLAN_PRODUCTS for payloads that didn't
  // carry our metadata (e.g. portal-initiated changes, or historic
  // events from before metadata.slug was standardized).
  const metadata = (data.metadata ?? {}) as Record<string, unknown>
  const metadataSlug =
    typeof metadata.slug === 'string' && metadata.slug
      ? metadata.slug
      : null
  // PRODUCT_ID_TO_SLUG covers both test + live IDs so a webhook for
  // either environment resolves its slug here.
  const fallbackSlug = productId
    ? (PRODUCT_ID_TO_SLUG[productId] ?? null)
    : null
  const slug = metadataSlug ?? fallbackSlug
  const plan: PlanId = planFromSlug(slug)
  const subscriptionId =
    typeof data.subscription_id === 'string' ? data.subscription_id : null
  const customerId =
    data.customer && typeof data.customer === 'object'
      ? ((data.customer as { customer_id?: string }).customer_id ?? null)
      : null
  const nextBillingDate =
    typeof data.next_billing_date === 'string'
      ? Date.parse(data.next_billing_date)
      : null
  return {
    plan,
    subscriptionId,
    customerId,
    nextBillingDate: Number.isFinite(nextBillingDate) ? nextBillingDate : null,
    productId,
  }
}

export async function handleDodoPayload(
  payload: DodoPayload,
  headers?: DodoHeaders,
): Promise<void> {
  const db = makeDb(env.DB)
  const eventId =
    headers?.['webhook-id'] ??
    // Deterministic fallback so we still dedupe events seen without
    // the Standard Webhook header (rare — only if we're invoked outside
    // the plugin's endpoint).
    `${payload.type}:${payload.data && 'subscription_id' in payload.data ? payload.data.subscription_id : ''}:${headers?.['webhook-timestamp'] ?? payload.timestamp ?? ''}`

  // 1. Idempotency check — bail if we've already processed this event.
  const existing = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.id, eventId))
    .limit(1)
  if (existing[0]) return

  let workspaceId = await resolveWorkspaceId(db, payload.data)

  let error: string | null = null
  try {
    // Pay-first flow: when the success-page redirect doesn't run (user
    // closed the tab between Dodo and our redirect), the first time we
    // hear about the new subscription is this webhook. Materialize the
    // user + workspace here so the user can recover via magic-link
    // sign-in later. Idempotent on subscription_id.
    if (
      !workspaceId &&
      payload.type === 'subscription.active' &&
      payload.data
    ) {
      const created = await tryFirstPaymentUpsert(db, payload.data)
      if (created) {
        workspaceId = created
      }
    }

    if (workspaceId && payload.data) {
      // Belt-and-suspenders: if the workspace was deleted between
      // checkout creation and this event arriving (e.g. we cleaned up
      // an orphan), an UPDATE in applyEvent would silently no-op and
      // make the audit row look like a successful apply. Surface it
      // explicitly instead.
      const exists = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1)
      if (exists.length === 0) {
        error = 'workspace_deleted'
      } else {
        await applyEvent(db, workspaceId, payload.type, payload.data)
      }
    } else if (!workspaceId && payload.type.startsWith('subscription.')) {
      // Subscription event with no workspace attachment is a bug on the
      // checkout-session caller (we should always pass metadata). Log
      // so it surfaces in the webhook_events audit.
      error = 'no_workspace_id'
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  await db.insert(webhookEvents).values({
    id: eventId,
    eventType: payload.type,
    workspaceId,
    payload: JSON.stringify(payload),
    processedAt: Date.now(),
    error,
  })
}

async function applyEvent(
  db: ReturnType<typeof makeDb>,
  workspaceId: string,
  eventType: string,
  data: Record<string, unknown>,
): Promise<void> {
  const f = subscriptionFields(data)

  switch (eventType) {
    case 'subscription.active':
    case 'subscription.renewed':
    case 'subscription.plan_changed':
      await db
        .update(workspaces)
        .set({
          plan: f.plan,
          subscriptionId: f.subscriptionId,
          subscriptionStatus: 'active',
          currentPeriodEnd: f.nextBillingDate,
          dodoCustomerId: f.customerId,
        })
        .where(eq(workspaces.id, workspaceId))
      return

    case 'subscription.on_hold':
      await db
        .update(workspaces)
        .set({ subscriptionStatus: 'on_hold' })
        .where(eq(workspaces.id, workspaceId))
      return

    case 'subscription.cancelled':
    case 'subscription.expired':
    case 'subscription.failed':
      await db
        .update(workspaces)
        .set({
          plan: 'free',
          subscriptionStatus: eventType.replace('subscription.', ''),
          currentPeriodEnd: null,
        })
        .where(eq(workspaces.id, workspaceId))
      return

    case 'subscription.updated':
      // Real-time sync — refresh whatever we have from the payload
      // without changing plan if status is unchanged.
      await db
        .update(workspaces)
        .set({
          currentPeriodEnd: f.nextBillingDate,
          dodoCustomerId: f.customerId,
        })
        .where(eq(workspaces.id, workspaceId))
      return

    // Payment events — not state-changing for the plan, but audit
    // trail is useful via the webhook_events row itself.
    case 'payment.succeeded':
    case 'payment.failed':
      return

    default:
      return
  }
}

// Tab-close-recovery: if the user paid but never reached our success
// page, this is the first place we learn about the new subscription.
// Pull the email + customer fields off the webhook payload (Dodo
// puts the verified email on `customer.email`) and run the same
// upsert the success page would have. Returns the created/found
// workspace id, or null if we can't attribute this event.
async function tryFirstPaymentUpsert(
  db: ReturnType<typeof makeDb>,
  data: Record<string, unknown>,
): Promise<string | null> {
  const f = subscriptionFields(data)
  if (!f.subscriptionId) return null
  const customer = (data.customer ?? {}) as {
    email?: string | null
  }
  const email =
    typeof customer.email === 'string' ? customer.email.toLowerCase() : null
  if (!email) return null
  const { workspaceId } = await upsertPaidWorkspace(db, {
    email,
    plan: f.plan,
    subscriptionId: f.subscriptionId,
    customerId: f.customerId,
    currentPeriodEnd: f.nextBillingDate,
  })
  return workspaceId
}
