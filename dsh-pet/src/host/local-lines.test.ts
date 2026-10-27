/**
 * 本地台词选句的单测：时段 / 节日 / 状态优先级 / 去重 / 亲近台词，全部注入 rng 与时间。
 *
 * @module dsh-pet/src/host/local-lines.test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { festivalKeyOf, normalizePools, pickLocalLine, timeSlotOf } from './local-lines.ts';

const pools = normalizePools({
  byState: { working: ['干活A', '干活B'], waiting: ['等你确认'] },
  byTime: { morning: ['早上好'], night: ['晚安'] },
  festival: { '01-01': ['新年快乐'] },
  intimate: ['最喜欢你了'],
});

const base = {
  state: null as string | null,
  hour: 9,
  date: new Date(2026, 9, 27, 9, 0, 0),
  tier: 0,
  recent: [] as string[],
  rng: () => 0.5,
};

test('timeSlotOf：五个时段的边界', () => {
  assert.equal(timeSlotOf(5), 'morning');
  assert.equal(timeSlotOf(10), 'morning');
  assert.equal(timeSlotOf(11), 'noon');
  assert.equal(timeSlotOf(14), 'afternoon');
  assert.equal(timeSlotOf(18), 'evening');
  assert.equal(timeSlotOf(23), 'night');
  assert.equal(timeSlotOf(2), 'night');
});

test('festivalKeyOf：MM-DD，未命中返回键（由调用方查表）', () => {
  assert.equal(festivalKeyOf(new Date(2026, 0, 1)), '01-01');
  assert.equal(festivalKeyOf(new Date(2026, 11, 25)), '12-25');
});

test('pickLocalLine：有工作状态时优先状态池', () => {
  const line = pickLocalLine(pools, { ...base, state: 'working' });
  assert.ok(['干活A', '干活B'].includes(line));
});

test('pickLocalLine：节日池在小概率下优先（rng < 0.2）', () => {
  const line = pickLocalLine(pools, {
    ...base,
    date: new Date(2026, 0, 1, 9),
    rng: () => 0.1,
  });
  assert.equal(line, '新年快乐');
});

test('pickLocalLine：空闲时回落到时段池', () => {
  assert.equal(pickLocalLine(pools, { ...base, hour: 9 }), '早上好');
  assert.equal(pickLocalLine(pools, { ...base, hour: 23 }), '晚安');
});

test('pickLocalLine：亲近台词只在 tier ≥ 2 且 rng > 0.65 时出现', () => {
  const hit = pickLocalLine(pools, { ...base, tier: 2, rng: () => 0.9 });
  assert.equal(hit, '最喜欢你了');
  const missTier = pickLocalLine(pools, { ...base, tier: 1, rng: () => 0.9 });
  assert.equal(missTier, '早上好');
  const missRoll = pickLocalLine(pools, { ...base, tier: 3, rng: () => 0.3 });
  assert.equal(missRoll, '早上好');
});

test('pickLocalLine：排除最近说过的句子；全被排除时退回原池', () => {
  const line = pickLocalLine(pools, {
    ...base,
    state: 'working',
    recent: ['干活A'],
    rng: () => 0.1,
  });
  assert.equal(line, '干活B', '唯一新鲜候选');
  const fallback = pickLocalLine(pools, {
    ...base,
    state: 'working',
    recent: ['干活A', '干活B'],
    rng: () => 0.1,
  });
  assert.ok(['干活A', '干活B'].includes(fallback));
});

test('normalizePools：丢弃空串/非字符串，缺池返回空数组', () => {
  const cleaned = normalizePools({ byState: { working: ['a', '', 3, 'b'] }, byTime: 'bad' });
  assert.deepEqual(cleaned.byState.working, ['a', 'b']);
  assert.deepEqual(cleaned.byTime, {});
  assert.deepEqual(cleaned.intimate, []);
});
