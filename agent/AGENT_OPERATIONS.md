# Bubhe 天枢 Agent 操作手册

> 维护说明：Agent CLI 的命令、参数、输出、退出码或服务行为发生变化时，必须同步更新本文档。普通代码开发、测试和 Cloud/Web 修改通常不需要阅读本文档。

## 快速开始

### 环境准备

Agent 安装在运行本地模型的 macOS 或 Linux 设备上，不安装在 Cloud 或 Web 服务器。需要：

- Node.js 22 或更高版本；
- npm；
- 提供 `GET /v1/models` 和 `POST /v1/chat/completions` 的本地 OpenAI 兼容服务；
- Web 生成的一次性 enrollment token；
- Cloud HTTPS 地址。

检查 Node.js：

```bash
node --version
npm --version
```

Node.js 主版本低于 22 时，使用 Node.js 官方安装包或已有版本管理器升级后再继续。

### 安装 Agent

```bash
npm install -g dubhe-agent@1.0.0-beta.0
dubhe --version
dubhe --help
```

### 检查本地模型

假设本地模型服务监听 `127.0.0.1:8000`：

```bash
curl http://127.0.0.1:8000/v1/models
```

记录响应中的模型 ID，作为安装命令的 `--model`。

### 首次安装服务

```bash
dubhe service install \
  --cloud-url 'https://你的域名' \
  --token '<一次性令牌>' \
  --model '<模型名>' \
  --port 8000
```

默认连接 `127.0.0.1`。本地模型服务位于其他主机时增加 `--host`：

```bash
dubhe service install \
  --cloud-url 'https://你的域名' \
  --token '<一次性令牌>' \
  --model '<模型名>' \
  --host '127.0.0.1' \
  --port 8000
```

首次安装没有本地凭证，必须提供 `--token`。安装成功后会保存凭证、写入 launchd/systemd 配置并启动 Agent，终端不会显示 token 或凭证内容。

### 验证安装

```bash
dubhe status
dubhe doctor
dubhe models
```

`status` 应显示 `running`、模型名称、主机、端口、版本和 PID。`doctor` 检查服务配置与模型后端，`models` 列出本地模型。

### 更换模型或端口

```bash
dubhe config set --model '<新模型>' --port 9000
```

也可以只修改一项：

```bash
dubhe config set --model '<新模型>'
dubhe config set --host '127.0.0.1' --port 9000
```

配置成功后 Agent 自动重启，不重新注册设备，不修改凭证或 Cloud 设备身份。

### 升级 Agent

```bash
npm install -g dubhe-agent@新版本
dubhe service migrate
dubhe status
```

`migrate` 会备份旧服务配置、生成新版本配置并启动服务。迁移不需要 token，不删除凭证；失败时自动恢复备份并尝试启动旧服务。

### 彻底重置

```bash
dubhe service reset --yes
```

该命令停止服务并删除服务配置、配置备份和设备凭证，保留全局 `dubhe` 命令与日志。重置后必须从 Web 获取新 token 并重新安装。

## 命令详解

### `dubhe service install`

首次注册或复用已有凭证重新安装服务：

```bash
dubhe service install --cloud-url <url> --model <model> --port <port> [options]
```

参数：

- `--cloud-url <url>`：Cloud HTTPS/WSS 地址，必填；
- `--model <model>`：本地模型 ID，必填；
- `--port <port>`：本地模型端口，必填，范围 `1-65535`；
- `--host <host>`：本地模型主机，默认 `127.0.0.1`；
- `--token <token>`：仅首次安装且没有凭证时必填；
- `--name <name>`：Agent 名称，默认 `Bubhe 天枢 Agent`；
- `--device-id <id>`：可选设备 ID；
- `--credentials-path <path>`：可选凭证路径。

已有有效凭证时省略 `--token`，命令停止旧服务、重建服务配置并复用原设备身份。

成功输出示例：

```text
[service] 已安装并启动 model=gemma host=127.0.0.1 port=8000
```

### `dubhe config show`

```bash
dubhe config show
dubhe config show --json
```

