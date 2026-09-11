const fs = require('fs');
const { execFileSync } = require('child_process');

const server = fs.readFileSync('server.ts', 'utf8');
const app = fs.readFileSync('src/appScript.js', 'utf8');
const assessment = fs.readFileSync('src/assessmentModule.js', 'utf8');
const modules = fs.readFileSync('src/modulesScript.js', 'utf8');
const adminModules = fs.readFileSync('src/adminModules.js', 'utf8');
const settingsModule = fs.readFileSync('src/settingsAndMisc.js', 'utf8');
const chatModule = fs.readFileSync('src/chatModule.js', 'utf8');
const gitignore = fs.readFileSync('.gitignore', 'utf8');
const firestoreRules = fs.readFileSync('firestore.rules', 'utf8');
const trackedFiles = new Set(execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean));
const trackedRuntimeUploads = [...trackedFiles].filter((p) => p.startsWith('uploads/') && !p.endsWith('/.gitkeep') && p !== 'uploads/.gitkeep');

const dbPullStart = server.indexOf('app.post("/api/db-pull-cloud"');
const dbPullEnd = server.indexOf('function isCloudServer', dbPullStart);
const dbPullRoute = dbPullStart >= 0 ? server.slice(dbPullStart, dbPullEnd > dbPullStart ? dbPullEnd : undefined) : '';
const syncStateStart = server.indexOf('app.post("/api/sync-state"');
const syncStateEnd = server.indexOf('// Real-time Event Stream', syncStateStart);
const syncStateRoute = syncStateStart >= 0 ? server.slice(syncStateStart, syncStateEnd > syncStateStart ? syncStateEnd : undefined) : '';
const gameSubmitRouteCount = (server.match(/app\.post\("\/api\/games\/:id\/submit"/g) || []).length;
const protectedAiPostRoutes = [
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
const aiRoutesAreStaffOnly = protectedAiPostRoutes.every((route) =>
  server.includes(`app.post("${route}", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin'])`)
);
const obsoleteRootScripts = [
  'apply_changes.cjs', 'check-base64-endpoints.js', 'ensure_all_records_tagged_and_saved.cjs',
  'fix-server-base64.js', 'fix-server-manual.js', 'fix-sync-state-base64.js', 'fix-sync-state.js',
  'fix-try.js', 'fix-try2.js', 'generate_offline_update.cjs', 'generate_offline_zip.js',
  'patch_absen.cjs', 'replace_modal.cjs', 'replace_modal.js', 'rewrite_modal.cjs',
  'seed_both_x4_and_xi11.cjs', 'seed_xi11_sync.cjs', 'simple_zip.cjs',
  'unify_attendance.cjs', 'zip_update.cjs'
];

const checks = [
  ['JWT query bearer removed', !server.includes('req.query.token')],
  ['Realtime ticket endpoint exists', server.includes("/api/realtime-token")],
  ['SSE requires realtime ticket', server.includes('verifyRealtimeToken') && app.includes("/api/realtime-stream?rt=")],
  ['WebSocket register carries JWT', assessment.includes("token: (appState.currentUser && appState.currentUser.token)")],
  ['WebSocket server verifies JWT', server.includes("verifyAuthToken(String(data.token || ''))") && server.includes("ws.close(4001, 'Unauthorized')") && server.includes("ws.close(4003, 'Client identity mismatch')")],
  ['No hardcoded SQL password fallback', !/password:\s*process\.env\.SQL_PASSWORD\s*\|\|/.test(server)],
  ['Settings response strips adminPass', server.includes('function sanitizeSettingsForClient') && server.includes("'adminPass', 'password', 'jwtSecret'") && server.includes('delete safe[key]')],
  ['Public settings strip realtime credentials', server.includes('function sanitizeSettingsForPublic') && server.includes("'turnUrl', 'turnUsername', 'turnCredential'") && server.includes("'livekitUrl', 'livekitApiKey'") && server.includes('const sourceSettings = authenticatedUser ? effectiveSettingsForRequest(req) : globalSettingsBase()') && server.includes('sanitizeSettingsForPublic(sourceSettings)')],
  ['Online restored images are Cloudinary authoritative', server.includes('Cloudinary wajib dikonfigurasi pada mode online.') && server.includes('Upload foto ke Cloudinary gagal. Foto tidak dianggap tersimpan.') && server.includes("return value.startsWith('data:image/') ? await saveBase64ToFirestore(value) : value;")],
  ['Cloudinary local uploads are offline-only', server.includes('// Local files are a real source only in OFFLINE mode. Online never depends on Cloud Run disk.') && server.includes('// In offline mode, orphan local files are also valid candidates for backup.')],
  ['Login response token not logged', !app.includes("console.log('Login response:', data)")],
  ['Student fallback strips answer key', assessment.includes('stripStudentQuestionSecrets') && assessment.includes('delete safe.answer')],
  ['Online request body limit reduced', server.includes("isOnlineMode ? '25mb' : '50mb'")],
  ['CORS origin allowlist exists', server.includes('ALLOWED_ORIGINS') && server.includes('originAllowed')],
  ['System restore image normalization exists', server.includes('persistRestoredImageData')],
  ['Student attendance privacy exists', server.includes("String(item.studentId || '') === String(authUser.id)")],
  ['Attendance existing-record matching is tenant scoped', server.includes('isItemForCurrentMadrasah(a, req) &&\n        (String(a.studentId) === String(studentId)') && server.includes('isItemForCurrentMadrasah(a, req) &&\n        String(a.teacherId) === String(teacherId)')],
  ['Role mutations resolve user inside tenant', server.includes('ID pengguna ambigu; pilih tenant dan akun target secara eksplisit.') && server.includes('resolveTenantItemIndexById(students, userId, req)') && server.includes('resolveTenantItemIndexById(teachers, userId, req)')],
  ['Student grade privacy exists', server.includes("item.studentId || item.student_id")],
  ['DB write throttle declarations exist', server.includes('const DB_WRITE_THROTTLE_INTERVAL = 3000;') && server.includes('const dbWriteTimeouts = new Map<string, NodeJS.Timeout>()') && server.includes('const lastDbWriteTimes = new Map<string, number>()')],
  ['LKPD role uses authenticated identity', server.includes('const authenticatedUser = req.user || getAuthUser(req)')],
  ['Online tenant isolation is strict', server.includes('Production isolation is strict')],
  ['Legacy HMAC activation disabled by default', server.includes('ALLOW_LEGACY_HMAC_ACTIVATION')],
  ['Teacher activation target is identity scoped', server.includes('Guru hanya dapat mengaktifkan token untuk akun sendiri')],
  ['CBT attempt context is server validated', server.includes('function getExamAttemptContext(')],
  ['CBT answer requires active session', server.includes('Session ujian tidak aktif. Muat ulang dan lanjutkan ujian.')],
  ['CBT answer validates assigned question', server.includes('Soal tidak termasuk dalam paket ujian siswa ini.')],
  ['CBT finish ignores client grade', !server.includes('const { examId, answers, clientGrade } = req.body')],
  ['CBT finish has no fabricated 100 fallback', server.includes('const pgScore = pgQuestions.length > 0 ? Math.round((correctPGCount / pgQuestions.length) * 100) : 0;') && server.includes('finalScore: essayQuestions.length === 0 ? pgScore : null')],
  ['CBT finish requires server master questions', server.includes('Kunci soal server tidak tersedia. Finalisasi ditolak')],
  ['Runtime local_store files are not tracked', !trackedFiles.has('local_store.json') && !trackedFiles.has('local_store.json.backup')],
  ['Runtime uploads are not tracked', trackedRuntimeUploads.length === 0],
  ['Runtime state and secrets are gitignored', gitignore.includes('local_store.json.*') && gitignore.includes('.madrasah-secrets/') && gitignore.includes('uploads/*')],
  ['Firestore is deny-all', firestoreRules.includes('allow read, write: if false') && !firestoreRules.includes('allow read, write: if true')],
  ['Local-store legacy key is environment-only', !server.includes('const LEGACY_ENCRYPTION_SECRET = "') && server.includes("readConfiguredSecret('LOCAL_STORE_LEGACY_SECRET')")],
  ['Token-lock legacy key is environment-only', !server.includes('const LEGACY_TOKEN_LOCK_SECRET = "') && server.includes("readConfiguredSecret('TOKEN_LOCK_LEGACY_SECRET')")],
  ['Online runtime secrets fail closed', server.includes('Cloud/online deployments must never silently fall back') && server.includes("resolveRuntimeSecret('LOCAL_STORE_SECRET'") && server.includes("resolveRuntimeSecret('TOKEN_LOCK_SECRET'")],
  ['Online DB pull is Cloud SQL authoritative', dbPullRoute.includes('ONLINE_DB_PULL_CLOUD_SQL_ONLY') && dbPullRoute.indexOf('if (isOnlineMode)') >= 0 && dbPullRoute.indexOf('if (isOnlineMode)') < dbPullRoute.indexOf('tryLocalBackupRestore') && dbPullRoute.includes("mode: 'online-cloud-sql-authoritative'")],
  ['Sync-state uses explicit role allowlists in all modes', syncStateRoute.includes('studentSyncKeys') && syncStateRoute.includes('staffSyncKeys') && syncStateRoute.includes('State sinkronisasi tidak diizinkan.')],
  ['JWT is not persisted in localStorage', app.includes("const AUTH_SESSION_TOKEN_KEY = 'madrasah_auth_token'") && app.includes('sessionStorage.setItem(AUTH_SESSION_TOKEN_KEY') && !app.includes("localStorage.setItem('madrasah_current_user', JSON.stringify(loggedInUser))") && !modules.includes("localStorage.setItem('madrasah_current_user', JSON.stringify(appState.currentUser))") && !adminModules.includes("localStorage.setItem('madrasah_current_user', JSON.stringify(appState.currentUser))") && !settingsModule.includes("localStorage.setItem('madrasah_current_user', JSON.stringify(appState.currentUser))")],
  ['Student self-profile is identity scoped', server.includes('app.put("/api/student/profile", requireAuth, requireRole') && server.includes("String(item.id) === ownId && isItemForCurrentMadrasah(item, req)") && server.includes('Username sudah digunakan siswa lain.')],
  ['Chat list is private for students', server.includes('String(c.senderId) === ownId || String(c.receiverId) === ownId')],
  ['Chat HTML sinks escape user content', chatModule.includes('chatEscape(msg.text)') && chatModule.includes('isSafeChatAttachment')],
  ['Photo endpoint blocks traversal and active image formats', server.includes('isSafeManagedPhotoId') && server.includes('parseSafeRasterDataUrl') && server.includes("SAFE_RASTER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])") && server.includes('path.basename(id) === id')],
  ['Token approval is terminal and serialized', server.includes('withTokenLedger(async () =>') && server.includes("String(reqItem.status || 'pending').toLowerCase() !== 'pending'") && server.includes('Permintaan top-up ini sudah diproses')],
  ['Teacher token edits are BOSS-only', server.includes('app.put("/api/teachers/:id/tokens", requireAuth, requireRole([\'bos\', \'superadmin\'])')],
  ['Offline activation is offline-only and replay-safe', server.includes('Kode aktivasi offline hanya dapat digunakan pada instalasi offline.') && server.includes('usedActivationKeys.includes(signature)') && server.includes('withTokenLedger(async () =>')],
  ['CBT broadcast messages and violations are tenant namespaced', server.includes('function examBroadcastStateKey(') && server.includes('function resolveExamViolationLogKey(') && server.includes('normalizeExamMessageMapKeysForRequest') && !server.includes('examViolationLogs[eId].unshift')],
  ['Signaling payloads are bounded', server.includes('signalSize > 256 * 1024') && server.includes('maxPayload: 256 * 1024') && server.includes('Frame livecam terlalu besar.')],
  ['Offline update archive is authenticated and offline-only', server.includes('app.get("/update_offline.zip", requireAuth, requireRole') && server.includes('if (isOnlineMode) return res.status(404).send("Not found")')],
  ['Student attendance sync is identity scoped', syncStateRoute.includes('Siswa hanya dapat menyinkronkan absensi miliknya.') && syncStateRoute.includes('mergeTenantScopedSyncRecords')],
  ['Tenant settings sync is isolated from global protected settings', syncStateRoute.includes('sanitizeSettingsMutation(data, true)') && syncStateRoute.includes('__tenantScopedSettingsV1') && server.includes("'paymentAccounts', 'cbtTokenPrice'")],
  ['Generic settings PUT is BOSS-only', server.includes('app.put("/api/settings", requireAuth, requireRole([\'bos\', \'superadmin\'])')],
  ['Per-key DB writes are serialized', server.includes('const dbWriteQueue = new KeyedSerialQueue()') && server.includes('dbWriteQueue.run(key, () => writeKeyToPostgresDirectUnlocked(key))')],
  ['CBT delta writes are serialized', server.includes('await dbWriteQueue.run(dbKey, async () =>')],
  ['State-update SSE is tenant scoped', server.includes('requestRealtimeContext.getStore()') && server.includes('clientTenant !== eventTenant')],
  ['CBT runtime state is tenant namespaced', server.includes('function examStateKey(') && server.includes('v2::') && server.includes('resolveExamStateKey(req')],
  ['Exam deletion is staff-only', server.includes('app.delete("/api/exams/:id", requireAuth, requireRole')],
  ['Online CRUD batch routes are non-destructive', server.includes('exams = isOnlineMode') && server.includes('rooms = isOnlineMode') && server.includes('journals = isOnlineMode') && server.includes('calendarEvents = isOnlineMode') && server.includes('generatedExams = isOnlineMode')],
  ['Tenant list sync retags client supplied tenant identity', server.includes('Tenant identity is server-authoritative') && server.includes('delete clean.madrasahId') && server.includes('delete clean.madrasahSlug')],
  ['Online CRUD sync omission is non-destructive', server.includes('function mergeTenantCrudSyncData(') && server.includes('Explicit DELETE routes') && server.includes("questions = mergeTenantCrudSyncData(questions, data, req)") && server.includes("rooms = mergeTenantCrudSyncData(rooms, data, req)") && server.includes("grades = mergeTenantCrudSyncData(grades, data, req)")],
  ['Question bank batch cannot shrink online state', server.includes('QUESTION_BANK_SHRINK_GUARD') && server.includes("mode: isOnlineMode ? 'merge-non-destructive' : 'replace-offline'") && server.includes('questions = mergeTenantCrudSyncData(questions, incoming, req)')],
  ['Question bank persistence is read-back verified', server.includes('function verifyOnlineArrayPersistence(') && server.includes('PERSISTENCE_VERIFY_FAILED') && server.includes("key === 'questions' || key === 'questionBankGroups'")],
  ['Question bank routes require authenticated staff', server.includes('app.get("/api/question-bank-groups", requireAuth, requireRole') && server.includes('app.post("/api/questions/batch", requireAuth, requireRole') && server.includes('app.put("/api/questions/:id", requireAuth, requireRole')],
  ['Replace-list sync is retained only for roster-like state', server.includes("schedules = mergeTenantListData(schedules, data, req)") && server.includes("savedRosters = mergeTenantListData(savedRosters, data, req)") && server.includes("timeSlots = mergeTenantListData(timeSlots, data, req)")],
  ['Frontend CRUD deletes use explicit API routes', assessment.includes("/api/rooms/") && fs.readFileSync('src/cbtModules.js', 'utf8').includes("/api/journals/") && fs.readFileSync('src/calendarModule.js', 'utf8').includes("/api/calendar-events/") && fs.readFileSync('src/modulAjarModule.js', 'utf8').includes("/api/generated-exams/")],
  ['Student LKPD merge only accepts own submissions', server.includes("String(sub.studentId) !== String(authenticatedUser?.id || '')")],
  ['Chat mutations are tenant scoped', server.includes("Siswa hanya dapat menandai pesan yang diterimanya sendiri.") && server.includes("Pesan tidak ditemukan pada madrasah ini.") && server.includes("filterByMadrasah(students || [], req)")],
  ['Game ephemeral state is tenant namespaced', server.includes('function gameStudentStorageKey') && server.includes('function gameBroadcastStorageKey') && server.includes("madrasahId: gameTenantNamespace(req)")],
  ['Game without authoritative key never awards XP by default', server.includes('No authoritative answer key: never award XP by default.')],
  ['Randomized CBT auto-correction uses per-student master packet', server.includes('async function getAutoGradeAttempt') && server.includes('studentExamMasterQuestions[key]') && server.includes('attempt.essayQuestions')],
  ['Teacher writes are identity/admin scoped', server.includes('TEACHER_SELF_UPDATE_SCOPE') && server.includes('Guru hanya dapat mengubah profil sendiri.') && server.includes('app.post("/api/teachers", requireAuth, requireRole([\'admin\', \'bos\', \'superadmin\'])') && server.includes('app.delete("/api/teachers/:id", requireAuth, requireRole([\'admin\', \'bos\', \'superadmin\'])')],
  ['Subject mutations are admin scoped and rename-safe', server.includes('SUBJECT_RENAME_CASCADE') && server.includes('app.put("/api/subjects/:id", requireAuth, requireRole([\'admin\', \'bos\', \'superadmin\'])')],
  ['Question bank empty state cannot refetch forever', fs.readFileSync('src/cbtModules.js', 'utf8').includes('QUESTION_BANK_LOAD_GUARD')],
  ['Import groups use server-authoritative tenant state', fs.readFileSync('src/modulAjarModule.js', 'utf8').includes('IMPORT_GROUP_SERVER_AUTHORITATIVE') && !fs.readFileSync('src/modulAjarModule.js', 'utf8').includes("localStorage.setItem('madrasah_import_groups'"))],
  ['Online restore is add-only and conflict-safe', server.includes("mode: 'online-add-only-v1'") && server.includes('nonDestructive: true') && server.includes('buildOnlineSafeRestorePlan')],
  ['Recovery capability remains strict v2', server.includes("capability: 'master-recovery-missing-only-v2'")],
  ['Only one canonical game submit route exists', gameSubmitRouteCount === 1],
  ['No wildcard frame-ancestors override remains', !server.includes('frame-ancestors *')],
  ['LiveKit online fails closed before dev fallback', server.includes('LiveKit online belum dikonfigurasi dengan aman.') && server.includes('if (isOnlineMode && (!apiKey || !apiSecret || !serverUrl')],
  ['WebSocket admin identity is tenant namespaced', server.includes("'admin::' + tenant")],
  ['HTTP student signaling queue is tenant namespaced', server.includes("return 'student::' + tenant + '::' + String(studentId)")],
  ['WebSocket student identity is tenant namespaced', server.includes("student ? ('student::' + tenant + '::' + publicId)")],
  ['LiveKit physical room is tenant namespaced', server.includes("const physicalRoomName = 'room_tenant_'") && server.includes('at.addGrant({ room: physicalRoomName')],
  ['Grade upsert is tenant scoped', server.includes('g => isItemForCurrentMadrasah(g, req) &&') && server.includes('Nilai hanya dapat dibuat untuk siswa dan kelas pada tenant yang sama.')],
  ['Student delete cascades are tenant scoped', server.includes('!isItemForCurrentMadrasah(a, req) ||') && server.includes('!isItemForCurrentMadrasah(g, req) ||')],
  ['Regular student IDs reject duplicates', server.includes('ID siswa sudah digunakan. Gunakan ID lain agar state CBT dan realtime tetap unik.')],
  ['Import groups are tenant scoped', server.includes("let list = filterByMadrasah(importGroups || [], req)") && server.includes("tagNewRecord(raw, req)") && server.includes("isItemForCurrentMadrasah(g, req)")],
  ['Teacher deletion is tenant scoped', server.includes('teacherCandidates.find((t: any) => isItemForCurrentMadrasah(t, req))') && server.includes("teachers = teachers.filter((t: any) => !(String(t.id) === String(id) && isItemForCurrentMadrasah(t, req)))")],
  ['Legacy duplicate IDs resolve inside request tenant', server.includes('function resolveTenantItemIndexById(') && server.includes('ID guru ambigu lintas tenant') && server.includes('ID siswa ambigu lintas tenant') && server.includes('ID kelas ambigu lintas tenant') && server.includes('ID mata pelajaran ambigu lintas tenant')],
  ['Student photo-history attendance cleanup is tenant scoped', server.includes('if (isItemForCurrentMadrasah(a, req) &&') && server.includes('a.photo === photoUrl')],
  ['Tenant configuration envelope exists', server.includes('function tenantConfigValue(') && server.includes('function setTenantConfigValue(') && server.includes('__tenantScopedConfigV1')],
  ['Geofence settings are tenant scoped', server.includes("tenantConfigValue(schoolLocationSettings, req") && server.includes("setTenantConfigValue(\n    schoolLocationSettings")],
  ['Time slots and KBM are tenant scoped', server.includes('timeSlots = mergeTenantListData(timeSlots, newSlots, req)') && server.includes("tenantConfigValue(kbmDuration, req, 40, 'kbmDuration')")],
  ['Grade categories and custom columns are tenant scoped', server.includes("setTenantConfigValue(gradeCategories, req") && server.includes("setTenantConfigValue(customGradeColumns, req") && app.includes("endpoint = '/api/custom-grade-columns'")],
  ['Chunk restore is bound to owner and tenant', server.includes('session.owner !== owner || session.tenant !== tenant') && server.includes('15 * 60 * 1000')],
  ['AI and document generation routes are staff-only', aiRoutesAreStaffOnly],
  ['Auto-correction resolves exam and LKPD inside tenant', server.includes('ID ujian ambigu lintas tenant. Pilih madrasah target terlebih dahulu.') && server.includes('ID LKPD ambigu lintas tenant. Pilih madrasah target terlebih dahulu.') && server.includes('canonicalRealtimeTenant(st?.madrasahId || st?.madrasahSlug || \'default\') === examTenant') && server.includes('canonicalRealtimeTenant(s?.madrasahId || s?.madrasahSlug || \'default\') === lkpdTenant')],
  ['LKPD auto-correction uses authoritative in-memory state', !server.includes('const store = readLocalStore();\n    let lkpdList = store.lkpdList || [];') && server.includes("await saveData('lkpdList', lkpdList);")],
  ['Static SVG placeholder is sandboxed', server.includes("Content-Security-Policy', \"default-src 'none'; style-src 'none'; script-src 'none'; sandbox\"") && server.includes("X-Content-Type-Options', 'nosniff'")],
  ['Obsolete patch and seed scripts are not tracked', obsoleteRootScripts.every((name) => !trackedFiles.has(name))],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`Security audit passed (${checks.length}/${checks.length}).`);
