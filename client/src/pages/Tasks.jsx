import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, ListChecks, CalendarCheck } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useSheets } from '../lib/sheetsContext.js';
import { useAllTasks, useCategories, useDayTasks, useTaskSummary, useToggleTask } from '../lib/queries.js';
import { today, weekOf, addDays, fmtWeekday, fromISO, relativeDay, fmtMonth } from '../lib/dates.js';
import { TaskRow } from '../components/TaskRow.jsx';
import { Chip, Empty, ProgressBar, Segmented, Skeleton, cx } from '../components/ui.jsx';
import { Navigate } from 'react-router-dom';

function WeekStrip({ selected, onSelect }) {
  const [anchor, setAnchor] = useState(selected);
  const days = useMemo(() => weekOf(anchor), [anchor]);
  const summary = useTaskSummary(days[0], days[6]);
  const t = today();
  return (
    <div className="card p-2.5">
      <div className="mb-1.5 flex items-center justify-between px-1.5">
        <span className="text-[14px] font-semibold">{fmtMonth(days[3])}</span>
        <div className="flex items-center gap-1">
          {selected !== t && (
            <button className="mr-1 rounded-full bg-brand/10 px-3 py-1 text-[12px] font-semibold text-brand" onClick={() => { onSelect(t); setAnchor(t); }}>
              Today
            </button>
          )}
          <button aria-label="Previous week" onClick={() => setAnchor(addDays(anchor, -7))} className="grid size-8 place-items-center rounded-full text-muted active:bg-app"><ChevronLeft className="size-[18px]" /></button>
          <button aria-label="Next week" onClick={() => setAnchor(addDays(anchor, 7))} className="grid size-8 place-items-center rounded-full text-muted active:bg-app"><ChevronRight className="size-[18px]" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const on = d === selected;
          const s = summary.data?.[d];
          const frac = s?.total ? s.done / s.total : 0;
          return (
            <button key={d} onClick={() => onSelect(d)} className="relative flex flex-col items-center gap-1 rounded-2xl py-2 transition active:scale-95" aria-pressed={on} aria-label={relativeDay(d)}>
              {on && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className={cx('relative text-[11px] font-semibold', on ? 'text-app/70' : 'text-muted')}>{fmtWeekday(d).slice(0, 3)}</span>
              <span className={cx('num relative font-display text-[19px] font-semibold leading-none', on ? 'text-app' : d === t ? 'text-brand' : 'text-ink')}>{fromISO(d).getDate()}</span>
              <span className={cx('relative h-1 w-5 overflow-hidden rounded-full', on ? 'bg-app/25' : 'bg-line')}>
                {s?.total > 0 && <span className="block h-full rounded-full" style={{ width: `${frac * 100}%`, background: on ? '#D6A852' : 'rgb(var(--brand))' }} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AllTasks() {
  const { open } = useSheets();
  const q = useAllTasks();
  if (q.isLoading) return <Skeleton className="mt-4 h-40" />;
  if (!q.data?.length) return <Empty icon={ListChecks} title="No tasks yet" text="Add your first task, like a court date or a daily medicine." />;
  return (
    <div className="mt-4 space-y-2.5">
      {q.data.map((t, i) => (
        <TaskRow key={t.id} task={t} index={i} onOpen={() => open('task', { task: t })} />
      ))}
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const { open } = useSheets();
  const [date, setDate] = useState(today());
  const [view, setView] = useState('day');
  const [cat, setCat] = useState(null);
  const cats = useCategories();
  const q = useDayTasks(date);
  const toggle = useToggleTask(date);

  if (!user.modules.tasks) return <Navigate to="/" replace />;

  const list = (q.data || []).filter((t) => cat === null || t.category_id === cat);
  const done = list.filter((t) => t.done).length;
  const used = new Set((q.data || []).map((t) => t.category_id));

  return (
    <div className="space-y-4">
      <Segmented value={view} onChange={setView} options={[{ value: 'day', label: 'By day' }, { value: 'all', label: 'All tasks' }]} />
      {view === 'all' ? (
        <AllTasks />
      ) : (
        <>
          <WeekStrip selected={date} onSelect={setDate} />

          <div className="flex items-end justify-between px-1">
            <div>
              <h2 className="font-display text-[21px] font-semibold leading-tight">{relativeDay(date)}</h2>
              <p className="text-[13px] text-muted">{list.length ? `${done} of ${list.length} done` : 'Nothing scheduled'}</p>
            </div>
            <button className="btn btn-soft min-h-0 rounded-full px-3.5 py-2 text-[13px]" onClick={() => open('task', { date })}>
              <Plus className="size-4" /> Add
            </button>
          </div>
          {list.length > 0 && <ProgressBar value={done / list.length} color="rgb(var(--good))" />}

          {used.size > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              <Chip on={cat === null} onClick={() => setCat(null)}>All</Chip>
              {cats.data?.filter((c) => used.has(c.id)).map((c) => (
                <Chip key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>
                  <span>{c.icon}</span>{c.name}
                </Chip>
              ))}
            </div>
          )}

          {q.isLoading ? (
            <div className="space-y-2.5"><Skeleton className="h-[68px]" /><Skeleton className="h-[68px]" /><Skeleton className="h-[68px]" /></div>
          ) : list.length === 0 ? (
            <Empty icon={CalendarCheck} title={date === today() ? 'A clear day' : 'Nothing planned'} text="Add a hearing, a medicine, a workout. Set a time and Docket will remind you." action={<button className="btn btn-primary" onClick={() => open('task', { date })}><Plus className="size-4" /> New task</button>} />
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {list.map((t, i) => (
                  <TaskRow key={t.id} task={t} index={i} onToggle={(v) => toggle.mutate({ id: t.id, done: v })} onOpen={() => open('task', { task: t, date })} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
