# 大肥鱼桌宠 · 阶段验收清单

> 定位：**注意力路由器 + 轻陪伴**。宠物负责“在场与共情”，召唤负责“离开视线也能叫你”。
> 本文件是唯一验收口径：每条验收项都要有**可复现的证据**（命令输出 / 截图 / 手工步骤记录），
> 记录写进 `PROGRESS.md`，不允许“看起来没问题”。

## 通用门槛（每个阶段收尾都必须全绿）

| 编号 | 门槛 | 验证方式 |
|---|---|---|
| G1 | 构建通过 | `cd dsh-pet && pnpm run build` |
| G2 | 类型检查 | `pnpm run typecheck` |
| G3 | 单测全过且数量不减少 | `pnpm test` |
| G4 | OpenAPI 与路由一致 | `pnpm run check:openapi` |
| G5 | Lint 通过 | `pnpm run lint` |
| G6 | 桌面端渲染脚本语法 | `for f in runtime/electron-helper/*.js; do node --check "$f"; done` |
| G7 | 无新增常驻轮询/定时器 | 代码审查：新增 `setInterval`/长轮询需在 PROGRESS 说明理由 |

---

## P1 · 召唤链路（最高优先）

**目标**：长任务完成 / 等用户回答 / 出错 时，在用户**看不到 DSH 窗口**的情况下可靠提醒，且不骚扰。

### 事件识别（宿主，纯函数优先）

- [ ] **AC1.1** 回合完成且时长 ≥ 120 秒 → `attention { kind:'done', seconds }`
- [ ] **AC1.2** `tool/call` 的 `name === 'ask_user_question'` → `attention { kind:'question' }`（立即）
- [ ] **AC1.3** `turn/end` 的 `reason.kind ∈ {error,max-tokens,timeout}` 或 `blocked` → `attention { kind:'error'|'blocked' }`
- [ ] **AC1.4** 同一 turn 只产生一条 done/error；question 按工具调用次数计
- [ ] **AC1.5** 事件带 `sessionId / ts / seconds / text(≤60字)`，写进 `sections.attention`（含 counter）

### 去抖与合并（宿主，纯函数 + 单测）

- [ ] **AC2.1** `done` 在 60s 窗口内合并为一条，`count` 累加（提示“3 个任务完成”）
- [ ] **AC2.2** `question` 不合并、立即产生；`error` 合并窗口 60s 内最多一条
- [ ] **AC2.3** 合并只影响通知内容，不丢事件（`/state` 仍能看到最新一条与 count）
- [ ] **AC2.4** 窗口内同类事件不重复弹通知（客户端按 counter 消费，一次一条）

### 触发条件（客户端）

- [ ] **AC3.1** `document.visibilityState === 'hidden'` 或 `!document.hasFocus()` 时才发系统通知
- [ ] **AC3.2** 页面可见且聚焦时**不发**系统通知（宠物内气泡照常）
- [ ] **AC3.3** 无通知权限时不报错、降级为宠物内气泡，并在设置页显示授权状态

### 免打扰与开关（配置）

- [ ] **AC4.1** 新增配置 `summon`：`{ enabled, minTurnSeconds, coalesceSeconds, quietHours:{start,end}, sound }`
- [ ] **AC4.2** 免打扰时段内不弹通知，事件仍写入 `/state`（回来能看到）
- [ ] **AC4.3** 设置页「提醒」区块可改：开关、时长阈值、免打扰起止、声音
- [ ] **AC4.4** 配置非法（如 25:00）→ 告警并回退默认，不阻塞启动

### 交互

- [ ] **AC5.1** 点击通知把 DSH 窗口带到前台（桌面应用内 `window.focus()` 可用即通过）
- [ ] **AC5.2** 通知标题/正文含宠物名与事件摘要（完成用时；提问优先）
- [ ] **AC5.3** 声音可关；默认开（仅 question 与 error 发声）

### 质量

- [ ] **AC6.1** 新增单测覆盖：分类、阈值、合并、免打扰、配置回退（≥15 条）
- [ ] **AC6.2** G1–G7 全绿
- [ ] **AC6.3** 手工验证：用 `/attention/test`（或脚本）分别注入 done/question/error 三类，记录通知截图
- [ ] **AC6.4** 回归：现有 956 条测试不减少、不跳过

