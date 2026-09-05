# Cloud 架构设计

## 分层

```text
interfaces (HTTP 路由、WSS 适配)
        |
        v
application (用例编排)
        |
   +----+----+
   |         |
   v         v
domain    infrastructure
```

- `domain`：用户、Agent、模型、API Key、推理请求实体与状态机，禁止依赖框架和数据库。
- `application`：认证、注册、路由、推理、用量等用例。
- `infrastructure`：PostgreSQL Repository、WSS 连接注册表、安全工具、路由器和日志。
- `interfaces`：Fastify 路由与 WebSocket 消息适配。

`bootstrap/build-app.ts` 只创建依赖并注册接口。HTTP/WSS Handler 不执行 SQL；跨表写入由 PostgreSQL Repository 在事务中完成。

## 数据访问

`infrastructure/database` 是唯一访问 PostgreSQL 的位置。运行时连接状态（当前 WSS、活跃请求、心跳）保存在内存；持久化状态写入 PostgreSQL。

## 请求生命周期

```text
Caller HTTPS
  -> 校验 API Key 与模型权限
  -> 选择在线且 ready 的实例（最少活跃请求数）
  -> 创建 request_id 并下发 infer_request
  -> 非流式等待 infer_done；流式转发 infer_chunk 为 SSE
  -> 写入请求元数据与 usage
```

无可用实例时返回 `503`，错误码为 `MODEL_OFFLINE` / `MODEL_NOT_READY` / `AGENT_BUSY`。

## 约束

- 日志不包含完整 API Key、部署令牌、设备凭证或请求正文。
- HTTP 与 WSS 入参使用 Zod 严格校验，未知字段和超限载荷直接拒绝。
- 运行时内存不持久化 WebSocket 对象到数据库。
- 第一版单实例；后续多实例时再引入 Redis 或消息总线协调连接归属。
