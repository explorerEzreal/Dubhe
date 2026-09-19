import { z } from 'zod';
import os from 'node:os';
import { join } from 'node:path';

function defaultCredentialsPath(): string {
  if (process.platform === 'darwin') {
    return join(os.homedir(), 'Library', 'Application Support', 'Dubhe Agent', 'credentials.json');
  }
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(os.homedir(), 'AppData', 'Local'), 'Dubhe Agent', 'credentials.json');
  }
  return join(process.env.XDG_STATE_HOME ?? join(os.homedir(), '.local', 'state'), 'dubhe-agent', 'credentials.json');
}

const cloudUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'wss:' || (
      url.protocol === 'ws:' &&
      ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    );
  }, {
    message: 'CLOUD_URL 必须使用 wss，本地环回地址可使用 ws',
  });

const envSchema = z.object({
  CLOUD_URL: cloudUrlSchema,
  LOCAL_MODEL_URL: z.string().url().default('http://127.0.0.1:8000'),
  LOCAL_API_KEY: z.string().optional(),
  AGENT_ID: z.string().optional(),
  AGENT_CREDENTIAL: z.string().optional(),
  CREDENTIALS_PATH: z.string().trim().min(1).default(defaultCredentialsPath()),
  ENROLLMENT_TOKEN: z.string().min(1).optional(),
  AGENT_NAME: z.string().trim().min(1).max(200).default('Bubhe 天枢 Agent'),
  DEVICE_ID: z.string().trim().min(1).max(256).optional(),
  MODELS: z.string().trim().min(1),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  RECONNECT_INITIAL_MS: z.coerce.number().int().positive().default(1000),
  RECONNECT_MAX_MS: z.coerce.number().int().positive().default(300000),
  MAX_CONCURRENCY: z.coerce.number().int().positive().default(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
}).superRefine((value, context) => {
  if (value.RECONNECT_MAX_MS < value.RECONNECT_INITIAL_MS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RECONNECT_MAX_MS'],
      message: 'RECONNECT_MAX_MS must be greater than RECONNECT_INITIAL_MS',
    });
  }
});

export type AgentConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid agent config: ${parsed.error.message}`);
  }
  return parsed.data;
}
