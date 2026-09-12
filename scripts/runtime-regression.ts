import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { resolveSqlConnection, SqlConfigurationError, sqlOnlineMode } from '../src/db/connectionConfig.ts';
import { KeyedSerialQueue } from '../src/keyedSerialQueue.js';

// Exercise the actual server functions with isolated dependencies. No production
// database, credentials, network service, or persisted user data is used here.
const source = fs.readFileSync('server.ts', 'utf8');
const ast = ts.createSourceFile('server.ts', source, ts.ScriptTarget.ES2022, true);
const quiet = { log() {}, warn() {}, error() {} };
const transpile = (text: string) => ts.transpileModule(text, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function serverFunction(name: string): string {
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, 'Missing server function: ' + name);
  return transpile(node.getText(ast));
}

function mountFilesystem(directories: string[]) {
  const dirs = new Set(directories);
  return {
    existsSync: (name: string) => dirs.has(name),
    readdirSync: (name: string) => [...dirs]
      .filter(item => path.posix.dirname(item) === name)
      .map(item => path.posix.basename(item)),
    statSync: (name: string) => ({ isDirectory: () => dirs.has(name) }),
  } as any;
}
const fixtureCreds = { SQL_USER: 'fixture_user', SQL_PASSWORD: 'fixture_password' };
const instanceA = 'fixture:region:instance-a';
const instanceB = 'fixture:region:instance-b';
const noMounts = mountFilesystem([]);
const sql = (env: NodeJS.ProcessEnv, online = true, files = noMounts) =>
  resolveSqlConnection(env, online, files);

await test('SQL: storage mode matches explicit mode and trusted Cloud Run markers', () => {
  assert.equal(sqlOnlineMode({}), false);
  assert.equal(sqlOnlineMode({ APP_MODE: 'online' }), true);
  assert.equal(sqlOnlineMode({ K_SERVICE: 'fixture', K_REVISION: 'revision' }), true);
  assert.equal(sqlOnlineMode({ K_SERVICE: 'fixture' }), false);
  assert.equal(sqlOnlineMode({ APP_MODE: 'offline', K_SERVICE: 'fixture', K_REVISION: 'revision' }), false);
});

await test('SQL: aliases, password bytes, database and custom port are consistent OFFLINE', () => {
  for (const credentials of [
    { SQL_USER: 'fixture', SQL_PASSWORD: ' space matters ' },
    { PGUSER: 'fixture', PGPASSWORD: ' space matters ' },
    { SQL_ADMIN_USER: 'fixture', SQL_ADMIN_PASSWORD: ' space matters ' },
  ]) {
    assert.deepEqual(sql({ ...credentials, PGDATABASE: 'fixture_db', PGPORT: '5544' }, false), {
      host: 'localhost', user: 'fixture', password: ' space matters ', database: 'fixture_db', port: 5544,
    });
  }
  assert.equal(sql({}, false).database, 'cloud_sql_production_database');
  assert.throws(() => sql({ ...fixtureCreds, SQL_PORT: '0' }), /SQL_PORT/);
  assert.throws(() => sql({ ...fixtureCreds, SQL_PORT: 'not-a-port' }), /SQL_PORT/);
});

await test('SQL: ONLINE rejects TCP, URL-only config, traversal, and missing credentials', () => {
  for (const host of ['localhost', '127.0.0.1', '/cloudsql/../tmp', '/cloudsql/..', '/cloudsql/', '/cloudsql/a/b']) {
    assert.throws(() => sql({ ...fixtureCreds, SQL_HOST: host }), { code: 'ONLINE_CLOUD_SQL_HOST_INVALID' });
  }
  assert.throws(() => sql({ DATABASE_URL: 'postgresql://ignored' }), { code: 'ONLINE_CLOUD_SQL_CONFIG_MISSING' });
  for (const name of ['..', '.', '../tmp', 'a/b']) {
    assert.throws(() => sql({ ...fixtureCreds, CLOUD_SQL_CONNECTION_NAME: name }), { code: 'ONLINE_CLOUD_SQL_CONNECTION_NAME_INVALID' });
  }
});

