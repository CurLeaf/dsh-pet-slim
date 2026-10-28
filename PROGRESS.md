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
| 2026-10-27 | P1 AC6.2 补 | PASS | 新增宿主级集成测试 4 例（真实 apply + 真实路由 + 真实 session/event）：提问即时、长回合 200s→summon/done、短回合不写帧、出错即时；总测试 984 |
| 2026-10-27 | P1 AC6.3 | PARTIAL | 宿主侧注入已验证（集成测试）；系统通知的视觉弹出仍待重启后按 VERIFY.md 确认 |

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
| 2026-10-27 | P3 AC1 | PASS | `assets/lines.json`：6 状态 × ~12 句 + 5 时段 + 8 节日 + 10 亲近句（≥130 条） |
| 2026-10-27 | P3 AC2 | PASS | 每宠最近 3 句去重；全被排除时退回原池（单测覆盖） |
| 2026-10-27 | P3 AC3 | PASS | 周期碎碎念默认走 `publishLocalLine`（零模型）；`localLines.enabled=false` 才回到模型 |
| 2026-10-27 | P3 AC4 | PASS | `affinity.json` 持久化（去抖 400ms + 卸载 flush），点击/甩抛/对话三类计数 |
| 2026-10-27 | P3 AC5 | PASS | 亲密度只映射 tier(0–3) 影响选句，不暴露数值面板 |
| 2026-10-27 | P3 AC6 | PASS | 设置页「本地台词」开关 + 「清零亲密度」按钮（DELETE /affinity） |
| 2026-10-27 | P3 AC7 | PASS | 手动 `/whisper` 与 `/chat` 仍走模型，与本地周期路径分离 |
| 2026-10-27 | P3 AC8 | PASS | 11 条单测（选句优先级/去重/时段/等级/落盘/清零）；总测试 979 |

## P4 菜单栏角标

| 时间 | 验收项 | 结果 | 证据 |
|---|---|---|---|
|  |  |  |  |
| 2026-10-27 | P4 AC1 | PASS | Helper 托盘 5s 读 `/state` 的 `workStatus.attention`，macOS 菜单栏标题显示 ` ●N` |
| 2026-10-27 | P4 AC2 | PASS | 托盘菜单新增「打开 DSH」（`dsh://open`，失败回落浏览器打开站点） |
| 2026-10-27 | P4 AC3 | PASS | 仅 Helper 进程内实现；纯 Web 不拉起、不报错 |
| 2026-10-27 | P4 AC4 | PASS | 沿用既有托盘进程（此前实测空窗 228MB / 有窗 ~480MB）；新增仅 5s 一次本机 GET |
| 2026-10-27 | P4 AC5 | PASS | 配置 `summon.menuBar`（默认 true）+ 设置页「菜单栏角标」开关 |
| 2026-10-27 | P4 AC6 | PASS | 无 `tray.setTitle`（Windows/Linux）或 `menuBar=false` 时跳过；读取失败保持上次角标 |

## 阶段收尾

| 阶段 | commit | 通用门槛 G1–G7 | 独立验收代理结论 |
|---|---|---|---|
| P1 | 5b57cb5 | PASS（build/tsc/966→979 tests/lint/openapi；G6 node --check；G7 新增 ticker 已说明） | 代码与单测通过；真机通知待重启 |
| P2 | db8c708 | PASS（同名门槛；979 tests） | 代码通过；视觉截图待重启 |
| P3 | b4e6959 | PASS（+11 tests；零模型路径代码审查通过） | 通过 |
| P4 | d90d68f | PASS（helper node --check；open-target 守卫更新） | 代码通过；托盘角标待桌面模式验证 |

**发布**：v0.5.1（2026-10-27），Release `dsh-pet-0.5.1.tgz`，已装入 desktop profile（替换 npm 0.3.8），
**待重启生效**。真机验收步骤见 `VERIFY.md`。

**真机验收（等待重启）**：P1 AC6.3 / P2 AC9 / P4 托盘角标 —— 应用当前仍是 5 小时前启动的进程，
0.5.1 尚未加载；重启后按 VERIFY.md 执行并回填证据。

## 阻塞记录（2026-10-27 · goal round 4）

- 运行中的 DSH 仍是 5h41m 前启动的进程：`GET /state` 仍返回 `sections.balance`（0.4.0 已删），
  `workStatus` 无 `since/sessions/attention` → 0.5.1 未加载。
