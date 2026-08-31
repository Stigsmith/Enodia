/**
 * The game's own UI furniture, pulled out of the extraction by name.
 *
 *   npm run chrome
 *
 * `scripts/assets.ts --fill` finds art by matching the trait data's `Icon`
 * fields against the extraction. Chrome has no trait data behind it: a pause
 * box or a button plate is chosen because somebody looked at it and said that
 * one. So this is a hand-written table, and the table is the record of who
 * picked what and for what.
 *
 * It copies. It does not describe: **`npm run assets` is the only writer of
 * `assets/manifest.json`**, and this script tells you to run it.
 *
 * Two rules it enforces, both learned the hard way:
 *
 * - **A slug that already exists is a collision, not an overwrite.**
 *   `buildIconIndex` takes the first entry per slug and directory order decides
 *   which, so a `gifts/zeus.png` would quietly outrank `gods/zeus.webp` and
 *   change every god portrait in the app. Anything that would collide is
 *   refused and named.
 * - **Already there is not the same as missing.** Six of the files asked for on
 *   28 August 2026 were on the shelf already, byte for byte, under the names
 *   the app already uses: the four rarity icons, the tooltip backing and one
 *   resource backing. The script compares checksums and says so rather than
 *   making a second copy under a third name.
 */

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

import { slugify } from '../src/data/icons.ts'

const ROOT = resolve(import.meta.dirname, '..')
const ASSETS = join(ROOT, 'assets')
const GUI = join(ROOT, 'extracted/gui/textures/GUI')
/**
 * `ScriptsBase.pkg`, extracted separately.
 *
 * Two packages, two trees, and the second one was invisible to this script
 * until the Exit reward marker turned out to live in it. A pick names its tree.
 */
const SCRIPTSBASE = join(ROOT, 'extracted/scriptsbase/textures')
/** `GUI.pkg` also carries a top-level Items tree beside its GUI one. */
const ITEMS = join(ROOT, 'extracted/gui/textures/Items')

type Pick = {
  /** path under the tree named by `tree`, which defaults to GUI.pkg's GUI */
  from: string
  /** which extraction tree `from` is relative to */
  tree?: 'gui' | 'items' | 'scriptsbase'
  /** path under assets/ */
  to: string
  /** what it is for, in the owner's words where there are any */
  note: string
}

/**
 * The picks, 28 August 2026, chosen by the owner from the extraction.
 *
 * Grouped the way they were asked for rather than by folder, because the
 * grouping is the intent and the folder is an accident of how Supergiant
 * organises a package.
 */
