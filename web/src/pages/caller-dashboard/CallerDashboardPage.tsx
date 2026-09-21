import { useCallback, useState } from 'react';
import { App, Button, Modal, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { keyApi, type ApiKeyCreateResult } from '../../api/key-api';
import { groupApi } from '../../api/group-api';
import { usageApi } from '../../api/usage-api';
import { config } from '../../config/config';
import { REQUEST_ERROR_MESSAGE } from '../../constants';
import { useAsyncList } from '../../hooks';
import { copyText } from '../../utils/clipboard';
import { ContentLoadingState, ErrorState } from '../../components';
import { AddChannelModal, ApiKeyTable, ChannelList, CreatedKeyModal, CreateKeyModal, ModelCatalog, UsageMetrics } from './components';
import { UsageMonitoring } from '../usage-monitoring';

export function CallerDashboardPage() {
  const { message } = App.useApp();
  const loadData = useCallback(async () => {
    const [channels, channelModels, keys, usage, monitoring] = await Promise.all([
      groupApi.listChannels(),
      groupApi.listChannelModels(),
      keyApi.list(),
      usageApi.analytics(),
      usageApi.analytics('caller', dayjs().subtract(30, 'day').startOf('day').toISOString(), dayjs().endOf('day').toISOString()),
    ]);
    return { channels, channelModels, keys, usage, monitoring };
  }, []);
  const dashboard = useAsyncList(loadData, { poll: true });
  const channels = dashboard.data?.channels ?? [];
  const channelModels = dashboard.data?.channelModels ?? [];
  const keys = dashboard.data?.keys ?? [];
  const usage = dashboard.data?.usage;
  const apiKeyUsage = new Map((dashboard.data?.monitoring.apiKeys ?? []).map((item) => [item.id, item]));
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreateResult | null>(null);
  const [creating, setCreating] = useState(false);

  // 渠道添加
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [addingChannel, setAddingChannel] = useState(false);

  async function createKey(values: { channelId: string; expiresAt?: string }): Promise<void> {
    setCreating(true);
    try {
      const expiresAt = values.expiresAt ? new Date(`${values.expiresAt}T23:59:59.000Z`).toISOString() : null;
      const result = await keyApi.create({ channelId: values.channelId, expiresAt });
      setCreatedKey(result); setKeyModalOpen(false); await dashboard.reload();
    } catch { message.error(REQUEST_ERROR_MESSAGE); } finally { setCreating(false); }
  }

  async function handleAddChannel(token: string): Promise<void> {
    setAddingChannel(true);
    try {
      const result = await groupApi.addChannel(token);
      message.success(`渠道「${result.channelName}」已添加`);
      setChannelModalOpen(false);
      await dashboard.reload();
    } catch { message.error(REQUEST_ERROR_MESSAGE); } finally { setAddingChannel(false); }
  }

  async function handleRemoveChannel(accessId: string): Promise<void> {
    Modal.confirm({
      title: '移除渠道？',
      content: '移除后，引用此渠道的 API Key 将失效。',
      okText: '移除',
      cancelText: '取消',
      onOk: async () => {
        try {
          await groupApi.removeChannel(accessId);
          message.success('渠道已移除');
          await dashboard.reload();
        } catch { message.error(REQUEST_ERROR_MESSAGE); }
      },
    });
  }

  async function copy(value: string, success: string): Promise<void> {
    try { await copyText(value); message.success(success); } catch { message.error(REQUEST_ERROR_MESSAGE); }
  }

  async function disableKey(id: string): Promise<void> {
    try { await keyApi.disable(id); message.success('API Key 已禁用'); await dashboard.reload(); } catch { message.error(REQUEST_ERROR_MESSAGE); }
  }

  async function removeKey(id: string): Promise<void> {
    try { await keyApi.remove(id); message.success('API Key 已删除'); await dashboard.reload(); } catch { message.error(REQUEST_ERROR_MESSAGE); }
  }

  const firstModel = channelModels[0]?.models[0]?.name ?? 'my-model';
  const curl = createdKey ? [
    `curl ${config.apiBaseUrl}/api/v1/chat/completions ${'\\'}`,
    `  -H "Authorization: Bearer ${createdKey.plaintext}" ${'\\'}`,
    `  -H "Content-Type: application/json" ${'\\'}`,
    `  -d '{"model":"${firstModel}","messages":[{"role":"user","content":"你好"}]}'`,
  ].join('\n') : '';
  const sdk = createdKey ? `from openai import OpenAI\nclient = OpenAI(api_key="${createdKey.plaintext}", base_url="${config.apiBaseUrl}/api/v1")\nresponse = client.chat.completions.create(model="${firstModel}", messages=[{"role": "user", "content": "你好"}])` : '';

  if (dashboard.loading && !dashboard.data) return <ContentLoadingState />;
  return <section>
    <div className='dashboard-header'><div><Typography.Title level={1}>调用者控制台</Typography.Title><Typography.Paragraph type='secondary'>管理渠道、查看模型、创建 API Key 并调用推理。</Typography.Paragraph></div><Space><Button loading={dashboard.loading} onClick={() => void dashboard.reload()}>刷新</Button><Button onClick={() => setChannelModalOpen(true)}>添加渠道</Button><Button type='primary' onClick={() => setKeyModalOpen(true)} disabled={!channels.length}>创建 API Key</Button></Space></div>
    {dashboard.error && <ErrorState onRetry={() => void dashboard.reload()} />}
    <UsageMetrics totalCalls={usage?.totalCalls ?? 0} totalTokens={usage?.totalTokens ?? 0} inputTokens={usage?.inputTokens ?? 0} outputTokens={usage?.outputTokens ?? 0} errorRate={usage?.errorRate ?? 0} avgLatencyMs={usage?.avgLatencyMs ?? 0} />
    {dashboard.data?.monitoring && <UsageMonitoring data={dashboard.data.monitoring} showUser={false} />}
    <ChannelList channels={channels} hasError={dashboard.error} onRemove={(id) => void handleRemoveChannel(id)} />
    <ModelCatalog channelModels={channelModels} hasError={dashboard.error} />
    <ApiKeyTable keys={keys} usage={apiKeyUsage} hasError={dashboard.error} onDisable={(id) => void disableKey(id)} onRemove={(id) => void removeKey(id)} />
    <CreateKeyModal open={keyModalOpen} channels={channels} creating={creating} onClose={() => setKeyModalOpen(false)} onSubmit={(values) => void createKey(values)} />
    <CreatedKeyModal createdKey={createdKey} curl={curl} sdk={sdk} onClose={() => setCreatedKey(null)} onCopy={() => void copy(curl, 'curl 示例已复制')} />
    <AddChannelModal open={channelModalOpen} loading={addingChannel} onClose={() => setChannelModalOpen(false)} onSubmit={(token) => void handleAddChannel(token)} />
  </section>;
}
