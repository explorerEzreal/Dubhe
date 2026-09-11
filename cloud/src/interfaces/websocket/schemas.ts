import { z } from 'zod';
import { MODEL_INSTANCE_STATES } from '../../domain/models/model-instance-state.js';
import type { ModelInstanceState } from '../../domain/models/model-instance-state.js';

const modelNameSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);

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
    name: z.string().min(1).max(200).optional().default('Dubhe Agent'),
    hardwareInfo: z.record(z.unknown()).nullable().optional().default(null),
  }).strict(),
});

export const heartbeatMessageSchema = envelopeSchema.extend({
  type: z.literal('heartbeat'),
  payload: z.object({
    status: z.enum(['online', 'degraded']),
    hardwareInfo: z.record(z.unknown()).nullable().optional(),
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

const completionMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(1_000_000),
}).strict();

export const inferRequestMessageSchema = envelopeSchema.extend({
  type: z.literal('infer_request'),
  request_id: z.string().min(1).max(200),
  payload: z.object({
    model: modelNameSchema,
    messages: z.array(completionMessageSchema).min(1).max(100),
    stream: z.boolean(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    max_tokens: z.number().int().positive().max(100_000).optional(),
    stop: z.union([z.string(), z.array(z.string().min(1)).max(20)]).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
  }).strict(),
});

export const inferChunkMessageSchema = envelopeSchema.extend({
  type: z.literal('infer_chunk'),
  request_id: z.string().min(1).max(200),
  payload: z.object({
    seq: z.number().int().nonnegative(),
    content: z.string(),
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
    content: z.string(),
    finish_reason: z.literal('stop').optional(),
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
