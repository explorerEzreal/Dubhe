# Bubhe 天枢仓库约束

## 边界与数据链路

- `cloud` 是唯一 PostgreSQL 访问者，负责认证、凭证、路由、推理中转、用量和审计。
- `agent` 只访问本地 OpenAI 兼容模型服务，并通过出站 WSS 连接 Cloud。
- `web` 只通过 HTTPS 调用 Cloud，不直连数据库、Agent 或本地模型服务。
- 固定链路：`Web -> HTTPS -> Cloud -> PostgreSQL`、`Agent -> WSS -> Cloud -> PostgreSQL`。

## 协议与安全红线

- Agent/Cloud 使用带 `protocol_version` 的 JSON/WSS 协议；源文件为 `contracts/agent-messages.schema.json`，Cloud 与 Agent 副本必须一致。
- Agent 连接必须支持心跳、重连、状态同步和凭证撤销；Cloud 只路由在线、心跳有效且模型为 `ready` 的实例。
- 请求使用唯一 `request_id`；流式 chunk 保序，结束、取消、超时、断线都要释放占用。
- 密码、Key、令牌、凭证只存摘要；强制 TLS/WSS，日志不得记录密钥、请求正文或响应正文。
- 域名、数据库连接、JWT 密钥和 pepper 通过环境变量或 Secret 注入；传给 Agent 的内容只能是校验后的推理参数。

## 开发约定

- 使用现有 `pnpm-lock.yaml` 和依赖，未经用户许可不安装依赖或生成锁文件。
- 文档、注释、提交信息使用中文；第三方 API 和协议字段保留英文。
- 异步操作必须处理异常，接口对用户统一提示“请求失败，请稍后重试”。
- 修改协议后解析三份 schema 并执行一致性比较；按影响范围运行验证。

## 常用命令

```bash
pnpm test
pnpm build
pnpm lint
pnpm contracts:check
pnpm test:postgres
pnpm --dir cloud db:migrate
```

## 文档入口

- `README.md`：安装和使用
- `IMPLEMENTATION_PROGRESS.md`：当前里程碑、验证证据和风险
- `docs/architecture.md`：架构、路由、协议、数据表速查
- `agent/AGENT_OPERATIONS.md`：Agent 普通用户操作
- `cloud/docs/deployment.md`：部署和数据库运维
- `web/AGENTS.md`：Web 样式分层、主题 token 和图表主题约束
