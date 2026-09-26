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
 *   /api/exchange      everything published and still up. PUBLIC
 *   /api/exchange/friends  what the people you added have published
 *   /api/exchange/mine  your own listings, taken-down ones included
 *   /api/exchange/followed  the builds you took up, taken-down ones included
 *   /api/exchange/boards  leaderboards, global or among your friends. PUBLIC
 *   /api/exchange/<id>/...  take a copy, report a run, rate one
 *   /api/friends       your code, redeem one, your list, remove one
 *   /api/friends/feed  what your friends have published
 *   /api/g/<id>        read a guide, with the builds it names. PUBLIC
 *   /api/guides        everybody's guides (PUBLIC), or publish one
 *   /api/guides/mine   the guides you wrote and the ones you saved
 *   /api/guides/<id>/...  replace, take down, put back, save, like, report
 *
 * **Some of this is discoverable now, and that is a decision rather than a
 * drift.** `REQUIREMENTS.md` 5 wanted moderation designed before anything
 * discoverable existed, and for a long time nothing here was: a published build
 * was unlisted, and the exchange showed a hand-picked shelf and the builds of
 * people you added by code, so every item on it had passed a human.
 *
 * `/api/exchange` crosses that line deliberately, and the owner made the call
 * knowing it. What tipped it was that the old arrangement failed in the other
 * direction: an account's own listings appeared on no shelf, so the app that
 * published them could not show them back. Opening the everything shelf and
 * adding `/api/exchange/mine` are the same fix from two sides, and the curated
 * shelf came out with them because one person reading everything is not a thing
 * that scales past one person.
 *
 * **Builds still have no report and no hide, and that is worth stating plainly.**
 * The argument for shipping without them is narrow: a listing carries a build
 * name and an author's display name and no other text a stranger wrote, so
 * there is nothing on it to moderate. **Guides are different and have both**,
 * because a guide is sections of a stranger's writing: see `worker/guides.ts`. The one removal lever is the author taking
 * their own listing down. `worker/exchange.ts` holds the fuller version, and
 * says what adding a hide would cost if it becomes necessary.
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
  followedByYou,
  fromFriends,
  myShelf,
  played,
  rate,
  take,
} from './exchange.ts'
import { boards } from './boards.ts'
import {
  listGuides,
  markGuide,
  myGuides,
  publishGuide,
  putBackGuide,
  readGuide,
  replaceGuide,
  reportGuide,
  takeDownGuide,
} from './guides.ts'
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

/**
 * Two headers on every answer, whichever code wrote it.
 *
 * **`assets/_headers` does not reach anything here.** Cloudflare applies it to
 * static assets and never to a Worker's response, so until this existed every
 * `/api/*` answer went out with neither header, `/api/me` with a name and an
 * email included. Measured under `wrangler dev` on 26 September 2026, and
 * `worker/headers.test.ts` fails if it comes back.
 *
 * `nosniff` so a browser takes `content-type` at its word, which matters here
 * because a guide is text a stranger wrote. `no-store` because an answer about
 * an account belongs to whoever was signed in when it was asked, and a cached
 * one outlives that. Set only where a route has not said otherwise.
 *
 * The rest of `/*` in `_headers` is not repeated, because it is about a page:
 * a content security policy governs a document, and the page that calls this
 * API has already delivered HSTS and the referrer policy for the same host.
 *
 * Copied into a new `Response` rather than edited, because a response's
 * headers can be immutable depending on where it came from. The copy keeps
 * every header, better-auth's `set-cookie` included, and the test signs in with
 * the copied cookie to prove it. An exception thrown out of `route` never
 * reaches here and is answered by workerd itself.
 */
const harden = (response: Response): Response => {
  const out = new Response(response.body, response)
  out.headers.set('x-content-type-options', 'nosniff')
  if (!out.headers.has('cache-control')) out.headers.set('cache-control', 'no-store')
  return out
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return harden(await route(request, env))
  },
}

