/** Small line illustrations for empty states. They use theme colours, so they work in light and dark. */

const DOTS = ['#ff7a59', '#f5b83d', '#2dd4a7', '#38bdf8', '#c084fc'];

/** A streak line climbing through five days; draws itself on mount. */
export function StreakArt({ width = 220, className = '' }: { width?: number; className?: string }) {
  const pts: [number, number][] = [
    [12, 78],
    [58, 58],
    [100, 66],
    [148, 34],
    [200, 14],
  ];
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  return (
    <svg className={`art ${className}`} width={width} viewBox="0 0 212 92" role="img" aria-label="A streak climbing day by day" fill="none">
      <path className="art-line" d={d} stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
      {pts.map(([x, y], i) => (
        <circle key={i} className="art-dot" cx={x} cy={y} r={i === pts.length - 1 ? 7 : 5} fill={DOTS[i]} style={{ animationDelay: `${0.35 + i * 0.16}s` }} />
      ))}
    </svg>
  );
}

/** A stack of coins. */
export function CoinsArt({ width = 120 }: { width?: number }) {
  return (
    <svg className="art" width={width} viewBox="0 0 120 84" fill="none" role="img" aria-label="Coins">
      <ellipse cx="44" cy="64" rx="30" ry="10" stroke="var(--text-dim)" strokeWidth="2.5" fill="var(--surface-2)" />
      <path d="M14 54v10c0 5.5 13.4 10 30 10s30-4.5 30-10V54" stroke="var(--text-dim)" strokeWidth="2.5" />
      <ellipse cx="44" cy="54" rx="30" ry="10" stroke="var(--text-dim)" strokeWidth="2.5" fill="var(--surface-2)" />
      <ellipse cx="80" cy="30" rx="26" ry="9" stroke="var(--signal)" strokeWidth="2.5" fill="var(--surface-2)" />
      <path d="M54 30v10c0 5 11.6 9 26 9s26-4 26-9V30" stroke="var(--signal)" strokeWidth="2.5" />
      <path d="M72 30h16" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** A coin going out and coming back. */
export function LoopArt({ width = 120 }: { width?: number }) {
  return (
    <svg className="art" width={width} viewBox="0 0 120 84" fill="none" role="img" aria-label="Money lent and returned">
      <circle cx="28" cy="42" r="16" stroke="var(--text-dim)" strokeWidth="2.5" fill="var(--surface-2)" />
      <circle cx="92" cy="42" r="16" stroke="var(--signal)" strokeWidth="2.5" fill="var(--surface-2)" />
      <path d="M46 30c8-9 20-9 28 0" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M70 24l5 6-8 2" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M74 54c-8 9-20 9-28 0" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 7" />
      <path d="M50 60l-5-6 8-2" stroke="var(--signal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
