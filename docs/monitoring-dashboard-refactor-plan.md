# Cloud 数据监控与部署者仪表盘重构计划

## 一、目标与边界

将 Cloud 数据监控建设为独立的调用事实与聚合能力层，再基于该能力重构部署者仪表盘。

固定边界：

- Cloud 是唯一 PostgreSQL 访问者。
- 推理业务只发布监控事件，不依赖监控 SQL 或仪表盘结构。
- 监控模块负责记录、分类、幂等和聚合。
- 仪表盘通过适配器读取监控结果。
- 设备是系统对外业务概念，不再使用“端点”。
- 仪表盘只面向部署者，不保留“运营总览 / 我的使用”切换。
- 不安装新依赖，不修改无关业务模块。

执行顺序：

1. 冻结监控契约。
2. 重构 Cloud 数据监控。
3. 接入真实监控数据。
4. 重构 Web 仪表盘 UI。
5. 完成视觉、交互、接口和数据验收。
6. 更新 `IMPLEMENTATION_PROGRESS.md`。

## 二、监控契约与事实模型

### 事件契约

在 Cloud 内定义版本化生命周期事件：

```text
inference.started
inference.routed
inference.completed
inference.failed
inference.timeout
inference.cancelled
inference.disconnected
```

公共字段：

```text
event_id
event_version
request_id
occurred_at
user_id
api_key_id
group_id
model_id
device_id
```

结果字段：

```text
status
status_code
error_code
input_tokens
output_tokens
total_tokens
latency_ms
started_at
finished_at
```

约束：

- `request_id` 幂等。
- 已结束请求不可被重复完成事件覆盖。
- Token 缺失时保留记录并由查询层统计质量问题。
- 未分组调用保留 `group_id = null`。
- 所有时间使用 UTC 存储。
- 查询时间范围使用左闭右开 `[from, to)`。
- P50/P95 只统计已完成且存在延迟的请求。
- 错误率包含 `failed`、`timeout`、`cancelled`、`disconnected`。
- 活跃设备定义为筛选时间范围内至少产生过一次调用的设备。

### 历史快照

调用记录保存请求发生时的名称快照：

```text
model_name_snapshot
group_name_snapshot
device_name_snapshot
```

快照只用于历史展示，不参与权限判断。权限始终基于 ID。

### 数据质量规则

以下字段不写入每条事实记录，而作为查询结果元数据动态计算：

- `missingTokenCalls`
- `ungroupedCalls`
- `truncated`

`truncated` 表示本次查询结果是否超过返回上限，不代表某条调用记录的属性。

## 三、Cloud 监控模块

### 模块结构

```text
cloud/src/domain/monitoring/
  monitoring-events.ts
  monitoring-types.ts
  monitoring-classifier.ts

cloud/src/application/monitoring/
  monitoring-recorder.ts
  monitoring-query-service.ts
  monitoring-ports.ts

cloud/src/infrastructure/database/repositories/
  usage-record-repository.ts
  monitoring-query-repository.ts
```

### 各层职责

`MonitoringEventPort`

- 为推理业务提供唯一入口。
- 业务只发布事件，不知道存储方式和统计 SQL。

`MonitoringRecorder`

- 校验事件。
- 统一状态和错误分类。
- 处理幂等。
- 记录请求事实。
- 计算完成时间、延迟和总 Token。

`MonitoringClassifier`

- 将业务状态映射为监控状态。
- 将错误映射为统一错误分类。
- 不依赖数据库和页面结构。

`MonitoringQueryService`

- 按授权范围查询。
- 支持时间、用户、分组、模型、设备、状态和错误码过滤。
- 支持按时间、用户、分组、模型、设备、状态分组。
- 计算请求数、Token、错误率、平均延迟、P50、P95。
- 返回最近调用和数据质量元数据。

Repository：

- 独占 PostgreSQL SQL。
- 上层禁止直接操作 `inference_requests`。
- 所有查询口径集中维护。

### 存储策略

第一阶段复用现有 `inference_requests`，通过 `UsageRecordRepository` 隔离数据库表结构。

只有在以下情况出现时才拆分独立 `usage_records`：

- 路由状态和统计事实继续明显冲突。
- 需要独立保留不可变监控记录。
- 监控查询对业务请求表产生性能影响。

后续可无痛替换为：

```text
inference_requests  -> 路由和生命周期
usage_records       -> 监控事实
```

### 事务和可靠性

第一阶段：

```text
推理结果更新 + 监控事实更新
        同一个 Cloud 数据库事务
```

暂不引入外部消息队列。

监控接口预留 Outbox 扩展：

```text
InferenceService
  -> MonitoringEventPort
  -> monitoring_outbox
  -> Monitoring Worker
```

当数据量或写入压力达到需求后，再增加 Outbox 和汇总表，不改变推理业务接口。

### 版本与口径文档

事件和事实记录保留：

```text
event_version
recorded_at
occurred_at
```

在监控模块旁补充中文口径说明，明确：

- 错误率状态范围。
- P50/P95 过滤条件。
- Token 缺失处理。
- 时间边界和时区。
- 活跃设备定义。
- 删除对象后的历史名称显示规则。

## 四、Cloud 对外查询接口

新增或重构部署者监控适配器：

```text
MonitoringQueryService
  -> DeployerDashboardQuery
  -> GET /api/monitoring
```

接口规则：

