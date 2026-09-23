import { ClockCircleOutlined, DatabaseOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { MetricGrid, type MetricItem } from '../../../components';
import type { DashboardViewModel } from '../dashboard-view-model';

const icons = { calls: FileTextOutlined, tokens: DatabaseOutlined, latency: ClockCircleOutlined, devices: ThunderboltOutlined };

export function KpiGrid({ items }: { items: DashboardViewModel['kpis'] }): JSX.Element {
  const metrics: MetricItem[] = items.map((item) => {
    const Icon = icons[item.key as keyof typeof icons];
    return { ...item, icon: <Icon /> };
  });
  return <MetricGrid items={metrics} />;
}
