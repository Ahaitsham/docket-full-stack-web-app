import { motion } from 'framer-motion';
import { Bell, Repeat } from 'lucide-react';
import { fmtTime, DAY_NAMES } from '../lib/dates.js';
import { Check, cx } from './ui.jsx';

export function repeatLabel(t) {
  if (t.repeat === 'daily') return 'Every day';
  if (t.repeat === 'weekdays') return 'Mon–Fri';
  if (t.repeat === 'weekly') return [1, 2, 3, 4, 5, 6, 0].filter((d) => t.days?.includes(d)).map((d) => DAY_NAMES[d]).join(' ');
  return '';
}

export function TaskRow({ task, onToggle, onOpen, index = 0 }) {
  const color = task.category_color || '#6B778C';
  const rep = repeatLabel(task);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index, 6) * 0.03, type: 'spring', stiffness: 380, damping: 30 }}
      onClick={onOpen}
      className="card flex cursor-pointer items-center gap-3 py-3 pl-3.5 pr-3 transition active:scale-[.985]"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      {onToggle ? <Check checked={task.done} onChange={onToggle} color={color} label={`Mark ${task.title} as done`} /> : <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-[15.5px] font-semibold leading-snug transition-colors', task.done && 'text-muted line-through decoration-muted/50')}>{task.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted">
          {task.category_name && (
            <span className="flex min-w-0 items-center gap-1 truncate">
              <span>{task.category_icon}</span>
              <span className="truncate">{task.category_name}</span>
            </span>
          )}
          {rep && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Repeat className="size-3" />
              {rep}
            </span>
          )}
          {task.remind && <Bell className="size-3 shrink-0 text-brass" aria-label="Reminder on" />}
        </div>
        {task.notes && !task.done && <p className="mt-1 line-clamp-1 text-[12.5px] text-muted/80">{task.notes}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {task.time && <span className="num rounded-lg px-2 py-1 text-[12px] font-semibold" style={{ background: `${color}1A`, color }}>{fmtTime(task.time)}</span>}
        {task.priority === 'high' && !task.done && <span className="rounded-full bg-bad/10 px-2 py-0.5 text-[11px] font-semibold text-bad">High</span>}
      </div>
    </motion.div>
  );
}
