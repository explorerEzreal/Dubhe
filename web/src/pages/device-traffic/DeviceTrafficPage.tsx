import { useMemo } from 'react';
import { Card, DatePicker, Space, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { toMonitoringData, type MonitoringData } from '../../api/usage-api';
import { useUsageAnalyticsQuery, useUsageQueryState } from '../../features/usage';
import { ContentLoadingState, ErrorState } from '../../components';
import { UsageMonitoring } from '../usage-monitoring';

export function DeviceTrafficPage() {
  const state = useUsageQueryState({ initialRange: '30d' });
  const dashboard = useUsageAnalyticsQuery(state.query, { poll: true });
  const data = dashboard.data ? toMonitoringData(dashboard.data) : undefined;
  const userColumns: ColumnsType<MonitoringData['users'][number]> = useMemo(() => [
    { title: '调用用户', dataIndex: 'email' }, { title: '分组', dataIndex: 'groupName' }, { title: '调用次数', dataIndex: 'totalCalls', sorter: (a, b) => Number(a.totalCalls ?? 0) - Number(b.totalCalls ?? 0) }, { title: '总 Token', dataIndex: 'totalTokens', sorter: (a, b) => Number(a.totalTokens ?? 0) - Number(b.totalTokens ?? 0) }, { title: '平均延迟', dataIndex: 'avgLatencyMs', render: (value: number | null) => `${value ?? 0} ms` }, { title: '最近调用', dataIndex: 'lastUsedAt', render: (value: string | null) => value ? new Date(value).toLocaleString() : '暂无' },
  ], []);
  function handleRangeChange(value: [Dayjs | null, Dayjs | null] | null): void {
    const [start, end] = value ?? [];
    if (start && end) state.updateCustomRange([start, end]);
  }
  if (dashboard.loading && !data) return <ContentLoadingState />;
  if (dashboard.error && !data) return <ErrorState onRetry={() => void dashboard.reload()} />;
  const overview = data?.overview;
  return <section>
    <div className='dashboard-header'><div><Typography.Title level={1}>流量监控</Typography.Title><Typography.Paragraph type='secondary'>按分组、调用用户、API Key、模型和设备观察 Token 消耗与请求质量。</Typography.Paragraph></div><Space><DatePicker.RangePicker value={state.customRange} allowClear={false} onChange={handleRangeChange} /></Space></div>
    <div className='metric-grid'><Card><Statistic title='总调用数' value={overview?.totalCalls ?? 0} /></Card><Card><Statistic title='总 Token' value={overview?.totalTokens ?? 0} /></Card><Card><Statistic title='输入 / 输出 Token' value={`${overview?.inputTokens ?? 0} / ${overview?.outputTokens ?? 0}`} /></Card><Card><Statistic title='错误率' value={`${((overview?.errorRate ?? 0) * 100).toFixed(1)}%`} /></Card><Card><Statistic title='P95 延迟' value={overview?.p95LatencyMs ?? 0} suffix='ms' /></Card></div>
    <div className='metric-grid' style={{ marginTop: 16 }}><Card title='分组排行'><Table rowKey={(row) => row.id ?? row.name} size='small' pagination={false} dataSource={(data?.groups ?? []).slice(0, 5)} columns={[{ title: '分组', dataIndex: 'name' }, { title: 'Token', dataIndex: 'totalTokens' }]} /></Card><Card title='API Key 排行'><Table rowKey={(row) => row.id ?? row.prefix} size='small' pagination={false} dataSource={(data?.apiKeys ?? []).slice(0, 5)} columns={[{ title: 'Key', dataIndex: 'prefix' }, { title: 'Token', dataIndex: 'totalTokens' }]} /></Card><Card title='模型排行'><Table rowKey={(row) => row.id ?? row.name} size='small' pagination={false} dataSource={(data?.models ?? []).slice(0, 5)} columns={[{ title: '模型', dataIndex: 'name' }, { title: 'Token', dataIndex: 'totalTokens' }]} /></Card><Card title='设备排行'><Table rowKey={(row) => row.id ?? row.name} size='small' pagination={false} dataSource={(data?.agents ?? []).slice(0, 5)} columns={[{ title: '设备', dataIndex: 'name' }, { title: 'Token', dataIndex: 'totalTokens' }]} /></Card></div>
    <Card title='分组内调用用户用量' style={{ marginTop: 16 }}><Table rowKey={(row) => `${row.groupId ?? 'none'}-${row.id}`} size='small' dataSource={data?.users ?? []} columns={userColumns} pagination={{ pageSize: 10 }} /></Card>
    {data && <UsageMonitoring data={data} showUser />}
    <Typography.Text type='secondary'>数据更新时间：{data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : '暂无数据'}；趋势数据点：{data?.trend.length ?? 0} 天</Typography.Text>
  </section>;
}
