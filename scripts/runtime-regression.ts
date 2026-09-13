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
const serverSource = source;
const modulesSource = fs.readFileSync('src/modulesScript.js', 'utf8');
const adminModulesSource = fs.readFileSync('src/adminModules.js', 'utf8');
const cbtModulesSource = fs.readFileSync('src/cbtModules.js', 'utf8');
const appSource = fs.readFileSync('src/appScript.js', 'utf8');
const settingsSource = fs.readFileSync('src/settingsAndMisc.js', 'utf8');
const assessmentSource = fs.readFileSync('src/assessmentModule.js', 'utf8');
const lkpdSource = fs.readFileSync('src/lkpdModule.js', 'utf8');
const gameSource = fs.readFileSync('src/gameModule.js', 'utf8');
const modulAjarSource = fs.readFileSync('src/modulAjarModule.js', 'utf8');
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
  const memory: Record<string, any> = { lessonPlans: [{ id: 'committed-plan' }] };
  const cache: Record<string, any> = { lessonPlans: [{ id: 'committed-plan' }] };
  const persistedMemorySnapshots = new Map<string, any>([
    ['lessonPlans', structuredClone(memory.lessonPlans)]
  ]);
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
    persistedMemorySnapshots,
    rollbackMemoryToPersistedSnapshot: (key: string) => {
      if (!online || !persistedMemorySnapshots.has(key)) return false;
      memory[key] = structuredClone(persistedMemorySnapshots.get(key));
      cache[key] = structuredClone(memory[key]);
      events.push('rollback');
      return true;
    },
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
    const { context, memory, events } = persistenceContext(true);
    context.writeKeyToPostgresDirect = context.writeBatchToPostgresDirect = async () => {
      throw new Error('fixture SQL failure');
    };
    const work = kind === 'single' ? context.saveData('lessonPlans', [], false)
      : kind === 'batch' ? context.saveDataBatch([{ key: 'lessonPlans', value: [] }], false)
      : context.updateStoreKeyWithLock('lessonPlans', () => []);
    await assert.rejects(work, /fixture SQL failure/);
    assert.ok(!events.includes('broadcast'));
    assert.ok(events.includes('rollback'), 'Failed ONLINE mutation must restore the last committed memory state');
    assert.deepEqual(memory.lessonPlans, [{ id: 'committed-plan' }]);
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
        persistedMemorySnapshots: new Map(),
        cloneStateSnapshot: (input: any) => structuredClone(input),
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

await test('CBT: student load activates attempt before requesting questions', () => {
  const start = assessmentSource.indexOf('async function startStudentExam(examId)');
  const end = assessmentSource.indexOf('\nfunction ', start + 20);
  const fn = assessmentSource.slice(start, end > start ? end : undefined);
  const attemptStart = fn.indexOf("fetch('/api/exam/attempt/start'");
  const questionStart = fn.indexOf("fetch('/api/exam/attempt/start-questions'");
  assert.ok(attemptStart >= 0, 'student CBT load is missing authoritative attempt start');
  assert.ok(questionStart > attemptStart, 'question packet is requested before the attempt is active');
  assert.match(fn, /questions = questions\.map\(stripStudentQuestionSecrets\)\.filter\(Boolean\)/);
  assert.match(fn, /Paket soal ujian kosong/);
  assert.doesNotMatch(assessmentSource, /currentActiveExamKey\.split\('_'\)\[1\]/);
  assert.match(assessmentSource, /currentActiveExamKey\.slice\(matchedPrefix\.length\)/);
});

await test('CBT: expired attempt resumes at zero only for safe finalization', () => {
  const startRouteStart = serverSource.indexOf('app.post("/api/exam/attempt/start"');
  const startRouteEnd = serverSource.indexOf('\napp.', startRouteStart + 20);
  const startRoute = serverSource.slice(startRouteStart, startRouteEnd > startRouteStart ? startRouteEnd : undefined);
  assert.match(startRoute, /CBT_EXPIRED_RESUME_FINALIZE_V2/);
  assert.doesNotMatch(startRoute, /Number\(session\.endsAt\) <= now[\s\S]{0,120}Waktu ujian sudah habis/);
  assert.match(startRoute, /session\.timeLeft = Math\.max\(0, Math\.floor\(\(session\.endsAt - now\) \/ 1000\)\)/);

  const answerRouteStart = serverSource.indexOf('app.post("/api/exam/attempt/answer"');
  const answerRouteEnd = serverSource.indexOf('\napp.', answerRouteStart + 20);
  const answerRoute = serverSource.slice(answerRouteStart, answerRouteEnd > answerRouteStart ? answerRouteEnd : undefined);
  assert.match(answerRoute, /session\.endsAt && Number\(session\.endsAt\) <= now/);
  assert.match(answerRoute, /Waktu ujian sudah habis/);
});

