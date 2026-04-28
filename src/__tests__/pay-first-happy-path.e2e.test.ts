// Scripted end-to-end of the pay-first onboarding chain. No browser
// — drives the server-side handlers in sequence with mocked Dodo
// responses, then asserts the DB state matches "paid signed-in user
// with a pending workspace and a usable magic-link token".
//
// What this tests as a UNIT does not:
//   - Catches anyone who breaks the URL contract between the
//     /api/checkout/start handler and the /dashboard/billing/success
//     loader (the cs= placeholder, the metadata.slug field, etc.).
//   - Catches anyone who breaks idempotency on subscription_id —
//     a second invocation of completeCheckout for the same Dodo
//     session must reuse the existing user + workspace.
//
// What it doesn't do:
//   - Drive Better Auth's /api/auth/magic-link/verify endpoint
//     (that's better-auth's surface, not ours).
//   - Render the React /onboard/{ws} component.

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { user, verification, workspaces } from '#/db/schema'
import { runCompleteCheckout, type DodoClient } from '#/server/complete-checkout'
import { createTestDb, type TestDb } from '#/test-helpers/db'
import { makeTestEnv } from '#/test-helpers/env'
import { TEST_PRODUCT_ID_LITE } from '#/test-helpers/test-products'

// Mock the start.ts module's deps so its `handle()` returns a real
// 302 we can inspect. /api/checkout/start is the entry hop —
// completeCheckout is what runs after Dodo redirects back.
const mocks = vi.hoisted(() => ({
  env: {
    DODO_PAYMENTS_API_KEY: 'test_dodo_key' as string | undefined,
    DODO_PAYMENTS_ENV: 'test_mode' as 'live_mode' | 'test_mode' | undefined,
    BETTER_AUTH_URL: 'https://usefeedbackbot.com' as string | undefined,
  },
  dodoCreate: vi.fn() as ReturnType<typeof vi.fn>,
}))

vi.mock('#/env', () => ({ env: mocks.env }))
vi.mock('dodopayments', () => ({
  default: vi.fn(() => ({
    checkoutSessions: { create: mocks.dodoCreate },
  })),
}))

const { handle: startHandle } = await import('#/routes/api/checkout/start')

describe('pay-first happy path (scripted e2e)', () => {
  let testDb: TestDb

  beforeEach(() => {
    testDb = createTestDb()
    mocks.env.DODO_PAYMENTS_API_KEY = 'test_dodo_key'
    mocks.env.DODO_PAYMENTS_ENV = 'test_mode'
    mocks.env.BETTER_AUTH_URL = 'https://usefeedbackbot.com'
    mocks.dodoCreate.mockReset()
  })

  it('start → (Dodo) → success → /onboard, idempotent on re-success', async () => {
    // 1. Visitor clicks "Start with Lite" on landing.
    mocks.dodoCreate.mockResolvedValueOnce({
      checkout_url:
        'https://checkout.dodopayments.com/session/cs_happy_path',
    })
    const startRes = await startHandle(
      new Request('https://usefeedbackbot.com/api/checkout/start?plan=lite'),
    )
    expect(startRes.status).toBe(302)
    expect(startRes.headers.get('location')).toBe(
      'https://checkout.dodopayments.com/session/cs_happy_path',
    )
    const startCall = mocks.dodoCreate.mock.calls[0][0]
    expect(startCall.return_url).toBe(
      'https://usefeedbackbot.com/dashboard/billing/success?cs={CHECKOUT_SESSION_ID}',
    )

    // 2. (Dodo collects email + payment in the hosted UI; we can't
    //    drive that in a test. Simulate by calling completeCheckout
    //    directly with a stub Dodo client returning a paid session.)
    const dodoStub: DodoClient = {
      checkoutSessions: {
        retrieve: vi.fn(async () => ({
          payment_status: 'succeeded',
          customer: {
            customer_id: 'cust_happy',
            email: 'happy@example.com',
          },
          subscription_id: 'sub_happy',
          product_cart: [{ product_id: TEST_PRODUCT_ID_LITE }],
          metadata: { slug: 'feedbackbot-lite', plan: 'lite' },
          next_billing_date: '2026-05-28T08:00:00.000Z',
        })),
      },
    }
    const successResult = await runCompleteCheckout({
      data: { cs: 'cs_happy_path' },
      env: makeTestEnv({
        DODO_PAYMENTS_API_KEY: 'test_dodo_key',
        BETTER_AUTH_URL: 'https://usefeedbackbot.com',
      }),
      db: testDb.db,
      dodo: dodoStub,
    })

    // 3. Assert the success-page redirect is to a magic-link verify
    //    URL containing a token + a callbackURL pointing at /onboard.
    expect(successResult.kind).toBe('redirect')
    const verifyUrl = new URL(successResult.url)
    expect(verifyUrl.origin).toBe('https://usefeedbackbot.com')
    expect(verifyUrl.pathname).toBe('/api/auth/magic-link/verify')
    const token = verifyUrl.searchParams.get('token')
    expect(token).toMatch(/^[A-Za-z]{32}$/)
    const callbackURL = verifyUrl.searchParams.get('callbackURL') ?? ''
    expect(callbackURL).toMatch(/^\/onboard\/ws_/)

    // 4. DB state: one user, one workspace, one verification row whose
    //    identifier matches the URL token.
    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('happy@example.com')
    expect(users[0].emailVerified).toBe(true)

    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(1)
    expect(ws[0].subscriptionId).toBe('sub_happy')
    expect(ws[0].plan).toBe('lite')
    expect(ws[0].state).toBe('pending')
    expect(callbackURL.endsWith(ws[0].id)).toBe(true)

    const verifs = await testDb.db.select().from(verification)
    expect(verifs).toHaveLength(1)
    expect(verifs[0].identifier).toBe(token)

    // 5. Idempotency: hitting /success again with the same Dodo
    //    session id (e.g., a refresh) MUST NOT create another user
    //    or workspace.
    const second = await runCompleteCheckout({
      data: { cs: 'cs_happy_path' },
      env: makeTestEnv({
        DODO_PAYMENTS_API_KEY: 'test_dodo_key',
        BETTER_AUTH_URL: 'https://usefeedbackbot.com',
      }),
      db: testDb.db,
      dodo: dodoStub,
    })
    const secondCallback = new URL(second.url).searchParams.get('callbackURL')!
    expect(secondCallback).toBe(callbackURL)

    const usersAfter = await testDb.db.select().from(user)
    const wsAfter = await testDb.db.select().from(workspaces)
    expect(usersAfter).toHaveLength(1)
    expect(wsAfter).toHaveLength(1)
  })
})
