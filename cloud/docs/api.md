# Cloud API 约定

- 管理 API 使用 JWT Bearer 认证，路径前缀 `/api`。
- 推理 API 使用 API Key Bearer 认证，路径前缀 `/v1`，兼容 OpenAI Chat Completions。
- 统一错误格式：

```json
{
  "error": {
    "message": "No available agent for model",
    "type": "service_unavailable",
    "code": "MODEL_OFFLINE"
  }
}
```

- 第一版支持 `model`、`messages`、`stream`、`temperature`、`top_p`、`max_tokens`、`stop` 等常用字段，不承诺完整 OpenAI API。
- 完整 OpenAPI 见 `openapi/openapi.yaml`。
- API Key 创建支持 `models` 和 `expiresAt`；未知模型、已过期时间和未知字段返回 `400`。
- 推理接口按 API Key + 路由限流，鉴权接口按 IP + 路由限流；超限返回 `429` 和 `Retry-After`。