显示 Cloud 地址、模型、主机、端口、Agent 名称、版本、服务状态和凭证是否存在。只显示布尔状态，不输出凭证内容。

### `dubhe config set`

```bash
dubhe config set [--model <model>] [--host <host>] [--port <port>]
```

至少修改模型、主机或端口之一。端口范围为 `1-65535`。写入失败或服务重启失败时恢复原配置。

### `dubhe service migrate`

```bash
dubhe service migrate
```

用于 npm 包升级后迁移服务配置。保留 Cloud 地址、模型、主机、端口、Agent 名称、设备 ID 和凭证；内部服务入口统一为 `dubhe run`。

### `dubhe service reset`

```bash
dubhe service reset --yes
```

彻底删除服务配置、配置备份和设备凭证。`--yes` 必填，防止误操作。

### 日常服务命令

```bash
dubhe start
dubhe stop
dubhe restart
```

- `start`：启动已安装服务，重复执行保持幂等；
- `stop`：停止服务但保留配置和凭证；
- `restart`：重启服务，不重新注册设备。

服务未安装时返回退出码 `3`。

### 状态命令

```bash
dubhe status
dubhe status --json
```

文本输出示例：

```text
status=running
model=gemma
host=127.0.0.1
port=8000
local_url=http://127.0.0.1:8000
agent_version=1.0.0-beta.0
platform=darwin
service=com.dubhe.agent
pid=12345
```

JSON 输出字段使用 `status`、`model`、`host`、`port`、`localUrl`、`agentVersion`、`platform`、`service` 和 `pid`，未知值为 `null`。

状态值包括：

- `running`：运行中；
- `stopped`：已停止；
- `degraded`：服务异常；
- `not-installed`：未安装；
- `unknown`：无法确定。

### 日志命令

```bash
dubhe logs
dubhe logs -n 100
dubhe logs --follow
```

默认显示最近 50 行；`-n` 指定行数；`--follow` 持续跟踪。macOS 日志位于 `~/Library/Logs/dubhe-agent.log`，Linux 使用用户级 systemd journal。

### 诊断和模型命令

```bash
dubhe doctor
dubhe doctor --json
dubhe models
```

`doctor` 检查服务状态、Cloud 地址、本地模型配置和模型后端；`models` 查询本地服务的模型列表。模型服务不可用时返回退出码 `1`。

### 版本和帮助

```bash
dubhe --version
dubhe version
dubhe --help
```

### 内部命令

```bash
dubhe run
```

仅供 launchd/systemd 前台运行 Agent，普通用户不要直接执行。

## Cloud 兼容问题

Agent 与 Cloud 消息均携带 `protocol_version`。协议不兼容时 Agent 不应重新注册或删除凭证，应按以下顺序处理：

```bash
dubhe doctor
npm install -g dubhe-agent@新版本
dubhe service migrate
dubhe status
```

仍不兼容时，应升级 Cloud 或安装与 Cloud 匹配的 Agent 版本。

## 平台差异

- macOS：使用用户级 launchd，服务名 `com.dubhe.agent`；
- Linux：使用用户级 systemd，服务名 `dubhe-agent.service`；
- 两个平台均只建立出站连接，不开放 Agent 入站端口；
- 服务配置和凭证权限为 `0600`。

## 退出码

| 退出码 | 含义 |
| ---: | --- |
| `0` | 成功 |
| `1` | 运行、配置、连接或模型检查失败 |
| `2` | 参数错误 |
| `3` | 服务未安装 |
| `4` | 服务已停止或目标不可用 |

## 常见故障

- 服务未安装：执行 `dubhe service install`；
- 本地模型不可用：检查 `dubhe config show`、`dubhe models` 和本地服务进程；
- 换模后状态异常：确认模型 ID 与 `/v1/models` 返回值完全一致；
- npm 升级后服务无法运行：执行 `dubhe service migrate`；
- Cloud 协议不兼容：升级 Agent 后迁移服务，不要删除凭证；
- 排查顺序：`dubhe status`、`dubhe doctor`、`dubhe logs`。
