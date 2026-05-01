import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addTurnstileHostname,
  turnstileAdminConfigured,
} from './turnstile-admin'

const ENV = {
  CF_API_TOKEN: 'tok',
  CF_ACCOUNT_ID: 'acct_1',
  CF_TURNSTILE_WIDGET_ID: '0x4abc',
}

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

  it('GETs current domains, PATCHes with the merged list', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({ success: true, result: { domains: ['a.com'] } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true, result: {} }),
      })
    const ok = await addTurnstileHostname('b.com', ENV)
    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, patchInit] = fetchMock.mock.calls[1]!
    const body = JSON.parse((patchInit as RequestInit).body as string)
    expect(new Set(body.domains)).toEqual(new Set(['a.com', 'b.com']))
  })

  it('skips PATCH when domain already on the list', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        result: { domains: ['a.com', 'b.com'] },
      }),
    })
    const ok = await addTurnstileHostname('a.com', ENV)
    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns false (graceful) when env is unset', async () => {
    const ok = await addTurnstileHostname('a.com', {})
    expect(ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns false when CF responds with success:false', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: false,
        errors: [{ code: 7003, message: 'no route' }],
      }),
    })
    const ok = await addTurnstileHostname('a.com', ENV)
    expect(ok).toBe(false)
  })

  it('returns false when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    const ok = await addTurnstileHostname('a.com', ENV)
    expect(ok).toBe(false)
  })
})
