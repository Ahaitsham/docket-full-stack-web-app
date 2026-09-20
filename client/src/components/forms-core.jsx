import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useCategories, useRefresh } from '../lib/queries.js';
import { useToast } from '../lib/toast.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useSheets } from '../lib/sheetsContext.js';
import { today, fromISO, DAY_LETTERS } from '../lib/dates.js';
import { notificationPermission } from '../lib/notifications.js';
import { EMOJIS, COLORS } from '../lib/categories.js';
import { Sheet, Field, Chip, Segmented, Switch, ErrorNote, cx } from './ui.jsx';

/* ================= Task ================= */
const REPEATS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Mon–Fri' },
  { value: 'weekly', label: 'Pick days' },
];
const BEFORE = [
  { v: 0, l: 'On time' },
  { v: 10, l: '10 min' },
  { v: 30, l: '30 min' },
  { v: 60, l: '1 hour' },
];

export function TaskSheet({ open, close, task, date }) {
  const cats = useCategories();
  const refresh = useRefresh();
  const toast = useToast();
  const { confirm } = useSheets();
  const [f, setF] = useState(() => ({
    title: task?.title || '',
    notes: task?.notes || '',
    category_id: task?.category_id ?? null,
    start_date: task?.start_date || date || today(),
    repeat: task?.repeat || 'none',
    days: task?.days || [],
    end_date: task?.end_date || '',
    hasTime: Boolean(task?.time),
    time: task?.time || '09:00',
    remind: task?.remind ?? true,
    remind_before: task?.remind_before ?? 0,
    priority: task?.priority || 'normal',
  }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const editing = Boolean(task);

  const save = useMutation({
    mutationFn: () => {
      let days = f.days;
      if (f.repeat === 'weekly' && days.length === 0) days = [fromISO(f.start_date).getDay()];
      const body = {
        title: f.title,
        notes: f.notes,
        category_id: f.category_id,
        start_date: f.start_date,
        repeat: f.repeat,
        days,
        end_date: f.repeat === 'none' ? null : f.end_date || null,
        time: f.hasTime ? f.time : null,
        remind: f.hasTime && f.remind,
        remind_before: f.remind_before,
        priority: f.priority,
      };
      return editing ? api.patch(`/tasks/${task.id}`, body) : api.post('/tasks', body);
    },
    onSuccess: () => {
      refresh('tasks');
      toast.success(editing ? 'Task updated' : 'Task added');
      close();
    },
  });

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this task?',
      message: task.repeat === 'none' ? 'It will be removed permanently.' : 'All future occurrences and its history in Progress will be removed.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await api.del(`/tasks/${task.id}`);
    refresh('tasks');
    toast.success('Task deleted');
    close();
  };

  const toggleDay = (d) => set('days', f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d]);

  return (
    <Sheet
      open={open}
      onClose={close}
      title={editing ? 'Edit task' : 'New task'}
      footer={
        <div className="flex gap-2.5">
          {editing && (
            <button className="btn btn-danger" onClick={remove} aria-label="Delete task">
              <Trash2 className="size-[18px]" />
            </button>
          )}
          <button className="btn btn-primary flex-1" disabled={!f.title.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add task'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="What needs doing?">
          <input className="input" autoFocus={!editing} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Hearing at District Court" maxLength={160} />
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            <Chip on={f.category_id === null} onClick={() => set('category_id', null)}>None</Chip>
            {cats.data?.map((c) => (
              <Chip key={c.id} on={f.category_id === c.id} onClick={() => set('category_id', c.id)}>
                <span>{c.icon}</span>
                {c.name}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label={f.repeat === 'none' ? 'Date' : 'Starts on'}>
          <input type="date" className="input" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </Field>
        <Field label="Priority">
          <Segmented size="sm" value={f.priority} onChange={(v) => set('priority', v)} options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]} />
        </Field>

        <Field label="Repeat">
          <div className="flex flex-wrap gap-2">
            {REPEATS.map((r) => (
              <Chip key={r.value} on={f.repeat === r.value} onClick={() => set('repeat', r.value)}>
                {r.label}
              </Chip>
            ))}
          </div>
          {f.repeat === 'weekly' && (
            <div className="mt-3 flex justify-between gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={cx('grid size-10 place-items-center rounded-full text-[13px] font-semibold transition active:scale-90', f.days.includes(d) ? 'bg-brand text-white dark:text-[#0B1220]' : 'bg-app text-muted')}
                  aria-pressed={f.days.includes(d)}
                >
                  {DAY_LETTERS[d]}
                </button>
              ))}
            </div>
          )}
          {f.repeat !== 'none' && (
            <div className="mt-3">
              <label className="label">Stop repeating on (optional)</label>
              <input type="date" className="input" min={f.start_date} value={f.end_date} onChange={(e) => set('end_date', e.target.value)} />
            </div>
          )}
        </Field>

        <div className="rounded-2xl border border-line p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold">Set a time</p>
              <p className="text-[13px] text-muted">Get reminded on your phone</p>
            </div>
            <Switch checked={f.hasTime} onChange={(v) => set('hasTime', v)} label="Set a time" />
          </div>
          {f.hasTime && (
            <div className="mt-3 space-y-3">
              <input type="time" className="input" value={f.time} onChange={(e) => set('time', e.target.value)} />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[14px] font-medium">
                  <Bell className="size-4 text-brand" /> Remind me
                </span>
                <Switch checked={f.remind} onChange={(v) => set('remind', v)} label="Remind me" />
              </div>
              {f.remind && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {BEFORE.map((b) => (
                      <Chip key={b.v} on={f.remind_before === b.v} onClick={() => set('remind_before', b.v)}>
                        {b.l}
                      </Chip>
                    ))}
                  </div>
                  {notificationPermission() !== 'granted' && <p className="rounded-xl bg-brass/10 px-3 py-2 text-[13px] text-brass">Notifications are off on this device. Turn them on in Settings to receive reminders.</p>}
                </>
              )}
            </div>
          )}
        </div>

        <Field label="Notes (dose, case number, details)">
          <textarea className="input min-h-[84px]" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1000} placeholder="Optional" />
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Sheet>
  );
}

