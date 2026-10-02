/**
 * Settings: getting your work out of this browser, and the switches that are
 * not something you flip while looking at what they change.
 *
 * **The export is still the only copy that belongs to you.** Signing in now
 * carries a copy between your devices, which is a real safety net and is not
 * the same thing: it is this tool's storage either way, and a tool can go away.
 * So the export stays the headline here and the screen says how long it has
 * been since the last one.
 *
 * The view preferences stay in the menu rather than moving here. They are
 * things you flip while looking at the thing they change, which is a different
 * kind of setting from these and wants a different place.
 *
 * **The four numbers are at the top because they are what you came to read.**
 * They were prose lines inside the blocks below, which put the only state on
 * the page behind the paragraphs explaining it, and put the one that matters,
 * how long since you had a copy of your own work, in grey beside a button.
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
import { loadPrefs, savePrefs } from '../state/prefs.ts'
import { applySkin, readSkin, writeSkin } from './skin.ts'

/** What a file says it holds, once one has been chosen but not yet applied. */
type Pending = { manifest: Manifest; text: string } | { error: string } | null

export function Settings() {
  const [lastExport, setLastExport] = useState(readExportedAt)
  const [pending, setPending] = useState<Pending>(null)
  const [saidJustNow, setSaidJustNow] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(readName)
  const [reportRuns, setReportRuns] = useState(() => loadPrefs().reportRuns)
  const [skin, setSkin] = useState(readSkin)

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

      {/* The readout. Every one of these was a sentence somewhere below. */}
      <div className="setting-stats">
        <div className="setting-stat">
          <strong>{held.builds}</strong>
          <span>{held.builds === 1 ? 'build' : 'builds'}</span>
        </div>
        <div className="setting-stat">
          <strong>{held.runs}</strong>
          <span>{held.runs === 1 ? 'run' : 'runs'}</span>
        </div>
        {/* Never counts as stale, which the grey line this replaced did not do.
          * Having never exported is the worst version of this state, not a
          * neutral one, and it was the only one reading in the calm colour. */}
        <div className={`setting-stat${since === null || since >= 7 ? ' is-stale' : ''}`}>
          <strong>{since === null ? 'Never' : since === 0 ? 'Today' : since}</strong>
          <span>
            {since === null || since === 0
              ? 'exported'
              : since === 1
                ? 'day since your export'
                : 'days since your export'}
          </span>
        </div>
        <div className={`setting-stat${reportRuns ? '' : ' is-off'}`}>
          <strong>{reportRuns ? 'On' : 'Off'}</strong>
          <span>runs counted toward builds you took</span>
        </div>
      </div>

      {/* Two columns, and **the split is by subject rather than by height**:
        * left is your work moving in and out of this browser, right is the two
        * things that involve anybody else.
        *
        * Fixed columns rather than the CSS columns Help uses, because the
        * import block grows a confirmation panel when you choose a file, and a
        * balanced flow would shuffle the other blocks between columns while you
        * were reading the question it is asking. */}
      <div className="setting-grid">
        <div className="setting-col">
          {/* Here rather than beside the thing it changes, because it changes
            * everything: the buttons on this very screen redraw the moment it
            * is flipped, so the result is in front of you either way. */}
          <section className="setting-block" data-tour="setting-skin">
            <h3 className="arcana-rule">How it is drawn</h3>
            <p className="setting-say">
              Buttons, tabs, panels and trays are the game&rsquo;s own art. Plain draws them in
              the browser instead, in your theme&rsquo;s colours. Boon icons, portraits and the
              characters are the same either way.
            </p>
            <label className="setting-switch">
              <input
                type="checkbox"
                checked={skin === 'plain'}
                onChange={(event) => {
                  const next = event.target.checked ? 'plain' : 'game'
                  setSkin(next)
                  applySkin(next)
                  writeSkin(next)
                }}
              />
              <span>Plain interface</span>
            </label>
          </section>

          <section className="setting-block">
            <h3 className="arcana-rule">Your name</h3>
            <p className="setting-say">
              Put on the builds you make, and it travels with one you share so the person
              opening it knows whose it is. <strong>It is not a sign-in.</strong> It is stored
              in this browser, nobody checks it, and two people can pick the same one.
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
              Everything you have made lives in this browser. Signed in, a copy of it also
              follows you between your devices. The export is the copy that belongs to you
              rather than to this tool, and it is the one that survives the tool going away.
            </p>

            <div className="setting-row">
              <button type="button" className="quiet" onClick={exportNow}>
                Export everything
              </button>
              {/* The counts and the days sit in the readout above rather than
                * here. This is the only line left, and it appears once. */}
              {saidJustNow ? <p className="setting-done">{saidJustNow}</p> : null}
            </div>
          </section>

          <section className="setting-block" data-tour="setting-import">
            <h3 className="arcana-rule">From a file</h3>
            <p className="setting-say">
              An import <strong>replaces</strong> what is here. It is not a merge: a build this
              file does not have, sitting next to the ones it does, is neither what was
              exported nor what was here, and nothing could tell you which.
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
                  Your {held.builds} {held.builds === 1 ? 'build' : 'builds'} here will be
                  replaced.
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
        </div>

        <div className="setting-col">
          {/* The one switch that is about other people rather than about you, so
            * it says what it sends before it offers to stop sending it.
            * `Account.tsx` makes the same statement at more length and points
            * here for the control, rather than there being two of these to keep
            * in step. */}
          <section className="setting-block">
            <h3 className="arcana-rule">Runs, and the exchange</h3>
            <p className="setting-say">
              When you take a build off the exchange and log a run against your copy, the run
              is counted toward the build it came from. That is where <em>38 of 61 cleared</em>{' '}
              on a listing comes from, and it is the only reason a shelf of strangers&rsquo;
              builds has anything to go on.
            </p>
            <p className="setting-say">
              What travels is whether you cleared it and the Fear if you did. Your account is
              attached so one person cannot count a build a thousand times, and it is never
              shown to anybody. It stops on its own once you change the build.
            </p>
            <label className="setting-switch">
              <input
                type="checkbox"
                checked={reportRuns}
                onChange={(event) => {
                  setReportRuns(event.target.checked)
                  savePrefs({ ...loadPrefs(), reportRuns: event.target.checked })
                }}
              />
              <span>Count my runs toward builds I took</span>
            </label>
            <p className="setting-say">
              {reportRuns
                ? 'On. Turning it off sends nothing, and everything else keeps working: you can still take builds, still log runs, still read the counts.'
                : 'Off. Nothing about your runs leaves this browser. Rating a build needs a run behind it, so ratings are off with it.'}
            </p>
          </section>

          <section className="setting-block">
            <h3 className="arcana-rule">Sharing one build</h3>
            <p className="setting-say">
              Open a build, then <strong>Share</strong> in its menu. That copies a link holding
              the whole build, which anyone can open. It carries no rating, runs or clears:
              those are yours and stay here.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
