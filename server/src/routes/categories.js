import { Router } from 'express';
import { one, many, query } from '../db.js';
import { requireAuth } from '../auth.js';
import { reqStr, str, id, notFound } from '../util.js';

const router = Router();
router.use(requireAuth);

const color = (v, fallback = '#2B4BDB') => (/^#[0-9a-fA-F]{6}$/.test(v || '') ? v : fallback);

router.get('/', async (req, res) => {
  res.json(await many('select id, name, color, icon, sort from categories where user_id = $1 order by sort, id', [req.uid]));
});

router.post('/', async (req, res) => {
  const name = reqStr(req.body.name, 'Name', 40);
  const row = await one(
    `insert into categories (user_id, name, color, icon, sort)
     values ($1,$2,$3,$4,(select coalesce(max(sort),0)+1 from categories where user_id = $1)) returning id, name, color, icon, sort`,
    [req.uid, name, color(req.body.color), str(req.body.icon, 8) || '📌']
  );
  res.status(201).json(row);
});

router.patch('/:id', async (req, res) => {
  const cid = id(req.params.id);
  const cur = await one('select * from categories where id = $1 and user_id = $2', [cid, req.uid]);
  if (!cur) throw notFound();
  const row = await one(
    'update categories set name=$1, color=$2, icon=$3 where id=$4 returning id, name, color, icon, sort',
    [req.body.name !== undefined ? reqStr(req.body.name, 'Name', 40) : cur.name, color(req.body.color, cur.color), str(req.body.icon, 8) || cur.icon, cid]
  );
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const r = await query('delete from categories where id = $1 and user_id = $2', [id(req.params.id), req.uid]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true }); // tasks in this category keep existing, just uncategorised
});

export default router;
