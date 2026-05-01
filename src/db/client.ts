// Workspace-scoped D1 helpers. Enforces CLAUDE.md golden rule #2:
// every query against a workspace-scoped table takes a workspaceId and
// emits it in WHERE / INSERT. Route handlers MUST go through this
// module — no raw `env.DB.prepare(...)` in routes.

import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'

import {
  auditLog,
  comments,
  integrationDeliveries,
  integrationRoutes,
  integrations,
  tickets,
  votes,
  workspaces,
  type AuditLog,
  type Comment,
  type Integration,
  type IntegrationDelivery,
  type IntegrationRoute,
  type Ticket,
  type Workspace,
} from './schema'
import { newId } from './ids'
import type { ClassificationKind, TicketStatus } from '#/schema/ticket'

export type DB = ReturnType<typeof drizzle>

export function makeDb(d1: D1Database): DB {
  return drizzle(d1)
}

// ── workspace (global / unscoped) ────────────────────────────────

export async function getWorkspaceById(
  db: DB,
  id: string,
): Promise<Workspace | null> {
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
  return rows[0] ?? null
}

export async function getWorkspaceByDomain(
  db: DB,
  domain: string,
): Promise<Workspace | null> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.domain, domain))
    .limit(1)
  return rows[0] ?? null
}

export async function createPendingWorkspace(
  db: DB,
  domain: string,
): Promise<Workspace> {
  const now = Date.now()
  const row: Workspace = {
    id: newId.workspace(),
    domain,
    state: 'pending',
    verificationToken: newId.verificationToken(),
    betterAuthOrgId: null,
    settings: '{}',
    ticketCount: 0,
    createdAt: now,
    claimedAt: null,
    plan: 'free',
    subscriptionId: null,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    dodoCustomerId: null,
  }
  await db.insert(workspaces).values(row)
  return row
}

export async function markWorkspaceClaimed(
  db: DB,
  workspaceId: string,
  orgId: string,
): Promise<void> {
  await db
    .update(workspaces)
    .set({ state: 'claimed', betterAuthOrgId: orgId, claimedAt: Date.now() })
    .where(eq(workspaces.id, workspaceId))
}

// ── tickets ──────────────────────────────────────────────────────
// All operations scoped by workspaceId.

export async function insertTicket(
  db: DB,
  input: {
    workspaceId: string
    message: string
    pageUrl: string | null
    userAgent: string | null
    email: string | null
    ipHash: string | null
    screenshotKey: string | null
  },
): Promise<Ticket> {
  const now = Date.now()
  const row: Ticket = {
    id: newId.ticket(),
    workspaceId: input.workspaceId,
    message: input.message,
    pageUrl: input.pageUrl,
    userAgent: input.userAgent,
    email: input.email,
    screenshotKey: input.screenshotKey,
    ipHash: input.ipHash,
    status: 'open',
    classification: null,
    classificationMeta: null,
    upvotes: 0,
    createdAt: now,
    updatedAt: now,
  }
  await db.batch([
    db.insert(tickets).values(row),
    db
      .update(workspaces)
      .set({ ticketCount: sql`${workspaces.ticketCount} + 1` })
      .where(eq(workspaces.id, input.workspaceId)),
  ])
  return row
}

export async function getTicket(
  db: DB,
  workspaceId: string,
  ticketId: string,
): Promise<Ticket | null> {
  const rows = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.id, ticketId)))
    .limit(1)
  return rows[0] ?? null
}

export async function setClassification(
  db: DB,
  workspaceId: string,
  ticketId: string,
  classification: ClassificationKind,
  metaJson: string,
): Promise<void> {
  await db
    .update(tickets)
    .set({
      classification,
      classificationMeta: metaJson,
      updatedAt: Date.now(),
    })
    .where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.id, ticketId)))
}

export async function patchTicket(
  db: DB,
  workspaceId: string,
  ticketId: string,
  patch: { status?: TicketStatus; classification?: ClassificationKind },
): Promise<void> {
  await db
    .update(tickets)
    .set({ ...patch, updatedAt: Date.now() })
    .where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.id, ticketId)))
}