await test('CBT: server summary clears reset browser state and stale queued answers', () => {
  assert.match(assessmentSource, /CBT_SERVER_SUMMARY_AUTHORITY_V2/);
  assert.match(assessmentSource, /reconcileStudentCbtServerSummary\(stId, authoritativeExamList, mySumRes\)/);
  assert.match(assessmentSource, /delete appState\.completedExams\[key\]/);
  assert.match(assessmentSource, /delete appState\.activeExamSessions\[key\]/);
  assert.match(assessmentSource, /delete appState\.studentExamAnswers\[key\]/);
  assert.match(assessmentSource, /delete appState\.studentExamQuestions\[key\]/);
  assert.match(assessmentSource, /setPendingOfflineQueue\(pendingQueue\)/);
  assert.doesNotMatch(assessmentSource, /appState\.activeExamSessions = \{ \.\.\.localSessions, \.\.\.\(appState\.activeExamSessions \|\| \{\}\), \.\.\.mySumRes\.activeSessions \}/);
});

await test('CBT: fresh server attempt discards stale reset cache before loading questions', () => {
  const start = assessmentSource.indexOf('async function startStudentExam(examId)');
  const end = assessmentSource.indexOf('\nfunction ', start + 20);
  const fn = assessmentSource.slice(start, end > start ? end : undefined);
  assert.match(fn, /CBT_RESET_RECONCILE_V2/);
  assert.match(fn, /const hadLocalSession = Boolean\(activeSessions\[key1\] \|\| activeSessions\[key2\]\)/);
  assert.match(fn, /serverAttemptReady && hadLocalSession && preflightSession && serverAnswerCount === 0 && serverQuestionCount === 0/);
  assert.match(fn, /delete appState\.studentExamAnswers\[examQuestionKey\]/);
  assert.match(fn, /delete appState\.studentExamQuestions\[examQuestionKey\]/);
  assert.match(fn, /const cleanedQueue = getPendingOfflineQueue\(\)\.filter/);
});

await test('CBT: empty or incompatible question packet never starts the timer', () => {
  const startRouteStart = serverSource.indexOf('app.post("/api/exam/attempt/start"');
  const startRouteEnd = serverSource.indexOf('\napp.', startRouteStart + 20);
  const startRoute = serverSource.slice(startRouteStart, startRouteEnd > startRouteStart ? startRouteEnd : undefined);
  const guardPos = startRoute.indexOf('CBT_LOADABLE_PACKET_GUARD_V2');
  const sessionCreatePos = startRoute.indexOf('session = {');
  assert.ok(guardPos >= 0, 'fresh CBT start is missing loadable-question guard');
  assert.ok(sessionCreatePos > guardPos, 'CBT timer/session is created before question loadability is checked');
  assert.match(startRoute, /code: 'EXAM_NO_QUESTIONS'/);
  assert.match(startRoute, /getLoadableQuestionsForExamAttempt\(matchedExam\)/);

  const questionRouteStart = serverSource.indexOf('app.post("/api/exam/attempt/start-questions"');
  const questionRouteEnd = serverSource.indexOf('\napp.', questionRouteStart + 20);
  const questionRoute = serverSource.slice(questionRouteStart, questionRouteEnd > questionRouteStart ? questionRouteEnd : undefined);
  assert.match(questionRoute, /let rawQuestions = getLoadableQuestionsForExamAttempt\(matchedExam\)/);

  const helper = serverFunction('getLoadableQuestionsForExamAttempt');
  assert.match(helper, /examType === 'pilihan_ganda'/);
  assert.match(helper, /examType === 'esay_saja'/);
});

await test('CBT: duration extension advances server endsAt without double-extension on retry', () => {
  const monitoringStart = serverSource.indexOf('app.post("/api/exam-monitoring-state"');
  const monitoringEnd = serverSource.indexOf('\napp.', monitoringStart + 20);
  const route = serverSource.slice(monitoringStart, monitoringEnd > monitoringStart ? monitoringEnd : undefined);
  assert.match(route, /CBT_SERVER_TIME_EXTENSION_V2/);
  assert.match(route, /const extensionSec = Math\.max\(durationExtensionSec, extraExtensionSec\)/);
  assert.match(route, /const authoritativeEndsAt = previousEndsAt \+ \(extensionSec \* 1000\)/);
  assert.match(route, /nextSession\.timeLeft = Math\.max\(0, Math\.floor\(\(authoritativeEndsAt - Date\.now\(\)\) \/ 1000\)\)/);

  assert.match(assessmentSource, /CBT_LOCAL_TIME_EXTENSION_V2/);
  assert.match(assessmentSource, /sess\.endsAt = currentEndsAt \+ \(durationDiffSec \* 1000\)/);
});

