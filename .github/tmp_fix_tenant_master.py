from pathlib import Path

p = Path('server.ts')
s = p.read_text()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit(f'Expected {count} occurrence(s), found {n}: {old[:120]!r}')
    s = s.replace(old, new, count)

anchor = """  return [...otherItems, ...taggedIncoming];\n}\n\nfunction mergeLkpdListDataSmart(globalList: any[], incomingData: any[], req: any): any[] {"""
helper = """  return [...otherItems, ...taggedIncoming];
}

function mergeTenantEntityListData(globalList: any[], incomingData: any[], req: any, kind: 'teacher' | 'student' | 'class' | 'subject'): any[] {
  if (!Array.isArray(incomingData)) return Array.isArray(globalList) ? globalList : [];
  if (!Array.isArray(globalList)) globalList = [];

  const currentExisting = globalList.filter(item => isItemForCurrentMadrasah(item, req));
  const currentMap = new Map(currentExisting.filter(Boolean).map((item: any) => [String(item.id), item]));
  const otherItems = globalList.filter(item => !isItemForCurrentMadrasah(item, req));
  const mergedIncoming: any[] = [];

  for (const rawItem of incomingData) {
    if (!rawItem || rawItem.id === undefined || rawItem.id === null) continue;
    const existing: any = currentMap.get(String(rawItem.id));
    let merged: any = existing ? { ...existing, ...rawItem } : { ...rawItem };

    if ((kind === 'teacher' || kind === 'student') && existing?.password && !rawItem.password) {
      merged.password = existing.password;
    }
    if (kind === 'student' && existing) {
      if (existing.name && existing.name !== existing.nis && (rawItem.name === rawItem.nis || !rawItem.name)) merged.name = existing.name;
      if (existing.no_hp && !rawItem.no_hp) merged.no_hp = existing.no_hp;
      if (existing.photo && !rawItem.photo) merged.photo = existing.photo;
      if (existing.password && String(existing.password) !== String(existing.nis) && (String(rawItem.password || '') === String(rawItem.nis || '') || !rawItem.password)) merged.password = existing.password;
    }

    delete merged.madrasahId;
    delete merged.madrasahSlug;
    merged = tagNewRecord(merged, req);
    mergedIncoming.push(merged);
  }

  return [...otherItems, ...mergedIncoming];
}

function mergeLkpdListDataSmart(globalList: any[], incomingData: any[], req: any): any[] {"""
rep(anchor, helper)

rep('app.post("/api/sync-state", async (req, res) => {', 'app.post("/api/sync-state", requireAuth, async (req, res) => {')
rep(
    """    let { key, data } = req.body;\n    if (!key) return res.status(400).json({ success: false, message: \"Key required\" });\n""",
    """    let { key, data } = req.body;
    if (!key) return res.status(400).json({ success: false, message: \"Key required\" });

    const authUser = req.user || getAuthUser(req);
    const role = String(authUser?.role || '').toLowerCase();
    const tenantMasterKeys = new Set(['teachers', 'students', 'classes', 'subjects']);
    if (tenantMasterKeys.has(String(key)) && !staffRoles.has(role)) {
      return res.status(403).json({ success: false, message: 'Aksi master data hanya dapat dilakukan guru atau administrator.' });
    }
    if (tenantMasterKeys.has(String(key)) && !Array.isArray(data)) {
      return res.status(400).json({ success: false, message: 'Payload master data harus berupa array.' });
    }
"""
)

