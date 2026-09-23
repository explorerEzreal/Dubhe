import { theme as antTheme, type ThemeConfig } from 'antd';

export type AppThemeMode = 'light' | 'dark';

export const appThemeColors = {
  light: {
    primary: '#00c29a',
    success: '#00c29a',
    warning: '#f79009',
    error: '#f04438',
    sidebar: '#f0f0f0',
    sidebarBackground: '#ffffff',
    contentBackground: 'linear-gradient(135deg, #f5fffd 0%, #f7fbff 52%, #ffffff 100%)',
    deviceTrack: '#e2e8f0',
  },
  dark: {
    primary: '#34d399',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f97066',
    sidebar: '#202020',
    sidebarBackground: '#202020',
    contentBackground: 'linear-gradient(135deg, #172b35 0%, #182332 52%, #171b26 100%)',
    deviceTrack: '#202b3a',
  },
} as const;

export function createAppTheme(mode: AppThemeMode): ThemeConfig {
  const colors = appThemeColors[mode];
  const table = mode === 'dark'
    ? {
      headerBg: '#252a32',
      headerColor: '#c7ced8',
      headerSplitColor: '#3b4350',
      borderColor: '#3b4350',
      rowHoverBg: '#2a313b',
      rowSelectedBg: '#123b35',
      rowSelectedHoverBg: '#17483f',
      rowExpandedBg: '#202d2b',
    }
    : {
      headerBg: '#f7f8fa',
      headerColor: '#667085',
      headerSplitColor: '#e4e7ec',
      borderColor: '#e4e7ec',
      rowHoverBg: '#fafbfc',
      rowSelectedBg: '#e6fffa',
      rowSelectedHoverBg: '#d9fff5',
      rowExpandedBg: '#f8fffd',
    };
  return {
    algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: colors.primary,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError: colors.error,
      borderRadius: 10,
      boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
      boxShadowSecondary: '0 4px 12px rgba(16, 24, 40, 0.12)',
    },
    components: {
      Card: { borderRadiusLG: 12 },
      Table: {
        ...table,
        headerBorderRadius: 8,
        cellPaddingBlock: 12,
        cellPaddingInline: 16,
        cellPaddingBlockMD: 18,
        cellPaddingInlineMD: 16,
        cellPaddingBlockSM: 10,
        cellPaddingInlineSM: 12,
        cellFontSize: 13,
        cellFontSizeMD: 13,
        cellFontSizeSM: 12,
      },
    },
  };
}
