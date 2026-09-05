import type { ModelInstance, ModelInstanceState } from '../domain/model-state.js';

// 用例：Ollama 模型检查、拉取和状态同步。
export interface ModelService {
  list(): Promise<ModelInstance[]>;
  pull(model: string): Promise<void>;
  stateOf(model: string): Promise<ModelInstanceState>;
}
