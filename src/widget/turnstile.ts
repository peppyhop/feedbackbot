// Cloudflare Turnstile client integration. Lazy-loads the script
// on first use, renders an invisible widget inside the Shadow DOM,
// returns a fresh token per call.
//
// When the build-time site key is empty (graceful mode), every
// helper returns immediately with an empty token. The server
// route mirrors this: `TURNSTILE_SECRET` unset → bypass gate.

declare const __FB_TURNSTILE_SITEKEY__: string

const SITEKEY = __FB_TURNSTILE_SITEKEY__
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

interface TurnstileApi {
  render(
    container: Element,
    opts: {
      sitekey: string
      size?: 'normal' | 'compact' | 'invisible' | 'flexible'
      callback?: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
    },
  ): string
  execute(widgetId: string): void
  reset(widgetId: string): void
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export const TURNSTILE_ENABLED = SITEKEY !== ''

let scriptPromise: Promise<TurnstileApi> | null = null

function loadScript(): Promise<TurnstileApi> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile)
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('turnstile script loaded but global missing'))
    }
    script.onerror = () => reject(new Error('turnstile script failed to load'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

// Hard ceiling on how long we'll wait for a Turnstile token.
// Cloudflare's invisible challenge usually returns in <100ms;
// if it's still pending after this we give up and let the server
// respond with whatever its current gate behavior is. Without
// this timeout, a misconfigured hostname (not on the allowlist)
// silently hangs the iframe and the widget shows an infinite
// "routing" spinner.
const MINT_TIMEOUT_MS = 5000

// Mint a fresh token. Resolves to empty string on any failure
// (including graceful mode and timeout) — caller should still
// try to submit; the server will reject if TURNSTILE_SECRET is
// set, and the widget will surface that as an inline error.
export async function mintTurnstileToken(
  container: HTMLElement,
): Promise<string> {
  if (!TURNSTILE_ENABLED) return ''
  try {
    const turnstile = await loadScript()
    return await new Promise<string>((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        console.warn('feedbackbot: turnstile mint timed out')
        resolve('')
      }, MINT_TIMEOUT_MS)
      const finish = (token: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(token)
      }

      const widgetId = turnstile.render(container, {
        sitekey: SITEKEY,
        size: 'invisible',
        callback: (token) => {
          // Clean up the rendered widget so the next submission
          // mints a fresh token from a fresh render.
          try {
            turnstile.remove(widgetId)
          } catch {
            // ignore — best effort
          }
          finish(token)
        },
        'error-callback': () => finish(''),
        'expired-callback': () => finish(''),
      })
      // Invisible widgets need an explicit execute() to start the
      // challenge. Wrapped in try in case of API drift.
      try {
        turnstile.execute(widgetId)
      } catch {
        finish('')
      }
    })
  } catch (err) {
    console.warn('feedbackbot: turnstile mint failed', err)
    return ''
  }
}
