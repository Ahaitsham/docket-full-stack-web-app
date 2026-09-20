import { Router } from 'express';
import { one, many, query } from '../db.js';
import { requireAuth } from '../auth.js';
import { str, num, date, oneOf, id, notFound, bad, daysBetween } from '../util.js';

const router = Router();
router.use(requireAuth);

function normalize(b) {
  return {
    date: date(b.date),
    type: oneOf(b.type, ['income', 'expense'], 'Type'),
    amount: Math.round(num(b.amount, 'Amount', { min: 0.01, max: 1e10 }) * 100) / 100,
    category: str(b.category, 40) || 'Other',
    note: str(b.note, 300),
  };
}

router.get('/transactions', async (req, res) => {
  const from = date(req.query.from, 'From');
  const to = date(req.query.to, 'To');
  if (to < from || daysBetween(from, to) > 400) throw bad('Range is too large');
  res.json(
    await many('select * from transactions where user_id = $1 and date between $2::date and $3::date order by date desc, id desc', [req.uid, from, to])
  );
});

router.get('/summary', async (req, res) => {
  const from = date(req.query.from, 'From');
  const to = date(req.query.to, 'To');
  const [totals, byCategory] = await Promise.all([
    many('select type, sum(amount) as total from transactions where user_id = $1 and date between $2::date and $3::date group by type', [req.uid, from, to]),
    many(
      `select category, sum(amount) as total from transactions
       where user_id = $1 and type = 'expense' and date between $2::date and $3::date group by category order by total desc`,
      [req.uid, from, to]
    ),
  ]);
  const income = totals.find((t) => t.type === 'income')?.total || 0;
  const expense = totals.find((t) => t.type === 'expense')?.total || 0;
  res.json({ income, expense, net: income - expense, byCategory });
});

router.post('/transactions', async (req, res) => {
  const t = normalize(req.body);
  const row = await one(
    'insert into transactions (user_id, date, type, amount, category, note) values ($1,$2,$3,$4,$5,$6) returning *',
    [req.uid, t.date, t.type, t.amount, t.category, t.note]
  );
  res.status(201).json(row);
});

router.patch('/transactions/:id', async (req, res) => {
  const tid = id(req.params.id);
  const cur = await one('select * from transactions where id = $1 and user_id = $2', [tid, req.uid]);
  if (!cur) throw notFound();
  const t = normalize({ ...cur, ...req.body });
  const row = await one('update transactions set date=$1, type=$2, amount=$3, category=$4, note=$5 where id=$6 returning *', [t.date, t.type, t.amount, t.category, t.note, tid]);
  res.json(row);
});

router.delete('/transactions/:id', async (req, res) => {
  const r = await query('delete from transactions where id = $1 and user_id = $2', [id(req.params.id), req.uid]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
});

export default router;
