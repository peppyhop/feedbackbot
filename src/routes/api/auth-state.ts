// GET /api/auth-state
// Reports which auth methods are wired on this deploy, so the /login
// and /signup pages can hide buttons that wouldn't work. Google OAuth
// is enabled on every stage where the credentials are provisioned —
// previews use the better-auth oAuthProxy plugin to bounce the
// callback through prod (see src/lib/auth.ts).

import { createFileRoute } from '@tanstack/react-router'

import { env } from '#/env'
import {
  apiError,
  corsHeadersFor,
  json,
  optionsResponse,
} from '#/lib/http'
import { withRequestMetrics } from '#/lib/analytics'

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request)
  try {
    // Surface key fragments so a developer can match the deployed
    // value against what's shown in the Google Cloud / Unosend
    // dashboards without exposing full secrets. Lengths catch
    // trailing-newline / wrapping-quote bugs that don't show in
    // length-equals checks.
    const googleClientId = env.GOOGLE_CLIENT_ID ?? ''
    return json(
      {
        google_enabled: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
        google_client_id_head: googleClientId.slice(0, 12),
        google_client_id_tail: googleClientId.slice(-30),
        google_client_id_len: googleClientId.length,
        magic_link_enabled: !!env.UNOSEND_API_KEY,
      },
      { headers: cors },
    )
  } catch (err) {
    const res = apiError(err)
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  }
}

const getAuthState = withRequestMetrics('/api/auth-state', handle)

export const Route = createFileRoute('/api/auth-state')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => optionsResponse(request),
      GET: async ({ request }) => getAuthState(request),
    },
  },
})
