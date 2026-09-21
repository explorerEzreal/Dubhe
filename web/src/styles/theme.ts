/**
 * 统一主题色板 —— 全系统唯一色彩来源
 *
 * 设计方向：翡翠青（Teal）主色 + 深青墨深底 + 鲜明现代视觉强度
 *
 * 层级逻辑（浅色）：
 *   卡片 #FFFFFF（最亮，浮起） > 内容底 #F4F7F8 > 侧栏 #EDF2F2（最沉，承载导航）
 * 层级逻辑（深色）：
 *   浮层 #1A2A28 > 卡片 #131F1E > 侧栏 #0D1817 > 内容底 #0A1211（最沉）
 * 深浅两套均为「带青调中性色」，告别纯灰。
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  /** 品牌色：主色 + 青色辅助 + 渐变 */
  brand: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    /** 主色极淡底，用于选中态 / Tag 底 */
    primaryBg: string;
    primaryBgHover: string;
    primaryBorder: string;
    /** 主色在浅底上可读的文字色（强调文字、链接） */
    primaryText: string;
    /** 辅助强调色（青蓝），用于渐变终点与图表第二色 */
    secondary: string;
    gradient: string;
    /** 品牌色柔光，用于装饰性半透明叠加 */
    soft: string;
    veil: string;
  };
  /** 表面层级 */
  surface: {
    layout: string;
    container: string;
    elevated: string;
    sidebar: string;
    /** 内嵌轨道、次级面板底 */
    track: string;
    hover: string;
    /** 选中态背景 */
    active: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    icon: string;
    iconHover: string;
  };
  border: {
    base: string;
    secondary: string;
    split: string;
  };
  fill: {
    content: string;
    secondary: string;
    tertiary: string;
  };
  /** 语义色 */
  status: {
    success: string;
    successBg: string;
    warning: string;
    warningBg: string;
    error: string;
    errorBg: string;
    info: string;
    infoBg: string;
  };
  /** 设备/模型状态色（语义化，不再是裸 hex） */
  device: {
    online: string;
    connecting: string;
    degraded: string;
    offline: string;
    revoked: string;
    neutral: string;
  };
  /** 阴影与发光 */
  shadow: {
    card: string;
    popover: string;
    brand: string;
  };
  /** 聚焦/选中光环 */
  glow: string;
  /** 图表与数据可视化 */
  chart: {
    palette: string[];
    axis: string;
    splitLine: string;
    text: string;
    tooltipBg: string;
    tooltipBorder: string;
  };
  /** 数据可视化五色（KPI 图标、图例共用，深浅自适应） */
  dataViz: {
    teal: string;
    blue: string;
    violet: string;
    amber: string;
    pink: string;
    tealBg: string;
    blueBg: string;
    violetBg: string;
    amberBg: string;
    pinkBg: string;
  };
}

