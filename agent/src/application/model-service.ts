import type { ModelInstance, ModelInstanceState } from '../domain/model-state.js';

// 用例：本地模型服务检查和状态同步。
export interface ModelService {
  list(): Promise<ModelInstance[]>;
  stateOf(model: string): Promise<ModelInstanceState>;
}
