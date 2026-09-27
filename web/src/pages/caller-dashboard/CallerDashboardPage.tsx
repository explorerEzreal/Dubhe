import { useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import './styles.less';

interface ApiKeyRow {
  id: string;
  name: string;
  group: string;
  key: string;
  channel: string;
  current: number;
  limit: number;
  calls: number;
  tokens: string;
  status: 'active' | 'disabled';
  created: string;
}

type KeyFormValues = Pick<ApiKeyRow, 'name' | 'channel' | 'group'>;
type ConfirmAction = { id: string; action: 'delete' | 'toggle' } | null;

const initialKeys: ApiKeyRow[] = [
  { id: '1', name: '生产服务端', group: '生产环境', key: 'sk-prod-4x9m7q8f2a', channel: 'OpenAI', current: 8, limit: 20, calls: 12480, tokens: '2.16M', status: 'active', created: '2026-09-18 14:32' },
  { id: '2', name: '测试环境', group: '测试环境', key: 'sk-test-7p3kd6d91c', channel: 'Azure OpenAI', current: 2, limit: 10, calls: 4280, tokens: '618K', status: 'disabled', created: '2026-09-12 09:15' },
  { id: '3', name: '内部工具', group: '内部工具', key: 'sk-tool-2q5vw13a7e', channel: 'DeepSeek', current: 14, limit: 20, calls: 11880, tokens: '2.04M', status: 'active', created: '2026-09-08 16:48' },
  { id: '4', name: '数据分析服务', group: '生产环境', key: 'sk-prod-8c1n0k5b6d', channel: 'OpenAI', current: 1, limit: 12, calls: 860, tokens: '102K', status: 'active', created: '2026-08-27 11:06' },
  { id: '5', name: '自动化脚本', group: '内部工具', key: 'sk-auto-6j4h2m9x0p', channel: '自定义渠道', current: 0, limit: 5, calls: 140, tokens: '18K', status: 'disabled', created: '2026-08-21 18:20' },
];

const channelColors: Record<string, string> = {
  OpenAI: '#378add',
  'Azure OpenAI': '#7f77dd',
  DeepSeek: '#f79009',
  自定义渠道: '#d4537e',
};

function maskKey(value: string): string {
  const prefixEnd = value.indexOf('-') + 1;
  return `${value.slice(0, prefixEnd)}••••••${value.slice(-4).toUpperCase()}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN');
}

export function CallerDashboardPage() {
  const { message } = App.useApp();
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [nameQuery, setNameQuery] = useState('');
  const [keyQuery, setKeyQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [form] = Form.useForm<KeyFormValues>();

  const filteredKeys = useMemo(() => {
    const normalizedName = nameQuery.trim().toLowerCase();
    const normalizedKey = keyQuery.trim().toLowerCase();
    return keys.filter((item) => {
      const matchesName = !normalizedName || item.name.toLowerCase().includes(normalizedName);
      const matchesKey = !normalizedKey || item.key.toLowerCase().includes(normalizedKey) || maskKey(item.key).toLowerCase().includes(normalizedKey);
      return matchesName && matchesKey && (!groupFilter || item.group === groupFilter) && (!statusFilter || item.status === statusFilter);
    });
  }, [groupFilter, keyQuery, keys, nameQuery, statusFilter]);

  const activeCount = keys.filter((item) => item.status === 'active').length;
  const resetFilters = () => {
    setNameQuery('');
    setKeyQuery('');
    setGroupFilter('');
    setStatusFilter('');
  };

  const openCreate = () => {
    setEditingKey(null);
    form.resetFields();
    form.setFieldValue('group', '生产环境');
    setFormOpen(true);
  };

  const openEdit = (item: ApiKeyRow) => {
    setEditingKey(item);
    form.setFieldsValue({ name: item.name, channel: item.channel, group: item.group });
    setFormOpen(true);
  };

  const handleFormSubmit = (values: KeyFormValues) => {
    if (editingKey) {
      setKeys((items) => items.map((item) => item.id === editingKey.id ? { ...item, ...values } : item));
      setFormOpen(false);
      message.success('密钥信息已更新');
      return;
    }
    const suffix = Math.random().toString(36).slice(2, 12);
    const newKey: ApiKeyRow = {
      id: String(Date.now()),
      ...values,
      key: `sk-${values.group === '生产环境' ? 'prod' : values.group === '测试环境' ? 'test' : 'tool'}-${suffix}`,
      current: 0,
      limit: 10,
      calls: 0,
      tokens: '0',
      status: 'active',
      created: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
    };
    setKeys((items) => [newKey, ...items]);
    setFormOpen(false);
    setCreatedSecret(newKey.key);
  };

  const copyKey = async (value: string, successMessage = '完整 key 已复制') => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement('textarea');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    message.success(successMessage);
  };

  const confirmTitle = confirmAction
    ? confirmAction.action === 'delete'
      ? '删除 API 密钥？'
      : keys.find((item) => item.id === confirmAction.id)?.status === 'active'
        ? '禁用 API 密钥？'
        : '启用 API 密钥？'
    : '';
  const confirmDescription = confirmAction
    ? (() => {
        const item = keys.find((row) => row.id === confirmAction.id);
        if (!item) return '';
        if (confirmAction.action === 'delete') return `删除「${item.name}」后，该 key 将立即失效且不可恢复。`;
        return item.status === 'active' ? `禁用「${item.name}」后，使用它发起的新请求将被拒绝。` : `启用「${item.name}」后，该 key 将恢复调用权限。`;
      })()
    : '';

  const columns: ColumnsType<ApiKeyRow> = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 148,
      render: (value: string, item) => <div><Typography.Text strong>{value}</Typography.Text><Typography.Text className='api-key-subtext'>{item.group}</Typography.Text></div>,
    },
    {
      title: '密钥 key',
      dataIndex: 'key',
      width: 210,
      render: (value: string) => <Space size={4} className='api-key-value'><Typography.Text className='api-key-mono' ellipsis={{ tooltip: value }}>{maskKey(value)}</Typography.Text><Button type='text' size='small' icon={<CopyOutlined />} aria-label='复制完整 key' title='复制完整 key' onClick={() => void copyKey(value)} /></Space>,
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      width: 132,
      render: (value: string) => <Space size={7}><span className='api-channel-dot' style={{ background: channelColors[value] ?? 'var(--accent-color)' }} />{value}</Space>,
    },
    {
      title: '当前并发',
      key: 'concurrency',
      width: 160,
      render: (_value, item) => { const percent = Math.round((item.current / item.limit) * 100); return <div className='api-concurrency'><div><span>{item.current} / {item.limit}</span><Typography.Text type='secondary'>{percent}%</Typography.Text></div><Progress percent={percent} showInfo={false} size='small' status={percent > 90 ? 'exception' : percent >= 70 ? 'active' : 'normal'} /></div>; },
    },
    {
      title: '用量（今日）',
      key: 'usage',
      width: 130,
      render: (_value, item) => <div><span>{formatNumber(item.calls)} 次</span><Typography.Text className='api-key-subtext'>{item.tokens} Token</Typography.Text></div>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 92,
      render: (value: ApiKeyRow['status']) => <Tag className={`api-status-tag ${value}`} icon={value === 'active' ? <CheckCircleOutlined /> : undefined}>{value === 'active' ? '启用' : '已禁用'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created', width: 132, render: (value: string) => <Typography.Text type='secondary'>{value}</Typography.Text> },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      fixed: 'right',
      render: (_value, item) => <Space size={10} className='api-key-actions'><Button type='link' size='small' icon={<EditOutlined />} onClick={() => openEdit(item)}>编辑</Button><Button type='link' size='small' onClick={() => setConfirmAction({ id: item.id, action: 'toggle' })}>{item.status === 'active' ? '禁用' : '启用'}</Button><Button type='link' danger size='small' icon={<DeleteOutlined />} onClick={() => setConfirmAction({ id: item.id, action: 'delete' })}>删除</Button></Space>,
    },
  ];

  return (
    <section className='api-keys-page'>
      <div className='api-keys-page-head'>
        <div><Typography.Text className='api-keys-eyebrow'>调用管理</Typography.Text><Typography.Title level={1}>API 密钥</Typography.Title><Typography.Paragraph type='secondary'>统一管理访问凭证、渠道权限和调用用量</Typography.Paragraph></div>
        <Button type='primary' icon={<PlusOutlined />} onClick={openCreate}>创建密钥</Button>
      </div>

      <Row gutter={[12, 12]} className='api-key-stats'>
        <Col xs={24} sm={12} xl={6}><Card><Statistic title='密钥总数' value={keys.length} /><Typography.Text className='api-stat-foot positive'>{activeCount} 个启用中</Typography.Text></Card></Col>
        <Col xs={24} sm={12} xl={6}><Card><Statistic title='今日调用' value={28640} /><Typography.Text className='api-stat-foot positive'>较昨日 +12.6%</Typography.Text></Card></Col>
        <Col xs={24} sm={12} xl={6}><Card><Statistic title='今日 Token' value='4.82M' /><Typography.Text className='api-stat-foot'>输入 3.1M · 输出 1.7M</Typography.Text></Card></Col>
        <Col xs={24} sm={12} xl={6}><Card><Statistic title='当前并发' value={24} suffix='/ 80' /><Typography.Text className='api-stat-foot positive'><ThunderboltOutlined /> 运行正常</Typography.Text></Card></Col>
      </Row>

      <Card className='api-key-workspace' styles={{ body: { padding: 0 } }}>
        <div className='api-key-toolbar'>
          <Space wrap size={[8, 8]} className='api-key-filters'>
            <Input allowClear prefix={<SearchOutlined />} placeholder='搜索名称' value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} />
            <Input allowClear prefix={<KeyOutlined />} placeholder='搜索 key' value={keyQuery} onChange={(event) => setKeyQuery(event.target.value)} />
            <Select allowClear placeholder='全部分组' value={groupFilter || undefined} onChange={(value) => setGroupFilter(value ?? '')} options={['生产环境', '测试环境', '内部工具'].map((value) => ({ label: value, value }))} />
            <Select allowClear placeholder='全部状态' value={statusFilter || undefined} onChange={(value) => setStatusFilter(value ?? '')} options={[{ label: '启用', value: 'active' }, { label: '已禁用', value: 'disabled' }]} />
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          </Space>
          <Typography.Text type='secondary' className='api-key-result-count'>共 {filteredKeys.length} 个密钥</Typography.Text>
        </div>
        <Table<ApiKeyRow> rowKey='id' columns={columns} dataSource={filteredKeys} scroll={{ x: 1240 }} pagination={{ pageSize: 5, hideOnSinglePage: true, showSizeChanger: false, showTotal: (total, range) => `显示 ${range[0]}-${range[1]}，共 ${total} 个` }} locale={{ emptyText: <div className='api-key-empty'><strong>没有匹配的密钥</strong><span>试试调整搜索关键词或筛选条件</span><Button onClick={resetFilters}>重置筛选</Button></div> }} />
      </Card>

      <Modal open={formOpen} title={editingKey ? '编辑 API 密钥' : '创建 API 密钥'} okText={editingKey ? '保存修改' : '保存并创建'} cancelText='取消' onCancel={() => setFormOpen(false)} onOk={() => void form.submit()} destroyOnClose>
        <Typography.Paragraph type='secondary'>{editingKey ? '仅修改密钥名称、渠道和分组，不会改变已有 key。' : '创建后请妥善保存完整 key。'}</Typography.Paragraph>
        <Form form={form} layout='vertical' onFinish={handleFormSubmit} initialValues={{ group: '生产环境' }}>
          <Form.Item label='密钥名称' name='name' rules={[{ required: true, message: '请输入密钥名称' }]}><Input maxLength={40} placeholder='例如：生产服务端' /></Form.Item>
          <Form.Item label='选择渠道' name='channel' rules={[{ required: true, message: '请选择渠道' }]}><Select placeholder='请选择渠道' options={Object.keys(channelColors).map((value) => ({ label: value, value }))} /></Form.Item>
          <Form.Item label='所属分组' name='group'><Select options={['生产环境', '测试环境', '内部工具'].map((value) => ({ label: value, value }))} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={Boolean(confirmAction)} title={confirmTitle} okText={confirmAction?.action === 'delete' ? '确认删除' : '确认'} cancelText='取消' okButtonProps={{ danger: confirmAction?.action === 'delete' || keys.find((item) => item.id === confirmAction?.id)?.status === 'active' }} onCancel={() => setConfirmAction(null)} onOk={() => { if (!confirmAction) return; const target = keys.find((item) => item.id === confirmAction.id); if (!target) return; if (confirmAction.action === 'delete') { setKeys((items) => items.filter((item) => item.id !== target.id)); message.success('密钥已删除'); } else { setKeys((items) => items.map((item) => item.id === target.id ? { ...item, status: item.status === 'active' ? 'disabled' : 'active' } : item)); message.success(target.status === 'active' ? '密钥已禁用' : '密钥已启用'); } setConfirmAction(null); }}>
        <Typography.Paragraph>{confirmDescription}</Typography.Paragraph>
      </Modal>

      <Modal open={Boolean(createdSecret)} title='密钥创建成功' okText='我已保存' cancelButtonProps={{ style: { display: 'none' } }} onOk={() => setCreatedSecret(null)} onCancel={() => setCreatedSecret(null)}>
        <Typography.Paragraph type='secondary'>完整 key 只展示这一次，请立即复制并保存。</Typography.Paragraph>
        <Typography.Text strong>完整 API key</Typography.Text>
        <div className='api-secret-box'><Typography.Text className='api-key-mono' ellipsis={{ tooltip: createdSecret ?? '' }}>{createdSecret}</Typography.Text><Button icon={<CopyOutlined />} onClick={() => createdSecret && void copyKey(createdSecret)}>复制</Button></div>
      </Modal>
    </section>
  );
}
