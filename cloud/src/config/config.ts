import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  API_KEY_PEPPER: z.string().min(32),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),
  AGENT_DOWNLOAD_URL: z.string().url().default('http://localhost:3000/downloads/agent'),
  AGENT_RELEASE_DIR: z.string().default('./releases'),
  AGENT_RELEASE_VERSION: z.string().trim().min(1).default('0.1.0'),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),
  AGENT_WS_PATH: z.string().regex(/^\/[A-Za-z0-9/_-]*$/).default('/agent'),
  AGENT_REQUIRE_TLS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  AGENT_MAX_MESSAGE_BYTES: z.coerce.number().int().positive().max(10_485_760).default(1_048_576),
  AGENT_HEARTBEAT_TIMEOUT_MS: z.coerce.number().int().positive().max(86_400_000).default(30_000),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(3600),
  ENROLLMENT_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(900),
  MAX_REQUEST_BODY_BYTES: z.coerce.number().int().positive().max(10_485_760).default(1_048_576),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(10),
  INFERENCE_TIMEOUT_MS: z.coerce.number().int().positive().max(600_000).default(120_000),
});

export type CloudConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CloudConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid cloud config: ${parsed.error.message}`);
  }
  return parsed.data;
}