export async function listTickets(
  db: DB,
  workspaceId: string,
  opts: {
    status?: TicketStatus
    classification?: ClassificationKind
    limit?: number
  } = {},
): Promise<Array<Ticket>> {
  const conditions = [eq(tickets.workspaceId, workspaceId)]
  if (opts.status) conditions.push(eq(tickets.status, opts.status))
  if (opts.classification)
    conditions.push(eq(tickets.classification, opts.classification))
  return db
    .select()
    .from(tickets)
    .where(and(...conditions))
    .orderBy(desc(tickets.createdAt))
    .limit(opts.limit ?? 100)
}

export async function listPublicTickets(
  db: DB,
  workspaceId: string,
  limit = 100,
): Promise<Array<Ticket>> {
  // Public board: exclude spam and closed; newest first.
  return db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.workspaceId, workspaceId),
        // non-spam classifications only — classification IS NULL means
        // classifier hasn't run yet, still surface it.
        sql`(${tickets.classification} IS NULL OR ${tickets.classification} != 'spam')`,
        sql`${tickets.status} != 'closed'`,
      ),
    )
    .orderBy(desc(tickets.upvotes), desc(tickets.createdAt))
    .limit(limit)
}

// ── votes ────────────────────────────────────────────────────────

export async function insertVote(
  db: DB,
  workspaceId: string,
  ticketId: string,
  voterUserId: string,
): Promise<{ inserted: boolean; upvotes: number }> {
  const now = Date.now()
  try {
    await db.insert(votes).values({
      id: newId.vote(),
      ticketId,
      workspaceId,
      voterUserId,
      createdAt: now,
    })
  } catch (e) {
    // UNIQUE(ticket_id, voter_user_id) — already voted.
    const row = await db
      .select({ upvotes: tickets.upvotes })
      .from(tickets)
      .where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.id, ticketId)))
      .limit(1)
    return { inserted: false, upvotes: row[0]?.upvotes ?? 0 }
  }
  const updated = await db
    .update(tickets)
    .set({ upvotes: sql`${tickets.upvotes} + 1`, updatedAt: now })
    .where(and(eq(tickets.workspaceId, workspaceId), eq(tickets.id, ticketId)))
    .returning({ upvotes: tickets.upvotes })
  return { inserted: true, upvotes: updated[0]?.upvotes ?? 0 }
}

// ── comments ─────────────────────────────────────────────────────

export async function insertComment(
  db: DB,
  input: {
    workspaceId: string
    ticketId: string
    message: string
    authorUserId?: string | null
    authorName?: string | null
    source?: 'web' | 'integration'
  },
): Promise<Comment> {
  const row: Comment = {
    id: newId.comment(),
    ticketId: input.ticketId,
    workspaceId: input.workspaceId,
    authorUserId: input.authorUserId ?? null,
    authorName: input.authorName ?? null,
    message: input.message,
    source: input.source ?? 'web',
    createdAt: Date.now(),
  }
  await db.insert(comments).values(row)
  return row
}

export async function listComments(
  db: DB,
  workspaceId: string,
  ticketId: string,
): Promise<Array<Comment>> {
  return db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.workspaceId, workspaceId),
        eq(comments.ticketId, ticketId),
      ),
    )
    .orderBy(comments.createdAt)
}

// ── integrations & routing ───────────────────────────────────────

export async function insertIntegration(
  db: DB,
  input: {
    workspaceId: string
    kind: Integration['kind']
    name: string
    encryptedCredentials: string
  },
): Promise<Integration> {
  const row: Integration = {
    id: newId.integration(),
    workspaceId: input.workspaceId,
    kind: input.kind,
    name: input.name,
    credentials: input.encryptedCredentials,
    enabled: 1,
    createdAt: Date.now(),
  }
  await db.insert(integrations).values(row)
  return row
}

export async function listIntegrations(
  db: DB,
  workspaceId: string,
): Promise<Array<Integration>> {
  return db
    .select()
    .from(integrations)
    .where(eq(integrations.workspaceId, workspaceId))
    .orderBy(desc(integrations.createdAt))
}

