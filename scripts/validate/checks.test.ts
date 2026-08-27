import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  checkAssets,
  checkCharset,
  checkCounts,
  checkCurated,
  checkProvenance,
  checkReferences,
  checkRoster,
  checkVocabulary,
  classifyTraits,
  offerableTraits,
  extractUiStrings,
  rosterFromLoot,
} from './checks.ts'
import type { Bundle, Finding, GeneratedFile, SourceFile } from './types.ts'

// ---------------------------------------------------------------------------
// Fixtures. Small by design: every one is a shape lifted from the real data,
// trimmed to the field the check under test reads.
// ---------------------------------------------------------------------------

function generated(name: string, data: unknown, provenance: Record<string, unknown> = {}): GeneratedFile {
  const payloadSha256 = createHash('sha256').update(JSON.stringify(data)).digest('hex')
  return {
    name,
    data,
    payloadSha256,
    provenance: {
      extractedOn: '2026-08-27',
      gameVersion: '138174',
      source: 'Content/Scripts/*.lua',
      generatedBy: 'scripts/extract.mjs',
      sha256: payloadSha256,
      ...provenance,
    },
  }
}

function bundle(parts: Partial<Bundle> = {}): Bundle {
  return {
    generated: [],
    curated: [],
    sources: [],
    baseline: null,
    manifest: null,
    assetFiles: [],
    ...parts,
  }
}

const messages = (findings: Finding[], severity: Finding['severity']) =>
  findings.filter((f) => f.severity === severity).map((f) => f.message)

const source = (path: string, kind: SourceFile['kind'], text: string, legacy = false): SourceFile => ({
  path,
  kind,
  text,
  ...(legacy ? { legacy: true } : {}),
})

// ---------------------------------------------------------------------------

describe('provenance', () => {
  it('accepts a file whose payload matches its recorded checksum', () => {
    const findings = checkProvenance(bundle({ generated: [generated('traits', { A: {} })] }))
    expect(messages(findings, 'fail')).toEqual([])
  })

  it('rejects a payload that was hand edited after extraction', () => {
    const file = generated('traits', { A: {} })
    // What a hand edit looks like by the time the loader sees it: the payload
    // changed, so the hash the loader computes no longer matches the recorded one.
    file.data = { A: {}, B: { HandAdded: true } }
    file.payloadSha256 = createHash('sha256').update(JSON.stringify(file.data)).digest('hex')
    const findings = checkProvenance(bundle({ generated: [file] }))
    expect(messages(findings, 'fail')).toEqual(['traits.json payload does not match its recorded checksum'])
  })

  it('rejects a file with no checksum at all', () => {
    const file = generated('traits', { A: {} })
    delete file.provenance!.sha256
    expect(messages(checkProvenance(bundle({ generated: [file] })), 'fail')).toEqual([
      'traits.json provenance is missing sha256',
    ])
  })

  it('rejects a directory that is only half re-extracted', () => {
    const findings = checkProvenance(
      bundle({
        generated: [generated('traits', { A: {} }), generated('loot', {}, { gameVersion: '140000' })],
      }),
    )
    expect(messages(findings, 'fail')).toEqual([
      'data/generated holds 2 different game versions, so it is only half re-extracted',
    ])
  })
})

// ---------------------------------------------------------------------------

