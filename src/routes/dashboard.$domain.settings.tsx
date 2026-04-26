import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'

import { Btn, Chip, Slab } from '#/components/ui/brut'

type BillingSummary = {
  plan: 'free' | 'lite' | 'starter' | 'scale'
  entitlements: {
    audit_log_export: boolean
    api_access: boolean
    sso_enabled: boolean
  }
}

export const Route = createFileRoute('/dashboard/$domain/settings')({
  component: Settings,
})

function Settings() {
  const { domain } = Route.useParams() as { domain: string }

  const billing = useQuery({
    queryKey: ['billing-summary', domain],
    queryFn: async (): Promise<BillingSummary> => {
      const res = await fetch(
        `/api/admin/billing-summary?domain=${encodeURIComponent(domain)}`,
        { credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
  })

  const ent = billing.data?.entitlements

  return (
    <div style={{ maxWidth: 720 }}>
      <Slab num="04" right={domain}>
        Settings
      </Slab>
      <p style={{ color: 'var(--fg-mute)', fontSize: 14, marginBottom: 24 }}>
        Workspace-level settings. More controls — public-board
        visibility, data retention, transfer-ownership, deletion —
        coming as we need them.
      </p>

      <Section title="Audit log">
        <p style={{ fontSize: 13, color: 'var(--fg-mute)', margin: 0 }}>
          Every workspace mutation (claim, integration change, etc.) is
          recorded with actor + IP hash + timestamp. Scale-tier
          workspaces can export the full log as CSV.
        </p>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {ent?.audit_log_export ? (
            <Btn
              as="a"
              href={`/api/admin/audit-log?domain=${encodeURIComponent(domain)}&format=csv`}
              variant="primary"
              size="sm"
            >
              <Download size={12} strokeWidth={2} /> Export CSV
            </Btn>
          ) : (
            <>
              <Btn size="sm" variant="ghost" disabled>
                <Download size={12} strokeWidth={2} /> Export CSV
              </Btn>
              <Chip>Scale plan</Chip>
              <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>
                Available on Scale.
              </span>
            </>
          )}
        </div>
      </Section>

      <Section title="API access">
        <p style={{ fontSize: 13, color: 'var(--fg-mute)', margin: 0 }}>
          Programmatic access for ticket queries, integrations, and
          delivery logs.
        </p>
        <div style={{ marginTop: 14 }}>
          <Chip>{ent?.api_access ? 'Enabled (Scale)' : 'Scale plan'}</Chip>
          {!ent?.api_access && (
            <span
              style={{ marginLeft: 10, fontSize: 12, color: 'var(--fg-faint)' }}
            >
              Coming soon.
            </span>
          )}
        </div>
      </Section>

      <Section title="SSO">
        <p style={{ fontSize: 13, color: 'var(--fg-mute)', margin: 0 }}>
          Sign-in via your identity provider (SAML / OIDC).
        </p>
        <div style={{ marginTop: 14 }}>
          <Chip>{ent?.sso_enabled ? 'Enabled (Scale)' : 'Scale plan'}</Chip>
          {!ent?.sso_enabled && (
            <span
              style={{ marginLeft: 10, fontSize: 12, color: 'var(--fg-faint)' }}
            >
              Coming soon.
            </span>
          )}
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="hi-card"
      style={{
        padding: 18,
        marginBottom: 16,
      }}
    >
      <h2
        className="h-mono"
        style={{
          margin: '0 0 10px',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--fg-mute)',
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  )
}
