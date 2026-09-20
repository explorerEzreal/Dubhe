import { useMemo, useState } from 'react';
import { Alert, Button, Card, Select, Space, Table, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { ColumnsType } from 'antd/es/table';
import type { MonitoringData } from '../../api/usage-api';

interface UsageMonitoringProps {
  data: MonitoringData;
  showUser: boolean;
}

function downloadCsv(data: MonitoringData): void {
  const header = ['时间', '用户', '分组', 'API Key', '模型', '设备', '端点', '状态', '输入 Token', '输出 Token', '总 Token', '请求字节', '响应字节', '上游状态', '延迟'];
  const escape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = data.requests.map((item) => [item.startedAt, item.email, item.groupName, item.apiKeyPrefix, item.modelName, item.agentName, item.endpoint, item.status, item.inputTokens, item.outputTokens, item.totalTokens, item.requestBytes, item.responseBytes, item.upstreamStatusCode, item.latencyMs].map(escape).join(','));
  const blob = new Blob([`\uFEFF${[header.join(','), ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `流量使用日志-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}

export function UsageMonitoring({ data, showUser }: UsageMonitoringProps) {
  const [status, setStatus] = useState('all');
  const [group, setGroup] = useState('all');
  const [model, setModel] = useState('all');
  const requests = useMemo(() => data.requests.filter((item) => (status === 'all' || item.status === status) && (group === 'all' || item.groupName === group) && (model === 'all' || item.modelName === model)), [data.requests, group, model, status]);
  const columns: ColumnsType<MonitoringData['requests'][number]> = [
    { title: '时间', dataIndex: 'startedAt', render: (value: string) => new Date(value).toLocaleString() },
    ...(showUser ? [{ title: '用户', dataIndex: 'email' }] : []),
    { title: '分组', dataIndex: 'groupName' }, { title: 'API Key', dataIndex: 'apiKeyPrefix' }, { title: '模型', dataIndex: 'modelName' },
    { title: '输入', dataIndex: 'inputTokens', render: (value: number | null) => value ?? '缺失' }, { title: '输出', dataIndex: 'outputTokens', render: (value: number | null) => value ?? '缺失' }, { title: '总 Token', dataIndex: 'totalTokens' },
    { title: '端点', dataIndex: 'endpoint', render: (value: string | null | undefined) => value ?? '—' }, { title: '请求/响应', key: 'bytes', render: (_: unknown, item) => `${item.requestBytes ?? 0} / ${item.responseBytes ?? 0} B` }, { title: '延迟', dataIndex: 'latencyMs', render: (value: number | null) => value == null ? '—' : `${value} ms` }, { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={value === 'completed' ? 'green' : 'red'}>{value}</Tag> },
  ];
  const chartOption = { tooltip: { trigger: 'axis' }, legend: { data: ['Token', '调用次数'] }, grid: { left: 48, right: 48, bottom: 32, top: 48 }, xAxis: { type: 'category', data: data.trend.map((item) => new Date(item.date).toLocaleDateString()) }, yAxis: [{ type: 'value', name: 'Token' }, { type: 'value', name: '调用次数' }], series: [{ name: 'Token', type: 'line', smooth: true, data: data.trend.map((item) => item.totalTokens) }, { name: '调用次数', type: 'bar', yAxisIndex: 1, data: data.trend.map((item) => item.totalCalls) }] };
  const recent = Number(data.trend[data.trend.length - 1]?.totalTokens ?? 0);
  const baseline = data.trend.slice(-8, -1).reduce((sum, item) => sum + Number(item.totalTokens), 0) / Math.max(1, data.trend.slice(-8, -1).length);
  const topUser = data.users[0];
  const stale = Date.now() - new Date(data.generatedAt).getTime() > 5 * 60 * 1000;
  return <>
    {stale && <Alert type='warning' showIcon title='监控数据可能已过期' description={`最近更新时间：${new Date(data.generatedAt).toLocaleString()}`} style={{ marginBottom: 16 }} />}
    {data.overview.missingTokenCalls > 0 && <Alert type='warning' showIcon title={`${data.overview.missingTokenCalls} 次调用缺少 Token 数据`} description='模型服务未返回完整 usage，相关请求仍计入调用次数，但 Token 可能偏低。' style={{ marginBottom: 16 }} />}
    {baseline > 0 && recent > baseline * 2 && <Alert type='warning' showIcon title='Token 使用量明显上升' description={`最近一天用量是近 7 天日均的 ${(recent / baseline).toFixed(1)} 倍。`} style={{ marginBottom: 16 }} />}
    {data.overview.errorRate >= 0.1 && <Alert type='error' showIcon title='错误率偏高' description={`当前时间范围错误率为 ${(data.overview.errorRate * 100).toFixed(1)}%。`} style={{ marginBottom: 16 }} />}
    {showUser && topUser && Number(data.overview.totalTokens) > 0 && Number(topUser.totalTokens) / Number(data.overview.totalTokens) >= 0.5 && <Alert type='info' showIcon title='单用户用量集中' description={`${topUser.email} 占总 Token 的 ${(Number(topUser.totalTokens) / Number(data.overview.totalTokens) * 100).toFixed(1)}%。`} style={{ marginBottom: 16 }} />}
    <Card title='使用趋势' style={{ marginTop: 16 }}><ReactECharts option={chartOption} style={{ height: 320 }} /></Card>
    <Card title='使用日志' style={{ marginTop: 16 }} extra={<Button icon={<DownloadOutlined />} onClick={() => downloadCsv({ ...data, requests })}>导出 CSV</Button>}>
      <Space wrap style={{ marginBottom: 16 }}><Select value={group} onChange={setGroup} style={{ width: 180 }} options={[{ value: 'all', label: '全部分组' }, ...Array.from(new Set(data.requests.map((item) => item.groupName))).map((value) => ({ value, label: value }))]} /><Select value={model} onChange={setModel} style={{ width: 180 }} options={[{ value: 'all', label: '全部模型' }, ...Array.from(new Set(data.requests.map((item) => item.modelName))).map((value) => ({ value, label: value }))]} /><Select value={status} onChange={setStatus} style={{ width: 160 }} options={[{ value: 'all', label: '全部状态' }, ...Array.from(new Set(data.requests.map((item) => item.status))).map((value) => ({ value, label: value }))]} /><Typography.Text type='secondary'>共 {requests.length} 条</Typography.Text></Space>
      <Table rowKey='requestId' size='small' dataSource={requests} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 1200 }} />
    </Card>
  </>;
}
