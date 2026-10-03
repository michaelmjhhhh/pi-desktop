# 代码冗余与质量审计

日期：2026-10-03。基线：`7397d22`。实施分支：`chore/slop-audit-cleanup`。

本次采用调用点搜索、生产路径追踪、SDK 本地类型对照、测试内容审查和非 UI 验证。调查与复核子代理均使用 `gpt-6.1-sol`。以下区分已经修复的问题与需要单独处理的风险；不把文件大小、兼容性代码或测试数量本身作为删除依据。

## 主要发现与已实施改动

### 1. 读取失败被伪装成空配置：高优先级

位置：`lib/models-config-store.ts`、`app/api/models-config/route.ts`、`components/ModelsConfig.tsx`。

原先的宽泛兜底使损坏或不可读取的模型配置看起来像正常空配置，后续保存可能覆盖原文件。现在只有文件不存在才返回空配置；JSON/结构/文件系统错误正常暴露。读取和写入共用结构校验，保留未知字段。UI 显示错误、支持重新加载，并在读取成功前禁用保存和新增。测试确认错误写入不会改变原文件。

### 2. 删除流程吞掉重挂子会话的失败：高优先级

位置：`app/api/sessions/[id]/route.ts`、新增 `lib/session-deletion.ts`。

原先子会话文件操作失败可能被忽略，父会话仍继续删除。现在先读取候选文件并生成修改，再通过现有原子写入工具逐个应用；操作性错误会阻止父会话关闭和删除。实际 DELETE 路由测试注入重挂失败，验证返回 500、没有 shutdown/unlink，父文件仍存在。损坏记录与文件消失仍按明确规则处理。

这不是跨文件事务：后面的写入失败时，前面的子文件可能已经重挂，但父文件保留。外部 Pi 进程的并发写入也未由此解决，见后续工作。

### 3. 通过错误文本判断 HTTP 状态：中优先级

位置：`lib/subagents.ts`、`lib/subagent-errors.ts`、`app/api/subagents/[id]/route.ts`、`app/api/subagents/profiles/route.ts`。

错误文案承担机器协议职责，改一句文案就可能改变状态码。现改为有限错误代码，分别映射 400/403/409；未分类运行时错误保留为 500。只在请求 JSON 解码边界将 `SyntaxError` 认定为坏请求，避免把内部配置解析失败误报为用户输入错误。

### 4. 字典式命令协议与调用者自选返回类型：中优先级

位置：`lib/agent-client.ts`、`lib/agent-session-wrapper.ts`、新增 `lib/agent-protocol.ts`、两个 agent POST 路由。

原先命令使用宽泛字典和局部断言，客户端可自行指定一个并未由命令保证的泛型返回类型。这属于用动态字典模拟协议、绕过 TypeScript 约束的写法。现采用可辨识联合类型与命令结果映射，在启动 runtime 前校验输入，并由命令推导客户端结果。保留未指定工具与空工具数组的不同含义，也保留 HTTP `set_tools` 与进程内返回值的差异。无效成功响应不再被当作正常数据。

### 5. SSE 消费端散落类型断言：中优先级

位置：`hooks/useAgentSession.ts`、`lib/agent-event-connection.ts`、新增 `lib/client-agent-event.ts`。

现在在消费边界解析已知事件，集中检查实际使用的字段，忽略未知事件种类；为文本/思考增量、工具调用结束等负载补充校验。保留新旧 compaction 名称、扩展 widget 清空、超时字段和工具流式原始参数。这里没有声称验证完整 SDK 消息 schema：消息内容仍由 SDK 契约及统一 normalization 适配。

### 6. 手写 SDK 镜像类型与双重断言：中优先级

位置：`lib/pi-types.ts`、`lib/types.ts`、`lib/normalize.ts`、`lib/session-reader.ts`、`lib/subagent-runtime.ts`、`lib/session-title.ts`。

多处本地接口重复 SDK 定义，再用断言接回 SDK，容易在升级后悄悄漂移。现直接引用 SDK 的 agent/modelRuntime/bindExtensions/UI 类型；适配层承认 SDK 与历史本地消息的真实联合，保留扁平与旧式图片结构及非 assistant 消息对象身份。`bindExtensions` 保持通过实例成员调用，以保留 receiver。

仍保留两个有实际兼容用途的 `as unknown as`：SDK 私有 `flushed` 状态适配及无终端 widget factory 桥接。没有为了消除搜索结果而改写这些行为。

### 7. 仅为测试存在的完成回调机制：低风险清理

位置：`lib/agent-session-wrapper.ts`、`lib/rpc-manager-shutdown.test.mjs`。

删除没有生产消费者的 `onAgentRunComplete` 选项、相关状态跟踪和三项专门验证该机制的测试。保留真实使用的通知抑制逻辑与运行生命周期处理。

### 8. 未使用状态、返回成员和恒定占位值：低风险清理

位置：`lib/agent-session-wrapper.ts`、`hooks/useAgentSession.ts`、`components/ChatWindow.tsx` 的调用契约。

删除重复的 extension binding 错误状态及不可达分支、无消费者的 hook 返回成员和选项，以及固定为零而不提供真实信息的 wrapper 计数字段。没有移除仍服务于实际生命周期的状态。

### 9. 设置组件保留已无调用者的独立弹窗模式：低风险清理

位置：`components/SettingsUi.tsx`、`SettingsPanel.tsx`、四个配置 section、`app/settings.css`。