const light: ThemePalette = {
  brand: {
    // teal-600：饱和度高、视觉鲜明，非文本场景对比度 3.7:1 达标
    primary: '#0D9488',
    primaryHover: '#0F766E',
    primaryActive: '#115E59',
    primaryBg: '#E4F4F2',
    primaryBgHover: '#D2EDEA',
    primaryBorder: '#8FD8CF',
    // teal-700：正文级强调文字，白底对比 5.5:1（WCAG AA 达标）
    primaryText: '#0F766E',
    secondary: '#06B6D4',
    gradient: 'linear-gradient(135deg, #0D9488 0%, #06B6D4 100%)',
    soft: 'rgba(13, 148, 136, 0.12)',
    veil: 'rgba(13, 148, 136, 0.06)',
  },
  surface: {
    layout: '#F4F7F8',
    container: '#FFFFFF',
    elevated: '#FFFFFF',
    sidebar: '#EDF2F2',
    track: '#EAF0F0',
    hover: '#E6EDEE',
    active: '#DFF2F0',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    // 5.0:1 —— 时间戳等次要文本仍需达到 AA，不能只顾「淡」
    tertiary: '#5A6F6C',
    icon: '#6B8280',
    iconHover: '#0F172A',
  },
  border: {
    base: '#CBD5E1',
    secondary: '#E2E8EA',
    split: '#E2E8EA',
  },
  fill: {
    content: '#F1F5F5',
    secondary: '#E8EEEE',
    tertiary: '#DEE7E7',
  },
  status: {
    success: '#059669',
    successBg: '#E7F7F1',
    warning: '#D97706',
    warningBg: '#FEF3E2',
    error: '#DC2626',
    errorBg: '#FDECEC',
    info: '#0284C7',
    infoBg: '#E8F4FB',
  },
  device: {
    online: '#059669',
    connecting: '#D97706',
    degraded: '#EA580C',
    offline: '#64748B',
    revoked: '#DC2626',
    neutral: '#94A3B8',
  },
  shadow: {
    card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
    popover: '0 8px 32px rgba(15, 23, 42, 0.12)',
    brand: '0 2px 12px rgba(13, 148, 136, 0.28)',
  },
  glow: '0 0 0 3px rgba(13, 148, 136, 0.16)',
  chart: {
    palette: ['#0D9488', '#06B6D4', '#F59E0B', '#8B5CF6', '#EC4899'],
    axis: '#6B8280',
    splitLine: '#EEF2F2',
    text: '#475569',
    tooltipBg: '#FFFFFF',
    tooltipBorder: '#E2E8EA',
  },
  dataViz: {
    teal: '#00A88F',
    blue: '#2E90FA',
    violet: '#8B5CF6',
    amber: '#F59E0B',
    pink: '#EC4899',
    tealBg: 'rgba(0, 168, 143, 0.13)',
    blueBg: 'rgba(46, 144, 250, 0.13)',
    violetBg: 'rgba(139, 92, 246, 0.14)',
    amberBg: 'rgba(245, 158, 11, 0.14)',
    pinkBg: 'rgba(236, 72, 153, 0.13)',
  },
};

const dark: ThemePalette = {
  brand: {
    // teal-400：深底上 9.1:1 对比，主色在深色下依然跳脱
    primary: '#2DD4BF',
    primaryHover: '#5EEAD4',
    primaryActive: '#14B8A6',
    primaryBg: '#123330',
    primaryBgHover: '#17403C',
    primaryBorder: '#1D5450',
    primaryText: '#2DD4BF',
    secondary: '#22D3EE',
    gradient: 'linear-gradient(135deg, #2DD4BF 0%, #22D3EE 100%)',
    soft: 'rgba(45, 212, 191, 0.14)',
    veil: 'rgba(45, 212, 191, 0.08)',
  },
  surface: {
    // 深青墨：明确色彩倾向，拉开四层表面
    layout: '#0A1211',
    container: '#131F1E',
    elevated: '#1A2A28',
    sidebar: '#0D1817',
    track: '#1B2B2A',
    hover: '#172726',
    active: '#123330',
  },
  text: {
    primary: '#E6EFEE',
    secondary: '#A3B8B6',
    tertiary: '#7E968F',
    icon: '#8FA6A4',
    iconHover: '#E6EFEE',
  },
  border: {
    base: '#2A3D3B',
    secondary: '#1F2F2E',
    split: '#1F2F2E',
  },
  fill: {
    content: '#1B2B2A',
    secondary: '#223634',
    tertiary: '#2A403E',
  },
  status: {
    success: '#34D399',
    successBg: '#0F2A24',
    warning: '#FBBF24',
    warningBg: '#2E2410',
    error: '#F87171',
    errorBg: '#2E1616',
    info: '#38BDF8',
    infoBg: '#10222E',
  },
  device: {
    online: '#34D399',
    connecting: '#FBBF24',
    degraded: '#FB923C',
    offline: '#64748B',
    revoked: '#F87171',
    neutral: '#94A3B8',
  },
  shadow: {
    card: '0 1px 2px rgba(0, 0, 0, 0.40), 0 4px 16px rgba(0, 0, 0, 0.36)',
    popover: '0 8px 32px rgba(0, 0, 0, 0.56)',
    brand: '0 2px 14px rgba(45, 212, 191, 0.30)',
  },
  glow: '0 0 0 3px rgba(45, 212, 191, 0.18)',
  chart: {
    palette: ['#2DD4BF', '#22D3EE', '#FBBF24', '#A78BFA', '#F472B6'],
    axis: '#8FA6A4',
    splitLine: '#1B2B2A',
    text: '#A3B8B6',
    tooltipBg: '#1A2A28',
    tooltipBorder: '#2A3D3B',
  },
  dataViz: {
    teal: '#2DD4BF',
    blue: '#60A5FA',
    violet: '#A78BFA',
    amber: '#FBBF24',
    pink: '#F472B6',
    tealBg: 'rgba(45, 212, 191, 0.15)',
    blueBg: 'rgba(96, 165, 250, 0.15)',
    violetBg: 'rgba(167, 139, 250, 0.16)',
    amberBg: 'rgba(251, 191, 36, 0.15)',
    pinkBg: 'rgba(244, 114, 182, 0.15)',
  },
};

