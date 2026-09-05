// 用例：WSS 连接生命周期、心跳与指数退避重连。
export interface ConnectionService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isOnline(): boolean;
  send(message: unknown): Promise<void>;
}
