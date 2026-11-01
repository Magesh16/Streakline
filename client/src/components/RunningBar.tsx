import { useEffect, useRef } from 'react';
import { Maximize2, Pause, Play, Square } from 'lucide-react';
import { useNow } from '../lib/hooks';
import { dayKey, fmtClock, secondsOn } from '../lib/stats';
import { timerElapsedMs, useApp } from '../store';

/** Floating timer pill shown on every page, plus the tab title and the "goal hit" toast. */
export function RunningBar() {
  const { timer, habits, index, pauseTimer, resumeTimer, openSession, toast, setFocusOpen } = useApp();
  const now = useNow(250);
  const habit = habits.find((h) => h.id === timer?.habitId);
  const notified = useRef<string | null>(null);

  const elapsed = timer ? timerElapsedMs(timer, now) : 0;
  const clock = fmtClock(elapsed);

  useEffect(() => {
    document.title = timer && habit ? `${timer.runningSince ? '▶' : '⏸'} ${clock} · ${habit.name}` : 'Streakline';
  }, [clock, timer, habit]);

  useEffect(() => {
    if (!timer || !habit) return;
    const total = secondsOn(index, habit.id, dayKey(new Date())) + elapsed / 1000;
    if (total >= habit.minutesPerDay * 60 && notified.current !== timer.startedAt) {
      notified.current = timer.startedAt;
      toast(`Daily goal hit for ${habit.name} 🎯 Keep going or save it.`);
    }
  }, [elapsed, timer, habit, index, toast]);

  useEffect(() => () => void (document.title = 'Streakline'), []);

  if (!timer || !habit) return null;

  const running = Boolean(timer.runningSince);
  async function stop() {
    await pauseTimer();
    openSession({ kind: 'finish' });
  }

  return (
    <div className="runbar" style={{ ['--hc' as string]: habit.color }} role="region" aria-label="Running timer">
      <span className={`dot ${running ? '' : 'paused'}`} />
      <span className="runbar-name">{habit.name}</span>
      <span className="timer-readout runbar-time">{clock}</span>
      <button className="btn btn-ghost btn-icon runbar-expand" onClick={() => setFocusOpen(true)} aria-label="Open focus mode" title="Focus mode">
        <Maximize2 size={17} />
      </button>
      <button className="btn btn-icon" onClick={running ? pauseTimer : resumeTimer} aria-label={running ? 'Pause timer' : 'Resume timer'}>
        {running ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button className="btn btn-icon btn-habit" onClick={stop} aria-label="Stop and save">
        <Square size={16} fill="currentColor" />
      </button>
    </div>
  );
}
