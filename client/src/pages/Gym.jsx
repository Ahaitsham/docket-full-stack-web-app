import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Dumbbell, Plus, Pencil } from 'lucide-react';
import { useSheets } from '../lib/sheetsContext.js';
import { useWorkouts } from '../lib/queries.js';
import { today, addDays, weekOf, fmtWeekday, fromISO, fmtLong } from '../lib/dates.js';
import { nf } from '../lib/format.js';
import { Empty, Skeleton, cx } from '../components/ui.jsx';

const volume = (w) => w.exercises.reduce((a, e) => a + e.sets * e.reps * e.weight, 0);

function WorkoutCard({ w }) {
  const { open } = useSheets();
  const [expanded, setExpanded] = useState(false);
  const vol = volume(w);
  return (
    <motion.div layout className="card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={expanded}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#8E4EC6]/10 text-[#8E4EC6]"><Dumbbell className="size-[18px]" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{w.name}</span>
          <span className="num text-[12.5px] text-muted">
            {fmtLong(w.date)}{w.duration_min ? ` · ${w.duration_min} min` : ''}{w.exercises.length ? ` · ${w.exercises.length} exercises` : ''}
          </span>
        </span>
        <ChevronDown className={cx('size-5 shrink-0 text-muted transition-transform', expanded && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="space-y-1.5 border-t border-line/60 px-4 py-3">
              {w.exercises.length === 0 && <p className="text-[13px] text-muted">No exercises recorded.</p>}
              {w.exercises.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-[14px]">
                  <span className="font-medium">{e.name}</span>
                  <span className="num text-muted">{e.sets} × {e.reps}{e.weight ? ` @ ${e.weight} kg` : ''}</span>
                </div>
              ))}
              {vol > 0 && <p className="num pt-1 text-[12.5px] font-medium text-muted">Total volume {nf.format(vol)} kg</p>}
              {w.notes && <p className="pt-1 text-[13px] italic text-muted">{w.notes}</p>}
              <button className="btn btn-soft mt-2 min-h-0 w-full py-2 text-[14px]" onClick={() => open('workout', { workout: w })}><Pencil className="size-4" /> Edit</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Gym() {
  const { open } = useSheets();
  const t = today();
  const week = weekOf(t);
  const q = useWorkouts(addDays(t, -60), t);
  const list = q.data || [];
  const days = useMemo(() => new Set(list.map((w) => w.date)), [list]);
  const thisWeek = list.filter((w) => w.date >= week[0] && w.date <= week[6]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] font-medium text-muted">This week</p>
            <p className="num font-display text-[34px] font-semibold leading-none">{thisWeek.length}<span className="text-[15px] font-medium text-muted"> workouts</span></p>
          </div>
          <p className="num text-right text-[13px] text-muted">{thisWeek.reduce((a, w) => a + w.duration_min, 0)} min<br />trained</p>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const did = days.has(d);
            return (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className={cx('grid size-9 place-items-center rounded-full text-[12.5px] font-semibold', did ? 'bg-[#8E4EC6] text-white' : d === t ? 'border-2 border-dashed border-[#8E4EC6]/50 text-muted' : 'bg-app text-muted')}>
                  {fromISO(d).getDate()}
                </motion.span>
                <span className="text-[10.5px] font-medium text-muted">{fmtWeekday(d).slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button className="btn btn-primary w-full" onClick={() => open('workout', { date: t })}><Plus className="size-[18px]" /> Log a workout</button>

      {q.isLoading ? (
        <Skeleton className="h-20" />
      ) : list.length === 0 ? (
        <div className="card"><Empty icon={Dumbbell} title="No workouts logged" text="Log a session with its exercises, sets and weights to watch your strength grow." /></div>
      ) : (
        <div className="space-y-2.5">{list.map((w) => <WorkoutCard key={w.id} w={w} />)}</div>
      )}
    </div>
  );
}
