const fs = require('fs');

const file = 'src/settingsAndMisc.js';
let text = fs.readFileSync(file, 'utf8');

if (!text.includes("version: '2.2'")) {
  if (!text.includes("version: '2.1'")) throw new Error('backup version 2.1 marker not found');
  text = text.replace("version: '2.1'", "version: '2.2'");
}

if (!text.includes('merge tenant-scoped credential hashes')) {
  const marker = '        // Browser cache is not part of an online/Cloud Run backup.';
  const idx = text.indexOf(marker);
  if (idx < 0) throw new Error('browser backup marker not found');

  const block = `        // Disaster-recovery backup: merge tenant-scoped credential hashes from the server.
        // appState intentionally excludes password fields.
        if (incStudents) {
            if (btn) btn.innerHTML = \`<i class="fa-solid fa-spinner fa-spin"></i> <span>Mengamankan credential akun...</span>\`;
            const credentialResponse = await fetch('/api/system/backup-credentials', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });
            let credentialData = null;
            try { credentialData = await credentialResponse.json(); } catch (_) {}
            if (!credentialResponse.ok || !credentialData || credentialData.success === false) {
                const detail = credentialData && credentialData.message ? credentialData.message : \`HTTP \${credentialResponse.status}\`;
                throw new Error('Gagal mengambil credential backup: ' + detail);
            }

            const mergeAuth = (list, credentials) => {
                const byId = new Map((credentials || []).map(c => [String(c.id || ''), c]));
                const byUsername = new Map((credentials || []).filter(c => c.username).map(c => [String(c.username).toLowerCase(), c]));
                return (list || []).map(item => {
                    const record = byId.get(String(item.id || '')) || byUsername.get(String(item.username || '').toLowerCase());
                    return record && record.authHash ? { ...item, password: record.authHash } : item;
                });
            };

            backupData.students = mergeAuth(backupData.students, credentialData.students);
            backupData.teachers = mergeAuth(backupData.teachers, credentialData.teachers);
            backupData.credentialBackup = {
                version: credentialData.version || 'credential-backup-v1',
                hashOnly: true,
                studentCount: Array.isArray(credentialData.students) ? credentialData.students.length : 0,
                teacherCount: Array.isArray(credentialData.teachers) ? credentialData.teachers.length : 0,
                missingStudents: Number(credentialData.missingStudents || 0),
                missingTeachers: Number(credentialData.missingTeachers || 0)
            };
        }

`;
  text = text.slice(0, idx) + block + text.slice(idx);
}

if (!text.includes('const missingStudentCredentialCount =')) {
  const marker = '        let examCount = restored.exams ? restored.exams.length : 0;';
  const idx = text.indexOf(marker);
  if (idx < 0) throw new Error('restore count marker not found');
  const insert = `\n        const missingStudentCredentialCount = restored.students ? restored.students.filter(item => !item || !item.password).length : 0;\n        const missingTeacherCredentialCount = restored.teachers ? restored.teachers.filter(item => !item || !item.password).length : 0;\n        const missingCredentialCount = missingStudentCredentialCount + missingTeacherCredentialCount;`;
  text = text.slice(0, idx + marker.length) + insert + text.slice(idx + marker.length);
}

if (!text.includes('Backup ini tidak memiliki credential untuk')) {
  const marker = '                <p class="text-xs text-rose-600 font-semibold">Tindakan ini akan memulihkan data ke server dan memperbarui aplikasi.</p>';
  if (!text.includes(marker)) throw new Error('restore warning marker not found');
  const replacement = `                \${incStudents && missingCredentialCount > 0 ? \`<p class="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-xl p-2.5">⚠ Backup ini tidak memiliki credential untuk <strong>\${missingCredentialCount}</strong> akun. Data tetap dapat dipulihkan, tetapi akun baru tersebut perlu di-reset password oleh admin.</p>\` : ''}\n${marker}`;
  text = text.replace(marker, replacement);
}

fs.writeFileSync(file, text, 'utf8');
console.log('frontend backup/restore patched');
