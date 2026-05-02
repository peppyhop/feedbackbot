import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react'
import { z } from 'zod'

import { Btn, Chip, Slab } from '#/components/ui/brut'
import type { IntegrationCreate } from '#/schema/integration'

const searchSchema = z
  .object({
    slack: z.enum(['installed', 'error']).optional(),
    reason: z.string().optional(),
    integration: z.string().optional(),
  })
  .partial()

type IntegrationRow = {
  id: string
  kind: 'webhook' | 'slack'
  name: string
  enabled: boolean
  createdAt: number
}

type TicketKind = 'bug' | 'feature' | 'query'

type SlackChannel = {
  id: string
  name: string
  is_private: boolean
  is_member: boolean
}

type RouteRow = {
  id: string
  ticket_type: TicketKind
  config: { channel_id?: string; channel_name?: string } & Record<string, unknown>
  enabled: boolean
}

// Shared route-list query so the two callers (the inline route
// editor + the SlackRoutesEditor below) don't drift on cache key
// shape or fetch options.
function useIntegrationRoutes(integrationId: string, domain: string) {
  return useQuery({
    queryKey: ['integration-routes', integrationId, domain],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/integrations/${encodeURIComponent(integrationId)}/routes?domain=${encodeURIComponent(domain)}`,
        { credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { routes: Array<RouteRow> }
    },
  })
}

export const Route = createFileRoute('/dashboard/$domain/integrations')({
  component: IntegrationsPage,
  validateSearch: (input) => searchSchema.parse(input),
})

function IntegrationsPage() {
  const { domain } = Route.useParams() as { domain: string }
  const search = useSearch({ from: '/dashboard/$domain/integrations' })
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ['admin-integrations', domain],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/integrations?domain=${encodeURIComponent(domain)}`,
        { credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { integrations: Array<IntegrationRow> }
    },
  })

  const create = useMutation({
    mutationFn: async (body: IntegrationCreate) => {
      const res = await fetch(
        `/api/admin/integrations?domain=${encodeURIComponent(domain)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin-integrations', domain] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/admin/integrations/${encodeURIComponent(id)}?domain=${encodeURIComponent(domain)}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin-integrations', domain] }),
  })

  // If we just completed a Slack install, auto-open that integration's
  // route editor so the admin can pick channels immediately.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  useEffect(() => {
    if (search.slack === 'installed' && search.integration) {
      setExpandedId(search.integration)
    }
  }, [search.slack, search.integration])

  return (
    <div style={{ maxWidth: 840 }}>
      <Slab num="03" right={domain}>
        Integrations
      </Slab>

      {search.slack === 'installed' && (
        <InstallBanner
          tone="ok"
          message="Slack installed. Pick which ticket types post to which channels below."
        />
      )}
      {search.slack === 'error' && (
        <InstallBanner
          tone="err"
          message={`Slack install failed${search.reason ? `: ${search.reason}` : '.'}`}
        />
      )}

      <SlackInstallCard domain={domain} />
      <WebhookForm
        onSubmit={(body) => create.mutate(body)}
        pending={create.isPending}
        errorMessage={create.error ? (create.error as Error).message : undefined}
      />

      <div style={{ marginTop: 28 }}>
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
          Configured
        </div>
        {list.isLoading && (
          <div style={{ color: 'var(--fg-mute)', fontSize: 13 }}>Loading…</div>
        )}
        {list.data?.integrations.length === 0 && (
          <div
            style={{
              padding: 16,
              border: '1.5px dashed var(--border-soft)',
              color: 'var(--fg-faint)',
              fontSize: 13,
            }}
          >
            None yet. Add a webhook above or install Slack.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.data?.integrations.map((i) => (
            <IntegrationCard
              key={i.id}
              integration={i}
              domain={domain}
              expanded={expandedId === i.id}
              onToggle={() => setExpandedId(expandedId === i.id ? null : i.id)}
              onDelete={() => {
                if (confirm(`Delete integration "${i.name}"?`)) remove.mutate(i.id)
              }}
              deleting={remove.isPending}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function IntegrationCard({
  integration,
  domain,
  expanded,
  onToggle,
  onDelete,
  deleting,
}: {
  integration: IntegrationRow
  domain: string
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="hi-card">
      <div
        style={{
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 10,
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <span style={{ color: 'var(--fg-mute)' }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {integration.name}
          </div>
          <div
            style={{
              marginTop: 4,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Chip>{integration.kind}</Chip>
            <Chip>{integration.enabled ? 'enabled' : 'disabled'}</Chip>
            <span
              className="h-mono"
              style={{ fontSize: 11, color: 'var(--fg-faint)' }}
            >
              {new Date(integration.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
        <Btn
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          disabled={deleting}
        >
          <Trash2 size={12} /> delete
        </Btn>
      </div>
      {expanded && (
        <div
          style={{
            borderTop: '1.5px solid var(--border-soft)',
            padding: 16,
            background: 'var(--surface-alt)',
          }}
        >
          {integration.kind === 'slack' ? (
            <SlackRoutesEditor
              integrationId={integration.id}
              domain={domain}
            />
          ) : (
            <WebhookEditor
              integrationId={integration.id}
              domain={domain}
            />
          )}
        </div>
      )}
    </div>
  )
}

const TICKET_KINDS: ReadonlyArray<TicketKind> = ['bug', 'feature', 'query']

function SlackRoutesEditor({
  integrationId,
  domain,
}: {
  integrationId: string
  domain: string
}) {
  const qc = useQueryClient()

  const channels = useQuery({
    queryKey: ['slack-channels', integrationId, domain],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/integrations/${encodeURIComponent(integrationId)}/slack-channels?domain=${encodeURIComponent(domain)}`,
        { credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { channels: Array<SlackChannel> }
    },
  })

  const routes = useIntegrationRoutes(integrationId, domain)

  const [draft, setDraft] = useState<Record<TicketKind, string>>({
    bug: '',
    feature: '',
    query: '',
  })

  // Seed draft once routes load.
  useEffect(() => {
    if (!routes.data) return
    const next: Record<TicketKind, string> = { bug: '', feature: '', query: '' }
    for (const r of routes.data.routes) {
      if (r.ticket_type in next && r.config.channel_id) {
        next[r.ticket_type] = r.config.channel_id
      }
    }
    setDraft(next)
  }, [routes.data])

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        routes: TICKET_KINDS.filter((k) => draft[k]).map((k) => {
          const ch = channels.data?.channels.find((c) => c.id === draft[k])
          return {
            ticket_type: k,
            config: {
              channel_id: draft[k],
              channel_name: ch?.name,
            },
          }
        }),
      }
      const res = await fetch(
        `/api/admin/integrations/${encodeURIComponent(integrationId)}/routes?domain=${encodeURIComponent(domain)}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['integration-routes', integrationId, domain],
      }),
  })

  if (channels.isLoading || routes.isLoading) {
    return (
      <div className="h-mono" style={{ fontSize: 12, color: 'var(--fg-mute)' }}>
        Loading channels…
      </div>
    )
  }
  if (channels.error) {
    return (
      <div style={{ color: 'var(--danger)', fontSize: 13 }}>
        Couldn't load Slack channels: {(channels.error as Error).message}
      </div>
    )
  }

  const channelList = channels.data?.channels ?? []

  return (
    <div>
      <div
        className="h-mono"
        style={{
          fontSize: 11,
          color: 'var(--fg-mute)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Route by ticket type ({channelList.length} channel
        {channelList.length === 1 ? '' : 's'} available)
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {TICKET_KINDS.map((kind) => (
          <div
            key={kind}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(60px, max-content) minmax(0, 1fr)',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              className="h-mono"
              style={{
                fontSize: 12,
                color: 'var(--fg-mute)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {kind}
            </span>
            <select
              value={draft[kind]}
              onChange={(e) => setDraft({ ...draft, [kind]: e.target.value })}
              style={{
                width: '100%',
                border: '1.5px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--fg)',
                padding: '8px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="">— don't deliver —</option>
              {channelList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.is_private ? '🔒' : '#'}
                  {c.name}
                  {!c.is_member ? ' (not a member)' : ''}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Btn
          size="sm"
          variant="primary"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save routes'}
        </Btn>
        {save.isSuccess && (
          <span
            className="h-mono"
            style={{ fontSize: 11, color: 'var(--ok)' }}
          >
            ✓ saved
          </span>
        )}
        {save.error && (
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>
            {(save.error as Error).message}
          </span>
        )}
        <span
          className="h-mono"
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            marginLeft: 'auto',
          }}
        >
          private channels: invite the bot with /invite @FeedbackBot
        </span>
      </div>
    </div>
  )
}

function WebhookEditor({
  integrationId,
  domain,
}: {
  integrationId: string
  domain: string
}) {
  const qc = useQueryClient()
  const routes = useIntegrationRoutes(integrationId, domain)
  const [draft, setDraft] = useState<Record<TicketKind, boolean>>({
    bug: false,
    feature: false,
    query: false,
  })
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (!routes.data || hydrated) return
    const next: Record<TicketKind, boolean> = { bug: false, feature: false, query: false }
    for (const r of routes.data.routes) {
      if (r.enabled && (r.ticket_type === 'bug' || r.ticket_type === 'feature' || r.ticket_type === 'query')) {
        next[r.ticket_type] = true
      }
    }
    setDraft(next)
    setHydrated(true)
  }, [routes.data, hydrated])

  // PUT all routes — server replaces the full set, so we send what
  // we want enabled + omit the rest.
  const saveRoutes = useMutation({
    mutationFn: async (next: Record<TicketKind, boolean>) => {
      const desired = TICKET_KINDS.filter((k) => next[k]).map((k) => ({
        ticket_type: k,
        config: {},
      }))
      const res = await fetch(
        `/api/admin/integrations/${integrationId}/routes?domain=${encodeURIComponent(domain)}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ routes: desired }),
        },
      )
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration-routes', integrationId, domain] })
    },
  })

  const setKind = (k: TicketKind, on: boolean) => {
    const next = { ...draft, [k]: on }
    setDraft(next)
    saveRoutes.mutate(next)
  }

  // POST /test-send: drives the existing dispatcher with a synthetic
  // payload and surfaces the response code/body inline.
  const [testResult, setTestResult] = useState<
    | null
    | {
        ok: boolean
        response_code: number | null
        response_body: string | null
        error: string | null
      }
  >(null)
  const testSend = useMutation({
    mutationFn: async () => {
      setTestResult(null)
      const res = await fetch(
        `/api/admin/integrations/${integrationId}/test-send?domain=${encodeURIComponent(domain)}`,
        { method: 'POST', credentials: 'include' },
      )
      const body = (await res.json()) as {
        ok?: boolean
        response_code?: number | null
        response_body?: string | null
        error?: string | null
      }
      if (!res.ok && !('ok' in body)) {
        throw new Error(`HTTP ${res.status}`)
      }
      return body as {
        ok: boolean
        response_code: number | null
        response_body: string | null
        error: string | null
      }
    },
    onSuccess: (data) => setTestResult(data),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div
          className="h-mono"
          style={{
            fontSize: 11,
            color: 'var(--fg-mute)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Routes
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TICKET_KINDS.map((k) => (
            <label
              key={k}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                border: '1.5px solid var(--border)',
                background: draft[k] ? 'var(--accent)' : 'transparent',
                color: draft[k] ? 'var(--accent-ink)' : 'var(--fg)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={draft[k]}
                onChange={(e) =>
                  setKind(k, (e.currentTarget as HTMLInputElement).checked)
                }
                style={{ display: 'none' }}
              />
              {draft[k] ? '✓' : '○'} {k}
            </label>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-faint)', marginTop: 6 }}>
          Tickets matching the selected types fire this webhook. Saved
          automatically when you toggle.
        </div>
      </div>

      <div>
        <div
          className="h-mono"
          style={{
            fontSize: 11,
            color: 'var(--fg-mute)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Test delivery
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Btn
            size="sm"
            variant="primary"
            onClick={() => testSend.mutate()}
            disabled={testSend.isPending}
          >
            {testSend.isPending ? 'Sending…' : 'Send test event'}
          </Btn>
          {testResult && (
            <span
              className="h-mono"
              style={{
                fontSize: 12,
                color: testResult.ok ? 'var(--ok)' : 'var(--danger)',
              }}
            >
              {testResult.ok ? '✓' : '✗'}{' '}
              {testResult.response_code ?? testResult.error ?? 'no response'}
            </span>
          )}
        </div>
        {testResult && testResult.response_body && (
          <pre
            style={{
              marginTop: 8,
              padding: 8,
              border: '1.5px solid var(--border-soft)',
              background: 'var(--surface)',
              fontSize: 11,
              maxHeight: 120,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {testResult.response_body}
          </pre>
        )}
        {testSend.error && (
          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>
            {(testSend.error as Error).message}
          </div>
        )}
      </div>

      <details
        style={{
          fontSize: 13,
          color: 'var(--fg-mute)',
          padding: 8,
          border: '1.5px solid var(--border-soft)',
        }}
      >
        <summary style={{ cursor: 'pointer' }}>
          How to verify the signature on your side
        </summary>
        <pre
          style={{
            marginTop: 8,
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >{`# Headers we send on every delivery:
#   x-feedback-signature: sha256=<hex>
#   x-feedback-timestamp: <unix-seconds>
# Body: JSON OutboundTicketPayload

# Verify in pseudo-code:
sig    = request.headers["x-feedback-signature"].split("=", 1)[1]
ts     = request.headers["x-feedback-timestamp"]
body   = request.raw_body
expect = hmac_sha256_hex(WEBHOOK_SECRET, ts + "." + body)
if not constant_time_eq(sig, expect): reject 401
if abs(now() - int(ts)) > 300: reject 401  # replay window`}</pre>
      </details>
    </div>
  )
}

function InstallBanner({ tone, message }: { tone: 'ok' | 'err'; message: string }) {
  return (
    <div
      className="hi-card"
      style={{
        padding: 12,
        marginBottom: 20,
        borderColor: tone === 'ok' ? 'var(--ok)' : 'var(--danger)',
        background:
          tone === 'ok'
            ? 'color-mix(in oklch, var(--ok) 8%, transparent)'
            : 'color-mix(in oklch, var(--danger) 8%, transparent)',
        fontSize: 14,
      }}
    >
      {message}
    </div>
  )
}

function SlackInstallCard({ domain }: { domain: string }) {
  return (
    <div
      className="hi-card hi-card-raised"
      style={{ padding: 20, marginBottom: 20 }}
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
        Slack
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            Post tickets to a Slack channel
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-mute)', lineHeight: 1.5 }}>
            One-click install via Slack OAuth. You'll pick the channel per
            ticket type after install.
          </div>
        </div>
        <Btn
          as="a"
          href={`/api/integrations/slack/install?domain=${encodeURIComponent(domain)}`}
          variant="primary"
          size="sm"
        >
          Install Slack <ExternalLink size={12} strokeWidth={2} />
        </Btn>
      </div>
    </div>
  )
}

function WebhookForm({
  onSubmit,
  pending,
  errorMessage,
}: {
  onSubmit: (body: IntegrationCreate) => void
  pending: boolean
  errorMessage?: string
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [kinds, setKinds] = useState<Record<TicketKind, boolean>>({
    bug: true,
    feature: true,
    query: false,
  })

  const submit = () => {
    if (!name.trim() || !url.trim() || secret.length < 16) return
    onSubmit({
      name: name.trim(),
      creds: { kind: 'webhook', url, hmac_secret: secret },
      routes: TICKET_KINDS.filter((k) => kinds[k]).map((k) => ({
        ticket_type: k,
        config: {},
      })),
    })
    setName('')
    setUrl('')
    setSecret('')
  }

  const canSubmit =
    name.trim().length > 0 && url.trim().length > 0 && secret.length >= 16

  return (
    <div className="hi-card hi-card-raised" style={{ padding: 20 }}>
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
        Add a signed webhook
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Engineering relay"
            style={fieldStyle}
          />
        </Field>
        <Field label="url">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.example.com/feedback"
            style={{ ...fieldStyle, fontFamily: 'var(--font-mono)' }}
          />
        </Field>
        <Field label="hmac secret">
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="≥ 16 chars"
            type="password"
            style={{ ...fieldStyle, fontFamily: 'var(--font-mono)' }}
          />
        </Field>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span
            className="h-mono"
            style={{
              fontSize: 11,
              color: 'var(--fg-faint)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            deliver
          </span>
          {TICKET_KINDS.map((k) => (
            <label
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={kinds[k]}
                onChange={(e) =>
                  setKinds({ ...kinds, [k]: e.currentTarget.checked })
                }
              />
              {k}
            </label>
          ))}
        </div>
        {errorMessage && (
          <div style={{ color: 'var(--danger)', fontSize: 13 }}>
            {errorMessage}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn
            variant="primary"
            onClick={submit}
            disabled={!canSubmit || pending}
          >
            {pending ? 'Adding…' : 'Add webhook'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid var(--border)',
  background: 'var(--surface)',
  padding: '8px 10px',
  fontSize: 14,
  outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span
        className="h-mono"
        style={{
          fontSize: 11,
          color: 'var(--fg-faint)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
