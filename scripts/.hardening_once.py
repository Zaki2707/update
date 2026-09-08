from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    (ROOT / rel).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'Patch target not found: {label}')
    return text.replace(old, new, 1)


def sub_once(text, pattern, repl, label, flags=re.S):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'Patch target count for {label}: {count}')
    return out


# ------------------------------------------------------------------
# FRONTEND: remove credential logging + authenticated realtime tokens
# ------------------------------------------------------------------
app = read('src/appScript.js')
app = app.replace("        console.log('Login response:', data);\n", '', 1)

old_connect = """    function connect() {
        if (sseSource) {
            sseSource.close();
        }
        
        console.log('Connecting to real-time event stream...');
        sseSource = new EventSource('/api/realtime-stream');
"""
new_connect = """    async function connect() {
        if (sseSource) {
            sseSource.close();
        }

        console.log('Connecting to authenticated real-time event stream...');
        let realtimeTicket = '';
        try {
            const ticketResponse = await fetch('/api/realtime-token', { cache: 'no-store' });
            const ticketData = await ticketResponse.json();
            if (ticketResponse.ok && ticketData && ticketData.success && ticketData.token) {
                realtimeTicket = String(ticketData.token);
            }
        } catch (err) {
            console.warn('Unable to obtain realtime access ticket:', err);
        }

        if (!realtimeTicket) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connect, 5000);
            return;
        }

        sseSource = new EventSource('/api/realtime-stream?rt=' + encodeURIComponent(realtimeTicket));
"""
app = replace_once(app, old_connect, new_connect, 'authenticated SSE client')
write('src/appScript.js', app)


# ------------------------------------------------------------------
# CBT CLIENT: never persist answer keys; authenticate WS registration
# ------------------------------------------------------------------
assessment = read('src/assessmentModule.js')

old_sync = """async function syncExamStateToServer(payload) {
    try {
        await fetch('/api/exam-monitoring-state', {
"""
new_sync = """async function syncExamStateToServer(payload) {
    const role = String((appState && appState.role) || (appState.currentUser && appState.currentUser.role) || '').toLowerCase();
    if (['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(role)) {
        // Student state is persisted through the dedicated server-authoritative attempt endpoints.
        return;
    }
    try {
        await fetch('/api/exam-monitoring-state', {
"""
assessment = replace_once(assessment, old_sync, new_sync, 'disable legacy student monitoring-state writes')

helper_marker = "function prepareQuestionsForStudent(rawQuestions, ex) {"
helper_code = """function stripStudentQuestionSecrets(question) {
    if (!question || typeof question !== 'object') return question;
    const safe = { ...question };
    delete safe.answer;
    delete safe.answerKey;
    delete safe.correctAnswer;
    delete safe.correctOptionText;
    delete safe.originalOptions;
    delete safe.explanation;
    delete safe.solution;
    delete safe.key;
    return safe;
}

"""
if 'function stripStudentQuestionSecrets(question)' not in assessment:
    assessment = assessment.replace(helper_marker, helper_code + helper_marker, 1)

start = assessment.index(helper_marker)
ret = assessment.index('    return processed;', start)
assessment = assessment[:ret] + '    return processed.map(stripStudentQuestionSecrets);' + assessment[ret + len('    return processed;'):]

register_old = "JSON.stringify({ type: 'register', clientId: clientId })"
register_new = "JSON.stringify({ type: 'register', clientId: clientId, token: (appState.currentUser && appState.currentUser.token) || '' })"
count_register = assessment.count(register_old)
if count_register < 2:
    raise RuntimeError(f'Expected >=2 WebSocket register messages, found {count_register}')
assessment = assessment.replace(register_old, register_new)
write('src/assessmentModule.js', assessment)


# ------------------------------------------------------------------
# BACKEND SECURITY HARDENING
# ------------------------------------------------------------------
server = read('server.ts')

# Remove hardcoded PostgreSQL password fallbacks without exposing or depending on their value.
server, db_pw_count = re.subn(
    r"password:\s*process\.env\.SQL_PASSWORD\s*\|\|\s*'[^']*'",
    "password: process.env.SQL_PASSWORD",
    server,
)
if db_pw_count < 1:
    raise RuntimeError('No hardcoded SQL password fallback was removed')
