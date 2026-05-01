/** @jsxImportSource preact */
import { useEffect, useRef, useState } from 'preact/hooks'

import { fetchWidgetConfig, submitTicket } from './api'
import { mintTurnstileToken, TURNSTILE_ENABLED } from './turnstile'

type Step = 'compose' | 'sending' | 'sent'
type Kind = 'auto' | 'bug' | 'idea' | 'ask'

const KINDS: Array<{ k: Kind; label: string; glyph: string }> = [
  { k: 'auto', label: 'auto', glyph: '⚡' },
  { k: 'bug', label: 'bug', glyph: '☒' },
  { k: 'idea', label: 'idea', glyph: '★' },
  { k: 'ask', label: 'ask', glyph: '?' },
]

export function Widget(props: { onClose?: () => void; theme?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('compose')
  const [kind, setKind] = useState<Kind>('auto')
  const [msg, setMsg] = useState('')
  const [email, setEmail] = useState('')
  const [withScreenshot, setWithScreenshot] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // remove_branding entitlement flag — fetched once on mount, defaults
  // to false (watermark visible) so the link still renders if the
  // config endpoint is unreachable.
  const [removeBranding, setRemoveBranding] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchWidgetConfig().then((cfg) => {
      if (!cancelled) setRemoveBranding(cfg.remove_branding)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const close = () => {
    setOpen(false)
    props.onClose?.()
  }
  const reset = () => {
    setStep('compose')
    setMsg('')
    setErrorMessage(null)
  }

  const turnstileRef = useRef<HTMLDivElement>(null)

  const send = async () => {
    setStep('sending')
    setErrorMessage(null)
    let screenshotDataUrl: string | undefined
    if (withScreenshot) {
      const { captureScreenshot } = await import('./screenshot')
      screenshotDataUrl = (await captureScreenshot()) ?? undefined
    }
    // Mint a Turnstile token if enabled. Tokens are single-use and
    // expire in ~5 min — minting per submit keeps it simple. When
    // disabled (no site key baked), this resolves to '' instantly.
    let turnstileToken = ''
    if (TURNSTILE_ENABLED && turnstileRef.current) {
      turnstileToken = await mintTurnstileToken(turnstileRef.current)
    }
    const result = await submitTicket({
      message: msg,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      email: email || undefined,
      kind,
      screenshotDataUrl,
      turnstileToken,
    })
    if (result.ok) {
      setStep('sent')
    } else {
      // Surface the error inline on the compose step so the user
      // can fix-up + retry without losing what they typed. (Was
      // `setStep('sent')` here, which trapped the user on a
      // success screen with an error message and no way back.)
      setErrorMessage(
        result.status === 429
          ? 'Too many submissions — try again in a minute.'
          : result.status === 403
          ? "Couldn't verify — please refresh and try again."
          : 'Could not send. Try again.',
      )
      setStep('compose')
    }
  }

  const themeClass = props.theme === 'dark' ? 'theme-dark' : ''

  return (
    <div class={`wrap ${themeClass}`}>
      {/* Invisible Turnstile mount point. Lives outside the panel
          so it survives panel open/close cycles. */}
      <div
        ref={turnstileRef}
        style="position:absolute;width:0;height:0;overflow:hidden;"
        aria-hidden
      />
      <div class="stack">
        {open && (
          <div class="panel">
            <div class="head">
              <strong class="title">Send feedback</strong>
              <span class="spacer" />
              <button class="x" onClick={close} aria-label="close">
                ×
              </button>
            </div>

            {step === 'compose' && (
              <div class="body">
                <div class="kinds">
                  {KINDS.map((x) => (
                    <button
                      key={x.k}
                      class={kind === x.k ? 'active' : ''}
                      onClick={() => setKind(x.k)}
                      type="button"
                    >
                      <span aria-hidden>{x.glyph}</span>
                      {x.label}
                    </button>
                  ))}
                </div>

                <div class="textwrap">
                  <textarea
                    rows={4}
                    value={msg}
                    onInput={(e) =>
                      setMsg((e.currentTarget as HTMLTextAreaElement).value)
                    }
                    placeholder="What's on your mind? We'll auto-classify."
                  />
                  <div class="ctl">
                    <label>
                      <span class={`check ${withScreenshot ? 'on' : ''}`}>
                        {withScreenshot ? '✓' : ''}
                      </span>
                      <input
                        type="checkbox"
                        checked={withScreenshot}
                        onChange={(e) =>
                          setWithScreenshot(
                            (e.currentTarget as HTMLInputElement).checked,
                          )
                        }
                        style={{ display: 'none' }}
                      />
                      screenshot
                    </label>
                    <span class="divider" />
                    <span>{msg.length} / 2000</span>
                    <span class="spacer" />
                    <span class="tag">markdown ok</span>
                  </div>
                </div>

                <div class="email">
                  <span class="label">reply to</span>
                  <input
                    type="email"
                    value={email}
                    onInput={(e) =>
                      setEmail((e.currentTarget as HTMLInputElement).value)
                    }
                    placeholder="optional@email.com"
                  />
                </div>

                {errorMessage && (
                  <div class="err" role="alert">
                    {errorMessage}
                  </div>
                )}

                <div class="foot">
                  {removeBranding ? (
                    <span class="spacer" />
                  ) : (
                    <>
                      <a
                        class="brand"
                        href="https://usefeedbackbot.com/?ref=widget"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ▣ Powered by FeedbackBot
                      </a>
                      <span class="spacer" />
                    </>
                  )}
                  <button
                    class="btn primary"
                    onClick={send}
                    disabled={!msg.trim()}
                    type="button"
                  >
                    send
                  </button>
                </div>
              </div>
            )}

            {step === 'sending' && (
              <div class="pending">
                <div class="hint">routing</div>
                <div class="dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            {step === 'sent' && (
              <div class="sent">
                <div class="badge" aria-hidden>
                  ✓
                </div>
                {errorMessage ? (
                  <>
                    <div class="title">Try again</div>
                    <div class="err">{errorMessage}</div>
                  </>
                ) : (
                  <>
                    <div class="title">Got it.</div>
                    <div class="sub">Tagged and routed to your integrations.</div>
                  </>
                )}
                <button class="btn ghost" onClick={reset} type="button">
                  send another
                </button>
              </div>
            )}
          </div>
        )}

        <button
          class={`bubble ${open ? 'open' : ''}`}
          onClick={() => setOpen(!open)}
          aria-label="Feedback"
          type="button"
        >
          {open ? '×' : '💬'}
        </button>
      </div>
    </div>
  )
}
