/**
 * You, in the top right corner, on every screen.
 *
 * ## Why the corner, and why the full convention
 *
 * The tool used to sell not needing an account, and that pitch is retired. It
 * was written when there was no server; there is one now, and the account is
 * what carries your builds between devices, publishes them, holds your friends
 * and will hold everything after that. It is fine to use the tool without one
 * and better to use it with one, so the account gets the place every tool
 * anybody already uses puts it: top right, always, as a real control rather
 * than a quiet link apologising for existing.
 *
 * ## It mirrors the menu exactly
 *
 * `.app > .menu` is `position: fixed; top: 0.7rem; left: 0.8rem; z-index: 30`
 * and pays for its space with `--nav-inset`, which page headings pad against.
 * This is that rule with `right` instead of `left` and `--you-inset` instead,
 * and it opens a panel on the same art at the same z-index. Two controls in two
 * corners that behave identically is one thing to learn, not two.
 *
 * **Fixed is not a style choice.** In pinned-pane mode `.app` becomes a two
 * column grid whose in-flow children are `.menu` and `.app-view`. Anything else
 * in flow would become a third column and break the pane.
 *
 * ## What it holds, and what it deliberately does not
 *
 * Account, Friends, Sign out. Those are facts about you rather than places in
 * the tool, which is exactly the split that makes two menus worth having: the
 * one on the left is where you go, this one is who you are. Leaderboards stayed
 * on the left, because it is about everybody.
 *
 * **Signed out it is one button that goes to the Account screen.** An inline
 * sign-in form in a dropdown is more convention still, and it is a pattern this
 * tool has nowhere else; the screen with the form already exists and works.
 *
 * ## It shows the account name, not the local one
 *
 * There are two names for one person: `state/identity.ts` holds a local label
 * stamped onto builds you make, and the account carries the name you signed up
 * with, which is the byline on everything you publish. This shows the account
 * one, because it is the name other people see. That the two can disagree is a
 * real problem and it is not this file's to solve.
 */

import { useEffect, useRef, useState } from 'react'

import { ACCOUNT_CHANGED, currentAccount, signOut } from '../state/account.ts'
import type { Account } from '../state/account.ts'

export function You({ onGo }: { onGo: (view: 'account' | 'friends') => void }) {
  const [who, setWho] = useState<Account | null>(null)
  /** Undefined until the first answer, so nothing flashes the wrong state. */
  const [asked, setAsked] = useState(false)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  /**
   * Asked once, and again whenever somebody signs in or out.
   *
   * The event is not optional. Reading the account once at mount was a real bug
   * earlier: signing in during a session left every other part of the app
   * believing nobody was, silently, with nothing on screen looking wrong.
   */
  useEffect(() => {
    let live = true
    const check = () =>
      void currentAccount().then((found) => {
        if (!live) return
        setWho(found)
        setAsked(true)
      })

    check()
    window.addEventListener(ACCOUNT_CHANGED, check)
    return () => {
      live = false
      window.removeEventListener(ACCOUNT_CHANGED, check)
    }
  }, [])

  /* Closed by a click outside it or by Escape, the same two gestures that close
   * the menu. Copied deliberately rather than shared: the menu's version also
   * has to know about being pinned, which this never is. */
  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const go = (view: 'account' | 'friends') => {
    setOpen(false)
    onGo(view)
  }

  const leave = async () => {
    setOpen(false)
    await signOut()
    // `signOut` announces on the window, so the effect above refreshes this.
    // Setting it here as well would be two owners of one piece of state.
  }

  /**
   * Nothing at all until the first answer comes back.
   *
   * The alternative is drawing "Sign in" for a moment and then replacing it
   * with a name, which reads as being signed out and then signed in, on every
   * single page load, to somebody who was signed in the whole time.
   */
  if (!asked) return <div className="you" ref={root} />

  if (!who) {
    return (
      <div className="you" ref={root}>
        <button type="button" className="you-in" onClick={() => go('account')}>
          Sign in
        </button>
      </div>
    )
  }

  return (
    <div className="you" ref={root}>
      <button
        type="button"
        className={`you-name${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((was) => !was)}
      >
        <span className="you-mark" aria-hidden="true">
          {/* The first letter, which is the cheapest avatar there is and the
            * only one available: there are no pictures on an account. */}
          {who.name.trim().slice(0, 1).toUpperCase() || '?'}
        </span>
        <span className="you-text">{who.name}</span>
      </button>

      {open ? (
        <div className="you-panel" role="menu">
          <p className="you-as">
            Signed in as <strong>{who.name}</strong>
          </p>
          <ul>
            <li>
              <button type="button" role="menuitem" onClick={() => go('account')}>
                Account
              </button>
            </li>
            <li>
              <button type="button" role="menuitem" onClick={() => go('friends')}>
                Friends
              </button>
            </li>
            <li>
              <button type="button" role="menuitem" onClick={() => void leave()}>
                Sign out
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}
