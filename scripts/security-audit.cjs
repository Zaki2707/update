const fs = require('fs');

const server = fs.readFileSync('server.ts', 'utf8');
const app = fs.readFileSync('src/appScript.js', 'utf8');
const assessment = fs.readFileSync('src/assessmentModule.js', 'utf8');

const checks = [
  ['JWT query bearer removed', !server.includes('req.query.token')],
  ['Realtime ticket endpoint exists', server.includes("/api/realtime-token")],
  ['SSE requires realtime ticket', server.includes('verifyRealtimeToken') && app.includes("/api/realtime-stream?rt=")],
  ['WebSocket register carries JWT', assessment.includes("token: (appState.currentUser && appState.currentUser.token)")],
  ['WebSocket server verifies JWT', server.includes('authenticated client registered') && server.includes('verifyAuthToken(String(data.token')],
  ['No hardcoded SQL password fallback', !/password:\s*process\.env\.SQL_PASSWORD\s*\|\|/.test(server)],
  ['Settings response strips adminPass', server.includes("delete safeSettings[k]") && server.includes("'adminPass'")],
  ['Login response token not logged', !app.includes("console.log('Login response:', data)")],
  ['Student fallback strips answer key', assessment.includes('stripStudentQuestionSecrets') && assessment.includes('delete safe.answer')],
  ['Online request body limit reduced', server.includes("isOnlineMode ? '25mb' : '50mb'")],
  ['CORS origin allowlist exists', server.includes('ALLOWED_ORIGINS') && server.includes('originAllowed')],
  ['System restore image normalization exists', server.includes('persistRestoredImageData')],
  ['Student attendance privacy exists', server.includes("String(item.studentId || '') === String(authUser.id)")],
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
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`Security audit passed (${checks.length}/${checks.length}).`);
