/**
 * Hidden SVG <defs> referenced by the global chart theme in index.css.
 * Mounted once in the app shell so every recharts bar/pie picks up soft gradients.
 */
const STOPS: [id: string, top: string, bottom: string][] = [
  ["teal", "#3FB3A6", "#2A8C82"],
  ["green", "#34D399", "#21865B"],
  ["amber", "#F5C15A", "#D69A32"],
  ["violet", "#8B8CF8", "#5457D6"],
  ["blue", "#6BA3E8", "#4779B8"],
  ["red", "#EE7B7B", "#C94C4C"],
]

export default function ChartGradients() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        {STOPS.map(([id, top, bottom]) => (
          <g key={id}>
            <linearGradient id={`cg-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={top} />
              <stop offset="100%" stopColor={bottom} />
            </linearGradient>
            <linearGradient id={`cg-${id}-r`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={top} />
              <stop offset="100%" stopColor={bottom} />
            </linearGradient>
          </g>
        ))}
      </defs>
    </svg>
  )
}
