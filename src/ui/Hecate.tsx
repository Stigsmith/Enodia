/**
 * The room the tool is standing in.
 *
 * `tokens.css` takes jade from Hecate's portrait and calls it the living
 * light, so the page is lit by it and by nothing else. Fixed layers behind
 * everything: a wallpaper, the theme's own fog, drifting blooms, three fields of
 * dust at three depths, and a vignette. What the dust does is the theme's: it rises, falls,
 * flickers or holds still as stars. All of it is decoration, so it is aria-hidden and inert, and
 * `prefers-reduced-motion` stops every animation in it.
 *
 * **The wallpaper is under the light, not over it.** The blooms wash across it
 * and the vignette eats its edges, which is what keeps a photograph of the
 * Crossroads from reading as a photograph pasted behind a tool. `wallpaper.ts`
 * chooses the picture and how far down it sits; this only says where in the
 * stack it goes.
 */
export function Hecate() {
  return (
    <div className="hecate" aria-hidden="true">
      <div className="hecate-wall" />
      <div className="hecate-fog" />
      <div className="hecate-glow" />
      <div className="hecate-motes is-far" />
      <div className="hecate-motes" />
      <div className="hecate-motes is-near" />
      <div className="hecate-vignette" />
    </div>
  )
}
