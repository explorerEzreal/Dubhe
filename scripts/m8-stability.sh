#!/usr/bin/env sh
set -eu

command -v docker >/dev/null 2>&1 || { echo '[m8:stability] 缺少 Docker' >&2; exit 2; }
connections=${M8_STABILITY_CONNECTIONS:-1000}
duration_hours=${M8_STABILITY_DURATION_HOURS:-24}
output=${M8_STABILITY_OUTPUT:-m8-stability-result.json}

case "$connections" in (*[!0-9]*|'') echo 'M8_STABILITY_CONNECTIONS 必须为整数' >&2; exit 2;; esac
case "$duration_hours" in (*[!0-9]*|'') echo 'M8_STABILITY_DURATION_HOURS 必须为整数' >&2; exit 2;; esac

echo "[m8:stability] connections=$connections duration_hours=$duration_hours"
echo '[m8:stability] 需要验收环境提供预注册凭证清单和 WSS 地址；将由连接压测容器执行心跳、随机断线与重连。'
cat > "$output" <<EOF
{"status":"blocked","reason":"需要 Docker、WSS 地址和预注册凭证清单","connections":$connections,"duration_hours":$duration_hours}
EOF
exit 2
