# Agent

部署者机器上的本地客户端。管理本地 Ollama、保持到 Cloud 的出站 WSS 连接，并执行 Cloud 下发的推理请求。

## 职责

- 保存 Cloud URL、Agent ID、设备凭证和本地模型配置。
- 建立并维护出站 WSS 长连接，支持心跳、指数退避重连和状态重同步。
- 首次使用部署令牌注册设备，换取可撤销的设备凭证。
- 检查 Ollama 健康状态，拉取和查询模型。
- 接收推理任务，调用本机 Ollama HTTP API，按 `request_id` 转发流式 chunk、完成和错误。
- 执行本地并发限制、超时和任务清理。
- 采集 CPU、内存、GPU 可用信息和最小运行状态。
- 输出脱敏日志并支持优雅关闭。

## 非职责

- 不访问 PostgreSQL。
- 不处理用户登录、API Key 或调用者鉴权。
- 不直接接收公网调用者请求。
- 不执行由请求内容拼接出的 shell 命令或任意本地代码。
- 不要求终端用户安装 Node.js（正式交付逐步提供 Linux 独立可执行包）。

## 目录结构

```text
src/
├── main.ts            # CLI 入口和进程生命周期
├── cli/               # 命令解析与参数校验
├── config/            # 配置加载与校验
├── domain/            # 纯业务状态、实体、错误，不依赖基础设施
├── application/       # 用例编排：注册、重连、模型同步、推理、指标
├── infrastructure/    # WSS 客户端、Ollama HTTP、系统采集、凭证存储、日志
└── interfaces/        # 对外输入适配（CLI 输入、消息处理）
```

依赖方向：`interfaces -> application -> domain <- infrastructure`。`domain` 不 import 任何基础设施代码。

## 运行

```bash
pnpm install
pnpm dev -- doctor          # 环境自检
pnpm dev -- start           # 启动 Agent 常驻运行时
pnpm build
pnpm test
pnpm lint
```

## 环境变量

见 `.env.example`。Agent 只依赖可配置的 `CLOUD_URL`，不写死官方域名。`CLOUD_URL` 必须使用 `wss://`；首次启动可设置一次性 `ENROLLMENT_TOKEN` 自动注册，成功后凭证以 `0600` 权限写入 `CREDENTIALS_PATH`。

## 与 Cloud 的通信

通过版本化 WSS 协议，详见 `docs/protocol-v1.md` 和 `protocol/agent-messages.schema.json`。Agent 只建立出站连接，不开放公网端口；连接成功后立即同步 Ollama 模型与系统快照，按配置周期发送心跳，断线按带抖动的指数退避重连。

## 官方托管与私有化部署

两者使用同一 Agent 工程，仅需修改 `CLOUD_URL` 指向目标 Cloud 地址。
