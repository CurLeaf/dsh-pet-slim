/**
 * 本地台词库：零模型成本的碎碎念选句（纯函数，可离线单测）。
 *
 * 设计：周期碎碎念不再每次调模型，而是从 `assets/lines.json` 里按优先级挑一句——
 * 节日 > 当前工作状态 > 时段；亲密度达到 2 级后按概率混入「亲近」台词。
 * 只负责选句：读文件、写 /state、节流由宿主半侧的其他代码负责。
 *
 * @module dsh-pet/src/host/local-lines
 */

/** 台词库结构（与 assets/lines.json 同构）。 */
export interface LinePools {
  byState: Record<string, string[]>;
  byTime: Record<string, string[]>;
  festival: Record<string, string[]>;
  intimate: string[];
}

/** 时段 id。 */
export type TimeSlot = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

/** 小时 → 时段。 */
export function timeSlotOf(hour: number): TimeSlot {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

/** 日期 → 公历节日键（MM-DD）；没有对应节日返回 null。 */
export function festivalKeyOf(date: Date): string | null {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return mm + '-' + dd;
}

/** 从候选里剔除最近说过的那几句；全被剔除则退回原池（宁可重复，不能没话说）。 */
function fresh(pool: string[], recent: readonly string[]): string[] {
  const out = pool.filter((line) => !recent.includes(line));
  return out.length > 0 ? out : pool;
}

/** 选句参数。 */
export interface PickOptions {
  /** 当前工作状态档位；null = 空闲 */
  state: string | null;
  /** 本地小时（0-23） */
  hour: number;
  /** 当前日期（节日判定） */
  date: Date;
  /** 亲密度等级（0-3） */
  tier: number;
  /** 最近说过的句子（最多保留 3 条，供去重） */
  recent: readonly string[];
  /** 随机源（注入便于测试） */
  rng: () => number;
}

/**
 * 选一句台词。
 *
 * 优先级（命中即返回）：
 * 1. 节日池（20% 概率，避免整天只说过节）；
 * 2. 有工作状态 → 该状态池；
 * 3. 亲密度 ≥ 2 时空闲有 35% 概率说亲近台词；
 * 4. 时段池。
 */
export function pickLocalLine(pools: LinePools, opts: PickOptions): string {
  const roll = opts.rng();

  const festival = pools.festival[festivalKeyOf(opts.date) ?? ''];
  if (festival && festival.length > 0 && roll < 0.2) {
    return pick(festival, opts);
  }

  if (opts.state && pools.byState[opts.state]?.length) {
    return pick(pools.byState[opts.state], opts);
  }

  if (opts.tier >= 2 && pools.intimate.length > 0 && roll > 0.65) {
    return pick(pools.intimate, opts);
  }

  const slotPool = pools.byTime[timeSlotOf(opts.hour)];
  if (slotPool?.length) return pick(slotPool, opts);

  // 兜底：任意一条，绝不返回空串（调用方据此决定是否写气泡）
  const all = Object.values(pools.byState).flat();
  return all.length > 0 ? pick(all, opts) : '……';
}

/** 从池内按 rng 抽 1，优先避重。 */
function pick(pool: string[], opts: PickOptions): string {
  const candidates = fresh(pool, opts.recent);
  const index = Math.min(candidates.length - 1, Math.floor(opts.rng() * candidates.length));
  return candidates[index] ?? pool[0] ?? '……';
}

/** 基础校验：结构不对的行直接丢弃，缺池返回空数组（不阻塞启动）。 */
export function normalizePools(raw: unknown): LinePools {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
  const record = (value: unknown): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
    for (const [key, list] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = strings(list);
      if (cleaned.length > 0) out[key] = cleaned;
    }
    return out;
  };
  return {
    byState: record(root.byState),
    byTime: record(root.byTime),
    festival: record(root.festival),
    intimate: strings(root.intimate),
  };
}
