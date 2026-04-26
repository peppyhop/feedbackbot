// Port of hi-landing.jsx (the chosen "Landing A"). Structured as a
// single component tree with sub-components for each numbered
// section. Copy comes directly from the hi-fi design; styling uses
// the hi-* classes + Btn/Chip/Slab/Tag/LogoMark primitives.

import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  Dot,
} from 'lucide-react'

import { Btn, Chip, LogoMark, Slab, Tag } from '#/components/ui/brut'
import { ThemeToggle } from '#/components/theme-toggle'

const INSTALL_SNIPPET =
  '<script src="https://usefeedbackbot.com/widget.js" defer></script>'

export function Landing() {
  return (
    <div>
      <Nav />
      <Hero />
      <Marquee />
      <HowItWorks />
      <FanOutPipeline />
      <Claim />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  )
}

// ── Nav ──────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="fb-nav">
      <LogoMark size={32} />
      <span className="h-display" style={{ fontSize: 20 }}>
        FeedbackBot
      </span>
      <span className="fb-nav-chip">
        <Chip>v0</Chip>
      </span>
      <div className="fb-nav-actions">
        <ThemeToggle />
        <Btn as="a" href="/login" variant="ghost" size="sm">
          Sign in
        </Btn>
      </div>
    </nav>
  )
}

// ── Hero ─────────────────────────────────────────────────────────

function Hero() {
  const [copied, setCopied] = useState(false)

  const onCopy = () => {
    try {
      navigator.clipboard.writeText(INSTALL_SNIPPET)
    } catch {
      // clipboard denied — silent
    }
    setCopied(true)
    const t = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(t)
  }

  return (
    <section
      id="get-started"
      style={{ position: 'relative', padding: '72px 32px 96px', overflow: 'hidden' }}
    >
      <div
        className="hi-dots"
        style={{ position: 'absolute', inset: 0, opacity: 0.7, pointerEvents: 'none' }}
      />

      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 28,
            flexWrap: 'wrap',
          }}
        >
          <Chip accent>▣ new</Chip>
          <Chip>zero signup</Chip>
          <Chip>zero config</Chip>
          <div style={{ flex: 1 }} />
          <span
            className="h-mono"
            style={{ fontSize: 11, color: 'var(--fg-faint)' }}
          >
            usefeedbackbot.com — ships 2026
          </span>
        </div>

        <h1
          className="h-display"
          style={{
            fontSize: 'clamp(56px, 10vw, 132px)',
            letterSpacing: '-0.04em',
            marginBottom: 24,
            maxWidth: 1200,
          }}
        >
          <span>It's already </span>
          <span
            className="h-serif"
            style={{
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: '1em',
              color: 'var(--fg-mute)',
            }}
          >
            collecting
          </span>
          <br />
          <span
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              padding: '0 14px',
              boxShadow: '8px 8px 0 0 var(--border)',
              display: 'inline-block',
              transform: 'rotate(-1deg)',
              border: '3px solid var(--border)',
            }}
          >
            feedback.
          </span>
          <span> You just </span>
          <br />
          <span>don't know it yet.</span>
        </h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
            gap: 40,
            marginTop: 48,
            alignItems: 'start',
          }}
        >
          <div>
            <p
              style={{
                fontSize: 19,
                lineHeight: 1.45,
                color: 'var(--fg-mute)',
                maxWidth: 480,
                marginBottom: 32,
              }}
            >
              Drop one{' '}
              <span
                className="h-mono"
                style={{
                  fontSize: 16,
                  color: 'var(--fg)',
                  background: 'var(--surface-alt)',
                  padding: '1px 6px',
                  border: '1px solid var(--border-soft)',
                }}
              >
                {'<script>'}
              </span>{' '}
              tag. Feedback flows in, pre-sorted into bugs, ideas,
              questions, and spam. Claim the workspace later — DNS record
              or email on the matching domain. The data's already yours.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Btn variant="primary" onClick={onCopy}>
                {copied ? (
                  <>
                    <Check size={14} strokeWidth={2} /> copied
                  </>
                ) : (
                  <>
                    <Copy size={14} strokeWidth={1.75} /> copy snippet
                  </>
                )}
              </Btn>
              <Btn as="a" href="#how" variant="ghost">
                See it live <ArrowDown size={14} strokeWidth={1.75} />
              </Btn>
            </div>

            <div
              style={{
                marginTop: 40,
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                flexWrap: 'wrap',
              }}
            >
              <span
                className="h-mono"
                style={{
                  fontSize: 12,
                  color: 'var(--fg-mute)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Dot size={10} fill="var(--ok)" color="var(--ok)" />
                Running on Cloudflare — workers, D1, R2, queues
              </span>
              <div
                style={{ width: 1, height: 18, background: 'var(--border-soft)' }}
              />
              <span
                className="h-mono"
                style={{ fontSize: 12, color: 'var(--fg-mute)' }}
              >
                Widget: &lt;10kb gzipped
              </span>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <pre className="hi-code hi-code-raised" style={{ paddingTop: 48 }}>
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  padding: '6px 14px',
                  background: 'var(--fg)',
                  color: 'var(--bg)',
                  border: '2px solid var(--border)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                index.html
              </span>
              <span
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  color: 'var(--fg-faint)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: 'var(--ok)',
                    display: 'inline-block',
                  }}
                />
                live
              </span>
              <span className="c-com">
                {'<!-- in <head>, anywhere. really. -->\n'}
              </span>
              <span className="c-brk">{'<'}</span>
              <span className="c-tag">script</span>{' '}
              <span className="c-atr">src</span>
              <span className="c-brk">=</span>
              <span className="c-str">"https://usefeedbackbot.com/widget.js"</span>{' '}
              <span className="c-atr">defer</span>
              <span className="c-brk">{'></'}</span>
              <span className="c-tag">script</span>
              <span className="c-brk">{'>'}</span>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Marquee ──────────────────────────────────────────────────────

