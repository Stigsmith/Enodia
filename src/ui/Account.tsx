/**
 * The Account room. Phase 4, Stage 3.
 *
 * Rendered only when `ACCOUNTS_LIVE` is true. Until then `App.tsx` keeps this
 * door shut and Dora is still standing behind it, which is honest: an account
 * system with no password reset is a trap with a nice form on it.
 *
 * ## What an account is for, and what it is not for
 *
 * It is for publishing a build to get a short link, and for nothing else yet.
 * It does **not** back your builds up. They stay in this browser, they stay the
 * record, and the loss warning in the build manager points at the export rather
 * than at this screen for exactly that reason.
 *
 * Saying "sign in to keep your builds safe" would be the easy sell and it would
 * be false. `REQUIREMENTS.md` 5 defers syncing to its own feature.
 *
 * ## Why the form is a real form
 *
 * `<form>` rather than a div of inputs, so Enter submits and password managers
 * recognise it. `preventDefault` means it never actually navigates, which
 * matters because `assets/_headers` sets `form-action 'none'`: if the script
 * ever failed, the browser would refuse the submit rather than posting
 * somebody's password somewhere. It fails closed.
 */

import { useEffect, useState } from 'react'

import {
  capabilities,
  completeReset,
  currentAccount,
  requestReset,
  signIn,
  signOut,
  signUp,
} from '../state/account.ts'
import type { Account as Who, ResetArrival } from '../state/account.ts'
import { Page } from './Pages.tsx'

type Mode = 'in' | 'up' | 'forgot'

const TITLE: Record<Mode, string> = {
  in: 'Sign in',
  up: 'Create an account',
  forgot: 'Reset your password',
}

export function Account() {
  const [who, setWho] = useState<Who | null>(null)
  /** Undefined while the first check is in flight, so nothing flashes. */
  const [checked, setChecked] = useState(false)
  const [canReset, setCanReset] = useState(false)

  const [mode, setMode] = useState<Mode>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let live = true
    void Promise.all([currentAccount(), capabilities()]).then(([account, caps]) => {
      if (!live) return
      setWho(account)
      setCanReset(caps.passwordReset)
      setChecked(true)
    })
    return () => {
      live = false
    }
  }, [])

  const go = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const outcome =
      mode === 'up'
        ? await signUp(name.trim(), email.trim(), password)
        : mode === 'in'
          ? await signIn(email.trim(), password)
          : await requestReset(email.trim())

    if (!outcome.ok) {
      setError(outcome.say)
      setBusy(false)
      return
    }

    if (mode === 'forgot') {
      setSent(true)
      setBusy(false)
      return
    }

    // The password is not kept around after it has been used.
    setPassword('')
    setWho(await currentAccount())
    setBusy(false)
  }

  const leave = async () => {
    setBusy(true)
    await signOut()
    setWho(null)
    setBusy(false)
  }

  if (!checked) {
    return (
      <Page title="Account" standfirst="Checking whether you are signed in.">
        <p className="acct-quiet">One moment.</p>
      </Page>
    )
  }

  if (who) {
    return (
      <Page
        title="Account"
        standfirst="Signed in. Your builds still live in this browser, and this does not change that."
      >
        <section className="ref">
          <h3 className="ref-rule">You</h3>
          <p className="ref-say">
            <strong>{who.name}</strong>
            <br />
            <span className="acct-mono">{who.email}</span>
          </p>
          <button type="button" className="acct-go" onClick={leave} disabled={busy}>
            {busy ? 'Signing out' : 'Sign out'}
          </button>
        </section>

        <section className="ref">
          <h3 className="ref-rule">What this is for</h3>
          <p className="ref-say">
            Two things. A build you publish gets a short link instead of a 1,588 character
            one. And your builds, runs and settings follow you: sign in on a phone and what
            you made on a desktop is already there.
          </p>
          <p className="ref-say">
            It copies, it does not move. Everything is still in this browser and still works
            with no account at all, signing out leaves it exactly where it is, and Settings
            still has the export.
          </p>
        </section>
      </Page>
    )
  }

  return (
    <Page
      title="Account"
      standfirst="You do not need one to use any of this. It exists so a shared build can have a short link."
    >
      <section className="ref">
        <div className="acct-modes" role="tablist" aria-label="Sign in or create an account">
          {(['in', 'up'] as const).map((one) => (
            <button
              key={one}
              type="button"
              role="tab"
              aria-selected={mode === one}
              className={mode === one ? 'acct-mode is-on' : 'acct-mode'}
              onClick={() => {
                setMode(one)
                setError(null)
                setSent(false)
              }}
            >
              {TITLE[one]}
            </button>
          ))}
        </div>

        {sent ? (
          <p className="ref-say" role="status">
            If there is an account on that address, a reset link is on its way. It works once
            and expires in an hour.
          </p>
        ) : (
          <form className="acct-form" onSubmit={go}>
            {mode === 'up' ? (
              <label className="acct-field">
                <span>Name</span>
                <input
                  type="text"
                  autoComplete="nickname"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            ) : null}

            <label className="acct-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            {mode !== 'forgot' ? (
              <label className="acct-field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {mode === 'up' ? (
                  <small className="acct-hint">
                    Eight characters at least. Use a password manager: there is no way to
                    change this address later yet.
                  </small>
                ) : null}
              </label>
            ) : null}

            {error ? (
              <p className="acct-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="acct-go" disabled={busy}>
              {busy ? 'Working' : TITLE[mode]}
            </button>
          </form>
        )}

        {/* Offered only when a letter can actually be sent. `capabilities()`
          * asks the server rather than assuming, because whether a mail
          * provider is configured is not something the browser can know. */}
        {mode !== 'forgot' && !sent ? (
          canReset ? (
            <button
              type="button"
              className="acct-link"
              onClick={() => {
                setMode('forgot')
                setError(null)
              }}
            >
              Forgotten your password?
            </button>
          ) : (
            <p className="acct-hint acct-warn">
              There is no password reset on this deployment yet. If you forget this password
              nobody can recover the account for you, so write it down somewhere real.
            </p>
          )
        ) : null}
      </section>

      <section className="ref">
        <h3 className="ref-rule">What you get, and what you do not</h3>
        <p className="ref-say">
          An account gets you a short link for a build you publish, and carries your library,
          your runs and your settings between your devices. Sign in somewhere new and what you
          made is waiting.
        </p>
        <p className="ref-say">
          It is a copy rather than a move. Everything still lives in this browser, everything
          still works signed out, and Settings still has the export. Where two devices disagree
          about the same thing, the one changed most recently wins.
        </p>
        <p className="ref-say">
          The only things kept are your name, your email and a signed-in session. Nothing is
          tracked and nothing is measured about you.
        </p>
      </section>
    </Page>
  )
}

