import { ClockCircleOutlined, DatabaseOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { DashboardViewModel } from '../dashboard-view-model';
import './KpiGrid.less';

const icons = { calls: FileTextOutlined, tokens: DatabaseOutlined, latency: ClockCircleOutlined, devices: ThunderboltOutlined };

export function KpiGrid({ items }: { items: DashboardViewModel['kpis'] }): JSX.Element {
  return <div className='design-kpis'>{items.map((item) => {
    const Icon = icons[item.key as keyof typeof icons];
    return <article className={`design-kpi ${item.tone}`} key={item.key}>
      <span className='kpi-icon'><Icon /></span>
      <div className='kpi-content'>
        <span className='kpi-label'>{item.label}</span>
        <div className='kpi-value-row'><b className='kpi-value mono'>{item.value}</b><span className='kpi-unit'>{item.unit}</span></div>
      </div>
    </article>;
  })}</div>;
}
