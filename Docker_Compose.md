# Dubhe Docker Compose 部署

## 部署拓扑

云服务器只运行 Web、Cloud、PostgreSQL 和 HTTPS 反向代理；算力设备独立运行 Ollama 与 Linux x86_64 Agent。

```text
浏览器 --HTTPS--> Caddy --> Web
                         --> Cloud --> PostgreSQL
Linux Agent --WSS-----> Cloud
Linux Agent --HTTP----> 本机 Ollama
```

## 服务器准备

准备一台 Linux 云服务器，安装 Docker Engine、Docker Compose v2，并将域名的 A/AAAA 记录解析到服务器。防火墙放行 TCP `80` 和 `443`。

## 一条启动命令

```bash
git clone <仓库地址> Dubhe
cd Dubhe
cp .env.example .env
nano .env
docker compose up -d
```

如果服务器仅提供旧版命令，也可将最后一行替换为 `docker-compose up -d`。

`.env` 至少修改 `PUBLIC_DOMAIN`、`POSTGRES_PASSWORD`、`JWT_SECRET` 和 `API_KEY_PEPPER`。配置 `ADMIN_EMAIL` 与 `ADMIN_PASSWORD` 时，首次启动会自动创建管理员；不配置则直接打开 Web 注册。

Caddy 会自动申请和续期 Let's Encrypt 证书。域名未解析或 80/443 被占用时，代理不会就绪，可使用 `docker compose logs proxy` 查看原因。

启动后访问：

```text
https://你的域名/
https://你的域名/healthz
https://你的域名/readyz
```

## Linux Agent 接入

在需要共享模型的 Linux x86_64 设备上安装 Ollama 并拉取模型：

```bash
ollama serve
ollama pull llama3:8b
```

登录 Web，进入“部署者控制台”生成一次性令牌，在该 Linux 设备执行页面展示的命令：

```bash
curl -fsSL "https://你的域名/downloads/agent/install.sh" | sh -s -- \
  --cloud-url "wss://你的域名/agent" \
  --enrollment-token "一次性令牌" \
  --models "llama3:8b"
```

安装脚本会下载带 SHA-256 清单的 Agent、写入 `0600` 配置、注册 systemd 服务并自动重连。Agent 只建立出站 WSS，不需要开放入站端口，也不需要数据库凭证。

当前发布包仅支持 Linux x86_64；macOS、Windows 和其他架构的 Agent 属于后续版本。

## 调用模型

其他设备打开同一域名并登录，在调用者控制台创建 API Key。使用示例：

```bash
curl https://你的域名/v1/chat/completions \
  -H "Authorization: Bearer dsh_live_xxx" \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3:8b","messages":[{"role":"user","content":"你好"}]}'
```

## 运维

```bash
docker compose ps
docker compose logs --tail=100 cloud proxy
docker compose pull
docker compose build
docker compose up -d
```

PostgreSQL 数据保存在 `pgdata` 卷。升级前备份数据库，禁止删除该卷。停止并重新启动不会丢失用户、设备和 API Key 数据：

```bash
docker compose down
docker compose up -d
```

## 安全边界

- PostgreSQL、Cloud 和 Web 不映射公网端口，仅由 Caddy 代理。
- Cloud 是唯一访问 PostgreSQL 的工程。
- API Key、部署令牌、设备凭证不会写入 Web 或日志明文。
- 生产环境保持 `AGENT_REQUIRE_TLS=true`，Agent 必须使用 `wss://`。
