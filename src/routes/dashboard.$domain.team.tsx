import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Trash2, X } from 'lucide-react'

import { Btn, Chip, Slab } from '#/components/ui/brut'
import { seoMeta } from '#/lib/seo'

type MembersResponse = {
  plan: string
  seats: { used: number; max: number }
  members: Array<{
    id: string
    user_id: string
    email: string | null
    name: string | null
    role: string
    created_at: number
  }>
  pending_invitations: Array<{
    id: string
    email: string
    role: string
    expires_at: number
  }>
}

export const Route = createFileRoute('/dashboard/$domain/team')({
  component: TeamPage,
  head: ({ params }) => ({
    meta: seoMeta({
      path: `/dashboard/${params.domain}/team`,
      title: `${params.domain} · team`,
      noindex: true,
    }),
  }),
})

function TeamPage() {
  const { domain } = Route.useParams() as { domain: string }
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ['admin-members', domain],
    queryFn: async (): Promise<MembersResponse> => {
      const res = await fetch(
        `/api/admin/members?domain=${encodeURIComponent(domain)}`,
        { credentials: 'include' },
      )
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `HTTP ${res.status}`)
      }
      return res.json()
    },
  })

  const invite = useMutation({
    mutationFn: async (vars: { email: string; role: 'member' | 'admin' }) => {
      const res = await fetch(
        `/api/admin/members?domain=${encodeURIComponent(domain)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(vars),
        },
      )
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin-members', domain] }),
  })

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(
        `/api/admin/members/${memberId}?domain=${encodeURIComponent(domain)}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin-members', domain] }),
  })

  const cancelInvite = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(
        `/api/admin/invitations/${invitationId}?domain=${encodeURIComponent(domain)}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin-members', domain] }),
  })

  return (
    <div style={{ maxWidth: 720 }}>
      <Slab num="07" right={domain}>
        Team
      </Slab>

      {list.isLoading && (
        <div style={{ color: 'var(--fg-mute)' }}>Loading…</div>
      )}
      {list.error && <ErrBox msg={(list.error as Error).message} />}

      {list.data && (
        <>
          <SeatStrip data={list.data} />

          <div style={{ marginTop: 24 }}>
            <InviteForm
              data={list.data}
              submit={(vars) => invite.mutate(vars)}
              pending={invite.isPending}
              error={(invite.error as Error | null)?.message ?? null}
              onClearError={() => invite.reset()}
            />
          </div>

          <div style={{ marginTop: 32 }}>
            <h2
              className="h-mono"
              style={{
                fontSize: 12,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--fg-mute)',
                margin: '0 0 12px',
              }}
            >
              Members ({list.data.members.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.data.members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  onRemove={() => removeMember.mutate(m.id)}
                  removing={
                    removeMember.isPending &&
                    removeMember.variables === m.id
                  }
                />
              ))}
            </div>
          </div>

          {list.data.pending_invitations.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h2
                className="h-mono"
                style={{
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-mute)',
                  margin: '0 0 12px',
                }}
              >
                Pending invitations ({list.data.pending_invitations.length})
              </h2>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                {list.data.pending_invitations.map((inv) => (
                  <InviteRow
                    key={inv.id}
                    inv={inv}
                    onCancel={() => cancelInvite.mutate(inv.id)}
                    canceling={
                      cancelInvite.isPending &&
                      cancelInvite.variables === inv.id
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SeatStrip({ data }: { data: MembersResponse }) {
  const pct = Math.min((data.seats.used / data.seats.max) * 100, 100)
  const full = data.seats.used >= data.seats.max
  return (
    <div className="hi-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
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
          seats · {data.plan}
        </div>
        <div style={{ fontSize: 13 }}>
          <strong>{data.seats.used}</strong>
          <span style={{ color: 'var(--fg-faint)' }}> / {data.seats.max}</span>
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
            background: full ? 'var(--danger)' : 'var(--accent)',
            transition: 'width .3s ease',
          }}
        />
      </div>
    </div>
  )
}

function InviteForm({
  data,
  submit,
  pending,
  error,
  onClearError,
}: {
  data: MembersResponse
  submit: (vars: { email: string; role: 'member' | 'admin' }) => void
  pending: boolean
  error: string | null
  onClearError: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const full = data.seats.used >= data.seats.max
  return (
    <div>
      <h2
        className="h-mono"
        style={{
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--fg-mute)',
          margin: '0 0 12px',
        }}
      >
        Invite a teammate
      </h2>
      {full ? (
        <div
          className="hi-card"
          style={{
            padding: 14,
            background: 'var(--surface-alt)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          You're at the seat cap for the <strong>{data.plan}</strong> plan
          ({data.seats.max} seat{data.seats.max === 1 ? '' : 's'}).
          Upgrade or remove a member to free a seat.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onClearError()
            submit({ email, role })
            setEmail('')
          }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="teammate@example.com"
            required
            autoComplete="email"
            className="hi-focus"
            style={{
              flex: 1,
              minWidth: 220,
              padding: '8px 10px',
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--fg)',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.currentTarget.value as 'member' | 'admin')}
            className="hi-focus"
            style={{
              padding: '8px 10px',
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--fg)',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Btn variant="primary" disabled={pending || !email}>
            <Mail size={12} strokeWidth={2} />
            {pending ? 'Sending…' : 'Send invite'}
          </Btn>
        </form>
      )}
      {error && <ErrBox msg={error} />}
    </div>
  )
}

function MemberRow({
  member,
  onRemove,
  removing,
}: {
  member: MembersResponse['members'][number]
  onRemove: () => void
  removing: boolean
}) {
  const isOwner = member.role === 'owner'
  return (
    <div
      className="hi-card"
      style={{
        padding: '10px 14px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {member.email ?? member.user_id}
        </div>
        {member.name && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--fg-mute)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {member.name}
          </div>
        )}
      </div>
      <Chip>{member.role}</Chip>
      {isOwner ? (
        <span
          className="h-mono"
          style={{ fontSize: 11, color: 'var(--fg-faint)', padding: '4px 8px' }}
        >
          —
        </span>
      ) : (
        <Btn
          size="sm"
          variant="ghost"
          onClick={onRemove}
          disabled={removing}
        >
          <Trash2 size={12} strokeWidth={2} />
          {removing ? 'Removing…' : 'Remove'}
        </Btn>
      )}
    </div>
  )
}

function InviteRow({
  inv,
  onCancel,
  canceling,
}: {
  inv: MembersResponse['pending_invitations'][number]
  onCancel: () => void
  canceling: boolean
}) {
  return (
    <div
      className="hi-card"
      style={{
        padding: '10px 14px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
        gap: 12,
        alignItems: 'center',
        borderStyle: 'dashed',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {inv.email}
        </div>
        <div
          className="h-mono"
          style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 2 }}
        >
          expires {new Date(inv.expires_at).toLocaleDateString()}
        </div>
      </div>
      <Chip>{inv.role}</Chip>
      <Btn size="sm" variant="ghost" onClick={onCancel} disabled={canceling}>
        <X size={12} strokeWidth={2} />
        {canceling ? 'Cancelling…' : 'Cancel'}
      </Btn>
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