export const themes: Record<ThemeMode, ThemePalette> = { light, dark };

export function getPalette(mode: ThemeMode): ThemePalette {
  return themes[mode];
}

/**
 * 色板 → CSS 自定义属性映射
 * global.less 与各页面通过 var(--*) 消费，实现一处改动全站生效。
 */
export function toCssVars(p: ThemePalette): Record<string, string> {
  return {
    '--brand-primary': p.brand.primary,
    '--brand-primary-hover': p.brand.primaryHover,
    '--brand-primary-active': p.brand.primaryActive,
    '--brand-primary-bg': p.brand.primaryBg,
    '--brand-primary-border': p.brand.primaryBorder,
    '--brand-primary-text': p.brand.primaryText,
    '--brand-secondary': p.brand.secondary,
    '--brand-gradient': p.brand.gradient,
    '--brand-soft': p.brand.soft,
    '--brand-veil': p.brand.veil,
    // 旧代码里的惯用名，保留别名避免全站改名
    '--accent-color': p.brand.primary,
    '--focus-color': p.brand.primary,

    '--sidebar-bg': p.surface.sidebar,
    '--content-bg': p.surface.layout,
    '--panel-bg': p.surface.container,
    '--elevated-bg': p.surface.elevated,
    '--device-track': p.surface.track,
    '--hover-bg': p.surface.hover,
    '--active-bg': p.surface.active,

    '--text-color': p.text.primary,
    '--menu-color': p.text.secondary,
    '--muted-color': p.text.tertiary,
    '--icon-color': p.text.icon,
    '--icon-hover': p.text.iconHover,

    '--border-color': p.border.secondary,
    '--border-strong': p.border.base,
    '--split-color': p.border.split,

    '--button-bg': p.fill.content,
    '--fill-secondary': p.fill.secondary,
    '--selected-bg': p.surface.active,

    '--color-success': p.status.success,
    '--color-success-bg': p.status.successBg,
    '--color-warning': p.status.warning,
    '--color-warning-bg': p.status.warningBg,
    '--color-error': p.status.error,
    '--color-error-bg': p.status.errorBg,
    '--color-info': p.status.info,
    '--color-info-bg': p.status.infoBg,

    '--status-online': p.device.online,
    '--status-connecting': p.device.connecting,
    '--status-degraded': p.device.degraded,
    '--status-offline': p.device.offline,
    '--status-revoked': p.device.revoked,
    '--status-neutral': p.device.neutral,

    '--shadow-card': p.shadow.card,
    '--shadow-popover': p.shadow.popover,
    '--shadow-brand': p.shadow.brand,
    '--glow': p.glow,

    '--chart-axis': p.chart.axis,
    '--chart-split': p.chart.splitLine,
    '--chart-text': p.chart.text,
    '--chart-tooltip-bg': p.chart.tooltipBg,
    '--chart-tooltip-border': p.chart.tooltipBorder,
    ...Object.fromEntries(
      p.chart.palette.map((color, index) => [`--chart-${index + 1}`, color]),
    ),

    '--dv-teal': p.dataViz.teal,
    '--dv-blue': p.dataViz.blue,
    '--dv-violet': p.dataViz.violet,
    '--dv-amber': p.dataViz.amber,
    '--dv-pink': p.dataViz.pink,
    '--dv-teal-bg': p.dataViz.tealBg,
    '--dv-blue-bg': p.dataViz.blueBg,
    '--dv-violet-bg': p.dataViz.violetBg,
    '--dv-amber-bg': p.dataViz.amberBg,
    '--dv-pink-bg': p.dataViz.pinkBg,
  };
}
