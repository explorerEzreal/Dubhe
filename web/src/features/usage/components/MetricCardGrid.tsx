import { Card, Statistic } from 'antd';
import type { ReactNode } from 'react';

export type UsageMetric = {
  key: string;
  title: string;
  value: string | number;
  suffix?: string;
  prefix?: ReactNode;
};

export function MetricCardGrid({ items }: { items: UsageMetric[] }): JSX.Element {
  return <div className='metric-grid'>{items.map((item) => <Card key={item.key}><Statistic title={item.title} value={item.value} suffix={item.suffix} prefix={item.prefix} /></Card>)}</div>;
}