const PICKS: Pick[] = [
  // The boon slot plates are already here as frames/plate-*.png, one per
  // rarity. This is the lit overlay the game draws on the hovered one, and it
  // is 1280x320 like the plates, so it lands on them exactly.
  {
    from: 'Screens/BoonSelect/BoonHighlightOut/BoonHighlightOut0001.png',
    to: 'frames/plate-highlight.png',
    note: 'the lit overlay on a hovered boon slot, same 1280x320 as the plates',
  },

  // The HUD's objective bar, for the picker's own step titles.
  {
    from: 'HUD/ObjectiveBG.png',
    to: 'shell/objective-bar.png',
    note: 'title bar, 1280x88. "What did this Exit give"',
  },

  // The save slot, which is the game's own card, for the build manager.
  {
    from: 'Screens/SaveProfileSlot.png',
    to: 'shell/slot-card.png',
    note: 'card backing, 425x630 portrait. One build in the build manager',
  },
  {
    from: 'Screens/SaveProfileSlotHighlight.png',
    to: 'shell/slot-card-highlight.png',
    note: 'the same card, lit, for hover',
  },

  // Panels, large enough to hold a paragraph.
  { from: 'Shell/background_confirm.png', to: 'shell/box-confirm.png', note: 'large textbox, 1287x794' },
  { from: 'Shell/Box_Pause.png', to: 'shell/box-pause.png', note: 'large textbox, 1173x1063' },
  { from: 'Shell/Box_HalfScreen.png', to: 'shell/box-halfscreen.png', note: 'large textbox, 1248x1104' },

  // Panels for a line or two.
  { from: 'ResourceBacking.png', to: 'shell/resource-backing.png', note: 'small text window' },
  { from: 'ResourceBacking_Harvest.png', to: 'shell/resource-backing-harvest.png', note: 'small text window' },
  { from: 'ResourceBacking_Long.png', to: 'shell/resource-backing-long.png', note: 'small text window, wide' },
  { from: 'TimerBacking.png', to: 'shell/timer-backing.png', note: 'small text window' },
  { from: 'Screens/SpellScreen/SpellScreenSlot.png', to: 'shell/spell-slot.png', note: 'textbox' },
  {
    from: 'Screens/SpellScreen/SpellScreenSlotHighlight.png',
    to: 'shell/spell-slot-highlight.png',
    note: 'textbox, hovered',
  },

  // Buttons, each with the state the game draws under the cursor.
  { from: 'Shell/button.png', to: 'shell/button.png', note: 'button' },
  { from: 'Shell/button_highlight.png', to: 'shell/button-highlight.png', note: 'button, hovered' },
  { from: 'Screens/TradeScreen/button-cancel.png', to: 'shell/button-cancel.png', note: 'cancel' },
  {
    from: 'Screens/TradeScreen/button-cancel_highlight.png',
    to: 'shell/button-cancel-highlight.png',
    note: 'cancel, hovered',
  },
  { from: 'Screens/TradeScreen/button-confirm.png', to: 'shell/button-confirm.png', note: 'confirm' },
  {
    from: 'Screens/TradeScreen/button-confirm_highlight.png',
    to: 'shell/button-confirm-highlight.png',
    note: 'confirm, hovered',
  },
  { from: 'ConfirmButton.png', to: 'shell/confirm-button.png', note: 'confirm, round' },
  { from: 'ConfirmButtonHighlight.png', to: 'shell/confirm-button-highlight.png', note: 'confirm, round, hovered' },
  { from: 'ExitButton.png', to: 'shell/exit-button.png', note: 'exit, round' },
  { from: 'ExitButtonHighlight.png', to: 'shell/exit-button-highlight.png', note: 'exit, round, hovered' },
  { from: 'InfoButton.png', to: 'shell/info-button.png', note: 'info, round' },
  { from: 'InfoButtonHighlight.png', to: 'shell/info-button-highlight.png', note: 'info, round, hovered' },
  { from: 'TrashButton.png', to: 'shell/trash-button.png', note: 'bin, for the build manager' },
  { from: 'TrashButtonHilight.png', to: 'shell/trash-button-highlight.png', note: 'bin, hovered' },

  // A row you pick from.
  { from: 'Screens/Narration-In/ChoiceBox_01.png', to: 'shell/choicebox.png', note: 'choice box' },
  {
    from: 'Screens/Narration-In/ChoiceBox_MouseOver01.png',
    to: 'shell/choicebox-highlight.png',
    note: 'choice box, hovered',
  },

  // Everything else that frames rather than fills.
  { from: 'Tooltip_Backing_01.png', to: 'shell/tooltip-backing.png', note: 'tooltip' },
  { from: 'SideBars_01.png', to: 'shell/sidebars.png', note: 'sidebars, 380x1080' },
  { from: 'Screens/DialogueBoxOlympian-In/DialogueBoxOlympian-In0016.png', to: 'shell/dialogue-olympian.png', note: 'Olympian dialogue box' },
  { from: 'Screens/BoonSelect/BoonSelectMelOut/BoonSelectMelOut0001.png', to: 'shell/backdrop-mel.png', note: 'backdrop' },

  // Splash art. The chrome/victory-* already on the shelf are the 1920x360
  // banners off the same screens, not these.
  { from: 'Screens/VictoryScreenUnderworld/VictoryScreenUnderworld.png', to: 'shell/splash-underworld.png', note: 'splash' },
  { from: 'Screens/VictoryScreenSurface/VictoryScreenSurface.png', to: 'shell/splash-surface.png', note: 'splash' },
  { from: 'Screens/VictoryScreenDreamRun/VictoryScreenDreamRun.png', to: 'shell/splash-dreamrun.png', note: 'splash' },

  // Frame candidates for the radial bubbles, 28 August 2026. The shelf already
  // held frames/circle.png (BoonSelect's stone ring), chrome/circle-filigree.png
  // (which is UnlockTextCircleBacking, a filled disc with flourishes rather
  // than a ring) and the seven rounded-square BoonIconFrames. These are the
  // rest of what the package offers in that shape.
  { from: 'Screens/TalentScreen/TalentTreeIconsUnlocked.png', to: 'frames/starburst.png', note: 'frame, bright' },
  { from: 'Screens/TalentScreen/TalentTreeIconsLocked.png', to: 'frames/starburst-dark.png', note: 'frame, dark' },
  { from: 'Screens/TalentScreen/TalentTreeIconsHilight.png', to: 'frames/halo.png', note: 'a filled glow, for behind' },
  { from: 'Screens/CosmeticIcons/cosmetic_cauldronRing01.png', to: 'frames/orbit.png', note: 'a thin band, not a full ring' },

  // The tray, in the pieces the owner asked for. TraitTrayBacking is the one
  // with a header baked in, which is why two of them side by side never lined
  // up; _NoHeader is the plain panel and it tiles.
  { from: 'HUD/TraitTrayBacking_NoHeader.png', to: 'shell/tray-panel.png', note: 'page backdrop, plain' },
  { from: 'HUD/TraitTrayHeader.png', to: 'shell/tray-header.png', note: 'tray header ribbon' },
  { from: 'HUD/TraitTrayTab.png', to: 'shell/tray-tab.png', note: 'tab' },
  { from: 'HUD/TraitTrayTabHighlight.png', to: 'shell/tray-tab-highlight.png', note: 'tab, hovered' },

  // Circles that are actually circles, drawn face on rather than in world
  // space. These are what the radial has been wanting all along.
  {
    from: 'Fx/HeroTouchdownCircles/HeroTouchdownCircleA.png',
    to: 'frames/circle-script.png',
    tree: 'scriptsbase',
    note: 'a witch circle, script around the rim',
  },
  {
    from: 'Fx/HeroTouchdownCircles/HeroTouchdownCircleB.png',
    to: 'frames/circle-script-b.png',
    tree: 'scriptsbase',
    note: 'the same with a triangle inscribed',
  },
  {
    from: 'Fx/Sorcery/SorceryWolfHowlDecal.png',
    to: 'shell/sorcery-circle.png',
    tree: 'scriptsbase',
    note: 'the radial backdrop: a lit nonagram',
  },

  // Icons.
  { from: 'Loot/PreviewOnly/Story.png', to: 'icons/story.png', tree: 'items', note: 'a Story Exit, Echo or Medea' },
  { from: 'Loot/MysteryResource.png', to: 'icons/mystery.png', tree: 'items', note: 'something unknown' },
  {
    from: 'Loot/PreviewOnly/ChaosGate.png',
    to: 'icons/chaos-gate.png',
    tree: 'items',
    note: 'a Chaos gate. LootData_Chaos carries a DoorIcon, so it is a real Exit reward',
  },
  {
    from: 'Screens/QuestLogScreen/questComplete.png',
    to: 'icons/complete.png',
    tree: 'scriptsbase',
    note: 'a checkmark',
  },
  {
    from: 'GUI/Screens/MetaUpgrade/MaxUpgrade.png',
    to: 'icons/max-upgrade.png',
    tree: 'scriptsbase',
    note: 'at its maximum',
  },
  { from: 'Icons/LoadingSymbol_01.png', to: 'icons/loading.png', note: 'a witch sigil, for waiting' },
  { from: 'Shell/OptionSelectorIcon.png', to: 'icons/selected.png', note: 'what is chosen, in a menu' },

  // Backdrops and furniture held for later.
  {
    from: 'LocationBackings/PalaceofZeusBacking/PalaceofZeusBacking.png',
    to: 'shell/backing-palace-of-zeus.png',
    note: 'an Olympian theme, later',
  },
  { from: 'LocationBackings/LocationBackingStar.png', to: 'shell/location-star.png', note: 'a Location nameplate rule' },
  { from: 'LobSpecialDecal.png', to: 'shell/lob-decal.png', note: 'an astrolabe, as a backdrop' },
  {
    from: 'Screens/DialogueBox-Loop/DialogueBoxStatic.png',
    to: 'shell/dialogue-static.png',
    note: 'the dialogue box everyone who is not an Olympian gets',
  },
  { from: 'Screens/DialogueContinueArrow.png', to: 'icons/continue.png', note: 'a pointer, downwards' },

  // Rarity. All four were already on the shelf under the name the app uses,
  // byte for byte, and they stay in the table so it is a complete record of
  // what was asked for rather than of what happened to be missing.
  { from: 'Icons/CardRarityIcon_Common.png', to: 'rarity/common.png', note: 'rarity' },
  { from: 'Icons/CardRarityIcon_Rare.png', to: 'rarity/rare.png', note: 'rarity' },
  { from: 'Icons/CardRarityIcon_Epic.png', to: 'rarity/epic.png', note: 'rarity' },
  { from: 'Icons/CardRarityIcon_Heroic.png', to: 'rarity/heroic.png', note: 'rarity' },

  // The game's own UI icons. Their own shelf, because ui/ is the wiki's
  // section icons and mixing the two makes the source unreadable.
  { from: 'Icons/Boon.png', to: 'icons/boon.png', note: 'a boon, generically' },
  { from: 'Icons/Currency_Big.png', to: 'icons/currency.png', note: 'gold' },
  { from: 'Icons/ReRoll.png', to: 'icons/reroll.png', note: 'reroll or randomise' },
  { from: 'Screens/Inventory/Icon-Inventory.png', to: 'icons/inventory.png', note: 'inventory' },
  { from: 'Screens/NewStar.png', to: 'icons/new-star.png', note: 'warning, or new' },
  { from: 'Icons/Status/Startled.png', to: 'icons/startled.png', note: 'unknown, question mark' },
  { from: 'Icons/Status/WantsToTalk_Important.png', to: 'icons/wants-to-talk.png', note: 'warning, alternate' },
]

