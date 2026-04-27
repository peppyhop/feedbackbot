import { createFileRoute, redirect, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Btn, LogoMark, Slab } from '#/components/ui/brut'
import { authClient } from '#/lib/auth-client'
import { seoMeta } from '#/lib/seo'
import { PLAN_LABEL, type PlanId } from '#/lib/billing/plans'
import { loadLoginState } from '#/server/login-state'

const PLAN_INTENT_KEY = 'fb:intended_plan'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  validateSearch: (raw: Record<string, unknown>) => ({
    plan: typeof raw.plan === 'string' ? (raw.plan as string) : undefined,
  }),
  // Loader runs server-side on first hit and on every client nav.
  // It collapses the previous two useEffect probes (auth-state +
  // workspace lookup) into one server round-trip and short-circuits
  // signed-in users with a claimed workspace before we render.
  loader: async () => {
    const state = await loadLoginState()
    if (state.signed_in && state.claimed_workspace_domain) {
      throw redirect({
        to: '/dashboard/$domain/billing',
        params: { domain: state.claimed_workspace_domain },
      })
    }
    return state
  },
  head: () => ({
    meta: seoMeta({
      path: '/login',
      title: 'Sign in',
      noindex: true,
    }),
  }),
})

type Stage = 'idle' | 'sending' | 'sent' | 'error'

function LoginPage() {
  const search = useSearch({ from: '/login' })
  const state = Route.useLoaderData()
  const signedInNoWorkspace = state.signed_in
  const googleEnabled = state.google_enabled
  const magicLinkEnabled = state.magic_link_enabled

  const planSlug = search.plan
  const planId: PlanId | null =
    planSlug === 'lite' ||
    planSlug === 'starter' ||
    planSlug === 'scale'
      ? planSlug
      : null
  const planLabel = planId ? PLAN_LABEL[planId] : null

  // Persist the intended plan so the billing page can auto-trigger
  // checkout after the user signs in and claims a workspace. Cleared
  // on successful checkout.
  useEffect(() => {
    if (typeof window === 'undefined' || !planId) return
    try {
      window.sessionStorage.setItem(PLAN_INTENT_KEY, planId)
    } catch {
      // SessionStorage denied (private mode, etc.) — best-effort only.
    }
  }, [planId])

  const [email, setEmail] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setStage('sending')
    setError(null)
    try {
      const res = await fetch('/api/auth/sign-in/magic-link', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          callbackURL: '/',
        }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `HTTP ${res.status}`)
      }
      setStage('sent')
    } catch (err) {
      setStage('error')
      setError((err as Error).message || 'Failed to send magic link')
    }
  }

  if (signedInNoWorkspace) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <div style={{ width: '100%', maxWidth: 460 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <LogoMark size={36} />
            <div style={{ fontWeight: 700, fontSize: 18 }}>FeedbackBot</div>
          </div>
          <Slab num="02" right="next step">
            You're signed in.
          </Slab>
          {planLabel && (
            <div
              style={{
                padding: '10px 12px',
                marginTop: 8,
                marginBottom: 16,
                border: '1.5px solid var(--accent)',
                background: 'var(--surface-alt)',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Your <strong>{planLabel}</strong> pick is saved. We'll
              auto-open checkout the moment you have a claimed workspace.
            </div>
          )}
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--fg-mute)' }}>
            FeedbackBot bills per workspace. To upgrade, you first need
            to install the widget on a site you control and claim the
            workspace (DNS TXT record or an email on the matching
            domain).
          </p>
          <ol
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--fg)',
              paddingLeft: 20,
              marginTop: 12,
            }}
          >
            <li>Copy the install snippet from the landing page.</li>
            <li>Drop it into your site's <code>&lt;head&gt;</code>.</li>
            <li>Open the widget once — that registers the workspace.</li>
            <li>Go to <code>/dashboard/&lt;your-domain&gt;/claim</code> and verify.</li>
          </ol>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <Btn as="a" href="/#get-started" variant="primary">
              Install the widget
            </Btn>
            <Btn as="a" href="/" variant="ghost">
              Back to home
            </Btn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <LogoMark size={36} />
          <div style={{ fontWeight: 700, fontSize: 18 }}>FeedbackBot</div>
        </div>

        <Slab num="01" right="sign in">
          Welcome back
        </Slab>

        <p style={{ color: 'var(--fg-mute)', fontSize: 14, marginBottom: 24 }}>
          Sign in with a magic link or Google. No password.
        </p>

        {planLabel && (
          <div
            style={{
              padding: '10px 12px',
              marginBottom: 20,
              border: '1.5px solid var(--accent)',
              background: 'var(--surface-alt)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            Heads up — you're signing in to upgrade to{' '}
            <strong>{planLabel}</strong>. After you sign in and claim a
            workspace, we'll take you straight to checkout.
          </div>
        )}

        {stage === 'sent' ? (
          <div
            className="hi-card"
            style={{
              padding: 20,
              borderColor: 'var(--accent)',
              background: 'var(--surface-alt)',
            }}
          >
            <strong style={{ fontSize: 15 }}>Check your inbox.</strong>
            <p
              style={{
                marginTop: 8,
                fontSize: 13,
                color: 'var(--fg-mute)',
                lineHeight: 1.5,
              }}
            >
              We sent a sign-in link to <code>{email}</code>. It's valid for
              5 minutes.
            </p>
            <div style={{ marginTop: 16 }}>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setStage('idle')}
              >
                Use a different email
              </Btn>
            </div>
          </div>
        ) : (
          <>
            {magicLinkEnabled && (
            <form
              onSubmit={sendMagicLink}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <label
                className="h-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-faint)',
                }}
              >
                email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="you@yourdomain.com"
                required
                autoComplete="email"
                className="hi-focus"
                style={{
                  padding: '10px 12px',
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--fg)',
                  fontSize: 15,
                  fontFamily: 'inherit',
                }}
              />
              <Btn
                variant="primary"
                disabled={stage === 'sending' || !email}
              >
                {stage === 'sending' ? 'Sending…' : 'Email me a magic link'}
              </Btn>
            </form>
            )}

            {googleEnabled && magicLinkEnabled && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  margin: '20px 0',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 1.5,
                    background: 'var(--border)',
                  }}
                />
                <span
                  className="h-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--fg-faint)',
                  }}
                >
                  or
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1.5,
                    background: 'var(--border)',
                  }}
                />
              </div>
            )}
            {googleEnabled && (
              <Btn
                variant="default"
                onClick={() => {
                  // Better Auth's social sign-in endpoint is POST-only;
                  // the SDK wraps the redirect dance for us. callbackURL
                  // is where we land after the proxy hop completes.
                  authClient.signIn.social({
                    provider: 'google',
                    callbackURL: '/',
                  })
                }}
              >
                Continue with Google
              </Btn>
            )}

            {error && (
              <div
                style={{
                  marginTop: 16,
                  padding: 10,
                  border: '1.5px solid var(--danger)',
                  color: 'var(--danger)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
