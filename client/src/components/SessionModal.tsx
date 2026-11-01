import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Modal, Switch } from './ui';
import { DSA_TOPICS, GYM_SPLITS, TYPE_META } from '../lib/habitTypes';
import { dayKey, fmtClock } from '../lib/stats';
import { timerElapsedMs, useApp } from '../store';
import type { Session, SessionMeta } from '../types';

export type SessionMode = { kind: 'finish' } | { kind: 'add'; habitId?: string } | { kind: 'edit'; session: Session };

const pad = (n: number) => String(n).padStart(2, '0');
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function SessionModal({ mode, onClose }: { mode: SessionMode; onClose: () => void }) {
  const { habits, timer, addSession, updateSession, finishTimer, discardTimer, toast } = useApp();

  const editing = mode.kind === 'edit' ? mode.session : null;
  const finishing = mode.kind === 'finish' ? timer : null;

  const [elapsedMs] = useState(() => (finishing ? timerElapsedMs(finishing) : 0));
  const initialStart = editing ? new Date(editing.startedAt) : finishing ? new Date(finishing.startedAt) : new Date();

  const [habitId, setHabitId] = useState(editing?.habitId ?? finishing?.habitId ?? (mode.kind === 'add' ? mode.habitId : undefined) ?? habits[0]?.id ?? '');
  const [date, setDate] = useState(dayKey(initialStart));
  const [time, setTime] = useState(timeOf(initialStart));
  const [minutes, setMinutes] = useState(() => {
    if (editing) return String(Math.max(1, Math.round(editing.durationSec / 60)));
    if (finishing) return String(Math.max(1, Math.round(elapsedMs / 60000)));
    return '30';
  });
  const [note, setNote] = useState(editing?.note ?? '');
  const [meta, setMeta] = useState<SessionMeta>(editing?.meta ?? {});
  const [busy, setBusy] = useState(false);

  const habit = habits.find((h) => h.id === habitId);
  const type = habit?.type ?? 'custom';
  const patch = (m: Partial<SessionMeta>) => setMeta((x) => ({ ...x, ...m }));

  const title = finishing ? 'Save session' : editing ? 'Edit session' : 'Log a session';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const mins = Number(minutes);
    if (!habit) return toast('Pick a habit', 'error');
    if (!Number.isFinite(mins) || mins < 1 || mins > 960) return toast('Duration must be between 1 and 960 minutes', 'error');
    const startedAt = finishing ? finishing.startedAt : new Date(`${date}T${time}`).toISOString();
    if (!finishing && Date.parse(startedAt) > Date.now() + 60_000) return toast('That start time is in the future', 'error');

    // keep only the meta fields that belong to this habit type
    const clean: SessionMeta = {};
    if (type === 'gym' && meta.split) clean.split = meta.split;
    if (type === 'dsa') {
      if (meta.problem?.trim()) clean.problem = meta.problem.trim();
      if (meta.difficulty) clean.difficulty = meta.difficulty;
      if (meta.topic?.trim()) clean.topic = meta.topic.trim();
      if (meta.solved !== undefined) clean.solved = meta.solved;
    }

    setBusy(true);
    const durationSec = Math.round(mins * 60);
    let ok = false;
    if (finishing) ok = await finishTimer(durationSec, note.trim(), clean);
    else if (editing) ok = await updateSession(editing.id, { habitId, startedAt, durationSec, note: note.trim(), meta: clean });
    else ok = await addSession({ habitId, startedAt, durationSec, note: note.trim(), meta: clean });
    setBusy(false);
    if (ok) {
      toast(finishing ? `Saved ${mins} min of ${habit.name}` : editing ? 'Session updated' : 'Session logged');
      onClose();
    }
  }

  async function discard() {
    if (!window.confirm('Discard this timer without saving?')) return;
    await discardTimer();
    onClose();
  }

  if (mode.kind === 'finish' && !timer) return null;

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="stack" style={{ gap: 18 }}>
        {finishing && (
          <div className="rule-explain" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {habit?.name} · timer stopped at <b className="tnum">{fmtClock(elapsedMs)}</b>
            </span>
            {elapsedMs < 60_000 && <span className="pill pill-warn">Under a minute</span>}
          </div>
        )}

        {!finishing && (
          <div className="field">
            <label className="label" htmlFor="sm-habit">
              Habit
            </label>
            <select id="sm-habit" className="select" value={habitId} onChange={(e) => setHabitId(e.target.value)}>
              {habits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="row">
          {!finishing && (
            <>
              <div className="field">
                <label className="label" htmlFor="sm-date">
                  Date
                </label>
                <input id="sm-date" className="input" type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="sm-time">
                  Started at
                </label>
                <input id="sm-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
            </>
          )}
          <div className="field">
            <label className="label" htmlFor="sm-min">
              Minutes
            </label>
            <input id="sm-min" className="input tnum" type="number" min={1} max={960} step={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
          </div>
        </div>

        {type === 'gym' && (
          <div className="field">
            <span className="label">Workout</span>
            <div className="chips">
              {GYM_SPLITS.map((s) => (
                <button type="button" key={s} className="chip" aria-pressed={meta.split === s} onClick={() => patch({ split: meta.split === s ? undefined : s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'dsa' && (
          <>
            <div className="field">
              <label className="label" htmlFor="sm-prob">
                Problem
              </label>
              <input id="sm-prob" className="input" placeholder="e.g. LeetCode 560 · Subarray Sum Equals K" value={meta.problem ?? ''} onChange={(e) => patch({ problem: e.target.value })} maxLength={120} />
            </div>
            <div className="row">
              <div className="field">
                <span className="label">Difficulty</span>
                <div className="chips">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button type="button" key={d} className="chip" aria-pressed={meta.difficulty === d} onClick={() => patch({ difficulty: meta.difficulty === d ? undefined : d })} style={{ textTransform: 'capitalize' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="sm-topic">
                  Topic
                </label>
                <input id="sm-topic" className="input" list="dsa-topics" placeholder="Pick or type" value={meta.topic ?? ''} onChange={(e) => patch({ topic: e.target.value })} maxLength={40} />
                <datalist id="dsa-topics">
                  {DSA_TOPICS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>
            <Switch checked={meta.solved ?? false} onChange={(v) => patch({ solved: v })} label={meta.solved ? 'Solved on my own' : 'Not solved / needed hints'} />
          </>
        )}

        <div className="field">
          <label className="label" htmlFor="sm-note">
            Notes
          </label>
          <textarea id="sm-note" className="textarea" placeholder={TYPE_META[type].placeholder} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </div>

        <div className="modal-foot" style={{ marginTop: 4 }}>
          {finishing && (
            <button type="button" className="btn btn-danger btn-ghost" onClick={discard} style={{ marginRight: 'auto' }}>
              Discard
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {finishing ? 'Keep going' : 'Cancel'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Check size={16} /> {finishing ? 'Save session' : editing ? 'Save changes' : 'Log session'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
