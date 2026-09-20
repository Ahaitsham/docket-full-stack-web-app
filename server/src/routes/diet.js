import { Router } from 'express';
import { one, many, query } from '../db.js';
import { requireAuth } from '../auth.js';
import { reqStr, str, num, date, oneOf, id, notFound, bad, daysBetween, round1 } from '../util.js';

const router = Router();
router.use(requireAuth);

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 };
const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'];

// Mifflin-St Jeor BMR -> maintenance (TDEE) -> daily target for the chosen goal.
export function computeDiet(p) {
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  const bmr = Math.round(base + (p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78));
  const maintenance = Math.round(bmr * ACTIVITY[p.activity]);
  const delta = Math.round((p.weekly_rate * 7700) / 7); // ~7700 kcal per kg of body weight
  let target = p.goal === 'lose' ? maintenance - delta : p.goal === 'gain' ? maintenance + delta : maintenance;
  if (p.goal === 'lose') target = Math.max(target, p.sex === 'male' ? 1500 : 1200);
  target = Math.round(target / 10) * 10;
  const protein_g = Math.round(p.weight_kg * 1.8);
  const fat_g = Math.round((target * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((target - protein_g * 4 - fat_g * 9) / 4));
  return { bmr, maintenance, target_calories: target, protein_g, carbs_g, fat_g };
}

async function saveProfile(uid, p) {
  const d = computeDiet(p);
  return one(
    `insert into diet_profiles (user_id, sex, age, height_cm, weight_kg, goal_weight_kg, activity, goal, weekly_rate, bmr, maintenance, target_calories, protein_g, carbs_g, fat_g, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
     on conflict (user_id) do update set sex=$2, age=$3, height_cm=$4, weight_kg=$5, goal_weight_kg=$6, activity=$7, goal=$8, weekly_rate=$9,
       bmr=$10, maintenance=$11, target_calories=$12, protein_g=$13, carbs_g=$14, fat_g=$15, updated_at=now()
     returning *`,
    [uid, p.sex, p.age, p.height_cm, p.weight_kg, p.goal_weight_kg, p.activity, p.goal, p.weekly_rate, d.bmr, d.maintenance, d.target_calories, d.protein_g, d.carbs_g, d.fat_g]
  );
}

// ---------- profile ----------
router.get('/profile', async (req, res) => {
  res.json({ profile: await one('select * from diet_profiles where user_id = $1', [req.uid]) });
});

router.put('/profile', async (req, res) => {
  const b = req.body;
  const p = {
    sex: oneOf(b.sex, ['male', 'female', 'other'], 'Sex'),
    age: Math.round(num(b.age, 'Age', { min: 14, max: 100 })),
    height_cm: num(b.height_cm, 'Height', { min: 100, max: 250 }),
    weight_kg: num(b.weight_kg, 'Current weight', { min: 30, max: 300 }),
    goal_weight_kg: num(b.goal_weight_kg, 'Goal weight', { min: 30, max: 300 }),
    activity: oneOf(b.activity, Object.keys(ACTIVITY), 'Activity level'),
    goal: oneOf(b.goal, ['lose', 'maintain', 'gain'], 'Goal'),
    weekly_rate: num(b.weekly_rate ?? 0.5, 'Weekly pace', { min: 0.1, max: 1.5 }),
  };
  const profile = await saveProfile(req.uid, p);
  if (b.date) {
    await query(
      'insert into weight_logs (user_id, date, weight_kg) values ($1,$2,$3) on conflict (user_id, date) do update set weight_kg = excluded.weight_kg',
      [req.uid, date(b.date), p.weight_kg]
    );
  }
  res.json({ profile });
});

// ---------- weight ----------
router.get('/weights', async (req, res) => {
  res.json(await many('select id, date, weight_kg from weight_logs where user_id = $1 order by date desc limit 400', [req.uid]));
});

router.post('/weights', async (req, res) => {
  const d = date(req.body.date);
  const w = round1(num(req.body.weight_kg, 'Weight', { min: 30, max: 300 }));
  const row = await one(
    'insert into weight_logs (user_id, date, weight_kg) values ($1,$2,$3) on conflict (user_id, date) do update set weight_kg = excluded.weight_kg returning id, date, weight_kg',
    [req.uid, d, w]
  );
  // If this is the newest entry, it becomes the "current weight" and targets are recalculated.
  const latest = await one('select date, weight_kg from weight_logs where user_id = $1 order by date desc limit 1', [req.uid]);
  const profile = await one('select * from diet_profiles where user_id = $1', [req.uid]);
  if (profile && latest) await saveProfile(req.uid, { ...profile, weight_kg: latest.weight_kg });
  res.status(201).json(row);
});

router.delete('/weights/:id', async (req, res) => {
  const r = await query('delete from weight_logs where id = $1 and user_id = $2', [id(req.params.id), req.uid]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
});

// ---------- meals ----------
function normalizeMeal(b) {
  return {
    date: date(b.date),
    meal_type: oneOf(b.meal_type, MEAL_TYPES, 'Meal type', 'snack'),
    name: reqStr(b.name, 'Food name', 120),
    servings: num(b.servings ?? 1, 'Servings', { min: 0.05, max: 100 }),
    calories: Math.round(num(b.calories, 'Calories', { min: 0, max: 10000 })),
    protein: round1(num(b.protein ?? 0, 'Protein', { min: 0, max: 1000 })),
    carbs: round1(num(b.carbs ?? 0, 'Carbs', { min: 0, max: 2000 })),
    fat: round1(num(b.fat ?? 0, 'Fat', { min: 0, max: 1000 })),
  };
}

router.get('/meals', async (req, res) => {
  const d = date(req.query.date);
  res.json(await many('select * from meals where user_id = $1 and date = $2::date order by created_at', [req.uid, d]));
});

router.post('/meals', async (req, res) => {
  const m = normalizeMeal(req.body);
  const row = await one(
    'insert into meals (user_id, date, meal_type, name, servings, calories, protein, carbs, fat) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',
    [req.uid, m.date, m.meal_type, m.name, m.servings, m.calories, m.protein, m.carbs, m.fat]
  );
  res.status(201).json(row);
});

router.patch('/meals/:id', async (req, res) => {
  const mid = id(req.params.id);
  const cur = await one('select * from meals where id = $1 and user_id = $2', [mid, req.uid]);
  if (!cur) throw notFound();
  const m = normalizeMeal({ ...cur, ...req.body });
  const row = await one(
    'update meals set date=$1, meal_type=$2, name=$3, servings=$4, calories=$5, protein=$6, carbs=$7, fat=$8 where id=$9 returning *',
    [m.date, m.meal_type, m.name, m.servings, m.calories, m.protein, m.carbs, m.fat, mid]
  );
  res.json(row);
});

router.delete('/meals/:id', async (req, res) => {
  const r = await query('delete from meals where id = $1 and user_id = $2', [id(req.params.id), req.uid]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
});

// Daily totals over a range
router.get('/daily', async (req, res) => {
  const from = date(req.query.from, 'From');
  const to = date(req.query.to, 'To');
  if (to < from || daysBetween(from, to) > 120) throw bad('Range must be 120 days or less');
  res.json(
    await many(
      `select date, sum(calories)::int as calories, sum(protein) as protein, sum(carbs) as carbs, sum(fat) as fat
       from meals where user_id = $1 and date between $2::date and $3::date group by date order by date`,
      [req.uid, from, to]
    )
  );
});

// ---------- saved foods ----------
router.get('/foods', async (req, res) => {
  res.json(await many('select * from foods where user_id = $1 order by name', [req.uid]));
});

router.post('/foods', async (req, res) => {
  const b = req.body;
  const row = await one(
    'insert into foods (user_id, name, serving, calories, protein, carbs, fat) values ($1,$2,$3,$4,$5,$6,$7) returning *',
    [
      req.uid,
      reqStr(b.name, 'Food name', 120),
      str(b.serving, 60) || '1 serving',
      Math.round(num(b.calories, 'Calories', { min: 0, max: 10000 })),
      round1(num(b.protein ?? 0, 'Protein', { min: 0, max: 1000 })),
      round1(num(b.carbs ?? 0, 'Carbs', { min: 0, max: 2000 })),
      round1(num(b.fat ?? 0, 'Fat', { min: 0, max: 1000 })),
    ]
  );
  res.status(201).json(row);
});

router.delete('/foods/:id', async (req, res) => {
  const r = await query('delete from foods where id = $1 and user_id = $2', [id(req.params.id), req.uid]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
});

export default router;
