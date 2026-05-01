// Drizzle table definitions. Column layout mirrors
// src/db/migrations/0001_init.sql exactly. Keep them in lockstep —
// the SQL file is authoritative for the wire schema (CLAUDE.md:
// migrations are never edited after commit).

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    domain: text('domain').notNull().unique(),
    state: text('state').notNull(),
    verificationToken: text('verification_token').notNull(),
    betterAuthOrgId: text('better_auth_org_id'),
    settings: text('settings').notNull().default('{}'),
    ticketCount: integer('ticket_count').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    claimedAt: integer('claimed_at'),
    plan: text('plan').notNull().default('free'),
    subscriptionId: text('subscription_id'),
    subscriptionStatus: text('subscription_status'),
    currentPeriodEnd: integer('current_period_end'),
    dodoCustomerId: text('dodo_customer_id'),
  },
  (t) => [
    index('ws_state_idx').on(t.state),
    index('ws_sub_idx').on(t.subscriptionId),
  ],
)

export const tickets = sqliteTable(
  'tickets',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    message: text('message').notNull(),
    pageUrl: text('page_url'),
    userAgent: text('user_agent'),
    email: text('email'),
    screenshotKey: text('screenshot_key'),
    ipHash: text('ip_hash'),
    status: text('status').notNull().default('open'),
    classification: text('classification'),
    classificationMeta: text('classification_meta'),
    upvotes: integer('upvotes').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('tkt_ws_idx').on(t.workspaceId, t.createdAt),
    index('tkt_ws_status_idx').on(t.workspaceId, t.status),
    index('tkt_ws_class_idx').on(t.workspaceId, t.classification),
  ],
)

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    authorUserId: text('author_user_id'),
    authorName: text('author_name'),
    message: text('message').notNull(),
    source: text('source').notNull().default('web'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('cmt_ticket_idx').on(t.ticketId, t.createdAt)],
)

export const votes = sqliteTable(
  'votes',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    voterUserId: text('voter_user_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('votes_ticket_user_uq').on(t.ticketId, t.voterUserId)],
)

export const integrations = sqliteTable('integrations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  credentials: text('credentials').notNull(),
  enabled: integer('enabled').notNull().default(1),
  createdAt: integer('created_at').notNull(),
})

export const integrationRoutes = sqliteTable(
  'integration_routes',
  {
    id: text('id').primaryKey(),
    integrationId: text('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    ticketType: text('ticket_type').notNull(),
    config: text('config').notNull(),
    enabled: integer('enabled').notNull().default(1),
  },
  (t) => [
    index('route_ws_type_idx').on(t.workspaceId, t.ticketType, t.enabled),
  ],
)

export const integrationDeliveries = sqliteTable(
  'integration_deliveries',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    integrationId: text('integration_id').notNull(),
    ticketId: text('ticket_id').notNull(),
    status: text('status').notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    requestBody: text('request_body'),
    responseCode: integer('response_code'),
    responseBody: text('response_body'),
    createdAt: integer('created_at').notNull(),
    deliveredAt: integer('delivered_at'),
  },
  (t) => [index('dlv_ws_idx').on(t.workspaceId, t.createdAt)],
)

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    actorUserId: text('actor_user_id'),
    actorIpHash: text('actor_ip_hash'),
    action: text('action').notNull(),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('audit_ws_idx').on(t.workspaceId, t.createdAt)],
)

export const webhookEvents = sqliteTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    workspaceId: text('workspace_id'),
    payload: text('payload').notNull(),
    processedAt: integer('processed_at').notNull(),
    error: text('error'),
  },
  (t) => [index('wh_ws_idx').on(t.workspaceId, t.processedAt)],
)

// ── Better Auth tables ──────────────────────────────────────────
// Mirrors src/db/migrations/0002_better_auth.sql. Column names stay
// camelCase because Better Auth queries them literally (no adapter
// case mapping). The Drizzle adapter needs these as a schema object
// so it can resolve models like "verification" — hence they're
// exported and re-imported into auth.ts.

// Better Auth sends JS Date objects on write and expects them back on
// read. SQLite integers can't hold Dates directly — drizzle's
// `mode: 'timestamp_ms'` is the bridge. Boolean fields use
// `mode: 'boolean'` for the same reason (Better Auth passes true/false).
export const user = sqliteTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('emailVerified', { mode: 'boolean' })
      .notNull()
      .default(false),
    image: text('image'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
    isAnonymous: integer('isAnonymous', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (t) => [index('user_email_idx').on(t.email)],
)

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId').notNull(),
    activeOrganizationId: text('activeOrganizationId'),
    activeTeamId: text('activeTeamId'),
  },
  (t) => [
    index('session_userId_idx').on(t.userId),
    index('session_token_idx').on(t.token),
  ],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId').notNull(),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: integer('accessTokenExpiresAt', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refreshTokenExpiresAt', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('account_userId_idx').on(t.userId),
    index('account_providerId_idx').on(t.accountId, t.providerId),
  ],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

export const organization = sqliteTable(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    logo: text('logo'),
    metadata: text('metadata'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('organization_slug_idx').on(t.slug)],
)

export const member = sqliteTable(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    userId: text('userId').notNull(),
    role: text('role').notNull().default('member'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('member_organizationId_idx').on(t.organizationId),
    index('member_userId_idx').on(t.userId),
  ],
)

export const invitation = sqliteTable(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organizationId').notNull(),
    email: text('email').notNull(),
    role: text('role'),
    teamId: text('teamId'),
    status: text('status').notNull().default('pending'),
    expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    inviterId: text('inviterId').notNull(),
  },
  (t) => [
    index('invitation_organizationId_idx').on(t.organizationId),
    index('invitation_email_idx').on(t.email),
  ],
)

export const team = sqliteTable(
  'team',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    organizationId: text('organizationId').notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }),
  },
  (t) => [index('team_organizationId_idx').on(t.organizationId)],
)

export const teamMember = sqliteTable(
  'teamMember',
  {
    id: text('id').primaryKey(),
    teamId: text('teamId').notNull(),
    userId: text('userId').notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('teamMember_teamId_idx').on(t.teamId),
    index('teamMember_userId_idx').on(t.userId),
  ],
)

export const ssoProvider = sqliteTable(
  'ssoProvider',
  {
    id: text('id').primaryKey(),
    issuer: text('issuer').notNull(),
    oidcConfig: text('oidcConfig'),
    samlConfig: text('samlConfig'),
    userId: text('userId'),
    providerId: text('providerId').notNull().unique(),
    organizationId: text('organizationId'),
    domain: text('domain').notNull(),
    domainVerified: integer('domainVerified', { mode: 'boolean' }),
  },
  (t) => [index('ssoProvider_providerId_idx').on(t.providerId)],
)

// Row types (select shape).
export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type Ticket = typeof tickets.$inferSelect
export type NewTicket = typeof tickets.$inferInsert
export type Comment = typeof comments.$inferSelect
export type Vote = typeof votes.$inferSelect
export type Integration = typeof integrations.$inferSelect
export type IntegrationRoute = typeof integrationRoutes.$inferSelect
export type IntegrationDelivery = typeof integrationDeliveries.$inferSelect
export type AuditLog = typeof auditLog.$inferSelect
export type WebhookEvent = typeof webhookEvents.$inferSelect
