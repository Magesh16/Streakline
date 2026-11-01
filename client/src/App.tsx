import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, LogOut, Moon, Search, Settings, Sparkles, Sun, Wallet, XCircle, Zap, type LucideIcon } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { BrandMark } from './components/BrandMark';
import { CommandPalette } from './components/CommandPalette';
import { FocusMode } from './components/FocusMode';
import { QuickAddButton, QuickHost } from './components/QuickAdd';
import { RunningBar } from './components/RunningBar';
import { SessionModal } from './components/SessionModal';
import { Insights } from './pages/Insights';
import { Progress } from './pages/Progress';
import { Setup } from './pages/Setup';
import { Money } from './pages/Money';
import { Today } from './pages/Today';
import { useApp } from './store';

export type Tab = 'today' | 'progress' | 'spend' | 'insights' | 'setup';

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', Icon: Zap },
  { id: 'progress', label: 'Progress', Icon: BarChart3 },
  { id: 'spend', label: 'Money', Icon: Wallet },
  { id: 'insights', label: 'Insights', Icon: Sparkles },
  { id: 'setup', label: 'Setup', Icon: Settings },
];

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: just don't persist */
  }
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === 'ok' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function App() {
  const { user, logout, loading, loadError, reload, sessionModal, closeSession, timer } = useApp();
  const [palette, setPalette] = useState(false);
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === read('tab')) ? (read('tab') as Tab) : 'today'));
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (read('theme') as 'dark' | 'light') || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0c0f' : '#f4f2ec');
    write('theme', theme);
  }, [theme]);

  // Ctrl/Cmd+K opens the command palette from anywhere once signed in
  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [user]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const go = (t: Tab) => {
    setTab(t);
    write('tab', t);
    window.scrollTo({ top: 0 });
  };

  if (loading)
    return (
      <div className="fullpage boot" role="status" aria-label="Loading">
        <BrandMark size={52} />
        <div className="boot-bars">
          <i />
          <i />
          <i />
        </div>
      </div>
    );

  if (loadError)
    return (
      <div className="fullpage">
        <div>
          <XCircle size={36} color="var(--danger)" />
          <h1 style={{ margin: '12px 0 6px', color: 'var(--text)' }}>Can’t reach the server</h1>
          <p style={{ marginBottom: 16 }}>{loadError}</p>
          <button className="btn btn-primary" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );

  if (!user)
    return (
      <>
        <AuthScreen />
        <Toasts />
      </>
    );

  return (
    <div className={`shell ${timer ? 'has-timer' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          Streakline
        </div>
        <button className="nav-search" onClick={() => setPalette(true)} aria-label="Open command palette">
          <Search size={16} />
          <span>Jump to…</span>
          <kbd className="kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <nav className="nav" aria-label="Main">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className="nav-item" aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
              <Icon size={19} /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip" title={user.email}>
            <span className="avatar" aria-hidden>
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            <span style={{ minWidth: 0 }}>
              <b className="user-name">{user.name}</b>
              <span className="user-mail">{user.email}</span>
            </span>
            <button className="btn btn-ghost btn-icon" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
          <button className="nav-item" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="page" key={tab}>
          {tab === 'today' && <Today go={go} />}
          {tab === 'progress' && <Progress />}
          {tab === 'spend' && <Money />}
          {tab === 'insights' && <Insights go={go} />}
          {tab === 'setup' && <Setup theme={theme} setTheme={setTheme} />}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Main">
        {TABS.slice(0, 2).map(({ id, label, Icon }) => (
          <button key={id} className="bn-item" aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
            <Icon size={22} />
            {label}
          </button>
        ))}
        <QuickAddButton />
        {TABS.slice(2).map(({ id, label, Icon }) => (
          <button key={id} className="bn-item" aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>

      <RunningBar />
      <FocusMode />
      {sessionModal && <SessionModal mode={sessionModal} onClose={closeSession} />}
      <QuickHost />
      {palette && <CommandPalette onClose={() => setPalette(false)} go={go} theme={theme} toggleTheme={toggleTheme} />}

      <Toasts />
    </div>
  );
}
