// 模型实例状态机。模型定义与具体 Agent 上的实例分离。
export type ModelInstanceState =
  | 'unknown'
  | 'checking'
  | 'pulling'
  | 'ready'
  | 'busy'
  | 'error'
  | 'stopped'
  | 'offline';

export const MODEL_INSTANCE_STATES: readonly ModelInstanceState[] = [
  'unknown',
  'checking',
  'pulling',
  'ready',
  'busy',
  'error',
  'stopped',
  'offline',
];

export interface ModelInstance {
  model: string;
  state: ModelInstanceState;
  lastError?: string;
}

export function isRoutable(state: ModelInstanceState): boolean {
  return state === 'ready';
}
