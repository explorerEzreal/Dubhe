import type { AgentConfig } from '../../config/config.js';
import type { InferenceBackend } from '../../interfaces/inference/index.js';
import { createOpenAiClient } from '../openai/index.js';

// Agent 只实现通用 OpenAI 兼容本地 HTTP 协议，不绑定具体推理引擎。
export function createInferenceBackend(config: AgentConfig): InferenceBackend {
  return createOpenAiClient(config.LOCAL_MODEL_URL, config.MODELS, config.LOCAL_API_KEY);
}