await test('SQL: explicit host wins and only an alternate mount of the same instance is accepted', () => {
  const mounts = mountFilesystem(['/app/cloudsql/' + instanceA, '/cloudsql/' + instanceB]);
  const result = sql({ ...fixtureCreds, SQL_HOST: '/cloudsql/' + instanceA, CLOUD_SQL_CONNECTION_NAME: instanceB }, true, mounts);
  assert.equal(result.host, '/app/cloudsql/' + instanceA);
  assert.equal(sql({ ...fixtureCreds, CLOUD_SQL_CONNECTION_NAME: instanceA }, true, mounts).host, result.host);
  assert.equal(sql({ ...fixtureCreds, SQL_HOST: '/cloudsql/' + instanceA }, true,
    mountFilesystem(['/cloudsql', '/cloudsql/' + instanceB])).host, '/cloudsql/' + instanceA);
});

await test('SQL: discovery accepts one logical instance and fails closed for zero, multiple or unreadable mounts', () => {
  const one = ['/cloudsql', '/cloudsql/' + instanceA, '/app/cloudsql', '/app/cloudsql/' + instanceA];
  assert.equal(sql(fixtureCreds, true, mountFilesystem(one)).host, '/cloudsql/' + instanceA);
  assert.throws(() => sql(fixtureCreds), { code: 'ONLINE_CLOUD_SQL_SOCKET_NOT_FOUND' });
  assert.throws(() => sql(fixtureCreds, true, mountFilesystem([...one, '/cloudsql/' + instanceB])), { code: 'ONLINE_CLOUD_SQL_SOCKET_AMBIGUOUS' });
  assert.throws(() => sql(fixtureCreds, true, {
    ...mountFilesystem(one), readdirSync() { throw new Error('fixture unreadable'); },
  }), { code: 'ONLINE_CLOUD_SQL_SOCKET_UNREADABLE' });
});

async function within<T>(work: Promise<T>, message: string): Promise<T> {
  let timer: NodeJS.Timeout;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), 500);
    })]);
  } finally {
    clearTimeout(timer!);
  }
}

await test('OFFLINE: unavailable PostgreSQL does not deadlock dbInitPromise with hydration', async () => {
  const context: any = vm.createContext({
    process: { env: {} }, fs: noMounts, path, resolveSqlConnection, SqlConfigurationError,
    pool: null, dbInitPromise: null, isOnlineMode: false, isDbQuotaExceeded: false,
    activeDbSource: 'NONE', dbConnectionErrorMsg: null, console: quiet,
    Pool: class { on() {} async query() { throw new Error('fixture unavailable'); } async end() {} },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms).unref(),
  });
  let hydrated = false;
  context.ensureHydrated = async () => { await context.dbInitPromise; hydrated = true; };
  vm.runInContext(serverFunction('determineAndInitPool'), context);
  context.dbInitPromise = context.determineAndInitPool();
  await within(context.dbInitPromise, 'DB initialization waits cyclically for hydration');
  await within(context.ensureHydrated(), 'OFFLINE hydration is blocked');
  assert.equal(hydrated, true);
});

function persistenceContext(online: boolean) {
  const events: string[] = [];
  const memory: Record<string, any> = {};
  const cache: Record<string, any> = {};
  const context: any = vm.createContext({
    isOnlineMode: online, isRestoring: false, dbInitPromise: null,
    pool: {}, isDbQuotaExceeded: false, db: null, console: quiet,
    getMemoryKeyValue: (key: string) => memory[key],
    updateMemoryKey: (key: string, value: any) => { memory[key] = value; },
    readLocalStore: () => cache,
    writeLocalStore: () => events.push('disk'),
    broadcastStateUpdate: () => events.push('broadcast'),
    scheduleDbWrite: () => events.push('schedule'),
    storeMutationQueue: new KeyedSerialQueue(),
  });
  for (const name of ['saveData', 'saveDataBatch', 'updateStoreKeyWithLock']) {
    vm.runInContext(serverFunction(name), context);
  }
  return { context, memory, cache, events };
}

