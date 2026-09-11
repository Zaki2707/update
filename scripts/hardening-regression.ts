import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KeyedSerialQueue } from '../src/keyedSerialQueue.js';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function testSameKeySerializes() {
  const queue = new KeyedSerialQueue();
  const events: string[] = [];
  let releaseFirst: () => void = () => {};
  const hold = new Promise<void>((resolve) => { releaseFirst = resolve; });

  const first = queue.run('questions', async () => {
    events.push('first:start');
    await hold;
    events.push('first:end');
  });
  await sleep(5);

  const second = queue.run('questions', async () => {
    events.push('second:start');
    events.push('second:end');
  });
  await sleep(15);

  assert.deepEqual(events, ['first:start'], 'same-key task started before prior writer finished');
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
  assert.equal(queue.pendingKeys, 0);
}

async function testDifferentKeysCanProgress() {
  const queue = new KeyedSerialQueue();
  let releaseA: () => void = () => {};
  const holdA = new Promise<void>((resolve) => { releaseA = resolve; });
  let bRan = false;

  const a = queue.run('questions', async () => { await holdA; });
  await sleep(5);
  await queue.run('rooms', async () => { bRan = true; });
  assert.equal(bRan, true, 'different keys should not block each other');
  releaseA();
  await a;
}

async function testFailureDoesNotPoisonKey() {
  const queue = new KeyedSerialQueue();
  await assert.rejects(queue.run('questions', async () => {
    throw new Error('expected failure');
  }));
  let ran = false;
  await queue.run('questions', async () => { ran = true; });
  assert.equal(ran, true, 'failed writer poisoned the per-key queue');
}

