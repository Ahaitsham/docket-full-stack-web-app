// Emergency password reset, run from your own computer against your database:
//   npm run reset-password -- vikash@example.com "NewPassword123"
// It also signs out every device and prints a fresh recovery code.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { makeRecoveryCode, normalizeRecovery } from '../src/auth.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run reset-password -- <email> "<new password, 8+ characters>"');
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const code = makeRecoveryCode();
  const r = await client.query(
    'update users set password_hash = $1, recovery_hash = $2, token_version = token_version + 1 where email = $3 returning id',
    [await bcrypt.hash(password, 10), await bcrypt.hash(normalizeRecovery(code), 8), email.toLowerCase()]
  );
  if (!r.rowCount) console.error('No user with that email.');
  else console.log(`Password updated. New recovery code (write it down): ${code}`);
} finally {
  await client.end();
}
