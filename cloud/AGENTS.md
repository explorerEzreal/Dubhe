# Cloud 工程上下文

## 职责

Cloud 是唯一的 PostgreSQL 访问者，负责认证、部署令牌、Agent WSS、模型路由、推理中转、用量和审计。

## 非职责

不直接控制部署者机器上的 Ollama，不把数据库凭证暴露给 Web 或 Agent，不持久化 WebSocket 对象和请求正文。

## 关键目录

- `src/domain`：领域状态、错误码和实体。
- `src/application`：业务用例编排。
- `src/infrastructure`：数据库、安全、路由、WSS 和日志。
- `src/interfaces`：Fastify HTTP/WSS 适配。
- `migrations`、`scripts`：迁移和管理员初始化。
- `openapi`、`protocol`、`docs`：对外契约和部署说明。

## 命令

```bash
pnpm db:migrate
pnpm db:seed-admin
pnpm build
pnpm test
pnpm lint
```

## 约束

- 认证、API Key、部署令牌和设备凭证必须摘要化保存，明文只一次展示。
- API Key 使用 HMAC 摘要；密码使用 Argon2id；错误不得泄露内部信息。
- Agent 连接、活跃请求和心跳状态保存在运行时内存，业务元数据写 PostgreSQL。
- 推理只路由到在线且模型 `ready` 的实例；结束、取消、超时和断线必须释放占用。
- HTTP/WSS 入参使用明确类型和校验，避免在路由层扩散 `any`。
- 修改后运行 build、lint、test 和契约检查。

## 当前缺口

当前已完成非流式推理路由、Agent 桥接、请求超时和断线清理；流式 SSE、调用者取消和完整稳定性验收尚未完成。

进度入口：根目录 `IMPLEMENTATION_PROGRESS.md`。
