// Dodo webhook payload fixtures. Hand-built to match the shape
// `src/lib/billing/webhook-reducer.ts` reads (see subscriptionFields
// + tryFirstPaymentUpsert). When you have time to capture real
// payloads via `dodo wh trigger <event>`, save them here as JSON
// and replace these — they're stable contracts.
//
// Important: keep `metadata.slug` aligned with the slugs declared
// in src/lib/billing/plans.ts (feedbackbot-lite/starter/scale).

import {
  TEST_PRODUCT_ID_LITE,
  TEST_PRODUCT_ID_STARTER,
} from '#/test-helpers/test-products'

const baseTimestamp = '2026-04-28T08:00:00.000Z'

export type DodoWebhookPayload = {
  business_id?: string
  type: string
  timestamp?: string
  data?: Record<string, unknown> & { payload_type?: string }
}

// Pay-first first-payment event. customer.email is the verified
// email Dodo collected at checkout. workspace_id is set by the
// /api/checkout/start metadata when the success page already ran;
// when it didn't run (tab-close recovery), the field is absent and
// tryFirstPaymentUpsert kicks in via customer.email.
export function subscriptionActiveEvent(opts: {
  email?: string
  subscriptionId?: string
  productId?: string
  slug?: string
  workspaceId?: string
} = {}): DodoWebhookPayload {
  return {
    business_id: 'biz_test',
    type: 'subscription.active',
    timestamp: baseTimestamp,
    data: {
      payload_type: 'Subscription',
      subscription_id: opts.subscriptionId ?? 'sub_test_active',
      product_id: opts.productId ?? TEST_PRODUCT_ID_LITE,
      next_billing_date: '2026-05-28T08:00:00.000Z',
      customer: {
        customer_id: 'cust_test',
        email: opts.email ?? 'buyer@example.com',
        name: 'Test Buyer',
      },
      metadata: {
        slug: opts.slug ?? 'feedbackbot-lite',
        // workspace_id only present when /api/checkout/start put
        // it there at checkout creation time. Pay-first leaves it
        // absent so the webhook + success page both rely on
        // (subscription_id, customer.email) for attribution.
        ...(opts.workspaceId ? { workspace_id: opts.workspaceId } : {}),
      },
    },
  }
}

export function subscriptionRenewedEvent(opts: {
  subscriptionId?: string
  productId?: string
  slug?: string
} = {}): DodoWebhookPayload {
  return {
    business_id: 'biz_test',
    type: 'subscription.renewed',
    timestamp: baseTimestamp,
    data: {
      payload_type: 'Subscription',
      subscription_id: opts.subscriptionId ?? 'sub_test_active',
      product_id: opts.productId ?? TEST_PRODUCT_ID_STARTER,
      next_billing_date: '2026-06-28T08:00:00.000Z',
      customer: {
        customer_id: 'cust_test',
        email: 'buyer@example.com',
      },
      metadata: { slug: opts.slug ?? 'feedbackbot-starter' },
    },
  }
}

export function subscriptionOnHoldEvent(subscriptionId = 'sub_test_active'): DodoWebhookPayload {
  return {
    business_id: 'biz_test',
    type: 'subscription.on_hold',
    timestamp: baseTimestamp,
    data: {
      payload_type: 'Subscription',
      subscription_id: subscriptionId,
    },
  }
}

export function subscriptionCancelledEvent(subscriptionId = 'sub_test_active'): DodoWebhookPayload {
  return {
    business_id: 'biz_test',
    type: 'subscription.cancelled',
    timestamp: baseTimestamp,
    data: {
      payload_type: 'Subscription',
      subscription_id: subscriptionId,
    },
  }
}

export function paymentSucceededEvent(): DodoWebhookPayload {
  return {
    business_id: 'biz_test',
    type: 'payment.succeeded',
    timestamp: baseTimestamp,
    data: {
      payload_type: 'Payment',
      subscription_id: 'sub_test_active',
    },
  }
}
