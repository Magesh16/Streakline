/** The mark: a streak line climbing through day-dots. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 32 32" width={size * 0.66} height={size * 0.66} fill="none">
        <path d="M4 22 L12 15 L18 19 L27 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="27" cy="8" r="3.2" fill="var(--signal)" />
      </svg>
    </span>
  );
}
