export type AgentStatus = 'created' | 'connecting' | 'online' | 'degraded' | 'offline' | 'revoked';

export const AGENT_STATUSES: readonly AgentStatus[] = [
  'created',
  'connecting',
  'online',
  'degraded',
  'offline',
  'revoked',
];

export function isRoutable(status: AgentStatus): boolean {
  return status === 'online';
}
