import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Key, Loader2, LogOut, Moon, Plus, Sun, Trash2 } from 'lucide-react';
import { HabitIcon } from '../components/ui';
import { HabitModal } from '../components/HabitModal';
import { COLORS, ICONS, PRESET_MINUTES } from '../lib/habitTypes';
import { CURRENCIES } from '../lib/money';
import { api } from '../api';
import { useApp } from '../store';
import type { Habit } from '../types';

function RuleCard({ habit }: { habit: Habit }) {
  const { updateHabit, deleteHabit, toast } = useApp();
  const [name, setName] = useState(habit.name);
  const [mins, setMins] = useState(String(habit.minutesPerDay));

  const commitName = () => {
    const n = name.trim();
    if (!n) return setName(habit.name);
    if (n !== habit.name) void updateHabit(habit.id, { name: n });
  };
  const commitMins = () => {
    const m = Math.round(Number(mins));
    if (!Number.isFinite(m) || m < 1 || m > 600) {
      toast('Minutes per day must be between 1 and 600', 'error');
      return setMins(String(habit.minutesPerDay));
    }
    setMins(String(m));
    if (m !== habit.minutesPerDay) void updateHabit(habit.id, { minutesPerDay: m });
  };

  return (
    <section className="card rule-card" style={{ ['--hc' as string]: habit.color }}>
      <div className="hc-top">
        <div className="hc-icon">
          <HabitIcon habit={habit} />
        </div>
        <input className="input" style={{ fontWeight: 700, fontSize: 16 }} value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} maxLength={40} aria-label="Habit name" />
        <button
          className="btn btn-ghost btn-icon btn-danger"
          aria-label={`Delete ${habit.name}`}
          onClick={() => {
            if (window.confirm(`Delete "${habit.name}" and all its sessions? This cannot be undone.`)) void deleteHabit(habit.id);
          }}
        >
          <Trash2 size={17} />
        </button>
      </div>

      <div className="field">
        <span className="label">Days per week</span>
        <div className="segmented" role="group" aria-label="Days per week">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button key={n} aria-pressed={habit.daysPerWeek === n} onClick={() => habit.daysPerWeek !== n && updateHabit(habit.id, { daysPerWeek: n })}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor={`m-${habit.id}`}>
          Minutes a day to count
        </label>
        <div className="chips" style={{ alignItems: 'center' }}>
          <input id={`m-${habit.id}`} className="input tnum" style={{ width: 90 }} type="number" min={1} max={600} value={mins} onChange={(e) => setMins(e.target.value)} onBlur={commitMins} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          {PRESET_MINUTES.map((p) => (
            <button key={p} className="chip" aria-pressed={habit.minutesPerDay === p} onClick={() => { setMins(String(p)); void updateHabit(habit.id, { minutesPerDay: p }); }}>
              {p}m
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">Icon</span>
        <div className="chips" role="group" aria-label="Icon">
          {Object.entries(ICONS).map(([key, Icon]) => (
            <button key={key} className="chip" style={{ padding: '8px 11px' }} aria-label={key} aria-pressed={(habit.icon ?? '') === key} onClick={() => updateHabit(habit.id, { icon: key })}>
              <Icon size={17} />
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">Colour</span>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} className="swatch" style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={habit.color === c} onClick={() => updateHabit(habit.id, { color: c })} />
          ))}
        </div>
      </div>

      <p className="rule-explain">
        A day counts when you log <b>{habit.minutesPerDay} min</b>. Hit <b>{habit.daysPerWeek} {habit.daysPerWeek === 1 ? 'day' : 'days'}</b> in a week and that week is complete, extending your streak. {habit.daysPerWeek < 7 ? `You get ${7 - habit.daysPerWeek} rest ${7 - habit.daysPerWeek === 1 ? 'day' : 'days'} a week.` : 'No rest days.'}
      </p>
    </section>
  );
}

// stands in for the saved key (which the browser doesn't hold); typing replaces it
const MASK = '•'.repeat(24);

function AiSettings() {
  const { settings, saveSettings, toast } = useApp();
  const [key, setKey] = useState('');
  const [shown, setShown] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [model, setModel] = useState(settings.model);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    const patch: { geminiKey?: string; model?: string } = {};
    if (key.trim()) patch.geminiKey = key.trim();
    if (model.trim() && model.trim() !== settings.model) patch.model = model.trim();
    if (!Object.keys(patch).length) return toast('Nothing to save');
    if (await saveSettings(patch)) {
      setKey('');
      setShown(false);
      setRevealed(null);
      setResult(null);
      toast('AI settings saved');
    }
  }

  async function toggleShow() {
    if (shown) {
      setShown(false);
      setRevealed(null);
      return;
    }
    // Nothing typed and a key is saved: fetch it from the server (decrypted on demand).
    if (!key && settings.keySource === 'saved') {
      try {
        setRevealed((await api.revealKey()).key);
      } catch (e) {
        return toast((e as Error).message, 'error');
      }
    }
    setShown(true);
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const r = await api.testGemini();
      setResult({ ok: true, text: `Connected to ${r.model}` });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    }
    setTesting(false);
  }

  return (
    <section className="card stack">
      <div className="card-title" style={{ marginBottom: 0 }}>
        <Key size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
        AI insights (Gemini)
      </div>
      <p className="dim" style={{ fontSize: 14 }}>
        The key is stored encrypted on your server. It only comes back to this page when you press the eye icon.
        {settings.keySource === 'env' && ' Currently using the GEMINI_API_KEY environment variable.'}
      </p>
      <div className="field">
        <label className="label" htmlFor="ai-key">
          API key {settings.hasKey && <span className="pill pill-success" style={{ marginLeft: 6, textTransform: 'none' }}>{settings.keySource === 'env' ? 'from env' : 'saved'}</span>}
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="ai-key"
            className="input"
            style={{ paddingRight: 46 }}
            type={shown ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your Gemini API key"
            value={key || revealed || (settings.hasKey ? MASK : '')}
            onFocus={(e) => !key && !revealed && settings.hasKey && e.target.select()}
            onChange={(e) => {
              setRevealed(null);
              setKey(e.target.value.replace(/•/g, ''));
            }}
          />
          {(key || settings.keySource === 'saved') && (
            <button type="button" className="btn btn-ghost btn-icon" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }} onClick={toggleShow} aria-label={shown ? 'Hide API key' : 'Show API key'} aria-pressed={shown} title={shown ? 'Hide' : 'Show'}>
              {shown ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          )}
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="ai-model">
          Model
        </label>
        <input id="ai-model" className="input" value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
        <span className="muted" style={{ fontSize: 12 }}>
          Google retires model names often. If insights start failing with “not available”, change it here.
        </span>
      </div>
      {result && (
        <p className={`pill ${result.ok ? 'pill-success' : 'pill-danger'}`} style={{ borderRadius: 12, padding: '8px 12px', alignSelf: 'flex-start', whiteSpace: 'normal' }} role="status">
          {result.ok && <CheckCircle2 size={14} />} {result.text}
        </p>
      )}
      <div className="modal-foot" style={{ marginTop: 0, justifyContent: 'flex-start' }}>
        <button className="btn btn-primary" onClick={save}>
          Save
        </button>
        <button className="btn" onClick={test} disabled={testing || !settings.hasKey}>
          {testing && <Loader2 size={15} className="spin" />} Test connection
        </button>
      </div>
    </section>
  );
}

