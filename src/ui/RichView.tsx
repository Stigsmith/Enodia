/**
 * A guide's body, drawn.
 *
 * The tree from `state/rich.ts`, already cleaned, as React. **Nothing here
 * sets HTML**: every node is a component this file names and every run of
 * text goes through React, which escapes it, so a stranger's guide can only
 * ever be the elements listed below. A node this file does not know is drawn
 * as its children, which `clean` has already made the only possibility.
 *
 * Mentions are drawn exactly as `Prose` draws them in plain text: a record is
 * its art and current name with the game's tooltip, a section of the wiki is
 * its picture and title, and a build carries its verdict while a run is live.
 */

import { Fragment } from 'react'
import type { ReactNode } from 'react'

import { safeHref } from '../state/rich.ts'
import type { RichMark, RichNode } from '../state/rich.ts'
import { BuildMention } from './BuildMention.tsx'
import { pieceOf } from './build-pieces.ts'
import { Mention, PlaceMention } from './Prose.tsx'
import type { MentionAt } from './mentions.ts'

const CALLOUT_SAYS: Record<string, string> = { note: 'Note', tip: 'Tip', warn: 'Watch out' }

function marked(text: string, marks: readonly RichMark[] | undefined): ReactNode {
  let out: ReactNode = text
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
        out = <strong>{out}</strong>
        break
      case 'italic':
        out = <em>{out}</em>
        break
      case 'underline':
        out = <u>{out}</u>
        break
      case 'strike':
        out = <s>{out}</s>
        break
      case 'code':
        out = <code>{out}</code>
        break
      case 'highlight':
        out = <mark>{out}</mark>
        break
      case 'link': {
        /* Checked again here as well as in `clean`: a link is the one way out
         * of the page, so it does not rely on anything upstream having run. */
        const href = safeHref(mark.attrs?.href)
        if (href) {
          out = (
            <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer" className="rich-link">
              {out}
            </a>
          )
        }
        break
      }
    }
  }
  return out
}

function MentionNode({ node }: { node: RichNode }) {
  const at = { kind: node.attrs?.kind, id: node.attrs?.id } as MentionAt
  const label = String(node.attrs?.label ?? node.attrs?.id ?? '')
  if (at.kind === 'build') return <BuildMention id={at.id} name={label} linked />
  if (at.kind === 'place') return <PlaceMention id={at.id} name={label} />
  const piece = pieceOf(at)
  return piece ? <Mention at={at} piece={piece} /> : <>{label}</>
}

function Node({ node }: { node: RichNode }): ReactNode {
  const kids = <Kids nodes={node.content} />
  switch (node.type) {
    case 'doc':
      return kids
    case 'paragraph':
      return <p>{kids}</p>
    case 'heading':
      return node.attrs?.level === 3 ? <h4 className="rich-h3">{kids}</h4> : <h3 className="rich-h2">{kids}</h3>
    case 'text':
      return marked(node.text ?? '', node.marks)
    case 'hardBreak':
      return <br />
    case 'bulletList':
      return <ul>{kids}</ul>
    case 'orderedList':
      return <ol start={typeof node.attrs?.start === 'number' ? node.attrs.start : 1}>{kids}</ol>
    case 'listItem':
      return <li>{kids}</li>
    case 'blockquote':
      return <blockquote>{kids}</blockquote>
    case 'horizontalRule':
      return <hr />
    case 'codeBlock':
      return (
        <pre>
          <code>{kids}</code>
        </pre>
      )
    case 'spoiler':
      return (
        <details className="rich-spoiler">
          <summary>{String(node.attrs?.title ?? 'Spoiler')}</summary>
          <div className="rich-spoiler-body">{kids}</div>
        </details>
      )
    case 'callout': {
      const tone = String(node.attrs?.tone ?? 'note')
      return (
        <aside className={`rich-callout is-${tone}`}>
          <p className="rich-callout-says">{CALLOUT_SAYS[tone] ?? 'Note'}</p>
          {kids}
        </aside>
      )
    }
    case 'table':
      return (
        <div className="rich-table">
          <table>
            <tbody>{kids}</tbody>
          </table>
        </div>
      )
    case 'tableRow':
      return <tr>{kids}</tr>
    case 'tableHeader':
      return (
        <th colSpan={Number(node.attrs?.colspan ?? 1)} rowSpan={Number(node.attrs?.rowspan ?? 1)}>
          {kids}
        </th>
      )
    case 'tableCell':
      return (
        <td colSpan={Number(node.attrs?.colspan ?? 1)} rowSpan={Number(node.attrs?.rowspan ?? 1)}>
          {kids}
        </td>
      )
    case 'mention':
      return <MentionNode node={node} />
    default:
      return kids
  }
}

function Kids({ nodes }: { nodes: RichNode[] | undefined }) {
  if (!nodes?.length) return null
  return (
    <>
      {nodes.map((one, at) => (
        <Fragment key={at}>
          <Node node={one} />
        </Fragment>
      ))}
    </>
  )
}

export function RichView({ doc }: { doc: RichNode }) {
  return (
    <div className="rich">
      <Node node={doc} />
    </div>
  )
}
