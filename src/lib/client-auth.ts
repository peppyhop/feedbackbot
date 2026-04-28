// Client-side helpers for the auth UI. Server-side things still live
// in `#/lib/auth` and `#/lib/admin-auth`.

// Wraps the POST to Better Auth's sign-in/magic-link endpoint. Used
// by both /login and /accept-invitation/:id which previously each
// inlined the same 14-line fetch + error-handling block.
export async function requestMagicLink(opts: {
  email: string
  callbackURL: string
}): Promise<void> {
  const res = await fetch('/api/auth/sign-in/magic-link', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(opts),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
}
