import type { AgentStatus } from '../domain/agents/agent-status.js';
import type { ModelInstanceState } from '../domain/models/model-instance-state.js';

export interface UserRecord {
  id: string;
  email: string;
  role: string;
  passwordHash?: string;
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
  modelNames: string[];
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface UserRepository {
  create(email: string, passwordHash: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface SessionRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findActive(tokenHash: string): Promise<SessionRecord | null>;
  touch(id: string): Promise<void>;
  revoke(tokenHash: string): Promise<boolean>;
}

export interface EnrollmentTokenRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
}

export interface AgentRepository {
  listByUser(userId: string): Promise<Array<Record<string, unknown>>>;
  findByUser(userId: string, agentId: string): Promise<Record<string, unknown> | null>;
  authenticateCredential(credentialHash: string): Promise<AgentIdentity | null>;
  register(input: AgentRegistrationInput): Promise<AgentRegistrationResult | null>;
  rotateCredential(userId: string, agentId: string, credentialHash: string): Promise<number | null>;
  revokeCredentials(userId: string, agentId: string): Promise<boolean>;
  heartbeat(agentId: string, input: AgentHeartbeatInput): Promise<void>;
  markOffline(agentId: string): Promise<void>;
}

export interface ApiKeyRepository {
  listByUser(userId: string): Promise<Array<Record<string, unknown>>>;
  create(input: ApiKeyCreateInput): Promise<Record<string, unknown> | null>;
  disable(userId: string, keyId: string): Promise<boolean>;
  delete(userId: string, keyId: string): Promise<boolean>;
  authenticate(keyHash: string): Promise<ApiKeyIdentity | null>;
  listPermittedModels(keyId: string): Promise<Array<Record<string, unknown>>>;
  hasModelPermission(keyId: string, modelName: string): Promise<boolean>;
}

export interface CatalogRepository {
  listModels(): Promise<Array<Record<string, unknown>>>;
  getUsage(userId: string): Promise<Record<string, unknown>>;
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
}

export interface InferenceRouteInput {
  requestId: string;
  agentId: string;
  modelId: string;
}

export interface InferenceFinishInput {
  status: 'completed' | 'failed' | 'cancelled' | 'timeout' | 'agent_disconnected';
  statusCode: number;
  errorCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export interface InferenceRepository {
  getSnapshot(modelName: string): Promise<InferenceSnapshot>;
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
  randomToken(prefix: string): string;
}
