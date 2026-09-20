export const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
export const money = (n, cur = '₹') => `${n < 0 ? '−' : ''}${cur}${nf.format(Math.abs(n))}`;
export const compact = (n, cur = '₹') => {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e7) return `${sign}${cur}${nf1.format(a / 1e7)}Cr`;
  if (a >= 1e5) return `${sign}${cur}${nf1.format(a / 1e5)}L`;
  if (a >= 1e3) return `${sign}${cur}${nf1.format(a / 1e3)}k`;
  return `${sign}${cur}${nf.format(a)}`;
};
export const pct = (v) => (v === null || v === undefined ? '–' : `${Math.round(v)}%`);
export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
export const firstName = (name = '') => name.split(/\s+/)[0] || name;
