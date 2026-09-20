import { Router } from 'express';
import { query, one } from '../db.js';
import { requireAuth } from '../auth.js';
import { bad } from '../util.js';
import { pushReady, sendToUser } from '../push.js';

const router = Router();

router.get('/public-key', (_req, res) => {
  res.json({ key: pushReady() ? process.env.VAPID_PUBLIC_KEY : null });
});

router.use(requireAuth);

router.post('/subscribe', async (req, res) => {
  const sub = req.body.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw bad('Invalid subscription');
  await query(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1,$2,$3,$4)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [req.uid, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
  res.status(201).json({ ok: true });
});

router.post('/unsubscribe', async (req, res) => {
  if (req.body.endpoint) await query('delete from push_subscriptions where endpoint = $1 and user_id = $2', [req.body.endpoint, req.uid]);
  res.json({ ok: true });
});

router.get('/status', async (req, res) => {
  const row = await one('select count(*)::int as devices from push_subscriptions where user_id = $1', [req.uid]);
  res.json({ configured: pushReady(), devices: row.devices });
});

router.post('/test', async (req, res) => {
  if (!pushReady()) throw bad('Push notifications are not configured on the server yet (missing VAPID keys).');
  const r = await sendToUser(req.uid, { title: 'Docket', body: 'Reminders are working on this device.', tag: 'docket-test', url: '/' });
  res.json(r);
});

export default router;
