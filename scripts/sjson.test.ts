/**
 * The sjson parser, against the shapes the game's files actually use.
 *
 * The first case is the reason the parser exists: a projectile whose nested
 * effect has a `Name` of its own. A walk from one `Name` to the next splits that
 * record in two, which is how the text and animation passes read their files
 * and why they could not read this one.
 */

import { describe, expect, it } from 'vitest'

import { parseSjson } from './sjson.ts'
import type { SjsonObject } from './sjson.ts'

const obj = (value: unknown): SjsonObject => value as SjsonObject

describe('parseSjson', () => {
  it('keeps a nested Name inside the record that declared it', () => {
    const root = obj(
      parseSjson(`{ Projectiles = [
        {
          Name = "1_BaseDamagingProjectile"
          UseArmor = false
          Effects =
          [
            {
              Name = "OnHitStun"
              Duration = 0
            }
          ]
        }
        {
          Name = "ZeusEchoStrike"
          InheritFrom = "ZeusLightningStrikeBase"
          Damage = 100
        }
      ] }`),
    )
    const list = root.Projectiles as SjsonObject[]
    expect(list).toHaveLength(2)
    expect(list[0]?.Name).toBe('1_BaseDamagingProjectile')
    expect(list[0]).not.toHaveProperty('Duration')
    expect(obj((list[0]?.Effects as unknown[])[0]).Name).toBe('OnHitStun')
    expect(list[1]).toEqual({ Name: 'ZeusEchoStrike', InheritFrom: 'ZeusLightningStrikeBase', Damage: 100 })
  })

  it('reads numbers, booleans, null, and keeps a bare word as a string', () => {
    expect(parseSjson('a = -0.5 b = 0.0 c = 1e3 d = 42 e = true f = false g = null h = INSTANT')).toEqual({
      a: -0.5,
      b: 0,
      c: 1000,
      d: 42,
      e: true,
      f: false,
      g: null,
      h: 'INSTANT',
    })
  })

  it('treats commas as optional, takes : for =, and skips both kinds of comment', () => {
    const src = `{
      // a line comment
      Points = [ { X = 48, Y = -48 }, { X: -48 Y: 48 } ] /* a block
      comment */ Speed = 700
    }`
    expect(parseSjson(src)).toEqual({ Points: [{ X: 48, Y: -48 }, { X: -48, Y: 48 }], Speed: 700 })
  })

  it('keeps a triple-quoted string exactly as written', () => {
    expect(parseSjson('Description = """Line one\n"quoted" line two"""')).toEqual({
      Description: 'Line one\n"quoted" line two',
    })
  })

  it('unescapes only a quote and a backslash, so a Windows path survives', () => {
    expect(parseSjson('Path = "GUI\\Screens\\new" Q = "say \\"hi\\""')).toEqual({
      Path: 'GUI\\Screens\\new',
      Q: 'say "hi"',
    })
  })

  it('reads a file whose root has no braces', () => {
    expect(parseSjson('Name = "x"\nValue = 3')).toEqual({ Name: 'x', Value: 3 })
  })

  it('accepts a quoted key', () => {
    expect(parseSjson('{ "odd key" = 1 }')).toEqual({ 'odd key': 1 })
  })

  it('stops a bare word at a comment', () => {
    expect(parseSjson('Speed = 700// fast\nFuse = 0.3')).toEqual({ Speed: 700, Fuse: 0.3 })
  })

  it('says where it failed rather than returning half a file', () => {
    expect(() => parseSjson('{ A = 1\nB = [ 2 3')).toThrow(/never closes/)
    expect(() => parseSjson('A 1')).toThrow(/no = after A at line 1/)
  })
})