export async function getIntegration(
  db: DB,
  workspaceId: string,
  integrationId: string,
): Promise<Integration | null> {
  const rows = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspaceId),
        eq(integrations.id, integrationId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function insertRoute(
  db: DB,
  input: {
    workspaceId: string
    integrationId: string
    ticketType: ClassificationKind
    config: string
  },
): Promise<IntegrationRoute> {
  const row: IntegrationRoute = {
    id: newId.route(),
    integrationId: input.integrationId,
    workspaceId: input.workspaceId,
    ticketType: input.ticketType,
    config: input.config,
    enabled: 1,
  }
  await db.insert(integrationRoutes).values(row)
  return row
}

export async function listRoutesForIntegration(
  db: DB,
  workspaceId: string,
  integrationId: string,
): Promise<Array<IntegrationRoute>> {
  return db
    .select()
    .from(integrationRoutes)
    .where(
      and(
        eq(integrationRoutes.workspaceId, workspaceId),
        eq(integrationRoutes.integrationId, integrationId),
      ),
    )
}

export async function deleteRoutesForIntegration(
  db: DB,
  workspaceId: string,
  integrationId: string,
): Promise<void> {
  await db
    .delete(integrationRoutes)
    .where(
      and(
        eq(integrationRoutes.workspaceId, workspaceId),
        eq(integrationRoutes.integrationId, integrationId),
      ),
    )
}

export async function routesForTicketType(
  db: DB,
  workspaceId: string,
  ticketType: ClassificationKind,
): Promise<Array<IntegrationRoute & { integration: Integration }>> {
  // Join integration_routes with integrations, both scoped by workspace.
  const rows = await db
    .select({
      route: integrationRoutes,
      integration: integrations,
    })
    .from(integrationRoutes)
    .innerJoin(
      integrations,
      and(
        eq(integrationRoutes.integrationId, integrations.id),
        eq(integrations.enabled, 1),
        eq(integrations.workspaceId, workspaceId),
      ),
    )
    .where(
      and(
        eq(integrationRoutes.workspaceId, workspaceId),
        eq(integrationRoutes.ticketType, ticketType),
        eq(integrationRoutes.enabled, 1),
      ),
    )
  return rows.map((r) => ({ ...r.route, integration: r.integration }))
}

// ── deliveries ───────────────────────────────────────────────────

export async function recordDelivery(
  db: DB,
  input: {
    workspaceId: string
    integrationId: string
    ticketId: string
    status: 'pending' | 'delivered' | 'failed' | 'dead'
    attempts: number
    lastError?: string | null
    requestBody?: string | null
    responseCode?: number | null
    responseBody?: string | null
  },
): Promise<IntegrationDelivery> {
  const row: IntegrationDelivery = {
    id: newId.delivery(),
    workspaceId: input.workspaceId,
    integrationId: input.integrationId,
    ticketId: input.ticketId,
    status: input.status,
    attempts: input.attempts,
    lastError: input.lastError ?? null,
    requestBody: input.requestBody ?? null,
    responseCode: input.responseCode ?? null,
    responseBody: input.responseBody ?? null,
    createdAt: Date.now(),
    deliveredAt: input.status === 'delivered' ? Date.now() : null,
  }
  await db.insert(integrationDeliveries).values(row)
  return row
}

export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'dead'

export async function listDeliveries(
  db: DB,
  workspaceId: string,
  opts: {
    since?: number
    limit?: number
    status?: DeliveryStatus
    integrationId?: string
  } = {},
): Promise<Array<IntegrationDelivery>> {
  const conditions = [eq(integrationDeliveries.workspaceId, workspaceId)]
  if (opts.since)
    conditions.push(gt(integrationDeliveries.createdAt, opts.since))
  if (opts.status)
    conditions.push(eq(integrationDeliveries.status, opts.status))
  if (opts.integrationId)
    conditions.push(eq(integrationDeliveries.integrationId, opts.integrationId))
  return db
    .select()
    .from(integrationDeliveries)
    .where(and(...conditions))
    .orderBy(desc(integrationDeliveries.createdAt))
    .limit(opts.limit ?? 200)
}

// ── audit log ────────────────────────────────────────────────────

export async function writeAudit(
  db: DB,
  input: {
    workspaceId: string
    action: string
    actorUserId?: string | null
    actorIpHash?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<AuditLog> {
  const row: AuditLog = {
    id: newId.audit(),
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId ?? null,
    actorIpHash: input.actorIpHash ?? null,
    action: input.action,
    metadata: JSON.stringify(input.metadata ?? {}),
    createdAt: Date.now(),
  }
  await db.insert(auditLog).values(row)
  return row
}
