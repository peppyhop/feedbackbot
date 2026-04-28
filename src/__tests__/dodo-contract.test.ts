// Hits Dodo's real test-mode API. Throws at module load if
// DODO_PAYMENTS_API_KEY isn't set so missing config is loud, not
// silent. The user-confirmed posture (in plan): every contributor
// sets the secret in `.env.local`; CI inherits it from the workflow
// env.
//
// Lives outside the vi.mock('dodopayments') used elsewhere — this
// test file imports the SDK directly and the bare module is what
// gets exercised.
//
// What this catches that the mocks can't:
//   - Wrong / rotated test product IDs in src/lib/billing/plans.ts
//   - Schema drift on the create() request body
//   - Authentication regression (key revoked or in wrong env)
//
// What it doesn't try to do:
//   - Complete payment / drive the hosted checkout (needs a browser)
//   - Verify retrieve() returns 'paid' (same — needs a real payment)

import { describe, expect, it } from 'vitest'
import DodoPayments from 'dodopayments'

import { TEST_PRODUCT_ID_LITE } from '#/test-helpers/test-products'

// Prefer DODO_TEST_API_KEY when present (separate secret name in
// GitHub Actions so it's clearly the test-mode bearer, distinct from
// the live key in DODO_PAYMENTS_API_KEY). Locally, fall back to
// DODO_PAYMENTS_API_KEY since .env.local already holds a test-mode
// key under that name.
const DODO_KEY =
  process.env.DODO_TEST_API_KEY ?? process.env.DODO_PAYMENTS_API_KEY

// Hard refusal to ever touch live mode from this test. Production
// CI sets DODO_PAYMENTS_ENV=live_mode at the job level — `pnpm test`
// there silently skips this file (the deploy step still runs).
// Preview CI doesn't set the var, so the test runs against test mode.
const stageEnv = process.env.DODO_PAYMENTS_ENV
const isLiveStage = stageEnv === 'live_mode'

const describeContract = isLiveStage ? describe.skip : describe

if (!isLiveStage && !DODO_KEY) {
  throw new Error(
    'A Dodo TEST-MODE bearer token is required for the contract ' +
      'test. Set DODO_TEST_API_KEY (preferred — distinct GitHub secret) ' +
      'or rely on DODO_PAYMENTS_API_KEY in .env.local. Never use the ' +
      'live key here; the test refuses to run when ' +
      'DODO_PAYMENTS_ENV=live_mode anyway.',
  )
}

describeContract('Dodo Payments — test-mode contract', () => {
  // Construct inside the describe so the constructor doesn't run
  // when the suite is skipped (live stage).
  const dodo = new DodoPayments({
    bearerToken: DODO_KEY!,
    environment: 'test_mode',
  })

  it(
    'creates a checkout session for the lite product and returns a URL',
    async () => {
      // Triple-lock: re-assert here so a future refactor that moves
      // this above the describe won't be able to slip past the gate.
      expect(stageEnv).not.toBe('live_mode')

      const resp = (await dodo.checkoutSessions.create({
        product_cart: [{ product_id: TEST_PRODUCT_ID_LITE, quantity: 1 }],
        metadata: { source: 'feedbackbot-contract-test' },
        return_url:
          'https://usefeedbackbot.com/dashboard/billing/success?cs={CHECKOUT_SESSION_ID}',
      })) as unknown as {
        checkout_url?: string
        payment_link?: string
        url?: string
      }

      const url = resp.checkout_url ?? resp.payment_link ?? resp.url
      expect(url, 'Dodo create() returned no URL').toBeTruthy()
      expect(url).toMatch(/^https?:\/\//)
    },
    20_000,
  )
})
