import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUp, MessageSquare } from 'lucide-react'

import { Btn, Chip, LogoMark, Slab, Tag, type TagKind } from '#/components/ui/brut'
import { ThemeToggle } from '#/components/theme-toggle'
import type { ClassificationKind, TicketStatus } from '#/schema/ticket'
import { loadPublicBoard, type PublicBoard } from '#/server/public-board'

type PublicTicket = PublicBoard['tickets'][number]

const STATUS_LANES: Array<{ status: TicketStatus; label: string }> = [
  { status: 'open', label: 'Under review' },
  { status: 'planned', label: 'Planned' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'completed', label: 'Shipped' },
]

export const Route = createFileRoute('/b/$domain')({
  component: BoardPage,
  notFoundComponent: NotFoundBoard,
  errorComponent: BoardError,
  loader: async ({ params }) =>
    loadPublicBoard({ data: { domain: params.domain } }),
})

function NotFoundBoard() {
  return (
    <BoardMessage
      title="No board here."
      body="This workspace either isn't claimed yet or doesn't exist on FeedbackBot. Ask the site owner to claim their workspace."
    />
  )
}

function BoardError({ error }: { error: Error }) {
  return (
    <BoardMessage
      title="Something's off."
      body={error.message || 'The board failed to load. Try again in a moment.'}
    />
  )
}

function BoardMessage({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 32 }}>
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <LogoMark size={36} />
        </div>
        <h1 className="h-display" style={{ fontSize: 36, letterSpacing: '-0.03em' }}>
          {title}
        </h1>
        <p style={{ marginTop: 12, color: 'var(--fg-mute)', fontSize: 16, lineHeight: 1.5 }}>
          {body}
        </p>
      </div>
    </div>
  )
}