server = re.sub(r"user:\s*process\.env\.SQL_USER\s*\|\|\s*'[^']*'", "user: process.env.SQL_USER || process.env.PGUSER", server)

# Trust Cloud Run proxy for correct req.ip and HTTPS awareness.
server = replace_once(
    server,
    "const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;\n",
    "const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;\nif (isOnlineMode) app.set('trust proxy', 1);\n",
    'trust proxy',
)

# Replace permissive CORS / framing policy with mode-aware production security headers.
cors_pattern = r'''app\.use\(\(req, res, next\) => \{\n  res\.setHeader\(\"Access-Control-Allow-Origin\", \"\*\"\);\n  res\.setHeader\(\"Access-Control-Allow-Methods\", \"GET, POST, PUT, DELETE, OPTIONS\"\);\n  res\.setHeader\(\"Access-Control-Allow-Headers\", \"\*\"\);\n  res\.removeHeader\(\"X-Frame-Options\"\);\n  res\.setHeader\(\"Content-Security-Policy\", \"frame-ancestors \*\"\);\n  if \(req\.method === \"OPTIONS\"\) \{[\s\S]*?\n  next\(\);\n\}\);'''
new_cors = r'''const configuredAllowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const effectiveProto = forwardedProto || req.protocol || (isOnlineMode ? 'https' : 'http');
  const selfOrigin = req.headers.host ? `${effectiveProto}://${req.headers.host}` : '';
  const originAllowed = !origin || origin === selfOrigin || configuredAllowedOrigins.has(origin);

  if (isOnlineMode) {
    if (origin && originAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token, X-Madrasah-Id, X-User-Id, X-User-Role');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');

  if (isOnlineMode) {
    const frameAncestors = String(process.env.ALLOWED_FRAME_ANCESTORS || "'self'").trim();
    res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
    if (!process.env.ALLOWED_FRAME_ANCESTORS) {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    } else {
      res.removeHeader('X-Frame-Options');
    }
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  } else {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  if (req.method === 'OPTIONS') {
    if (isOnlineMode && origin && !originAllowed) {
      return res.status(403).end();
    }
    return res.status(204).end();
  }
  next();
});'''
server = sub_once(server, cors_pattern, new_cors, 'CORS/security headers')

