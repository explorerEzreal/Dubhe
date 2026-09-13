#!/usr/bin/env sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
compose_file="$root_dir/docker-compose.yml"

command -v docker >/dev/null 2>&1 || { echo '[m8:e2e] 缺少 Docker' >&2; exit 2; }
docker compose version >/dev/null 2>&1 || { echo '[m8:e2e] 缺少 Docker Compose 插件' >&2; exit 2; }

compose() {
  docker compose -f "$compose_file" "$@"
}

read_public_domain() {
  if [ -n "${M8_API_BASE_URL:-}" ]; then
    printf '%s\n' "$M8_API_BASE_URL"
    return 0
  fi
  if [ ! -f "$root_dir/.env" ]; then
    echo '[m8:e2e] 缺少 .env，请设置 M8_API_BASE_URL 或复制 .env.example' >&2
    exit 2
  fi
  domain=$(awk -F= '
    /^[[:space:]]*PUBLIC_DOMAIN[[:space:]]*=/ {
      value=$0
      sub(/^[^=]*=/, "", value)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^\"|\"$/, "", value)
      gsub(/^\047|\047$/, "", value)
      print value
      exit
    }
  ' "$root_dir/.env")
  [ -n "$domain" ] || { echo '[m8:e2e] .env 缺少 PUBLIC_DOMAIN' >&2; exit 2; }
  printf 'https://%s\n' "$domain"
}

cleanup() { compose down >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

echo '[m8:e2e] 校验 Compose 配置'
if ! compose config >/dev/null; then
  echo '[m8:e2e] Compose 配置无效，请检查 .env 和 docker-compose.yml' >&2
  exit 1
fi
echo '[m8:e2e] 启动 Caddy、Web、Cloud、PostgreSQL、迁移与管理员初始化'
if ! compose up -d; then
  echo '[m8:e2e] Compose 启动失败，请查看 docker compose logs' >&2
  exit 1
fi

api_base=$(read_public_domain)
wait_for() {
  i=0
  while [ "$i" -lt 60 ]; do
    if curl -kfsS "$1" >/dev/null 2>&1; then return 0; fi
    i=$((i + 1)); sleep 2
  done
  echo "[m8:e2e] 等待失败: $1，请查看 compose 日志" >&2
  exit 1
}

wait_for "$api_base/healthz"
wait_for "$api_base/readyz"
echo '[m8:e2e] 健康检查通过；请由验收环境继续执行注册、API Key、非流式/流式和故障场景。'
