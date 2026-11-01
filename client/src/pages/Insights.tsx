import { useState } from 'react';
import { AlertTriangle, ArrowRight, Key, RefreshCw, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Ring } from '../components/ui';
import { useNow } from '../lib/hooks';
import { WEEKDAYS, addDays, buildInsightPayload, dayKey, fmtWeekRange, weekInfo, weekStart } from '../lib/stats';
import { useApp } from '../store';
import type { Tab } from '../App';

const STATUS_PILL = { great: 'pill pill-success', ok: 'pill pill-warn', poor: 'pill pill-danger' } as const;

export function Insights({ go }: { go: (t: Tab) => void }) {
  const { habits, sessions, index, settings, insights, generateInsights } = useApp();
  const nowMs = useNow(60_000);
  const now = new Date(nowMs);
  const [offset, setOffset] = useState(0); // 0 = this week, 1 = last week
  const [busy, setBusy] = useState(false);

  const ws = addDays(weekStart(now), -7 * offset);
  const key = dayKey(ws);
  const saved = insights[key];
  const weeks = habits.map((h) => ({ habit: h, week: weekInfo(h, index, ws, now) }));
  const hasData = weeks.some((w) => w.week.totalSeconds > 0);

  async function run(force: boolean) {
    setBusy(true);
    await generateInsights(key, buildInsightPayload(habits, sessions, index, ws, now), force);
    setBusy(false);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Weekly insights</h1>
          <p className="page-sub">{fmtWeekRange(ws)} · written by {settings.model || 'Gemini'} from your logged data</p>
        </div>
        <div className="tabs" style={{ margin: 0 }} role="group" aria-label="Week">
          <button className="tab" aria-pressed={offset === 0} onClick={() => setOffset(0)}>
            This week
          </button>
          <button className="tab" aria-pressed={offset === 1} onClick={() => setOffset(1)}>
            Last week
          </button>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Minutes by weekday</div>
        <div className="grid-2">
          {weeks.map(({ habit, week }) => {
            const max = Math.max(habit.minutesPerDay, ...week.days.map((d) => d.seconds / 60));
            return (
              <div key={habit.id} style={{ ['--hc' as string]: habit.color }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <b>{habit.name}</b>
                  <span className="muted tnum">
                    {week.counted}/{week.required} days
                  </span>
                </div>
                <div className="mini-bars">
                  {week.days.map((d, i) => (
                    <div className="mini-bar" key={d.key} title={`${WEEKDAYS[i]} · ${Math.round(d.seconds / 60)} min`}>
                      <i style={{ height: `${Math.max(4, (d.seconds / 60 / max) * 100)}%`, opacity: d.counted ? 1 : 0.4 }} />
                      {WEEKDAYS[i][0]}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {!settings.hasKey ? (
        <div className="card empty">
          <Key size={30} style={{ marginBottom: 8 }} />
          <p style={{ marginBottom: 14 }}>Add your Gemini API key to get a written review of your week: patterns, weak spots and a plan for next week.</p>
          <button className="btn btn-primary" onClick={() => go('setup')}>
            Open Setup
          </button>
        </div>
      ) : busy ? (
        <div className="stack" aria-busy="true" aria-live="polite">
          <div className="skeleton" style={{ height: 130 }} />
          <div className="skeleton" style={{ height: 180 }} />
          <p className="muted" style={{ textAlign: 'center' }}>
            Reading your week…
          </p>
        </div>
      ) : !saved ? (
        <div className="card empty">
          <Sparkles size={30} style={{ marginBottom: 8 }} />
          <p style={{ marginBottom: 14 }}>{hasData ? 'Generate a written review of this week. It is saved, so it only costs one request.' : 'Nothing logged this week yet. You can still generate a review, but it will be short.'}</p>
          <button className="btn btn-primary" onClick={() => run(false)}>
            <Sparkles size={16} /> Generate insights
          </button>
        </div>
      ) : (
        <div className="stack">
          <section className="card insight-hero">
            <Ring size={110} stroke={10} pct={saved.data.score / 100} color="var(--success)" label={`Consistency score ${saved.data.score}`}>
              <div className="stat-n tnum" style={{ fontSize: 30 }}>
                {saved.data.score}
              </div>
            </Ring>
            <div style={{ minWidth: 0 }}>
              <div className="card-title" style={{ marginBottom: 6 }}>
                Verdict
              </div>
              <h2 style={{ fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.3, marginBottom: 8 }}>{saved.data.headline}</h2>
              <p className="dim">{saved.data.summary}</p>
            </div>
          </section>

          {saved.data.perHabit.length > 0 && (
            <div className="grid-2">
              {saved.data.perHabit.map((h) => (
                <section className="card verdict" key={h.habit}>
                  <div className="verdict-head">
                    <b style={{ fontSize: 16 }}>{h.habit}</b>
                    <span className={STATUS_PILL[h.status]} style={{ marginLeft: 'auto' }}>
                      {h.status === 'great' ? 'Great' : h.status === 'ok' ? 'Okay' : 'Needs work'}
                    </span>
                  </div>
                  <p style={{ fontWeight: 600 }}>{h.verdict}</p>
                  <p className="dim">{h.note}</p>
                </section>
              ))}
            </div>
          )}

          <div className="grid-2">
            {saved.data.patterns.length > 0 && (
              <section className="card">
                <div className="card-title">Patterns</div>
                <ul className="insight-list">
                  {saved.data.patterns.map((t, i) => (
                    <li key={i}>
                      <TrendingUp size={16} />
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {saved.data.weakSpots.length > 0 && (
              <section className="card">
                <div className="card-title">Weak spots</div>
                <ul className="insight-list">
                  {saved.data.weakSpots.map((t, i) => (
                    <li key={i}>
                      <AlertTriangle size={16} style={{ color: 'var(--warn)' }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {saved.data.nextWeekPlan.length > 0 && (
            <section className="card">
              <div className="card-title">
                <Target size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                Plan for next week
              </div>
              <ul className="insight-list">
                {saved.data.nextWeekPlan.map((t, i) => (
                  <li key={i}>
                    <ArrowRight size={16} style={{ color: 'var(--success)' }} />
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
            Generated {new Date(saved.generatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} with {saved.model}
            <button className="btn btn-sm" onClick={() => run(true)}>
              <RefreshCw size={14} /> Regenerate
            </button>
          </div>
        </div>
      )}
    </>
  );
}
