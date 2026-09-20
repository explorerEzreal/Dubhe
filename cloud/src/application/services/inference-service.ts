import crypto from 'node:crypto';
import type {
  ConnectionRegistry,
  InferenceRepository,
  ModelRouteCandidate,
  MonitoringEvent,
  MonitoringEventPort,
} from '../ports.js';
import {
  inferChunkMessageSchema,
  inferDoneMessageSchema,
  inferErrorMessageSchema,
} from '../../interfaces/websocket/schemas.js';
import { errors } from '../../domain/common/index.js';

export interface InferenceChunk {
  seq: number;
  data: string;
  content?: string;
  encoding: 'base64';
  responseBytes: number;
  statusCode?: number;
  headers?: Record<string, string>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface InferenceRunInput {
  userId: string;
  apiKeyId: string;
  groupId: string | null;
  model: string;
  endpoint: 'chat/completions' | 'responses';
  payload: Record<string, unknown>;
  requestBytes: number;
  onStart?: (requestId: string, created: number) => void;
  onChunk?: (chunk: InferenceChunk) => void;
}

export interface InferenceRunResult {
  requestId: string;
  model: string;
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  created: number;
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
  encoding?: 'base64';
  responseBytes: number;
}

interface ActiveRequest {
  requestId: string;
  agentId: string;
  model: string;
  startedAt: number;
  resolve: (value: InferenceRunResult) => void;
  reject: (reason: unknown) => void;
  timer: NodeJS.Timeout;
  settled: boolean;
  expectedSeq: number;
  content: string;
  stream: boolean;
  responseBytes: number;
  onChunk?: (chunk: InferenceChunk) => void;
}

interface InferenceLogger {
  warn(object: Record<string, unknown>, message: string): void;
}

function emptyUsage(): InferenceRunResult['usage'] {
  return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
}

export class InferenceService {
  private readonly active = new Map<string, ActiveRequest>();
  private readonly agentActive = new Map<string, number>();
  private readonly lastUsed = new Map<string, number>();

  constructor(
    private readonly repository: InferenceRepository,
    private readonly connections: ConnectionRegistry,
    private readonly timeoutMs: number,
    private readonly logger: InferenceLogger,
    private readonly monitoring?: MonitoringEventPort,
  ) {}

  activeCount(): number { return this.active.size; }

