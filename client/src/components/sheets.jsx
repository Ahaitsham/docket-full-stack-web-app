import { useCallback, useState } from 'react';
import { CheckSquare, Utensils, Wallet, Dumbbell, Scale, Check as CheckIcon } from 'lucide-react';
import { SheetsCtx, useSheets } from '../lib/sheetsContext.js';
import { useAuth } from '../lib/auth.jsx';
import { useAllTasks, useCategories } from '../lib/queries.js';
import { ConfirmDialog, Sheet, cx } from './ui.jsx';
import { TaskSheet, CategorySheet, PasswordSheet } from './forms-core.jsx';
import { MealSheet, WeightSheet, ProfileSheet, TxSheet, WorkoutSheet } from './forms-track.jsx';

function QuickAddSheet({ open, close }) {
  const { user } = useAuth();
  const { open: openSheet } = useSheets();
  const m = user.modules;
  const items = [
    m.tasks && { name: 'task', icon: CheckSquare, label: 'Task', hint: 'Case, medicine, errand', tone: 'text-brand bg-brand/10' },
    m.diet && { name: 'meal', icon: Utensils, label: 'Meal', hint: 'Log calories', tone: 'text-good bg-good/10' },
    m.money && { name: 'tx', icon: Wallet, label: 'Money', hint: 'Income or expense', tone: 'text-brass bg-brass/10' },
    m.gym && { name: 'workout', icon: Dumbbell, label: 'Workout', hint: 'Sets and reps', tone: 'text-[#F76B15] bg-[#F76B15]/10' },
    m.diet && { name: 'weight', icon: Scale, label: 'Weight', hint: 'Weigh-in', tone: 'text-[#8E4EC6] bg-[#8E4EC6]/10' },
  ].filter(Boolean);
  return (
    <Sheet open={open} onClose={close} title="Add something">
      <div className="grid grid-cols-2 gap-3 pb-2">
        {items.map((it) => (
          <button key={it.name} onClick={() => openSheet(it.name)} className="card flex flex-col items-start gap-3 p-4 text-left transition active:scale-[.97]">
            <span className={cx('grid size-11 place-items-center rounded-2xl', it.tone)}>
              <it.icon className="size-5" />
            </span>
            <span>
              <span className="block text-[16px] font-semibold">{it.label}</span>
              <span className="text-[13px] text-muted">{it.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// Lets Progress narrow charts to one category or one task.
function FocusSheet({ open, close, scope, onPick }) {
  const cats = useCategories();
  const tasks = useAllTasks(open);
  const Row = ({ label, sub, on, onClick }) => (
    <button onClick={() => { onClick(); close(); }} className={cx('flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-left transition active:scale-[.99]', on ? 'bg-brand/10' : 'active:bg-app')}>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">{label}</span>
        {sub && <span className="text-[12px] text-muted">{sub}</span>}
      </span>
      {on && <CheckIcon className="size-[18px] shrink-0 text-brand" />}
    </button>
  );
  return (
    <Sheet open={open} onClose={close} title="Show progress for" tall>
      <Row label="All tasks" sub="Everything together" on={scope.type === 'all'} onClick={() => onPick({ type: 'all' })} />
      <p className="mb-1 mt-4 px-1 text-[13px] font-medium text-muted">A category</p>
      {cats.data?.map((c) => (
        <Row key={c.id} label={`${c.icon}  ${c.name}`} on={scope.type === 'category' && scope.id === c.id} onClick={() => onPick({ type: 'category', id: c.id, label: c.name })} />
      ))}
      <p className="mb-1 mt-4 px-1 text-[13px] font-medium text-muted">One task</p>
      {tasks.data?.map((t) => (
        <Row key={t.id} label={t.title} sub={t.category_name} on={scope.type === 'task' && scope.id === t.id} onClick={() => onPick({ type: 'task', id: t.id, label: t.title })} />
      ))}
      {tasks.data?.length === 0 && <p className="px-1 text-[14px] text-muted">No tasks yet.</p>}
    </Sheet>
  );
}

const REGISTRY = {
  quick: QuickAddSheet,
  task: TaskSheet,
  category: CategorySheet,
  password: PasswordSheet,
  meal: MealSheet,
  weight: WeightSheet,
  profile: ProfileSheet,
  tx: TxSheet,
  workout: WorkoutSheet,
  focus: FocusSheet,
};

export function SheetProvider({ children }) {
  const [state, setState] = useState({ name: null, props: {}, open: false, key: 0 });
  const [ask, setAsk] = useState(null);

  const open = useCallback((name, props = {}) => setState((s) => ({ name, props, open: true, key: s.key + 1 })), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const confirm = useCallback((opts) => new Promise((resolve) => setAsk({ opts, resolve })), []);
  const answer = (v) => {
    ask?.resolve(v);
    setAsk((a) => (a ? { ...a, closing: true } : a));
    setTimeout(() => setAsk(null), 250);
  };

  const Comp = REGISTRY[state.name];
  return (
    <SheetsCtx.Provider value={{ open, close, confirm }}>
      {children}
      {Comp && <Comp key={state.key} {...state.props} open={state.open} close={close} />}
      <ConfirmDialog open={Boolean(ask) && !ask.closing} {...(ask?.opts || {})} onConfirm={() => answer(true)} onCancel={() => answer(false)} />
    </SheetsCtx.Provider>
  );
}
