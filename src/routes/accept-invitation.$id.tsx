import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Mail } from 'lucide-react'

import { Btn, LogoMark, Slab } from '#/components/ui/brut'
import { requestMagicLink } from '#/lib/client-auth'
import { seoMeta } from '#/lib/seo'

export const Route = createFileRoute('/accept-invitation/$id')({
  component: AcceptInvitationPage,
  head: () => ({
    meta: seoMeta({
      path: '/accept-invitation',
      title: 'Accept invitation',
      noindex: true,
    }),
  }),
})

type Invitation = {
  id: string
  email: string
  role: string
  status: string
  organizationName?: string
  organizationSlug?: string
  organization?: { id: string; name: string; slug: string }
}

type Session = {
  signed_in: boolean
  user: { id: string; email: string; is_anonymous: boolean } | null
}

function AcceptInvitationPage() {
  const { id } = Route.useParams() as { id: string }

  const me = useQuery({
    queryKey: ['me-session'],
    queryFn: async (): Promise<Session> => {
      const res = await fetch('/api/me/workspaces', {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
  })

  const inv = useQuery({
    queryKey: ['invitation', id],
    queryFn: async (): Promise<Invitation> => {
      const res = await fetch(
        `/api/auth/organization/get-invitation?id=${encodeURIComponent(id)}`,
        { credentials: 'include' },
      )
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `HTTP ${res.status}`)
      }
      return res.json()
    },
  })

  const accept = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/organization/accept-invitation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invitationId: id }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      const slug = inv.data?.organization?.slug ?? inv.data?.organizationSlug
      if (slug) {
        window.location.href = `/dashboard/${slug}`
      } else {
        window.location.href = '/'
      }
    },
  })

  const orgName =
    inv.data?.organization?.name ??
    inv.data?.organizationName ??
    'a workspace'

  // If the signed-in user's email matches the invitee email, auto-fire
  // accept. Most common case after the magic link round-trip.
  const isInvitee =
    me.data?.signed_in &&
    !me.data.user?.is_anonymous &&
    me.data.user?.email?.toLowerCase() === inv.data?.email?.toLowerCase()
  useEffect(() => {
    if (isInvitee && inv.data?.status === 'pending' && !accept.isPending) {
      accept.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInvitee, inv.data?.status])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
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

        <Slab num="!" right="invitation">
          You're invited.
        </Slab>

        {(me.isLoading || inv.isLoading) && (
          <div style={{ color: 'var(--fg-mute)', fontSize: 13 }}>Loading…</div>
        )}

        {inv.error && (
          <ErrBox
            msg={
              "Couldn't fetch this invitation — it may have been cancelled or it's expired. " +
              ((inv.error as Error).message || '')
            }
          />
        )}

        {inv.data && inv.data.status !== 'pending' && (
          <div className="hi-card" style={{ padding: 16, marginTop: 16 }}>
            This invitation is <strong>{inv.data.status}</strong>. Reach out
            to the workspace owner if you think this is wrong.
          </div>
        )}

        {inv.data && inv.data.status === 'pending' && (
          <>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--fg-mute)',
                margin: '12px 0 18px',
              }}
            >
              You've been invited to join <strong>{orgName}</strong> on
              FeedbackBot as <strong>{inv.data.role}</strong>.
              <br />
              Invitation sent to <code>{inv.data.email}</code>.
            </p>

            {!me.data?.signed_in || me.data.user?.is_anonymous ? (
              <SignInPrompt invitationId={id} email={inv.data.email} />
            ) : isInvitee ? (
              <div className="hi-card" style={{ padding: 16 }}>
                {accept.isPending ? (
                  <span style={{ color: 'var(--fg-mute)', fontSize: 13 }}>
                    Joining {orgName}…
                  </span>
                ) : accept.error ? (
                  <ErrBox msg={(accept.error as Error).message} />
                ) : (
                  <>
                    <div style={{ marginBottom: 10, fontSize: 14 }}>
                      <Check size={14} strokeWidth={2.5} /> Signed in as{' '}
                      <code>{me.data.user?.email}</code>.
                    </div>
                    <Btn
                      variant="primary"
                      onClick={() => accept.mutate()}
                      disabled={accept.isPending}
                    >
                      {accept.isPending ? 'Joining…' : 'Accept invitation'}
                    </Btn>
                  </>
                )}
              </div>
            ) : (
              <div className="hi-card" style={{ padding: 16 }}>
                You're signed in as <code>{me.data.user?.email}</code> but
                this invitation is for <code>{inv.data.email}</code>.
                <div style={{ marginTop: 12 }}>
                  <Btn
                    as="a"
                    href={`/login?invite=${id}`}
                    variant="primary"
                    size="sm"
                  >
                    Sign in as {inv.data.email}
                  </Btn>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SignInPrompt({
  invitationId,
  email,
}: {
  invitationId: string
  email: string
}) {
  const [stage, setStage] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setStage('sending')
    setError(null)
    try {
      await requestMagicLink({
        email,
        callbackURL: `/accept-invitation/${invitationId}`,
      })
      setStage('sent')
    } catch (err) {
      setStage('error')
      setError((err as Error).message || 'failed')
    }
  }

  if (stage === 'sent') {
    return (
      <div
        className="hi-card"
        style={{
          padding: 16,
          background: 'var(--surface-alt)',
          borderColor: 'var(--accent)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Mail size={14} strokeWidth={2} />
          <strong style={{ fontSize: 14 }}>Magic link sent</strong>
        </div>
        <p style={{ fontSize: 13, color: 'var(--fg-mute)', lineHeight: 1.5 }}>
          Check <code>{email}</code> for a sign-in link. Clicking it will
          bring you back here and accept the invitation automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="hi-card" style={{ padding: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--fg-mute)', marginBottom: 14 }}>
        Sign in to accept. We'll email a one-click link to{' '}
        <code>{email}</code>.
      </p>
      <Btn variant="primary" onClick={send} disabled={stage === 'sending'}>
        <Mail size={12} strokeWidth={2} />
        {stage === 'sending' ? 'Sending…' : `Email me a sign-in link`}
      </Btn>
      {error && <ErrBox msg={error} />}
    </div>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 10,
        border: '1.5px solid var(--danger)',
        color: 'var(--danger)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}
    >
      {msg}
    </div>
  )
}