await test('CBT: answer sync is write-ahead and survives logout/reconnect restore', () => {
  const saveStart = assessmentSource.indexOf('function saveExamAnswer(qId, val)');
  const saveEnd = assessmentSource.indexOf('\nfunction selectExamOption', saveStart);
  const saveFn = assessmentSource.slice(saveStart, saveEnd > saveStart ? saveEnd : undefined);
  const queuePos = saveFn.indexOf('upsertPendingOfflineAnswer(payload)');
  const fetchPos = saveFn.indexOf("fetch('/api/exam/attempt/answer'");
  assert.ok(queuePos >= 0 && fetchPos > queuePos, 'answer must be queued before network fetch');
  assert.match(saveFn, /if \(!r\.ok \|\| !res\.success\) throw/);
  assert.match(saveFn, /removePendingOfflineAnswer\(payload\)/);
  assert.match(saveFn, /madrasah_student_exam_answers/);

  assert.match(assessmentSource, /CBT_ANSWER_WRITE_AHEAD_V2/);
  assert.match(assessmentSource, /CBT_RESUME_PENDING_ANSWER_PRECEDENCE_V2/);
  assert.match(assessmentSource, /const mergedAnswers = \{ \.\.\.\(serverSession\.answers \|\| \{\}\), \.\.\.queuedAnswers \}/);
  assert.match(assessmentSource, /const pendingResumeAnswers = getPendingAnswersForExam\(st\.id, ex\.id\)/);
  assert.match(assessmentSource, /sessionData\.answers = \{ \.\.\.sessionData\.answers, \.\.\.res\.session\.answers, \.\.\.pendingResumeAnswers \}/);
  assert.doesNotMatch(assessmentSource, /sessionData\.answers = \{ \.\.\.res\.session\.answers, \.\.\.sessionData\.answers \}/);
  assert.match(assessmentSource, /if \(!res\.ok \|\| !data\.success\) throw new Error/);
});

