import { useState } from 'react';
import { CalendarPlus, Flame, Plus, Sparkles } from 'lucide-react';
import { HabitModal } from '../components/HabitModal';
import { HabitCard } from '../components/HabitCard';
import { StreakArt } from '../components/Art';
import { ConcentricRings } from '../components/Rings';
import { HabitIcon } from '../components/ui';
import { TEMPLATES, type Template } from '../lib/habitTypes';
import { useNow } from '../lib/hooks';
import { dayKey, fmtDuration, fmtWeekRange, secondsOn, streak, weekInfo, weekStart, weeklyScore } from '../lib/stats';
import { useApp } from '../store';
import type { Tab } from '../App';

const joinNames = (n: string[]) => (n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`);

function greeting(h: number) {
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Late session';
}

export function Today({ go }: { go: (t: Tab) => void }) {
  const { habits, index, openSession, user } = useApp();
  const [creating, setCreating] = useState<{ template?: Template } | null>(null);
  const nowMs = useNow(60_000); // also rolls the day over at midnight
  const now = new Date(nowMs);
  const ws = weekStart(now);

  const weeks = habits.map((h) => ({ habit: h, week: weekInfo(h, index, ws, now) }));
  const score = weeklyScore(habits, index, ws, now);
  const done = weeks.filter((w) => w.week.status === 'done').length;
  const risk = weeks.filter((w) => w.week.status === 'at-risk');
  const missed = weeks.filter((w) => w.week.status === 'missed');
  const daysLeft = 7 - ((now.getDay() + 6) % 7);
  const totalSec = weeks.reduce((a, w) => a + w.week.totalSeconds, 0);

  let note = 'Start a timer to log your first session.';
  if (habits.length && done === habits.length) note = 'Every habit is complete for the week. Anything extra is a bonus.';
  else if (risk.length) note = `${joinNames(risk.map((r) => r.habit.name))} ${risk.length === 1 ? 'needs' : 'need'} every remaining day to keep the streak.`;
  else if (missed.length && missed.length === weeks.length - done) note = 'This week’s targets are out of reach. Next week is a clean slate.';
  else if (totalSec > 0) note = 'You are on track. Keep the daily minimum and the weekly count takes care of itself.';

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">
            {greeting(now.getHours())}
            {user ? <span className="title-name">, {user.name.trim().split(' ')[0]}</span> : null}
          </h1>
          <p className="page-sub">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        {habits.length > 0 && (
          <div className="row" style={{ flex: 'none' }}>
            <button className="btn" onClick={() => openSession({ kind: 'add' })}>
              <CalendarPlus size={16} /> Log a session
            </button>
            <button className="btn btn-primary" onClick={() => setCreating({})}>
              <Plus size={16} /> Add activity
            </button>
          </div>
        )}
      </header>

      {habits.length === 0 ? (
        <section className="card stack" aria-label="Get started" style={{ gap: 20 }}>
          <StreakArt className="onboard-art" />
          <div>
            <h2 className="display-h2">What do you want to be consistent at?</h2>
            <p className="muted" style={{ marginTop: 4 }}>
              Pick a starting point or create your own. You choose how many days a week and how many minutes a day, and that sets your streak.
            </p>
          </div>
          <div className="template-grid">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.name} className="template" style={{ ['--hc' as string]: tpl.color }} onClick={() => setCreating({ template: tpl })}>
                <span className="hc-icon">
                  <HabitIcon habit={tpl} />
                </span>
                <span style={{ textAlign: 'left' }}>
                  <b>{tpl.name}</b>
                  <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                    {tpl.daysPerWeek}d/wk · {tpl.minutesPerDay}m
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div>
            <button className="btn btn-primary" onClick={() => setCreating({})}>
              <Plus size={16} /> Create your own activity
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="card hero" aria-label="Weekly summary">
            <ConcentricRings
              size={148}
              label={`Weekly score ${Math.round(score * 100)} percent. ${weeks.map((w) => `${w.habit.name} ${w.week.counted} of ${w.week.required} days`).join(', ')}`}
              items={weeks.map((w) => ({ pct: w.week.required ? w.week.counted / w.week.required : 0, color: w.habit.color, name: w.habit.name, detail: `${w.week.counted} of ${w.week.required} days` }))}
            >
              <div className="rings-score tnum">
                {Math.round(score * 100)}
                <small>%</small>
              </div>
            </ConcentricRings>
            <div className="hero-text">
              <div className="card-title" style={{ marginBottom: 4 }}>
                This week · {fmtWeekRange(ws)}
              </div>
              <p className="dim" style={{ maxWidth: 520 }}>
                {note}
              </p>
              <ul className="legend-list" aria-label="This week by activity">
                {weeks.map((w) => (
                  <li key={w.habit.id}>
                    <i style={{ background: w.habit.color }} />
                    {w.habit.name}
                    <b className="tnum">
                      {w.week.counted}/{w.week.required}
                    </b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hero-stats">
              <div>
                <div className="stat-n tnum">
                  {done}/{habits.length}
                </div>
                <div className="stat-l">habits complete</div>
              </div>
              <div>
                <div className="stat-n tnum">{daysLeft}</div>
                <div className="stat-l">{daysLeft === 1 ? 'day left' : 'days left'}</div>
              </div>
              <div>
                <div className="stat-n tnum">{fmtDuration(totalSec)}</div>
                <div className="stat-l">logged this week</div>
              </div>
            </div>
          </section>

          <section className="grid-2" aria-label="Habits">
            {weeks.map(({ habit, week }) => (
              <HabitCard key={habit.id} habit={habit} week={week} streakWeeks={streak(habit, index, now)} todaySeconds={secondsOn(index, habit.id, dayKey(now))} />
            ))}
          </section>

          <p className="muted" style={{ marginTop: 20, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <Flame size={14} /> A day counts when you hit its minutes. A week counts when you hit its days. Streak = completed weeks in a row.
            <button className="btn btn-ghost btn-sm" onClick={() => go('insights')} style={{ marginLeft: 'auto' }}>
              <Sparkles size={14} /> Weekly insights
            </button>
          </p>
        </>
      )}
      {creating && <HabitModal template={creating.template} onClose={() => setCreating(null)} />}
    </>
  );
}
