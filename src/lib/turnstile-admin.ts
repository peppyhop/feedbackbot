// Cloudflare Turnstile admin — programmatically add hostnames to
// our widget's allowlist whenever a customer verifies a new
// domain. Lets the widget work cross-origin without us managing
// the hostname list by hand.
//
// Auth: a Cloudflare API token scoped to "Account > Turnstile >
// Edit" only. Set CF_API_TOKEN, CF_ACCOUNT_ID, and the widget's
// site key (CF_TURNSTILE_WIDGET_ID — same string as the public
// site key baked into the widget bundle).
//
// Failure mode: every helper logs and returns false on error.
// Domain verification should NOT block on Turnstile admin — a
// failed hostname-add means the widget will 403 from that
// customer's site (a problem worth alerting on, not a problem
// worth blocking onboarding for).

const CF_BASE = 'https://api.cloudflare.com/client/v4'

interface CfWidget {
  domains?: Array<string>
}

interface CfApiResponse<T> {
  success: boolean
  result?: T
  errors?: Array<{ code: number; message: string }>
}

interface AdminEnv {
  CF_API_TOKEN?: string
  CF_ACCOUNT_ID?: string
  CF_TURNSTILE_WIDGET_ID?: string
}

export function turnstileAdminConfigured(env: AdminEnv): boolean {
  return Boolean(
    env.CF_API_TOKEN && env.CF_ACCOUNT_ID && env.CF_TURNSTILE_WIDGET_ID,
  )
}

export async function addTurnstileHostname(
  domain: string,
  env: AdminEnv,
): Promise<boolean> {
  if (!turnstileAdminConfigured(env)) {
    // Graceful: with no admin token we can't manage hostnames.
    // The widget will only work on already-allowlisted domains.
    return false
  }
  const widgetUrl =
    `${CF_BASE}/accounts/${env.CF_ACCOUNT_ID}` +
    `/challenges/widgets/${env.CF_TURNSTILE_WIDGET_ID}`
  const auth = { authorization: `Bearer ${env.CF_API_TOKEN}` }

  try {
    // Read-then-merge. Two concurrent verifies for different
    // domains could race here (last writer wins), but the next
    // verify on either domain self-heals — both domains land in
    // the list eventually because every PATCH includes whatever
    // CF currently has plus the caller's new domain.
    const getRes = await fetch(widgetUrl, { headers: auth })
    const getData = (await getRes.json()) as CfApiResponse<CfWidget>
    if (!getData.success) {
      console.error('turnstile-admin: get failed', { errors: getData.errors })
      return false
    }
    const current = new Set(getData.result?.domains ?? [])
    if (current.has(domain)) return true // already allowlisted

    current.add(domain)
    const patchRes = await fetch(widgetUrl, {
      method: 'PATCH',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ domains: Array.from(current) }),
    })
    const patchData = (await patchRes.json()) as CfApiResponse<CfWidget>
    if (!patchData.success) {
      console.error('turnstile-admin: patch failed', {
        domain,
        errors: patchData.errors,
      })
      return false
    }
    return true
  } catch (err) {
    console.error('turnstile-admin: network error', { domain, err })
    return false
  }
}
