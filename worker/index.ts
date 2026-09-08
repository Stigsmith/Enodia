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
 *   /api/builds        publish one, list yours, replace one, take one down
 *   /api/b/<id>        read a published build. PUBLIC, because that is the point
 *   /api/sync          everything an account carries between devices
 *   /api/exchange      the picked shelf. PUBLIC, and every item was chosen by hand
 *   /api/exchange/all  everything published and still up. PUBLIC
 *   /api/exchange/friends  what the people you added have published
 *   /api/exchange/mine  your own listings, taken-down ones included
 *   /api/exchange/boards  leaderboards, global or among your friends. PUBLIC
 *   /api/exchange/<id>/...  take a copy, report a run, rate one, pick one
 *   /api/friends       your code, redeem one, your list, remove one
 *   /api/friends/feed  what your friends have published
 *
 * **Some of this is discoverable now, and that is a decision rather than a
 * drift.** `REQUIREMENTS.md` 5 wanted moderation designed before anything
 * discoverable existed, and for a long time nothing here was: a published build
 * was unlisted, the exchange's two shelves were the owner's own picks and the
 * builds of people you added by code, and every item on both had passed a human.
 *
 * `/api/exchange/all` crosses that line deliberately, and the owner made the
 * call knowing it. What tipped it was that the old arrangement failed in the
 * other direction: an account's own listings appeared on no shelf, so the app
 * that published them could not show them back. Opening the everything shelf and
 * adding `/api/exchange/mine` are the same fix from two sides.
 *
 * **There is still no report and no hide, and that is worth stating plainly.**
 * The argument for shipping without them is narrow: a listing carries a build
 * name and an author's display name and no other text a stranger wrote, so there
 * is nothing here to moderate that is not already on the picked shelf. The
 * remedies that exist are the author taking their own listing down and the
 * curator un-picking. `worker/exchange.ts` holds the fuller version, and says
 * what adding a hide would cost if it becomes necessary.
 *
 * Friends is still not discovery: a list you build one person at a time from
 * codes you were given by hand, and the moderation tool for it is removing
 * somebody.
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
import { RULES, keyFor, take as take_limit } from './limit.ts'
import {
  buildsOfFriend,
  codeFor,
  friendsFeed,
  listFriends,
  redeem,
  rotateCode,
  unfriend,
} from './friends.ts'
import { listMine, publish, putBack, read, republish, takeDown } from './publish.ts'
import {
  everything,
  fromFriends,
  myShelf,
  pick,
  picked,
  played,
  rate,
  take,
} from './exchange.ts'
import { boards } from './boards.ts'
import { sync } from './sync.ts'
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
      const over = await take_limit(db, keyFor.address('read', request), RULES.read)
      if (over) return tooMany(over.retryAfter)
      const found = await read(db, shared[1] as string)
      if (!found) return json({ error: 'no such build' }, 404)
      return json(found)
    }

    /**
     * Everything an account carries between devices, in one exchange.
     *
     * Its own rule rather than `own`, because this is the one route a person
     * hits without doing anything: it runs on sign-in and after edits, where
     * every other route here is somebody pressing a button. Counting it against
     * the same budget as reading your own list would let ordinary use of one
     * exhaust the other.
     */
    /**
     * The picked shelf, and the only exchange route a stranger can reach.
     *
     * Public because every build on it was chosen by hand and signed, so there
     * is nothing here that arrived unread. Rate limited on the address like the
     * other public route, because there is no account to count against.
     */
    if (url.pathname === '/api/exchange' && request.method === 'GET') {
      const over = await take_limit(db, keyFor.address('read', request), RULES.read)
      if (over) return tooMany(over.retryAfter)
      /**
       * Signed in or not, and the shelf is the same either way.
       *
       * The session is read only so a row can be marked as the reader's own.
       * It is optional: this route is public, a stranger gets the shelf without
       * one, and the mark is simply absent for them. What goes back is a
       * boolean, never the id it was compared against.
       */
      const who = await auth.api.getSession({ headers: request.headers }).catch(() => null)
      return json({ builds: await picked(db, who?.user.id ?? null) })
    }

    /**
     * Everything published, and the second route a stranger can reach.
     *
     * Public for the same reason the picked shelf is, which is now a thinner
     * argument than it was: `worker/exchange.ts` carries it, and the short
     * version is that this shelf shows a build name and a display name, both of
     * which already travel on the picked shelf. Rate limited on the address
     * because there is no account to count against, and it must be taken before
     * the session lookup below or a signed-out reader would fall into it.
     */
    if (url.pathname === '/api/exchange/all' && request.method === 'GET') {
      const over = await take_limit(db, keyFor.address('read', request), RULES.read)
      if (over) return tooMany(over.retryAfter)
      const who = await auth.api.getSession({ headers: request.headers }).catch(() => null)
      return json({ builds: await everything(db, who?.user.id ?? null) })
    }

    /**
     * The leaderboards, both scopes on one route.
     *
     * Public at `scope=global` for the same reason the shelves above it are,
     * and it has to sit before the prefix branch to stay that way. `friends`
     * needs an account because it is a question about your account, and it is
     * the one case here where 401 is the honest answer rather than an empty
     * board: a stranger has no friends to scope to, not zero of them.
     *
     * One rate limit on the address covers both. The screen fetches one scope
     * at a time and switching is a fetch, so the counter is per look rather
     * than per board.
     */
    if (url.pathname === '/api/exchange/boards' && request.method === 'GET') {
      const over = await take_limit(db, keyFor.address('read', request), RULES.read)
      if (over) return tooMany(over.retryAfter)
      const scope = url.searchParams.get('scope') === 'friends' ? 'friends' : 'global'
      const who = await auth.api.getSession({ headers: request.headers }).catch(() => null)
      if (scope === 'friends' && !who) return json({ error: 'not signed in' }, 401)
      return json({ boards: await boards(db, scope, who?.user.id ?? null) })
    }

    if (url.pathname.startsWith('/api/exchange')) {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return json({ error: 'not signed in' }, 401)
      const userId = session.user.id

      const over = await take_limit(db, keyFor.user('own', userId), RULES.own)
      if (over) return tooMany(over.retryAfter)

      if (url.pathname === '/api/exchange/friends' && request.method === 'GET') {
        return json({ builds: await fromFriends(db, userId) })
      }

      /* Your own inventory, so it needs the account and nothing else. Taken-down
         rows come back on this one alone; see `myShelf`. */
      if (url.pathname === '/api/exchange/mine' && request.method === 'GET') {
        return json({ builds: await myShelf(db, userId) })
      }

      const one = /^\/api\/exchange\/([A-Za-z0-9]{1,32})\/(take|played|rate|pick)$/.exec(
        url.pathname,
      )
      if (one && request.method === 'POST') {
        const buildId = one[1] as string
        const what = one[2] as string
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

        if (what === 'take') {
          const outcome = await take(db, userId, buildId)
          if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
          return json(outcome)
        }

        if (what === 'played') {
          const outcome = await played(
            db,
            userId,
            buildId,
            body.cleared === true,
            typeof body.fear === 'number' && Number.isFinite(body.fear) ? body.fear : null,
            // Which version the player was holding. Absent from an older
            // client, which `played` reads as "cannot be stale".
            typeof body.shape === 'string' ? body.shape : undefined,
          )
          if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
          return json(outcome)
        }

        if (what === 'rate') {
          const outcome = await rate(db, userId, buildId, Number(body.rating))
          if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
          return json(outcome)
        }

        /**
         * Curating, and the one route with an owner check on it.
         *
         * `CURATOR_USER_ID` is a var rather than a role column because there is
         * exactly one curator. Unset means nobody can curate, which is the right
         * default for a deployment that is not this one.
         */
        if (!env.CURATOR_USER_ID || userId !== env.CURATOR_USER_ID) {
          return json({ error: 'no such route' }, 404)
        }
        const outcome = await pick(
          db,
          buildId,
          typeof body.note === 'string' ? body.note : null,
        )
        if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
        return json(outcome)
      }

      return json({ error: 'no such route' }, 404)
    }

    if (url.pathname === '/api/sync' && request.method === 'POST') {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return json({ error: 'not signed in' }, 401)

      const over = await take_limit(db, keyFor.user('sync', session.user.id), RULES.sync)
      if (over) return tooMany(over.retryAfter)

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
      const outcome = await sync(db, session.user.id, body)
      if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
      return json(outcome)
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
      const writes = request.method === 'POST' || request.method === 'PUT'
      const rule = url.pathname.startsWith('/api/builds') && writes ? 'publish' : 'own'
      const over = await take_limit(db, keyFor.user(rule, userId), RULES[rule])
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

      /**
       * Replace one of yours in place.
       *
       * `PUT` rather than another `POST` to the collection, because the whole
       * point is that this addresses a listing that already exists rather than
       * making a second one. Counted under `publish` rather than `own`: it
       * writes a payload, so it belongs with the rule that bounds writing
       * payloads.
       */
      if (mine && request.method === 'PUT') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const outcome = await republish(db, userId, mine[1] as string, body)
        if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
        return json(outcome)
      }

      /**
       * DELETE is still the verb, and it still takes the build off the shelves.
       * What it no longer does is destroy the row: see `takeDown`. The method
       * is kept because that is what a caller means by it, and because the
       * alternative is a second spelling of the same intention.
       */
      if (mine && request.method === 'DELETE') {
        const down = await takeDown(db, userId, mine[1] as string)
        // Not found and not yours answer the same way, so this cannot be used
        // to ask whether a given id exists on somebody else's account.
        if (!down) return json({ error: 'no such build' }, 404)
        return json({ ok: true })
      }

      /**
       * Putting one back needs its own route rather than riding on republish.
       *
       * `GET /api/builds` returns no payload, so an author's own inventory
       * cannot put a build back by republishing it: it does not hold the build
       * to send. And a restore must not move `revision`, or every follower
       * would be told there was a change to look at when there was none.
       */
      const restore = /^\/api\/builds\/([A-Za-z0-9]{1,32})\/restore$/.exec(url.pathname)
      if (restore && request.method === 'POST') {
        const back = await putBack(db, userId, restore[1] as string)
        if (!back) return json({ error: 'no such build' }, 404)
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
      const over = await take_limit(db, keyFor.user(rule, userId), RULES[rule])
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
