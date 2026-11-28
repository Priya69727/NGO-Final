/**
 * Shared chart theme for recharts.
 *
 * Tooltips, grid lines, axis text, legends and hover effects are styled
 * globally in styles/modern.css. This file adds what CSS cannot:
 * the colour palette, reusable gradient <defs>, and axis/grid presets.
 *
 * Usage:
 *   <BarChart data={d}>
 *     <ChartGradients />
 *     <CartesianGrid {...GRID} />
 *     <XAxis dataKey="name" {...AXIS} />
 *     <YAxis {...AXIS} />
 *     <Bar dataKey="value" fill={gradientUrl('teal')} radius={BAR_RADIUS} />
 *   </BarChart>
 */

export const CHART_COLORS = {
  teal: '#2A8C82',
  cyan: '#1AACB8',
  blue: '#4779B8',
  indigo: '#6366F1',
  pink: '#E879A0',
  amber: '#D69A32',
  green: '#21865B',
  red: '#C94C4C',
  slate: '#94A3B8',
} as const;

export type ChartColorKey = keyof typeof CHART_COLORS;

/** Ordered palette for multi-series / pie charts. */
export const CHART_PALETTE = [
  CHART_COLORS.teal,
  CHART_COLORS.indigo,
  CHART_COLORS.amber,
  CHART_COLORS.pink,
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.cyan,
  CHART_COLORS.red,
];

/** Axis preset: no axis lines / ticks, soft labels (colour comes from CSS). */
export const AXIS = { axisLine: false, tickLine: false, tickMargin: 8 } as const;

/** Grid preset: horizontal dashed lines only (colour comes from CSS). */
export const GRID = { vertical: false, strokeDasharray: '4 6' } as const;

/** Rounded top corners for vertical bars. */
export const BAR_RADIUS: [number, number, number, number] = [8, 8, 0, 0];
/** Rounded right corners for horizontal bars. */
export const BAR_RADIUS_H: [number, number, number, number] = [0, 8, 8, 0];

/** Returns the url() for a gradient defined by <ChartGradients />. */
export const gradientUrl = (key: ChartColorKey) => `url(#cg-${key})`;
export const areaGradientUrl = (key: ChartColorKey) => `url(#cga-${key})`;

/**
 * Drop inside any recharts chart. Defines:
 *   cg-<color>   vertical solid -> lighter gradient (for bars)
 *   cga-<color>  colour -> transparent gradient   (for areas)
 */
export function ChartGradients({ keys = Object.keys(CHART_COLORS) as ChartColorKey[] }: { keys?: ChartColorKey[] }) {
  return (
    <defs>
      {keys.map((k) => (
        <g key={k}>
          <linearGradient id={`cg-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS[k]} stopOpacity={1} />
            <stop offset="100%" stopColor={CHART_COLORS[k]} stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id={`cga-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS[k]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLORS[k]} stopOpacity={0} />
          </linearGradient>
        </g>
      ))}
    </defs>
  );
}