describe('references', () => {
  const traits = { ZeusWeaponBoon: {}, HeraWeaponBoon: {}, StormRingBoon: { InheritFrom: ['SynergyTrait'] }, SynergyTrait: {} }

  it('passes when every reference resolves', () => {
    const findings = checkReferences(
      bundle({
        generated: [
          generated('traits', traits),
          generated('requirements', { StormRingBoon: { OneFromEachSet: [['ZeusWeaponBoon'], ['HeraWeaponBoon']] } }),
          generated('linked-trait-sets', { ZeusCoreTraits: ['ZeusWeaponBoon'] }),
        ],
      }),
    )
    expect(messages(findings, 'fail')).toEqual([])
  })

  it('fails on a prerequisite naming a trait that does not exist, and says where', () => {
    const findings = checkReferences(
      bundle({
        generated: [
          generated('traits', traits),
          generated('requirements', { StormRingBoon: { OneFromEachSet: [['ZeusWeaponBoon'], ['PoseidonGhostBoon']] } }),
        ],
      }),
    )
    expect(messages(findings, 'fail')).toEqual([
      '1 trait references do not resolve to a record in traits.json',
    ])
    expect(findings.find((f) => f.severity === 'fail')?.detail?.[0]).toBe(
      'PoseidonGhostBoon  <-  requirements.json StormRingBoon.OneFromEachSet[1]',
    )
  })

  it('fails on a loot list offering a trait that does not exist', () => {
    const findings = checkReferences(
      bundle({
        generated: [
          generated('traits', traits),
          generated('loot', { Zeus: { ZeusUpgrade: { Traits: ['ZeusWeaponBoon', 'GhostBoon'] } } }),
        ],
      }),
    )
    expect(findings.find((f) => f.severity === 'fail')?.detail?.[0]).toBe(
      'GhostBoon  <-  loot.json Zeus.ZeusUpgrade.Traits',
    )
  })

  it('fails on an Arcana grid naming a card that does not exist', () => {
    const findings = checkReferences(
      bundle({
        generated: [
          generated('traits', traits),
          generated('arcana-cards', { CastBuff: { TraitName: 'ZeusWeaponBoon' } }),
          generated('arcana-layout', [['CastBuff', 'NotACard']]),
        ],
      }),
    )
    expect(messages(findings, 'fail')).toEqual(['1 Arcana references do not resolve to a card'])
  })
})

// ---------------------------------------------------------------------------

describe('classification', () => {
  // The shape that matters: a duo is a duo because it inherits SynergyTrait,
  // not because it states two prerequisite sets. Four real duos state three.
  const traits = {
    SynergyTrait: { DebugOnly: true, IsDuoBoon: true, Frame: 'Duo' },
    LegendaryTrait: { DebugOnly: true },
    AetherBoon: { DebugOnly: true },
    StormRingBoon: { InheritFrom: ['SynergyTrait'] },
    GoodStuffBoon: { InheritFrom: ['SynergyTrait', 'AetherBoon'] },
    DoubleExManaBoon: { InheritFrom: ['LegendaryTrait'] },
    MoonBeamAresTalent: { IsDuoBoon: true },
    ZeusWeaponBoon: { InheritFrom: ['BaseTrait'] },
    BaseTrait: {},
  }
  const requirements = {
    StormRingBoon: { OneFromEachSet: [['a'], ['b']] },
    GoodStuffBoon: { OneFromEachSet: [['a'], ['b'], ['c']] },
    DoubleExManaBoon: { OneFromEachSet: [['a'], ['b'], ['c']] },
    WeakVulnerabilityBoon: { OneOf: ['a', 'b'] },
  }

  it('counts a three-set duo as a duo, not a legendary', () => {
    const found = classifyTraits(traits, requirements)
    expect(found.duos).toEqual(['GoodStuffBoon', 'StormRingBoon'])
    expect(found.legendaries).toEqual(['DoubleExManaBoon'])
  })

  it('keeps the Hex duos separate, since their gate is game state', () => {
    expect(classifyTraits(traits, requirements).hexDuos).toEqual(['MoonBeamAresTalent'])
  })

  it('leaves the base templates out, DebugOnly and all', () => {
    const found = classifyTraits(traits, requirements)
    expect([...found.duos, ...found.legendaries, ...found.hexDuos]).not.toContain('SynergyTrait')
  })

  it('reads OneOf as the gated form', () => {
    expect(classifyTraits(traits, requirements).gated).toEqual(['WeakVulnerabilityBoon'])
  })
})

// ---------------------------------------------------------------------------

