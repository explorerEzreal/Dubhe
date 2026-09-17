import { useCallback, useState } from 'react';
import { App, Button, Space, Typography } from 'antd';
import { keyApi, type ApiKeyCreateResult } from '../../api/key-api';
import { modelApi } from '../../api/model-api';
import { usageApi } from '../../api/usage-api';
import { config } from '../../config/config';
import { REQUEST_ERROR_MESSAGE } from '../../constants';
import { useAsyncList } from '../../hooks';
import { copyText } from '../../utils/clipboard';
import { ContentLoadingState, ErrorState } from '../../components';
import { ApiKeyTable, CreatedKeyModal, CreateKeyModal, ModelCatalog, UsageMetrics } from './components';

export function CallerDashboardPage() {
  const { message } = App.useApp();
  const loadData = useCallback(async () => {
    const [models, keys, usage] = await Promise.all([modelApi.list(), keyApi.list(), usageApi.summary()]);
    return { models, keys, usage };
  }, []);
  const dashboard = useAsyncList(loadData, { poll: true });
  const models = dashboard.data?.models ?? [];
  const keys = dashboard.data?.keys ?? [];
  const usage = dashboard.data?.usage;
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreateResult | null>(null);
  const [creating, setCreating] = useState(false);

  async function createKey(values: { models?: string[]; expiresAt?: string }): Promise<void> {
    setCreating(true);
    try {
      const expiresAt = values.expiresAt ? new Date(`${values.expiresAt}T23:59:59.000Z`).toISOString() : null;
      const result = await keyApi.create({ models: values.models ?? [], expiresAt });
      setCreatedKey(result); setKeyModalOpen(false); await dashboard.reload();
    } catch { message.error(REQUEST_ERROR_MESSAGE); } finally { setCreating(false); }
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

  const curl = createdKey ? [
    `curl ${config.apiBaseUrl}/api/v1/chat/completions ${'\\'}`,
    `  -H "Authorization: Bearer ${createdKey.plaintext}" ${'\\'}`,
    `  -H "Content-Type: application/json" ${'\\'}`,
    `  -d '{"model":"${models[0]?.name ?? 'my-model'}","messages":[{"role":"user","content":"你好"}]}'`,
  ].join('\n') : '';
  const sdk = createdKey ? `from openai import OpenAI\nclient = OpenAI(api_key="${createdKey.plaintext}", base_url="${config.apiBaseUrl}/api/v1")\nresponse = client.chat.completions.create(model="${models[0]?.name ?? 'my-model'}", messages=[{"role": "user", "content": "你好"}])` : '';

  if (dashboard.loading && !dashboard.data) return <ContentLoadingState />;
  return <section>
    <div className='dashboard-header'><div><Typography.Title level={1}>调用者控制台</Typography.Title><Typography.Paragraph type='secondary'>查看可用模型，管理 API Key 并复制调用示例。</Typography.Paragraph></div><Space><Button loading={dashboard.loading} onClick={() => void dashboard.reload()}>刷新</Button><Button type='primary' onClick={() => setKeyModalOpen(true)}>创建 API Key</Button></Space></div>
    {dashboard.error && <ErrorState onRetry={() => void dashboard.reload()} />}
    <UsageMetrics totalCalls={usage?.totalCalls ?? 0} errorRate={usage?.errorRate ?? 0} avgLatencyMs={usage?.avgLatencyMs ?? 0} />
    <ModelCatalog models={models} hasError={dashboard.error} />
    <ApiKeyTable keys={keys} hasError={dashboard.error} onDisable={(id) => void disableKey(id)} onRemove={(id) => void removeKey(id)} />
    <CreateKeyModal open={keyModalOpen} models={models} creating={creating} onClose={() => setKeyModalOpen(false)} onSubmit={(values) => void createKey(values)} />
    <CreatedKeyModal createdKey={createdKey} curl={curl} sdk={sdk} onClose={() => setCreatedKey(null)} onCopy={() => void copy(curl, 'curl 示例已复制')} />
  </section>;
}

