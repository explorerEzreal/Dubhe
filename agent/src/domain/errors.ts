// 稳定错误码，供 WSS 协议和本地日志共同使用。错误信息不得包含凭证或请求正文。
export const ERROR_CODES = {
  AUTH_FAILED: 'AUTH_FAILED',
  PROTOCOL_MISMATCH: 'PROTOCOL_MISMATCH',
  OLLAMA_UNAVAILABLE: 'OLLAMA_UNAVAILABLE',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  MODEL_NOT_READY: 'MODEL_NOT_READY',
  INFERENCE_TIMEOUT: 'INFERENCE_TIMEOUT',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  CONCURRENCY_LIMIT: 'CONCURRENCY_LIMIT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AgentError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}
