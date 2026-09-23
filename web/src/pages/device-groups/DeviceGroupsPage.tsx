import { useMemo, useState } from 'react';
import {
  App,
  Button,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  DisconnectOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { agentApi } from '../../api/agent-api';
import { groupApi, type GroupDetail, type GroupSummary } from '../../api/group-api';
import { useAsyncList } from '../../hooks';
import { EmptyState, ErrorState, PageHeader } from '../../components';
import {
  AddAgentToGroupModal,
  CreateEditGroupModal,
} from '../deployer-dashboard/components';
import { REQUEST_ERROR_MESSAGE } from '../../constants';
import './DeviceGroupsPage.less';

type GroupRow = GroupSummary & { key: string; detail?: GroupDetail };

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function modelColor(engine: string): string {
  const value = engine.toLowerCase();
  if (value.includes('openai')) return 'green';
  if (value.includes('gemini') || value.includes('google')) return 'blue';
  if (value.includes('anthropic') || value.includes('claude')) return 'orange';
  return 'default';
}

export function DeviceGroupsPage() {
  const { message } = App.useApp();
  const dashboard = useAsyncList(async () => {
    const [groups, agents] = await Promise.all([groupApi.list(), agentApi.list()]);
    const details = await Promise.all(groups.map(async (group) => [group.id, await groupApi.get(group.id)] as const));
    return { groups, agents, details: Object.fromEntries(details) as Record<string, GroupDetail> };
  }, { poll: true });
  const groups = dashboard.data?.groups ?? [];
  const agents = dashboard.data?.agents ?? [];
  const details = dashboard.data?.details ?? {};
  const [search, setSearch] = useState('');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupSummary | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>();

  const rows = useMemo<GroupRow[]>(() => groups
    .filter((group) => `${group.name} ${group.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .map((group) => ({ ...group, key: group.id, detail: details[group.id] })), [groups, search, details]);

  async function handleCreateGroup(values: { name: string; description?: string | null }): Promise<void> {
    setGroupSaving(true);
    try {
      if (editingGroup) {
        await groupApi.update(editingGroup.id, { name: values.name, description: values.description ?? null });
        message.success('分组已更新');
      } else {
        await groupApi.create({ name: values.name, description: values.description ?? null });
        message.success('分组已创建');
      }
      setGroupModalOpen(false);
      setEditingGroup(null);
      await dashboard.reload();
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    } finally {
      setGroupSaving(false);
    }
  }

  function handleDeleteGroup(group: GroupSummary): void {
    Modal.confirm({
      title: `删除分组「${group.name}」？`,
      content: '删除后，引用此分组的 API Key 将失效。',
      okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
      onOk: async () => {
        try { await groupApi.remove(group.id); message.success('分组已删除'); await dashboard.reload(); }
        catch { message.error(REQUEST_ERROR_MESSAGE); }
      },
    });
  }

  const columns: ColumnsType<GroupRow> = [
    { title: '分组名称', dataIndex: 'name', width: 190, render: (name: string) => <Space><span className='group-table-mark'><TeamOutlined /></span><Typography.Text strong>{name}</Typography.Text></Space> },
    { title: '描述', dataIndex: 'description', width: 220, render: (value: string | null) => <Typography.Text type={value ? undefined : 'secondary'}>{value || '暂无描述'}</Typography.Text> },
    { title: '设备', key: 'agents', width: 250, render: (_value, group) => group.detail?.agents.length ? <Space wrap size={[6, 6]}>{group.detail.agents.map((agent) => <Tag key={agent.id} color='cyan'>{agent.name || agent.id}</Tag>)}</Space> : <Typography.Text type='secondary'>暂无设备</Typography.Text> },
    { title: '支持模型', key: 'models', width: 300, render: (_value, group) => { const models = Array.from(new Map((group.detail?.agents ?? []).flatMap((agent) => agent.modelInstances ?? []).map((model) => [model.name, model])).values()); return models.length ? <Space wrap size={[6, 6]}>{models.map((model) => <Tag key={model.name} color={modelColor(model.engine)}>{model.name}</Tag>)}</Space> : <Typography.Text type='secondary'>暂无模型</Typography.Text>; } },
    { title: '创建时间', dataIndex: 'createdAt', width: 180, render: (value: string) => formatDate(value) },
    { title: '操作', key: 'actions', width: 190, render: (_value, group) => <Space size={2}><Tooltip title='编辑分组'><Button type='text' icon={<EditOutlined />} aria-label='编辑分组' onClick={() => { setEditingGroup(group); setGroupModalOpen(true); }} /></Tooltip><Tooltip title='添加设备'><Button type='text' icon={<LinkOutlined />} aria-label='添加设备' onClick={() => { setSelectedGroupId(group.id); setAddAgentModalOpen(true); }} /></Tooltip><Tooltip title='禁用分组'><Button type='text' icon={<DisconnectOutlined />} aria-label='禁用分组' onClick={() => message.info('功能暂未开放')} /></Tooltip><Tooltip title='删除分组'><Button type='text' danger icon={<DeleteOutlined />} aria-label='删除分组' onClick={() => handleDeleteGroup(group)} /></Tooltip></Space> },
  ];

  return <section className='device-groups-page'>
    <PageHeader title='模型分组' subtitle='按设备组织可调用模型，集中管理关联关系。' />
    {dashboard.error && <ErrorState onRetry={() => void dashboard.reload()} />}
    <div className='group-table-toolbar'><Typography.Text strong>分组列表</Typography.Text><Space wrap><Input allowClear prefix={<SearchOutlined />} placeholder='搜索分组名称或描述' value={search} onChange={(event) => setSearch(event.target.value)} /><Button type='primary' icon={<PlusOutlined />} onClick={() => { setEditingGroup(null); setGroupModalOpen(true); }}>创建分组</Button><Button icon={<LinkOutlined />} onClick={() => { setSelectedGroupId(undefined); setAddAgentModalOpen(true); }}>关联设备</Button></Space></div>
    <div className='group-table-shell'>{!rows.length && !dashboard.loading && !dashboard.error ? <EmptyState description={search ? '没有匹配的分组' : '暂无分组。创建分组后即可关联设备。'} /> : <Table<GroupRow> rowKey='key' size='middle' dataSource={rows} columns={columns} loading={dashboard.loading && !dashboard.data} pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 1280 }} />}</div>
    <CreateEditGroupModal open={groupModalOpen} editing={editingGroup} loading={groupSaving} onClose={() => { setGroupModalOpen(false); setEditingGroup(null); }} onSubmit={(values) => void handleCreateGroup(values)} />
    <AddAgentToGroupModal open={addAgentModalOpen} groups={groups} agents={agents} loading={false} initialGroupId={selectedGroupId} onClose={() => setAddAgentModalOpen(false)} onSubmit={(groupId, agentId) => void (async () => { try { await groupApi.addAgent(groupId, agentId); message.success('设备已加入分组'); setAddAgentModalOpen(false); await dashboard.reload(); } catch { message.error(REQUEST_ERROR_MESSAGE); } })()} />
  </section>;
}
