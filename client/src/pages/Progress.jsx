import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Area, AreaChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Flame, ListFilter, ChartNoAxesColumn, Utensils, Wallet, Dumbbell, CheckCheck } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useSheets } from '../lib/sheetsContext.js';
import { useProgress } from '../lib/queries.js';
import { useChartColors } from '../lib/theme.jsx';
import { today } from '../lib/dates.js';
import { compact, money, nf, nf1, pct } from '../lib/format.js';
import { Chip, Empty, ProgressBar, Reveal, Ring, Segmented, Skeleton, cx } from '../components/ui.jsx';

const GRANS = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
];
const RANGE_TEXT = { days: 'Last 14 days', weeks: 'Last 12 weeks', months: 'Last 12 months', years: 'Last 3 years' };
const PALETTE = ['#2B4BDB', '#30A46C', '#F76B15', '#B7862F', '#8E4EC6', '#E5484D', '#0091AD', '#6B778C'];

function Tip({ active, payload, rows }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-[12px] text-app shadow-lift">
      <p className="mb-0.5 font-semibold">{p.full}</p>
      {rows(p).map(([l, v]) => (
        <p key={l} className="num opacity-80">{l}: <span className="font-semibold opacity-100">{v}</span></p>
      ))}
    </div>
  );
}

const axis = (c) => ({ tickLine: false, axisLine: false, tick: { fill: c.muted, fontSize: 11 } });

function ChartCard({ title, sub, children, right, minHeight = 240 }) {
  return (
    <Reveal minHeight={minHeight}>
      <section className="card p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-[18px] font-semibold leading-tight">{title}</h3>
            {sub && <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p>}
          </div>
          {right}
        </div>
        {children}
      </section>
    </Reveal>
  );
}

