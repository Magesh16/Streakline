export type HabitType = 'gym' | 'skill' | 'dsa' | 'custom';

export interface Habit {
  id: string;
  name: string;
  type: HabitType;
  icon?: string;
  color: string;
  daysPerWeek: number;
  minutesPerDay: number;
  createdAt: string;
}

export interface SessionMeta {
  split?: string;
  problem?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string;
  solved?: boolean;
}

export interface Session {
  id: string;
  habitId: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  note?: string;
  meta?: SessionMeta;
}

export interface Timer {
  habitId: string;
  startedAt: string;
  accumulatedMs: number;
  runningSince: string | null;
}

export interface InsightData {
  headline: string;
  score: number;
  summary: string;
  perHabit: { habit: string; status: 'great' | 'ok' | 'poor'; verdict: string; note: string }[];
  patterns: string[];
  weakSpots: string[];
  nextWeekPlan: string[];
}

export interface Insight {
  generatedAt: string;
  model: string;
  data: InsightData;
}

export interface Expense {
  id: string;
  amountMinor: number;
  category: string;
  note?: string;
  date: string; // YYYY-MM-DD, the day you spent it
  createdAt: string;
}

export interface Repayment {
  id: string;
  amountMinor: number;
  date: string;
  note?: string;
}

export interface Loan {
  id: string;
  person: string;
  amountMinor: number;
  date: string; // YYYY-MM-DD lent
  dueDate?: string;
  note?: string;
  repayments: Repayment[];
  createdAt: string;
}

export interface Settings {
  model: string;
  currency: string;
  hasKey: boolean;
  keySource: 'saved' | 'env' | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AppState {
  user: User;
  habits: Habit[];
  sessions: Session[];
  expenses: Expense[];
  loans: Loan[];
  timer: Timer | null;
  settings: Settings;
  insights: Record<string, Insight>;
}
