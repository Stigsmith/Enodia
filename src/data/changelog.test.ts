/**
 * The changelog's versions, which a reader uses to say which release they mean.
 *
 * Newest first, every one different, each a step down from the one above it,
 * dated no later than the one above it, and the newest is the version
 * `package.json` says the app is. A release added without a version, or with
 * one out of order, fails here rather than on the page.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { CHANGELOG } from './changelog.ts'

const parts = (version: string) => version.split('.').map(Number)

const newer = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)]
  for (let at = 0; at < 3; at++) if ((x[at] ?? 0) !== (y[at] ?? 0)) return (x[at] ?? 0) > (y[at] ?? 0)
  return false
}

describe('the changelog', () => {
  it('gives every release a version of three numbers', () => {
    for (const release of CHANGELOG) expect(release.version, release.title).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('runs newest first, by version and by date', () => {
    for (let at = 1; at < CHANGELOG.length; at++) {
      const [above, below] = [CHANGELOG[at - 1]!, CHANGELOG[at]!]
      expect(newer(above.version, below.version), `${above.version} above ${below.version}`).toBe(true)
      expect(above.date >= below.date, `${above.version} dated before ${below.version}`).toBe(true)
    }
  })

  it('has the newest release be the version the app says it is', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
    expect(CHANGELOG[0]?.version).toBe(pkg.version)
  })
})
