import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_PRODUCT_ID_LITE, TEST_PRODUCT_ID_STARTER } from '#/test-helpers/test-products'

// Hoisted holders so vi.mock factories can read live values from
// per-test setup. Vitest hoists vi.mock() above imports; this is
// the only safe way to wire mock factories to mutable state.
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

// Import AFTER vi.mock — the handler picks up the mocked modules.
const { handle } = await import('#/routes/api/checkout/start')

beforeEach(() => {
  mocks.env.DODO_PAYMENTS_API_KEY = 'test_dodo_key'
  mocks.env.DODO_PAYMENTS_ENV = 'test_mode'
  mocks.env.BETTER_AUTH_URL = 'https://usefeedbackbot.com'
  mocks.dodoCreate.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/checkout/start', () => {
  it('missing plan → 400', async () => {
    const res = await handle(
      new Request('https://usefeedbackbot.com/api/checkout/start'),
    )
    expect(res.status).toBe(400)
  })

  it('unknown plan → 400', async () => {
    const res = await handle(
      new Request('https://usefeedbackbot.com/api/checkout/start?plan=unicorn'),
    )
    expect(res.status).toBe(400)
  })

  it('missing DODO_PAYMENTS_API_KEY → 503', async () => {
    mocks.env.DODO_PAYMENTS_API_KEY = undefined
    const res = await handle(
      new Request('https://usefeedbackbot.com/api/checkout/start?plan=lite'),
    )
    expect(res.status).toBe(503)
  })

  it('valid plan → 302 to the mocked Dodo checkout URL with the right product_id', async () => {
    mocks.dodoCreate.mockResolvedValueOnce({
      checkout_url: 'https://checkout.dodopayments.com/session/cs_xyz',
    })

    const res = await handle(
      new Request('https://usefeedbackbot.com/api/checkout/start?plan=lite'),
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      'https://checkout.dodopayments.com/session/cs_xyz',
    )

    expect(mocks.dodoCreate).toHaveBeenCalledTimes(1)
    const arg = mocks.dodoCreate.mock.calls[0][0]
    expect(arg.product_cart).toEqual([
      { product_id: TEST_PRODUCT_ID_LITE, quantity: 1 },
    ])
    expect(arg.metadata).toMatchObject({
      plan: 'lite',
      slug: 'feedbackbot-lite',
      flow: 'pay_first',
    })
    // Return URL must contain Dodo's substitution placeholder so we
    // can call retrieve(cs) on the success page.
    expect(arg.return_url).toBe(
      'https://usefeedbackbot.com/dashboard/billing/success?cs={CHECKOUT_SESSION_ID}',
    )
  })

  it('plan=starter resolves to the right product id', async () => {
    mocks.dodoCreate.mockResolvedValueOnce({
      checkout_url: 'https://checkout.dodopayments.com/session/cs_starter',
    })

    await handle(
      new Request(
        'https://usefeedbackbot.com/api/checkout/start?plan=starter',
      ),
    )

    const arg = mocks.dodoCreate.mock.calls[0][0]
    expect(arg.product_cart).toEqual([
      { product_id: TEST_PRODUCT_ID_STARTER, quantity: 1 },
    ])
  })

  it('falls back to request origin when BETTER_AUTH_URL is unset', async () => {
    mocks.env.BETTER_AUTH_URL = ''
    mocks.dodoCreate.mockResolvedValueOnce({
      checkout_url: 'https://dodo/cs_p',
    })

    await handle(
      new Request(
        'https://pr-99.preview.usefeedbackbot.com/api/checkout/start?plan=lite',
      ),
    )

    const arg = mocks.dodoCreate.mock.calls[0][0]
    expect(arg.return_url).toBe(
      'https://pr-99.preview.usefeedbackbot.com/dashboard/billing/success?cs={CHECKOUT_SESSION_ID}',
    )
  })

  it('falls through to 502 if Dodo returns no URL', async () => {
    mocks.dodoCreate.mockResolvedValueOnce({})

    const res = await handle(
      new Request('https://usefeedbackbot.com/api/checkout/start?plan=lite'),
    )

    expect(res.status).toBe(502)
  })
})
