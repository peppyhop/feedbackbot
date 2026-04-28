// GET /api/admin/audit-log?domain=<d>&format=csv
// Scale-tier export of the workspace's audit log. JSON is the
// default; pass `?format=csv` to stream as RFC 4180 CSV with a
// content-disposition attachment header.

import { createFileRoute } from '@tanstack/react-router'
import { desc, eq } from 'drizzle-orm'

import { auditLog } from '#/db/schema'
import {
  ApiError,
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdminWorkspace } from '#/lib/admin-auth'
import { entitlementsFor } from '#/lib/billing/entitlements'

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  // RFC 4180: wrap if it contains comma, double-quote, CR, or LF.
  if (/[,"\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { workspace, db } = await requireAdminWorkspace(request)
    const url = new URL(request.url)

    // Tier gate.
    const ent = entitlementsFor(workspace.plan)
    if (!ent.audit_log_export) {
      throw new ApiError(
        402,
        `${workspace.plan} plan does not include audit log export. Upgrade to Scale.`,
        'plan_audit_export',
      )
    }

    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        actor_user_id: auditLog.actorUserId,
        actor_ip_hash: auditLog.actorIpHash,
        metadata: auditLog.metadata,
        created_at: auditLog.createdAt,
      })
      .from(auditLog)
      .where(eq(auditLog.workspaceId, workspace.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(10_000)

    const format = url.searchParams.get('format') ?? 'json'

    if (format === 'csv') {
      const header = ['id', 'created_at_iso', 'action', 'actor_user_id', 'actor_ip_hash', 'metadata']
      const lines = [header.join(',')]
      for (const r of rows) {
        lines.push(
          [
            csvCell(r.id),
            csvCell(new Date(r.created_at).toISOString()),
            csvCell(r.action),
            csvCell(r.actor_user_id),
            csvCell(r.actor_ip_hash),
            csvCell(r.metadata),
          ].join(','),
        )
      }
      const csv = lines.join('\r\n') + '\r\n'
      const today = new Date().toISOString().slice(0, 10)
      return new Response(csv, {
        headers: {
          ...cors,
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="audit-log-${workspace.domain}-${today}.csv"`,
        },
      })
    }

    return json({ count: rows.length, rows }, { headers: cors })
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const getAuditLog = withRequestMetrics('/api/admin/audit-log', handle)

export const Route = createFileRoute('/api/admin/audit-log')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request }) => getAuditLog(request),
    },
  },
})
