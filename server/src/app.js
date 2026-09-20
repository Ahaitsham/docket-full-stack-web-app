import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { HttpError } from './util.js';

import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import taskRoutes from './routes/tasks.js';
import dietRoutes from './routes/diet.js';
import moneyRoutes from './routes/money.js';
import gymRoutes from './routes/gym.js';
import progressRoutes from './routes/progress.js';
import pushRoutes from './routes/push.js';
import cronRoutes from './routes/cron.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowed = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new HttpError(403, 'This origin is not allowed. Add it to CLIENT_URL on the server.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);
app.use(express.json({ limit: '200kb' }));
app.use((req, _res, next) => {
  if (req.body === undefined) req.body = {}; // Express 5 leaves body undefined when empty
  next();
});

app.get('/', (_req, res) => res.json({ ok: true, name: 'Docket API' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/diet', dietRoutes);
app.use('/api/money', moneyRoutes);
app.use('/api/gym', gymRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/cron', cronRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (err.code === '23505') return res.status(409).json({ error: 'That already exists' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server' : err.message });
});

export default app;
