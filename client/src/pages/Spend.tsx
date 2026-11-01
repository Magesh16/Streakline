import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { CoinsArt } from '../components/Art';
import { DayBars } from '../components/Charts';
import { ExpenseModal } from '../components/ExpenseModal';
import { categoryColor, fmtMoney } from '../lib/money';
import { dayKey } from '../lib/stats';
import { useApp } from '../store';
import type { Expense } from '../types';

const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
const sum = (xs: Expense[]) => xs.reduce((a, e) => a + e.amountMinor, 0);

function dayHeading(key: string, today: string, yesterday: string) {
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function Spend() {
  const { expenses, settings, deleteExpense, toast } = useApp();
  const cur = settings.currency;
  const money = (n: number) => fmtMoney(n, cur);

  const now = new Date();
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [modal, setModal] = useState<{ expense?: Expense } | null>(null);

  const key = monthKey(ym.y, ym.m);
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const elapsed = isCurrent ? now.getDate() : daysInMonth;

  const data = useMemo(() => {
    const inMonth = expenses.filter((e) => e.date.startsWith(key));
    const total = sum(inMonth);

    const cats = new Map<string, { name: string; total: number; count: number }>();
    for (const e of inMonth) {
      const k = e.category.toLowerCase();
      const c = cats.get(k) ?? { name: e.category, total: 0, count: 0 };
      c.total += e.amountMinor;
      c.count++;
      cats.set(k, c);
    }
    const byCat = [...cats.values()].sort((a, b) => b.total - a.total);

    const days = Array.from({ length: daysInMonth }, (_, i) => ({ total: 0, label: new Date(ym.y, ym.m, i + 1).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }));
    for (const e of inMonth) days[Number(e.date.slice(8)) - 1].total += e.amountMinor;

    // compare like with like: this month so far vs last month up to the same day
    const py = ym.m === 0 ? ym.y - 1 : ym.y;
    const pm = ym.m === 0 ? 11 : ym.m - 1;
    const prevKey = monthKey(py, pm);
    const prev = sum(expenses.filter((e) => e.date.startsWith(prevKey) && (!isCurrent || Number(e.date.slice(8)) <= elapsed)));

    const groups = new Map<string, Expense[]>();
    for (const e of inMonth) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
    return { inMonth, total, byCat, days, prev, groups: [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])) };
  }, [expenses, key, daysInMonth, ym.y, ym.m, isCurrent, elapsed]);

  const delta = data.prev > 0 ? Math.round(((data.total - data.prev) / data.prev) * 100) : null;
  const shift = (n: number) => setYm((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  async function remove(e: Expense) {
    if (!window.confirm(`Delete ${money(e.amountMinor)} · ${e.category}?`)) return;
    await deleteExpense(e.id);
    toast('Expense deleted');
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Spend</h1>
          <p className="page-sub">Log what you spend and see where it goes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={16} /> Add expense
        </button>
      </header>

      <div className="month-switch" role="group" aria-label="Month">
        <button className="btn btn-icon" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <b className="month-label">{monthLabel}</b>
        <button className="btn btn-icon" onClick={() => shift(1)} disabled={isCurrent} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="card empty">
          <CoinsArt />
          <p style={{ marginBottom: 14 }}>No expenses yet. Log your first one, it takes a few seconds.</p>
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <Plus size={16} /> Add expense
          </button>
        </div>
      ) : (
        <>
          <section className="card hero spend-hero" aria-label="Month summary">
            <div className="hero-text" style={{ alignSelf: 'center' }}>
              <div className="card-title" style={{ marginBottom: 4 }}>
                Spent in {new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: 'long' })}
              </div>
              <div className="spend-total tnum" data-testid="month-total">
                {money(data.total)}
              </div>
              {delta !== null && (
                <p className={`pill ${delta > 0 ? 'pill-warn' : 'pill-success'}`} style={{ marginTop: 10 }}>
                  {delta === 0 ? 'Same as' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}% ${delta > 0 ? 'more than' : 'less than'}`} {isCurrent ? 'this point last month' : 'the month before'}
                </p>
              )}
            </div>
            <div className="hero-stats">
              <div>
                <div className="stat-n tnum">{money(Math.round(data.total / Math.max(1, elapsed)))}</div>
                <div className="stat-l">per day on average</div>
              </div>
              <div>
                <div className="stat-n tnum">{data.inMonth.length}</div>
                <div className="stat-l">{data.inMonth.length === 1 ? 'expense' : 'expenses'}</div>
              </div>
              <div>
                <div className="stat-n tnum">{data.byCat[0] ? data.byCat[0].name : '–'}</div>
                <div className="stat-l">top category</div>
              </div>
            </div>
          </section>

          {data.inMonth.length === 0 ? (
            <p className="card empty">Nothing logged in {monthLabel}.</p>
          ) : (
            <>
              <div className="grid-2" style={{ marginBottom: 16 }}>
                <section className="card">
                  <div className="card-title">By category</div>
                  <ul className="cat-list">
                    {data.byCat.map((c) => {
                      const pct = (c.total / data.total) * 100;
                      return (
                        <li key={c.name}>
                          <div className="cat-line">
                            <span className="tab-dot" style={{ background: categoryColor(c.name) }} />
                            <span className="cat-name">{c.name}</span>
                            <span className="muted tnum" style={{ fontSize: 12 }}>
                              {pct < 1 ? '<1' : Math.round(pct)}%
                            </span>
                            <b className="tnum">{money(c.total)}</b>
                          </div>
                          <div className="cat-track">
                            <i style={{ width: `${Math.max(2, pct)}%`, background: categoryColor(c.name) }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
                <section className="card">
                  <div className="card-title">Per day</div>
                  <DayBars days={data.days} color="var(--signal)" todayIndex={isCurrent ? now.getDate() - 1 : -1} format={money} />
                </section>
              </div>

              <section className="card">
                <div className="card-title">Expenses</div>
                {data.groups.map(([day, items]) => (
                  <div key={day} className="day-group">
                    <div className="day-head">
                      <span>{dayHeading(day, todayKey, yesterdayKey)}</span>
                      <span className="tnum">{money(sum(items))}</span>
                    </div>
                    {items.map((e) => (
                      <div className="exp-row" key={e.id}>
                        <span className="session-dot" style={{ background: categoryColor(e.category) }} />
                        <button className="exp-main" onClick={() => setModal({ expense: e })} aria-label={`Edit ${e.category} ${money(e.amountMinor)}`}>
                          <span className="session-title">{e.note || e.category}</span>
                          <span className="session-sub">{e.note ? e.category : 'No note'}</span>
                        </button>
                        <b className="tnum exp-amt">{money(e.amountMinor)}</b>
                        <button className="btn btn-ghost btn-icon" onClick={() => setModal({ expense: e })} aria-label="Edit expense">
                          <Pencil size={16} />
                        </button>
                        <button className="btn btn-ghost btn-icon" onClick={() => remove(e)} aria-label="Delete expense">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            </>
          )}
        </>
      )}

      {modal && <ExpenseModal expense={modal.expense} onClose={() => setModal(null)} />}
    </>
  );
}
