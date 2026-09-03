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
 *   /api/friends       your code, redeem one, your list, remove one
 *   /api/friends/feed  what your friends have published
 *
 * **Nothing here is discoverable, which is the line that matters.** A published
 * build is unlisted: no gallery, no index, no search, and a random id rather
 * than a sequential one, so it is reachable only by whoever was handed the link.
 * Friends is a list you build one person at a time from codes you were given by
 * hand, so it is not discovery either, and the moderation tool for it is
 * removing somebody.
 *
 * `REQUIREMENTS.md` 5 wants moderation designed before anything discoverable
 * exists. **Leaderboards would be the first thing that crosses that line**, and
 * they are still not here.
 *
 * ## Limits
 *
 * better-auth limits `/api/auth/*` and can see nothing else, so everything
 * above was unlimited until `worker/limit.ts`. Every route here now takes one
 * counter before it does any work: the public read on the caller's address,
 * the rest on the account. `limit.ts` holds the numbers and the reasoning.
 */

import { drizzle } from 'drizzle-orm/d1'

import { createAuth } from './auth.ts'
import { RULES, keyFor, take } from './limit.ts'
import {
  buildsOfFriend,
  codeFor,
  friendsFeed,
  listFriends,
  redeem,
  rotateCode,
  unfriend,
} from './friends.ts'
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

/**
 * A refusal from `limit.ts`, in the shape the client already reads.
 *
 * `src/state/publish.ts` shows `body.error` verbatim on any non-ok response, so
 * this sentence is what somebody sees. It says how long, because "too many
 * requests" with no number is indistinguishable from being broken.
 *
 * `retry-after` is the standard header and is seconds. better-auth sends
 * `X-Retry-After` for the same thing on its own routes, which is not the
 * standard name; both are set here so a client written against either works.
 */
const tooMany = (retryAfter: number) =>
  new Response(
    JSON.stringify({
      error: `Too many requests. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
    }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'retry-after': String(retryAfter),
        'x-retry-after': String(retryAfter),
      },
    },
  )

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
      // Counted before the lookup, not after. A limiter that runs once the work
      // is done has already paid for the work.
      const over = await take(db, keyFor.address('read', request), RULES.read)
      if (over) return tooMany(over.retryAfter)
      const found = await read(db, shared[1] as string)
      if (!found) return json({ error: 'no such build' }, 404)
      return json(found)
    }

    if (url.pathname === '/api/builds' || url.pathname.startsWith('/api/builds/')) {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return json({ error: 'not signed in' }, 401)
      const userId = session.user.id

      /**
       * One check for the whole group, with publishing counted separately.
       *
       * Publishing is the only route under here that creates something, so it
       * gets its own rule and its own counter. Everything else is reading or
       * removing your own things and shares `own`, which is generous enough
       * that a person cannot reach it and low enough to bound a script.
       */
      const rule = url.pathname === '/api/builds' && request.method === 'POST' ? 'publish' : 'own'
      const over = await take(db, keyFor.user(rule, userId), RULES[rule])
      if (over) return tooMany(over.retryAfter)

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

    /**
     * Friends. Every route here needs a session, and none of them is public:
     * unlike a published build, there is nothing here a stranger should reach.
     */
    if (url.pathname === '/api/friends' || url.pathname.startsWith('/api/friends/')) {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return json({ error: 'not signed in' }, 401)
      const userId = session.user.id

      /* Redeeming looks up a string the caller chose, so it is the one route
       * here that reads on a stranger's say-so. Its own counter, for that. */
      const rule =
        url.pathname === '/api/friends/redeem' && request.method === 'POST' ? 'redeem' : 'own'
      const over = await take(db, keyFor.user(rule, userId), RULES[rule])
      if (over) return tooMany(over.retryAfter)

      if (url.pathname === '/api/friends' && request.method === 'GET') {
        return json({ friends: await listFriends(db, userId) })
      }

      if (url.pathname === '/api/friends/code' && request.method === 'GET') {
        return json({ code: await codeFor(db, userId) })
      }

      if (url.pathname === '/api/friends/code' && request.method === 'POST') {
        return json({ code: await rotateCode(db, userId) })
      }

      if (url.pathname === '/api/friends/redeem' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const outcome = await redeem(db, userId, body.code)
        if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
        return json({ friend: outcome }, 201)
      }

      if (url.pathname === '/api/friends/feed' && request.method === 'GET') {
        return json({ builds: await friendsFeed(db, userId) })
      }

      const one = /^\/api\/friends\/([A-Za-z0-9]{1,64})$/.exec(url.pathname)
      if (one && request.method === 'DELETE') {
        const gone = await unfriend(db, userId, one[1] as string)
        if (!gone) return json({ error: 'not on your list' }, 404)
        return json({ ok: true })
      }

      const theirs = /^\/api\/friends\/([A-Za-z0-9]{1,64})\/builds$/.exec(url.pathname)
      if (theirs && request.method === 'GET') {
        const builds = await buildsOfFriend(db, userId, theirs[1] as string)
        // Not a friend and no such account answer identically. Telling them
        // apart would make this a way to ask who has an account here.
        if (!builds) return json({ error: 'not on your list' }, 404)
        return json({ builds })
      }

      return json({ error: 'no such route' }, 404)
    }

    return json({ error: 'no such route' }, 404)
  },
}
