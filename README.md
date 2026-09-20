# Docket

A mobile-first personal planner built as an installable PWA. It was made for **Vikash Bhardwaj**, a lawyer, to keep his work and his health in one place:

- **Tasks and reminders** for court dates, medicines, errands. Optional time, repeat rules, phone notifications.
- **Diet**: BMR, maintenance calories, daily target, current and goal weight, meal logging, calorie and macro tracking.
- **Money**: income and expenses by category, monthly summary.
- **Gym**: workouts with exercises, sets, reps and weights.
- **Progress**: charts by **days, weeks, months or years**, for everything or for one category or one task.
- **Password protected**, with change password and forgot password (recovery code).
- **Modules can be switched off** in Settings, so he only sees what he wants to manage.

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS 3, Framer Motion, Recharts, TanStack Query |
| Backend | Node.js, Express 5, JWT auth, bcrypt, web-push |
| Database | PostgreSQL on **Neon** |
| Hosting | **Vercel** (two projects: `client` and `server`) |

---

## 1. Project layout

```
docket/
├── client/                 React PWA (deploy as Vercel project #1)
│   ├── public/             manifest, service worker (sw.js), icons
│   ├── src/
│   │   ├── components/     UI primitives, sheets/forms, app shell
│   │   ├── lib/            api client, auth, theme, queries, notifications
│   │   └── pages/          Home, Tasks, Diet, Money, Gym, Progress, Settings
│   └── vercel.json         SPA rewrite + service worker headers
└── server/                 Express API (deploy as Vercel project #2)
    ├── api/index.js        Vercel serverless entry point
    ├── db/schema.sql       all tables
    ├── scripts/            migrate, generate VAPID keys, reset password
    ├── src/                app, routes, auth, push, cron
    └── vercel.json         routes every request to the Express app
```

## 2. Requirements

- **Node.js 20.19+ or 22+** (Vite 8 needs it). Check with `node -v`.
- A free **Neon** account: https://neon.tech
- A free **Vercel** account: https://vercel.com
- A **GitHub** account (Vercel deploys from a repository)

---

## 3. Local development

### 3.1 Create the database on Neon

1. In Neon, create a project (any name, for example `docket`).
2. Open **Connect** and copy the **pooled connection string**. It looks like
   `postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
3. Tip: create a second Neon *branch* called `dev` for local work so you never touch production data.

### 3.2 Backend

```bash
cd server
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Open `server/.env` and fill in:

| Variable | What to put |
| --- | --- |
| `DATABASE_URL` | the Neon connection string from 3.1 |
| `JWT_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | `http://localhost:5173` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | run `npm run vapid` and paste both lines (needed for notifications) |
| `VAPID_SUBJECT` | `mailto:` plus your email |
| `CRON_SECRET` | any random string (protects the reminder endpoint) |
| `ALLOW_REGISTRATION` | keep `true` for now |

Create the tables, then start the API:

```bash
npm run migrate             # prints "Database is ready. All tables exist."
npm run dev                 # http://localhost:5000
```

Check it: open http://localhost:5000/api/health

### 3.3 Frontend

In a second terminal:

```bash
cd client
npm install
npm run dev                 # http://localhost:5173
```

Leave `VITE_API_URL` empty locally. Vite forwards `/api` to `localhost:5000`, so there is no CORS setup to think about.

### 3.4 First run

1. Open http://localhost:5173 and choose **Create account**.
2. **Save the recovery code** shown once. It is the only way to reset a forgotten password (see section 7).
3. Open the **+** button to add tasks, meals, money entries and workouts. Open **Track, Diet, Set up my plan** to calculate BMR and calories.

---

## 4. Notifications and reminders

How it works:

- **App open:** Docket checks today's tasks every 20 seconds and shows due reminders.
- **App closed:** the server sends **Web Push** to the phone. This needs the VAPID keys and a scheduler that calls the server once a minute (section 5.4).

To turn them on: **Settings, Reminders, Turn on**, allow the permission, then **Send a test notification**.

Notes:

- Push needs **HTTPS**. Vercel gives you that. `localhost` also works.
- The service worker only runs in production builds. To test push locally: `npm run build && npm run preview` in `client`, then open http://localhost:4173.
- **iPhone (iOS 16.4+):** notifications only work after the app is added to the Home Screen (Share, Add to Home Screen) and opened from there.
- **Android:** works in Chrome, and after installing the app.
- A reminder is sent at the chosen time, or 10/30/60 minutes before, and is skipped if the task is already ticked off. Each reminder is sent once per day.

