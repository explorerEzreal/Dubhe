import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Col, Descriptions, Form, Modal, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { agentApi, type AgentSummary, type ModelInstanceSummary } from '../../api/agent-api';
import { enrollmentApi, type EnrollmentTokenResult } from '../../api/enrollment-api';
import { modelApi, type ModelSummary } from '../../api/model-api';
import { config } from '../../config/config';
import { copyText } from '../../utils/clipboard';
import { EmptyState, ErrorState, LoadingState } from '../../components';

const agentStatusText: Record<string, string> = { created: '未安装', connecting: '连接中', online: '在线', degraded: '降级', offline: '未连接', revoked: '已撤销' };
const modelStateText: Record<string, string> = { unknown: '未知', checking: '检查中', pulling: '拉取中', ready: '就绪', busy: '忙碌', error: '错误', stopped: '已停止', offline: '离线' };

function statusColor(status: string): string {
  if (status === 'online' || status === 'ready') return 'green';
  if (status === 'degraded' || status === 'pulling' || status === 'checking' || status === 'busy') return 'orange';
  if (status === 'error' || status === 'revoked') return 'red';
  return 'default';
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return '—'; }
}

function ModelInstance({ model }: { model: ModelInstanceSummary }) {
  return <Card size="small" title={model.name} extra={<Tag color={statusColor(model.state)}>{modelStateText[model.state] ?? model.state}</Tag>}>
    <Descriptions column={1} size="small">
      <Descriptions.Item label="引擎">{model.engine}</Descriptions.Item>
      <Descriptions.Item label="并发上限">{model.maxConcurrency}</Descriptions.Item>
      {model.lastError && <Descriptions.Item label="最近错误">{model.lastError}</Descriptions.Item>}
    </Descriptions>
  </Card>;
}

export function DeployerDashboardPage() {
  const { message } = App.useApp();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [tokenResult, setTokenResult] = useState<EnrollmentTokenResult | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [agentList, modelList] = await Promise.all([agentApi.list(), modelApi.list()]);
      setAgents(agentList);
      setModels(modelList);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => { void load(); }, 15000); return () => window.clearInterval(timer); }, [load]);

  async function createToken(): Promise<void> {
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
    ? `curl -fsSL "${config.agentInstallScriptUrl}" | sh -s -- --cloud-url "${config.cloudWebSocketUrl}" --enrollment-token "${tokenResult.token}"${selectedModels.length ? ` --models "${selectedModels.join(',')}"` : ''}`
    : '';

  async function copy(value: string, success = '已复制'): Promise<void> {
    try { await copyText(value); message.success(success); } catch { message.error('请求失败，请稍后重试'); }
  }

  if (loading && !agents.length) return <LoadingState />;
  return <section>
    <div className="dashboard-header"><div><Typography.Title level={1}>部署者控制台</Typography.Title><Typography.Paragraph type="secondary">管理本地设备、Ollama 模型和共享状态。</Typography.Paragraph></div><Space><Button onClick={() => void load()}>刷新</Button><Button type="primary" onClick={() => setDeviceModalOpen(true)}>添加设备</Button></Space></div>
    {error && <ErrorState onRetry={() => void load()} />}
    <Modal title="添加设备" open={deviceModalOpen} onCancel={() => setDeviceModalOpen(false)} footer={null} destroyOnClose>
      <Form layout="vertical" onFinish={() => void createToken()}>
        <Form.Item label="共享模型" extra="可多选；Agent 将按命令中的 MODELS 启动。"><Select mode="multiple" placeholder="选择模型（可选）" value={selectedModels} onChange={setSelectedModels} options={models.map((model) => ({ label: model.name, value: model.name }))} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={creating} block>生成一次性部署令牌</Button>
      </Form>
    </Modal>
    <Modal title="部署命令" open={Boolean(tokenResult)} onCancel={() => setTokenResult(null)} footer={<Button type="primary" onClick={() => setTokenResult(null)}>完成</Button>} width={720}>
      {tokenResult && <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="warning" showIcon message={`令牌 ${Math.floor(tokenResult.expiresIn / 60)} 分钟后过期，注册成功后立即失效。`} />
        <Typography.Text strong>一次性令牌</Typography.Text><Typography.Text copyable={{ text: tokenResult.token }}>{tokenResult.token}</Typography.Text>
        <Typography.Text strong>单行启动命令</Typography.Text><Typography.Text className="code-block" copyable={{ text: command }}>{command}</Typography.Text>
        <Button onClick={() => void copy(command, '启动命令已复制')}>复制启动命令</Button>
      </Space>}
    </Modal>
    {!agents.length && !error ? <Card><EmptyState description="尚未安装 Agent，请点击“添加设备”开始接入。" /></Card> : <Row gutter={[16, 16]}>{agents.map((agent) => <Col xs={24} lg={12} key={agent.id}><Card title={agent.name || agent.id} extra={<Tag color={statusColor(agent.status)}>{agentStatusText[agent.status] ?? agent.status}</Tag>}>
      <Descriptions column={1} size="small"><Descriptions.Item label="设备 ID">{agent.id}</Descriptions.Item><Descriptions.Item label="最近心跳">{agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : '—'}</Descriptions.Item><Descriptions.Item label="资源快照">{agent.hardwareInfo ? Object.entries(agent.hardwareInfo).map(([key, value]) => `${key}: ${displayValue(value)}`).join('，') : '暂无'}</Descriptions.Item></Descriptions>
      <Typography.Title level={5}>模型状态</Typography.Title>
      {agent.modelInstances?.length ? <Row gutter={[8, 8]}>{agent.modelInstances.map((model) => <Col span={24} key={model.name}><ModelInstance model={model} /></Col>)}</Row> : <Typography.Text type="secondary">暂无模型状态</Typography.Text>}
      <Space style={{ marginTop: 16 }}><Button onClick={() => void agentApi.rotate(agent.id).then(() => message.success('凭证已轮换')).catch(() => message.error('请求失败，请稍后重试'))}>轮换凭证</Button><Button danger onClick={() => Modal.confirm({ title: '撤销设备凭证？', content: '撤销后该设备将无法继续连接 Cloud。', okText: '撤销', cancelText: '取消', onOk: async () => { try { await agentApi.revoke(agent.id); message.success('设备已撤销'); await load(); } catch { message.error('请求失败，请稍后重试'); } } })}>撤销设备</Button></Space>
    </Card></Col>)}</Row>}
    <div className="metric-grid" style={{ marginTop: 24 }}>{models.map((model) => <Card key={model.id}><Statistic title={model.name} value={model.readyInstances} suffix={`/ ${model.instanceCount} 个实例`} /><Tag color={model.status === 'ready' ? 'green' : 'default'}>{model.status === 'ready' ? '可路由' : '暂无可用实例'}</Tag></Card>)}</div>
  </section>;
}
