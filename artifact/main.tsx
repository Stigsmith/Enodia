/**
 * The build manager, on its own, for showing somebody.
 *
 * The owner wants a second opinion on which of the five layouts to keep, and
 * that reader is not going to install anything. So this entry renders `Builds`
 * and nothing else: no run, no menu, no setup. `scripts/artifact.ts` builds it
 * and folds the whole thing, art included, into one HTML file.
 *
 * **It is the same components.** Nothing here reimplements a layout. If the
 * five diverge from what the app does, that is a bug in this file, and the only
 * way it could happen is by someone adding a variant here rather than in
 * `src/ui/variants`.
 *
 * This is not the public site. enodia.me serves the app itself, and putting a
 * design switcher and three "these are samples" notices there would be the
 * wrong thing entirely.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../src/ui/tokens.css'
import '../src/ui/base.css'
import '../src/ui/surface.css'
import '../src/ui/sprites.css'
import '../src/ui/builds.css'
import { Builds } from '../src/ui/Builds.tsx'
import { Hecate } from '../src/ui/Hecate.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('no #root in index.html')

createRoot(root).render(
  <StrictMode>
    <div className="shell is-wide">
      <Hecate />
      {/* No `onClose`: there is nowhere to go back to here. */}
      <Builds />
    </div>
  </StrictMode>,
)
