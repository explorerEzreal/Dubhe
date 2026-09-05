# Cloud

平台的核心控制面与数据面，也是唯一访问 PostgreSQL 的服务。

## 职责

- 用户认证与会话、部署令牌、Agent 凭证、API Key。
- Agent WSS 连接、在线状态与模型实例状态。
- API Key 摘要、模型权限、限流与鉴权。
- 模型路由、活跃请求管理与并发控制。
- Agent 请求转发、SSE 流式输出、超时与取消。
- 请求元数据、用量摘要与审计日志。
- 管理 API、健康检查、结构化日志与数据库迁移。

## 非职责

- 不直接安装或控制部署者机器上的 Ollama。
- 不保存请求/响应正文（默认）。
- 不向 Web 或 Agent 暴露数据库凭证。

## 目录结构

```text
src/
├── main.ts            # Fastify 启动入口
├── config/            # 环境变量加载与校验
├── bootstrap/         # 依赖装配与生命周期
├── domain/            # 实体、状态机、错误码、权限规则（无框架依赖）
├── application/       # 用例编排
├── infrastructure/    # database / websocket / security / routing / logging
└── interfaces/        # http 路由、websocket 适配
```

依赖方向：`interfaces -> application -> domain <- infrastructure`。`domain` 不依赖 Fastify 或 PostgreSQL 实现。

## 运行

```bash
pnpm install
pnpm db:migrate
pnpm db:seed-admin
pnpm dev
```

## 环境变量

见 `.env.example`。所有域名、数据库和密钥通过环境注入，不写死官方值。

Agent WSS 默认要求 TLS。由可信反向代理终止 TLS 时启用 `TRUST_PROXY=true`，且不得将 Cloud 内部端口直接暴露公网。

## 数据访问边界

只有 Cloud 访问 PostgreSQL。Web 通过 HTTPS API、Agent 通过 WSS 与 Cloud 通信。
