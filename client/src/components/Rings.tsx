import type { ReactNode } from 'react';

export interface RingItem {
  pct: number; // 0..1
  color: string;
  name: string;
  detail: string;
}

/** One ring per activity, outermost first, like activity rings: a whole week at a glance. */
export function ConcentricRings({ items, size = 140, children, label }: { items: RingItem[]; size?: number; children?: ReactNode; label: string }) {
  const hole = 24; // radius left free in the middle for the number
  const pitch = Math.min(14, (size / 2 - hole) / Math.max(1, items.length));
  const stroke = Math.max(3, pitch - 3.5);
  return (
    <div className="rings" style={{ ['--rs' as string]: `${size}px` }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
        {items.map((it, i) => {
          const r = size / 2 - stroke / 2 - i * pitch - 1;
          const c = 2 * Math.PI * r;
          const p = Math.max(0, Math.min(1, it.pct));
          return (
            <g key={i}>
              <title>{`${it.name}: ${it.detail}`}</title>
              <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
              <circle
                className={`ring-bar ${p >= 1 ? 'ring-done' : ''} ${p <= 0 ? 'ring-empty' : ''}`}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={it.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - p)}
                style={{ ['--c' as string]: c, ['--off' as string]: c * (1 - p), ['--ring-glow' as string]: it.color, animationDelay: `${i * 90}ms` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
