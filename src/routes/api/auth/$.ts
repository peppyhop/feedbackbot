import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'

async function handle(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname
  const friendly = () =>
    path.includes('/sign-in/magic-link')
      ? "Couldn't send the sign-in email. Please try again, or contact support@usefeedbackbot.com if it keeps failing."
      : 'Authentication failed. Please try again.'

  try {
    const res = await auth.handler(request)
    // Better Auth catches its own plugin throws (e.g. a sendMagicLink
    // failure) and returns an empty-body 500. The login form reads
    // res.text() to populate the error toast — empty body falls back
    // to "HTTP 500", which is useless. Rewrite the body when the
    // upstream gave us a 5xx with no actionable text.
    if (res.status >= 500 && path.startsWith('/api/auth/')) {
      const body = await res.clone().text()
      if (body.length === 0) {
        console.warn('rewriting empty 500 body for', path)
        return new Response(friendly(), {
          status: res.status,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      }
    }
    return res
  } catch (err) {
    // True throws from the handler (rare — Better Auth absorbs most)
    // still need a graceful response. Log the full stack to tail.
    console.error('auth handler threw', {
      path,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      cause: err instanceof Error ? err.cause : undefined,
    })
    return new Response(friendly(), {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
})