describe('counts against the baseline', () => {
  const generatedFiles = [
    generated('traits', { A: { Icon: 'Boon_A' }, B: {} }),
    generated('requirements', {}),
    generated('text-traits', { A: { name: 'Alpha' } }),
  ]

  it('fails when a count moves and the game build did not', () => {
    const findings = checkCounts(
      bundle({
        generated: generatedFiles,
        baseline: { gameVersion: '138174', counts: { traits: 3 }, coverage: {} },
      }),
    )
    const failure = findings.find((f) => f.severity === 'fail')
    expect(failure?.message).toBe('1 structural counts moved since the baseline')
    expect(failure?.detail?.[0]).toBe('traits: 3 -> 2')
    expect(failure?.detail?.at(-1)).toContain('this is the extractor changing shape, not the game')
  })

  it('names the patch when the game build moved too', () => {
    const findings = checkCounts(
      bundle({
        generated: generatedFiles,
        baseline: { gameVersion: '130000', counts: { traits: 3 }, coverage: {} },
      }),
    )
    expect(findings.find((f) => f.severity === 'fail')?.detail?.at(-1)).toContain('130000 to 138174')
  })

  it('warns when there is no baseline to hold anything to', () => {
    expect(messages(checkCounts(bundle({ generated: generatedFiles })), 'warn')).toEqual([
      'no data/baseline.json, so nothing holds the extractor to its last known output',
    ])
  })
})

// ---------------------------------------------------------------------------

describe('vocabulary', () => {
  const scan = (text: string, kind: SourceFile['kind'] = 'tsx', legacy = false) =>
    checkVocabulary(bundle({ sources: [source('src/Test.tsx', kind, text, legacy)] }))

  it('fails on an internal word in JSX text', () => {
    const findings = scan('export const A = () => <p>Pick a door</p>')
    expect(messages(findings, 'fail')).toEqual(['1 UI strings use an internal word'])
    expect(findings[0]?.detail?.[0]).toContain('say "Exit", not "Door"')
  })

  it('fails on an internal word in a string literal and a template', () => {
    expect(messages(scan('const label = "next room"'), 'fail')).toHaveLength(1)
    expect(messages(scan('const label = `this biome`'), 'fail')).toHaveLength(1)
  })

  it('leaves code identifiers alone, since only UI strings are player facing', () => {
    const text = ['const key = "DoorIcon"', 'const table = "RoomData"', 'const set = "BiomeSets"'].join('\n')
    expect(messages(scan(text), 'fail')).toEqual([])
  })

  it('leaves comments alone', () => {
    const text = ['// the door is called an Exit', '/* room, biome */', 'const a = 1'].join('\n')
    expect(messages(scan(text), 'fail')).toEqual([])
  })

  it('takes an escape on the line for the rare legitimate use', () => {
    expect(messages(scan('const raw = "door" // enodia-vocab-ok, quoting the Lua field'), 'fail')).toEqual([])
  })

  // A block that opens and closes on one line must not swallow what follows.
  // An earlier version did, and this test read as passing because the next
  // line happened to carry the closing tag.
  it('reads html text nodes but not its script or style blocks', () => {
    const html = [
      '<style>#doors button{color:red}</style>',
      '<p>Ten rooms in</p>',
      '<script>var DOORS = {}; var room = 1;</script>',
      '<p>Pick a door</p>',
    ].join('\n')
    const findings = checkVocabulary(bundle({ sources: [source('page.html', 'html', html)] }))
    expect(messages(findings, 'fail')).toEqual(['2 UI strings use an internal word'])
  })

  it('skips a multi-line script block and resumes after it', () => {
    const html = ['<script>', 'var room = 1;', 'var door = 2;', '</script><p>Ten rooms in</p>'].join('\n')
    const findings = checkVocabulary(bundle({ sources: [source('page.html', 'html', html)] }))
    expect(messages(findings, 'fail')).toEqual(['1 UI strings use an internal word'])
  })

  it('skips an html comment and resumes after it', () => {
    const html = ['<!-- a note about the door', 'and the room -->', '<p>Ten rooms in</p>'].join('\n')
    const findings = checkVocabulary(bundle({ sources: [source('page.html', 'html', html)] }))
    expect(messages(findings, 'fail')).toEqual(['1 UI strings use an internal word'])
  })

  it('reports the legacy page rather than failing the build on it', () => {
    const findings = scan('export const A = () => <p>Ten rooms in</p>', 'tsx', true)
    expect(messages(findings, 'fail')).toEqual([])
    expect(messages(findings, 'warn')).toHaveLength(1)
  })
})

