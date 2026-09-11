import type {
  InferenceBackend,
  InferenceChatChunk,
  InferenceUsage,
} from '../../interfaces/inference/index.js';

interface OpenAiModelList {
  data?: Array<{ id?: string }>;
}

interface OpenAiStreamChunk {
  choices?: Array<{
    delta?: { content?: string };
    message?: { content?: string };
  }>;
  usage?: InferenceUsage;
}

function apiRoot(baseUrl: string): string {
  const url = new URL(baseUrl);
  const pathname = url.pathname.replace(/\/$/, '').replace(/\/v1$/, '');
  url.pathname = `${pathname}/v1`;
  return url.toString().replace(/\/$/, '');
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null
    ? payload as Record<string, unknown>
    : {};
}

function headers(apiKey?: string): HeadersInit {
  return apiKey
    ? { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
    : { 'content-type': 'application/json' };
}

function parseChunk(data: string): InferenceChatChunk | undefined {
  const parsed = JSON.parse(data) as OpenAiStreamChunk;
  const choice = parsed.choices?.[0];
  const content = choice?.delta?.content ?? choice?.message?.content;
  if (!content && !parsed.usage) return undefined;
  return { content, usage: parsed.usage };
}

const STREAM_DONE = Symbol('stream-done');

export function createOpenAiClient(
  baseUrl: string,
  configuredModel: string,
  apiKey?: string,
): InferenceBackend {
  const root = apiRoot(baseUrl);
  const model = configuredModel.trim();

  const listModels = async (): Promise<string[]> => {
    const response = await fetch(`${root}/models`, { headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined });
    if (!response.ok) throw new Error('local model service unavailable');
    const body = await response.json() as OpenAiModelList;
    const discovered = (body.data ?? [])
      .map((item) => item.id?.trim())
      .filter((item): item is string => Boolean(item));
    return discovered.length > 0 ? discovered : model ? [model] : [];
  };

  return {
    async health(): Promise<boolean> {
      try {
        await listModels();
        return true;
      } catch {
        return false;
      }
    },

    listModels,

    async *chat(requestModel: string, payload: unknown, signal: AbortSignal): AsyncIterable<string | InferenceChatChunk> {
      const response = await fetch(`${root}/chat/completions`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ ...payloadRecord(payload), model: requestModel, stream: true }),
        signal,
      });
      if (!response.ok || !response.body) throw new Error('local model service request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventData = '';
      const consumeLine = (line: string): InferenceChatChunk | typeof STREAM_DONE | undefined => {
        const normalized = line.endsWith('\r') ? line.slice(0, -1) : line;
        if (normalized.startsWith('data:')) {
          eventData += normalized.slice(5).trimStart();
          return undefined;
        }
        if (normalized !== '' || eventData === '') return undefined;
        const data = eventData;
        eventData = '';
        if (data === '[DONE]') return STREAM_DONE;
        return parseChunk(data);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const chunk = consumeLine(line);
          if (chunk === STREAM_DONE) return;
          if (chunk) yield chunk;
        }
      }
      buffer += decoder.decode();
      if (buffer) {
        const chunk = consumeLine(buffer);
        if (chunk === STREAM_DONE) return;
        if (chunk) yield chunk;
      }
      if (eventData && eventData !== '[DONE]') {
        const chunk = parseChunk(eventData);
        if (chunk) yield chunk;
      }
    },
  };
}