- 只允许部署者访问。
- 前端不再传递 caller/deployer scope。
- 对外字段使用 `devices`，内部数据库可继续使用 `agents`。
- `trend` 返回 `errorRate`。
- `overview` 返回 `activeDevices` 和 `totalDevices`。
- 最近调用通过第 201 条记录判断 `truncated`。
- Cloud 返回实际生效的 `granularity`。
- 空数据、删除对象和缺失 Token 使用稳定占位值。
- 权限范围由权限层生成，不在底层统计 SQL 中散落角色判断。

返回结构：

```text
overview
todayOverview
trend
models
groups
devices
requests
dataQuality
generatedAt
granularity
```

## 五、Web 仪表盘重构

### 页面组件

`DashboardPage` 只负责数据请求、轮询、刷新和状态编排。

拆分组件：

- `DashboardHeader`
- `DashboardToolbar`
- `KpiGrid`
- `TrendCard`
- `HealthCard`
- `DistributionCard`
- `RecentCallsCard`
- `DataQualityBar`

新增格式化和数据转换模块：

- Token、请求数、延迟格式化。
- 环比计算。
- 趋势数据转换。
- 状态标签转换。
- 分布排序和占比计算。
- 最近调用时间格式化。

### 页面内容

固定显示：

- 总请求数。
- 总 Token。
- 错误率。
- P95 延迟。
- 活跃设备。
- Token / 请求 / 错误率趋势。
- 服务健康度。
- 模型、分组、设备分布。
- 最近调用 8 条。
- 数据质量提示。

移除：

- “运营总览 / 我的使用”切换。
- 所有用户可见的“端点”称呼。
- 设计稿中的伪造静态数据。

### 样式边界

`global.less` 仅保留：

- reset。
- 全局字体。
- 主题 CSS 变量。
- 通用焦点环。
- reduced-motion 规则。

仪表盘组件样式就近拆分：

```text
web/src/pages/dashboard/DashboardPage.less
web/src/pages/dashboard/components/DashboardHeader.less
web/src/pages/dashboard/components/DashboardToolbar.less
web/src/pages/dashboard/components/KpiGrid.less
web/src/pages/dashboard/components/TrendCard.less
web/src/pages/dashboard/components/HealthCard.less
web/src/pages/dashboard/components/DistributionCard.less
web/src/pages/dashboard/components/RecentCallsCard.less
web/src/pages/dashboard/components/DataQualityBar.less
```

每个组件只引入自己的 Less，禁止将仪表盘布局、卡片、表格、图表和状态样式集中写入 `global.less`。

### 真实数据接入

- Web 使用 Cloud 返回的真实 `MonitoringData`。
- 分布字段使用 `models`、`groups`、`devices`。
- 活跃设备使用 `activeDevices`。
- 错误率趋势使用 Cloud 的 `trend.errorRate`。
- 最近调用使用 Cloud 返回结果的最新 8 条。
- 数据质量使用 Cloud 动态计算结果。
- Cloud 请求失败时保留上一次成功快照。
- “查看全部”跳转用量记录，并携带当前时间范围和粒度。

## 六、设计稿还原

完整执行附件设计稿和规格文档中的要求：

- 1440px、1024px、390px 三档视口。
- 浅色和深色主题。
- 侧栏展开和折叠。
- 正常、加载、空数据、错误四态。
- 吸顶工具条。
- 5 个 KPI、环比和 Sparkline。
- 趋势图图例开关、Tooltip 和十字线。
- 分布卡 Token / 请求切换。
- 移动端表格列隐藏。
- 键盘焦点、ARIA 标识和 reduced-motion。
- 辅助文本对比度和数字等宽显示。
- 所有 UI 文案与设计稿一致。

## 七、验证计划

### Cloud 验证

- 每种生命周期事件均能正确落库。
- 重复事件不会重复统计。
- 成功、失败、超时、取消、断线分类正确。
- Token、错误率、平均延迟、P50、P95 口径正确。
- 缺失 Token、未分组和截断统计正确。
- 名称快照不受对象改名或删除影响。
- 部署者权限隔离正确。
- 时间边界和时区正确。
- PostgreSQL migration 幂等。
- Cloud 测试、构建、lint 通过。

### Web 验证

- TypeScript、构建、lint 通过。
- Cloud 字段与 Web 类型一致。
- 1440、1024、390 视口截图对照设计稿。
- 浅色、深色主题对照。
- 正常、加载、空数据、错误状态对照。
- 时间范围、粒度限制、刷新、图例和分布切换可用。
- 最近调用和查看全部跳转可用。
- 页面不出现“端点”和 scope 切换。
- 仪表盘组件样式不进入 `global.less`。
- 不存在静态示意数据残留。

## 八、文档与完成标准

更新 `IMPLEMENTATION_PROGRESS.md`，分别记录：

- 监控事件契约证据。
- 监控事实写入证据。
- 通用聚合查询证据。
- 部署者接口权限证据。
- Web 真实数据接入证据。
- 设计稿视觉验收证据。
- 未覆盖的真实 Cloud、Agent、Ollama 和长时间稳定性风险。

完成标准：

- Cloud 监控可以脱离仪表盘独立记录和查询。
- 推理业务不直接依赖监控 SQL。
- 新增用户仪表盘只需新增查询适配器。
- Web 仪表盘完全使用真实 Cloud 数据。
- 设计稿要求的结构、状态和响应式行为全部可验证。