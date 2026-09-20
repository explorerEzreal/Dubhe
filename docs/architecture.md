# Bubhe 天枢架构速查

## 工程职责

| 工程 | 职责 | 对外连接 |
| --- | --- | --- |
| `cloud` | Fastify 服务、认证、设备、Key、分组、推理、WSS 控制面；唯一访问 PostgreSQL | HTTPS、WSS、SQL |
| `agent` | 模型设备上的 CLI 和常驻运行时，管理本地模型并转发推理 | 出站 WSS、localhost HTTP |
| `web` | React 控制台和调用者界面 | 仅 HTTPS Cloud API |

固定链路：`Web -> HTTPS -> Cloud -> PostgreSQL`、`Agent -> WSS -> Cloud -> PostgreSQL`。

## 关键 HTTP 路由

认证使用 Web 会话 Bearer；推理使用 API Key Bearer。

| 范围 | 路由 |
| --- | --- |
| 认证 | `POST /api/auth/register`、`POST /api/auth/login`、`POST /api/auth/logout` |
| 用户 | `GET /api/me`、`PATCH /api/me/profile`、`PATCH /api/me/password` |
| 设备 | `POST /api/enrollment-tokens`、`GET /api/agents`、`GET /api/agents/:id`、`PATCH /api/agents/:id`、凭证轮换/撤销 |
| 分组/渠道 | `/api/groups` CRUD、设备关联、邀请码；`/api/channels` 查询、添加、移除、模型广场 |
| Key/用量 | `/api/keys` 创建、查询、禁用、删除；`GET /api/usage` |
| 管理员 | `/api/admin/users` 列表、改密、删除 |
| 推理 | `GET /v1/models`、`POST /v1/chat/completions`、`POST /v1/responses` |
| 健康 | `/healthz`、`/readyz` |

## Agent WSS 协议

协议源文件为 `contracts/agent-messages.schema.json`，副本位于 `cloud/protocol/` 和 `agent/protocol/`。

| 方向 | 消息 | 用途 |
| --- | --- | --- |
| Agent -> Cloud | `register` | 使用 enrollment token 注册设备 |
| Cloud -> Agent | `registered` | 返回设备凭证 |
| Agent -> Cloud | `heartbeat` | 心跳、模型状态和资源快照 |
| Cloud -> Agent | `heartbeat_ack` | 心跳确认 |
| Cloud -> Agent | `infer_request` | 推理请求 |
| Agent -> Cloud | `infer_chunk`、`infer_done`、`infer_error` | 流式结果、结束和错误 |
| Cloud -> Agent | `infer_cancel` | 取消推理 |

所有消息带 `protocol_version`；请求使用唯一 `request_id`，流式 chunk 必须保序。

## 核心数据表

| 表 | 作用 |
| --- | --- |
| `users`、`sessions` | 用户和 Web 会话 |
| `enrollment_tokens`、`agents`、`agent_credentials` | 设备预创建、状态、凭证及轮换 |
| `models`、`model_instances` | 全局模型和 Agent 模型实例 |
| `groups`、`group_agents`、`user_group_access` | 分组、设备关联和调用者渠道 |
| `api_keys` | 绑定单个 `group_id` 的 API Key |
| `inference_requests`、`audit_logs` | 推理记录和审计 |

## Web 页面

| 路径 | 页面 |
| --- | --- |
| `/login`、`/register` | 登录、注册 |
| `/deployer` | 兼容入口 |
| `/device/groups` | 分组和渠道管理 |
| `/device/agents` | 设备监控、模型和资源状态 |
| `/device/traffic` | 流量监控 |
| `/caller` | API Key 和调用配置 |
| `/admin/users` | 系统用户 |

## 数据流

```text
Web/curl --HTTPS--> Cloud --SQL--> PostgreSQL
                       |
                       +-- WSS --> Agent --HTTP--> 本地 OpenAI 兼容模型服务
```

Cloud 按 API Key 绑定的 `group_id` 过滤 ready 模型实例并负责并发占用、超时、取消和断线清理。Agent 不感知分组，Web 不直连 Agent。