await test('CBT: final submission waits for server acknowledgement before clearing recovery state', () => {
  const submitStart = assessmentSource.indexOf('async function submitExamFinal()');
  const submitEnd = assessmentSource.indexOf('// Room Management Functions', submitStart);
  const submitFn = assessmentSource.slice(submitStart, submitEnd > submitStart ? submitEnd : undefined);
  const finishPos = submitFn.indexOf("fetch('/api/exam/attempt/finish'");
  const completedPos = submitFn.indexOf('appState.completedExams[key] = completionValue');
  assert.ok(finishPos >= 0 && completedPos > finishPos, 'local completion must happen only after finish request');
  assert.match(submitFn, /CBT_FINALIZE_SERVER_ACK_V2/);
  assert.match(submitFn, /if \(!response\.ok \|\| !res\.success\)/);
  assert.match(submitFn, /confirmCbtCompletionOnServer\(st\.id, ex\.id\)/);
  assert.match(submitFn, /Pengiriman belum dikonfirmasi server/);
  assert.doesNotMatch(submitFn, /syncExamStateToServer\(/);
});

await test('CBT: pending answer replay is isolated to the currently authenticated student', () => {
  const flushStart = assessmentSource.indexOf('window.flushPendingOfflineAnswers = async function()');
  const flushEnd = assessmentSource.indexOf('if (!window._offlineSyncListenerAdded)', flushStart);
  const flushFn = assessmentSource.slice(flushStart, flushEnd > flushStart ? flushEnd : undefined);
  const ownerGuardPos = flushFn.indexOf('pendingOfflineAnswerMatches(item, owner.studentId');
  const fetchPos = flushFn.indexOf("fetch('/api/exam/attempt/answer'");
  assert.ok(ownerGuardPos >= 0 && fetchPos > ownerGuardPos, 'account ownership guard must run before answer replay');
  assert.match(assessmentSource, /CBT_QUEUE_ACCOUNT_ISOLATION_V2/);
  assert.match(assessmentSource, /tenantId: String\(/);
  assert.match(assessmentSource, /function removePendingOfflineAnswersForAttempt/);
  assert.match(assessmentSource, /const ownPending = owner/);
});

await test('CBT: logout clears volatile runtime without deleting recovery storage', () => {
  const logoutStart = appSource.indexOf('function logout()');
  const logoutEnd = appSource.indexOf('\nwindow.logout = logout;', logoutStart);
  const logoutFn = appSource.slice(logoutStart, logoutEnd > logoutStart ? logoutEnd : undefined);
  assert.match(logoutFn, /__resetCbtRuntimeOnLogout/);
  assert.match(assessmentSource, /CBT_LOGOUT_RUNTIME_ISOLATION_V2/);
  assert.match(assessmentSource, /activeExamSession = null/);
  assert.match(assessmentSource, /clearInterval\(window\.__examTimerInterval\)/);
  assert.doesNotMatch(logoutFn, /removeItem\('madrasah_active_exam_sessions'\)/);
  assert.doesNotMatch(logoutFn, /removeItem\('cbt_pending_offline_answers'\)/);
});

await test('CBT: expired attempts freeze client answers and server ignores post-deadline payloads', () => {
  assert.match(assessmentSource, /CBT_EXPIRED_FINALIZATION_FREEZE_V3/);
  assert.match(assessmentSource, /function isCbtSessionFrozen/);
  assert.match(assessmentSource, /freezeExpiredCbtSessionForFinalization\(\)/);
  assert.match(assessmentSource, /if \(isCbtSessionFrozen\(activeExamSession\)\)/);
  assert.match(assessmentSource, /status: expiredFinalization \? 'expired_pending_submit' : 'active'/);
  assert.match(serverSource, /CBT_EXPIRED_FINALIZATION_FREEZE_V3/);
  assert.match(serverSource, /const sessionExpired = Boolean/);
  assert.match(serverSource, /const incomingAnswers = \(isStaffForceFinish \|\| sessionExpired\) \? \{\} : filterAllowedAnswers\(answers\)/);
});

await test('Auth: persisted sessions validate before UI restore and account RAM fails closed', () => {
  const initStart = appSource.indexOf('async function initAppSession()');
  const initEnd = appSource.indexOf('setTimeout(initAppSession, 0);', initStart);
  const initFn = appSource.slice(initStart, initEnd);
  const authCheckPos = initFn.indexOf("fetch('/api/auth/me'");
  const sessionStartPos = initFn.indexOf('startSession(true)');
  assert.ok(authCheckPos >= 0 && sessionStartPos > authCheckPos, 'auth/me must validate before restored UI session starts');
  assert.match(appSource, /ACCOUNT_RUNTIME_ISOLATION_V2/);
  assert.match(appSource, /resetAccountScopedRuntimeState\(\)/);
  assert.match(appSource, /if \(!loadSucceeded\)/);
  assert.match(settingsSource, /return true;/);
  assert.match(settingsSource, /fallbackAuthenticatedResponses\.some\(item => item && item\.success === true\)/);
});

await test('Realtime: legacy slug-only sessions receive canonical tenant exam events', () => {
  const start = serverSource.indexOf('function broadcastExamEvent');
  const end = serverSource.indexOf('\nfunction getJakartaTodayDateStr', start);
  const fn = serverSource.slice(start, end > start ? end : undefined);
  assert.match(fn, /REALTIME_TENANT_CANONICAL_SCOPE_V2/);
  assert.match(fn, /canonicalRealtimeTenant\(user\.madrasahId \|\| user\.madrasahSlug \|\| 'default'\)/);
  assert.match(fn, /clientTenant !== eventTenant/);
});

await test('Realtime: teacher SSE events follow academic exam and LKPD scope', () => {
  assert.match(serverSource, /REALTIME_TEACHER_EVENT_SCOPE_V3/);
  assert.match(serverSource, /function teacherCanReceiveRealtimeEvent/);
  assert.match(serverSource, /teacherCanUseExamPayload\(scopeReq, candidates\[0\]\)/);
  assert.match(serverSource, /teacherCanUseLkpdPayload\(scopeReq, candidates\[0\]\)/);
  const start = serverSource.indexOf('function broadcastExamEvent');
  const end = serverSource.indexOf('\nfunction getJakartaTodayDateStr', start);
  const fn = serverSource.slice(start, end > start ? end : undefined);
  assert.match(fn, /isTeacher && !teacherCanReceiveRealtimeEvent\(user, event, eventTenant\)/);

  const context: any = vm.createContext({
    exams: [], lkpdList: [],
    canonicalRealtimeTenant: (value: any) => String(value || 'default'),
    getMemoryKeyValue: (key: string) => key === 'exams'
      ? [{ id: 'exam-1', madrasahId: 'm-1', subject: 'allowed' }, { id: 'exam-2', madrasahId: 'm-1', subject: 'blocked' }]
      : [{ id: 'lkpd-1', madrasahId: 'm-1', subject: 'allowed' }],
    teacherCanUseExamPayload: (_req: any, item: any) => item.subject === 'allowed',
    teacherCanUseLkpdPayload: (_req: any, item: any) => item.subject === 'allowed',
  });
  vm.runInContext(serverFunction('teacherCanReceiveRealtimeEvent'), context);
  const teacher = { role: 'teacher', id: 't-1', madrasahId: 'm-1' };
  assert.equal(context.teacherCanReceiveRealtimeEvent(teacher, { examId: 'exam-1' }, 'm-1'), true);
  assert.equal(context.teacherCanReceiveRealtimeEvent(teacher, { examId: 'exam-2' }, 'm-1'), false);
  assert.equal(context.teacherCanReceiveRealtimeEvent(teacher, { lkpdId: 'lkpd-1' }, 'm-1'), true);
  assert.equal(context.teacherCanReceiveRealtimeEvent(teacher, { studentId: 's-1' }, 'm-1'), false);
});

await test('Realtime: P2P signaling bridges WebSocket and HTTP fallback per account', () => {
  assert.match(serverSource, /SIGNALING_PER_STAFF_ROUTE_V3/);
  assert.match(serverSource, /SIGNALING_TRANSPORT_BRIDGE_V4/);
  assert.match(serverSource, /function signalingStaffKeyForTenant/);
  assert.match(serverSource, /function deliverSignalToStudent/);
  assert.match(serverSource, /function deliverSignalToStaff/);
  assert.match(serverSource, /function flushQueuedSignalsToSocket/);

  const postStart = serverSource.indexOf('app.post("/api/exam/signaling"');
  const getStart = serverSource.indexOf('app.get("/api/exam/signaling"', postStart);
  const livekitStart = serverSource.indexOf('// LiveKit grants are derived', getStart);
  const postRoute = serverSource.slice(postStart, getStart);
  const getRoute = serverSource.slice(getStart, livekitStart);
  assert.match(postRoute, /deliverSignalToStaff\(tenant, recipientId, senderId, signal\)/);
  assert.match(postRoute, /deliverSignalToStudent\(signalingItemTenant\(target\), recipientId, senderId, signal\)/);
  assert.match(getRoute, /key = rememberSignalingStaffRoute\(user, routeTenant\)/);

  const wsStart = serverSource.indexOf('wss.on("connection"');
  const wsEnd = serverSource.indexOf('console.log("WebRTC WebSocket Signaling Server initialized successfully!"', wsStart);
  const wsBlock = serverSource.slice(wsStart, wsEnd > wsStart ? wsEnd : undefined);
  assert.match(wsBlock, /publicId = String\(auth\.id\)/);
  assert.match(wsBlock, /signalingStaffKeyForTenant\(tenant, auth\.id\)/);
  assert.match(wsBlock, /flushQueuedSignalsToSocket\(storageKey, ws\)/);
  assert.match(wsBlock, /deliverSignalToStaff\(tenant, recipient, publicId, data\.signal\)/);
  assert.match(wsBlock, /deliverSignalToStudent\(targetTenant, recipient, publicId, data\.signal\)/);
  assert.doesNotMatch(wsBlock, /storageKey = publicId === 'admin'/);

  const sent: any[] = [];
  const context: any = vm.createContext({
    examSignalingMessages: {},
    wsClients: new Map(),
    signalingStaffRoutes: new Map(),
    canonicalRealtimeTenant: (value: any) => String(value || 'default'),
    signalingStaffKeyForTenant: (tenant: any, id: any) => 'staff::' + String(tenant) + '::' + String(id),
    JSON,
  });
  for (const name of ['enqueueExamSignal', 'sendSignalToSocket', 'flushQueuedSignalsToSocket', 'deliverSignalToStudent']) {
    vm.runInContext(serverFunction(name), context);
  }
  const ws = { readyState: 1, send: (payload: string) => sent.push(JSON.parse(payload)) };
  context.wsClients.set('student::m-1::s-1', ws);
  assert.equal(context.deliverSignalToStudent('m-1', 's-1', 't-1', { type: 'offer' }), 'ws');
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], { type: 'signal', senderId: 't-1', signal: { type: 'offer' } });

  context.wsClients.clear();
  assert.equal(context.deliverSignalToStudent('m-1', 's-1', 't-1', { type: 'candidate' }), 'http');
  assert.equal(context.examSignalingMessages['student::m-1::s-1']['t-1'].length, 1);
  context.flushQueuedSignalsToSocket('student::m-1::s-1', ws);
  assert.equal(sent.length, 2);
  assert.equal(context.examSignalingMessages['student::m-1::s-1'], undefined);
});

