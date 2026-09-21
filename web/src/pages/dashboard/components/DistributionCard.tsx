import { Card, Empty } from 'antd';
import type { ReactNode } from 'react';
import { useChartTheme } from '../../../hooks/useChartTheme';
import type { DashboardDistribution, DashboardViewModel } from '../dashboard-view-model';
import './DistributionCard.less';

export function DistributionCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: ReactNode;
  items: DashboardDistribution[];
}): JSX.Element {
  const chart = useChartTheme();
  const colors = chart.palette;

  if (!items.length)
    return (
      <Card
        className='design-card design-distribution'
        title={
          <span className='design-card-title'>
            {icon}
            {title}
          </span>
        }
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description='暂无分布数据'
        />
      </Card>
    );

  let cursor = 0;
  const stops = items
    .map((item, index) => {
      const start = cursor;
      cursor += item.value;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    })
    .join(', ');

  return (
    <Card
      className='design-card design-distribution'
      title={
        <span className='design-card-title'>
          {icon}
          {title}
        </span>
      }
    >
      <div className='distribution-body'>
        <div className='donut' style={{ background: `conic-gradient(${stops})` }}>
          <div>
            <b className='mono'>100%</b>
            <span>Token</span>
          </div>
        </div>
        <div className='distribution-rank'>
          {items.slice(0, 8).map((item, index) => (
            <div className='rank-item' key={item.id}>
              <div className='rank-name'>
                <i style={{ background: colors[index % colors.length] }} />
                {item.name}
              </div>
              <b className='mono'>{item.value}%</b>
              <div className='rank-track'>
                <span
                  style={{
                    width: `${item.value}%`,
                    background: colors[index % colors.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function distributionItems(
  data: DashboardViewModel['distributions'],
): DashboardDistribution[] {
  return data.models;
}
