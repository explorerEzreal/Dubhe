// 端口：WSS 消息发送。实现位于 infrastructure/cloud。
export interface MessageSender {
  send(message: unknown): Promise<void>;
}