/**
 * Whole folders, slugified as they stand.
 *
 * `suffix` exists for one reason: the Keepsake gift art is one image per
 * character and every name in it already belongs to `gods/` or `characters/`.
 * Without it, `gifts/` sorts before `gods/` and silently wins every collision.
 */
const SWEEPS: { from: string; to: string; suffix?: string; prefix?: string; note: string }[] = [
  {
    from: 'Shell',
    to: 'shell',
    note: "the game's own menu furniture, whole. Buttons, arrows, boxes, selectors",
  },
  { from: 'Screens/FamiliarIcons', to: 'familiars', note: 'the five familiars, their skins and their stat icons' },
  {
    from: 'Screens/AwardMenu/KeepsakeMaxGift/KeepsakeMaxGift_big',
    to: 'gifts',
    suffix: '-gift',
    note: 'the Keepsake max gift portraits, a possible alternate to gods/ and characters/',
  },
]

const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

/** Every slug already on the shelf, and the file that holds it. */
function existingSlugs(): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(webp|png|jpg|jpeg)$/i.test(entry.name)) {
        const slug = slugify(basename(entry.name).replace(/\.[^.]+$/, ''))
        if (!out.has(slug)) out.set(slug, full.slice(ASSETS.length + 1).replace(/\\/g, '/'))
      }
    }
  }
  walk(ASSETS)
  return out
}

