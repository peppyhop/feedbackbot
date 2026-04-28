// Server function: builds the data the /login route needs in a
// single round-trip. Reads the better-auth session, surfaces which
// social providers are wired on this stage, and reports whether the
// signed-in user already has a claimed workspace (so the route
// loader can redirect instead of rendering the form).

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq, inArray } from 'drizzle-orm'

import { env } from '#/env'
import { auth } from '#/lib/auth'
import { makeDb } from '#/db/client'
import { member, workspaces } from '#/db/schema'

export type LoginUser = {
  email: string
  name: string | null
}

export type LoginState = {
  google_enabled: boolean
  magic_link_enabled: boolean
  signed_in: boolean
  user: LoginUser | null
  claimed_workspace_domain: string | null
  // First not-yet-claimed workspace the user owns — set when the
  // user paid but didn't finish onboarding. Used by /login (and
  // future entry points) to drop them back into /onboard/{ws}.
  incomplete_workspace_id: string | null
}

export const loadLoginState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<LoginState> => {
    const request = getRequest()
    const flags = {
      google_enabled:
        !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
      magic_link_enabled: !!env.RESEND_API_KEY,
    }

    const session = await auth.api
      .getSession({ headers: request.headers })
      .catch(() => null)
    if (!session?.user) {
      return {
        ...flags,
        signed_in: false,
        user: null,
        claimed_workspace_domain: null,
        incomplete_workspace_id: null,
      }
    }

    const sessionUser = session.user as {
      id: string
      email: string
      name?: string | null
      isAnonymous?: boolean
    }
    // Anonymous users are an internal pre-claim placeholder; treat
    // them as not-signed-in for landing-page purposes so we don't
    // render a profile menu for an unclaimed checkout session.
    if (sessionUser.isAnonymous) {
      return {
        ...flags,
        signed_in: false,
        user: null,
        claimed_workspace_domain: null,
        incomplete_workspace_id: null,
      }
    }
    const user: LoginUser = {
      email: sessionUser.email,
      name: sessionUser.name ?? null,
    }

    const db = makeDb(env.DB)
    const memberships = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, sessionUser.id))
    const orgIds = memberships.map((m) => m.organizationId)
    if (orgIds.length === 0) {
      return {
        ...flags,
        signed_in: true,
        user,
        claimed_workspace_domain: null,
        incomplete_workspace_id: null,
      }
    }
    const ownedWorkspaces = await db
      .select({
        id: workspaces.id,
        domain: workspaces.domain,
        state: workspaces.state,
      })
      .from(workspaces)
      .where(inArray(workspaces.betterAuthOrgId, orgIds))
    const claimed = ownedWorkspaces.find((w) => w.state === 'claimed')
    const incomplete = ownedWorkspaces.find((w) => w.state !== 'claimed')
    return {
      ...flags,
      signed_in: true,
      user,
      claimed_workspace_domain: claimed?.domain ?? null,
      incomplete_workspace_id: claimed ? null : (incomplete?.id ?? null),
    }
  },
)