# Body limits + global API authentication/authorization + lightweight rate limiting.
body_old = """}); app.use(express.json({ limit: \"50mb\" }));
app.use(express.urlencoded({ extended: true, limit: \"50mb\" }));
if (isOfflineMode) app.use('/uploads', express.static(uploadsDir));
"""
body_new = """});
const requestBodyLimit = isOnlineMode ? '25mb' : '50mb';
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

const apiRateBuckets = new Map<string, { count: number; resetAt: number }>();
function enforceApiRateLimit(req: any, res: any, bucket: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
  const key = `${bucket}:${ip}`;
  let item = apiRateBuckets.get(key);
  if (!item || item.resetAt <= now) {
    item = { count: 0, resetAt: now + windowMs };
    apiRateBuckets.set(key, item);
  }
  item.count += 1;
  if (item.count > limit) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((item.resetAt - now) / 1000))));
    res.status(429).json({ success: false, message: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat.' });
    return false;
  }
  return true;
}

const staffRoles = new Set(['teacher', 'guru', 'admin', 'bos', 'superadmin']);
const adminRoles = new Set(['admin', 'bos', 'superadmin']);
const bossRoles = new Set(['bos', 'superadmin']);
const staffWritePrefixes = [
  '/api/teachers', '/api/students', '/api/classes', '/api/subjects',
  '/api/teacher-attendance', '/api/question-bank-groups', '/api/questions',
  '/api/grades', '/api/time-slots', '/api/grade-categories', '/api/system-settings',
  '/api/lesson-plans', '/api/schedules', '/api/rooms', '/api/journals',
  '/api/calendar-events', '/api/generated-exams'
];
const staffOnlyPrefixes = [
  '/api/teacher-attendance', '/api/question-bank-groups', '/api/journals',
  '/api/lesson-plans', '/api/generated-exams'
];

app.use((req: any, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const method = String(req.method || 'GET').toUpperCase();
  const p = String(req.path || '');
  if (method === 'OPTIONS') return next();

  const publicApi =
    (method === 'POST' && p === '/api/login') ||
    (method === 'POST' && p === '/api/register-madrasah') ||
    (method === 'GET' && p === '/api/settings') ||
    (method === 'GET' && p === '/api/health') ||
    (method === 'GET' && p.startsWith('/api/madrasah-by-slug/')) ||
    (method === 'GET' && p.startsWith('/api/photos/'));

  if (publicApi) {
    if (method === 'POST' && p === '/api/login') {
      const username = String(req.body?.username || '').trim().toLowerCase().slice(0, 128) || 'unknown';
      const limit = isOnlineMode ? 12 : 120;
      if (!enforceApiRateLimit(req, res, `login:${username}`, limit, 10 * 60 * 1000)) return;
    }
    if (method === 'POST' && p === '/api/register-madrasah') {
      const limit = isOnlineMode ? 8 : 80;
      if (!enforceApiRateLimit(req, res, 'register', limit, 60 * 60 * 1000)) return;
    }
    return next();
  }

  if (p === '/api/realtime-stream') {
    const realtimeUser = verifyRealtimeToken(String(req.query?.rt || ''));
    if (!realtimeUser) {
      return res.status(401).json({ success: false, message: 'Realtime access ticket tidak sah atau kedaluwarsa.' });
    }
    req.user = realtimeUser;
    return next();
  }

  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: 'Akses ditolak: Silakan login terlebih dahulu.' });
  }
  req.user = authUser;
  const role = String(authUser.role || '').toLowerCase();

  if (p.startsWith('/api/boss/') && !bossRoles.has(role)) {
    return res.status(403).json({ success: false, message: 'Akses khusus BOSS.' });
  }

  const adminOnly =
    p === '/api/db-status' ||
    p.startsWith('/api/system/backup') ||
    p.startsWith('/api/system/restore') ||
    (p === '/api/settings' && method !== 'GET');
  if (adminOnly && !adminRoles.has(role)) {
    return res.status(403).json({ success: false, message: 'Akses hanya untuk administrator.' });
  }

  if (staffOnlyPrefixes.some(prefix => p.startsWith(prefix)) && !staffRoles.has(role)) {
    return res.status(403).json({ success: false, message: 'Akses hanya untuk guru atau administrator.' });
  }

  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const exactStaffWrite = p === '/api/exams' || p === '/api/lkpds' || p === '/api/games';
  if (isMutation && (exactStaffWrite || staffWritePrefixes.some(prefix => p.startsWith(prefix))) && !staffRoles.has(role)) {
    return res.status(403).json({ success: false, message: 'Aksi ini hanya dapat dilakukan guru atau administrator.' });
  }

  if (p === '/api/realtime-token') {
    if (!enforceApiRateLimit(req, res, `realtime:${authUser.id}`, 120, 10 * 60 * 1000)) return;
  }
  if (p === '/api/boss/generate-activation-key') {
    if (!enforceApiRateLimit(req, res, `activation:${authUser.id}`, 60, 60 * 1000)) return;
  }

  next();
});

app.get('/api/realtime-token', (req: any, res) => {
  const authUser = req.user || getAuthUser(req);
  if (!authUser) return res.status(401).json({ success: false, message: 'Belum login.' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, token: createRealtimeToken(authUser), expiresIn: 600 });
});

if (isOfflineMode) app.use('/uploads', express.static(uploadsDir));
"""
server = replace_once(server, body_old, body_new, 'API guard/body limits')

# JWT: remove long-lived query-string bearer tokens; configurable session lifetime.
server = re.sub(
    r"\n  // 3\. Query token\n  if \(req\.query && req\.query\.token && typeof req\.query\.token === 'string'\) \{\n    const verified = verifyAuthToken\(req\.query\.token\.trim\(\)\);\n    if \(verified\) return verified;\n  \}",
    '',
    server,
    count=1,
)