function testServerGuards() {
  const server = fs.readFileSync('server.ts', 'utf8');
  const app = fs.readFileSync('src/appScript.js', 'utf8');
  const chat = fs.readFileSync('src/chatModule.js', 'utf8');

  assert.match(server, /dbWriteQueue\.run\(key, \(\) => writeKeyToPostgresDirectUnlocked\(key\)\)/);
  assert.match(server, /app\.delete\("\/api\/exams\/:id", requireAuth, requireRole/);
  assert.match(server, /app\.put\("\/api\/settings", requireAuth, requireRole\(\['bos', 'superadmin'\]\)/);
  assert.match(server, /__tenantScopedSettingsV1/);
  assert.match(server, /function examStateKey\(/);
  assert.match(server, /filterExamStateMapForRequest/);
  assert.match(server, /clientTenant !== eventTenant/);

  assert.match(server, /app\.put\("\/api\/student\/profile", requireAuth, requireRole/);
  assert.match(server, /withTokenLedger\(async \(\) =>/);
  assert.match(server, /Permintaan top-up ini sudah diproses/);
  assert.match(server, /function examBroadcastStateKey\(/);
  assert.match(server, /function resolveExamViolationLogKey\(/);
  assert.match(server, /app\.get\("\/update_offline\.zip", requireAuth, requireRole/);
  assert.match(server, /maxPayload: 256 \* 1024/);
  assert.match(server, /Frame livecam terlalu besar/);
  assert.match(server, /function parseSafeRasterDataUrl\(/);
  assert.equal(server.includes('examViolationLogs[eId].unshift'), false);
  assert.match(server, /function runWithDbKeyLocks/);
  assert.match(server, /async function writeBatchToPostgresDirect/);
  assert.match(server, /await writeBatchToPostgresDirect\(normalizedItems\.map/);
  assert.match(server, /rewardAlreadyClaimed/);
  assert.match(server, /storeMutationQueue\.run\(rewardLockKey/);
  assert.match(server, /State sesi game terlalu besar/);
  assert.match(server, /Jawaban terlalu besar\. Maksimal 64 KB per soal/);
  assert.match(server, /Format frame livecam tidak valid/);
  assert.match(server, /function sanitizeMadrasahMemberView/);
  assert.match(server, /function teacherAllowedSubjectsForRequest/);
  assert.match(server, /function questionBankGroupsForRequest/);
  assert.match(server, /function questionsForRequest/);
  assert.match(server, /function examsForRequest/);
  assert.match(server, /Batch soal memuat mata pelajaran di luar assignment guru/);
  assert.match(server, /const scopedStudents = filterByMadrasah\(students \|\| \[\], req\)/);
  assert.equal(server.includes('if (isOnlineMode && isStudentSyncRole)'), false);
  assert.match(server, /const resolvedExam = resolveTenantItemIndexById\(examSource, eId, req\)/);
  assert.match(server, /app\.get\("\/api\/token-requests", requireAuth, requireRole/);

  assert.match(app, /sessionStorage\.setItem\(AUTH_SESSION_TOKEN_KEY/);
  assert.equal(app.includes("localStorage.setItem('madrasah_current_user', JSON.stringify(loggedInUser))"), false);
  assert.match(chat, /chatEscape\(msg\.text\)/);
  assert.equal(chat.includes('$' + '{msg.text}'), false);
  const staffAiRoutes = [
    '/api/gemini/generate-questions',
    '/api/gemini/generate-enrichment',
    '/api/gemini/generate-modul',
    '/api/gemini/generate-modul-all',
    '/api/modul/parse-document',
    '/api/modul/import-ai-structure',
    '/api/gemini/generate-modul2-general',
    '/api/gemini/generate-modul2-bab',
    '/api/gemini/generate-ppt',
    '/api/gemini/generate-poster',
    '/api/gemini/generate-kbc-document',
    '/api/gemini/generate-soal-kisi',
    '/api/gemini/generate-rpp',
    '/api/gemini/generate-device'
  ];
  const staffMiddlewareMarker = ", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin'])";
  for (const route of staffAiRoutes) {
    assert.equal(server.includes('app.post("' + route + '"' + staffMiddlewareMarker), true, 'AI/module route is not explicitly staff-only: ' + route);
  }
  assert.match(server, /ID ujian ambigu lintas tenant\. Pilih madrasah target terlebih dahulu\./);
  assert.match(server, /ID LKPD ambigu lintas tenant\. Pilih madrasah target terlebih dahulu\./);
  assert.match(server, /TEACHER_SELF_UPDATE_SCOPE/);
  assert.match(server, /SUBJECT_RENAME_CASCADE/);
  assert.match(fs.readFileSync('src/cbtModules.js', 'utf8'), /QUESTION_BANK_LOAD_GUARD/);
  assert.match(fs.readFileSync('src/modulAjarModule.js', 'utf8'), /IMPORT_GROUP_SERVER_AUTHORITATIVE/);
  assert.match(server, /=== examTenant/);
  assert.match(server, /=== lkpdTenant/);
  assert.equal(server.includes("const store = readLocalStore();\n    let lkpdList = store.lkpdList || [];"), false);
  assert.match(server, /default-src 'none'; style-src 'none'; script-src 'none'; sandbox/);

  for (const destructive of [
    'exams = [...otherExams, ...taggedIncoming]',
    'rooms = [...otherRooms, ...taggedIncoming]',
    'journals = [...otherJournals, ...taggedIncoming]',
    'calendarEvents = [...otherEvents, ...taggedIncoming]',
    'generatedExams = [...otherExams, ...taggedIncoming]'
  ]) {
    assert.equal(server.includes(destructive), false, 'destructive online batch pattern remains: ' + destructive);
  }

  for (const legacyKey of [
    'const key = sId + "_" + eId;',
    "const key = studentId + '_' + examId;",
    'const key = studentId + "_" + examId;'
  ]) {
    assert.equal(server.includes(legacyKey), false, 'unscoped CBT key remains: ' + legacyKey);
  }
}

await testSameKeySerializes();
await testDifferentKeysCanProgress();
await testFailureDoesNotPoisonKey();
testServerGuards();
console.log('Hardening regression passed.');
