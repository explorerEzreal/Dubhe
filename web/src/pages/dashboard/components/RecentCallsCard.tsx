import { FileTextOutlined } from '@ant-design/icons';
import { Card, Tag } from 'antd';
import { ContentLoadingState, ErrorState } from '../../../components';
import type { DashboardRequest } from '../dashboard-view-model';
import './RecentCallsCard.less';

type Props = {
  requests: DashboardRequest[];
  truncated: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
};

const labels = {
  success: ['成功', 'success'],
  warning: ['降级', 'warning'],
  error: ['失败', 'error'],
} as const;

export function RecentCallsCard({ requests, truncated, loading, error, onRetry }: Props): JSX.Element {
  const hasData = requests.length > 0;

  return (
    <Card
      className='design-card design-recent'
      title={<span className='design-card-title'><FileTextOutlined />最近调用 <small>仅展示最新 {requests.length} 条</small></span>}
      extra={<button className='view-all'>查看全部</button>}
    >
      {error && hasData && <ErrorState onRetry={onRetry} />}
      <div className='recent-table-wrap'>
        {error && !hasData ? <ErrorState onRetry={onRetry} /> : loading && !hasData ? <ContentLoadingState /> : (
          <>
            <table className='recent-table'>
              <thead><tr><th>时间</th><th>用户</th><th>分组</th><th>模型</th><th>设备</th><th>状态</th><th>延迟</th><th>Token</th></tr></thead>
              <tbody>{requests.map((item) => <tr key={item.id}>
                <td className='mono'>{item.time}</td><td>{item.user}</td><td>{item.group}</td><td>{item.model}</td><td>{item.device}</td>
                <td><Tag color={labels[item.status][1]}>{labels[item.status][0]}</Tag></td>
                <td className='mono'>{item.latency == null ? '—' : `${item.latency} ms`}</td><td className='mono'>{item.tokens.toLocaleString()}</td>
              </tr>)}</tbody>
            </table>
            {!requests.length && <div className='dashboard-empty'>暂无调用记录</div>}
          </>
        )}
      </div>
      <div className='table-foot'><span>{loading ? '刷新中...' : truncated ? '最近调用已截断' : `共 ${requests.length} 条记录`}</span><span className='mono'>实时数据</span></div>
    </Card>
  );
}
