import { Alert, Button, Card, Col, Form, Input, List, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { ApiKeyCreateResult, ApiKeySummary } from '../../api/key-api';
import type { ChannelSummary, ChannelModels } from '../../api/group-api';
import { formatDate, formatDateOnly } from '../../utils/format';
import { EmptyState } from '../../components';

function modelStatus(model: { name: string; engine: string; state: string; agentCount: number }): { text: string; color: string } {
  if (model.agentCount > 0) return { text: '在线可用', color: 'green' };
  return { text: '离线', color: 'default' };
}

export function UsageMetrics({ totalCalls, errorRate, avgLatencyMs }: { totalCalls: number; errorRate: number; avgLatencyMs: number }) {
  return <div className='metric-grid'><Card><Statistic title='总调用数' value={totalCalls} /></Card><Card><Statistic title='错误率' value={(errorRate * 100).toFixed(1)} suffix='%' /></Card><Card><Statistic title='平均延迟' value={avgLatencyMs} suffix='ms' /></Card></div>;
}

export function ModelCatalog({ channelModels, hasError }: { channelModels: ChannelModels[]; hasError: boolean }) {
  return <Card title='模型广场' style={{ marginBottom: 24 }}>
    {!channelModels.length && !hasError ? <EmptyState description='暂无渠道，请先通过邀请码添加渠道。' /> :
      channelModels.map((channel) => (
        <Card key={channel.channelId} size='small' title={channel.channelName} type='inner' style={{ marginBottom: 12 }}>
          <Row gutter={[16, 16]}>
            {channel.models.map((model) => {
              const status = modelStatus(model);
              return <Col xs={24} md={12} lg={8} key={model.name}>
                <Card size='small' title={model.name} extra={<Tag color={status.color}>{status.text}</Tag>}>
                  <Typography.Text>可用 Agent：{model.agentCount}</Typography.Text>
                </Card>
              </Col>;
            })}
            {!channel.models.length && <Col span={24}><Typography.Text type='secondary'>该渠道暂无模型</Typography.Text></Col>}
          </Row>
        </Card>
      ))
    }
  </Card>;
}

export function ApiKeyTable({ keys, hasError, onDisable, onRemove }: { keys: ApiKeySummary[]; hasError: boolean; onDisable: (id: string) => void; onRemove: (id: string) => void }) {
  return <Card title='API Key'>{!keys.length && !hasError ? <EmptyState description='暂无 API Key' /> : <Table rowKey='id' dataSource={keys} pagination={false} scroll={{ x: 720 }} columns={[{ title: '前缀', dataIndex: 'prefix' }, { title: '渠道', dataIndex: 'channelName', render: (value: string) => value || '—' }, { title: '状态', dataIndex: 'status', render: (status: string) => <Tag color={status === 'active' ? 'green' : 'default'}>{status === 'active' ? '启用' : '已禁用'}</Tag> }, { title: '创建时间', dataIndex: 'createdAt', render: (value: string) => formatDate(value) }, { title: '过期时间', dataIndex: 'expiresAt', render: (value: string | null) => formatDateOnly(value) }, { title: '操作', key: 'actions', render: (_: unknown, record: ApiKeySummary) => <Space><Button disabled={record.status !== 'active'} onClick={() => onDisable(record.id)}>禁用</Button><Popconfirm title='确认删除此 API Key？' okText='删除' cancelText='取消' onConfirm={() => onRemove(record.id)}><Button danger>删除</Button></Popconfirm></Space> }]} />}</Card>;
}

export function CreateKeyModal({ open, channels, creating, onClose, onSubmit }: { open: boolean; channels: ChannelSummary[]; creating: boolean; onClose: () => void; onSubmit: (values: { channelId: string; expiresAt?: string }) => void }) {
  return <Modal title='创建 API Key' open={open} onCancel={onClose} footer={null} destroyOnClose>
    <Form layout='vertical' onFinish={onSubmit}>
      <Form.Item label='选择渠道' name='channelId' rules={[{ required: true, message: '请选择一个渠道' }]}>
        <Select placeholder='选择渠道' options={channels.map((ch) => ({ label: ch.channelName, value: ch.groupId }))} />
      </Form.Item>
      <Form.Item label='过期日期' name='expiresAt'>
        <Input type='date' />
      </Form.Item>
      <Button type='primary' htmlType='submit' loading={creating} block>创建并显示一次性明文</Button>
    </Form>
  </Modal>;
}

export function CreatedKeyModal({ createdKey, curl, sdk, onClose, onCopy }: { createdKey: ApiKeyCreateResult | null; curl: string; sdk: string; onClose: () => void; onCopy: () => void }) {
  return <Modal title='API Key 只显示一次' open={Boolean(createdKey)} onCancel={onClose} footer={<Button type='primary' onClick={onClose}>我已保存</Button>} width={760}>{createdKey && <Space direction='vertical' size='middle' style={{ width: '100%' }}><Alert type='warning' showIcon message='请立即保存，关闭后无法再次查看完整 Key。' /><Typography.Text strong>完整 API Key</Typography.Text><Typography.Text className='code-block' copyable={{ text: createdKey.plaintext }}>{createdKey.plaintext}</Typography.Text><Typography.Text strong>curl 示例</Typography.Text><Typography.Text className='code-block' copyable={{ text: curl }}>{curl}</Typography.Text><Button onClick={onCopy}>复制 curl</Button><Typography.Text strong>OpenAI Python 示例</Typography.Text><Typography.Text className='code-block' copyable={{ text: sdk }}>{sdk}</Typography.Text></Space>}</Modal>;
}

// ─── 渠道管理组件 ────────────────────────────────────────────

export function ChannelList({ channels, hasError, onRemove }: { channels: ChannelSummary[]; hasError: boolean; onRemove: (accessId: string) => void }) {
  return <Card title='我的渠道' style={{ marginBottom: 24 }}>
    {!channels.length && !hasError ? <EmptyState description='暂无渠道。请通过部署者提供的邀请码添加渠道。' /> :
      <List
        dataSource={channels}
        renderItem={(ch) => (
          <List.Item
            actions={[
              <Button key='remove' danger size='small' onClick={() => onRemove(ch.accessId)}>移除</Button>,
            ]}
          >
            <List.Item.Meta
              title={ch.channelName}
              description={
                <Space>
                  <Tag>{ch.source === 'owner' ? '自有' : '受邀'}</Tag>
                  <Typography.Text type='secondary'>{ch.agentCount} 台设备 · {ch.modelCount} 个模型</Typography.Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    }
  </Card>;
}

export function AddChannelModal({ open, loading, onClose, onSubmit }: { open: boolean; loading: boolean; onClose: () => void; onSubmit: (token: string) => void }) {
  const [token, setToken] = useState('');
  return <Modal title='添加渠道' open={open} onCancel={onClose} footer={null} destroyOnClose>
    <Form layout='vertical' onFinish={() => onSubmit(token)}>
      <Form.Item label='邀请码' name='token' rules={[{ required: true, message: '请输入邀请码' }]}>
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder='粘贴部署者提供的邀请码' />
      </Form.Item>
      <Button type='primary' htmlType='submit' loading={loading} block>添加</Button>
    </Form>
  </Modal>;
}