old_master = """    if (key === 'teachers') {
      if (Array.isArray(data)) {
        const tMap = new Map(teachers.map((t: any) => [String(t.id), t]));
        const newTeachers = [];
        for (const item of data as any[]) { if (item && item.id != null) { const ext: any = tMap.get(String(item.id)); newTeachers.push(ext ? { ...ext, ...item } : item); } }
        teachers = newTeachers;
      } else {
        teachers = data;
      }
      await saveData('teachers', teachers);
    }
    else if (key === 'students') {
      if (Array.isArray(data)) {
        const sMap = new Map(students.map((s: any) => [String(s.id), s]));
        const newStudents = [];
        for (const item of data as any[]) {
          if (item && item.id != null) {
            const idStr = String(item.id);
            const ext: any = sMap.get(idStr);
            if (!ext) {
              newStudents.push(item);
            } else {
              const merged: any = { ...ext, ...item };
              if (ext.name && ext.name !== ext.nis && (item.name === item.nis || !item.name)) merged.name = ext.name;
              if (ext.no_hp && !item.no_hp) merged.no_hp = ext.no_hp;
              if (ext.photo && !item.photo) merged.photo = ext.photo;
              if (ext.password && String(ext.password) !== String(ext.nis) && (String(item.password) === String(item.nis) || !item.password)) merged.password = ext.password;
              newStudents.push(merged);
            }
          }
        }
        students = newStudents;
      } else {
        students = data;
      }
      await saveData('students', students);
    }
    else if (key === 'classes') {
      if (Array.isArray(data)) {
        const cMap = new Map(classes.map((c: any) => [String(c.id), c]));
        const newClasses = [];
        for (const item of data as any[]) { if (item && item.id != null) { const ext: any = cMap.get(String(item.id)); newClasses.push(ext ? { ...ext, ...item } : item); } }
        classes = newClasses;
      } else {
        classes = data;
      }
      await saveData('classes', classes);
    }
    else if (key === 'subjects') { subjects = data; await saveData('subjects', subjects); }
"""
new_master = """    if (key === 'teachers') {
      teachers = mergeTenantEntityListData(teachers, data, req, 'teacher');
      await saveData('teachers', teachers);
    }
    else if (key === 'students') {
      students = mergeTenantEntityListData(students, data, req, 'student');
      await saveData('students', students);
    }
    else if (key === 'classes') {
      classes = mergeTenantEntityListData(classes, data, req, 'class');
      await saveData('classes', classes);
    }
    else if (key === 'subjects') {
      subjects = mergeTenantEntityListData(subjects, data, req, 'subject');
      await saveData('subjects', subjects);
    }
"""
rep(old_master, new_master)

rep(
    """  const t = teachers[idx];\n  \n  let updatedPassword = t.password;""",
    """  const t = teachers[idx];
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === 'bos' || authUser?.role === 'superadmin';
  if (!isBos && !isItemForCurrentMadrasah(t, req)) {
    return res.status(403).json({ success: false, message: \"Akses ditolak: guru bukan milik madrasah Anda.\" });
  }
  
  let updatedPassword = t.password;"""
)
rep(
    """  const teacherToDelete = (teachers || []).find(t => String(t.id) === String(id));\n  const photoUrlsToDelete = new Set<string>();""",
    """  const teacherToDelete = (teachers || []).find(t => String(t.id) === String(id));
  if (!teacherToDelete) {
    return res.status(404).json({ success: false, message: \"Guru tidak ditemukan.\" });
  }
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === 'bos' || authUser?.role === 'superadmin';
  if (!isBos && !isItemForCurrentMadrasah(teacherToDelete, req)) {
    return res.status(403).json({ success: false, message: \"Akses ditolak: guru bukan milik madrasah Anda.\" });
  }
  const photoUrlsToDelete = new Set<string>();"""
)
rep(
    """      if (record && String(record.teacherId) === String(id) && record.photo) {""",
    """      if (record && String(record.teacherId) === String(id) && (isBos || isItemForCurrentMadrasah(record, req)) && record.photo) {"""
)

