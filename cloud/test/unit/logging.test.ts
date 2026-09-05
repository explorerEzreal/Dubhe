import { describe, expect, it } from 'vitest';
import {
  createLoggerOptions,
  SENSITIVE_LOG_PATHS,
} from '../../src/infrastructure/logging/index.js';

describe('logging security', () => {
  it('redacts authorization and credential fields', () => {
    const options = createLoggerOptions('info');
    expect(options.redact.censor).toBe('[REDACTED]');
    expect(SENSITIVE_LOG_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'body.password',
        'payload.token',
        'payload.credential',
        'payload.plaintext',
      ]),
    );
  });
});
