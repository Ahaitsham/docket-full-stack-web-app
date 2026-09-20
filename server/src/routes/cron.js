import { Router } from 'express';
import { many, query } from '../db.js';
import { HttpError, isScheduled, localNow, hhmmToMinutes } from '../util.js';
import { safeEqual } from '../auth.js';
import { pushReady, sendToUser } from '../push.js';

const router = Router();

// How long after the exact reminder minute we still deliver it (covers scheduler jitter / downtime).
const GRACE_MINUTES = 30;

function authorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  return safeEqual(bearer, secret) || safeEqual(key, secret);
}

async function dispatch(req, res) {
  if (!authorised(req)) throw new HttpError(401, 'Unauthorised');
  if (!pushReady()) return res.json({ ok: true, skipped: 'VAPID keys are not configured' });

  const tasks = await many(
    `select t.*, u.timezone, c.name as category_name
     from tasks t
     join users u on u.id = t.user_id
     left join categories c on c.id = t.category_id
     where t.remind = true and t.time is not null
       and exists (select 1 from push_subscriptions p where p.user_id = t.user_id)`
  );

  let notified = 0;
  for (const t of tasks) {
    const now = localNow(t.timezone);
    if (t.last_notified_on === now.date) continue;
    if (!isScheduled(t, now.date)) continue;
    const target = hhmmToMinutes(t.time) - t.remind_before;
    if (now.minutes < target || now.minutes > target + GRACE_MINUTES) continue;

    const done = await many('select 1 from task_logs where task_id = $1 and date = $2::date', [t.id, now.date]);
    if (done.length) continue;

    const when = t.remind_before > 0 ? `In ${t.remind_before} min · ${t.time}` : `Now · ${t.time}`;
    await sendToUser(t.user_id, {
      title: t.title,
      body: t.category_name ? `${when} · ${t.category_name}` : when,
      tag: `task-${t.id}-${now.date}`,
      url: '/tasks',
    });
    await query('update tasks set last_notified_on = $1::date where id = $2', [now.date, t.id]);
    notified++;
  }
  res.json({ ok: true, checked: tasks.length, notified });
}

router.get('/dispatch', dispatch);
router.post('/dispatch', dispatch);

export default router;
