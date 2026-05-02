import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addTurnstileHostname,
  getTurnstileWidget,
  turnstileAdminConfigured,
} from './turnstile-admin'

const ENV = {
  CF_API_TOKEN: 'tok',
  CF_ACCOUNT_ID: 'acct_1',
  CF_TURNSTILE_WIDGET_ID: '0x4abc',
}

// Sentry is imported by the module — stub captureMessage so tests
// don't need a real DSN. Spies on the same vi.fn so we can assert.
vi.mock('#/lib/sentry', () => ({
  Sentry: { captureMessage: vi.fn() },
  withSentry: (_opts: unknown, h: unknown) => h,
  sentryOptions: () => undefined,
}))

describe('turnstileAdminConfigured', () => {
  it('true only when all three vars are set', () => {
    expect(turnstileAdminConfigured(ENV)).toBe(true)
    expect(turnstileAdminConfigured({ ...ENV, CF_API_TOKEN: undefined })).toBe(false)
    expect(turnstileAdminConfigured({ ...ENV, CF_ACCOUNT_ID: '' })).toBe(false)
    expect(turnstileAdminConfigured({})).toBe(false)
  })
})

describe('addTurnstileHostname', () => {
  const realFetch = globalThis.fetch
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  function ok(json: unknown) {
    return { ok: true, json: async () => json }
  }
  function bad(status: number, json: unknown) {
    return { ok: false, status, json: async () => json }
  }

  it('GETs current widget, PUTs allowlisted body with merged list', async () => {
    // GET returns the full widget incl. fields PUT rejects
    // (sitekey, secret, created_on, modified_on). Our PUT must
    // strip those.
    fetchMock
      .mockResolvedValueOnce(
        ok({
          success: true,
          result: {
            sitekey: '0x4abc',
            secret: 'shhh',
            name: 'fb',
            mode: 'managed',
            domains: ['a.com'],
            created_on: '2026-01-01',
            modified_on: '2026-04-01',
            bot_fight_mode: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        ok({
          success: true,
          result: { name: 'fb', mode: 'managed', domains: ['a.com', 'b.com'] },
        }),
      )
    const result = await addTurnstileHostname('b.com', ENV)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(new Set(result.hostnames)).toEqual(new Set(['a.com', 'b.com']))
    }
    const putCall = fetchMock.mock.calls[1]!
    const init = putCall[1] as RequestInit
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body as string)
    // Writable fields preserved.
    expect(body).toMatchObject({
      name: 'fb',
      mode: 'managed',
      domains: ['a.com', 'b.com'],
      bot_fight_mode: false,
    })
    // Server-generated fields stripped — sending these fails CF
    // with "json: unknown field" errors.
    expect(body).not.toHaveProperty('sitekey')
    expect(body).not.toHaveProperty('secret')
    expect(body).not.toHaveProperty('created_on')
    expect(body).not.toHaveProperty('modified_on')
  })

  it('skips PATCH when domain already on the list', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ success: true, result: { domains: ['a.com', 'b.com'] } }),
    )
    const result = await addTurnstileHostname('a.com', ENV)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.alreadyPresent).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns not_configured when env is incomplete', async () => {
    const result = await addTurnstileHostname('a.com', {})
    expect(result).toEqual({
      ok: false,
      reason: 'not_configured',
      details: null,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('classifies 401 as auth_failed (no retry)', async () => {
    fetchMock.mockResolvedValueOnce(bad(401, { error: 'unauth' }))
    const result = await addTurnstileHostname('a.com', ENV)
    expect(result).toEqual({
      ok: false,
      reason: 'auth_failed',
      details: { error: 'unauth' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('classifies 404 as widget_not_found (no retry)', async () => {
    fetchMock.mockResolvedValueOnce(bad(404, { error: 'no widget' }))
    const result = await addTurnstileHostname('a.com', ENV)
    expect(result).toEqual({
      ok: false,
      reason: 'widget_not_found',
      details: { error: 'no widget' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // Retry tests use real timers — exponential backoff is 1+2+4s
  // before the final attempt. Per-test timeout bumped to 12s.
  it(
    'retries on 500 then succeeds',
    async () => {
      fetchMock
        .mockResolvedValueOnce(bad(500, { error: 'boom' }))
        .mockResolvedValueOnce(
          ok({ success: true, result: { domains: [] } }),
        )
        .mockResolvedValueOnce(
          ok({ success: true, result: { domains: ['a.com'] } }),
        )
      const result = await addTurnstileHostname('a.com', ENV)
      expect(result.ok).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    },
    12_000,
  )

  it(
    'returns network_error after retry exhaustion',
    async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      const result = await addTurnstileHostname('a.com', ENV)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('network_error')
      // 1 initial + 3 retries = 4 attempts
      expect(fetchMock).toHaveBeenCalledTimes(4)
    },
    12_000,
  )

  it('captures Sentry message on terminal failure', async () => {
    const { Sentry } = await import('#/lib/sentry')
    fetchMock.mockResolvedValueOnce(bad(401, { error: 'unauth' }))
    await addTurnstileHostname('a.com', ENV)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'turnstile-admin: hostname add failed',
      expect.objectContaining({ level: 'error' }),
    )
  })
})

describe('getTurnstileWidget', () => {
  const realFetch = globalThis.fetch
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('returns the raw widget on success', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, result: { domains: ['a.com'] } }),
    })
    const result = await getTurnstileWidget(ENV)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.widget).toEqual({
        success: true,
        result: { domains: ['a.com'] },
      })
    }
  })

  it('classifies the failure on error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden' }),
    })
    const result = await getTurnstileWidget(ENV)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('auth_failed')
  })
})