await test('Livecam: runtime frames are ephemeral, TTL-pruned, and cleared on finalization', () => {
  assert.match(serverSource, /RUNTIME_LIVECAM_EPHEMERAL_V3/);
  assert.match(serverSource, /let studentLivecamFrames: Record<string, string> = \{\}/);
  assert.doesNotMatch(serverSource, /let studentLivecamFrames = bootStore\['studentLivecamFrames'\]/);
  assert.match(serverSource, /RUNTIME_LIVECAM_FRAME_TTL_MS = 2 \* 60 \* 1000/);

  const finishStart = serverSource.indexOf('app.post("/api/exam/attempt/finish"');
  const finishEnd = serverSource.indexOf('// Phase 1 Endpoint: Summarized Teacher Monitoring', finishStart);
  const finishRoute = serverSource.slice(finishStart, finishEnd);
  assert.match(finishRoute, /clearRuntimeLivecamFrame\(key\)/);
  assert.match(finishRoute, /saveDeltaDb\('studentLivecamFrames', key, null\)/);

  const context: any = vm.createContext({
    studentLivecamFrames: {},
    studentLivecamFrameUpdatedAt: {},
    RUNTIME_LIVECAM_FRAME_TTL_MS: 1000,
    Date: { now: () => 5000 },
  });
  for (const name of ['pruneStaleLivecamFrames', 'setRuntimeLivecamFrame', 'clearRuntimeLivecamFrame']) {
    vm.runInContext(serverFunction(name), context);
  }
  context.setRuntimeLivecamFrame('fresh', 'frame');
  assert.equal(context.studentLivecamFrames.fresh, 'frame');
  context.studentLivecamFrames.stale = 'old';
  context.studentLivecamFrameUpdatedAt.stale = 3000;
  context.pruneStaleLivecamFrames(5000);
  assert.equal(context.studentLivecamFrames.stale, undefined);
  assert.equal(context.studentLivecamFrames.fresh, 'frame');
  context.clearRuntimeLivecamFrame('fresh');
  assert.equal(context.studentLivecamFrames.fresh, undefined);
});

