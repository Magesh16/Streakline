import type { AppState, Expense, Habit, Loan, Insight, Session, Settings, Timer, User } from './types';

type LoanBody = Partial<Pick<Loan, 'person' | 'amountMinor' | 'date' | 'note'>> & { dueDate?: string | null };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      // the server rejects writes without this header (CSRF guard)
      headers: { 'X-Requested-With': 'streakline', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Is it running?');
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.error || `Request failed (${res.status})`, res.status);
  return json as T;
}

export const api = {
  me: () => req<{ user: User | null }>('GET', '/api/auth/me'),
  login: (email: string, password: string) => req<{ user: User }>('POST', '/api/auth/login', { email, password }),
  register: (name: string, email: string, password: string) => req<{ user: User; imported: { habits: number; sessions: number } | null }>('POST', '/api/auth/register', { name, email, password }),
  logout: () => req<void>('POST', '/api/auth/logout'),
  state: () => req<AppState>('GET', '/api/state'),
  addHabit: (h: Partial<Habit>) => req<Habit>('POST', '/api/habits', h),
  updateHabit: (id: string, h: Partial<Habit>) => req<Habit>('PATCH', `/api/habits/${id}`, h),
  deleteHabit: (id: string) => req<void>('DELETE', `/api/habits/${id}`),
  addSession: (s: Partial<Session>) => req<Session>('POST', '/api/sessions', s),
  updateSession: (id: string, s: Partial<Session>) => req<Session>('PATCH', `/api/sessions/${id}`, s),
  deleteSession: (id: string) => req<void>('DELETE', `/api/sessions/${id}`),
  addExpense: (e: Partial<Expense>) => req<Expense>('POST', '/api/expenses', e),
  updateExpense: (id: string, e: Partial<Expense>) => req<Expense>('PATCH', `/api/expenses/${id}`, e),
  deleteExpense: (id: string) => req<void>('DELETE', `/api/expenses/${id}`),
  addLoan: (l: LoanBody) => req<Loan>('POST', '/api/loans', l),
  updateLoan: (id: string, l: LoanBody) => req<Loan>('PATCH', `/api/loans/${id}`, l),
  deleteLoan: (id: string) => req<void>('DELETE', `/api/loans/${id}`),
  addRepayment: (id: string, r: { amountMinor: number; date: string; note?: string }) => req<Loan>('POST', `/api/loans/${id}/repayments`, r),
  deleteRepayment: (id: string, rid: string) => req<Loan>('DELETE', `/api/loans/${id}/repayments/${rid}`),
  setTimer: (t: Timer) => req<Timer>('PUT', '/api/timer', t),
  clearTimer: () => req<void>('DELETE', '/api/timer'),
  saveSettings: (s: { geminiKey?: string; model?: string; currency?: string }) => req<Settings>('PUT', '/api/settings', s),
  revealKey: () => req<{ key: string }>('POST', '/api/settings/reveal-key'),
  testGemini: () => req<{ ok: boolean; model: string; reply: string }>('POST', '/api/settings/test'),
  insights: (weekStart: string, payload: unknown, force: boolean) => req<Insight>('POST', '/api/insights', { weekStart, payload, force }),
};
