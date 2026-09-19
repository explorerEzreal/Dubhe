import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import type { AgentSummary, ModelInstanceSummary } from '../../api/agent-api';
import type { EnrollmentTokenResult } from '../../api/enrollment-api';
import type { ModelSummary } from '../../api/model-api';
import type { GroupSummary } from '../../api/group-api';
import {
  AGENT_STATUS_REASON_TEXT,
  AGENT_STATUS_TEXT,
  MODEL_STATE_TEXT,
  statusColor,
} from '../../constants';
import { displayValue } from '../../utils/format';

export interface AddDeviceFormValues {
  deviceName: string;
  localHost: string;
  localPort: string;
}

export function ModelInstanceCard({ model }: { model: ModelInstanceSummary }) {
  return (
    <Card
      size='small'
      title={model.name}
      extra={
        <Tag color={statusColor(model.state)}>
          {MODEL_STATE_TEXT[model.state] ?? model.state}
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

export function AgentCard({
  agent,
  onRotate,
  onRevoke,
}: {
  agent: AgentSummary;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  return (
    <Col xs={24} lg={12}>
      <Card
        title={agent.name || agent.id}
        extra={
          <Tag color={statusColor(agent.status)}>
            {AGENT_STATUS_TEXT[agent.status] ?? agent.status}
          </Tag>
        }
      >
        <Descriptions column={1} size='small'>
          <Descriptions.Item label='设备 ID'>{agent.id}</Descriptions.Item>
          <Descriptions.Item label='状态说明'>
            {AGENT_STATUS_REASON_TEXT[agent.statusReason ?? 'heartbeat'] ??
              '暂无'}
          </Descriptions.Item>
          <Descriptions.Item label='最近心跳'>
            {agent.lastSeenAt
              ? new Date(agent.lastSeenAt).toLocaleString()
              : '—'}
          </Descriptions.Item>
          <Descriptions.Item label='资源快照'>
            {agent.hardwareInfo
              ? Object.entries(agent.hardwareInfo)
                  .map(([key, value]) => `${key}: ${displayValue(value)}`)
                  .join('，')
              : '暂无'}
          </Descriptions.Item>
        </Descriptions>
        <Typography.Title level={5}>模型状态</Typography.Title>
        {agent.modelInstances?.length ? (
          <Row gutter={[8, 8]}>
            {agent.modelInstances.map((model) => (
              <Col span={24} key={model.name}>
                <ModelInstanceCard model={model} />
              </Col>
            ))}
          </Row>
        ) : (
          <Typography.Text type='secondary'>暂无模型状态</Typography.Text>
        )}
        <Space style={{ marginTop: 16 }}>
          <Button
            disabled={agent.status === 'created' || agent.status === 'revoked'}
            onClick={onRotate}
          >
            轮换凭证
          </Button>
          <Button
            danger
            disabled={agent.status === 'revoked'}
            onClick={onRevoke}
          >
            {agent.status === 'created' ? '取消接入' : '撤销设备'}
          </Button>
        </Space>
      </Card>
    </Col>
  );
}

export function ModelStatistics({ models }: { models: ModelSummary[] }) {
  return (
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
  );
}

export function AddDeviceModal({
  open,
  models,
  selectedModel,
  creating,
  onClose,
  onModelChange,
  onSubmit,
}: {
  open: boolean;
  models: ModelSummary[];
  selectedModel: string;
  creating: boolean;
  onClose: () => void;
  onModelChange: (value: string) => void;
  onSubmit: (values: AddDeviceFormValues) => void;
}) {
  return (
    <Modal
      title='添加设备'
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        layout='vertical'
        initialValues={{
          deviceName: 'Bubhe Agent-001',
          localHost: '127.0.0.1',
          localPort: '8080',
        }}
        onFinish={onSubmit}
      >
        <Form.Item
          label='设备名称'
          name='deviceName'
          rules={[
            { required: true, whitespace: true, message: '请输入设备名称' },
          ]}
        >
          <Input maxLength={200} placeholder='请输入设备名称' />
        </Form.Item>
        <Form.Item
          label='共享模型'
          extra='每个 Agent 进程绑定一个模型和一个本地 OpenAI 兼容服务地址。'
        >
          <AutoComplete
            placeholder='选择或输入模型名'
            value={selectedModel || undefined}
            onChange={onModelChange}
            options={models.map((model) => ({
              label: model.name,
              value: model.name,
            }))}
          />
        </Form.Item>
        <Form.Item
          label='本地模型服务域名'
          name='localHost'
          rules={[
            {
              required: true,
              whitespace: true,
              message: '请输入本地模型服务域名',
            },
          ]}
        >
          <Input placeholder='127.0.0.1' />
        </Form.Item>
        <Form.Item
          label='本地模型服务端口'
          name='localPort'
          rules={[
            {
              required: true,
              whitespace: true,
              message: '请输入本地模型服务端口',
            },
            {
              pattern:
                /^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/,
              message: '端口必须是 1-65535 的整数',
            },
          ]}
        >
          <Input inputMode='numeric' placeholder='8080' />
        </Form.Item>
        <Button type='primary' htmlType='submit' loading={creating} block>
          生成一次性部署令牌
        </Button>
      </Form>
    </Modal>
  );
}

export function DeploymentCommandModal({
  tokenResult,
  command,
  onClose,
  onCopy,
}: {
  tokenResult: EnrollmentTokenResult | null;
  command: string;
  onClose: () => void;
  onCopy: () => void;
}) {
  return (
    <Modal
      title='部署命令'
      open={Boolean(tokenResult)}
      onCancel={onClose}
      footer={
        <Button type='primary' onClick={onClose}>
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
            适用于 Linux systemd 和 macOS launchd。模型设备需要 Node.js
            22+，本地服务需支持 <code>/v1/models</code> 与{' '}
            <code>/v1/chat/completions</code>；命令会自动安装并启动常驻服务。
          </Typography.Paragraph>
          <Typography.Text strong>一次性令牌</Typography.Text>
          <Typography.Text copyable={{ text: tokenResult.token }}>
            {tokenResult.token}
          </Typography.Text>
          <Typography.Text strong>启动命令</Typography.Text>
          <Typography.Text className='code-block' copyable={{ text: command }}>
            {command}
          </Typography.Text>
          <Button onClick={onCopy}>复制启动命令</Button>
        </Space>
      )}
    </Modal>
  );
}

// ─── 分组管理组件 ────────────────────────────────────────────

export function GroupCard({
  group,
  onEdit,
  onDelete,
  onInvite,
}: {
  group: GroupSummary;
  onEdit: () => void;
  onDelete: () => void;
  onInvite: () => void;
}) {
  return (
    <Col xs={24} md={12} lg={8}>
      <Card
        title={group.name}
        extra={<Tag>{group.agentCount} 台设备</Tag>}
        actions={[
          <Button type='link' key='edit' onClick={onEdit}>
            编辑
          </Button>,
          <Button type='link' key='invite' onClick={onInvite}>
            邀请
          </Button>,
          <Button type='link' key='delete' danger onClick={onDelete}>
            删除
          </Button>,
        ]}
      >
        <Typography.Paragraph type='secondary'>
          {group.description || '暂无描述'}
        </Typography.Paragraph>
      </Card>
    </Col>
  );
}

export function CreateEditGroupModal({
  open,
  editing,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: GroupSummary | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; description?: string | null }) => void;
}) {
  return (
    <Modal
      title={editing ? '编辑分组' : '创建分组'}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        layout='vertical'
        onFinish={onSubmit}
        initialValues={
          editing
            ? { name: editing.name, description: editing.description ?? '' }
            : undefined
        }
      >
        <Form.Item
          label='分组名称'
          name='name'
          rules={[{ required: true, message: '请输入分组名称' }]}
        >
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item label='描述' name='description'>
          <Input.TextArea maxLength={500} rows={3} />
        </Form.Item>
        <Button type='primary' htmlType='submit' loading={loading} block>
          {editing ? '保存' : '创建'}
        </Button>
      </Form>
    </Modal>
  );
}

export function InviteTokenModal({
  open,
  token,
  onClose,
  onCopy,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
  onCopy: () => void;
}) {
  return (
    <Modal
      title='邀请码'
      open={open}
      onCancel={onClose}
      footer={
        <Button type='primary' onClick={onClose}>
          完成
        </Button>
      }
    >
      <Space direction='vertical' size='middle' style={{ width: '100%' }}>
        <Alert
          type='info'
          showIcon
          message='将以下邀请码发送给调用者，调用者可通过"添加渠道"功能接入此分组。邀请码 7 天内有效。'
        />
        <Typography.Text strong>邀请码（JWT）</Typography.Text>
        <Typography.Text className='code-block' copyable={{ text: token }}>
          {token}
        </Typography.Text>
        <Button onClick={onCopy}>复制邀请码</Button>
      </Space>
    </Modal>
  );
}

export function AddAgentToGroupModal({
  open,
  groups,
  agents,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  groups: GroupSummary[];
  agents: AgentSummary[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (groupId: string, agentId: string) => void;
}) {
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  return (
    <Modal
      title='将设备加入分组'
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        layout='vertical'
        onFinish={() => {
          if (selectedGroup && selectedAgent)
            onSubmit(selectedGroup, selectedAgent);
        }}
      >
        <Form.Item label='选择分组' required>
          <Select
            placeholder='选择分组'
            value={selectedGroup || undefined}
            onChange={setSelectedGroup}
            options={groups.map((g) => ({ label: g.name, value: g.id }))}
          />
        </Form.Item>
        <Form.Item label='选择设备' required>
          <Select
            placeholder='选择设备'
            value={selectedAgent || undefined}
            onChange={setSelectedAgent}
            options={agents.map((a) => ({
              label: a.name || a.id,
              value: a.id,
            }))}
          />
        </Form.Item>
        <Button
          type='primary'
          htmlType='submit'
          loading={loading}
          block
          disabled={!selectedGroup || !selectedAgent}
        >
          添加
        </Button>
      </Form>
    </Modal>
  );
}
