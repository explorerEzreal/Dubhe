import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { App as AntApp, ConfigProvider, theme as antTheme } from 'antd';
import { THEME_STORAGE_KEY } from '../constants';
import { getPalette, toCssVars, type ThemeMode } from '../styles/theme';

type ThemeContextValue = { mode: ThemeMode; setTheme: (mode: ThemeMode) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme 必须在 AppProviders 内使用');
  return context;
}

/** 将统一色板同步到 :root 的 CSS 自定义属性，供 global.less 与各页面消费 */
function ThemeSync() {
  const { mode } = useAppTheme();

  // layout effect：在浏览器绘制前完成，避免切换主题时闪白
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    const vars = toCssVars(getPalette(mode));
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    root.style.colorScheme = mode;
  }, [mode]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'),
  );
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const theme = useMemo(() => {
    const p = getPalette(mode);
    return {
      algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        // 品牌：翡翠青
        colorPrimary: p.brand.primary,
        colorPrimaryHover: p.brand.primaryHover,
        colorPrimaryActive: p.brand.primaryActive,
        colorPrimaryBg: p.brand.primaryBg,
        colorPrimaryBorder: p.brand.primaryBorder,
        colorPrimaryText: p.brand.primaryText,
        // 表面层级：卡片浮起、侧栏沉底
        colorBgLayout: p.surface.layout,
        colorBgContainer: p.surface.container,
        colorBgElevated: p.surface.elevated,
        colorBgTextHover: p.surface.hover,
        // 文字
        colorText: p.text.primary,
        colorTextSecondary: p.text.secondary,
        colorTextTertiary: p.text.tertiary,
        colorTextQuaternary: p.text.tertiary,
        colorIcon: p.text.icon,
        colorIconHover: p.text.iconHover,
        // 描边与分割
        colorBorder: p.border.base,
        colorBorderSecondary: p.border.secondary,
        colorSplit: p.border.split,
        // 填充
        colorFill: p.fill.content,
        colorFillSecondary: p.fill.secondary,
        colorFillTertiary: p.fill.tertiary,
        colorFillQuaternary: p.fill.secondary,
        // 语义色
        colorSuccess: p.status.success,
        colorWarning: p.status.warning,
        colorError: p.status.error,
        colorInfo: p.status.info,
        // 形态
        borderRadius: 10,
        borderRadiusSM: 8,
        borderRadiusLG: 14,
        fontSize: 14,
        controlHeight: 34,
        lineHeight: 1.5714,
        fontFamily:
          "Inter, system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      },
      components: {
        Layout: {
          bodyBg: p.surface.layout,
          siderBg: p.surface.sidebar,
          headerBg: p.surface.container,
          triggerBg: p.surface.sidebar,
          triggerColor: p.text.icon,
        },
        // 卡片浮起：柔和阴影替代原来的纯边框
        Card: {
          boxShadow: p.shadow.card,
          headerBg: 'transparent',
          headerFontSize: 15,
          paddingLG: 20,
        },
        Button: {
          primaryShadow: 'none',
          defaultShadow: 'none',
          dangerShadow: 'none',
          fontWeight: 500,
        },
        Table: {
          headerBg: p.surface.track,
          headerColor: p.text.secondary,
          headerSplitColor: 'transparent',
          rowHoverBg: p.surface.hover,
          borderColor: p.border.secondary,
        },
        Input: { activeShadow: p.glow, hoverBorderColor: p.brand.primary },
        InputNumber: { activeShadow: p.glow },
        Select: { optionSelectedBg: p.surface.active, optionActiveBg: p.surface.hover },
        Tag: { defaultBg: p.fill.content, defaultColor: p.text.secondary },
        Tooltip: { colorBgSpotlight: p.surface.elevated, colorTextLightSolid: p.text.primary },
        Modal: { contentBg: p.surface.elevated, headerBg: p.surface.elevated },
        Drawer: { colorBgElevated: p.surface.elevated },
        Popover: { colorBgElevated: p.surface.elevated },
        Dropdown: { colorBgElevated: p.surface.elevated },
        Progress: { remainingColor: p.surface.track },
        Statistic: { contentFontSize: 24 },
      },
      cssVar: { prefix: 'ant', key: 'app-theme' },
    };
  }, [mode]);

  const value = useMemo(() => ({ mode, setTheme: setMode }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={theme}>
        <AntApp>
          <ThemeSync />
          {children}
        </AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
