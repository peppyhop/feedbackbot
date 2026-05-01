// Consistent JSON response + error helpers for API routes.

export function json<T>(data: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  })
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

export function apiError(err: unknown): Response {
  if (err instanceof ApiError) {
    return json(
      { error: { message: err.message, code: err.code ?? 'error' } },
      { status: err.status },
    )
  }
  console.error('unhandled route error', err)
  return json(
    { error: { message: 'internal_error', code: 'internal_error' } },
    { status: 500 },
  )
}

// Extract caller IP across the usual proxy chain.
export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

// CORS for the ingestion endpoints. Widgets call us from arbitrary
// third-party origins — that's the whole point. We don't gate by
// allowlist here; the Origin header is parsed + used to derive the
// workspace, and invalid Origins are rejected.
//
// `Allow-Credentials: true` only when an Origin is present.
// Browsers reject `Allow-Origin: *` paired with `Allow-Credentials:
// true`, so when we fall back to the wildcard we must also drop
// the credentials flag. Without this, any cross-origin fetch with
// `credentials: 'include'` would fail preflight and surface as a
// generic network error to the widget ("Could not send. Try
// again.").
export function corsHeadersFor(request: Request): Record<string, string> {
  const origin = request.headers.get('origin')
  const headers: Record<string, string> = {
    'access-control-allow-origin': origin ?? '*',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
  if (origin) headers['access-control-allow-credentials'] = 'true'
  return headers
}

export function optionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeadersFor(request) })
}
