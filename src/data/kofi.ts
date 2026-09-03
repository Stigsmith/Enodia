/**
 * Where a tip goes, and the only place the handle is written.
 *
 * Two things ask for it now, the footer and Dora on the landing page, and a
 * second copy is how they end up pointing at different places. Empty means
 * neither draws anything, so a placeholder can never ship aimed at a stranger's
 * donation page.
 *
 * **A plain link, never the widget.** Ko-fi's embed wants `script-src` and
 * `frame-src` opened onto a third party, which is the same hole the Google
 * Fonts stylesheet was and which `assets/_headers` exists to keep shut. A
 * top-level navigation from an anchor is not governed by `default-src`, and
 * `form-action 'none'` only blocks form submissions, so a link costs the policy
 * nothing.
 *
 * Ko-fi rather than Buy Me a Coffee because Ko-fi takes 0% of a one-off
 * donation and Buy Me a Coffee takes 5%, with no tier that removes it.
 */
export const KOFI = 'stigsmith'

/** The whole URL, or null when there is no handle to point at. */
export const kofiUrl = (): string | null => (KOFI ? `https://ko-fi.com/${KOFI}` : null)
