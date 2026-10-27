/**
 * 亲密度的单测：等级阈值、文件读取容错、累加/清零/落盘。
 *
 * @module dsh-pet/src/host/affinity.test
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { AffinityStore, readAffinity, tierName, tierOf } from './affinity.ts';

const zero = { clicks: 0, throws: 0, chats: 0, since: 0 };

test('tierOf：分数 = 点击 + 甩抛×2 + 对话×3，阈值 10/50/200', () => {
  assert.equal(tierOf({ ...zero, clicks: 9 }), 0);
  assert.equal(tierOf({ ...zero, clicks: 10 }), 1);
  assert.equal(tierOf({ ...zero, throws: 25 }), 2, '25×2=50');
  assert.equal(tierOf({ ...zero, chats: 67 }), 3, '67×3=201');
  assert.equal(tierName(0), '陌生');
  assert.equal(tierName(3), '黏人');
});

test('readAffinity：文件缺失 → 零值；损坏 → 零值不抛错', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pet-affinity-'));
  const missing = readAffinity(join(dir, 'nope.json'));
  assert.equal(missing.clicks, 0);
  assert.ok(missing.since > 0);

  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{oops');
  assert.equal(readAffinity(bad).clicks, 0);
});

test('AffinityStore：bump 累加、reset 清零、flush 落盘可回读', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pet-affinity-'));
  const file = join(dir, 'affinity.json');
  writeFileSync(file, JSON.stringify({ version: 1, clicks: 2, throws: 1, chats: 0, since: 1 }));

  const store = new AffinityStore(file);
  assert.deepEqual(store.get(), { clicks: 2, throws: 1, chats: 0, since: 1 });
  store.bump('clicks');
  store.bump('chats');
  store.flush();

  const saved = JSON.parse(readFileSync(file, 'utf8')) as { clicks: number; throws: number; chats: number };
  assert.equal(saved.clicks, 3);
  assert.equal(saved.throws, 1);
  assert.equal(saved.chats, 1);

  store.reset();
  store.flush();
  const cleared = JSON.parse(readFileSync(file, 'utf8')) as { clicks: number };
  assert.equal(cleared.clicks, 0);
});
