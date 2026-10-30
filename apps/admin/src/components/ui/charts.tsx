import { brand } from "@illyrian/config";

// Dependency-free SVG charts in the brand palette. Every chart renders only the data it is given (no smoothing
// that invents points, no fake placeholder series) and exposes the same numbers to screen readers as a table.

export const CHART_COLORS = [brand.ink, "#6e9900", "#9fa89f", "#bfff00", "#343a35", "#aeea00"] as const;

const W = 640;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export interface Series {
  name: string;
  values: number[];
  color?: string;
}

function SrTable({ labels, series, format }: { labels: string[]; series: Series[]; format: (n: number) => string }) {
  return (
    <table className="sr-only">
      <thead>
        <tr>
          <th>Period</th>
          {series.map((s) => (
            <th key={s.name}>{s.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((l, i) => (
          <tr key={l + i}>
            <th>{l}</th>
            {series.map((s) => (
              <td key={s.name}>{format(s.values[i] ?? 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Grid({ max, format, ticks = 4 }: { max: number; format: (n: number) => string; ticks?: number }) {
  const innerH = H - PAD.top - PAD.bottom;
  return (
    <g>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const y = PAD.top + innerH - (innerH * i) / ticks;
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(10,13,11,0.08)" strokeDasharray={i === 0 ? undefined : "3 4"} />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#566057">
              {format((max * i) / ticks)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XLabels({ labels }: { labels: string[] }) {
  const innerW = W - PAD.left - PAD.right;
  const every = Math.ceil(labels.length / 12);
  return (
    <g>
      {labels.map((l, i) =>
        i % every === 0 ? (
          <text key={i} x={PAD.left + (innerW * (i + 0.5)) / labels.length} y={H - 8} textAnchor="middle" fontSize="11" fill="#566057">
            {l}
          </text>
        ) : null,
      )}
    </g>
  );
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
      {series.map((s, i) => (
        <li key={s.name} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Grouped vertical bars. The last period is the "current" one and is drawn in lime-on-ink for emphasis. */
export function BarChart({
  labels,
  series,
  format = (n) => String(Math.round(n)),
  ariaLabel,
}: {
  labels: string[];
  series: Series[];
  format?: (n: number) => string;
  ariaLabel: string;
}) {
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const groupW = innerW / Math.max(1, labels.length);
  const barW = Math.min(36, (groupW * 0.7) / series.length);
  return (
    <figure>
      <Legend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
        <Grid max={max} format={format} />
        {labels.map((_, i) =>
          series.map((s, si) => {
            const v = s.values[i] ?? 0;
            const h = (v / max) * innerH;
            const x = PAD.left + groupW * i + (groupW - barW * series.length) / 2 + barW * si;
            return (
              <rect
                key={`${i}-${si}`}
                x={x}
                y={PAD.top + innerH - h}
                width={Math.max(2, barW - 3)}
                height={Math.max(0, h)}
                rx={4}
                fill={s.color ?? CHART_COLORS[si % CHART_COLORS.length]}
                opacity={series.length === 1 && i !== labels.length - 1 ? 0.88 : 1}
              >
                <title>{`${labels[i]} - ${s.name}: ${format(v)}`}</title>
              </rect>
            );
          }),
        )}
        <XLabels labels={labels} />
      </svg>
      <SrTable labels={labels} series={series} format={format} />
    </figure>
  );
}

/** Straight-segment line chart (no curve smoothing, so the line never implies values that were not recorded). */
export function LineChart({
  labels,
  series,
  format = (n) => String(Math.round(n)),
  ariaLabel,
}: {
  labels: string[];
  series: Series[];
  format?: (n: number) => string;
  ariaLabel: string;
}) {
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (innerW * (i + 0.5)) / Math.max(1, labels.length);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  return (
    <figure>
      <Legend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
        <Grid max={max} format={format} />
        {series.map((s, si) => {
          const color = s.color ?? CHART_COLORS[si % CHART_COLORS.length];
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const area = `${x(0)},${PAD.top + innerH} ${pts} ${x(s.values.length - 1)},${PAD.top + innerH}`;
          return (
            <g key={s.name}>
              {si === 0 && series.length === 1 && s.values.length > 1 && <polygon points={area} fill={brand.lime} opacity={0.28} />}
              <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5}>
                  <title>{`${labels[i]} - ${s.name}: ${format(v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        <XLabels labels={labels} />
      </svg>
      <SrTable labels={labels} series={series} format={format} />
    </figure>
  );
}

export interface Segment {
  label: string;
  value: number;
  color?: string;
}

/** Share-of-total ring. Centre text shows the total; segments with value 0 are omitted. */
export function DonutChart({ segments, centerLabel, ariaLabel }: { segments: Segment[]; centerLabel: string; ariaLabel: string }) {
  const parts = segments.filter((s) => s.value > 0);
  const total = parts.reduce((n, s) => n + s.value, 0);
  const R = 62;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <figure className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 160 160" role="img" aria-label={ariaLabel} className="h-40 w-40 shrink-0">
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(10,13,11,0.08)" strokeWidth="18" />
        {parts.map((s, i) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={s.label}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth="18"
              strokeDasharray={`${Math.max(0, len - 2)} ${C - Math.max(0, len - 2)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x="80" y="78" textAnchor="middle" className="font-heading" fontSize="26" fontWeight="800" fill={brand.ink}>
          {total}
        </text>
        <text x="80" y="96" textAnchor="middle" fontSize="10" fill="#566057">
          {centerLabel}
        </text>
      </svg>
      <ul className="min-w-[10rem] flex-1 space-y-2 text-sm">
        {parts.length === 0 && <li className="text-text-muted">No data yet.</li>}
        {parts.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
              {s.label}
            </span>
            <span className="tabular font-bold text-text-primary">
              {s.value} <span className="font-medium text-text-muted">({Math.round((s.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Tiny inline trend line for stat cards. */
export function Sparkline({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - (v / max) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" role="img" aria-label={ariaLabel} className="h-8 w-24">
      <polyline points={pts} fill="none" stroke={brand.ink} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
