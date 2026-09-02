/**
 * A row of tabs, wearing the game's own button art.
 *
 * The game puts a row of these across the top of its trays: a pill each, the
 * live one lit. `assets/shell/button.png` and `buttonselected-highlight.png`
 * are that art, and both were sitting in the library unused.
 *
 * **Why the builder needed them.** It was three panels in a two-column grid, so
 * a wide screen wrapped the third and left a column of nothing, with nine
 * stacked headings inside. Tabs turn nine headings into five, put one screenful
 * on screen at a time, and free the other half of the width for the tray.
 *
 * Deliberately not a routing concern. Which tab is open is a detail of one
 * form, not a place in the app, so it does not belong in the URL: a shared link
 * to the builder pointing at the Arcana tab would be an odd thing to send.
 */

export type Tab<T extends string> = {
  id: T
  label: string
  /** shown in the corner of the tab, for a tab that has a count worth knowing */
  count?: number
}

export function Tabs<T extends string>({
  tabs,
  open,
  onOpen,
  label,
}: {
  tabs: readonly Tab<T>[]
  open: T
  onOpen: (id: T) => void
  label: string
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          /* So a tour step can press this one before it talks about it. Every
           * tab row in the tool gets the anchor, not just the editor's. */
          data-tour={`tab-${tab.id}`}
          aria-selected={tab.id === open}
          aria-controls={`panel-${tab.id}`}
          className={`tab${tab.id === open ? ' is-open' : ''}`}
          onClick={() => onOpen(tab.id)}
        >
          <span className="tab-label">{tab.label}</span>
          {/* Zero is drawn, and that is the point of the count: an empty Arcana
            * tab should say so from the outside rather than after a click. */}
          {tab.count === undefined ? null : <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** The panel a tab controls. Wired for a screen reader, plain for everyone else. */
export function TabPanel<T extends string>({
  id,
  open,
  children,
}: {
  id: T
  open: T
  children: React.ReactNode
}) {
  if (id !== open) return null
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="tabpanel">
      {children}
    </div>
  )
}