rep(
    """    const duplicate = students.find(s => String(s.nis || '').trim() === trimmedNis && String(s.id) !== String(id));""",
    """    const duplicate = filterByMadrasah(students, req).find(s => String(s.nis || '').trim() === trimmedNis && String(s.id) !== String(id));"""
)
rep(
    """    const idx = students.findIndex(s => \n      String(s.nis || '').trim() === itemNis || \n      String(s.username || '').trim() === itemNis\n    );""",
    """    const authUser = getAuthUser(req);
    const isBos = authUser?.role === 'bos' || authUser?.role === 'superadmin';
    const idx = students.findIndex(s => 
      (String(s.nis || '').trim() === itemNis || String(s.username || '').trim() === itemNis) &&
      (isBos || isItemForCurrentMadrasah(s, req))
    );"""
)
rep(
    """  const st = students[idx];\n  const prevPhoto = st.photo || '';""",
    """  const st = students[idx];
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === 'bos' || authUser?.role === 'superadmin';
  if (!isBos && !isItemForCurrentMadrasah(st, req)) {
    return res.status(403).json({ success: false, message: \"Akses ditolak.\" });
  }
  const prevPhoto = st.photo || '';"""
)
rep(
    """  const st = students[idx];\n  let history: any[] = Array.isArray(st.photoHistory) ? [...st.photoHistory] : [];""",
    """  const st = students[idx];
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === 'bos' || authUser?.role === 'superadmin';
  if (!isBos && !isItemForCurrentMadrasah(st, req)) {
    return res.status(403).json({ success: false, message: \"Akses ditolak.\" });
  }
  let history: any[] = Array.isArray(st.photoHistory) ? [...st.photoHistory] : [];"""
)

rep(
    """    if (idx >= 0) {\n      classes[idx] = { """,
    """    if (idx >= 0) {
      const authUser = getAuthUser(req);
      const isBos = authUser?.role === 'bos' || authUser?.role === 'superadmin';
      if (!isBos && !isItemForCurrentMadrasah(classes[idx], req)) {
        return res.status(403).json({ success: false, message: \"Akses ditolak: kelas bukan milik madrasah Anda.\" });
      }
      classes[idx] = { """
)
rep(
    """      teachers.forEach(t => {\n        if (String(t.id) === String(homeroomTeacherId)) {""",
    """      teachers.forEach(t => {
        if (!isItemForCurrentMadrasah(t, req)) return;
        if (String(t.id) === String(homeroomTeacherId)) {"""
)
rep(
    """    teachers.forEach(t => {\n      if (String(t.id) === String(homeroomTeacherId)) {""",
    """    teachers.forEach(t => {
      if (!isItemForCurrentMadrasah(t, req)) return;
      if (String(t.id) === String(homeroomTeacherId)) {"""
)
rep(
    """app.delete(\"/api/classes/:id\", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {\n  const { id } = req.params;\n  classes = classes.filter(c => String(c.id) !== String(id));""",
    """app.delete(\"/api/classes/:id\", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const targetClass = classes.find(c => String(c.id) === String(id));
  if (!targetClass) return res.status(404).json({ success: false, message: \"Kelas tidak ditemukan.\" });
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === 'bos' || authUser?.role === 'superadmin';
  if (!isBos && !isItemForCurrentMadrasah(targetClass, req)) {
    return res.status(403).json({ success: false, message: \"Akses ditolak: kelas bukan milik madrasah Anda.\" });
  }
  classes = classes.filter(c => String(c.id) !== String(id));"""
)
rep(
    """app.delete(\"/api/subjects/:id\", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {\n  const { id } = req.params;\n  subjects = subjects.filter(s => String(s.id) !== String(id));""",
    """app.delete(\"/api/subjects/:id\", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const targetSubject = subjects.find(s => String(s.id) === String(id));
  if (!targetSubject) return res.status(404).json({ success: false, message: \"Mata pelajaran tidak ditemukan.\" });
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === 'bos' || authUser?.role === 'superadmin';
  if (!isBos && !isItemForCurrentMadrasah(targetSubject, req)) {
    return res.status(403).json({ success: false, message: \"Akses ditolak: mata pelajaran bukan milik madrasah Anda.\" });
  }
  subjects = subjects.filter(s => String(s.id) !== String(id));"""
)

p.write_text(s)
print('tenant master-data patch applied')
