/**
 * The theme picker. Four rooms, and you choose by looking.
 *
 * **Each panel is painted in the theme it offers.** `tokens.css` scopes every
 * theme block to `[data-theme]` rather than to `:root`, so a card carrying the
 * attribute wears that theme's whole palette: its ground, its light, its
 * accent, its plate. What is in the panel is what lands on the page.
 *
 * Choosing applies it immediately and the picker stays open, because the only
 * way to judge a room is to stand in it. The wallpaper strip underneath is the
 * current theme's own, which is where the old flat list of four went: a
 * wallpaper belongs to a theme rather than to the app.
 */

import { NONE, THEMES, themeById, wallpaperOf } from './theme.ts'
import type { Theme } from './theme.ts'

export function Themes({
  theme,
  wallpapers,
  onTheme,
  onWallpaper,
}: {
  theme: string
  wallpapers: Record<string, string>
  onTheme: (id: string) => void
  onWallpaper: (themeId: string, wallpaperId: string) => void
}) {
  const current = themeById(theme)
  const wearing = wallpaperOf(current, wallpapers)

  return (
    <div className="themes">
      <header className="builds-top">
        <h2>Themes</h2>
      </header>

      <p className="themes-intro">
        Each one is a palette, a light, a weather and a set of pictures. Every colour was measured
        off that theme&rsquo;s own art, then solved so all four read at the same contrast.
      </p>

      <ul className="theme-grid">
        {THEMES.map((one) => (
          <li key={one.id}>
            <ThemeCard one={one} chosen={one.id === theme} onChoose={() => onTheme(one.id)} />
          </li>
        ))}
      </ul>

      <section className="themes-walls">
        <h3 className="arcana-rule">Behind {current.name}</h3>
        <ul className="wall-grid">
          <li>
            <button
              type="button"
              className={`wall${wearing === null ? ' is-on' : ''}`}
              aria-pressed={wearing === null}
              onClick={() => onWallpaper(current.id, NONE)}
            >
              <span className="wall-swatch is-none" aria-hidden="true" />
              <span className="wall-name">None</span>
            </button>
          </li>
          {current.wallpapers.map((wall) => (
            <li key={wall.id}>
              <button
                type="button"
                className={`wall${wearing?.id === wall.id ? ' is-on' : ''}`}
                aria-pressed={wearing?.id === wall.id}
                onClick={() => onWallpaper(current.id, wall.id)}
              >
                <span
                  className="wall-swatch"
                  style={{ backgroundImage: `url('/${wall.file}')` }}
                  aria-hidden="true"
                />
                <span className="wall-name">{wall.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {/* The swatches are at full strength and the page is not. What a
          * wallpaper actually looks like is already visible behind this
          * screen, because choosing one changes the room you are standing in. */}
        <p className="themes-note">
          Swatches are shown at full strength. On the page they sit between four and fifteen
          percent, dimmed until nothing in them is brighter than a panel.
        </p>
      </section>
    </div>
  )
}

/**
 * One room, drawn in itself.
 *
 * The backdrop inside the card is the same three layers `Hecate` puts behind
 * the app, at the same proportions, reading the same tokens. It is a preview
 * in the strict sense: nothing here is a picture of the theme.
 */
function ThemeCard({ one, chosen, onChoose }: { one: Theme; chosen: boolean; onChoose: () => void }) {
  return (
    <button
      type="button"
      data-theme={one.id}
      data-weather={one.weather}
      className={`theme-card${chosen ? ' is-on' : ''}`}
      aria-pressed={chosen}
      onClick={onChoose}
    >
      <span className="theme-stage" aria-hidden="true">
        <span className="theme-glow" />
        <span className="theme-fog" style={{ '--fog-at': one.fog } as React.CSSProperties} />
        <span className="theme-motes" />
        <span className="theme-plate">{one.name}</span>
      </span>

      <span className="theme-meta">
        <span className="theme-title">
          {one.name}
          {chosen ? (
            <img className="menu-chosen" src="/icons/selected.png" alt="" aria-hidden="true" />
          ) : null}
        </span>
        <span className="theme-say">{one.say}</span>
        <span className="theme-swatches" aria-hidden="true">
          <i style={{ background: 'var(--lit-dim)' }} />
          <i style={{ background: 'var(--lit)' }} />
          <i style={{ background: 'var(--lit-hot)' }} />
          <i style={{ background: 'var(--lit-accent)' }} />
          <i style={{ background: 'var(--metal)' }} />
        </span>
        {/* Which two the game drew and which two were derived. Worth saying
          * on the page rather than only in a comment. */}
        <span className="theme-source">
          {one.platedByTheGame ? 'Plate from the game' : 'Plate derived from its art'}
        </span>
      </span>
    </button>
  )
}
