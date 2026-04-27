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
    return json(
      {
        google_enabled: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
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
