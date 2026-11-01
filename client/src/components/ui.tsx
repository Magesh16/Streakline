import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { iconFor } from '../lib/habitTypes';
import type { Habit } from '../types';

export function HabitIcon({ habit, size = 20 }: { habit: Pick<Habit, 'type' | 'icon'>; size?: number }) {
  const Icon = iconFor(habit);
  return <Icon size={size} strokeWidth={2.2} aria-hidden />;
}

interface RingProps {
  size?: number;
  stroke?: number;
  pct: number; // 0..1
  color: string;
  children?: ReactNode;
  label?: string;
}

export function Ring({ size = 96, stroke = 9, pct, color, children, label }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div className="ring" style={{ ['--rs' as string]: `${size}px`, ['--ring-glow' as string]: color }} role="img" aria-label={label ?? `${Math.round(p * 100)}%`}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className={`ring-bar ${p >= 1 ? 'ring-done' : ''} ${p <= 0 ? 'ring-empty' : ''}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ ['--c' as string]: c, ['--off' as string]: c * (1 - p) }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="modal-head">
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close" data-close>
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch-track" />
      {label}
    </button>
  );
}
