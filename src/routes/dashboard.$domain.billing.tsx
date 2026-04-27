import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'

import { Btn, Chip, Slab } from '#/components/ui/brut'
import { seoMeta } from '#/lib/seo'
import type { PlanId } from '#/lib/billing/plans'

// Shared sessionStorage key — set in /login when user arrives via the
// landing page "Upgrade to <plan>" CTA. Consumed + cleared here.
const PLAN_INTENT_KEY = 'fb:intended_plan'

// The Dodo plugin registers these endpoints under Better Auth's base
// path (/api/auth). Calling them directly avoids importing the Dodo
// client plugin, which would pull ~900kB of server code into this
// chunk because the package ships a single "." export.
async function createCheckoutSession(body: {
  slug: string
  referenceId: string
  metadata: Record<string, string>
}): Promise<{ url: string }> {
  const res = await fetch('/api/auth/dodopayments/checkout-session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      slug: body.slug,
      reference_id: body.referenceId,
      metadata: body.metadata,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(t || 'checkout failed')
  }
  return res.json()
}

async function openCustomerPortal(): Promise<{ url: string }> {
  const res = await fetch('/api/auth/dodopayments/customer/portal', {
    credentials: 'include',
  })
  if (!res.ok) {
    const t = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(t || 'portal unavailable')
  }
  return res.json()
}

type BillingSummary = {
  workspace_id: string
  plan: PlanId
  plan_label: string
  subscription_id: string | null
  subscription_status: string | null
  current_period_end: number | null
  billing_enabled: boolean
  entitlements: {
    monthly_ticket_cap: number
    hourly_burst: number
    max_seats: number
    max_integrations: number
    remove_branding: boolean
    sso_enabled: boolean
    audit_log_export: boolean
    api_access: boolean
  }
  usage: {
    monthly_tickets_used: number
    monthly_tickets_remaining: number
  }
}

type Tier = {
  id: PlanId
  slug: string | null
  label: string
  price: string | null
  blurb: string
  features: Array<string>
}

// Placeholder tiers. Swap slugs for the real product slugs once they're
// created in the Dodo Dashboard. Feature copy is descriptive only —
// nothing in this route enforces entitlements.
const TIERS: Array<Tier> = [
  {
    id: 'lite',
    slug: 'feedbackbot-lite',
    label: 'Lite',
    price: '$1 / mo',
    blurb: 'Hobby projects. Small enough to keep spam out.',
    features: [
      '100 tickets / month',
      '1 admin seat',
      '1 integration',
      'Public board',
    ],
  },
  {
    id: 'starter',
    slug: 'feedbackbot-starter',
    label: 'Starter',
    price: '$9 / mo',
    blurb: 'For indie makers and growing apps.',
    features: [
      '1,000 tickets / month',
      '3 admin seats',
      '2 integrations',
      'Custom domain, no watermark',
    ],
  },
  {
    id: 'scale',
    slug: 'feedbackbot-scale',
    label: 'Scale',
    price: '$29 / mo',
    blurb: 'For teams running real support.',
    features: [
      '10 admin seats',
      '10,000 tickets / month',
      'Unlimited webhooks + all PM integrations',
      'SSO, audit log, API access',
      'Priority support',
    ],
  },
]

export const Route = createFileRoute('/dashboard/$domain/billing')({
  component: BillingPage,
  head: ({ params }) => ({
    meta: seoMeta({
      path: `/dashboard/${params.domain}/billing`,
      title: `${params.domain} · billing`,
      noindex: true,
    }),
  }),
})

