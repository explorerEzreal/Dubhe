import { useCallback, useMemo, useState } from 'react';
import { Card, DatePicker, Segmented, Space, Statistic, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import dayjs, { type Dayjs } from 'dayjs';
import { usageApi, type MonitoringData } from '../../api/usage-api';
import { groupApi } from '../../api/group-api';
import { ContentLoadingState, ErrorState } from '../../components';
import { useAsyncList } from '../../hooks';
import { useAuthStore } from '../../state';

export function DashboardPage() {
  const role = useAuthStore((state) => state.role);
  const [scope, setScope] = useState<'deployer' | 'caller'>('caller');
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()]);
  const load = useCallback(async () => {
    const groups = await groupApi.list();
    const canViewDeployer = role === 'admin' || role === 'super_admin' || groups.length > 0;
    const activeScope = canViewDeployer ? scope : 'caller';
    return { monitoring: await usageApi.monitoring(activeScope, range[0].startOf('day').toISOString(), range[1].endOf('day').toISOString()), canViewDeployer };
  }, [range, role, scope]);
  const dashboard = useAsyncList(load, { poll: true });
  const data = dashboard.data?.monitoring as MonitoringData | undefined;
  const canViewDeployer = dashboard.data?.canViewDeployer ?? false;
  const chart = useMemo(() => ({ tooltip: { trigger: 'axis' }, legend: { data: ['Token', '调用次数'] }, xAxis: { type: 'category', data: data?.trend.map((item) => new Date(item.date).toLocaleDateString()) ?? [] }, yAxis: [{ type: 'value' }, { type: 'value' }], series: [{ name: 'Token', type: 'line', smooth: true, data: data?.trend.map((item) => item.totalTokens) ?? [] }, { name: '调用次数', type: 'bar', yAxisIndex: 1, data: data?.trend.map((item) => item.totalCalls) ?? [] }] }), [data]);
  if (dashboard.loading && !data) return <ContentLoadingState />;
  if (dashboard.error && !data) return <ErrorState onRetry={() => void dashboard.reload()} />;
  const overview = data?.overview;
  const today = data?.todayOverview;
  const cards: Array<[string, string | number, string?]> = [
    ['总调用数', overview?.totalCalls ?? 0], ['总 Token', overview?.totalTokens ?? 0], ['错误率', `${((overview?.errorRate ?? 0) * 100).toFixed(1)}%`], ['P95 延迟', overview?.p95LatencyMs ?? 0, 'ms'],
    ['今日调用数', today?.totalCalls ?? 0], ['今日 Token', today?.totalTokens ?? 0], ['活跃用户数', overview?.activeUsers ?? 0], ['活跃 API Key 数', overview?.activeApiKeys ?? 0],
  ];
  const ranking = (title: string, items: Array<{ name?: string; email?: string; totalTokens: number }>) => <Card title={title}><ReactECharts option={{ xAxis: { type: 'value' }, yAxis: { type: 'category', data: items.slice(0, 5).map((item) => item.name ?? item.email ?? '未知') }, series: [{ type: 'bar', data: items.slice(0, 5).map((item) => item.totalTokens) }] }} style={{ height: 260 }} /></Card>;
  return <section>
    <div className='dashboard-header'><div><Typography.Title level={1}>仪表盘</Typography.Title><Typography.Paragraph type='secondary'>统一观察系统流量、Token 消耗和调用质量。</Typography.Paragraph></div><Space wrap>{canViewDeployer && <Segmented value={scope} onChange={(value) => setScope(value as 'deployer' | 'caller')} options={[{ label: '运营总览', value: 'deployer' }, { label: '我的使用', value: 'caller' }]} />}<DatePicker.RangePicker value={range} onChange={(value) => { if (value?.[0] && value?.[1]) setRange([value[0], value[1]]); }} /></Space></div>
    <div className='metric-grid'>{cards.map(([title, value, suffix]) => <Card key={title}><Statistic title={title} value={value} suffix={suffix} /></Card>)}</div>
    {data && <><Card title='Token 与调用趋势' style={{ marginTop: 16 }}><ReactECharts option={chart} style={{ height: 340 }} /></Card><div className='metric-grid' style={{ marginTop: 16 }}>{ranking('分组排行', data.groups)}{ranking('用户排行', data.users)}{ranking('API Key 排行', data.apiKeys.map((item) => ({ ...item, name: item.prefix })))}{ranking('模型排行', data.models)}{ranking('设备排行', data.agents)}</div><Typography.Text type='secondary'>数据更新时间：{new Date(data.generatedAt).toLocaleString()}；缺失 Token：{data.dataQuality.missingTokenCalls} 次</Typography.Text></>}
  </section>;
}
