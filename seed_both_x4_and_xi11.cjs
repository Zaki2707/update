const fs = require('fs');
const crypto = require('crypto');

const ENCRYPTION_KEY = crypto.createHash('sha256').update("***REMOVED***").digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return text;
  const parts = trimmed.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function run() {
  const raw = fs.readFileSync('local_store.json', 'utf8');
  const store = JSON.parse(decrypt(raw));

  const x4Students = (store.students || []).filter(s => s.classId === 'C1');
  const xi11Students = (store.students || []).filter(s => s.classId === 'C3');

  console.log(`X.4 students: ${x4Students.length}, XI.1.1 students: ${xi11Students.length}`);

  const dates = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31'];
  const attMap = new Map();

  // Preserved existing attendance
  (store.attendance || []).forEach(a => {
    if (a && (a.id || a.studentId)) {
      const k = String(a.id || `${a.studentId}_${a.date}`);
      attMap.set(k, a);
    }
  });

  // Generate X.4 attendance
  dates.forEach(d => {
    x4Students.forEach((st, idx) => {
      const id = `ATT_X4_${st.id}_${d.replace(/-/g, '')}`;
      let status = 'HADIR';
      if (idx % 10 === 3) status = 'IZIN';
      if (idx % 10 === 7) status = 'SAKIT';
      attMap.set(id, {
        id,
        date: d,
        studentId: st.id,
        studentName: st.name,
        classId: 'C1',
        className: 'X.4',
        nis: st.nis,
        status: status,
        time: '07:15:00',
        location: '-6.2000, 106.8166',
        method: 'ADMIN_INPUT'
      });
    });
  });

  // Generate XI.1.1 attendance
  dates.forEach(d => {
    xi11Students.forEach((st, idx) => {
      const id = `ATT_XI11_${st.id}_${d.replace(/-/g, '')}`;
      let status = 'HADIR';
      if (idx % 11 === 3) status = 'IZIN';
      if (idx % 11 === 7) status = 'SAKIT';
      if (idx % 11 === 10) status = 'ALPA';
      attMap.set(id, {
        id,
        date: d,
        studentId: st.id,
        studentName: st.name,
        classId: 'C3',
        className: 'XI.1.1',
        nis: st.nis,
        status: status,
        time: '07:12:00',
        location: '-6.2000, 106.8166',
        method: 'ADMIN_INPUT'
      });
    });
  });

  const fullAttendance = Array.from(attMap.values());
  store.attendance = fullAttendance;

  // Exam Grades for Exam EX1786457950062 ("aa")
  const examId = 'EX1786457950062';
  const completedExams = store.completedExams || {};
  const studentExamGrades = store.studentExamGrades || {};
  const studentExamAnswers = store.studentExamAnswers || {};

  // X.4 grades
  x4Students.forEach((st, idx) => {
    const key = `${st.id}_${examId}`;
    const scoreVal = 80 + (idx % 5) * 4;
    completedExams[key] = { completedAt: '2026-08-28T09:30:00.000Z', score: scoreVal, classId: 'C1', examId: examId, studentId: st.id };
    studentExamGrades[key] = { examId: examId, studentId: st.id, studentName: st.name, classId: 'C1', className: 'X.4', nis: st.nis, mcCorrect: 8 + (idx % 3), mcTotal: 10, mcScore: scoreVal, essayScore: 0, finalScore: scoreVal, gradedAt: '2026-08-28T09:30:00.000Z', status: 'SUDAH_DIKOREKSI' };
    studentExamAnswers[key] = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A', 6: 'B', 7: 'C', 8: 'D', 9: 'A', 10: 'B' };
  });

  // XI.1.1 grades
  xi11Students.forEach((st, idx) => {
    const key = `${st.id}_${examId}`;
    const scoreVal = 82 + (idx % 5) * 4;
    completedExams[key] = { completedAt: '2026-08-28T09:45:00.000Z', score: scoreVal, classId: 'C3', examId: examId, studentId: st.id };
    studentExamGrades[key] = { examId: examId, studentId: st.id, studentName: st.name, classId: 'C3', className: 'XI.1.1', nis: st.nis, mcCorrect: 8 + (idx % 3), mcTotal: 10, mcScore: scoreVal, essayScore: 0, finalScore: scoreVal, gradedAt: '2026-08-28T09:45:00.000Z', status: 'SUDAH_DIKOREKSI' };
    studentExamAnswers[key] = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A', 6: 'B', 7: 'C', 8: 'D', 9: 'A', 10: 'B' };
  });

  store.completedExams = completedExams;
  store.studentExamGrades = studentExamGrades;
  store.studentExamAnswers = studentExamAnswers;

  // Save encrypted local_store.json and local_store.json.backup
  const jsonStr = JSON.stringify(store, null, 2);
  const encryptedStr = encrypt(jsonStr);
  fs.writeFileSync('local_store.json', encryptedStr, 'utf8');
  fs.writeFileSync('local_store.json.backup', encryptedStr, 'utf8');

  console.log(`Successfully written to disk: ${fullAttendance.length} attendance records and ${Object.keys(studentExamGrades).length} exam grades!`);

  // Sync to running server via /api/sync-state to update PostgreSQL & active memory
  try {
    await fetch('http://localhost:3000/api/sync-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'attendance', data: fullAttendance })
    });
    await fetch('http://localhost:3000/api/exam-monitoring-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completed: completedExams,
        gradesObj: studentExamGrades,
        answers: studentExamAnswers
      })
    });
    console.log('Successfully posted attendance and grades to /api/sync-state and /api/exam-monitoring-state!');
  } catch (err) {
    console.error('API Sync warning:', err.message);
  }
}

run();
