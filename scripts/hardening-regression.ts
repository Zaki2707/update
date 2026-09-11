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
  const modules = fs.readFileSync('src/modulesScript.js', 'utf8');
  const settingsMisc = fs.readFileSync('src/settingsAndMisc.js', 'utf8');
  const modulAjar = fs.readFileSync('src/modulAjarModule.js', 'utf8');
  const mainEntry = fs.readFileSync('src/main.tsx', 'utf8');
  const indexHtml = fs.readFileSync('index.html', 'utf8');

  assert.match(server, /dbWriteQueue\.run\(key, \(\) => writeKeyToPostgresDirectUnlocked\(key\)\)/);
  assert.match(server, /app\.delete\("\/api\/exams\/:id", requireAuth, requireRole/);
  assert.match(server, /app\.put\("\/api\/settings", requireAuth, requireRole\(\['bos', 'superadmin'\]\)/);
  assert.match(server, /__tenantScopedSettingsV1/);
  assert.match(server, /function examStateKey\(/);
  assert.match(server, /filterExamStateMapForRequest/);
  assert.match(server, /clientTenant !== eventTenant/);
  assert.match(server, /ONLINE_RUNTIME_STARTING/);
  assert.match(server, /startOnlineRuntimeInitializationLoop\(\)/);
  assert.match(server, /ONLINE_STARTUP_NOT_READY/);
  assert.match(server, /Retry-After", "2"/);
  assert.match(server, /function isOnlineRuntimeUsable\(\)/);
  assert.match(server, /hasHydratedPersistentState[\s\S]*pool[\s\S]*!isDbQuotaExceeded/);
  assert.match(server, /mergeLessonPlanDbSources\(/);
  assert.match(server, /madrasah_lessonPlans/);
  assert.match(server, /madrasah_lesson_plans/);
  assert.match(server, /migrateLegacyLessonPlansTenantOwnership\(\)/);
  assert.match(server, /inferLegacyLessonPlanTenant\(/);
  assert.match(server, /filterLessonPlansForRequest\(req\)/);
  assert.match(server, /__legacyTenantRecoveredV1/);
  assert.match(server, /lessonPlans: filteredTenant/);
  assert.match(server, /lessonPlans: filtered/);
  assert.match(app, /waitForServerRuntimeReady\(/);
  assert.match(app, /fetch\('\/api\/health'/);
  assert.equal(app.includes("fetch('/readyz'"), false, 'frontend startup must not poll a 503 readiness endpoint');
  assert.match(app, /runtimeReady = await waitForServerRuntimeReady\(45000\)/);
  assert.match(app, /runtimeReady = await waitForServerRuntimeReady\(15000\)/);
  assert.match(app, /Array\.isArray\(resData\.data\) \? resData\.data : resData\.lessonPlans/);
  assert.match(settingsMisc, /Array\.isArray\(lpRes\.data\) \? lpRes\.data : \(lpRes\.lessonPlans \|\| \[\]\)/);
  assert.match(modulAjar, /isSameSubject\(lp\.subjectId, s\.id, appState\.subjects\)/);
  assert.equal(modulAjar.includes("String(lp.subjectId) === String(s.id)"), false);
  assert.match(mainEntry, /madrasah:runtime-ready/);
  assert.match(indexHtml, /id="app-initial-loader-status"/);
  const listenIndex = server.indexOf('const server = app.listen(PORT, "0.0.0.0"');
  const backgroundInitIndex = server.lastIndexOf('startOnlineRuntimeInitializationLoop();');
  assert.equal(listenIndex >= 0, true, 'server listen marker missing');
  assert.equal(backgroundInitIndex > listenIndex, true, 'online DB initialization must run after the port is listening');
  assert.equal(server.includes('akan terus di-hydrate di latar belakang'), false, 'misleading one-shot hydration warning remains');

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
  assert.match(server, /LKPD_STUDENT_STATE_V1/);
  assert.match(server, /TEACHER_SYNC_SCOPE_V2/);
  assert.match(server, /TEACHER_MONITOR_SCOPE_V2/);
  assert.match(server, /TEACHER_LIVECAM_SCOPE_V1/);
  assert.match(server, /function teacherCanMonitorStudentRealtime\(/);
  assert.match(server, /Guru hanya dapat membuka livecam siswa pada ujian aktif yang diampu/);
  assert.match(server, /Guru hanya dapat membuka livecam untuk ujian mata pelajaran\/bank soal yang diampu/);
  assert.match(server, /teacherCanMonitorStudentRealtime\(wsReq, user, target\)/);
  assert.match(server, /LKPD_STUDENT_SUBMISSION_WRITE_SCOPE/);
  assert.match(server, /LKPD_REALTIME_EVENT_V2/);
  assert.match(server, /STUDENT_ATTENDANCE_POLICY_V1/);
  assert.match(server, /function validateStudentAttendancePolicy\(/);
  assert.match(server, /const policyError = validateStudentAttendancePolicy\(req, photo, location\)/);
  assert.match(server, /for \(const item of data\.slice\(0, 100\)\)/);
  assert.match(server, /status: 'HADIR',[\s\S]*note: '',[\s\S]*timestamp: Date\.now\(\)/);
  assert.match(modules, /GPS belum tersedia atau tidak valid/);
  assert.equal(modules.includes("location: window._currentLatLon ? \`${window._currentLatLon.latitude}, ${window._currentLatLon.longitude}\` : '-6.2000, 106.8166'"), false);
  assert.match(server, /saveDeltaBatchDb/);
  assert.match(server, /monitoringStateKeyAllowedForActor/);
  assert.match(server, /teacherCanUseLkpdPayload/);
  assert.match(server, /function normalizeStudentStoredRole\(/);
  assert.match(server, /role: normalizeStudentStoredRole\(student\.role\)/);
  assert.match(server, /function studentCanAccessExam\(/);
  assert.match(server, /filteredExams = selfStudent[\s\S]*studentCanAccessExam\(selfStudent, exam\)/);
  assert.match(server, /filteredLkpds = selfStudent[\s\S]*studentCanAccessLkpd\(selfStudent, lkpd\)/);
  assert.match(server, /list = ownStudent \? list\.filter\(\(exam: any\) => studentCanAccessExam\(ownStudent, exam\)\) : \[\]/);
  assert.match(server, /const stateContext = getExamAttemptContext\(req, authUser, sId, eId\)/);
  assert.match(server, /summaryIsStudent \|\| studentCanAccessExam\(summaryStudent\.student, ex\)/);
  assert.equal(server.includes('role: student.role || "student"'), false);
  assert.equal(server.includes('role: req.body.role || "student"'), false);
  assert.equal(server.includes('role: req.body.role ?? st.role'), false);
  assert.match(server, /app\.delete\("\/api\/lkpds\/:id", requireAuth, requireRole/);
  assert.match(server, /parsed\.studentId === String\(studentId\)/);
  assert.match(server, /parsed\.lkpdId === String\(lkpdId\)/);
  assert.equal(server.includes('Guru hanya dapat memonitor ujian mata pelajaran/bank soal yang diampu'), true);
  assert.match(server, /function lkpdStateKey\(/);
  assert.match(server, /function lkpdBroadcastStateKey\(/);
  assert.match(server, /function lkpdLegacyStateKeysForRequest\(/);
  assert.match(server, /function lkpdStateCandidateKeys\(/);
  assert.match(server, /migrateDeltaState\(blockedStudents, 'blockedStudents'\)/);
  assert.match(server, /queueDelta\('activeExamSessions', legacyKey, null\)/);
  assert.match(server, /await saveDeltaBatchDb\(deltaWrites\)/);
  assert.match(server, /const blocked = personalKeys\.some/);
  assert.match(server, /for \(const candidate of personalKeys\) delete nextMessages\[candidate\]/);
  assert.match(server, /const ownCandidates = \(students \|\| \[\]\)\.filter/);
  assert.match(server, /app\.post\("\/api\/lkpd\/student-state"/);
  const lkpdModule = fs.readFileSync('src/lkpdModule.js', 'utf8');
  assert.match(lkpdModule, /fetch\('\/api\/lkpd\/student-state'/);
  assert.equal(lkpdModule.includes("fetch('/api/exam-monitoring-state')"), false);
  assert.match(lkpdModule, /LKPD_REALTIME_CLIENT_V2/);
  assert.equal(lkpdModule.includes("fetch('/api/lkpds')"), true);
  assert.match(lkpdModule, /fetch\('\/api\/lkpds\/' \+ encodeURIComponent\(lkpdId\), \{ method: 'DELETE' \}\)/);
  assert.match(lkpdModule, /payload\.active === false/);
  assert.equal((lkpdModule.match(/Date\.now\(\) - lastSeenAt < 30000/g) || []).length >= 2, true);
  assert.equal(app.includes("/api/sync-state?key=lkpdList"), false);
  assert.match(app, /payload.type === 'lkpd_progress'/);

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