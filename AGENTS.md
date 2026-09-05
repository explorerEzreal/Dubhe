# 本地大模型部署与共享平台：核心链路 MVP 需求文档

**版本**：2.0 MVP  
**日期**：2026-09-04  
**状态**：开发基线

---

## 1. 文档目的

本文档定义本地大模型部署与共享平台第一版的产品范围、系统边界、接口协议、部署方式和验收标准，作为 `agent`、`cloud`、`web` 三个独立工程的共同开发基线。

第一版不追求完整的平台化能力，而是验证一条稳定、可复用、可私有化部署的核心链路：

1. 不熟悉计算机操作的部署者可以通过 Web 引导和一条安装命令接入本地算力。
2. Agent 可以稳定管理本地 Ollama 模型并保持与 Cloud 的连接。
3. Cloud 可以可靠完成模型路由、请求转发和流式响应。
4. 调用者可以通过接近 OpenAI Chat Completions 的 API 稳定调用模型。
5. 同一套工程可以通过更换服务器、域名和配置，部署为客户自己的平台。

---

## 2. 产品定位

平台连接两类用户：

- **部署者**：拥有 GPU 或高性能 CPU，希望以较低操作门槛共享本地模型能力。
- **调用者**：希望通过标准 API 调用平台上的模型。

平台提供两种运行形态：

### 2.1 官方托管

```text
部署者 Agent -> 官方 Cloud -> 官方 PostgreSQL
调用者 Web/API -> 官方 Cloud
```

### 2.2 客户私有化部署

```text
部署者 Agent -> 客户 Cloud -> 客户 PostgreSQL
调用者 Web/API -> 客户 Cloud
```

官方托管和私有化部署使用相同的 Agent、Cloud、Web 工程以及相同的 Agent-Cloud 协议。二者主要通过服务器、域名、数据库连接和密钥配置区分，不通过修改业务源码区分。

---

## 3. MVP 范围

### 3.1 第一版必须实现

- Web 注册、登录和会话管理。
- 部署者通过 Web 添加设备并生成一次性部署令牌。
- Agent 注册并换取可撤销的设备凭证。
- Agent 检测本地 Ollama，管理模型拉取并同步模型状态。
- Agent 通过出站 WSS 连接 Cloud，支持心跳、断线重连和状态重同步。
- Cloud 在单实例内管理多个 Agent 和多个模型实例。
- 基于模型、在线状态和活跃请求数完成基础路由。
- API Key 创建、一次性明文展示、禁用、删除和模型权限控制。
- `POST /v1/chat/completions` 和 `GET /v1/models`。
- Chat Completions 非流式 JSON 和流式 SSE 响应。
- 请求超时、调用者取消、Agent 断开和 Ollama 错误处理。
- Web 展示设备、模型 ready 状态、当前资源快照和基础调用统计。
- PostgreSQL 持久化业务数据；Cloud 是唯一的数据库访问者。
- Docker Compose 单机部署、健康检查、数据库迁移和一键验收脚本。

### 3.2 第一版不实现

- vLLM、llama.cpp 或其他推理引擎适配。
- AMD、Windows、macOS 的正式兼容承诺。
- 计费、支付、收益结算和模型市场。
- 模型上传、自定义模型仓库和联邦学习。
- 独立 Relay 集群、跨节点路由、消息队列和 Kubernetes 高可用。
- 完整历史时序监控、复杂告警和远程升级。
- 完整 OpenAI API 覆盖，例如 Embeddings、Images、Assistants 等。
- 默认保存请求或响应正文。
- 找回密码、企业 SSO 和复杂 RBAC；邮箱和企业能力后续增加。

---

## 4. 用户核心流程

### 4.1 部署者流程

部署者不需要理解 WebSocket、数据库、API Key 或推理引擎内部细节：

1. 注册或登录 Web。
2. 点击“添加设备”。
3. 选择要共享的模型，或填写模型名称。
4. Web 生成短期、一次性的部署令牌和安装命令。
5. 部署者在本地执行安装命令，或启动 Agent 容器。
6. Agent 自动检测 Ollama、注册设备并报告硬件信息。
7. Agent 自动检查或拉取指定模型。
8. Web 显示设备在线和模型 `ready`。
9. 部署者可以启用、暂停或停止模型共享。

