import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  RotateCw,
} from 'lucide-react'

import { Btn, Chip, Slab, Tag, type TagKind } from '#/components/ui/brut'
import type { ClassificationKind } from '#/schema/ticket'

type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'dead'

type DeliveryRow = {
  id: string
  integration: { id: string; kind: string; name: string } | null
  ticket: { id: string; message: string | null; classification: ClassificationKind | null }
  status: DeliveryStatus
  attempts: number
  last_error: string | null
  response_code: number | null
  request_body: string | null
  response_body: string | null
  created_at: number
  delivered_at: number | null
}

const FILTER_STATUSES: ReadonlyArray<{ v: '' | DeliveryStatus; label: string }> = [
  { v: '', label: 'all' },
  { v: 'delivered', label: 'delivered' },
  { v: 'failed', label: 'failed' },
  { v: 'dead', label: 'DLQ' },
  { v: 'pending', label: 'pending' },
]

const KIND_TAG: Partial<Record<ClassificationKind, TagKind>> = {
  bug: 'bug',
  feature: 'feat',
  query: 'query',
  spam: 'spam',
}

export const Route = createFileRoute('/dashboard/$domain/deliveries')({
  component: DeliveriesPage,
})

function DeliveriesPage() {
  const { domain } = Route.useParams() as { domain: string }
  const qc = useQueryClient()
  const [status, setStatus] = useState<'' | DeliveryStatus>('')

  const list = useQuery({
    queryKey: ['admin-deliveries', domain, status],
    queryFn: async () => {
      const qs = new URLSearchParams({ domain })
      if (status) qs.set('status', status)
      const res = await fetch(`/api/admin/deliveries?${qs}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { deliveries: Array<DeliveryRow> }
    },
  })

  const redrive = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await fetch('/api/admin/redrive', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain, ticket_id: ticketId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin-deliveries', domain] }),
  })

  const deliveries = list.data?.deliveries ?? []
  const counts = countByStatus(deliveries)

  return (
    <div style={{ maxWidth: 960 }}>
      <Slab num="05" right={domain}>
        Delivery log
      </Slab>

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        {FILTER_STATUSES.map((f) => (
          <button
            key={f.v || 'all'}
            onClick={() => setStatus(f.v)}
            className="hi-btn hi-btn-sm hi-focus"
            style={{
              background:
                status === f.v ? 'var(--accent)' : 'var(--surface)',
              color:
                status === f.v ? 'var(--accent-ink)' : 'var(--fg)',
              borderColor:
                status === f.v ? 'var(--accent-ink)' : 'var(--border)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              boxShadow: status === f.v ? '3px 3px 0 0 var(--accent-ink)' : '3px 3px 0 0 var(--border)',
            }}
          >
            {f.label}
            {f.v && counts[f.v] > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  color:
                    status === f.v ? 'var(--accent-ink)' : 'var(--fg-faint)',
                }}
              >
                {counts[f.v]}
              </span>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => list.refetch()}
          disabled={list.isFetching}
        >
          <RefreshCw
            size={12}
            strokeWidth={2}
            style={{
              transform: list.isFetching ? 'rotate(90deg)' : undefined,
              transition: 'transform .2s',
            }}
          />
          refresh
        </Btn>
      </div>

      {list.isLoading && (
        <div style={{ color: 'var(--fg-mute)', fontSize: 13 }}>Loading…</div>
      )}
      {list.error && (
        <div
          className="hi-card"
          style={{
            padding: 20,
            borderColor: 'var(--danger)',
            background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
          }}
        >
          {(list.error as Error).message}
        </div>
      )}
      {!list.isLoading && deliveries.length === 0 && (
        <div
          style={{
            padding: 16,
            border: '1.5px dashed var(--border-soft)',
            color: 'var(--fg-faint)',
            fontSize: 13,
          }}
        >
          No deliveries to show.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {deliveries.map((d) => (
          <DeliveryCard
            key={d.id}
            delivery={d}
            onRedrive={() => redrive.mutate(d.ticket.id)}
            redriving={
              redrive.isPending && redrive.variables === d.ticket.id
            }
          />
        ))}
      </div>
    </div>
  )
}

function DeliveryCard({
  delivery,
  onRedrive,
  redriving,
}: {
  delivery: DeliveryRow
  onRedrive: () => void
  redriving: boolean
}) {
  const [open, setOpen] = useState(false)
  const kindTag = delivery.ticket.classification
    ? KIND_TAG[delivery.ticket.classification]
    : undefined
  return (
    <div className="hi-card">
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: 14,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 10,
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <span style={{ color: 'var(--fg-mute)' }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 4,
            }}
          >
            <StatusChip status={delivery.status} />
            {kindTag && <Tag kind={kindTag} />}
            <Chip>{delivery.integration?.kind ?? 'unknown'}</Chip>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {delivery.integration?.name ?? '(deleted integration)'}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--fg-mute)',
              lineHeight: 1.4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
            }}
          >
            {delivery.ticket.message ?? '(ticket not found)'}
          </div>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              gap: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-faint)',
            }}
          >
            <span>{new Date(delivery.created_at).toLocaleString()}</span>
            <span>
              attempt #{delivery.attempts}
              {delivery.response_code ? ` · HTTP ${delivery.response_code}` : ''}
            </span>
          </div>
        </div>
        {(delivery.status === 'failed' || delivery.status === 'dead') && (
          <Btn
            size="sm"
            variant="default"
            onClick={(e) => {
              e.stopPropagation()
              onRedrive()
            }}
            disabled={redriving}
          >
            <RotateCw size={12} strokeWidth={2} />
            {redriving ? 'redriving…' : 'redrive'}
          </Btn>
        )}
      </div>
      {open && (
        <div
          style={{
            borderTop: '1.5px solid var(--border-soft)',
            padding: 14,
            background: 'var(--surface-alt)',
            display: 'grid',
            gap: 12,
          }}
        >
          {delivery.last_error && (
            <DetailBlock label="error" body={delivery.last_error} tone="err" />
          )}
          {delivery.request_body && (
            <DetailBlock label="request" body={delivery.request_body} />
          )}
          {delivery.response_body && (
            <DetailBlock label="response" body={delivery.response_body} />
          )}
          {!delivery.last_error &&
            !delivery.request_body &&
            !delivery.response_body && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--fg-faint)',
                }}
              >
                No stored request/response body for this delivery.
              </div>
            )}
        </div>
      )}
    </div>
  )
}

function DetailBlock({
  label,
  body,
  tone,
}: {
  label: string
  body: string
  tone?: 'err'
}) {
  return (
    <div>
      <div
        className="h-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: tone === 'err' ? 'var(--danger)' : 'var(--fg-mute)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <pre
        className="h-mono"
        style={{
          margin: 0,
          padding: 10,
          background: 'var(--surface)',
          border: '1.5px solid var(--border-soft)',
          fontSize: 12,
          lineHeight: 1.5,
          maxHeight: 240,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {body.length > 4000 ? `${body.slice(0, 4000)}…` : body}
      </pre>
    </div>
  )
}

function StatusChip({ status }: { status: DeliveryStatus }) {
  const color =
    status === 'delivered'
      ? 'var(--ok)'
      : status === 'failed'
        ? 'var(--danger)'
        : status === 'dead'
          ? 'var(--danger)'
          : 'var(--fg-mute)'
  return (
    <span
      className="h-mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        border: `1.5px solid ${color}`,
        color,
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontWeight: 600,
        background: `color-mix(in oklch, ${color} 10%, transparent)`,
      }}
    >
      {status === 'dead' ? 'DLQ' : status}
    </span>
  )
}

function countByStatus(rows: Array<DeliveryRow>): Record<DeliveryStatus, number> {
  const c: Record<DeliveryStatus, number> = {
    pending: 0,
    delivered: 0,
    failed: 0,
    dead: 0,
  }
  for (const r of rows) c[r.status]++
  return c
}
