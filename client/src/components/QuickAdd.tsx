import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, HandCoins, Plus, Receipt, Target } from 'lucide-react';
import { ExpenseModal } from './ExpenseModal';
import { HabitModal } from './HabitModal';
import { LoanModal } from './LoanModal';
import { useApp } from '../store';

/**
 * Phone-only "+" that lives in the middle of the bottom dock (so it never covers page content) and opens the four
 * things you add most. Hidden on desktop, where the header buttons and Ctrl/Cmd+K do this.
 */
export function QuickAddButton() {
  const { habits, openQuick, openSession } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // the menu is portalled out of the dock, so "inside" means anything tagged data-fab
    const onDown = (e: MouseEvent | TouchEvent) => !(e.target as Element).closest?.('[data-fab]') && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const menu = open
    ? createPortal(
        <>
          <div className="fab-scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="fab-menu" role="menu" aria-label="Quick add" data-fab>
          <button role="menuitem" className="fab-item" onClick={pick(() => openQuick('expense'))}>
            <span>Add expense</span>
            <Receipt size={18} />
          </button>
          <button role="menuitem" className="fab-item" onClick={pick(() => openQuick('loan'))}>
            <span>Note a loan</span>
            <HandCoins size={18} />
          </button>
          {habits.length > 0 && (
            <button role="menuitem" className="fab-item" onClick={pick(() => openSession({ kind: 'add' }))}>
              <span>Log a session</span>
              <CalendarPlus size={18} />
            </button>
          )}
          <button role="menuitem" className="fab-item" onClick={pick(() => openQuick('activity'))}>
            <span>New activity</span>
            <Target size={18} />
          </button>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <div className="fab-wrap">
      {menu}
      <button className={`fab ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} aria-label="Quick add" aria-expanded={open} aria-haspopup="menu" data-fab>
        <Plus size={26} strokeWidth={2.4} />
      </button>
    </div>
  );
}

/** Renders whichever quick-add sheet the palette or the "+" button asked for. */
export function QuickHost() {
  const { quick, closeQuick } = useApp();
  return (
    <>
      {quick === 'expense' && <ExpenseModal onClose={closeQuick} />}
      {quick === 'loan' && <LoanModal onClose={closeQuick} />}
      {quick === 'activity' && <HabitModal onClose={closeQuick} />}
    </>
  );
}
