// Agent 状态机。业务规则不依赖任何基础设施实现。
export type AgentState = 'created' | 'connecting' | 'online' | 'degraded' | 'offline' | 'revoked';

export const AGENT_STATES: readonly AgentState[] = [
  'created',
  'connecting',
  'online',
  'degraded',
  'offline',
  'revoked',
];

export function canAcceptRequests(state: AgentState): boolean {
  return state === 'online';
}
