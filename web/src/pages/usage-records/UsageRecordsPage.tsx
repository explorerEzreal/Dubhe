import { useCallback, useState } from 'react';
import { Card, DatePicker, Segmented, Space, Table, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { usageApi, type MonitoringData } from '../../api/usage-api';
import { ContentLoadingState, ErrorState } from '../../components';
import { useAsyncList } from '../../hooks';
import { UsageMonitoring } from '../usage-monitoring';
import { useAuthStore } from '../../state';

export function UsageRecordsPage() {
  const [view, setView] = useState<'users' | 'requests'>('users');
  const role = useAuthStore((state) => state.role);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()]);
  const load = useCallback(() => usageApi.monitoring(role === 'admin' || role === 'super_admin' ? 'deployer' : 'caller', range[0].startOf('day').toISOString(), range[1].endOf('day').toISOString()), [range, role]);
  const dashboard = useAsyncList(load, { poll: true });
  const data = dashboard.data as MonitoringData | undefined;
  if (dashboard.loading && !data) return <ContentLoadingState />;
  if (dashboard.error && !data) return <ErrorState onRetry={() => void dashboard.reload()} />;
  const users = data?.users ?? [];
  const userColumns = [{ title: '用户', dataIndex: 'email' }, { title: '分组', dataIndex: 'groupName' }, { title: '调用次数', dataIndex: 'totalCalls' }, { title: '总 Token', dataIndex: 'totalTokens' }, { title: '平均延迟', dataIndex: 'avgLatencyMs', render: (value: number) => `${value} ms` }, { title: '最近调用', dataIndex: 'lastUsedAt', render: (value: string) => new Date(value).toLocaleString() }];
  return <section><div className='dashboard-header'><div><Typography.Title level={1}>使用记录</Typography.Title><Typography.Paragraph type='secondary'>按用户汇总并查看请求明细。</Typography.Paragraph></div><Space><Segmented value={view} onChange={(value) => setView(value as 'users' | 'requests')} options={[{ label: '用户汇总', value: 'users' }, { label: '请求明细', value: 'requests' }]} /><DatePicker.RangePicker value={range} onChange={(value) => { if (value?.[0] && value?.[1]) setRange([value[0], value[1]]); }} /></Space></div>{view === 'users' ? <Card><Table rowKey={(row) => `${row.groupId ?? 'none'}-${row.id}`} dataSource={users} columns={userColumns} pagination={{ pageSize: 20 }} /></Card> : data && <UsageMonitoring data={data} showUser />}</section>;
}
