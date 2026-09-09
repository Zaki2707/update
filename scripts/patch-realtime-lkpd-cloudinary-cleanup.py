from pathlib import Path
import re


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def replace_once(text, old, new, label):
    count = text.count(old)
    require(count == 1, f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# 1) Frontend realtime + server-authoritative LKPD cache
# -----------------------------------------------------------------------------
app_path = Path('src/appScript.js')
app = app_path.read_text(encoding='utf-8')

hygiene_old = """        localStorage.removeItem('madrasah_students');
        localStorage.removeItem('madrasah_student_livecam_frames');

        let role = '';
"""
hygiene_new = """        localStorage.removeItem('madrasah_students');
        localStorage.removeItem('madrasah_student_livecam_frames');

        // LKPD can contain large embedded images. The server/RAM is authoritative;
        // remove legacy browser copies so they cannot exhaust localStorage quota.
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key === 'madrasah_lkpdList' || /^madrasah_.+_lkpdList$/.test(key))) {
                localStorage.removeItem(key);
            }
        }

        let role = '';
"""
app = replace_once(app, hygiene_old, hygiene_new, 'storage hygiene')

safe_marker = """function safeSetLocalStorage(key, value) {
    const storageKey = String(key || '');
    if (!storageKey) return false;

    // Server/RAM is authoritative for the full student roster.
"""
safe_replacement = """function safeSetLocalStorage(key, value) {
    const storageKey = String(key || '');
    if (!storageKey) return false;

    // Full LKPD state is server-authoritative and may contain large images.
    // Never persist it in localStorage; also purge any legacy copy quietly.
    if (storageKey === 'madrasah_lkpdList' || /^madrasah_.+_lkpdList$/.test(storageKey)) {
        try { localStorage.removeItem(storageKey); } catch (_) {}
        return false;
    }

    // Server/RAM is authoritative for the full student roster.
"""
app = replace_once(app, safe_marker, safe_replacement, 'safeSetLocalStorage LKPD guard')

realtime_pattern = re.compile(
    r"function initRealtimeSync\(\) \{.*?// Start realtime synchronization on load\nsetTimeout\(initRealtimeSync, 1000\);",
    re.S,
)
realtime_match = realtime_pattern.search(app)
require(realtime_match is not None, 'realtime block not found')
realtime_new = r'''function getStoredRealtimeAuthToken() {
    try {
        const saved = JSON.parse(localStorage.getItem('madrasah_current_user') || 'null');
        return saved && saved.token ? String(saved.token) : '';
    } catch (_) {
        return '';
    }
}

function initRealtimeSync() {
    // Prevent duplicate SSE loops when modules/routes are rendered repeatedly.
    if (window.__madrasahRealtimeStarted) return;
    window.__madrasahRealtimeStarted = true;

    let sseSource = null;
    let reconnectTimeout = null;
    let authWatchInterval = null;
    let connectedAuthToken = '';
    let rejectedAuthToken = '';

    const closeSource = () => {
        if (sseSource) {
            try { sseSource.close(); } catch (_) {}
            sseSource = null;
        }
        connectedAuthToken = '';
    };

    const scheduleReconnect = (delay = 1500) => {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, delay);
    };

    async function connect() {
        closeSource();

        const authToken = getStoredRealtimeAuthToken();
        if (!authToken) {
            // Logged-out/login page: wait locally. Do NOT hit protected endpoints.
            rejectedAuthToken = '';
            scheduleReconnect(1500);
            return;
        }

        // If this exact token was already rejected, wait for login/session rotation
        // instead of spamming /api/realtime-token with repeated 401 responses.
        if (rejectedAuthToken && rejectedAuthToken === authToken) {
            scheduleReconnect(2000);
            return;
        }

        console.log('Connecting to authenticated real-time event stream...');
        let realtimeTicket = '';
        try {
            const ticketResponse = await fetch('/api/realtime-token', { cache: 'no-store' });
            if (ticketResponse.status === 401 || ticketResponse.status === 403) {
                rejectedAuthToken = authToken;
                scheduleReconnect(2000);
                return;
            }
            const ticketData = await ticketResponse.json();
            if (ticketResponse.ok && ticketData && ticketData.success && ticketData.token) {
                realtimeTicket = String(ticketData.token);
            }
        } catch (err) {
            console.warn('Unable to obtain realtime access ticket:', err);
        }

        if (!realtimeTicket) {
            scheduleReconnect(5000);
            return;
        }

        rejectedAuthToken = '';
        connectedAuthToken = authToken;
        sseSource = new EventSource('/api/realtime-stream?rt=' + encodeURIComponent(realtimeTicket));

        sseSource.onmessage = function(event) {
            try {
                const payload = JSON.parse(event.data);
                if (payload && payload.type === 'state-update') {
                    if (payload.senderClientId !== appState.clientId) {
                        console.log('Real-time update received for key:', payload.key);
                        syncKeyFromServer(payload.key);
                    }
                } else if (payload && (payload.type === 'exam_progress' || payload.type === 'student_heartbeat' || payload.type === 'exam_violation' || payload.type === 'exam_finish' || payload.type === 'exam_started' || payload.type === 'exam_presence')) {
                    if (typeof window.__onExamMonitoringEvent === 'function') {
                        window.__onExamMonitoringEvent(payload);
                    }
                }
            } catch (e) {
                console.error('Error parsing SSE event data:', e);
            }
        };

        sseSource.onerror = function() {
            closeSource();
            scheduleReconnect(5000);
        };
    }

    // Detect login/logout/token rotation without making any network request while logged out.
    authWatchInterval = setInterval(() => {
        const currentToken = getStoredRealtimeAuthToken();
        if (!currentToken) {
            if (sseSource) closeSource();
            return;
        }
        if (connectedAuthToken && currentToken !== connectedAuthToken) {
            closeSource();
            rejectedAuthToken = '';
            scheduleReconnect(0);
        } else if (!sseSource && currentToken !== rejectedAuthToken && !reconnectTimeout) {
            scheduleReconnect(0);
        }
    }, 2000);

    window.__stopRealtimeSync = function() {
        closeSource();
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
        if (authWatchInterval) clearInterval(authWatchInterval);
        authWatchInterval = null;
        window.__madrasahRealtimeStarted = false;
    };

    connect();
}

window.initRealtimeSync = initRealtimeSync;

// Start realtime synchronization on load. When logged out this only performs a
// lightweight local auth check and does not call the protected realtime API.
setTimeout(initRealtimeSync, 1000);'''
app = app[:realtime_match.start()] + realtime_new + app[realtime_match.end():]
app_path.write_text(app, encoding='utf-8')

# -----------------------------------------------------------------------------
# 2) LKPD module: server/RAM authoritative, no full list in localStorage
# -----------------------------------------------------------------------------
lkpd_path = Path('src/lkpdModule.js')
lkpd = lkpd_path.read_text(encoding='utf-8')

init_pattern = re.compile(r"// Ensure appState has lkpdList initialized\nfunction initLkpdState\(\) \{.*?\n\}\n\n// Persist LKPD state", re.S)
init_match = init_pattern.search(lkpd)
require(init_match is not None, 'LKPD init block not found')
init_new = r'''// Ensure appState has lkpdList initialized.
// The backend/RAM is authoritative; full LKPD payloads are intentionally not
// restored from localStorage because custom images can exceed browser quota.
function initLkpdState() {
    if (!window.appState) return [];
    try {
        const legacyKey = window.getLkpdStorageKey();
        localStorage.removeItem(legacyKey);
        localStorage.removeItem('madrasah_lkpdList');
    } catch (_) {}
    if (!Array.isArray(window.appState.lkpdList)) {
        window.appState.lkpdList = [];
    }
    return window.appState.lkpdList;
}

// Persist LKPD state'''
lkpd = lkpd[:init_match.start()] + init_new + lkpd[init_match.end():]

save_pattern = re.compile(r"window\.saveLkpdState = async function\(\) \{.*?\n\};\n\n// ============================================================================\n// SVG THEMES", re.S)
save_match = save_pattern.search(lkpd)
require(save_match is not None, 'LKPD save block not found')
save_new = r'''window.saveLkpdState = async function() {
    if (!window.appState || !Array.isArray(window.appState.lkpdList)) return;

    // Safety lock: if the list is empty and user is student, DO NOT save or sync to prevent wiping server state.
    const isTeacherOrAdmin = window.appState.currentUser && ['teacher', 'guru', 'admin', 'administrator', 'BOSS'].includes(window.appState.currentUser.role || window.appState.role);
    if (window.appState.lkpdList.length === 0 && !isTeacherOrAdmin) {
        console.warn("Safety Lock: Blocked student empty lkpdList from overwriting server state.");
        return;
    }

    // Purge legacy browser copies. Cloud SQL/local backend remains authoritative.
    try {
        localStorage.removeItem(window.getLkpdStorageKey());
        localStorage.removeItem('madrasah_lkpdList');
    } catch (_) {}

    try {
        if (typeof window.saveState === 'function') {
            window.saveState('lkpdList');
        } else {
            await fetch('/api/sync-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'lkpdList', data: window.appState.lkpdList })
            }).catch(() => {});
        }
    } catch (err) {
        console.error("Error saving LKPD state:", err);
    }
};

// ============================================================================
// SVG THEMES'''
lkpd = lkpd[:save_match.start()] + save_new + lkpd[save_match.end():]
lkpd_path.write_text(lkpd, encoding='utf-8')

# -----------------------------------------------------------------------------
# 3) Settings loader/UI: no LKPD cache, Cloudinary wording
# -----------------------------------------------------------------------------
settings_path = Path('src/settingsAndMisc.js')
settings = settings_path.read_text(encoding='utf-8')

lkpd_load_old = """            if (res.lkpdList) {
                appState.lkpdList = res.lkpdList;
                const storageKey = typeof window.getLkpdStorageKey === 'function' ? window.getLkpdStorageKey() : 'madrasah_lkpdList';
                safeSetLocalStorage(storageKey, appState.lkpdList);
            }
"""
lkpd_load_new = """            if (res.lkpdList) {
                // Full LKPD payload stays in RAM/server; do not duplicate it in localStorage.
                appState.lkpdList = res.lkpdList;
            }
"""
settings = replace_once(settings, lkpd_load_old, lkpd_load_new, 'settings LKPD load cache')

settings = settings.replace(
    'Optimalkan kapasitas penyimpanan Firebase Anda secara cerdas dengan menghapus foto absensi lama namun tetap menyisakan minimal 1 foto terbaru untuk setiap siswa & guru.',
    'Optimalkan kapasitas Cloudinary dengan menghapus foto absensi lama (>30 hari) secara aman, sambil mempertahankan minimal 1 foto terbaru setiap siswa & guru serta seluruh foto yang masih direferensikan.'
)
settings = settings.replace(
    'Mengosongkan kolom foto pada data absensi guru agar menghemat ruang.',
    'Menghapus hanya foto absensi guru lama (>30 hari) yang aman dan tetap menyisakan minimal 1 foto terbaru setiap guru.'
)
settings = settings.replace(
    'Tindakan ini tidak dapat dibatalkan. Lanjutkan?',
    'Aset Cloudinary yang benar-benar usang akan dihapus permanen. Foto terbaru dan foto yang masih dipakai akan dipertahankan. Lanjutkan?'
)
settings_path.write_text(settings, encoding='utf-8')

# -----------------------------------------------------------------------------
# 4) Backend Cloudinary reference parsing and safe Smart Cleanup
# -----------------------------------------------------------------------------
server_path = Path('server.ts')
server = server_path.read_text(encoding='utf-8')

collect_pattern = re.compile(r"function collectReferencedPhotoIds\(\): Set<string> \{.*?\n\}\n\nasync function listActualCloudinaryPhotos", re.S)
collect_match = collect_pattern.search(server)
require(collect_match is not None, 'collectReferencedPhotoIds block not found')
collect_new = r'''function getCloudinaryPhotoIdFromReference(value: any): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.startsWith('data:image/')) return null;

  if (raw.startsWith('/api/photos/')) {
    const id = raw.slice('/api/photos/'.length).split(/[?#]/)[0];
    return id ? normalizeCloudinaryPhotoId(id) : null;
  }

  // Direct Cloudinary URLs can appear after restore/repair. Uploaded photos use
  // the dedicated madrasah_photos folder and sanitized one-segment public IDs.
  if (/^https?:\/\//i.test(raw) && raw.includes('/madrasah_photos/')) {
    try {
      const parsed = new URL(raw);
      const match = parsed.pathname.match(/\/madrasah_photos\/([^/]+)$/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]).replace(/\.[a-zA-Z0-9]+$/, '');
        return decoded ? normalizeCloudinaryPhotoId(decoded) : null;
      }
    } catch (_) {}
  }

  return null;
}

function collectReferencedPhotoIds(): Set<string> {
  const candidates = new Set<string>();
  const addPhotoId = (value: any) => {
    const photoId = getCloudinaryPhotoIdFromReference(value);
    if (photoId) candidates.add(photoId);
  };
  const scanDeep = (value: any, depth = 0) => {
    if (depth > 8 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      addPhotoId(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scanDeep(item, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const item of Object.values(value)) scanDeep(item, depth + 1);
    }
  };

  // Scan all known durable structures that can hold photo/image references.
  scanDeep(students || []);
  scanDeep(teachers || []);
  scanDeep(attendance || []);
  scanDeep(teacherAttendance || []);
  scanDeep(questions || []);
  scanDeep(lkpdList || []);
  scanDeep(lessonPlans || []);
  scanDeep(generatedExams || []);
  scanDeep(eduGames || []);
  scanDeep(appSettings || {});
  return candidates;
}

async function listActualCloudinaryPhotos'''
server = server[:collect_match.start()] + collect_new + server[collect_match.end():]

cleanup_pattern = re.compile(
    r"// Smart photo cleanup endpoint for admin \(preserves profile photos, photo history, and latest attendance photos\).*?(?=// 8\. Question Bank Groups API)",
    re.S,
)
cleanup_match = cleanup_pattern.search(server)
require(cleanup_match is not None, 'legacy Smart Cleanup block not found')
cleanup_new = r'''// Cloudinary Smart Cleanup: remove only old attendance photos that are no longer needed.
// It is deliberately conservative: no generic cross-tenant orphan deletion is performed because
// legacy Cloudinary public IDs are not tenant-prefixed.
function cleanupPhotoTimestamp(record: any): number {
  if (!record) return 0;
  const values = [record.timestamp, record.createdAt, record.updatedAt, record.date];
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value < 100000000000 ? value * 1000 : value;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 1000000000) {
      return numeric < 100000000000 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(String(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function cleanupPersonKey(record: any, kind: 'student' | 'teacher'): string {
  if (!record) return '';
  if (kind === 'teacher') {
    return String(record.teacherId || record.nip || record.username || '').trim();
  }
  return String(record.studentId || record.nis || record.username || '').trim();
}

function buildLatestAttendancePhotoMap(list: any[], kind: 'student' | 'teacher', req: any): Map<string, any> {
  const latest = new Map<string, any>();
  for (const record of (Array.isArray(list) ? list : [])) {
    if (!record || !isItemForCurrentMadrasah(record, req)) continue;
    const photoId = getCloudinaryPhotoIdFromReference(record.photo);
    const personKey = cleanupPersonKey(record, kind);
    if (!photoId || !personKey) continue;
    const existing = latest.get(personKey);
    if (!existing || cleanupPhotoTimestamp(record) > cleanupPhotoTimestamp(existing)) {
      latest.set(personKey, record);
    }
  }
  return latest;
}

function isOldCleanupCandidate(record: any, kind: 'student' | 'teacher', latest: Map<string, any>, req: any, cutoff: number): boolean {
  if (!record || !isItemForCurrentMadrasah(record, req)) return false;
  const photoId = getCloudinaryPhotoIdFromReference(record.photo);
  const personKey = cleanupPersonKey(record, kind);
  if (!photoId || !personKey) return false;
  if (latest.get(personKey) === record) return false; // Always retain newest photo for this person.
  const ts = cleanupPhotoTimestamp(record);
  return ts > 0 && ts < cutoff;
}

function collectNonAttendanceProtectedPhotoIds(): Set<string> {
  const protectedIds = new Set<string>();
  const scanDeep = (value: any, depth = 0) => {
    if (depth > 8 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      const id = getCloudinaryPhotoIdFromReference(value);
      if (id) protectedIds.add(id);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scanDeep(item, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const item of Object.values(value)) scanDeep(item, depth + 1);
    }
  };

  // Protect every non-attendance durable reference, across ALL tenants.
  scanDeep(students || []);
  scanDeep(teachers || []);
  scanDeep(questions || []);
  scanDeep(lkpdList || []);
  scanDeep(lessonPlans || []);
  scanDeep(generatedExams || []);
  scanDeep(eduGames || []);
  scanDeep(appSettings || {});
  return protectedIds;
}

async function destroyCloudinaryPhotoId(photoId: string): Promise<'deleted' | 'missing' | 'failed'> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return 'failed';
  const normalized = normalizeCloudinaryPhotoId(photoId);
  if (!normalized) return 'failed';
  const fullId = `madrasah_photos/${normalized}`;
  try {
    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(fullId, { resource_type: 'image', invalidate: true }, (error: any, response: any) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
    const outcome = String(result?.result || '').toLowerCase();
    if (outcome === 'ok') return 'deleted';
    if (outcome === 'not found') return 'missing';
    console.warn(`[Smart Cleanup] Unexpected Cloudinary delete result for ${fullId}:`, outcome || result);
    return 'failed';
  } catch (err: any) {
    console.warn(`[Smart Cleanup] Cloudinary delete failed for ${fullId}:`, err?.message || err);
    return 'failed';
  }
}

async function runCloudinaryAttendanceCleanup(req: any, teacherOnly = false) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary belum dikonfigurasi. Pembersihan tidak dijalankan.');
  }

  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const studentList = Array.isArray(attendance) ? attendance : [];
  const teacherList = Array.isArray(teacherAttendance) ? teacherAttendance : [];
  const latestStudents = buildLatestAttendancePhotoMap(studentList, 'student', req);
  const latestTeachers = buildLatestAttendancePhotoMap(teacherList, 'teacher', req);

  const candidateIds = new Set<string>();
  if (!teacherOnly) {
    for (const record of studentList) {
      if (isOldCleanupCandidate(record, 'student', latestStudents, req, cutoff)) {
        const id = getCloudinaryPhotoIdFromReference(record.photo);
        if (id) candidateIds.add(id);
      }
    }
  }
  for (const record of teacherList) {
    if (isOldCleanupCandidate(record, 'teacher', latestTeachers, req, cutoff)) {
      const id = getCloudinaryPhotoIdFromReference(record.photo);
      if (id) candidateIds.add(id);
    }
  }

  // Protect profile/history/question/logo/etc references globally.
  const protectedIds = collectNonAttendanceProtectedPhotoIds();

  // Also protect attendance references that are NOT eligible candidates, including
  // latest photos, recent photos, unknown-date photos, and every other tenant.
  for (const record of studentList) {
    const id = getCloudinaryPhotoIdFromReference(record?.photo);
    if (!id) continue;
    if (!isOldCleanupCandidate(record, 'student', latestStudents, req, cutoff)) protectedIds.add(id);
  }
  for (const record of teacherList) {
    const id = getCloudinaryPhotoIdFromReference(record?.photo);
    if (!id) continue;
    if (!isOldCleanupCandidate(record, 'teacher', latestTeachers, req, cutoff)) protectedIds.add(id);
  }

  const safeIds = [...candidateIds].filter(id => !protectedIds.has(id));
  const removableIds = new Set<string>();
  let deletedCount = 0;
  let alreadyMissingCount = 0;
  let failedCount = 0;

  for (const id of safeIds) {
    const result = await destroyCloudinaryPhotoId(id);
    if (result === 'deleted') {
      deletedCount++;
      removableIds.add(id);
    } else if (result === 'missing') {
      alreadyMissingCount++;
      removableIds.add(id);
    } else {
      failedCount++;
    }
  }

  let clearedStudentRefs = 0;
  let clearedTeacherRefs = 0;

  if (!teacherOnly && removableIds.size > 0) {
    await updateStoreKeyWithLock('attendance', (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      const latest = buildLatestAttendancePhotoMap(list, 'student', req);
      for (const record of list) {
        if (!isOldCleanupCandidate(record, 'student', latest, req, cutoff)) continue;
        const id = getCloudinaryPhotoIdFromReference(record.photo);
        if (id && removableIds.has(id)) {
          record.photo = '';
          clearedStudentRefs++;
        }
      }
      return list;
    });
  }

  if (removableIds.size > 0) {
    await updateStoreKeyWithLock('teacherAttendance', (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      const latest = buildLatestAttendancePhotoMap(list, 'teacher', req);
      for (const record of list) {
        if (!isOldCleanupCandidate(record, 'teacher', latest, req, cutoff)) continue;
        const id = getCloudinaryPhotoIdFromReference(record.photo);
        if (id && removableIds.has(id)) {
          record.photo = '';
          clearedTeacherRefs++;
        }
      }
      return list;
    });
  }

  // Remove stale map aliases only after Cloudinary confirms deletion/missing.
  let mapChanged = false;
  if (removableIds.size > 0) {
    for (const key of Object.keys(photoCloudinaryMap || {})) {
      const keyId = normalizeCloudinaryPhotoId(key);
      const valueId = getCloudinaryPhotoIdFromReference(photoCloudinaryMap[key]);
      if (removableIds.has(keyId) || (valueId && removableIds.has(valueId))) {
        delete photoCloudinaryMap[key];
        mapChanged = true;
      }
    }
    if (mapChanged) await saveData('photoCloudinaryMap', photoCloudinaryMap, true);
  }

  const tenantStudents = filterByMadrasah(students || [], req);
  const tenantTeachers = filterByMadrasah(teachers || [], req);
  const currentAttendance = filterByMadrasah((getMemoryKeyValue('attendance') || attendance || []), req);
  const currentTeacherAttendance = filterByMadrasah((getMemoryKeyValue('teacherAttendance') || teacherAttendance || []), req);
  const studentProfilePhotos = tenantStudents.filter((s: any) => Boolean(getCloudinaryPhotoIdFromReference(s?.photo))).length;
  const teacherProfilePhotos = tenantTeachers.filter((t: any) => Boolean(getCloudinaryPhotoIdFromReference(t?.photo))).length;
  const studentAttendancePhotos = currentAttendance.filter((a: any) => Boolean(getCloudinaryPhotoIdFromReference(a?.photo))).length;
  const teacherAttendancePhotos = currentTeacherAttendance.filter((a: any) => Boolean(getCloudinaryPhotoIdFromReference(a?.photo))).length;

  let remainingCount = studentProfilePhotos + teacherProfilePhotos + studentAttendancePhotos + teacherAttendancePhotos;
  try {
    remainingCount = (await listActualCloudinaryPhotos()).size;
  } catch (_) {}

  return {
    deletedCount,
    remainingCount,
    details: {
      studentProfilePhotos,
      teacherProfilePhotos,
      studentAttendancePhotos,
      teacherAttendancePhotos,
      candidateAssets: candidateIds.size,
      protectedAssets: candidateIds.size - safeIds.length,
      alreadyMissingCount,
      failedCount,
      clearedStudentRefs,
      clearedTeacherRefs,
      policy: 'older_than_30_days_keep_latest_per_person'
    }
  };
}

app.post("/api/admin/cleanup-photos", requireAuth, requireRole(['admin', 'bos', 'superadmin']), async (req: any, res) => {
  try {
    const result = await runCloudinaryAttendanceCleanup(req, false);
    return res.json({
      success: true,
      message: result.deletedCount > 0
        ? `Pembersihan Cloudinary selesai. ${result.deletedCount} aset foto absensi lama dihapus dengan aman.`
        : 'Pembersihan Cloudinary selesai. Tidak ada aset foto absensi lama yang aman untuk dihapus.',
      ...result
    });
  } catch (err: any) {
    console.error('[Smart Cleanup] Failed:', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'Pembersihan Cloudinary gagal.' });
  }
});

app.post("/api/admin/cleanup-teacher-photos", requireAuth, requireRole(['admin', 'bos', 'superadmin']), async (req: any, res) => {
  try {
    const result = await runCloudinaryAttendanceCleanup(req, true);
    return res.json({
      success: true,
      message: result.deletedCount > 0
        ? `Pembersihan foto absensi guru selesai. ${result.deletedCount} aset lama dihapus; foto terbaru setiap guru tetap dipertahankan.`
        : 'Tidak ada foto absensi guru lama yang aman untuk dihapus.',
      ...result
    });
  } catch (err: any) {
    console.error('[Teacher Smart Cleanup] Failed:', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'Pembersihan foto guru gagal.' });
  }
});

'''
server = server[:cleanup_match.start()] + cleanup_new + server[cleanup_match.end():]
server_path.write_text(server, encoding='utf-8')

# Keep tracked public mirrors synchronized with authoritative src files.
for name in ['appScript.js', 'lkpdModule.js', 'settingsAndMisc.js']:
    src = Path('src') / name
    dst = Path('public') / name
    require(src.exists() and dst.exists(), f'missing src/public pair for {name}')
    dst.write_text(src.read_text(encoding='utf-8'), encoding='utf-8')

print('Patch applied successfully.')
