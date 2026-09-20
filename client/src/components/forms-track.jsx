import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, Trash2, Plus, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFoods, useRefresh } from '../lib/queries.js';
import { useToast } from '../lib/toast.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useSheets } from '../lib/sheetsContext.js';
import { today } from '../lib/dates.js';
import { BUILT_IN_FOODS } from '../lib/foods.js';
import { MEAL_TYPES, mealTypeNow, ACTIVITY, computeDiet, weeksToGoal } from '../lib/diet.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/categories.js';
import { nf } from '../lib/format.js';
import { Sheet, Field, Chip, Segmented, Stepper, ErrorNote, cx } from './ui.jsx';

const n = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));
const r1 = (v) => Math.round(v * 10) / 10;

/* ================= Meal ================= */
export function MealSheet({ open, close, meal, date, mealType }) {
  const refresh = useRefresh();
  const toast = useToast();
  const { confirm } = useSheets();
  const foods = useFoods();
  const editing = Boolean(meal);
  const s0 = meal?.servings || 1;
  const [f, setF] = useState({
    name: meal?.name || '',
    date: meal?.date || date || today(),
    meal_type: meal?.meal_type || mealType || mealTypeNow(),
    servings: s0,
    calories: meal ? String(Math.round(meal.calories / s0)) : '',
    protein: meal ? String(r1(meal.protein / s0)) : '',
    carbs: meal ? String(r1(meal.carbs / s0)) : '',
    fat: meal ? String(r1(meal.fat / s0)) : '',
    serving: '1 serving',
    saveFood: false,
  });
  const [q, setQ] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const results = useMemo(() => {
    const all = [...(foods.data || []), ...BUILT_IN_FOODS];
    const needle = q.trim().toLowerCase();
    if (!needle) return (foods.data || []).slice(0, 6);
    return all.filter((x) => x.name.toLowerCase().includes(needle)).slice(0, 7);
  }, [q, foods.data]);

  const pick = (x) => {
    setF((s) => ({ ...s, name: x.name, serving: x.serving, calories: String(x.calories), protein: String(x.protein), carbs: String(x.carbs), fat: String(x.fat), servings: 1 }));
    setQ('');
  };

  const total = {
    calories: Math.round(n(f.calories) * f.servings),
    protein: r1(n(f.protein) * f.servings),
    carbs: r1(n(f.carbs) * f.servings),
    fat: r1(n(f.fat) * f.servings),
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = { date: f.date, meal_type: f.meal_type, name: f.name, servings: f.servings, ...total };
      if (f.saveFood && !editing) {
        await api.post('/diet/foods', { name: f.name, serving: f.serving, calories: n(f.calories), protein: n(f.protein), carbs: n(f.carbs), fat: n(f.fat) });
      }
      return editing ? api.patch(`/diet/meals/${meal.id}`, body) : api.post('/diet/meals', body);
    },
    onSuccess: () => {
      refresh('diet');
      toast.success(editing ? 'Meal updated' : `${total.calories} kcal logged`);
      close();
    },
  });

  const remove = async () => {
    if (!(await confirm({ title: 'Remove this meal?', confirmLabel: 'Remove', danger: true }))) return;
    await api.del(`/diet/meals/${meal.id}`);
    refresh('diet');
    close();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={editing ? 'Edit meal' : 'Log a meal'}
      tall
      footer={
        <div className="flex items-center gap-2.5">
          {editing && (
            <button className="btn btn-danger" onClick={remove} aria-label="Delete meal">
              <Trash2 className="size-[18px]" />
            </button>
          )}
          <button className="btn btn-primary flex-1" disabled={!f.name.trim() || f.calories === '' || save.isPending} onClick={() => save.mutate()}>
            Add {nf.format(total.calories)} kcal
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((m) => (
            <Chip key={m.id} on={f.meal_type === m.id} onClick={() => set('meal_type', m.id)}>
              <span>{m.emoji}</span>
              {m.label}
            </Chip>
          ))}
        </div>

        {!editing && (
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
              <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search food: roti, dal, paneer…" />
            </div>
            {results.length > 0 && (
              <div className="mt-2 divide-y divide-line/70 overflow-hidden rounded-2xl border border-line">
                {results.map((x) => (
                  <button key={x.id} type="button" onClick={() => pick(x)} className="flex w-full items-center justify-between gap-3 bg-card px-3.5 py-2.5 text-left active:bg-app">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{x.name}</span>
                      <span className="text-[12px] text-muted">{x.serving}</span>
                    </span>
                    <span className="num shrink-0 text-[14px] font-semibold text-muted">{x.calories} kcal</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Field label="Food">
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="What did you eat?" maxLength={120} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories / serving">
            <input className="input num" type="number" inputMode="decimal" min="0" value={f.calories} onChange={(e) => set('calories', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Servings">
            <Stepper value={f.servings} onChange={(v) => set('servings', v)} step={0.5} min={0.5} />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            ['protein', 'Protein g'],
            ['carbs', 'Carbs g'],
            ['fat', 'Fat g'],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <input className="input num" type="number" inputMode="decimal" min="0" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder="0" />
            </Field>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-brand/10 px-4 py-3">
          <span className="text-[14px] font-medium text-brand">Total</span>
          <span className="num text-[15px] font-semibold text-brand">
            {nf.format(total.calories)} kcal · P {total.protein} · C {total.carbs} · F {total.fat}
          </span>
        </div>

        <Field label="Date">
          <input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </Field>

        {!editing && (
          <label className="flex items-center gap-2.5 text-[14px] font-medium text-muted">
            <input type="checkbox" className="size-[18px] accent-[rgb(var(--brand))]" checked={f.saveFood} onChange={(e) => set('saveFood', e.target.checked)} />
            Save to my foods for next time
          </label>
        )}
        <ErrorNote error={save.error} />
      </div>
    </Sheet>
  );
}

/* ================= Weight ================= */
export function WeightSheet({ open, close, current }) {
  const refresh = useRefresh();
  const toast = useToast();
  const [w, setW] = useState(current ? String(current) : '');
  const [d, setD] = useState(today());
  const save = useMutation({
    mutationFn: () => api.post('/diet/weights', { date: d, weight_kg: Number(w) }),
    onSuccess: () => {
      refresh('diet');
      toast.success('Weight logged');
      close();
    },
  });
  return (
    <Sheet open={open} onClose={close} title="Log weight" footer={<button className="btn btn-primary w-full" disabled={!w || save.isPending} onClick={() => save.mutate()}>Save weight</button>}>
      <div className="space-y-4">
        <Field label="Weight (kg)">
          <input className="input num text-[22px] font-semibold" type="number" inputMode="decimal" step="0.1" autoFocus value={w} onChange={(e) => setW(e.target.value)} placeholder="0.0" />
        </Field>
        <Field label="Date">
          <input type="date" className="input" value={d} max={today()} onChange={(e) => setD(e.target.value)} />
        </Field>
        <p className="text-[13px] text-muted">Your newest weight becomes your current weight, and your calorie target is recalculated.</p>
        <ErrorNote error={save.error} />
      </div>
    </Sheet>
  );
}

/* ================= Diet plan ================= */
export function ProfileSheet({ open, close, profile }) {
  const refresh = useRefresh();
  const toast = useToast();
  const [f, setF] = useState({
    sex: profile?.sex || 'male',
    age: profile ? String(profile.age) : '',
    height_cm: profile ? String(profile.height_cm) : '',
    weight_kg: profile ? String(profile.weight_kg) : '',
    goal_weight_kg: profile ? String(profile.goal_weight_kg) : '',
    activity: profile?.activity || 'light',
    goal: profile?.goal || 'lose',
    weekly_rate: profile?.weekly_rate || 0.5,
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const num = { ...f, age: n(f.age), height_cm: n(f.height_cm), weight_kg: n(f.weight_kg), goal_weight_kg: n(f.goal_weight_kg) };
  const ready = num.age >= 14 && num.height_cm >= 100 && num.weight_kg >= 30 && num.goal_weight_kg >= 30;
  const calc = ready ? computeDiet(num) : null;
  const weeks = ready ? weeksToGoal(num) : null;

  const save = useMutation({
    mutationFn: () => api.put('/diet/profile', { ...num, date: today() }),
    onSuccess: () => {
      refresh('diet');
      toast.success('Diet plan saved');
      close();
    },
  });

  return (
    <Sheet open={open} onClose={close} title="Your diet plan" tall footer={<button className="btn btn-primary w-full" disabled={!ready || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save plan'}</button>}>
      <div className="space-y-4">
        <Segmented value={f.sex} onChange={(v) => set('sex', v)} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <input className="input num" type="number" inputMode="numeric" value={f.age} onChange={(e) => set('age', e.target.value)} placeholder="years" />
          </Field>
          <Field label="Height (cm)">
            <input className="input num" type="number" inputMode="decimal" value={f.height_cm} onChange={(e) => set('height_cm', e.target.value)} placeholder="cm" />
          </Field>
          <Field label="Current weight (kg)">
            <input className="input num" type="number" inputMode="decimal" step="0.1" value={f.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} placeholder="kg" />
          </Field>
          <Field label="Goal weight (kg)">
            <input className="input num" type="number" inputMode="decimal" step="0.1" value={f.goal_weight_kg} onChange={(e) => set('goal_weight_kg', e.target.value)} placeholder="kg" />
          </Field>
        </div>

        <Field label="Daily activity">
          <div className="space-y-2">
            {Object.entries(ACTIVITY).map(([k, a]) => (
              <button key={k} type="button" onClick={() => set('activity', k)} className={cx('flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition active:scale-[.99]', f.activity === k ? 'border-brand bg-brand/5' : 'border-line')}>
                <span>
                  <span className="block text-[15px] font-semibold">{a.label}</span>
                  <span className="text-[12px] text-muted">{a.hint}</span>
                </span>
                <span className={cx('size-4 rounded-full border-2', f.activity === k ? 'border-brand bg-brand' : 'border-line')} />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Goal">
          <Segmented value={f.goal} onChange={(v) => set('goal', v)} options={[{ value: 'lose', label: 'Lose weight' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Gain' }]} />
        </Field>
        {f.goal !== 'maintain' && (
          <Field label="Pace per week">
            <div className="flex gap-2">
              {[0.25, 0.5, 0.75, 1].map((r) => (
                <Chip key={r} on={f.weekly_rate === r} onClick={() => set('weekly_rate', r)}>
                  {r} kg
                </Chip>
              ))}
            </div>
          </Field>
        )}

        {calc && (
          <div className="rounded-2xl bg-ink p-4 text-app">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ['BMR', calc.bmr],
                ['Maintenance', calc.maintenance],
                ['Daily target', calc.target],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="num font-display text-[24px] font-semibold leading-none">{nf.format(v)}</p>
                  <p className="mt-1 text-[12px] opacity-70">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-app/15 pt-3 text-center text-[12.5px] opacity-80">
              kcal per day{weeks ? ` · about ${weeks} weeks to reach ${num.goal_weight_kg} kg` : ''}
            </p>
          </div>
        )}
        <ErrorNote error={save.error} />
      </div>
    </Sheet>
  );
}

/* ================= Money ================= */
export function TxSheet({ open, close, tx, type: initialType }) {
  const { user } = useAuth();
  const refresh = useRefresh();
  const toast = useToast();
  const { confirm } = useSheets();
  const editing = Boolean(tx);
  const [f, setF] = useState({
    type: tx?.type || initialType || 'expense',
    amount: tx ? String(tx.amount) : '',
    category: tx?.category || '',
    date: tx?.date || today(),
    note: tx?.note || '',
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const cats = f.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, amount: Number(f.amount), category: f.category || 'Other' };
      return editing ? api.patch(`/money/transactions/${tx.id}`, body) : api.post('/money/transactions', body);
    },
    onSuccess: () => {
      refresh('money');
      toast.success(f.type === 'income' ? 'Income added' : 'Expense added');
      close();
    },
  });
  const remove = async () => {
    if (!(await confirm({ title: 'Delete this entry?', confirmLabel: 'Delete', danger: true }))) return;
    await api.del(`/money/transactions/${tx.id}`);
    refresh('money');
    close();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={editing ? 'Edit entry' : 'Add money entry'}
      footer={
        <div className="flex gap-2.5">
          {editing && (
            <button className="btn btn-danger" onClick={remove} aria-label="Delete entry">
              <Trash2 className="size-[18px]" />
            </button>
          )}
          <button className="btn btn-primary flex-1" disabled={!(Number(f.amount) > 0) || save.isPending} onClick={() => save.mutate()}>
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented value={f.type} onChange={(v) => setF((s) => ({ ...s, type: v, category: '' }))} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
        <Field label="Amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-xl text-muted">{user.currency}</span>
            <input className="input num pl-9 font-display text-[26px] font-semibold" type="number" inputMode="decimal" min="0" autoFocus={!editing} value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0" />
          </div>
        </Field>
        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <Chip key={c} on={f.category === c} onClick={() => set('category', c)}>
                {c}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Note">
            <input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Optional" maxLength={300} />
          </Field>
        </div>
        <ErrorNote error={save.error} />
      </div>
    </Sheet>
  );
}

/* ================= Workout ================= */
const WORKOUT_IDEAS = ['Push', 'Pull', 'Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Cardio', 'Full body', 'Yoga'];

export function WorkoutSheet({ open, close, workout, date }) {
  const refresh = useRefresh();
  const toast = useToast();
  const { confirm } = useSheets();
  const editing = Boolean(workout);
  const [f, setF] = useState({
    name: workout?.name || '',
    date: workout?.date || date || today(),
    duration_min: workout ? String(workout.duration_min || '') : '',
    notes: workout?.notes || '',
    exercises: workout?.exercises?.length ? workout.exercises.map((e) => ({ ...e })) : [{ name: '', sets: '', reps: '', weight: '' }],
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setEx = (i, k, v) => set('exercises', f.exercises.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, duration_min: n(f.duration_min), exercises: f.exercises.filter((e) => e.name.trim()).map((e) => ({ name: e.name, sets: n(e.sets), reps: n(e.reps), weight: n(e.weight) })) };
      return editing ? api.patch(`/gym/workouts/${workout.id}`, body) : api.post('/gym/workouts', body);
    },
    onSuccess: () => {
      refresh('gym');
      toast.success('Workout saved');
      close();
    },
  });
  const remove = async () => {
    if (!(await confirm({ title: 'Delete this workout?', confirmLabel: 'Delete', danger: true }))) return;
    await api.del(`/gym/workouts/${workout.id}`);
    refresh('gym');
    close();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={editing ? 'Edit workout' : 'Log workout'}
      tall
      footer={
        <div className="flex gap-2.5">
          {editing && (
            <button className="btn btn-danger" onClick={remove} aria-label="Delete workout">
              <Trash2 className="size-[18px]" />
            </button>
          )}
          <button className="btn btn-primary flex-1" disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()}>
            Save workout
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Workout">
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Chest day" maxLength={80} />
          <div className="mt-2 flex flex-wrap gap-2">
            {WORKOUT_IDEAS.map((w) => (
              <Chip key={w} on={f.name === w} onClick={() => set('name', w)}>
                {w}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Duration (min)">
            <input className="input num" type="number" inputMode="numeric" value={f.duration_min} onChange={(e) => set('duration_min', e.target.value)} placeholder="45" />
          </Field>
        </div>

        <div>
          <p className="label">Exercises</p>
          <div className="space-y-2.5">
            {f.exercises.map((e, i) => (
              <div key={i} className="rounded-2xl border border-line p-2.5">
                <div className="flex items-center gap-2">
                  <input className="input" value={e.name} onChange={(ev) => setEx(i, 'name', ev.target.value)} placeholder="Exercise" maxLength={80} />
                  {f.exercises.length > 1 && (
                    <button type="button" aria-label="Remove exercise" onClick={() => set('exercises', f.exercises.filter((_, j) => j !== i))} className="grid size-9 shrink-0 place-items-center rounded-full text-muted active:scale-90">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    ['sets', 'Sets'],
                    ['reps', 'Reps'],
                    ['weight', 'kg'],
                  ].map(([k, l]) => (
                    <input key={k} className="input num text-center" type="number" inputMode="decimal" min="0" value={e[k]} onChange={(ev) => setEx(i, k, ev.target.value)} placeholder={l} aria-label={l} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-soft mt-2.5 w-full" onClick={() => set('exercises', [...f.exercises, { name: '', sets: '', reps: '', weight: '' }])}>
            <Plus className="size-4" /> Add exercise
          </button>
        </div>

        <Field label="Notes">
          <textarea className="input" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="How did it feel?" maxLength={500} />
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Sheet>
  );
}
