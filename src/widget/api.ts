// Transport layer for the widget. Single POST to /api/ticket +
// optional two-step screenshot upload.

// API base is the origin the widget script itself was loaded from —
// captured by the bootstrap IIFE before this module runs and stashed
// on the global so we don't have to thread it through every call.
// Falls back to same-origin (empty string) for the dev-server case
// where the widget is loaded into the dashboard origin directly.
declare global {
  interface Window {
    __FEEDBACKBOT_ORIGIN__?: string
  }
}
const API_BASE =
  (typeof window !== 'undefined' && window.__FEEDBACKBOT_ORIGIN__) || ''

export type SubmitInput = {
  message: string
  pageUrl: string
  userAgent: string
  email?: string
  kind?: 'auto' | 'bug' | 'idea' | 'ask'
  screenshotDataUrl?: string
  turnstileToken?: string
}

export type SubmitResult =
  | { ok: true; ticketId: string; routedTo?: string | null }
  | { ok: false; status: number; message: string }

export async function submitTicket(input: SubmitInput): Promise<SubmitResult> {
  const body = {
    message: input.message,
    page_url: input.pageUrl,
    user_agent: input.userAgent,
    email: input.email ?? '',
    honeypot: '',
    want_screenshot_upload: !!input.screenshotDataUrl,
    turnstile_token: input.turnstileToken ?? '',
  }
  try {
    const res = await fetch(`${API_BASE}/api/ticket`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      return { ok: false, status: res.status, message: `HTTP ${res.status}` }
    }
    const json = (await res.json()) as {
      ticket_id: string
      screenshot_upload_url?: string
    }
    if (input.screenshotDataUrl && json.screenshot_upload_url) {
      await uploadScreenshot(json.screenshot_upload_url, input.screenshotDataUrl)
    }
    return { ok: true, ticketId: json.ticket_id, routedTo: null }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : 'network',
    }
  }
}

async function uploadScreenshot(url: string, dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob()
  await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: blob,
  }).catch(() => {
    // Screenshot is best-effort; failure doesn't kill the flow.
  })
}

export type WidgetConfig = {
  plan: string | null
  remove_branding: boolean
}

export async function fetchWidgetConfig(): Promise<WidgetConfig> {
  // Defensive: never block widget render on this. If the request fails
  // (offline, CORS, etc.), we keep the watermark visible — that's the
  // safe default.
  try {
    const res = await fetch(`${API_BASE}/api/widget-config`)
    if (!res.ok) return { plan: null, remove_branding: false }
    return (await res.json()) as WidgetConfig
  } catch {
    return { plan: null, remove_branding: false }
  }
}
