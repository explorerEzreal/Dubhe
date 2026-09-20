// 推理后端端口：不同工具通过同一组能力接入 Agent。
export interface InferenceUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface InferenceChatChunk {
  data: string;
  encoding: 'base64';
  responseBytes: number;
  statusCode?: number;
  headers?: Record<string, string>;
  usage?: InferenceUsage;
}

export interface InferenceBackend {
  health(): Promise<boolean>;
  listModels(): Promise<string[]>;
  request?: (
    endpoint: 'chat/completions' | 'responses',
    model: string,
    payload: unknown,
    signal: AbortSignal,
  ) => AsyncIterable<string | InferenceChatChunk>;
  chat?: (model: string, payload: unknown, signal: AbortSignal) => AsyncIterable<string | InferenceChatChunk>;
}
