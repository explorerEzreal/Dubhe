import { ClockCircleOutlined, DatabaseOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import type { MonitoringData } from '../../api/usage-api';
import { MetricGrid, type MetricItem } from '../../components';
import { formatCompact, formatInt, formatMs } from './record-utils';

export function UsageRecordSummary({ data }: { data: MonitoringData }): JSX.Element | null {
  const overview = data?.overview;
  if (!overview) return null;

  const errorRate = Number(overview.errorRate ?? 0) * 100;
  const tokens = Number(overview.totalTokens ?? 0);

  const stats: MetricItem[] = [
    {
      key: 'calls',
      label: '请求数',
      value: formatInt(overview.totalCalls),
      unit: '次',
      hint: `活跃用户 ${formatInt(overview.activeUsers)}`,
      tone: 'blue',
      icon: <ThunderboltOutlined />,
    },
    {
      key: 'tokens',
      label: 'Token 总量',
      value: formatCompact(tokens),
      hint: `入 ${formatCompact(overview.inputTokens)} · 出 ${formatCompact(overview.outputTokens)}`,
      tone: 'green',
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
    <MetricGrid items={stats} />
  );
}
