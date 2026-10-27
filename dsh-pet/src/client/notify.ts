/**
 * 系统通知引擎（浏览器半侧）：消费宿主生成的通知帧，按「聚焦不弹」发系统级 toast。
 * 这是独立于宠物的能力，只随 DSH 网页端走——桌面模式不做宠物无关的功能。
 * 不负责产生帧：宿主监听 DSH 事件并写进 `/state`，容器统一轮询发现 counter 变化后调 `notifyFromFrame`；
 * 中断 / 活动门等过滤也已在宿主侧完成。
 * 依赖 shared/notify.ts 的帧到文案映射，以及成品配置的 `main.notificationsEnabled` 总开关。
 * @module dsh-pet/src/client/notify
 */

import { frameToToast, truncate, NOTIFY_ICONS as ICON_NAMES, type NotifyFrame } from '../shared/notify';

let pageVisible = typeof document !== 'undefined' && !document.hidden;
let pageFocused = typeof document !== 'undefined' && document.hasFocus();

function refreshVisible(): void {
  pageVisible = !document.hidden;
}
function refreshFocused(): void {
  pageFocused = document.hasFocus();
}

/** 注册聚焦与可见性监听，返回解绑函数。 */
function initFocusTracking(): () => void {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('visibilitychange', refreshVisible);
  window.addEventListener('focus', refreshFocused);
  window.addEventListener('blur', refreshFocused);
  return () => {
    document.removeEventListener('visibilitychange', refreshVisible);
    window.removeEventListener('focus', refreshFocused);
    window.removeEventListener('blur', refreshFocused);
  };
}

/** 用户是否在看本页（页面可见且持有焦点）；是则跳过通知。 */
function isPageActive(): boolean {
  return pageVisible && pageFocused;
}

/** 图标 URL；pic 路由由宿主提供（`assets/pic` → `/dsh-pet-7340/pic/<file>`）。 */
const PIC = (name: string): string => '/dsh-pet-7340/pic/' + name + '.png';

/** 图标 URL 表；文件名以 shared 为单一来源，设置页的测试通知也用它。 */
export const NOTIFY_ICONS = {
  done: PIC(ICON_NAMES.done),
  error: PIC(ICON_NAMES.error),
  truncated: PIC(ICON_NAMES.truncated),
  approval: PIC(ICON_NAMES.approval),
  question: PIC(ICON_NAMES.question),
  test: PIC(ICON_NAMES.test),
} as const;

/** 当前生效的总开关；运行中可被 reloadNotifications 更新，设置页保存后即时生效。 */
let notifyEnabled = true;

/** 客户端侧的召唤配置（与宿主同口径，缺省见 DEFAULT）。 */
interface SummonUiConfig {
  enabled: boolean;
  sound: boolean;
  quietHours: { start: string; end: string } | null;
}

const DEFAULT_SUMMON_UI: SummonUiConfig = {
  enabled: true,
  sound: true,
  quietHours: { start: '23:00', end: '08:00' },
};

let summonConfig: SummonUiConfig = DEFAULT_SUMMON_UI;

/** HH:MM → 当日分钟；非法 → null。 */
function clockMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 ? h * 60 + min : null;
}

/** 现在是否在免打扰时段（支持跨零点）；未配置/写坏 → false。 */
function inQuietHours(range: SummonUiConfig['quietHours']): boolean {
  if (!range) return false;
  const start = clockMinutes(range.start);
  const end = clockMinutes(range.end);
  if (start === null || end === null || start === end) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

/** 两声短提示音（无素材依赖；浏览器可能因自动播放策略静音，静默失败）。 */
function playSummonSound(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const beep = (freq: number, at: number): void => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.18);
    };
    beep(880, 0);
    beep(1174, 0.18);
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* 声音只是锦上添花，失败不影响通知 */
  }
}

/** 会话跳转器：由 app.ts 注入，取不到服务时退化为不跳会话。 */
export interface SessionNavigator {
  openSession(sessionId: string): void;
}

/** 当前生效的会话跳转器（app.ts 注入；旧版 DSH 没有 uiWorkspace 时为 undefined）。 */
let sessionNavigator: SessionNavigator | undefined;

/**
 * 点通知：先页内切到那条会话，再聚焦页面，最后请桌面壳把主窗口叫回前台。
 * 先切会话再叫窗口，用户看到窗口的那一刻就是目标会话；`dsh://open` 只在 Electron 宿主里发，
 * 浏览器里导航该协议会弹拦截框。`sessionId` 缺失时只跳过切换，其余照旧。
 */
export function wireNotificationClick(n: Notification, sessionId?: string): void {
  n.onclick = () => {
    n.close();
    if (sessionId !== undefined) {
      // 跳转失败（会话已删 / 旧版没有该服务）绝不能连累「把窗口叫回来」那条腿。
      try {
        sessionNavigator?.openSession(sessionId);
      } catch {
        /* 不跳会话而已，继续叫窗口。 */
      }
    }
    window.focus();
    if (!/electron/i.test(navigator.userAgent)) return;
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = 'dsh://open';
    document.body.append(frame);
    setTimeout(() => frame.remove(), 1000);
  };
}

/** 发一条系统通知；总开关关闭、环境不支持、未授权或本页正在看时静默跳过。
 * 日志只在门之后记录：被拦下的触发不产生「弹窗」日志。 */
