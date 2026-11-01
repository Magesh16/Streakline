import { dayKey, parseKey, startOfDay } from './stats';
import type { Loan } from '../types';

export const paidOf = (l: Loan) => l.repayments.reduce((a, r) => a + r.amountMinor, 0);
export const remainingOf = (l: Loan) => l.amountMinor - paidOf(l);
export const isSettled = (l: Loan) => remainingOf(l) <= 0;

export type DueKind = 'overdue' | 'soon' | 'later' | 'none';
export interface DueInfo {
  kind: DueKind;
  days: number; // overdue: days late; soon/later: days until due
}

/** Settled loans are never "overdue". `soon` = due within a week. */
export function dueInfo(l: Loan, now = new Date()): DueInfo {
  if (!l.dueDate || isSettled(l)) return { kind: 'none', days: 0 };
  const diff = Math.round((parseKey(l.dueDate).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff < 0) return { kind: 'overdue', days: -diff };
  return { kind: diff <= 7 ? 'soon' : 'later', days: diff };
}

export interface PersonGroup {
  key: string;
  name: string;
  loans: Loan[];
  remaining: number;
  lent: number;
  overdue: number;
}

/** People are matched case-insensitively ("arun" and "Arun" are one person). Biggest balance first. */
export function groupByPerson(loans: Loan[], now = new Date()): PersonGroup[] {
  const map = new Map<string, PersonGroup>();
  for (const l of loans) {
    const key = l.person.toLowerCase();
    const g = map.get(key) ?? { key, name: l.person, loans: [], remaining: 0, lent: 0, overdue: 0 };
    if (g.loans.length && l.createdAt < g.loans.reduce((m, x) => (x.createdAt < m ? x.createdAt : m), g.loans[0].createdAt)) g.name = l.person;
    g.loans.push(l);
    g.remaining += Math.max(0, remainingOf(l));
    g.lent += l.amountMinor;
    if (dueInfo(l, now).kind === 'overdue') g.overdue++;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name));
}

export const todayKey = () => dayKey(new Date());

export function fmtDay(key: string): string {
  const d = parseKey(key);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
