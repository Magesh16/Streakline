import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Modal } from './ui';
import { remainingOf, todayKey } from '../lib/loans';
import { fmtMoney, minorToInput, parseAmount } from '../lib/money';
import { useApp } from '../store';
import type { Loan } from '../types';

/** Record that someone paid some (or all) of a loan back. */
export function RepaymentModal({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const { settings, addRepayment, toast } = useApp();
  const money = (n: number) => fmtMoney(n, settings.currency);
  const left = remainingOf(loan);
  const today = todayKey();
  const [amount, setAmount] = useState(minorToInput(left));
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const minor = parseAmount(amount);
    if (minor === null) return toast('Enter an amount greater than 0 (up to 2 decimals)', 'error');
    if (minor > left) return toast(`${loan.person} only owes ${money(left)}`, 'error');
    if (!date || date > today) return toast('The repayment date can\'t be in the future', 'error');
    if (date < loan.date) return toast('That is before the loan was made', 'error');
    setBusy(true);
    const ok = await addRepayment(loan.id, { amountMinor: minor, date, note: note.trim() });
    setBusy(false);
    if (!ok) return;
    toast(minor === left ? `${loan.person} has paid everything back` : `${money(minor)} received · ${money(left - minor)} still owed`);
    onClose();
  }

  return (
    <Modal title="Record repayment" onClose={onClose}>
      <form onSubmit={submit} className="stack" style={{ gap: 18 }} noValidate>
        <p className="rule-explain">
          <b>{loan.person}</b> still owes <b>{money(left)}</b> of {money(loan.amountMinor)}.
        </p>
        <div className="field">
          <label className="label" htmlFor="rp-amount">
            Amount received
          </label>
          <input id="rp-amount" className="input amount-input tnum" style={{ paddingLeft: 14 }} inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          <div className="chips">
            <button type="button" className="chip" aria-pressed={parseAmount(amount) === left} onClick={() => setAmount(minorToInput(left))}>
              Everything ({money(left)})
            </button>
            {left >= 200 && (
              <button type="button" className="chip" aria-pressed={parseAmount(amount) === Math.floor(left / 2)} onClick={() => setAmount(minorToInput(Math.floor(left / 2)))}>
                Half ({money(Math.floor(left / 2))})
              </button>
            )}
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label className="label" htmlFor="rp-date">
              Date
            </label>
            <input id="rp-date" className="input" type="date" value={date} min={loan.date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1.6 }}>
            <label className="label" htmlFor="rp-note">
              Note <span style={{ textTransform: 'none', fontWeight: 500 }}>(optional)</span>
            </label>
            <input id="rp-note" className="input" placeholder="e.g. paid by GPay" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </div>
        </div>
        <div className="modal-foot" style={{ marginTop: 0 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            <Check size={16} /> Save repayment
          </button>
        </div>
      </form>
    </Modal>
  );
}
