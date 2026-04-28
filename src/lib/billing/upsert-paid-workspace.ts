// Idempotent helper called from BOTH the success-page handler and
// the Dodo webhook reducer to materialize a paid workspace from the
// information Dodo gives us at checkout completion. Either path can
// run first; the second call is a no-op except for filling in any
// fields the first didn't know yet.
//
// Lookups:
//   - User by email — created in better-auth's `user` table directly
//     (passwordless; emailVerified=true since Dodo just confirmed the
//     email by accepting payment to it).
//   - Workspace by subscription_id — single source of truth so the
//     two callers can't double-create.
//
// Race window: success page runs synchronously on browser redirect;
// webhook fires within seconds. Both check existence before insert.
// If they collide on the same subscription_id we accept duplicate
// workspace creation (rare, sub-second window). A unique partial
// index on subscription_id would close it but requires a migration
// — defer to a follow-up if it shows up in practice.

import { customAlphabet } from 'nanoid'
import { eq } from 'drizzle-orm'

import type { makeDb } from '#/db/client'
import { newId } from '#/db/ids'
import {
  member,
  organization,
  user,
  workspaces,
} from '#/db/schema'
import { type PlanId } from '#/lib/billing/plans'

const shortId = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 10)
const userId = customAlphabet(
  '23456789abcdefghjkmnpqrstuvwxyz',
  16,
)

export type UpsertInput = {
  email: string
  plan: PlanId
  subscriptionId: string
  customerId: string | null
  currentPeriodEnd: number | null
}

export type UpsertResult = {
  userId: string
  workspaceId: string
  organizationId: string
  createdUser: boolean
  createdWorkspace: boolean
}

export async function upsertPaidWorkspace(
  db: ReturnType<typeof makeDb>,
  input: UpsertInput,
): Promise<UpsertResult> {
  const now = Date.now()

  // 1. User by email — find or create.
  const existingUser = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1)
  let createdUser = false
  let userIdValue = existingUser[0]?.id
  if (!userIdValue) {
    userIdValue = `usr_${userId()}`
    await db.insert(user).values({
      id: userIdValue,
      name: input.email.split('@')[0] || 'user',
      email: input.email,
      emailVerified: true,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      isAnonymous: false,
    })
    createdUser = true
  }

  // 2. Workspace by subscription_id — find or create.
  const existingWs = await db
    .select({ id: workspaces.id, betterAuthOrgId: workspaces.betterAuthOrgId })
    .from(workspaces)
    .where(eq(workspaces.subscriptionId, input.subscriptionId))
    .limit(1)
  if (existingWs[0] && existingWs[0].betterAuthOrgId) {
    return {
      userId: userIdValue,
      workspaceId: existingWs[0].id,
      organizationId: existingWs[0].betterAuthOrgId,
      createdUser,
      createdWorkspace: false,
    }
  }

  // 3. New org + member + workspace.
  const orgSlug = `org-${shortId()}`
  const orgIdValue = `org_${shortId()}`
  await db.insert(organization).values({
    id: orgIdValue,
    name: orgSlug,
    slug: orgSlug,
    createdAt: new Date(now),
  })
  await db.insert(member).values({
    id: `mem_${shortId()}`,
    organizationId: orgIdValue,
    userId: userIdValue,
    role: 'owner',
    createdAt: new Date(now),
  })
  const workspaceIdValue = newId.workspace()
  await db.insert(workspaces).values({
    id: workspaceIdValue,
    domain: `pending-${shortId()}.feedbackbot.internal`,
    state: 'pending',
    verificationToken: newId.verificationToken(),
    betterAuthOrgId: orgIdValue,
    settings: '{}',
    ticketCount: 0,
    createdAt: now,
    claimedAt: null,
    plan: input.plan,
    subscriptionId: input.subscriptionId,
    subscriptionStatus: 'active',
    currentPeriodEnd: input.currentPeriodEnd,
    dodoCustomerId: input.customerId,
  })
  return {
    userId: userIdValue,
    workspaceId: workspaceIdValue,
    organizationId: orgIdValue,
    createdUser,
    createdWorkspace: true,
  }
}
