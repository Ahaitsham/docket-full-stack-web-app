// ---------- errors ----------
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const bad = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

// ---------- date helpers (all dates are 'YYYY-MM-DD' strings, math done in UTC) ----------
export const pad = (n) => String(n).padStart(2, '0');
export const toStr = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime());
export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toStr(d);
};
export const dayOfWeek = (s) => parseDate(s).getUTCDay(); // 0 = Sunday
export const daysBetween = (from, to) => Math.round((parseDate(to) - parseDate(from)) / 86400000);
export function* eachDate(from, to) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

// Current local date + minutes-since-midnight in a given IANA timezone.
export function localNow(timeZone) {
  const fmt = (tz) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
  let parts;
  try {
    parts = fmt(timeZone || 'Asia/Kolkata');
  } catch {
    parts = fmt('Asia/Kolkata');
  }
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}
export const hhmmToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// ---------- recurrence ----------
// Is `task` supposed to happen on `date`?
export function isScheduled(task, date) {
  if (date < task.start_date) return false;
  if (task.end_date && date > task.end_date) return false;
  switch (task.repeat) {
    case 'none':
      return date === task.start_date;
    case 'daily':
      return true;
    case 'weekdays': {
      const d = dayOfWeek(date);
      return d >= 1 && d <= 5;
    }
    case 'weekly':
      return (task.days || []).includes(dayOfWeek(date));
    default:
      return false;
  }
}

// ---------- validation ----------
export const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export function reqStr(v, label, max = 200) {
  const s = str(v, max);
  if (!s) throw bad(`${label} is required`);
  return s;
}
export function num(v, label, { min = -Infinity, max = Infinity, required = true } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${label} is required`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`${label} must be a number between ${min} and ${max}`);
  return n;
}
export function date(v, label = 'Date', required = true) {
  if (v === undefined || v === null || v === '') {
    if (required) throw bad(`${label} is required`);
    return null;
  }
  if (!isDate(v)) throw bad(`${label} must look like 2026-01-31`);
  return v;
}
export function oneOf(v, list, label, fallback) {
  if (v === undefined || v === null || v === '') {
    if (fallback !== undefined) return fallback;
    throw bad(`${label} is required`);
  }
  if (!list.includes(v)) throw bad(`${label} must be one of: ${list.join(', ')}`);
  return v;
}
export const id = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad('Invalid id');
  return n;
};
export const round1 = (n) => Math.round(n * 10) / 10;
