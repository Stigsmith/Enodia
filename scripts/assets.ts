/**
 * The image library, and the join onto the trait data. Build order step 3.
 *
 *   npm run assets           rebuild assets/manifest.json from what is on disk
 *   npm run assets -- --fill copy missing icons out of extracted/ first
 *
 * Two jobs, and they belong together because the second changes what the first
 * has to describe.
 *
 * **This script is the only writer of assets/manifest.json.** build-lib.ps1
 * rebuilds the wiki half of the files and used to write the manifest too, which
 * is why the manifest went stale the moment the Arcana were replaced with game
 * art: the PowerShell only ever saw the wiki zips. One writer, walking the real
 * directory, cannot drift from it.
 *
 * The fill reads the deppth2 extraction in extracted/, which is 364 MB of
 * scratch and is not in version control. Without it the fill reports and stops,
 * because a missing extraction is a missing input, not a failure.
 */

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { buildIconIndex, resolveIcon, slugify } from '../src/data/icons.ts'
import type { Manifest, ManifestEntry } from '../src/data/icons.ts'
import { classifyTraits, dictOf, offerableTraits } from './validate/checks.ts'

const ROOT = resolve(import.meta.dirname, '..')
const ASSETS = join(ROOT, 'assets')
const EXTRACTED = join(ROOT, 'extracted')
const MANIFEST = join(ASSETS, 'manifest.json')

const fill = process.argv.includes('--fill')

const IMAGE = /\.(webp|png|jpg|jpeg)$/i
/** A four digit tail is an animation frame, not a still. assets/README.md. */
const ANIMATION_FRAME = /\d{4}\.png$/i
/** The packed sprites drop these prefixes. The data says Boon_Apollo_37, the
 *  file is Apollo_37.png. Concluding absence from the prefix is the mistake
 *  that kept 435 icons hidden for a week. */
const ICON_PREFIX = /^(Boon|Keepsake|Hammer|Shop)_/

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')) as unknown

const generated = (name: string) => dictOf(dictOf(readJson(join(ROOT, `data/generated/${name}.json`))).data)

// ---------------------------------------------------------------------------
// Walking
// ---------------------------------------------------------------------------

/** Every image under assets/, as a path relative to assets/. */
function assetFiles(): string[] {
  const out: string[] = []
  for (const dir of readdirSync(ASSETS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    for (const file of readdirSync(join(ASSETS, dir.name))) {
      if (IMAGE.test(file)) out.push(`${dir.name}/${file}`)
    }
  }
  return out.sort()
}

/** Basename to full path, over the whole extraction. Stills only. */
function extractionIndex(): Map<string, string> {
  const index = new Map<string, string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.png') && !ANIMATION_FRAME.test(entry.name)) {
        const base = entry.name.slice(0, -4)
        if (!index.has(base)) index.set(base, path)
      }
    }
  }
  walk(EXTRACTED)
  return index
}

// ---------------------------------------------------------------------------
// Fill. Every offerable trait that has no image, against the extraction.
// ---------------------------------------------------------------------------

/** Where a filled image lands. Category is organisation, the slug is the join. */
function categoryFor(traitId: string, duos: Set<string>, hexDuos: Set<string>): string {
  if (duos.has(traitId)) return 'duos'
  if (hexDuos.has(traitId)) return 'hexes'
  return 'boons'
}

function runFill(): { copied: number; unsourced: { id: string; name: string; icon: string }[] } {
  const traits = generated('traits')
  const names = generated('text-traits')
  const loot = generated('loot')

  const manifest = existsSync(MANIFEST) ? (readJson(MANIFEST) as Manifest) : { assets: [] }
  const index = buildIconIndex(manifest)
  // The manifest can lag the directory, so consider what is actually there too.
  for (const file of assetFiles()) {
    const slug = file.slice(file.indexOf('/') + 1).replace(IMAGE, '')
    if (!index.has(slug)) index.set(slug, { id: slug, category: file.slice(0, file.indexOf('/')), file })
  }

  const found = classifyTraits(traits, generated('requirements'))
  const duos = new Set(found.duos)
  const hexDuos = new Set(found.hexDuos)

  const extraction = extractionIndex()
  let copied = 0
  const unsourced: { id: string; name: string; icon: string }[] = []

  for (const traitId of offerableTraits(traits, loot)) {
    const displayName = dictOf(names[traitId]).name
    const name = typeof displayName === 'string' ? displayName : null
    if (resolveIcon(traitId, name, index).found) continue

    const icon = dictOf(traits[traitId]).Icon
    const iconName = typeof icon === 'string' ? icon : ''
    const source = extraction.get(iconName.replace(ICON_PREFIX, '')) ?? extraction.get(iconName)

    if (!source || !name) {
      unsourced.push({ id: traitId, name: name ?? '(no display name)', icon: iconName || '(no Icon field)' })
      continue
    }

    const category = categoryFor(traitId, duos, hexDuos)
    const slug = slugify(name)
    mkdirSync(join(ASSETS, category), { recursive: true })
    copyFileSync(source, join(ASSETS, category, `${slug}.png`))
    console.log(`  ${category}/${slug}.png  <-  ${relative(ROOT, source).replaceAll('\\', '/')}`)
    copied += 1
  }

  return { copied, unsourced }
}

