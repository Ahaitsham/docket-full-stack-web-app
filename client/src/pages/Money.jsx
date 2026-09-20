import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, Plus, Wallet } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useSheets } from '../lib/sheetsContext.js';
import { useMoneySummary, useTransactions } from '../lib/queries.js';
import { today, addMonths, monthRange, fmtMonth, fmtLong } from '../lib/dates.js';
import { money, compact } from '../lib/format.js';
import { Segmented, ProgressBar, Empty, Skeleton, cx } from '../components/ui.jsx';

export default function Money() {
  const { user } = useAuth();
  const { open } = useSheets();
  const [anchor, setAnchor] = useState(today());
  const [filter, setFilter] = useState('all');
  const { from, to } = monthRange(anchor);
  const summary = useMoneySummary(from, to);
  const txs = useTransactions(from, to);
  const cur = user.currency;
  const s = summary.data;
  const max = Math.max(s?.income || 0, s?.expense || 0, 1);

  const groups = useMemo(() => {
    const g = new Map();
    for (const t of txs.data || []) {
      if (filter !== 'all' && t.type !== filter) continue;
      if (!g.has(t.date)) g.set(t.date, []);
      g.get(t.date).push(t);
    }
    return [...g.entries()];
  }, [txs.data, filter]);

  const isCurrent = anchor.slice(0, 7) === today().slice(0, 7);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button aria-label="Previous month" onClick={() => setAnchor(addMonths(anchor, -1))} className="grid size-10 place-items-center rounded-full bg-card text-muted shadow-card active:scale-90"><ChevronLeft className="size-5" /></button>
        <p className="font-display text-[20px] font-semibold">{fmtMonth(anchor)}</p>
        <button aria-label="Next month" onClick={() => setAnchor(addMonths(anchor, 1))} disabled={isCurrent} className="grid size-10 place-items-center rounded-full bg-card text-muted shadow-card active:scale-90 disabled:opacity-30"><ChevronRight className="size-5" /></button>
      </div>

      <div className="card p-5">
        {summary.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            <p className="text-[13px] font-medium text-muted">Net this month</p>
            <p className={cx('num font-display text-[38px] font-semibold leading-tight', s.net < 0 ? 'text-bad' : 'text-ink')}>{money(s.net, cur)}</p>
            <div className="mt-4 space-y-3">
              {[
                ['Income', s.income, 'rgb(var(--good))', ArrowDownLeft],
                ['Expenses', s.expense, 'rgb(var(--brass))', ArrowUpRight],
              ].map(([l, v, c, Icon]) => (
                <div key={l}>
                  <div className="mb-1.5 flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-1.5 font-medium text-muted"><Icon className="size-3.5" style={{ color: c }} />{l}</span>
                    <span className="num font-semibold">{money(v, cur)}</span>
                  </div>
                  <ProgressBar value={v / max} color={c} height={7} />
                </div>
              ))}
            </div>
            {s.byCategory.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line/60 pt-4">
                {s.byCategory.slice(0, 5).map((c) => (
                  <span key={c.category} className="rounded-full bg-app px-3 py-1.5 text-[12.5px] font-medium">
                    {c.category} <span className="num font-semibold text-muted">{compact(c.total, cur)}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Segmented className="flex-1" size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expenses' }]} />
        <button className="btn btn-primary min-h-0 rounded-full px-4 py-2.5 text-[14px]" onClick={() => open('tx', {})}><Plus className="size-4" /> Add</button>
      </div>

      {txs.isLoading ? (
        <div className="space-y-2.5"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : groups.length === 0 ? (
        <div className="card"><Empty icon={Wallet} title="No entries yet" text="Record a client payment or an expense to see where your money goes." /></div>
      ) : (
        groups.map(([d, items]) => (
          <section key={d}>
            <p className="mb-1.5 px-1 text-[13px] font-medium text-muted">{fmtLong(d)}</p>
            <div className="card divide-y divide-line/60 overflow-hidden">
              {items.map((t) => (
                <motion.button layout key={t.id} onClick={() => open('tx', { tx: t })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-app">
                  <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', t.type === 'income' ? 'bg-good/10 text-good' : 'bg-brass/10 text-brass')}>
                    {t.type === 'income' ? <ArrowDownLeft className="size-[18px]" /> : <ArrowUpRight className="size-[18px]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{t.category}</span>
                    {t.note && <span className="block truncate text-[12.5px] text-muted">{t.note}</span>}
                  </span>
                  <span className={cx('num shrink-0 text-[15.5px] font-semibold', t.type === 'income' && 'text-good')}>
                    {t.type === 'income' ? '+' : '−'}{money(t.amount, cur)}
                  </span>
                </motion.button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
