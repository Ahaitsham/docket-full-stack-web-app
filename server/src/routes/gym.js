import { Router } from 'express';
import { one, many, query } from '../db.js';
import { requireAuth } from '../auth.js';
import { reqStr, str, num, date, id, notFound, bad, daysBetween } from '../util.js';

const router = Router();
router.use(requireAuth);

function cleanExercises(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).map((e) => ({
    name: str(e?.name, 80),
    sets: Math.max(0, Math.round(Number(e?.sets) || 0)),
    reps: Math.max(0, Math.round(Number(e?.reps) || 0)),
    weight: Math.max(0, Number(e?.weight) || 0),
  })).filter((e) => e.name);
}

function normalize(b) {
  return {
    date: date(b.date),
    name: reqStr(b.name, 'Workout name', 80),
    duration_min: Math.round(num(b.duration_min ?? 0, 'Duration', { min: 0, max: 1000 })),
    notes: str(b.notes, 500),
    exercises: cleanExercises(b.exercises),
  };
}

router.get('/workouts', async (req, res) => {
  const from = date(req.query.from, 'From');
  const to = date(req.query.to, 'To');
  if (to < from || daysBetween(from, to) > 400) throw bad('Range is too large');
  res.json(await many('select * from workouts where user_id = $1 and date between $2::date and $3::date order by date desc, id desc', [req.uid, from, to]));
});

router.post('/workouts', async (req, res) => {
  const w = normalize(req.body);
  const row = await one(
    'insert into workouts (user_id, date, name, duration_min, notes, exercises) values ($1,$2,$3,$4,$5,$6) returning *',
    [req.uid, w.date, w.name, w.duration_min, w.notes, JSON.stringify(w.exercises)]
  );
  res.status(201).json(row);
});

router.patch('/workouts/:id', async (req, res) => {
  const wid = id(req.params.id);
  const cur = await one('select * from workouts where id = $1 and user_id = $2', [wid, req.uid]);
  if (!cur) throw notFound();
  const w = normalize({ ...cur, ...req.body });
  const row = await one(
    'update workouts set date=$1, name=$2, duration_min=$3, notes=$4, exercises=$5 where id=$6 returning *',
    [w.date, w.name, w.duration_min, w.notes, JSON.stringify(w.exercises), wid]
  );
  res.json(row);
});

router.delete('/workouts/:id', async (req, res) => {
  const r = await query('delete from workouts where id = $1 and user_id = $2', [id(req.params.id), req.uid]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
});

export default router;
