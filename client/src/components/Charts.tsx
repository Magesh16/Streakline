import { useEffect, useRef } from 'react';
import { WEEKDAYS, dayKey, type HeatCell, type WeekPoint } from '../lib/stats';

/** GitHub-style grid. Columns are weeks (oldest first), rows are Mon..Sun. */
export function Heatmap({ cols, color }: { cols: HeatCell[][]; color: string }) {
  const todayKey = dayKey(new Date());
  // label a month at its first column, but never closer than 3 columns to the previous label
  let lastLabel = -3;
  const months = cols.map((col, i) => {
    const first = col[0].date;
    const prev = i > 0 ? cols[i - 1][0].date : null;
    if ((prev && prev.getMonth() === first.getMonth()) || i - lastLabel < 3) return '';
    lastLabel = i;
    return first.toLocaleDateString(undefined, { month: 'short' });
  });
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // on narrow screens start at the most recent weeks, not the oldest
    if (wrap.current) wrap.current.scrollLeft = wrap.current.scrollWidth;
  }, [cols.length]);
  return (
    <div>
      <div className="heat-wrap" ref={wrap}>
        <div className="heat-layout">
          <div className="heat-days" aria-hidden>
            {WEEKDAYS.map((d, i) => (
              <span key={d}>{i % 2 === 0 ? d : ''}</span>
            ))}
          </div>
          <div>
            <div className="heat-months" aria-hidden>
              {months.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
            <div className="heat" role="img" aria-label="Activity heatmap for the last weeks">
              {cols.flat().map((c, idx) => {
                const level = c.pct <= 0 ? 0 : c.pct < 0.5 ? 0.3 : c.pct < 1 ? 0.6 : 1;
                const label = `${c.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${Math.round(c.seconds / 60)} min${c.pct >= 1 ? ' · goal hit' : ''}`;
                return (
                  <div
                    key={c.key}
                    title={c.future ? '' : label}
                    className={`heat-cell ${c.future ? 'future' : ''} ${!c.active && !c.future ? 'inactive' : ''} ${c.key === todayKey ? 'today' : ''}`}
                    style={{ ['--i' as string]: idx, ...(!c.future && level > 0 ? { background: `color-mix(in srgb, ${color} ${Math.round(level * 100)}%, var(--cell))` } : {}) }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="legend" aria-hidden>
        Less
        {[0, 0.3, 0.6, 1].map((l) => (
          <i key={l} style={{ background: l ? `color-mix(in srgb, ${color} ${l * 100}%, var(--cell))` : 'var(--cell)' }} />
        ))}
        More
      </div>
    </div>
  );
}

/** Days counted per week against the weekly target, last N weeks. */
export function WeekBars({ points, target, color, wide = false }: { points: WeekPoint[]; target: number; color: string; wide?: boolean }) {
  // viewBox matches the rendered width so text stays ~1:1 instead of scaling up with the card
  const W = wide ? 940 : 520;
  const H = wide ? 210 : 190;
  const padL = 8;
  const padB = 28;
  const padT = 20;
  const slot = (W - padL) / points.length;
  const bw = Math.min(wide ? 56 : 40, slot * 0.58);
  const y = (v: number) => H - padB - (v / 7) * (H - padB - padT);
  return (
    <div className="bars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Days completed per week against a target of ${target}`}>
        {[0, 7].map((v) => (
          <line key={v} x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="var(--cell)" strokeWidth={1} />
        ))}
        {points.map((p, i) => {
          const cx = padL + slot * i + slot / 2;
          const h = y(0) - y(p.counted);
          return (
            <g key={p.weekStart.getTime()}>
              <rect x={cx - bw / 2} y={y(0) - Math.max(h, 2)} width={bw} height={Math.max(h, 2)} rx={7} fill={color} opacity={p.complete ? 1 : 0.4}>
                <title>{`Week of ${p.weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${p.counted}/${target} days · ${p.minutes} min`}</title>
              </rect>
              {p.counted > 0 && (
                <text className="bar-val" x={cx} y={y(0) - h - 6} textAnchor="middle">
                  {p.counted}
                </text>
              )}
              <text className="bar-label" x={cx} y={H - 8} textAnchor="middle">
                {p.weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            </g>
          );
        })}
        <line x1={padL} x2={W} y1={y(target)} y2={y(target)} stroke="var(--text-dim)" strokeWidth={1.5} strokeDasharray="5 5" />
        <text className="bar-label" x={W} y={y(target) - 6} textAnchor="end">
          target {target}
        </text>
      </svg>
    </div>
  );
}

/** Spend per day of a month. Bars share one scale; today is outlined. */
export function DayBars({ days, color, todayIndex, format }: { days: { total: number; label: string }[]; color: string; todayIndex: number; format: (minor: number) => string }) {
  const W = 380; // close to the card's rendered width, so labels aren't shrunk
  const H = 150;
  const padB = 22;
  const padT = 8;
  const max = Math.max(1, ...days.map((d) => d.total));
  const slot = W / days.length;
  const bw = Math.max(3, slot * 0.66);
  const y = (v: number) => H - padB - (v / max) * (H - padB - padT);
  return (
    <div className="bars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Spending per day this month">
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--cell)" strokeWidth={1} />
        {days.map((d, i) => {
          const cx = slot * i + slot / 2;
          const h = Math.max(d.total > 0 ? 3 : 0, y(0) - y(d.total));
          return (
            <g key={i}>
              {d.total > 0 && (
                <rect x={cx - bw / 2} y={y(0) - h} width={bw} height={h} rx={3} fill={color} opacity={i === todayIndex ? 1 : 0.7}>
                  <title>{`${d.label}: ${format(d.total)}`}</title>
                </rect>
              )}
              {(i === 0 || (i + 1) % 5 === 0 || (i === days.length - 1 && (i + 1) % 5 >= 3)) && (
                <text className="bar-label" x={cx} y={H - 6} textAnchor="middle" style={{ fontSize: 11, ...(i === todayIndex ? { fill: 'var(--text)' } : {}) }}>
                  {i + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