/* ================= Category ================= */
export function CategorySheet({ open, close, category }) {
  const refresh = useRefresh();
  const toast = useToast();
  const { confirm } = useSheets();
  const editing = Boolean(category);
  const [f, setF] = useState({ name: category?.name || '', icon: category?.icon || '📌', color: category?.color || COLORS[0] });

  const save = useMutation({
    mutationFn: () => (editing ? api.patch(`/categories/${category.id}`, f) : api.post('/categories', f)),
    onSuccess: () => {
      refresh('categories', 'tasks');
      toast.success(editing ? 'Category updated' : 'Category added');
      close();
    },
  });
  const remove = async () => {
    const ok = await confirm({ title: `Delete "${category.name}"?`, message: 'Tasks in this category are kept, but will show as uncategorised.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await api.del(`/categories/${category.id}`);
    refresh('categories', 'tasks');
    close();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={editing ? 'Edit category' : 'New category'}
      footer={
        <div className="flex gap-2.5">
          {editing && (
            <button className="btn btn-danger" onClick={remove} aria-label="Delete category">
              <Trash2 className="size-[18px]" />
            </button>
          )}
          <button className="btn btn-primary flex-1" disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()}>
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Clients" maxLength={40} autoFocus />
        </Field>
        <Field label="Icon">
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setF({ ...f, icon: e })} className={cx('grid aspect-square place-items-center rounded-xl text-xl transition active:scale-90', f.icon === e ? 'bg-brand/15 ring-2 ring-brand' : 'bg-app')}>
                {e}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Colour">
          <div className="flex flex-wrap gap-2.5">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => setF({ ...f, color: c })} className={cx('size-9 rounded-full transition active:scale-90', f.color === c && 'ring-2 ring-offset-2 ring-offset-card')} style={{ background: c, '--tw-ring-color': c }} />
            ))}
          </div>
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Sheet>
  );
}

/* ================= Change password ================= */
export function PasswordSheet({ open, close }) {
  const toast = useToast();
  const { commit, user } = useAuth();
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [localError, setLocalError] = useState('');
  const save = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: f.current, newPassword: f.next }),
    onSuccess: (r) => {
      commit(r.token, user);
      toast.success('Password changed. Other devices were signed out.');
      close();
    },
  });
  const submit = () => {
    setLocalError('');
    if (f.next.length < 8) return setLocalError('New password must be at least 8 characters');
    if (f.next !== f.again) return setLocalError('The new passwords do not match');
    save.mutate();
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title="Change password"
      footer={
        <button className="btn btn-primary w-full" disabled={!f.current || !f.next || save.isPending} onClick={submit}>
          {save.isPending ? 'Updating…' : 'Update password'}
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="Current password">
          <input type="password" autoComplete="current-password" className="input" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <input type="password" autoComplete="new-password" className="input" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        </Field>
        <Field label="Repeat new password">
          <input type="password" autoComplete="new-password" className="input" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />
        </Field>
        {localError && <p className="rounded-xl bg-bad/10 px-3.5 py-2.5 text-[14px] font-medium text-bad">{localError}</p>}
        <ErrorNote error={save.error} />
      </div>
    </Sheet>
  );
}
