import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { AdminTicketRow } from './dashboard.$domain'
import { Slab, Chip, Btn } from '#/components/ui/brut'
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

function Tickets() {
  const { domain } = Route.useParams() as { domain: string }
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
        <Chip accent>{data?.tickets.length ?? 0} total</Chip>
        <Chip>all statuses</Chip>
        <Chip>all kinds</Chip>
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

      {!isLoading && !error && data && data.tickets.length === 0 && (
        <div
          className="hi-card"
          style={{ padding: 28, textAlign: 'center' }}
        >
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
            and submit feedback, it'll show up here — pre-sorted into bugs,
            ideas, questions, and spam.
          </p>
          <Btn as="a" href="/#get-started" variant="ghost" size="sm">
            Install snippet →
          </Btn>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data?.tickets.map((t) => {
          const kindMap: Partial<
            Record<ClassificationKind, 'bug' | 'feat' | 'query' | 'spam'>
          > = {
            bug: 'bug',
            feature: 'feat',
            query: 'query',
            spam: 'spam',
          }
          const meta = t.classificationMeta
            ? (safeParse(t.classificationMeta) as {
                suggested_title?: string
              } | null)
            : null
          return (
            <Link
              key={t.id}
              to="/dashboard/$domain/tickets/$id"
              params={{ domain, id: t.id }}
              style={{ textDecoration: 'none' }}
            >
              <AdminTicketRow
                title={meta?.suggested_title ?? t.message.slice(0, 80)}
                message={t.message}
                tagKind={t.classification ? kindMap[t.classification] : undefined}
                upvotes={t.upvotes}
                status={t.status}
                createdAt={t.createdAt}
              />
            </Link>
          )
        })}
      </div>
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
