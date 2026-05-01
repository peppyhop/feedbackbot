// Cloudflare Turnstile siteverify wrapper. Call from any route
// that wants a server-side check on a token the widget minted.
//
// Tokens are SINGLE-USE — a successful siteverify burns the token.
// Don't retry the same token; mint a fresh one on the client.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type VerifyResult =
  | { ok: true; hostname: string }
  | { ok: false; codes: Array<string> }

export async function verifyTurnstile(
  token: string,
  remoteip: string,
  secret: string,
): Promise<VerifyResult> {
  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  if (remoteip && remoteip !== 'unknown') form.set('remoteip', remoteip)
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: form,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
    const data = (await res.json()) as {
      success: boolean
      hostname?: string
      'error-codes'?: Array<string>
    }
    if (data.success) return { ok: true, hostname: data.hostname ?? '' }
    return { ok: false, codes: data['error-codes'] ?? ['unknown'] }
  } catch {
    return { ok: false, codes: ['network-error'] }
  }
}
