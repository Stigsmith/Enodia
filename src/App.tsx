/**
 * The app shell, and nothing more.
 *
 * The run surface arrives at build order step 7 and 8 (DESIGN.md 10). Until
 * then this renders the frame and says plainly that it is empty, because a
 * scaffold that fakes a screen is a scaffold nobody can trust.
 */
export function App() {
  return (
    <main className="shell">
      <h1 className="wordmark">Enodia</h1>
      <p className="tagline">A build companion for Hades II, read at an Exit.</p>
      <p className="state">
        Scaffold only. The data layer and its validator are built. The run surface is not.
      </p>
    </main>
  )
}
