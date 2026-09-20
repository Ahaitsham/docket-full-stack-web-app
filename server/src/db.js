import pg from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings and NUMERIC/BIGINT as numbers.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

let pool;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3, // small pool: every serverless instance keeps its own
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', (err) => console.error('Postgres pool error', err.message));
  }
  return pool;
}

export const query = (text, params) => getPool().query(text, params);
export const one = async (text, params) => (await query(text, params)).rows[0] || null;
export const many = async (text, params) => (await query(text, params)).rows;