jwt_marker = 'interface AuthSession {'
if 'function createRealtimeToken(user: any)' not in server:
    jwt_insert = """const requestedJwtTtl = Number(process.env.JWT_TTL_SECONDS || '');
const JWT_TTL_SECONDS = Number.isFinite(requestedJwtTtl) && requestedJwtTtl >= 900 && requestedJwtTtl <= (90 * 24 * 3600)
  ? Math.floor(requestedJwtTtl)
  : (isOnlineMode ? 12 * 3600 : 30 * 24 * 3600);

function createRealtimeToken(user: any): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is required for realtime authentication.');
  const payload = {
    id: String(user.id || ''),
    role: String(user.role || '').toLowerCase(),
    madrasahId: String(user.madrasahId || 'default'),
    scope: 'realtime',
    exp: Math.floor(Date.now() / 1000) + 600
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`realtime.${encoded}`).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyRealtimeToken(token: string): any | null {
  if (!JWT_SECRET || !token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`realtime.${encoded}`).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.scope !== 'realtime') return null;
    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

"""
    server = server.replace(jwt_marker, jwt_insert + jwt_marker, 1)

server = server.replace(
    "exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600) // 30 days",
    "exp: Math.floor(Date.now() / 1000) + JWT_TTL_SECONDS",
    1,
)

# Sanitize settings returned before login; restrict settings writes in depth.
settings_pattern = r'''app\.get\(\"/api/settings\", \(req, res\) => \{\n  res\.json\(\{ success: true, settings: appSettings, isOfflineMode \}\);\n\}\);\napp\.put\(\"/api/settings\", async \(req, res\) => \{'''
settings_repl = '''app.get("/api/settings", (req, res) => {
  const safeSettings: any = { ...(appSettings || {}) };
  ['adminPass', 'password', 'jwtSecret', 'apiKey', 'geminiApiKey', 'cloudinaryApiSecret'].forEach(k => delete safeSettings[k]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, settings: safeSettings, isOfflineMode });
});
app.put("/api/settings", requireAuth, requireRole(['admin', 'bos', 'superadmin']), async (req, res) => {'''
server = sub_once(server, settings_pattern, settings_repl, 'settings sanitization')

# Never send stored admin password hashes to BOSS browser either.
server = server.replace(
    "return res.json({ success: true, madrasahs: madrasahs || [] });",
    "return res.json({ success: true, madrasahs: (madrasahs || []).map(({ adminPass, ...rest }: any) => rest) });",
    1,
)

# Student privacy for attendance and grades reads.
attendance_old = """app.get(\"/api/attendance\", requireAuth, async (req, res) => {
  res.setHeader(\"Cache-Control\", \"no-cache, no-store, must-revalidate\");
  res.json({ success: true, attendance: filterByMadrasah(attendance || [], req) });
});
"""
attendance_new = """app.get(\"/api/attendance\", requireAuth, async (req: any, res) => {
  res.setHeader(\"Cache-Control\", \"no-cache, no-store, must-revalidate\");
  const authUser = req.user || getAuthUser(req);
  const role = String(authUser?.role || '').toLowerCase();
  let list = filterByMadrasah(attendance || [], req);
  if (role === 'student' || role === 'siswa') {
    list = list.filter((item: any) => String(item.studentId || '') === String(authUser.id));
  } else if (role === 'class_leader' || role === 'ketua_kelas') {
    const selfStudent = (students || []).find((s: any) => String(s.id) === String(authUser.id));
    const classId = selfStudent?.classId || selfStudent?.class_id || authUser?.classId || '';
    list = list.filter((item: any) => String(item.classId || '') === String(classId));
  }
  res.json({ success: true, attendance: list });
});
"""
server = replace_once(server, attendance_old, attendance_new, 'attendance privacy')

grades_old = """app.get(\"/api/grades\", requireAuth, (req, res) => {
  res.json({ success: true, grades: filterByMadrasah(grades, req) });
});
"""
grades_new = """app.get(\"/api/grades\", requireAuth, (req: any, res) => {
  const authUser = req.user || getAuthUser(req);
  const role = String(authUser?.role || '').toLowerCase();
  let list = filterByMadrasah(grades, req);
  if (['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(role)) {
    list = list.filter((item: any) => String(item.studentId || item.student_id || '') === String(authUser.id));
  }
  res.json({ success: true, grades: list });
});
"""
server = replace_once(server, grades_old, grades_new, 'grade privacy')

