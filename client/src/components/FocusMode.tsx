import { useEffect } from 'react';
import { Check, Minimize2, Pause, Play, Square } from 'lucide-react';
import { Ring } from './ui';
import { useNow } from '../lib/hooks';
import { dayKey, fmtClock, secondsOn } from '../lib/stats';
import { timerElapsedMs, useApp } from '../store';

/** Full-screen timer for when the phone is propped up at the gym or on the desk. */
export function FocusMode() {
  const { timer, habits, index, focusOpen, setFocusOpen, pauseTimer, resumeTimer, openSession } = useApp();
  const now = useNow(250);
  const habit = habits.find((h) => h.id === timer?.habitId);
  const open = focusOpen && Boolean(timer && habit);

  // leave focus mode when the timer ends; keep the screen awake while it is open
  useEffect(() => {
    if (focusOpen && !timer) setFocusOpen(false);
  }, [focusOpen, timer, setFocusOpen]);

  useEffect(() => {
    if (!open) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFocusOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      void lock?.release().catch(() => undefined);
    };
  }, [open, setFocusOpen]);

  if (!open || !timer || !habit) return null;

  const running = Boolean(timer.runningSince);
  const elapsed = timerElapsedMs(timer, now);
  const target = habit.minutesPerDay * 60;
  const total = secondsOn(index, habit.id, dayKey(new Date(now))) + elapsed / 1000;
  const left = Math.max(0, Math.ceil((target - total) / 60));
  const hit = total >= target;

  async function stop() {
    await pauseTimer();
    setFocusOpen(false);
    openSession({ kind: 'finish' });
  }

  return (
    <div className="focus" role="dialog" aria-modal="true" aria-label="Focus mode" style={{ ['--hc' as string]: habit.color }}>
      <button className="btn btn-ghost btn-icon focus-min" onClick={() => setFocusOpen(false)} aria-label="Leave focus mode">
        <Minimize2 size={20} />
      </button>
      <div className="focus-body">
        <p className="focus-name">{habit.name}</p>
        <Ring size={320} stroke={14} pct={total / target} color={habit.color} label={`${Math.floor(total / 60)} of ${habit.minutesPerDay} minutes today`}>
          <div className="focus-clock" aria-live="off">
            {fmtClock(elapsed)}
          </div>
        </Ring>
        <p className="focus-goal">
          {hit ? (
            <>
              <Check size={18} strokeWidth={3} /> Daily goal hit{total - target >= 60 ? ` · ${Math.floor((total - target) / 60)} min over` : ''}
            </>
          ) : (
            <>
              {left} min to today's goal of {habit.minutesPerDay}
            </>
          )}
        </p>
        <div className="focus-actions">
          <button className="btn focus-btn" onClick={running ? pauseTimer : resumeTimer} aria-label={running ? 'Pause timer' : 'Resume timer'}>
            {running ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}
            {running ? 'Pause' : 'Resume'}
          </button>
          <button className="btn btn-habit focus-btn" onClick={stop} aria-label="Stop and save">
            <Square size={20} fill="currentColor" /> Stop &amp; save
          </button>
        </div>
      </div>
    </div>
  );
}
