# Cloud 安全说明

- 密码使用 Argon2id。
- API Key 使用带前缀格式，数据库只存 prefix + HMAC-SHA256 摘要，明文只显示一次。
- 部署令牌短期、一次性、可撤销；注册后换发设备凭证。
- Agent 强制校验 Cloud TLS 证书。
- Ollama 只监听本地地址，不暴露公网。
- 请求/响应正文默认不落盘。
- 日志只记录 request_id、模型、状态、延迟和 usage，不记录正文与凭证。
- 管理 JWT 同时登记 sessions 摘要，登出或撤销后立即失效。
- API Key + 路由使用单实例内存滑动窗口限流，超限返回 429 和 Retry-After。
- Agent 凭证支持轮换和撤销，旧连接在变更后关闭。
- Agent WSS 默认要求 TLS；TLS 在可信反向代理终止时设置 `TRUST_PROXY=true`，并确保 Cloud 端口不直接暴露公网。
- HTTP 请求体和 Agent 消息默认限制为 1 MiB，可通过环境变量收紧。
- JWT 密钥和 API Key pepper 至少 32 个字符。
- Cloud 传给 Agent 的数据只能作为受校验的推理参数，不拼 shell 命令或任意本地路径。