安装命令不应要求部署者手工填写数据库、WSS 协议或复杂配置。生产安装包需要具备版本和校验值，部署令牌注册成功后立即失效。

### 4.2 调用者流程

1. 注册或登录 Web。
2. 查看可用模型及在线状态。
3. 创建 API Key 并选择模型权限。
4. 复制 curl 或 OpenAI SDK 示例。
5. 调用非流式或流式 Chat Completions。
6. 查看调用次数、错误率、延迟和最近请求状态。

### 4.3 私有化部署流程

客户管理员在新服务器上：

1. 配置域名、TLS、数据库连接和平台密钥。
2. 使用 Docker Compose 启动 Web、Cloud、PostgreSQL 和反向代理。
3. 执行数据库迁移和首个管理员初始化。
4. 通过客户自己的 Cloud 地址生成 Agent 安装命令。
5. 部署者 Agent 配置客户 Cloud URL 后接入客户平台。

客户不应为了更换平台归属而修改 Agent 或 Web 业务代码。

---

## 5. 三个独立工程

项目由三个独立构建、测试、发布和部署的工程组成：

```text
agent
cloud
web
```

三个工程共享版本化的 API 和 WSS 协议规范，不共享数据库表和内部实现。协议至少携带 `protocol_version`，协议不兼容时必须明确拒绝并记录原因。

### 5.1 Agent

Agent 只负责部署者机器侧：

- 保存 Cloud URL、Agent ID、设备凭证和本地模型配置。
- 建立并维护出站 WSS 长连接。
- 首次使用部署令牌注册设备并换取设备凭证。
- 进行心跳、指数退避重连和重连后的状态同步。
- 检查 Ollama 健康状态。
- 拉取、查询和管理 Ollama 模型。
- 接收推理任务，调用本机 Ollama HTTP API。
- 按 `request_id` 转发流式 chunk、完成、错误和取消。
- 执行本地并发限制、超时和任务清理。
- 采集 CPU、内存、GPU 可用信息和最小运行状态。
- 输出脱敏日志并支持自动重启。

Agent 不负责：

- 用户注册、登录和 API Key 管理。
- 调用者鉴权、模型权限判断和计费。
- 直接接收公网调用者请求。
- 访问 PostgreSQL。
- 执行由请求内容拼接出的 shell 命令或任意本地代码。

Agent 不要求终端用户安装 Node.js。开发和容器运行使用 Node.js，正式交付应逐步提供 Linux 独立可执行包或安装器。

### 5.2 Cloud

Cloud 是平台的唯一数据访问层和核心中转层：

- 用户认证和会话。
- 部署令牌、Agent 注册和设备凭证。
- Agent WSS 连接、在线状态和模型实例状态。
- API Key 摘要、模型权限、限流和鉴权。
- 模型路由、活跃请求管理和并发控制。
- Agent 请求转发、SSE 流式输出、超时和取消。
- 请求元数据、用量摘要和审计日志。
- 管理 API、健康检查和结构化日志。
- 数据库迁移、配置校验和私有化部署支持。

Cloud 不直接安装或控制部署者机器上的 Ollama，只能通过明确的 Agent 协议请求模型操作和推理。

### 5.3 Web

Web 是面向部署者、调用者和管理员的浏览器控制台：

- 注册、登录和会话管理。
- 部署者添加设备、生成安装命令和查看安装状态。
- Agent 在线状态、模型拉取状态和最近错误。
- 模型启用、暂停和并发配置。
- CPU、内存、GPU 当前快照。
- 调用者模型目录、API Key 管理和 API 示例。
- 调用次数、错误率和延迟摘要。

Web 只访问 Cloud API，不直接访问 PostgreSQL、Agent 或 Ollama，也不包含数据库凭证、JWT 签名密钥或 API Key 哈希。

---

## 6. 总体架构和数据访问边界

