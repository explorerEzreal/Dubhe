import { Alert, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ApiKeyCreateResult, ApiKeySummary } from '../../api/key-api';
import type { ModelSummary } from '../../api/model-api';
import { formatDate, formatDateOnly } from '../../utils/format';
import { EmptyState } from '../../components';

function modelStatus(model: ModelSummary): { text: string; color: string } {
  if (model.readyInstances > 0) return { text: '在线可用', color: 'green' };
  if (model.instanceCount > 0) return { text: '暂不可用', color: 'orange' };
  return { text: '离线', color: 'default' };
}

export function UsageMetrics({ totalCalls, errorRate, avgLatencyMs }: { totalCalls: number; errorRate: number; avgLatencyMs: number }) {
  return <div className='metric-grid'><Card><Statistic title='总调用数' value={totalCalls} /></Card><Card><Statistic title='错误率' value={(errorRate * 100).toFixed(1)} suffix='%' /></Card><Card><Statistic title='平均延迟' value={avgLatencyMs} suffix='ms' /></Card></div>;
}

export function ModelCatalog({ models, hasError }: { models: ModelSummary[]; hasError: boolean }) {
  return <Card title='模型目录' style={{ marginBottom: 24 }}>{!models.length && !hasError ? <EmptyState description='暂无模型' /> : <Row gutter={[16, 16]}>{models.map((model) => { const status = modelStatus(model); return <Col xs={24} md={12} lg={8} key={model.id}><Card size='small' title={model.name} extra={<Tag color={status.color}>{status.text}</Tag>}><Typography.Paragraph type='secondary'>{model.description || 'OpenAI 兼容本地模型服务'}</Typography.Paragraph><Typography.Text>就绪实例：{model.readyInstances} / {model.instanceCount}</Typography.Text></Card></Col>; })}</Row>}</Card>;
}

export function ApiKeyTable({ keys, hasError, onDisable, onRemove }: { keys: ApiKeySummary[]; hasError: boolean; onDisable: (id: string) => void; onRemove: (id: string) => void }) {
  return <Card title='API Key'>{!keys.length && !hasError ? <EmptyState description='暂无 API Key' /> : <Table rowKey='id' dataSource={keys} pagination={false} scroll={{ x: 720 }} columns={[{ title: '前缀', dataIndex: 'prefix' }, { title: '状态', dataIndex: 'status', render: (status: string) => <Tag color={status === 'active' ? 'green' : 'default'}>{status === 'active' ? '启用' : '已禁用'}</Tag> }, { title: '创建时间', dataIndex: 'createdAt', render: (value: string) => formatDate(value) }, { title: '过期时间', dataIndex: 'expiresAt', render: (value: string | null) => formatDateOnly(value) }, { title: '操作', key: 'actions', render: (_: unknown, record: ApiKeySummary) => <Space><Button disabled={record.status !== 'active'} onClick={() => onDisable(record.id)}>禁用</Button><Popconfirm title='确认删除此 API Key？' okText='删除' cancelText='取消' onConfirm={() => onRemove(record.id)}><Button danger>删除</Button></Popconfirm></Space> }]} />}</Card>;
}

export function CreateKeyModal({ open, models, creating, onClose, onSubmit }: { open: boolean; models: ModelSummary[]; creating: boolean; onClose: () => void; onSubmit: (values: { models?: string[]; expiresAt?: string }) => void }) {
  return <Modal title='创建 API Key' open={open} onCancel={onClose} footer={null} destroyOnClose><Form layout='vertical' onFinish={onSubmit}><Form.Item label='模型权限' name='models' extra='不选择表示允许访问当前全部模型'><Select mode='multiple' placeholder='选择模型（可选）' options={models.map((model) => ({ label: model.name, value: model.name }))} /></Form.Item><Form.Item label='过期日期' name='expiresAt'><Input type='date' /></Form.Item><Button type='primary' htmlType='submit' loading={creating} block>创建并显示一次性明文</Button></Form></Modal>;
}

export function CreatedKeyModal({ createdKey, curl, sdk, onClose, onCopy }: { createdKey: ApiKeyCreateResult | null; curl: string; sdk: string; onClose: () => void; onCopy: () => void }) {
  return <Modal title='API Key 只显示一次' open={Boolean(createdKey)} onCancel={onClose} footer={<Button type='primary' onClick={onClose}>我已保存</Button>} width={760}>{createdKey && <Space direction='vertical' size='middle' style={{ width: '100%' }}><Alert type='warning' showIcon message='请立即保存，关闭后无法再次查看完整 Key。' /><Typography.Text strong>完整 API Key</Typography.Text><Typography.Text className='code-block' copyable={{ text: createdKey.plaintext }}>{createdKey.plaintext}</Typography.Text><Typography.Text strong>curl 示例</Typography.Text><Typography.Text className='code-block' copyable={{ text: curl }}>{curl}</Typography.Text><Button onClick={onCopy}>复制 curl</Button><Typography.Text strong>OpenAI Python 示例</Typography.Text><Typography.Text className='code-block' copyable={{ text: sdk }}>{sdk}</Typography.Text></Space>}</Modal>;
}

