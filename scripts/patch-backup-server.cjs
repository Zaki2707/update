const fs = require('fs');

const file = 'server.ts';
let text = fs.readFileSync(file, 'utf8');
if (text.includes('/api/system/backup-credentials')) {
  console.log('server backup patch already applied');
  process.exit(0);
}

const marker = '// System Backup & Restore API';
const idx = text.indexOf(marker);
if (idx < 0) throw new Error('System Backup marker not found');

const block = `// Tenant-scoped account credential export for disaster-recovery backups.
// Only stored one-way hashes are returned; plaintext passwords are never exposed here.
app.get("/api/system/backup-credentials", requireAuth, requireRole(['admin', 'administrator', 'bos', 'superadmin']), (req: any, res) => {
  const authUser = req.user || getAuthUser(req);
  const targetTenant = String(getRequestMadrasahId(req) || authUser?.madrasahId || authUser?.madrasahSlug || '').trim();
  if (!targetTenant || targetTenant === 'BOSS') {
    return res.status(400).json({ success: false, message: "Tenant backup tidak valid." });
  }

  const scopedStudents = filterByMadrasah(students, req) || [];
  const scopedTeachers = filterByMadrasah(teachers, req) || [];

  const toRecord = (item: any) => {
    const stored = String(item?.password || '').trim();
    if (!stored) return null;
    const authHash = stored.startsWith('scrypt$') || stored.startsWith('sha256$') ? stored : hashPassword(stored);
    return { id: String(item?.id || ''), username: String(item?.username || ''), authHash };
  };

  const studentRecords = scopedStudents.map(toRecord).filter(Boolean);
  const teacherRecords = scopedTeachers.map(toRecord).filter(Boolean);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json({
    success: true,
    version: 'credential-backup-v1',
    madrasahId: targetTenant,
    students: studentRecords,
    teachers: teacherRecords,
    missingStudents: Math.max(0, scopedStudents.length - studentRecords.length),
    missingTeachers: Math.max(0, scopedTeachers.length - teacherRecords.length)
  });
});

// Efficient tenant-safe bulk reset for controlled account recovery.
app.post("/api/admin/reset-student-passwords-bulk", requireAuth, requireRole(['admin', 'administrator', 'bos', 'superadmin']), async (req: any, res) => {
  const ids = Array.isArray(req.body?.ids) ? Array.from(new Set(req.body.ids.map((id: any) => String(id).trim()).filter(Boolean))) : [];
  const newPassword = String(req.body?.password || '').trim();
  if (ids.length === 0) return res.status(400).json({ success: false, message: "Daftar ID siswa kosong." });
  if (ids.length > 1000) return res.status(400).json({ success: false, message: "Maksimal 1000 akun per proses." });
  if (newPassword.length < 8) return res.status(400).json({ success: false, message: "Password baru minimal 8 karakter." });

  const allowedIds = new Set((filterByMadrasah(students, req) || []).map((s: any) => String(s.id)));
  const wanted = new Set(ids);
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < students.length; i++) {
    const id = String(students[i]?.id || '');
    if (!wanted.has(id)) continue;
    if (!allowedIds.has(id)) { skipped++; continue; }
    students[i] = { ...students[i], password: hashPassword(newPassword) };
    updated++;
  }
  if (updated > 0) await saveData('students', students);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json({ success: true, updated, skipped, requested: ids.length });
});

`;

text = text.slice(0, idx) + block + text.slice(idx);
fs.writeFileSync(file, text, 'utf8');
console.log('server backup/recovery endpoints patched');
