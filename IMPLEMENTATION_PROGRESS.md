# MVP 实施进度

基线日期：2026-09-04。状态只有在代码存在且有验证依据时标记为“已完成”；未打通端到端链路标记为“部分实现”。

## 当前基线

| 工程 | 状态 | 已具备能力 | 主要缺口 |
| --- | --- | --- | --- |
| Cloud | 部分实现 | 认证、会话、部署令牌、设备凭证、API Key、限流、审计、迁移、WSS 控制面、模型路由、流式/非流式推理和请求清理 | 真实本地模型服务、长连接和生产环境验收 |
| Agent | 部分实现 | `dubhe-agent` CLI、OpenAI 兼容本地服务、凭证持久化、自动注册、WSS、心跳、重连、模型同步、资源指标、推理转发和取消 | 真实 Cloud/模型服务和断网恢复验收 |
| Web | 已完成（M7） | 注册登录、部署者引导、一次性命令、设备/模型状态、API Key 生命周期、调用示例和用量摘要 | 生产安装包及 Docker/TLS 端到端验收 |

## 里程碑

| 里程碑 | 状态 | 关键结果 | 风险/待验收 |
| --- | --- | --- | --- |
| M1 文档与验证基线 | 已完成 | 三工程约束、验证基线和进度记录建立 | 无 |
| M2 Cloud 基础设施、安全和持久化 | 已完成 | 分层、认证、凭证、API Key、审计、限流、迁移完成 | Docker、模型服务和稳定性验收留后续 |
| M3 Agent 常驻运行时 | 已完成 | 注册、凭证、WSS 生命周期、心跳、重连和状态同步完成 | 未做真实 Cloud/模型服务长连接验收 |
| M4 Cloud WSS 控制面 | 已完成 | 单连接注册表、心跳、状态同步、离线扫描完成 | 未做真实断网和压力验收 |
| M5 非流式推理链路 | 已完成 | ready 路由、并发占用、超时、取消、断线清理和 JSON 响应完成 | 未做真实模型服务验收 |
| M6 流式 SSE 与兼容 API | 已完成 | chunk 顺序校验、SSE、`[DONE]`、取消和清理完成 | 未做真实网络恢复验收 |
| M7 Web 完整控制台 | 已完成 | 部署引导、状态、Key 权限、调用示例和统计完成 | 未做真实浏览器/部署验收 |
| M8 Docker、自部署和稳定性 | 部分实现 | 根 Compose 唯一线上入口、Caddy、npm Agent 入口、本地 `pnpm dev:local` 和私有化配置完成 | Docker、TLS/WSS、真实模型服务、1000 条连接 24 小时验收 |

## 最近验证

- 2026-09-12：部署入口收敛为“根目录 docker-compose.yml（唯一线上入口）+ `pnpm dev:local`（唯一本地入口）”；环境变量收敛为 `.env.example`/`.env.local.example` 两套，删除 `cloud/.env.example`；`cloud/docker-compose.yml`（Nginx 旧入口）标记废弃，脚本引用清除；新增 `cloud/docs/deployment.md` 与本地 PostgreSQL 验收流程（`dubhe_dev`/`dubhe_acceptance`）。待真实 Docker/TLS/WSS 环境验收。
- 2026-09-11：Agent npm 发布钩子、公开包元数据、systemd/launchd 服务命令、平台凭证目录和本地推理清理已实现；待完成干净目录安装和真实 Cloud/WSS/模型服务验收。
- 2026-09-06：Compose YAML、Cloud/Agent/Web TypeScript、Vitest、ESLint、协议 schema 和 Shell 语法检查通过。
- 2026-09-05：全仓 `pnpm test`、`pnpm build`、`pnpm lint`、`pnpm contracts:check` 通过；PostgreSQL 隧道测试和连续两次迁移通过。
- 当前环境无 Docker，且 pnpm 可能触发网络依赖检查；未据此声称 Docker、TLS、真实模型服务或长连接稳定性已验收。

## 下一步

在云服务器和模型设备执行干净目录 npm tarball 安装、systemd/launchd 服务启停、Compose、真实 OpenAI 兼容模型服务、TLS/WSS、断网恢复及 1000 条连接 24 小时测试；补齐证据后再将 M8 标记为“已完成”。
