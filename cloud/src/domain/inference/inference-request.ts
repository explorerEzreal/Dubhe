export type InferenceStatus =
  | 'accepted'
  | 'routed'
  | 'running'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'agent_disconnected';

export interface InferenceRequest {
  requestId: string;
  modelId: string;
  agentId: string;
  status: InferenceStatus;
  stream: boolean;
  startedAt: Date;
  finishedAt?: Date;
}

export function isTerminal(status: InferenceStatus): boolean {
  return ['completed', 'failed', 'cancelled', 'timeout', 'agent_disconnected'].includes(status);
}
