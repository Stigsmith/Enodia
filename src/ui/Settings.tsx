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

import { useRef, useState } from 'react'

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
import { NAME_LIMIT, readName, writeName } from '../state/identity.ts'

/** What a file says it holds, once one has been chosen but not yet applied. */
type Pending = { manifest: Manifest; text: string } | { error: string } | null

export function Settings() {
  const [lastExport, setLastExport] = useState(readExportedAt)
  const [pending, setPending] = useState<Pending>(null)
  const [saidJustNow, setSaidJustNow] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(readName)

  const since = daysSince(lastExport)
  const held = describe(collect())

  const exportNow = () => {
    /**
     * Stamped before the snapshot, not after.
     *
     * `collect` copies `enodia.exportedAt` along with everything else, so
     * marking the export afterwards put the *previous* export time in the file.
     * Importing that file then rolled the counter backwards, which is how it
     * could still read "9 days ago" straight after an export.
     */
    const at = markExported()
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
    setLastExport(at)
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

      <section className="setting-block">
        <h3 className="arcana-rule">Your name</h3>
        <p className="setting-say">
          Put on the builds you make, and it travels with one you share so the person opening it
          knows whose it is. <strong>It is not a sign-in.</strong> It is stored in this browser,
          nobody checks it, and two people can pick the same one.
        </p>
        <label className="setting-name" data-tour="setting-name">
          <span>Name</span>
          <input
            type="text"
            value={name}
            maxLength={NAME_LIMIT}
            placeholder="Nobody"
            /* Written on every keystroke rather than on blur. The pinned menu
               means you can leave this screen without the field ever losing
               focus, and a name typed and then lost is worse than no field. */
            onChange={(event) => {
              setName(event.target.value)
              writeName(event.target.value)
            }}
            /* Tidied when you leave it, so the field shows what was stored
               rather than the spaces you happened to type. */
            onBlur={() => setName(readName())}
          />
        </label>
      </section>
      <section className="setting-block" data-tour="setting-export">
        <h3 className="arcana-rule">Your things</h3>
        <p className="setting-say">
          Everything you have made lives in this browser. Signed in, a copy of it also follows
          you between your devices. The export is the copy that belongs to you rather than to
          this tool, and it is the one that survives the tool going away.
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

      <section className="setting-block" data-tour="setting-import">
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
