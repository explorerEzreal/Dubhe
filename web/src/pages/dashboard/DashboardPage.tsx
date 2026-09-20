import { DatabaseOutlined, DeploymentUnitOutlined, TeamOutlined } from '@ant-design/icons';
import { Alert, Empty } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usageApi } from '../../api/usage-api';
import { useAsyncList } from '../../hooks';
import { DataQualityBar, DashboardHeader, DashboardToolbar, DistributionCard, HealthCard, KpiGrid, RecentCallsCard, TrendCard } from './components';
import { toDashboardViewModel, type DashboardViewModel } from './dashboard-view-model';
import './DashboardPage.less';

type RangeKey = 'today' | '7d' | '30d' | 'custom';
const emptyViewModel: DashboardViewModel = { generatedAt: '', granularity: 'day', trend: [], kpis: [{ key: 'calls', label: '总请求数', value: '0', unit: '', delta: '—', tone: 'blue' }, { key: 'tokens', label: '总 Token', value: '0', unit: '', delta: '—', tone: 'green' }, { key: 'errors', label: '错误率', value: '0', unit: '%', delta: '—', tone: 'red' }, { key: 'latency', label: 'P95 延迟', value: '0', unit: 'ms', delta: '—', tone: 'purple' }, { key: 'devices', label: '活跃设备', value: '0', unit: '/ 0', delta: '—', tone: 'teal' }], health: { todayTokens: '0', activeUsers: '0', activeKeys: '0', p95: '0 ms', lastCall: '—', inputTokens: '0', outputTokens: '0', inputRatio: 0, errorRate: 0 }, distributions: { models: [], groups: [], devices: [] }, requests: [], quality: { missingTokens: 0, ungrouped: '0', truncated: false } };

function rangeDates(range: RangeKey, custom: [Dayjs, Dayjs]): [Dayjs, Dayjs] { const end = dayjs(); if (range === 'today') return [end.startOf('day'), end]; if (range === '7d') return [end.subtract(6, 'day').startOf('day'), end]; if (range === '30d') return [end.subtract(29, 'day').startOf('day'), end]; return custom; }

export function DashboardPage(): JSX.Element {
  const [range, setRange] = useState<RangeKey>('30d');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()]);
  const [granularity, setGranularity] = useState<'hour' | 'day'>('day');
  const firstLoad = useRef(true);
  const [from, to] = rangeDates(range, customRange);
  const load = useCallback(() => usageApi.monitoring(from.toISOString(), to.toISOString(), granularity), [from, granularity, to]);
  const dashboard = useAsyncList(load, { poll: true });
  useEffect(() => { if (firstLoad.current) { firstLoad.current = false; return; } dashboard.reload(); }, [range, customRange, granularity]);
  const data = dashboard.data ? toDashboardViewModel(dashboard.data) : emptyViewModel;
  const hasData = Boolean(dashboard.data);
  const pointCount = data.trend.length;
  const handleRange = (value: RangeKey): void => { setRange(value); if (value === 'today') setGranularity('hour'); else if (value !== 'custom') setGranularity('day'); };
  const title = useMemo(() => dashboard.error ? '请求失败，请稍后重试' : '', [dashboard.error]);
  return <section className='design-dashboard'>
    <DashboardHeader generatedAt={data.generatedAt} loading={dashboard.loading} onRefresh={() => dashboard.reload()} />
    {dashboard.error && <Alert className='design-dashboard-alert' type='error' showIcon message={title} action={<button onClick={() => dashboard.reload()}>重试</button>} />}
    <DashboardToolbar range={range} customRange={customRange} granularity={granularity} pointCount={pointCount} onRangeChange={handleRange} onCustomRangeChange={setCustomRange} onGranularityChange={setGranularity} />
    {dashboard.loading && !hasData ? <div className='dashboard-loading'>正在加载监控数据...</div> : <>
      <KpiGrid items={data.kpis} />
      <div className='design-main-row'><TrendCard trend={data.trend} granularity={data.granularity} /><HealthCard health={data.health} /></div>
      <div className='design-distribution-row'><DistributionCard title='模型分布' icon={<DatabaseOutlined />} items={data.distributions.models} /><DistributionCard title='分组使用分布' icon={<TeamOutlined />} items={data.distributions.groups} /><DistributionCard title='设备分布' icon={<DeploymentUnitOutlined />} items={data.distributions.devices} /></div>
      <RecentCallsCard requests={data.requests} truncated={data.quality.truncated} /><DataQualityBar quality={data.quality} />
      {!data.trend.length && !data.requests.length && <div className='dashboard-empty-summary'><Empty description='该时间范围内没有调用记录' /></div>}
    </>}
  </section>;
}
