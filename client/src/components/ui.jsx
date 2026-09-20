import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useInView } from 'framer-motion';
import { X, Minus, Plus } from 'lucide-react';

export const cx = (...a) => a.filter(Boolean).join(' ');

/* ---------- Bottom sheet ---------- */
export function Sheet({ open, onClose, title, children, footer, tall = false }) {
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cx('relative flex w-full max-w-lg flex-col rounded-t-sheet bg-card shadow-pop', tall ? 'h-[92dvh]' : 'max-h-[92dvh]')}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => (info.offset.y > 110 || info.velocity.y > 700) && onClose()}
          >
            <div className="flex touch-none justify-center pb-1 pt-2.5" onPointerDown={(e) => controls.start(e)}>
              <span className="h-1.5 w-10 rounded-full bg-line" />
            </div>
            <div className="flex items-center justify-between px-5 pb-2 pt-1" onPointerDown={(e) => controls.start(e)}>
              <h2 className="font-display text-[22px] font-semibold leading-tight">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-app text-muted transition active:scale-90">
                <X className="size-[18px]" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-2">{children}</div>
            {footer && <div className="border-t border-line/70 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">{footer}</div>}
            {!footer && <div className="pb-safe" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ---------- Centered confirm dialog ---------- */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center px-6">
          <motion.div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-sheet bg-card p-6 shadow-pop"
            initial={{ opacity: 0, scale: 0.86, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', damping: 24, stiffness: 380 }}
          >
            <h3 className="font-display text-xl font-semibold">{title}</h3>
            {message && <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{message}</p>}
            <div className="mt-5 flex gap-2.5">
              <button className="btn btn-ghost flex-1 border border-line" onClick={onCancel}>Cancel</button>
              <button className={cx('btn flex-1', danger ? 'bg-bad text-white' : 'btn-primary')} onClick={onConfirm} autoFocus>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ---------- Progress ring ---------- */
export function Ring({ value = 0, size = 120, stroke = 10, color = 'rgb(var(--brand))', track = 'rgb(var(--line))', children, className }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={cx('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: track }} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ stroke: color }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/* ---------- Animated tick ---------- */
export function Check({ checked, onChange, color = 'rgb(var(--brand))', label }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      whileTap={{ scale: 0.82 }}
      animate={{ scale: checked ? [1, 1.18, 1] : 1 }}
      transition={{ duration: 0.28 }}
      className="grid size-[26px] shrink-0 place-items-center rounded-full border-2"
      style={{ borderColor: checked ? color : 'rgb(var(--line))', background: checked ? color : 'transparent' }}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="#fff"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.22 }}
        />
      </svg>
    </motion.button>
  );
}

/* ---------- Segmented control ---------- */
export function Segmented({ options, value, onChange, className, size = 'md' }) {
  const id = useId();
  return (
    <div className={cx('relative flex rounded-xl bg-app p-1', className)} role="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx('relative z-10 flex-1 whitespace-nowrap rounded-lg font-semibold transition-colors', size === 'sm' ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-[14px]', on ? 'text-ink' : 'text-muted')}
          >
            {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 -z-10 rounded-lg bg-card shadow-card" transition={{ type: 'spring', stiffness: 460, damping: 36 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const Chip = ({ on, children, className, ...p }) => (
  <button type="button" className={cx('chip', on && 'chip-on', className)} {...p}>
    {children}
  </button>
);

export function Field({ label, hint, children, className }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-line')}
    >
      <motion.span className="absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow" animate={{ x: checked ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
    </button>
  );
}

export function Stepper({ value, onChange, step = 0.5, min = 0.5, max = 50 }) {
  const set = (v) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div className="flex items-center gap-1 rounded-xl bg-app p-1">
      <button type="button" onClick={() => set(value - step)} className="grid size-9 place-items-center rounded-lg bg-card text-ink shadow-card active:scale-90" aria-label="Less">
        <Minus className="size-4" />
      </button>
      <span className="num min-w-12 text-center text-[15px] font-semibold">{value}</span>
      <button type="button" onClick={() => set(value + step)} className="grid size-9 place-items-center rounded-lg bg-card text-ink shadow-card active:scale-90" aria-label="More">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export const Spinner = ({ className }) => <span className={cx('inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-label="Loading" />;

export function Skeleton({ className }) {
  return (
    <div className={cx('relative overflow-hidden rounded-2xl bg-line/60', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-card/60 to-transparent" />
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icon && (
        <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Icon className="size-6" />
        </div>
      )}
      <p className="font-display text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-[260px] text-[14px] leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value = 0, color = 'rgb(var(--brand))', height = 6, className }) {
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-line/70', className)} style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/* Mounts its content only when scrolled into view, so charts draw as they arrive. */
export function Reveal({ children, minHeight = 180, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  return (
    <div ref={ref} className={className} style={{ minHeight: inView ? undefined : minHeight }}>
      {inView && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      )}
    </div>
  );
}

export const SectionTitle = ({ children, right }) => (
  <div className="mb-2.5 mt-6 flex items-end justify-between px-1">
    <h2 className="font-display text-[19px] font-semibold">{children}</h2>
    {right}
  </div>
);

export const ErrorNote = ({ error }) =>
  error ? <p className="rounded-xl bg-bad/10 px-3.5 py-2.5 text-[14px] font-medium text-bad" role="alert">{error.message || String(error)}</p> : null;
