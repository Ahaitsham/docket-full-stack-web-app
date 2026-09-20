import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { House, ListChecks, Plus, Activity, ChartColumn } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { useSheets } from '../lib/sheetsContext.js';
import { useDayTasks } from '../lib/queries.js';
import { useToast } from '../lib/toast.jsx';
import { today, minutesOf, nowMinutes, fmtTime } from '../lib/dates.js';
import { showLocalNotification } from '../lib/notifications.js';
import { initials } from '../lib/format.js';
import { cx } from './ui.jsx';

const TITLES = { '/': 'Docket', '/tasks': 'Tasks', '/track': 'Track', '/progress': 'Progress', '/settings': 'Settings' };

// While the app is open, fire due reminders locally. (When it is closed, the server sends web push.)
function useLocalReminders(enabled) {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const { data: tasks } = useDayTasks(date);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const d = today();
      if (d !== date) return setDate(d);
      if (!tasks) return;
      const now = nowMinutes();
      let seen = {};
      try {
        seen = JSON.parse(localStorage.getItem('docket_seen') || '{}');
      } catch {
        /* ignore */
      }
      let changed = false;
      for (const t of tasks) {
        if (!t.time || !t.remind || t.done) continue;
        const target = minutesOf(t.time) - t.remind_before;
        const key = `${t.id}|${d}`;
        if (now >= target && now <= target + 30 && !seen[key]) {
          seen[key] = 1;
          changed = true;
          const body = t.remind_before > 0 ? `In ${t.remind_before} min · ${fmtTime(t.time)}` : `Now · ${fmtTime(t.time)}`;
          showLocalNotification(t.title, body, `task-${t.id}-${d}`).then((ok) => !ok && toast.info(`${t.title} · ${fmtTime(t.time)}`));
        }
      }
      if (changed) {
        for (const k of Object.keys(seen)) if (!k.endsWith(`|${d}`)) delete seen[k];
        localStorage.setItem('docket_seen', JSON.stringify(seen));
      }
    };
    tick();
    const id = setInterval(tick, 20_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [tasks, date, enabled, toast]);
}

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink to={to} end={end} className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold">
      {({ isActive }) => (
        <>
          <span className={cx('relative grid h-8 w-12 place-items-center rounded-full transition-colors', isActive ? 'text-brand' : 'text-muted')}>
            {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-brand/10" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <Icon className="relative size-[21px]" strokeWidth={isActive ? 2.4 : 2} />
          </span>
          <span className={isActive ? 'text-ink' : 'text-muted'}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function AppShell() {
  const { user } = useAuth();
  const { open } = useSheets();
  const loc = useLocation();
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 8));
  useLocalReminders(user.modules.tasks);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  const m = user.modules;
  const hasTrack = m.diet || m.money || m.gym;
  const root = '/' + (loc.pathname.split('/')[1] || '');
  const title = TITLES[root] || 'Docket';

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg md:max-w-2xl">
      <header className={cx('sticky top-0 z-30 transition-all duration-300', scrolled ? 'bg-app/80 shadow-[0_1px_0_rgb(var(--line))] backdrop-blur-xl' : 'bg-transparent')}>
        <div className="pt-safe">
          <div className={cx('flex items-center justify-between px-5 transition-all duration-300', scrolled ? 'h-12' : 'h-16')}>
            <motion.h1 layout className={cx('font-display font-semibold transition-all duration-300', scrolled ? 'text-[19px]' : 'text-[26px]')}>
              {title}
            </motion.h1>
            <button onClick={() => nav('/settings')} aria-label="Settings" className="grid size-9 place-items-center rounded-full bg-ink text-[13px] font-bold text-app shadow-card transition active:scale-90">
              {initials(user.name)}
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pb-36">
        <motion.div key={root} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}>
          <Outlet />
        </motion.div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-3 pb-[max(env(safe-area-inset-bottom),10px)] md:max-w-2xl" aria-label="Main">
        <div className="flex items-center rounded-[28px] border border-line/70 bg-card/90 px-2 py-1 shadow-lift backdrop-blur-xl">
          <NavItem to="/" end icon={House} label="Home" />
          {m.tasks ? <NavItem to="/tasks" icon={ListChecks} label="Tasks" /> : <span className="flex-1" />}
          <div className="flex flex-1 justify-center">
            <motion.button whileTap={{ scale: 0.88, rotate: 90 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} onClick={() => open('quick')} aria-label="Add" className="-mt-7 grid size-14 place-items-center rounded-full bg-brand text-white shadow-lift ring-4 ring-app dark:text-[#0B1220]">
              <Plus className="size-7" strokeWidth={2.6} />
            </motion.button>
          </div>
          {hasTrack ? <NavItem to="/track" icon={Activity} label="Track" /> : <span className="flex-1" />}
          <NavItem to="/progress" icon={ChartColumn} label="Progress" />
        </div>
      </nav>
    </div>
  );
}
