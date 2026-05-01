import { createFileRoute, redirect, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Btn, LogoMark, Slab } from '#/components/ui/brut'
import { authClient } from '#/lib/auth-client'
import { requestMagicLink } from '#/lib/client-auth'
import { seoMeta } from '#/lib/seo'
import { PLAN_LABEL, type PlanId } from '#/lib/billing/plans'
import { loadLoginState } from '#/server/login-state'

const PLAN_INTENT_KEY = 'fb:intended_plan'

// Only allow same-origin path callbacks. Reject absolute URLs and
// protocol-relative `//evil.com` to prevent open-redirect abuse.
function safeCallbackURL(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  if (!raw.startsWith('/') || raw.startsWith('//')) return undefined
  return raw
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
  validateSearch: (raw: Record<string, unknown>) => ({
    plan: typeof raw.plan === 'string' ? (raw.plan as string) : undefined,
    callbackURL: safeCallbackURL(raw.callbackURL),
  }),
  // Loader runs server-side on first hit and on every client nav.
  // It collapses the previous two useEffect probes (auth-state +
  // workspace lookup) into one server round-trip and short-circuits
  // signed-in users with a claimed workspace before we render.
  loaderDeps: ({ search }) => ({ callbackURL: search.callbackURL }),
  loader: async ({ deps }) => {
    const state = await loadLoginState()
    // Honor an explicit callbackURL when the visitor is already
    // signed in (e.g. they clicked "Vote" on a public board, hit
    // /login while still authenticated, and we want to bounce
    // them straight back). Validated in validateSearch — only
    // same-origin paths reach here.
    if (state.signed_in && deps.callbackURL) {
      throw redirect({ to: deps.callbackURL })
    }
    // Signed-in user with a claimed workspace → straight to dashboard.
    if (state.signed_in && state.claimed_workspace_domain) {
      throw redirect({
        to: '/dashboard/$domain',
        params: { domain: state.claimed_workspace_domain },
      })
    }
    // Signed-in user mid-onboarding (paid but no claimed workspace
    // yet) → resume the onboarding flow.
    if (state.signed_in && state.incomplete_workspace_id) {
      throw redirect({
        to: '/onboard/$workspaceId',
        params: { workspaceId: state.incomplete_workspace_id },
        search: { failed: undefined },
      })
    }
    // Signed-in user with no workspace at all → bounce to pricing
    // so they can pick a plan. We no longer ask them to install
    // the snippet first; the snippet shows after payment + verify.
    if (state.signed_in) {
      throw redirect({ to: '/', hash: 'pricing' })
    }
    return state
  },
  staleTime: 0,
  shouldReload: true,
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
  // Signed-in users are redirected away in the loader before the
  // component renders — only the magic-link / OAuth form remains here.
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
      // Default: land back on /login after verify; the loader
      // routes based on workspace state (claimed → /dashboard,
      // incomplete → /onboard/{ws}, neither → /#pricing). When a
      // ?callbackURL= param is present (e.g. a vote/comment 401
      // redirect from a public board), we pass it through so the
      // visitor is bounced straight back to where they were.
      await requestMagicLink({
        email,
        callbackURL: search.callbackURL ?? '/login',
      })
      setStage('sent')
    } catch (err) {
      setStage('error')
      setError((err as Error).message || 'Failed to send magic link')
    }
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
                  // the SDK wraps the redirect dance for us. Same
                  // callbackURL trick as magic-link: re-enter /login
                  // (or the explicit callbackURL when present) so
                  // its loader routes the user to the right place.
                  authClient.signIn.social({
                    provider: 'google',
                    callbackURL: search.callbackURL ?? '/login',
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
