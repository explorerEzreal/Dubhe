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
  DEFAULT_LOCAL_MODEL_URL,
  REQUEST_ERROR_MESSAGE,
} from '../../constants';
import { useAsyncList } from '../../hooks';
import { copyText } from '../../utils/clipboard';
import { EmptyState, ErrorState } from '../../components';
import { useAppTheme } from '../../app/providers';
import {
  AddDeviceModal,
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
  const [localUrl, setLocalUrl] = useState(DEFAULT_LOCAL_MODEL_URL);
  const [creating, setCreating] = useState(false);
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
        const status =
          agent.status === 'online'
            ? 'online'
            : ['connecting', 'degraded'].includes(agent.status)
              ? 'busy'
              : 'offline';
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

  async function copy(value: string, success = '已复制'): Promise<void> {
    try {
      await copyText(value);
      message.success(success);
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    }
  }

  const command = tokenResult
    ? `npm install -g dubhe-agent@0.1.0\ndubhe service install --cloud-url ${shellQuote(config.apiBaseUrl)} --token ${shellQuote(tokenResult.token)} --model ${shellQuote(selectedModel || '<模型名>')} --local-url ${shellQuote(localUrl)}`
    : '';

  const updatedLabel = lastUpdatedAt
    ? `最后更新时间：${lastUpdatedAt.getFullYear()}年${String(lastUpdatedAt.getMonth() + 1).padStart(2, '0')}月${String(lastUpdatedAt.getDate()).padStart(2, '0')}日 ${String(lastUpdatedAt.getHours()).padStart(2, '0')}时${String(lastUpdatedAt.getMinutes()).padStart(2, '0')}分`
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
                    onRotate={() =>
                      void agentApi
                        .rotate(agent.id)
                        .then(() => message.success('凭证已轮换'))
                        .catch(() => message.error(REQUEST_ERROR_MESSAGE))
                    }
                    onRevoke={() =>
                      Modal.confirm({
                        title: '撤销设备凭证？',
                        content: '撤销后该设备将无法继续连接 Cloud。',
                        okText: '撤销',
                        cancelText: '取消',
                        onOk: async () => {
                          try {
                            await agentApi.revoke(agent.id);
                            message.success('设备已撤销');
                            await dashboard.reload();
                          } catch {
                            message.error(REQUEST_ERROR_MESSAGE);
                          }
                        },
                      })
                    }
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
        localUrl={localUrl}
        creating={creating}
        onClose={() => setDeviceModalOpen(false)}
        onModelChange={setSelectedModel}
        onUrlChange={setLocalUrl}
        onSubmit={() => void createToken()}
      />
      <DeploymentCommandModal
        tokenResult={tokenResult}
        command={command}
        onClose={() => setTokenResult(null)}
        onCopy={() => void copy(command, '启动命令已复制')}
      />
    </section>
  );
}
