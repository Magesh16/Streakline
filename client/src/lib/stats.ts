import type { Habit, Session } from '../types';

/* ---------- dates (all local time, weeks start Monday) ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
export const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* ---------- formatting ---------- */

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 1) return sec > 0 ? '<1m' : '0m';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${pad(m % 60)}m` : `${m}m`;
}

export function fmtWeekRange(ws: Date): string {
  const we = addDays(ws, 6);
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${ws.toLocaleDateString(undefined, o)} – ${we.toLocaleDateString(undefined, o)}`;
}

/* ---------- indexing ---------- */

/** habitId -> dayKey -> seconds logged that day (a session belongs to the day it started). */
export type DayIndex = Map<string, Map<string, number>>;

export function buildIndex(sessions: Session[]): DayIndex {
  const idx: DayIndex = new Map();
  for (const s of sessions) {
    const key = dayKey(new Date(s.startedAt));
    let days = idx.get(s.habitId);
    if (!days) idx.set(s.habitId, (days = new Map()));
    days.set(key, (days.get(key) ?? 0) + s.durationSec);
  }
  return idx;
}

export const secondsOn = (idx: DayIndex, habitId: string, key: string) => idx.get(habitId)?.get(key) ?? 0;

/** First day the habit can be judged on: its creation day, or the earliest logged session if older. */
export function habitStart(habit: Habit, idx: DayIndex): Date {
  let start = startOfDay(new Date(habit.createdAt));
  const days = idx.get(habit.id);
  if (days) {
    for (const k of days.keys()) {
      const d = parseKey(k);
      if (d < start) start = d;
    }
  }
  return start;
}

/* ---------- week evaluation ---------- */

export type WeekStatus = 'done' | 'on-track' | 'at-risk' | 'missed';

export interface DayInfo {
  key: string;
  date: Date;
  seconds: number;
  counted: boolean;
  pct: number; // 0..1 of the daily target
  isToday: boolean;
  isFuture: boolean;
  beforeStart: boolean;
}

export interface WeekInfo {
  weekStart: Date;
  days: DayInfo[];
  counted: number;
  required: number; // daysPerWeek, trimmed if the habit was created mid-week
  complete: boolean;
  need: number; // counted days still missing
  available: number; // days left that could still count (today + future, not yet counted)
  status: WeekStatus;
  totalSeconds: number;
}

export function weekInfo(habit: Habit, idx: DayIndex, ws: Date, now: Date): WeekInfo {
  const today = startOfDay(now);
  const start = habitStart(habit, idx);
  const target = habit.minutesPerDay * 60;
  const days: DayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(ws, i);
    const key = dayKey(date);
    const seconds = secondsOn(idx, habit.id, key);
    days.push({
      key,
      date,
      seconds,
      counted: seconds >= target,
      pct: Math.min(1, seconds / target),
      isToday: date.getTime() === today.getTime(),
      isFuture: date > today,
      beforeStart: date < start,
    });
  }
  const live = days.filter((d) => !d.beforeStart);
  const required = Math.min(habit.daysPerWeek, live.length);
  const counted = days.filter((d) => d.counted).length;
  const complete = required > 0 && counted >= required;
  const available = live.filter((d) => (d.isToday || d.isFuture) && !d.counted).length;
  const need = Math.max(0, required - counted);
  const isPast = addDays(ws, 6) < today;
  let status: WeekStatus;
  if (complete) status = 'done';
  else if (isPast || need > available) status = 'missed';
  else if (need === available) status = 'at-risk';
  else status = 'on-track';
  return {
    weekStart: ws,
    days,
    counted,
    required,
    complete,
    need,
    available,
    status,
    totalSeconds: days.reduce((a, d) => a + d.seconds, 0),
  };
}

/**
 * Streak = consecutive completed weeks. The current week counts once it is complete;
 * while it is still in progress it never breaks the streak.
 */
export function streak(habit: Habit, idx: DayIndex, now: Date): number {
  const first = weekStart(habitStart(habit, idx));
  const cur = weekStart(now);
  let n = weekInfo(habit, idx, cur, now).complete ? 1 : 0;
  for (let w = addDays(cur, -7); w >= first && n < 1040; w = addDays(w, -7)) {
    if (!weekInfo(habit, idx, w, now).complete) break;
    n++;
  }
  return n;
}

export function bestStreak(habit: Habit, idx: DayIndex, now: Date): number {
  const first = weekStart(habitStart(habit, idx));
  const cur = weekStart(now);
  let best = 0;
  let run = 0;
  for (let w = first; w <= cur; w = addDays(w, 7)) {
    if (weekInfo(habit, idx, w, now).complete) best = Math.max(best, ++run);
    else if (w < cur) run = 0; // the in-progress week doesn't reset a run
  }
  return best;
}

/** Share of the last `n` finished weeks that were completed (null if the habit has no finished week yet). */
export function completionRate(habit: Habit, idx: DayIndex, now: Date, n = 8): number | null {
  const first = weekStart(habitStart(habit, idx));
  const cur = weekStart(now);
  let total = 0;
  let done = 0;
  for (let i = 1; i <= n; i++) {
    const w = addDays(cur, -7 * i);
    if (w < first) break;
    total++;
    if (weekInfo(habit, idx, w, now).complete) done++;
  }
  return total ? done / total : null;
}