function toast(title: string, body?: string, icon?: string, sessionId?: string): void {
  if (!notifyEnabled) return;
  if (isPageActive()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  console.log('【弹窗】' + title + (body ? '：' + body : ''));
  try {
    const opts: NotificationOptions = {};
    if (body) opts.body = truncate(body);
    if (icon) opts.icon = icon;
    // 点击行为与真实事件通知共用 wireNotificationClick；图标加载失败只降级为无图标，不会关闭弹窗。
    const n = new Notification(title, opts);
    wireNotificationClick(n, sessionId);
  } catch {
    /* 个别桌面壳在构造时抛错：忽略，不打断业务。 */
  }
}

/** 帧 → toast 并发出；未知帧静默跳过，帧里的 sessionId 一并透传给点击行为。 */
function toastFrame(frame: NotifyFrame): void {
  const t = frameToToast(frame);
  if (!t) return;
  // 召唤类：受「提醒」独立开关与免打扰约束（普通通知不受影响）；免打扰时事件仍在 /state，回来能看到
  if (frame.summon) {
    if (!summonConfig.enabled) return;
    if (inQuietHours(summonConfig.quietHours)) return;
    if (summonConfig.sound && (frame.summon.kind === 'question' || frame.summon.kind === 'error')) {
      playSummonSound();
    }
  }
  toast(t.title, t.body, PIC(t.icon), typeof frame.sessionId === 'string' ? frame.sessionId : undefined);
}

/** 申请通知权限的结果；失败时带原因与可选文案，供设置页红字展示。 */
export type PermissionResult =
  { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'rejected' | 'error'; message?: string };

/**
 * 申请浏览器通知权限，必须在用户手势（点击）下调用，否则可能被静默压制。
 * 失败原因：`unsupported` 无 Notification、`denied` 已被阻止、`rejected` 询问时选了阻止、`error` 申请异常。
 */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (typeof Notification === 'undefined') return { ok: false, reason: 'unsupported' };
  if (Notification.permission === 'granted') return { ok: true };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  try {
    const p = await Notification.requestPermission();
    if (p === 'granted') return { ok: true };
    if (p === 'denied') return { ok: false, reason: 'rejected' };
    // 弹窗被直接关掉 / 未选择：浏览器仍是 default。
    return { ok: false, reason: 'error', message: '权限未授予（' + p + '）' };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** 读系统通知总开关（成品配置 main 条目）；拉取或解析失败时按开启处理，不阻塞。 */
async function readNotifyConfig(): Promise<{ enabled: boolean; summon: SummonUiConfig }> {
  const fallback = { enabled: true, summon: DEFAULT_SUMMON_UI };
  try {
    const r = await fetch('/dsh-pet-7340/config');
    if (!r.ok) return fallback;
    const d = (await r.json().catch(() => null)) as {
      main?: { notificationsEnabled?: unknown; summon?: Record<string, unknown> };
    } | null;
    const enabled = typeof d?.main?.notificationsEnabled === 'boolean' ? d.main.notificationsEnabled : true;
    const raw = d?.main?.summon;
    const q = raw?.quietHours;
    const quietHours =
      q === null
        ? null
        : q && typeof q === 'object' && clockMinutes((q as { start?: unknown }).start) !== null &&
            clockMinutes((q as { end?: unknown }).end) !== null
          ? { start: String((q as { start?: unknown }).start), end: String((q as { end?: unknown }).end) }
          : DEFAULT_SUMMON_UI.quietHours;
    return {
      enabled,
      summon: {
        enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_SUMMON_UI.enabled,
        sound: typeof raw?.sound === 'boolean' ? raw.sound : DEFAULT_SUMMON_UI.sound,
        quietHours,
      },
    };
  } catch {
    return fallback;
  }
}

/** 重读总开关（设置页保存开关后调用）；之后新触发的通知按新值执行，无需刷新页面。 */
export async function reloadNotifications(): Promise<void> {
  const cfg = await readNotifyConfig();
  notifyEnabled = cfg.enabled;
  summonConfig = cfg.summon;
}

/** 一帧通知 → toast；由容器统一轮询 `/state` 发现 `sections.notify` 变化后调用。 */
export function notifyFromFrame(frame: unknown): void {
  toastFrame(frame as NotifyFrame);
}

/**
 * 初始化通知引擎：记住会话跳转器、读总开关、兜底申请权限并跟踪页面聚焦；不做轮询。
 * @param navigator - 会话跳转器；不传时点击只叫窗口、不跳会话。
 * @returns 释放函数，摘掉聚焦监听。
 */
export function initNotify(navigator?: SessionNavigator): () => void {
  sessionNavigator = navigator;
  // 总开关读成品配置（拉取失败不阻塞，默认开启）；之后由设置页保存后 reloadNotifications 重读。
  void readNotifyConfig().then((cfg) => {
    notifyEnabled = cfg.enabled;
    summonConfig = cfg.summon;
    if (typeof Notification !== 'undefined' && cfg.enabled && Notification.permission === 'default') {
      // 兜底申请；无手势时浏览器可能压制，真正的申请在设置页开关或按钮点击处。
      void requestNotificationPermission();
    }
  });
  return initFocusTracking();
}
