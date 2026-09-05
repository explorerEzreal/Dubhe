# Web 工程上下文

## 职责

提供部署者、调用者和管理员控制台，只通过 Cloud HTTPS API 获取数据。

## 非职责

不访问 PostgreSQL、Agent 或 Ollama，不保存数据库凭证、JWT 签名密钥或 API Key 哈希。

## 关键目录

- `src/pages`：页面组合。
- `src/api`：唯一 Cloud API 访问层。
- `src/state`：浏览器端登录态和轻量状态。
- `src/features`、`src/components`：业务功能和通用组件。
- `src/config`、`src/styles`：运行时配置和样式。

## 命令

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm lint
```

## 约束

- 页面不得直接 `fetch`，统一调用 `src/api/client.ts`。
- API 错误统一提示“请求失败，请稍后重试”，页面覆盖 loading、empty、error、offline 和成功状态。
- `VITE_API_BASE_URL` 是唯一 Cloud 地址配置，不能写死官方域名。
- API Key 明文只在创建成功页展示一次，不进入持久化客户端状态。
- 修改后运行 build、test 和 lint；不主动新增依赖。

## 当前缺口

部署者添加设备、安装命令、模型 ready/资源状态、API Key 完整操作、调用示例、用量统计和 E2E 页面尚未完成。

进度入口：根目录 `IMPLEMENTATION_PROGRESS.md`。
