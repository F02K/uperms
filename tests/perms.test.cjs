const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { Permissions } = require('../dist/server/service.js');
const { matches, specificity } = require('../dist/server/matcher.js');
const { JsonStorage } = require('../dist/server/storage.js');
const { MysqlStorage, parseConnectionString } = require('../dist/server/mysql-storage.js');
const { runCommand, parseDuration } = require('../dist/server/commands.js');

const OWNER = '76561199000000001', A = '76561199000000002', B = '76561199000000003';
const config = { owners: [OWNER], storage: 'json', defaultGroup: 'default', commandPrefix: 'uperms', mysql: { table: 'uperms_data', connectionLimit: 10, slowQueryWarningMs: 0, debug: false } };
const memory = () => { const s = { data: null, saves: 0, load: async () => s.data, save: async d => { s.data = JSON.parse(JSON.stringify(d)); s.saves++; } }; return s; };
async function make(storage = memory()) { const p = new Permissions(config, storage); await p.start(); return { p, storage }; }
const player = steamId => ({ steamId });

test('matcher: wildcards and specificity', () => {
  assert.ok(matches('*', 'a.b'));
  assert.ok(matches('job.*', 'job.police.arrest'));
  assert.ok(!matches('job.*', 'job'));
  assert.ok(!matches('job.*', 'jobs.x'));
  assert.ok(matches('a.b', 'a.b') && !matches('a.b', 'a.b.c'));
  assert.ok(specificity('a.b') > specificity('a.*') && specificity('a.*') > specificity('*'));
});

test('default is deny; owners always pass; not loaded means owners only', async () => {
  const { p } = await make();
  assert.equal(p.can(player(A), 'admin.kick'), false);
  assert.equal(p.can(player(OWNER), 'anything.at.all'), true);
  const cold = new Permissions(config, memory());
  assert.equal(cold.can(player(OWNER), 'x'), true);
  assert.equal(cold.can(player(A), 'x'), false);
  assert.throws(() => cold.grant('t', player(A), 'x'), /not loaded/);
});

test('groups inherit through parents; default group applies to everyone', async () => {
  const { p } = await make();
  p.grantGroup('t', 'default', 'chat.say');
  p.createGroup('t', 'helper'); p.grantGroup('t', 'helper', 'admin.kick');
  p.createGroup('t', 'mod', ['helper']); p.grantGroup('t', 'mod', 'admin.ban');
  p.addToGroup('t', player(A), 'mod');
  assert.ok(p.can(player(A), 'admin.kick') && p.can(player(A), 'admin.ban') && p.can(player(A), 'chat.say'));
  assert.ok(p.can(player(B), 'chat.say') && !p.can(player(B), 'admin.kick'));
  assert.throws(() => p.setParents('t', 'helper', ['mod']), /itself/);
});

test('precedence: specific beats wildcard, subject beats group, deny beats allow on a tie', async () => {
  const { p } = await make();
  p.createGroup('t', 'admin'); p.grantGroup('t', 'admin', 'admin.*'); p.grantGroup('t', 'admin', 'admin.ban', { effect: 'deny' });
  p.addToGroup('t', player(A), 'admin');
  assert.ok(p.can(player(A), 'admin.kick') && !p.can(player(A), 'admin.ban'));
  p.grant('t', player(A), 'admin.ban'); // same specificity, closer source
  assert.ok(p.can(player(A), 'admin.ban'));
  p.grant('t', player(A), 'admin.kick', { effect: 'deny' });
  assert.ok(!p.can(player(A), 'admin.kick'));
});

test('expiry on rules and memberships', async () => {
  const { p } = await make();
  p.grant('t', player(A), 'event.host', { expires: Date.now() + 60_000 });
  assert.ok(p.can(player(A), 'event.host'));
  p.grant('t', player(A), 'event.host', { expires: Date.now() - 1 });
  assert.ok(!p.can(player(A), 'event.host'));
  p.createGroup('t', 'vip'); p.grantGroup('t', 'vip', 'vip.door');
  p.addToGroup('t', player(B), 'vip', Date.now() - 1);
  assert.ok(!p.can(player(B), 'vip.door'));
});

test('conditions: built-in ctx, plugins, unknown and throwing fail closed', async () => {
  const { p } = await make();
  p.registerCondition('night', (arg, ctx) => ctx.hour >= 20 === arg);
  p.grant('t', player(A), 'job.guard.arrest', { when: { ctx: { onDuty: true } } });
  assert.ok(p.can(player(A), 'job.guard.arrest', { onDuty: true }));
  assert.ok(!p.can(player(A), 'job.guard.arrest', { onDuty: false }));
  assert.ok(!p.can(player(A), 'job.guard.arrest'));
  p.grant('t', player(A), 'x.night', { when: { night: true } });
  assert.ok(p.can(player(A), 'x.night', { hour: 22 }) && !p.can(player(A), 'x.night', { hour: 9 }));
  p.grant('t', player(A), 'x.unknown', { when: { nope: 1 } });
  assert.ok(!p.can(player(A), 'x.unknown'));
  p.registerCondition('boom', () => { throw new Error('x'); });
  p.grant('t', player(A), 'x.boom', { when: { boom: 1 } });
  assert.ok(!p.can(player(A), 'x.boom'));
});

test('free-form subjects and validation', async () => {
  const { p } = await make();
  p.grant('t', 'faction:guards', 'gate.use');
  assert.ok(p.can('faction:guards', 'gate.use'));
  assert.throws(() => p.grant('t', A, 'bad node!'), /Invalid node/);
  assert.equal(p.can(player(A), 'bad node!'), false);
});

