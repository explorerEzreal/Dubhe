import type {
  InferenceBackend,
  InferenceChatChunk,
  InferenceUsage,
} from '../../interfaces/inference/index.js';

interface OpenAiModelList { data?: Array<{ id?: string }>; }

function apiRoot(baseUrl: string): string {
  const url = new URL(baseUrl);
  const pathname = url.pathname.replace(/\/$/, '').replace(/\/v1$/, '');
  url.pathname = `${pathname}/v1`;
  return url.toString().replace(/\/$/, '');
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
}

function headers(apiKey?: string): HeadersInit {
  return apiKey
    ? { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
    : { 'content-type': 'application/json' };
}

function responseHeaders(response: Response): Record<string, string> {
  const result: Record<string, string> = {};
  response.headers.forEach((value, key) => { result[key] = value; });
  return result;
}

function extractUsage(text: string): InferenceUsage | undefined {
  const candidates = text.split(/\n\n+/).map((item) => item.replace(/^data:\s*/, '').trim()).filter((item) => item && item !== '[DONE]');
  for (const candidate of [...candidates.reverse(), text]) {
    try {
      const parsed = JSON.parse(candidate) as { usage?: InferenceUsage };
      if (parsed.usage && Number.isFinite(parsed.usage.total_tokens)) return parsed.usage;
    } catch { /* 原始响应可能是非 JSON，保持透传 */ }
  }
  return undefined;
}

function encode(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

export function createOpenAiClient(baseUrl: string, configuredModel: string, apiKey?: string): InferenceBackend {
  const root = apiRoot(baseUrl);
  const model = configuredModel.trim();
  const listModels = async (): Promise<string[]> => {
    const response = await fetch(`${root}/models`, { headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined });
    if (!response.ok) throw new Error('local model service unavailable');
    const body = await response.json() as OpenAiModelList;
    const discovered = (body.data ?? []).map((item) => item.id?.trim()).filter((item): item is string => Boolean(item));
    return discovered.length > 0 ? discovered : model ? [model] : [];
  };

  return {
    async health(): Promise<boolean> { try { await listModels(); return true; } catch { return false; } },
    listModels,
    async *request(endpoint, requestModel, payload, signal): AsyncIterable<string | InferenceChatChunk> {
      const body = JSON.stringify({ ...payloadRecord(payload), model: requestModel });
      const response = await fetch(`${root}/${endpoint}`, { method: 'POST', headers: headers(apiKey), body, signal });
      const meta = { statusCode: response.status, headers: responseHeaders(response) };
      if (!response.body) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        yield { ...meta, data: encode(bytes), encoding: 'base64', responseBytes: bytes.byteLength, usage: extractUsage(new TextDecoder().decode(bytes)) };
        return;
      }
      const reader = response.body.getReader();
      let total = 0;
      let text = '';
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        const bytes = next.value;
        total += bytes.byteLength;
        text += new TextDecoder().decode(bytes, { stream: true });
        yield { ...(total === bytes.byteLength ? meta : {}), data: encode(bytes), encoding: 'base64', responseBytes: total, usage: extractUsage(text) };
      }
      const usage = extractUsage(text);
      if (usage) yield { data: '', encoding: 'base64', responseBytes: total, usage };
    },
  };
}
