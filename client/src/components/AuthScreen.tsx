import { useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, Flame, Loader2, LineChart, Sparkles } from 'lucide-react';
import { StreakArt } from './Art';
import { BrandMark } from './BrandMark';
import { useApp } from '../store';

const POINTS = [
  { Icon: Flame, text: 'Streaks built on weeks, so a rest day never breaks your run' },
  { Icon: LineChart, text: 'Your own activities, targets and a heatmap of every day' },
  { Icon: Sparkles, text: 'A written review of your week from Gemini' },
];

export function AuthScreen() {
  const { login, register } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isReg = mode === 'register';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isReg && password.length < 8) return setError('Password must be at least 8 characters');
    setBusy(true);
    const err = isReg ? await register(name, email, password) : await login(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError(null);
  };

  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="brand">
          <BrandMark />
          Streakline
        </div>
        <div>
          <StreakArt width={260} className="auth-art" />
          <h1 className="auth-headline">Show up. Keep the streak.</h1>
          <p className="muted" style={{ marginTop: 10, maxWidth: 380 }}>
            A daily consistency tracker for the things you actually want to get better at.
          </p>
          <ul className="auth-points">
            {POINTS.map(({ Icon, text }) => (
              <li key={text}>
                <span className="hc-icon" style={{ ['--hc' as string]: 'var(--accent)', width: 34, height: 34, borderRadius: 11 }}>
                  <Icon size={17} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="auth-panel">
        <form className="card auth-card" onSubmit={submit} noValidate>
          <div className="segmented auth-tabs" style={{ gridTemplateColumns: '1fr 1fr' }} role="tablist" aria-label="Sign in or create an account">
            <button type="button" role="tab" aria-selected={!isReg} aria-pressed={!isReg} onClick={() => switchMode('login')}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={isReg} aria-pressed={isReg} onClick={() => switchMode('register')}>
              Create account
            </button>
          </div>

          <div>
            <h2 style={{ fontSize: 22, letterSpacing: '-0.02em' }}>{isReg ? 'Create your account' : 'Welcome back'}</h2>
            <p className="muted" style={{ marginTop: 2 }}>
              {isReg ? 'Your activities and progress stay private to you.' : 'Sign in to pick up your streak.'}
            </p>
          </div>

          {isReg && (
            <div className="field">
              <label className="label" htmlFor="au-name">
                Name
              </label>
              <input id="au-name" className="input" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} maxLength={40} required autoFocus />
            </div>
          )}

          <div className="field">
            <label className="label" htmlFor="au-email">
              Email
            </label>
            <input id="au-email" className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} required autoFocus={!isReg} />
          </div>

          <div className="field">
            <label className="label" htmlFor="au-pass">
              Password
            </label>
            <div className="pass-wrap">
              <input id="au-pass" className="input" type={show ? 'text' : 'password'} autoComplete={isReg ? 'new-password' : 'current-password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} required minLength={isReg ? 8 : undefined} maxLength={128} />
              <button type="button" className="btn btn-ghost btn-icon pass-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {isReg && (
              <span className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: password.length >= 8 ? 'var(--success)' : undefined }}>
                <CheckCircle2 size={13} /> At least 8 characters
              </span>
            )}
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn-primary" style={{ padding: '12px 16px' }} disabled={busy || !email || !password || (isReg && !name.trim())}>
            {busy && <Loader2 size={16} className="spin" />} {isReg ? 'Create account' : 'Sign in'}
          </button>

          <p className="muted" style={{ fontSize: 13, textAlign: 'center' }}>
            {isReg ? 'Already have an account?' : 'New here?'}{' '}
            <button type="button" className="link" onClick={() => switchMode(isReg ? 'login' : 'register')}>
              {isReg ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}
