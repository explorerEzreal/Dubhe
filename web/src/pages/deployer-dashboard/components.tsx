import { Alert, AutoComplete, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Space, Statistic, Tag, Typography } from 'antd';
import type { AgentSummary, ModelInstanceSummary } from '../../api/agent-api';
import type { EnrollmentTokenResult } from '../../api/enrollment-api';
import type { ModelSummary } from '../../api/model-api';
import { AGENT_STATUS_TEXT, MODEL_STATE_TEXT, statusColor } from '../../constants';
import { displayValue } from '../../utils/format';

export function ModelInstanceCard({ model }: { model: ModelInstanceSummary }) {
  return <Card size='small' title={model.name} extra={<Tag color={statusColor(model.state)}>{MODEL_STATE_TEXT[model.state] ?? model.state}</Tag>}>
    <Descriptions column={1} size='small'><Descriptions.Item label='引擎'>{model.engine}</Descriptions.Item><Descriptions.Item label='并发上限'>{model.maxConcurrency}</Descriptions.Item>{model.lastError && <Descriptions.Item label='最近错误'>{model.lastError}</Descriptions.Item>}</Descriptions>
  </Card>;
}

export function AgentCard({ agent, onRotate, onRevoke }: { agent: AgentSummary; onRotate: () => void; onRevoke: () => void }) {
  return <Col xs={24} lg={12}><Card title={agent.name || agent.id} extra={<Tag color={statusColor(agent.status)}>{AGENT_STATUS_TEXT[agent.status] ?? agent.status}</Tag>}>
    <Descriptions column={1} size='small'><Descriptions.Item label='设备 ID'>{agent.id}</Descriptions.Item><Descriptions.Item label='最近心跳'>{agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : '—'}</Descriptions.Item><Descriptions.Item label='资源快照'>{agent.hardwareInfo ? Object.entries(agent.hardwareInfo).map(([key, value]) => `${key}: ${displayValue(value)}`).join('，') : '暂无'}</Descriptions.Item></Descriptions>
    <Typography.Title level={5}>模型状态</Typography.Title>{agent.modelInstances?.length ? <Row gutter={[8, 8]}>{agent.modelInstances.map((model) => <Col span={24} key={model.name}><ModelInstanceCard model={model} /></Col>)}</Row> : <Typography.Text type='secondary'>暂无模型状态</Typography.Text>}
    <Space style={{ marginTop: 16 }}><Button onClick={onRotate}>轮换凭证</Button><Button danger onClick={onRevoke}>撤销设备</Button></Space>
  </Card></Col>;
}

export function ModelStatistics({ models }: { models: ModelSummary[] }) {
  return <div className='metric-grid' style={{ marginTop: 24 }}>{models.map((model) => <Card key={model.id}><Statistic title={model.name} value={model.readyInstances} suffix={`/ ${model.instanceCount} 个实例`} /><Tag color={model.status === 'ready' ? 'green' : 'default'}>{model.status === 'ready' ? '可路由' : '暂无可用实例'}</Tag></Card>)}</div>;
}

export function AddDeviceModal({ open, models, selectedModel, localUrl, creating, onClose, onModelChange, onUrlChange, onSubmit }: { open: boolean; models: ModelSummary[]; selectedModel: string; localUrl: string; creating: boolean; onClose: () => void; onModelChange: (value: string) => void; onUrlChange: (value: string) => void; onSubmit: () => void }) {
  return <Modal title='添加设备' open={open} onCancel={onClose} footer={null} destroyOnClose><Form layout='vertical' onFinish={onSubmit}><Form.Item label='共享模型' extra='每个 Agent 进程绑定一个模型和一个本地 OpenAI 兼容服务地址。'><AutoComplete placeholder='选择或输入模型名' value={selectedModel || undefined} onChange={onModelChange} options={models.map((model) => ({ label: model.name, value: model.name }))} /></Form.Item><Form.Item label='本地模型服务地址' required extra='需要提供 OpenAI 兼容的 /v1/models 和 /v1/chat/completions 接口。'><Input value={localUrl} onChange={(event) => onUrlChange(event.target.value)} placeholder='http://127.0.0.1:11434' /></Form.Item><Button type='primary' htmlType='submit' loading={creating} block>生成一次性部署令牌</Button></Form></Modal>;
}

export function DeploymentCommandModal({ tokenResult, command, onClose, onCopy }: { tokenResult: EnrollmentTokenResult | null; command: string; onClose: () => void; onCopy: () => void }) {
  return <Modal title='部署命令' open={Boolean(tokenResult)} onCancel={onClose} footer={<Button type='primary' onClick={onClose}>完成</Button>} width={720}>{tokenResult && <Space direction='vertical' size='middle' style={{ width: '100%' }}><Alert type='warning' showIcon message={`令牌 ${Math.floor(tokenResult.expiresIn / 60)} 分钟后过期，注册成功后立即失效。`} /><Typography.Paragraph type='secondary'>适用于 Linux systemd 和 macOS launchd。模型设备需要 Node.js 22+，本地服务需支持 <code>/v1/models</code> 与 <code>/v1/chat/completions</code>；命令会自动安装并启动常驻服务。</Typography.Paragraph><Typography.Text strong>一次性令牌</Typography.Text><Typography.Text copyable={{ text: tokenResult.token }}>{tokenResult.token}</Typography.Text><Typography.Text strong>启动命令</Typography.Text><Typography.Text className='code-block' copyable={{ text: command }}>{command}</Typography.Text><Button onClick={onCopy}>复制启动命令</Button></Space>}</Modal>;
}

