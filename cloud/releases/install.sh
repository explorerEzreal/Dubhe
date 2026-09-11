#!/usr/bin/env sh
set -eu

cloud_url=''
enrollment_token=''
model=''
local_url=''

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

npm install -g dubhe-agent
exec dubhe service install --cloud-url "$cloud_url" --token "$enrollment_token" --model "$model" --local-url "$local_url"