---

## 5. Deploying to Vercel (frontend and backend)

You will create **two Vercel projects from the same GitHub repository**, one per folder.

### 5.1 Push to GitHub

```bash
cd docket
git init
git add .
git commit -m "Docket"
# create an empty repo on GitHub, then:
git remote add origin https://github.com/<you>/docket.git
git branch -M main
git push -u origin main
```

`.env` files are git-ignored, so no secrets are pushed.

### 5.2 Run the migration on the production database

If you used a separate `dev` branch locally, run the schema once on the production branch. Either:

- Neon dashboard, **SQL Editor**, paste the contents of `server/db/schema.sql`, run. Or
- Put the production string in `server/.env` temporarily and run `npm run migrate`.

### 5.3 Deploy the backend first

1. Vercel, **Add New, Project**, import the repository.
2. **Root Directory:** `server`. Framework preset: **Other**. Leave build and output settings empty.
3. **Environment Variables** (Production):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `JWT_SECRET` | long random string (use a different one than local) |
| `CLIENT_URL` | your frontend URL. Not known yet: put `https://placeholder.vercel.app` and fix it in 5.5 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | from `npm run vapid` (keep the same pair once users have subscribed) |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | long random string |
| `ALLOW_REGISTRATION` | `true` for now |

4. Deploy. Open `https://<backend>.vercel.app/api/health`. You should see `{"ok":true,...}`.

### 5.4 Deploy the frontend

1. Vercel, **Add New, Project**, import the **same repository** again.
2. **Root Directory:** `client`. Framework preset: **Vite** (detected automatically).
3. **Environment Variable:** `VITE_API_URL` = `https://<backend>.vercel.app` (no trailing slash, no `/api`).
4. Deploy. You get a URL such as `https://docket-app.vercel.app`.

### 5.5 Connect them (CORS)

Go back to the **backend** project, Settings, Environment Variables, set `CLIENT_URL` to the exact frontend URL (`https://docket-app.vercel.app`, no trailing slash). If you add a custom domain, list both separated by a comma. **Redeploy** the backend (Deployments, the three dots, Redeploy) so the change takes effect.

### 5.6 Start the reminder scheduler

Reminders while the app is closed need something to call the server every minute:

**Option A. cron-job.org (free, every minute). Recommended on Vercel's free plan.**

1. Create a free account at https://cron-job.org
2. New cronjob, URL: `https://<backend>.vercel.app/api/cron/dispatch`
3. Schedule: every 1 minute.
4. Advanced, Headers: `Authorization` = `Bearer <your CRON_SECRET>`
   (or skip the header and use `...dispatch?key=<your CRON_SECRET>` in the URL).

**Option B. Vercel Cron (needs a Pro plan for per-minute schedules).** On the free plan Vercel only runs cron jobs once a day. On Pro, add this to `server/vercel.json`:

```json
"crons": [{ "path": "/api/cron/dispatch", "schedule": "* * * * *" }]
```

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.

Test it by opening `https://<backend>.vercel.app/api/cron/dispatch?key=<CRON_SECRET>`. You should see `{"ok":true,"checked":N,"notified":M}`.

### 5.7 Lock down sign-ups

After Vikash has created his account, set `ALLOW_REGISTRATION` to `false` on the backend project and redeploy. Nobody else can register, and the only way in is his password.

---

## 6. Installing on the phone

Open the frontend URL on the phone and sign in.

- **Android (Chrome):** menu, **Install app** (or use **Settings, Install Docket** inside the app).
- **iPhone (Safari):** Share, **Add to Home Screen**. Open it from the Home Screen icon, then turn on reminders in Settings.

The app shell works offline. Data needs a connection.

---

## 7. Passwords and recovery

- **Sign in:** email and password. Sessions last 30 days.
- **Change password:** Settings, Security, Change password. All other devices are signed out.
- **Forgot password:** Sign in screen, Forgot password. Enter the email, the **recovery code** and a new password. The old code stops working and a **new code is shown once**.
- **New recovery code:** Settings, Security (asks for the password first).
- **Lost both?** From your computer, with `DATABASE_URL` set in `server/.env`:

```bash
cd server
npm run reset-password -- vikash@example.com "NewPassword123"
```