```text
                    +------------------+
                    |       Web        |
                    | React + TypeScript|
                    +---------+--------+
                              | HTTPS
                              v
                    +------------------+
                    |      Cloud       |
                    | Node.js + Fastify|
                    | Auth / Router    |
                    | WSS / API / Usage|
                    +------+-------+---+
                           |       |
                         WSS       | SQL
                           |       v
                           |  +----------+
                           |  |PostgreSQL|
                           |  +----------+
                           v
                    +------------------+
                    |      Agent       |
                    | Node.js + TS     |
                    +---------+--------+
                              | localhost HTTP
                              v
                         +---------+
                         | Ollama  |
                         +---------+
```

数据库访问边界必须固定为：

```text
Web -> HTTPS -> Cloud -> PostgreSQL
Agent -> WSS -> Cloud -> PostgreSQL
Caller -> HTTPS -> Cloud -> PostgreSQL
```

只有 Cloud 持有 PostgreSQL 连接信息。Agent 和 Web 不知道数据库地址、账号、密码或表结构。

Cloud 内部采用以下分层：

```text
HTTP/WSS Handler
      -> Application Service
      -> Repository
      -> PostgreSQL
```

当前 WebSocket 连接、活跃请求、发送队列、短期心跳和路由表保存在 Cloud 运行时内存中。PostgreSQL 保存持久化业务数据和最后状态快照，不保存 WebSocket 对象。

第一版不依赖 Redis、时序数据库或消息队列；后续增加多 Cloud 实例时，再引入 Redis、内部 RPC 或消息系统协调连接归属。

---

## 7. Agent 状态和模型状态

### 7.1 Agent 状态

```text
created
connecting
online
degraded
offline
revoked
```

- `online`：连接有效且最近心跳正常。
- `degraded`：连接存在，但 Ollama 或部分模型不可用。
- `offline`：连接关闭或心跳超时。
- `revoked`：设备凭证被撤销，不得继续注册。

### 7.2 模型实例状态

```text
unknown
checking
pulling
ready
busy
error
stopped
offline
```

只有 `ready` 的模型实例可以接受推理请求。模型定义和模型实例必须分离：模型定义表示 `llama3:8b`，模型实例表示某个 Agent 上运行的具体实例。

### 7.3 推理请求状态

```text
accepted
routed
running
streaming
completed
failed
cancelled
timeout
agent_disconnected
```

每个请求使用唯一 `request_id`。Cloud 必须在请求结束、失败、取消、超时或 Agent 断开时释放路由占用和活跃请求记录。

---

## 8. Agent 与 Cloud 的 WSS 协议

Agent 只主动建立出站 WSS 连接，部署者不需要开放公网端口。

所有消息包含：

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

### 8.1 消息类型

- `register` / `registered`：使用部署令牌注册并换取设备凭证。
- `heartbeat` / `heartbeat_ack`：发送设备、模型、资源和请求状态。
- `infer_request`：Cloud 下发模型和推理参数。
- `infer_chunk`：Agent 返回有序的文本增量和可选 usage。
- `infer_done`：Agent 表示请求完成。
- `infer_error`：Agent 返回稳定错误码和安全错误信息。
- `infer_cancel`：Cloud 请求 Agent 取消任务。

### 8.2 可靠性规则

- Agent 默认每 15 秒发送心跳；Cloud 在连续 2 个心跳周期未收到消息后标记离线。
- 重连采用指数退避，初始间隔 1 秒，最大间隔 5 分钟，并加入随机抖动。
- 重连成功后 Agent 必须重新同步模型和请求能力状态。
- Cloud 断开连接后，旧请求统一进入 `agent_disconnected`，不得继续占用路由。
- 每个流式 chunk 带单调递增序号，Cloud 检查顺序。
- 请求超时、调用者断开或服务关闭时，Cloud 尽力发送 `infer_cancel`。
- 单个 Agent 的最大并发数、队列长度、请求体大小、输出长度和超时时间可配置。
- 重复 `request_id` 不得产生重复任务。
- Ollama 不可用或模型未 ready 时，Agent 保持连接但不上报可路由状态。

---

## 9. 请求路由与流式转发

Cloud 接收到调用者请求后按以下顺序处理：

