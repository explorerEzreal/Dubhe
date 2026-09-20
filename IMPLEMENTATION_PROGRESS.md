# MVP 实施进度

基线日期：2026-09-04。状态只有在代码存在且有验证依据时标记为“已完成”；未打通端到端链路标记为“部分实现”。

## 当前基线

| 工程 | 状态 | 已具备能力 | 主要缺口 |
| --- | --- | --- | --- |
| Cloud | 部分实现 | 认证、会话、部署令牌、设备凭证、API Key（绑定渠道）、分组管理、渠道管理、邀请码、限流、审计、迁移、WSS 控制面、模型路由（按分组过滤）、流式/非流式推理和请求清理 | 真实本地模型服务、长连接和生产环境验收 |
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
- 2026-09-14：确认 Web 与 Agent 保持职责解耦。Web 部署者控制台提供一次性令牌、安装命令、设备/模型状态及凭证轮换/撤销；Agent 本机配置、诊断和 launchd/systemd 操作继续由 CLI 完成。补充 README、部署文档和 Web 边界提示；未新增 Web→Agent 直连或远程执行接口。
- 2026-09-11：Agent npm 发布钩子、公开包元数据、systemd/launchd 服务命令、平台凭证目录和本地推理清理已实现；待完成干净目录安装和真实 Cloud/WSS/模型服务验收。
- 2026-09-06：Compose YAML、Cloud/Agent/Web TypeScript、Vitest、ESLint、协议 schema 和 Shell 语法检查通过。
- 2026-09-05：全仓 `pnpm test`、`pnpm build`、`pnpm lint`、`pnpm contracts:check` 通过；PostgreSQL 隧道测试和连续两次迁移通过。
- 当前环境无 Docker，且 pnpm 可能触发网络依赖检查；未据此声称 Docker、TLS、真实模型服务或长连接稳定性已验收。
- 2026-09-16：分组与渠道概念实施完成。新增 `groups`、`group_agents`、`user_group_access` 数据库表；`api_keys` 绑定 `group_id` 替代模型级权限（`api_key_model_permissions` 保留但不再使用）；新增 `GroupService` + `PgGroupRepository`，JWT 零存储邀请码；新增分组管理（CRUD、设备关联、邀请码）和渠道管理（邀请码添加、移除、模型广场）HTTP 路由（16 个路由）及 Web 前端组件；推理链路按 groupId 过滤 Agent 实例。Agent 代码零改动。
- 2026-09-18：Web `/device/agents` 更新为设备监控中心 UI，复用现有设备、模型和分组接口，新增分组导航、状态筛选、搜索、状态/资源/网络监控图表及响应式设备卡片；未新增路由或修改接口。资源缺失时展示“暂无数据”，待浏览器端验收浅色/深色主题和窄屏布局。
- 2026-09-19：优化 Web 设备监控中心展示：移除手动刷新按钮并显示轮询更新时间，分组调整为顶部横向栏，稳定设备总数统计卡片宽度，收紧页面描述并补齐桌面/移动端响应式布局；未新增路由或修改接口。
- 2026-09-19：进一步收紧设备监控中心顶部 UI：主标题调整为 26px 紧凑层级，分组标题和卡片降低字号与高度，当前分组标题调整为 18px，并缩短顶部间距；统计、筛选和设备卡片区域未调整。
- 2026-09-19：添加设备表单新增必填设备名称、模型服务域名和端口字段，默认值为 `Bubhe Agent-001`、`127.0.0.1`、`8080`；端口限制为 1-65535，并将名称和拼接后的本地服务地址写入 Agent 安装命令。未修改 enrollment API、Cloud 路由或 Agent 协议。
- 2026-09-19：设备状态与资源快照链路适配完成。Cloud 按 `created/connecting/online/degraded/offline/revoked` 返回标准状态、状态原因、最近心跳和资源快照时间；Agent 心跳补充内存使用率、磁盘和 Linux 网络快照，GPU/平台不支持时保持空值；Web 直接展示标准状态及 CPU、GPU、内存、磁盘、网络当前快照。新增 `cloud/migrations/0005_agent_state_consistency.sql` 回填历史空名称并约束状态枚举；未新增资源历史表或接口。
- 2026-09-19：添加设备调整为 Cloud 预创建 `created` 设备并将 enrollment token 绑定设备，Agent 注册不再覆盖 Cloud 名称；新增设备重命名 API。设备监控卡片隐藏技术 ID，支持复制/行内修改名称、模型名称省略与多模型提示，设备操作收纳到菜单，凭证轮换显示一次性新凭证，未安装设备支持取消接入。删除设备暂不实现。
- 2026-09-19：新增 `agent/AGENT_OPERATIONS.md` 普通用户操作手册并在 Agent/root README 建立入口；Agent CLI 增加 `start`、`stop`、`close`、`restart`、`status --json`、`logs`、`version` 和内部 `run` 命令，服务配置改为调用 `run`，`doctor` 自动读取已安装服务配置，`service install --force` 和 `service uninstall --yes` 增加覆盖与自动化控制。Agent build 和 lint 通过；真实服务启停、模型服务和 Cloud 长连接仍待验收。
- 2026-09-19：Agent CLI 完成不兼容升级：删除 `close`、位置参数、`--local-url`、`service status/uninstall` 和 `--force`；新增 `config show/set`、凭证复用的 `service install --host/--port`、升级迁移 `service migrate` 与彻底清理 `service reset --yes`。状态输出增加模型、主机、端口、URL 和版本；配置变更和迁移提供备份回滚。操作手册已重写为新版唯一用户说明；Agent 7 个单元测试、build、lint、CLI 帮助/旧命令拒绝及 npm pack dry-run 通过。
- 2026-09-19：修复 Agent `service install` 本地开发接入。`http://` 会转换为 `ws://.../agent`，配置层仅允许本地环回地址使用 `ws://`，注册连接关闭时返回 Cloud 关闭码，安装失败输出非敏感错误；Agent 7 个单元测试、构建、ESLint 和全局本地安装验证通过。生产仍要求 HTTPS/WSS；本地 Cloud 需设置 `AGENT_REQUIRE_TLS=false`。
- 2026-09-19：重新设计 Web 设备监控卡片，调整为最多两列布局，统一名称复制、编辑和设备操作入口，重组模型、资源、网络和时间信息层级，修正缺失状态原因时的错误回退，并补充移动端侧栏自动折叠与溢出约束；未修改接口或设备操作逻辑。

