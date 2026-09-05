# MVP 实施进度

基线日期：2026-09-04

## 使用约定

- 状态只有在代码存在且有验证依据时标记为“已完成”。
- 骨架、接口或未打通端到端链路标记为“部分实现”。
- 每完成一个里程碑，更新状态、日期、变更、验证和风险。
- 统一使用仓库已有依赖和 `pnpm-lock.yaml`，不主动新增依赖。

## 当前基线

| 工程 | 结论 | 已有能力 | 主要缺口 |
| --- | --- | --- | --- |
| cloud | 部分实现 | Handler/Application/Repository 分层、认证、会话撤销、部署令牌、API Key、Zod 校验、滑动窗口限流、审计、迁移、健康检查、WSS 控制面、非流式/流式推理路由、请求持久化、超时、取消和断线清理 | 真实 Ollama 和长连接验收 |
| agent | 部分实现 | 配置、持久凭证、自动注册、常驻 WSS、心跳、重连、统一 `name` 心跳模型字段、Ollama 模型同步、系统指标、非流式推理聚合、流式 chunk 转发和取消 | 真实 Cloud/Ollama 验收 |
| web | 已完成（M7） | Ant Design 控制台、部署者引导、一次性令牌命令、Agent/模型状态、API Key 权限与生命周期、调用示例、用量摘要、统一交互状态 | 生产独立安装包和 Docker/TLS 端到端验收留至 M8 |

## 验证基线

- `pnpm test`：已通过（2026-09-05 10:47），Cloud 24 个用例通过、PostgreSQL 2 个条件用例跳过，Agent/Web 测试通过。
- `pnpm contracts:check`：已通过（2026-09-05 10:47），三份 Agent 消息 schema 一致。
- `pnpm lint`：已通过（2026-09-05 10:47），Cloud、Agent、Web 均无错误。
- `pnpm build`：已通过（2026-09-05 10:47），Cloud、Agent、Web TypeScript 与 Web Vite 构建均成功。
- M3 定向验证：已通过（2026-09-05 12:14），`agent` 目录下 `./node_modules/.bin/tsc -p tsconfig.json`、`./node_modules/.bin/vitest run --config vitest.config.ts`、`./node_modules/.bin/eslint src` 均通过；`pnpm contracts:check` 通过。
- M3 包管理器限制：`pnpm --dir agent build`、`test`、`lint` 尝试访问 registry，报 `getaddrinfo ENOTFOUND registry.npmjs.org`；未安装依赖或改写锁文件，改用现有 `agent/node_modules` 二进制完成验证。
- M5 定向验证：2026-09-05，Cloud 30 个用例（含 2 个 PostgreSQL 条件跳过）和 Agent 4 个用例通过；Cloud/Agent TypeScript 与 ESLint、Web Vite 构建通过；`pnpm contracts:check` 通过。
- M5 包管理器限制：`pnpm --offline test` 不被当前 pnpm 版本支持（`Unknown option: 'offline'`）；未安装依赖，改用各工程现有 `node_modules/.bin` 完成验证。
- 依赖验证：未安装新依赖；使用工作区已有包恢复本地链接后完成四项验证。
- M7 定向验证：2026-09-05，Web/Cloud TypeScript、Web/Cloud ESLint、Web/Cloud Vitest、Agent TypeScript/ESLint、Web Vite 构建和 `pnpm contracts:check` 等价检查通过；Web 1 个用例通过，Cloud 31 个用例通过、PostgreSQL 2 个条件用例跳过。
- M7 依赖说明：Ant Design 6.6.2 由用户预先安装；未执行依赖安装或锁文件改写。工作区 `pnpm build` 因 pnpm 无 TTY 清理 modules 保护退出，已使用现有 Vite/TypeScript 二进制完成等价构建检查。
- M8 定向验证：2026-09-05，Cloud/Agent/Web TypeScript、ESLint、Vitest、`pnpm contracts:check` 和四个 M8 Shell 脚本 `sh -n` 均通过；`pnpm m8:e2e` 与 `pnpm m8:stability` 均因当前环境缺少 Docker 以退出码 2，未执行 Compose、TLS、Ollama 或压力测试。
- 2026-09-06 部署入口更新：新增根目录 `docker-compose.yml`、`.env.example` 和 `deploy/Caddyfile`；Compose 自动迁移、可选管理员初始化、构建 Linux x86_64 Agent 发布包并通过 Caddy 提供 HTTPS/WSS；补充 `Docker_Compose.md`，Web 静态代理增加 `/downloads/`，Agent 发布镜像包含打包脚本；`seed-admin` 未配置管理员变量时安全跳过。
- 2026-09-06 等价验证：根 Compose YAML 通过 Ruby Psych 解析；Cloud/Agent/Web TypeScript `--noEmit` 通过；Cloud 31、Agent 5、Web 1 个 Vitest 用例通过；三份协议 schema 一致；Shell 脚本语法通过。当前环境无 Docker，且 pnpm 无 TTY/网络依赖检查阻断，未完成真实 Compose、Caddy、TLS、Ollama 和 WSS 验收。
- 根目录未检测到可用 Git 元数据，本进度不记录分支和提交状态。

