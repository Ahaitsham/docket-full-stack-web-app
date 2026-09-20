import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, BellOff, KeyRound, LogOut, Lock, Plus, Download, ChevronRight, Send, Smartphone } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useTheme } from '../lib/theme.jsx';
import { useToast } from '../lib/toast.jsx';
import { useSheets } from '../lib/sheetsContext.js';
import { useCategories, useRefresh } from '../lib/queries.js';
import { currentSubscription, disablePush, enablePush, notificationPermission, notificationsSupported } from '../lib/notifications.js';
import { initials } from '../lib/format.js';
import { Field, Segmented, Switch, SectionTitle, Spinner, ErrorNote } from '../components/ui.jsx';
import { RecoveryDialog } from '../components/RecoveryDialog.jsx';

const Row = ({ icon: Icon, title, sub, right, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-app">
      {Icon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-app text-muted"><Icon className="size-[18px]" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        {sub && <span className="block text-[12.5px] text-muted">{sub}</span>}
      </span>
      {right ?? (onClick && <ChevronRight className="size-5 text-muted" />)}
    </Tag>
  );
};

function Notifications() {
  const toast = useToast();
  const [perm, setPerm] = useState(notificationPermission());
  const [subscribed, setSubscribed] = useState(false);
  const status = useQuery({ queryKey: ['push-status'], queryFn: () => api.get('/push/status') });
  useEffect(() => {
    currentSubscription().then((s) => setSubscribed(Boolean(s)));
  }, [perm]);

  const enable = useMutation({
    mutationFn: enablePush,
    onSuccess: () => {
      setPerm(notificationPermission());
      setSubscribed(true);
      status.refetch();
      toast.success('Reminders are on for this device');
    },
    onError: (e) => {
      setPerm(notificationPermission());
      toast.error(e.message);
    },
  });
  const test = useMutation({
    mutationFn: () => api.post('/push/test'),
    onSuccess: (r) => (r.sent ? toast.success('Test sent. Check your notifications.') : toast.error('Nothing was sent. Enable reminders on this device first.')),
    onError: (e) => toast.error(e.message),
  });
  const disable = async () => {
    await disablePush();
    setSubscribed(false);
    status.refetch();
    toast.success('Reminders are off for this device');
  };

  const supported = notificationsSupported();
  const on = subscribed && perm === 'granted';
  return (
    <div className="card overflow-hidden">
      <Row
        icon={on ? Bell : BellOff}
        title="Reminders on this device"
        sub={!supported ? 'Not supported here. On iPhone, add Docket to your Home Screen first.' : perm === 'denied' ? 'Blocked. Allow notifications for this site in your phone settings.' : on ? 'On. You will be reminded even when the app is closed.' : 'Off'}
        right={supported && perm !== 'denied' ? (on ? <button className="btn btn-ghost min-h-0 px-3 py-1.5 text-[13px]" onClick={disable}>Turn off</button> : <button className="btn btn-primary min-h-0 px-3.5 py-2 text-[13px]" onClick={() => enable.mutate()} disabled={enable.isPending}>{enable.isPending ? <Spinner className="size-4" /> : 'Turn on'}</button>) : <span />}
      />
      {on && <div className="border-t border-line/60"><Row icon={Send} title="Send a test notification" onClick={() => test.mutate()} right={test.isPending ? <Spinner className="size-4" /> : undefined} /></div>}
      {status.data && !status.data.configured && <p className="border-t border-line/60 bg-brass/10 px-4 py-2.5 text-[12.5px] text-brass">The server has no VAPID keys yet, so background reminders cannot be sent. See the README.</p>}
    </div>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const { open, confirm } = useSheets();
  const toast = useToast();
  const cats = useCategories();
  const refresh = useRefresh();
  const [name, setName] = useState(user.name);
  const [installEvent, setInstallEvent] = useState(window.__docketInstall || null);
  const [recovery, setRecovery] = useState(null);
  const [pw, setPw] = useState('');
  const [askPw, setAskPw] = useState(false);

  useEffect(() => {
    const on = (e) => {
      e.preventDefault();
      window.__docketInstall = e;
      setInstallEvent(e);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  const patch = useMutation({
    mutationFn: (body) => api.patch('/auth/me', body),
    onSuccess: (r) => {
      setUser(r.user);
      refresh('tasks');
    },
    onError: (e) => toast.error(e.message),
  });

  const regen = useMutation({
    mutationFn: () => api.post('/auth/regenerate-recovery', { password: pw }),
    onSuccess: (r) => {
      setAskPw(false);
      setPw('');
      setRecovery(r.recoveryCode);
    },
  });

  const modules = [
    ['tasks', 'Tasks & reminders', 'Court dates, medicines, errands'],
    ['diet', 'Diet & calories', 'BMR, meals, weight goal'],
    ['money', 'Money', 'Income and expenses'],
    ['gym', 'Gym', 'Workouts, sets and reps'],
  ];

  const signOut = async () => {
    if (await confirm({ title: 'Sign out?', message: 'You will need your password to get back in.', confirmLabel: 'Sign out' })) logout();
  };

  return (
    <div className="space-y-2 pb-4">
      <div className="card flex items-center gap-4 p-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-ink font-display text-[22px] font-semibold text-app">{initials(user.name)}</span>
        <div className="min-w-0 flex-1">
          <input className="w-full truncate bg-transparent font-display text-[21px] font-semibold outline-none focus:underline" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== user.name && patch.mutate({ name })} aria-label="Your name" maxLength={80} />
          <p className="truncate text-[13px] text-muted">{user.email}</p>
        </div>
      </div>

      <SectionTitle>What you manage</SectionTitle>
      <div className="card divide-y divide-line/60 overflow-hidden">
        {modules.map(([k, t, s]) => (
          <Row key={k} title={t} sub={s} right={<Switch checked={user.modules[k]} label={t} onChange={(v) => patch.mutate({ modules: { [k]: v } })} />} />
        ))}
      </div>

      <SectionTitle>Reminders</SectionTitle>
      <Notifications />

      {user.modules.tasks && (
        <>
          <SectionTitle right={<button className="flex items-center gap-1 text-[13px] font-semibold text-brand" onClick={() => open('category', {})}><Plus className="size-3.5" /> New</button>}>Task categories</SectionTitle>
          <div className="card divide-y divide-line/60 overflow-hidden">
            {cats.data?.map((c) => (
              <Row key={c.id} onClick={() => open('category', { category: c })} title={c.name} icon={undefined} right={<><span className="mr-1 text-lg">{c.icon}</span><span className="size-3.5 rounded-full" style={{ background: c.color }} /><ChevronRight className="size-5 text-muted" /></>} />
            ))}
          </div>
        </>
      )}

      <SectionTitle>Appearance</SectionTitle>
      <div className="card p-3">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'system', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <div className="mt-3 grid grid-cols-2 gap-3 px-1 pb-1">
          <Field label="Currency">
            <select className="input" value={user.currency} onChange={(e) => patch.mutate({ currency: e.target.value })}>
              {['₹', '$', '€', '£', 'AED', 'S$'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Time zone">
            <button className="input text-left text-[13px]" onClick={() => patch.mutate({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })} title="Use this device's time zone">{user.timezone}</button>
          </Field>
        </div>
      </div>

      <SectionTitle>Security</SectionTitle>
      <div className="card divide-y divide-line/60 overflow-hidden">
        <Row icon={Lock} title="Change password" sub="Signs out your other devices" onClick={() => open('password', {})} />
        <Row icon={KeyRound} title="New recovery code" sub="Replaces the old one. Needed if you forget your password" onClick={() => setAskPw(true)} />
        {installEvent && <Row icon={Download} title="Install Docket" sub="Add it to your home screen" onClick={async () => { installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); window.__docketInstall = null; }} />}
        {!installEvent && !window.matchMedia('(display-mode: standalone)').matches && <Row icon={Smartphone} title="Use it like an app" sub="Android: browser menu, Install app. iPhone: Share, Add to Home Screen" />}
        <Row icon={LogOut} title="Sign out" onClick={signOut} />
      </div>

      {askPw && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card space-y-3 p-4">
          <Field label="Enter your password to create a new code">
            <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" />
          </Field>
          <ErrorNote error={regen.error} />
          <div className="flex gap-2.5">
            <button className="btn btn-ghost flex-1 border border-line" onClick={() => { setAskPw(false); setPw(''); regen.reset(); }}>Cancel</button>
            <button className="btn btn-primary flex-1" disabled={!pw || regen.isPending} onClick={() => regen.mutate()}>Create code</button>
          </div>
        </motion.div>
      )}

      <p className="pt-4 text-center text-[12px] text-muted">Docket · your data lives in your own database</p>
      <RecoveryDialog code={recovery} title="Your new recovery code" onDone={() => setRecovery(null)} />
    </div>
  );
}