function Marquee() {
  const items = [
    '◎ install in 10 seconds',
    '▣ workspace keyed by Origin',
    '※ AI-classified',
    '◉ webhooks everywhere',
    '⌁ claim via DNS or email',
    '◈ <8kb, zero deps',
    '※ 99% spam filter',
    '◎ dark & light widget',
  ]
  const doubled = [...items, ...items]
  return (
    <div
      style={{
        borderTop: '1.5px solid var(--border)',
        borderBottom: '1.5px solid var(--border)',
        background: 'var(--fg)',
        color: 'var(--bg)',
        overflow: 'hidden',
        padding: '14px 0',
      }}
    >
      <div className="hi-marquee-inner">
        {doubled.map((x, i) => (
          <div
            key={`${x}-${i}`}
            className="h-mono"
            style={{
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {x}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── How it works (§02) ───────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    title: 'Paste the script tag',
    body: 'Anywhere in <head>. No build step. No env vars.',
  },
  {
    n: '02',
    title: 'Tickets queue under your Origin',
    body: 'Workspace auto-derived. Data held for 30 days unclaimed.',
  },
  {
    n: '03',
    title: 'AI sorts them into four buckets',
    body: 'bug / feature / query / spam. Re-runs on every edit.',
  },
  {
    n: '04',
    title: 'Webhooks fan out by rule',
    body: 'Slack, Discord, Linear, GitHub, or any HTTPS endpoint.',
  },
]

function HowItWorks() {
  return (
    <section id="how" style={{ padding: '96px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Slab num="02" right="live preview">
          How it works
        </Slab>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
            gap: 56,
            alignItems: 'start',
          }}
        >
          <div>
            <h2
              className="h-display"
              style={{ fontSize: 56, marginBottom: 24, letterSpacing: '-0.03em' }}
            >
              Paste.{' '}
              <span className="h-serif" style={{ fontStyle: 'italic', fontWeight: 400 }}>
                And?
              </span>
              <br />
              That's{' '}
              <span
                style={{
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  padding: '0 10px',
                  border: '2px solid var(--border)',
                  boxShadow: '4px 4px 0 0 var(--border)',
                  display: 'inline-block',
                }}
              >
                it.
              </span>
            </h2>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.5,
                color: 'var(--fg-mute)',
                marginBottom: 32,
                maxWidth: 460,
              }}
            >
              The backend reads the{' '}
              <span className="h-mono" style={{ fontSize: 14, color: 'var(--fg)' }}>
                Origin
              </span>{' '}
              header, derives your workspace, and starts queueing tickets. The
              classifier tags every message. Your webhooks fire.
            </p>
            <div
              className="hi-card hi-card-raised"
              style={{ background: 'var(--surface)' }}
            >
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '54px 1fr',
                    gap: 14,
                    padding: '18px',
                    borderTop: i ? '1.5px solid var(--border-soft)' : 'none',
                  }}
                >
                  <div
                    className="h-mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--accent-ink)',
                      background: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px solid var(--border)',
                    }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 3 }}>
                      {s.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--fg-mute)',
                        lineHeight: 1.4,
                      }}
                    >
                      {s.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <LiveTerminal />
        </div>
      </div>
    </section>
  )
}

