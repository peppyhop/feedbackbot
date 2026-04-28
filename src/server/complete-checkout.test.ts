import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import { user, verification, workspaces } from '#/db/schema'
import { runCompleteCheckout, type DodoClient } from '#/server/complete-checkout'
import { createTestDb, type TestDb } from '#/test-helpers/db'
import { makeTestEnv } from '#/test-helpers/env'
import { TEST_PRODUCT_ID_LITE } from '#/test-helpers/test-products'

function makeDodoStub(
  retrieve: (id: string) => Promise<unknown>,
): DodoClient {
  return {
    checkoutSessions: {
      retrieve: vi.fn(retrieve),
    },
  }
}

const baseEnv = makeTestEnv({
  DODO_PAYMENTS_API_KEY: 'test_dodo_key',
  DODO_PAYMENTS_ENV: 'test_mode',
  BETTER_AUTH_URL: 'https://usefeedbackbot.com',
})

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    payment_status: 'succeeded',
    customer: {
      customer_id: 'cust_test',
      email: 'buyer@example.com',
    },
    subscription_id: 'sub_test',
    product_cart: [{ product_id: TEST_PRODUCT_ID_LITE }],
    metadata: { slug: 'feedbackbot-lite' },
    next_billing_date: '2026-05-28T08:00:00.000Z',
    ...overrides,
  }
}

describe('runCompleteCheckout', () => {
  let testDb: TestDb

  beforeEach(() => {
    testDb = createTestDb()
  })

  it('paid session → upserts user + workspace, writes verification, returns verify-URL redirect', async () => {
    const dodo = makeDodoStub(async () => paidSession())

    const result = await runCompleteCheckout({
      data: { cs: 'cs_test_1' },
      env: baseEnv,
      db: testDb.db,
      dodo,
    })

    expect(dodo.checkoutSessions.retrieve).toHaveBeenCalledWith('cs_test_1')
    expect(result.kind).toBe('redirect')
    expect(result.url).toMatch(
      /^https:\/\/usefeedbackbot\.com\/api\/auth\/magic-link\/verify\?token=[A-Za-z]{32}&callbackURL=%2Fonboard%2Fws_/,
    )

    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('buyer@example.com')

    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(1)
    expect(ws[0].subscriptionId).toBe('sub_test')
    expect(ws[0].plan).toBe('lite')
    expect(ws[0].state).toBe('pending')

    const verifs = await testDb.db.select().from(verification)
    expect(verifs).toHaveLength(1)
    const value = JSON.parse(verifs[0].value)
    expect(value).toEqual({ email: 'buyer@example.com', name: '', attempt: 0 })
    // The token in the URL matches the verification.identifier we wrote.
    const tokenInUrl = new URL(result.url).searchParams.get('token')
    expect(tokenInUrl).toBe(verifs[0].identifier)
    // Expiry is roughly 5 min in the future.
    const expiresMs = verifs[0].expiresAt.getTime()
    const now = Date.now()
    expect(expiresMs - now).toBeGreaterThan(4 * 60 * 1000)
    expect(expiresMs - now).toBeLessThan(6 * 60 * 1000)
  })

  it('uses request origin (no leading host) when BETTER_AUTH_URL is empty', async () => {
    const dodo = makeDodoStub(async () => paidSession())

    const result = await runCompleteCheckout({
      data: { cs: 'cs_no_host' },
      env: { ...baseEnv, BETTER_AUTH_URL: '' },
      db: testDb.db,
      dodo,
    })

    expect(result.url.startsWith('/api/auth/magic-link/verify?')).toBe(true)
  })

  it('unpaid session → returns failed redirect, no DB writes', async () => {
    const dodo = makeDodoStub(async () =>
      paidSession({ payment_status: 'failed' }),
    )

    const result = await runCompleteCheckout({
      data: { cs: 'cs_failed' },
      env: baseEnv,
      db: testDb.db,
      dodo,
    })

    expect(result.url).toBe('/?failed=failed#pricing')

    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(0)
    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(0)
    const verifs = await testDb.db.select().from(verification)
    expect(verifs).toHaveLength(0)
  })

  it('missing email on paid session → falls back to homepage, no DB writes', async () => {
    const dodo = makeDodoStub(async () =>
      paidSession({ customer: null, customer_email: null }),
    )

    const result = await runCompleteCheckout({
      data: { cs: 'cs_no_email' },
      env: baseEnv,
      db: testDb.db,
      dodo,
    })

    expect(result.url).toBe('/')

    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(0)
  })

  it('missing DODO_PAYMENTS_API_KEY → returns / immediately, never calls Dodo', async () => {
    const dodo = makeDodoStub(async () => paidSession())

    const result = await runCompleteCheckout({
      data: { cs: 'cs_anything' },
      env: { ...baseEnv, DODO_PAYMENTS_API_KEY: '' },
      db: testDb.db,
      dodo,
    })

    expect(result.url).toBe('/')
    expect(dodo.checkoutSessions.retrieve).not.toHaveBeenCalled()
  })

  it('idempotent on the same checkout-session id — second invocation returns the same workspace', async () => {
    // We use the same paid session both times. upsertPaidWorkspace
    // dedupes by subscription_id, so the second call should reuse.
    const dodo = makeDodoStub(async () => paidSession())

    const first = await runCompleteCheckout({
      data: { cs: 'cs_idem' },
      env: baseEnv,
      db: testDb.db,
      dodo,
    })
    const second = await runCompleteCheckout({
      data: { cs: 'cs_idem' },
      env: baseEnv,
      db: testDb.db,
      dodo,
    })

    const firstWsId = new URL(first.url).pathname.split('/').pop() ??
      new URL(first.url).searchParams.get('callbackURL')?.split('/').pop() ??
      ''
    const secondWsId = new URL(second.url).searchParams
      .get('callbackURL')!
      .split('/')
      .pop()
    const firstWsIdFromCallback = new URL(first.url).searchParams
      .get('callbackURL')!
      .split('/')
      .pop()
    expect(secondWsId).toBe(firstWsIdFromCallback)
    expect(firstWsId).toBeTruthy()

    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(1)
    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(1)
    // Each call writes a fresh verification token (intentional — the
    // user might re-land on /success and need a usable token).
    const verifs = await testDb.db.select().from(verification)
    expect(verifs).toHaveLength(2)
  })

  it('falls back to product_id → slug mapping when metadata.slug is missing', async () => {
    const dodo = makeDodoStub(async () =>
      paidSession({ metadata: {} }),
    )

    await runCompleteCheckout({
      data: { cs: 'cs_no_slug' },
      env: baseEnv,
      db: testDb.db,
      dodo,
    })

    const ws = await testDb.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.subscriptionId, 'sub_test'))
    expect(ws[0].plan).toBe('lite') // resolved from TEST_PRODUCT_ID_LITE
  })
})
