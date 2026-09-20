import { z } from 'zod';
import { MODEL_INSTANCE_STATES } from '../../domain/models/model-instance-state.js';
import type { ModelInstanceState } from '../../domain/models/model-instance-state.js';

const modelNameSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);

const hardwareInfoSchema = z.object({
  cpu: z.object({
    cores: z.number().int().positive().optional(),
    loadAverage: z.array(z.number().nonnegative()).optional(),
    usagePercent: z.number().min(0).max(100).nullable().optional(),
  }).passthrough().optional(),
  memory: z.object({
    totalBytes: z.number().nonnegative().optional(),
    freeBytes: z.number().nonnegative().optional(),
    usedBytes: z.number().nonnegative().optional(),
    usagePercent: z.number().min(0).max(100).nullable().optional(),
  }).passthrough().optional(),
  gpu: z.object({ usagePercent: z.number().min(0).max(100).nullable().optional() }).passthrough().nullable().optional(),
  disk: z.object({ usagePercent: z.number().min(0).max(100).nullable().optional() }).passthrough().nullable().optional(),
  network: z.object({
    rxBytes: z.number().nonnegative().optional(),
    txBytes: z.number().nonnegative().optional(),
    rxBytesPerSecond: z.number().nonnegative().nullable().optional(),
    txBytesPerSecond: z.number().nonnegative().nullable().optional(),
  }).passthrough().nullable().optional(),
}).passthrough();

const envelopeSchema = z.object({
  protocol_version: z.literal(1),
  type: z.enum([
    'register',
    'registered',
    'heartbeat',
    'heartbeat_ack',
    'infer_request',
    'infer_chunk',
    'infer_done',
    'infer_error',
    'infer_cancel',
  ]),
  timestamp: z.string().datetime({ offset: true }),
  request_id: z.string().min(1).max(200).optional(),
  payload: z.record(z.unknown()),
}).strict();

export const registerMessageSchema = envelopeSchema.extend({
  type: z.literal('register'),
  payload: z.object({
    token: z.string().min(1).max(512),
    deviceId: z.string().min(1).max(256),
    name: z.string().min(1).max(200).optional().default('Bubhe 天枢 Agent'),
    hardwareInfo: hardwareInfoSchema.nullable().optional().default(null),
  }).strict(),
});

export const heartbeatMessageSchema = envelopeSchema.extend({
  type: z.literal('heartbeat'),
  payload: z.object({
    status: z.enum(['online', 'degraded']),
    hardwareInfo: hardwareInfoSchema.nullable().optional(),
    models: z
      .array(
        z.object({
          name: modelNameSchema,
          state: z.enum(MODEL_INSTANCE_STATES as [ModelInstanceState, ...ModelInstanceState[]]),
        }),
      )
      .max(200)
      .max(200),
  }).strict(),
});

export const agentMessageSchema = envelopeSchema;

export const inferRequestMessageSchema = envelopeSchema.extend({
  type: z.literal('infer_request'),
  request_id: z.string().min(1).max(200),
  payload: z.object({
    endpoint: z.enum(['chat/completions', 'responses']),
    model: modelNameSchema,
    body: z.record(z.unknown()),
    stream: z.boolean(),
    request_bytes: z.number().int().nonnegative(),
  }).passthrough(),
});

export const inferChunkMessageSchema = envelopeSchema.extend({
  type: z.literal('infer_chunk'),
  request_id: z.string().min(1).max(200),
  payload: z.object({
    seq: z.number().int().nonnegative(),
    data: z.string().optional(),
    encoding: z.literal('base64').optional(),
    content: z.string().optional(),
    response_bytes: z.number().int().nonnegative().optional(),
    status_code: z.number().int().min(100).max(599).optional(),
    headers: z.record(z.string()).optional(),
    usage: z.object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    }).strict().optional(),
  }).strict(),
});

export const inferDoneMessageSchema = envelopeSchema.extend({
  type: z.literal('infer_done'),
  request_id: z.string().min(1).max(200),
  payload: z.object({
    status_code: z.number().int().min(100).max(599).optional(),
    headers: z.record(z.string()).optional(),
    content: z.string().optional(),
    body: z.string().optional(),
    encoding: z.literal('base64').optional(),
    response_bytes: z.number().int().nonnegative().optional(),
    finish_reason: z.string().optional(),
    usage: z.object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    }).strict().optional(),
  }).strict(),
});

export const inferErrorMessageSchema = envelopeSchema.extend({
  type: z.literal('infer_error'),
  request_id: z.string().min(1).max(200),
  payload: z.object({
    code: z.enum([
      'MODEL_NOT_READY',
      'MODEL_NOT_FOUND',
      'LOCAL_SERVICE_UNAVAILABLE',
      'INFERENCE_TIMEOUT',
      'UPSTREAM_ERROR',
      'CONCURRENCY_LIMIT',
    ]),
    message: z.string().max(500).optional(),
  }).strict(),
});

export const inferCancelMessageSchema = envelopeSchema.extend({
  type: z.literal('infer_cancel'),
  request_id: z.string().min(1).max(200),
  payload: z.object({}).strict(),
});
