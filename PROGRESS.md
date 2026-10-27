# 执行记录（证据台账）

> 规则：每完成一条验收项，在这里追加一行：`日期 · 验收编号 · 结果 · 证据（命令输出摘要/截图路径）`。
> 没有证据的勾选一律视为未完成。

## P1 召唤链路

| 时间 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 2026-10-27 | P1 AC1.1–AC1.5 | PASS | 生产事件接入 `host/index.ts`（turn/start 记时、turn/end 算时长）；分类阈值由 `normalizeSummon`/`qualifyCompletion` 决定；10 条单测覆盖 |
| 2026-10-27 | P1 AC2.1–AC2.4 | PASS | `CompletionCoalescer`：首条立即发、窗口内攒批、到点 flush 汇总（count/最长时长）；`host/index.ts` 用 `coalesceTimer` 排程并在卸载时清理 |
| 2026-10-27 | P1 AC3.1–AC3.3 | PASS | 既有 `client/notify.ts` 已实现 hidden/失焦才弹 + 权限降级；本次在其上新增召唤门控 |
| 2026-10-27 | P1 AC4.1–AC4.4 | PASS | `assets/config.jsonc` 默认段 + `config.ts` topFieldValid/saveUserConfig + `normalizeSummon` 坏值回落；设置页新增「提醒」卡（开关/阈值/免打扰/声音） |
| 2026-10-27 | P1 AC5.1–AC5.3 | PASS | 点击行为沿用 `wireNotificationClick`（openSession → focus → dsh://open，已由 DSH 调研确认可行）；正文含「用时 X」；声音仅 question/error |
| 2026-10-27 | P1 AC6.1 | PASS | `summon-policy.test.ts` 10 条：归一化/时钟/免打扰/门槛/合并器 |
| 2026-10-27 | P1 AC6.2 | PASS | build / tsc / 966 tests / check:openapi / lint 全绿 |
| 2026-10-27 | P1 AC6.4 | PASS | 测试数 956 → 966（无减少、无跳过） |
| 2026-10-27 | P1 AC6.3 | PENDING | 需真机重启后注入三类事件验证通知（脚本见 ACCEPTANCE.md） |

## P2 状态名牌

| 时间 | 验收项 | 结果 | 证据 |
|---|---|---|---|
|  |  |  |  |
| 2026-10-27 | P2 AC1–AC3 | PASS | 名牌显示状态点+文案+耗时；idle 隐藏；终态 10s 后收起；定位头顶、与气泡互斥不遮挡 |
| 2026-10-27 | P2 AC4 | PASS | 名牌 `title` 提供会话数/待处理数/本回合时长（悬停可见） |
| 2026-10-27 | P2 AC5 | PASS | 配置 `nameplate.enabled`（默认 true），设置页「状态名牌」开关 |
| 2026-10-27 | P2 AC6 | PASS | 无动效（不涉及 reduced-motion 分支） |
| 2026-10-27 | P2 AC7 | PASS | 每只 PetCard 独立计算，不共享状态 |
| 2026-10-27 | P2 AC8 | PASS | 仅复用 `/state` 长轮询；1s ticker 是纯本地重绘（无网络/无 I/O），已在代码注释说明 |
| 2026-10-27 | P2 AC9 | PENDING | 需真机截图确认视觉（与 AC6.3 一并做） |

## P3 本地台词与亲密度

| 时间 | 验收项 | 结果 | 证据 |
|---|---|---|---|
|  |  |  |  |

## P4 菜单栏角标

| 时间 | 验收项 | 结果 | 证据 |
|---|---|---|---|
|  |  |  |  |

## 阶段收尾

| 阶段 | commit | 通用门槛 G1–G7 | 独立验收代理结论 |
|---|---|---|---|
| P1 |  |  |  |
| P2 |  |  |  |
| P3 |  |  |  |
| P4 |  |  |  |