async function route(request: Request, env: Env): Promise<Response> {
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
   * Guides, read and listed. Public, as a published build and the exchange
   * are, and counted on the caller's address for the same reason.
   *
   * The session is read only to answer questions about the reader: whether
   * the guide is theirs, whether they saved or liked it, and whether a hidden
   * guide is theirs to still see. What goes back is booleans, never the id
   * they were worked out from.
   */
  const aGuide = /^\/api\/g\/([A-Za-z0-9]{1,32})$/.exec(url.pathname)
  if (aGuide && request.method === 'GET') {
    const over = await take_limit(db, keyFor.address('read', request), RULES.read)
    if (over) return tooMany(over.retryAfter)
    const who = await auth.api.getSession({ headers: request.headers }).catch(() => null)
    const found = await readGuide(db, aGuide[1] as string, who?.user.id ?? null)
    if (!found) return json({ error: 'no such guide' }, 404)
    return json(found)
  }

  if (url.pathname === '/api/guides' && request.method === 'GET') {
    const over = await take_limit(db, keyFor.address('read', request), RULES.read)
    if (over) return tooMany(over.retryAfter)
    const who = await auth.api.getSession({ headers: request.headers }).catch(() => null)
    return json({ guides: await listGuides(db, who?.user.id ?? null) })
  }

  /**
   * Everything else about guides needs an account.
   *
   * Three counters: publishing and replacing share `publish` with builds,
   * because both write a payload; reporting has its own low one; the rest is
   * `own`. `worker/guides.ts` says why moderation has no route here.
   */
  if (url.pathname === '/api/guides' || url.pathname.startsWith('/api/guides/')) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return json({ error: 'not signed in' }, 401)
    const userId = session.user.id

    const one = /^\/api\/guides\/([A-Za-z0-9]{1,32})(?:\/(restore|save|like|report))?$/.exec(url.pathname)
    const verb = one?.[2]
    const mine = url.pathname === '/api/guides/mine'
    const writes =
      (url.pathname === '/api/guides' && request.method === 'POST') ||
      (one !== null && !verb && !mine && request.method === 'PUT')
    const rule = writes ? 'publish' : verb === 'report' ? 'report' : 'own'
    const over = await take_limit(db, keyFor.user(rule, userId), RULES[rule])
    if (over) return tooMany(over.retryAfter)

    if (mine && request.method === 'GET') {
      return json(await myGuides(db, userId))
    }

    if (url.pathname === '/api/guides' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
      const outcome = await publishGuide(db, userId, body)
      if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
      return json(outcome, 201)
    }

    if (one && !mine) {
      const id = one[1] as string

      if (!verb && request.method === 'PUT') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const outcome = await replaceGuide(db, userId, id, body)
        if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
        return json(outcome)
      }

      /* Not found and not yours answer alike, as they do for builds. */
      if (!verb && request.method === 'DELETE') {
        if (!(await takeDownGuide(db, userId, id))) return json({ error: 'no such guide' }, 404)
        return json({ ok: true })
      }

      if (verb === 'restore' && request.method === 'POST') {
        if (!(await putBackGuide(db, userId, id))) return json({ error: 'no such guide' }, 404)
        return json({ ok: true })
      }

      if ((verb === 'save' || verb === 'like') && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const outcome = await markGuide(db, userId, id, verb === 'save' ? 'saved' : 'liked', body.on !== false)
        if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
        return json(outcome)
      }

      if (verb === 'report' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const outcome = await reportGuide(db, userId, id, body.reason)
        if ('status' in outcome) return json({ error: outcome.say }, outcome.status)
        return json(outcome)
      }
    }

    return json({ error: 'no such route' }, 404)
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
   * Everything published, and the shelf a stranger lands on.
   *
   * Public, and rate limited on the caller's address because there is no
   * account to count against. A curated shelf used to stand here and be the
   * only thing a signed-out reader could see; `worker/exchange.ts` says why it
   * is gone.
   *
   * Signed in or not, the shelf is the same. The session is read only so a row
   * can be marked as the reader's own, and what goes back is a boolean rather
   * than the id it was compared against.
   */
  if (url.pathname === '/api/exchange' && request.method === 'GET') {
    const over = await take_limit(db, keyFor.address('read', request), RULES.read)
    if (over) return tooMany(over.retryAfter)
    const who = await auth.api.getSession({ headers: request.headers }).catch(() => null)
    return json({ builds: await everything(db, who?.user.id ?? null) })
  }

  /**
   * The leaderboards, both scopes on one route.
   *
   * Public at `scope=global` for the same reason the shelf above it is, and it
   * has to sit before the prefix branch to stay that way. `friends` needs an
   * account because it is a question about your account, and it is the one
   * case here where 401 is the honest answer rather than an empty board: a
   * stranger has no friends to scope to, not zero of them.
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

    /* What you took up. Taken-down listings stay on this one too: a build you
       follow goes on working when its author withdraws it. */
    if (url.pathname === '/api/exchange/followed' && request.method === 'GET') {
      return json({ builds: await followedByYou(db, userId) })
    }

    const one = /^\/api\/exchange\/([A-Za-z0-9]{1,32})\/(take|played|rate)$/.exec(
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

      const outcome = await rate(db, userId, buildId, Number(body.rating))
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
}
