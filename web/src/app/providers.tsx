import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App as AntApp, ConfigProvider, theme as antTheme } from 'antd';
import { THEME_STORAGE_KEY } from '../constants';
import { appThemeColors, createAppTheme, type AppThemeMode } from '../styles/theme';

type ThemeMode = AppThemeMode;
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
    const colors = appThemeColors[mode];
    root.style.setProperty('--sidebar-bg', colors.sidebar);
    root.style.setProperty('--content-bg', token.colorBgLayout);
    root.style.setProperty('--app-sidebar-background', colors.sidebarBackground);
    root.style.setProperty('--app-content-background', colors.contentBackground);
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
    root.style.setProperty('--device-track', colors.deviceTrack);
    root.style.setProperty('--text-primary', token.colorText);
    root.style.setProperty('--text-secondary', token.colorTextSecondary);
    root.style.setProperty('--text-muted', token.colorTextTertiary);
    root.style.setProperty('--surface-page', token.colorBgLayout);
    root.style.setProperty('--surface-panel', token.colorBgContainer);
    root.style.setProperty('--surface-elevated', token.colorBgElevated);
    root.style.setProperty('--border-default', token.colorBorder);
    root.style.setProperty('--radius-card', `${token.borderRadiusLG}px`);
    root.style.setProperty('--shadow-card', token.boxShadow);
    root.style.setProperty('--shadow-elevated', token.boxShadowSecondary);
    root.style.setProperty('--status-success', token.colorSuccess);
    root.style.setProperty('--status-warning', token.colorWarning);
    root.style.setProperty('--status-error', token.colorError);
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
        theme={{ ...createAppTheme(mode), cssVar: { prefix: 'ant', key: 'app-theme' } }}
      >
        <AntApp>
          <ThemeSync />
          {children}
        </AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
