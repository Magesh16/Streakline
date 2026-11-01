import { HandCoins, Receipt } from 'lucide-react';
import { Lent } from './Lent';
import { Spend } from './Spend';
import { dueInfo } from '../lib/loans';
import { useApp } from '../store';

/** Expenses and money lent to others, behind one tab. */
export function Money() {
  const { loans, moneyTab: sub, setMoneyTab: pick } = useApp();
  const overdue = loans.filter((l) => dueInfo(l).kind === 'overdue').length;

  return (
    <>
      <div className="segmented money-switch" style={{ gridTemplateColumns: '1fr 1fr' }} role="group" aria-label="Money section">
        <button aria-pressed={sub === 'expenses'} onClick={() => pick('expenses')}>
          <Receipt size={15} style={{ verticalAlign: -2, marginRight: 7 }} />
          Expenses
        </button>
        <button aria-pressed={sub === 'lent'} onClick={() => pick('lent')}>
          <HandCoins size={15} style={{ verticalAlign: -2, marginRight: 7 }} />
          Lent
          {overdue > 0 && <span className="dot-alert" title={`${overdue} overdue`} aria-label={`${overdue} overdue`} />}
        </button>
      </div>
      {sub === 'expenses' ? <Spend /> : <Lent />}
    </>
  );
}
