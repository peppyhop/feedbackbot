import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import {
  magicLink,
  oAuthProxy,
  organization,
} from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import DodoPayments from 'dodopayments'
import {
  checkout,
  dodopayments,
  portal,
  webhooks,
} from '@dodopayments/better-auth'

import { env } from '#/env'
import { makeDb } from '#/db/client'
import * as authSchema from '#/db/schema'
import { handleDodoPayload } from '#/lib/billing/webhook-reducer'
import { sendMail } from '#/lib/mailer'
import { planProductsFor } from '#/lib/billing/plans'

const MAGIC_LINK_SUBJECT = 'Your FeedbackBot sign-in link'

// `@better-auth/sso` is NOT imported. The plugin pulls in samlify +
// node-forge + xmldom + asn1 + node-rsa + jose + fast-xml-parser —
// ~1.5 MB of SAML tooling we don't use until SSO UI ships. Schema
// tables for SSO already exist (migration 0002_better_auth.sql), so
// re-enabling is a one-line import when the UI lands.

// Factory returns a fully-typed Better Auth instance that carries
// plugin-specific method signatures. Pulling this out of the lazy
// Proxy preserves the plugin types.
function buildAuth() {
  // Dodo plugin is only wired when both API key + webhook secret are
  // set. Missing secrets at module load is a no-op (feature disabled)
  // rather than a hard failure — mirrors how GitHub OAuth is treated.
  const dodoConfigured =
    !!env.DODO_PAYMENTS_API_KEY && !!env.DODO_PAYMENTS_WEBHOOK_SECRET
  const dodoPlugin = dodoConfigured
    ? dodopayments({
        client: new DodoPayments({
          bearerToken: env.DODO_PAYMENTS_API_KEY!,
          environment:
            env.DODO_PAYMENTS_ENV === 'live_mode' ? 'live_mode' : 'test_mode',
        }),
        createCustomerOnSignUp: true,
        getCustomerParams: (user: { id: string }) => ({
          metadata: { user_id: user.id },
        }),
        use: [
          checkout({
            // Pay-first flow has no session pre-checkout — visitor
            // hits /api/checkout/start which creates the Dodo session
            // directly. The post-payment success page mints the user
            // + workspace via upsertPaidWorkspace.
            authenticatedUsersOnly: false,
            successUrl: '/dashboard/billing/success',
            // Resolved at request time inside the lazy Proxy so the
            // right ID set (test vs live) is selected per current
            // env binding, not at module load.
            products: planProductsFor(env.DODO_PAYMENTS_ENV),
          }),
          portal(),
          webhooks({
            webhookKey: env.DODO_PAYMENTS_WEBHOOK_SECRET!,
            onPayload: async (payload) => {
              await handleDodoPayload(
                payload as unknown as Parameters<typeof handleDodoPayload>[0],
              )
            },
          }),
        ],
      })
    : null

  return betterAuth({
    database: drizzleAdapter(makeDb(env.DB), {
      provider: 'sqlite',
      // Pass the full schema so the adapter can resolve Better Auth
      // tables (user, session, account, verification, organization,
      // member, invitation, team, teamMember, ssoProvider). Without
      // this, auto-discovery fails because our schema file mixes app
      // tables with auth tables and the adapter doesn't know which is
      // which.
      schema: authSchema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    // Allow OAuth flows initiated from preview deploys to redirect
    // back to their own origin after the proxy hop through prod.
    // Wildcard pattern matches the per-PR hostnames; the apex is
    // the production callback target.
    trustedOrigins: [
      'https://usefeedbackbot.com',
      'https://*.preview.usefeedbackbot.com',
    ],

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },

    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          try {
            await sendMail({
              to: email,
              subject: MAGIC_LINK_SUBJECT,
              text: `Sign in to FeedbackBot: ${url}\n\nLink expires in 5 minutes.`,
              html: `<p>Sign in to FeedbackBot:</p><p><a href="${url}">${url}</a></p><p>Link expires in 5 minutes.</p>`,
            })
          } catch (err) {
            // On non-prod stages (where BETTER_AUTH_URL is empty),
            // dump the URL to wrangler tail so a developer can grab
            // it when the email provider is misconfigured / down.
            // Production stays silent — the URL is bearer-token-grade
            // sensitive and we don't want it routinely in prod logs.
            const isProd =
              env.BETTER_AUTH_URL === 'https://usefeedbackbot.com'
            if (!isProd) {
              const keyPrefix = (env.RESEND_API_KEY ?? '').slice(0, 12)
              console.warn(
                `[magic-link] mail send failed on non-prod stage; URL=${url} email=${email} keyPrefix=${keyPrefix} from=${env.RESEND_FROM ?? 'default'}`,
              )
            }
            throw err
          }
        },
      }),
      organization({
        // The link points at our UI route, which fetches invitation
        // details and either prompts the recipient to sign in (magic
        // link) or — if already signed in — POSTs to
        // /api/auth/organization/accept-invitation to seal the deal.
        sendInvitationEmail: async ({ id, email, organization, inviter }) => {
          const baseUrl =
            env.BETTER_AUTH_URL && env.BETTER_AUTH_URL.length > 0
              ? env.BETTER_AUTH_URL
              : 'https://usefeedbackbot.com'
          const url = `${baseUrl}/accept-invitation/${id}`
          const orgName = organization.name
          const inviterName =
            (inviter?.user?.name || inviter?.user?.email || 'Your teammate') +
            ''
          await sendMail({
            to: email,
            subject: `${inviterName} invited you to ${orgName} on FeedbackBot`,
            text: `${inviterName} invited you to join the ${orgName} workspace on FeedbackBot.\n\nAccept the invitation: ${url}\n\nLink doesn't expire — but feel free to ignore if you weren't expecting it.`,
            html: `<p><strong>${inviterName}</strong> invited you to join <strong>${orgName}</strong> on FeedbackBot.</p><p><a href="${url}">Accept the invitation</a></p><p style="color:#666;font-size:13px">Link doesn't expire — feel free to ignore if you weren't expecting it.</p>`,
          })
        },
      }),
      ...(dodoPlugin ? [dodoPlugin] : []),
      // Routes preview-deploy OAuth flows through prod so we only
      // need a single redirect URI registered with each provider.
      // Production exchanges the code, signs an encrypted profile
      // payload, then 302s back to the original preview origin
      // which decrypts it (BETTER_AUTH_SECRET shared across stages)
      // and creates the local session. No-op on production itself.
      oAuthProxy({
        productionURL: 'https://usefeedbackbot.com',
      }),
      tanstackStartCookies(),
    ],
  })
}

type AuthInstance = ReturnType<typeof buildAuth>

// Better Auth is lazily constructed on first access because
// `cloudflare:workers`'s `env` binding isn't populated at module
// load time — only inside a request scope.
let _auth: AuthInstance | null = null
function getAuth(): AuthInstance {
  if (!_auth) _auth = buildAuth()
  return _auth
}

// The Proxy preserves the `auth.handler(req)` / `auth.api.*` surface
// that callers rely on, while deferring construction to request time.
export const auth = new Proxy({} as AuthInstance, {
  get(_target, prop) {
    return Reflect.get(getAuth() as object, prop)
  },
}) as AuthInstance
