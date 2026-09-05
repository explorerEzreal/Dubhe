# Cloud 部署与私有化

## 当前可部署范围

当前版本可以部署并验收 Cloud、Web、PostgreSQL、认证、部署令牌、API Key、Agent 注册、WSS 心跳、模型状态同步、离线判定和健康检查。
Cloud-Agent Ollama 非流式、流式 SSE、调用者取消和请求超时均已接入；真实 Ollama、断网恢复和长连接稳定性通过 M8 脚本验收。

生产部署入口已统一到仓库根目录的 `docker-compose.yml`，完整流程见 `Docker_Compose.md`。本文件中的 `cd cloud` 分步命令仅用于维护和调试。

## 服务器拓扑

推荐两台机器：

```text
公网服务器：Nginx/TLS -> Web(127.0.0.1:5173)
                       -> Cloud(127.0.0.1:3000，HTTP + WSS /agent)
                       -> PostgreSQL（Compose 内网）
算力服务器：Ollama(127.0.0.1:11434) <- Agent（只出站连接 Cloud）
```

公网只开放 `80/443`。PostgreSQL、Cloud `3000` 和 Web `5173` 只绑定回环地址。

## 1. 公网服务器准备（推荐根目录 Compose）

从仓库根目录执行 `Docker_Compose.md` 中的流程即可完成全量启动。下面的分步命令用于排查迁移、管理员初始化和反向代理问题，不是首次部署的必需步骤。

安装 Docker Engine 和 Compose v2，准备两个 DNS：`console.example.com`（Web）和 `api.example.com`（Cloud）。

```bash
git clone <仓库地址> Dubhe
cd Dubhe/cloud
```

生成密钥并创建 `cloud/.env`（不要提交到 Git）：

```bash
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
API_KEY_PEPPER=$(openssl rand -hex 32)
cat > .env <<EOF
POSTGRES_USER=cloud
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=cloud
DATABASE_URL=postgres://cloud:${POSTGRES_PASSWORD}@postgres:5432/cloud
JWT_SECRET=${JWT_SECRET}
API_KEY_PEPPER=${API_KEY_PEPPER}
VITE_API_BASE_URL=https://api.example.com
PUBLIC_BASE_URL=https://api.example.com
WEB_BASE_URL=https://console.example.com
AGENT_DOWNLOAD_URL=https://api.example.com/downloads/agent
CORS_ORIGINS=https://console.example.com
AGENT_REQUIRE_TLS=true
AGENT_HEARTBEAT_TIMEOUT_MS=30000
TRUST_PROXY=true
WEB_BIND_ADDRESS=127.0.0.1
CLOUD_BIND_ADDRESS=127.0.0.1
EOF
chmod 600 .env
```

启动数据库、迁移、Cloud 和 Web：

```bash
docker compose up -d postgres
docker compose run --rm migrate
docker compose up -d cloud web
docker compose --profile tls up -d reverse-proxy
docker compose ps
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/readyz
```

初始化首个管理员（只在空库执行一次）：

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='替换为强密码' \
docker compose run --rm \
  -e ADMIN_EMAIL -e ADMIN_PASSWORD \
  cloud node --import tsx scripts/seed-admin.ts
```

## 2. Nginx 和 TLS

在宿主机 Nginx 配置两个站点。证书可用 Certbot 获取；`/agent` 必须带 WebSocket 升级头：

```nginx
server {
  listen 443 ssl http2;
  server_name console.example.com;
  location / { proxy_pass http://127.0.0.1:5173; proxy_set_header Host $host; }
}

server {
  listen 443 ssl http2;
  server_name api.example.com;
  location /agent {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

放行 `80/443` 后检查：`https://console.example.com`、`https://api.example.com/healthz`、`https://api.example.com/readyz`。

## 3. 算力服务器安装 Ollama 和 Agent

Ollama 只监听本机地址，先拉取模型并确认健康：

```bash
ollama serve
ollama pull llama3:8b
curl -fsS http://127.0.0.1:11434/api/tags
```

从 Web 创建部署令牌后，在算力机执行 Web 展示的一条安装命令。该命令下载带 SHA-256 校验的 Linux x86_64 Agent 发布包并注册 systemd 服务；发布包由 `agent/release/build-linux-x86_64.sh` 生成并放入 `AGENT_RELEASE_DIR`。

```bash
curl -fsSL "https://api.example.com/downloads/agent/install.sh" | sh -s -- \
  --cloud-url "wss://api.example.com/agent" \
  --enrollment-token "<一次性部署令牌>" \
  --models "llama3:8b"
```

Agent 不需要开放入站端口，也不需要 PostgreSQL 凭证。安装脚本会写入 `0600` 配置、创建 systemd 服务并自动注册；连接成功后立即同步状态，并以带抖动的指数退避在断线后重连。Cloud 默认连续 30 秒未收到合法心跳即关闭连接，并将 Agent 和模型实例标记为 `offline`。

## 升级、备份和回滚

```bash
git pull
docker compose build
docker compose run --rm migrate
docker compose up -d cloud web
docker compose logs --tail=100 cloud migrate
```

备份 PostgreSQL 卷或使用 `pg_dump`；升级前先备份，迁移失败时保留旧镜像并恢复数据库备份。不要删除 `pgdata` 卷。

## M2 数据库验收

设置测试库连接后执行：

```bash
TEST_DATABASE_URL=postgres://... pnpm test:postgres
DATABASE_URL=postgres://... pnpm db:migrate
DATABASE_URL=postgres://... pnpm db:migrate
```

测试自动创建随机临时 schema，完成后级联删除，不访问测试库中的其他业务表。迁移命令连续执行两次，第二次应显示 `0 applied`。
