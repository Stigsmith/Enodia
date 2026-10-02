import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './ui/fonts.css'
import './ui/tokens.css'
import './ui/base.css'
import './ui/surface.css'
import './ui/sprites.css'
import './ui/builds.css'
import './ui/guides.css'
import './ui/wiki.css'
// Last, because every rule in it overrides one above, and only under a CSS skin.
import './ui/skins.css'
import { App } from './App.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('no #root in index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