1. 解析并校验 Bearer API Key。
2. 校验 Key 状态、有效期和模型权限。
3. 校验请求体、模型名、超时、输出长度和 `stream` 参数。
4. 查找在线、心跳未超时、模型为 `ready` 且未达到并发上限的实例。
5. 选择活跃请求数最少的实例；平局时选择最近使用时间最早的实例。
6. 创建 `request_id` 和请求记录。
7. 通过 WSS 发送 `infer_request`。
8. 非流式请求等待 `infer_done` 后返回 JSON。
9. 流式请求将 `infer_chunk` 转为 OpenAI 风格 SSE，并以 `data: [DONE]` 结束。
10. 请求结束后写入状态、延迟和 usage 元数据。

无法找到可用实例时返回：

```http
503 Service Unavailable
```

错误码为 `MODEL_OFFLINE`、`MODEL_NOT_READY` 或 `AGENT_BUSY`，不得返回内部连接对象、数据库错误或部署者敏感信息。

---

## 10. 对外 API

### 10.1 调用 API

```text
POST /v1/chat/completions
GET  /v1/models
```

必须使用：

```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

第一版支持常用字段：

- `model`
- `messages`
- `stream`
- `temperature`
- `top_p`
- `max_tokens`
- `stop`
- `presence_penalty`
- `frequency_penalty`

支持非流式 JSON 和流式 `text/event-stream`，不承诺完整覆盖 OpenAI API。

统一错误格式：

```json
{
  "error": {
    "message": "No available agent for model",
    "type": "service_unavailable",
    "code": "MODEL_OFFLINE"
  }
}
```

### 10.2 管理 API

```text
POST /api/auth/register
POST /api/auth/login
POST /api/enrollment-tokens
POST /api/keys
GET  /api/keys
POST /api/keys/{id}/disable
DELETE /api/keys/{id}
GET  /api/agents
GET  /api/agents/{id}
GET  /api/models
GET  /api/usage
GET  /healthz
GET  /readyz
```

API Key 关联模型使用独立权限记录表达，不把模型权限直接信任为客户端传入的字符串或前端状态。

---

## 11. 凭证与安全

### 11.1 用户和 API Key

- 用户密码使用 Argon2id 或 bcrypt。
- 管理 API 使用短期 JWT 或安全会话机制。
- API Key 使用带前缀格式，例如 `dsh_live_...`。
- 数据库保存 Key ID、prefix、HMAC-SHA256 摘要、状态、过期时间和最后使用时间。
- 完整 API Key 只在创建成功时显示一次。
- 禁用 Key 必须立即阻止后续调用，缓存不能延长其有效期。

### 11.2 Agent 凭证

- 部署令牌短期、一次性、可撤销。
- 注册成功后，Agent 使用设备凭证进行后续连接。
- 设备凭证支持撤销和轮换。
- 用户删除 Agent 后，Cloud 必须关闭现有连接并拒绝旧凭证。
- Agent 强制验证 Cloud TLS 证书，不允许关闭证书校验。

### 11.3 数据和日志

- Ollama 只监听本地地址，不暴露公网。
- 请求和响应正文默认不落盘。
- 日志不得包含完整 API Key、部署令牌、设备凭证、请求正文或响应正文。
- 请求日志只保存 request ID、用户、Key、模型、Agent、状态码、延迟和可选 usage。
- 所有创建 Key、删除 Agent、禁用凭证等管理动作写入审计日志。
- 对请求体大小、输出长度、并发数、速率和超时做限制。
- Cloud 传给 Agent 的数据只能作为受校验的推理参数使用，不得转换为 shell 命令或任意本地路径。

---

## 12. 数据模型

PostgreSQL 由 Cloud 独占访问，第一版至少包含：

- `users`：用户和密码哈希。
- `sessions`：管理会话或刷新令牌。
- `enrollment_tokens`：短期一次性部署令牌。
- `agents`：Agent 所属用户、设备信息和最后状态快照。
- `agent_credentials`：设备凭证摘要、状态和轮换信息。
- `models`：平台模型定义和引擎名称。
- `model_instances`：Agent 上的具体模型实例、状态和并发配置。
- `api_keys`：Key 元数据、prefix、摘要和状态。
- `api_key_model_permissions`：Key 与模型的授权关系。
- `inference_requests`：请求状态、延迟、错误码和 usage 元数据。
- `audit_logs`：管理操作审计记录。

不保存 WebSocket 连接对象，不把 Agent 作为数据库直连客户端，不把完整 API Key 或默认密码写入数据库。

---

## 13. 自部署和私有化部署

### 13.1 部署要求

第一版提供 Docker Compose 部署包：

```text
web + cloud + postgres + reverse-proxy
```

客户可以将所有组件部署在一台服务器，也可以将 Web、Cloud 和 PostgreSQL 分离。PostgreSQL 不暴露公网，只允许 Cloud 访问。

### 13.2 配置项

Cloud 至少支持以下环境变量或 Docker Secret：

```env
DATABASE_URL=postgres://...
JWT_SECRET=...
API_KEY_PEPPER=...
PUBLIC_BASE_URL=https://api.customer.com
WEB_BASE_URL=https://console.customer.com
CORS_ORIGINS=https://console.customer.com
AGENT_DOWNLOAD_URL=https://api.customer.com/downloads/agent
```

SMTP、计费服务、官方模型目录和外部监控均为可选依赖，不应阻塞 Cloud 启动或核心推理链路。

Web 通过构建时或运行时配置指定：

```env
VITE_API_BASE_URL=https://api.customer.com
```

Agent 通过配置指定：

```yaml
cloud:
  url: wss://api.customer.com/agent
