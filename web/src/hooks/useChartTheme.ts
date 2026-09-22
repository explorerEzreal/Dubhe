import { useMemo } from 'react';
import { useAppTheme } from '../app/providers';

export interface ChartTheme {
  /** 系列配色，深浅模式各自一套 */
  palette: string[];
  axisLine: string;
  axisLabel: string;
  splitLine: string;
  text: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  /** 语义红：错误率等「越低越好」的指标专用，避免被当成普通系列色 */
  error: string;
  /** 内嵌轨道底色（Progress trail 等 canvas 场景不能用 var()，必须传字面量） */
  track: string;
  /** 设备/模型状态色，保证图表与界面状态语义一致 */
  status: {
    online: string;
    connecting: string;
    degraded: string;
    offline: string;
    revoked: string;
    neutral: string;
  };
}

/**
 * 图表主题兼容层：保留当前组件接口，颜色恢复为线上原始图表色。
 */
export function useChartTheme(): ChartTheme {
  const { mode } = useAppTheme();
  return useMemo(() => {
    const dark = mode === 'dark';
    return {
      palette: dark ? ['#48c8bd', '#22d3ee', '#fb7185'] : ['#2e90fa', '#00c29a', '#f04438'],
      axisLine: dark ? '#334155' : '#E2E8EA',
      axisLabel: dark ? '#94a3b8' : '#667085',
      splitLine: dark ? '#243142' : '#EEF2F2',
      text: dark ? '#e2e8f0' : '#475569',
      tooltipBg: dark ? '#1f2937' : '#FFFFFF',
      tooltipBorder: dark ? '#334155' : '#E2E8EA',
      tooltipText: dark ? '#e2e8f0' : '#0F172A',
      error: dark ? '#fb7185' : '#f04438',
      track: dark ? '#202b3a' : '#e2e8f0',
      status: dark
        ? { online: '#35d399', connecting: '#fbbf24', degraded: '#f97316', offline: '#64748b', revoked: '#ef4444', neutral: '#94a3b8' }
        : { online: '#059669', connecting: '#D97706', degraded: '#EA580C', offline: '#64748b', revoked: '#DC2626', neutral: '#94a3b8' },
    };
  }, [mode]);
}

/**
 * 设备状态色：图表、圆点指示、筛选按钮共用线上原始语义色。
 */
export function useStatusTone(): Record<string, string> {
  const { mode } = useAppTheme();
  return useMemo(() => {
    const device = mode === 'dark'
      ? { online: '#35d399', connecting: '#fbbf24', degraded: '#f97316', offline: '#64748b', revoked: '#ef4444', neutral: '#94a3b8' }
      : { online: '#059669', connecting: '#D97706', degraded: '#EA580C', offline: '#64748b', revoked: '#DC2626', neutral: '#94a3b8' };
    return {
      all: device.neutral,
      created: device.neutral,
      connecting: device.connecting,
      online: device.online,
      degraded: device.degraded,
      offline: device.offline,
      revoked: device.revoked,
    };
  }, [mode]);
}
