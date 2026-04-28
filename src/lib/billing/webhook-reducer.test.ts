import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import { user, webhookEvents, workspaces } from '#/db/schema'
import { handleDodoPayload } from '#/lib/billing/webhook-reducer'
import { createTestDb, type TestDb } from '#/test-helpers/db'
import { upsertPaidWorkspace } from '#/lib/billing/upsert-paid-workspace'
import {
  paymentSucceededEvent,
  subscriptionActiveEvent,
  subscriptionCancelledEvent,
  subscriptionOnHoldEvent,
  subscriptionRenewedEvent,
} from '#/test-helpers/fixtures/dodo-webhooks'
import { TEST_PRODUCT_ID_STARTER } from '#/test-helpers/test-products'

// Hoisted holder so vi.mock factory + beforeEach can share state.
// vi.mock runs at import time; the factory captures `mocks` by
// reference, then beforeEach swaps `mocks.db` per test.
const mocks = vi.hoisted(() => ({
  db: null as ReturnType<typeof createTestDb>['db'] | null,
}))

vi.mock('#/db/client', async () => {
  const actual = await vi.importActual<typeof import('#/db/client')>(
    '#/db/client',
  )
  return {
    ...actual,
    makeDb: () => mocks.db!,
  }
})

vi.mock('#/env', () => ({
  env: {
    DB: {},
    BETTER_AUTH_SECRET: 'test',
    DODO_PAYMENTS_ENV: 'test_mode',
  },
}))

describe('handleDodoPayload', () => {
  let testDb: TestDb

  beforeEach(() => {
    testDb = createTestDb()
    mocks.db = testDb.db
  })

  it('subscription.active for an unknown workspace creates the user + workspace via tryFirstPaymentUpsert', async () => {
    await handleDodoPayload(
      subscriptionActiveEvent({ email: 'recover@example.com' }),
      { 'webhook-id': 'evt_1' },
    )

    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('recover@example.com')

    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(1)
    expect(ws[0].subscriptionId).toBe('sub_test_active')
    expect(ws[0].plan).toBe('lite')
    expect(ws[0].subscriptionStatus).toBe('active')

    const events = await testDb.db.select().from(webhookEvents)
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('evt_1')
    expect(events[0].error).toBeNull()
    expect(events[0].workspaceId).toBe(ws[0].id)
  })

  it('subscription.active for a known workspace updates the existing row, no new workspace', async () => {
    // Pre-create the workspace via the normal upsert path so it
    // has the subscription_id the webhook will resolve against.
    const seed = await upsertPaidWorkspace(testDb.db, {
      email: 'buyer@example.com',
      plan: 'lite',
      subscriptionId: 'sub_test_active',
      customerId: 'cust_test',
      currentPeriodEnd: null,
    })

    await handleDodoPayload(
      // Renewed/upgraded plan event, same subscription_id.
      subscriptionActiveEvent({
        productId: TEST_PRODUCT_ID_STARTER,
        slug: 'feedbackbot-starter',
      }),
      { 'webhook-id': 'evt_renew' },
    )

    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(1)
    expect(ws[0].id).toBe(seed.workspaceId)
    expect(ws[0].plan).toBe('starter')
    expect(ws[0].subscriptionStatus).toBe('active')
  })

  it('dedupes by webhook-id — same eventId twice is a no-op the second time', async () => {
    const event = subscriptionActiveEvent({ email: 'dedupe@example.com' })
    await handleDodoPayload(event, { 'webhook-id': 'evt_dup' })
    await handleDodoPayload(event, { 'webhook-id': 'evt_dup' })

    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(1)
    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(1)
    const events = await testDb.db.select().from(webhookEvents)
    expect(events).toHaveLength(1)
  })

  it('subscription.cancelled flips plan to free + records subscriptionStatus=cancelled', async () => {
    await upsertPaidWorkspace(testDb.db, {
      email: 'cancel@example.com',
      plan: 'starter',
      subscriptionId: 'sub_to_cancel',
      customerId: null,
      currentPeriodEnd: null,
    })

    await handleDodoPayload(subscriptionCancelledEvent('sub_to_cancel'), {
      'webhook-id': 'evt_cancel',
    })

    const ws = await testDb.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.subscriptionId, 'sub_to_cancel'))
    expect(ws[0].plan).toBe('free')
    expect(ws[0].subscriptionStatus).toBe('cancelled')
    expect(ws[0].currentPeriodEnd).toBeNull()
  })

  it('subscription.on_hold sets subscriptionStatus=on_hold without changing plan', async () => {
    await upsertPaidWorkspace(testDb.db, {
      email: 'hold@example.com',
      plan: 'starter',
      subscriptionId: 'sub_hold',
      customerId: null,
      currentPeriodEnd: null,
    })

    await handleDodoPayload(subscriptionOnHoldEvent('sub_hold'), {
      'webhook-id': 'evt_hold',
    })

    const ws = await testDb.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.subscriptionId, 'sub_hold'))
    expect(ws[0].plan).toBe('starter')
    expect(ws[0].subscriptionStatus).toBe('on_hold')
  })

  it('subscription.renewed picks up plan changes from the new product_id', async () => {
    await upsertPaidWorkspace(testDb.db, {
      email: 'renew@example.com',
      plan: 'lite',
      subscriptionId: 'sub_renew',
      customerId: null,
      currentPeriodEnd: null,
    })

    await handleDodoPayload(
      subscriptionRenewedEvent({
        subscriptionId: 'sub_renew',
        productId: TEST_PRODUCT_ID_STARTER,
        slug: 'feedbackbot-starter',
      }),
      { 'webhook-id': 'evt_renew2' },
    )

    const ws = await testDb.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.subscriptionId, 'sub_renew'))
    expect(ws[0].plan).toBe('starter')
  })

  it('subscription event with no workspace + no email logs no_workspace_id', async () => {
    const event = subscriptionActiveEvent({})
    delete (event.data as Record<string, unknown>).customer
    delete (event.data as Record<string, unknown>).metadata

    await handleDodoPayload(event, { 'webhook-id': 'evt_no_attr' })

    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(0)
    const events = await testDb.db.select().from(webhookEvents)
    expect(events[0].error).toBe('no_workspace_id')
  })

  it('payment.succeeded is recorded but does not mutate the workspace', async () => {
    await upsertPaidWorkspace(testDb.db, {
      email: 'pay@example.com',
      plan: 'lite',
      subscriptionId: 'sub_test_active',
      customerId: null,
      currentPeriodEnd: 1735000000000,
    })

    await handleDodoPayload(paymentSucceededEvent(), {
      'webhook-id': 'evt_pay',
    })

    const ws = await testDb.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.subscriptionId, 'sub_test_active'))
    expect(ws[0].plan).toBe('lite')
    expect(ws[0].currentPeriodEnd).toBe(1735000000000)

    const events = await testDb.db.select().from(webhookEvents)
    expect(events[0].error).toBeNull()
    expect(events[0].eventType).toBe('payment.succeeded')
  })
})
