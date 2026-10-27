/**
 * 召唤链路的宿主级集成测试：真实 apply(host) + 真实路由 + 真实 session/event 投递。
 *
 * 与 summon-policy.test 的分工：那边测纯规则；这里测「事件 → notify 叶子」的接线，
 * 覆盖时长阈值、提问即时、错误即时、短回合不写帧。
 *
 * @module dsh-pet/src/host/summon.integration.test
 */
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';

import { rolldown } from 'rolldown';

import { createStandaloneContext } from '../standalone/context.ts';
import { createRequestSecurity } from '../standalone/request-security.ts';
import { listenStandaloneServer } from '../standalone/server.ts';

const source = fileURLToPath(new URL('..', import.meta.url));

let dir = '';
let home = '';
let base = '';
let token = '';
let server: Awaited<ReturnType<typeof listenStandaloneServer>>;
let context: ReturnType<typeof createStandaloneContext>;
const handlers = new Map<string, (session: unknown, event: unknown) => void>();
const realNow = Date.now;
let fakeNow = realNow();

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dsh-pet-summon-'));
  const pkg = join(dir, 'package');
  mkdirSync(join(pkg, 'assets'), { recursive: true });
  copyFileSync(new URL('../../assets/config.jsonc', import.meta.url), join(pkg, 'assets/config.jsonc'));
  copyFileSync(new URL('../../assets/lines.json', import.meta.url), join(pkg, 'assets/lines.json'));

  const aliases = Object.fromEntries(
    ['dsh-home-paths', 'dsh-credentials', 'dsh-llm'].map((name) => [
      '@deepseek-ai/' + name,
      join(source, 'standalone/shims', name + '.ts'),
    ]),
  );
  const bundle = await rolldown({
    input: join(source, 'host/index.ts'),
    platform: 'node',
    external: (id) =>
      id.startsWith('node:') ||
      (id.startsWith('@deepseek-ai/') && !(id in aliases)) ||
      ['zod', '@electron/get', '@electron-internal/extract-zip'].includes(id),
    plugins: [{ name: 'summon-test-shims', resolveId: (id) => aliases[id] }],
  });
  const entry = join(pkg, 'lib/host.mjs');
  await bundle.write({ format: 'esm', file: entry });
  await bundle.close();

  home = join(dir, 'home');
  process.env.DSH_HOME = home;
  process.env.DSH_PET_IN_PROCESS = '1';
  mkdirSync(join(home, 'dsh-pet/pet'), { recursive: true });
  writeFileSync(
    join(home, 'dsh-pet/main-config.jsonc'),
    JSON.stringify({
      trayEnabled: false,
      notificationsEnabled: true,
      summon: { enabled: true, minTurnSeconds: 10, coalesceSeconds: 60, sound: false, quietHours: null },
      pets: [
        {
          id: 'main',
          name: 'main',
          size: 260,
          display: 'web',
          whisperEnabled: false,
          workStatusEnabled: true,
          fixedEnabled: false,
          position: { corner: 'top-right', marginX: 10, marginY: 10 },
        },
      ],
    }),
  );

  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  context = createStandaloneContext({ port: 0, logger });
  // 夹具的 on 是 noop：换成记录器，测试据此投递 DSH 会话事件
  (context.ctx as unknown as { on: (name: string, cb: (s: unknown, e: unknown) => void) => () => void }).on = (
    name,
    cb,
  ) => {
    handlers.set(name, cb);
    return () => {};
  };
  const { apply } = await import(pathToFileURL(entry).href);
  apply(context.ctx);

  const security = createRequestSecurity();
  token = security.token;
  server = await listenStandaloneServer({ routes: context.routes, logger, port: 0, security });
  base = `http://127.0.0.1:${server.port}/dsh-pet-7340`;
});

after(async () => {
  Date.now = realNow;
  await server?.close();
  await context?.dispose();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DSH_HOME;
  delete process.env.DSH_PET_IN_PROCESS;
});

/** 投递一条会话事件（主会话 s1）。 */
function emit(type: string, data: Record<string, unknown> = {}): void {
  const cb = handlers.get('session/event');
  assert.ok(cb, 'host 必须订阅 session/event');
  cb({ id: 's1', header: { id: 's1' } }, { type, data });
}

/** 读当前 notify 叶子。 */
async function notifyLeaf(): Promise<{ counter: number; data: unknown }> {
  const res = await fetch(base + '/state', { headers: { 'X-DSH-Pet-Token': token } });
  const body = (await res.json()) as { sections: { notify: { counter: number; data: unknown } } };
  return body.sections.notify;
}

test('ask_user_question → 立即写 question 帧（summon.kind=question）', async () => {
  emit('tool/call', {
    name: 'ask_user_question',
    arguments: JSON.stringify({ questions: [{ question: '选 A 还是 B？' }] }),
  });
  const leaf = await notifyLeaf();
  const frame = leaf.data as { type?: string; summon?: { kind?: string } };
  assert.equal(frame.type, 'question/requested');
  assert.equal(frame.summon?.kind, 'question');
});

test('长回合完成 → 经活动门后写 summon/done（含时长）', async () => {
  Date.now = () => fakeNow;
  fakeNow = realNow();
  emit('turn/start', { turn: 1 });
  fakeNow += 200_000; // 200 秒
  emit('turn/end', { reason: { kind: 'completed' } });
  // 活动门 1.5s：等它过去再看叶子
  await new Promise((r) => setTimeout(r, 1800));
  const leaf = await notifyLeaf();
  const frame = leaf.data as { type?: string; summon?: { kind?: string; seconds?: number } };
  assert.equal(frame.type, 'summon/done');
  assert.equal(frame.summon?.kind, 'done');
  assert.ok(Math.abs(Number(frame.summon?.seconds) - 200) <= 1, '时长取 turn/start → turn/end 的差');
});

test('短回合完成 → 不写帧（阈值过滤）', async () => {
  const before = await notifyLeaf();
  fakeNow = realNow();
  emit('turn/start', { turn: 2 });
  fakeNow += 5_000; // 5 秒
  emit('turn/end', { reason: { kind: 'completed' } });
  await new Promise((r) => setTimeout(r, 1800));
  const after = await notifyLeaf();
  assert.equal(after.counter, before.counter, '短回合不得推进 notify 计数器');
});

test('出错回合 → 立即写错误帧（summon.kind=error）', async () => {
  fakeNow = realNow();
  emit('turn/end', { reason: { kind: 'error', error: { message: 'boom' } } });
  const leaf = await notifyLeaf();
  const frame = leaf.data as { type?: string; summon?: { kind?: string } };
  assert.equal(frame.summon?.kind, 'error');
});
