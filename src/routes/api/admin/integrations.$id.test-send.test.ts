// Tests for POST /api/admin/integrations/:id/test-send

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  integrations,
  member,
  organization,
  user,
  workspaces,
} from '#/db/schema'
import { newId } from '#/db/ids'
import { createTestDb, type TestDb } from '#/test-helpers/db'

// Hoisted mock state — re-set per test so each test starts clean.
const mocks = vi.hoisted(() => ({
  db: null as ReturnType<typeof createTestDb>['db'] | null,
  getSession: vi.fn(),
  listMembers: vi.fn(),
}))

vi.mock('#/db/client', async () => {
  const actual = await vi.importActual<typeof import('#/db/client')>('#/db/client')
  return { ...actual, makeDb: () => mocks.db! }
})

vi.mock('#/lib/auth', () => ({
  auth: { api: { getSession: mocks.getSession, listMembers: mocks.listMembers } },
}))

// 32 bytes of zeros → valid AES-GCM master key (just for tests).
const TEST_MASTER_KEY_B64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

vi.mock('#/env', () => ({
  env: {
    DB: {},
    BETTER_AUTH_SECRET: 'test',
    INTEGRATIONS_ENCRYPTION_KEY: TEST_MASTER_KEY_B64,
    HMAC_SECRET_SEED: 'test-hmac',
  },
}))

const { Route } = await import('./integrations.$id.test-send')
const { b64ToBytes, deriveWorkspaceKey, encryptCredentials } = await import(
  '#/lib/crypto'
)
// Side-effect import: registers the webhook + slack dispatchers
// via the integrations-core barrel.
await import('#/integrations-core')

async function call(integrationId: string, domain: string): Promise<Response> {
  const handlers = (Route.options.server as {
    handlers: Record<string, (ctx: { request: Request; params: { id: string } }) => Promise<Response>>
  }).handlers
  const handler = handlers.POST
  const url = `https://t/api/admin/integrations/${integrationId}/test-send?domain=${encodeURIComponent(domain)}`
  return handler({
    request: new Request(url, { method: 'POST' }),
    params: { id: integrationId },
  })
}

describe('test-send endpoint', () => {
  let testDb: TestDb
  const userId = 'usr_t'
  const orgId = 'org_t'
  const wsId = newId.workspace()
  const integrationId = newId.integration()
  const domain = 'example.com'

  const realFetch = globalThis.fetch
  const fetchMock = vi.fn()

  beforeEach(async () => {
    testDb = createTestDb()
    mocks.db = testDb.db
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    mocks.getSession.mockResolvedValue({ user: { id: userId } })
    mocks.listMembers.mockResolvedValue({ members: [{ userId }] })

    // Seed: user (member FK requires it) + org + member + claimed
    // workspace + a webhook integration with encrypted creds.
    await testDb.db.insert(user).values({
      id: userId,
      name: 'tester',
      email: 'tester@example.com',
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isAnonymous: false,
    })
    await testDb.db.insert(organization).values({
      id: orgId,
      name: 'org',
      slug: 'org',
      createdAt: new Date(),
    })
    await testDb.db.insert(member).values({
      id: 'mem_1',
      organizationId: orgId,
      userId,
      role: 'owner',
      createdAt: new Date(),
    })
    await testDb.db.insert(workspaces).values({
      id: wsId,
      domain,
      state: 'claimed',
      verificationToken: 'tok',
      betterAuthOrgId: orgId,
      settings: '{}',
      ticketCount: 0,
      createdAt: Date.now(),
      claimedAt: Date.now(),
      plan: 'lite',
      subscriptionId: 'sub_x',
      subscriptionStatus: 'active',
      currentPeriodEnd: null,
      dodoCustomerId: null,
      turnstileSyncedAt: null,
    })

    const masterKey = b64ToBytes(TEST_MASTER_KEY_B64)
    const wsKey = await deriveWorkspaceKey(masterKey, wsId)
    const encrypted = await encryptCredentials(wsKey, {
      kind: 'webhook',
      url: 'https://hook.example/in',
      hmac_secret: 'sixteen-char-min-secret-for-tests',
    })
    await testDb.db.insert(integrations).values({
      id: integrationId,
      workspaceId: wsId,
      kind: 'webhook',
      name: 'test webhook',
      credentials: encrypted,
      enabled: 1,
      createdAt: Date.now(),
    })
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('401 when not signed in', async () => {
    mocks.getSession.mockResolvedValueOnce(null)
    const res = await call(integrationId, domain)
    expect(res.status).toBe(401)
  })

  it('403 when not a member of the workspace', async () => {
    mocks.listMembers.mockResolvedValueOnce({ members: [{ userId: 'other' }] })
    const res = await call(integrationId, domain)
    expect(res.status).toBe(403)
  })

  it('404 when integration id belongs to a different workspace', async () => {
    const res = await call('int_does_not_exist', domain)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('no_integration')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('dispatches a synthetic OutboundTicketPayload with HMAC headers', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'ack',
    })
    const res = await call(integrationId, domain)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      response_code: number
      response_body: string
    }
    expect(body.ok).toBe(true)
    expect(body.response_code).toBe(200)
    expect(body.response_body).toBe('ack')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://hook.example/in')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['x-feedback-signature']).toMatch(/^sha256=[0-9a-f]{64}$/)
    expect(headers['x-feedback-timestamp']).toMatch(/^\d{10}$/)

    const payload = JSON.parse((init as RequestInit).body as string)
    expect(payload.event).toBe('ticket.created')
    expect(payload.workspace.domain).toBe(domain)
    // Synthetic ticket id is recognizable as a test event.
    expect(payload.ticket.id).toMatch(/^tkt_test_[a-z0-9]+$/)
    expect(payload.delivery.id).toMatch(/^dlv_test_[a-z0-9]+$/)
  })

  it('does NOT write a row to integration_deliveries (test-send is a probe)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '',
    })
    await call(integrationId, domain)
    const { integrationDeliveries } = await import('#/db/schema')
    const rows = await testDb.db.select().from(integrationDeliveries)
    expect(rows).toHaveLength(0)
  })

  it('relays the failure through (5xx → ok:false + status code)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => 'bad gateway',
    })
    const res = await call(integrationId, domain)
    expect(res.status).toBe(200) // endpoint succeeded
    const body = (await res.json()) as {
      ok: boolean
      response_code: number
      response_body: string
    }
    expect(body.ok).toBe(false) // dispatcher reported failure
    expect(body.response_code).toBe(502)
    expect(body.response_body).toBe('bad gateway')
  })
})
