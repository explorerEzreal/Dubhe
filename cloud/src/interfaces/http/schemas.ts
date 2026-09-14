import { z } from 'zod';

const modelNameSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);

export const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(256),
}).strict();

export const apiKeySchema = z.object({
  models: z.array(modelNameSchema).max(100).optional().default([]),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

export const agentParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const completionSchema = z.object({
  model: modelNameSchema,
  messages: z
    .array(
      z
        .object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string().min(1).max(1_000_000),
        })
        .strict(),
    )
    .min(1)
    .max(100),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().max(100_000).optional(),
  stop: z.union([z.string(), z.array(z.string().min(1)).max(20)]).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
}).strict();

const responsesContentSchema = z.union([
  z.string().min(1).max(1_000_000),
  z.array(z.record(z.unknown())).min(1).max(100),
]);

export const responsesSchema = z.object({
  model: modelNameSchema,
  input: z.union([
    z.string().min(1).max(1_000_000),
    z.array(z.object({
      role: z.enum(['system', 'developer', 'user', 'assistant']),
      content: responsesContentSchema,
    }).passthrough()).min(1).max(100),
  ]),
  instructions: z.string().max(1_000_000).optional(),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_output_tokens: z.number().int().positive().max(100_000).optional(),
  tools: z.array(z.record(z.unknown())).max(128).optional(),
  tool_choice: z.unknown().optional(),
  response_format: z.record(z.unknown()).optional(),
  parallel_tool_calls: z.boolean().optional(),
  previous_response_id: z.string().max(200).optional(),
  metadata: z.record(z.string()).optional(),
  n: z.number().int().positive().max(16).optional(),
  stream_options: z.record(z.unknown()).optional(),
}).strict();
