// GET /sitemap.xml — dynamic sitemap referenced by /robots.txt.
//
// Includes:
//   • Public marketing pages (/, /login)
//   • Public boards for every CLAIMED workspace (/b/<domain>)
//
// Excluded (per robots.txt + noindex meta):
//   • /dashboard/*  (admin)
//   • /api/*        (API)
//   • /onboard/*    (post-payment, noindex)
//
// We bypass TanStack's createFileRoute SSR shell and return raw XML
// from the server handler so the response Content-Type is right.

import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { env } from '#/env'
import { makeDb } from '#/db/client'
import { workspaces } from '#/db/schema'
import { SITE_URL } from '#/lib/seo'

const STATIC_PATHS = ['/', '/login']

async function handle(_request: Request): Promise<Response> {
  const today = new Date().toISOString().slice(0, 10)

  let claimedDomains: Array<string> = []
  try {
    const db = makeDb(env.DB)
    const rows = await db
      .select({ domain: workspaces.domain })
      .from(workspaces)
      .where(eq(workspaces.state, 'claimed'))
    claimedDomains = rows
      .map((r) => r.domain)
      // Defense-in-depth: never list internal placeholder domains.
      .filter((d) => !d.endsWith('.feedbackbot.internal'))
  } catch (err) {
    // If D1 is unreachable, fall back to the static set so the
    // sitemap is at least syntactically valid.
    console.warn('sitemap: claimed-workspaces query failed', err)
  }

  const urls = [
    ...STATIC_PATHS.map((p) => ({
      loc: `${SITE_URL}${p}`,
      changefreq: 'weekly',
      priority: p === '/' ? '1.0' : '0.7',
    })),
    ...claimedDomains.map((d) => ({
      loc: `${SITE_URL}/b/${d}`,
      changefreq: 'daily',
      priority: '0.6',
    })),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // 1h browser, 6h edge — fast enough for new workspace listings,
      // cheap enough to skip a D1 hit per request.
      'cache-control': 'public, max-age=3600, s-maxage=21600',
    },
  })
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
    },
  },
})
