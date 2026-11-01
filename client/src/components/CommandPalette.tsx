import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BarChart3, CalendarPlus, CornerDownLeft, HandCoins, LogOut, Maximize2, Moon, Pause, Play, Plus, Receipt, Search, Settings, Sparkles, Square, Sun, Target, Zap } from 'lucide-react';
import { HabitIcon } from './ui';
import { useApp } from '../store';
import type { Tab } from '../App';

interface Cmd {
  id: string;
  group: string;
  label: string;
  keywords?: string;
  icon: ReactNode;
  run: () => void;
}

/** Ctrl/Cmd+K: jump anywhere, add anything, drive the timer, without leaving the keyboard. */
export function CommandPalette({ onClose, go, theme, toggleTheme }: { onClose: () => void; go: (t: Tab) => void; theme: 'dark' | 'light'; toggleTheme: () => void }) {
  const { habits, timer, openQuick, openSession, startTimer, pauseTimer, resumeTimer, setFocusOpen, setMoneyTab, logout } = useApp();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const cmds = useMemo<Cmd[]>(() => {
    const nav = (id: string, label: string, tab: Tab, icon: ReactNode, extra?: () => void): Cmd => ({ id, group: 'Go to', label, icon, run: () => { extra?.(); go(tab); } });
    const list: Cmd[] = [
      nav('go-today', 'Today', 'today', <Zap size={17} />),
      nav('go-progress', 'Progress', 'progress', <BarChart3 size={17} />),
      nav('go-expenses', 'Money · Expenses', 'spend', <Receipt size={17} />, () => setMoneyTab('expenses')),
      nav('go-lent', 'Money · Lent', 'spend', <HandCoins size={17} />, () => setMoneyTab('lent')),
      nav('go-insights', 'Insights', 'insights', <Sparkles size={17} />),
      nav('go-setup', 'Setup', 'setup', <Settings size={17} />),
      { id: 'add-expense', group: 'Create', label: 'Add expense', keywords: 'spend money log cost', icon: <Plus size={17} />, run: () => openQuick('expense') },
      { id: 'add-loan', group: 'Create', label: 'Note a loan', keywords: 'lent lend owe money borrowed', icon: <HandCoins size={17} />, run: () => openQuick('loan') },
      { id: 'add-activity', group: 'Create', label: 'New activity', keywords: 'habit add create track', icon: <Target size={17} />, run: () => openQuick('activity') },
    ];
    if (habits.length) list.push({ id: 'log-session', group: 'Create', label: 'Log a session', keywords: 'time manual workout study', icon: <CalendarPlus size={17} />, run: () => openSession({ kind: 'add' }) });
    if (timer) {
      const running = Boolean(timer.runningSince);
      list.push(
        { id: 't-toggle', group: 'Timer', label: running ? 'Pause timer' : 'Resume timer', icon: running ? <Pause size={17} /> : <Play size={17} />, run: () => void (running ? pauseTimer() : resumeTimer()) },
        { id: 't-focus', group: 'Timer', label: 'Open focus mode', keywords: 'full screen fullscreen', icon: <Maximize2 size={17} />, run: () => setFocusOpen(true) },
        { id: 't-stop', group: 'Timer', label: 'Stop & save timer', icon: <Square size={17} />, run: () => void pauseTimer().then(() => openSession({ kind: 'finish' })) }
      );
    } else {
      for (const h of habits) list.push({ id: `start-${h.id}`, group: 'Timer', label: `Start timer · ${h.name}`, keywords: 'begin go', icon: <HabitIcon habit={h} size={17} />, run: () => void startTimer(h.id) });
    }
    list.push(
      { id: 'theme', group: 'App', label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', keywords: 'theme appearance', icon: theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />, run: toggleTheme },
      { id: 'logout', group: 'App', label: 'Sign out', keywords: 'log out', icon: <LogOut size={17} />, run: () => void logout() }
    );
    return list;
  }, [habits, timer, theme, go, openQuick, openSession, startTimer, pauseTimer, resumeTimer, setFocusOpen, setMoneyTab, toggleTheme, logout]);

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return cmds;
    return cmds
      .filter((c) => tokens.every((t) => `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(t)))
      .sort((a, b) => Number(b.label.toLowerCase().startsWith(tokens[0])) - Number(a.label.toLowerCase().startsWith(tokens[0])));
  }, [cmds, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function run(c: Cmd | undefined) {
    if (!c) return;
    onClose();
    c.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  let lastGroup = '';
  return (
    <div className="overlay palette-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-search">
          <Search size={18} aria-hidden />
          <input
            autoFocus
            className="palette-input"
            placeholder="Type a command or search…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {results.length === 0 && <p className="palette-empty">No matches for “{q}”</p>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {header && !q && <div className="palette-group">{header}</div>}
                <div id={`cmd-${c.id}`} role="option" aria-selected={i === active} className="palette-item" onMouseMove={() => setActive(i)} onClick={() => run(c)}>
                  <span className="palette-icon">{c.icon}</span>
                  <span className="palette-label">{c.label}</span>
                  {q && <span className="palette-tag">{c.group}</span>}
                  {i === active && <CornerDownLeft size={14} className="palette-enter" aria-hidden />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move
          </span>
          <span>
            <kbd className="kbd">↵</kbd> to run
          </span>
        </div>
      </div>
    </div>
  );
}
