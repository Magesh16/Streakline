import { useMemo, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Modal } from './ui';
import { paidOf, todayKey } from '../lib/loans';
import { fmtMoney, minorToInput, parseAmount } from '../lib/money';
import { useApp } from '../store';
import type { Loan } from '../types';

/** Note a new loan, or edit an existing one. */
export function LoanModal({ loan, onClose }: { loan?: Loan; onClose: () => void }) {
  const { loans, settings, addLoan, updateLoan, toast } = useApp();
  const today = todayKey();
  const [person, setPerson] = useState(loan?.person ?? '');
  const [amount, setAmount] = useState(loan ? minorToInput(loan.amountMinor) : '');
  const [date, setDate] = useState(loan?.date ?? today);
  const [dueDate, setDueDate] = useState(loan?.dueDate ?? '');
  const [note, setNote] = useState(loan?.note ?? '');
  const [busy, setBusy] = useState(false);

  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const l of loans) if (!seen.has(l.person.toLowerCase())) seen.set(l.person.toLowerCase(), l.person);
    return [...seen.values()];
  }, [loans]);
  const paid = loan ? paidOf(loan) : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const minor = parseAmount(amount);
    if (!person.trim()) return toast('Who did you lend it to?', 'error');
    if (minor === null) return toast('Enter an amount greater than 0 (up to 2 decimals)', 'error');
    if (minor < paid) return toast(`Already repaid ${fmtMoney(paid, settings.currency)}, so the amount can't be lower`, 'error');
    if (!date || date > today) return toast(date > today ? 'The date lent can\'t be in the future' : 'Pick the date you lent it', 'error');
    if (dueDate && dueDate < date) return toast('The due date can\'t be before the date lent', 'error');
    setBusy(true);
    const typed = person.trim().replace(/\s+/g, ' ');
    const canonical = people.find((p) => p.toLowerCase() === typed.toLowerCase()) ?? typed;
    const body = { person: canonical, amountMinor: minor, date, dueDate: dueDate || null, note: note.trim() };
    const ok = loan ? await updateLoan(loan.id, body) : await addLoan(body);
    setBusy(false);
    if (!ok) return;
    toast(loan ? 'Loan updated' : `Noted: ${body.person} owes you ${fmtMoney(minor, settings.currency)}`);
    onClose();
  }

  return (
    <Modal title={loan ? 'Edit loan' : 'Note a loan'} onClose={onClose}>
      <form onSubmit={submit} className="stack" style={{ gap: 18 }} noValidate>
        <div className="field">
          <label className="label" htmlFor="ln-person">
            Lent to
          </label>
          <input id="ln-person" className="input" list="ln-people" placeholder="Name" value={person} onChange={(e) => setPerson(e.target.value)} maxLength={40} autoFocus autoComplete="off" />
          <datalist id="ln-people">
            {people.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label className="label" htmlFor="ln-amount">
            Amount
          </label>
          <input id="ln-amount" className="input amount-input tnum" style={{ paddingLeft: 14 }} inputMode="decimal" autoComplete="off" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {loan && paid > 0 && (
            <span className="muted" style={{ fontSize: 12 }}>
              {fmtMoney(paid, settings.currency)} already repaid, so it can't go lower than that.
            </span>
          )}
        </div>

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="ln-date">
              Date lent
            </label>
            <input id="ln-date" className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="ln-due">
              Return by <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span>
            </label>
            <input id="ln-due" className="input" type="date" value={dueDate} min={date} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="ln-note">
            Note <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span>
          </label>
          <textarea id="ln-note" className="textarea" placeholder="What was it for? What did they promise?" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </div>

        <div className="modal-foot" style={{ marginTop: 0 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            <Check size={16} /> {loan ? 'Save changes' : 'Save loan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
