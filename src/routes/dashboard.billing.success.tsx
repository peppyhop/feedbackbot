import { createFileRoute, redirect } from '@tanstack/react-router'

import { seoMeta } from '#/lib/seo'
import { completeCheckout } from '#/server/complete-checkout'

export const Route = createFileRoute('/dashboard/billing/success')({
  validateSearch: (raw: Record<string, unknown>) => ({
    // Dodo appends these to the return_url after checkout:
    //   ?subscription_id=&status=&email=
    // We only trust `subscription_id` — the rest are re-fetched
    // server-side via the Dodo API for verification.
    subscription_id:
      typeof raw.subscription_id === 'string' ? raw.subscription_id : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    // Backwards-compat with previous Dodo configs that sent
    // ?workspace_id=&status=. Hand off to /onboard/{ws} so any
    // checkout sessions in flight don't 404 mid-deploy.
    workspace_id:
      typeof raw.workspace_id === 'string' ? raw.workspace_id : undefined,
  }),
  loader: async ({ location }) => {
    const search = location.search as {
      subscription_id?: string
      status?: string
      email?: string
      workspace_id?: string
    }

    // Legacy redirect path: previous Dodo callbacks sent
    // ?workspace_id=…&status=…
    if (search.workspace_id) {
      const failed =
        search.status &&
        search.status !== 'active' &&
        search.status !== 'succeeded'
      throw redirect({
        to: '/onboard/$workspaceId',
        params: { workspaceId: search.workspace_id },
        search: { failed: failed ? search.status : undefined },
      })
    }

    if (!search.subscription_id) {
      throw redirect({ to: '/' })
    }

    // Server-side: verify Dodo subscription, upsert user + workspace,
    // mint magic-link verification value, return URL to redirect to.
    const result = await completeCheckout({
      data: {
        subscription_id: search.subscription_id,
        status: search.status,
        email: search.email,
      },
    })
    throw redirect({ href: result.url, reloadDocument: true })
  },
  head: () => ({
    meta: seoMeta({
      path: '/dashboard/billing/success',
      title: 'Finishing up',
      noindex: true,
    }),
  }),
})
