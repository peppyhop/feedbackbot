import { beforeEach, describe, expect, it } from 'vitest'

import { workspaces } from '#/db/schema'
import { newId } from '#/db/ids'
import { ApiError } from '#/lib/http'
import { getWorkspaceFromOrigin } from '#/lib/workspace-scope'
import { createTestDb, type TestDb } from '#/test-helpers/db'

function expectApiError(p: Promise<unknown>, status: number, code: string) {
  return p.then(
    () => {
      throw new Error(`expected ApiError ${status}/${code}, but resolved`)
    },
    (err) => {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(status)
      expect((err as ApiError).code).toBe(code)
    },
  )
}

async function seedClaimedWorkspace(testDb: TestDb, domain: string) {
  await testDb.db.insert(workspaces).values({
    id: newId.workspace(),
    domain,
    state: 'claimed',
    verificationToken: 'tok',
    betterAuthOrgId: 'org_test',
    settings: '{}',
    ticketCount: 0,
    createdAt: Date.now(),
    claimedAt: Date.now(),
    plan: 'lite',
    subscriptionId: null,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    dodoCustomerId: null,
  })
}

describe('getWorkspaceFromOrigin', () => {
  let testDb: TestDb

  beforeEach(() => {
    testDb = createTestDb()
  })

  it('no Origin or Referer → 400 bad_origin', async () => {
    const req = new Request('https://api.example.com/api/comment')
    await expectApiError(
      getWorkspaceFromOrigin(testDb.db, req),
      400,
      'bad_origin',
    )
  })

  it('Origin with no matching workspace → 404 no_workspace', async () => {
    const req = new Request('https://api.example.com/api/comment', {
      headers: { origin: 'https://nobody.com' },
    })
    await expectApiError(
      getWorkspaceFromOrigin(testDb.db, req),
      404,
      'no_workspace',
    )
  })

  it('Origin matches a workspace → returns it', async () => {
    await seedClaimedWorkspace(testDb, 'acme.com')
    const req = new Request('https://api.example.com/api/comment', {
      headers: { origin: 'https://acme.com' },
    })
    const ws = await getWorkspaceFromOrigin(testDb.db, req)
    expect(ws.domain).toBe('acme.com')
  })

  it('falls back to Referer when Origin is missing', async () => {
    await seedClaimedWorkspace(testDb, 'acme.com')
    const req = new Request('https://api.example.com/api/comment', {
      headers: { referer: 'https://acme.com/some-page' },
    })
    const ws = await getWorkspaceFromOrigin(testDb.db, req)
    expect(ws.domain).toBe('acme.com')
  })

  it('Origin with subdomain still resolves to the apex (per domainFromHeader)', async () => {
    await seedClaimedWorkspace(testDb, 'acme.com')
    const req = new Request('https://api.example.com/api/comment', {
      headers: { origin: 'https://app.acme.com' },
    })
    const ws = await getWorkspaceFromOrigin(testDb.db, req)
    expect(ws.domain).toBe('acme.com')
  })
})
