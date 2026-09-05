#!/usr/bin/env sh
set -eu

cloud_url=''
enrollment_token=''
models=''
release_base=${AGENT_DOWNLOAD_URL:-}

usage() {
  echo '用法: install.sh --cloud-url <wss-url> --enrollment-token <token> [--models <models>]' >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --cloud-url) cloud_url=${2:-}; shift 2 ;;
    --enrollment-token) enrollment_token=${2:-}; shift 2 ;;
    --models) models=${2:-}; shift 2 ;;
    --release-base) release_base=${2:-}; shift 2 ;;
    *) usage ;;
  esac
done

[ -n "$cloud_url" ] && [ -n "$enrollment_token" ] || usage
[ "$(uname -s)" = Linux ] || { echo '仅支持 Linux' >&2; exit 1; }
[ "$(uname -m)" = x86_64 ] || { echo '仅支持 x86_64' >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo '缺少 curl' >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo '缺少 sha256sum' >&2; exit 1; }

if ! command -v systemctl >/dev/null 2>&1; then
  echo '缺少 systemd，无法注册系统服务' >&2
  exit 1
fi

if [ -z "$release_base" ]; then
  release_base=${cloud_url%/agent}/downloads/agent
fi

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT INT TERM
manifest="$tmp_dir/manifest.json"
curl -fsSL "$release_base/manifest.json" -o "$manifest"

artifact=$(sed -n 's/.*"artifact"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" | head -n 1)
sha=$(sed -n 's/.*"sha256"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" | head -n 1)
[ -n "$artifact" ] && [ -n "$sha" ] || { echo 'Agent 发布物尚未发布' >&2; exit 1; }

archive="$tmp_dir/$artifact"
curl -fsSL "$release_base/$artifact" -o "$archive"
actual=$(sha256sum "$archive" | awk '{print $1}')
[ "$actual" = "$sha" ] || { echo 'Agent 发布物校验失败' >&2; exit 1; }

install_dir=/opt/dubhe-agent
config_dir=/etc/dubhe-agent
sudo mkdir -p "$install_dir" "$config_dir"
sudo tar -xzf "$archive" -C "$install_dir"
sudo tee "$config_dir/config.env" >/dev/null <<EOF
CLOUD_URL=$cloud_url
ENROLLMENT_TOKEN=$enrollment_token
OLLAMA_URL=http://127.0.0.1:11434
MODELS=$models
CREDENTIALS_PATH=$config_dir/credentials.json
EOF
sudo chmod 600 "$config_dir/config.env"
sudo env CLOUD_URL="$cloud_url" OLLAMA_URL=http://127.0.0.1:11434 CREDENTIALS_PATH="$config_dir/credentials.json" \
  "$install_dir/agent" register --token "$enrollment_token"
sudo sed -i '/^ENROLLMENT_TOKEN=/d' "$config_dir/config.env"
sudo tee /etc/systemd/system/dubhe-agent.service >/dev/null <<EOF
[Unit]
Description=Dubhe Agent
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=$config_dir/config.env
ExecStart=$install_dir/agent start
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now dubhe-agent.service
echo 'Dubhe Agent 已安装并启动，可使用 systemctl status dubhe-agent 查看状态。'
