import WebSocket from 'ws';
import crypto from 'node:crypto';
import type { MessageSender } from '../../interfaces/websocket/message-sender.js';

export interface CloudClient extends MessageSender {
  connect(): Promise<void>;
  close(code?: number, reason?: string): void;
  online(): boolean;
  onClose(listener: (code: number, reason: string) => void): void;
  onMessage(listener: (raw: WebSocket.RawData) => void): void;
}

export interface RegisterDeviceInput {
  token: string;
  deviceId?: string;
  name: string;
  hardwareInfo?: Record<string, unknown>;
}

export function createCloudClient(url: string, credential: string): CloudClient {
  let socket: WebSocket | undefined;
  const closeListeners = new Set<(code: number, reason: string) => void>();
  const messageListeners = new Set<(raw: WebSocket.RawData) => void>();

  return {
    async connect(): Promise<void> {
      if (socket?.readyState === WebSocket.OPEN) return;

      const nextSocket = new WebSocket(url, {
        headers: { authorization: `Bearer ${credential}` },
      });
      socket = nextSocket;

      nextSocket.on('message', (raw) => {
        messageListeners.forEach((listener) => listener(raw));
      });
      nextSocket.on('close', (code, reason) => {
        const reasonText = reason.toString();
        closeListeners.forEach((listener) => listener(code, reasonText));
      });
      nextSocket.on('error', () => undefined);

      await new Promise<void>((resolve, reject) => {
        let opened = false;
        const rejectConnection = (error: Error): void => {
          if (!opened) reject(error);
        };

        nextSocket.once('open', () => {
          opened = true;
          resolve();
        });
        nextSocket.once('error', rejectConnection);
        nextSocket.once('close', (code, reason) => {
          rejectConnection(
            new Error(`cloud connection closed: ${code} ${reason.toString()}`),
          );
        });
      });
    },
    close(code = 1000, reason = 'agent stopped'): void {
      socket?.close(code, reason);
    },
    online(): boolean {
      return socket?.readyState === WebSocket.OPEN;
    },
    onClose(listener): void {
      closeListeners.add(listener);
    },
    onMessage(listener): void {
      messageListeners.add(listener);
    },
    async send(message: unknown): Promise<void> {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error('cloud offline');
      }
      socket.send(JSON.stringify(message));
    },
  };
}

export async function registerDevice(
  url: string,
  input: RegisterDeviceInput,
): Promise<{ agentId: string; credential: string; deviceId: string }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const deviceId = input.deviceId ?? crypto.randomUUID();
    let completed = false;
    const complete = (): boolean => {
      if (completed) return false;
      completed = true;
      clearTimeout(timeout);
      return true;
    };
    const fail = (error: Error): void => {
      if (complete()) reject(error);
    };
    const succeed = (result: {
      agentId: string;
      credential: string;
      deviceId: string;
    }): void => {
      if (complete()) resolve(result);
    };
    const timeout = setTimeout(() => {
      socket.close();
      fail(new Error('registration timeout'));
    }, 15000);
    socket.on('error', fail);
    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as { type?: string; payload?: { agentId?: string; credential?: string } };
        if (message.type !== 'registered' || !message.payload?.agentId || !message.payload.credential) return;
        socket.close();
        succeed({
          agentId: message.payload.agentId,
          credential: message.payload.credential,
          deviceId,
        });
      } catch {
        socket.close();
        fail(new Error('invalid registration response'));
      }
    });
    socket.once('open', () => {
      socket.send(JSON.stringify({
        protocol_version: 1,
        type: 'register',
        timestamp: new Date().toISOString(),
        payload: {
          token: input.token,
          deviceId,
          name: input.name,
          hardwareInfo: input.hardwareInfo ?? null,
        },
      }));
    });
  });
}
