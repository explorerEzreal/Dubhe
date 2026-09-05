# Agent 架构设计

## 分层

```text
interfaces (CLI、消息适配)
        |
        v
application (用例编排)
        |
   +----+----+
   |         |
   v         v
domain    infrastructure
```

- `domain`：状态机、实体、错误码、协议无关规则。禁止 import `infrastructure` 或 `interfaces`。
- `application`：调用 `domain` 规则并编排 `infrastructure` 能力。
- `infrastructure`：实现端口接口（WSS 客户端、Ollama HTTP、系统采集、凭证存储、日志）。
- `interfaces`：把 CLI 输入和 WSS 消息翻译为 application 调用。

## 关键模块

| 模块 | 路径 | 职责 |
|------|------|------|
| ConnectionService | `application/connection-service.ts` | 连接生命周期、重连、心跳 |
| RegistrationService | `application/registration-service.ts` | 部署令牌注册、凭证持久化 |
| ModelService | `application/model-service.ts` | Ollama 模型检查、拉取、状态同步 |
| InferenceService | `application/inference-service.ts` | 推理任务编排、流式转发、取消 |
| MetricsService | `application/metrics-service.ts` | 采集系统指标并上报 |

## 状态机

- Agent：`created -> connecting -> online | degraded | offline | revoked`
- 模型实例：`unknown -> checking -> pulling -> ready | busy | error | stopped | offline`
- 推理请求：`accepted -> running -> streaming -> completed | failed | cancelled | timeout`

只有模型实例为 `ready` 时才可被 Cloud 路由。

## 约束

- 单请求使用唯一 `request_id`。
- 流式 chunk 携带单调递增序号。
- 采集失败不能阻塞推理链路。
- 日志必须脱敏，不输出凭证和请求正文。
