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

## 备份与恢复

PostgreSQL 备份、恢复、定时任务与灾备说明将在下一轮提供，本轮不涉及。
