# Bubhe 天枢 — 项目架构速查

> ⚠️ 每次项目更新（新增路由、表、服务、页面）必须同步修改本文档，减少 AI 重复理解成本。

---

## 1. 工程职责

| 工程 | 一句话 |
| --- | --- |
| **cloud** | Fastify 服务端，认证/设备/Key/推理/WSS 控制面，唯一直接访问 PostgreSQL |
| **agent** | Node.js 本地常驻，出站 WSS 连接 Cloud，转发推理请求 |
| **web** | React SPA，仅通过 HTTPS 调用 Cloud API，不直连数据库或 Agent |

## 2. Cloud 目录骨架

```
src/
  main.ts                       # 入口
  config/config.ts              # 环境变量 Zod 校验 + CloudConfig 类型
  bootstrap/build-app.ts        # 组装依赖、注册路由、启动监听
  domain/                       # 纯数据模型 + 错误定义
    common/application-error.ts # ApplicationError + errors 工厂
    agents/agent-status.ts
    api-keys/api-key.ts
    models/model-instance-state.ts
    inference/inference-request.ts
    users/user.ts
  application/
    ports.ts                    # 全部 Repository / Service 接口
    rate-limit.ts               # SlidingWindowRateLimiter
    services/                   # 业务服务（只依赖 ports 接口）
      auth-service.ts
      agent-service.ts
      api-key-service.ts
      catalog-service.ts
      enrollment-service.ts
      inference-service.ts
  infrastructure/
    database/
      index.ts                  # createDatabase (Pool)
      migrator.ts               # 按 0001-000N 顺序执行 SQL
      repositories/             # Pg*Repository 实现
        user-session-repository.ts
        agent-repository.ts
        api-key-repository.ts
        catalog-repository.ts
        enrollment-token-repository.ts
        audit-repository.ts
        inference-repository.ts
    websocket/
      index.ts                  # WS 升级处理
      connection-registry.ts    # InMemoryConnectionRegistry
      heartbeat-monitor.ts      # AgentHeartbeatMonitor
    security/                   # HmacSecurityService
    logging/
    routing/
  interfaces/
    http/                       # Fastify 路由
      auth-routes.ts
      management-routes.ts      # /api/agents /api/keys /api/models /api/enrollment-tokens
      inference-routes.ts       # /v1/chat/completions /v1/models /v1/responses
      health-routes.ts
      download-routes.ts
      schemas.ts                # Zod 请求体验证
      types.ts                  # HttpServices 接口
      http-errors.ts            # bearer / sendError / sendRateLimit
    websocket/
      index.ts                  # Agent WSS 路由注册
      schemas.ts                # WSS 消息 Zod schema
      agent-routes.ts
test/
  unit/                         # 单元测试
  integration/                  # 集成测试
  postgres/                     # 迁移测试
migrations/                     # SQL 迁移文件
```

## 3. Agent 目录骨架

```
src/
  main.ts
  config/config.ts
  domain/
    agent-state.ts
    model-state.ts
    inference-request.ts
    errors.ts
  application/
    agent-runtime.ts            # 主循环
    connection-service.ts       # WSS 连接管理
    inference-service.ts        # 本地推理转发
    model-service.ts            # 模型状态管理
    metrics-service.ts          # 资源指标收集
    registration-service.ts     # 自动注册逻辑
    service-manager.ts          # 服务生命周期编排
  infrastructure/
    backends/                   # 模型后端适配器
    cloud/                      # Cloud WSS 协议实现
    credentials/                # 凭证持久化
    logging/
    openai/                     # OpenAI 兼容本地服务客户端
    system/                     # systemd/launchd 服务管理
  interfaces/
    websocket/                  # WSS 消息收发
      message-sender.ts
      schemas.ts
    inference/                  # OpenAI 兼容本地 HTTP 服务
  cli/index.ts                  # CLI 入口
```

## 4. Web 目录骨架

```
src/
  main.tsx
  config/config.ts
  app/
    router.tsx                  # React Router 路由定义
    providers.tsx               # Theme / Antd Provider
  components/
    AppShell.tsx                # 侧栏布局 + 用户面板
    app-shell-config.ts         # 菜单分组配置
    AuthGate.tsx
    AccountSecurityModal.tsx
    StateView.tsx
  pages/
    login/, register/
    caller-dashboard/           # CallerDashboardPage + components
    deployer-dashboard/         # DeployerDashboardPage + components
    system-users/               # SystemUsersPage
    not-found/
  api/                          # Cloud API 客户端
    client.ts                   # axios 实例 + 401 拦截退出
    agent-api.ts
    auth-api.ts
    key-api.ts
    model-api.ts
    enrollment-api.ts
    usage-api.ts
    user-api.ts
  state/index.ts                # Zustand 状态
  hooks/useAsyncList.ts         # ahooks useRequest 封装
  types/
  constants/
  utils/
```

## 5. HTTP API 路由表

> 认证标记：🔑= Bearer Session Token, 🔐= Bearer API Key

### 认证（auth-routes.ts）

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | — | 注册 |
| POST | `/api/auth/login` | — | 登录 |
| POST | `/api/auth/logout` | 🔑 | 登出 |