function LiveTerminal() {
  // Simulated rolling feed — real tickets post-launch would come from
  // a streaming read of /api/public/tickets.
  const samples = [
    { tag: 'bug' as const, msg: 'checkout button 404s on Safari 16', page: '/pricing' },
    { tag: 'feat' as const, msg: 'add export to CSV for analytics', page: '/dashboard' },
    { tag: 'query' as const, msg: 'how do I invite teammates?', page: '/settings' },
    { tag: 'bug' as const, msg: 'stripe webhook retries 500', page: '/billing' },
    { tag: 'spam' as const, msg: 'cheap backlinks cheap backlinks', page: '/contact' },
  ]
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % samples.length), 2200)
    return () => clearInterval(id)
  }, [samples.length])

  const visible = [samples[idx], samples[(idx + 1) % samples.length], samples[(idx + 2) % samples.length]]

  return (
    <div
      className="hi-card hi-card-raised"
      style={{ background: 'var(--fg)', color: 'var(--bg)' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          borderBottom: '1.5px solid var(--bg)',
          opacity: 0.9,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ width: 8, height: 8, background: '#3fdc80' }} />
        <span style={{ width: 8, height: 8, background: '#ffe24a' }} />
        <span style={{ width: 8, height: 8, background: '#ff6a4a' }} />
        <span style={{ flex: 1 }} />
        feed · {samples.length} sites
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visible.map((t, i) =>
          t ? (
            <div
              key={`${idx}-${i}`}
              className="hi-slide-in"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                opacity: 1 - i * 0.25,
              }}
            >
              <Tag kind={t.tag} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{t.msg}</div>
                <div
                  className="h-mono"
                  style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}
                >
                  {t.page}
                </div>
              </div>
            </div>
          ) : null,
        )}
      </div>
    </div>
  )
}

// ── Fan-out pipeline (§03) ───────────────────────────────────────

