import {
  DatabaseOutlined,
  DeploymentUnitOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Alert, Empty } from 'antd';
import { useMemo, useState } from 'react';
import { toMonitoringData } from '../../api/usage-api';
import { PageHeader, UsageRecordExplorer } from '../../components';
import {
  useUsageAnalyticsQuery,
  useUsageQueryState,
  useUsageRecordsQuery,
  type UsageRangeKey,
} from '../../features/usage';
import {
  DataQualityBar,
  DashboardToolbar,
  DistributionCard,
  HealthCard,
  KpiGrid,
  TrendCard,
} from './components';
import {
  toDashboardViewModel,
  type DashboardViewModel,
} from './dashboard-view-model';
import './DashboardPage.less';

const emptyViewModel: DashboardViewModel = {
  generatedAt: '',
  granularity: 'day',
  trend: [],
  kpis: [
    { key: 'calls', label: '总请求数', value: '0', unit: '', tone: 'blue' },
    { key: 'tokens', label: '总 Token', value: '0', unit: '', tone: 'green' },
    {
      key: 'latency',
      label: 'P95 延迟',
      value: '0',
      unit: 'ms',
      tone: 'purple',
    },
    {
      key: 'devices',
      label: '活跃设备',
      value: '0',
      unit: '/ 0',
      tone: 'teal',
    },
  ],
  health: {
    todayTokens: '0',
    activeUsers: '0',
    activeKeys: '0',
    p95: '0 ms',
    lastCall: '—',
    inputTokens: '0',
    outputTokens: '0',
    inputRatio: 0,
    errorRate: 0,
  },
  distributions: { models: [], groups: [], devices: [] },
  quality: { missingTokens: 0, ungrouped: '0', truncated: false },
};

export function DashboardPage(): JSX.Element {
  const state = useUsageQueryState({ initialRange: 'today' });
  const [range, setRange] = useState<UsageRangeKey>('today');
  const [granularity, setGranularity] = useState<'hour' | 'day'>('day');
  const dashboard = useUsageAnalyticsQuery(
    { ...state.query, granularity },
    { poll: true },
  );
  const records = useUsageRecordsQuery(
    { ...state.query, page: 1, pageSize: 9, includeFacets: false },
    { poll: true },
  );
  const data = dashboard.data
    ? toDashboardViewModel(toMonitoringData(dashboard.data))
    : emptyViewModel;
  const requests = records.data?.items ?? [];
  const hasData = Boolean(dashboard.data);
  const pointCount = data.trend.length;
  const handleRange = (value: UsageRangeKey): void => {
    setRange(value);
    state.updateRange(value);
    if (value === 'today') setGranularity('hour');
    else if (value !== 'custom') setGranularity('day');
  };
  const handleRefresh = async (): Promise<void> => {
    await Promise.all([dashboard.reload(), records.reload()]);
  };
  const title = useMemo(
    () => (dashboard.error ? '请求失败，请稍后重试' : ''),
    [dashboard.error],
  );
  return (
    <section className='design-dashboard'>
      <PageHeader
        title='仪表盘'
        loading={dashboard.loading || records.loading}
        onRefresh={() => void handleRefresh()}
        meta={
          <>
            <span className='status-dot' />
            数据更新于{' '}
            <span className='mono'>
              {data.generatedAt
                ? new Date(data.generatedAt).toLocaleString()
                : '—'}
            </span>
            <span>·</span>
            <span>每 15 秒自动刷新</span>
          </>
        }
        className='design-dashboard-head'
      />
      {dashboard.error && (
        <Alert
          className='design-dashboard-alert'
          type='error'
          showIcon
          message={title}
          action={<button onClick={() => void dashboard.reload()}>重试</button>}
        />
      )}
      <DashboardToolbar
        range={range}
        customRange={state.customRange}
        granularity={granularity}
        pointCount={pointCount}
        onRangeChange={handleRange}
        onCustomRangeChange={state.updateCustomRange}
        onGranularityChange={setGranularity}
      />
      {dashboard.loading && !hasData ? (
        <div className='dashboard-loading'>正在加载监控数据...</div>
      ) : (
        <>
          <KpiGrid items={data.kpis} />
          <div className='design-main-row'>
            <TrendCard trend={data.trend} granularity={data.granularity} />
            <HealthCard health={data.health} />
          </div>
          <div className='design-distribution-row'>
            <DistributionCard
              title='模型分布'
              icon={<DatabaseOutlined />}
              items={data.distributions.models}
            />
            <DistributionCard
              title='分组使用分布'
              icon={<TeamOutlined />}
              items={data.distributions.groups}
            />
            <DistributionCard
              title='设备分布'
              icon={<DeploymentUnitOutlined />}
              items={data.distributions.devices}
            />
          </div>
          <UsageRecordExplorer
            mode='dashboard'
            items={requests}
            truncated={records.data?.items.length === 9}
            loading={records.loading}
            error={records.error}
            onRetry={() => void records.reload()}
            title='最近使用'
            description='仅展示最新 9 条'
          />
          <DataQualityBar quality={data.quality} />
          {!data.trend.length && !requests.length && (
            <div className='dashboard-empty-summary'>
              <Empty description='该时间范围内没有调用记录' />
            </div>
          )}
        </>
      )}
    </section>
  );
}
