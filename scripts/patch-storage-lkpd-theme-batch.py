from pathlib import Path
import re


def require(cond, msg):
    if not cond:
        raise SystemExit(msg)


def replace_once(text, old, new, label):
    count = text.count(old)
    require(count == 1, f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# 1) Backend: exact per-person photo retention + managed LKPD/theme assets
# -----------------------------------------------------------------------------
server_path = Path('server.ts')
server = server_path.read_text(encoding='utf-8')
pattern = re.compile(
    r"// Cloudinary Smart Cleanup: remove only old attendance photos that are no longer needed\..*?(?=// 8\. Question Bank Groups API)",
    re.S,
)
match = pattern.search(server)
require(match is not None, 'Smart Cleanup block not found')

new_block = r'''// Cloudinary Smart Cleanup: exact per-person retention policy.
// For each person in the active tenant, retain only the active profile photo and
// the newest attendance photo. Older profile-history and attendance photo refs
// are removed; Cloudinary assets are deleted only when no durable reference
// anywhere in the application still needs them.
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
  return kind === 'teacher'
    ? String(record.teacherId || record.nip || record.username || '').trim()
    : String(record.studentId || record.nis || record.username || '').trim();
}

function historyPhotoValue(entry: any): any {
  return typeof entry === 'string' ? entry : entry?.photo;
}

function buildLatestAttendancePhotoMap(list: any[], kind: 'student' | 'teacher', req: any): Map<string, any> {
  const latest = new Map<string, any>();
  for (const record of (Array.isArray(list) ? list : [])) {
    if (!record || !isItemForCurrentMadrasah(record, req) || !record.photo) continue;
    const personKey = cleanupPersonKey(record, kind);
    if (!personKey) continue;
    const existing = latest.get(personKey);
    if (!existing || cleanupPhotoTimestamp(record) >= cleanupPhotoTimestamp(existing)) {
      latest.set(personKey, record);
    }
  }
  return latest;
}

function isExtraAttendancePhoto(record: any, kind: 'student' | 'teacher', latest: Map<string, any>, req: any): boolean {
  if (!record || !record.photo || !isItemForCurrentMadrasah(record, req)) return false;
  const personKey = cleanupPersonKey(record, kind);
  if (!personKey) return false;
  return latest.get(personKey) !== record;
}

function collectCleanupProtectedIds(req: any, latestStudents: Map<string, any>, latestTeachers: Map<string, any>, teacherOnly: boolean): Set<string> {
  const protectedIds = new Set<string>();
  const add = (value: any) => {
    const id = getCloudinaryPhotoIdFromReference(value);
    if (id) protectedIds.add(id);
  };
  const scanDeep = (value: any, depth = 0) => {
    if (depth > 8 || value === null || value === undefined) return;
    if (typeof value === 'string') { add(value); return; }
    if (Array.isArray(value)) { for (const item of value) scanDeep(item, depth + 1); return; }
    if (typeof value === 'object') { for (const item of Object.values(value)) scanDeep(item, depth + 1); }
  };

  // Active profile photos are always retained globally.
  for (const person of (students || [])) add(person?.photo);
  for (const person of (teachers || [])) add(person?.photo);

  // Profile history belonging to other tenants is untouched. During teacher-only
  // cleanup, student history in the active tenant is also untouched.
  for (const person of (students || [])) {
    if (!isItemForCurrentMadrasah(person, req) || teacherOnly) scanDeep(person?.photoHistory || []);
  }
  for (const person of (teachers || [])) {
    if (!isItemForCurrentMadrasah(person, req)) scanDeep(person?.photoHistory || []);
  }

  // Protect every non-profile durable image reference.
  scanDeep(questions || []);
  scanDeep(lkpdList || []);
  scanDeep(lessonPlans || []);
  scanDeep(generatedExams || []);
  scanDeep(eduGames || []);
  scanDeep(appSettings || {});
  scanDeep(exams || []);
  scanDeep(studentExamQuestions || {});
  scanDeep(activeExamSessions || {});

  // Attendance of other tenants is always protected. In the active tenant only
  // the newest attendance photo per person is protected.
  for (const record of (attendance || [])) {
    if (!isItemForCurrentMadrasah(record, req) || teacherOnly) add(record?.photo);
  }
  for (const record of (teacherAttendance || [])) {
    if (!isItemForCurrentMadrasah(record, req)) add(record?.photo);
  }
  for (const record of latestStudents.values()) add(record?.photo);
  for (const record of latestTeachers.values()) add(record?.photo);

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
        if (error) reject(error); else resolve(response);
      });
    });
    const outcome = String(result?.result || '').toLowerCase();
    if (outcome === 'ok') return 'deleted';
    if (outcome === 'not found') return 'missing';
    console.warn(`[Cloudinary Cleanup] Unexpected delete result for ${fullId}:`, outcome || result);
    return 'failed';
  } catch (err: any) {
    console.warn(`[Cloudinary Cleanup] Delete failed for ${fullId}:`, err?.message || err);
    return 'failed';
  }
}

async function removePhotoMapAliases(ids: Set<string>) {
  if (!ids.size) return;
  let changed = false;
  for (const key of Object.keys(photoCloudinaryMap || {})) {
    const keyId = normalizeCloudinaryPhotoId(key);
    const valueId = getCloudinaryPhotoIdFromReference(photoCloudinaryMap[key]);
    if (ids.has(keyId) || (valueId && ids.has(valueId))) {
      delete photoCloudinaryMap[key];
      changed = true;
    }
  }
  if (changed) await saveData('photoCloudinaryMap', photoCloudinaryMap, true);
}

async function runCloudinaryAttendanceCleanup(req: any, teacherOnly = false) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary belum dikonfigurasi. Pembersihan tidak dijalankan.');
  }

  const studentList = Array.isArray(attendance) ? attendance : [];
  const teacherList = Array.isArray(teacherAttendance) ? teacherAttendance : [];
  const latestStudents = buildLatestAttendancePhotoMap(studentList, 'student', req);
  const latestTeachers = buildLatestAttendancePhotoMap(teacherList, 'teacher', req);
  const candidateIds = new Set<string>();

  if (!teacherOnly) {
    for (const record of studentList) {
      if (isExtraAttendancePhoto(record, 'student', latestStudents, req)) {
        const id = getCloudinaryPhotoIdFromReference(record.photo);
        if (id) candidateIds.add(id);
      }
    }
    for (const person of (students || [])) {
      if (!isItemForCurrentMadrasah(person, req)) continue;
      const currentId = getCloudinaryPhotoIdFromReference(person?.photo);
      for (const entry of (Array.isArray(person?.photoHistory) ? person.photoHistory : [])) {
        const id = getCloudinaryPhotoIdFromReference(historyPhotoValue(entry));
        if (id && id !== currentId) candidateIds.add(id);
      }
    }
  }

  for (const record of teacherList) {
    if (isExtraAttendancePhoto(record, 'teacher', latestTeachers, req)) {
      const id = getCloudinaryPhotoIdFromReference(record.photo);
      if (id) candidateIds.add(id);
    }
  }
  for (const person of (teachers || [])) {
    if (!isItemForCurrentMadrasah(person, req)) continue;
    const currentId = getCloudinaryPhotoIdFromReference(person?.photo);
    for (const entry of (Array.isArray(person?.photoHistory) ? person.photoHistory : [])) {
      const id = getCloudinaryPhotoIdFromReference(historyPhotoValue(entry));
      if (id && id !== currentId) candidateIds.add(id);
    }
  }

  const protectedIds = collectCleanupProtectedIds(req, latestStudents, latestTeachers, teacherOnly);
  const deleteIds = [...candidateIds].filter(id => !protectedIds.has(id));
  const removableIds = new Set<string>();
  let deletedCount = 0;
  let alreadyMissingCount = 0;
  let failedCount = 0;

  for (const id of deleteIds) {
    const result = await destroyCloudinaryPhotoId(id);
    if (result === 'deleted') { deletedCount++; removableIds.add(id); }
    else if (result === 'missing') { alreadyMissingCount++; removableIds.add(id); }
    else failedCount++;
  }

  // A candidate asset protected by a retained reference may still be removed from
  // old history/attendance rows because the underlying asset remains in use.
  const resolvedIds = new Set<string>(removableIds);
  for (const id of candidateIds) if (protectedIds.has(id)) resolvedIds.add(id);

  let clearedStudentRefs = 0;
  let clearedTeacherRefs = 0;
  let trimmedStudentHistory = 0;
  let trimmedTeacherHistory = 0;

  if (!teacherOnly) {
    await updateStoreKeyWithLock('attendance', (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      const latest = buildLatestAttendancePhotoMap(list, 'student', req);
      for (const record of list) {
        if (!isExtraAttendancePhoto(record, 'student', latest, req)) continue;
        const id = getCloudinaryPhotoIdFromReference(record.photo);
        if (!id || resolvedIds.has(id)) { record.photo = ''; clearedStudentRefs++; }
      }
      return list;
    });

    await updateStoreKeyWithLock('students', (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      for (const person of list) {
        if (!isItemForCurrentMadrasah(person, req)) continue;
        const currentPhoto = person?.photo || '';
        const currentId = getCloudinaryPhotoIdFromReference(currentPhoto);
        const history = Array.isArray(person?.photoHistory) ? person.photoHistory : [];
        const kept: any[] = [];
        let keptCurrent = False as any;
        for (const entry of history) {
          const value = historyPhotoValue(entry);
          const id = getCloudinaryPhotoIdFromReference(value);
          const isCurrent = (currentPhoto && value === currentPhoto) || (currentId && id === currentId);
          if (isCurrent && !keptCurrent) { kept.push(entry); keptCurrent = True as any; continue; }
          if (!id || resolvedIds.has(id)) { trimmedStudentHistory++; continue; }
          kept.push(entry); // failed Cloudinary deletion: retain reference for retry.
        }
        person.photoHistory = kept;
      }
      return list;
    });
  }

  await updateStoreKeyWithLock('teacherAttendance', (currentVal) => {
    const list = Array.isArray(currentVal) ? currentVal : [];
    const latest = buildLatestAttendancePhotoMap(list, 'teacher', req);
    for (const record of list) {
      if (!isExtraAttendancePhoto(record, 'teacher', latest, req)) continue;
      const id = getCloudinaryPhotoIdFromReference(record.photo);
      if (!id || resolvedIds.has(id)) { record.photo = ''; clearedTeacherRefs++; }
    }
    return list;
  });

  await updateStoreKeyWithLock('teachers', (currentVal) => {
    const list = Array.isArray(currentVal) ? currentVal : [];
    for (const person of list) {
      if (!isItemForCurrentMadrasah(person, req)) continue;
      const currentPhoto = person?.photo || '';
      const currentId = getCloudinaryPhotoIdFromReference(currentPhoto);
      const history = Array.isArray(person?.photoHistory) ? person.photoHistory : [];
      const kept: any[] = [];
      let keptCurrent = false;
      for (const entry of history) {
        const value = historyPhotoValue(entry);
        const id = getCloudinaryPhotoIdFromReference(value);
        const isCurrent = (currentPhoto && value === currentPhoto) || (currentId && id === currentId);
        if (isCurrent && !keptCurrent) { kept.push(entry); keptCurrent = true; continue; }
        if (!id || resolvedIds.has(id)) { trimmedTeacherHistory++; continue; }
        kept.push(entry);
      }
      person.photoHistory = kept;
    }
    return list;
  });

  await removePhotoMapAliases(removableIds);

  const tenantStudents = filterByMadrasah(students || [], req);
  const tenantTeachers = filterByMadrasah(teachers || [], req);
  const currentAttendance = filterByMadrasah((getMemoryKeyValue('attendance') || attendance || []), req);
  const currentTeacherAttendance = filterByMadrasah((getMemoryKeyValue('teacherAttendance') || teacherAttendance || []), req);
  const studentProfilePhotos = tenantStudents.filter((s: any) => Boolean(s?.photo)).length;
  const teacherProfilePhotos = tenantTeachers.filter((t: any) => Boolean(t?.photo)).length;
  const studentAttendancePhotos = currentAttendance.filter((a: any) => Boolean(a?.photo)).length;
  const teacherAttendancePhotos = currentTeacherAttendance.filter((a: any) => Boolean(a?.photo)).length;

  let remainingCount = studentProfilePhotos + teacherProfilePhotos + studentAttendancePhotos + teacherAttendancePhotos;
  try { remainingCount = (await listActualCloudinaryPhotos()).size; } catch (_) {}

  return {
    deletedCount,
    remainingCount,
    details: {
      studentProfilePhotos,
      teacherProfilePhotos,
      studentAttendancePhotos,
      teacherAttendancePhotos,
      candidateAssets: candidateIds.size,
      protectedSharedAssets: [...candidateIds].filter(id => protectedIds.has(id)).length,
      alreadyMissingCount,
      failedCount,
      clearedStudentRefs,
      clearedTeacherRefs,
      trimmedStudentHistory,
      trimmedTeacherHistory,
      policy: 'keep_active_profile_and_latest_attendance_per_person'
    }
  };
}

app.post("/api/admin/cleanup-photos", requireAuth, requireRole(['admin', 'bos', 'superadmin']), async (req: any, res) => {
  try {
    const result = await runCloudinaryAttendanceCleanup(req, false);
    return res.json({
      success: true,
      message: `Smart Cleanup selesai. ${result.deletedCount} aset Cloudinary ekstra dihapus; per ID hanya foto profil aktif dan foto absensi terbaru yang dipertahankan.`,
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
      message: `Pembersihan guru selesai. ${result.deletedCount} aset ekstra dihapus; tiap guru mempertahankan foto profil aktif dan foto absensi terbaru.`,
      ...result
    });
  } catch (err: any) {
    console.error('[Teacher Smart Cleanup] Failed:', err?.message || err);
    return res.status(500).json({ success: false, message: err?.message || 'Pembersihan foto guru gagal.' });
  }
});

function isAllowedManagedImageDataUrl(value: any): boolean {
  if (typeof value !== 'string' || value.length < 32 || value.length > 3000000) return false;
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value);
}

async function releaseManagedPhotoRefs(refs: any[]): Promise<{ deleted: number; protected: number; failed: number }> {
  const protectedIds = collectReferencedPhotoIds();
  const ids = new Set<string>();
  for (const ref of (Array.isArray(refs) ? refs : [])) {
    const id = getCloudinaryPhotoIdFromReference(ref);
    if (id) ids.add(id);
  }
  const removed = new Set<string>();
  let deleted = 0, protectedCount = 0, failed = 0;
  for (const id of ids) {
    if (protectedIds.has(id)) { protectedCount++; continue; }
    const outcome = await destroyCloudinaryPhotoId(id);
    if (outcome === 'deleted' || outcome === 'missing') { removed.add(id); if (outcome === 'deleted') deleted++; }
    else failed++;
  }
  await removePhotoMapAliases(removed);
  return { deleted, protected: protectedCount, failed };
}

app.post('/api/lkpd-assets/upload', requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req: any, res) => {
  try {
    const { dataUrl } = req.body || {};
    if (!isAllowedManagedImageDataUrl(dataUrl)) return res.status(400).json({ success: false, message: 'Gambar LKPD harus PNG/JPG/WebP dan maksimal sekitar 2 MB.' });
    const ref = await saveBase64ToFirestore(dataUrl);
    return res.json({ success: true, ref });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal mengunggah gambar LKPD.' });
  }
});

app.post('/api/lkpd-assets/release', requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req: any, res) => {
  try {
    const result = await releaseManagedPhotoRefs([req.body?.ref]);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal melepas aset LKPD.' });
  }
});

app.post('/api/theme-assets/upload', requireAuth, requireRole(['admin', 'bos', 'superadmin']), async (req: any, res) => {
  try {
    const { dataUrl } = req.body || {};
    if (!isAllowedManagedImageDataUrl(dataUrl)) return res.status(400).json({ success: false, message: 'Aset tema harus PNG/JPG/WebP dan maksimal sekitar 2 MB.' });
    const ref = await saveBase64ToFirestore(dataUrl);
    return res.json({ success: true, ref });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal mengunggah aset tema.' });
  }
});

app.post('/api/theme-assets/release', requireAuth, requireRole(['admin', 'bos', 'superadmin']), async (req: any, res) => {
  try {
    const refs = Array.isArray(req.body?.refs) ? req.body.refs.slice(0, 8) : [];
    const result = await releaseManagedPhotoRefs(refs);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal melepas aset tema.' });
  }
});

'''
# Python booleans accidentally embedded above: normalize to TS booleans.
new_block = new_block.replace('False as any', 'false').replace('True as any', 'true')
server = server[:match.start()] + new_block + server[match.end():]
server_path.write_text(server, encoding='utf-8')

# -----------------------------------------------------------------------------
# 2) LKPD lifecycle: upload custom images to managed Cloudinary + release on reset/delete
# -----------------------------------------------------------------------------
lkpd_path = Path('src/lkpdModule.js')
lkpd = lkpd_path.read_text(encoding='utf-8')

helper_anchor = """// ============================================================================
// SVG THEMES FOR LKPD WORKSHEETS
// ============================================================================
"""
helpers = r'''async function uploadManagedLkpdImage(dataUrl) {
    const res = await fetch('/api/lkpd-assets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
    });
    const data = await res.json();
    if (!res.ok || !data.success || !data.ref) throw new Error(data.message || 'Gagal mengunggah gambar LKPD.');
    return data.ref;
}

async function releaseManagedLkpdImage(ref) {
    if (!ref || typeof ref !== 'string' || ref.startsWith('data:image/')) return;
    try {
        await fetch('/api/lkpd-assets/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref })
        });
    } catch (err) {
        console.warn('Gagal melepas aset LKPD lama:', err);
    }
}

'''
lkpd = replace_once(lkpd, helper_anchor, helpers + helper_anchor, 'LKPD managed asset helpers')

old_select = """window.selectLkpdTheme = async function(lkpdId, themeKey) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    lkpd.theme = themeKey;
    lkpd.customImage = null;
    await saveLkpdState();
    openManageLkpdModal(lkpdId);
};
"""
new_select = """window.selectLkpdTheme = async function(lkpdId, themeKey) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    const oldImage = lkpd.customImage;
    lkpd.theme = themeKey;
    lkpd.customImage = null;
    await saveLkpdState();
    await releaseManagedLkpdImage(oldImage);
    openManageLkpdModal(lkpdId);
};
"""
lkpd = replace_once(lkpd, old_select, new_select, 'selectLkpdTheme release')

old_reset = """window.resetLkpdToTheme = async function(lkpdId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    lkpd.customImage = null;
    await saveLkpdState();
    openManageLkpdModal(lkpdId);
};
"""
new_reset = """window.resetLkpdToTheme = async function(lkpdId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    const oldImage = lkpd.customImage;
    lkpd.customImage = null;
    await saveLkpdState();
    await releaseManagedLkpdImage(oldImage);
    openManageLkpdModal(lkpdId);
};
"""
lkpd = replace_once(lkpd, old_reset, new_reset, 'resetLkpd release')

import_pattern = re.compile(r"window\.handleImportLkpdImage = function\(event, lkpdId\) \{.*?\n\};\n\n// Handle click on canvas", re.S)
import_match = import_pattern.search(lkpd)
require(import_match is not None, 'handleImportLkpdImage block not found')
import_new = r'''window.handleImportLkpdImage = function(event, lkpdId) {
    const file = event.target.files[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
        showToast("Gunakan gambar PNG, JPG, atau WebP. SVG tidak diizinkan untuk aset terkelola.", "error");
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast("Ukuran gambar maksimal 2 MB.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const base64 = e.target.result;
            const lkpds = initLkpdState();
            const lkpd = lkpds.find(l => l.id === lkpdId);
            if (!lkpd) return;
            const oldImage = lkpd.customImage;
            const managedRef = await uploadManagedLkpdImage(base64);
            lkpd.customImage = managedRef;
            await saveLkpdState();
            await releaseManagedLkpdImage(oldImage);
            showToast("Gambar LKPD berhasil disimpan ke penyimpanan terkelola.", "success");
            openManageLkpdModal(lkpdId);
        } catch (err) {
            console.error('Gagal mengunggah gambar LKPD:', err);
            showToast(err.message || 'Gagal mengunggah gambar LKPD.', 'error');
        }
    };
    reader.readAsDataURL(file);
};

// Handle click on canvas'''
lkpd = lkpd[:import_match.start()] + import_new + lkpd[import_match.end():]

delete_pattern = re.compile(r"window\.deleteLkpd = async function\(lkpdId\) \{.*?\n\};\n\n// ============================================================================\n// 3\. MANAGE LKPD", re.S)
delete_match = delete_pattern.search(lkpd)
require(delete_match is not None, 'deleteLkpd block not found')
delete_new = r'''window.deleteLkpd = async function(lkpdId) {
    const performDelete = async () => {
        const lkpds = initLkpdState();
        const idx = lkpds.findIndex(l => l.id === lkpdId);
        if (idx === -1) return;
        const oldImage = lkpds[idx]?.customImage;
        lkpds.splice(idx, 1);
        await saveLkpdState();
        // Release only after the LKPD list is durably updated. The server refuses
        // deletion if the same asset is still referenced elsewhere.
        await releaseManagedLkpdImage(oldImage);
        showToast("Kartu LKPD dan aset gambar yang tidak lagi dipakai telah dihapus.", "success");
        const container = document.getElementById('view-container');
        if (container && typeof window.renderAssessmentModule === 'function') {
            window.renderAssessmentModule(container, 'lkpd');
        }
    };

    if (typeof showConfirmModal === 'function') {
        showConfirmModal("Apakah Anda yakin ingin menghapus kartu LKPD ini beserta seluruh jawaban siswa dan gambar khususnya?", performDelete);
    } else {
        if (!confirm("Apakah Anda yakin ingin menghapus kartu LKPD ini beserta seluruh jawaban siswa dan gambar khususnya?")) return;
        await performDelete();
    }
};

// ============================================================================
// 3. MANAGE LKPD'''
lkpd = lkpd[:delete_match.start()] + delete_new + lkpd[delete_match.end():]
lkpd_path.write_text(lkpd, encoding='utf-8')

# -----------------------------------------------------------------------------
# 3) Smart Cleanup UI text + disable legacy destructive clear-all frontend path
# -----------------------------------------------------------------------------
settings_path = Path('src/settingsAndMisc.js')
settings = settings_path.read_text(encoding='utf-8')
settings = settings.replace(
    'Optimalkan kapasitas Cloudinary dengan menghapus foto absensi lama (>30 hari) secara aman, sambil mempertahankan minimal 1 foto terbaru setiap siswa & guru serta seluruh foto yang masih direferensikan.',
    'Rapikan Cloudinary per ID pengguna: pertahankan 1 foto profil aktif dan 1 foto absensi terbaru setiap siswa/guru, lalu hapus foto riwayat dan absensi ekstra yang sudah tidak dipakai.'
)
settings = settings.replace(
    'Sistem akan mencari foto absensi yang berusia <strong>lebih dari 30 hari</strong>. Foto-foto usang tersebut akan dihapus secara permanen dari Cloudinary untuk menghemat ruang, <strong>KECUALI</strong> jika foto tersebut adalah foto terbaru orang tersebut atau masih direferensikan oleh data penting lain. Dengan metode ini, <strong>seluruh siswa & guru dijamin akan tetap memiliki minimal 1 foto verifikasi terbaru di dalam sistem</strong>. Data teks kehadiran (tanggal, jam, keterangan) tidak akan dihapus!',
    'Sistem bekerja berdasarkan <strong>ID siswa/guru</strong>. Setiap orang mempertahankan <strong>1 foto profil aktif + 1 foto absensi terbaru</strong>. Foto profil riwayat dan foto absensi lainnya dilepas dari data lama dan aset Cloudinary dihapus bila tidak dipakai di tempat lain. <strong>Data teks absensi tetap dipertahankan.</strong>'
)
settings = settings.replace('Foto Usang Terhapus', 'Aset Foto Ekstra Terhapus')
settings = settings.replace('Usia &gt; 30 hari (bukan foto terakhir)', 'Selain profil aktif &amp; absensi terbaru')
settings = settings.replace(
    'Apakah Anda yakin ingin membersihkan foto absensi guru lama?\\n\\nSistem akan:\\n1. Memeriksa aset foto absensi guru di Cloudinary.\\n2. Menghapus hanya foto berusia >30 hari yang aman dan tetap menyisakan minimal 1 foto terbaru setiap guru.\\n3. Mempertahankan foto yang masih dipakai oleh profil, riwayat, atau data penting lain.\\n\\nAset yang benar-benar usang akan dihapus permanen. Lanjutkan?',
    'Apakah Anda yakin ingin merapikan foto guru?\\n\\nSistem akan:\\n1. Menyisakan 1 foto profil aktif setiap guru.\\n2. Menyisakan 1 foto absensi terbaru setiap guru.\\n3. Menghapus referensi foto riwayat/absensi ekstra dan aset Cloudinary yang tidak lagi dipakai.\\n\\nData teks absensi tidak dihapus. Lanjutkan?'
)

legacy_pattern = re.compile(r"async function clearAllAttendanceRecords\(\) \{.*?\n\}\nwindow\.clearAllAttendanceRecords = clearAllAttendanceRecords;", re.S)
legacy_match = legacy_pattern.search(settings)
require(legacy_match is not None, 'legacy clearAllAttendanceRecords not found')
legacy_new = r'''async function clearAllAttendanceRecords() {
    // Legacy UI entry now delegates to the safe Cloudinary Smart Cleanup.
    // It must never delete historical attendance text rows.
    if (typeof window.runSmartPhotoCleanup === 'function') {
        return window.runSmartPhotoCleanup();
    }
    showToast('Buka Pengaturan > Smart Cleanup untuk menjalankan pembersihan foto aman.', 'info');
}
window.clearAllAttendanceRecords = clearAllAttendanceRecords;'''
settings = settings[:legacy_match.start()] + legacy_new + settings[legacy_match.end():]
settings_path.write_text(settings, encoding='utf-8')

# -----------------------------------------------------------------------------
# 4) Declarative .mbtheme module (safe ZIP manifest, preview/apply/reset)
# -----------------------------------------------------------------------------
theme_module = r'''import JSZip from 'jszip';

const MBTHEME_FORMAT = 'madrasah-bisa-theme';
const MBTHEME_MAX_ZIP = 4 * 1024 * 1024;
const MBTHEME_MAX_ASSET = 2 * 1024 * 1024;
const MBTHEME_ALLOWED_IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp']);
let pendingThemePackage = null;

function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function validHex(value, fallback) {
    const s = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}
function enumValue(value, allowed, fallback) {
    const s = String(value || '').trim();
    return allowed.includes(s) ? s : fallback;
}
function safePath(value) {
    const s = String(value || '').replace(/\\/g, '/').trim();
    if (!s || s.startsWith('/') || s.includes('../') || s.includes('/..') || s.includes(':')) return '';
    return s;
}
function normalizeManifest(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('theme.json tidak valid.');
    if (raw.format !== MBTHEME_FORMAT || Number(raw.version) !== 1) throw new Error('Format tema tidak didukung. Gunakan format madrasah-bisa-theme versi 1.');
    const tokens = raw.tokens && typeof raw.tokens === 'object' ? raw.tokens : {};
    const assets = raw.assets && typeof raw.assets === 'object' ? raw.assets : {};
    return {
        format: MBTHEME_FORMAT,
        version: 1,
        name: String(raw.name || 'Tema Kustom').slice(0, 60),
        author: String(raw.author || '').slice(0, 60),
        description: String(raw.description || '').slice(0, 180),
        tokens: {
            primary: validHex(tokens.primary, '#0f766e'),
            accent: validHex(tokens.accent, '#2563eb'),
            background: validHex(tokens.background, '#f8fafc'),
            surface: validHex(tokens.surface, '#ffffff'),
            muted: validHex(tokens.muted, '#f1f5f9'),
            text: validHex(tokens.text, '#0f172a'),
            sidebar: validHex(tokens.sidebar, '#0f172a'),
            sidebarText: validHex(tokens.sidebarText, '#f8fafc'),
            radius: enumValue(tokens.radius, ['sharp','small','medium','large'], 'large'),
            style: enumValue(tokens.style, ['flat','soft','border'], 'soft'),
            font: enumValue(tokens.font, ['jakarta','system','serif','mono'], 'jakarta'),
            iconStyle: enumValue(tokens.iconStyle, ['solid','minimal'], 'solid')
        },
        assets: {
            logo: safePath(assets.logo),
            loginBackground: safePath(assets.loginBackground),
            sidebarBackground: safePath(assets.sidebarBackground)
        }
    };
}
function radiusPx(name) { return ({sharp:'2px',small:'6px',medium:'12px',large:'18px'})[name] || '18px'; }
function fontStack(name) {
    if (name === 'serif') return "Georgia, 'Times New Roman', serif";
    if (name === 'mono') return "ui-monospace, SFMono-Regular, Menlo, monospace";
    if (name === 'system') return "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    return "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
}
function resolveAssetUrl(value) {
    if (!value) return '';
    return String(value);
}
function ensureThemeStyle() {
    let style = document.getElementById('mbtheme-runtime-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'mbtheme-runtime-style';
        style.textContent = `
body.mbtheme-active{background:var(--mb-bg)!important;color:var(--mb-text);font-family:var(--mb-font)!important}
body.mbtheme-active #sidebar{background-color:var(--mb-sidebar)!important;color:var(--mb-sidebar-text)!important;background-image:var(--mb-sidebar-image,none)!important;background-size:cover!important;background-position:center!important}
body.mbtheme-active #sidebar a,body.mbtheme-active #sidebar button,body.mbtheme-active #sidebar span{color:inherit}
body.mbtheme-active header,body.mbtheme-active .bg-white{background-color:var(--mb-surface)!important}
body.mbtheme-active .bg-slate-50,body.mbtheme-active .bg-slate-100{background-color:var(--mb-muted)!important}
body.mbtheme-active .bg-emerald-600,body.mbtheme-active .bg-emerald-700,body.mbtheme-active .hover\\:bg-emerald-700:hover{background-color:var(--mb-primary)!important}
body.mbtheme-active .text-emerald-600,body.mbtheme-active .text-emerald-700,body.mbtheme-active .text-emerald-800{color:var(--mb-primary)!important}
body.mbtheme-active .border-emerald-200,body.mbtheme-active .border-emerald-500,body.mbtheme-active .border-emerald-600{border-color:var(--mb-primary)!important}
body.mbtheme-active button:not(.rounded-full),body.mbtheme-active input:not([type=checkbox]):not([type=radio]),body.mbtheme-active select,body.mbtheme-active textarea,body.mbtheme-active .rounded-xl,body.mbtheme-active .rounded-2xl,body.mbtheme-active .rounded-3xl{border-radius:var(--mb-radius)!important}
body.mbtheme-active[data-mb-style='border'] .bg-white{box-shadow:none!important;border-width:2px!important;border-color:color-mix(in srgb,var(--mb-text) 18%,transparent)!important}
body.mbtheme-active[data-mb-style='flat'] .bg-white{box-shadow:none!important}
body.mbtheme-active[data-mb-style='soft'] .bg-white{box-shadow:0 10px 30px rgba(15,23,42,.07)}
body.mbtheme-active[data-mb-icons='minimal'] .fa-solid{opacity:.78;filter:saturate(.65)}
body.mbtheme-active #login-container{background-color:var(--mb-bg)!important;background-image:var(--mb-login-image,none)!important;background-size:cover!important;background-position:center!important}
body.mbtheme-active #login-left-panel,body.mbtheme-active #login-right-panel{background-color:color-mix(in srgb,var(--mb-surface) 94%,transparent)!important}
body.mbtheme-active.mbtheme-has-logo #login-logo-box,body.mbtheme-active.mbtheme-has-logo #login-left-logo-box{background-image:var(--mb-logo-image)!important;background-size:cover!important;background-position:center!important}
body.mbtheme-active.mbtheme-has-logo #login-logo-box>*,body.mbtheme-active.mbtheme-has-logo #login-left-logo-box>*{opacity:0!important}
`;
        document.head.appendChild(style);
    }
}
function clearThemePackageVisual() {
    document.body.classList.remove('mbtheme-active','mbtheme-has-logo');
    document.body.removeAttribute('data-mb-style');
    document.body.removeAttribute('data-mb-icons');
    ['--mb-primary','--mb-accent','--mb-bg','--mb-surface','--mb-muted','--mb-text','--mb-sidebar','--mb-sidebar-text','--mb-radius','--mb-font','--mb-login-image','--mb-sidebar-image','--mb-logo-image'].forEach(k=>document.documentElement.style.removeProperty(k));
}
function applyThemePackage(pkg) {
    if (!pkg || !pkg.manifest) { clearThemePackageVisual(); return; }
    ensureThemeStyle();
    const m = normalizeManifest(pkg.manifest);
    const t = m.tokens;
    const a = pkg.assets || {};
    const root = document.documentElement.style;
    root.setProperty('--mb-primary', t.primary); root.setProperty('--mb-accent', t.accent);
    root.setProperty('--mb-bg', t.background); root.setProperty('--mb-surface', t.surface); root.setProperty('--mb-muted', t.muted);
    root.setProperty('--mb-text', t.text); root.setProperty('--mb-sidebar', t.sidebar); root.setProperty('--mb-sidebar-text', t.sidebarText);
    root.setProperty('--mb-radius', radiusPx(t.radius)); root.setProperty('--mb-font', fontStack(t.font));
    const loginBg = resolveAssetUrl(a.loginBackground); const sidebarBg = resolveAssetUrl(a.sidebarBackground); const logo = resolveAssetUrl(a.logo);
    root.setProperty('--mb-login-image', loginBg ? `url("${loginBg.replace(/"/g,'')}")` : 'none');
    root.setProperty('--mb-sidebar-image', sidebarBg ? `url("${sidebarBg.replace(/"/g,'')}")` : 'none');
    root.setProperty('--mb-logo-image', logo ? `url("${logo.replace(/"/g,'')}")` : 'none');
    document.body.classList.add('mbtheme-active');
    document.body.classList.toggle('mbtheme-has-logo', Boolean(logo));
    document.body.dataset.mbStyle = t.style; document.body.dataset.mbIcons = t.iconStyle;
}
window.applyThemePackage = applyThemePackage;
window.clearThemePackageVisual = clearThemePackageVisual;

async function persistThemeSettings() {
    const response = await fetch('/api/sync-state', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ key: 'settings', data: window.appState.settings })
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) throw new Error(data?.message || 'Gagal menyimpan pengaturan tema.');
}
async function uploadThemeAsset(dataUrl) {
    const res = await fetch('/api/theme-assets/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({dataUrl}) });
    const data = await res.json();
    if (!res.ok || !data.success || !data.ref) throw new Error(data.message || 'Gagal mengunggah aset tema.');
    return data.ref;
}
async function releaseThemeAssets(refs) {
    const filtered = (refs || []).filter(Boolean);
    if (!filtered.length) return;
    try { await fetch('/api/theme-assets/release', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refs:filtered})}); } catch (_) {}
}
function getPackageAssetRefs(pkg) { return pkg?.assets ? Object.values(pkg.assets).filter(Boolean) : []; }

async function parseThemeFile(file) {
    if (!file) throw new Error('Pilih file .mbtheme terlebih dahulu.');
    if (file.size > MBTHEME_MAX_ZIP) throw new Error('Paket tema maksimal 4 MB.');
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);
    if (entries.length > 30) throw new Error('Paket tema memiliki terlalu banyak file.');
    for (const entry of entries) {
        const path = safePath(entry.name);
        if (!path || path !== entry.name.replace(/\\/g,'/')) throw new Error('Paket mengandung path yang tidak aman.');
        if (entry.dir) continue;
        const ext = path.includes('.') ? path.split('.').pop().toLowerCase() : '';
        if (path !== 'theme.json' && !MBTHEME_ALLOWED_IMAGE_EXT.has(ext)) throw new Error(`File ${path} tidak diizinkan. Hanya theme.json dan PNG/JPG/WebP.`);
    }
    const manifestEntry = zip.file('theme.json');
    if (!manifestEntry) throw new Error('theme.json tidak ditemukan di root paket.');
    const manifestText = await manifestEntry.async('string');
    if (manifestText.length > 65536) throw new Error('theme.json terlalu besar.');
    const manifest = normalizeManifest(JSON.parse(manifestText));
    const previewAssets = {};
    for (const [key,path] of Object.entries(manifest.assets)) {
        if (!path) continue;
        const entry = zip.file(path);
        if (!entry) throw new Error(`Aset ${path} yang disebut theme.json tidak ditemukan.`);
        const ext = path.split('.').pop().toLowerCase();
        if (!MBTHEME_ALLOWED_IMAGE_EXT.has(ext)) throw new Error(`Format aset ${path} tidak diizinkan.`);
        const bytes = await entry.async('uint8array');
        if (bytes.byteLength > MBTHEME_MAX_ASSET) throw new Error(`Aset ${path} lebih dari 2 MB.`);
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const blob = new Blob([bytes], {type:mime});
        previewAssets[key] = await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=()=>reject(new Error('Gagal membaca aset tema.')); r.readAsDataURL(blob); });
    }
    return {manifest, previewAssets};
}

function themeStatus(html, cls='text-slate-600') {
    const el = document.getElementById('mbtheme-status'); if (el) el.innerHTML = `<div class="text-xs ${cls}">${html}</div>`;
}
async function handleThemePackageUpload(event) {
    try {
        pendingThemePackage = await parseThemeFile(event.target.files?.[0]);
        themeStatus(`<b>${esc(pendingThemePackage.manifest.name)}</b> siap dipratinjau.`, 'text-emerald-700');
        const applyBtn = document.getElementById('mbtheme-apply-btn'); if (applyBtn) applyBtn.disabled = false;
        const previewBtn = document.getElementById('mbtheme-preview-btn'); if (previewBtn) previewBtn.disabled = false;
    } catch (err) {
        pendingThemePackage = null; themeStatus(esc(err.message || err), 'text-rose-600');
    }
}
async function previewPendingTheme() {
    if (!pendingThemePackage) return;
    applyThemePackage({manifest:pendingThemePackage.manifest, assets:pendingThemePackage.previewAssets});
    themeStatus(`Pratinjau aktif: <b>${esc(pendingThemePackage.manifest.name)}</b>. Klik Terapkan untuk menyimpan.`, 'text-indigo-700');
}
async function applyPendingTheme() {
    if (!pendingThemePackage) return;
    const btn = document.getElementById('mbtheme-apply-btn'); if (btn) btn.disabled = true;
    const oldPkg = window.appState?.settings?.themePackage;
    const uploaded = {};
    try {
        for (const [key,dataUrl] of Object.entries(pendingThemePackage.previewAssets || {})) uploaded[key] = await uploadThemeAsset(dataUrl);
        if (!window.appState.settings) window.appState.settings = {};
        window.appState.settings.theme = 'package';
        window.appState.settings.themePackage = { manifest: pendingThemePackage.manifest, assets: uploaded, appliedAt: new Date().toISOString() };
        await persistThemeSettings();
        applyThemePackage(window.appState.settings.themePackage);
        await releaseThemeAssets(getPackageAssetRefs(oldPkg));
        themeStatus(`Tema <b>${esc(pendingThemePackage.manifest.name)}</b> berhasil diterapkan dan tersimpan.`, 'text-emerald-700');
        pendingThemePackage = null;
    } catch (err) {
        await releaseThemeAssets(Object.values(uploaded));
        themeStatus(esc(err.message || err), 'text-rose-600');
        if (oldPkg) applyThemePackage(oldPkg); else clearThemePackageVisual();
    } finally { if (btn) btn.disabled = false; }
}
async function resetThemePackage() {
    const oldPkg = window.appState?.settings?.themePackage;
    if (!window.appState?.settings) return;
    delete window.appState.settings.themePackage;
    window.appState.settings.theme = 'emerald';
    try {
        await persistThemeSettings();
        clearThemePackageVisual();
        if (window.applyTheme) window.applyTheme();
        await releaseThemeAssets(getPackageAssetRefs(oldPkg));
        themeStatus('Tema paket dinonaktifkan. Tema Emerald bawaan aktif.', 'text-emerald-700');
    } catch (err) { if (oldPkg) { window.appState.settings.themePackage = oldPkg; window.appState.settings.theme = 'package'; applyThemePackage(oldPkg); } themeStatus(esc(err.message || err), 'text-rose-600'); }
}
async function downloadThemeTemplate() {
    const zip = new JSZip();
    zip.file('theme.json', JSON.stringify({
        format:MBTHEME_FORMAT,version:1,name:'Akademik Modern',author:'Madrasah',description:'Contoh tema aman Madrasah Bisa',
        tokens:{primary:'#0f766e',accent:'#2563eb',background:'#f8fafc',surface:'#ffffff',muted:'#f1f5f9',text:'#0f172a',sidebar:'#0f172a',sidebarText:'#f8fafc',radius:'medium',style:'flat',font:'jakarta',iconStyle:'minimal'},
        assets:{logo:'',loginBackground:'',sidebarBackground:''}
    }, null, 2));
    const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='contoh-akademik-modern.mbtheme'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
window.handleThemePackageUpload = handleThemePackageUpload;
window.previewPendingTheme = previewPendingTheme;
window.applyPendingTheme = applyPendingTheme;
window.resetThemePackage = resetThemePackage;
window.downloadThemeTemplate = downloadThemeTemplate;

function mountThemePanel(container) {
    if (!container || document.getElementById('mbtheme-panel')) return;
    const root = container.querySelector('.space-y-6') || container;
    const current = window.appState?.settings?.themePackage;
    const panel = document.createElement('div'); panel.id='mbtheme-panel'; panel.className='bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4';
    panel.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 class="text-base font-bold text-slate-800"><i class="fa-solid fa-box-open text-indigo-600 mr-2"></i>Tema Paket (.mbtheme)</h2><p class="text-xs text-slate-500 mt-1">Impor tampilan deklaratif tanpa menjalankan JS/HTML/CSS dari paket. Aset gambar disimpan ke Cloudinary.</p></div>
        <span class="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">${current ? 'Aktif: '+esc(current.manifest?.name||'Tema Paket') : 'Belum aktif'}</span>
      </div>
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <input id="mbtheme-file" type="file" accept=".mbtheme,.zip,application/zip" onchange="handleThemePackageUpload(event)" class="block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-2 file:border-0 file:rounded-xl file:bg-indigo-600 file:text-white file:font-bold">
        <div class="flex flex-wrap gap-2">
          <button id="mbtheme-preview-btn" type="button" disabled onclick="previewPendingTheme()" class="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold disabled:opacity-40"><i class="fa-solid fa-eye mr-1"></i>Pratinjau</button>
          <button id="mbtheme-apply-btn" type="button" disabled onclick="applyPendingTheme()" class="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40"><i class="fa-solid fa-check mr-1"></i>Terapkan</button>
          <button type="button" onclick="resetThemePackage()" class="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold"><i class="fa-solid fa-rotate-left mr-1"></i>Kembali ke Bawaan</button>
          <button type="button" onclick="downloadThemeTemplate()" class="px-3 py-2 rounded-xl bg-white text-slate-700 border border-slate-200 text-xs font-bold"><i class="fa-solid fa-download mr-1"></i>Unduh Contoh .mbtheme</button>
        </div>
        <div id="mbtheme-status" class="min-h-5 text-xs text-slate-500">Format v1 mendukung warna, radius, gaya, font, ikon minimal/solid, serta logo/login/sidebar background PNG/JPG/WebP.</div>
      </div>`;
    root.appendChild(panel);
}

const originalRenderSetting = window.renderSettingModule;
if (typeof originalRenderSetting === 'function') {
    window.renderSettingModule = function(container) { const out = originalRenderSetting.apply(this, arguments); setTimeout(()=>mountThemePanel(container),0); return out; };
}
const originalSelectTheme = window.selectSystemTheme;
if (typeof originalSelectTheme === 'function') {
    window.selectSystemTheme = function(name) { if (name !== 'package') clearThemePackageVisual(); return originalSelectTheme.apply(this, arguments); };
}
setTimeout(()=>{ if (window.appState?.settings?.theme === 'package' && window.appState.settings.themePackage) applyThemePackage(window.appState.settings.themePackage); },1200);
'''
Path('src/themePackageModule.js').write_text(theme_module, encoding='utf-8')

# Import the new module immediately after settings module.
main_path = Path('src/main.tsx')
main = main_path.read_text(encoding='utf-8')
main = replace_once(main, "import './settingsAndMisc.js';\n", "import './settingsAndMisc.js';\nimport './themePackageModule.js';\n", 'main theme module import')
main_path.write_text(main, encoding='utf-8')

# Ensure persisted package is applied immediately after settings arrive from server.
settings = settings_path.read_text(encoding='utf-8')
old_settings_load = """            if (res.settings) {
                appState.settings = res.settings;
                if (window.applyLoginCustomization) window.applyLoginCustomization();
            }
"""
new_settings_load = """            if (res.settings) {
                appState.settings = res.settings;
                if (window.applyLoginCustomization) window.applyLoginCustomization();
                if (window.applyThemePackage && appState.settings.theme === 'package' && appState.settings.themePackage) {
                    window.applyThemePackage(appState.settings.themePackage);
                }
            }
"""
settings = replace_once(settings, old_settings_load, new_settings_load, 'apply persisted theme package')
settings_path.write_text(settings, encoding='utf-8')

# prepare-build copies src JS to public during validation/build. Also copy now for parity.
for name in ['appScript.js','lkpdModule.js','settingsAndMisc.js','themePackageModule.js']:
    src = Path('src') / name
    if src.exists():
        (Path('public') / name).write_text(src.read_text(encoding='utf-8'), encoding='utf-8')

print('Batch patch applied.')
