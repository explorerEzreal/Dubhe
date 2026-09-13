#!/usr/bin/env sh
set -eu

cloud_url=''
enrollment_token=''
model=''
local_url=''
agent_package=${DUBHE_AGENT_PACKAGE:-dubhe-agent@0.1.0}

usage() {
  echo '用法: install.sh --cloud-url <https-url> --enrollment-token <token> --model <model> --local-url <url>' >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --cloud-url) cloud_url=${2:-}; shift 2 ;;
    --enrollment-token) enrollment_token=${2:-}; shift 2 ;;
    --model) model=${2:-}; shift 2 ;;
    --local-url) local_url=${2:-}; shift 2 ;;
    *) usage ;;
  esac
done

[ -n "$cloud_url" ] && [ -n "$enrollment_token" ] && [ -n "$model" ] && [ -n "$local_url" ] || usage
command -v node >/dev/null 2>&1 || { echo '缺少 Node.js 22+' >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo '缺少 npm' >&2; exit 1; }
node_major=$(node -p "process.versions.node.split('.')[0]")
case "$node_major" in
  ''|*[!0-9]*) echo '无法识别 Node.js 版本' >&2; exit 1 ;;
esac
[ "$node_major" -ge 22 ] || { echo 'Node.js 版本必须为 22 或更高' >&2; exit 1; }

case "$(uname -s)" in
  Linux) command -v systemctl >/dev/null 2>&1 || { echo 'Linux 需要 systemctl（systemd）' >&2; exit 1; } ;;
  Darwin) command -v launchctl >/dev/null 2>&1 || { echo 'macOS 需要 launchctl' >&2; exit 1; } ;;
  *) echo '仅支持 Linux 和 macOS' >&2; exit 1 ;;
esac

global_prefix=$(npm config get prefix 2>/dev/null || true)
if [ -z "$global_prefix" ] || { [ ! -w "$global_prefix" ] && [ ! -w "$(dirname "$global_prefix")" ] && [ "$(id -u)" -ne 0 ]; }; then
  echo '当前用户没有 npm 全局安装目录写权限，请调整 npm prefix 或使用具备权限的环境' >&2
  exit 1
fi

npm install -g "$agent_package" || {
  echo 'Agent 安装失败，请检查 npm 权限或配置 DUBHE_AGENT_PACKAGE' >&2
  exit 1
}
exec dubhe service install --cloud-url "$cloud_url" --token "$enrollment_token" --model "$model" --local-url "$local_url"
