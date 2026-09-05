# Agent 工程上下文

## 职责

管理部署者机器上的 Ollama，使用出站 WSS 接入 Cloud，执行模型同步和推理任务。

## 非职责

不访问 PostgreSQL、不处理用户或 API Key 鉴权、不接收公网请求、不执行任意 shell 或本地代码。

## 关键目录

- `src/domain`：状态、错误码和请求实体。
- `src/application`：连接、注册、模型、指标和推理用例。
- `src/infrastructure`：Cloud WSS、Ollama、凭证、系统指标和日志适配。
- `src/interfaces`：CLI 和外部协议适配。
- `docs/protocol-v1.md`、`protocol/agent-messages.schema.json`：通信契约。

## 命令

```bash
pnpm dev -- doctor
pnpm dev -- start
pnpm build
pnpm test
pnpm lint
```

## 约束

- Cloud URL、Ollama URL 和凭证路径必须配置注入，不能写死官方地址。
- 只建立出站 WSS，强制校验 TLS。
- Ollama 不可用时保持连接但不上报可路由模型。
- 流式 chunk 必须带单调递增序号；日志不得包含凭证或请求正文。
- 修改后优先运行 `pnpm test` 和 `pnpm build`，不主动新增依赖。

## 当前缺口

常驻连接、心跳重连、模型状态同步、系统指标和非流式推理任务已完成；流式转发、生产自动重启和完整端到端验收尚未完成。

进度入口：根目录 `IMPLEMENTATION_PROGRESS.md`。
