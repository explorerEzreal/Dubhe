import type { AgentConfig } from '../config/config.js';
import type { AgentState } from '../domain/agent-state.js';
import type { ModelInstance } from '../domain/model-state.js';
import type { Credentials } from '../infrastructure/credentials/index.js';
import type { OllamaClient } from '../interfaces/ollama/ollama-client.js';
import type { CloudClient, RegisterDeviceInput } from '../infrastructure/cloud/index.js';
import type WebSocket from 'ws';
import { createInferenceService } from './inference-service.js';
import { inferCancelSchema, inferRequestSchema } from '../interfaces/websocket/schemas.js';

interface AgentLogger {
  info(object: Record<string, unknown>, message: string): void;
  warn(object: Record<string, unknown>, message: string): void;
  debug(object: Record<string, unknown>, message: string): void;
}

interface HeartbeatSnapshot {
  status: 'online' | 'degraded';
  hardwareInfo: Record<string, unknown>;
  models: ModelInstance[];
}

export interface AgentRuntimeOptions {
  config: AgentConfig;
  ollama: OllamaClient;
  logger: AgentLogger;
  collectMetrics(): Promise<Record<string, unknown>>;
  loadCredentials(path: string): Promise<Credentials>;
  saveCredentials(path: string, credentials: Credentials): Promise<void>;
  registerDevice(
    url: string,
    input: RegisterDeviceInput,
  ): Promise<Credentials>;
  createCloudClient(url: string, credential: string): CloudClient;
}

export interface AgentRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
  state(): AgentState;
}

