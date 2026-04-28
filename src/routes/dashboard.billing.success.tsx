import { createFileRoute, redirect } from '@tanstack/react-router'

import { seoMeta } from '#/lib/seo'
import { completeCheckout } from '#/server/complete-checkout'

export const Route = createFileRoute('/dashboard/billing/success')({
  validateSearch: (raw: Record<string, unknown>) => ({
    cs: typeof raw.cs === 'string' ? raw.cs : undefined,
    // Backwards-compat with previous Dodo configs that sent
    // ?workspace_id=&status=. Either is OK; we prefer `cs` going
    // forward.
    workspace_id:
      typeof raw.workspace_id === 'string' ? raw.workspace_id : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
  }),
  loader: async ({ location }) => {
    const search = location.search as {
      cs?: string
      workspace_id?: string
      status?: string
    }

    // Legacy redirect path: previous Dodo callbacks sent
    // ?workspace_id=…&status=…. Hand off to /onboard/{ws} so any
    // checkout sessions in flight don't 404 mid-deploy.
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

    if (!search.cs) {
      throw redirect({ to: '/' })
    }

    // Server-side: verify Dodo session, upsert user + workspace,
    // mint magic-link verification value, return URL to redirect to.
    const result = await completeCheckout({ data: { cs: search.cs } })
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
