import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { verifyTurnstile } from './turnstile'

describe('verifyTurnstile', () => {
  const realFetch = globalThis.fetch
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('returns ok:true with hostname for a valid token', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ success: true, hostname: 'peppyhop.com' }),
    })
    const result = await verifyTurnstile('tok', '1.2.3.4', 'secret')
    expect(result).toEqual({ ok: true, hostname: 'peppyhop.com' })
    const [, init] = fetchMock.mock.calls[0]!
    const body = (init as RequestInit).body as URLSearchParams
    expect(body.get('secret')).toBe('secret')
    expect(body.get('response')).toBe('tok')
    expect(body.get('remoteip')).toBe('1.2.3.4')
  })

  it('returns the error codes for an invalid token', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
    })
    const result = await verifyTurnstile('bad', '1.2.3.4', 'secret')
    expect(result).toEqual({
      ok: false,
      codes: ['invalid-input-response'],
    })
  })

  it('returns network-error when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    const result = await verifyTurnstile('tok', '1.2.3.4', 'secret')
    expect(result).toEqual({ ok: false, codes: ['network-error'] })
  })

  it('omits remoteip when client IP is unknown', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ success: true, hostname: 'peppyhop.com' }),
    })
    await verifyTurnstile('tok', 'unknown', 'secret')
    const [, init] = fetchMock.mock.calls[0]!
    const body = (init as RequestInit).body as URLSearchParams
    expect(body.has('remoteip')).toBe(false)
  })

  it('returns empty hostname when CF omits it', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    })
    const result = await verifyTurnstile('tok', '1.2.3.4', 'secret')
    expect(result).toEqual({ ok: true, hostname: '' })
  })
})