- 待办：用户 Cmd+Q 重启后，按 `VERIFY.md` 完成 P1 AC6.3（通知视觉）、P2 AC9（名牌视觉）、
  P4 托盘角标三项，并在本文件回填证据。
- 自检命令（重启后）：
  `curl -s http://127.0.0.1:<port>/dsh-pet-7340/state | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['sections']['workStatus']['data'])"`
  期望能看到 `since/sessions/attention`，且不再有 `sections.balance`。

## 0.5.2 修复记录（桌宠不启动）

- 现象：重启后 `/dsh-pet-7340/state` 404，宠物不出现。
- 根因：lib/index.js 依赖 `@deepseek-ai/dsh-home-paths` / `dsh-llm`；profile 的 pnpm 管理把
  DSH 投影的对等包清掉后 import 失败，宿主整体不挂载。
- 修复：构建期 noExternal 内联两包闭包 + 补 `@oxc-project/runtime` 依赖。
- 验证：最小 profile（base + web-app + dsh-pet）启动成功，`/state` 200 且字段齐全。
- 已装：desktop profile `0.5.2`，待重启确认。

## 2026-10-27 发布门禁修复（迁移到 Linux 后复核）

仓库搬到 `/home/yxw/WorkSpace/dsh-pet-slim` 后，按 `prepack` 链路逐项复核，发现两条门禁是红的，
且都与 0.5.x 的改动有关，先修门禁本身（不改产品行为）：

| 时间 | 项 | 修复前 | 修复后 | 证据 |
|---|---|---|---|---|
| 2026-10-27 | check:openapi | ✗ `host 实现了 /attention，但文档里没有` | ✓ 28 路径 / 36 操作全通过 | 误报源是 0.5.0 加的测试钩子 `rest === 'attention/test'`（仅 `DSH_PET_TEST_HOOKS=1` 挂载、发布版不暴露）；检查脚本把它当成公开路由。已让脚本跳过 `*/test` 段，而不是把测试钩子写进公开文档。 |
| 2026-10-27 | prepack-check | ✗ `bundle imports undeclared helper @oxc-project/runtime` | ✓ `helper imported by lib/index.js and declared in dependencies` | 该规则的旧前提是「此包不在 dependencies」；0.5.2 的修复已把它列入 dependencies（`^0.155.0`）并随包安装，helper 能被解析。脚本改为「未声明依赖时才阻断」，保留了「防 ERR_MODULE_NOT_FOUND」的原意。 |
| 2026-10-27 | format:check | ✗ 12 个文件不符合 Prettier | ✓ All matched files use Prettier code style | `npx prettier --write` 逐个格式化被点名的 12 个文件（每文件 6–7 行差异，纯格式）；格式化后 build / typecheck / lint / 984 tests 全部复跑通过。 |

复核结论（Linux / Node 24.21.0 / pnpm 10.33.0）：

- `npm run build` ✓（产物与仓库一致，`git status` 在格式化前无改动）
- `npm test` ✓ **984 tests / 211 suites / 0 fail**
- `npm run typecheck` ✓、`npm run lint` ✓、`npm run format:check` ✓
- `node scripts/prepack-check.js` ✓（63.6MB 包体、27 张表情对齐）
- `npm run check:openapi` ✓
- `npm run test:ui`（`node --test scripts/tests/*.test.mjs`）：装好 Playwright chromium 后 **22 tests / 15 pass / 6 fail / 1 skip**。
  6 个失败**在 HEAD 上就存在**（`git stash` 后复跑同为 12 pass / 6 fail，仅计 settings.test.mjs 的 18 项），与本次门禁修复无关：
  - 5 个是选择器歧义：`getByRole('button', { name: 'Save', exact: true })` 同时命中工具栏与底栏两个 Save
    按钮（`is-sm` 版 + 常规版），Playwright strict mode 直接报错；
  - 1 个是 `model picker remains anchored … scrolled` 的 `waitForFunction` 5000ms 超时。
  需要单独判断「响应式布局真的渲染了两个 Save」还是「测试该用 `.first()`/限定作用域」，未在本次修复。
- 真机验收（P1 AC6.3 / P2 AC9 / P4 托盘角标）仍未做，且本机是 Linux，`node scripts/start-desktop.mjs`
  与 `runtime/electron-helper` 的 macOS/Windows 分支需要重新确认
