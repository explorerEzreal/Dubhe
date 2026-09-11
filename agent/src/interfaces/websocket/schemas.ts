import { z } from 'zod';

export const inferRequestSchema = z.object({
  protocol_version: z.literal(1),
  type: z.literal('infer_request'),
  timestamp: z.string().datetime({ offset: true }),
  request_id: z.string().min(1).max(200),
  payload: z.object({
    model: z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/),
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1).max(1_000_000),
    }).strict()).min(1).max(100),
    stream: z.boolean(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    max_tokens: z.number().int().positive().max(100_000).optional(),
    stop: z.union([z.string(), z.array(z.string().min(1)).max(20)]).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
  }).strict(),
}).strict();

export const inferChunkSchema = z.object({
  protocol_version: z.literal(1),
  type: z.literal('infer_chunk'),
  timestamp: z.string().datetime({ offset: true }),
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
}).strict();

export const inferCancelSchema = z.object({
  protocol_version: z.literal(1),
  type: z.literal('infer_cancel'),
  timestamp: z.string().datetime({ offset: true }),
  request_id: z.string().min(1).max(200),
  payload: z.object({}).strict(),
}).strict();

export const registeredMessageSchema = z.object({
  protocol_version: z.literal(1),
  type: z.literal('registered'),
  timestamp: z.string().datetime({ offset: true }),
  payload: z.object({
    agentId: z.string().min(1).max(200),
    credential: z.string().min(1).max(512),
  }).strict(),
}).strict();
