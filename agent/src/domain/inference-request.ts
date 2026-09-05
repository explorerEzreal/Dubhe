// 推理请求生命周期。request_id 在 Cloud 与 Agent 之间唯一关联一个任务。
export type InferenceRequestState =
  | 'accepted'
  | 'running'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface InferenceRequest {
  requestId: string;
  model: string;
  state: InferenceRequestState;
  stream: boolean;
  chunkSequence: number;
}