function BillingPage() {
  const { domain } = Route.useParams() as { domain: string }

  const summary = useQuery({
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

  const upgrade = useMutation({
    mutationFn: async ({ slug }: { slug: string }) => {
      if (!summary.data) throw new Error('summary not loaded')
      const { url } = await createCheckoutSession({
        slug,
        referenceId: summary.data.workspace_id,
        metadata: {
          workspace_id: summary.data.workspace_id,
          slug,
        },
      })
      window.location.href = url
    },
  })

  const portal = useMutation({
    mutationFn: async () => {
      const { url } = await openCustomerPortal()
      window.location.href = url
    },
  })

  const active = summary.data?.plan ?? 'free'
  const hasSub = !!summary.data?.subscription_id

  // If the user came from the landing page with an intended plan,
  // auto-fire the checkout once we know the workspace is ready and
  // still on the free tier. Run at most once per mount.
  const intentFiredRef = useRef(false)
  useEffect(() => {
    if (intentFiredRef.current) return
    if (!summary.data?.billing_enabled) return
    if (summary.data.plan !== 'free') return
    if (typeof window === 'undefined') return
    const intent = window.sessionStorage.getItem(PLAN_INTENT_KEY)
    if (!intent) return
    const tier = TIERS.find((t) => t.id === intent && t.slug)
    if (!tier?.slug) return
    intentFiredRef.current = true
    window.sessionStorage.removeItem(PLAN_INTENT_KEY)
    upgrade.mutate({ slug: tier.slug })
  }, [summary.data, upgrade])

  return (
    <div style={{ maxWidth: 960 }}>
      <Slab num="06" right={domain}>
        Billing
      </Slab>

      {summary.data && !summary.data.billing_enabled && (
        <div
          className="hi-card"
          style={{
            padding: 16,
            marginBottom: 20,
            borderColor: 'var(--warn, var(--border))',
            background: 'var(--surface-alt)',
          }}
        >
          Billing is not configured on this deployment. Set{' '}
          <code>DODO_PAYMENTS_API_KEY</code> and{' '}
          <code>DODO_PAYMENTS_WEBHOOK_SECRET</code> and redeploy.
        </div>
      )}

      {summary.data && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <Chip accent>current: {summary.data.plan_label}</Chip>
            {summary.data.subscription_status && (
              <Chip>{summary.data.subscription_status}</Chip>
            )}
            {summary.data.current_period_end && (
              <span
                className="h-mono"
                style={{ fontSize: 11, color: 'var(--fg-faint)' }}
              >
                renews{' '}
                {new Date(
                  summary.data.current_period_end,
                ).toLocaleDateString()}
              </span>
            )}
            {hasSub && summary.data.billing_enabled && (
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending ? 'Opening…' : 'Manage billing'}
              </Btn>
            )}
          </div>

          <UsageStrip data={summary.data} />
        </>
      )}

      {summary.isLoading && (
        <div style={{ color: 'var(--fg-mute)', fontSize: 13 }}>Loading…</div>
      )}
      {summary.error && (
        <div
          className="hi-card"
          style={{
            padding: 20,
            borderColor: 'var(--danger)',
            background: 'color-mix(in oklch, var(--danger) 8%, transparent)',
          }}
        >
          {(summary.error as Error).message}
        </div>
      )}

      {summary.data && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
            gap: 16,
          }}
        >
          {TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              active={tier.id === active}
              canUpgrade={
                !!summary.data?.billing_enabled && tier.id !== active
              }
              pending={
                upgrade.isPending && upgrade.variables?.slug === tier.slug
              }
              onUpgrade={() =>
                tier.slug && upgrade.mutate({ slug: tier.slug })
              }
            />
          ))}
        </div>
      )}

      {upgrade.error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: '1.5px solid var(--danger)',
            color: 'var(--danger)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          {(upgrade.error as Error).message}
        </div>
      )}
    </div>
  )
}

function UsageStrip({ data }: { data: BillingSummary }) {
  const cap = data.entitlements.monthly_ticket_cap
  const used = data.usage.monthly_tickets_used
  const pct = cap > 0 ? Math.min((used / cap) * 100, 100) : 0
  const danger = pct >= 90
  return (
    <div
      className="hi-card"
      style={{
        padding: 16,
        marginBottom: 24,
        display: 'grid',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div className="h-mono" style={{ fontSize: 12, color: 'var(--fg-mute)' }}>
          tickets this month
        </div>
        <div style={{ fontSize: 13 }}>
          <strong>{used.toLocaleString()}</strong>
          <span style={{ color: 'var(--fg-faint)' }}>
            {' '}
            / {cap.toLocaleString()}
          </span>
        </div>
      </div>
      <div
        style={{
          height: 6,
          background: 'var(--surface-alt)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: danger ? 'var(--danger)' : 'var(--accent)',
            transition: 'width .3s ease',
          }}
        />
      </div>
      <div
        className="h-mono"
        style={{ fontSize: 11, color: 'var(--fg-faint)' }}
      >
        seats {data.entitlements.max_seats} · integrations{' '}
        {data.entitlements.max_integrations === 100
          ? 'unlimited'
          : data.entitlements.max_integrations}
        {data.entitlements.sso_enabled ? ' · SSO' : ''}
        {data.entitlements.audit_log_export ? ' · audit export' : ''}
        {data.entitlements.api_access ? ' · API' : ''}
      </div>
    </div>
  )
}

function TierCard({
  tier,
  active,
  canUpgrade,
  pending,
  onUpgrade,
}: {
  tier: Tier
  active: boolean
  canUpgrade: boolean
  pending: boolean
  onUpgrade: () => void
}) {
  return (
    <div
      className="hi-card"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderColor: active ? 'var(--accent)' : undefined,
        background: active ? 'var(--surface-alt)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 18 }}>{tier.label}</strong>
        {active && <Chip>current</Chip>}
      </div>
      {tier.price && (
        <div
          className="h-display"
          style={{ fontSize: 22, lineHeight: 1, letterSpacing: '-0.01em' }}
        >
          {tier.price}
        </div>
      )}
      <p style={{ fontSize: 13, color: 'var(--fg-mute)', margin: 0 }}>
        {tier.blurb}
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flex: 1,
        }}
      >
        {tier.features.map((f) => (
          <li
            key={f}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
            }}
          >
            <Check size={12} strokeWidth={2.5} />
            {f}
          </li>
        ))}
      </ul>
      <div>
        {active ? (
          <Btn size="sm" variant="ghost" disabled>
            Current plan
          </Btn>
        ) : canUpgrade ? (
          <Btn
            size="sm"
            variant="primary"
            onClick={onUpgrade}
            disabled={pending}
          >
            {pending ? 'Redirecting…' : `Upgrade to ${tier.label}`}
          </Btn>
        ) : (
          <Btn size="sm" variant="ghost" disabled>
            Unavailable
          </Btn>
        )}
      </div>
    </div>
  )
}
