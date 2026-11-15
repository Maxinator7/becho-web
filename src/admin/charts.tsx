import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { fmtNum } from './ui';

/*
 * Lightweight SVG/HTML charts for the admin overview. Follows the dataviz rules:
 * categorical slots in fixed order (--viz-1..3), 2px lines, ~10% area wash,
 * hairline recessive grid, ≤24px bars with 4px rounded data ends, legend for ≥2
 * series, text in text tokens (never series colour), hover tooltips, keyboard
 * focus, and a table view for every chart.
 */

export const SERIES_COLORS = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)'];

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(240, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Clean integer ticks: 0..max in 3–5 steps of 1/2/5×10ⁿ. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? pow * 10);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v));
  return ticks;
}

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const tickLabel = (v: number, top: number) => (top >= 10000 ? compact.format(v) : fmtNum(v));
const dayShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const parseDay = (d: string) => new Date(`${d}T00:00:00Z`);

/* ------------------------------------------------------------------ */
/* Chart frame with title, legend and table toggle                     */
/* ------------------------------------------------------------------ */

export const ChartCard: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  legend?: { label: string; color: string }[];
  table: { columns: string[]; rows: (string | number)[][] };
  extra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, legend, table, extra, children }) => {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="a-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="a-card__head" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="a-card__title">{title}</h2>
          {subtitle && <div className="a-card__sub">{subtitle}</div>}
        </div>
        <div className="a-row" style={{ gap: 10 }}>
          {extra}
          <button
            type="button"
            onClick={() => setShowTable((s) => !s)}
            aria-pressed={showTable}
            title={showTable ? 'Show chart' : 'Show as table'}
            className="a-btn a-btn--soft a-btn--sm"
          >
            {showTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
            {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </div>
      {legend && legend.length > 1 && !showTable && (
        <div className="a-legend" style={{ marginBottom: 10 }}>
          {legend.map((l) => (
            <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 3, borderRadius: 2, background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      {showTable ? <DataTable {...table} /> : children}
    </section>
  );
};

const DataTable: React.FC<{ columns: string[]; rows: (string | number)[][] }> = ({ columns, rows }) => (
  <div className="a-table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
    <table className="a-table a-table--compact" style={{ fontSize: '0.8rem' }}>
      <thead>
        <tr>{columns.map((c, i) => <th key={c} className={i > 0 ? 'a-td-num' : undefined}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((v, j) => <td key={j} className={j > 0 ? 'a-td-num' : undefined}>{typeof v === 'number' ? fmtNum(v) : v}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ChartEmpty: React.FC<{ text: string; height?: number }> = ({ text, height = 180 }) => (
  <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--a-muted)', fontSize: '0.85rem', border: '1px dashed var(--a-border-strong)', borderRadius: '8px' }}>
    {text}
  </div>
);

/* ------------------------------------------------------------------ */
/* Daily line chart                                                    */
/* ------------------------------------------------------------------ */

export interface LineSeries { key: string; label: string; color: string; values: number[] }

export const LineChart: React.FC<{ days: string[]; series: LineSeries[]; height?: number; emptyText?: string }> = ({ days, series, height = 200, emptyText = 'No activity in this period' }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const total = series.reduce((s, x) => s + x.values.reduce((a, b) => a + b, 0), 0);
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const m = { t: 10, r: 14, b: 26, l: top >= 1000 ? 44 : 32 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const n = days.length;
  const x = (i: number) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / top) * ih;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));
  const single = series.length === 1;

  const indexAt = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - m.l;
    return Math.min(n - 1, Math.max(0, Math.round(n <= 1 ? 0 : (px / iw) * (n - 1))));
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {total === 0 ? (
        <ChartEmpty text={emptyText} height={height} />
      ) : (
        <>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${series.map((s) => s.label).join(', ')} per day. Use arrow keys to inspect days.`}
            tabIndex={0}
           
            style={{ display: 'block', borderRadius: 6 }}
            onMouseMove={(e) => setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onMouseLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
              else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
              else if (e.key === 'Escape') setHover(null);
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'} strokeWidth={1} />
                <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--a-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {tickLabel(t, top)}
                </text>
              </g>
            ))}
            {days.map((d, i) => {
              // Label every `labelEvery` days counting back from today, so the latest day is always labelled.
              const fromEnd = n - 1 - i;
              if (fromEnd % labelEvery !== 0) return null;
              if (i < labelEvery * 0.6 && i !== 0 && fromEnd !== 0) return null;
              return (
                <text key={d} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--a-muted)">
                  {dayShort.format(parseDay(d))}
                </text>
              );
            })}
            {series.map((s) => {
              const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
              return (
                <g key={s.key}>
                  {single && <polygon points={`${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`} fill={s.color} opacity={0.1} />}
                  <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              );
            })}
            {hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="var(--viz-axis)" strokeWidth={1} />
                {series.map((s) => (
                  <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke="var(--a-surface)" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
          {hover !== null && (
            <div
              role="status"
              style={{
                position: 'absolute', top: 4, pointerEvents: 'none',
                left: x(hover) > width - 190 ? Math.max(0, x(hover) - 182) : x(hover) + 12,
                width: 170, background: 'var(--a-surface)', border: '1px solid var(--a-border-strong)', borderRadius: 8,
                boxShadow: 'var(--a-shadow-lg)', padding: '0.5rem 0.65rem', fontSize: '0.78rem', zIndex: 2,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{dayLong.format(parseDay(days[hover]))}</div>
              {series.map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--a-text-2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                  <span style={{ color: 'var(--a-text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(s.values[hover])}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Horizontal bar chart (single series, value at the tip)              */
/* ------------------------------------------------------------------ */

export const HBarChart: React.FC<{
  rows: { label: string; value: number; note?: string }[];
  color?: string;
  emptyText?: string;
  valueSuffix?: (row: { label: string; value: number; note?: string }) => string | undefined;
}> = ({ rows, color = 'var(--viz-1)', emptyText = 'No data yet', valueSuffix }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (rows.length === 0 || max === 0) return <ChartEmpty text={emptyText} height={140} />;
  return (
    <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {rows.map((r, i) => {
        const pct = (r.value / max) * 100;
        const suffix = valueSuffix?.(r);
        return (
          <div
            key={r.label}
            role="listitem"
            tabIndex={0}
           
            aria-label={`${r.label}: ${fmtNum(r.value)}${suffix ? ` (${suffix})` : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 32%) minmax(0, 1fr)', alignItems: 'center', gap: '0.75rem', borderRadius: 6, padding: '2px 4px', background: hover === i ? 'var(--a-surface-2)' : 'transparent' }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--a-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>
              {r.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <div style={{ flex: `0 1 ${pct}%`, minWidth: r.value > 0 ? 4 : 0, height: 16, background: color, borderRadius: '0 4px 4px 0', opacity: hover === null || hover === i ? 1 : 0.55, transition: 'opacity 0.15s' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(r.value)}
                {suffix && <span style={{ fontWeight: 400, color: 'var(--a-muted)' }}> · {suffix}</span>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
