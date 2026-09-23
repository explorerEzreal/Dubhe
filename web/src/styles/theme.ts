import { theme as antTheme, type ThemeConfig } from 'antd';

export type AppThemeMode = 'light' | 'dark';

export const appThemeColors = {
  light: {
    primary: '#00c29a',
    sidebar: '#f0f0f0',
    sidebarBackground: '#ffffff',
    contentBackground: 'linear-gradient(135deg, #f5fffd 0%, #f7fbff 52%, #ffffff 100%)',
    deviceTrack: '#e2e8f0',
  },
  dark: {
    primary: '#34d399',
    sidebar: '#202020',
    sidebarBackground: '#202020',
    contentBackground: 'linear-gradient(135deg, #172b35 0%, #182332 52%, #171b26 100%)',
    deviceTrack: '#202b3a',
  },
} as const;

export function createAppTheme(mode: AppThemeMode): ThemeConfig {
  const colors = appThemeColors[mode];
  return {
    algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: colors.primary,
      borderRadius: 10,
      boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
      boxShadowSecondary: '0 4px 12px rgba(16, 24, 40, 0.12)',
    },
    components: {
      Card: { borderRadiusLG: 12 },
    },
  };
}
