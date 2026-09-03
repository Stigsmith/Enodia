/**
 * The Friends room. Rendered only when `ACCOUNTS_LIVE` is true.
 *
 * Three things, in the order somebody needs them: your code to hand out, a box
 * to paste somebody else's into, and then the people and what they published.
 *
 * **There is no search and no directory, on purpose.** `state/friends.ts` says
 * why. The practical consequence for this screen is that the code is the first
 * thing on it and is meant to be copied, because it is the only way anybody
 * gets added.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  friendsFeed,
  listFriends,
  myCode,
  redeemCode,
  removeFriend,
  rotateCode,
} from '../state/friends.ts'
import type { Friend, FriendBuild } from '../state/friends.ts'
import { linkTo } from '../state/publish.ts'
import { Page } from './Pages.tsx'

const when = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export function Friends() {
  const [code, setCode] = useState<string | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [feed, setFeed] = useState<FriendBuild[]>([])
  const [ready, setReady] = useState(false)

  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    const [mine, theirs] = await Promise.all([listFriends(), friendsFeed()])
    if (mine.ok) setFriends(mine.value.friends)
    if (theirs.ok) setFeed(theirs.value.builds)
  }, [])

  useEffect(() => {
    let live = true
    void (async () => {
      const [asked] = await Promise.all([myCode(), refresh()])
      if (!live) return
      if (asked.ok) setCode(asked.value.code)
      setReady(true)
    })()
    return () => {
      live = false
    }
  }, [refresh])

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setSaid(null)
    const outcome = await redeemCode(typed)
    if (!outcome.ok) {
      setSaid(outcome.say)
    } else {
      setSaid(`${outcome.value.friend.name} is on your list.`)
      setTyped('')
      await refresh()
    }
    setBusy(false)
  }

  const rotate = async () => {
    setBusy(true)
    const outcome = await rotateCode()
    if (outcome.ok) {
      setCode(outcome.value.code)
      setSaid('New code. The old one has stopped working.')
    }
    setBusy(false)
  }

  const drop = async (friend: Friend) => {
    setBusy(true)
    await removeFriend(friend.id)
    await refresh()
    setSaid(`${friend.name} is off your list.`)
    setBusy(false)
  }

  if (!ready) {
    return (
      <Page title="Friends" standfirst="Fetching your list.">
        <p className="acct-quiet">One moment.</p>
      </Page>
    )
  }

  return (
    <Page
      title="Friends"
      standfirst="People you swapped codes with. You see what they publish, they see what you publish, and nobody else sees either."
    >
      <section className="ref">
        <h3 className="ref-rule">Your code</h3>
        <p className="ref-say">
          Hand this to somebody and they can add you. There is no way to search for a person
          here, which is deliberate: it means nobody can be found who did not want to be.
        </p>
        <div className="frnd-code">
          <span className="frnd-code-value">{code ?? '········'}</span>
          <button
            type="button"
            className="acct-go"
            disabled={!code}
            onClick={() => {
              if (!code) return
              navigator.clipboard?.writeText(code).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <button type="button" className="acct-link" onClick={rotate} disabled={busy}>
          Give me a new one
        </button>
        <p className="acct-hint">
          Rotating is for a code that ended up somewhere public. It does not remove anybody
          you have already added.
        </p>
      </section>

      <section className="ref">
        <h3 className="ref-rule">Add someone</h3>
        <form className="acct-form" onSubmit={add}>
          <label className="acct-field">
            <span>Their code</span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="acct-go" disabled={busy || !typed.trim()}>
            {busy ? 'Working' : 'Add'}
          </button>
        </form>
        {said ? (
          <p className="acct-hint" role="status">
            {said}
          </p>
        ) : null}
      </section>

      <section className="ref">
        <h3 className="ref-rule">Your friends</h3>
        {friends.length ? (
          <ul className="frnd-list">
            {friends.map((friend) => (
              <li key={friend.id}>
                <span className="frnd-name">{friend.name}</span>
                <span className="frnd-since">since {when(friend.since)}</span>
                <button
                  type="button"
                  className="acct-link"
                  disabled={busy}
                  onClick={() => void drop(friend)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ref-say">
            Nobody yet. Swap codes with somebody and you will both see each other&rsquo;s
            published builds here.
          </p>
        )}
      </section>

      <section className="ref">
        <h3 className="ref-rule">What they have published</h3>
        {feed.length ? (
          <ul className="frnd-feed">
            {feed.map((build) => (
              // A published build already has a short link, and following it is
              // the same arrival the app handles for a shared one. No second
              // way of opening a build had to be invented for this screen.
              <li key={build.id}>
                <a href={linkTo(build.id)}>{build.name}</a>
                <span className="frnd-by">
                  {build.by}, {when(build.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ref-say">
            Nothing yet. A build shows up here when a friend publishes one, and publishing is
            in the More menu on any build of your own.
          </p>
        )}
      </section>
    </Page>
  )
}
