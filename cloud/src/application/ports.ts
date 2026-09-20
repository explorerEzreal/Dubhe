import type { AgentStatus } from '../domain/agents/agent-status.js';
import type { ModelInstanceState } from '../domain/models/model-instance-state.js';

export interface UserRecord {
  id: string;
  email: string;
  role: string;
  passwordHash?: string;
  createdAt?: Date;
  nickname?: string | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
}

export interface ApiKeyIdentity {
  id: string;
  userId: string;
  status: string;
  expiresAt: Date | null;
  groupId: string | null;
}

export interface AgentIdentity {
  id: string;
  userId: string;
  status: AgentStatus;
}

export interface AgentRegistrationInput {
  tokenHash: string;
  credentialHash: string;
  deviceId: string;
  name: string;
  hardwareInfo: Record<string, unknown> | null;
}

export interface AgentRegistrationResult {
  agentId: string;
  userId: string;
}

export interface AgentHeartbeatInput {
  status: Extract<AgentStatus, 'online' | 'degraded'>;
  hardwareInfo?: Record<string, unknown> | null;
  models: Array<{ name: string; state: ModelInstanceState }>;
}

export interface ApiKeyCreateInput {
  userId: string;
  prefix: string;
  keyHash: string;
  expiresAt: Date | null;
  groupId: string;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface UserRepository {
  create(email: string, passwordHash: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByIdWithPassword(id: string): Promise<UserRecord | null>;
  listAll(): Promise<Array<Pick<UserRecord, 'id' | 'email' | 'role' | 'createdAt' | 'nickname'>>>;
  updateProfile(id: string, email: string, nickname: string | null): Promise<UserRecord | null>;
  updatePassword(id: string, passwordHash: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

export interface SessionRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findActive(tokenHash: string): Promise<SessionRecord | null>;
  touch(id: string): Promise<void>;
  revoke(tokenHash: string): Promise<boolean>;
  revokeAll(userId: string): Promise<void>;
}

export interface EnrollmentTokenRepository {
  create(userId: string, name: string, tokenHash: string, expiresAt: Date): Promise<string>;
}

export interface AgentRepository {
  listByUser(userId: string): Promise<Array<Record<string, unknown>>>;
  findByUser(userId: string, agentId: string): Promise<Record<string, unknown> | null>;
  authenticateCredential(credentialHash: string): Promise<AgentIdentity | null>;
  register(input: AgentRegistrationInput): Promise<AgentRegistrationResult | null>;
  rotateCredential(userId: string, agentId: string, credentialHash: string): Promise<number | null>;
  revokeCredentials(userId: string, agentId: string): Promise<boolean>;
  updateName(userId: string, agentId: string, name: string): Promise<boolean>;
  heartbeat(agentId: string, input: AgentHeartbeatInput): Promise<void>;
  markOffline(agentId: string): Promise<void>;
}

export interface ApiKeyRepository {
  listByUser(userId: string): Promise<Array<Record<string, unknown>>>;
  create(input: ApiKeyCreateInput): Promise<Record<string, unknown> | null>;
  disable(userId: string, keyId: string): Promise<boolean>;
  delete(userId: string, keyId: string): Promise<boolean>;
  authenticate(keyHash: string): Promise<ApiKeyIdentity | null>;
  listModelsByGroup(groupId: string): Promise<Array<Record<string, unknown>>>;
}

export interface GroupRepository {
  create(userId: string, name: string, description: string | null): Promise<Record<string, unknown>>;
  listByOwner(userId: string): Promise<Array<Record<string, unknown>>>;
  getById(groupId: string): Promise<Record<string, unknown> | null>;
  update(groupId: string, name: string, description: string | null): Promise<boolean>;
  delete(groupId: string): Promise<boolean>;
  addAgent(groupId: string, agentId: string): Promise<void>;
  removeAgent(groupId: string, agentId: string): Promise<void>;
  listAgentsByGroup(groupId: string): Promise<Array<Record<string, unknown>>>;
  countApiKeys(groupId: string): Promise<number>;
  // 渠道（user_group_access）
  addAccess(userId: string, groupId: string, source: string): Promise<void>;
  removeAccess(userId: string, accessId: string): Promise<boolean>;
  listAccessByUser(userId: string): Promise<Array<Record<string, unknown>>>;
  hasAccess(userId: string, groupId: string): Promise<boolean>;
  getAccessById(accessId: string): Promise<Record<string, unknown> | null>;
}

export interface CatalogRepository {
  listModels(): Promise<Array<Record<string, unknown>>>;
  getUsage(userId: string): Promise<Record<string, unknown>>;
  getMonitoring(userId: string, from: Date, to: Date, scope: 'caller' | 'deployer', granularity?: 'hour' | 'day'): Promise<Record<string, unknown>>;
}

export type MonitoringEventType = 'inference.started' | 'inference.routed' | 'inference.completed' | 'inference.failed' | 'inference.timeout' | 'inference.cancelled' | 'inference.disconnected';

export interface MonitoringEvent {
  eventId: string;
  eventVersion: 1;
  type: MonitoringEventType;
  requestId: string;
  occurredAt: Date;
  userId: string;
  apiKeyId: string;
  groupId: string | null;
  modelId?: string | null;
  modelName?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  groupName?: string | null;
  status?: InferenceFinishInput['status'];
  statusCode?: number;
  errorCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}

export interface MonitoringEventPort {
  publish(event: MonitoringEvent): Promise<void>;
}

export interface MonitoringQueryService {
  getDeployerDashboard(userId: string, from: Date, to: Date, granularity: 'hour' | 'day'): Promise<Record<string, unknown>>;
}

export interface ModelRouteCandidate {
  modelId: string;
  modelName: string;
  agentId: string;
  agentStatus: AgentStatus;
  state: ModelInstanceState;
  maxConcurrency: number;
  lastUsedAt: Date;
}

export interface InferenceSnapshot {
  modelExists: boolean;
  instances: ModelRouteCandidate[];
}

export interface InferenceCreateInput {
  requestId: string;
  userId: string;
  apiKeyId: string;
  groupId: string | null;
  endpoint: 'chat/completions' | 'responses';
  requestBytes: number;
}

export interface InferenceRouteInput {
  requestId: string;
  agentId: string;
  modelId: string;
  modelName?: string;
}

export interface InferenceFinishInput {
  status: 'completed' | 'failed' | 'cancelled' | 'timeout' | 'agent_disconnected';
  statusCode: number;
  errorCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  endpoint?: 'chat/completions' | 'responses';
  requestBytes?: number;
  responseBytes?: number;
  upstreamStatusCode?: number;
  usageAvailable?: boolean;
  usageSource?: string;
  upstreamLatencyMs?: number;
}

export interface InferenceRepository {
  getSnapshot(groupId: string | null, modelName: string): Promise<InferenceSnapshot>;
  createAccepted(input: InferenceCreateInput): Promise<void>;
  markRouted(input: InferenceRouteInput): Promise<void>;
  finish(requestId: string, input: InferenceFinishInput): Promise<void>;
}

export interface AuditRepository {
  record(actorId: string | null, action: string, resource: string): Promise<void>;
}

export interface ConnectionSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'message', listener: (raw: Buffer) => void): void;
}

export interface ConnectionRegistry {
  add(agentId: string, socket: ConnectionSocket): ConnectionSocket | undefined;
  remove(agentId: string, socket: ConnectionSocket): boolean;
  closeAgent(agentId: string, code: number, reason: string): void;
  get(agentId: string): ConnectionSocket | undefined;
  touch(agentId: string, socket: ConnectionSocket, at?: number): void;
  getStale(timeoutMs: number, now?: number): Array<{ agentId: string; socket: ConnectionSocket }>;
}

export interface RateLimiter {
  consume(key: string, now?: number): RateLimitResult;
  clear(key?: string): void;
}

export interface DatabaseHealth {
  check(): Promise<boolean>;
}

export interface SecurityService {
  hashPassword(value: string): Promise<string>;
  verifyPassword(hash: string, value: string): Promise<boolean>;
  digest(value: string): string;
  signSession(userId: string, role: string, ttlSeconds: number): string;
  verifySession(token: string): Record<string, unknown> | null;
  signPayload(payload: Record<string, unknown>, ttlSeconds: number): string;
  verifyPayload(token: string): Record<string, unknown> | null;
  randomToken(prefix: string): string;
}
