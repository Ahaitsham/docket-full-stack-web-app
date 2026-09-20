import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Plus, Flame, Utensils, Wallet, Dumbbell, BellRing, ArrowRight, CalendarCheck } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useSheets } from '../lib/sheetsContext.js';
import { useDayTasks, useDietProfile, useMeals, useMoneySummary, useProgress, useToggleTask, useWorkouts } from '../lib/queries.js';
import { today, fmtLong, greeting, monthRange, weekOf, minutesOf, nowMinutes, fmtTime } from '../lib/dates.js';
import { firstName, compact, nf } from '../lib/format.js';
import { TaskRow } from '../components/TaskRow.jsx';
import { Ring, Empty, Skeleton, SectionTitle } from '../components/ui.jsx';

function Tile({ to, icon: Icon, tone, label, children, sub }) {
  return (
    <Link to={to} className="card flex flex-col gap-2.5 p-3.5 transition active:scale-[.97]">
      <div className="flex items-center justify-between">
        <span className="grid size-8 place-items-center rounded-xl" style={{ background: `${tone}1F`, color: tone }}>
          <Icon className="size-[17px]" />
        </span>
        <span className="text-[12px] font-medium text-muted">{label}</span>
      </div>
      <div>
        <div className="num font-display text-[24px] font-semibold leading-none">{children}</div>
        <p className="mt-1.5 text-[12.5px] text-muted">{sub}</p>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { open } = useSheets();
  const m = user.modules;
  const date = today();
  const tasksQ = useDayTasks(date);
  const toggle = useToggleTask(date);
  const profile = useDietProfile();
  const meals = useMeals(date);
  const { from, to } = monthRange(date);
  const money = useMoneySummary(from, to);
  const week = weekOf(date);
  const workouts = useWorkouts(week[0], week[6]);
  const streak = useProgress({ granularity: 'days', today: date, scope: 'all' });

  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, [0, 240], [1, 0.95]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0.6]);

  const tasks = tasksQ.data || [];
  const done = tasks.filter((t) => t.done).length;
  const frac = tasks.length ? done / tasks.length : 0;
  const nowMin = nowMinutes();
  const next = useMemo(() => tasks.filter((t) => !t.done && t.time && minutesOf(t.time) >= nowMin - 15).sort((a, b) => a.time.localeCompare(b.time))[0], [tasks, nowMin]);
  const eaten = (meals.data || []).reduce((a, x) => a + x.calories, 0);
  const target = profile.data?.target_calories;
  const pending = tasks.filter((t) => !t.done);

  return (
    <div>
      <motion.section style={{ scale, opacity }} className="relative overflow-hidden rounded-[28px] bg-[#0E1A2F] p-5 text-white shadow-lift dark:bg-[#18274A]">
        <svg className="pointer-events-none absolute -bottom-16 -left-10 size-56 opacity-[.07]" viewBox="0 0 200 200" fill="none" aria-hidden="true">
          <circle cx="100" cy="100" r="90" stroke="#fff" strokeWidth="14" />
        </svg>
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white/60">{fmtLong(date)}</p>
            <h2 className="mt-1 font-display text-[28px] font-semibold leading-[1.1]">
              {greeting()},<br />
              {firstName(user.name)}
            </h2>
            {m.tasks && (
              <p className="mt-3 text-[14px] text-white/75">
                {tasks.length === 0 ? 'No tasks today' : pending.length === 0 ? 'Everything is done. Well played.' : `${pending.length} left today`}
              </p>
            )}
          </div>
          {m.tasks && (
            <Ring value={frac} size={104} stroke={9} color="#D6A852" track="rgba(255,255,255,.14)">
              <div className="text-center">
                <p className="num font-display text-[26px] font-semibold leading-none">{done}<span className="text-[15px] text-white/50">/{tasks.length}</span></p>
                <p className="mt-0.5 text-[10.5px] font-medium text-white/60">done</p>
              </div>
            </Ring>
          )}
        </div>
        {next && (
          <button onClick={() => open('task', { task: next, date })} className="relative mt-4 flex w-full items-center gap-2.5 rounded-2xl bg-white/10 px-3.5 py-2.5 text-left backdrop-blur transition active:scale-[.98]">
            <BellRing className="size-4 shrink-0 text-[#D6A852]" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{next.title}</span>
            <span className="num shrink-0 text-[13px] font-semibold text-[#D6A852]">{fmtTime(next.time)}</span>
          </button>
        )}
      </motion.section>

      {m.tasks && (
        <>
          <SectionTitle right={<Link to="/tasks" className="flex items-center gap-1 text-[13px] font-semibold text-brand">All tasks <ArrowRight className="size-3.5" /></Link>}>Today</SectionTitle>
          {tasksQ.isLoading ? (
            <div className="space-y-2.5"><Skeleton className="h-[68px]" /><Skeleton className="h-[68px]" /></div>
          ) : tasks.length === 0 ? (
            <div className="card">
              <Empty icon={CalendarCheck} title="Nothing on the docket" text="Add a court date, a medicine or a workout for today." action={<button className="btn btn-primary" onClick={() => open('task', { date })}><Plus className="size-4" /> Add a task</button>} />
            </div>
          ) : (
            <div className="space-y-2.5">
              {tasks.slice(0, 6).map((t, i) => (
                <TaskRow key={t.id} task={t} index={i} onToggle={(v) => toggle.mutate({ id: t.id, done: v })} onOpen={() => open('task', { task: t, date })} />
              ))}
              {tasks.length > 6 && <Link to="/tasks" className="block py-1 text-center text-[13px] font-semibold text-muted">+{tasks.length - 6} more</Link>}
            </div>
          )}
        </>
      )}

      <SectionTitle>At a glance</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {m.tasks && (
          <Tile to="/progress" icon={Flame} tone="#F76B15" label="Streak" sub={`Best: ${streak.data?.tasks.streak.best ?? 0} days`}>
            {streak.data?.tasks.streak.current ?? 0} <span className="text-[14px] font-medium text-muted">days</span>
          </Tile>
        )}
        {m.diet && (
          <Tile to="/track/diet" icon={Utensils} tone="#30A46C" label="Calories" sub={target ? `${nf.format(Math.max(0, target - eaten))} left of ${nf.format(target)}` : 'Set up your plan'}>
            {nf.format(eaten)} <span className="text-[14px] font-medium text-muted">kcal</span>
          </Tile>
        )}
        {m.money && (
          <Tile to="/track/money" icon={Wallet} tone="#B7862F" label="This month" sub={`${compact(money.data?.income || 0, user.currency)} in · ${compact(money.data?.expense || 0, user.currency)} out`}>
            {compact(money.data?.net || 0, user.currency)}
          </Tile>
        )}
        {m.gym && (
          <Tile to="/track/gym" icon={Dumbbell} tone="#8E4EC6" label="This week" sub={`${(workouts.data || []).reduce((a, w) => a + w.duration_min, 0)} min trained`}>
            {workouts.data?.length ?? 0} <span className="text-[14px] font-medium text-muted">workouts</span>
          </Tile>
        )}
      </div>
    </div>
  );
}
