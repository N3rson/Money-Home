import { useState } from 'preact/hooks';
import { compactPLN, formatPLN } from '../lib/money';
import { MONTHS, MONTHS_SHORT, addMonths, parseMonth } from '../lib/months';
import type { MonthKey } from '../model/types';
import { useWidth } from './components';

export type Tone = 'neutral' | 'indigo' | 'clay';

const TONES: Record<Tone, { light: string; strong: string }> = {
  neutral: { light: 'var(--neutral-bar)', strong: 'var(--neutral-bar-strong)' },
  indigo: { light: 'var(--indigo-wash)', strong: 'var(--indigo)' },
  clay: { light: 'var(--clay-wash)', strong: 'var(--clay)' },
};

export function toneColors(t: Tone) {
  return TONES[t];
}

/** Round an axis maximum up to 1/2/2.5/5 × 10^n. */
function niceMax(v: number): number {
  if (v <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * exp >= v) return m * exp;
  }
  return 10 * exp;
}

/** Bar with a 4px rounded data-end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export interface MonthDatum {
  month: MonthKey;
  income: number;
  out: number;
}

/**
 * Twelve months as bullet bars: the wide light bar is income, the narrow dark
 * bar inside it is what went out. Tapping a month selects it app-wide.
 */
export function MonthBars({
  data,
  selected,
  onSelect,
  tone,
  outLabel,
  height = 156,
}: {
  data: MonthDatum[];
  selected: MonthKey;
  onSelect: (m: MonthKey) => void;
  tone: Tone;
  outLabel: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<MonthKey | null>(null);
  const c = TONES[tone];
  // bottom band holds the month labels and a small dot under the selected one
  const pad = { l: 40, r: 4, t: 10, b: 30 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.income, d.out))));
  const y = (v: number) => pad.t + plotH - (Math.max(0, v) / max) * plotH;
  const band = plotW / data.length;
  const wide = Math.min(22, band * 0.66);
  const narrow = Math.max(4, wide * 0.42);
  const ticks = [0, max / 2, max];
  const active = hover ?? selected;
  const act = data.find((d) => d.month === active);

  return (
    <div class="chart" ref={ref}>
      {/* fixed two-line readout: the chart never moves when another month is picked */}
      <div class="readout fixed" aria-live="polite">
        <strong class="ro-month">{act ? MONTHS[parseMonth(act.month).month - 1] : '\u00a0'}</strong>
        <div class="ro-values">
          <span>
            <i style={{ background: c.light }} />
            Dochód <strong class="num">{act ? formatPLN(act.income, { decimals: false }) : '—'}</strong>
          </span>
          <span>
            <i style={{ background: c.strong }} />
            {outLabel} <strong class="num">{act ? formatPLN(act.out, { decimals: false }) : '—'}</strong>
          </span>
        </div>
      </div>
      <svg width={width} height={height} role="img" aria-label={`Dochód i ${outLabel.toLowerCase()} w kolejnych miesiącach`} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line class="grid" x1={pad.l} x2={width - pad.r} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
            <text x={pad.l - 8} y={y(t) + 4} text-anchor="end">
              {compactPLN(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const isSel = d.month === selected;
          const isActive = d.month === active;
          return (
            <g key={d.month}>
              <g class="bars" opacity={isActive ? 1 : 0.42}>
                <path d={barPath(cx - wide / 2, y(d.income), wide, pad.t + plotH - y(d.income))} fill={c.light} />
                <path d={barPath(cx - narrow / 2, y(d.out), narrow, pad.t + plotH - y(d.out), 3)} fill={c.strong} />
              </g>
              <text x={cx} y={height - 13} text-anchor="middle" class={isActive ? 'tick-strong' : undefined}>
                {MONTHS_SHORT[parseMonth(d.month).month - 1]}
              </text>
              {isSel && <circle class="sel-dot" cx={cx} cy={height - 4} r={2.5} />}
              <rect
                class="hit"
                x={cx - band / 2}
                y={0}
                width={band}
                height={height}
                tabIndex={0}
                role="button"
                aria-label={`${MONTHS[i]}: dochód ${formatPLN(d.income)}, ${outLabel.toLowerCase()} ${formatPLN(d.out)}`}
                aria-pressed={isSel}
                onClick={() => onSelect(d.month)}
                onPointerEnter={(e) => (e as PointerEvent).pointerType === 'mouse' && setHover(d.month)}
                onFocus={() => setHover(d.month)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(d.month);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Two people side by side per month. */
export function PairBars({
  data,
  names,
  selected,
  onSelect,
  height = 150,
}: {
  data: { month: MonthKey; a: number; b: number }[];
  names: [string, string];
  selected: MonthKey;
  onSelect: (m: MonthKey) => void;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<MonthKey | null>(null);
  const pad = { l: 40, r: 4, t: 10, b: 30 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.a, d.b))));
  const y = (v: number) => pad.t + plotH - (Math.max(0, v) / max) * plotH;
  const band = plotW / data.length;
  const bw = Math.max(4, Math.min(11, (band * 0.72 - 2) / 2));
  const ticks = [0, max / 2, max];
  const active = hover ?? selected;
  return (
    <div class="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={`Dochody: ${names[0]} i ${names[1]} w kolejnych miesiącach`} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line class="grid" x1={pad.l} x2={width - pad.r} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
            <text x={pad.l - 8} y={y(t) + 4} text-anchor="end">
              {compactPLN(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const isSel = d.month === selected;
          const isActive = d.month === active;
          return (
            <g key={d.month}>
              <g class="bars" opacity={isActive ? 1 : 0.42}>
                <path d={barPath(cx - bw - 1, y(d.a), bw, pad.t + plotH - y(d.a), 3)} fill="var(--indigo)" />
                <path d={barPath(cx + 1, y(d.b), bw, pad.t + plotH - y(d.b), 3)} fill="var(--clay)" />
              </g>
              <text x={cx} y={height - 13} text-anchor="middle" class={isActive ? 'tick-strong' : undefined}>
                {MONTHS_SHORT[i]}
              </text>
              {isSel && <circle class="sel-dot" cx={cx} cy={height - 4} r={2.5} />}
              <rect
                class="hit"
                x={cx - band / 2}
                y={0}
                width={band}
                height={height}
                tabIndex={0}
                role="button"
                aria-label={`${MONTHS[i]}: ${names[0]} ${formatPLN(d.a)}, ${names[1]} ${formatPLN(d.b)}`}
                aria-pressed={isSel}
                onClick={() => onSelect(d.month)}
                onPointerEnter={(e) => (e as PointerEvent).pointerType === 'mouse' && setHover(d.month)}
                onFocus={() => setHover(d.month)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(d.month);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>
      <div class="legend">
        <span>
          <i style={{ background: 'var(--indigo)' }} />
          {names[0]}
        </span>
        <span>
          <i style={{ background: 'var(--clay)' }} />
          {names[1]}
        </span>
      </div>
    </div>
  );
}

export interface BalanceSeries {
  key: string;
  label: string;
  color: string;
  emphasis?: boolean;
  /** balance after each installment, from the first payment */
  values: number[];
}

/** Remaining loan balance over time; crosshair snaps to the nearest month. */
export function BalanceChart({ series, start, principal, height = 190 }: { series: BalanceSeries[]; start: MonthKey; principal: number; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 46, r: 14, t: 12, b: 26 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const n = Math.max(...series.map((s) => s.values.length), 12);
  const max = niceMax(principal);
  const x = (i: number) => pad.l + (i / n) * plotW;
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const startYear = parseMonth(start).year;
  const endYear = parseMonth(addMonths(start, n)).year;
  const step = endYear - startYear > 20 ? 5 : endYear - startYear > 8 ? 2 : 1;
  const years: number[] = [];
  for (let yr = Math.ceil(startYear / step) * step; yr <= endYear; yr += step) years.push(yr);
  const ticks = [0, max / 2, max];

  const line = (vals: number[]) => {
    const pts = [principal, ...vals];
    return pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  };
  const area = (vals: number[]) => `${line(vals)}L${x(vals.length).toFixed(1)},${y(0)}L${x(0)},${y(0)}Z`;

  const onMove = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - pad.l) / plotW) * n);
    setHover(Math.max(0, Math.min(n, i)));
  };

  const hoverMonth = hover !== null ? addMonths(start, Math.max(0, hover - 1)) : null;
  const hm = hoverMonth ? parseMonth(hoverMonth) : null;

  return (
    <div class="chart" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Saldo kredytu w czasie"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ touchAction: 'pan-y' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line class="grid" x1={pad.l} x2={width - pad.r} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
            <text x={pad.l - 8} y={y(t) + 4} text-anchor="end">
              {compactPLN(t)}
            </text>
          </g>
        ))}
        {years.map((yr) => {
          const i = (yr - startYear) * 12 - (parseMonth(start).month - 1);
          if (i < 0 || i > n) return null;
          return (
            <text key={yr} x={x(i)} y={height - 6} text-anchor="middle">
              {yr}
            </text>
          );
        })}
        {series
          .filter((s) => s.emphasis)
          .map((s) => (
            <path key={`a-${s.key}`} d={area(s.values)} fill={s.color} opacity={0.1} />
          ))}
        {series.map((s) => (
          <path key={s.key} d={line(s.values)} fill="none" stroke={s.color} stroke-width={2} stroke-linejoin="round" stroke-linecap="round" />
        ))}
        {series.map((s) => {
          const i = s.values.length;
          const endYr = parseMonth(addMonths(start, i - 1)).year;
          const ex = x(i);
          const anchor = ex > width - 40 ? 'end' : 'middle';
          return (
            <g key={`e-${s.key}`}>
              <circle cx={ex} cy={y(0)} r={4.5} fill={s.color} stroke="var(--surface)" stroke-width={2} />
              <text x={anchor === 'end' ? ex + 4 : ex} y={y(0) - 10} text-anchor={anchor} class="tick-strong">
                {endYr}
              </text>
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} stroke="var(--ink-3)" stroke-width={1} />
            {series.map((s) => {
              const v = hover === 0 ? principal : s.values[hover - 1];
              if (v === undefined) return null;
              return <circle key={s.key} cx={x(hover)} cy={y(v)} r={4} fill={s.color} stroke="var(--surface)" stroke-width={2} />;
            })}
          </g>
        )}
      </svg>
      {hover !== null && hm && (
        <div class="tooltip" style={{ left: `${Math.min(Math.max(x(hover), 90), width - 90)}px`, top: '0px' }}>
          <div>
            {MONTHS[hm.month - 1]} {hm.year}
          </div>
          {series.map((s) => {
            const v = hover === 0 ? principal : s.values[hover - 1] ?? 0;
            return (
              <div class="t-row" key={s.key}>
                <span class="key" style={{ background: s.color }} />
                <b>{formatPLN(v, { decimals: false })}</b>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <div class="legend">
        {series.map((s) => (
          <span key={s.key}>
            <i class="line" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** An open ensō ring split into parts of a whole (angles clockwise from 12 o'clock). */
export function Enso({
  parts,
  total,
  size = 132,
  children,
  label,
}: {
  parts: { value: number; color: string }[];
  total: number;
  size?: number;
  children?: preact.ComponentChildren;
  label: string;
}) {
  const sw = size > 90 ? 9 : 6;
  const r = size / 2 - sw;
  const c = size / 2;
  const start = 28; // the gap sits just right of 12 o'clock, like a brush lifting off
  const sweep = 326;
  const pt = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = pt(from);
    const [x2, y2] = pt(to);
    const large = to - from > 180 ? 1 : 0;
    return `M${x1.toFixed(2)},${y1.toFixed(2)}A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  };
  let acc = start;
  const segs = parts
    .filter((p) => p.value > 0 && total > 0)
    .map((p) => {
      const deg = Math.max(2, (p.value / total) * sweep);
      const from = acc;
      acc = Math.min(start + sweep, acc + deg);
      return { d: arc(from, acc), color: p.color };
    });
  return (
    <div class={`enso ${size < 90 ? 'sm' : ''}`} style={{ width: `${size}px`, height: `${size}px` }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <path d={arc(start, start + sweep)} fill="none" stroke="var(--surface-3)" stroke-width={sw} stroke-linecap="round" />
        {segs.map((s, i) => (
          <path key={i} d={s.d} fill="none" stroke={s.color} stroke-width={sw} stroke-linecap="round" />
        ))}
        {/* a hair of dry brush along the outer edge */}
        <path d={arc(start + 6, start + sweep - 30)} fill="none" stroke="var(--ink)" stroke-opacity={0.08} stroke-width={1} transform={`translate(0.6 -0.4)`} />
      </svg>
      <div class="center">{children}</div>
    </div>
  );
}
