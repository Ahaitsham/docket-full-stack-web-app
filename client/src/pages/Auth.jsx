import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Field, Segmented, ErrorNote, Spinner } from '../components/ui.jsx';
import { RecoveryDialog } from '../components/RecoveryDialog.jsx';

function PasswordInput({ value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className="input pr-11" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted">
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

export default function AuthPage() {
  const { user, commit } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [f, setF] = useState({ name: '', email: '', password: '', code: '', newPassword: '' });
  const [pending, setPending] = useState(null); // { token, user, recoveryCode } waiting for "I saved it"
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = useMutation({
    mutationFn: async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (mode === 'login') return { kind: 'login', ...(await api.post('/auth/login', { email: f.email, password: f.password })) };
      if (mode === 'register') return { kind: 'register', ...(await api.post('/auth/register', { name: f.name, email: f.email, password: f.password, timezone })) };
      return { kind: 'reset', ...(await api.post('/auth/forgot-reset', { email: f.email, recoveryCode: f.code, newPassword: f.newPassword })) };
    },
    onSuccess: (r) => {
      if (r.kind === 'login') commit(r.token, r.user);
      else setPending(r); // sign-up and reset both hand out a fresh recovery code first
    },
  });

  if (user && !pending) return <Navigate to="/" replace />;

  const onSubmit = (e) => {
    e.preventDefault();
    submit.mutate();
  };
  const switchMode = (m) => {
    submit.reset();
    setMode(m);
  };

  return (
    <div className="min-h-dvh bg-app">
      <div className="relative overflow-hidden rounded-b-[40px] bg-[#0E1A2F] px-7 pb-24 pt-[calc(env(safe-area-inset-top)+56px)] text-white">
        <svg className="absolute -right-24 -top-24 size-80 opacity-[.16]" viewBox="0 0 200 200" fill="none" aria-hidden="true">
          <circle cx="100" cy="100" r="90" stroke="#D6A852" strokeWidth="10" strokeDasharray="420 200" strokeLinecap="round" />
          <circle cx="100" cy="100" r="62" stroke="#fff" strokeWidth="6" strokeDasharray="200 200" strokeLinecap="round" />
        </svg>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="relative mx-auto max-w-md">
          <img src="/icons/icon-192.png" alt="" className="mb-5 size-14 rounded-2xl shadow-lift" />
          <h1 className="font-display text-[40px] font-semibold leading-none">Docket</h1>
          <p className="mt-3 max-w-[280px] text-[16px] leading-snug text-white/70">Court dates, medicines, meals and money. One calm place.</p>
        </motion.div>
      </div>

      <div className="relative z-10 mx-auto -mt-14 max-w-md px-4 pb-10">
        <motion.form onSubmit={onSubmit} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="card p-5">
          {mode !== 'forgot' ? (
            <Segmented value={mode} onChange={switchMode} options={[{ value: 'login', label: 'Sign in' }, { value: 'register', label: 'Create account' }]} />
          ) : (
            <div>
              <h2 className="font-display text-[22px] font-semibold">Reset password</h2>
              <p className="mt-1 text-[14px] text-muted">Enter your email and the recovery code you saved when you created the account.</p>
            </div>
          )}

          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={mode} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="mt-4 space-y-3.5">
              {mode === 'register' && (
                <Field label="Your name">
                  <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" placeholder="Vikash Bhardwaj" />
                </Field>
              )}
              <Field label="Email">
                <input className="input" type="email" inputMode="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" placeholder="you@example.com" />
              </Field>
              {mode === 'forgot' ? (
                <>
                  <Field label="Recovery code">
                    <input className="input font-mono uppercase tracking-wider" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" />
                  </Field>
                  <Field label="New password" hint="At least 8 characters">
                    <PasswordInput value={f.newPassword} onChange={(v) => set('newPassword', v)} autoComplete="new-password" />
                  </Field>
                </>
              ) : (
                <Field label="Password" hint={mode === 'register' ? 'At least 8 characters' : undefined}>
                  <PasswordInput value={f.password} onChange={(v) => set('password', v)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                </Field>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-4 space-y-3">
            <ErrorNote error={submit.error} />
            <button className="btn btn-primary w-full" disabled={submit.isPending}>
              {submit.isPending ? <Spinner /> : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password'}
            </button>
            {mode === 'login' && (
              <button type="button" onClick={() => switchMode('forgot')} className="w-full py-1 text-center text-[14px] font-semibold text-brand">
                Forgot password?
              </button>
            )}
            {mode === 'forgot' && (
              <button type="button" onClick={() => switchMode('login')} className="w-full py-1 text-center text-[14px] font-semibold text-muted">
                Back to sign in
              </button>
            )}
          </div>
        </motion.form>
      </div>

      <RecoveryDialog
        code={pending?.recoveryCode}
        title={pending?.kind === 'reset' ? 'Password reset. Save your new code' : 'Save your recovery code'}
        onDone={() => {
          commit(pending.token, pending.user);
          setPending(null);
        }}
      />
    </div>
  );
}
