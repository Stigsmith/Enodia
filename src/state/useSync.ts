/**
 * When a sync happens, which is the difference between the feature working and
 * the feature existing.
 *
 * The thing being built is "edit on the desktop, pick up the phone, it is
 * there". Nobody presses a sync button for that, so the timing has to be right
 * without anybody thinking about it.
 *
 * Four moments, and each one is a different half of the handoff:
 *
 * - **On load**, because opening the tool is exactly when you want what the
 *   other device did.
 * - **When the tab is hidden**, which is the moment you put a laptop down. That
 *   push is what makes the phone's next pull find anything.
 * - **When the tab comes back**, which is the moment you pick one up.
 * - **On a slow timer**, so two devices left open beside each other converge
 *   without either being touched.
 *
 * ## Not on every edit
 *
 * Tempting, and wrong. Typing a build name would fire a request per keystroke,
 * and the debounce that fixes that is a worse version of the timer already
 * here. The cost of waiting is that the other device is a minute behind, and a
 * minute is invisible next to walking to another room.
 *
 * ## Failing quietly is the correct behaviour
 *
 * Almost everybody using this has no account, so almost every call would be a
 * 401. It is not an error, it is the normal state, and `syncNow` reports it as
 * `signedOut` rather than something to put in front of anybody. A sync that
 * does not happen loses nothing: the data is still local, and the next attempt
 * carries the same changes.
 */

import { useEffect, useRef } from 'react'

import { backfillStamps, syncNow } from './sync.ts'

/** Slow on purpose. See the docblock: a minute is invisible, a request per
 * keystroke is not. */
const EVERY = 60_000

/**
 * Keep this browser in step with the account, and call `onChanged` whenever
 * something actually arrived so the screen can be redrawn.
 *
 * `onChanged` is held in a ref rather than depended on, so a caller passing an
 * inline arrow does not tear down and rebuild every listener on each render.
 */
export function useSync(signedIn: boolean, onChanged: () => void): void {
  const changed = useRef(onChanged)
  changed.current = onChanged

  /** Guards against two syncs overlapping, which would send the same items
   * twice and race over which answer is applied last. */
  const busy = useRef(false)

  useEffect(() => {
    if (!signedIn) return

    let stopped = false

    const run = async () => {
      if (busy.current || stopped) return
      busy.current = true
      try {
        const outcome = await syncNow()
        if (!stopped && outcome.ok && outcome.changed > 0) changed.current()
      } finally {
        busy.current = false
      }
    }

    /* Once, before the first exchange. Settings written by a version that
     * stamped nothing would otherwise never travel. `backfillStamps` guards
     * itself, so calling it on every mount is free. */
    backfillStamps()
    void run()

    /**
     * Hidden as well as visible, and the hidden one is the important half.
     *
     * Leaving a tab is when a person stops editing, so it is the last chance to
     * push before they pick up something else. Waiting for the timer would make
     * the handoff take up to a minute for no reason.
     */
    const onVisibility = () => void run()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)

    const timer = window.setInterval(() => {
      // Nothing is changing in a tab nobody is looking at, and a phone in a
      // pocket should not be waking up to say so.
      if (document.visibilityState === 'visible') void run()
    }, EVERY)

    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      window.clearInterval(timer)
    }
  }, [signedIn])
}
