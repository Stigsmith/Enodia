/**
 * Which traits make the damage the game calls Olympian, and which read that list.
 *
 * Three records multiply or charge off "damaging effects from Olympians", and
 * the game states what that phrase means as two lists of names rather than as a
 * set of gods: `WeaponSets.OlympianProjectileNames`, 63 projectiles, and
 * `OlympianEffectNames`, 3 effects. **The projectile list names Artemis and
 * Athena**, who have no `LootData` entry and never spend an Olympian slot, so
 * the word here is not the word the cap uses.
 *
 * ## What counts as making it
 *
 * No trait record says "I fire ZeusEchoStrike" in one field, so this reads the
 * three shapes that do say it, and nothing else:
 *
 * - **`ExtractValues` with `BaseType` `Projectile` or `ProjectileBase`.** The
 *   trait's own stat line is computed from that projectile's damage, so the
 *   number the boon prints is that projectile's number. Heaven Strike reads
 *   `ZeusEchoStrike`
 * - **Function arguments naming a `ProjectileName`, `ProjectileNames` or an
 *   `EffectName`.** The trait spawns it or applies it. Flame Strike applies
 *   `BurnEffect` from `OnEnemyDamagedAction`
 * - **A `PropertyChanges` entry setting a weapon's `Projectile`.** Divine Dash
 *   makes Sprint fire `AthenaRushProjectile`
 *
 * **Two shapes are left out on purpose**, because both mean "somebody else's
 * projectile, changed" rather than "mine":
 *
 * - Anything inside `AddOutgoingDamageModifiers`, where `ProjectileName` and
 *   `ValidProjectiles` pick out what a modifier applies to. Master Conductor
 *   adds 0.15 per jump to `ProjectileZeusSpark`, and Static Shock is what fires
 *   it
 * - A `PropertyChanges` entry naming a `ProjectileName`, which changes that
 *   projectile's own properties. Coffin Nail moves `ProjectileAresSwordWake`'s
 *   fuse, and Stabbing Rush is what fires it
 *
 * ## Who reads the list
 *
 * Found rather than named: a trait whose record holds an array equal to one of
 * the two lists. The game assigns them by reference, so they come through the
 * extractor as copies and comparing the contents is exact. Three traits do
 * today, and a patch adding a fourth needs no edit here.
 *
 * ## What it cannot see, which is why the warning only states the positive
 *
 * 51 of the 66 names have a trait that makes them. Five of the rest are Region
 * traps, under a `-- Traps` comment in `WeaponSets.lua`, and no boon fires
 * those. The others are weapon variants whose link to a boon lives in the
 * per-weapon data, which is not loaded, and `CLAUDE.md` carries that note. So
 * this table **undercounts and never overcounts**: a pick it lists does make
 * damage on the list, and a pick it leaves out may still do so.
 */

const isDict = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** One listed name a trait makes, and the field that says so. */
export type OlympianSource = { name: string; at: string }

export type OlympianTrace = {
  /** `OlympianProjectileNames`, in the game's own order */
  projectiles: string[]
  /** `OlympianEffectNames` */
  effects: string[]
  /** trait id, to what its damage comes out of */
  makes: Map<string, OlympianSource[]>
  /** the traits that multiply damage from the list, or charge off it */
  readers: string[]
}

const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) && value.every((one) => typeof one === 'string') ? (value as string[]) : []

/** Inside a damage modifier, where a projectile name says what is modified. */
const modifier = (trail: string[]) => trail.some((key) => key.startsWith('AddOutgoingDamageModifiers'))

/** Inside a property change, where a projectile name says what is changed. */
const changed = (trail: string[]) => trail.includes('PropertyChanges')

export function traceOlympian(weaponSets: unknown, traits: Record<string, unknown>): OlympianTrace {
  const sets = isDict(weaponSets) ? weaponSets : {}
  const projectiles = stringsOf(sets.OlympianProjectileNames)
  const effects = stringsOf(sets.OlympianEffectNames)
  const listed = new Set([...projectiles, ...effects])
  const lists = new Set([projectiles.join('|'), effects.join('|')])

  const makes = new Map<string, OlympianSource[]>()
  const readers = new Set<string>()

  const note = (id: string, name: string, at: string) => {
    const held = makes.get(id) ?? []
    if (!held.some((one) => one.name === name)) held.push({ name, at })
    makes.set(id, held)
  }

  const walk = (node: unknown, trail: string[], id: string): void => {
    if (Array.isArray(node)) {
      // A copy of one of the two lists is what makes a trait a reader.
      const strings = stringsOf(node)
      if (strings.length && lists.has(strings.join('|'))) readers.add(id)
      if (trail[trail.length - 1] === 'ProjectileNames' && !modifier(trail) && !changed(trail)) {
        for (const one of strings) if (listed.has(one)) note(id, one, trail.join('.'))
      }
      for (const one of node) walk(one, [...trail, '[]'], id)
      return
    }
    if (!isDict(node)) return

    for (const [key, value] of Object.entries(node)) {
      if (typeof value !== 'string' || !listed.has(value)) continue
      const at = [...trail, key].join('.')
      // The trait's own number is that projectile's number.
      if (key === 'BaseName' && (node.BaseType === 'Projectile' || node.BaseType === 'ProjectileBase')) {
        note(id, value, at)
        continue
      }
      // It makes a weapon fire it.
      if (key === 'Projectile' && trail[trail.length - 1] === 'WeaponProperties') {
        note(id, value, at)
        continue
      }
      // It spawns it or applies it, as long as this is neither a modifier's
      // filter nor a change to a projectile somebody else fires.
      if ((key === 'ProjectileName' || key === 'EffectName') && !modifier(trail) && !changed(trail)) {
        note(id, value, at)
      }
    }
    for (const [key, value] of Object.entries(node)) walk(value, [...trail, key], id)
  }

  for (const [id, record] of Object.entries(traits)) walk(record, [], id)

  return { projectiles, effects, makes, readers: [...readers].sort() }
}
