import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { one, query } from '../db.js';
import { requireAuth, signToken, publicUser, makeRecoveryCode, normalizeRecovery } from '../auth.js';
import { HttpError, bad, str, reqStr } from '../util.js';

const router = Router();

const limiter = (max, windowMin) =>
  rateLimit({
    windowMs: windowMin * 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  });

export const DEFAULT_CATEGORIES = [
  { name: 'Court & Cases', color: '#2B4BDB', icon: '⚖️' },
  { name: 'Medicines', color: '#E5484D', icon: '💊' },
  { name: 'Gym', color: '#F76B15', icon: '🏋️' },
  { name: 'Diet', color: '#30A46C', icon: '🥗' },
  { name: 'Money', color: '#B7862F', icon: '💰' },
  { name: 'Personal', color: '#8E4EC6', icon: '🏠' },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const checkPassword = (p) => {
  if (typeof p !== 'string' || p.length < 8) throw bad('Password must be at least 8 characters');
  if (p.length > 200) throw bad('Password is too long');
  return p;
};

async function issueRecovery(userId) {
  const code = makeRecoveryCode();
  const hash = await bcrypt.hash(normalizeRecovery(code), 8);
  await query('update users set recovery_hash = $1 where id = $2', [hash, userId]);
  return code;
}

router.post('/register', limiter(10, 60), async (req, res) => {
  if (process.env.ALLOW_REGISTRATION === 'false') throw new HttpError(403, 'Sign-ups are closed for this app.');
  const name = reqStr(req.body.name, 'Name', 80);
  const email = reqStr(req.body.email, 'Email', 200).toLowerCase();
  if (!EMAIL.test(email)) throw bad('Enter a valid email address');
  const password = checkPassword(req.body.password);
  const timezone = str(req.body.timezone, 60) || 'Asia/Kolkata';

  if (await one('select 1 from users where email = $1', [email])) throw new HttpError(409, 'An account with this email already exists');

  const hash = await bcrypt.hash(password, 10);
  const user = await one('insert into users (name, email, password_hash, timezone) values ($1,$2,$3,$4) returning *', [name, email, hash, timezone]);

  for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
    await query('insert into categories (user_id, name, color, icon, sort) values ($1,$2,$3,$4,$5)', [user.id, c.name, c.color, c.icon, i]);
  }
  const recoveryCode = await issueRecovery(user.id);
  res.status(201).json({ token: signToken(user), user: publicUser(user), recoveryCode });
});

router.post('/login', limiter(15, 15), async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = email ? await one('select * from users where email = $1', [email]) : null;
  const ok = user ? await bcrypt.compare(password, user.password_hash) : await bcrypt.compare(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect');
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/forgot-reset', limiter(6, 60), async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  const code = normalizeRecovery(req.body.recoveryCode);
  const newPassword = checkPassword(req.body.newPassword);
  const user = email ? await one('select * from users where email = $1', [email]) : null;
  const ok = user?.recovery_hash ? await bcrypt.compare(code, user.recovery_hash) : false;
  if (!user || !ok) throw new HttpError(400, 'Email or recovery code is incorrect');

  const hash = await bcrypt.hash(newPassword, 10);
  const updated = await one('update users set password_hash = $1, token_version = token_version + 1 where id = $2 returning *', [hash, user.id]);
  const recoveryCode = await issueRecovery(user.id); // old code is now void
  res.json({ ok: true, token: signToken(updated), user: publicUser(updated), recoveryCode });
});

router.use(requireAuth);

router.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

router.patch('/me', async (req, res) => {
  const u = req.user;
  const name = req.body.name !== undefined ? reqStr(req.body.name, 'Name', 80) : u.name;
  const timezone = req.body.timezone !== undefined ? reqStr(req.body.timezone, 'Timezone', 60) : u.timezone;
  const currency = req.body.currency !== undefined ? reqStr(req.body.currency, 'Currency', 4) : u.currency;
  let modules = u.modules;
  if (req.body.modules && typeof req.body.modules === 'object') {
    modules = { ...u.modules };
    for (const k of ['tasks', 'diet', 'money', 'gym']) if (typeof req.body.modules[k] === 'boolean') modules[k] = req.body.modules[k];
  }
  const row = await one('update users set name=$1, timezone=$2, currency=$3, modules=$4 where id=$5 returning *', [name, timezone, currency, modules, u.id]);
  res.json({ user: publicUser(row) });
});

router.post('/change-password', limiter(10, 15), async (req, res) => {
  const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = checkPassword(req.body.newPassword);
  if (!(await bcrypt.compare(current, req.user.password_hash))) throw new HttpError(400, 'Current password is incorrect');
  const hash = await bcrypt.hash(next, 10);
  const row = await one('update users set password_hash = $1, token_version = token_version + 1 where id = $2 returning *', [hash, req.uid]);
  res.json({ ok: true, token: signToken(row) }); // this device stays signed in, all others are signed out
});

router.post('/regenerate-recovery', limiter(10, 15), async (req, res) => {
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!(await bcrypt.compare(password, req.user.password_hash))) throw new HttpError(400, 'Password is incorrect');
  res.json({ recoveryCode: await issueRecovery(req.uid) });
});

export default router;
