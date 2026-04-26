import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

import { Chip, LogoMark, Tag } from '#/components/ui/brut'
import { ThemeToggle } from '#/components/theme-toggle'
import { seoMeta } from '#/lib/seo'

export const Route = createFileRoute('/dashboard/$domain')({
  component: DashboardLayout,
  head: ({ params }) => ({
    meta: seoMeta({
      path: `/dashboard/${params.domain}`,
      title: `${params.domain} · dashboard`,
      noindex: true,
    }),
  }),
})

function DashboardLayout() {
  const { domain } = Route.useParams() as { domain: string }
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '240px 1fr' }}>
      <aside
        style={{
          borderRight: '1.5px solid var(--border)',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <LogoMark size={26} />
          <div style={{ flex: 1 }}>
            <div
              className="h-mono"
              style={{
                fontSize: 10,
                color: 'var(--fg-faint)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              workspace
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{domain}</div>
          </div>
        </div>

        <SidebarLink to={`/dashboard/${domain}`}>Tickets</SidebarLink>
        <SidebarLink to={`/dashboard/${domain}/claim`}>Claim</SidebarLink>
        <SidebarLink to={`/dashboard/${domain}/integrations`}>
          Integrations
        </SidebarLink>
        <SidebarLink to={`/dashboard/${domain}/deliveries`}>
          Deliveries
        </SidebarLink>
        <SidebarLink to={`/dashboard/${domain}/team`}>Team</SidebarLink>
        <SidebarLink to={`/dashboard/${domain}/billing`}>Billing</SidebarLink>
        <SidebarLink to={`/dashboard/${domain}/settings`}>Settings</SidebarLink>

        <div style={{ flex: 1 }} />

        <Link
          to="/b/$domain"
          params={{ domain }}
          className="h-mono"
          style={{
            fontSize: 11,
            color: 'var(--fg-faint)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          view public board →
        </Link>
        <div style={{ height: 8 }} />
        <ThemeToggle />
      </aside>

      <main style={{ padding: 32, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

function SidebarLink({
  to,
  children,
}: {
  to: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={to as never}
      activeOptions={{ exact: true }}
      className="hi-focus"
      style={{
        padding: '8px 10px',
        border: '1.5px solid transparent',
        fontSize: 14,
        fontWeight: 500,
      }}
      activeProps={{
        style: {
          padding: '8px 10px',
          border: '1.5px solid var(--border)',
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          fontSize: 14,
          fontWeight: 600,
        },
      }}
    >
      {children}
    </Link>
  )
}

// Shared ticket card styling — used by index + (future) detail page.
export function AdminTicketRow({
  title,
  message,
  tagKind,
  upvotes,
  status,
  createdAt,
}: {
  title: string
  message: string
  tagKind?: 'bug' | 'feat' | 'query' | 'spam'
  upvotes: number
  status: string
  createdAt: number
}) {
  return (
    <div
      className="hi-card"
      style={{
        padding: 16,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--fg-mute)',
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          {message.slice(0, 180)}
          {message.length > 180 ? '…' : ''}
        </div>
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
          <Chip>{status}</Chip>
          <span
            className="h-mono"
            style={{ fontSize: 11, color: 'var(--fg-faint)' }}
          >
            {new Date(createdAt).toLocaleString()}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="h-display" style={{ fontSize: 24, lineHeight: 1 }}>
          {upvotes}
        </div>
        <div
          className="h-mono"
          style={{
            fontSize: 10,
            color: 'var(--fg-faint)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          upvotes
        </div>
      </div>
    </div>
  )
}
