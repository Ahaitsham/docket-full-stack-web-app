import { Router } from 'express';
import { many, one } from '../db.js';
import { requireAuth } from '../auth.js';
import { bad, date, oneOf, id, addDays, dayOfWeek, parseDate, toStr, pad, eachDate, isScheduled, round1 } from '../util.js';

const router = Router();
router.use(requireAuth);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildBuckets(gran, today) {
  const out = [];
  const [ty, tm] = today.split('-').map(Number);
  if (gran === 'days') {
    for (let i = 13; i >= 0; i--) {
      const s = addDays(today, -i);
      const d = parseDate(s);
      out.push({ start: s, end: s, label: String(d.getUTCDate()), full: `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` });
    }
  } else if (gran === 'weeks') {
    const monday = addDays(today, -((dayOfWeek(today) + 6) % 7));
    for (let i = 11; i >= 0; i--) {
      const s = addDays(monday, -7 * i);
      const e = addDays(s, 6);
      const ds = parseDate(s);
      const de = parseDate(e);
      out.push({
        start: s,
        end: e,
        label: `${ds.getUTCDate()} ${MONTHS[ds.getUTCMonth()]}`,
        full: `${ds.getUTCDate()} ${MONTHS[ds.getUTCMonth()]} – ${de.getUTCDate()} ${MONTHS[de.getUTCMonth()]}`,
      });
    }
  } else if (gran === 'months') {
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(Date.UTC(ty, tm - 1 - i, 1));
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth();
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      out.push({ start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(last)}`, label: MONTHS[m], full: `${MONTHS[m]} ${y}` });
    }
  } else {
    for (let i = 2; i >= 0; i--) {
      const y = ty - i;
      out.push({ start: `${y}-01-01`, end: `${y}-12-31`, label: String(y), full: String(y) });
    }
  }
  return out;
}

const pct = (done, total) => (total ? Math.round((done / total) * 100) : null);

router.get('/', async (req, res) => {
  const gran = oneOf(req.query.granularity, ['days', 'weeks', 'months', 'years'], 'Granularity', 'weeks');
  const today = date(req.query.today, 'Today');
  const scope = oneOf(req.query.scope, ['all', 'category', 'task'], 'Scope', 'all');
  const scopeId = scope === 'all' ? null : id(req.query.id);

  const buckets = buildBuckets(gran, today);
  const from = buckets[0].start;
  const bucketOf = new Map();
  buckets.forEach((b, i) => {
    for (const d of eachDate(b.start, b.end < today ? b.end : today)) bucketOf.set(d, i);
  });
  const extFrom = from < addDays(today, -400) ? from : addDays(today, -400); // extra history for streaks

  const [taskRows, logs, cats, meals, weights, profile, txs, workouts] = await Promise.all([
    many(`select t.*, c.name as category_name, c.color as category_color from tasks t left join categories c on c.id = t.category_id where t.user_id = $1 and t.start_date <= $2::date`, [req.uid, today]),
    many('select l.task_id, l.date from task_logs l join tasks t on t.id = l.task_id where t.user_id = $1 and l.date between $2::date and $3::date', [req.uid, extFrom, today]),
    many('select id, name, color, icon from categories where user_id = $1', [req.uid]),
    many('select date, sum(calories)::int as calories, sum(protein) as protein, sum(carbs) as carbs, sum(fat) as fat from meals where user_id = $1 and date between $2::date and $3::date group by date', [req.uid, from, today]),
    many('select date, weight_kg from weight_logs where user_id = $1 and date between $2::date and $3::date order by date', [req.uid, from, today]),
    one('select * from diet_profiles where user_id = $1', [req.uid]),
    many('select date, type, category, amount from transactions where user_id = $1 and date between $2::date and $3::date', [req.uid, from, today]),
    many('select date, duration_min from workouts where user_id = $1 and date between $2::date and $3::date', [req.uid, from, today]),
  ]);

  // ---------------- tasks ----------------
  let tasks = taskRows;
  if (scope === 'category') tasks = tasks.filter((t) => t.category_id === scopeId);
  if (scope === 'task') tasks = tasks.filter((t) => t.id === scopeId);
  if (scope !== 'all' && tasks.length === 0 && scope === 'task') throw bad('That task was not found');

  const done = new Set(logs.map((l) => `${l.task_id}|${l.date}`));
  const series = buckets.map((b) => ({ label: b.label, full: b.full, scheduled: 0, done: 0 }));
  const perTask = new Map(tasks.map((t) => [t.id, { id: t.id, title: t.title, category: t.category_name, color: t.category_color || '#6B778C', scheduled: 0, done: 0 }]));
  const perCat = new Map();
  const dayStats = new Map();

  for (const d of eachDate(extFrom, today)) {
    let s = 0;
    let dn = 0;
    for (const t of tasks) {
      if (!isScheduled(t, d)) continue;
      const isDone = done.has(`${t.id}|${d}`);
      s++;
      if (isDone) dn++;
      if (d >= from) {
        const pt = perTask.get(t.id);
        pt.scheduled++;
        if (isDone) pt.done++;
        const key = t.category_id ?? 0;
        if (!perCat.has(key)) perCat.set(key, { id: key, name: t.category_name || 'No category', color: t.category_color || '#6B778C', scheduled: 0, done: 0 });
        const pc = perCat.get(key);
        pc.scheduled++;
        if (isDone) pc.done++;
      }
    }
    dayStats.set(d, { s, dn });
    if (d >= from && s) {
      const b = series[bucketOf.get(d)];
      b.scheduled += s;
      b.done += dn;
    }
  }
  series.forEach((b) => (b.rate = pct(b.done, b.scheduled)));
  const totalS = series.reduce((a, b) => a + b.scheduled, 0);
  const totalD = series.reduce((a, b) => a + b.done, 0);

  // Streak = consecutive days on which every scheduled task was completed.
  let current = 0;
  let best = 0;
  let run = 0;
  for (const d of eachDate(extFrom, today)) {
    const st = dayStats.get(d);
    if (!st.s) continue;
    if (st.dn === st.s) {
      run++;
      best = Math.max(best, run);
    } else if (d !== today) run = 0;
  }
  {
    // walk back from today
    for (let d = today; d >= extFrom; d = addDays(d, -1)) {
      const st = dayStats.get(d);
      if (!st.s) continue;
      if (st.dn === st.s) current++;
      else if (d === today) continue;
      else break;
    }
  }

  const tasksOut = {
    series,
    totals: { scheduled: totalS, done: totalD, rate: pct(totalD, totalS) },
    byCategory: [...perCat.values()].map((c) => ({ ...c, rate: pct(c.done, c.scheduled) })).sort((a, b) => b.scheduled - a.scheduled),
    byTask: [...perTask.values()].filter((t) => t.scheduled > 0).map((t) => ({ ...t, rate: pct(t.done, t.scheduled) })).sort((a, b) => b.scheduled - a.scheduled).slice(0, 15),
    streak: { current, best },
  };

  // ---------------- diet ----------------
  const dietSeries = buckets.map((b) => ({ label: b.label, full: b.full, total: 0, days: 0, avg: null, target: profile?.target_calories ?? null }));
  const macro = { protein: 0, carbs: 0, fat: 0, days: 0 };
  for (const m of meals) {
    const b = dietSeries[bucketOf.get(m.date)];
    b.total += m.calories;
    b.days += 1;
    macro.protein += m.protein;
    macro.carbs += m.carbs;
    macro.fat += m.fat;
    macro.days += 1;
  }
  dietSeries.forEach((b) => (b.avg = b.days ? Math.round(b.total / b.days) : null));
  const loggedTotal = dietSeries.reduce((a, b) => a + b.total, 0);
  const weightSeries = buckets.map((b) => ({ label: b.label, full: b.full, weight: null }));
  for (const w of weights) weightSeries[bucketOf.get(w.date)].weight = w.weight_kg; // last one in each bucket wins
  const firstW = weights[0]?.weight_kg ?? null;
  const lastW = weights.length ? weights[weights.length - 1].weight_kg : null;

  const dietOut = {
    hasProfile: Boolean(profile),
    target: profile?.target_calories ?? null,
    maintenance: profile?.maintenance ?? null,
    series: dietSeries,
    avgCalories: macro.days ? Math.round(loggedTotal / macro.days) : null,
    daysLogged: macro.days,
    macros: macro.days ? { protein: Math.round(macro.protein / macro.days), carbs: Math.round(macro.carbs / macro.days), fat: Math.round(macro.fat / macro.days) } : null,
    macroTargets: profile ? { protein: profile.protein_g, carbs: profile.carbs_g, fat: profile.fat_g } : null,
    weight: {
      series: weightSeries,
      goal: profile?.goal_weight_kg ?? null,
      current: profile?.weight_kg ?? lastW,
      change: firstW !== null && lastW !== null ? round1(lastW - firstW) : null,
    },
  };

  // ---------------- money ----------------
  const moneySeries = buckets.map((b) => ({ label: b.label, full: b.full, income: 0, expense: 0 }));
  const expCat = new Map();
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    const b = moneySeries[bucketOf.get(t.date)];
    if (t.type === 'income') {
      b.income += t.amount;
      income += t.amount;
    } else {
      b.expense += t.amount;
      expense += t.amount;
      expCat.set(t.category, (expCat.get(t.category) || 0) + t.amount);
    }
  }
  const moneyOut = {
    series: moneySeries.map((b) => ({ ...b, income: Math.round(b.income), expense: Math.round(b.expense) })),
    totals: { income, expense, net: income - expense },
    byCategory: [...expCat.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 8),
  };

  // ---------------- gym ----------------
  const gymSeries = buckets.map((b) => ({ label: b.label, full: b.full, sessions: 0, minutes: 0 }));
  for (const w of workouts) {
    const b = gymSeries[bucketOf.get(w.date)];
    b.sessions += 1;
    b.minutes += w.duration_min;
  }
  const gymOut = {
    series: gymSeries,
    totals: { sessions: workouts.length, minutes: workouts.reduce((a, w) => a + w.duration_min, 0), activeDays: new Set(workouts.map((w) => w.date)).size },
  };

  res.json({ granularity: gran, range: { from, to: today }, scope, categories: cats, tasks: tasksOut, diet: dietOut, money: moneyOut, gym: gymOut });
});

export default router;
