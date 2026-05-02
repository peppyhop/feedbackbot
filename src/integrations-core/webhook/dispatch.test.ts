import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { webhookDispatcher } from './dispatch'
import type { OutboundTicketPayload } from '#/schema/integration'

const PAYLOAD: OutboundTicketPayload = {
  event: 'ticket.created',
  workspace: { id: 'ws_x', domain: 'example.com' },
  ticket: {
    id: 'tkt_1',
    message: 'hello',
    page_url: 'https://example.com/',
    email: null,
    created_at: 1700000000,
    classification: {
      primary: 'bug',
      secondary: [],
      confidence: 0.9,
      summary: 's',
      suggested_title: 'title',
    },
  },
  delivery: { id: 'dlv_1', attempt: 0 },
}

const CREDS = { kind: 'webhook' as const, url: 'https://hook.example/in', hmac_secret: 'shhh' }

describe('webhookDispatcher', () => {
  const realFetch = globalThis.fetch
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('POSTs JSON with HMAC + timestamp headers, returns ok on 2xx', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'ok',
    })
    const result = await webhookDispatcher.dispatch({
      creds: CREDS,
      routeConfig: {},
      payload: PAYLOAD,
      hmacSeed: 'unused',
    })
    expect(result.ok).toBe(true)
    expect(result.responseCode).toBe(200)
    expect(result.responseBody).toBe('ok')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://hook.example/in')
    expect((init as RequestInit).method).toBe('POST')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-feedback-signature']).toMatch(/^sha256=[0-9a-f]{64}$/)
    expect(headers['x-feedback-timestamp']).toMatch(/^\d{10}$/)
    expect(headers['user-agent']).toBe('FeedbackBot/1.0')
    // Body is the canonical OutboundTicketPayload, JSON-stringified.
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.event).toBe('ticket.created')
    expect(body.ticket.id).toBe('tkt_1')
  })

  it('signature is HMAC-SHA256 of `{timestamp}.{body}` — verifiable on the receiver side', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '',
    })
    await webhookDispatcher.dispatch({
      creds: CREDS,
      routeConfig: {},
      payload: PAYLOAD,
      hmacSeed: 'unused',
    })
    const [, init] = fetchMock.mock.calls[0]!
    const headers = (init as RequestInit).headers as Record<string, string>
    const body = (init as RequestInit).body as string
    const signature = headers['x-feedback-signature']!.replace('sha256=', '')
    const timestamp = headers['x-feedback-timestamp']!
    // Recompute via the same helper used internally + a fresh
    // imported instance (mirrors how a customer would verify).
    const { hmacSha256Hex } = await import('#/lib/crypto')
    const expected = await hmacSha256Hex(CREDS.hmac_secret, `${timestamp}.${body}`)
    expect(signature).toBe(expected)
  })

  it('returns ok:false with response code on 4xx / 5xx', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'server error',
    })
    const result = await webhookDispatcher.dispatch({
      creds: CREDS,
      routeConfig: {},
      payload: PAYLOAD,
      hmacSeed: 'unused',
    })
    expect(result.ok).toBe(false)
    expect(result.responseCode).toBe(500)
    expect(result.responseBody).toBe('server error')
  })

  it('returns ok:false with error on fetch throw', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    const result = await webhookDispatcher.dispatch({
      creds: CREDS,
      routeConfig: {},
      payload: PAYLOAD,
      hmacSeed: 'unused',
    })
    expect(result.ok).toBe(false)
    expect(result.responseCode).toBeNull()
    expect(result.error).toBe('boom')
  })

  it('rejects on creds-kind mismatch (defense for stored creds drift)', async () => {
    const result = await webhookDispatcher.dispatch({
      // @ts-expect-error — exercising the runtime guard, not the type
      creds: { kind: 'slack', token: 'xoxb-x' },
      routeConfig: {},
      payload: PAYLOAD,
      hmacSeed: 'unused',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('creds kind mismatch')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('truncates long response bodies to 2000 chars', async () => {
    const big = 'x'.repeat(5000)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => big,
    })
    const result = await webhookDispatcher.dispatch({
      creds: CREDS,
      routeConfig: {},
      payload: PAYLOAD,
      hmacSeed: 'unused',
    })
    expect(result.responseBody?.length).toBe(2000)
  })
})
