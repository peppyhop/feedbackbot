import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { member, organization, user, workspaces } from '#/db/schema'
import { upsertPaidWorkspace } from '#/lib/billing/upsert-paid-workspace'
import { createTestDb, type TestDb } from '#/test-helpers/db'

describe('upsertPaidWorkspace', () => {
  let testDb: TestDb

  beforeEach(() => {
    testDb = createTestDb()
  })

  it('creates user + org + member + workspace on first call', async () => {
    const result = await upsertPaidWorkspace(testDb.db, {
      email: 'buyer@example.com',
      plan: 'lite',
      subscriptionId: 'sub_first',
      customerId: 'cust_first',
      currentPeriodEnd: 1735000000000,
    })

    expect(result.createdUser).toBe(true)
    expect(result.createdWorkspace).toBe(true)
    expect(result.userId).toMatch(/^usr_/)
    expect(result.workspaceId).toMatch(/^ws_/)
    expect(result.organizationId).toMatch(/^org_/)

    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('buyer@example.com')
    expect(users[0].emailVerified).toBe(true)
    expect(users[0].isAnonymous).toBe(false)

    const orgs = await testDb.db.select().from(organization)
    expect(orgs).toHaveLength(1)

    const memberships = await testDb.db.select().from(member)
    expect(memberships).toHaveLength(1)
    expect(memberships[0].userId).toBe(result.userId)
    expect(memberships[0].organizationId).toBe(result.organizationId)
    expect(memberships[0].role).toBe('owner')

    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(1)
    expect(ws[0].id).toBe(result.workspaceId)
    expect(ws[0].plan).toBe('lite')
    expect(ws[0].subscriptionId).toBe('sub_first')
    expect(ws[0].subscriptionStatus).toBe('active')
    expect(ws[0].currentPeriodEnd).toBe(1735000000000)
    expect(ws[0].dodoCustomerId).toBe('cust_first')
    expect(ws[0].state).toBe('pending')
    expect(ws[0].betterAuthOrgId).toBe(result.organizationId)
  })

  it('placeholder domain matches the expected shape', async () => {
    const { workspaceId } = await upsertPaidWorkspace(testDb.db, {
      email: 'a@b.com',
      plan: 'lite',
      subscriptionId: 'sub_x',
      customerId: null,
      currentPeriodEnd: null,
    })

    const ws = await testDb.db
      .select({ domain: workspaces.domain })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
    expect(ws[0].domain).toMatch(
      /^pending-[a-z0-9]{10}\.feedbackbot\.internal$/,
    )
  })

  it('is idempotent on subscription_id — second call returns the same workspace', async () => {
    const first = await upsertPaidWorkspace(testDb.db, {
      email: 'buyer@example.com',
      plan: 'starter',
      subscriptionId: 'sub_dedupe',
      customerId: null,
      currentPeriodEnd: null,
    })
    const second = await upsertPaidWorkspace(testDb.db, {
      email: 'buyer@example.com',
      plan: 'starter',
      subscriptionId: 'sub_dedupe',
      customerId: null,
      currentPeriodEnd: null,
    })

    expect(second.workspaceId).toBe(first.workspaceId)
    expect(second.userId).toBe(first.userId)
    expect(second.organizationId).toBe(first.organizationId)
    expect(second.createdUser).toBe(false)
    expect(second.createdWorkspace).toBe(false)

    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(1)
    const orgs = await testDb.db.select().from(organization)
    expect(orgs).toHaveLength(1)
    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(1)
  })

  it('reuses existing user but creates a new workspace + org for a different subscription_id', async () => {
    const first = await upsertPaidWorkspace(testDb.db, {
      email: 'buyer@example.com',
      plan: 'lite',
      subscriptionId: 'sub_a',
      customerId: null,
      currentPeriodEnd: null,
    })
    const second = await upsertPaidWorkspace(testDb.db, {
      email: 'buyer@example.com',
      plan: 'scale',
      subscriptionId: 'sub_b',
      customerId: null,
      currentPeriodEnd: null,
    })

    expect(second.userId).toBe(first.userId)
    expect(second.createdUser).toBe(false)
    expect(second.workspaceId).not.toBe(first.workspaceId)
    expect(second.organizationId).not.toBe(first.organizationId)
    expect(second.createdWorkspace).toBe(true)

    const users = await testDb.db.select().from(user)
    expect(users).toHaveLength(1)
    const ws = await testDb.db.select().from(workspaces)
    expect(ws).toHaveLength(2)
    const orgs = await testDb.db.select().from(organization)
    expect(orgs).toHaveLength(2)
  })
})