## 里程碑计划

| 里程碑 | 状态 | 完成日期 | 变更摘要 | 验证命令与结果 | 风险 |
| --- | --- | --- | --- | --- | --- |
| M1 文档与验证基线 | 已完成 | 2026-09-04 | 补齐根目录和三个项目级 `AGENTS.md`、本进度文件；修复 `readyz` 类型调用；完成 Cloud 严格类型、Agent/Cloud/Web 构建与 lint 复验 | `pnpm test`、`pnpm build`、`pnpm lint`、`pnpm contracts:check` 全部通过；Docker/Ollama 按计划留至 M8 | Docker/Ollama 尚未运行 |
| M2 Cloud 基础设施、安全和持久化 | 已完成 | 2026-09-05 | 完成 HTTP/WSS Handler、Application Service、Repository、Domain 分层；会话、Agent 凭证、API Key、审计、限流、严格校验、事务迁移和安全配置；同步 OpenAPI 与部署文档 | 2026-09-05 10:47：Cloud 24 个测试用例通过，WSS/HTTP 集成和敏感字段脱敏覆盖；全仓四项命令全部通过；2026-09-05 11:25：通过 SSH 隧道执行 `pnpm test:postgres`，2 个 PostgreSQL 用例全部通过；`pnpm --dir cloud db:migrate` 连续两次均为 `[migrate] ok (0 applied)` | Docker/Ollama、完整推理链路和长连接稳定性验收按 M5-M8 进行 |
| M3 Agent 常驻运行时 | 已完成 | 2026-09-05 | 实现 `wss://` 配置校验、首次部署令牌自动注册、凭证原子持久化、WSS 生命周期、立即及周期心跳、带抖动指数退避重连、Ollama 模型状态同步、系统资源快照、凭证拒绝停止重连和优雅停止 | 2026-09-05 12:14：Agent TypeScript 构建、已有 1 个 Vitest 用例、ESLint 和 `pnpm contracts:check` 全部通过 | 未使用真实 Cloud、Ollama 和断网环境做端到端验证；推理、取消和 chunk 转发留在 M5-M6 |
| M4 Cloud WSS 控制面 | 已完成 | 2026-09-05 | 统一心跳协议字段；实现单 Agent 单连接注册表、连接替换、心跳 touch、断开/超时离线持久化、模型实例状态同步、方向和状态校验、30 秒可配置超时扫描 | Cloud 定向 27 个用例、Agent 定向 2 个用例、PostgreSQL 隧道 2 个集成用例通过；全仓 `pnpm test`、`pnpm build`、`pnpm lint`、`pnpm contracts:check` 通过 | Docker/Ollama、真实 Cloud-Agent 断网恢复和长连接压力测试留至 M8 |
| M5 非流式推理链路 | 已完成 | 2026-09-05 | 完成严格推理协议、在线 ready 路由、并发占用、request_id 生命周期、Agent Ollama 聚合、错误上报、超时取消、断线清理、OpenAI 非流式 JSON 和 inference_requests 元数据持久化 | Cloud 30 用例、Agent 4 用例通过；Cloud/Agent 构建与 lint、Web 构建、`pnpm contracts:check` 通过；PostgreSQL 2 个条件用例跳过 | 真实 Ollama、Cloud-Agent 网络恢复和调用者取消留至 M6/M8 |
| M6 流式 SSE 与 OpenAI 兼容 API | 已完成 | 2026-09-05 | Agent 增量 chunk 与序号、Cloud 顺序校验、OpenAI SSE/[DONE]、调用者断开取消、超时/断线清理、取消状态持久化 | Cloud 31 用例通过（PostgreSQL 2 个条件用例跳过）、Agent 5 用例通过、Web 现有用例通过；Cloud/Agent/Web TypeScript 与 ESLint、三份 schema JSON/一致性检查通过。`pnpm` 因当前环境 DNS 触发联网依赖检查未完成；真实 Ollama、网络恢复和长连接稳定性仍未覆盖 | 
| M7 Web 完整控制台 | 已完成 | 2026-09-05 | 引入 Ant Design 6.6.2；完成统一控制台布局、部署者添加设备与一次性令牌命令、Agent 硬件/模型状态、凭证轮换/撤销、调用者模型目录、API Key 模型权限/过期/禁用/删除、curl/OpenAI 示例和调用统计；Cloud Agent/模型只读响应补齐实例与 ready 状态 | Web/Cloud TypeScript、Web/Cloud ESLint、Web/Cloud Vitest、Agent TypeScript/ESLint、Web Vite 构建、`pnpm contracts:check` 等价检查通过；Web 1 个用例、Cloud 31 个用例通过，PostgreSQL 2 个条件用例跳过 | pnpm 根构建受无 TTY modules 保护阻断；未做真实浏览器、Cloud-Agent、Ollama 和 Docker 验收，留至 M8 |
| M8 Docker、自部署和稳定性验收 | 部分实现 | 2026-09-06 | 新增根目录一键 Compose、`.env.example`、Caddy 自动 HTTPS/WSS、自动迁移和可选管理员初始化；Compose 启动时生成 Linux x86_64 Agent 发布包；补充根目录部署手册和 Web `/downloads/` 代理；保留 Agent 仅 Linux x86_64 支持 | 根 Compose YAML、三工程 TypeScript、Vitest、协议一致性和 Shell 语法检查通过；Docker/Caddy/Ollama/真实 WSS 尚未运行 | 当前环境无 Docker/Ollama；Let's Encrypt 需要真实域名和 80/443；Linux x86_64 发布制品与断网恢复、1000 连接 24 小时测试未完成 |

