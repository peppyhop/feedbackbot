import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous, magicLink, organization } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'
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
import { member } from '#/db/schema'
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
            // Payment-first flow needs anonymous users to pay before
            // they upgrade to a real account via magic link. The
            // workspace + subscription stay attached to the org as the
            // anon user is merged into the real one in onLinkAccount.
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

    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID ?? '',
        clientSecret: env.GITHUB_CLIENT_SECRET ?? '',
      },
    },

    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMail({
            to: email,
            subject: MAGIC_LINK_SUBJECT,
            text: `Sign in to FeedbackBot: ${url}\n\nLink expires in 5 minutes.`,
            html: `<p>Sign in to FeedbackBot:</p><p><a href="${url}">${url}</a></p><p>Link expires in 5 minutes.</p>`,
          })
        },
      }),
      organization(),
      anonymous({
        emailDomainName: 'feedbackbot.internal',
        // Fires when an anonymous user signs in with a real method
        // (magic link, OAuth). We migrate every `member` row over so
        // the org they created while anonymous now belongs to the
        // real user. Better Auth deletes the anon user after.
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          const db = makeDb(env.DB)
          await db
            .update(member)
            .set({ userId: newUser.user.id })
            .where(eq(member.userId, anonymousUser.user.id))
        },
      }),
      ...(dodoPlugin ? [dodoPlugin] : []),
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
