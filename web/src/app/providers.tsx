import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App as AntApp, ConfigProvider, theme as antTheme } from 'antd';
import { THEME_STORAGE_KEY } from '../constants';

type ThemeMode = 'light' | 'dark';
type ThemeContextValue = { mode: ThemeMode; setTheme: (mode: ThemeMode) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme 必须在 AppProviders 内使用');
  return context;
}

/** 将 antd 计算后的 theme token 同步到 :root 的 CSS 自定义属性 */
function ThemeSync() {
  const { token } = antTheme.useToken();
  const { mode } = useAppTheme();

  useEffect(() => {
    const root = document.documentElement;
    // 侧栏背景色不来自 antd token，手动按模式设置
    root.style.setProperty('--sidebar-bg', mode === 'dark' ? '#202020' : '#f0f0f0');
    root.style.setProperty('--content-bg', token.colorBgLayout);
    root.style.setProperty('--panel-bg', token.colorBgElevated);
    root.style.setProperty('--text-color', token.colorText);
    root.style.setProperty('--menu-color', token.colorTextSecondary);
    root.style.setProperty('--icon-color', token.colorIcon);
    root.style.setProperty('--muted-color', token.colorTextTertiary);
    root.style.setProperty('--button-bg', token.colorFillContent);
    root.style.setProperty('--selected-bg', token.controlItemBgActive);
    root.style.setProperty('--active-bg', token.colorPrimaryBg);
    root.style.setProperty('--hover-bg', token.controlItemBgHover);
    root.style.setProperty('--border-color', token.colorBorderSecondary);
    root.style.setProperty('--accent-color', token.colorPrimary);
    root.style.setProperty('--focus-color', token.colorPrimary);
    root.style.setProperty('--device-track', mode === 'dark' ? '#202b3a' : '#e2e8f0');
  }, [token, mode]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'),
  );
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);
  const value = useMemo(() => ({ mode, setTheme: setMode }), [mode]);
  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: {
            colorPrimary: mode === 'dark' ? '#34d399' : '#00c29a',
            borderRadius: 10,
          },
          cssVar: { prefix: 'ant', key: 'app-theme' },
        }}
      >
        <AntApp>
          <ThemeSync />
          {children}
        </AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
