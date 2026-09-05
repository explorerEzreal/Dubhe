# Agent-Cloud WSS 协议 v1

Agent 只主动建立出站 WSS 连接。所有消息为 JSON 文本帧。

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

`request_id` 对请求消息必填，对心跳和注册消息可选。

心跳载荷固定使用模型字段 `name`：

```json
{
  "status": "online",
  "hardwareInfo": {},
  "models": [
    { "name": "llama3:8b", "state": "ready" }
  ]
}
```

## 消息类型

| type | 方向 | 说明 |
|------|------|------|
| `register` | Agent -> Cloud | 使用部署令牌注册 |
| `registered` | Cloud -> Agent | 返回设备凭证 |
| `heartbeat` | Agent -> Cloud | 设备、模型、资源、请求状态 |
| `heartbeat_ack` | Cloud -> Agent | 心跳确认 |
| `infer_request` | Cloud -> Agent | 下发推理参数（支持 stream true/false） |
| `infer_chunk` | Agent -> Cloud | `{ seq, content }` 有序文本增量 |
| `infer_done` | Agent -> Cloud | 请求完成 |
| `infer_error` | Agent -> Cloud | 稳定错误码 |
| `infer_cancel` | Cloud -> Agent | 取消请求 |

## 可靠性规则

- 默认心跳间隔 15 秒；Cloud 连续 2 个周期未收到消息即标记离线。
- 重连指数退避：初始 1 秒，最大 5 分钟，带随机抖动。
- 重连成功后 Agent 重新同步模型与请求能力状态。
- 每个流式 chunk 带单调递增序号，Cloud 校验顺序。
- 重复 `request_id` 不得产生重复任务。
- Ollama 不可用或模型未 ready 时，Agent 保持连接但不上报可路由状态。
- Agent 只能主动发送 `register`、`heartbeat`、`infer_done` 和 `infer_error`；Cloud 下发 `infer_request` 或 `infer_cancel` 时必须携带有效 `request_id`。
