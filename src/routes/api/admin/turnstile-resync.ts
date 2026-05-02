// POST /api/admin/turnstile-resync?domain=<d>
// Re-runs the Cloudflare Turnstile hostname add for a workspace.
// Wired to the dashboard's "widget setup pending" banner so a
// customer who notices their bot isn't working can self-rescue
// without operator intervention.

import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import { markWorkspaceTurnstileSynced, writeAudit } from '#/db/client'
import {
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'
import { requireAdminWorkspace } from '#/lib/admin-auth'
import { addTurnstileHostname } from '#/lib/turnstile-admin'

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    const { workspace, userId, db } = await requireAdminWorkspace(request)

    const sync = await addTurnstileHostname(workspace.domain, env)

    await writeAudit(db, {
      workspaceId: workspace.id,
      action: 'workspace.turnstile.sync',
      actorUserId: userId,
      metadata: sync.ok
        ? {
            ok: true,
            alreadyPresent: sync.alreadyPresent,
            via: 'manual-resync',
          }
        : {
            ok: false,
            reason: sync.reason,
            details: sync.details,
            via: 'manual-resync',
          },
    })

    if (sync.ok) {
      const syncedAt = Date.now()
      await markWorkspaceTurnstileSynced(db, workspace.id, syncedAt)
      return json(
        {
          ok: true,
          synced_at: syncedAt,
          already_present: sync.alreadyPresent,
        },
        { headers: cors },
      )
    }
    // Surface the failure reason so the dashboard can show the
    // customer something actionable ("token missing scope" → it's
    // a FeedbackBot operator problem, not theirs).
    return json(
      {
        ok: false,
        reason: sync.reason,
        details: sync.details,
      },
      { status: 502, headers: cors },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const turnstileResync = withRequestMetrics(
  '/api/admin/turnstile-resync',
  handle,
)

export const Route = createFileRoute('/api/admin/turnstile-resync')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      POST: async ({ request }) => turnstileResync(request),
    },
  },
})