调用链已经统一为设置面板内嵌 section，组件却仍维护另一套弹窗、关闭按钮和样式。删除该死分支，保留外层设置面板及 provider picker 的真实弹窗行为。

### 10. 图片、音频、视频三套重复订阅逻辑：中优先级

位置：`components/FileViewer.tsx`、新增 `hooks/useMediaWatch.ts`。

三套 SSE 订阅、断线刷新、缓存失效和过期结果保护容易发生修复不同步。提取一处共享 hook，保留各媒体元数据处理、generation guard、重连和清理语义，并移除重复注册的错误处理。这里需要人工验收实际媒体行为，静态复核不能替代它。

### 11. 派生状态与命令式样式操作：低风险清理

位置：`hooks/useTheme.ts`、`hooks/useI18n.tsx`、`components/FileExplorer.tsx`、`components/TabBar.tsx`、`app/globals.css`。

主题状态改为所需的标量，移除冗余 hydration 标记；将纯 hover 样式移回 CSS。补齐 Skills/Plugins 的 effect 依赖，减少依靠闭包或重复状态维持一致性的代码。

### 12. 重复常量和零价值转发层：低风险清理

位置：新增 `lib/thinking-levels.ts`、`lib/file-links.ts`、`app/api/models-config/discover/route.ts`。

收敛多处 thinking-level 列表为 readonly 元组、类型与 guard；路径斜杠归一化复用既有实现；移除仅转发 `Headers.has()` 的 `hasHeader` 包装。没有把所有短函数都视为坏包装：边界校验、错误分类和 SDK 适配仍有独立职责。

### 13. 测试验证实现形状而非用户或业务结果：中优先级

位置及逐套数量见 [测试审计](test-audit.md)。

- 从八个套件移除 50 项既有顶层测试，其中包含 SSR 标记断言、源码截取后放入 VM 的伪 hook 生命周期、键盘处理器抽取及组件 memo 比较器测试；保留有价值的纯 helper 检查。
- Mermaid 的 SSR 测试只看到加载/源码标记，effect 根本没有执行，不能证明图表渲染成功。
- SessionSidebar 列表窗口测试改为验证可见/聚焦项、边界、唯一排序及有界窗口，不锁死具体 overscan 参数。
- 不因目录名是 `components` 就删除其中的解析、草稿、图片处理、终端传输等非 UI 测试。
- 按仓库规定移除自动 UI 检查，并将实际交互、渲染与错误显示转为人工清单。这会减少自动渲染覆盖；不能宣称纯 helper 测试等价替代它。

本次新增测试集中在配置损坏、写入拒绝、真正的路由失败顺序、命令协议、流式事件和消息兼容性，不添加“某段源码已经删除”式测试。

### 14. 全局关闭规则掩盖新增问题：中优先级

位置：`eslint.config.mjs`。

恢复 `react-hooks/immutability`。将 refs 和 set-state-in-effect 的历史豁免收窄到列出的具体文件，新文件和其他文件继续使用严格默认规则。没有为让 lint 变绿而批量改变复杂生命周期。

## 后续建议与明确保留的边界

| 问题 | 位置 | 建议与实施条件 |
| --- | --- | --- |
| 大模块仍有较高认知负担 | `hooks/useAgentSession.ts`（约 1,932 行）、`lib/agent-session-wrapper.ts`（约 1,562 行）、`components/SessionSidebar.tsx`（约 2,252 行）、`components/ChatInput.tsx`（约 2,318 行） | 分批按稳定职责拆分，先处理纯数据转换；把流生命周期、重连、fork 的迁移作为独立 PR。行数不是 bug 证据。 |
| wrapper 结果映射没有逐分支编译证明 | `AgentSessionWrapper.send` 的 overload 与 `Promise<unknown>` 实现 | 后续可让各分支结果显式受 result-map 类型检查；当前已逐分支复核并验证相关协议，不声称类型系统覆盖所有返回路径。 |
| SDK 私有字段和 headless 扩展适配 | `lib/agent-session-wrapper.ts` | SDK 提供正式替代能力后再移除，单独验证持久化与扩展生命周期。 |
| 仍存在文件级 React lint 豁免 | `eslint.config.mjs` 列出的文件 | 逐文件解释 refs/effect 需求并人工验证交互后收紧，避免大范围状态行为变化。 |
| 删除涉及多个文件及外部写入者 | `lib/session-deletion.ts`、会话文件写入路径 | 若要求事务式删除，需要统一锁/日志或可恢复事务设计，并考虑正在运行的会话缓存；不适合混入低风险清理。 |
| 一些纯 helper 仍位于 TSX 中 | `components/*.test.mjs` 对应模块 | 只有在自然职责边界明确时提取，避免生成大量单函数文件。 |

保留的兼容逻辑包括旧/新 compaction 事件、旧 session 工具选择语义、跨平台路径规范、SDK/历史图片格式、HMR 全局 registry 和 fork 后销毁 wrapper。这些都有现存行为依据，不属于应删除的冗余。

## 验证与人工验收

- TypeScript 与 ESLint 通过，lint 无警告。
- 完整非 UI 测试：658 通过，0 失败、0 跳过。
- Desktop 测试：2 通过、3 因缺少 staged/packaged artifact 跳过。
- `git diff --check` 通过；未运行 `next build`，未执行 UI 自动化，也未声称人工检查已通过。
- 按 [人工验收清单](manual-testing.md) 的最后两个部分验证设置错误恢复、媒体更新、流式消息、扩展对话框、主题/语言，以及被删除 UI 测试原本试图覆盖的交互。
