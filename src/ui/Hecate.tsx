/**
 * The room the tool is standing in.
 *
 * `tokens.css` takes jade from Hecate's portrait and calls it the living
 * light, so the page is lit by it and by nothing else. Three fixed layers
 * behind everything: drifting blooms, two fields of rising dust, and a
 * vignette. All of it is decoration, so it is aria-hidden and inert, and
 * `prefers-reduced-motion` stops every animation in it.
 */
export function Hecate() {
  return (
    <div className="hecate" aria-hidden="true">
      <div className="hecate-glow" />
      <div className="hecate-motes is-far" />
      <div className="hecate-motes" />
      <div className="hecate-vignette" />
    </div>
  )
}
