import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  agentApi,
  type AgentSummary,
  type ModelInstanceSummary,
} from '../../api/agent-api';
import {
  enrollmentApi,
  type EnrollmentTokenResult,
} from '../../api/enrollment-api';
import { modelApi, type ModelSummary } from '../../api/model-api';
import { config } from '../../config/config';
import { copyText } from '../../utils/clipboard';
import { EmptyState, ErrorState, LoadingState } from '../../components';

const agentStatusText: Record<string, string> = {
  created: '未安装',
  connecting: '连接中',
  online: '在线',
  degraded: '降级',
  offline: '未连接',
  revoked: '已撤销',
};
const modelStateText: Record<string, string> = {
  unknown: '未知',
  checking: '检查中',
  pulling: '拉取中',
  ready: '就绪',
  busy: '忙碌',
  error: '错误',
  stopped: '已停止',
  offline: '离线',
};

function statusColor(status: string): string {
  if (status === 'online' || status === 'ready') return 'green';
  if (
    status === 'degraded' ||
    status === 'pulling' ||
    status === 'checking' ||
    status === 'busy'
  )
    return 'orange';
  if (status === 'error' || status === 'revoked') return 'red';
  return 'default';
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '—';
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function ModelInstance({ model }: { model: ModelInstanceSummary }) {
  return (
    <Card
      size='small'
      title={model.name}
      extra={
        <Tag color={statusColor(model.state)}>
          {modelStateText[model.state] ?? model.state}
        </Tag>
      }
    >
      <Descriptions column={1} size='small'>
        <Descriptions.Item label='引擎'>{model.engine}</Descriptions.Item>
        <Descriptions.Item label='并发上限'>
          {model.maxConcurrency}
        </Descriptions.Item>
        {model.lastError && (
          <Descriptions.Item label='最近错误'>
            {model.lastError}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
}

export function DeployerDashboardPage() {
  const { message } = App.useApp();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [tokenResult, setTokenResult] = useState<EnrollmentTokenResult | null>(
    null,
  );
  const [selectedModel, setSelectedModel] = useState('');
  const [localUrl, setLocalUrl] = useState('http://127.0.0.1:8080');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [agentList, modelList] = await Promise.all([
        agentApi.list(),
        modelApi.list(),
      ]);
      setAgents(agentList);
      setModels(modelList);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

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
      message.error('请求失败，请稍后重试');
    } finally {
      setCreating(false);
    }
  }

  const command = tokenResult
    ? (() => {
        const modelName = selectedModel || '<模型名>';
        return `npm install -g dubhe-agent\ndubhe service install --cloud-url ${shellQuote(config.apiBaseUrl)} --token ${shellQuote(tokenResult.token)} --model ${shellQuote(modelName)} --local-url ${shellQuote(localUrl)}`;
      })()
    : '';

  async function copy(value: string, success = '已复制'): Promise<void> {
    try {
      await copyText(value);
      message.success(success);
    } catch {
      message.error('请求失败，请稍后重试');
    }
  }

  if (loading && !agents.length) return <LoadingState />;
  return (
    <section>
      <div className='dashboard-header'>
        <div>
          <Typography.Title level={1}>部署者控制台</Typography.Title>
          <Typography.Paragraph type='secondary'>
            管理本地设备、模型服务和共享状态。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button onClick={() => void load()}>刷新</Button>
          <Button type='primary' onClick={() => setDeviceModalOpen(true)}>
            添加设备
          </Button>
        </Space>
      </div>
      {error && <ErrorState onRetry={() => void load()} />}
      <Modal
        title='添加设备'
        open={deviceModalOpen}
        onCancel={() => setDeviceModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout='vertical' onFinish={() => void createToken()}>
          <Form.Item
            label='共享模型'
            extra='每个 Agent 进程绑定一个模型和一个本地 OpenAI 兼容服务地址。'
          >
            <AutoComplete
              placeholder='选择或输入模型名'
              value={selectedModel || undefined}
              onChange={setSelectedModel}
              options={models.map((model) => ({
                label: model.name,
                value: model.name,
              }))}
              filterOption={(input, option) =>
                String(option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            label='本地模型服务地址'
            required
            extra='需要提供 OpenAI 兼容的 /v1/models 和 /v1/chat/completions 接口。'
          >
            <Input
              value={localUrl}
              onChange={(event) => setLocalUrl(event.target.value)}
              placeholder='http://127.0.0.1:11434'
            />
          </Form.Item>
          <Button type='primary' htmlType='submit' loading={creating} block>
            生成一次性部署令牌
          </Button>
        </Form>
      </Modal>
      <Modal
        title='部署命令'
        open={Boolean(tokenResult)}
        onCancel={() => setTokenResult(null)}
        footer={
          <Button type='primary' onClick={() => setTokenResult(null)}>
            完成
          </Button>
        }
        width={720}
      >
        {tokenResult && (
          <Space direction='vertical' size='middle' style={{ width: '100%' }}>
            <Alert
              type='warning'
              showIcon
              message={`令牌 ${Math.floor(tokenResult.expiresIn / 60)} 分钟后过期，注册成功后立即失效。`}
            />
            <Typography.Paragraph type='secondary'>
              适用于 Linux systemd 和 macOS launchd。模型设备需要 Node.js 22+，本地服务需支持
              <code>/v1/models</code> 与 <code>/v1/chat/completions</code>；命令会自动安装并启动常驻服务。
            </Typography.Paragraph>
            <Typography.Text strong>一次性令牌</Typography.Text>
            <Typography.Text copyable={{ text: tokenResult.token }}>
              {tokenResult.token}
            </Typography.Text>
            <Typography.Text strong>启动命令</Typography.Text>
            <Typography.Text
              className='code-block'
              copyable={{ text: command }}
            >
              {command}
            </Typography.Text>
            <Button onClick={() => void copy(command, '启动命令已复制')}>
              复制启动命令
            </Button>
          </Space>
        )}
      </Modal>
      {!agents.length && !error ? (
        <Card>
          <EmptyState description='尚未安装 Agent，请点击“添加设备”开始接入。' />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {agents.map((agent) => (
            <Col xs={24} lg={12} key={agent.id}>
              <Card
                title={agent.name || agent.id}
                extra={
                  <Tag color={statusColor(agent.status)}>
                    {agentStatusText[agent.status] ?? agent.status}
                  </Tag>
                }
              >
                <Descriptions column={1} size='small'>
                  <Descriptions.Item label='设备 ID'>
                    {agent.id}
                  </Descriptions.Item>
                  <Descriptions.Item label='最近心跳'>
                    {agent.lastSeenAt
                      ? new Date(agent.lastSeenAt).toLocaleString()
                      : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label='资源快照'>
                    {agent.hardwareInfo
                      ? Object.entries(agent.hardwareInfo)
                          .map(
                            ([key, value]) => `${key}: ${displayValue(value)}`,
                          )
                          .join('，')
                      : '暂无'}
                  </Descriptions.Item>
                </Descriptions>
                <Typography.Title level={5}>模型状态</Typography.Title>
                {agent.modelInstances?.length ? (
                  <Row gutter={[8, 8]}>
                    {agent.modelInstances.map((model) => (
                      <Col span={24} key={model.name}>
                        <ModelInstance model={model} />
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Typography.Text type='secondary'>
                    暂无模型状态
                  </Typography.Text>
                )}
                <Space style={{ marginTop: 16 }}>
                  <Button
                    onClick={() =>
                      void agentApi
                        .rotate(agent.id)
                        .then(() => message.success('凭证已轮换'))
                        .catch(() => message.error('请求失败，请稍后重试'))
                    }
                  >
                    轮换凭证
                  </Button>
                  <Button
                    danger
                    onClick={() =>
                      Modal.confirm({
                        title: '撤销设备凭证？',
                        content: '撤销后该设备将无法继续连接 Cloud。',
                        okText: '撤销',
                        cancelText: '取消',
                        onOk: async () => {
                          try {
                            await agentApi.revoke(agent.id);
                            message.success('设备已撤销');
                            await load();
                          } catch {
                            message.error('请求失败，请稍后重试');
                          }
                        },
                      })
                    }
                  >
                    撤销设备
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      <div className='metric-grid' style={{ marginTop: 24 }}>
        {models.map((model) => (
          <Card key={model.id}>
            <Statistic
              title={model.name}
              value={model.readyInstances}
              suffix={`/ ${model.instanceCount} 个实例`}
            />
            <Tag color={model.status === 'ready' ? 'green' : 'default'}>
              {model.status === 'ready' ? '可路由' : '暂无可用实例'}
            </Tag>
          </Card>
        ))}
      </div>
    </section>
  );
}