## 下一步

### 流量监控 M9（阶段一至五，2026-09-20）

- 状态：已完成代码实现，真实 PostgreSQL 与浏览器验收待执行。
- 变更：新增 `docs/traffic-monitoring-plan.md`；请求事实表增加分组快照、总 Token 和维度索引；`/api/monitoring` 严格区分调用者与部署者范围，返回总览、趋势、分组、用户、Key、模型、设备及最近请求；部署者看板增加多维排行、分组内用户、趋势、筛选、异常提示和 CSV；分组表、设备卡片及调用者 API Key 表增加近 30 天 Token；调用者增加个人趋势、筛选和使用日志。
- 验证：Cloud/Web TypeScript、Web 构建、Cloud 推理单测、HTTP 路由测试、定向 ESLint、`git diff --check` 通过；使用本机 `TEST_DATABASE_URL` 执行 `pnpm test:postgres`，2 个 PostgreSQL 验收测试全部通过，迁移重复执行返回空结果；同步修正验收夹具以适配当前分组 API Key 模型。
- 风险：历史请求无法恢复已变更 API Key 的原分组；当前日志查询最多返回最近 200 条，超大规模导出与小时/日聚合表留待数据规模增长后实施；浏览器检查因本地无可用 Cloud 登录态而停留在认证页，真实看板视觉和 Cloud 聚合数据展示仍待验收。

### 仪表盘与使用记录重构（2026-09-20）

- 状态：已实现路由、菜单、默认首页、八项指标卡片、趋势/排行图表和独立使用记录入口。
- 变更：新增 `/dashboard`、`/usage-records`；根路径默认进入仪表盘；`/device/traffic` 兼容重定向；Cloud 监控返回 `todayOverview` 和 `dataQuality`；使用记录支持用户汇总/请求明细切换；菜单将仪表盘和使用记录置于首位。
- 验证：Cloud 全量 35 项测试通过（含 PostgreSQL 2 项）；Web TypeScript、全量 ESLint、生产构建和 `git diff --check` 通过。
- 风险：使用记录当前仍复用现有最近 200 条请求数据，树形用户下钻和带筛选分页 API 需后续阶段补齐；图表点击联动和真实浏览器验收待完成。

在云服务器和模型设备执行干净目录 npm tarball 安装、systemd/launchd 服务启停、Compose、真实 OpenAI 兼容模型服务、TLS/WSS、断网恢复及 1000 条连接 24 小时测试；补齐证据后再将 M8 标记为“已完成”。
## 设备管理 UI 优化（2026-09-19）

- 状态：已实现并完成 Web 构建校验。
- 变更：设备卡片按侧栏状态采用 3/4 列布局；设备名称和模型名称支持悬停、点击复制及键盘操作；顶部更新时间精简为时分秒。
- 验证：`pnpm --dir web build` 通过；本次涉及文件定向 ESLint 通过。全量 lint 仍受既有 `CallerDashboardPage.tsx` 未使用类型报错影响。