### 管理（management-routes.ts）

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/me` | 🔑 | 当前用户 |
| PATCH | `/api/me/profile` | 🔑 | 更新资料 |
| PATCH | `/api/me/password` | 🔑 | 改密码 |
| GET | `/api/admin/users` | 🔑 admin | 用户列表 |
| PATCH | `/api/admin/users/:id/password` | 🔑 admin | 改他人密码 |
| DELETE | `/api/admin/users/:id` | 🔑 admin | 删除用户 |
| POST | `/api/enrollment-tokens` | 🔑 | 生成部署令牌 |
| GET | `/api/agents` | 🔑 | 设备列表 |
| GET | `/api/agents/:id` | 🔑 | 设备详情 |
| POST | `/api/agents/:id/credentials/rotate` | 🔑 | 轮换凭证 |
| POST | `/api/agents/:id/credentials/revoke` | 🔑 | 撤销设备 |
| GET | `/api/models` | 🔑 | 全局模型目录 |
| GET | `/api/usage` | 🔑 | 用量摘要 |
| GET | `/api/keys` | 🔑 | API Key 列表 |
| POST | `/api/keys` | 🔑 | 创建 API Key（绑定渠道） |
| POST | `/api/keys/:id/disable` | 🔑 | 禁用 Key |
| DELETE | `/api/keys/:id` | 🔑 | 删除 Key |
| POST | `/api/groups` | 🔑 | 创建分组 |
| GET | `/api/groups` | 🔑 | 我的分组列表 |
| GET | `/api/groups/:id` | 🔑 | 分组详情（含设备和模型） |
| PATCH | `/api/groups/:id` | 🔑 | 编辑分组 |
| DELETE | `/api/groups/:id` | 🔑 | 删除分组（关联 Key 时拒绝） |
| POST | `/api/groups/:id/agents` | 🔑 | 添加设备到分组 |
| DELETE | `/api/groups/:id/agents/:agentId` | 🔑 | 从分组移除设备 |
| POST | `/api/groups/:id/invite-tokens` | 🔑 | 生成邀请码 |
| GET | `/api/channels` | 🔑 | 我的渠道列表 |
| POST | `/api/channels` | 🔑 | 通过邀请码添加渠道 |
| GET | `/api/channels/models` | 🔑 | 模型广场（按渠道分组） |
| DELETE | `/api/channels/:id` | 🔑 | 移除渠道 |

### 推理（inference-routes.ts）

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/v1/models` | 🔐 | 可用模型列表 |
| POST | `/v1/chat/completions` | 🔐 | Chat 推理 |
| POST | `/v1/responses` | 🔐 | Responses API |

## 6. WSS Agent 协议

> Cloud 监听一个 WebSocket 路径（`AGENT_WS_PATH`），Agent 出站连接。

| 方向 | 消息 type | 说明 |
|------|-----------|------|
| Agent → Cloud | `register` | 注册（携带 enrollment token） |
| Cloud → Agent | `registered` | 注册成功，返回 credential |
| Agent → Cloud | `heartbeat` | 心跳 + 模型状态同步 |
| Cloud → Agent | `heartbeat_ack` | 心跳确认 |
| Cloud → Agent | `infer_request` | 推理请求 |
| Agent → Cloud | `infer_chunk` | 流式 chunk |
| Agent → Cloud | `infer_done` | 推理结束 |
| Agent → Cloud | `infer_error` | 推理错误 |
| Cloud → Agent | `infer_cancel` | 取消推理 |

## 7. 数据库核心表

| 表 | 作用 | 关键外键 |
|-----|------|---------|
| `users` | 用户 | — |
| `sessions` | Web 会话 | user_id |
| `enrollment_tokens` | 部署注册令牌 | user_id |
| `agents` | Agent 设备 | user_id |
| `agent_credentials` | Agent 凭证 | agent_id, replaced_by |
| `models` | 全局模型注册表 | — |
| `model_instances` | Agent 上模型运行时 | agent_id, model_id |
| `groups` | 部署者分组 | user_id |
| `group_agents` | 分组 ↔ Agent 多对多 | group_id, agent_id |
| `user_group_access` | 用户渠道（调用者视角） | user_id, group_id |
| `api_keys` | API 密钥（绑定 group_id） | user_id, group_id |
| `inference_requests` | 推理请求记录 | user_id, api_key_id, agent_id, model_id |
| `audit_logs` | 审计日志 | — |

## 8. Web 前端路由

| 路径 | 页面组件 | 菜单分组 |
|------|---------|---------|
| `/deployer` | DeployerDashboardPage | 设备 > 设备管理 |
| `/caller` | CallerDashboardPage | 调用 > API 密钥 |
| `/admin/users` | SystemUsersPage | 管理员 > 系统用户 |
| `/login` | LoginPage | — |
| `/register` | RegisterPage | — |

## 9. 数据流简图

```
用户 (Web/curl)
  │ HTTPS
  ▼
Cloud (Fastify)
  ├─ HTTP → AuthService → UserRepository / SessionRepository
  ├─ HTTP → GroupService → GroupRepository (分组/渠道管理)
  ├─ HTTP → ApiKeyService → ApiKeyRepository (密钥绑定渠道)
  ├─ HTTP → AgentService → AgentRepository
  ├─ HTTP → InferenceService → ConnectionRegistry → WSS → Agent
  │                              │
  │                       pg_inference_repository (按 group 过滤)
  └─ WSS ← Agent (出站连接)
       ├─ register / heartbeat (Agent 无感知分组)
       └─ infer_chunk / infer_done / infer_error

Agent (Node.js)
  ├─ WSS → Cloud (出站)
  └─ HTTP → 本地 OpenAI 兼容服务 (ollama/vllm 等)
```