describe('extractUiStrings', () => {
  it('reads a template literal that spans lines', () => {
    const text = ['const a = `first', 'second`', 'const b = 1'].join('\n')
    const found = extractUiStrings(source('src/A.ts', 'ts', text))
    expect(found.map((f) => f.text)).toContain('first\nsecond'.split('\n')[1])
  })

  it('reads css content strings and nothing else', () => {
    const found = extractUiStrings(source('src/a.css', 'css', '.x::after{content:"a door"}\n.y{color:red}'))
    expect(found.map((f) => f.text)).toEqual(['a door'])
  })
})

// ---------------------------------------------------------------------------

describe('roster', () => {
  // Poseidon states no GodLoot and inherits true from BaseLoot. Hermes states
  // false. Selene inherits from nothing. Reading the flag without following
  // InheritFrom would drop an Olympian, which is the MaxGodsPerRun mistake.
  const loot = {
    Loot: { BaseLoot: { GodLoot: true }, WeaponUpgrade: { GodLoot: false, Traits: ['StaffTrait'] } },
    Poseidon: {
      PoseidonUpgrade: { Speaker: 'NPC_Poseidon_01', InheritFrom: ['BaseLoot'], Traits: ['PoseidonWeaponBoon'] },
    },
    Hermes: {
      HermesUpgrade: {
        Speaker: 'NPC_Hermes_01',
        GodLoot: false,
        InheritFrom: ['BaseLoot'],
        Traits: ['HermesWeaponBoon'],
      },
    },
    Selene: { SpellDrop: { Speaker: 'NPC_Selene_01', InheritFrom: [] } },
  }

  it('counts a god that inherits GodLoot as an Olympian', () => {
    expect(rosterFromLoot(loot).olympians).toContain('Poseidon')
  })

  it('leaves out the ones that state GodLoot false or inherit nothing', () => {
    const { olympians, gods } = rosterFromLoot(loot)
    expect(olympians).not.toContain('Hermes')
    expect(olympians).not.toContain('Selene')
    expect(gods).toContain('Hermes')
  })

  it('counts a god with a Speaker and no trait list, and not the shared weapon pool', () => {
    const { gods } = rosterFromLoot(loot)
    expect(gods).toContain('Selene')
    expect(gods).not.toContain('Loot')
  })

  it('fails an app file that has grown its own list of gods', () => {
    const text = 'const gods = ["Poseidon", "Hermes", "Selene"]'
    const findings = checkRoster(
      bundle({ generated: [generated('loot', loot)], sources: [source('src/gods.ts', 'ts', text)] }),
    )
    expect(messages(findings, 'fail')).toEqual(['src/gods.ts names 3 gods as string literals'])
  })

  it('allows an app file naming one god, which is a caption and not a roster', () => {
    const findings = checkRoster(
      bundle({
        generated: [generated('loot', loot)],
        sources: [source('src/caption.ts', 'ts', 'const who = "Poseidon"')],
      }),
    )
    expect(messages(findings, 'fail')).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('curated records', () => {
  const generatedFiles = [generated('traits', { StormRingBoon: {} })]
  const curatedFile = (json: unknown) => bundle({ generated: generatedFiles, curated: [{ path: 'data/curated/x.json', json }] })

  it('reports an orphan rather than dropping it', () => {
    const findings = checkCurated(
      curatedFile({ knownGaps: [], records: [{ id: 'RemovedInPatchBoon', aliases: [] }] }),
    )
    expect(messages(findings, 'warn')).toEqual(['1 records in data/curated/x.json resolve to nothing generated'])
    expect(messages(findings, 'fail')).toEqual([])
  })

  it('resolves a renamed record through its aliases', () => {
    const findings = checkCurated(
      curatedFile({ knownGaps: [], records: [{ id: 'OldName', aliases: ['StormRingBoon'] }] }),
    )
    expect(messages(findings, 'warn')).toEqual([])
  })

  it('fails a record with no aliases array', () => {
    const findings = checkCurated(curatedFile({ knownGaps: [], records: [{ id: 'StormRingBoon' }] }))
    expect(messages(findings, 'fail')).toEqual(['data/curated/x.json records[0] (StormRingBoon) has no aliases array'])
  })

  it('fails a rating whose source is neither curator nor wiki', () => {
    const findings = checkCurated(
      curatedFile({ knownGaps: [], records: [{ id: 'StormRingBoon', aliases: [], source: 'youtube' }] }),
    )
    expect(messages(findings, 'fail')).toEqual(['data/curated/x.json records[0] (StormRingBoon) has source "youtube"'])
  })

  it('fails a rule that cannot explain itself', () => {
    const findings = checkCurated(
      curatedFile({ knownGaps: [], records: [{ id: 'StormRingBoon', aliases: [], delta: 25 }] }),
    )
    expect(messages(findings, 'fail')).toEqual(['data/curated/x.json records[0] (StormRingBoon) is a rule with no say'])
  })

  it('fails a file with no knownGaps array', () => {
    const findings = checkCurated(curatedFile({ records: [] }))
    expect(messages(findings, 'fail')).toEqual(['data/curated/x.json has no knownGaps array'])
  })
})

// ---------------------------------------------------------------------------

describe('the offerable set', () => {
  const traits = {
    SynergyTrait: { DebugOnly: true, IsDuoBoon: true },
    ZeusWeaponBoon: {},
    HermesWeaponBoon: {},
    ChaosBlessingBoon: {},
    StormRingBoon: { InheritFrom: ['SynergyTrait'] },
    NotOfferedTemplate: {},
  }
  const loot = {
    Zeus: { ZeusUpgrade: { Traits: ['ZeusWeaponBoon'], WeaponUpgrades: ['ZeusWeaponBoon'] } },
    Hermes: { HermesUpgrade: { Traits: ['HermesWeaponBoon'] } },
    Chaos: { TrialUpgrade: { PermanentTraits: ['ChaosBlessingBoon'], TemporaryTraits: [] } },
  }

  it('gathers every pool, including the two fields only Chaos uses', () => {
    expect(offerableTraits(traits, loot)).toContain('ChaosBlessingBoon')
    expect(offerableTraits(traits, loot)).toContain('HermesWeaponBoon')
  })

  it('adds the kinds that arrive by prerequisite rather than from a pool', () => {
    expect(offerableTraits(traits, loot)).toContain('StormRingBoon')
  })

  it('leaves out a trait no pool offers', () => {
    expect(offerableTraits(traits, loot)).not.toContain('NotOfferedTemplate')
  })

  it('leaves out a pool entry the trait data does not define', () => {
    const withGhost = { Zeus: { ZeusUpgrade: { Traits: ['ZeusWeaponBoon', 'GhostBoon'] } } }
    expect(offerableTraits(traits, withGhost)).not.toContain('GhostBoon')
  })
})

// ---------------------------------------------------------------------------

describe('assets', () => {
  const traits = { ZeusWeaponBoon: {}, RapidHackTrait: {} }
  const loot = { Zeus: { ZeusUpgrade: { Traits: ['ZeusWeaponBoon', 'RapidHackTrait'] } } }
  const names = { ZeusWeaponBoon: { name: 'Heaven Strike' }, RapidHackTrait: { name: 'Rapid Hack' } }
  const generatedFiles = [
    generated('traits', traits),
    generated('loot', loot),
    generated('text-traits', names),
    generated('requirements', {}),
  ]
  const manifest = {
    assets: [{ id: 'heaven-strike', category: 'boons', file: 'boons/heaven-strike.webp' }],
  }
  const withAssets = (parts: Partial<Bundle> = {}) =>
    bundle({ generated: generatedFiles, manifest, assetFiles: ['boons/heaven-strike.webp'], ...parts })

  it('fails a trait that has neither art nor a recorded gap', () => {
    const findings = checkAssets(withAssets())
    expect(messages(findings, 'fail')).toEqual(['1 traits have neither art nor a recorded gap'])
  })

  it('accepts a gap that is recorded, with its reason', () => {
    const curated = [
      {
        path: 'data/curated/icons.json',
        json: { knownGaps: [{ id: 'RapidHackTrait', why: 'not in GUI.pkg and the wiki scrape missed it' }], records: [] },
      },
    ]
    const findings = checkAssets(withAssets({ curated }))
    expect(messages(findings, 'fail')).toEqual([])
    expect(findings[0]?.message).toContain('1 of 2 offerable traits and 0 of 0 weapon aspects have art')
  })

  it('accepts an override onto a file the slug rule cannot reach', () => {
    const curated = [
      {
        path: 'data/curated/icons.json',
        json: { knownGaps: [], records: [{ id: 'RapidHackTrait', aliases: [], asset: 'hammers/rapid-27s-hack.webp' }] },
      },
    ]
    expect(messages(checkAssets(withAssets({ curated })), 'fail')).toEqual([])
  })

  it('warns when a recorded gap has quietly been filled', () => {
    const curated = [
      { path: 'data/curated/icons.json', json: { knownGaps: ['ZeusWeaponBoon', 'RapidHackTrait'], records: [] } },
    ]
    expect(messages(checkAssets(withAssets({ curated })), 'warn')).toEqual(['1 recorded gaps now have art'])
  })

  it('fails a manifest that names a file which is not on disk', () => {
    const findings = checkAssets(withAssets({ assetFiles: [] }))
    expect(messages(findings, 'fail')).toContain('1 manifest entries name a file that is not on disk')
  })

  it('fails an image on disk that the manifest does not list', () => {
    const findings = checkAssets(withAssets({ assetFiles: ['boons/heaven-strike.webp', 'boons/stray.webp'] }))
    expect(messages(findings, 'fail')).toContain('1 images on disk are not in the manifest')
  })

  it('warns when one slug is claimed by two different images', () => {
    const shadowing = {
      assets: [
        { id: 'coat-melinoe', category: 'aspects', file: 'aspects/coat-melinoe.png', sha256: 'aaa' },
        { id: 'coat-melinoe', category: 'hammers', file: 'hammers/coat-melinoe.webp', sha256: 'bbb' },
      ],
    }
    const findings = checkAssets(
      withAssets({ manifest: shadowing, assetFiles: ['aspects/coat-melinoe.png', 'hammers/coat-melinoe.webp'] }),
    )
    expect(messages(findings, 'warn')).toContain('1 slugs are claimed by two different images')
  })

  it('stays quiet about the same picture shelved twice', () => {
    const twice = {
      assets: [
        { id: 'arterial-spray', category: 'boons', file: 'boons/arterial-spray.webp', sha256: 'same' },
        { id: 'arterial-spray', category: 'duos', file: 'duos/arterial-spray.webp', sha256: 'same' },
      ],
    }
    const findings = checkAssets(
      withAssets({ manifest: twice, assetFiles: ['boons/arterial-spray.webp', 'duos/arterial-spray.webp'] }),
    )
    expect(messages(findings, 'warn')).not.toContain('1 slugs are claimed by two different images')
  })

  it('fails when there is no manifest at all', () => {
    const findings = checkAssets(bundle({ generated: generatedFiles }))
    expect(messages(findings, 'fail')).toEqual(['no assets/manifest.json'])
  })
})

// ---------------------------------------------------------------------------

describe('charset', () => {
  it('passes when the charset meta comes first', () => {
    const html = '<head><meta charset="utf-8"><meta name="viewport" content="a"></head>'
    expect(messages(checkCharset(bundle({ sources: [source('index.html', 'html', html)] })), 'fail')).toEqual([])
  })

  it('fails when anything else comes first', () => {
    const html = '<head><meta name="viewport" content="a"><meta charset="utf-8"></head>'
    expect(messages(checkCharset(bundle({ sources: [source('index.html', 'html', html)] })), 'fail')).toHaveLength(1)
  })

  it('fails when there is no meta at all', () => {
    expect(
      messages(checkCharset(bundle({ sources: [source('index.html', 'html', '<head></head>')] })), 'fail'),
    ).toEqual(['index.html has no meta tags at all'])
  })
})
