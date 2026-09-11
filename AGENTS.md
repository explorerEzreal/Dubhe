# Dubhe 仓库约束

## 工程边界

- `agent`：部署者机器上的 Node.js Agent，只连接本地 OpenAI 兼容模型服务，并通过出站 WSS 连接 Cloud。
- `cloud`：唯一的 PostgreSQL 访问者，负责认证、凭证、模型路由、推理中转、用量和审计。
- `web`：React 控制台，只通过 HTTPS 调用 Cloud API。
- 固定数据链路：`Web -> HTTPS -> Cloud -> PostgreSQL`、`Agent -> WSS -> Cloud -> PostgreSQL`。
- Web、Agent 不得持有数据库凭证、直接访问 PostgreSQL、Agent 或本地模型服务。

## 核心协议与运行规则

- Agent 与 Cloud 使用版本化 JSON/WSS 协议，消息必须带 `protocol_version`；协议来源为 `contracts/agent-messages.schema.json`，两个工程的副本必须保持一致。
- Agent 只建立出站 WSS；心跳、重连、模型状态同步和凭证撤销必须可恢复且可清理。
- Cloud 只将在线、心跳有效且模型为 `ready` 的实例纳入路由；请求结束、取消、超时或断线必须释放活跃占用。
- 请求使用唯一 `request_id`；流式 chunk 按序转发，错误使用稳定错误码，不泄露内部对象或敏感信息。
- Web、Cloud、Agent 的业务源码保持独立，不通过共享数据库表或内部模块耦合。

## 安全与配置

- 密码、API Key、部署令牌和设备凭证只保存摘要；完整 API Key 仅创建成功时展示一次。
- 强制 TLS/WSS，日志不得包含完整密钥、令牌、凭证、请求正文或响应正文。
- 域名、数据库连接、JWT 密钥和 API Key pepper 通过环境变量或 Secret 注入，不写死官方值。
- Cloud 传给 Agent 的内容只能作为经过校验的推理参数，不得拼接 shell 命令、路径或任意代码。

## 开发约定

- 使用仓库已有 `pnpm-lock.yaml` 和依赖；未经用户许可不安装依赖、不生成新锁文件。
- 文档、注释和提交信息使用中文；第三方 API 字段、协议字段保留英文。
- 异步操作处理异常，接口错误对用户统一提示“请求失败，请稍后重试”，不得暴露技术细节。
- 修改协议后解析三份 schema 并执行一致性比较；修改后按影响范围运行验证命令。

## 常用命令

```bash
pnpm test
pnpm build
pnpm lint
pnpm contracts:check
pnpm test:postgres
pnpm --dir cloud db:migrate
```

根目录文档入口只有 `README.md`（使用说明）和 `IMPLEMENTATION_PROGRESS.md`（实施状态）。
