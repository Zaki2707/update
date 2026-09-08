from pathlib import Path
import re

path = Path("src/appScript.js")
s = path.read_text(encoding="utf-8")

cleanup_marker = "// Storage cache hygiene: large server-authoritative datasets must not fill localStorage"
if cleanup_marker not in s:
    anchor = "\nvar appState = {"
    cleanup = """
// Storage cache hygiene: large server-authoritative datasets must not fill localStorage
(() => {
    try {
        localStorage.removeItem('madrasah_students');
        localStorage.removeItem('madrasah_student_livecam_frames');

        let role = '';
        try {
            const savedUser = JSON.parse(localStorage.getItem('madrasah_current_user') || 'null');
            role = String(savedUser && savedUser.role || '').toLowerCase();
        } catch (_) {}

        const examRecoveryRoles = ['student', 'class_leader', 'ketua_kelas'];
        if (!examRecoveryRoles.includes(role)) {
            localStorage.removeItem('madrasah_student_exam_questions');
        }
    } catch (_) {}
})();
"""
    if anchor not in s:
        raise SystemExit("appState anchor not found")
    s = s.replace(anchor, "\n" + cleanup + anchor, 1)

student_pattern = re.compile(r"    students: \(\(\) => \{\n.*?\n    \}\)\(\),\n    subjects:", re.S)
if student_pattern.search(s):
    s = student_pattern.sub("    students: [],\n    subjects:", s, count=1)
elif "    students: [],\n    subjects:" not in s:
    raise SystemExit("students initializer target not found")

safe_pattern = re.compile(
    r"function safeSetLocalStorage\(key, value\) \{.*?\n\}\nwindow\.safeSetLocalStorage = safeSetLocalStorage;",
    re.S
)

replacement = """function getLocalStorageRole() {
    let role = '';
    try {
        role = String(
            (appState && appState.currentUser && appState.currentUser.role) ||
            (appState && appState.role) ||
            ''
        ).toLowerCase();
    } catch (_) {}

    if (!role) {
        try {
            const savedUser = JSON.parse(localStorage.getItem('madrasah_current_user') || 'null');
            role = String(savedUser && savedUser.role || '').toLowerCase();
        } catch (_) {}
    }
    return role;
}

function safeSetLocalStorage(key, value) {
    const storageKey = String(key || '');
    if (!storageKey) return false;

    // Server/RAM is authoritative for the full student roster.
    if (storageKey === 'madrasah_students') {
        try { localStorage.removeItem(storageKey); } catch (_) {}
        return true;
    }

    // Livecam frames are ephemeral and must never consume persistent browser quota.
    if (storageKey === 'madrasah_student_livecam_frames') {
        try { localStorage.removeItem(storageKey); } catch (_) {}
        return true;
    }

    // Full per-student question maps are only useful as recovery cache on a student device.
    if (storageKey === 'madrasah_student_exam_questions') {
        const role = getLocalStorageRole();
        const recoveryRoles = ['student', 'class_leader', 'ketua_kelas'];
        if (!recoveryRoles.includes(role)) {
            try { localStorage.removeItem(storageKey); } catch (_) {}
            return true;
        }
    }

    let strVal;
    try {
        strVal = typeof value === 'string' ? value : JSON.stringify(value);
    } catch (e) {
        console.warn(`Gagal serialisasi localStorage key ${storageKey}:`, e);
        return false;
    }

    try {
        localStorage.setItem(storageKey, strVal);
        return true;
    } catch (e) {
        const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
        if (!isQuota) {
            console.warn(`LocalStorage error for ${storageKey}:`, e);
            return false;
        }

        console.warn(`LocalStorage kuota penuh saat menyimpan key: ${storageKey}. Membersihkan cache opsional...`);

        const disposableKeys = [
            'madrasah_students',
            'madrasah_student_livecam_frames',
            'madrasah_attendance_photos',
            'madrasah_teacherAttendance_photos',
            'madrasah_questionBank_photos'
        ];

        const role = getLocalStorageRole();
        if (!['student', 'class_leader', 'ketua_kelas'].includes(role)) {
            disposableKeys.push('madrasah_student_exam_questions');
        }

        for (const k of disposableKeys) {
            if (k === storageKey) continue;
            try { localStorage.removeItem(k); } catch (_) {}
        }

        try {
            localStorage.setItem(storageKey, strVal);
            return true;
        } catch (retryError) {
            console.warn(`LocalStorage tetap penuh; key ${storageKey} tidak dipersist. Data RAM/server tetap dipakai.`, retryError);
            return false;
        }
    }
}
window.safeSetLocalStorage = safeSetLocalStorage;"""

if safe_pattern.search(s):
    s = safe_pattern.sub(replacement, s, count=1)
elif "function getLocalStorageRole()" not in s:
    raise SystemExit("safeSetLocalStorage target not found")

path.write_text(s, encoding="utf-8")
