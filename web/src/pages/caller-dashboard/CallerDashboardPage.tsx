import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { keyApi, type ApiKeyCreateResult, type ApiKeySummary } from '../../api/key-api';
import { modelApi, type ModelSummary } from '../../api/model-api';
import { usageApi, type UsageSummary } from '../../api/usage-api';
import { config } from '../../config/config';
import { copyText } from '../../utils/clipboard';
import { EmptyState, ErrorState, LoadingState } from '../../components';

function modelStatus(model: ModelSummary): { text: string; color: string } {
  if (model.readyInstances > 0) return { text: '在线可用', color: 'green' };
  if (model.instanceCount > 0) return { text: '暂不可用', color: 'orange' };
  return { text: '离线', color: 'default' };
}

export function CallerDashboardPage() {
  const { message } = App.useApp();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreateResult | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [modelList, keyList, usageSummary] = await Promise.all([modelApi.list(), keyApi.list(), usageApi.summary()]);
      setModels(modelList); setKeys(keyList); setUsage(usageSummary);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => { void load(); }, 15000); return () => window.clearInterval(timer); }, [load]);

  async function createKey(values: { models?: string[]; expiresAt?: string }): Promise<void> {
    setCreating(true);
    try {
      const expiresAt = values.expiresAt ? new Date(`${values.expiresAt}T23:59:59.000Z`).toISOString() : null;
      const result = await keyApi.create({ models: values.models ?? [], expiresAt });
      setCreatedKey(result); setKeyModalOpen(false); await load();
    } catch { message.error('请求失败，请稍后重试'); } finally { setCreating(false); }
  }

  async function copy(value: string, success: string): Promise<void> {
    try { await copyText(value); message.success(success); } catch { message.error('请求失败，请稍后重试'); }
  }

  const curl = createdKey ? `curl ${config.apiBaseUrl}/v1/chat/completions \\\n+  -H "Authorization: Bearer ${createdKey.plaintext}" \\\n+  -H "Content-Type: application/json" \\\n+  -d '{"model":"${models[0]?.name ?? 'llama3:8b'}","messages":[{"role":"user","content":"你好"}]}'` : '';
  const sdk = createdKey ? `from openai import OpenAI\nclient = OpenAI(api_key="${createdKey.plaintext}", base_url="${config.apiBaseUrl}/v1")\nresponse = client.chat.completions.create(model="${models[0]?.name ?? 'llama3:8b'}", messages=[{"role": "user", "content": "你好"}])` : '';

  if (loading && !usage) return <LoadingState />;
  return <section>
    <div className="dashboard-header"><div><Typography.Title level={1}>调用者控制台</Typography.Title><Typography.Paragraph type="secondary">查看可用模型，管理 API Key 并复制调用示例。</Typography.Paragraph></div><Space><Button onClick={() => void load()}>刷新</Button><Button type="primary" onClick={() => setKeyModalOpen(true)}>创建 API Key</Button></Space></div>
    {error && <ErrorState onRetry={() => void load()} />}
    <div className="metric-grid"><Card><Statistic title="总调用数" value={usage?.totalCalls ?? 0} /></Card><Card><Statistic title="错误率" value={((usage?.errorRate ?? 0) * 100).toFixed(1)} suffix="%" /></Card><Card><Statistic title="平均延迟" value={usage?.avgLatencyMs ?? 0} suffix="ms" /></Card></div>
    <Card title="模型目录" style={{ marginBottom: 24 }}>
      {!models.length && !error ? <EmptyState description="暂无模型" /> : <Row gutter={[16, 16]}>{models.map((model) => { const status = modelStatus(model); return <Col xs={24} md={12} lg={8} key={model.id}><Card size="small" title={model.name} extra={<Tag color={status.color}>{status.text}</Tag>}><Typography.Paragraph type="secondary">{model.description || '本地 Ollama 模型'}</Typography.Paragraph><Typography.Text>就绪实例：{model.readyInstances} / {model.instanceCount}</Typography.Text></Card></Col>; })}</Row>}
    </Card>
    <Card title="API Key" extra={<Button type="link" onClick={() => setKeyModalOpen(true)}>创建 Key</Button>}>
      {!keys.length && !error ? <EmptyState description="暂无 API Key" /> : <Table rowKey="id" dataSource={keys} pagination={false} scroll={{ x: 720 }} columns={[{ title: '前缀', dataIndex: 'prefix' }, { title: '状态', dataIndex: 'status', render: (status: string) => <Tag color={status === 'active' ? 'green' : 'default'}>{status === 'active' ? '启用' : '已禁用'}</Tag> }, { title: '创建时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() }, { title: '过期时间', dataIndex: 'expiresAt', render: (value: string | null) => value ? new Date(value).toLocaleDateString() : '永不过期' }, { title: '操作', key: 'actions', render: (_: unknown, record: ApiKeySummary) => <Space><Button disabled={record.status !== 'active'} onClick={() => void keyApi.disable(record.id).then(() => { message.success('API Key 已禁用'); return load(); }).catch(() => message.error('请求失败，请稍后重试'))}>禁用</Button><Popconfirm title="确认删除此 API Key？" okText="删除" cancelText="取消" onConfirm={() => void keyApi.remove(record.id).then(() => { message.success('API Key 已删除'); return load(); }).catch(() => message.error('请求失败，请稍后重试'))}><Button danger>删除</Button></Popconfirm></Space> }]} />}
    </Card>
    <Modal title="创建 API Key" open={keyModalOpen} onCancel={() => setKeyModalOpen(false)} footer={null} destroyOnClose>
      <Form layout="vertical" onFinish={(values: { models?: string[]; expiresAt?: string }) => void createKey(values)}>
        <Form.Item label="模型权限" name="models" extra="不选择表示允许访问当前全部模型"><Select mode="multiple" placeholder="选择模型（可选）" options={models.map((model) => ({ label: model.name, value: model.name }))} /></Form.Item>
        <Form.Item label="过期日期" name="expiresAt"><Input type="date" /></Form.Item>
        <Button type="primary" htmlType="submit" loading={creating} block>创建并显示一次性明文</Button>
      </Form>
    </Modal>
    <Modal title="API Key 只显示一次" open={Boolean(createdKey)} onCancel={() => setCreatedKey(null)} footer={<Button type="primary" onClick={() => setCreatedKey(null)}>我已保存</Button>} width={760}>
      {createdKey && <Space direction="vertical" size="middle" style={{ width: '100%' }}><Alert type="warning" showIcon message="请立即保存，关闭后无法再次查看完整 Key。" /><Typography.Text strong>完整 API Key</Typography.Text><Typography.Text className="code-block" copyable={{ text: createdKey.plaintext }}>{createdKey.plaintext}</Typography.Text><Typography.Text strong>curl 示例</Typography.Text><Typography.Text className="code-block" copyable={{ text: curl }}>{curl}</Typography.Text><Button onClick={() => void copy(curl, 'curl 示例已复制')}>复制 curl</Button><Typography.Text strong>OpenAI Python 示例</Typography.Text><Typography.Text className="code-block" copyable={{ text: sdk }}>{sdk}</Typography.Text></Space>}
    </Modal>
  </section>;
}
