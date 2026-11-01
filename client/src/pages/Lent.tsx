import { useMemo, useState } from 'react';
import { CheckCheck, ChevronDown, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { LoopArt } from '../components/Art';
import { LoanModal } from '../components/LoanModal';
import { RepaymentModal } from '../components/RepaymentModal';
import { dueInfo, fmtDay, groupByPerson, isSettled, paidOf, remainingOf, todayKey } from '../lib/loans';
import { categoryColor, fmtMoney } from '../lib/money';
import { useApp } from '../store';
import type { Loan } from '../types';

type Filter = 'open' | 'settled' | 'all';

function DuePill({ loan }: { loan: Loan }) {
  if (isSettled(loan)) return <span className="pill pill-success">Settled</span>;
  const d = dueInfo(loan);
  if (d.kind === 'overdue') return <span className="pill pill-danger">Overdue · {d.days} {d.days === 1 ? 'day' : 'days'}</span>;
  if (d.kind === 'soon') return <span className="pill pill-warn">{d.days === 0 ? 'Due today' : `Due in ${d.days} ${d.days === 1 ? 'day' : 'days'}`}</span>;
  if (d.kind === 'later' && loan.dueDate) return <span className="pill">Due {fmtDay(loan.dueDate)}</span>;
  return null;
}

export function Lent() {
  const { loans, settings, addRepayment, deleteLoan, deleteRepayment, toast } = useApp();
  const money = (n: number) => fmtMoney(n, settings.currency);
  const [filter, setFilter] = useState<Filter>('open');
  const [modal, setModal] = useState<{ kind: 'loan'; loan?: Loan } | { kind: 'repay'; loan: Loan } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({}); // expanded repayment histories

  const stats = useMemo(() => {
    const openLoans = loans.filter((l) => !isSettled(l));
    return {
      owed: openLoans.reduce((a, l) => a + remainingOf(l), 0),
      people: new Set(openLoans.map((l) => l.person.toLowerCase())).size,
      open: openLoans.length,
      overdue: openLoans.filter((l) => dueInfo(l).kind === 'overdue').length,
      repaid: loans.reduce((a, l) => a + paidOf(l), 0),
    };
  }, [loans]);

  const groups = useMemo(() => {
    const shown = loans.filter((l) => (filter === 'all' ? true : filter === 'open' ? !isSettled(l) : isSettled(l)));
    return groupByPerson(shown);
  }, [loans, filter]);

  async function markPaid(l: Loan) {
    const ok = await addRepayment(l.id, { amountMinor: remainingOf(l), date: todayKey() < l.date ? l.date : todayKey(), note: 'Settled' });
    if (ok) toast(`${l.person} has paid everything back`);
  }
  async function remove(l: Loan) {
    if (!window.confirm(`Delete the ${money(l.amountMinor)} loan to ${l.person}? Its repayment history goes too.`)) return;
    await deleteLoan(l.id);
    toast('Loan deleted');
  }
  async function removeRepayment(l: Loan, rid: string) {
    if (!window.confirm('Remove this repayment? The balance owed goes back up.')) return;
    await deleteRepayment(l.id, rid);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Lent</h1>
          <p className="page-sub">Money you've lent, so you always remember who owes what</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ kind: 'loan' })}>
          <Plus size={16} /> Note a loan
        </button>
      </header>

      {loans.length === 0 ? (
        <div className="card empty">
          <LoopArt />
          <p style={{ marginBottom: 14 }}>Nothing lent yet. Note a loan with who, how much and when, and tick it off as it comes back.</p>
          <button className="btn btn-primary" onClick={() => setModal({ kind: 'loan' })}>
            <Plus size={16} /> Note a loan
          </button>
        </div>
      ) : (
        <>
          <section className="card hero spend-hero" aria-label="Owed to you">
            <div className="hero-text" style={{ alignSelf: 'center' }}>
              <div className="card-title" style={{ marginBottom: 4 }}>
                Owed to you
              </div>
              <div className="spend-total tnum" data-testid="owed-total">
                {money(stats.owed)}
              </div>
              {stats.overdue > 0 ? (
                <p className="pill pill-danger" style={{ marginTop: 10 }}>
                  {stats.overdue} {stats.overdue === 1 ? 'loan is' : 'loans are'} overdue
                </p>
              ) : stats.open === 0 ? (
                <p className="pill pill-success" style={{ marginTop: 10 }}>
                  Everyone has paid you back
                </p>
              ) : null}
            </div>
            <div className="hero-stats">
              <div>
                <div className="stat-n tnum">{stats.people}</div>
                <div className="stat-l">{stats.people === 1 ? 'person owes you' : 'people owe you'}</div>
              </div>
              <div>
                <div className="stat-n tnum">{stats.open}</div>
                <div className="stat-l">open {stats.open === 1 ? 'loan' : 'loans'}</div>
              </div>
              <div>
                <div className="stat-n tnum">{money(stats.repaid)}</div>
                <div className="stat-l">paid back so far</div>
              </div>
            </div>
          </section>

          <div className="tabs" role="group" aria-label="Show">
            {(['open', 'settled', 'all'] as const).map((f) => (
              <button key={f} className="tab" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'open' ? 'Outstanding' : f === 'settled' ? 'Settled' : 'All'}
              </button>
            ))}
          </div>

          {groups.length === 0 ? (
            <p className="card empty">{filter === 'open' ? 'Nothing outstanding. Everyone has paid you back.' : 'Nothing here yet.'}</p>
          ) : (
            <div className="stack">
              {groups.map((g) => (
                <section className="card person-card" key={g.key} aria-label={g.name}>
                  <div className="person-head">
                    <span className="avatar" style={{ background: categoryColor(g.name), color: '#0b0d12' }} aria-hidden>
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 className="person-name">{g.name}</h3>
                      <p className="muted" style={{ fontSize: 13 }}>
                        {g.loans.length} {g.loans.length === 1 ? 'loan' : 'loans'}
                        {g.overdue > 0 && <span style={{ color: 'var(--danger)', fontWeight: 700 }}> · {g.overdue} overdue</span>}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="stat-n tnum" style={{ fontSize: 20 }}>
                        {g.remaining > 0 ? money(g.remaining) : 'Settled'}
                      </div>
                      <div className="stat-l">{g.remaining > 0 ? 'still owed' : `of ${money(g.lent)}`}</div>
                    </div>
                  </div>

                  {g.loans.map((l) => {
                    const paid = paidOf(l);
                    const left = remainingOf(l);
                    const done = isSettled(l);
                    return (
                      <div className={`loan ${done ? 'done' : ''}`} key={l.id}>
                        <div className="loan-top">
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="loan-note">{l.note || 'Loan'}</div>
                            <div className="session-sub">
                              {money(l.amountMinor)} lent on {fmtDay(l.date)}
                            </div>
                          </div>
                          <DuePill loan={l} />
                          <button className="btn btn-ghost btn-icon" onClick={() => setModal({ kind: 'loan', loan: l })} aria-label={`Edit loan to ${l.person}`}>
                            <Pencil size={16} />
                          </button>
                          <button className="btn btn-ghost btn-icon" onClick={() => remove(l)} aria-label={`Delete loan to ${l.person}`}>
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="cat-track" role="img" aria-label={`${Math.round((paid / l.amountMinor) * 100)}% repaid`}>
                          <i style={{ width: `${Math.min(100, (paid / l.amountMinor) * 100)}%`, background: 'var(--success)' }} />
                        </div>
                        <div className="loan-foot">
                          <span className="tnum muted" style={{ fontSize: 13 }}>
                            {paid > 0 ? `${money(paid)} paid · ` : ''}
                            <b style={{ color: done ? 'var(--success)' : 'var(--text)' }}>{done ? 'all paid back' : `${money(left)} left`}</b>
                          </span>
                          <span className="loan-actions">
                            {l.repayments.length > 0 && (
                              <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => ({ ...o, [l.id]: !o[l.id] }))} aria-expanded={Boolean(open[l.id])}>
                                <ChevronDown size={14} style={{ transform: open[l.id] ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
                                {l.repayments.length} {l.repayments.length === 1 ? 'payment' : 'payments'}
                              </button>
                            )}
                            {!done && (
                              <>
                                <button className="btn btn-sm" onClick={() => markPaid(l)}>
                                  <CheckCheck size={14} /> Mark repaid
                                </button>
                                <button className="btn btn-sm btn-primary" onClick={() => setModal({ kind: 'repay', loan: l })}>
                                  <Wallet size={14} /> Record payment
                                </button>
                              </>
                            )}
                          </span>
                        </div>

                        {open[l.id] && (
                          <ul className="repay-list">
                            {[...l.repayments].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                              <li key={r.id}>
                                <span className="tnum">{fmtDay(r.date)}</span>
                                <span className="repay-note">{r.note || 'Payment'}</span>
                                <b className="tnum">{money(r.amountMinor)}</b>
                                <button className="btn btn-ghost btn-icon" onClick={() => removeRepayment(l, r.id)} aria-label={`Remove ${money(r.amountMinor)} repayment`}>
                                  <Trash2 size={14} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {modal?.kind === 'loan' && <LoanModal loan={modal.loan} onClose={() => setModal(null)} />}
      {modal?.kind === 'repay' && <RepaymentModal loan={modal.loan} onClose={() => setModal(null)} />}
    </>
  );
}
