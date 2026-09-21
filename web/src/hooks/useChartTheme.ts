import { useMemo } from 'react';
import { useAppTheme } from '../app/providers';
import { getPalette } from '../styles/theme';

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
 * 图表主题：让 ECharts 跟随系统深浅模式。
 * 之前图表颜色全部硬编码，深色模式下坐标轴与文字发灰发闷，这里统一收口。
 */
export function useChartTheme(): ChartTheme {
  const { mode } = useAppTheme();
  return useMemo(() => {
    const p = getPalette(mode);
    return {
      palette: p.chart.palette,
      axisLine: p.border.secondary,
      axisLabel: p.chart.axis,
      splitLine: p.chart.splitLine,
      text: p.chart.text,
      tooltipBg: p.chart.tooltipBg,
      tooltipBorder: p.chart.tooltipBorder,
      tooltipText: p.text.primary,
      error: p.status.error,
      status: { ...p.device },
    };
  }, [mode]);
}

/**
 * 设备状态色：图表、圆点指示、筛选按钮共用一套语义色，跟随深浅模式。
 * 原实现为模块级硬编码常量，深色模式下对比度不足。
 */
export function useStatusTone(): Record<string, string> {
  const { mode } = useAppTheme();
  return useMemo(() => {
    const { device } = getPalette(mode);
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
