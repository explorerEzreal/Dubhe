import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Modal, Space, Typography } from 'antd';
import { agentApi } from '../../api/agent-api';
import {
  enrollmentApi,
  type EnrollmentTokenResult,
} from '../../api/enrollment-api';
import { groupApi } from '../../api/group-api';
import { modelApi } from '../../api/model-api';
import { config } from '../../config/config';
import {
  DEFAULT_LOCAL_MODEL_HOST,
  DEFAULT_LOCAL_MODEL_PORT,
  REQUEST_ERROR_MESSAGE,
} from '../../constants';
import { useAsyncList } from '../../hooks';
import { copyText } from '../../utils/clipboard';
import { EmptyState, ErrorState } from '../../components';
import { useAppTheme } from '../../app/providers';
import {
  AddDeviceModal,
  type AddDeviceFormValues,
  DeploymentCommandModal,
} from '../deployer-dashboard/components';
import { shellQuote } from '../../utils/format';
import {
  DeviceMonitorCard,
  GroupRail,
  OverviewCards,
  StatusFilters,
  type DeviceStatusFilter,
} from './monitor-components';

export function DeviceAgentsPage() {
  const { message } = App.useApp();
  const { mode } = useAppTheme();
  const dashboard = useAsyncList(
    async () => {
      const [agents, models, groups] = await Promise.all([
        agentApi.list(),
        modelApi.list(),
        groupApi.list(),
      ]);
      return { agents, models, groups };
    },
    { poll: true },
  );
  const agents = dashboard.data?.agents ?? [];
  const models = dashboard.data?.models ?? [];
  const groups = dashboard.data?.groups ?? [];
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedGroupAgentIds, setSelectedGroupAgentIds] = useState<
    string[] | null
  >(null);
  const [statusFilter, setStatusFilter] = useState<DeviceStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [tokenResult, setTokenResult] = useState<EnrollmentTokenResult | null>(
    null,
  );
  const [selectedModel, setSelectedModel] = useState('');
  const [localHost, setLocalHost] = useState(DEFAULT_LOCAL_MODEL_HOST);
  const [localPort, setLocalPort] = useState(DEFAULT_LOCAL_MODEL_PORT);
  const [creating, setCreating] = useState(false);
  const [operatingAgentId, setOperatingAgentId] = useState<string | null>(null);
  const [rotatedCredential, setRotatedCredential] = useState<{ name: string; credential: string } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (dashboard.data) setLastUpdatedAt(new Date());
  }, [dashboard.data]);

  useEffect(() => {
    if (selectedGroup === 'all') {
      setSelectedGroupAgentIds(null);
      return;
    }
    let active = true;
    void groupApi
      .get(selectedGroup)
      .then((group) => {
        if (active)
          setSelectedGroupAgentIds(
            group.agents.map((agent) =>
              String(agent.id ?? agent.agentId ?? ''),
            ),
          );
      })
      .catch(() => {
        if (active) setSelectedGroupAgentIds([]);
      });
    return () => {
      active = false;
    };
  }, [selectedGroup]);

  const visibleAgents = useMemo(
    () =>
      agents.filter((agent) => {
        const matchesGroup =
          selectedGroup === 'all' ||
          (selectedGroupAgentIds
            ? selectedGroupAgentIds.includes(agent.id)
            : false);
        const status = agent.status as DeviceStatusFilter;
        const matchesStatus = statusFilter === 'all' || status === statusFilter;
        const query = search.trim().toLowerCase();
        return (
          matchesGroup &&
          matchesStatus &&
          (!query ||
            `${agent.name ?? ''} ${agent.id}`.toLowerCase().includes(query))
        );
      }),
    [agents, search, selectedGroup, selectedGroupAgentIds, statusFilter],
  );

  async function createToken(values: AddDeviceFormValues): Promise<void> {
    const name = values.deviceName.trim();
    setLocalHost(values.localHost.trim());
    setLocalPort(values.localPort.trim());
    if (!selectedModel.trim()) {
      message.error('请填写模型和本地服务地址');
      return;
    }
    setCreating(true);
    try {
      setTokenResult(await enrollmentApi.create(name));
      setDeviceModalOpen(false);
      await dashboard.reload();
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    } finally {
      setCreating(false);
    }
  }

  async function copy(value: string, success = '已复制'): Promise<boolean> {
    try {
      await copyText(value);
      message.success(success);
      return true;
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
      return false;
    }
  }

  async function renameAgent(agentId: string, name: string): Promise<boolean> {
    try {
      await agentApi.rename(agentId, name);
      message.success('设备名称已更新');
      await dashboard.reload();
      return true;
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
      return false;
    }
  }

  function rotateAgent(agentId: string, name: string): void {
    Modal.confirm({
      title: '轮换设备凭证？',
      content: '当前凭证将立即失效，设备需要配置新凭证后才能重新连接。',
      okText: '确认轮换',
      cancelText: '取消',
      onOk: async () => {
        setOperatingAgentId(agentId);
        try {
          const result = await agentApi.rotate(agentId);
          setRotatedCredential({ name, credential: result.credential });
          await dashboard.reload();
        } catch {
          message.error(REQUEST_ERROR_MESSAGE);
        } finally {
          setOperatingAgentId(null);
        }
      },
    });
  }

  function revokeAgent(agentId: string, status: string): void {
    const pending = status === 'created';
    Modal.confirm({
      title: pending ? '取消设备接入？' : '撤销设备凭证？',
      content: pending
        ? '取消后当前部署令牌立即失效，该设备无法继续完成注册。'
        : '撤销后设备将立即断开，并且无法继续连接 Cloud。',
      okText: pending ? '确认取消' : '确认撤销',
      okButtonProps: { danger: true },
      cancelText: '返回',
      onOk: async () => {
        setOperatingAgentId(agentId);
        try {
          await agentApi.revoke(agentId);
          message.success(pending ? '设备接入已取消' : '设备已撤销');
          await dashboard.reload();
        } catch {
          message.error(REQUEST_ERROR_MESSAGE);
        } finally {
          setOperatingAgentId(null);
        }
      },
    });
  }

  const command = tokenResult
    ? `npm install -g dubhe-agent@0.1.0\ndubhe service install --cloud-url ${shellQuote(config.apiBaseUrl)} --token ${shellQuote(tokenResult.token)} --model ${shellQuote(selectedModel || '<模型名>')} --host ${shellQuote(localHost || DEFAULT_LOCAL_MODEL_HOST)} --port ${shellQuote(localPort || DEFAULT_LOCAL_MODEL_PORT)}`
    : '';

  const updatedLabel = lastUpdatedAt
    ? `最后更新时间：${String(lastUpdatedAt.getHours()).padStart(2, '0')}:${String(lastUpdatedAt.getMinutes()).padStart(2, '0')}:${String(lastUpdatedAt.getSeconds()).padStart(2, '0')}`
    : '最后更新时间：暂无';

  return (
    <section className='device-monitor-page'>
      <div className='dashboard-header'>
        <div className='device-page-heading'>
          <Typography.Title level={3}>设备监控中心</Typography.Title>
        </div>
        <Space className='device-header-actions'>
          <span className='monitoring-state'>
            <i className='status-dot' />
            监测中
          </span>
          <span className='device-updated-at'>{updatedLabel}</span>
          <Button type='primary' onClick={() => setDeviceModalOpen(true)}>
            添加设备
          </Button>
        </Space>
      </div>
      {dashboard.error && (
        <ErrorState onRetry={() => void dashboard.reload()} />
      )}
      {dashboard.loading && !dashboard.data && !dashboard.error ? (
        <Card>
          <div className='state-view'>加载中...</div>
        </Card>
      ) : !agents.length && !dashboard.error ? (
        <Card>
          <EmptyState description='尚未安装 Agent，请点击“添加设备”开始接入。' />
        </Card>
      ) : (
        <>
          <GroupRail
            groups={groups}
            selected={selectedGroup}
            agents={agents}
            onSelect={(id) => {
              setSelectedGroup(id);
              setStatusFilter('all');
            }}
          />
          <main className='device-monitor-main'>
            <div className='device-section-heading'>
              <div>
                <Typography.Title level={4}>
                  {selectedGroup === 'all'
                    ? '全部设备'
                    : (groups.find((group) => group.id === selectedGroup)
                        ?.name ?? '设备分组')}
                </Typography.Title>
              </div>
            </div>
            <OverviewCards agents={agents} dark={mode === 'dark'} />
            <StatusFilters
              value={statusFilter}
              onChange={setStatusFilter}
              search={search}
              onSearch={setSearch}
            />
            {!visibleAgents.length ? (
              <Card>
                <EmptyState description='没有符合当前筛选条件的设备。' />
              </Card>
            ) : (
              <div className='device-card-grid'>
                {visibleAgents.map((agent) => (
                  <DeviceMonitorCard
                    key={agent.id}
                    agent={agent}
                    operating={operatingAgentId === agent.id}
                    onCopyName={() => copy(agent.name || agent.id, '设备名称已复制')}
                    onCopyModel={(model) => copy(model, '模型名称已复制')}
                    onCopyId={() => void copy(agent.id, '设备标识已复制')}
                    onRename={(name) => renameAgent(agent.id, name)}
                    onRotate={() => rotateAgent(agent.id, agent.name || '设备')}
                    onRevoke={() => revokeAgent(agent.id, agent.status)}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}
      <AddDeviceModal
        open={deviceModalOpen}
        models={models}
        selectedModel={selectedModel}
        creating={creating}
        onClose={() => setDeviceModalOpen(false)}
        onModelChange={setSelectedModel}
        onSubmit={(values) => void createToken(values)}
      />
      <DeploymentCommandModal
        tokenResult={tokenResult}
        command={command}
        onClose={() => setTokenResult(null)}
        onCopy={() => void copy(command, '启动命令已复制')}
      />
      <Modal
        title='新设备凭证'
        open={Boolean(rotatedCredential)}
        onCancel={() => setRotatedCredential(null)}
        footer={<Button type='primary' onClick={() => setRotatedCredential(null)}>完成</Button>}
      >
        <Typography.Paragraph type='warning'>该凭证仅展示一次。请立即更新“{rotatedCredential?.name}”的 Agent 配置。</Typography.Paragraph>
        <Typography.Text copyable={{ text: rotatedCredential?.credential }}>{rotatedCredential?.credential}</Typography.Text>
      </Modal>
    </section>
  );
}