export function Setup({ theme, setTheme }: { theme: 'dark' | 'light'; setTheme: (t: 'dark' | 'light') => void }) {
  const { habits, user, logout, settings, saveSettings } = useApp();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Setup</h1>
          <p className="page-sub">Your activities and the rules that decide your streaks</p>
        </div>
        {!adding && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> New activity
          </button>
        )}
      </header>
      <div className="stack">
        {adding && <HabitModal onClose={() => setAdding(false)} />}
        {habits.length === 0 && <p className="card empty">No activities yet. Add one to get started.</p>}
        <div className="grid-2">
          {habits.map((h) => (
            <RuleCard key={h.id} habit={h} />
          ))}
        </div>
        <AiSettings />
        <section className="card stack">
          <div className="card-title" style={{ marginBottom: 0 }}>
            Account
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="avatar" aria-hidden>
              {user?.name.trim().charAt(0).toUpperCase()}
            </span>
            <span style={{ minWidth: 0 }}>
              <b>{user?.name}</b>
              <span className="muted" style={{ display: 'block', fontSize: 13 }}>
                {user?.email}
              </span>
            </span>
            <button className="btn" style={{ marginLeft: 'auto' }} onClick={logout}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </section>
        <section className="card stack">
          <div className="card-title" style={{ marginBottom: 0 }}>
            Money
          </div>
          <div className="field" style={{ maxWidth: 340 }}>
            <label className="label" htmlFor="currency">
              Currency for expenses
            </label>
            <select id="currency" className="select" value={settings.currency} onChange={(e) => void saveSettings({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="muted" style={{ fontSize: 12 }}>
              Only changes how amounts are shown. Existing amounts are not converted.
            </span>
          </div>
        </section>
        <section className="card stack">
          <div className="card-title" style={{ marginBottom: 0 }}>
            Appearance
          </div>
          <div className="chips">
            <button className="chip" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              <Moon size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
              Dark
            </button>
            <button className="chip" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              <Sun size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
              Light
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
