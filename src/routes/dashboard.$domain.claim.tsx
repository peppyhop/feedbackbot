import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Copy } from 'lucide-react'

import { Btn, Chip, Slab } from '#/components/ui/brut'
import type { WorkspaceStateResponse } from '#/schema/claim'

export const Route = createFileRoute('/dashboard/$domain/claim')({
  component: ClaimPage,
})

function ClaimPage() {
  const { domain } = Route.useParams() as { domain: string }
  const state = useQuery({
    queryKey: ['workspace-state', domain],
    queryFn: async (): Promise<WorkspaceStateResponse> => {
      const res = await fetch(
        `/api/workspace-state?domain=${encodeURIComponent(domain)}`,
        { credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
  })

  const verify = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/verify-domain', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<{
        verified: boolean
        checked_record: string
        found_values: Array<string>
      }>
    },
    onSuccess: () => state.refetch(),
  })

  return (
    <div style={{ maxWidth: 800 }}>
      <Slab num="—" right={domain}>
        Re-verify domain
      </Slab>
      <p style={{ fontSize: 16, color: 'var(--fg-mute)', marginBottom: 32 }}>
        New workspaces verify their domain during onboarding. Use this
        page to re-verify if you rotated DNS records, lost the TXT
        entry, or need to add an additional verification path.
      </p>

      {state.isLoading && <div>Loading…</div>}
      {state.data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <DnsCard
            recordName={state.data.claim_paths.dns_txt.record_name}
            recordValue={state.data.claim_paths.dns_txt.record_value}
            verified={state.data.claim_paths.dns_txt.verified}
            onVerify={() => verify.mutate()}
            pending={verify.isPending}
            lastCheck={verify.data}
          />
          <EmailCard
            available={state.data.claim_paths.email_match.available}
            reason={state.data.claim_paths.email_match.reason}
          />
          <div
            className="h-mono"
            style={{
              fontSize: 11,
              color: 'var(--fg-faint)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            workspace state: {state.data.workspace.state} · tickets:{' '}
            {state.data.workspace.ticket_count}
          </div>
        </div>
      )}
    </div>
  )
}

function DnsCard({
  recordName,
  recordValue,
  verified,
  onVerify,
  pending,
  lastCheck,
}: {
  recordName: string
  recordValue: string
  verified: boolean
  onVerify: () => void
  pending: boolean
  lastCheck: { verified: boolean; found_values: Array<string> } | undefined
}) {
  const [copied, setCopied] = useState<'name' | 'value' | null>(null)
  const copy = async (which: 'name' | 'value', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
    setCopied(which)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div className="hi-card hi-card-raised" style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Chip accent>path 1</Chip>
        <strong style={{ fontSize: 18 }}>DNS TXT record</strong>
        {verified && (
          <Chip>
            <Check size={11} /> verified
          </Chip>
        )}
      </div>
      <p style={{ fontSize: 14, color: 'var(--fg-mute)', marginBottom: 14 }}>
        Add this TXT record at your DNS provider. Propagates usually within
        a minute; we verify via Cloudflare's DoH resolver.
      </p>
      <RecordRow
        label="name"
        value={recordName}
        copied={copied === 'name'}
        onCopy={() => copy('name', recordName)}
      />
      <div style={{ height: 10 }} />
      <RecordRow
        label="value"
        value={recordValue}
        copied={copied === 'value'}
        onCopy={() => copy('value', recordValue)}
      />
      <div
        style={{
          marginTop: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Btn variant="primary" onClick={onVerify} disabled={pending}>
          {pending ? 'Verifying…' : 'Verify now'}
        </Btn>
        {lastCheck && (
          <span
            className="h-mono"
            style={{ fontSize: 12, color: 'var(--fg-mute)' }}
          >
            {lastCheck.verified
              ? '✓ verified'
              : `not found · saw: ${lastCheck.found_values.join(', ') || '(none)'}`}
          </span>
        )}
      </div>
    </div>
  )
}

function RecordRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(60px, max-content) minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 10,
        border: '1.5px solid var(--border)',
        padding: '8px 10px',
        background: 'var(--surface)',
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
        {label}
      </span>
      <code
        className="h-mono"
        style={{
          fontSize: 13,
          color: 'var(--fg)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </code>
      <Btn size="sm" variant="ghost" onClick={onCopy}>
        {copied ? (
          <>
            <Check size={12} /> copied
          </>
        ) : (
          <>
            <Copy size={12} /> copy
          </>
        )}
      </Btn>
    </div>
  )
}

function EmailCard({
  available,
  reason,
}: {
  available: boolean
  reason?: string
}) {
  return (
    <div
      className="hi-card"
      style={{
        padding: 24,
        opacity: available ? 1 : 0.7,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Chip accent>path 2</Chip>
        <strong style={{ fontSize: 18 }}>Email on matching domain</strong>
        {available && <Chip>available</Chip>}
      </div>
      <p style={{ fontSize: 14, color: 'var(--fg-mute)' }}>
        If you're signed in with an email on this domain, we can promote you
        to owner directly. Freemail and EDU/GOV domains are blocked from
        this path.
      </p>
      {!available && reason && (
        <div
          style={{
            marginTop: 14,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--fg-faint)',
          }}
        >
          not available: {reason}
        </div>
      )}
    </div>
  )
}
