// 端口：Ollama HTTP 适配。实现位于 infrastructure/ollama。
export interface OllamaUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OllamaChatChunk {
  content?: string;
  usage?: OllamaUsage;
}

export interface OllamaClient {
  health(): Promise<boolean>;
  listModels(): Promise<string[]>;
  pullModel(model: string): Promise<void>;
  chat(model: string, payload: unknown, signal: AbortSignal): AsyncIterable<string | OllamaChatChunk>;
}