test('JSON storage: changes persist and reload; corrupt file does not start', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uperms-')), 'd', 'uperms.json');
  const one = await make(new JsonStorage(file));
  one.p.grant('t', player(A), 'a.b'); await one.p.flush();
  const two = await make(new JsonStorage(file));
  assert.ok(two.p.can(player(A), 'a.b'));
  fs.writeFileSync(file, '{"version":1,"groups":"x"}');
  const bad = new Permissions(config, new JsonStorage(file), () => {});
  await bad.start(3_600_000);
  assert.equal(bad.isReady(), false);
  assert.equal(bad.can(player(OWNER), 'x'), true);
});

test('MySQL: connection string formats', () => {
  assert.deepEqual(parseConnectionString('mysql://us%40er:p%3Ass@db.example:3307/uperms'), { host: 'db.example', port: 3307, database: 'uperms', user: 'us@er', password: 'p:ss' });
  assert.deepEqual(parseConnectionString('host=h;database=d;uid=u;pwd=p'), { host: 'h', port: 3306, database: 'd', user: 'u', password: 'p' });
  assert.equal(parseConnectionString(''), null);
  assert.equal(parseConnectionString('nonsense'), null);
});

function fakePool(over = {}) {
  const log = [];
  const pool = { log, ended: 0, stored: '', query: async (sql, values) => {
    log.push([sql, values]);
    if (over.fail?.test(sql)) throw new Error('boom');
    if (/^SELECT data/.test(sql)) return [[{ data: pool.stored }], []];
    if (/^INSERT/.test(sql)) pool.stored = values[0];
    return [[], []];
  }, end: async () => { pool.ended++; } };
  return pool;
}
const options = { connectionString: 'mysql://u:p@h/d', table: 'uperms_data', connectionLimit: 10, slowQueryWarningMs: 0, debug: false };

test('MySQL storage: round trip through the driver, one pool, closed on stop', async () => {
  const pool = fakePool(); let made = 0, limit = 0;
  const storage = new MysqlStorage(options, () => {}, (_c, l) => { made++; limit = l; return pool; });
  assert.equal(await storage.load(), null);
  const data = { version: 1, groups: {}, subjects: {}, audit: [] };
  await storage.save(data);
  assert.deepEqual(await storage.load(), data);
  assert.equal(made, 1); assert.equal(limit, 10);
  assert.ok(pool.log.some(([sql]) => /^CREATE TABLE IF NOT EXISTS `uperms_data`/.test(sql)));
  await storage.close();
  assert.equal(pool.ended, 1);
});

test('MySQL storage: failures throw, so an error is never read as empty data', async () => {
  const bad = new MysqlStorage(options, () => {}, () => fakePool({ fail: /^SELECT data/ }));
  await assert.rejects(bad.load(), /boom/);
  const down = fakePool({ fail: /^SELECT 1/ });
  await assert.rejects(new MysqlStorage(options, () => {}, () => down).load(), /boom/);
  assert.equal(down.ended, 1);
  await assert.rejects(new MysqlStorage({ ...options, connectionString: '' }, () => {}, () => fakePool()).load(), /connection string/);
  await assert.rejects(new MysqlStorage(options, () => {}, () => { throw new Error('mysql2 package missing'); }).load(), /mysql2 package missing/);
  assert.throws(() => new MysqlStorage({ ...options, table: 'x; DROP' }), /invalid/);
});

test('MySQL storage: a failed load leaves uperms degraded, owners only, writes refused', async () => {
  const p = new Permissions(config, new MysqlStorage(options, () => {}, () => fakePool({ fail: /^SELECT data/ })), () => {});
  await p.start(3_600_000);
  assert.equal(p.isReady(), false);
  assert.ok(p.can(player(OWNER), 'x') && !p.can(player(A), 'x'));
  assert.throws(() => p.grant('t', player(A), 'x'), /not loaded/);
});

test('commands: need uperms.manage and cannot hand out what you do not hold', async () => {
  const { p } = await make();
  const said = [];
  const host = { perms: p, find: id => ({ 2: { steamId: A, nickname: 'Anna' }, 3: { steamId: B, nickname: 'Ben' } }[id] ?? null), reply: (_pl, t) => said.push(t) };
  runCommand(host, player(A), ['info', '3']);
  assert.match(said.at(-1), /Missing permission: uperms.manage/);
  p.grant('t', player(A), 'uperms.manage'); p.grant('t', player(A), 'admin.kick');
  runCommand(host, player(A), ['grant', '3', 'admin.kick']);
  assert.ok(p.can(player(B), 'admin.kick'));
  runCommand(host, player(A), ['grant', '3', 'admin.ban']);
  assert.match(said.at(-1), /Missing permission: admin.ban/);
  assert.ok(!p.can(player(B), 'admin.ban'));
  runCommand(host, player(A), ['group', 'add', '3', 'default']);
  assert.match(said.at(-1), /uperms.group.default/);
  runCommand(host, player(OWNER), ['group', 'create', 'helper']);
  runCommand(host, player(OWNER), ['group', 'add', '3', 'helper', '2h']);
  assert.ok(p.getSubject(player(B)).groups.find(m => m.group === 'helper').expires > Date.now());
  runCommand(host, player(OWNER), ['info', '99']);
  assert.match(said.at(-1), /Player not found/);
  assert.equal(parseDuration('30m', 0), 1_800_000);
  assert.equal(parseDuration('deny'), null);
});
