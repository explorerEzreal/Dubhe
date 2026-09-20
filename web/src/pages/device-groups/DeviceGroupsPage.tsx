import { useMemo, useState, type Key } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { agentApi, type AgentSummary } from '../../api/agent-api';
import { groupApi, type GroupDetail, type GroupSummary } from '../../api/group-api';
import { useAsyncList } from '../../hooks';
import { copyText } from '../../utils/clipboard';
import { EmptyState, ErrorState } from '../../components';
import {
  AddAgentToGroupModal,
  CreateEditGroupModal,
  InviteTokenModal,
} from '../deployer-dashboard/components';
import { REQUEST_ERROR_MESSAGE } from '../../constants';

type GroupRow = GroupSummary & { key: string };

function statusLabel(status: string): { text: string; color: string } {
  if (status === 'online' || status === 'ready') return { text: '在线', color: 'success' };
  if (status === 'degraded') return { text: '异常', color: 'warning' };
  if (status === 'created') return { text: '待接入', color: 'default' };
  return { text: '离线', color: 'error' };
}

export function DeviceGroupsPage() {
  const { message } = App.useApp();
  const dashboard = useAsyncList(async () => {
    const [groups, agents] = await Promise.all([groupApi.list(), agentApi.list()]);
    return { groups, agents };
  }, { poll: true });
  const groups = dashboard.data?.groups ?? [];
  const agents = dashboard.data?.agents ?? [];
  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [details, setDetails] = useState<Record<string, GroupDetail>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupSummary | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>();

  const rows = useMemo<GroupRow[]>(() => groups
    .filter((group) => `${group.name} ${group.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .map((group) => ({ ...group, key: group.id })), [groups, search]);

  async function loadDetail(groupId: string): Promise<void> {
    if (details[groupId]) return;
    setDetailLoading((state) => ({ ...state, [groupId]: true }));
    try {
      const detail = await groupApi.get(groupId);
      setDetails((state) => ({ ...state, [groupId]: detail }));
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    } finally {
      setDetailLoading((state) => ({ ...state, [groupId]: false }));
    }
  }

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

  async function removeAgent(groupId: string, agentId: string): Promise<void> {
    try {
      await groupApi.removeAgent(groupId, agentId);
      message.success('设备已移出分组');
      const detail = await groupApi.get(groupId);
      setDetails((state) => ({ ...state, [groupId]: detail }));
      await dashboard.reload();
    } catch { message.error(REQUEST_ERROR_MESSAGE); }
  }

  async function createInvite(group: GroupSummary): Promise<void> {
    try { setInviteToken((await groupApi.createInviteToken(group.id)).token); }
    catch { message.error(REQUEST_ERROR_MESSAGE); }
  }

  async function copy(value: string): Promise<void> {
    try { await copyText(value); message.success('邀请码已复制'); }
    catch { message.error(REQUEST_ERROR_MESSAGE); }
  }

  const deviceColumns = (groupId: string): ColumnsType<AgentSummary> => [
    { title: '设备名称', dataIndex: 'name', render: (name: string | undefined, record) => <span><Typography.Text strong>{name || record.id}</Typography.Text><Typography.Text type='secondary' style={{ display: 'block', fontSize: 12 }}>{record.id}</Typography.Text></span> },
    { title: '状态', dataIndex: 'status', width: 100, render: (status: string) => { const item = statusLabel(status); return <Badge status={item.color as 'success' | 'warning' | 'error' | 'default'} text={item.text} />; } },
    { title: '模型', dataIndex: 'modelInstances', render: (models: AgentSummary['modelInstances']) => models?.length ? <Space wrap size={[4, 4]}>{models.slice(0, 3).map((model) => <Tag key={model.name} color={model.state === 'ready' ? 'green' : 'default'}>{model.name}</Tag>)}{models.length > 3 && <Tag>+{models.length - 3}</Tag>}</Space> : <Typography.Text type='secondary'>暂无模型</Typography.Text> },
    { title: '操作', key: 'actions', width: 90, render: (_value, record) => <Popconfirm title='移除该设备？' description='设备仍会保留，只解除与当前分组的关联。' okText='移除' cancelText='取消' onConfirm={() => void removeAgent(groupId, record.id)}><Button type='link' danger size='small'>移除</Button></Popconfirm> },
  ];

  const columns: ColumnsType<GroupRow> = [
    { title: '分组名称', dataIndex: 'name', width: 250, render: (name: string, group) => <Space><span className='group-table-mark'><TeamOutlined /></span><span><Typography.Text strong>{name}</Typography.Text><Typography.Text type='secondary' ellipsis style={{ display: 'block', maxWidth: 190 }}>{group.description || '暂无描述'}</Typography.Text></span></Space> },
    { title: '设备数', dataIndex: 'agentCount', width: 110, render: (count: number) => <Typography.Text>{count} <Typography.Text type='secondary'>台</Typography.Text></Typography.Text> },
    { title: '运行状态', key: 'health', width: 150, render: (_value, group) => { const detail = details[group.id]; const online = detail?.agents.filter((agent) => ['online', 'ready'].includes(String(agent.status))).length; return detail ? <Badge status={online ? 'success' : 'default'} text={online ? `${online} 台在线` : '暂无在线设备'} /> : <Typography.Text type='secondary'>展开查看</Typography.Text>; } },
    { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: (value: string) => value ? new Date(value).toLocaleString() : '—' },
    { title: '操作', key: 'actions', width: 260, render: (_value, group) => <Space size={2}><Tooltip title='编辑分组'><Button type='text' icon={<EditOutlined />} aria-label='编辑分组' onClick={() => { setEditingGroup(group); setGroupModalOpen(true); }} /></Tooltip><Tooltip title='添加设备'><Button type='text' icon={<LinkOutlined />} aria-label='添加设备' onClick={() => { setSelectedGroupId(group.id); setAddAgentModalOpen(true); }} /></Tooltip><Tooltip title='生成邀请码'><Button type='text' icon={<SendOutlined />} aria-label='生成邀请码' onClick={() => void createInvite(group)} /></Tooltip><Button type='link' size='small' danger icon={<DeleteOutlined />} onClick={() => handleDeleteGroup(group)}>删除</Button></Space> },
  ];

  return <section className='device-groups-page'>
    <div className='dashboard-header'>
      <div><Typography.Title level={3}>模型分组</Typography.Title><Typography.Paragraph type='secondary'>按设备组织可调用模型，集中管理关联关系与访问邀请码。</Typography.Paragraph></div>
      <Space wrap><Button icon={<ReloadOutlined />} loading={dashboard.loading && Boolean(dashboard.data)} onClick={() => void dashboard.reload()}>刷新</Button><Button type='primary' icon={<PlusOutlined />} onClick={() => { setEditingGroup(null); setGroupModalOpen(true); }}>创建分组</Button></Space>
    </div>
    {dashboard.error && <ErrorState onRetry={() => void dashboard.reload()} />}
    <div className='group-overview-grid'><Card size='small'><Statistic title='分组总数' value={groups.length} /></Card><Card size='small'><Statistic title='设备总数' value={agents.length} suffix='台' /></Card><Card size='small'><Statistic title='在线设备' value={agents.filter((agent) => ['online', 'ready'].includes(agent.status)).length} suffix='台' /></Card></div>
    <Card className='group-table-card' bodyStyle={{ padding: 0 }}>
      <div className='group-table-toolbar'><Typography.Text strong>分组列表</Typography.Text><Space><Input allowClear prefix={<SearchOutlined />} placeholder='搜索分组名称或描述' value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: 240 }} /><Button icon={<LinkOutlined />} onClick={() => { setSelectedGroupId(undefined); setAddAgentModalOpen(true); }}>关联设备</Button></Space></div>
      {!rows.length && !dashboard.loading && !dashboard.error ? <EmptyState description={search ? '没有匹配的分组' : '暂无分组。创建分组后即可关联设备。'} /> : <Table<GroupRow> rowKey='key' size='middle' dataSource={rows} columns={columns} loading={dashboard.loading && !dashboard.data} pagination={{ pageSize: 10, showSizeChanger: false }} expandable={{ expandedRowKeys: expandedKeys, onExpand: (expanded, record) => { setExpandedKeys((keys) => expanded ? [...keys, record.id] : keys.filter((key) => key !== record.id)); if (expanded) void loadDetail(record.id); }, expandedRowRender: (group) => { const detail = details[group.id]; if (!detail) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={detailLoading[group.id] ? '加载设备中…' : '暂无设备'} />; return <div className='group-device-panel'><div className='group-device-panel-head'><Typography.Text type='secondary'>该分组中的设备</Typography.Text><Button type='link' size='small' icon={<PlusOutlined />} onClick={() => { setSelectedGroupId(group.id); setAddAgentModalOpen(true); }}>添加设备</Button></div><Table<AgentSummary> rowKey='id' size='small' dataSource={detail.agents} columns={deviceColumns(group.id)} pagination={false} /></div>; } }} />}
    </Card>
    <CreateEditGroupModal open={groupModalOpen} editing={editingGroup} loading={groupSaving} onClose={() => { setGroupModalOpen(false); setEditingGroup(null); }} onSubmit={(values) => void handleCreateGroup(values)} />
    <InviteTokenModal open={Boolean(inviteToken)} token={inviteToken ?? ''} onClose={() => setInviteToken(null)} onCopy={() => void copy(inviteToken ?? '')} />
    <AddAgentToGroupModal open={addAgentModalOpen} groups={groups} agents={agents} loading={false} initialGroupId={selectedGroupId} onClose={() => setAddAgentModalOpen(false)} onSubmit={(groupId, agentId) => void (async () => { try { await groupApi.addAgent(groupId, agentId); message.success('设备已加入分组'); setAddAgentModalOpen(false); setDetails((state) => { const next = { ...state }; delete next[groupId]; return next; }); await dashboard.reload(); if (expandedKeys.includes(groupId)) await loadDetail(groupId); } catch { message.error(REQUEST_ERROR_MESSAGE); } })()} />
  </section>;
}
