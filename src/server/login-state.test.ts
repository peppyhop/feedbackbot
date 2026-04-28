import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildLoginState, type LoginStateDeps } from '#/server/login-state'
import { member, organization, user, workspaces } from '#/db/schema'
import { newId } from '#/db/ids'
import { createTestDb, type TestDb } from '#/test-helpers/db'
import { makeTestEnv } from '#/test-helpers/env'

const headers = new Headers()

function depsWithSession(
  testDb: TestDb,
  session: Awaited<ReturnType<LoginStateDeps['getSession']>>,
): LoginStateDeps {
  return {
    env: makeTestEnv({
      GOOGLE_CLIENT_ID: 'g-id',
      GOOGLE_CLIENT_SECRET: 'g-secret',
      RESEND_API_KEY: 're_test',
    }),
    db: testDb.db,
    headers,
    getSession: vi.fn(async () => session),
  }
}

async function seedUserOrgWorkspace(
  testDb: TestDb,
  opts: {
    userId: string
    email?: string
    workspaceState: 'pending' | 'claimed'
    domain?: string
  },
): Promise<{ orgId: string; workspaceId: string }> {
  const now = Date.now()
  const orgId = `org_${opts.userId.slice(4, 14)}`
  await testDb.db.insert(user).values({
    id: opts.userId,
    name: opts.email ?? 'test',
    email: opts.email ?? `${opts.userId}@example.com`,
    emailVerified: true,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    isAnonymous: false,
  })
  await testDb.db.insert(organization).values({
    id: orgId,
    name: orgId,
    slug: orgId,
    createdAt: new Date(now),
  })
  await testDb.db.insert(member).values({
    id: `mem_${opts.userId.slice(4, 14)}`,
    organizationId: orgId,
    userId: opts.userId,
    role: 'owner',
    createdAt: new Date(now),
  })
  const workspaceId = newId.workspace()
  await testDb.db.insert(workspaces).values({
    id: workspaceId,
    domain:
      opts.domain ??
      (opts.workspaceState === 'claimed'
        ? 'acme.com'
        : `pending-${workspaceId.slice(3, 13)}.feedbackbot.internal`),
    state: opts.workspaceState,
    verificationToken: 'tok',
    betterAuthOrgId: orgId,
    settings: '{}',
    ticketCount: 0,
    createdAt: now,
    claimedAt: opts.workspaceState === 'claimed' ? now : null,
    plan: 'lite',
    subscriptionId: `sub_${opts.userId}`,
    subscriptionStatus: 'active',
    currentPeriodEnd: null,
    dodoCustomerId: null,
  })
  return { orgId, workspaceId }
}

describe('buildLoginState', () => {
  let testDb: TestDb

  beforeEach(() => {
    testDb = createTestDb()
  })

  it('returns signed_in:false when there is no session', async () => {
    const state = await buildLoginState(depsWithSession(testDb, null))

    expect(state.signed_in).toBe(false)
    expect(state.user).toBeNull()
    expect(state.claimed_workspace_domain).toBeNull()
    expect(state.incomplete_workspace_id).toBeNull()
    // Provider flags reflect the env we passed in.
    expect(state.google_enabled).toBe(true)
    expect(state.magic_link_enabled).toBe(true)
  })

  it('treats anonymous sessions as not signed in', async () => {
    const state = await buildLoginState(
      depsWithSession(testDb, {
        user: {
          id: 'usr_anon',
          email: 'anon@feedbackbot.internal',
          isAnonymous: true,
        },
      }),
    )

    expect(state.signed_in).toBe(false)
    expect(state.user).toBeNull()
  })

  it('signed in with no orgs → both workspace fields null', async () => {
    await testDb.db.insert(user).values({
      id: 'usr_loner',
      name: 'loner',
      email: 'loner@example.com',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isAnonymous: false,
    })

    const state = await buildLoginState(
      depsWithSession(testDb, {
        user: {
          id: 'usr_loner',
          email: 'loner@example.com',
        },
      }),
    )

    expect(state.signed_in).toBe(true)
    expect(state.user?.email).toBe('loner@example.com')
    expect(state.claimed_workspace_domain).toBeNull()
    expect(state.incomplete_workspace_id).toBeNull()
  })

  it('signed in with one claimed workspace → claimed=domain, incomplete=null', async () => {
    await seedUserOrgWorkspace(testDb, {
      userId: 'usr_claimed',
      email: 'owner@acme.com',
      workspaceState: 'claimed',
      domain: 'acme.com',
    })

    const state = await buildLoginState(
      depsWithSession(testDb, {
        user: { id: 'usr_claimed', email: 'owner@acme.com' },
      }),
    )

    expect(state.signed_in).toBe(true)
    expect(state.claimed_workspace_domain).toBe('acme.com')
    expect(state.incomplete_workspace_id).toBeNull()
  })

  it('signed in with one pending workspace → claimed=null, incomplete=ws_id', async () => {
    const { workspaceId } = await seedUserOrgWorkspace(testDb, {
      userId: 'usr_pending',
      email: 'paid@example.com',
      workspaceState: 'pending',
    })

    const state = await buildLoginState(
      depsWithSession(testDb, {
        user: { id: 'usr_pending', email: 'paid@example.com' },
      }),
    )

    expect(state.signed_in).toBe(true)
    expect(state.claimed_workspace_domain).toBeNull()
    expect(state.incomplete_workspace_id).toBe(workspaceId)
  })

  it('claimed workspace wins over an incomplete one', async () => {
    // Seed a claimed workspace.
    await seedUserOrgWorkspace(testDb, {
      userId: 'usr_two',
      email: 'two@example.com',
      workspaceState: 'claimed',
      domain: 'acme.com',
    })
    // Add a second pending workspace under a NEW org for the same user.
    const now = Date.now()
    const orgId2 = 'org_second'
    await testDb.db.insert(organization).values({
      id: orgId2,
      name: orgId2,
      slug: orgId2,
      createdAt: new Date(now),
    })
    await testDb.db.insert(member).values({
      id: 'mem_second',
      organizationId: orgId2,
      userId: 'usr_two',
      role: 'owner',
      createdAt: new Date(now),
    })
    const incompleteWorkspaceId = newId.workspace()
    await testDb.db.insert(workspaces).values({
      id: incompleteWorkspaceId,
      domain: `pending-second.feedbackbot.internal`,
      state: 'pending',
      verificationToken: 'tok',
      betterAuthOrgId: orgId2,
      settings: '{}',
      ticketCount: 0,
      createdAt: now,
      claimedAt: null,
      plan: 'lite',
      subscriptionId: 'sub_second',
      subscriptionStatus: 'active',
      currentPeriodEnd: null,
      dodoCustomerId: null,
    })

    const state = await buildLoginState(
      depsWithSession(testDb, {
        user: { id: 'usr_two', email: 'two@example.com' },
      }),
    )

    expect(state.signed_in).toBe(true)
    expect(state.claimed_workspace_domain).toBe('acme.com')
    // Loader uses the claimed redirect; incomplete is not surfaced
    // to avoid a competing /onboard redirect.
    expect(state.incomplete_workspace_id).toBeNull()
  })

  it('provider flags reflect env: missing GOOGLE_CLIENT_ID → google_enabled=false', async () => {
    const deps: LoginStateDeps = {
      env: makeTestEnv({ RESEND_API_KEY: 're_test' }),
      db: testDb.db,
      headers,
      getSession: vi.fn(async () => null),
    }
    const state = await buildLoginState(deps)

    expect(state.google_enabled).toBe(false)
    expect(state.magic_link_enabled).toBe(true)
  })
})