function Stat({ icon: Icon, tone, label, value, sub }) {
  return (
    <div className="card p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg" style={{ background: `${tone}1F`, color: tone }}><Icon className="size-[15px]" /></span>
        <span className="text-[12px] font-medium text-muted">{label}</span>
      </div>
      <p className="num font-display text-[26px] font-semibold leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

function RateBar({ name, sub, color, rate, right, onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="block w-full text-left">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[14px] font-semibold">{name}</span>
        <span className="num shrink-0 text-[13px] font-semibold">{right ?? pct(rate)}</span>
      </div>
      <ProgressBar value={(rate || 0) / 100} color={color} height={7} />
      {sub && <p className="num mt-1 text-[11.5px] text-muted">{sub}</p>}
    </button>
  );
}

/* ---------------- Tasks ---------------- */
function TasksSection({ d, full, scope, setScope, gran }) {
  const c = useChartColors();
  const t = d.tasks;
  if (t.totals.scheduled === 0) {
    return <div className="card"><Empty icon={CheckCheck} title="No task history yet" text="Complete a few tasks and your streaks and completion charts will appear here." /></div>;
  }
  return (
    <>
      <ChartCard title="Completion" sub={`${pct(t.totals.rate)} overall · ${t.totals.done} of ${t.totals.scheduled} tasks done`}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={t.series} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 4" />
            <XAxis dataKey="label" {...axis(c)} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axis(c)} width={42} unit="%" />
            <Tooltip cursor={false} content={(p) => <Tip {...p} rows={(x) => [['Done', `${x.done} of ${x.scheduled}`], ['Rate', pct(x.rate)]]} />} />
            <Bar dataKey="rate" fill={c.brand} radius={8} maxBarSize={24} background={{ fill: c.track, radius: 8 }} animationDuration={900} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {full && scope.type === 'all' && t.byCategory.length > 0 && (
        <ChartCard title="By category" sub="Tap one to focus on it" minHeight={120}>
          <div className="space-y-4">
            {t.byCategory.map((x) => (
              <RateBar key={x.id} name={x.name} color={x.color} rate={x.rate} sub={`${x.done} of ${x.scheduled} done`} onClick={x.id ? () => setScope({ type: 'category', id: x.id, label: x.name }) : undefined} />
            ))}
          </div>
        </ChartCard>
      )}

      {full && scope.type !== 'task' && t.byTask.length > 0 && (
        <ChartCard title="Task by task" sub="Tap one to see only that task" minHeight={120}>
          <div className="space-y-4">
            {t.byTask.map((x) => (
              <RateBar key={x.id} name={x.title} color={x.color} rate={x.rate} sub={`${x.category || 'No category'} · ${x.done} of ${x.scheduled}`} onClick={() => setScope({ type: 'task', id: x.id, label: x.title })} />
            ))}
          </div>
        </ChartCard>
      )}
    </>
  );
}

/* ---------------- Diet ---------------- */
function DietSection({ d, full, gran }) {
  const c = useChartColors();
  const x = d.diet;
  const hasCal = x.daysLogged > 0;
  const w = x.weight;
  const wVals = w.series.map((s) => s.weight).filter((v) => v !== null);
  const wMin = Math.min(...wVals, w.goal ?? Infinity);
  const wMax = Math.max(...wVals, w.goal ?? -Infinity);
  const maxAvg = Math.max(...x.series.map((s) => s.avg || 0), x.target || 0);
  return (
    <>
      <ChartCard title="Calories" sub={hasCal ? `Average ${nf.format(x.avgCalories)} kcal on ${x.daysLogged} logged days${x.target ? ` · target ${nf.format(x.target)}` : ''}` : 'Log meals to see your intake'}>
        {hasCal ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={x.series} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 4" />
              <XAxis dataKey="label" {...axis(c)} interval="preserveStartEnd" />
              <YAxis domain={[0, Math.ceil((maxAvg * 1.15) / 500) * 500]} {...axis(c)} width={38} />
              <Tooltip cursor={false} content={(p) => <Tip {...p} rows={(s) => [['Average', s.avg ? `${nf.format(s.avg)} kcal` : '–'], ['Days logged', s.days]]} />} />
              {x.target && <ReferenceLine y={x.target} stroke={c.brass} strokeDasharray="5 4" strokeWidth={1.5} />}
              <Bar dataKey="avg" radius={8} maxBarSize={24} animationDuration={900}>
                {x.series.map((s, i) => (
                  <Cell key={i} fill={x.target && s.avg > x.target * 1.05 ? c.bad : c.good} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty icon={Utensils} title="No meals logged" text="Your calorie chart will fill in as you log meals." />
        )}
        {hasCal && x.target && <p className="mt-2 text-[12px] text-muted">Dashed line is your daily target. Bars turn red when the average runs over it.</p>}
      </ChartCard>

      {full && x.macros && (
        <ChartCard title="Average macros" sub="Per logged day" minHeight={140}>
          <div className="space-y-4">
            <RateBar name="Protein" color="#2B4BDB" rate={x.macroTargets ? (x.macros.protein / x.macroTargets.protein) * 100 : 0} right={`${x.macros.protein} g${x.macroTargets ? ` / ${x.macroTargets.protein}` : ''}`} />
            <RateBar name="Carbs" color="#F76B15" rate={x.macroTargets ? (x.macros.carbs / x.macroTargets.carbs) * 100 : 0} right={`${x.macros.carbs} g${x.macroTargets ? ` / ${x.macroTargets.carbs}` : ''}`} />
            <RateBar name="Fat" color="#B7862F" rate={x.macroTargets ? (x.macros.fat / x.macroTargets.fat) * 100 : 0} right={`${x.macros.fat} g${x.macroTargets ? ` / ${x.macroTargets.fat}` : ''}`} />
          </div>
        </ChartCard>
      )}

      {wVals.length > 0 && (
        <ChartCard title="Weight" sub={`${nf1.format(w.current)} kg now${w.goal ? ` · goal ${nf1.format(w.goal)} kg` : ''}${w.change !== null ? ` · ${w.change > 0 ? '+' : ''}${w.change} kg in this period` : ''}`}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={w.series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.brand} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={c.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 4" />
              <XAxis dataKey="label" {...axis(c)} interval="preserveStartEnd" />
              <YAxis domain={[Math.floor(wMin - 1), Math.ceil(wMax + 1)]} {...axis(c)} width={34} />
              <Tooltip cursor={{ stroke: c.grid }} content={(p) => <Tip {...p} rows={(s) => [['Weight', s.weight ? `${s.weight} kg` : '–']]} />} />
              {w.goal && <ReferenceLine y={w.goal} stroke={c.brass} strokeDasharray="5 4" strokeWidth={1.5} />}
              <Area type="monotone" dataKey="weight" stroke={c.brand} strokeWidth={2.5} fill="url(#wfill)" connectNulls dot={{ r: 3, fill: c.brand, strokeWidth: 0 }} activeDot={{ r: 5 }} animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  );
}

/* ---------------- Money ---------------- */
function MoneySection({ d, full, cur }) {
  const c = useChartColors();
  const m = d.money;
  const any = m.totals.income > 0 || m.totals.expense > 0;
  return (
    <>
      <ChartCard
        title="Income and expenses"
        sub={any ? `Net ${money(m.totals.net, cur)} · in ${money(m.totals.income, cur)} · out ${money(m.totals.expense, cur)}` : 'Add entries to see the flow of money'}
        right={any && (
          <div className="flex gap-3 pt-1 text-[11.5px] font-medium text-muted">
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: c.good }} />In</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: c.brass }} />Out</span>
          </div>
        )}
      >
        {any ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={m.series} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} barGap={3}>
              <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 4" />
              <XAxis dataKey="label" {...axis(c)} interval="preserveStartEnd" />
              <YAxis {...axis(c)} width={44} tickFormatter={(v) => compact(v, '')} />
              <Tooltip cursor={false} content={(p) => <Tip {...p} rows={(s) => [['Income', money(s.income, cur)], ['Expenses', money(s.expense, cur)]]} />} />
              <Bar dataKey="income" fill={c.good} radius={[7, 7, 2, 2]} maxBarSize={16} animationDuration={900} />
              <Bar dataKey="expense" fill={c.brass} radius={[7, 7, 2, 2]} maxBarSize={16} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty icon={Wallet} title="No money entries" text="Record income and expenses to see them here." />
        )}
      </ChartCard>

      {full && m.byCategory.length > 0 && (
        <ChartCard title="Where it goes" sub="Spending by category" minHeight={220}>
          <div className="flex items-center gap-4">
            <div className="size-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={m.byCategory} dataKey="total" nameKey="name" innerRadius={44} outerRadius={66} paddingAngle={3} cornerRadius={5} stroke="none" animationDuration={900}>
                    {m.byCategory.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {m.byCategory.slice(0, 6).map((x, i) => (
                <li key={x.name} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2"><i className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate font-medium">{x.name}</span></span>
                  <span className="num shrink-0 font-semibold text-muted">{compact(x.total, cur)}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      )}
    </>
  );
}

/* ---------------- Gym ---------------- */
function GymSection({ d }) {
  const c = useChartColors();
  const g = d.gym;
  return (
    <ChartCard title="Workouts" sub={g.totals.sessions ? `${g.totals.sessions} sessions on ${g.totals.activeDays} days · ${nf.format(g.totals.minutes)} min` : 'Log a workout to start your chart'}>
      {g.totals.sessions ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={g.series} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 4" />
            <XAxis dataKey="label" {...axis(c)} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} {...axis(c)} width={26} />
            <Tooltip cursor={false} content={(p) => <Tip {...p} rows={(s) => [['Sessions', s.sessions], ['Minutes', s.minutes]]} />} />
            <Bar dataKey="sessions" fill="#8E4EC6" radius={8} maxBarSize={24} animationDuration={900} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty icon={Dumbbell} title="No workouts yet" />
      )}
    </ChartCard>
  );
}

export default function Progress() {
  const { user } = useAuth();
  const { open } = useSheets();
  const m = user.modules;
  const [gran, setGran] = useState('weeks');
  const [tab, setTab] = useState('all');
  const [scope, setScope] = useState({ type: 'all' });

  const params = { granularity: gran, today: today(), scope: scope.type };
  if (scope.type !== 'all') params.id = scope.id;
  const q = useProgress(params);
  const d = q.data;

  const tabs = [
    { id: 'all', label: 'Overview' },
    m.tasks && { id: 'tasks', label: 'Tasks' },
    m.diet && { id: 'diet', label: 'Diet' },
    m.money && { id: 'money', label: 'Money' },
    m.gym && { id: 'gym', label: 'Gym' },
  ].filter(Boolean);
  const showScope = m.tasks && (tab === 'all' || tab === 'tasks');
  const show = (k) => m[k] && (tab === 'all' || tab === k);
  const full = tab !== 'all';

  return (
    <div className="space-y-4">
      <Segmented value={gran} onChange={setGran} options={GRANS} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {tabs.map((t) => (
          <Chip key={t.id} on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Chip>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[13px] font-medium text-muted">{RANGE_TEXT[gran]}</p>
        {showScope && (
          <button onClick={() => open('focus', { scope, onPick: setScope })} className={cx('flex max-w-[60%] items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition active:scale-95', scope.type === 'all' ? 'border-line bg-card text-muted' : 'border-brand bg-brand/10 text-brand')}>
            <ListFilter className="size-3.5 shrink-0" />
            <span className="truncate">{scope.type === 'all' ? 'All tasks' : scope.label}</span>
          </button>
        )}
      </div>

      {q.isLoading || !d ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      ) : (
        <>
          {tab === 'all' && (
            <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
              {m.tasks && <Stat icon={CheckCheck} tone="#2B4BDB" label="Completion" value={pct(d.tasks.totals.rate)} sub={`${d.tasks.totals.done} of ${d.tasks.totals.scheduled} tasks`} />}
              {m.tasks && <Stat icon={Flame} tone="#F76B15" label="Streak" value={`${d.tasks.streak.current}d`} sub={`Best ${d.tasks.streak.best} days`} />}
              {m.diet && <Stat icon={Utensils} tone="#30A46C" label="Avg calories" value={d.diet.avgCalories ? nf.format(d.diet.avgCalories) : '–'} sub={d.diet.target ? `Target ${nf.format(d.diet.target)}` : 'No plan yet'} />}
              {m.money && <Stat icon={Wallet} tone="#B7862F" label="Net money" value={compact(d.money.totals.net, user.currency)} sub={`In ${compact(d.money.totals.income, user.currency)}`} />}
              {m.gym && <Stat icon={Dumbbell} tone="#8E4EC6" label="Workouts" value={d.gym.totals.sessions} sub={`${nf.format(d.gym.totals.minutes)} min`} />}
            </div>
          )}
          {show('tasks') && <TasksSection d={d} full={full} scope={scope} setScope={setScope} gran={gran} />}
          {show('diet') && <DietSection d={d} full={full} gran={gran} />}
          {show('money') && <MoneySection d={d} full={full} cur={user.currency} />}
          {show('gym') && <GymSection d={d} />}
        </>
      )}
    </div>
  );
}
