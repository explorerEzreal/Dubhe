import type { FastifyInstance, FastifyRequest } from 'fastify';
import type {
  ConnectionRegistry,
  ConnectionSocket,
} from '../../application/ports.js';
import type { AgentService } from '../../application/services/index.js';
import {
  agentMessageSchema,
  heartbeatMessageSchema,
  inferChunkMessageSchema,
  inferDoneMessageSchema,
  inferErrorMessageSchema,
  registerMessageSchema,
} from './schemas.js';

interface AgentRequest extends FastifyRequest {
  raw: FastifyRequest['raw'] & { socket: { encrypted?: boolean } };
}

export interface AgentRoutesOptions {
  path: string;
  requireTls: boolean;
  maxMessageBytes: number;
  service: AgentService;
  connections: ConnectionRegistry;
  onInferenceMessage?: (agentId: string, message: unknown) => void;
  onDisconnect?: (agentId: string) => void;
}

function bearer(request: FastifyRequest): string {
  const authorization = String(request.headers.authorization ?? '');
  return authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
}

function isSecure(request: AgentRequest): boolean {
  return request.protocol === 'https' || request.raw.socket.encrypted === true;
}

export function registerAgentRoutes(
  app: FastifyInstance,
  options: AgentRoutesOptions,
): void {
  app.get(
    options.path,
    { websocket: true } as never,
    createAgentConnectionHandler(app, options),
  );
}

export function createAgentConnectionHandler(
  app: Pick<FastifyInstance, 'log'>,
  options: AgentRoutesOptions,
): (socket: ConnectionSocket, request: AgentRequest) => void {
  return (socket: ConnectionSocket, request: AgentRequest) => {
    if (options.requireTls && !isSecure(request)) {
      socket.close(1008, 'tls required');
      return;
    }

    const credential = bearer(request);
    if (credential.length > 512) {
      socket.close(1008, 'credential rejected');
      return;
    }
    let authenticatedAgentId: string | null = null;
    let registrationPending = false;
    let closed = false;
    const close = (code: number, reason: string): void => {
      if (closed) return;
      closed = true;
      socket.close(code, reason);
    };
    const bindConnection = (agentId: string): void => {
      authenticatedAgentId = agentId;
      const previous = options.connections.add(agentId, socket);
      if (previous && previous !== socket) {
        previous.close(4001, 'connection replaced');
      }
    };
    const authentication: Promise<boolean> = credential
      ? options.service
          .authenticateCredential(credential)
          .then((agent) => {
            if (closed) return false;
            bindConnection(agent.id);
            return true;
          })
          .catch(() => {
            close(1008, 'credential rejected');
            return false;
          })
      : Promise.resolve(true);

    socket.on('close', () => {
      closed = true;
      const agentId = authenticatedAgentId;
      if (agentId && options.connections.remove(agentId, socket)) {
        options.onDisconnect?.(agentId);
        void options.service.markOffline(agentId).catch(() => {
          app.log.warn('agent offline persistence failed');
        });
      }
    });

    socket.on('message', (raw: Buffer) => {
      void handleMessage(raw);
    });

    const handleMessage = async (raw: Buffer): Promise<void> => {
      try {
        if (closed) return;
        if (raw.byteLength > options.maxMessageBytes) {
          close(1009, 'message too large');
          return;
        }
        if (!(await authentication)) return;
        const parsed = JSON.parse(raw.toString()) as unknown;
        const envelope = agentMessageSchema.safeParse(parsed);
        if (!envelope.success) {
          app.log.warn('agent protocol rejected');
          close(1003, 'invalid message');
          return;
        }

        if (envelope.data.type === 'register') {
          if (credential || authenticatedAgentId || registrationPending) {
            close(1008, 'already authenticated');
            return;
          }
          const registration = registerMessageSchema.safeParse(parsed);
          if (!registration.success) {
            close(1008, 'registration rejected');
            return;
          }
          registrationPending = true;
          const result = await options.service.register(
            registration.data.payload,
          );
          bindConnection(result.agentId);
          socket.send(
            JSON.stringify({
              protocol_version: 1,
              type: 'registered',
              timestamp: new Date().toISOString(),
              payload: result,
            }),
          );
          return;
        }

        if (!authenticatedAgentId) {
          close(1008, 'credential required');
          return;
        }

        if (envelope.data.type === 'heartbeat') {
          const heartbeat = heartbeatMessageSchema.safeParse(parsed);
          if (!heartbeat.success) {
            close(1003, 'invalid heartbeat');
            return;
          }
          options.connections.touch(authenticatedAgentId, socket);
          await options.service.heartbeat(authenticatedAgentId, {
            status: heartbeat.data.payload.status,
            hardwareInfo: heartbeat.data.payload.hardwareInfo,
            models: heartbeat.data.payload.models,
          });
          socket.send(
            JSON.stringify({
              protocol_version: 1,
              type: 'heartbeat_ack',
              timestamp: new Date().toISOString(),
              payload: {},
            }),
          );
          return;
        }

        if (envelope.data.type === 'infer_chunk' || envelope.data.type === 'infer_done' || envelope.data.type === 'infer_error') {
          const inference = envelope.data.type === 'infer_chunk'
            ? inferChunkMessageSchema.safeParse(parsed)
            : envelope.data.type === 'infer_done'
              ? inferDoneMessageSchema.safeParse(parsed)
              : inferErrorMessageSchema.safeParse(parsed);
          if (!inference.success) {
            close(1003, 'invalid inference message');
            return;
          }
          options.onInferenceMessage?.(authenticatedAgentId, inference.data);
          return;
        }

        close(1003, 'invalid message direction');
      } catch {
        app.log.warn('agent message rejected');
        close(1008, 'message rejected');
      }
    };
  };
}
