export const pad = (n) => String(n).padStart(2, '0');

// Local calendar date as YYYY-MM-DD (never UTC, so "today" is right for the person holding the phone).
export const toISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const addMonths = (s, n) => {
  const d = fromISO(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
};
export const today = () => toISO();
export const startOfWeek = (s) => addDays(s, -((fromISO(s).getDay() + 6) % 7)); // Monday
export const weekOf = (s) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(s), i));
export const monthRange = (s) => {
  const d = fromISO(s);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toISO(first), to: toISO(last) };
};

const fmt = (opts) => new Intl.DateTimeFormat('en-IN', opts);
export const fmtLong = (s) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(fromISO(s));
export const fmtShort = (s) => fmt({ day: 'numeric', month: 'short' }).format(fromISO(s));
export const fmtWeekday = (s) => fmt({ weekday: 'short' }).format(fromISO(s));
export const fmtMonth = (s) => fmt({ month: 'long', year: 'numeric' }).format(fromISO(s));

export function relativeDay(s) {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, 1)) return 'Tomorrow';
  if (s === addDays(t, -1)) return 'Yesterday';
  return fmtLong(s);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'pm' : 'am'}`;
}
export const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const nowMinutes = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
