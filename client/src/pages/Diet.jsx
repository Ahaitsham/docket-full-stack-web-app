import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Scale, Pencil, Target, Sparkles } from 'lucide-react';
import { useSheets } from '../lib/sheetsContext.js';
import { useDietProfile, useMeals, useWeights } from '../lib/queries.js';
import { today, addDays, relativeDay } from '../lib/dates.js';
import { MEAL_TYPES, weeksToGoal } from '../lib/diet.js';
import { nf, nf1 } from '../lib/format.js';
import { Ring, ProgressBar, Skeleton, SectionTitle, cx } from '../components/ui.jsx';

function Macro({ label, value, target, color }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="num mb-1.5 text-[13px] font-semibold">
        {Math.round(value)}
        {target ? <span className="text-muted"> / {target}g</span> : 'g'}
      </p>
      <ProgressBar value={target ? value / target : 0} color={color} height={5} />
    </div>
  );
}

export default function Diet() {
  const { open } = useSheets();
  const [date, setDate] = useState(today());
  const profile = useDietProfile();
  const meals = useMeals(date);
  const weights = useWeights();

  const p = profile.data;
  const list = meals.data || [];
  const sum = useMemo(
    () => list.reduce((a, m) => ({ cal: a.cal + m.calories, p: a.p + m.protein, c: a.c + m.carbs, f: a.f + m.fat }), { cal: 0, p: 0, c: 0, f: 0 }),
    [list]
  );
  const target = p?.target_calories || 0;
  const left = target - sum.cal;
  const over = target > 0 && left < 0;

  // weight journey: from first logged weight to goal
  const logs = weights.data || [];
  const start = logs.length ? logs[logs.length - 1].weight_kg : p?.weight_kg;
  let journey = 0;
  if (p && start !== p.goal_weight_kg) journey = Math.max(0, Math.min(1, (start - p.weight_kg) / (start - p.goal_weight_kg)));
  if (p?.goal === 'maintain') journey = 1;
  const weeks = p ? weeksToGoal(p) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} className="grid size-10 place-items-center rounded-full bg-card text-muted shadow-card active:scale-90"><ChevronLeft className="size-5" /></button>
        <div className="text-center">
          <p className="font-display text-[20px] font-semibold">{relativeDay(date)}</p>
          {date !== today() && <button onClick={() => setDate(today())} className="text-[12px] font-semibold text-brand">Back to today</button>}
        </div>
        <button aria-label="Next day" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} className="grid size-10 place-items-center rounded-full bg-card text-muted shadow-card active:scale-90 disabled:opacity-30"><ChevronRight className="size-5" /></button>
      </div>

      {profile.isLoading ? (
        <Skeleton className="h-48" />
      ) : !p ? (
        <div className="card overflow-hidden p-5">
          <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-good/10 text-good"><Sparkles className="size-6" /></div>
          <h3 className="font-display text-[21px] font-semibold leading-tight">Build your calorie plan</h3>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">Enter your height, weight and goal. Docket works out your BMR, maintenance calories and a daily target.</p>
          <button className="btn btn-primary mt-4 w-full" onClick={() => open('profile', {})}>Set up my plan</button>
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <Ring value={target ? sum.cal / target : 0} size={128} stroke={12} color={over ? 'rgb(var(--bad))' : 'rgb(var(--good))'}>
              <div className="text-center">
                <p className="num font-display text-[28px] font-semibold leading-none">{nf.format(Math.abs(left))}</p>
                <p className="mt-1 text-[11.5px] font-medium text-muted">{over ? 'kcal over' : 'kcal left'}</p>
              </div>
            </Ring>
            <div className="grid flex-1 grid-cols-1 gap-2.5">
              {[
                ['Target', nf.format(target)],
                ['Eaten', nf.format(sum.cal)],
                ['Maintenance', nf.format(p.maintenance)],
              ].map(([l, v]) => (
                <div key={l} className="flex items-baseline justify-between border-b border-line/60 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-[13px] text-muted">{l}</span>
                  <span className="num text-[15px] font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3.5 border-t border-line/60 pt-4">
            <Macro label="Protein" value={sum.p} target={p.protein_g} color="#2B4BDB" />
            <Macro label="Carbs" value={sum.c} target={p.carbs_g} color="#F76B15" />
            <Macro label="Fat" value={sum.f} target={p.fat_g} color="#B7862F" />
          </div>
        </div>
      )}

      {p && (
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['BMR', p.bmr], ['Maintenance', p.maintenance], ['Daily target', p.target_calories]].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-app py-2.5">
                <p className="num font-display text-[20px] font-semibold leading-none">{nf.format(v)}</p>
                <p className="mt-1 text-[11.5px] text-muted">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[12px] font-medium text-muted">Current weight</p>
              <p className="num font-display text-[26px] font-semibold leading-none">{nf1.format(p.weight_kg)}<span className="text-[14px] text-muted"> kg</span></p>
            </div>
            <Target className="mb-1 size-5 text-muted" />
            <div className="text-right">
              <p className="text-[12px] font-medium text-muted">Goal</p>
              <p className="num font-display text-[26px] font-semibold leading-none">{nf1.format(p.goal_weight_kg)}<span className="text-[14px] text-muted"> kg</span></p>
            </div>
          </div>
          <ProgressBar value={journey} color="rgb(var(--brass))" height={8} className="mt-3" />
          <p className="mt-2 text-[12.5px] text-muted">
            {p.goal === 'maintain' ? 'Maintaining your weight' : journey >= 1 ? 'Goal reached. Well done.' : `${nf1.format(Math.abs(p.weight_kg - p.goal_weight_kg))} kg to go${weeks ? ` · about ${weeks} weeks at ${p.weekly_rate} kg a week` : ''}`}
          </p>
          <div className="mt-3.5 flex gap-2.5">
            <button className="btn btn-soft flex-1" onClick={() => open('weight', { current: p.weight_kg })}><Scale className="size-4" /> Log weight</button>
            <button className="btn btn-ghost flex-1 border border-line" onClick={() => open('profile', { profile: p })}><Pencil className="size-4" /> Edit plan</button>
          </div>
        </div>
      )}

      <SectionTitle>Meals</SectionTitle>
      <div className="space-y-3">
        {MEAL_TYPES.map((t) => {
          const items = list.filter((m) => m.meal_type === t.id);
          const sub = items.reduce((a, m) => a + m.calories, 0);
          return (
            <motion.section key={t.id} layout className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-app text-lg">{t.emoji}</span>
                  <div>
                    <p className="text-[15px] font-semibold leading-tight">{t.label}</p>
                    <p className="num text-[12px] text-muted">{items.length ? `${nf.format(sub)} kcal` : 'Nothing logged'}</p>
                  </div>
                </div>
                <button aria-label={`Add to ${t.label}`} onClick={() => open('meal', { date, mealType: t.id })} className="grid size-9 place-items-center rounded-full bg-brand/10 text-brand transition active:scale-90"><Plus className="size-[18px]" /></button>
              </div>
              {items.map((m) => (
                <button key={m.id} onClick={() => open('meal', { meal: m })} className={cx('flex w-full items-center justify-between gap-3 border-t border-line/60 px-4 py-2.5 text-left active:bg-app')}>
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium">{m.name}</span>
                    <span className="num text-[12px] text-muted">{m.servings !== 1 ? `${m.servings} × · ` : ''}P {Math.round(m.protein)} · C {Math.round(m.carbs)} · F {Math.round(m.fat)}</span>
                  </span>
                  <span className="num shrink-0 text-[14.5px] font-semibold">{nf.format(m.calories)}</span>
                </button>
              ))}
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
