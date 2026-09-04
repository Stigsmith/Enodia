/**
 * Reading a password reset arrival out of the URL.
 *
 * `resetInUrl` is pure, so this runs in Node. It is small, and it is the one
 * piece of the reset flow this project wrote rather than inherited: everything
 * either side of it is better-auth's. Getting it wrong strands somebody who
 * clicked a link in an email, which is the failure this whole flow exists to
 * prevent, and it would do so silently by rendering the ordinary app.
 *
 * The shapes asserted here are not invented. They were read off the deployed
 * Worker, which answers the link in the letter with a 302 to one of exactly two
 * places:
 *
 *   https://enodia.me/?token=YSM7MIVmt2EWRtjOoBo0VUKw#reset
 *   https://enodia.me/?error=INVALID_TOKEN#reset
 *
 * better-auth builds both with `URL.searchParams.set`, which is why the answer
 * is always a query parameter and the `#reset` fragment always survives it.
 */

import { describe, expect, it } from 'vitest'

import { resetInUrl } from './account.ts'

describe('arriving from the letter', () => {
  it('reads the token the Worker actually redirects with', () => {
    expect(resetInUrl('?token=YSM7MIVmt2EWRtjOoBo0VUKw')).toEqual({
      token: 'YSM7MIVmt2EWRtjOoBo0VUKw',
    })
  })

  /**
   * The common failure, and it has to be told apart from "no arrival at all".
   * A letter sits in an inbox for a day and the token lasts an hour, so the
   * dead link is the one most people will click. Rendering the ordinary app
   * with no explanation would read as the tool being broken rather than as
   * them being slow.
   */
  it('reads an expired or already used link', () => {
    expect(resetInUrl('?error=INVALID_TOKEN')).toEqual({ expired: true })
  })

  it('is nothing at all on an ordinary visit', () => {
    expect(resetInUrl('')).toBeNull()
    expect(resetInUrl('?')).toBeNull()
  })

  /**
   * A share link carries its build in the fragment, never the query, and
   * `buildInUrl` looks for `build=`. The two cannot be confused, but this
   * pins it: an arrival check that fired on a shared build would replace
   * somebody's build with a password form.
   */
  it('ignores a query that is not about a reset', () => {
    expect(resetInUrl('?utm_source=discord')).toBeNull()
    expect(resetInUrl('?build=Zsomethingpacked')).toBeNull()
  })

  /** The token wins if both somehow appear. A usable token beats an error. */
  it('prefers a token over an error', () => {
    expect(resetInUrl('?error=INVALID_TOKEN&token=abc123')).toEqual({ token: 'abc123' })
  })

  /** An empty token is not a token, and must not draw a form that cannot work. */
  it('treats an empty token as no arrival', () => {
    expect(resetInUrl('?token=')).toBeNull()
  })

  /** Leading `?` or not, because callers pass `location.search` straight in. */
  it('does not care about the leading question mark', () => {
    expect(resetInUrl('token=abc123')).toEqual({ token: 'abc123' })
  })
})