## 现状功能清单

### 已实现

- 三个独立工程、TypeScript、Dockerfile、基础 Compose。
- PostgreSQL 初始迁移和管理员初始化脚本。
- Agent-Cloud 协议 schema，三份文件一致。
- Cloud 用户注册/登录、JWT、部署令牌生成、API Key CRUD、模型权限写入、`/v1/models`、健康检查。
- Cloud HTTP/WSS Handler、Application Service、Repository、Domain 分层；会话摘要与撤销、Agent 凭证认证/轮换/撤销、Zod 输入校验、API Key 滑动窗口限流、管理审计和幂等迁移。
- Agent `wss://` 配置校验、Ollama 健康/列表/拉取/流式聊天客户端、自动注册、凭证原子保存、常驻连接、心跳、重连、模型状态与系统指标同步。
- Cloud WSS 单 Agent 单连接、重复连接替换、心跳应答、消息方向校验、心跳超时关闭和 Agent/model instance 离线持久化。
- Cloud-Agent 非流式推理、ready/活跃请求路由、超时/断线清理和 OpenAI 兼容 JSON 响应。
- Agent 非流式 Ollama 推理聚合、usage 提取、并发限制、取消和稳定错误上报。
- Agent 心跳按协议发送 `status`、`hardwareInfo` 和 `{ name, state }` 模型项。
- Web 注册、登录、JWT 本地保存、受保护路由、基础列表页和统一 API 错误提示。

### 部分实现

- 数据库有 sessions 表，JWT 签发后登记摘要并支持触摸、撤销和过期校验；迁移、索引和凭证摘要已在远程 PostgreSQL 验收。
- Agent 注册可换取凭证，后续连接校验凭证、Agent 状态和 TLS 上下文，并支持撤销/轮换。
- WSS 已完成独立连接注册表、协议校验、消息大小限制、注册/心跳处理、非流式推理消息桥接和离线扫描。
- API Key 已支持 HMAC 摘要、状态、过期时间、模型权限、未知模型拒绝和路由限流，前端权限选择待补齐。
- Web 的生产独立安装包、下载服务、TLS/WSS 和 Docker 端到端验收留至 M8。
- Compose 缺少反向代理、TLS/WSS、自动验收和完整私有化流程。

### 未实现

- Docker + Ollama 端到端验收及 1000 条 WSS 稳定性测试。

## 下一步入口

M8 已进入部分实现。下一步在具备 Docker、Ollama 和 Linux x86_64 构建能力的验收主机执行 `pnpm m8:e2e`、`pnpm m8:stability`，补齐真实推理、TLS/WSS、断网恢复和 1000 条连接 24 小时证据后再标记完成。