await test('LiveKit: token minting requires explicit credentials in every mode', () => {
  const start = serverSource.indexOf('app.post("/api/exam/livekit-token"');
  const end = serverSource.indexOf('\nfunction sanitizeChatAttachment', start);
  const route = serverSource.slice(start, end > start ? end : undefined);
  assert.match(route, /LIVEKIT_EXPLICIT_CREDENTIALS_V3/);
  assert.match(route, /if \(!apiKey \|\| !apiSecret \|\| !serverUrl\)/);
  assert.match(route, /new AccessToken\(apiKey, apiSecret/);
  assert.match(route, /serverUrl, roomName: physicalRoomName/);
  assert.doesNotMatch(route, /devkey/);
  assert.doesNotMatch(route, /apiSecret \|\| "secret"/);
  assert.doesNotMatch(route, /ws:\/\/localhost:7880/);
});

await test('LiveKit: browser capability is server-authoritative and falls back to P2P on runtime failure', () => {
  assert.match(serverSource, /LIVEKIT_RUNTIME_CAPABILITY_V4/);
  assert.match(serverSource, /function resolveLiveKitRuntimeConfig/);
  assert.match(serverSource, /safeSettings\.livekitConfigured = resolveLiveKitRuntimeConfig\(\)\.configured/);
  assert.match(serverSource, /sanitizedSettings\.livekitConfigured = resolveLiveKitRuntimeConfig\(\)\.configured/);
  assert.match(assessmentSource, /LIVEKIT_CLIENT_CAPABILITY_V4/);
  assert.match(assessmentSource, /s\.livekitConfigured === true/);
  assert.match(assessmentSource, /LIVEKIT_TO_P2P_FAILOVER_V4/);
  assert.match(assessmentSource, /window\._liveKitRuntimeUnavailable = true/);
  assert.match(assessmentSource, /window\.initSignalingWebSocket\(String\(studentId\)/);
  assert.doesNotMatch(assessmentSource, /const key = s\.livekitApiKey \|\| ''/);
});

await test('CBT monitoring: legacy livecam frames use the same bounded raster validation', () => {
  const start = serverSource.indexOf('app.post("/api/exam-monitoring-state"');
  const end = serverSource.indexOf('// Reset Individual Student Exam Progress API', start);
  const route = serverSource.slice(start, end > start ? end : undefined);
  assert.match(route, /LEGACY_LIVECAM_FRAME_VALIDATION_V3/);
  assert.match(route, /Payload frame livecam monitoring tidak valid/);
  assert.match(route, /Buffer\.byteLength\(frameText, 'utf8'\) > 2 \* 1024 \* 1024/);
  assert.match(route, /parseSafeRasterDataUrl\(frameText\)/);
});

await test('Assessment: persisted event and violation text is escaped before innerHTML', () => {
  assert.match(assessmentSource, /assessmentEscapeHtml\(ev\.title\)/);
  assert.match(assessmentSource, /assessmentEscapeHtml\(ev\.description \|\| 'Kelompok jadwal ujian'\)/);
  assert.match(assessmentSource, /assessmentInlineArg\(ev\.id\)/);
  assert.match(assessmentSource, /assessmentEscapeHtml\(v\.studentName \|\| 'Peserta Ujian'\)/);
  assert.match(assessmentSource, /assessmentEscapeHtml\(v\.className\)/);
  assert.match(assessmentSource, /assessmentEscapeHtml\(v\.reason \|\| 'Keluar Tab \/ Aplikasi Ujian'\)/);
  assert.ok((assessmentSource.match(/assessmentSafeImageSrc\(snap\)/g) || []).length >= 3);
  assert.doesNotMatch(assessmentSource, /<img src="\$\{snap\}"/);
  assert.match(serverSource, /VIOLATION_PLAIN_TEXT_V3/);
});

await test('Assessment: teachers cannot mutate EVENT containers but can still read them', () => {
  assert.match(serverSource, /TEACHER_EVENT_MUTATION_SCOPE_V3/);
  const context: any = vm.createContext({
    isTeacherRequest: () => true,
    teacherCanUseExamPayload: (_req: any, payload: any) => payload?.subject === 'allowed',
  });
  vm.runInContext(serverFunction('teacherCanMutateExamPayload'), context);
  assert.equal(context.teacherCanMutateExamPayload({}, { recordType: 'EVENT' }), false);
  assert.equal(context.teacherCanMutateExamPayload({}, { recordType: 'EXAM', subject: 'allowed' }), true);
  assert.equal(context.teacherCanMutateExamPayload({}, { recordType: 'EXAM', subject: 'blocked' }), false);

  const start = serverSource.indexOf('app.post("/api/exams"');
  const end = serverSource.indexOf('// Rooms API', start);
  const routes = serverSource.slice(start, end > start ? end : undefined);
  assert.match(routes, /teacherCanMutateExamPayload\(req, item\)/);
  assert.match(routes, /teacherCanMutateExamPayload\(req, req\.body\)/);
  assert.match(routes, /teacherCanMutateExamPayload\(req, resolved\.item\)/);
});

await test('Teacher generic sync cannot mutate EVENT or out-of-scope LKPD records', () => {
  const start = serverSource.indexOf('app.post("/api/sync-state"');
  const end = serverSource.indexOf('// Real-time Event Stream', start);
  const route = serverSource.slice(start, end > start ? end : undefined);
  assert.match(route, /TEACHER_SYNC_EXAM_MUTATION_SCOPE_V3/);
  assert.match(route, /teacherCanMutateExamPayload\(req, item\)/);
  assert.match(route, /TEACHER_SYNC_LKPD_SCOPE_V3/);
  assert.match(route, /teacherCanUseLkpdPayload\(req, tagNewRecord\(clean, req\)\)/);
  assert.match(route, /Guru hanya dapat menyinkronkan LKPD mata pelajaran yang diampu/);
});

await test('Stored assessment, LKPD, game and admin modal data is output-encoded', () => {
  assert.match(adminModulesSource, /adminEscapeAttr\(target\.title\)/);
  assert.match(adminModulesSource, /adminInlineArg\(target\.id\)/);
  assert.match(assessmentSource, /assessmentEscapeHtml\(room\.name\)/);
  assert.match(assessmentSource, /assessmentEscapeHtml\(st\.name\)/);
  assert.match(assessmentSource, /assessmentEscapeHtml\(title\)/);
  assert.match(assessmentSource, /assessmentEscapeHtml\(message\)/);
  assert.match(assessmentSource, /assessmentInlineArg\(examId\)/);
  assert.match(assessmentSource, /assessmentEscapeHtml\(reason\)/);
  assert.match(lkpdSource, /lkpdEscapeHtml\(reason\)/);
  assert.match(gameSource, /gameSafeImageSrc\(imgUrl\)/);
});

await test('AI poster and PPT fields are encoded before live and exported HTML rendering', () => {
  assert.match(modulAjarSource, /MODUL_AJAR_OUTPUT_ENCODING_V3/);
  assert.match(modulAjarSource, /modulEscapeHtml\(posterData\.title \|\| topic\)/);
  assert.match(modulAjarSource, /modulSafeImageSrc\(posterData\.imageUrl\)/);
  assert.match(modulAjarSource, /modulInlineJson\(h\)/);
  assert.match(modulAjarSource, /modulSafePercent\(h\.x\)/);
  assert.match(modulAjarSource, /modulEscapeHtml\(slide\.title\)/);
  assert.match(modulAjarSource, /modulSafeJsonForScript\(slides\)/);
  assert.match(modulAjarSource, /map\(p => `<li>\$\{modulEscapeHtml\(p\)\}<\/li>`\)/);
  assert.doesNotMatch(modulAjarSource, /<img src="\$\{posterData\.imageUrl\}"/);
  assert.doesNotMatch(modulAjarSource, /<h5 class="text-sm font-extrabold text-slate-900 leading-tight">\$\{data\.name\}<\/h5>/);
});

await test('Auth: legacy slug-only account records remain valid for canonical tenant tokens', () => {
  assert.match(serverSource, /AUTH_TENANT_ID_SLUG_COMPAT_V2/);
  assert.match(serverSource, /function canonicalAuthTenantIdentity/);
  assert.match(serverSource, /values\.some\(\(value\) => canonicalAuthTenantIdentity\(value\) === target\)/);
  assert.match(serverSource, /const sessionTenantCanonical = canonicalAuthTenantIdentity\(tenantId\)/);
});

await test('Tenant isolation: teacher token balance and class leader attendance use current tenant only', () => {
  const tokenBalanceStart = serverSource.indexOf('app.get("/api/token-balance"');
  const tokenBalanceEnd = serverSource.indexOf('\nfunction sanitizeMadrasahPublic', tokenBalanceStart);
  const tokenBalanceRoute = serverSource.slice(tokenBalanceStart, tokenBalanceEnd);
  assert.match(tokenBalanceRoute, /String\(t\.id\) === String\(authUser\?\.id \|\| ''\) &&\s*isItemForCurrentMadrasah\(t, req\)/);
  assert.doesNotMatch(tokenBalanceRoute, /String\(t\.username\) === String\(authUser\.username\)/);

  const attendanceStart = serverSource.indexOf('app.get("/api/attendance"');
  const attendanceEnd = serverSource.indexOf('\napp.post("/api/attendance"', attendanceStart);
  const attendanceRoute = serverSource.slice(attendanceStart, attendanceEnd);
  assert.match(attendanceRoute, /String\(s\.id\) === String\(authUser\.id\) && isItemForCurrentMadrasah\(s, req\)/);
});

await test('Auth: JWT is bound to current credential and active tenant state', () => {
  assert.match(serverSource, /AUTH_SESSION_CREDENTIAL_STAMP_V2/);
  assert.match(serverSource, /function validateAuthSessionAgainstCurrentState/);
  assert.match(serverSource, /if \(!session \|\| !session\.authStamp\) return false/);
  assert.match(serverSource, /sessionMadrasah\.isActive === false/);
  assert.match(serverSource, /const \{ authStamp: _authStamp, \.\.\.safeAuthUser \} = authUser/);
  assert.match(serverSource, /validateAuthSessionAgainstCurrentState\(payload\)/);
  assert.match(serverSource, /createAuthToken\(studentUser, student\.password\)/);
  assert.match(serverSource, /createAuthToken\(teacherUser, teacher\.password\)/);
});

await test('Frontend: dynamic account and school text is escaped before HTML rendering', () => {
  assert.match(appSource, /const currentUserName = escapeHtml\(/);
  assert.match(appSource, /const runningText = escapeHtml\(/);
  assert.match(appSource, /escapeHtmlAttr\(currentSchoolLogo\)/);
  assert.match(modulesSource, /moduleEscapeHtml\(st\.name \|\| 'Siswa'\)/);
  assert.match(modulesSource, /moduleEscapeHtml\(cls \? cls\.name : 'Umum'\)/);
  assert.match(modulesSource, /moduleEscapeAttr\(st\.username \|\| 'siswa1'\)/);
});

await test('Frontend: persisted student and CBT journal records are escaped at HTML sinks', () => {
  assert.match(adminModulesSource, /adminEscapeHtml\(student\.name\)/);
  assert.match(adminModulesSource, /adminEscapeHtml\(student\.username\)/);
  assert.match(adminModulesSource, /adminInlineArg\(student\.id\)/);
  assert.match(cbtModulesSource, /qbEscapeHtml\(s\.name\)/);
  assert.match(cbtModulesSource, /qbEscapeHtml\(j\.material\)/);
  assert.match(cbtModulesSource, /qbEscapeAttr\(journal\.material \|\| ''\)/);
  assert.match(cbtModulesSource, /qbInlineArg\(j\.id\)/);
});

await test('Student master writes are admin-owned and self password may remain unchanged', () => {
  assert.match(serverSource, /app\.post\("\/api\/students", requireAuth, requireRole\(\['admin', 'bos', 'superadmin'\]\)/);
  assert.match(serverSource, /app\.put\("\/api\/students\/:id", requireAuth, requireRole\(\['admin', 'bos', 'superadmin'\]\)/);
  assert.match(serverSource, /if \(password\) student\.password = hashPassword\(password\)/);
  assert.ok(modulesSource.includes('Kosongkan jika tidak ingin mengganti'));
});

await test('Offline restore re-hashes legacy plaintext user credentials', () => {
  assert.ok(serverSource.includes('for (const restoredStudent of mergedStudents)'));
  assert.ok(serverSource.includes('for (const restoredTeacher of mergedTeachers)'));
});

await test('Class master writes stay admin-owned', () => {
  assert.match(serverSource, /app\.post\("\/api\/classes", requireAuth, requireRole\(\['admin', 'bos', 'superadmin'\]\)/);
  assert.match(serverSource, /app\.delete\("\/api\/classes\/:id", requireAuth, requireRole\(\['admin', 'bos', 'superadmin'\]\)/);
});

await test('Schedule configuration is admin-owned while teachers remain read-only', () => {
  assert.match(serverSource, /app\.post\("\/api\/schedules", requireAuth, requireRole\(\['admin', 'bos', 'superadmin'\]\)/);
  assert.match(serverSource, /app\.delete\("\/api\/schedules\/:id", requireAuth, requireRole\(\['admin', 'bos', 'superadmin'\]\)/);
  assert.match(serverSource, /app\.post\("\/api\/time-slots", requireAuth, requireRole\(\['admin', 'bos', 'superadmin'\]\)/);
  assert.ok(serverSource.includes("'schedules', 'savedRosters', 'timeSlots', 'kbmDuration', 'classGrades'"));
});

await test('Temporary student credentials are hidden from teachers and purged on logout', () => {
  assert.ok(adminModulesSource.includes("if (!['admin', 'bos', 'superadmin'].includes(credentialRole)) return ''"));
  assert.ok(adminModulesSource.includes('Tidak ditampilkan'));
  assert.ok(appSource.includes("sessionStorage.removeItem('cbt_print_credentials')"));
});

await test('Built server HTTP smoke: OFFLINE fallback, ONLINE pending/ready and private backend assets', () => {
  execFileSync(process.execPath, ['scripts/runtime-smoke.cjs'], {
    stdio: 'inherit', timeout: 45000,
  });
});
