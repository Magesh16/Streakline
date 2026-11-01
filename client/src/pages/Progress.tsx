import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Heatmap, WeekBars } from '../components/Charts';
import { useNow } from '../lib/hooks';
import { bestStreak, completionRate, fmtDuration, heatmap, streak, weeklyHistory } from '../lib/stats';
import { useApp } from '../store';
import type { Session } from '../types';

export function Progress() {
  const { habits, sessions, index, openSession, deleteSession, toast } = useApp();
  const [sel, setSel] = useState<string>('all');
  const nowMs = useNow(60_000);
  const now = new Date(nowMs);

  const habit = habits.find((h) => h.id === sel) ?? null;
  const scope = habit ? [habit] : habits;
  const cols = useMemo(() => heatmap(scope, index, now, 26), [scope, index, nowMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const color = habit?.color ?? 'var(--signal)';

  const list = useMemo(
    () =>
      sessions
        .filter((s) => !habit || s.habitId === habit.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 25),
    [sessions, habit]
  );

  const thirtyAgo = nowMs - 30 * 86400000;
  const recentSec = sessions.filter((s) => (!habit || s.habitId === habit.id) && Date.parse(s.startedAt) >= thirtyAgo).reduce((a, s) => a + s.durationSec, 0);

  async function remove(s: Session) {
    if (!window.confirm('Delete this session?')) return;
    await deleteSession(s.id);
    toast('Session deleted');
  }

  const rate = habit ? completionRate(habit, index, now, 8) : null;

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Progress</h1>
          <p className="page-sub">Your consistency over time</p>
        </div>
      </header>

      <div className="tabs" role="group" aria-label="Habit filter">
        <button className="tab" aria-pressed={sel === 'all'} onClick={() => setSel('all')}>
          All habits
        </button>
        {habits.map((h) => (
          <button key={h.id} className="tab" aria-pressed={sel === h.id} onClick={() => setSel(h.id)}>
            <span className="tab-dot" style={{ background: h.color }} />
            {h.name}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        {habit ? (
          <>
            <div className="card stat-tile">
              <div className="stat-n tnum">{streak(habit, index, now)} wk</div>
              <div className="stat-l">current streak</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-n tnum">{bestStreak(habit, index, now)} wk</div>
              <div className="stat-l">best streak</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-n tnum">{rate === null ? '–' : `${Math.round(rate * 100)}%`}</div>
              <div className="stat-l">weeks completed (last 8)</div>
            </div>
          </>
        ) : (
          <>
            <div className="card stat-tile">
              <div className="stat-n tnum">{habits.filter((h) => streak(h, index, now) > 0).length}/{habits.length}</div>
              <div className="stat-l">habits with a live streak</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-n tnum">{Math.max(0, ...habits.map((h) => streak(h, index, now)))} wk</div>
              <div className="stat-l">longest live streak</div>
            </div>
            <div className="card stat-tile">
              <div className="stat-n tnum">{sessions.length}</div>
              <div className="stat-l">sessions logged</div>
            </div>
          </>
        )}
        <div className="card stat-tile">
          <div className="stat-n tnum">{fmtDuration(recentSec)}</div>
          <div className="stat-l">last 30 days</div>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Last 26 weeks{habit ? ` · ${habit.name}` : ' · all habits (average of daily goals)'}</div>
        <Heatmap cols={cols} color={color} />
      </section>

      {habit ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Days completed per week · target {habit.daysPerWeek}</div>
          <WeekBars points={weeklyHistory(habit, index, now, 8)} target={habit.daysPerWeek} color={habit.color} wide />
        </section>
      ) : (
        <div className="grid-2" style={{ marginBottom: 16 }}>
          {habits.map((h) => (
            <section className="card" key={h.id}>
              <div className="card-title" style={{ color: h.color }}>
                {h.name} · target {h.daysPerWeek}/wk
              </div>
              <WeekBars points={weeklyHistory(h, index, now, 8)} target={h.daysPerWeek} color={h.color} />
            </section>
          ))}
        </div>
      )}

      <section className="card">
        <div className="card-title">Recent sessions</div>
        {list.length === 0 ? (
          <p className="empty">No sessions yet. Start a timer from Today.</p>
        ) : (
          <div className="session-list">
            {list.map((s) => {
              const h = habits.find((x) => x.id === s.habitId);
              const d = new Date(s.startedAt);
              const bits = [s.meta?.split, s.meta?.problem, s.meta?.difficulty, s.meta?.topic, s.meta?.solved === true ? 'solved' : s.meta?.solved === false ? 'unsolved' : undefined].filter(Boolean);
              return (
                <div className="session" key={s.id}>
                  <span className="session-dot" style={{ background: h?.color }} />
                  <div className="session-main">
                    <div className="session-title">
                      {h?.name ?? 'Deleted habit'} · <span className="tnum">{fmtDuration(s.durationSec)}</span>
                      {bits.length > 0 && <span className="muted" style={{ fontWeight: 500 }}> · {bits.join(' · ')}</span>}
                    </div>
                    <div className="session-sub">
                      {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      {s.note ? ` · ${s.note}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => openSession({ kind: 'edit', session: s })} aria-label="Edit session">
                    <Pencil size={16} />
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={() => remove(s)} aria-label="Delete session">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