```

### 13.3 自部署必备能力

- 自动初始化和数据库迁移。
- 首个管理员初始化命令。
- 客户自有域名和 TLS/WSS。
- 数据备份、恢复和版本升级说明。
- 独立生成客户自己的 JWT 密钥和 API Key pepper。
- 无官方计费、OAuth 或模型目录服务时正常运行。
- 官方平台与客户私有平台默认不共享请求内容、API Key 和业务数据。
- Agent 连接的 Cloud 地址可配置，不能写死官方域名。

私有化部署的目标是：客户主要通过更换服务器、域名、数据库连接和密钥配置完成部署，不修改 Agent、Cloud、Web 的业务源码。

---

## 14. 推荐技术栈

### 14.1 Agent

- Node.js 22+
- TypeScript
- WebSocket 客户端
- 原生 `fetch` 或 Undici
- `systeminformation` 或平台适配方式采集资源指标
- Docker 开发和验证
- 后续提供 Linux 独立可执行包和安装器

### 14.2 Cloud

- Node.js 22+
- TypeScript
- Fastify
- WebSocket
- Zod
- PostgreSQL
- Kysely 或 Drizzle
- Pino
- Vitest
- Docker Compose

### 14.3 Web

- React
- TypeScript
- Vite
- 现有稳定 UI 组件库
- Playwright
- 通过 Cloud API 获取所有数据

第一版不引入 Redis、InfluxDB、TimescaleDB、Kafka、NATS 或 Kubernetes。代码可以为后续增加这些组件保留接口，但核心链路必须在单 Cloud + PostgreSQL 环境独立运行。

---

## 15. 测试要求

### 15.1 Agent 单元测试

- WSS 注册和协议编解码。
- 心跳发送、超时和指数退避重连。
- 断线后的状态重同步。
- Ollama 可用、不可用和模型不存在。
- 模型拉取成功和失败。
- 流式 chunk 转发和顺序检查。
- 请求取消、超时和并发限制。
- 本地凭证读写和日志脱敏。

### 15.2 Cloud 单元和集成测试

- 用户、部署令牌和 API Key 校验。
- Key 禁用和模型权限。
- Agent 注册、在线状态和心跳过期。
- 最少活跃请求数路由。
- 非流式和流式请求桥接。
- 调用者断开、Agent 断开、超时和取消。
- 活跃请求释放和重复 request ID 处理。
- 数据库迁移和自部署配置校验。

### 15.3 端到端测试

使用 Docker Compose 启动 Cloud、PostgreSQL、Ollama 和 Web，验证：

```text
Web 注册
 -> 生成部署令牌
 -> Agent 注册
 -> Ollama 模型 ready
 -> Web 创建 API Key
 -> curl 非流式调用
 -> curl/OpenAI SDK 流式调用
 -> Agent 断网返回 503
 -> Agent 恢复并自动重连
 -> 调用恢复