function FanOutPipeline() {
  const lanes: Array<{ kind: 'bug' | 'feat' | 'query' | 'spam'; label: string; dest: string }> = [
    { kind: 'bug', label: 'bug', dest: 'Linear → #bugs' },
    { kind: 'feat', label: 'feature', dest: 'Slack → #product' },
    { kind: 'query', label: 'query', dest: 'Slack → #support' },
    { kind: 'spam', label: 'spam', dest: 'dropped silently' },
  ]
  return (
    <section style={{ padding: '96px 32px', background: 'var(--surface-alt)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Slab num="03" right="pipeline">
          Tagged. Routed. Done.
        </Slab>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
            gap: 56,
          }}
        >
          <div>
            <h2
              className="h-display"
              style={{ fontSize: 48, marginBottom: 20, letterSpacing: '-0.03em' }}
            >
              Every ticket fans out —{' '}
              <span className="h-serif" style={{ fontStyle: 'italic' }}>
                tagged, signed, logged.
              </span>
            </h2>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.5,
                color: 'var(--fg-mute)',
                marginBottom: 24,
                maxWidth: 460,
              }}
            >
              Gemma 4 on Workers AI classifies each ticket with JSON-mode
              output. Each classification routes through a per-workspace rule
              table. Payloads are HMAC-signed. Every delivery is logged,
              with retries visible in your dashboard.
            </p>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <Stat label="classifier" value="Gemma 4" />
              <Stat label="delivery retries" value="5×" />
              <Stat label="dead-letter queue" value="yes" />
            </div>
          </div>

          <div className="hi-card hi-card-raised" style={{ padding: 20 }}>
            <div
              className="h-mono"
              style={{
                fontSize: 11,
                color: 'var(--fg-mute)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              trunk · classify · tag · route
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
              }}
            >
              {lanes.map((lane) => (
                <div
                  key={lane.kind}
                  style={{
                    border: '2px solid var(--border)',
                    padding: 12,
                    background: 'var(--surface)',
                  }}
                >
                  <Tag kind={lane.kind}>{lane.label}</Tag>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      color: lane.kind === 'spam' ? 'var(--fg-faint)' : 'var(--fg)',
                      textDecoration: lane.kind === 'spam' ? 'line-through' : 'none',
                    }}
                  >
                    {lane.dest}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="h-display" style={{ fontSize: 32, lineHeight: 1 }}>
        {value}
      </div>
      <div
        className="h-mono"
        style={{
          fontSize: 11,
          color: 'var(--fg-faint)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ── Claim (§04) ──────────────────────────────────────────────────

function Claim() {
  return (
    <section style={{ padding: '96px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Slab num="04" right="claim the workspace">
          Ownership, later.
        </Slab>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: 32,
          }}
        >
          <ClaimCard
            title="Email on the matching domain"
            kicker="fastest"
            body="Sign in with alice@acme.com → workspace for acme.com is yours. Freemail and EDU/GOV blocked from this path."
          />
          <ClaimCard
            title="DNS TXT record"
            kicker="no email needed"
            body={
              <>
                Add a TXT record at{' '}
                <code className="h-mono">_feedback.yourdomain.com</code> with
                the token we hand you. Verified via DoH in seconds.
              </>
            }
          />
          <ClaimCard
            title="Team invites"
            kicker="after claim"
            body="Owner invites members via magic-link email. GitHub sign-in works too. SSO wiring is deferred to production workspaces."
          />
        </div>
      </div>
    </section>
  )
}

function ClaimCard({
  title,
  kicker,
  body,
}: {
  title: string
  kicker: string
  body: React.ReactNode
}) {
  return (
    <div className="hi-card hi-card-raised" style={{ padding: 24 }}>
      <Chip accent>{kicker}</Chip>
      <h3
        className="h-display"
        style={{ fontSize: 22, marginTop: 14, lineHeight: 1.1, letterSpacing: '-0.02em' }}
      >
        {title}
      </h3>
      <p
        style={{
          marginTop: 10,
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--fg-mute)',
        }}
      >
        {body}
      </p>
    </div>
  )
}

// ── Features (§05) ───────────────────────────────────────────────

function Features() {
  const feats = [
    {
      label: '<8kb widget',
      body: 'Preact in a Shadow DOM. Loads once, caches forever. html2canvas lazy-loads only when a user attaches a screenshot.',
    },
    {
      label: 'AI classification',
      body: 'Gemma 4 on Workers AI with JSON-mode. Every ticket gets a primary tag, confidence, and a suggested title.',
    },
    {
      label: 'Signed webhooks',
      body: 'Every outbound POST carries X-Feedback-Signature: sha256=<hex>. Five retries with backoff; dead-letter queue for failures.',
    },
    {
      label: 'Spam filter',
      body: 'Freemail + disposable blocklists at ingestion. Honeypot field. Per-IP and per-workspace sliding-window rate limits.',
    },
    {
      label: 'Public roadmap',
      body: 'Claimed workspaces get a shareable /b/yourdomain board with voting and comments. No accounts required for voters.',
    },
    {
      label: 'Zero raw IPs',
      body: 'ip_hash = sha256(ip + daily_salt). No raw IPs stored, ever. Audit log for every claim event.',
    },
  ]
  return (
    <section style={{ padding: '96px 32px', background: 'var(--surface-alt)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Slab num="05" right="what's in the box">
          Built like we'd audit it.
        </Slab>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: 20,
          }}
        >
          {feats.map((f) => (
            <div
              key={f.label}
              className="hi-card"
              style={{ padding: 24, background: 'var(--surface)' }}
            >
              <div
                className="h-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--fg-faint)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                {f.label}
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.5 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing (§06) ────────────────────────────────────────────────

function Pricing() {
  // Kept in sync with TIERS in src/routes/dashboard.$domain.billing.tsx
  // and SLUG_TO_PLAN in src/lib/billing/plans.ts. If you change pricing
  // here, update both places.
  const plans: Array<{
    name: string
    price: string
    sub: string
    bullets: Array<string>
    cta: string
    href: string
    primary: boolean
  }> = [
    {
      name: 'Lite',
      price: '$1',
      sub: 'per workspace / month',
      bullets: [
        '100 tickets / month',
        '1 admin seat',
        '1 integration',
        'Public board',
      ],
      cta: 'Start with Lite',
      href: '/signup?plan=lite',
      primary: false,
    },
    {
      name: 'Starter',
      price: '$9',
      sub: 'per workspace / month',
      bullets: [
        '1,000 tickets / month',
        '3 admin seats',
        '2 integrations',
        'Custom domain, no watermark',
      ],
      cta: 'Start with Starter',
      href: '/signup?plan=starter',
      primary: true,
    },
    {
      name: 'Scale',
      price: '$29',
      sub: 'per workspace / month',
      bullets: [
        '10 admin seats',
        '10,000 tickets / month',
        'All PM integrations, unlimited webhooks',
        'SSO, audit log, API',
      ],
      cta: 'Choose Scale',
      href: '/signup?plan=scale',
      primary: false,
    },
  ]
  return (
    <section id="pricing" style={{ padding: '96px 32px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Slab num="06" right="pricing">
          Simple.
        </Slab>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            margin: '0 0 28px',
            border: '1.5px solid var(--border)',
            background: 'var(--surface-alt)',
            maxWidth: 640,
          }}
        >
          <div
            className="h-mono"
            style={{
              fontSize: 11,
              padding: '2px 8px',
              border: '1.5px solid var(--border)',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            why $1?
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--fg-mute)',
            }}
          >
            Even the smallest plan costs a dollar. Bot signup farms
            optimize for $0 — charging anything filters them out so
            real makers actually get heard. Cancel any time, no contract.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: 20,
          }}
        >
          {plans.map((p) => (
            <div
              key={p.name}
              className={p.primary ? 'hi-card hi-card-raised' : 'hi-card'}
              style={{
                padding: 28,
                background: p.primary ? 'var(--accent)' : 'var(--surface)',
                color: p.primary ? 'var(--accent-ink)' : 'var(--fg)',
              }}
            >
              <div
                className="h-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                }}
              >
                {p.name}
              </div>
              <div
                className="h-display"
                style={{ fontSize: 56, marginTop: 6, lineHeight: 1 }}
              >
                {p.price}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                {p.sub}
              </div>
              <ul
                style={{
                  marginTop: 20,
                  paddingLeft: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {p.bullets.map((b) => (
                  <li
                    key={b}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 14,
                    }}
                  >
                    <Check size={14} strokeWidth={2} /> {b}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 24 }}>
                <Btn
                  as="a"
                  href={p.href}
                  variant={p.primary ? 'default' : 'primary'}
                >
                  {p.cta}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── FAQ (§07) ────────────────────────────────────────────────────

function FAQ() {
  const items = [
    {
      q: 'What stops someone hijacking my workspace?',
      a: "Claim requires DNS TXT OR an email on the matching domain (with freemail and EDU/GOV blocked). First valid claimant becomes owner, subsequent become members. Every claim is audit-logged.",
    },
    {
      q: 'What happens to tickets before I claim?',
      a: 'They queue under your Origin-derived workspace in a pending state, capped at 100 tickets. Once you claim you see everything; you can also purge them on claim.',
    },
    {
      q: 'Do you store IPs?',
      a: 'No. Every ticket stores a sha256(ip + daily_salt) only. The salt rotates daily so even the hash can\'t be used to correlate across days.',
    },
    {
      q: "Can I self-host?",
      a: "Not yet. The entire platform runs on Cloudflare (Workers, D1, R2, Queues). Self-host story is post-GA.",
    },
  ]
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  return (
    <section id="faq" style={{ padding: '96px 32px', background: 'var(--surface-alt)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Slab num="07" right="questions">
          FAQ
        </Slab>
        <div className="hi-card hi-card-raised" style={{ background: 'var(--surface)' }}>
          {items.map((it, i) => (
            <details
              key={it.q}
              open={openIdx === i}
              onToggle={(e) =>
                (e.currentTarget as HTMLDetailsElement).open ? setOpenIdx(i) : null
              }
              style={{
                borderTop: i ? '1.5px solid var(--border-soft)' : 'none',
                padding: '18px 20px',
              }}
            >
              <summary
                style={{
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: 'pointer',
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span className="h-mono" style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {it.q}
              </summary>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: 'var(--fg-mute)',
                }}
              >
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA (§08) ────────────────────────────────────────────────────

function CTA() {
  return (
    <section style={{ padding: '96px 32px', textAlign: 'center' }}>
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <h2
          className="h-display"
          style={{
            fontSize: 'clamp(44px, 7vw, 88px)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          One script.{' '}
          <span className="h-serif" style={{ fontStyle: 'italic' }}>
            That's the install.
          </span>
        </h2>
        <p
          style={{
            marginTop: 20,
            fontSize: 18,
            color: 'var(--fg-mute)',
            maxWidth: 520,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Claim when you're ready. Cancel whenever. Your data travels with
          the domain.
        </p>
        <div
          style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center' }}
        >
          <Btn variant="primary">
            Copy install tag <ArrowUpRight size={14} strokeWidth={2} />
          </Btn>
          <Btn variant="ghost">Docs</Btn>
        </div>
      </div>
    </section>
  )
}

// ── Footer ───────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      style={{
        padding: '40px 32px',
        borderTop: '1.5px solid var(--border)',
        color: 'var(--fg-faint)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <LogoMark size={22} />
        <span style={{ color: 'var(--fg)' }}>usefeedbackbot.com</span>
        <span>·</span>
        <span>built on cloudflare</span>
        <div style={{ flex: 1 }} />
        <a href="#privacy">Privacy</a>
        <a href="#terms">Terms</a>
        <a href="#status">Status</a>
      </div>
    </footer>
  )
}
