import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { one } from './db.js';
import { HttpError } from './util.js';

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};

export const signToken = (user) => jwt.sign({ uid: user.id, v: user.token_version }, secret(), { expiresIn: '30d' });

export const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  timezone: u.timezone,
  currency: u.currency,
  modules: u.modules,
});

// Loads the signed-in user on every request. The token_version check means that
// changing or resetting the password signs out every other device.
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in');
  let payload;
  try {
    payload = jwt.verify(token, secret());
  } catch {
    throw new HttpError(401, 'Your session has ended. Please sign in again.');
  }
  const user = await one('select * from users where id = $1', [payload.uid]);
  if (!user || user.token_version !== payload.v) throw new HttpError(401, 'Your session has ended. Please sign in again.');
  req.user = user;
  req.uid = user.id;
  next();
}

// Recovery code: 16 characters, easy to read out and write down. Shown once.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRecoveryCode() {
  const bytes = crypto.randomBytes(16);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return chars.match(/.{4}/g).join('-');
}
export const normalizeRecovery = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