```

同时验证 Ollama 重启、调用者中途取消、Key 禁用、模型离线、数据库重启和 Cloud 重启场景。

---

## 16. 验收标准

1. 部署者通过 Web 获得一次性令牌和安装命令，无需配置数据库或公网端口即可注册 Agent。
2. Agent 注册成功后，Web 显示设备在线、Ollama 状态和模型状态。
3. 模型为 `ready` 后，调用者可以使用 curl 和 OpenAI SDK 完成非流式调用。
4. 流式调用可以持续返回 OpenAI 风格 SSE，并正确发送 `[DONE]`。
5. 没有可用模型实例时，API 返回 `503` 及 `MODEL_OFFLINE`、`MODEL_NOT_READY` 或 `AGENT_BUSY`。
6. Agent 断网后 Cloud 在心跳超时窗口内停止路由；网络恢复后 Agent 自动重连并重新同步。
7. Ollama 重启、Agent 断开、调用者取消和请求超时不会导致活跃任务永久泄漏或阻塞后续请求。
8. API Key 禁用后立即拒绝请求，数据库和日志中不存在完整 Key 明文。
9. Web 和 Agent 不持有 PostgreSQL 凭证，只有 Cloud 可以访问 PostgreSQL。
10. 客户通过修改服务器、域名、数据库连接和密钥配置即可启动一套独立平台，不修改三个工程的业务代码。
11. Docker Compose 可以完成全新环境启动、数据库迁移、管理员初始化和核心链路验收。
12. 在目标测试环境中维持至少 1000 条 Agent WSS 连接 24 小时，心跳和请求处理无异常，并记录中继处理延迟。

---

## 17. 实施顺序

1. 建立 `agent`、`cloud`、`web` 三个独立工程和版本化协议文档。
2. 实现 Cloud 配置、PostgreSQL 迁移、健康检查和 Docker Compose。
3. 实现 Web 注册、登录、添加设备和一次性部署令牌。
4. 实现 Agent 注册、凭证保存、心跳、重连和 Ollama 状态同步。
5. 实现 API Key、模型权限、模型目录和基础路由。
6. 实现 Cloud 到 Agent 的非流式推理链路。
7. 实现流式 SSE、取消、超时、错误映射和连接清理。
8. 实现部署者引导页面、调用者控制台和基础监控。
9. 完成真实 Ollama、断网恢复、服务重启和并发稳定性测试。
10. 使用同一套镜像和代码验证官方托管模拟环境与客户私有化部署环境。

只有核心链路稳定后，才进入 Redis、独立 Relay、多 Cloud 节点、历史时序监控、多引擎适配、远程升级、计费和模型市场等后续阶段。

---

## 18. 后续扩展方向

- Agent 独立安装器、桌面化安装和跨平台支持。
- vLLM、llama.cpp 等推理引擎适配器。
- Redis 或消息总线支持多 Cloud 节点。
- Prometheus、TimescaleDB 或其他历史监控方案。
- 企业 SSO、RBAC、审计导出和私有镜像仓库。
- 计费、收益结算和模型市场。
- 客户自定义 Cloud 中转节点、区域路由和离线部署。

这些扩展不得破坏第一版定义的三个工程边界、Cloud 独占数据库访问原则和 Agent-Cloud 协议兼容性。

---

## AI 检索与执行约定

- `agent`、`cloud`、`web` 是三个独立工程；修改一个工程时不得绕过其边界直接访问另一工程的数据库或内部实现。
- 工程级上下文见 `agent/AGENTS.md`、`cloud/AGENTS.md`、`web/AGENTS.md`；实施状态见 `IMPLEMENTATION_PROGRESS.md`。
- 当前统一使用仓库已有 `pnpm-lock.yaml` 和 `pnpm` 脚本，不主动新增依赖，不生成新的锁文件。
- 跨工程消息必须同步检查 `contracts/agent-messages.schema.json`、`agent/protocol/agent-messages.schema.json` 和 `cloud/protocol/agent-messages.schema.json`。
- Cloud 是 PostgreSQL 唯一访问者；Web 和 Agent 不得持有数据库连接信息。
- 修改后按影响范围运行 `pnpm test`、`pnpm build`、`pnpm lint` 和 `pnpm contracts:check`，并把命令结果写入 `IMPLEMENTATION_PROGRESS.md`。