---

## P2 · 状态名牌（视线内的补充）

- [ ] **AC1** 名牌显示：状态点（颜色）+ 一句话（任务/工具）+ 本步耗时
- [ ] **AC2** `idle` 时自动隐藏；`success/error` 显示 10s 后收起
- [ ] **AC3** 不遮挡输入框与设置面板（右下定位 + 可配置关闭）
- [ ] **AC4** hover 名牌显示详情（会话数、模型、等待数）
- [ ] **AC5** 配置 `nameplate.enabled`（默认 true），设置页可关
- [ ] **AC6** `prefers-reduced-motion` 下不做动效
- [ ] **AC7** 多宠物各自独立，不串台
- [ ] **AC8** 不新增轮询：复用 `/state` 长轮询
- [ ] **AC9** 手工截图 + 文字说明记录进 PROGRESS

---

## P3 · 本地台词与亲密度（零模型成本的陪伴）

- [ ] **AC1** 本地台词库 ≥ 120 条：6 状态 × 时段/节日，文件化（`assets/lines.json`）
- [ ] **AC2** 随机选句去重（同一句不连续出现 3 次内）
- [ ] **AC3** 周期碎碎念默认改为本地台词：**不调用模型**（单测断言无 LLM 调用）
- [ ] **AC4** 亲密度计数持久化到 `$DSH_HOME/dsh-pet/affinity.json`（点击/甩抛/对话）
- [ ] **AC5** 亲密度只影响台词档位，不做数值面板（避免养成负担）
- [ ] **AC6** 设置页可关闭本地台词 / 清零亲密度
- [ ] **AC7** 主动聊天仍走模型，与台词的入口分开
- [ ] **AC8** 单测：选句、时段、去重、持久化

---

## P4 · 菜单栏角标（常驻信号）

- [ ] **AC1** 桌面 Helper 托盘显示待处理角标（`●N`），N = question + error 未读
- [ ] **AC2** 点击托盘菜单项可打开 DSH（复用现有 open-target 能力）
- [ ] **AC3** 仅当 Helper 在运行时启用；纯 Web 模式不报错、不拉起额外进程
- [ ] **AC4** 资源开销：Helper 空窗 RSS < 250MB（记录实测）
- [ ] **AC5** 设置页可关（`summon.menuBar`）
- [ ] **AC6** 无 Helper 时功能降级，日志只告警一次

---

## 并发编排（怎么并行、怎么互不踩踏）

| 工作包 | 文件范围 | 并行策略 |
|---|---|---|
| W1 宿主规则 | `src/host/summon.ts`（新）、`index.ts` 挂载 | 串行（与 W2 共改 index 时机后错开） |
| W2 宿主配置 | `src/host/config.ts`、`assets/config.jsonc` | 串行 |
| W3 客户端通知 | `src/client/notify.ts`、`src/shared/summon.ts`（新） | 可与 W1 并行（文件不重叠） |
| W4 设置页 | `src/client/settings.ts` | 串行（单文件） |
| W5 台词资源 | `assets/lines.json`（新）、`src/host/whisper.ts` 选句 | 与 W1–W4 并行（独立文件） |
| W6 测试 | `src/host/summon.test.ts`、`src/shared/summon.test.ts`（新） | 与 W1/W3 并行 |

**协作协议**
1. 我负责所有**写代码**与合并；子代理只做**只读调研/独立验收**，避免并发写冲突。
2. 每阶段完成后，派一个只读「验收代理」按本清单逐条打分，输出 `PASS/FAIL + 证据`；FAIL 项我修完再验。
3. 每阶段独立 commit；全部完成后再升版本、推送、发 Release。

## 手工验证脚本（P1）

```bash
# 注入一条 done（模拟 5 分钟回合）
curl -s -X POST http://127.0.0.1:<port>/dsh-pet-7340/attention/test -d '{"kind":"done","seconds":300}'
# 注入 question
curl -s -X POST http://127.0.0.1:<port>/dsh-pet-7340/attention/test -d '{"kind":"question"}'
# 注入 error
curl -s -X POST http://127.0.0.1:<port>/dsh-pet-7340/attention/test -d '{"kind":"error"}'
```
（测试端点仅在 `DSH_PET_TEST_HOOKS=1` 时挂载；发布版不暴露。）
