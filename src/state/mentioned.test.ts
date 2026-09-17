// @vitest-environment jsdom

/**
 * Finding the build a mention names.
 *
 * What has to hold is that only a real absence is drawn as withdrawn, that a
 * refused or failed read is not, and that a rate limit stops the reads rather
 * than spending the rest of the budget.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FIRST_BUILD } from '../data/builds.fixture.ts'
import { saveBuild } from './builds.ts'
import { fetchMentioned, forgetMentioned, fromLibrary, knownMention } from './mentioned.ts'
import { setOffers } from './offers.ts'
import { packBuild } from './transfer.ts'

const answer = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

const fetched = vi.fn<(url: string) => Promise<Response>>()

beforeEach(() => {
  window.localStorage.clear()
  forgetMentioned()
  fetched.mockReset()
  vi.stubGlobal('fetch', fetched)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the library first', () => {
  it('finds a build of yours by the id it was published under', () => {
    saveBuild({ ...FIRST_BUILD, id: 'mine-1', by: 'owner', publishedAs: 'aB3xK9pQmR', publishedDown: true })
    const found = fromLibrary('aB3xK9pQmR')
    expect(found).toMatchObject({ state: 'found', local: 'mine-1', takenDown: true })
  })

  it('finds a build you follow by the id it came from, and knows when its author took it down', () => {
    saveBuild({ ...FIRST_BUILD, id: 'theirs-1', by: 'community', derivedFrom: 'Zz9yX8wV7u' })
    expect(fromLibrary('Zz9yX8wV7u')).toMatchObject({ state: 'found', local: 'theirs-1', takenDown: false })
    setOffers({ 'theirs-1': { kind: 'takenDown', from: 'Zz9yX8wV7u', at: 1 } })
    expect(fromLibrary('Zz9yX8wV7u')).toMatchObject({ takenDown: true })
  })

  it('does not hold a build it was never given', () => {
    expect(fromLibrary('aB3xK9pQmR')).toBeNull()
  })
})

describe('asking the worker', () => {
  it('reads a published build, under the name its listing carries', async () => {
    fetched.mockResolvedValue(answer(200, { payload: await packBuild(FIRST_BUILD), name: 'Listed Name', revision: 2, takenDown: false }))
    const found = await fetchMentioned('aB3xK9pQmR')
    expect(fetched).toHaveBeenCalledWith('/api/b/aB3xK9pQmR')
    expect(found).toMatchObject({ state: 'found', local: null, takenDown: false })
    expect(found.state === 'found' && found.build.name).toBe('Listed Name')
  })

  it('calls a 404 gone, and does not ask again', async () => {
    fetched.mockResolvedValue(answer(404, { error: 'no such build' }))
    expect(await fetchMentioned('aB3xK9pQmR')).toEqual({ state: 'gone' })
    expect(await fetchMentioned('aB3xK9pQmR')).toEqual({ state: 'gone' })
    expect(knownMention('aB3xK9pQmR')).toEqual({ state: 'gone' })
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it('does not ask about an id the route would refuse', async () => {
    expect(await fetchMentioned('not_an-id')).toEqual({ state: 'gone' })
    expect(fetched).not.toHaveBeenCalled()
  })

  /* The failure this file exists to prevent: a reader whose connection
     dropped being told the builds in a guide were withdrawn. */
  it('calls an offline read unknown, not gone, and asks again once a minute has passed', async () => {
    fetched.mockRejectedValue(new TypeError('Failed to fetch'))
    const now = Date.now()
    expect(await fetchMentioned('aB3xK9pQmR', now)).toEqual({ state: 'unknown' })
    expect(await fetchMentioned('aB3xK9pQmR', now + 1000)).toEqual({ state: 'unknown' })
    expect(fetched).toHaveBeenCalledTimes(1)

    fetched.mockResolvedValue(answer(404))
    expect(await fetchMentioned('aB3xK9pQmR', Date.now() + 61_000)).toEqual({ state: 'gone' })
    expect(fetched).toHaveBeenCalledTimes(2)
  })

  it('calls a server error unknown, not gone', async () => {
    fetched.mockResolvedValue(answer(500, { error: 'server misconfigured' }))
    expect(await fetchMentioned('aB3xK9pQmR')).toEqual({ state: 'unknown' })
  })

  it('stops asking about anything once refused, until the refusal has passed', async () => {
    fetched.mockResolvedValue(answer(429, { error: 'Too many requests.' }, { 'retry-after': '30' }))
    expect(await fetchMentioned('aB3xK9pQmR')).toEqual({ state: 'unknown' })
    expect(await fetchMentioned('Zz9yX8wV7u')).toEqual({ state: 'unknown' })
    expect(await fetchMentioned('Qq2wE3rT4y')).toEqual({ state: 'unknown' })
    expect(fetched).toHaveBeenCalledTimes(1)

    fetched.mockResolvedValue(answer(404))
    expect(await fetchMentioned('Zz9yX8wV7u', Date.now() + 31_000)).toEqual({ state: 'gone' })
    expect(fetched).toHaveBeenCalledTimes(2)
  })

  it('shares one request between everything asking about the same id at once', async () => {
    fetched.mockResolvedValue(answer(404))
    await Promise.all([fetchMentioned('aB3xK9pQmR'), fetchMentioned('aB3xK9pQmR'), fetchMentioned('aB3xK9pQmR')])
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it('calls a payload that will not unpack gone', async () => {
    fetched.mockResolvedValue(answer(200, { payload: 'not a build', name: 'X', revision: 1, takenDown: false }))
    expect(await fetchMentioned('aB3xK9pQmR')).toEqual({ state: 'gone' })
  })
})
