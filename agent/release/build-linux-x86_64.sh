#!/usr/bin/env sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=${AGENT_RELEASE_VERSION:-0.1.0}
output_dir=${AGENT_RELEASE_OUTPUT_DIR:-"$root_dir/../cloud/releases"}
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT INT TERM

command -v node >/dev/null 2>&1 || { echo '缺少 Node.js 构建运行时' >&2; exit 2; }
command -v sha256sum >/dev/null 2>&1 || { echo '缺少 sha256sum' >&2; exit 2; }
[ "$(uname -s)" = Linux ] || { echo '必须在 Linux 环境构建 x86_64 Agent' >&2; exit 2; }
[ "$(uname -m)" = x86_64 ] || { echo '必须在 x86_64 环境构建 Agent' >&2; exit 2; }
[ -d "$root_dir/dist" ] || { echo '请先构建 Agent' >&2; exit 2; }
[ -d "$root_dir/node_modules" ] || { echo '缺少 Agent 依赖目录' >&2; exit 2; }

mkdir -p "$output_dir"
mkdir -p "$stage/dubhe-agent"
cp -R "$root_dir/dist" "$stage/dubhe-agent/dist"
cp -R "$root_dir/node_modules" "$stage/dubhe-agent/node_modules"
cp "$root_dir/package.json" "$stage/dubhe-agent/package.json"
cp "$(command -v node)" "$stage/dubhe-agent/node"
cat > "$stage/dubhe-agent/agent" <<'EOF'
#!/usr/bin/env sh
set -eu
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$base/node" "$base/dist/main.js" "$@"
EOF
chmod +x "$stage/dubhe-agent/agent"

artifact="dubhe-agent-${version}-linux-x86_64.tar.gz"
tar -czf "$output_dir/$artifact" -C "$stage" dubhe-agent
sha=$(sha256sum "$output_dir/$artifact" | awk '{print $1}')
cat > "$output_dir/manifest.json" <<EOF
{"version":"$version","platform":"linux-x86_64","artifact":"$artifact","sha256":"$sha","available":true}
EOF
echo "已生成 $output_dir/$artifact"