  async run(input: InferenceRunInput): Promise<InferenceRunResult> {
    const requestId = `req_${crypto.randomUUID()}`;
    const snapshot = await this.repository.getSnapshot(input.groupId, input.model);
    const candidate = this.selectCandidate(snapshot.instances);
    if (!candidate) {
      const reachable = snapshot.instances.some((item) => item.agentStatus === 'online' || item.agentStatus === 'degraded');
      if (!snapshot.modelExists || !reachable) throw errors.modelOffline();
      if (!snapshot.instances.some((item) => item.state === 'ready')) throw errors.modelNotReady();
      throw errors.agentBusy();
    }
    await this.repository.createAccepted({ requestId, userId: input.userId, apiKeyId: input.apiKeyId, groupId: input.groupId, endpoint: input.endpoint, requestBytes: input.requestBytes });
    await this.publish({ eventId: `${requestId}:started`, eventVersion: 1, type: 'inference.started', requestId, occurredAt: new Date(), userId: input.userId, apiKeyId: input.apiKeyId, groupId: input.groupId, modelName: input.model });
    await this.repository.markRouted({ requestId, agentId: candidate.agentId, modelId: candidate.modelId, modelName: candidate.modelName });
    await this.publish({ eventId: `${requestId}:routed`, eventVersion: 1, type: 'inference.routed', requestId, occurredAt: new Date(), userId: input.userId, apiKeyId: input.apiKeyId, groupId: input.groupId, modelId: candidate.modelId, modelName: candidate.modelName, deviceId: candidate.agentId });
    this.increment(candidate.agentId);
    const socket = this.connections.get(candidate.agentId);
    if (!socket) {
      this.release(candidate.agentId);
      await this.repository.finish(requestId, { status: 'agent_disconnected', statusCode: 503, errorCode: 'AGENT_DISCONNECTED', latencyMs: 0 });
      throw errors.agentDisconnected();
    }
    const startedAt = Date.now();
    return new Promise<InferenceRunResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        const current = this.active.get(requestId);
        if (current) void this.timeout(current);
      }, this.timeoutMs);
      this.active.set(requestId, {
        requestId, agentId: candidate.agentId, model: input.model, startedAt,
        resolve, reject, timer, settled: false, expectedSeq: 0, content: '', stream: input.payload.stream === true, responseBytes: 0, onChunk: input.onChunk,
      });
      input.onStart?.(requestId, Math.floor(startedAt / 1000));
      try {
        socket.send(JSON.stringify({ protocol_version: 1, type: 'infer_request', timestamp: new Date().toISOString(), request_id: requestId, payload: { endpoint: input.endpoint, model: input.model, body: input.payload, stream: input.payload.stream === true, request_bytes: input.requestBytes } }));
      } catch {
        void this.terminate(requestId, errors.agentDisconnected(), 'agent_disconnected', 503, 'AGENT_DISCONNECTED');
      }
    });
  }

  async cancel(requestId: string): Promise<void> {
    const active = this.active.get(requestId);
    if (!active || active.settled) return;
    try {
      this.connections.get(active.agentId)?.send(JSON.stringify({ protocol_version: 1, type: 'infer_cancel', timestamp: new Date().toISOString(), request_id: requestId, payload: {} }));
    } catch {
      this.logger.warn({ requestId }, 'inference cancel delivery failed');
    }
    await this.terminate(requestId, errors.inferenceCancelled(), 'cancelled', 499, 'INFERENCE_CANCELLED');
  }

  async handleAgentMessage(agentId: string, message: unknown): Promise<void> {
    const envelope = message as { type?: string; request_id?: string };
    if (!envelope.request_id) return;
    const active = this.active.get(envelope.request_id);
    if (!active || active.agentId !== agentId || active.settled) return;
    if (envelope.type === 'infer_chunk') {
      if (!active.stream) {
        await this.terminate(active.requestId, errors.upstreamError(), 'failed', 502, 'UPSTREAM_ERROR');
        return;
      }
      const parsed = inferChunkMessageSchema.safeParse(message);
      if (!parsed.success || parsed.data.payload.seq !== active.expectedSeq) {
        await this.terminate(active.requestId, errors.upstreamError(), 'failed', 502, 'UPSTREAM_ERROR');
        return;
      }
      active.expectedSeq += 1;
      const data = parsed.data.payload.data ?? Buffer.from(parsed.data.payload.content ?? '', 'utf8').toString('base64');
      active.responseBytes = parsed.data.payload.response_bytes ?? Buffer.from(parsed.data.payload.content ?? '', 'utf8').byteLength;
      try {
        active.onChunk?.({ data, content: parsed.data.payload.content ?? Buffer.from(data, 'base64').toString('utf8'), encoding: 'base64', responseBytes: active.responseBytes, seq: parsed.data.payload.seq, usage: parsed.data.payload.usage, statusCode: parsed.data.payload.status_code, headers: parsed.data.payload.headers });
      } catch {
        await this.terminate(active.requestId, errors.inferenceCancelled(), 'cancelled', 499, 'INFERENCE_CANCELLED');
      }
      return;
    }
    if (envelope.type === 'infer_done') {
      const parsed = inferDoneMessageSchema.safeParse(message);
      if (!parsed.success) {
        await this.terminate(active.requestId, errors.upstreamError(), 'failed', 502, 'UPSTREAM_ERROR');
        return;
      }
      const legacy = parsed.data.payload.content !== undefined && parsed.data.payload.body === undefined;
      const body = parsed.data.payload.body ?? (legacy ? parsed.data.payload.content : undefined);
      await this.finishSuccess(active, body ?? '', parsed.data.payload.usage, parsed.data.payload.status_code ?? 200, parsed.data.payload.headers ?? {}, parsed.data.payload.response_bytes ?? Buffer.byteLength(parsed.data.payload.content ?? ''), legacy ? undefined : (parsed.data.payload.encoding ?? (body ? 'base64' : undefined)));
      return;
    }
    if (envelope.type === 'infer_error') {
      const parsed = inferErrorMessageSchema.safeParse(message);
      if (!parsed.success) {
        await this.terminate(active.requestId, errors.upstreamError(), 'failed', 502, 'UPSTREAM_ERROR');
        return;
      }
      const mapped = parsed.data.payload.code === 'MODEL_NOT_READY' ? errors.modelNotReady()
        : parsed.data.payload.code === 'INFERENCE_TIMEOUT' ? errors.inferenceTimeout()
          : errors.upstreamError();
      await this.terminate(active.requestId, mapped, 'failed', mapped.statusCode, mapped.code);
    }
  }

  async handleAgentDisconnected(agentId: string): Promise<void> {
    const pending = Array.from(this.active.values()).filter((item) => item.agentId === agentId);
    for (const request of pending) await this.terminate(request.requestId, errors.agentDisconnected(), 'agent_disconnected', 503, 'AGENT_DISCONNECTED');
  }

  private async finishSuccess(active: ActiveRequest, content: string, usage: InferenceRunResult['usage'] | undefined, statusCode: number, headers: Record<string, string>, responseBytes: number, encoding?: 'base64'): Promise<void> {
    const latencyMs = Date.now() - active.startedAt;
    await this.repository.finish(active.requestId, { status: statusCode >= 400 ? 'failed' : 'completed', statusCode, inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens, usageAvailable: Boolean(usage), usageSource: usage ? 'upstream' : undefined, responseBytes, latencyMs }).catch(() => this.logger.warn({ requestId: active.requestId }, 'inference persistence failed'));
    await this.publish({ eventId: `${active.requestId}:completed`, eventVersion: 1, type: 'inference.completed', requestId: active.requestId, occurredAt: new Date(), userId: '', apiKeyId: '', groupId: null, status: statusCode >= 400 ? 'failed' : 'completed', statusCode, inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens, latencyMs });
    this.complete(active.requestId, { requestId: active.requestId, model: active.model, content, usage: usage ?? emptyUsage(), created: Math.floor(active.startedAt / 1000), statusCode, headers, body: content, encoding, responseBytes });
  }

  private async terminate(requestId: string, error: unknown, status: 'failed' | 'cancelled' | 'timeout' | 'agent_disconnected', statusCode: number, errorCode: string): Promise<void> {
    const active = this.active.get(requestId);
    if (!active || active.settled) return;
    active.settled = true;
    clearTimeout(active.timer);
    this.active.delete(requestId);
    this.release(active.agentId);
    await this.repository.finish(requestId, { status, statusCode, errorCode, latencyMs: Date.now() - active.startedAt }).catch(() => this.logger.warn({ requestId }, 'inference persistence failed'));
    await this.publish({ eventId: `${requestId}:${status}`, eventVersion: 1, type: status === 'timeout' ? 'inference.timeout' : status === 'cancelled' ? 'inference.cancelled' : status === 'agent_disconnected' ? 'inference.disconnected' : 'inference.failed', requestId, occurredAt: new Date(), userId: '', apiKeyId: '', groupId: null, status, statusCode, errorCode, latencyMs: Date.now() - active.startedAt });
    active.reject(error);
  }

  private async publish(event: MonitoringEvent): Promise<void> {
    if (!this.monitoring) return;
    try { await this.monitoring.publish(event); } catch (error) { this.logger.warn({ requestId: event.requestId, error }, 'monitoring persistence failed'); }
  }

  private selectCandidate(instances: ModelRouteCandidate[]): ModelRouteCandidate | undefined {
    return instances.filter((item) => item.agentStatus === 'online' && item.state === 'ready')
      .filter((item) => (this.agentActive.get(item.agentId) ?? 0) < item.maxConcurrency)
      .sort((a, b) => ((this.agentActive.get(a.agentId) ?? 0) - (this.agentActive.get(b.agentId) ?? 0)) || ((this.lastUsed.get(a.agentId) ?? a.lastUsedAt.getTime()) - (this.lastUsed.get(b.agentId) ?? b.lastUsedAt.getTime())))[0];
  }

  private increment(agentId: string): void { this.agentActive.set(agentId, (this.agentActive.get(agentId) ?? 0) + 1); this.lastUsed.set(agentId, Date.now()); }
  private release(agentId: string): void { const count = (this.agentActive.get(agentId) ?? 1) - 1; if (count <= 0) this.agentActive.delete(agentId); else this.agentActive.set(agentId, count); }
  private complete(requestId: string, result: InferenceRunResult): void { const active = this.active.get(requestId); if (!active || active.settled) return; active.settled = true; clearTimeout(active.timer); this.active.delete(requestId); this.release(active.agentId); active.resolve(result); }
  private fail(requestId: string, error: unknown): void { const active = this.active.get(requestId); if (!active || active.settled) return; active.settled = true; clearTimeout(active.timer); this.active.delete(requestId); this.release(active.agentId); active.reject(error); }
  private async timeout(active: ActiveRequest): Promise<void> { if (active.settled) return; try { this.connections.get(active.agentId)?.send(JSON.stringify({ protocol_version: 1, type: 'infer_cancel', timestamp: new Date().toISOString(), request_id: active.requestId, payload: {} })); } catch { this.logger.warn({ requestId: active.requestId }, 'inference cancel delivery failed'); } await this.terminate(active.requestId, errors.inferenceTimeout(), 'timeout', 504, 'INFERENCE_TIMEOUT'); }
}
