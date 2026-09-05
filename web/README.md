# Web

面向部署者、调用者和管理员的 React 控制台。只访问 Cloud API。

## 职责

- 注册、登录与会话管理。
- 部署者添加设备、生成安装命令、查看 Agent 与模型状态。
- 调用者查看模型、创建/禁用 API Key、查看用量。
- 显示 CPU、内存、GPU 当前快照和最近错误。

## 非职责

- 不直接访问 PostgreSQL、Agent 或 Ollama。
- 不包含数据库凭证、JWT 签名密钥或 API Key 哈希。

## 目录结构

```text
src/
├── main.tsx            # 应用入口
├── app/                # 路由、Provider、布局
├── api/                # 唯一的 Cloud API 访问层
├── auth/               # 登录态与受保护路由
├── features/           # 按业务域组织（onboarding/agents/models/api-keys/usage）
├── components/         # 通用 UI、状态和反馈组件
├── pages/              # 页面级组合
├── state/              # 客户端状态
├── types/              # 共享类型
├── config/             # 运行时配置
└── styles/             # 样式
```

依赖方向：`pages -> features -> api -> client`。页面不得直接 `fetch`，必须通过 `src/api`。

## 运行

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

## 环境变量

`VITE_API_BASE_URL` 指向 Cloud 地址，官方托管与私有化只改此配置。
