/**
 * Settings, which for now is the one thing that cannot wait: getting your work
 * out of this browser and back into another one.
 *
 * **Nothing here is on a server.** That is the point of the tool and it is also
 * the risk: everything a person builds lives in one browser's storage, and a
 * cleared browser is the whole library gone with no way to ask for it back. So
 * the export is not a convenience, it is the only copy anyone will ever have,
 * and the screen says how long it has been since the last one.
 *
 * The view preferences stay in the menu rather than moving here. They are
 * things you flip while looking at the thing they change, which is a different
 * kind of setting from this one and wants a different place.
 */

import { useEffect, useRef, useState } from 'react'

import {
  collect,
  daysSince,
  describe,
  markExported,
  readBundle,
  readExportedAt,
  restore,
} from '../state/transfer.ts'
import type { Manifest } from '../state/transfer.ts'
import { NAV_MODES, PANE_QUERY, applyNav, readNav, writeNav } from '../ui/nav.ts'

/** What a file says it holds, once one has been chosen but not yet applied. */
type Pending = { manifest: Manifest; text: string } | { error: string } | null

export function Settings() {
  const [lastExport, setLastExport] = useState(readExportedAt)
  const [pending, setPending] = useState<Pending>(null)
  const [saidJustNow, setSaidJustNow] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  /**
   * Where the menu sits, which used to be set from inside the menu itself.
   *
   * It is offered only on a screen wide enough to hold a pane. Below 60rem the
   * pop-out is the only mode there is, and a setting that changes nothing is a
   * setting that lies.
   */
  const [nav, setNav] = useState(readNav)
  const [wide, setWide] = useState(() => window.matchMedia(PANE_QUERY).matches)

  useEffect(() => {
    applyNav(nav)
    writeNav(nav)
  }, [nav])

  useEffect(() => {
    const query = window.matchMedia(PANE_QUERY)
    const sync = () => setWide(query.matches)
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const since = daysSince(lastExport)
  const held = describe(collect())

  const exportNow = () => {
    const bundle = collect()
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(bundle, null, 1)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `enodia-${stamp}.json`
    document.body.append(link)
    link.click()
    link.remove()
    // Revoked on the next turn of the loop, because Safari has not finished
    // with the URL when click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 0)
    setLastExport(markExported())
    setSaidJustNow(`Saved enodia-${stamp}.json`)
  }

  const choose = (chosen: File) => {
    setSaidJustNow(null)
    const reader = new FileReader()
    reader.onload = () => {
      const read = readBundle(String(reader.result ?? ''))
      setPending('error' in read ? { error: read.error } : { manifest: describe(read.bundle), text: String(reader.result) })
    }
    reader.onerror = () => setPending({ error: 'That file could not be read.' })
    reader.readAsText(chosen)
  }

  const applyPending = () => {
    if (!pending || 'error' in pending) return
    const read = readBundle(pending.text)
    if ('error' in read) return
    restore(read.bundle)
    // Everything on screen was built from the storage that just changed
    // underneath it, so the honest thing is to start again rather than to
    // reconcile a dozen useState calls with a file.
    window.location.reload()
  }

  return (
    <div className="settings">
      <header className="builds-top">
        <h2>Settings</h2>
      </header>

      {wide ? (
        <section className="setting-block">
          <h3 className="arcana-rule">The menu</h3>
          <ul className="menu-choice setting-choice">
            {NAV_MODES.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={nav === option.id}
                  className={nav === option.id ? 'is-on' : ''}
                  onClick={() => setNav(option.id)}
                >
                  <span className="menu-label">
                    {option.name}
                    {nav === option.id ? (
                      <img className="menu-chosen" src="/icons/selected.png" alt="" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="menu-note">{option.note}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="setting-block">
        <h3 className="arcana-rule">Your things</h3>
        <p className="setting-say">
          Everything you have made lives in this browser and nowhere else. There is no account and
          no server, so an export is the only copy that exists.
        </p>

        <div className="setting-row">
          <button type="button" className="quiet" onClick={exportNow}>
            Export everything
          </button>
          <p className={`setting-since${since !== null && since >= 7 ? ' is-stale' : ''}`}>
            {since === null
              ? 'Never exported'
              : since === 0
                ? 'Exported today'
                : since === 1
                  ? 'Exported yesterday'
                  : `Exported ${since} days ago`}
          </p>
        </div>

        <p className="setting-holds">
          <strong>{held.builds}</strong> {held.builds === 1 ? 'build' : 'builds'} and{' '}
          <strong>{held.runs}</strong> {held.runs === 1 ? 'run' : 'runs'} would go in the file.
        </p>
        {saidJustNow ? <p className="setting-done">{saidJustNow}</p> : null}
      </section>

      <section className="setting-block">
        <h3 className="arcana-rule">From a file</h3>
        <p className="setting-say">
          An import <strong>replaces</strong> what is here. It is not a merge: a build this file
          does not have, sitting next to the ones it does, is neither what was exported nor what
          was here, and nothing could tell you which.
        </p>

        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            if (chosen) choose(chosen)
            event.target.value = ''
          }}
        />
        <div className="setting-row">
          <button type="button" className="quiet" onClick={() => file.current?.click()}>
            Choose a file
          </button>
        </div>

        {pending && 'error' in pending ? <p className="setting-bad">{pending.error}</p> : null}

        {pending && 'manifest' in pending ? (
          <div className="setting-confirm">
            <p>
              That file holds <strong>{pending.manifest.builds}</strong>{' '}
              {pending.manifest.builds === 1 ? 'build' : 'builds'} and{' '}
              <strong>{pending.manifest.runs}</strong>{' '}
              {pending.manifest.runs === 1 ? 'run' : 'runs'}
              {pending.manifest.exportedAt
                ? `, exported ${new Date(pending.manifest.exportedAt).toLocaleDateString()}`
                : ''}
              .
            </p>
            <p className="setting-warn">
              Your {held.builds} {held.builds === 1 ? 'build' : 'builds'} here will be replaced.
            </p>
            <div className="setting-buttons">
              <button type="button" className="setting-go" onClick={applyPending}>
                Replace everything
              </button>
              <button type="button" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="setting-block">
        <h3 className="arcana-rule">Sharing one build</h3>
        <p className="setting-say">
          Open a build, then <strong>Share</strong> in its menu. That copies a link holding the
          whole build, which anyone can open. It carries no rating, runs or clears: those are
          yours and stay here.
        </p>
      </section>
    </div>
  )
}
