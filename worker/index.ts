/**
 * The API. Everything else on this origin is a static file.
 *
 * `wrangler.jsonc` sets `run_worker_first: ["/api/*"]`, so this function is
 * only ever entered for those paths. A page load, a boon icon and a wallpaper
 * never reach it, which is the difference between free and metered: static
 * asset requests are unlimited on every plan, Worker invocations are 100k a day
 * on the free one.
 *
 * Same origin on purpose. `assets/_headers` says `connect-src 'self'` and this
 * is served from the same hostname, so the whole API works under a policy that
 * never had to be opened up for it.
 *
 * ## What is here
 *
 *   /api/auth/*      handed whole to better-auth: sign up, sign in, sign out, session
 *   /api/capabilities  what this deployment can do. Public, and honest about mail
 *   /api/me            who is signed in
 *   /api/builds        publish one, list yours, unpublish one
 *   /api/b/<id>        read a published build. PUBLIC, because that is the point
 *
 * **Still nothing social.** A published build is unlisted: no gallery, no index,
 * no search, and a random id rather than a sequential one, so it is reachable
 * only by somebody who was handed the link. `REQUIREMENTS.md` 5 wants moderation
 * designed before anything discoverable exists, and this is deliberately not
 * that. Friends and leaderboards are still not here.
 */

import { drizzle } from 'drizzle-orm/d1'

import { createAuth } from './auth.ts'
import { listMine, publish, read, unpublish } from './publish.ts'
import * as schema from './schema.ts'

/**
 * `Env` is not declared here. `npm run types` derives it from the bindings in
 * `wrangler.jsonc` into `worker-configuration.d.ts`, so a binding added to the
 * config cannot go missing from the types. Re-run it after editing the config.
 *
 * Two bindings today:
 *
 *   DB                   the D1 database
 *   BETTER_AUTH_SECRET   signs every session cookie. `wrangler secret put
 *                        BETTER_AUTH_SECRET` in production, `.dev.vars` locally,
 *                        which is gitignored. Rotating it signs everybody out,
 *                        which is the right behaviour if it ever leaks
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Fail loudly and early. A missing secret means every cookie this Worker
    // issues is signed with `undefined`, which is not an error anywhere in the
    // stack and is a silent authentication bypass.
    if (!env.BETTER_AUTH_SECRET) {
      return json({ error: 'server misconfigured' }, 500)
    }

    // Both built per request, and they have to be: a D1 binding does not exist
    // outside one. The origin comes off the request rather than a config so the
    // same code serves workers.dev and enodia.tools without either being told.
    const db = drizzle(env.DB, { schema })
    // The mail keys are optional and are threaded in rather than read inside,
    // so worker/auth.ts names no environment variable of its own.
    const auth = createAuth(db, env.BETTER_AUTH_SECRET, url.origin, {
      RESEND_API_KEY: env.RESEND_API_KEY,
      MAIL_FROM: env.MAIL_FROM,
    })

    if (url.pathname.startsWith('/api/auth/')) {
      return auth.handler(request)
    }

    /**
     * What this deployment can actually do.
     *
     * Public, and it exists for one reason: password reset only works when a
     * mail provider is configured, and the UI must not offer a flow that
     * silently sends nothing. Better to grey it out and say why than to show
     * somebody "check your email" for a letter nobody wrote.
     */
    if (url.pathname === '/api/capabilities') {
      return json({ passwordReset: Boolean(env.RESEND_API_KEY && env.MAIL_FROM) })
    }

    if (url.pathname === '/api/me') {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return json({ error: 'not signed in' }, 401)
      return json({
        user: { id: session.user.id, email: session.user.email, name: session.user.name },
        expiresAt: session.session.expiresAt,
      })
    }

    /**
     * Reading a published build, and the only route here that does not care who
     * you are. Somebody handed a short link should not need an account to open
     * it: that would make publishing useless for the thing it exists for.
     */
    const shared = /^\/api\/b\/([A-Za-z0-9]{1,32})$/.exec(url.pathname)
    if (shared && request.method === 'GET') {
      const found = await read(db, shared[1] as string)
      if (!found) return json({ error: 'no such build' }, 404)
      return json(found)
    }

    if (url.pathname === '/api/builds' || url.pathname.startsWith('/api/builds/')) {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return json({ error: 'not signed in' }, 401)
      const userId = session.user.id

      if (url.pathname === '/api/builds' && request.method === 'GET') {
        return json({ builds: await listMine(db, userId) })
      }

      if (url.pathname === '/api/builds' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const outcome = await publish(db, userId, body)
        if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
        return json(outcome, 201)
      }

      const mine = /^\/api\/builds\/([A-Za-z0-9]{1,32})$/.exec(url.pathname)
      if (mine && request.method === 'DELETE') {
        const gone = await unpublish(db, userId, mine[1] as string)
        // Not found and not yours answer the same way, so this cannot be used
        // to ask whether a given id exists on somebody else's account.
        if (!gone) return json({ error: 'no such build' }, 404)
        return json({ ok: true })
      }

      return json({ error: 'no such route' }, 404)
    }

    return json({ error: 'no such route' }, 404)
  },
}
