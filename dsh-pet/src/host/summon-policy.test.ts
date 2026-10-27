/**
 * 召唤规则的单测：时长门槛、免打扰时段、合并器状态机都是纯函数，直接喂时间戳断言。
 *
 * @module dsh-pet/src/host/summon-policy.test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CompletionCoalescer,
  DEFAULT_SUMMON,
  formatDuration,
  inQuietHours,
  normalizeSummon,
  parseClock,
  qualifyCompletion,
} from './summon-policy.ts';

test('normalizeSummon：空/非法输入一律回落默认，不抛错', () => {
  assert.deepEqual(normalizeSummon(undefined), DEFAULT_SUMMON);
  assert.deepEqual(normalizeSummon(null), DEFAULT_SUMMON);
  assert.deepEqual(normalizeSummon('oops'), DEFAULT_SUMMON);
  assert.deepEqual(normalizeSummon([]), DEFAULT_SUMMON);
  assert.deepEqual(normalizeSummon({}), DEFAULT_SUMMON);
});

test('normalizeSummon：合法字段被采纳，数值夹到合理区间', () => {
  const cfg = normalizeSummon({
    enabled: false,
    minTurnSeconds: 300,
    coalesceSeconds: 90,
    sound: false,
    quietHours: { start: '22:30', end: '07:15' },
  });
  assert.deepEqual(cfg, {
    enabled: false,
    minTurnSeconds: 300,
    coalesceSeconds: 90,
    sound: false,
    quietHours: { start: '22:30', end: '07:15' },
  });

  const clamped = normalizeSummon({ minTurnSeconds: 1, coalesceSeconds: 9999 });
  assert.equal(clamped.minTurnSeconds, 10, '下限 10 秒');
  assert.equal(clamped.coalesceSeconds, 600, '上限 600 秒');
});

test('normalizeSummon：quietHours 写坏 → 告警并回落默认；显式 null → 关闭免打扰', () => {
  const warnings: string[] = [];
  const bad = normalizeSummon({ quietHours: { start: '25:00', end: '08:00' } }, (m) => warnings.push(m));
  assert.deepEqual(bad.quietHours, DEFAULT_SUMMON.quietHours);
  assert.ok(warnings.some((w) => w.includes('quietHours')), '必须留下告警');

  const off = normalizeSummon({ quietHours: null });
  assert.equal(off.quietHours, null);
});

test('parseClock：只接受 0-23:00-59 的 HH:MM', () => {
  assert.equal(parseClock('00:00'), 0);
  assert.equal(parseClock('7:05'), 425);
  assert.equal(parseClock('23:59'), 1439);
  for (const bad of ['24:00', '12:60', '12', '12:5', '', null, undefined, 'ab:cd']) {
    assert.equal(parseClock(bad as unknown), null, String(bad));
  }
});

test('inQuietHours：普通时段 / 跨零点 / 边界 / 关闭', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 27, h, m, 0, 0);
  const night = { start: '23:00', end: '08:00' };
  assert.equal(inQuietHours(night, at(23, 0)), true, '起点含');
  assert.equal(inQuietHours(night, at(2, 30)), true, '跨零点');
  assert.equal(inQuietHours(night, at(7, 59)), true);
  assert.equal(inQuietHours(night, at(8, 0)), false, '终点不含');
  assert.equal(inQuietHours(night, at(12, 0)), false);
  assert.equal(inQuietHours(null, at(2)), false, '未配置');
  assert.equal(inQuietHours({ start: '09:00', end: '09:00' }, at(9)), false, '起止相同视为关闭');

  const noon = { start: '12:00', end: '13:30' };
  assert.equal(inQuietHours(noon, at(12, 30)), true);
  assert.equal(inQuietHours(noon, at(13, 30)), false);
});

test('qualifyCompletion：门槛与开关', () => {
  const cfg = { ...DEFAULT_SUMMON, minTurnSeconds: 120 };
  assert.equal(qualifyCompletion(119, cfg), false);
  assert.equal(qualifyCompletion(120, cfg), true, '达到门槛即算');
  assert.equal(qualifyCompletion(600, cfg), true);
  assert.equal(qualifyCompletion(600, { ...cfg, enabled: false }), false);
  assert.equal(qualifyCompletion(Number.NaN, cfg), false, '脏数据不召唤');
  assert.equal(qualifyCompletion(-1, cfg), false);
});

test('formatDuration：秒 / 分 / 小时三档可读', () => {
  assert.equal(formatDuration(42), '42 秒');
  assert.equal(formatDuration(312), '5 分 12 秒');
  assert.equal(formatDuration(3700), '1 小时 01 分');
  assert.equal(formatDuration(-5), '0 秒');
});

test('CompletionCoalescer：首条立即发，窗口内合并，flush 发汇总', () => {
  const c = new CompletionCoalescer(60);
  const t0 = 1_000_000;

  assert.deepEqual(c.push(200, t0), { emit: true, count: 1, seconds: 200 }, '首条立即发');
  assert.deepEqual(c.push(300, t0 + 10_000), { emit: false, count: 0, seconds: 0 }, '窗口内不发');
  assert.equal(c.pending, 1);

  assert.deepEqual(c.flush(t0 + 60_000), { emit: true, count: 1, seconds: 300 }, '汇总发一条');
  assert.equal(c.pending, 0);
  assert.deepEqual(c.flush(t0 + 70_000), { emit: false, count: 0, seconds: 0 }, '没有积压不再发');
});

test('CompletionCoalescer：窗口结束后的首条把积压一并计入', () => {
  const c = new CompletionCoalescer(30);
  const t0 = 2_000_000;
  c.push(150, t0); // 立即发
  c.push(400, t0 + 5_000); // 积压
  c.push(500, t0 + 6_000); // 积压

  const next = c.push(600, t0 + 31_000);
  assert.equal(next.emit, true);
  assert.equal(next.count, 3, '1 条新 + 2 条积压');
  assert.equal(next.seconds, 600, '时长取最长');
});

test('CompletionCoalescer：reset 后回到初始状态', () => {
  const c = new CompletionCoalescer(60);
  c.push(200, 3_000_000);
  c.push(300, 3_000_001);
  assert.equal(c.pending, 1);
  c.reset();
  assert.equal(c.pending, 0);
  assert.equal(c.push(200, 3_000_002).emit, true, 'reset 后首条立即发');
});
