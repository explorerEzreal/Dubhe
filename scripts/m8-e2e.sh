#!/usr/bin/env sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
compose="docker compose -f $root_dir/docker-compose.yml"

command -v docker >/dev/null 2>&1 || { echo '[m8:e2e] 缺少 Docker' >&2; exit 2; }

echo '[m8:e2e] 校验 Compose 配置'
eval "$compose config >/dev/null"
echo '[m8:e2e] 启动 Caddy、Web、Cloud、PostgreSQL、迁移与管理员初始化'
eval "$compose up -d"

cleanup() { eval "$compose down" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

api_base=${M8_API_BASE_URL:-https://${PUBLIC_DOMAIN:?请设置 PUBLIC_DOMAIN}}
wait_for() {
  i=0
  while [ "$i" -lt 60 ]; do
    if curl -kfsS "$1" >/dev/null 2>&1; then return 0; fi
    i=$((i + 1)); sleep 2
  done
  echo "[m8:e2e] 等待失败: $1" >&2
  exit 1
}

wait_for "$api_base/healthz"
wait_for "$api_base/readyz"
echo '[m8:e2e] 健康检查通过；请由验收环境继续执行注册、API Key、非流式/流式和故障场景。'
