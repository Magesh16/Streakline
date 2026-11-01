import { Check, Flame, Pause, Play, Plus, Square } from 'lucide-react';
import { HabitIcon, Ring } from './ui';
import { useNow } from '../lib/hooks';
import { WEEKDAY_LETTERS, fmtClock, type WeekInfo } from '../lib/stats';
import { timerElapsedMs, useApp } from '../store';
import type { Habit } from '../types';

interface Props {
  habit: Habit;
  week: WeekInfo;
  streakWeeks: number;
  todaySeconds: number;
}

export function WeekDots({ week }: { week: WeekInfo }) {
  return (
    <div className="week-dots" role="list" aria-label="This week">
      {week.days.map((d, i) => (
        <div key={d.key} role="listitem" className={`wd ${d.isToday ? 'today' : ''}`} title={`${d.date.toDateString()} · ${Math.round(d.seconds / 60)} min`}>
          <div className={`wd-dot ${d.counted ? 'counted' : ''} ${d.isFuture ? 'future' : ''} ${d.beforeStart ? 'before' : ''}`} style={{ ['--p' as string]: d.counted ? 1 : d.pct }}>
            {d.counted && <Check size={14} strokeWidth={3.5} />}
          </div>
          {WEEKDAY_LETTERS[i]}
        </div>
      ))}
    </div>
  );
}

function statusPill(week: WeekInfo) {
  switch (week.status) {
    case 'done':
      return <span className="pill pill-success">Week complete</span>;
    case 'at-risk':
      return <span className="pill pill-warn">Every remaining day counts</span>;
    case 'missed':
      return <span className="pill pill-danger">Target out of reach</span>;
    default:
      return <span className="pill">On track</span>;
  }
}

export function HabitCard({ habit, week, streakWeeks, todaySeconds }: Props) {
  const { timer, startTimer, pauseTimer, resumeTimer, openSession } = useApp();
  const mine = timer?.habitId === habit.id ? timer : null;
  const now = useNow(mine?.runningSince ? 250 : 60_000);
  const liveSec = mine ? timerElapsedMs(mine, now) / 1000 : 0;

  const target = habit.minutesPerDay * 60;
  const total = todaySeconds + liveSec;
  const pct = total / target;
  const hit = pct >= 1;
  const minsDone = Math.floor(total / 60);

  async function stop() {
    await pauseTimer();
    openSession({ kind: 'finish' });
  }

  return (
    <article className={`card habit-card ${mine ? 'running' : ''}`} style={{ ['--hc' as string]: habit.color }} aria-label={habit.name}>
      <div className="hc-top">
        <div className="hc-icon">
          <HabitIcon habit={habit} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 className="hc-name">{habit.name}</h3>
          <p className="hc-rule">
            {habit.daysPerWeek} {habit.daysPerWeek === 1 ? 'day' : 'days'}/wk · {habit.minutesPerDay} min/day
          </p>
        </div>
        <div className={`hc-streak ${streakWeeks > 0 ? 'hot' : ''}`} title="Consecutive completed weeks">
          <Flame size={15} /> {streakWeeks} wk
        </div>
      </div>

      <div className="hc-mid">
        <Ring size={104} stroke={10} pct={pct} color={habit.color} label={`${minsDone} of ${habit.minutesPerDay} minutes today`}>
          <div>
            {hit ? (
              <Check size={26} strokeWidth={3} color={habit.color} />
            ) : (
              <div className="hc-ring-num tnum">
                {minsDone}
                <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
                  /{habit.minutesPerDay}
                </span>
              </div>
            )}
            <div className="hc-ring-sub">{hit ? 'Goal hit' : 'min today'}</div>
          </div>
        </Ring>
        <div className="hc-week">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700 }} className="tnum">
              {week.counted}/{week.required} <span className="muted">days this week</span>
            </span>
          </div>
          <WeekDots week={week} />
        </div>
      </div>

      <div className="hc-status">
        {statusPill(week)}
        {week.status !== 'done' && week.status !== 'missed' && (
          <span className="muted tnum">
            {week.need} more {week.need === 1 ? 'day' : 'days'} · {week.available} left
          </span>
        )}
      </div>

      {mine ? (
        <div>
          <div className="timer-readout" style={{ fontSize: 34, textAlign: 'center', marginBottom: 12, color: mine.runningSince ? 'var(--text)' : 'var(--muted)' }} aria-live="off">
            {fmtClock(timerElapsedMs(mine, now))}
          </div>
          <div className="hc-actions">
            <button className="btn btn-main" onClick={mine.runningSince ? pauseTimer : resumeTimer}>
              {mine.runningSince ? (
                <>
                  <Pause size={16} /> Pause
                </>
              ) : (
                <>
                  <Play size={16} /> Resume
                </>
              )}
            </button>
            <button className="btn btn-main btn-habit" onClick={stop}>
              <Square size={15} fill="currentColor" /> Stop &amp; save
            </button>
          </div>
        </div>
      ) : (
        <div className="hc-actions">
          <button className="btn btn-main btn-habit" onClick={() => startTimer(habit.id)} disabled={Boolean(timer)} title={timer ? 'Finish the running timer first' : undefined}>
            <Play size={16} fill="currentColor" /> Start timer
          </button>
          <button className="btn" onClick={() => openSession({ kind: 'add', habitId: habit.id })} aria-label={`Log a session for ${habit.name}`}>
            <Plus size={16} /> Log
          </button>
        </div>
      )}
    </article>
  );
}