/**
 * The other end of the letter, and the screen this whole flow was missing.
 *
 * Password reset was half built for a while: the form that asks for a letter
 * worked, the letter sent, and clicking the link landed on the landing page
 * where nothing happened. Somebody locked out got a letter and stayed locked
 * out, which is worse than not offering reset at all, because it looks like it
 * worked.
 *
 * **Rendered whatever `ACCOUNTS_LIVE` says, and that is deliberate.** A token
 * only exists because a letter was sent, and a letter is only sent for an
 * account that exists. Refusing to complete a reset because a flag is off would
 * be the exact trap the flag is there to prevent.
 *
 * **It takes the whole screen**, like an arriving share link, because somebody
 * who clicked a link in an email has one job and should not have to find a menu
 * to do it.
 *
 * No email field. The token identifies the account, so asking would be asking
 * for something already known, and getting it wrong would look like a failure
 * that was not one.
 */
export function ResetPassword({
  arrival,
  onDone,
}: {
  arrival: ResetArrival
  onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if ('expired' in arrival) {
    return (
      <Page
        title="That link has expired"
        standfirst="Reset links last an hour and work once. This one has been used already or it has run out."
      >
        <section className="ref">
          <p className="ref-say">
            Nothing is wrong with your account and your password has not changed. Ask for
            another letter and use the new link when it arrives.
          </p>
          <button type="button" className="acct-go" onClick={onDone}>
            Back to the tool
          </button>
        </section>
      </Page>
    )
  }

  if (done) {
    return (
      <Page
        title="That is done"
        standfirst="Your password has been changed. Every other session has been signed out."
      >
        <section className="ref">
          <p className="ref-say">
            You can sign in with the new one now. Nothing else about the account has changed,
            and the builds in this browser were never involved.
          </p>
          <button type="button" className="acct-go" onClick={onDone}>
            Sign in
          </button>
        </section>
      </Page>
    )
  }

  const go = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const outcome = await completeReset(arrival.token, password)
    // Cleared whether it worked or not. A spent token is worth nothing, and an
    // unspent one should not sit in the address bar to be read over a shoulder
    // or handed to whoever the next screenshot goes to.
    setPassword('')
    if (!outcome.ok) {
      setError(outcome.say)
      setBusy(false)
      return
    }

    /**
     * The token leaves the address bar the moment it is spent, not when the
     * person gets round to clicking through.
     *
     * Two reasons. A reload on the confirmation screen would otherwise find the
     * token still in the URL, draw the form again, and fail with "invalid
     * token" on a reset that had in fact worked. And a spent credential should
     * not sit in the address bar, in the history, or in the next screenshot.
     */
    history.replaceState(null, '', window.location.pathname)

    setDone(true)
    setBusy(false)
  }

  return (
    <Page
      title="Pick a new password"
      standfirst="The link checked out. Choose something new and you are back in."
    >
      <section className="ref">
        {/* A real form, for the same reasons the sign-in one is: Enter submits,
          * password managers offer to save, and `form-action 'none'` in
          * `assets/_headers` means a failed script cannot post it anywhere. */}
        <form className="acct-form" onSubmit={go}>
          <label className="acct-field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <small className="acct-hint">
              Eight characters at least. Use a password manager, and you will not be reading
              one of these letters again.
            </small>
          </label>

          {error ? (
            <p className="acct-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="acct-go" disabled={busy}>
            {busy ? 'Working' : 'Set it'}
          </button>
        </form>
      </section>
    </Page>
  )
}