# Restore data-image values through the official photo storage boundary.
restore_helper_marker = 'function getOrGenerateSSLCert() {'
if 'async function persistRestoredImageData' not in server:
    restore_helper = """async function persistRestoredImageData(value: any): Promise<any> {
  if (typeof value === 'string') {
    return value.startsWith('data:image/') ? await saveBase64ToFirestore(value) : value;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await persistRestoredImageData(item));
    return out;
  }
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = await persistRestoredImageData(item);
    }
    return out;
  }
  return value;
}

"""
    server = server.replace(restore_helper_marker, restore_helper + restore_helper_marker, 1)

server = server.replace('    const backup = req.body;\n    if (!backup || typeof backup !== \'object\') {', "    let backup = req.body;\n    if (!backup || typeof backup !== 'object') {", 1)
restore_validation = """      return res.status(400).json({ success: false, message: \"Format file backup tidak valid.\" });
    }
"""
restore_validation_new = restore_validation + "    backup = await persistRestoredImageData(backup);\n"
server = replace_once(server, restore_validation, restore_validation_new, 'restore image persistence')

# Authenticated/scoped SSE clients.
server = server.replace(
    'let sseClients: express.Response[] = [];',
    'let sseClients: Array<{ res: express.Response; user: any }> = [];',
    1,
)

def replace_top_function(src, name, new_code):
    start_match = re.search(rf'^function {re.escape(name)}\([^\n]*\) \{{', src, flags=re.M)
    if not start_match:
      raise RuntimeError(f'Function not found: {name}')
    next_match = re.search(r'^(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(', src[start_match.end():], flags=re.M)
    if not next_match:
      raise RuntimeError(f'Next function not found after: {name}')
    end = start_match.end() + next_match.start()
    return src[:start_match.start()] + new_code.rstrip() + '\n\n' + src[end:]

server = replace_top_function(server, 'broadcastStateUpdate', """function broadcastStateUpdate(key: string, senderClientId?: string) {
  const payload = JSON.stringify({ type: 'state-update', key, senderClientId });
  sseClients = sseClients.filter(client => {
    const res = client.res;
    try {
      if ((res as any).writableEnded || (res as any).destroyed || (res as any).finished) return false;
      res.write(`data: ${payload}\\n\\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
      return true;
    } catch {
      return false;
    }
  });
}""")

server = replace_top_function(server, 'broadcastExamEvent', """function broadcastExamEvent(event: any) {
  const eventTenant = (() => {
    if (event?.madrasahId) return String(event.madrasahId);
    if (event?.examId) {
      const ex = (exams || []).find((item: any) => String(item.id) === String(event.examId));
      if (ex?.madrasahId || ex?.tenant) return String(ex.madrasahId || ex.tenant);
    }
    if (event?.studentId) {
      const st = (students || []).find((item: any) => String(item.id) === String(event.studentId));
      if (st?.madrasahId || st?.tenant) return String(st.madrasahId || st.tenant);
    }
    return '';
  })();
  const payload = JSON.stringify(event);

  sseClients = sseClients.filter(client => {
    const res = client.res;
    const user = client.user || {};
    try {
      if ((res as any).writableEnded || (res as any).destroyed || (res as any).finished) return false;
      const role = String(user.role || '').toLowerCase();
      const isBoss = role === 'bos' || role === 'superadmin';
      const isStudent = ['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(role);
      if (!isBoss && eventTenant && String(user.madrasahId || 'default') !== eventTenant) return true;
      if (!isBoss && !eventTenant && !isStudent) return true;
      if (isStudent && String(event?.studentId || '') !== String(user.id || '')) return true;
      res.write(`data: ${payload}\\n\\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
      return true;
    } catch {
      return false;
    }
  });
}""")

server = server.replace('app.get(\"/api/realtime-stream\", (req, res) => {', 'app.get(\"/api/realtime-stream\", (req: any, res) => {\n  const authUser = req.user || verifyRealtimeToken(String(req.query?.rt || \'\'));\n  if (!authUser) return res.status(401).end();', 1)
server = server.replace('  sseClients.push(res);', '  sseClients.push({ res, user: authUser });', 1)
server = server.replace('sseClients = sseClients.filter(c => c !== res);', 'sseClients = sseClients.filter(c => c.res !== res);', 1)

# WebSocket signaling: JWT-authenticated registration and server-controlled sender identity.
ws_start = server.find('    wss.on(\"connection\", (ws: any) => {')
ws_end_marker = '    console.log(\"WebRTC WebSocket Signaling Server initialized successfully!\");'
ws_end = server.find(ws_end_marker, ws_start)
if ws_start < 0 or ws_end < 0:
    raise RuntimeError('WebSocket signaling block not found')
