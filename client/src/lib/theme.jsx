import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeCtx = createContext(null);
const KEY = 'docket_theme';

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem(KEY) || 'system');
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0B1220' : '#F3F5F9');
  }, [isDark]);

  const value = useMemo(
    () => ({
      mode,
      isDark,
      setMode: (m) => {
        localStorage.setItem(KEY, m);
        setMode(m);
      },
    }),
    [mode, isDark]
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// Hex values for charts (SVG attributes can't reliably use CSS variables everywhere).
export function useChartColors() {
  const { isDark } = useTheme();
  return isDark
    ? { brand: '#7C96FF', brass: '#D6A852', good: '#4AC88C', bad: '#FF767C', grid: '#23314C', track: '#1B2740', muted: '#94A1BA', ink: '#ECF0F8', card: '#131C2E' }
    : { brand: '#2B4BDB', brass: '#B7862F', good: '#168C5A', bad: '#D63C42', grid: '#E2E7F0', track: '#EEF1F7', muted: '#647188', ink: '#0E1A2F', card: '#FFFFFF' };
}