function BoardPage() {
  const initial = Route.useLoaderData() as PublicBoard
  const { domain } = Route.useParams() as { domain: string }
  const qc = useQueryClient()
  const { data } = useQuery<PublicBoard>({
    queryKey: ['board', domain],
    initialData: initial,
    queryFn: () => loadPublicBoard({ data: { domain } }),
    staleTime: 30_000,
  })
  const board: PublicBoard = data ?? initial

  const voteMut = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch('/api/vote', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      })
      // Voting requires a session — bounce unauthenticated users
      // through the magic-link flow and bring them back here.
      if (res.status === 401) {
        const next = `/b/${domain}`
        window.location.href = `/login?callbackURL=${encodeURIComponent(next)}`
        throw new Error('auth_required')
      }
      if (!res.ok) throw new Error(`vote failed: ${res.status}`)
      return res.json() as Promise<{ upvotes: number; voted: boolean }>
    },
    onSuccess: (result, ticketId) => {
      qc.setQueryData<PublicBoard | undefined>(['board', domain], (prev) =>
        prev
          ? {
              ...prev,
              tickets: prev.tickets.map((t) =>
                t.id === ticketId ? { ...t, upvotes: result.upvotes } : t,
              ),
            }
          : prev,
      )
    },
  })

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav
        style={{
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1.5px solid var(--border)',
        }}
      >
        <LogoMark size={28} />
        <span className="h-display" style={{ fontSize: 18 }}>
          FeedbackBot
        </span>
        <Chip>public board</Chip>
        <div style={{ flex: 1 }} />
        <ThemeToggle />
      </nav>

      <header style={{ padding: '48px 32px 16px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <Slab num="·" right={`/b/${board.workspace.domain}`}>
            Public feedback board
          </Slab>
          <h1
            className="h-display"
            style={{ fontSize: 'clamp(40px, 6vw, 72px)', letterSpacing: '-0.03em' }}
          >
            {board.workspace.domain}{' '}
            <span className="h-serif" style={{ fontStyle: 'italic' }}>
              roadmap.
            </span>
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 16,
              color: 'var(--fg-mute)',
              maxWidth: 640,
            }}
          >
            Vote on what should ship next. Comments are open once we've
            shipped the comment UI.
          </p>
        </div>
      </header>

      <SubmitCard domain={domain} />

      <section style={{ padding: '32px', paddingTop: 16 }}>
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'grid',
            gap: 24,
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
          }}
        >
          {STATUS_LANES.map((lane) => {
            const bucket = board.tickets.filter((t) => t.status === lane.status)
            return (
              <div key={lane.status}>
                <div
                  className="h-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--fg-mute)',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>{lane.label}</span>
                  <span style={{ color: 'var(--fg-faint)' }}>{bucket.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {bucket.length === 0 ? (
                    <div
                      style={{
                        padding: 16,
                        color: 'var(--fg-faint)',
                        border: '1.5px dashed var(--border-soft)',
                        fontSize: 13,
                      }}
                    >
                      nothing here yet
                    </div>
                  ) : (
                    bucket.map((t) => (
                      <TicketCard
                        key={t.id}
                        ticket={t}
                        onVote={() => voteMut.mutate(t.id)}
                        pendingVote={voteMut.isPending && voteMut.variables === t.id}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <footer
        style={{
          padding: '32px',
          borderTop: '1.5px solid var(--border)',
          textAlign: 'center',
          color: 'var(--fg-faint)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        powered by usefeedbackbot.com
      </footer>
    </div>
  )
}

function TicketCard({
  ticket,
  onVote,
  pendingVote,
}: {
  ticket: PublicTicket
  onVote: () => void
  pendingVote: boolean
}) {
  const kindToTag: Partial<Record<ClassificationKind, TagKind>> = {
    bug: 'bug',
    feature: 'feat',
    query: 'query',
  }
  const tagKind = ticket.classification
    ? kindToTag[ticket.classification]
    : undefined

  return (
    <div
      className="hi-card"
      style={{ padding: 16, display: 'grid', gridTemplateColumns: '48px 1fr', gap: 12 }}
    >
      <button
        onClick={onVote}
        disabled={pendingVote}
        className="hi-focus"
        style={{
          width: 42,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          border: '1.5px solid var(--border)',
          background: 'var(--surface)',
          padding: '6px 0',
          cursor: pendingVote ? 'wait' : 'pointer',
        }}
      >
        <ArrowUp size={14} strokeWidth={2} />
        <span className="h-mono" style={{ fontSize: 12, fontWeight: 700 }}>
          {ticket.upvotes}
        </span>
      </button>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
          {ticket.suggested_title ?? ticket.message.slice(0, 100)}
        </div>
        {ticket.suggested_title && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--fg-mute)',
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {ticket.message.slice(0, 140)}
            {ticket.message.length > 140 ? '…' : ''}
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {tagKind && <Tag kind={tagKind} />}
          <span
            className="h-mono"
            style={{ fontSize: 11, color: 'var(--fg-faint)' }}
          >
            {relativeTime(ticket.created_at)}
          </span>
          <span
            className="h-mono"
            style={{
              fontSize: 11,
              color: 'var(--fg-faint)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <MessageSquare size={11} strokeWidth={1.75} /> 0
          </span>
        </div>
      </div>
    </div>
  )
}

function SubmitCard({ domain }: { domain: string }) {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const submit = async () => {
    if (!message.trim()) return
    setStatus('sending')
    try {
      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Public board submits on behalf of its own domain.
          origin: `https://${domain}`,
        },
        body: JSON.stringify({
          message,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
          email: email || '',
          honeypot: '',
        }),
      })
      if (!res.ok) throw new Error('submit failed')
      setStatus('sent')
      setMessage('')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section style={{ padding: '0 32px' }}>
      <div
        className="hi-card hi-card-raised"
        style={{ maxWidth: 1080, margin: '24px auto', padding: 20 }}
      >
        <div
          className="h-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--fg-mute)',
            marginBottom: 10,
          }}
        >
          Request a feature
        </div>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What should ship next?"
          style={{
            width: '100%',
            border: '1.5px solid var(--border)',
            background: 'var(--surface)',
            padding: '10px 12px',
            fontSize: 15,
            fontFamily: 'var(--font-display)',
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="optional email"
            style={{
              flex: '1 1 220px',
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              padding: '8px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <Btn
            variant="primary"
            onClick={submit}
            disabled={status === 'sending' || !message.trim()}
          >
            {status === 'sending' ? 'sending…' : status === 'sent' ? 'sent' : 'submit'}
          </Btn>
        </div>
        {status === 'error' && (
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color: 'var(--danger)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Could not send — try again in a moment.
          </div>
        )}
      </div>
    </section>
  )
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
