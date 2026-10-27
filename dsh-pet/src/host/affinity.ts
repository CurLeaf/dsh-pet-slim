/**
 * 亲密度：点击 / 甩抛 / 对话的累计计数与等级（纯计数 + 落盘，无 UI）。
 *
 * 只影响本地台词的档位（见 local-lines.ts），不做数值面板、不做养成数值——避免宠物变成第二份工作。
 * 文件：`$DSH_HOME/dsh-pet/affinity.json`；写盘去抖 400ms，插件卸载时 flush。
 *
 * @module dsh-pet/src/host/affinity
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** 累计计数。 */
export interface AffinityStats {
  clicks: number;
  throws: number;
  chats: number;
  /** 首次记录时间（ms） */
  since: number;
}

/** 等级阈值：分数 = clicks + throws×2 + chats×3。 */
const TIER_THRESHOLDS = [10, 50, 200] as const;

/** 分数 → 等级 0-3（0 陌生 / 1 熟悉 / 2 亲近 / 3 黏人）。 */
export function tierOf(stats: AffinityStats): 0 | 1 | 2 | 3 {
  const score = stats.clicks + stats.throws * 2 + stats.chats * 3;
  if (score >= TIER_THRESHOLDS[2]) return 3;
  if (score >= TIER_THRESHOLDS[1]) return 2;
  if (score >= TIER_THRESHOLDS[0]) return 1;
  return 0;
}

/** 等级对外的中文名（设置页展示用）。 */
export function tierName(tier: 0 | 1 | 2 | 3): string {
  return ['陌生', '熟悉', '亲近', '黏人'][tier] ?? '陌生';
}

/** 计数种类。 */
export type AffinityKind = 'clicks' | 'throws' | 'chats';

/** 读文件：不存在/损坏 → 零值（不报错、不覆盖用户文件）。 */
export function readAffinity(path: string): AffinityStats {
  try {
    if (!existsSync(path)) return { clicks: 0, throws: 0, chats: 0, since: Date.now() };
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const n = (v: unknown): number => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);
    return {
      clicks: n(raw.clicks),
      throws: n(raw.throws),
      chats: n(raw.chats),
      since: n(raw.since) || Date.now(),
    };
  } catch {
    return { clicks: 0, throws: 0, chats: 0, since: Date.now() };
  }
}

/**
 * 亲密度存储：内存态 + 去抖落盘。
 *
 * 不做跨进程锁：唯一写入方是宿主进程（与 main-config 同一条约束），多窗口只读 /state。
 */
export class AffinityStore {
  declare private readonly path: string;
  declare private stats: AffinityStats;
  declare private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(path: string) {
    this.path = path;
    this.stats = readAffinity(path);
  }

  /** 当前计数（副本，调用方改不到内部状态）。 */
  get(): AffinityStats {
    return { ...this.stats };
  }

  /** 当前等级。 */
  tier(): 0 | 1 | 2 | 3 {
    return tierOf(this.stats);
  }

  /** 累加一次；返回新等级（调用方据此决定要不要提示）。 */
  bump(kind: AffinityKind): 0 | 1 | 2 | 3 {
    this.stats[kind] += 1;
    this.scheduleSave();
    return this.tier();
  }

  /** 清零（设置页按钮）。 */
  reset(): void {
    this.stats = { clicks: 0, throws: 0, chats: 0, since: Date.now() };
    this.scheduleSave();
  }

  /** 立即落盘（卸载/退出时调用）。 */
  flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(this.path, JSON.stringify({ version: 1, ...this.stats }, null, 2), 'utf8');
    } catch {
      /* 写失败只影响下次启动的初始等级，不打断宠物 */
    }
  }

  private scheduleSave(): void {
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flush();
    }, 400);
    this.timer.unref?.();
  }
}
