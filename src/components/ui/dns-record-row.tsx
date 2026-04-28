// Copy-able key/value row used by both onboarding and the
// reverify-domain page to surface the DNS TXT record name + value.
// Same visual + interaction in both places — extracted so changes
// to the brut card style ship to both screens at once.

import { Check, Copy } from 'lucide-react'

import { Btn } from '#/components/ui/brut'

export function DnsRecordRow({
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
        // minmax + max-content keeps the label snug and lets the
        // value cell flex to fill remaining space without
        // overflowing on phones (per PR #7's responsive grid pass).
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