export function weeklyScore(habits: Habit[], idx: DayIndex, ws: Date, now: Date): number {
  const scores = habits
    .map((h) => weekInfo(h, idx, ws, now))
    .filter((w) => w.required > 0)
    .map((w) => Math.min(1, w.counted / w.required));
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

export interface WeekPoint {
  weekStart: Date;
  counted: number;
  required: number;
  complete: boolean;
  minutes: number;
}

/** Oldest-first list of the last `n` weeks including the current one. */
export function weeklyHistory(habit: Habit, idx: DayIndex, now: Date, n = 8): WeekPoint[] {
  const cur = weekStart(now);
  const out: WeekPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const w = weekInfo(habit, idx, addDays(cur, -7 * i), now);
    out.push({ weekStart: w.weekStart, counted: w.counted, required: Math.min(habit.daysPerWeek, 7), complete: w.complete, minutes: Math.round(w.totalSeconds / 60) });
  }
  return out;
}

/* ---------- heatmap ---------- */

export interface HeatCell {
  key: string;
  date: Date;
  pct: number;
  seconds: number;
  future: boolean;
  active: boolean; // false before the habit(s) existed
}

/** Columns = weeks (oldest first), rows = Mon..Sun. */
export function heatmap(habits: Habit[], idx: DayIndex, now: Date, weeks = 18): HeatCell[][] {
  const today = startOfDay(now);
  const cur = weekStart(now);
  const starts = habits.map((h) => habitStart(h, idx));
  const cols: HeatCell[][] = [];
  for (let c = weeks - 1; c >= 0; c--) {
    const ws = addDays(cur, -7 * c);
    const col: HeatCell[] = [];
    for (let r = 0; r < 7; r++) {
      const date = addDays(ws, r);
      const key = dayKey(date);
      const live = habits.filter((_, i) => date >= starts[i]);
      const pcts = live.map((h) => Math.min(1, secondsOn(idx, h.id, key) / (h.minutesPerDay * 60)));
      const seconds = live.reduce((a, h) => a + secondsOn(idx, h.id, key), 0);
      col.push({
        key,
        date,
        pct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0,
        seconds,
        future: date > today,
        active: live.length > 0,
      });
    }
    cols.push(col);
  }
  return cols;
}

/* ---------- insights payload ---------- */

const bucketOf = (hour: number) => (hour >= 5 && hour < 12 ? 'morning' : hour < 17 && hour >= 12 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night');

export function buildInsightPayload(habits: Habit[], sessions: Session[], idx: DayIndex, ws: Date, now: Date) {
  const we = addDays(ws, 6);
  const inWeek = (s: Session) => {
    const d = startOfDay(new Date(s.startedAt));
    return d >= ws && d <= we;
  };
  return {
    week: { start: dayKey(ws), end: dayKey(we), today: dayKey(now), isCurrentWeek: weekStart(now).getTime() === ws.getTime() },
    overallScorePct: Math.round(weeklyScore(habits, idx, ws, now) * 100),
    habits: habits.map((h) => {
      const info = weekInfo(h, idx, ws, now);
      const mine = sessions.filter((s) => s.habitId === h.id && inWeek(s)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      const timeOfDayMinutes: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      for (const s of mine) timeOfDayMinutes[bucketOf(new Date(s.startedAt).getHours())] += Math.round(s.durationSec / 60);
      const dsa = h.type === 'dsa' ? mine.filter((s) => s.meta?.problem || s.meta?.topic) : [];
      return {
        name: h.name,
        type: h.type,
        rules: { daysPerWeek: h.daysPerWeek, minutesPerDay: h.minutesPerDay },
        daysCounted: info.counted,
        daysRequired: info.required,
        weekComplete: info.complete,
        totalMinutes: Math.round(info.totalSeconds / 60),
        streakWeeks: streak(h, idx, now),
        bestStreakWeeks: bestStreak(h, idx, now),
        minutesByWeekday: Object.fromEntries(info.days.map((d, i) => [WEEKDAYS[i], Math.round(d.seconds / 60)])),
        timeOfDayMinutes,
        sessions: mine.map((s) => {
          const d = new Date(s.startedAt);
          return { day: WEEKDAYS[(d.getDay() + 6) % 7], start: `${pad(d.getHours())}:${pad(d.getMinutes())}`, minutes: Math.round(s.durationSec / 60), note: s.note || undefined, ...s.meta };
        }),
        dsaSummary: dsa.length
          ? {
              problemsLogged: dsa.length,
              solved: dsa.filter((s) => s.meta?.solved).length,
              byDifficulty: countBy(dsa, (s) => s.meta?.difficulty),
              byTopic: countBy(dsa, (s) => s.meta?.topic),
              unsolvedByTopic: countBy(dsa.filter((s) => s.meta?.solved === false), (s) => s.meta?.topic),
            }
          : undefined,
        gymSplits: h.type === 'gym' ? countBy(mine, (s) => s.meta?.split) : undefined,
        previousWeeks: weeklyHistory(h, idx, addDays(ws, -7), 4).map((p) => ({ weekStart: dayKey(p.weekStart), daysCounted: p.counted, complete: p.complete, minutes: p.minutes })),
      };
    }),
  };
}

function countBy<T>(items: T[], pick: (t: T) => string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = pick(it);
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
