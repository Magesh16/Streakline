import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import { buildIndex, type DayIndex } from './lib/stats';
import type { SessionMode } from './components/SessionModal';
import type { Expense, Habit, Loan, Insight, Session, SessionMeta, Settings, Timer, User } from './types';

interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

export interface NewSession {
  habitId: string;
  startedAt: string;
  durationSec: number;
  note?: string;
  meta?: SessionMeta;
}

export interface NewLoan {
  person: string;
  amountMinor: number;
  date: string;
  dueDate?: string | null;
  note?: string;
}

export interface NewExpense {
  amountMinor: number;
  category: string;
  date: string;
  note?: string;
}

export type QuickKind = 'expense' | 'loan' | 'activity';
export type MoneyTab = 'expenses' | 'lent';

interface Ctx {
  /** Which quick-add sheet is open (shared by the command palette and the phone "+" button). */
  quick: QuickKind | null;
  openQuick: (k: QuickKind) => void;
  closeQuick: () => void;
  focusOpen: boolean;
  setFocusOpen: (v: boolean) => void;
  moneyTab: MoneyTab;
  setMoneyTab: (t: MoneyTab) => void;
  user: User | null;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  loading: boolean;
  loadError: string | null;
  habits: Habit[];
  sessions: Session[];
  expenses: Expense[];
  loans: Loan[];
  timer: Timer | null;
  settings: Settings;
  insights: Record<string, Insight>;
  index: DayIndex;
  toasts: Toast[];
  sessionModal: SessionMode | null;
  openSession: (m: SessionMode) => void;
  closeSession: () => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  reload: () => Promise<void>;
  addHabit: (h: Partial<Habit>) => Promise<Habit | null>;
  updateHabit: (id: string, h: Partial<Habit>) => Promise<boolean>;
  deleteHabit: (id: string) => Promise<void>;
  addSession: (s: NewSession) => Promise<boolean>;
  updateSession: (id: string, s: Partial<Session>) => Promise<boolean>;
  deleteSession: (id: string) => Promise<void>;
  startTimer: (habitId: string) => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  discardTimer: () => Promise<void>;
  /** Stops the timer and saves the session. Returns false on failure (timer is kept). */
  finishTimer: (durationSec: number, note: string, meta?: SessionMeta) => Promise<boolean>;
  addLoan: (l: NewLoan) => Promise<boolean>;
  updateLoan: (id: string, l: Partial<NewLoan>) => Promise<boolean>;
  deleteLoan: (id: string) => Promise<void>;
  addRepayment: (id: string, r: { amountMinor: number; date: string; note?: string }) => Promise<boolean>;
  deleteRepayment: (id: string, rid: string) => Promise<void>;
  addExpense: (e: NewExpense) => Promise<boolean>;
  updateExpense: (id: string, e: Partial<NewExpense>) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<void>;
  saveSettings: (s: { geminiKey?: string; model?: string; currency?: string }) => Promise<boolean>;
  generateInsights: (weekStart: string, payload: unknown, force: boolean) => Promise<boolean>;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
};

