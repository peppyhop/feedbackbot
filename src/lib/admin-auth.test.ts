// Tests for the workspace-scope guard used by every /api/admin/* route.
// Per CLAUDE.md golden rule #2 (workspace_id scoping), this is the single
// most security-sensitive helper in the codebase — every admin route
// trusts its return value to gate D1 access. Cover every failure mode.

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { workspaces } from '#/db/schema'
import { newId } from '#/db/ids'
import { ApiError } from '#/lib/http'
import { createTestDb, type TestDb } from '#/test-helpers/db'

// Hoisted mock state — mutated per test, read by the vi.mock factories
// at module load time. Same pattern used by webhook-reducer.test.ts.
const mocks = vi.hoisted(() => ({
  db: null as ReturnType<typeof createTestDb>['db'] | null,
  getSession: vi.fn(),
  listMembers: vi.fn(),
}))

vi.mock('#/db/client', async () => {
  const actual = await vi.importActual<typeof import('#/db/client')>(
    '#/db/client',
  )
  return {
    ...actual,
    makeDb: () => mocks.db!,
  }
})

vi.mock('#/lib/auth', () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      listMembers: mocks.listMembers,
    },
  },
}))

vi.mock('#/env', () => ({
  env: {
    DB: {},
    BETTER_AUTH_SECRET: 'test',
  },
}))

// Imported AFTER vi.mock — picks up the mocked deps.
const { requireAdminWorkspace, requireSession } = await import('#/lib/admin-auth')

describe('requireAdminWorkspace', () => {
  let testDb: TestDb

  beforeEach(() => {
    testDb = createTestDb()
    mocks.db = testDb.db
    mocks.getSession.mockReset()
    mocks.listMembers.mockReset()
  })

  async function seedClaimedWorkspace(opts: {
    domain: string
    orgId?: string
  }): Promise<string> {
    const id = newId.workspace()
    await testDb.db.insert(workspaces).values({
      id,
      domain: opts.domain,
      state: 'claimed',
      verificationToken: 'tok',
      betterAuthOrgId: opts.orgId ?? 'org_test',
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
    return id
  }

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

  it('missing ?domain= query → 400 bad_domain', async () => {
    const req = new Request('https://example.com/api/admin/audit-log')
    await expectApiError(requireAdminWorkspace(req), 400, 'bad_domain')
  })

  it('blank ?domain= query → 400 bad_domain', async () => {
    const req = new Request(
      'https://example.com/api/admin/audit-log?domain=',
    )
    await expectApiError(requireAdminWorkspace(req), 400, 'bad_domain')
  })

  it('domain has no matching workspace → 404 no_workspace', async () => {
    const req = new Request(
      'https://example.com/api/admin/audit-log?domain=missing.com',
    )
    await expectApiError(requireAdminWorkspace(req), 404, 'no_workspace')
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('no session → 401 unauth', async () => {
    await seedClaimedWorkspace({ domain: 'acme.com' })
    mocks.getSession.mockResolvedValueOnce(null)
    const req = new Request(
      'https://example.com/api/admin/audit-log?domain=acme.com',
    )
    await expectApiError(requireAdminWorkspace(req), 401, 'unauth')
  })

  it('workspace has no betterAuthOrgId (unclaimed) → 403 not_claimed', async () => {
    const id = newId.workspace()
    await testDb.db.insert(workspaces).values({
      id,
      domain: 'unclaimed.com',
      state: 'pending',
      verificationToken: 'tok',
      betterAuthOrgId: null,
      settings: '{}',
      ticketCount: 0,
      createdAt: Date.now(),
      claimedAt: null,
      plan: 'free',
      subscriptionId: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      dodoCustomerId: null,
    })
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'usr_1' } })
    const req = new Request(
      'https://example.com/api/admin/audit-log?domain=unclaimed.com',
    )
    await expectApiError(requireAdminWorkspace(req), 403, 'not_claimed')
  })

  it('signed in but not a member → 403 not_member', async () => {
    await seedClaimedWorkspace({ domain: 'acme.com', orgId: 'org_acme' })
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'usr_outsider' } })
    mocks.listMembers.mockResolvedValueOnce({
      members: [{ userId: 'usr_owner' }],
    })
    const req = new Request(
      'https://example.com/api/admin/audit-log?domain=acme.com',
    )
    await expectApiError(requireAdminWorkspace(req), 403, 'not_member')
  })

  it('happy path → returns { workspace, userId, db }', async () => {
    const id = await seedClaimedWorkspace({
      domain: 'acme.com',
      orgId: 'org_acme',
    })
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'usr_member' } })
    mocks.listMembers.mockResolvedValueOnce({
      members: [{ userId: 'usr_member' }, { userId: 'usr_owner' }],
    })
    const req = new Request(
      'https://example.com/api/admin/audit-log?domain=acme.com',
    )
    const ctx = await requireAdminWorkspace(req)

    expect(ctx.workspace.id).toBe(id)
    expect(ctx.workspace.domain).toBe('acme.com')
    expect(ctx.workspace.betterAuthOrgId).toBe('org_acme')
    expect(ctx.userId).toBe('usr_member')
    expect(ctx.db).toBeDefined()

    // Verify auth was called against the workspace's org.
    expect(mocks.listMembers).toHaveBeenCalledWith({
      query: { organizationId: 'org_acme' },
      headers: req.headers,
    })
  })

  describe('requireSession', () => {
    it('no session → 401 unauth', async () => {
      mocks.getSession.mockResolvedValueOnce(null)
      const req = new Request('https://example.com/api/whatever')
      await expectApiError(requireSession(req), 401, 'unauth')
    })

    it('session present → returns userId', async () => {
      mocks.getSession.mockResolvedValueOnce({ user: { id: 'usr_abc' } })
      const req = new Request('https://example.com/api/whatever')
      const ctx = await requireSession(req)
      expect(ctx.userId).toBe('usr_abc')
    })

    it('getSession rejection is caught (returns 401, not 500)', async () => {
      mocks.getSession.mockRejectedValueOnce(new Error('upstream blew up'))
      const req = new Request('https://example.com/api/whatever')
      await expectApiError(requireSession(req), 401, 'unauth')
    })
  })

  it('domain comparison is case-insensitive via normalizeDomain', async () => {
    await seedClaimedWorkspace({
      domain: 'acme.com',
      orgId: 'org_acme',
    })
    mocks.getSession.mockResolvedValueOnce({ user: { id: 'usr_m' } })
    mocks.listMembers.mockResolvedValueOnce({
      members: [{ userId: 'usr_m' }],
    })
    const req = new Request(
      'https://example.com/api/admin/audit-log?domain=ACME.COM',
    )
    const ctx = await requireAdminWorkspace(req)
    expect(ctx.workspace.domain).toBe('acme.com')
  })
})
