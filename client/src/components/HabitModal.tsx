import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from './ui';
import { COLORS, ICONS, PRESET_MINUTES, TYPE_META, type Template } from '../lib/habitTypes';
import { useApp } from '../store';
import type { HabitType } from '../types';

const BLANK: Template = { name: '', type: 'custom', icon: 'target', color: COLORS[4], daysPerWeek: 5, minutesPerDay: 30 };

/** Create a new activity. Pass a template to pre-fill the form. */
export function HabitModal({ template, onClose }: { template?: Template; onClose: () => void }) {
  const { addHabit, toast } = useApp();
  const init = template ?? BLANK;
  const [name, setName] = useState(init.name);
  const [type, setType] = useState<HabitType>(init.type);
  const [icon, setIcon] = useState(init.icon);
  const [color, setColor] = useState(init.color);
  const [days, setDays] = useState(init.daysPerWeek);
  const [mins, setMins] = useState(String(init.minutesPerDay));
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const m = Math.round(Number(mins));
    if (!name.trim()) return toast('Give your activity a name', 'error');
    if (!Number.isFinite(m) || m < 1 || m > 600) return toast('Minutes per day must be between 1 and 600', 'error');
    setBusy(true);
    const h = await addHabit({ name: name.trim(), type, icon, color, daysPerWeek: days, minutesPerDay: m });
    setBusy(false);
    if (h) {
      toast(`${h.name} added`);
      onClose();
    }
  }

  return (
    <Modal title={template ? `Add ${template.name}` : 'New activity'} onClose={onClose}>
      <form onSubmit={submit} className="stack" style={{ gap: 18, ['--hc' as string]: color }}>
        <div className="field">
          <label className="label" htmlFor="hm-name">
            Name
          </label>
          <input id="hm-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Guitar practice" maxLength={40} required />
        </div>

        <div className="field">
          <span className="label">Icon</span>
          <div className="chips" role="group" aria-label="Icon">
            {Object.entries(ICONS).map(([key, Icon]) => (
              <button type="button" key={key} className="chip" aria-pressed={icon === key} aria-label={key} onClick={() => setIcon(key)} style={{ padding: '8px 11px' }}>
                <Icon size={17} />
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">Colour</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button type="button" key={c} className="swatch" style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">How many days a week?</span>
          <div className="segmented" role="group" aria-label="Days per week">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button type="button" key={n} aria-pressed={days === n} onClick={() => setDays(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="hm-min">
            Minutes a day for it to count
          </label>
          <div className="chips" style={{ alignItems: 'center' }}>
            <input id="hm-min" className="input tnum" style={{ width: 90 }} type="number" min={1} max={600} value={mins} onChange={(e) => setMins(e.target.value)} />
            {PRESET_MINUTES.map((p) => (
              <button type="button" key={p} className="chip" aria-pressed={String(p) === mins} onClick={() => setMins(String(p))}>
                {p}m
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="hm-type">
            Extra details to log
          </label>
          <select id="hm-type" className="select" value={type} onChange={(e) => setType(e.target.value as HabitType)}>
            {(Object.keys(TYPE_META) as HabitType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_META[t].label}
              </option>
            ))}
          </select>
          <span className="muted" style={{ fontSize: 12 }}>
            {TYPE_META[type].hint}
          </span>
        </div>

        <p className="rule-explain">
          A day counts at <b>{mins || '…'} min</b>. Do that on <b>{days} {days === 1 ? 'day' : 'days'}</b> a week and the week is complete, which grows your streak.
        </p>

        <div className="modal-foot" style={{ marginTop: 0 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            <Plus size={16} /> Add activity
          </button>
        </div>
      </form>
    </Modal>
  );
}
