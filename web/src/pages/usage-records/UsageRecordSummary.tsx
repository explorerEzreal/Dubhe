import { ClockCircleOutlined, DatabaseOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { MonitoringData } from '../../api/usage-api';
import { formatCompact, formatInt, formatMs } from './record-utils';

type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'purple';
type Stat = { key: string; label: string; value: string; unit?: string; hint?: string; tone: StatTone; icon: ReactNode };

export function UsageRecordSummary({ data }: { data: MonitoringData }): JSX.Element | null {
  const overview = data?.overview;
  if (!overview) return null;

  const errorRate = Number(overview.errorRate ?? 0) * 100;
  const tokens = Number(overview.totalTokens ?? 0);

  const stats: Stat[] = [
    {
      key: 'calls',
      label: '请求数',
      value: formatInt(overview.totalCalls),
      unit: '次',
      hint: `活跃用户 ${formatInt(overview.activeUsers)}`,
      tone: 'primary',
      icon: <ThunderboltOutlined />,
    },
    {
      key: 'tokens',
      label: 'Token 总量',
      value: formatCompact(tokens),
      hint: `入 ${formatCompact(overview.inputTokens)} · 出 ${formatCompact(overview.outputTokens)}`,
      tone: 'success',
      icon: <DatabaseOutlined />,
    },
    {
      key: 'error',
      label: '错误率',
      value: errorRate.toFixed(2),
      unit: '%',
      tone: errorRate >= 5 ? 'danger' : 'warning',
      icon: <WarningOutlined />,
    },
    {
      key: 'latency',
      label: '平均延迟',
      value: formatMs(overview.avgLatencyMs),
      hint: `P95 ${formatMs(overview.p95LatencyMs)}`,
      tone: 'purple',
      icon: <ClockCircleOutlined />,
    },
  ];

  return (
    <div className="ur-summary">
      {stats.map((stat) => (
        <div key={stat.key} className="ur-stat" data-tone={stat.tone}>
          <div className="ur-stat-label">{stat.icon}{stat.label}</div>
          <div className="ur-stat-value">{stat.value}{stat.unit ? <span className="ur-stat-unit">{stat.unit}</span> : null}</div>
          {stat.hint ? <div className="ur-stat-hint">{stat.hint}</div> : <div className="ur-stat-hint">&nbsp;</div>}
        </div>
      ))}
    </div>
  );
}