// ---------------------------------------------------------------------------
// The manifest, rebuilt from the directory
// ---------------------------------------------------------------------------

function rebuildManifest(): Manifest {
  const previous = existsSync(MANIFEST) ? (readJson(MANIFEST) as Manifest) : { assets: [] }
  const carried = new Map<string, ManifestEntry>()
  for (const entry of previous.assets ?? []) {
    if (typeof entry?.file === 'string') carried.set(entry.file, entry)
  }

  const entries: ManifestEntry[] = assetFiles().map((file) => {
    const bytes = readFileSync(join(ASSETS, file))
    const category = file.slice(0, file.indexOf('/'))
    const id = file.slice(file.indexOf('/') + 1).replace(IMAGE, '')
    const before = carried.get(file)

    const entry: ManifestEntry = {
      id,
      category,
      file,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      // The extension says where an image came from and it has held for every
      // file so far: the wiki scrape wrote .webp, deppth2 writes .png.
      source: file.endsWith('.png') ? 'game' : 'wiki',
    }
    // A wiki image whose manifest row went missing, which happens when a file
    // is moved between categories by hand. The image is fine, the trail is not.
    if (entry.source === 'wiki' && !before?.sourceFile) entry.needsProvenance = true
    if (before?.sourceFile) entry.sourceFile = before.sourceFile
    if (before?.sourcePage) entry.sourcePage = before.sourcePage
    if (before?.weapon) entry.weapon = before.weapon
    if (before?.needsVerification) entry.needsVerification = before.needsVerification
    return entry
  })

  const categories = [...new Set(entries.map((e) => e.category))].sort().map((name) => {
    const inCategory = entries.filter((e) => e.category === name)
    const wiki = inCategory.filter((e) => e.source === 'wiki').length
    return {
      name,
      count: inCategory.length,
      // boons/ is genuinely mixed now: wiki art for what the scrape covered,
      // game art for the 71 it did not.
      source: wiki === inCategory.length ? 'wiki' : wiki === 0 ? 'game' : 'mixed',
      ...(wiki && wiki !== inCategory.length ? { wiki, game: inCategory.length - wiki } : {}),
    }
  })

  const manifest: Manifest = {
    generated: new Date().toISOString().slice(0, 10),
    source: 'hades.fandom.com saved-page archives, plus deppth2 extraction of the game packages',
    generatedBy: 'scripts/assets.ts, the only writer of this file',
    gamePatch: 'UNVERIFIED',
    license:
      'Game art (c) Supergiant Games. Unofficial fan project, non-commercial, not affiliated with or endorsed by Supergiant Games.',
    count: entries.length,
    categories,
    assets: entries,
  }

  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`)
  return manifest
}

// ---------------------------------------------------------------------------

if (fill) {
  if (!existsSync(EXTRACTED)) {
    console.log('no extracted/ directory, so there is nothing to fill from.')
    console.log('Re-create it with the deppth2 command in assets/README.md, then run this again.')
  } else {
    console.log('filling gaps from the game extraction:')
    const { copied, unsourced } = runFill()
    console.log(`\n${copied} images copied in, ${unsourced.length} with no source anywhere:`)
    for (const miss of unsourced) console.log(`  ${miss.id.padEnd(30)} ${miss.name.padEnd(24)} ${miss.icon}`)
  }
  console.log('')
}

const manifest = rebuildManifest()
console.log(`assets/manifest.json rebuilt: ${manifest.count} images`)
for (const category of manifest.categories as { name: string; count: number; source: string }[]) {
  console.log(`  ${String(category.count).padStart(4)}  ${category.name.padEnd(12)} ${category.source}`)
}

const unprovenanced = manifest.assets.filter((entry) => entry.needsProvenance)
if (unprovenanced.length) {
  console.log(`
${unprovenanced.length} wiki images have no source page recorded, probably moved between categories by hand:`)
  for (const entry of unprovenanced) console.log(`  ${entry.file}`)
}
console.log('\nRun npm run validate for the coverage report against the trait data.')