if (!existsSync(GUI)) {
  console.log('no extracted/ directory, so there is nothing to copy from.')
  console.log('Re-create it with the deppth2 command in assets/README.md.')
  process.exit(0)
}

const slugs = existingSlugs()
/** slug to the path it came from, for anything this run is about to write. */
const claimed = new Map<string, string>()

let copied = 0
let already = 0
const refused: string[] = []
const collided: string[] = []

const TREES = { gui: GUI, items: ITEMS, scriptsbase: SCRIPTSBASE }

function take(from: string, to: string, note: string, tree: keyof typeof TREES = 'gui') {
  const src = join(TREES[tree], from)
  if (!existsSync(src)) {
    refused.push(`${from} is not in the extraction`)
    return
  }

  const dest = join(ASSETS, to)
  const slug = slugify(basename(to).replace(/\.[^.]+$/, ''))
  const held = slugs.get(slug)

  // Already on the shelf under this exact name: only the bytes matter.
  if (existsSync(dest)) {
    if (sha(dest) === sha(src)) {
      already += 1
      return
    }
  } else if (held) {
    // Same slug, different file. Whichever sorts first would win, which is a
    // coin toss dressed as a rule.
    collided.push(`${to} would collide with ${held} on the slug "${slug}"`)
    return
  }

  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  slugs.set(slug, to)
  claimed.set(slug, to)
  copied += 1
  const kb = Math.round(statSync(dest).size / 1024)
  console.log(`  ${to.padEnd(38)} ${String(kb).padStart(5)} KB  ${note}`)
}

console.log('picks:')
for (const pick of PICKS) take(pick.from, pick.to, pick.note, pick.tree ?? 'gui')

for (const sweep of SWEEPS) {
  const dir = join(GUI, sweep.from)
  if (!existsSync(dir)) {
    refused.push(`${sweep.from} is not in the extraction`)
    continue
  }
  const files = readdirSync(dir).filter((name) => /\.png$/i.test(name))
  console.log(`\n${sweep.to}/  (${files.length} files, ${sweep.note}):`)
  for (const name of files) {
    const slug = `${sweep.prefix ?? ''}${slugify(name.replace(/\.[^.]+$/, ''))}${sweep.suffix ?? ''}`
    take(join(sweep.from, name).replace(/\\/g, '/'), `${sweep.to}/${slug}.png`, sweep.note)
  }
}

console.log(`\n${copied} copied, ${already} already on the shelf byte for byte.`)

if (collided.length) {
  console.log(`\n${collided.length} refused, because the slug is taken:`)
  for (const line of collided) console.log(`  ${line}`)
  console.log('  Rename the destination. The first entry per slug wins and directory order decides which.')
}

if (refused.length) {
  console.log(`\n${refused.length} not found:`)
  for (const line of refused) console.log(`  ${line}`)
}

console.log('\nRun npm run assets to describe them in assets/manifest.json.')
