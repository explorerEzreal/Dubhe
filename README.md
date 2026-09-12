# 本地模型平台

仓库包含三个独立工程：`agent`、`cloud`、`web`。Cloud 是 PostgreSQL 唯一访问者，Agent 与 Cloud 使用版本化 WSS 契约。

## 架构

```text
浏览器/调用者 --HTTPS--> Cloud --SQL--> PostgreSQL
                           ^
                           | 出站 WSS
模型设备 Agent --HTTP----> 本地 OpenAI 兼容模型服务
```

- `agent`：模型设备上的 `dubhe-agent` CLI，检查本地模型服务并转发推理请求。
- `cloud`：认证、部署令牌、API Key、模型路由、推理中转和用量元数据。
- `web`：React 控制台，只访问 Cloud API。

## 快速开始

线上：`cp .env.example .env` 后 `docker compose up -d`。
本地：`cp .env.local.example .env.local` 后 `pnpm dev:local`。

线上与本地是两套独立的环境变量，互不混用。

## 线上启动

唯一入口是仓库根目录的 `docker-compose.yml`，一次拉起 `Caddy + Web + Cloud + PostgreSQL + migrate + seed-admin`，HTTPS/WSS 由 Caddy 统一承担。

```bash
cp .env.example .env
# 设置 PUBLIC_DOMAIN、POSTGRES_PASSWORD、JWT_SECRET、API_KEY_PEPPER
docker compose up -d
curl https://你的域名/healthz
curl https://你的域名/readyz
```

部署、迁移、管理员初始化、升级与健康检查详见 `cloud/docs/deployment.md`。

## 本地开发

本地使用宿主机 PostgreSQL，不依赖 Docker 或远程数据库。首次使用先安装依赖并创建本地开发库：

```bash
# 前置：Node.js 22+、pnpm、本机 PostgreSQL
createdb dubhe_dev
(cd cloud && pnpm install)
(cd web && pnpm install)
```

一键启动（读取根目录 `.env.local`，自动执行 Cloud 迁移，同时启动 Cloud 与 Web，Ctrl-C 一并退出）：

```bash
cp .env.local.example .env.local
# 按本机 PostgreSQL 账号/密码修改 DATABASE_URL
pnpm dev:local
```

- Cloud 监听 `http://localhost:3000`，Web 监听 `http://localhost:5173`。
- 环境变量只分两套：`.env.example`（线上）与 `.env.local.example`（本地）。

## 接入模型设备

模型设备需要 Node.js 22+、npm，以及提供 `GET /v1/models` 和 `POST /v1/chat/completions` 的本地 HTTP 服务。服务只需监听本机端口，不需要开放公网端口。Agent 支持 Linux systemd 和 macOS launchd 常驻运行。

```bash
npm install -g dubhe-agent
dubhe service install --cloud-url 'https://你的域名' --token '<一次性令牌>' --model '<模型名>' --local-url 'http://127.0.0.1:8000'
```

令牌由 Web 部署者页面生成且只能使用一次；命令会注册设备、保存 0600 凭证并安装常驻服务，自动连接 `wss://你的域名/agent`。检查服务使用 `dubhe service status`，卸载使用 `dubhe service uninstall`，不会删除凭证。

## 调用 API

在 Web 创建 API Key 后调用：

```bash
curl https://你的域名/api/v1/chat/completions \
  -H "Authorization: Bearer dsh_live_xxx" \
  -H 'Content-Type: application/json' \
  -d '{"model":"my-model","messages":[{"role":"user","content":"你好"}]}'
```

协议契约见 `contracts/agent-messages.schema.json`；实施状态与验证证据见 `IMPLEMENTATION_PROGRESS.md`；部署细节见 `cloud/docs/deployment.md`。
