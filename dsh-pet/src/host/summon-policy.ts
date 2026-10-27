/**
 * 召唤（summon）规则：宿主半侧的纯逻辑，决定「这次回合结束值不值得叫你」。
 *
 * 背景：桌面通知已经由 notify-events.ts 统一产生，但「每个回合完成都弹」在长任务场景下是噪音，
 * 在短回合场景下是干扰。本模块只做三件事，全部可离线单测：
 *   1. 配置归一化（缺省/写错一律回落默认，不阻塞启动）；
 *   2. 时长门槛（默认 120 秒，短回合不叫你）；
 *   3. 完成事件的合并窗口（多会话同时收工时合并成一条）。
 *
 * 不负责发通知、不读文件、不碰 Date：时间一律由调用方传入，便于测试。
 *
 * @module dsh-pet/src/host/summon-policy
 */

/** 归一化后的召唤配置。 */
export interface SummonConfig {
  /** 总开关（关 = 不产生任何召唤通知，事件仍由既有通知链路写入 /state）。 */
  enabled: boolean;
  /** 回合时长门槛（秒）：完成事件只有达到它才召唤。 */
  minTurnSeconds: number;
  /** 合并窗口（秒）：窗口内再次完成不重复弹，累计到下一次汇总。 */
  coalesceSeconds: number;
  /** 声音开关（仅 question / error 发声）。 */
  sound: boolean;
  /** 免打扰时段（本地时间 HH:MM），null = 不启用。 */
  quietHours: { start: string; end: string } | null;
}

/** 默认值：120 秒门槛、60 秒合并窗口、23:00–08:00 免打扰、开放声音。 */
export const DEFAULT_SUMMON: SummonConfig = {
  enabled: true,
  minTurnSeconds: 120,
  coalesceSeconds: 60,
  sound: true,
  quietHours: { start: '23:00', end: '08:00' },
};

/** 时钟字符串 → 当日分钟数；非法（25:00、8:7、空）返回 null。 */
export function parseClock(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** 现在是否落在免打扰时段内；支持跨零点（23:00–08:00）。 */
export function inQuietHours(range: SummonConfig['quietHours'], date: Date): boolean {
  if (!range) return false;
  const start = parseClock(range.start);
  const end = parseClock(range.end);
  if (start === null || end === null) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  // start === end 视为「整天免打扰」在语义上不合理，按不启用处理（避免用户误配后收不到任何提醒）
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** 数值字段归一化：非有限数/越界 → 默认值。 */
function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * 原始配置 → 归一化配置。
 * @param raw - 成品配置里的 `summon` 段（可能缺失/写错）
 * @param warn - 可选告警回调（宿主用它写日志；测试可注入断言）
 */
export function normalizeSummon(raw: unknown, warn?: (message: string) => void): SummonConfig {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const enabled = typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_SUMMON.enabled;
  const minTurnSeconds = num(o.minTurnSeconds, DEFAULT_SUMMON.minTurnSeconds, 10, 7200);
  const coalesceSeconds = num(o.coalesceSeconds, DEFAULT_SUMMON.coalesceSeconds, 5, 600);
  const sound = typeof o.sound === 'boolean' ? o.sound : DEFAULT_SUMMON.sound;

  let quietHours: SummonConfig['quietHours'] = DEFAULT_SUMMON.quietHours;
  const q = o.quietHours;
  if (q === null) {
    quietHours = null;
  } else if (q && typeof q === 'object') {
    const start = (q as Record<string, unknown>).start;
    const end = (q as Record<string, unknown>).end;
    if (parseClock(start) !== null && parseClock(end) !== null) {
      quietHours = { start: String(start), end: String(end) };
    } else {
      warn?.('dsh-pet: summon.quietHours 不是合法 HH:MM，已回落默认');
    }
  }

  if (raw !== undefined && (o.enabled === undefined || o.minTurnSeconds === undefined)) {
    // 段存在但缺字段：只提示一次，避免每回合刷日志（调用方按配置变更频率调用）
    warn?.('dsh-pet: summon 配置不完整，缺失字段已取默认值');
  }

  return { enabled, minTurnSeconds, coalesceSeconds, sound, quietHours };
}

/** 这次回合完成是否值得召唤：开关打开且时长达到门槛。 */
export function qualifyCompletion(seconds: number, config: SummonConfig): boolean {
  if (!config.enabled) return false;
  if (!Number.isFinite(seconds) || seconds < 0) return false;
  return seconds >= config.minTurnSeconds;
}

/** 秒 → 人话时长：`42 秒` / `5 分 12 秒` / `1 小时 03 分`。 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return total + ' 秒';
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return minutes + ' 分 ' + String(total % 60).padStart(2, '0') + ' 秒';
  const hours = Math.floor(minutes / 60);
  return hours + ' 小时 ' + String(minutes % 60).padStart(2, '0') + ' 分';
}

/** 一次完成事件在合并器里的判定结果。 */
export interface CompletionDecision {
  /** 是否现在发一条通知 */
  emit: boolean;
  /** 本条通知代表几个回合（合并后可能 > 1） */
  count: number;
  /** 代表回合的时长（秒）；合并时取最长的一条 */
  seconds: number;
}

/**
 * 完成事件合并器（纯状态机）。
 *
 * 语义：第一条立即发；`coalesceSeconds` 窗口内后续完成不再单独发，累计计数；窗口到点后由
 * `flush` 发一条汇总（`count > 1` 时文案带「等 N 个任务」）。这样既不会延迟第一条，也不会连弹。
 */
export class CompletionCoalescer {
  private lastEmitAt = Number.NEGATIVE_INFINITY;
  private pendingCount = 0;
  private pendingMaxSeconds = 0;
  private readonly windowMs: number;

  constructor(coalesceSeconds: number) {
    this.windowMs = Math.max(5, Math.round(coalesceSeconds)) * 1000;
  }

  /** 收到一次合格完成；`now` 由调用方给（便于测试）。 */
  push(seconds: number, now: number): CompletionDecision {
    if (now - this.lastEmitAt >= this.windowMs) {
      // 窗口已过：本条立即发；之前积压的（若有）一并计入，避免汇总永远等不到下一拍
      const count = 1 + this.pendingCount;
      const maxSeconds = Math.max(seconds, this.pendingMaxSeconds);
      this.pendingCount = 0;
      this.pendingMaxSeconds = 0;
      this.lastEmitAt = now;
      return { emit: true, count, seconds: maxSeconds };
    }
    this.pendingCount += 1;
    this.pendingMaxSeconds = Math.max(this.pendingMaxSeconds, seconds);
    return { emit: false, count: 0, seconds: 0 };
  }

  /** 窗口到点：有积压则发一条汇总（由调用方定时调用）。 */
  flush(now: number): CompletionDecision {
    if (this.pendingCount === 0) return { emit: false, count: 0, seconds: 0 };
    const count = this.pendingCount;
    const seconds = this.pendingMaxSeconds;
    this.pendingCount = 0;
    this.pendingMaxSeconds = 0;
    this.lastEmitAt = now;
    return { emit: true, count, seconds };
  }

  /** 窗口长度（毫秒），调用方用来排定时器。 */
  get window(): number {
    return this.windowMs;
  }

  /** 是否还有积压（调用方在卸载/配置变更时判断要不要清定时器）。 */
  get pending(): number {
    return this.pendingCount;
  }

  /** 重置（配置变更/插件卸载）。 */
  reset(): void {
    this.lastEmitAt = Number.NEGATIVE_INFINITY;
    this.pendingCount = 0;
    this.pendingMaxSeconds = 0;
  }
}
