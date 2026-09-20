import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api.js';

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories'), staleTime: 5 * 60_000 });
export const useDayTasks = (date) => useQuery({ queryKey: ['tasks', 'day', date], queryFn: () => api.get(`/tasks/day?date=${date}`) });
export const useAllTasks = (enabled = true) => useQuery({ queryKey: ['tasks', 'all'], queryFn: () => api.get('/tasks'), enabled });
export const useTaskSummary = (from, to) => useQuery({ queryKey: ['tasks', 'summary', from, to], queryFn: () => api.get(`/tasks/summary?from=${from}&to=${to}`) });
export const useDietProfile = () => useQuery({ queryKey: ['diet', 'profile'], queryFn: () => api.get('/diet/profile').then((r) => r.profile) });
export const useMeals = (date) => useQuery({ queryKey: ['diet', 'meals', date], queryFn: () => api.get(`/diet/meals?date=${date}`) });
export const useFoods = () => useQuery({ queryKey: ['diet', 'foods'], queryFn: () => api.get('/diet/foods'), staleTime: 60_000 });
export const useWeights = () => useQuery({ queryKey: ['diet', 'weights'], queryFn: () => api.get('/diet/weights') });
export const useTransactions = (from, to) => useQuery({ queryKey: ['money', 'tx', from, to], queryFn: () => api.get(`/money/transactions?from=${from}&to=${to}`) });
export const useMoneySummary = (from, to) => useQuery({ queryKey: ['money', 'summary', from, to], queryFn: () => api.get(`/money/summary?from=${from}&to=${to}`) });
export const useWorkouts = (from, to) => useQuery({ queryKey: ['gym', from, to], queryFn: () => api.get(`/gym/workouts?from=${from}&to=${to}`) });
export const useProgress = (params) => {
  const qs = new URLSearchParams(params).toString();
  return useQuery({ queryKey: ['progress', qs], queryFn: () => api.get(`/progress?${qs}`), placeholderData: (prev) => prev });
};

// Any change can affect the progress charts, so they are always refreshed too.
export function useRefresh() {
  const qc = useQueryClient();
  return (...roots) => {
    roots.forEach((r) => qc.invalidateQueries({ queryKey: [r] }));
    qc.invalidateQueries({ queryKey: ['progress'] });
  };
}

// Tick a task on/off instantly, then confirm with the server.
export function useToggleTask(date) {
  const qc = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, done }) => api.post(`/tasks/${id}/toggle`, { date, done }),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ['tasks', 'day', date] });
      const prev = qc.getQueryData(['tasks', 'day', date]);
      qc.setQueryData(['tasks', 'day', date], (list) => list?.map((t) => (t.id === id ? { ...t, done } : t)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['tasks', 'day', date], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks', 'summary'] });
      qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}
