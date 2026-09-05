# Agent-Cloud WSS 协议 v1

与 `agent/docs/protocol-v1.md` 保持一致。Agent 只主动建立出站 WSS 连接。

## 消息信封

```json
{
  "protocol_version": 1,
  "type": "message_type",
  "timestamp": "2026-09-04T00:00:00Z",
  "request_id": "req_123",
  "payload": {}
}
```

## 消息类型

- `register` / `registered`
- `heartbeat` / `heartbeat_ack`
- `infer_request`
- `infer_chunk`
- `infer_done`
- `infer_error`
- `infer_cancel`

## 规则

- 心跳默认 15 秒，连续 2 个周期未收到则标记离线。
- 心跳载荷使用 `status`、`hardwareInfo` 和 `models`；模型项固定为 `{ "name": "llama3:8b", "state": "ready" }`。
- `infer_request` 支持 `stream: false|true`，必须携带 `request_id`、模型和消息列表；流式请求使用 `infer_chunk.payload.seq` 从 0 开始连续递增，最后由 `infer_done` 携带 usage 收尾。
- 同一 Agent 只保留一个当前连接，新连接建立后旧连接以 `4001` 关闭。
- 重连指数退避：初始 1 秒，最大 5 分钟。
- 每个 chunk 带单调递增序号。
- 请求结束、取消、超时或 Agent 断开时，Cloud 必须释放活跃请求。
