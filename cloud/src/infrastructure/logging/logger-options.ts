export const SENSITIVE_LOG_PATHS = [
  'req.headers.authorization',
  'request.headers.authorization',
  'headers.authorization',
  'body.password',
  'body.token',
  'body.credential',
  'body.plaintext',
  'payload.password',
  'payload.token',
  'payload.credential',
  'payload.plaintext',
];

export function createLoggerOptions(level: string) {
  return {
    level,
    redact: {
      paths: SENSITIVE_LOG_PATHS,
      censor: '[REDACTED]',
    },
  };
}
