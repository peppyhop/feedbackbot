import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Slab, Chip, Btn, Tag, type TagKind } from '#/components/ui/brut'
import type { ClassificationKind, TicketStatus } from '#/schema/ticket'

type AdminTicket = {
  id: string
  message: string
  status: TicketStatus
  classification: ClassificationKind | null
  classificationMeta: string | null
  upvotes: number
  createdAt: number
  pageUrl: string | null
}

export const Route = createFileRoute('/dashboard/$domain/')({
  component: Tickets,
})

// Lanes shown in the Kanban view. `closed` is treated as archive
// and hidden by default — toggle via the filter chip. `spam`
// short-circuits its own column when present so it doesn't
// pollute the funnel.
const LANES: Array<{ status: TicketStatus; label: string }> = [
  { status: 'open', label: 'Open' },
  { status: 'planned', label: 'Planned' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'completed', label: 'Shipped' },
]

const KIND_TAGS: Record<ClassificationKind, TagKind> = {
  bug: 'bug',
  feature: 'feat',
  query: 'query',
  spam: 'spam',
}

type KindFilter = 'all' | ClassificationKind

function Tickets() {
  const { domain } = Route.useParams() as { domain: string }
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [showSpam, setShowSpam] = useState(false)
  const [showClosed, setShowClosed] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-tickets', domain],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/tickets?domain=${encodeURIComponent(domain)}`,
        { credentials: 'include' },
      )
      if (res.status === 401) throw new Error('sign in required')
      if (res.status === 403) throw new Error('not a member of this workspace')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { tickets: Array<AdminTicket> }
    },
  })

  const tickets = data?.tickets ?? []

  // Apply filters before bucketing.
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (kindFilter !== 'all' && t.classification !== kindFilter) return false
      if (!showSpam && t.classification === 'spam') return false
      if (!showClosed && t.status === 'closed') return false
      return true
    })
  }, [tickets, kindFilter, showSpam, showClosed])

  // Bucket into lanes. Spam tickets (when enabled) get their own
  // lane appended at the right.
  const buckets = useMemo(() => {
    const byStatus: Record<string, Array<AdminTicket>> = {
      open: [],
      planned: [],
      in_progress: [],
      completed: [],
      closed: [],
    }
    const spamLane: Array<AdminTicket> = []
    for (const t of filtered) {
      if (t.classification === 'spam') {
        spamLane.push(t)
        continue
      }
      byStatus[t.status]?.push(t)
    }
    return { byStatus, spamLane }
  }, [filtered])

  const lanes = useMemo(() => {
    const base = [...LANES]
    if (showClosed) base.push({ status: 'closed', label: 'Closed' })
    return base
  }, [showClosed])

  return (
    <div>
      <Slab num="01" right={`workspace: ${domain}`}>
        Tickets
      </Slab>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Chip accent>{tickets.length} total</Chip>
        <KindFilterChips
          value={kindFilter}
          counts={kindCounts(tickets)}
          onChange={setKindFilter}
        />
        <ToggleChip
          label="spam"
          on={showSpam}
          count={countBy(tickets, (t) => t.classification === 'spam')}
          onClick={() => setShowSpam((v) => !v)}
        />
        <ToggleChip
          label="closed"
          on={showClosed}
          count={countBy(tickets, (t) => t.status === 'closed')}
          onClick={() => setShowClosed((v) => !v)}
        />
        <div style={{ flex: 1 }} />
        <Btn size="sm">Export CSV</Btn>
      </div>

      {isLoading && (
        <div className="h-mono" style={{ color: 'var(--fg-mute)', fontSize: 13 }}>
          Loading tickets…
        </div>
      )}
      {error && (
        <div
          className="hi-card"
          style={{
            padding: 20,
            background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
            borderColor: 'var(--danger)',
          }}
        >
          <strong>Couldn't load tickets.</strong>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {(error as Error).message}
          </div>
        </div>
      )}

      {!isLoading && !error && tickets.length === 0 && <EmptyState domain={domain} />}

      {!isLoading && !error && tickets.length > 0 && (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            alignItems: 'start',
          }}
        >
          {lanes.map((lane) => (
            <Lane
              key={lane.status}
              label={lane.label}
              tickets={buckets.byStatus[lane.status] ?? []}
              domain={domain}
            />
          ))}
          {showSpam && (
            <Lane
              label="Spam"
              tickets={buckets.spamLane}
              domain={domain}
              tone="muted"
            />
          )}
        </div>
      )}
    </div>
  )
}

