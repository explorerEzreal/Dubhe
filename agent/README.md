# Dubhe Agent

## 安装与接入

运行环境为 Node.js 22+。本地模型服务必须提供 OpenAI 兼容接口：`GET /v1/models` 和 `POST /v1/chat/completions`。

```bash
npm install -g dubhe-agent
dubhe service install --cloud-url 'https://你的域名' --token '<一次性令牌>' --model '<模型名>' --local-url 'http://127.0.0.1:8000'
```

`service install` 只使用一次性令牌完成注册，随后将设备凭证保存到平台用户数据目录，默认权限为 `0600`。常驻服务配置不保存 enrollment token。

## 服务管理

```bash
dubhe service status
dubhe service uninstall
dubhe doctor
```

Linux 使用用户级 systemd，日志查看：

```bash
journalctl --user -u dubhe-agent.service -f
```

macOS 使用 launchd，日志位于 `~/Library/Logs/dubhe-agent.log` 和 `~/Library/Logs/dubhe-agent.error.log`。

`CLOUD_URL` 必须为 `wss://`，或通过 CLI 传入 `https://` 由 Agent 转换为 `/agent` 路径。令牌过期或重复使用会注册失败；Cloud 撤销或轮换凭证后，旧 Agent 会停止重连，需要重新生成凭证。

## 配置

可通过环境变量覆盖默认值。凭证路径使用 `CREDENTIALS_PATH` 覆盖，模型使用逗号分隔的 `MODELS`，本地服务使用 `LOCAL_MODEL_URL`，日志级别使用 `LOG_LEVEL`。
