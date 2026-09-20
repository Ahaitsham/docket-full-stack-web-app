import { Router } from 'express';
import { one, many, query } from '../db.js';
import { requireAuth } from '../auth.js';
import { bad, reqStr, str, date, oneOf, id, notFound, isScheduled, eachDate, toStr, daysBetween } from '../util.js';

const router = Router();
router.use(requireAuth);

const REPEATS = ['none', 'daily', 'weekdays', 'weekly'];
const REMIND_BEFORE = [0, 5, 10, 15, 30, 60];
const PRIORITIES = ['low', 'normal', 'high'];
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };

const SELECT = `select t.*, c.name as category_name, c.color as category_color, c.icon as category_icon`;

async function normalize(uid, b, cur) {
  const has = (k) => b[k] !== undefined;
  const get = (k, fn, fallback) => (has(k) ? fn(b[k]) : cur ? cur[k] : fallback);

  const title = get('title', (v) => reqStr(v, 'Title', 160));
  if (!title) throw bad('Title is required');
  const notes = get('notes', (v) => str(v, 1000), '');
  const priority = get('priority', (v) => oneOf(v, PRIORITIES, 'Priority'), 'normal');
  const start_date = get('start_date', (v) => date(v, 'Start date'), toStr(new Date()));
  let end_date = get('end_date', (v) => date(v, 'End date', false), null);
  let repeat = get('repeat', (v) => oneOf(v, REPEATS, 'Repeat'), 'none');

  let days = get(
    'days',
    (v) => {
      if (!Array.isArray(v)) throw bad('Days must be a list');
      return [...new Set(v.map(Number))].filter((n) => Number.isInteger(n) && n >= 0 && n <= 6).sort();
    },
    []
  );
  if (repeat === 'weekly' && days.length === 0) throw bad('Pick at least one day of the week');
  if (repeat !== 'weekly') days = [];
  if (repeat === 'none') end_date = null;
  if (end_date && end_date < start_date) throw bad('End date cannot be before the start date');

  let time = get(
    'time',
    (v) => {
      if (v === null || v === '') return null;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw bad('Time must look like 09:30');
      return v;
    },
    null
  );
  let remind = get('remind', (v) => Boolean(v), false);
  let remind_before = get('remind_before', (v) => {
    const n = Number(v);
    if (!REMIND_BEFORE.includes(n)) throw bad('Reminder must be 0, 5, 10, 15, 30 or 60 minutes before');
    return n;
  }, 0);
  if (!time) {
    remind = false;
    remind_before = 0;
  }

  let category_id = get('category_id', (v) => (v === null || v === '' ? null : id(v)), null);
  if (category_id && !(await one('select 1 from categories where id = $1 and user_id = $2', [category_id, uid]))) throw bad('That category does not exist');

  return { title, notes, priority, start_date, end_date, repeat, days, time, remind, remind_before, category_id };
}

const byTime = (a, b) => {
  if (a.time && b.time) return a.time.localeCompare(b.time) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (a.time) return -1;
  if (b.time) return 1;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.id - b.id;
};

// All task definitions (for the "manage tasks" list)
router.get('/', async (req, res) => {
  const rows = await many(
    `${SELECT} from tasks t left join categories c on c.id = t.category_id where t.user_id = $1 order by t.created_at desc`,
    [req.uid]
  );
  res.json(rows);
});

// What is scheduled on one day, with done state
router.get('/day', async (req, res) => {
  const d = date(req.query.date);
  const rows = await many(
    `${SELECT}, (l.task_id is not null) as done
     from tasks t
     left join categories c on c.id = t.category_id
     left join task_logs l on l.task_id = t.id and l.date = $2::date
     where t.user_id = $1 and t.start_date <= $2::date and (t.end_date is null or t.end_date >= $2::date)`,
    [req.uid, d]
  );
  res.json(rows.filter((t) => isScheduled(t, d)).sort(byTime));
});

// Per-day totals for a date range (powers the week strip)
router.get('/summary', async (req, res) => {
  const from = date(req.query.from, 'From');
  const to = date(req.query.to, 'To');
  if (to < from || daysBetween(from, to) > 62) throw bad('Range must be 62 days or less');
  const [tasks, logs] = await Promise.all([
    many('select * from tasks where user_id = $1 and start_date <= $3::date and (end_date is null or end_date >= $2::date)', [req.uid, from, to]),
    many('select l.task_id, l.date from task_logs l join tasks t on t.id = l.task_id where t.user_id = $1 and l.date between $2::date and $3::date', [req.uid, from, to]),
  ]);
  const done = new Set(logs.map((l) => `${l.task_id}|${l.date}`));
  const out = {};
  for (const d of eachDate(from, to)) {
    let total = 0;
    let complete = 0;
    for (const t of tasks) {
      if (!isScheduled(t, d)) continue;
      total++;
      if (done.has(`${t.id}|${d}`)) complete++;
    }
    out[d] = { total, done: complete };
  }
  res.json(out);
});

router.post('/', async (req, res) => {
  const t = await normalize(req.uid, req.body, null);
  const row = await one(
    `insert into tasks (user_id, category_id, title, notes, start_date, end_date, repeat, days, time, remind, remind_before, priority)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    [req.uid, t.category_id, t.title, t.notes, t.start_date, t.end_date, t.repeat, t.days, t.time, t.remind, t.remind_before, t.priority]
  );
  res.status(201).json(row);
});

router.patch('/:id', async (req, res) => {
  const tid = id(req.params.id);
  const cur = await one('select * from tasks where id = $1 and user_id = $2', [tid, req.uid]);
  if (!cur) throw notFound();
  const t = await normalize(req.uid, req.body, cur);
  const row = await one(
    `update tasks set category_id=$1, title=$2, notes=$3, start_date=$4, end_date=$5, repeat=$6, days=$7, time=$8,
       remind=$9, remind_before=$10, priority=$11, last_notified_on=null
     where id=$12 returning *`,
    [t.category_id, t.title, t.notes, t.start_date, t.end_date, t.repeat, t.days, t.time, t.remind, t.remind_before, t.priority, tid]
  );
  res.json(row);
});

router.post('/:id/toggle', async (req, res) => {
  const tid = id(req.params.id);
  const d = date(req.body.date);
  if (!(await one('select 1 from tasks where id = $1 and user_id = $2', [tid, req.uid]))) throw notFound();
  if (req.body.done) await query('insert into task_logs (task_id, date) values ($1,$2) on conflict do nothing', [tid, d]);
  else await query('delete from task_logs where task_id = $1 and date = $2', [tid, d]);
  res.json({ done: Boolean(req.body.done) });
});

router.delete('/:id', async (req, res) => {
  const r = await query('delete from tasks where id = $1 and user_id = $2', [id(req.params.id), req.uid]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
});

export default router;
