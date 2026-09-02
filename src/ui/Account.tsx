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
  currentAccount,
  requestReset,
  signIn,
  signOut,
  signUp,
} from '../state/account.ts'
import type { Account as Who } from '../state/account.ts'
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
            Publishing a build, so it gets a short link instead of a 1,588 character one.
            That is all an account does today. It is not a backup: your builds are still
            in this browser and Settings still has the export.
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
          An account lets you publish a build so it has a short link. It does not store your
          builds, does not sync them between devices, and is not a backup. Everything you make
          stays in this browser either way, and Settings has the export.
        </p>
        <p className="ref-say">
          The only things kept are your name, your email and a signed-in session. Nothing is
          tracked and nothing is measured about you.
        </p>
      </section>
    </Page>
  )
}
