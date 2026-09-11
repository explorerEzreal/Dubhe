#!/usr/bin/env sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
compose="docker compose -f $root_dir/cloud/docker-compose.yml -f $root_dir/cloud/docker-compose.e2e.yml --profile e2e --profile tls"

command -v docker >/dev/null 2>&1 || { echo '[m8:e2e] 缺少 Docker' >&2; exit 2; }
[ -n "${M8_ENROLLMENT_TOKEN:-}" ] || { echo '[m8:e2e] 请设置 M8_ENROLLMENT_TOKEN' >&2; exit 2; }
[ -n "${M8_E2E_MODEL:-}" ] || export M8_E2E_MODEL=smollm2:135m

echo '[m8:e2e] 校验 Compose 配置'
eval "$compose config >/dev/null"
echo '[m8:e2e] 启动 PostgreSQL、迁移、Cloud、Web 和反向代理；模型服务由验收环境单独提供'
eval "$compose up -d postgres migrate cloud web reverse-proxy"

cleanup() { eval "$compose down" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

api_base=${M8_API_BASE_URL:-https://localhost}
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
