import pino, { type Logger } from 'pino';

// 统一脱敏敏感字段，运行时日志不输出凭证或请求正文。
export function createLogger(level: Logger['level']): Logger {
  return pino({
    level,
    redact: {
      paths: [
        'credential',
        'token',
        'authorization',
        'payload.credential',
        'payload.token',
        'payload.messages',
      ],
      censor: '[REDACTED]',
    },
  });
}
