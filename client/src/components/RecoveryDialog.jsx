import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, KeyRound, Check } from 'lucide-react';
import { cx } from './ui.jsx';

// Shown once after sign-up, after a password reset, or when a new code is generated.
export function RecoveryDialog({ code, onDone, title = 'Save your recovery code' }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is on screen to copy by hand */
    }
  };

  return createPortal(
    <AnimatePresence>
      {code && (
        <div className="fixed inset-0 z-[65] grid place-items-center px-5">
          <motion.div className="absolute inset-0 bg-ink/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-sheet bg-card p-6 shadow-pop"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', damping: 24, stiffness: 340 }}
          >
            <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-brass/15 text-brass">
              <KeyRound className="size-6" />
            </div>
            <h3 className="font-display text-[22px] font-semibold leading-tight">{title}</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">If you ever forget your password, this code is the only way back in. Write it down or keep it somewhere safe. It is shown just once.</p>
            <button onClick={copy} className="num mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-brass/60 bg-brass/5 px-4 py-4 font-mono text-[19px] font-semibold tracking-wider" aria-label="Copy recovery code">
              <span className="select-all">{code}</span>
              {copied ? <Check className="size-5 shrink-0 text-good" /> : <Copy className="size-5 shrink-0 text-muted" />}
            </button>
            <label className="mt-4 flex items-center gap-2.5 text-[14px] font-medium">
              <input type="checkbox" className="size-[18px] accent-[rgb(var(--brand))]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              I have saved this code
            </label>
            <button className={cx('btn btn-primary mt-4 w-full')} disabled={!saved} onClick={onDone}>
              Continue
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
