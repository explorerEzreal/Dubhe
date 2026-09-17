import { useCallback, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Modal,
  Row,
  Space,
  Typography,
} from 'antd';
import {
  agentApi,
} from '../../api/agent-api';
import {
  enrollmentApi,
  type EnrollmentTokenResult,
} from '../../api/enrollment-api';
import { groupApi, type GroupSummary } from '../../api/group-api';
import { modelApi } from '../../api/model-api';
import { config } from '../../config/config';
import { DEFAULT_LOCAL_MODEL_URL, REQUEST_ERROR_MESSAGE } from '../../constants';
import { useAsyncList } from '../../hooks';
import { copyText } from '../../utils/clipboard';
import { EmptyState, ErrorState } from '../../components';
import { AddDeviceModal, AddAgentToGroupModal, AgentCard, CreateEditGroupModal, DeploymentCommandModal, GroupCard, InviteTokenModal, ModelStatistics } from './components';

import { shellQuote } from '../../utils/format';

export function DeployerDashboardPage() {
  const { message } = App.useApp();
  const dashboard = useAsyncList(async () => {
    const [agents, models, groups] = await Promise.all([agentApi.list(), modelApi.list(), groupApi.list()]);
    return { agents, models, groups };
  }, { poll: true });
  const agents = dashboard.data?.agents ?? [];
  const models = dashboard.data?.models ?? [];
  const groups = dashboard.data?.groups ?? [];
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [tokenResult, setTokenResult] = useState<EnrollmentTokenResult | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [localUrl, setLocalUrl] = useState(DEFAULT_LOCAL_MODEL_URL);
  const [creating, setCreating] = useState(false);

  // 分组状态
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupSummary | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);

  async function createToken(): Promise<void> {
    if (!selectedModel.trim() || !localUrl.trim()) {
      message.error('请填写模型和本地服务地址');
      return;
    }
    setCreating(true);
    try {
      setTokenResult(await enrollmentApi.create());
      setDeviceModalOpen(false);
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    } finally {
      setCreating(false);
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

  const command = tokenResult
    ? (() => {
        const modelName = selectedModel || '<模型名>';
        return `npm install -g dubhe-agent@0.1.0\ndubhe service install --cloud-url ${shellQuote(config.apiBaseUrl)} --token ${shellQuote(tokenResult.token)} --model ${shellQuote(modelName)} --local-url ${shellQuote(localUrl)}`;
      })()
    : '';

  return (
    <section>
      <div className='dashboard-header'>
        <div>
          <Typography.Title level={1}>部署者控制台</Typography.Title>
          <Typography.Paragraph type='secondary'>
            管理设备、分组和模型。设备需加入分组才能被调用。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button loading={dashboard.loading && Boolean(dashboard.data)} onClick={() => void dashboard.reload()}>刷新</Button>
          <Button type='primary' onClick={() => setDeviceModalOpen(true)}>
            添加设备
          </Button>
        </Space>
      </div>
      {dashboard.error && <ErrorState onRetry={() => void dashboard.reload()} />}
      <Alert
        type='info'
        showIcon
        style={{ marginBottom: 16 }}
        message='Web 负责 Cloud 侧设备管理；本机 Agent 操作请在模型设备上使用 CLI。'
        description='此页面不会远程执行命令、修改本机文件或控制 launchd/systemd。安装完成后可在这里查看在线状态、模型状态并轮换或撤销凭证。'
      />

      {/* 分组管理 */}
      <Card
        title='分组管理'
        style={{ marginBottom: 24 }}
        extra={<Space><Button onClick={() => { setEditingGroup(null); setGroupModalOpen(true); }}>创建分组</Button><Button onClick={() => setAddAgentModalOpen(true)}>管理设备分组</Button></Space>}
      >
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

      {/* 设备列表 */}
      {dashboard.loading && !dashboard.data && !dashboard.error ? (
        <Card><div className='state-view'>加载中...</div></Card>
      ) : !agents.length && !dashboard.error ? (
        <Card title='设备列表'>
          <EmptyState description='尚未安装 Agent，请点击"添加设备"开始接入。' />
        </Card>
      ) : (
        <Card title='设备列表' style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onRotate={() => void agentApi.rotate(agent.id).then(() => message.success('凭证已轮换')).catch(() => message.error(REQUEST_ERROR_MESSAGE))} onRevoke={() => Modal.confirm({ title: '撤销设备凭证？', content: '撤销后该设备将无法继续连接 Cloud。', okText: '撤销', cancelText: '取消', onOk: async () => { try { await agentApi.revoke(agent.id); message.success('设备已撤销'); await dashboard.reload(); } catch { message.error(REQUEST_ERROR_MESSAGE); } } })} />
            ))}
          </Row>
        </Card>
      )}
      <ModelStatistics models={models} />

      <AddDeviceModal open={deviceModalOpen} models={models} selectedModel={selectedModel} localUrl={localUrl} creating={creating} onClose={() => setDeviceModalOpen(false)} onModelChange={setSelectedModel} onUrlChange={setLocalUrl} onSubmit={() => void createToken()} />
      <DeploymentCommandModal tokenResult={tokenResult} command={command} onClose={() => setTokenResult(null)} onCopy={() => void copy(command, '启动命令已复制')} />
      <CreateEditGroupModal open={groupModalOpen} editing={editingGroup} loading={groupSaving} onClose={() => { setGroupModalOpen(false); setEditingGroup(null); }} onSubmit={(values) => void handleCreateGroup(values)} />
      <InviteTokenModal open={Boolean(inviteToken)} token={inviteToken ?? ''} onClose={() => setInviteToken(null)} onCopy={() => void copy(inviteToken ?? '', '邀请码已复制')} />
      <AddAgentToGroupModal open={addAgentModalOpen} groups={groups} agents={agents} loading={false} onClose={() => setAddAgentModalOpen(false)} onSubmit={(groupId, agentId) => void handleAddAgent(groupId, agentId)} />
    </section>
  );
}
