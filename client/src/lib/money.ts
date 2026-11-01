/** Money is handled as integer minor units (paise/cents) everywhere, so sums never drift. */

export const CURRENCIES = [
  { code: 'INR', label: 'Indian rupee (₹)' },
  { code: 'USD', label: 'US dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'Pound sterling (£)' },
  { code: 'AED', label: 'UAE dirham (AED)' },
  { code: 'SGD', label: 'Singapore dollar (S$)' },
  { code: 'AUD', label: 'Australian dollar (A$)' },
  { code: 'CAD', label: 'Canadian dollar (C$)' },
  { code: 'JPY', label: 'Japanese yen (¥)' },
];

/** "1,234.50", "₹250", ".5" -> minor units, or null if it isn't a positive amount with at most 2 decimals. */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[\s,₹$€£¥]/g, '');
  if (s.startsWith('.')) s = `0${s}`;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return minor > 0 && minor <= 100_000_000_000 ? minor : null;
}

export function fmtMoney(minor: number, currency: string): string {
  const hasFraction = minor % 100 !== 0;
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export const minorToInput = (minor: number) => (minor / 100).toFixed(minor % 100 === 0 ? 0 : 2);

/* ---------- categories ---------- */

export const DEFAULT_CATEGORIES = ['Food', 'Groceries', 'Transport', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Other'];

const FIXED: Record<string, string> = {
  food: '#ff7a59',
  groceries: '#2dd4a7',
  transport: '#38bdf8',
  bills: '#7c8cff',
  shopping: '#c084fc',
  health: '#f472b6',
  entertainment: '#f5b83d',
  other: '#94a3b8',
};
const PALETTE = ['#fb923c', '#a3e635', '#22d3ee', '#e879f9', '#facc15', '#34d399', '#60a5fa', '#f87171'];

/** Stable colour per category name (case-insensitive), so a custom category keeps its colour everywhere. */
export function categoryColor(name: string): string {
  const k = name.trim().toLowerCase();
  if (FIXED[k]) return FIXED[k];
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Most-used categories first, then the defaults you haven't used yet. */
export function suggestCategories(used: string[]): string[] {
  const counts = new Map<string, { name: string; n: number }>();
  for (const c of used) {
    const k = c.toLowerCase();
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { name: c, n: 1 });
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n).map((e) => e.name);
  const rest = DEFAULT_CATEGORIES.filter((d) => !counts.has(d.toLowerCase()));
  return [...top, ...rest];
}
