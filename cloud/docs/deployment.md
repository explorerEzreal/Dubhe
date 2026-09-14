# 部署

线上部署只有**一个入口**：仓库根目录的 `docker-compose.yml`。本地开发使用 `pnpm dev:local`，不依赖 Docker 或远程数据库。

## 线上部署

根目录 `docker compose up -d` 一次拉起以下服务，HTTPS/WSS 由 Caddy 统一承担：

```text
Caddy + Web + Cloud + PostgreSQL + migrate + seed-admin
```

启动：

```bash
cp .env.example .env
# 设置 PUBLIC_DOMAIN、POSTGRES_PASSWORD、JWT_SECRET、API_KEY_PEPPER
docker compose up -d
```

`.env` 只需维护线上所需变量：`PUBLIC_DOMAIN`、`POSTGRES_USER/DB/PASSWORD`、`JWT_SECRET`、`API_KEY_PEPPER`、`ADMIN_EMAIL/ADMIN_PASSWORD`（可选，用于首次自动建管理员）。域名需已解析到本服务器并开放 80/443；Caddy 自动签发 HTTPS 证书。

### 部署前置条件

- Docker Engine、Docker Compose 插件可用；ARM64 主机需确认所用镜像提供对应架构。
- `PUBLIC_DOMAIN` 已解析到服务器，防火墙放行 TCP 80/443；不要将 PostgreSQL 端口暴露到公网。
- `.env` 中的 PostgreSQL 密码、JWT Secret、API Key Pepper 均使用随机值，并执行 `chmod 600 .env`。
- 模型设备单独运行 Agent 和本地 OpenAI 兼容服务，只允许 Agent 出站连接 Cloud 的 WSS 地址。

Web、Cloud、Agent 的控制边界：Web 通过 HTTPS 管理 Cloud 侧设备、令牌、状态和凭证；Cloud 通过 Agent 的出站 WSS 接收心跳并提供路由；Agent 本机的模型服务、配置文件、诊断及 launchd/systemd 服务由模型设备上的 CLI 管理。Cloud 不提供远程 shell 或操作系统服务控制接口，Agent 也不访问 PostgreSQL 或 Web。

> 已废弃的旧入口 `cloud/docker-compose.yml`（Nginx 方案）仅作为迁移过渡保留一个版本周期，请勿使用；Nginx 方案不再维护。

## 迁移

线上每次启动时 `migrate` 服务自动执行迁移，`cloud` 依赖 `migrate` 成功后才会启动，无需手动操作。

需要手动迁移时（例如本地或验收环境）：

```bash
pnpm --dir cloud db:migrate
```

迁移以事务方式逐个应用 `cloud/migrations/*.sql`，记录在 `schema_migrations` 表，重复执行幂等。

## 管理员初始化

`seed-admin` 服务在 `migrate` 成功后运行：当 `users` 表为空且 `.env` 配置了 `ADMIN_EMAIL`/`ADMIN_PASSWORD` 时创建首个管理员；否则跳过（可通过 Web 注册）。

手动初始化：

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='强密码' pnpm --dir cloud db:seed-admin
```

## 升级

1. 拉取新代码后重新构建镜像并重启：`docker compose up -d --build`。
2. `migrate` 服务会自动应用新增迁移，`cloud` 等待迁移完成后启动。
3. `seed-admin` 幂等：已存在用户时不会重复创建。

## 健康检查

```bash
curl https://你的域名/healthz   # 进程存活
curl https://你的域名/readyz    # 依赖就绪（数据库可用）
```

## PostgreSQL 备份与恢复

备份文件不得提交到 Git，建议每天执行并保留至少 7 个最近版本：

```bash
mkdir -p backups
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "backups/cloud-$(date +%Y%m%d-%H%M%S).dump"
chmod 600 backups/*.dump
```

恢复前先停止 Cloud 写入并确认目标数据库，恢复完成后重新启动服务：

```bash
docker compose stop cloud web proxy
cat backups/cloud-YYYYMMDD-HHMMSS.dump | docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --exit-on-error'
docker compose up -d
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from schema_migrations"'
```

恢复演练应在隔离数据库执行，并记录备份时间、文件校验和、恢复耗时及 `/readyz` 结果。升级失败时保留旧镜像与最近一次备份，回滚代码和镜像后再次执行幂等迁移。

## 数据库验收

验收使用**本机 PostgreSQL 服务**，不需要远程测试数据库、SSH 隧道或线上凭证。约定如下：

```text
PostgreSQL 实例：本机 5432
开发数据库：dubhe_dev
验收数据库：dubhe_acceptance
线上数据库：Compose 内部 postgres 服务的 cloud 库
```

前置：在本机 PostgreSQL 创建验收库（迁移只建表、不建库）：

```bash
createdb dubhe_acceptance
```

验收命令：

```bash
# 1) 迁移建表
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/dubhe_acceptance pnpm --dir cloud db:migrate

# 2) 迁移与持久化验收（数据隔离，不污染开发库）
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/dubhe_acceptance pnpm test:postgres
```

`test:postgres` 在验收库中创建随机 schema（`m2_<随机>`）并在结束后 `drop schema cascade`，因此与 `dubhe_dev` 及验收库既有数据完全隔离；未设置 `TEST_DATABASE_URL` 时该测试自动跳过。
