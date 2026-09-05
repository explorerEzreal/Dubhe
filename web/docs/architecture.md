# Web 架构设计

## 依赖方向

```text
pages (页面组合)
  -> features (业务域)
    -> api (Cloud API 客户端)
      -> fetch (HTTP)
```

- `pages` 组合 feature，不直接请求。
- `features` 调用 `api` 模块，不直接 fetch。
- `api/client.ts` 是唯一封装 baseURL、认证头和错误处理的位置。
- `state` 保存客户端状态，不保存服务端密钥。

## 状态反馈约定

所有数据视图必须覆盖：loading、empty、error、offline、成功 五种状态。

部署者页面需明确区分：未安装 Agent、Agent 未连接、Ollama 不可用、模型正在拉取、模型 ready。

## 配置

```env
VITE_API_BASE_URL=https://api.example.com
```

无数据库配置、无 Agent 直连地址、无服务端密钥。
