import webpush from 'web-push';
import { query } from './db.js';

let configured = false;
export function pushReady() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

// Sends one notification to every device the user has enabled. Dead subscriptions are removed.
export async function sendToUser(userId, payload, subs) {
  if (!pushReady()) return { sent: 0, failed: 0 };
  const rows = subs ?? (await query('select * from push_subscriptions where user_id = $1', [userId])).rows;
  let sent = 0;
  let failed = 0;
  await Promise.all(
    rows.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 });
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 404 || err.statusCode === 410) await query('delete from push_subscriptions where id = $1', [s.id]);
        else console.error('Push failed', err.statusCode, err.body || err.message);
      }
    })
  );
  return { sent, failed };
}
