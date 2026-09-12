/**
 * A link into the wiki, from anywhere.
 *
 * **A context rather than a prop**, for the reason `Peek.tsx` gives: a record
 * can be opened from the dialog in the build views, from the index, from one
 * record to another, and soon from a mention inside a build's write-up. Threading
 * a handler through each of those would be a chance to forget one per layout.
 *
 * It is a real `<a>` with a real address, so a middle click opens the record in
 * a new tab and copying the link copies something that reopens it. A plain
 * click is caught and handled in place, which keeps the app from reloading.
 */

import { createContext, useContext } from 'react'

import { wikiPath } from './wiki-route.ts'
import type { WikiAt } from './wiki-route.ts'

const OpenWiki = createContext<(at: WikiAt) => void>(() => {})

export const WikiProvider = OpenWiki.Provider

export const useOpenWiki = () => useContext(OpenWiki)

export function WikiLink({
  at,
  className,
  children,
  ...rest
}: {
  at: WikiAt
  className?: string
  children: React.ReactNode
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick' | 'className' | 'children'>) {
  const open = useOpenWiki()
  return (
    <a
      {...rest}
      href={wikiPath(at)}
      className={className}
      onClick={(event) => {
        // Let the browser have anything that is not a plain left click.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        open(at)
      }}
    >
      {children}
    </a>
  )
}
