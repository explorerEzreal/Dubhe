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

## Docker Compose 启动

云服务器运行 Caddy、Web、Cloud 和 PostgreSQL；模型设备独立运行 Agent 与本地模型服务。

```bash
cp .env.example .env
# 设置 PUBLIC_DOMAIN、POSTGRES_PASSWORD、JWT_SECRET、API_KEY_PEPPER
docker compose up -d
curl https://你的域名/healthz
curl https://你的域名/readyz
```

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

## 本地开发

```bash
cd cloud && pnpm dev
cd web && pnpm dev
cd agent && pnpm dev -- doctor
```

协议契约见 `contracts/agent-messages.schema.json`；实施状态与验证证据见 `IMPLEMENTATION_PROGRESS.md`。