export const timerElapsedMs = (t: Timer, now = Date.now()) => t.accumulatedMs + (t.runningSince ? Math.max(0, now - Date.parse(t.runningSince)) : 0);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [settings, setSettings] = useState<Settings>({ model: '', currency: 'INR', hasKey: false, keySource: null });
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sessionModal, setSessionModal] = useState<SessionMode | null>(null);
  const [quick, setQuick] = useState<QuickKind | null>(null);
  const [focusOpen, setFocusOpen] = useState(false);
  const [moneyTab, setMoneyTabState] = useState<MoneyTab>(() => {
    try {
      return localStorage.getItem('money-tab') === 'lent' ? 'lent' : 'expenses';
    } catch {
      return 'expenses';
    }
  });
  const setMoneyTab = useCallback((t: MoneyTab) => {
    setMoneyTabState(t);
    try {
      localStorage.setItem('money-tab', t);
    } catch {
      /* not persisted in private mode */
    }
  }, []);
  const toastId = useRef(0);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => (t.some((x) => x.text === text && x.kind === kind) ? t : [...t, { id, text, kind }]));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5200 : 2800);
  }, []);

  /** Wipe everything tied to the previous account so nothing leaks into the next sign-in. */
  const signedOut = useCallback(() => {
    setUser(null);
    setHabits([]);
    setSessions([]);
    setExpenses([]);
    setLoans([]);
    setTimer(null);
    setInsights({});
    setSettings({ model: '', currency: 'INR', hasKey: false, keySource: null });
    setSessionModal(null);
    setQuick(null);
    setFocusOpen(false);
  }, []);

  const reload = useCallback(async () => {
    try {
      if (!(await api.me()).user) {
        signedOut();
        setLoadError(null);
        return;
      }
      const s = await api.state();
      setUser(s.user);
      setHabits(s.habits);
      setSessions(s.sessions);
      setExpenses(s.expenses);
      setLoans(s.loans);
      setTimer(s.timer);
      setSettings(s.settings);
      setInsights(s.insights);
      setLoadError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        signedOut();
        setLoadError(null);
      } else setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [signedOut]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Re-sync when the tab becomes visible again (e.g. timer started on another device).
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  /** Wrap a mutation: run it, toast the error, return undefined on failure. */
  const attempt = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          signedOut();
          toast('Your session expired. Please sign in again.', 'error');
        } else toast((e as Error).message, 'error');
        return undefined;
      }
    },
    [toast, signedOut]
  );

  const value = useMemo<Ctx>(
    () => ({
      quick,
      openQuick: setQuick,
      closeQuick: () => setQuick(null),
      focusOpen,
      setFocusOpen,
      moneyTab,
      setMoneyTab,
      user,
      login: async (email, password) => {
        try {
          await api.login(email, password);
          await reload();
          return null;
        } catch (e) {
          return (e as Error).message;
        }
      },
      register: async (name, email, password) => {
        try {
          const r = await api.register(name, email, password);
          await reload();
          if (r.imported) toast(`Imported your existing data (${r.imported.habits} activities, ${r.imported.sessions} sessions)`);
          return null;
        } catch (e) {
          return (e as Error).message;
        }
      },
      logout: async () => {
        try {
          await api.logout();
        } catch {
          /* cookie is cleared server-side on a best-effort basis; sign out locally either way */
        }
        signedOut();
      },
      loading,
      loadError,
      habits,
      sessions,
      expenses,
      loans,
      timer,
      settings,
      insights,
      index: buildIndex(sessions),
      toasts,
      sessionModal,
      openSession: setSessionModal,
      closeSession: () => setSessionModal(null),
      toast,
      reload,
      addHabit: async (h) => {
        const created = await attempt(() => api.addHabit(h));
        if (created) setHabits((x) => [...x, created]);
        return created ?? null;
      },
      updateHabit: async (id, h) => {
        const updated = await attempt(() => api.updateHabit(id, h));
        if (updated) setHabits((x) => x.map((y) => (y.id === id ? updated : y)));
        return Boolean(updated);
      },
      deleteHabit: async (id) => {
        const ok = await attempt(async () => (await api.deleteHabit(id), true));
        if (ok) {
          setHabits((x) => x.filter((y) => y.id !== id));
          setSessions((x) => x.filter((y) => y.habitId !== id));
          setTimer((t) => (t?.habitId === id ? null : t));
        }
      },
      addSession: async (s) => {
        const created = await attempt(() => api.addSession(s));
        if (created) setSessions((x) => [...x, created]);
        return Boolean(created);
      },
      updateSession: async (id, s) => {
        const updated = await attempt(() => api.updateSession(id, s));
        if (updated) setSessions((x) => x.map((y) => (y.id === id ? updated : y)));
        return Boolean(updated);
      },
      deleteSession: async (id) => {
        const ok = await attempt(async () => (await api.deleteSession(id), true));
        if (ok) setSessions((x) => x.filter((y) => y.id !== id));
      },
      startTimer: async (habitId) => {
        if (timer) return toast('Finish the running timer first', 'error');
        const now = new Date().toISOString();
        const t = await attempt(() => api.setTimer({ habitId, startedAt: now, accumulatedMs: 0, runningSince: now }));
        if (t) setTimer(t);
      },
      pauseTimer: async () => {
        if (!timer || !timer.runningSince) return;
        const next: Timer = { ...timer, accumulatedMs: timerElapsedMs(timer), runningSince: null };
        const t = await attempt(() => api.setTimer(next));
        if (t) setTimer(t);
      },
      resumeTimer: async () => {
        if (!timer || timer.runningSince) return;
        const next: Timer = { ...timer, runningSince: new Date().toISOString() };
        const t = await attempt(() => api.setTimer(next));
        if (t) setTimer(t);
      },
      discardTimer: async () => {
        const ok = await attempt(async () => (await api.clearTimer(), true));
        if (ok) setTimer(null);
      },
      finishTimer: async (durationSec, note, meta) => {
        if (!timer) return false;
        const created = await attempt(() => api.addSession({ habitId: timer.habitId, startedAt: timer.startedAt, durationSec, note, meta }));
        if (!created) return false;
        setSessions((x) => [...x, created]);
        await attempt(() => api.clearTimer());
        setTimer(null);
        return true;
      },
      addLoan: async (l) => {
        const created = await attempt(() => api.addLoan(l));
        if (created) setLoans((x) => [created, ...x].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
        return Boolean(created);
      },
      updateLoan: async (id, l) => {
        const updated = await attempt(() => api.updateLoan(id, l));
        if (updated) setLoans((x) => x.map((y) => (y.id === id ? updated : y)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
        return Boolean(updated);
      },
      deleteLoan: async (id) => {
        const ok = await attempt(async () => (await api.deleteLoan(id), true));
        if (ok) setLoans((x) => x.filter((y) => y.id !== id));
      },
      addRepayment: async (id, r) => {
        const updated = await attempt(() => api.addRepayment(id, r));
        if (updated) setLoans((x) => x.map((y) => (y.id === id ? updated : y)));
        return Boolean(updated);
      },
      deleteRepayment: async (id, rid) => {
        const updated = await attempt(() => api.deleteRepayment(id, rid));
        if (updated) setLoans((x) => x.map((y) => (y.id === id ? updated : y)));
      },
      addExpense: async (e) => {
        const created = await attempt(() => api.addExpense(e));
        if (created) setExpenses((x) => [created, ...x].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
        return Boolean(created);
      },
      updateExpense: async (id, e) => {
        const updated = await attempt(() => api.updateExpense(id, e));
        if (updated) setExpenses((x) => x.map((y) => (y.id === id ? updated : y)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
        return Boolean(updated);
      },
      deleteExpense: async (id) => {
        const ok = await attempt(async () => (await api.deleteExpense(id), true));
        if (ok) setExpenses((x) => x.filter((y) => y.id !== id));
      },
      saveSettings: async (s) => {
        const next = await attempt(() => api.saveSettings(s));
        if (next) setSettings(next);
        return Boolean(next);
      },
      generateInsights: async (weekStart, payload, force) => {
        const entry = await attempt(() => api.insights(weekStart, payload, force));
        if (entry) setInsights((x) => ({ ...x, [weekStart]: entry }));
        return Boolean(entry);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quick, focusOpen, moneyTab, setMoneyTab, user, loading, loadError, habits, sessions, expenses, loans, timer, settings, insights, toasts, sessionModal, toast, reload, attempt, signedOut]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