for (const kind of ['single', 'batch', 'locked']) {
  await test('ONLINE ' + kind + ': response and broadcast wait for SQL, even with deferred flag', async () => {
    const { context, events } = persistenceContext(true);
    let complete!: () => void;
    const hold = new Promise<void>(resolve => { complete = resolve; });
    context.writeKeyToPostgresDirect = context.writeBatchToPostgresDirect = async () => {
      events.push('sql:start'); await hold; events.push('sql:commit');
    };
    let done = false;
    const work = (kind === 'single' ? context.saveData('lessonPlans', [], false)
      : kind === 'batch' ? context.saveDataBatch([{ key: 'lessonPlans', value: [] }], false)
      : context.updateStoreKeyWithLock('lessonPlans', () => []))
      .then(() => { done = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(done, false);
    assert.ok(events.includes('sql:start'));
    assert.ok(!events.includes('broadcast'));
    assert.ok(!events.includes('schedule'));
    complete();
    await work;
    assert.ok(events.indexOf('sql:commit') < events.indexOf('broadcast'));
  });

  await test('ONLINE ' + kind + ': SQL failure rejects and is not broadcast as saved', async () => {
    const { context, events } = persistenceContext(true);
    context.writeKeyToPostgresDirect = context.writeBatchToPostgresDirect = async () => {
      throw new Error('fixture SQL failure');
    };
    const work = kind === 'single' ? context.saveData('lessonPlans', [], false)
      : kind === 'batch' ? context.saveDataBatch([{ key: 'lessonPlans', value: [] }], false)
      : context.updateStoreKeyWithLock('lessonPlans', () => []);
    await assert.rejects(work, /fixture SQL failure/);
    assert.ok(!events.includes('broadcast'));
  });
}

await test('OFFLINE: ordinary saveData reaches local storage when SQL is unavailable', async () => {
  const { context, events } = persistenceContext(false);
  context.pool = null;
  await context.saveData('lessonPlans', [{ id: 'fixture-plan' }]);
  assert.ok(events.includes('disk'), 'Only token balances reached the local disk writer');
  assert.ok(events.includes('broadcast'));
});

for (const batch of [false, true]) {
  for (const matches of [false, true]) {
    await test((batch ? 'Batch' : 'Single') + ' writer: verify ' + (matches ? 'before COMMIT' : 'failure rolls back'), async () => {
      const queries: string[] = [];
      const value = [{ id: 'fixture-question' }];
      const client = {
        async query(statement: string) {
          const command = statement.trim().split(/\s+/)[0];
          queries.push(command);
          if (command === 'SELECT') return { rows: matches ? [{ value: [{ id: 'fixture-question' }] }] : [] };
          return { rows: [] };
        },
        release() {},
      };
      const context: any = vm.createContext({
        isOnlineMode: true, dbInitPromise: null, isDbQuotaExceeded: false,
        pool: { async connect() { value.push({ id: 'concurrent-change' }); return client; } },
        getMemoryKeyValue: () => value, structuredClone,
        dbWriteTimeouts: new Map(), lastDbWriteTimes: new Map(),
        dbWriteQueue: new KeyedSerialQueue(), clearTimeout, setTimeout, console: quiet,
        handleDbError() {}, triggerPoolRecreation() {},
      });
      for (const name of ['verifyOnlineArrayPersistence', 'writeKeyToPostgresDirectUnlocked', 'runWithDbKeyLocks', 'writeBatchToPostgresDirect']) {
        vm.runInContext(serverFunction(name), context);
      }
      const work = batch ? context.writeBatchToPostgresDirect(['questions']) : context.writeKeyToPostgresDirectUnlocked('questions');
      if (matches) {
        await work;
        assert.ok(queries.indexOf('SELECT') < queries.indexOf('COMMIT'));
      } else {
        await assert.rejects(work, /PERSISTENCE_VERIFY_FAILED/);
        assert.ok(queries.includes('ROLLBACK'));
        assert.ok(!queries.includes('COMMIT'));
      }
    });
  }
}

function middlewareContaining(marker: string) {
  const found: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'app.use' &&
        node.arguments[0] && ts.isArrowFunction(node.arguments[0]) &&
        node.arguments[0].getText(ast).includes(marker)) found.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(found.length, 1, 'Expected exactly one middleware: ' + marker);
  return transpile(found[0].getText(ast));
}

function responseStub() {
  return {
    statusCode: 200, body: null as any, headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    send(body: any) { this.body = body; return this; },
    json(body: any) { this.body = body; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
  };
}

await test('Health endpoints and assets never wait on hydration, even after a DB outage', async () => {
  let middleware: any;
  const context = vm.createContext({
    app: { use(fn: any) { middleware = fn; } }, isOnlineMode: true,
    isOnlineRuntimeUsable: () => true,
    refreshInmemoryState: () => new Promise(() => {}),
    ensureHydrated: () => new Promise(() => {}),
    console: quiet,
  });
  vm.runInContext(middlewareContaining('const readinessExemptPath'), context);
  for (const url of ['/health', '/healthz', '/readyz', '/api/health', '/index.html', '/assets/app.js']) {
    let next = false;
    await within(middleware({ path: url }, responseStub(), () => { next = true; }), 'Blocked diagnostic: ' + url);
    assert.equal(next, true);
  }
});

await test('Business API remains fail-closed until ONLINE hydration completes', async () => {
  let middleware: any;
  const context = vm.createContext({
    app: { use(fn: any) { middleware = fn; } }, isOnlineMode: true,
    isOnlineRuntimeUsable: () => false, console: quiet,
  });
  vm.runInContext(middlewareContaining('const readinessExemptPath'), context);
  const response = responseStub();
  let next = false;
  await middleware({ path: '/api/settings' }, response, () => { next = true; });
  assert.equal(next, false);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'ONLINE_RUNTIME_STARTING');
});

await test('Production static middleware blocks backend bundles and maps, including encoded paths', () => {
  let middleware: any;
  const context = vm.createContext({ app: { use(fn: any) { middleware = fn; } } });
  vm.runInContext(middlewareContaining('let assetPath'), context);
  const guardIndex = source.indexOf('let assetPath');
  assert.ok(guardIndex < source.indexOf('app.use(express.static(distPath'));
  for (const url of ['/server.cjs', '/server.cjs.map', '/%73erver.cjs', '/server%2Ecjs%2Emap', '/assets/../server.cjs', '/server.cjs/']) {
    const response = responseStub();
    let next = false;
    middleware({ path: url }, response, () => { next = true; });
    assert.equal(response.statusCode, 404, url);
    assert.equal(next, false, url);
  }
  let next = false;
  middleware({ path: '/assets/app.js' }, responseStub(), () => { next = true; });
  assert.equal(next, true);
  const malformed = responseStub();
  middleware({ path: '/%ZZ' }, malformed, () => assert.fail('malformed path passed'));
  assert.equal(malformed.statusCode, 400);
});

await test('Cloudinary repair discovers explicit persisted photo references only', () => {
  const context: any = vm.createContext({ URL });
  vm.runInContext(serverFunction('normalizeCloudinaryPhotoId'), context);
  vm.runInContext(serverFunction('getCloudinaryPhotoIdFromReference'), context);
  assert.equal(context.getCloudinaryPhotoIdFromReference('PHOTO_REF:abc-123'), 'abc-123');
  assert.equal(context.getCloudinaryPhotoIdFromReference('madrasah_photos/abc-123'), 'abc-123');
  assert.equal(context.getCloudinaryPhotoIdFromReference('/api/photos/abc-123'), 'abc-123');
  assert.equal(context.getCloudinaryPhotoIdFromReference('ordinary-non-photo-value'), null);
});

await test('CBT: schedule gate is authoritative in WIB', () => {
  const context: any = vm.createContext({});
  vm.runInContext(serverFunction('getExamScheduleAccess'), context);
  const exam = { date: '2026-09-12', startTime: '07:30', endTime: '09:00' };
  assert.equal(context.getExamScheduleAccess(exam, Date.parse('2026-09-12T00:29:59Z')).status, 'not_started');
  assert.equal(context.getExamScheduleAccess(exam, Date.parse('2026-09-12T00:30:00Z')).status, 'open');
  assert.equal(context.getExamScheduleAccess(exam, Date.parse('2026-09-12T02:00:01Z')).status, 'expired');
  assert.equal(context.getExamScheduleAccess({ date: 'legacy-invalid-date' }, Date.now()).status, 'open');
});

await test('CBT: teacher attempt context retains assignment boundary', () => {
  assert.match(serverFunction('getExamAttemptContext'), /teacherCanUseExamPayload\(req,\s*exam\)/);
});

await test('Built server HTTP smoke: OFFLINE fallback, ONLINE pending/ready and private backend assets', () => {
  execFileSync(process.execPath, ['scripts/runtime-smoke.cjs'], {
    stdio: 'inherit', timeout: 45000,
  });
});
