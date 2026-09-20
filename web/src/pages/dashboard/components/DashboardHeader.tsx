import { Button, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import './DashboardHeader.less';

export function DashboardHeader({ generatedAt, loading, onRefresh }: { generatedAt: string; loading: boolean; onRefresh: () => void }): JSX.Element {
  return <header className='design-dashboard-head'><div><Typography.Title level={1}>仪表盘</Typography.Title><div className='design-dashboard-sub'><span className='status-dot' />数据更新于 <span className='mono'>{generatedAt ? new Date(generatedAt).toLocaleString() : '—'}</span><span>·</span><span>每 15 秒自动刷新</span></div></div><Button className='design-refresh' loading={loading} icon={<ReloadOutlined />} onClick={onRefresh}>刷新</Button></header>;
}