Passwords and recovery codes are stored only as bcrypt hashes.

---

## 8. How the numbers are calculated

- **BMR** (Mifflin-St Jeor): `10 x kg + 6.25 x cm - 5 x age + 5` for men, `- 161` for women.
- **Maintenance** = BMR x activity factor (1.2 to 1.9).
- **Daily target** = maintenance minus (or plus) `pace x 7700 / 7`, never below 1,500 kcal (men) or 1,200 kcal (women) when losing weight.
- **Macros:** protein 1.8 g per kg, fat 25% of calories, carbs the remainder.
- Logging a new weight on Diet updates the current weight and recalculates everything.

These are estimates for general use, not medical advice.

---

## 9. API overview

All routes are under `/api` and need `Authorization: Bearer <token>` except auth, health and the cron endpoint.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/forgot-reset`, `/auth/change-password`, `/auth/regenerate-recovery`; `GET/PATCH /auth/me` |
| Categories | `GET/POST /categories`, `PATCH/DELETE /categories/:id` |
| Tasks | `GET /tasks`, `GET /tasks/day?date=`, `GET /tasks/summary?from=&to=`, `POST /tasks`, `PATCH/DELETE /tasks/:id`, `POST /tasks/:id/toggle` |
| Diet | `GET/PUT /diet/profile`, `GET/POST /diet/meals`, `PATCH/DELETE /diet/meals/:id`, `GET /diet/daily`, `GET/POST/DELETE /diet/foods`, `GET/POST/DELETE /diet/weights` |
| Money | `GET/POST /money/transactions`, `PATCH/DELETE /money/transactions/:id`, `GET /money/summary` |
| Gym | `GET/POST /gym/workouts`, `PATCH/DELETE /gym/workouts/:id` |
| Progress | `GET /progress?granularity=days\|weeks\|months\|years&today=YYYY-MM-DD&scope=all\|category\|task&id=` |
| Push | `GET /push/public-key`, `POST /push/subscribe`, `/push/unsubscribe`, `/push/test`, `GET /push/status` |
| Cron | `GET/POST /cron/dispatch` (secret required) |

---

## 10. Customising

- **Colours and type:** CSS variables at the top of `client/src/index.css` (light and dark). Tailwind reads them in `tailwind.config.js`.
- **Default categories:** `DEFAULT_CATEGORIES` in `server/src/routes/auth.js` (applies to new accounts). Users edit their own in Settings.
- **Built-in food list:** `client/src/lib/foods.js`. Users can also save their own foods.
- **Expense and income categories:** `client/src/lib/categories.js`.
- **App name and icons:** `client/index.html`, `client/public/manifest.webmanifest`, `client/public/icons/`.

## 11. Troubleshooting

| Problem | Fix |
| --- | --- |
| "Cannot reach the server" | `VITE_API_URL` is wrong or missing on the frontend project. Redeploy after changing it. |
| Browser console shows a CORS error | `CLIENT_URL` on the backend must match the frontend URL exactly (no trailing slash). Redeploy the backend. |
| `Something went wrong on the server` | Check the backend project's Vercel Logs. Usually `DATABASE_URL` or `JWT_SECRET` is missing, or the migration was not run. |
| Signed out again and again | `JWT_SECRET` changed between deployments, or the password was changed on another device. |
| No notifications | Run the test in Settings. Check: permission allowed, VAPID keys set on the backend, the scheduler (5.6) is running, and on iPhone the app was added to the Home Screen. |
| Notification arrives late | The scheduler runs once a minute. Reminders are still delivered up to 30 minutes after the chosen time. |
| First request after idle is slow | Neon wakes its database from sleep on the free plan. It takes a second or two. |
| Old version still showing | Close the app fully and reopen. The service worker updates in the background. |

## 12. Security notes

- Every query is parameterised. Each row is scoped to the signed-in user.
- Passwords need 8+ characters and are hashed with bcrypt. Sign-in, reset and password change are rate limited.
- Changing or resetting a password invalidates all other sessions.
- Use a strong, unique `JWT_SECRET` and keep `.env` files out of Git.
- Turn off sign-ups (5.7) once the account exists.
- Neon encrypts data at rest and in transit. For client-confidential legal data, avoid putting privileged details in task notes if that would breach your professional duties, and review your bar council's guidance on cloud storage.
# docket-full-stack-web-app
