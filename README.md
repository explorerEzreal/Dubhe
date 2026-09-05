# 本地模型平台

本仓库包含三个独立工程：`agent`、`cloud`、`web`。它们不共享源码和数据库连接，只通过版本化 HTTP/WSS 契约通信。

## 架构

```text
Web --HTTPS--> Cloud --SQL--> PostgreSQL
Caller --HTTPS--> Cloud --WSS--> Agent --localhost HTTP--> Ollama
```

- `agent`：部署者机器上的本地客户端，管理 Ollama、保持出站 WSS、执行推理。
- `cloud`：唯一访问 PostgreSQL 的服务，负责认证、路由、中转和用量元数据。
- `web`：React 控制台，只访问 Cloud API。

## Docker Compose 一键部署

生产部署请直接阅读 [Docker_Compose.md](Docker_Compose.md)，在仓库根目录执行：

```bash
cp .env.example .env
# 修改域名、数据库密码和密钥
docker compose up -d
```

## 本地开发初始化顺序

```bash
cd cloud && pnpm install && pnpm dev
cd web && pnpm install && pnpm dev
cd agent && pnpm install && pnpm dev -- doctor
```

每个目录都是独立项目，可单独复制到客户服务器部署。官方托管和私有化部署仅通过 Cloud URL、Web API URL、数据库连接、域名和密钥配置区分。

## 目录阅读顺序

1. `AGENTS.md`：产品边界与验收标准。
2. 各项目 `README.md`：工程职责和运行方式。
3. 各项目 `docs/architecture.md`：模块依赖方向。
4. `protocol/`、`openapi/`：跨工程通信契约。
# Dubhe
