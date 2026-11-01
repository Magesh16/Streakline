import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { Modal } from './ui';
import { categoryColor, fmtMoney, minorToInput, parseAmount, suggestCategories } from '../lib/money';
import { dayKey } from '../lib/stats';
import { useApp } from '../store';
import type { Expense } from '../types';

/** Add a new expense, or edit one when `expense` is given. */
export function ExpenseModal({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { expenses, settings, addExpense, updateExpense, toast } = useApp();
  const editing = Boolean(expense);
  const today = dayKey(new Date());

  const [amount, setAmount] = useState(expense ? minorToInput(expense.amountMinor) : '');
  const [category, setCategory] = useState(expense?.category ?? '');
  const [date, setDate] = useState(expense?.date ?? today);
  const [note, setNote] = useState(expense?.note ?? '');
  const [busy, setBusy] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => suggestCategories(expenses.map((e) => e.category)).slice(0, 10), [expenses]);
  const minor = parseAmount(amount);
  const typedNew = category.trim() && !suggestions.some((s) => s.toLowerCase() === category.trim().toLowerCase());

  async function save(another: boolean) {
    if (minor === null) return toast('Enter an amount greater than 0 (up to 2 decimals)', 'error');
    if (!category.trim()) return toast('Pick or type a category', 'error');
    if (!date || date > today) return toast(date > today ? 'That date is in the future' : 'Pick a date', 'error');
    setBusy(true);
    const body = { amountMinor: minor, category: category.trim(), date, note: note.trim() };
    const ok = editing && expense ? await updateExpense(expense.id, body) : await addExpense(body);
    setBusy(false);
    if (!ok) return;
    toast(editing ? 'Expense updated' : `Added ${fmtMoney(minor, settings.currency)} · ${body.category}`);
    if (another) {
      setAmount('');
      setNote('');
      amountRef.current?.focus();
    } else onClose();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(false);
  }

  return (
    <Modal title={editing ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <form onSubmit={onSubmit} className="stack" style={{ gap: 18 }} noValidate>
        <div className="field">
          <label className="label" htmlFor="ex-amount">
            Amount
          </label>
          <div className="amount-wrap">
            <span className="amount-cur" aria-hidden>
              {new Intl.NumberFormat(settings.currency === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency: settings.currency, maximumFractionDigits: 0 }).format(0).replace(/[\d\s.,]/g, '')}
            </span>
            <input id="ex-amount" ref={amountRef} className="input amount-input tnum" inputMode="decimal" autoComplete="off" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
        </div>

        <div className="field">
          <span className="label">Category</span>
          <div className="chips" role="group" aria-label="Category">
            {suggestions.map((c) => (
              <button type="button" key={c} className="chip" aria-pressed={category.trim().toLowerCase() === c.toLowerCase()} onClick={() => setCategory(c)}>
                <span className="tab-dot" style={{ background: categoryColor(c), display: 'inline-block', marginRight: 7 }} />
                {c}
              </button>
            ))}
          </div>
          <input className="input" style={{ marginTop: 8 }} placeholder="Or type a new category" aria-label="New category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={30} />
          {typedNew && (
            <span className="muted" style={{ fontSize: 12 }}>
              “{category.trim()}” will be created as a new category.
            </span>
          )}
        </div>

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="ex-date">
              Date
            </label>
            <input id="ex-date" className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: 1.6 }}>
            <label className="label" htmlFor="ex-note">
              Note <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span>
            </label>
            <input id="ex-note" className="input" placeholder="e.g. Lunch with Arun" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </div>
        </div>

        <div className="modal-foot" style={{ marginTop: 4 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          {!editing && (
            <button type="button" className="btn" disabled={busy} onClick={() => void save(true)}>
              <Plus size={16} /> Save &amp; add another
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Check size={16} /> {editing ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
