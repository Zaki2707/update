from pathlib import Path

p = Path('server.ts')
s = p.read_text(encoding='utf-8')

marker = "\nfunction mergeLkpdListDataSmart(globalList: any[], incomingData: any[], req: any): any[] {"
if marker not in s:
    raise SystemExit('mergeLkpdListDataSmart marker not found')
if '/api/system/recover-master-missing' in s:
    raise SystemExit('recovery endpoint already exists')

endpoint = r'''

// Emergency/maintenance recovery: add only master records that are truly missing.
// Existing records are NEVER replaced here. Normal deletions stay on explicit DELETE routes.
app.post('/api/system/recover-master-missing', requireAuth, requireRole(['admin', 'bos', 'superadmin']), async (req: any, res) => {
  if (!isOnlineMode) {
    return res.status(400).json({ success: false, message: 'Recovery missing-only ini khusus mode online.' });
  }

  const body = req.body || {};
  const dryRun = body.dryRun === true;
  const maxPerKind = 5000;
  const allowedKinds = ['classes', 'subjects', 'teachers', 'students'] as const;

  const currentByKind: Record<string, any[]> = {
    classes: Array.isArray(classes) ? classes : [],
    subjects: Array.isArray(subjects) ? subjects : [],
    teachers: Array.isArray(teachers) ? teachers : [],
    students: Array.isArray(students) ? students : []
  };

  const sameLogicalRecord = (kind: string, a: any, b: any) => {
    if (!a || !b) return false;
    if (a.id !== undefined && a.id !== null && b.id !== undefined && b.id !== null && String(a.id) === String(b.id)) return true;
    const n = (v: any) => String(v ?? '').trim().toLowerCase();
    if (kind === 'students') {
      if (n(a.username) && n(a.username) === n(b.username)) return true;
      if (n(a.nis) && n(a.nis) === n(b.nis)) return true;
    } else if (kind === 'teachers') {
      if (n(a.username) && n(a.username) === n(b.username)) return true;
      if (n(a.nip) && n(a.nip) === n(b.nip)) return true;
    } else if (kind === 'classes' || kind === 'subjects') {
      if (n(a.code) && n(a.code) === n(b.code)) return true;
      if (n(a.name) && n(a.name) === n(b.name)) return true;
    }
    return false;
  };

  const sanitizeRecoveredRecord = (kind: string, raw: any) => {
    if (!raw || typeof raw !== 'object' || raw.id === undefined || raw.id === null) return null;
    let item: any = { ...raw };
    delete item.madrasahId;
    delete item.madrasahSlug;
    delete item.passwordRaw;
    delete item.photoHistory;
    delete item.photo_history;
    if (typeof item.photo === 'string' && item.photo.startsWith('data:image/')) item.photo = '';
    if ((kind === 'students' || kind === 'teachers') && item.password) {
      const pw = String(item.password);
      if (!pw.startsWith('scrypt$') && !pw.startsWith('sha256$')) item.password = hashPassword(pw);
    }
    item = tagNewRecord(item, req);
    return item;
  };

  const plan: Record<string, any[]> = {};
  for (const kind of allowedKinds) {
    const incoming = Array.isArray(body[kind]) ? body[kind] : [];
    if (incoming.length > maxPerKind) {
      return res.status(413).json({ success: false, message: `Terlalu banyak record ${kind}; maksimum ${maxPerKind} per request.` });
    }
    const existing = currentByKind[kind].filter(item => isItemForCurrentMadrasah(item, req));
    const missing: any[] = [];
    for (const raw of incoming) {
      const item = sanitizeRecoveredRecord(kind, raw);
      if (!item) continue;
      if (existing.some(cur => sameLogicalRecord(kind, item, cur))) continue;
      if (missing.some(cur => sameLogicalRecord(kind, item, cur))) continue;
      missing.push(item);
    }
    plan[kind] = missing;
  }

  const wouldAdd = Object.fromEntries(allowedKinds.map(kind => [kind, plan[kind].length]));
  if (dryRun) {
    return res.json({
      success: true,
      capability: 'master-recovery-missing-only-v1',
      dryRun: true,
      wouldAdd
    });
  }

  const beforeCounts = {
    classes: classes.length,
    subjects: subjects.length,
    teachers: teachers.length,
    students: students.length
  };

  try {
    if (plan.classes.length) {
      classes = [...classes, ...plan.classes];
      await saveData('classes', classes);
    }
    if (plan.subjects.length) {
      subjects = [...subjects, ...plan.subjects];
      await saveData('subjects', subjects);
    }
    if (plan.teachers.length) {
      teachers = [...teachers, ...plan.teachers];
      await saveData('teachers', teachers);
    }
    if (plan.students.length) {
      students = [...students, ...plan.students];
      await saveData('students', students);
    }

    const afterCounts = {
      classes: classes.length,
      subjects: subjects.length,
      teachers: teachers.length,
      students: students.length
    };
    const reduced = allowedKinds.some(kind => afterCounts[kind] < beforeCounts[kind]);
    if (reduced) {
      throw new Error('RECOVERY_SAFETY_CHECK_FAILED: master-data count unexpectedly decreased.');
    }

    return res.json({
      success: true,
      capability: 'master-recovery-missing-only-v1',
      dryRun: false,
      added: wouldAdd,
      beforeCounts,
      afterCounts
    });
  } catch (err: any) {
    console.error('[Master Recovery] Failed:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Recovery master data gagal disimpan dengan aman.' });
  }
});
'''

s = s.replace(marker, endpoint + marker, 1)
p.write_text(s, encoding='utf-8')
print('Applied missing-only recovery endpoint')