function Lane({
  label,
  tickets,
  domain,
  tone,
}: {
  label: string
  tickets: Array<AdminTicket>
  domain: string
  tone?: 'muted'
}) {
  return (
    <div
      style={{
        opacity: tone === 'muted' ? 0.7 : 1,
      }}
    >
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
        <span>{label}</span>
        <span style={{ color: 'var(--fg-faint)' }}>{tickets.length}</span>
      </div>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {tickets.length === 0 ? (
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
          tickets.map((t) => <KanbanCard key={t.id} ticket={t} domain={domain} />)
        )}
      </div>
    </div>
  )
}

function KanbanCard({
  ticket,
  domain,
}: {
  ticket: AdminTicket
  domain: string
}) {
  const meta = ticket.classificationMeta
    ? (safeParse(ticket.classificationMeta) as {
        suggested_title?: string
      } | null)
    : null
  const title = meta?.suggested_title ?? ticket.message.slice(0, 80)
  const tagKind = ticket.classification ? KIND_TAGS[ticket.classification] : undefined
  return (
    <Link
      to="/dashboard/$domain/tickets/$id"
      params={{ domain, id: ticket.id }}
      style={{ textDecoration: 'none' }}
    >
      <div
        className="hi-card"
        style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--fg-mute)',
            lineHeight: 1.4,
          }}
        >
          {ticket.message.slice(0, 120)}
          {ticket.message.length > 120 ? '…' : ''}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 2,
          }}
        >
          {tagKind && <Tag kind={tagKind} />}
          <span
            className="h-mono"
            style={{ fontSize: 10, color: 'var(--fg-faint)' }}
          >
            ▲ {ticket.upvotes}
          </span>
          <span style={{ flex: 1 }} />
          <span
            className="h-mono"
            style={{ fontSize: 10, color: 'var(--fg-faint)' }}
          >
            {relTime(ticket.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  )
}

function KindFilterChips({
  value,
  counts,
  onChange,
}: {
  value: KindFilter
  counts: Record<ClassificationKind | 'all', number>
  onChange: (v: KindFilter) => void
}) {
  const opts: Array<{ k: KindFilter; label: string }> = [
    { k: 'all', label: 'all kinds' },
    { k: 'bug', label: 'bugs' },
    { k: 'feature', label: 'features' },
    { k: 'query', label: 'queries' },
  ]
  return (
    <>
      {opts.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          style={{
            padding: '4px 10px',
            border: '1.5px solid var(--border)',
            background: value === o.k ? 'var(--accent)' : 'transparent',
            color: value === o.k ? 'var(--accent-ink)' : 'var(--fg)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {o.label} {counts[o.k as keyof typeof counts] ?? 0}
        </button>
      ))}
    </>
  )
}

function ToggleChip({
  label,
  on,
  count,
  onClick,
}: {
  label: string
  on: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        border: '1.5px solid var(--border)',
        background: on ? 'var(--surface-alt)' : 'transparent',
        color: on ? 'var(--fg)' : 'var(--fg-mute)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {on ? '✓' : '○'} {label} {count}
    </button>
  )
}

function EmptyState({ domain }: { domain: string }) {
  return (
    <div className="hi-card" style={{ padding: 28, textAlign: 'center' }}>
      <div
        className="h-mono"
        style={{
          fontSize: 11,
          color: 'var(--fg-faint)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        No tickets yet
      </div>
      <div
        className="h-display"
        style={{ fontSize: 28, marginBottom: 10, letterSpacing: '-0.02em' }}
      >
        Quiet inbox.
      </div>
      <p
        style={{
          fontSize: 14,
          color: 'var(--fg-mute)',
          maxWidth: 420,
          margin: '0 auto 16px',
          lineHeight: 1.5,
        }}
      >
        Once visitors open the widget on{' '}
        <span className="h-mono" style={{ fontSize: 13 }}>
          {domain}
        </span>{' '}
        and submit feedback, it'll show up here — auto-classified into bugs,
        features, queries, and spam.
      </p>
    </div>
  )
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function countBy<T>(xs: Array<T>, p: (t: T) => boolean): number {
  let n = 0
  for (const x of xs) if (p(x)) n++
  return n
}

function kindCounts(
  tickets: Array<AdminTicket>,
): Record<ClassificationKind | 'all', number> {
  const counts: Record<string, number> = {
    all: tickets.length,
    bug: 0,
    feature: 0,
    query: 0,
    spam: 0,
  }
  for (const t of tickets) {
    if (t.classification) counts[t.classification] += 1
  }
  return counts as Record<ClassificationKind | 'all', number>
}

// Compact relative time — "5m", "3h", "2d", "Apr 28".
function relTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
