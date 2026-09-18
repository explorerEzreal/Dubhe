import { useState } from 'react';
import { App, Button, Card, Modal, Row, Space, Typography } from 'antd';
import { agentApi } from '../../api/agent-api';
import { groupApi, type GroupSummary } from '../../api/group-api';
import { useAsyncList } from '../../hooks';
import { copyText } from '../../utils/clipboard';
import { EmptyState, ErrorState } from '../../components';
import {
  AddAgentToGroupModal,
  CreateEditGroupModal,
  GroupCard,
  InviteTokenModal,
} from '../deployer-dashboard/components';
import { REQUEST_ERROR_MESSAGE } from '../../constants';

export function DeviceGroupsPage() {
  const { message } = App.useApp();
  const dashboard = useAsyncList(async () => {
    const [groups, agents] = await Promise.all([groupApi.list(), agentApi.list()]);
    return { groups, agents };
  }, { poll: true });
  const groups = dashboard.data?.groups ?? [];
  const agents = dashboard.data?.agents ?? [];

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupSummary | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);

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

  async function handleDeleteGroup(group: GroupSummary): Promise<void> {
    Modal.confirm({
      title: `删除分组「${group.name}」？`,
      content: '删除后，引用此分组的 API Key 将失效。',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          await groupApi.remove(group.id);
          message.success('分组已删除');
          await dashboard.reload();
        } catch {
          message.error(REQUEST_ERROR_MESSAGE);
        }
      },
    });
  }

  async function handleCreateInvite(group: GroupSummary): Promise<void> {
    try {
      const result = await groupApi.createInviteToken(group.id);
      setInviteToken(result.token);
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    }
  }

  async function handleAddAgent(groupId: string, agentId: string): Promise<void> {
    try {
      await groupApi.addAgent(groupId, agentId);
      message.success('设备已加入分组');
      setAddAgentModalOpen(false);
      await dashboard.reload();
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    }
  }

  async function copy(value: string, success = '已复制'): Promise<void> {
    try {
      await copyText(value);
      message.success(success);
    } catch {
      message.error('请求失败，请稍后重试');
    }
  }

  return (
    <section>
      <div className='dashboard-header'>
        <div>
          <Typography.Title level={1}>模型分组</Typography.Title>
          <Typography.Paragraph type='secondary'>
            管理分组，将设备加入分组，生成邀请码分享给调用者。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button loading={dashboard.loading && Boolean(dashboard.data)} onClick={() => void dashboard.reload()}>刷新</Button>
          <Button onClick={() => setAddAgentModalOpen(true)}>设备分组关联</Button>
          <Button type='primary' onClick={() => { setEditingGroup(null); setGroupModalOpen(true); }}>创建分组</Button>
        </Space>
      </div>
      {dashboard.error && <ErrorState onRetry={() => void dashboard.reload()} />}

      <Card title='分组列表'>
        {!groups.length && !dashboard.error ? (
          <EmptyState description='暂无分组。创建设备分组后，可将设备加入分组并分享给调用者。' />
        ) : (
          <Row gutter={[16, 16]}>
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onEdit={() => { setEditingGroup(group); setGroupModalOpen(true); }}
                onDelete={() => void handleDeleteGroup(group)}
                onInvite={() => void handleCreateInvite(group)}
              />
            ))}
          </Row>
        )}
      </Card>

      <CreateEditGroupModal open={groupModalOpen} editing={editingGroup} loading={groupSaving} onClose={() => { setGroupModalOpen(false); setEditingGroup(null); }} onSubmit={(values) => void handleCreateGroup(values)} />
      <InviteTokenModal open={Boolean(inviteToken)} token={inviteToken ?? ''} onClose={() => setInviteToken(null)} onCopy={() => void copy(inviteToken ?? '', '邀请码已复制')} />
      <AddAgentToGroupModal open={addAgentModalOpen} groups={groups} agents={agents} loading={false} onClose={() => setAddAgentModalOpen(false)} onSubmit={(groupId, agentId) => void handleAddAgent(groupId, agentId)} />
    </section>
  );
}
