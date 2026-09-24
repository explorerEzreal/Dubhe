import {
  DeleteOutlined,
  DisconnectOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ApiKeyCreateResult, keyApi } from '../../api/key-api';
import {
  groupApi,
  type ChannelModels,
  type ChannelSummary,
} from '../../api/group-api';
import {
  ContentLoadingState,
  EmptyState,
  ErrorState,
  PageHeader,
} from '../../components';
import { config } from '../../config/config';
import { REQUEST_ERROR_MESSAGE } from '../../constants';
import { useAsyncList } from '../../hooks';
import { copyText } from '../../utils/clipboard';
import {
  AddChannelModal,
  CreatedKeyModal,
  CreateKeyModal,
} from '../caller-dashboard/components';
import './AvailableChannelsPage.less';
import { BrandTag } from '../../components/BrandTag';

type ChannelRow = ChannelSummary & {
  key: string;
  models: ChannelModels['models'];
};

function formatRelativeTime(
  value: string | null | undefined,
  now = Date.now(),
): string {
  if (!value) return '暂无';
  const elapsed = Math.max(0, now - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function formatTokens(value: number): string {
  return Number(value ?? 0).toLocaleString();
}

export function AvailableChannelsPage() {
  const { message } = App.useApp();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const loadChannels = useCallback(async () => {
    const [channels, channelModels] = await Promise.all([
      groupApi.listChannels(),
      groupApi.listChannelModels(),
    ]);
    setLastUpdatedAt(Date.now());
    return { channels, channelModels };
  }, []);
  const channelList = useAsyncList(loadChannels, { poll: true });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const channels = channelList.data?.channels ?? [];
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addingChannel, setAddingChannel] = useState(false);
  const [keyModalChannel, setKeyModalChannel] = useState<ChannelSummary | null>(
    null,
  );
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreateResult | null>(null);

  const rows = useMemo<ChannelRow[]>(() => {
    const modelsByAccessId = new Map(
      (channelList.data?.channelModels ?? []).map((channel) => [
        channel.channelId,
        channel.models,
      ]),
    );
    const keyword = search.trim().toLowerCase();
    return channels
      .filter((channel) => {
        const models = modelsByAccessId.get(channel.accessId) ?? [];
        return `${channel.channelName} ${channel.channelDescription ?? ''} ${models.map((model) => model.name).join(' ')}`
          .toLowerCase()
          .includes(keyword);
      })
      .map((channel) => ({
        ...channel,
        key: channel.accessId,
        models: modelsByAccessId.get(channel.accessId) ?? [],
      }));
  }, [channelList.data?.channelModels, channels, search]);

  async function handleAddChannel(token: string): Promise<void> {
    setAddingChannel(true);
    try {
      const result = await groupApi.addChannel(token);
      message.success(`渠道「${result.channelName}」已添加`);
      setAddModalOpen(false);
      await channelList.reload();
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    } finally {
      setAddingChannel(false);
    }
  }

  function handleRemoveChannel(channel: ChannelSummary): void {
    Modal.confirm({
      title: `删除渠道「${channel.channelName}」？`,
      content: '删除后，引用此渠道的 API Key 将失效。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await groupApi.removeChannel(channel.accessId);
          message.success('渠道已删除');
          await channelList.reload();
        } catch {
          message.error(REQUEST_ERROR_MESSAGE);
        }
      },
    });
  }

  async function handleCreateKey(values: {
    channelId: string;
    expiresAt?: string;
  }): Promise<void> {
    setCreatingKey(true);
    try {
      const expiresAt = values.expiresAt
        ? new Date(`${values.expiresAt}T23:59:59.000Z`).toISOString()
        : null;
      const result = await keyApi.create({
        channelId: values.channelId,
        expiresAt,
      });
      setCreatedKey(result);
      setKeyModalChannel(null);
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleCopy(value: string): Promise<void> {
    try {
      await copyText(value);
      message.success('curl 示例已复制');
    } catch {
      message.error(REQUEST_ERROR_MESSAGE);
    }
  }

  const columns: ColumnsType<ChannelRow> = [
    {
      title: '渠道名称',
      dataIndex: 'channelName',
      width: 220,
      fixed: 'start',
      render: (name: string) => (
        <Typography.Text strong>{name}</Typography.Text>
      ),
    },
    {
      title: '描述',
      dataIndex: 'channelDescription',
      width: 320,
      render: (description: string | null) => (
        <Typography.Text type={description ? undefined : 'secondary'}>
          {description || '暂无描述'}
        </Typography.Text>
      ),
    },
    {
      title: '可用模型',
      dataIndex: 'models',
      width: 360,
      render: (models: ChannelModels['models']) =>
        models.length ? (
          <Space wrap size={[6, 6]}>
            {models.map((model) => (
              // <Tag key={model.name}>{model.name}</Tag>
              <BrandTag key={model.name} brand='deepseek'>
                {model.name}
              </BrandTag>
            ))}
          </Space>
        ) : (
          <Typography.Text type='secondary'>暂无模型</Typography.Text>
        ),
    },
    {
      title: '渠道状态',
      dataIndex: 'status',
      width: 80,
      render: (status: ChannelSummary['status']) => {
        const statusMap = {
          available: { color: 'success', label: '可用' },
          partial: { color: 'warning', label: '部分可用' },
          offline: { color: 'default', label: '离线' },
        } as const;
        const current = statusMap[status] ?? statusMap.offline;
        return <Tag color={current.color}>{current.label}</Tag>;
      },
    },
    {
      title: '模型数量',
      dataIndex: 'modelCount',
      width: 80,
      render: (count: number) => count.toLocaleString(),
    },

    {
      title: 'Token 消耗',
      key: 'tokens',
      width: 170,
      render: (_value, channel) => (
        <div className='channel-token-usage'>
          <Typography.Text>
            今日 {formatTokens(channel.todayTokens)}
          </Typography.Text>
          <Typography.Text type='secondary'>
            近 30 天 {formatTokens(channel.last30dTokens)}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '最近活跃',
      dataIndex: 'lastActiveAt',
      width: 120,
      render: (value: string | null) => (
        <Typography.Text type={value ? undefined : 'secondary'}>
          {formatRelativeTime(value, now)}
        </Typography.Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'end',
      width: 240,
      render: (_value, channel) => (
        <div className='channel-actions'>
          <Tooltip title='删除渠道'>
            <Button
              className='channel-action'
              type='text'
              danger
              aria-label='删除渠道'
              onClick={() => handleRemoveChannel(channel)}
            >
              <DeleteOutlined />
              <span>删除</span>
            </Button>
          </Tooltip>
          <Tooltip title='禁止使用'>
            <Button
              className='channel-action'
              type='text'
              aria-label='禁止使用'
              onClick={() => message.info('功能暂未开放')}
            >
              <DisconnectOutlined />
              <span>禁止使用</span>
            </Button>
          </Tooltip>
          <Tooltip title='创建密钥'>
            <Button
              className='channel-action'
              type='text'
              aria-label='创建密钥'
              onClick={() => setKeyModalChannel(channel)}
            >
              <KeyOutlined />
              <span>创建密钥</span>
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  const selectedChannelModels =
    rows.find((channel) => channel.accessId === keyModalChannel?.accessId)
      ?.models ?? [];
  const firstModel = selectedChannelModels[0]?.name ?? 'my-model';
  const curl = createdKey
    ? [
        `curl ${config.apiBaseUrl}/api/v1/chat/completions`,
        `  -H "Authorization: Bearer ${createdKey.plaintext}"`,
        '  -H "Content-Type: application/json"',
        `  -d '{"model":"${firstModel}","messages":[{"role":"user","content":"你好"}]}'`,
      ].join(' \\\n')
    : '';
  const sdk = createdKey
    ? `from openai import OpenAI\nclient = OpenAI(api_key="${createdKey.plaintext}", base_url="${config.apiBaseUrl}/api/v1")\nresponse = client.chat.completions.create(model="${firstModel}", messages=[{"role": "user", "content": "你好"}])`
    : '';

  if (channelList.loading && !channelList.data) return <ContentLoadingState />;
  return (
    <section className='available-channels-page'>
      <PageHeader
        title='可用渠道'
        meta="通过邀请码可添加渠道调用模型"
      />
      {channelList.error && (
        <ErrorState onRetry={() => void channelList.reload()} />
      )}
      <div className='available-channels-toolbar'>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder='搜索渠道名称、描述或模型'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={channelList.loading}
            onClick={() => void channelList.reload()}
          >
            刷新
          </Button>
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => setAddModalOpen(true)}
          >
            添加渠道
          </Button>
        </Space>
      </div>
      <div className='available-channels-table-shell'>
        {!rows.length && !channelList.loading && !channelList.error ? (
          <EmptyState
            description={
              search ? '没有匹配的渠道' : '暂无渠道。请通过邀请码添加渠道。'
            }
          />
        ) : (
          <Table<ChannelRow>
            rowKey='key'
            size='middle'
            dataSource={rows}
            columns={columns}
            loading={channelList.loading && !channelList.data}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 1600 }}
          />
        )}
      </div>
      <AddChannelModal
        open={addModalOpen}
        loading={addingChannel}
        onClose={() => setAddModalOpen(false)}
        onSubmit={(token) => void handleAddChannel(token)}
      />
      <CreateKeyModal
        open={Boolean(keyModalChannel)}
        channels={keyModalChannel ? [keyModalChannel] : []}
        creating={creatingKey}
        onClose={() => setKeyModalChannel(null)}
        onSubmit={(values) => void handleCreateKey(values)}
      />
      <CreatedKeyModal
        createdKey={createdKey}
        curl={curl}
        sdk={sdk}
        onClose={() => setCreatedKey(null)}
        onCopy={() => void handleCopy(curl)}
      />
    </section>
  );
}