secure_ws = r'''    wss.on("connection", (ws: any) => {
      let registeredClientId: string | null = null;
      let registeredUser: any = null;

      ws.on("message", (message: any) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "register") {
            const authUser = verifyAuthToken(String(data.token || ''));
            if (!authUser) {
              ws.close(4001, 'Unauthorized');
              return;
            }
            const requestedClientId = String(data.clientId || '');
            const role = String(authUser.role || '').toLowerCase();
            const isStudent = ['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(role);
            const isStaff = ['teacher', 'guru', 'admin', 'bos', 'superadmin'].includes(role);

            if (isStudent && requestedClientId !== String(authUser.id)) {
              ws.close(4003, 'Client identity mismatch');
              return;
            }
            if (requestedClientId === 'admin' && !isStaff) {
              ws.close(4003, 'Staff role required');
              return;
            }

            registeredUser = authUser;
            registeredClientId = requestedClientId || String(authUser.id);
            clients.set(registeredClientId, ws);
            console.log(`Signaling WS: authenticated client registered - ${registeredClientId}`);
          } else if (data.type === "signal") {
            if (!registeredUser || !registeredClientId) {
              ws.close(4001, 'Register first');
              return;
            }
            const recipientId = String(data.recipientId || '');
            const signal = data.signal;
            if (!recipientId || signal === undefined) return;

            const role = String(registeredUser.role || '').toLowerCase();
            const isStudent = ['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(role);
            const isBoss = role === 'bos' || role === 'superadmin';
            if (isStudent && recipientId !== 'admin') return;

            if (!isStudent && recipientId !== 'admin' && !isBoss) {
              const targetStudent = (students || []).find((st: any) => String(st.id) === recipientId);
              if (targetStudent) {
                const targetTenant = String(targetStudent.madrasahId || targetStudent.tenant || 'default');
                if (targetTenant !== String(registeredUser.madrasahId || 'default')) return;
              }
            }

            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === 1) {
              recipientWs.send(JSON.stringify({
                type: "signal",
                senderId: registeredClientId,
                signal
              }));
            }
          }
        } catch (e) {
          console.error("Signaling WS message error:", e);
        }
      });

      ws.on("close", () => {
        if (registeredClientId && clients.get(registeredClientId) === ws) {
          clients.delete(registeredClientId);
          console.log(`Signaling WS: Client disconnected - ${registeredClientId}`);
        }
      });

      ws.on("error", (err: any) => {
        console.error(`Signaling WS error for ${registeredClientId}:`, err);
      });
    });
'''
server = server[:ws_start] + secure_ws + server[ws_end:]

write('server.ts', server)


# ------------------------------------------------------------------
# ENV DOCUMENTATION
# ------------------------------------------------------------------
env = read('.env.example')
extra_env = """
# Keamanan origin untuk mode online (pisahkan dengan koma). Kosong = hanya same-origin.
ALLOWED_ORIGINS=
# Opsional: sumber iframe yang diizinkan. Default online: 'self'.
ALLOWED_FRAME_ANCESTORS=
# Masa berlaku sesi JWT dalam detik. Default: online 12 jam, offline 30 hari.
JWT_TTL_SECONDS=

# Alternatif konfigurasi PostgreSQL/Cloud SQL granular (jangan hardcode di source).
SQL_HOST=
SQL_USER=
SQL_PASSWORD=
SQL_DB_NAME=
"""
if 'ALLOWED_ORIGINS=' not in env:
    env = env.rstrip() + '\n' + extra_env
write('.env.example', env)


# ------------------------------------------------------------------
# PERSISTENT SECURITY AUDIT SCRIPT
# ------------------------------------------------------------------
audit_script = r'''const fs = require('fs');

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
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`Security audit passed (${checks.length}/${checks.length}).`);
'''
write('scripts/security-audit.cjs', audit_script)

pkg = json.loads(read('package.json'))
pkg.setdefault('scripts', {})['security:audit'] = 'node scripts/security-audit.cjs'
write('package.json', json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')

print('One-time hardening patch applied successfully.')
