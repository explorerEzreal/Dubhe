import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App as AntApp, ConfigProvider, theme as antTheme } from 'antd';

type ThemeMode = 'light' | 'dark';
type ThemeContextValue = { mode: ThemeMode; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme 必须在 AppProviders 内使用');
  return context;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => localStorage.getItem('shibawork_theme') === 'dark' ? 'dark' : 'light');
  useEffect(() => { document.documentElement.dataset.theme = mode; localStorage.setItem('shibawork_theme', mode); }, [mode]);
  const value = useMemo(() => ({ mode, toggleTheme: () => setMode((current) => current === 'light' ? 'dark' : 'light') }), [mode]);
  return <ThemeContext.Provider value={value}><ConfigProvider theme={{ algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm, token: { colorPrimary: mode === 'dark' ? '#34d399' : '#10b981', borderRadius: 10 } }}><AntApp>{children}</AntApp></ConfigProvider></ThemeContext.Provider>;
}