export function createAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  let currentState: AgentState = 'created';
  let credentials: Credentials = {};
  let client: CloudClient | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  let reconnectTimer: NodeJS.Timeout | undefined;
  let reconnectAttempt = 0;
  let stopping = false;
  const inference = createInferenceService(
    options.ollama,
    options.config.MAX_CONCURRENCY,
    options.logger,
  );

  const configuredModels = Array.from(
    new Set(
      options.config.MODELS.split(',')
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  );

  const setState = (next: AgentState): void => {
    if (currentState === next) return;
    currentState = next;
    options.logger.info({ state: next }, 'agent state changed');
  };

  const clearHeartbeat = (): void => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = undefined;
  };

  const scheduleReconnect = (): void => {
    if (stopping || currentState === 'revoked' || reconnectTimer) return;
    const baseDelay = Math.min(
      options.config.RECONNECT_MAX_MS,
      options.config.RECONNECT_INITIAL_MS * 2 ** reconnectAttempt,
    );
    const delay = Math.min(
      options.config.RECONNECT_MAX_MS,
      Math.round(baseDelay * (0.5 + Math.random())),
    );
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect();
    }, delay);
    options.logger.warn({ delay }, 'cloud reconnect scheduled');
  };

  const collectHeartbeat = async (): Promise<HeartbeatSnapshot> => {
    let hardwareInfo: Record<string, unknown> = {};
    try {
      hardwareInfo = await options.collectMetrics();
    } catch {
      options.logger.warn({}, 'system metrics unavailable');
    }

    try {
      if (!(await options.ollama.health())) {
        return {
          status: 'degraded',
          hardwareInfo,
          models: configuredModels.map((model) => ({ model, state: 'offline' })),
        };
      }

      const localModels = new Set(await options.ollama.listModels());
      const modelsToSync = configuredModels.length > 0
        ? configuredModels
        : Array.from(localModels);
      const models = modelsToSync.map((model) => ({
        model,
        state: localModels.has(model) ? 'ready' : 'error',
      } as ModelInstance));

      return {
        status: models.every((model) => model.state === 'ready') && models.length > 0
          ? 'online'
          : 'degraded',
        hardwareInfo,
        models,
      };
    } catch {
      return {
        status: 'degraded',
        hardwareInfo,
        models: configuredModels.map((model) => ({ model, state: 'offline' })),
      };
    }
  };

  const sendHeartbeat = async (): Promise<void> => {
    const activeClient = client;
    if (stopping || !activeClient || !activeClient.online()) return;

    try {
      const snapshot = await collectHeartbeat();
      if (client !== activeClient || stopping) return;
      await activeClient.send({
        protocol_version: 1,
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        payload: {
          status: snapshot.status,
          hardwareInfo: snapshot.hardwareInfo,
          models: snapshot.models.map(({ model, state }) => ({ name: model, state })),
        },
      });
      setState(snapshot.status);
    } catch {
      options.logger.warn({}, 'heartbeat delivery failed');
      activeClient.close(1011, 'heartbeat failed');
    } finally {
      if (!stopping && client === activeClient && activeClient.online()) {
        heartbeatTimer = setTimeout(() => {
          void sendHeartbeat();
        }, options.config.HEARTBEAT_INTERVAL_MS);
      }
    }
  };

  const handleMessage = (raw: WebSocket.RawData): void => {
    try {
      const content = Array.isArray(raw)
        ? Buffer.concat(raw).toString()
        : raw instanceof ArrayBuffer
          ? Buffer.from(new Uint8Array(raw)).toString()
          : raw.toString();
      const message = JSON.parse(content) as { type?: string };
      if (message.type === 'heartbeat_ack') return;
      if (message.type === 'infer_cancel') {
        const parsed = inferCancelSchema.safeParse(JSON.parse(content));
        if (parsed.success) inference.cancel(parsed.data.request_id);
        return;
      }
      if (message.type === 'infer_request') {
        const parsed = inferRequestSchema.safeParse(JSON.parse(content));
        const activeClient = client;
        if (parsed.success && activeClient) {
          void inference.handleRequest(parsed.data, activeClient);
        }
        return;
      }
      options.logger.debug({ type: message.type ?? 'unknown' }, 'cloud message deferred');
    } catch {
      options.logger.warn({}, 'cloud message ignored');
    }
  };

  const handleClose = (
    closedClient: CloudClient,
    code: number,
    reason: string,
  ): void => {
    if (client !== closedClient) return;
    client = undefined;
    clearHeartbeat();
    if (stopping) return;
    if (code === 1008 || code === 4001) {
      setState('revoked');
      options.logger.warn({ code, reason }, 'cloud credential rejected');
      return;
    }
    setState('offline');
    options.logger.warn({ code, reason }, 'cloud connection closed');
    scheduleReconnect();
  };

  const connect = async (): Promise<void> => {
    if (stopping || currentState === 'revoked' || client || !credentials.credential) {
      return;
    }

    setState('connecting');
    const nextClient = options.createCloudClient(
      options.config.CLOUD_URL,
      credentials.credential,
    );
    client = nextClient;
    nextClient.onMessage(handleMessage);
    nextClient.onClose((code, reason) => handleClose(nextClient, code, reason));

    try {
      await nextClient.connect();
      if (stopping || client !== nextClient) {
        nextClient.close();
        return;
      }
      reconnectAttempt = 0;
      await sendHeartbeat();
    } catch {
      if (client !== nextClient) return;
      nextClient.close();
      handleClose(nextClient, 1006, 'connection failed');
    }
  };

  const ensureCredentials = async (): Promise<void> => {
    const stored = await options.loadCredentials(options.config.CREDENTIALS_PATH);
    credentials = {
      agentId: options.config.AGENT_ID ?? stored.agentId,
      credential: options.config.AGENT_CREDENTIAL ?? stored.credential,
      deviceId: options.config.DEVICE_ID ?? stored.deviceId,
    };
    if (credentials.credential) return;
    if (!options.config.ENROLLMENT_TOKEN) {
      throw new Error('agent credentials are missing');
    }

    const hardwareInfo = await options.collectMetrics().catch(() => ({}));
    credentials = await options.registerDevice(options.config.CLOUD_URL, {
      token: options.config.ENROLLMENT_TOKEN,
      deviceId: credentials.deviceId,
      name: options.config.AGENT_NAME,
      hardwareInfo,
    });
    await options.saveCredentials(options.config.CREDENTIALS_PATH, credentials);
    options.logger.info({ agentId: credentials.agentId }, 'agent registered');
  };

  return {
    async start(): Promise<void> {
      stopping = false;
      await ensureCredentials();
      void connect();
    },
    async stop(): Promise<void> {
      stopping = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      clearHeartbeat();
      client?.close(1000, 'agent stopped');
      client = undefined;
      setState('offline');
    },
    state(): AgentState {
      return currentState;
    },
  };
}
