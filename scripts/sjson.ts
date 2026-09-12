/**
 * SJSON, the format the game keeps its engine data in.
 *
 * `Content/Scripts/*.lua` is the logic. What the engine reads without Lua lives
 * beside it under `Content/Game/`: the display text, the animations, and the
 * projectiles. The text and animation passes in `scripts/extract.mjs` get away
 * with walking from one `Id` or `Name` to the next, because a text entry or an
 * animation is one flat block.
 *
 * **A projectile is not flat, and that walk would read it wrong.** A record
 * nests `Effects` and `Thing` tables, and an effect carries a `Name` of its own:
 *
 *     { Name = "1_BaseDamagingProjectile"
 *       Effects = [ { Name = "OnHitStun"  Duration = 0 } ] }
 *
 * Splitting on `Name` cuts that record in two and hands the stun's `Duration`
 * to a projectile called OnHitStun. So this is a parser. The grammar is small,
 * and parsing it is the only way a property is read out of the block that
 * declared it.
 *
 * ## The grammar, as the game's files use it
 *
 * - An object is `{ key = value ... }`. A key is a bare word or a quoted
 *   string, and `:` works in place of `=`.
 * - An array is `[ value ... ]`.
 * - Commas between entries are optional, and ignored where present.
 * - A value is a number, a quoted string, a triple-quoted string, `true`,
 *   `false`, `null`, or a bare word, which is kept as a string.
 * - Line comments and block comments are skipped.
 * - The root is a braced object, or the body of one with no braces.
 *
 * **Only `\"` and `\\` are unescaped inside a string.** The game writes Windows
 * paths with single backslashes, `GUI\Screens\ShrineIcons\VowBlood`, so reading
 * `\n` or `\S` as an escape would put a line break in a file path.
 */

export type Sjson = null | boolean | number | string | Sjson[] | { [key: string]: Sjson }

export type SjsonObject = { [key: string]: Sjson }

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/

/** Characters that end a bare word. A comment start is checked separately. */
const STOPS = new Set([' ', '\t', '\n', '\r', ',', '=', ':', '{', '}', '[', ']', '"'])

export function parseSjson(source: string): Sjson {
  const text = source.replace(/^﻿/, '')
  let at = 0

  const fail = (why: string): never => {
    const line = text.slice(0, at).split('\n').length
    throw new Error(`sjson: ${why} at line ${line}`)
  }

  /** Whitespace, commas and comments: everything that separates and says nothing. */
  const skip = (): void => {
    for (;;) {
      const c = text[at]
      if (c === undefined) return
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',') {
        at += 1
      } else if (c === '/' && text[at + 1] === '/') {
        const end = text.indexOf('\n', at)
        at = end < 0 ? text.length : end + 1
      } else if (c === '/' && text[at + 1] === '*') {
        const end = text.indexOf('*/', at + 2)
        if (end < 0) fail('a block comment that never closes')
        at = end + 2
      } else {
        return
      }
    }
  }

  const word = (): string => {
    const start = at
    for (;;) {
      const c = text[at]
      if (c === undefined || STOPS.has(c)) break
      if (c === '/' && (text[at + 1] === '/' || text[at + 1] === '*')) break
      at += 1
    }
    if (at === start) fail(`an unexpected ${JSON.stringify(text[at] ?? 'end of file')}`)
    return text.slice(start, at)
  }

  const string = (): string => {
    if (text.startsWith('"""', at)) {
      const end = text.indexOf('"""', at + 3)
      if (end < 0) fail('a triple-quoted string that never closes')
      const out = text.slice(at + 3, end)
      at = end + 3
      return out
    }
    at += 1
    let out = ''
    for (;;) {
      const c = text[at]
      if (c === undefined) return fail('a string that never closes')
      if (c === '"') {
        at += 1
        return out
      }
      const next = text[at + 1]
      if (c === '\\' && (next === '"' || next === '\\')) {
        out += next
        at += 2
      } else {
        out += c
        at += 1
      }
    }
  }

  const array = (): Sjson[] => {
    at += 1
    const out: Sjson[] = []
    for (;;) {
      skip()
      const c = text[at]
      if (c === undefined) return fail('an array that never closes')
      if (c === ']') {
        at += 1
        return out
      }
      out.push(value())
    }
  }

  /** An object's body. `braced` says whether a `}` or the end of file closes it. */
  const object = (braced: boolean): SjsonObject => {
    const out: SjsonObject = {}
    for (;;) {
      skip()
      const c = text[at]
      if (c === undefined) {
        if (braced) fail('an object that never closes')
        return out
      }
      if (c === '}') {
        if (!braced) fail('a } with nothing open')
        at += 1
        return out
      }
      const key = c === '"' ? string() : word()
      skip()
      if (text[at] !== '=' && text[at] !== ':') fail(`no = after ${key}`)
      at += 1
      out[key] = value()
    }
  }

  function value(): Sjson {
    skip()
    const c = text[at]
    if (c === '{') {
      at += 1
      return object(true)
    }
    if (c === '[') return array()
    if (c === '"') return string()
    const bare = word()
    if (bare === 'true') return true
    if (bare === 'false') return false
    if (bare === 'null') return null
    return NUMBER.test(bare) ? Number(bare) : bare
  }

  skip()
  let root: Sjson
  if (text[at] === '{') {
    at += 1
    root = object(true)
  } else if (text[at] === '[') {
    root = array()
  } else {
    root = object(false)
  }
  skip()
  if (at < text.length) fail('content after the end of the file')
  return root
}
