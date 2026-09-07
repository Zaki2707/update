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

  const xi11Students = (store.students || []).filter(s => s.classId === 'C3');
  console.log(`Class XI.1.1 (C3) students count: ${xi11Students.length}`);

  // 1. Attendance records for XI.1.1
  const dates = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31'];
  const existingAtt = Array.isArray(store.attendance) ? store.attendance : [];
  const newAttRecords = [];

  dates.forEach(d => {
    xi11Students.forEach((st, idx) => {
      const existing = existingAtt.find(a => String(a.studentId) === String(st.id) && a.date === d);
      if (!existing) {
        let status = 'HADIR';
        if (idx % 11 === 3) status = 'IZIN';
        if (idx % 11 === 7) status = 'SAKIT';
        if (idx % 11 === 10) status = 'ALPA';

        newAttRecords.push({
          id: `ATT_XI11_${st.id}_${d.replace(/-/g, '')}`,
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
      }
    });
  });

  const fullAttendance = [...existingAtt, ...newAttRecords];
  store.attendance = fullAttendance;

  // 2. Exam Grades & Monitoring State for Exam EX1786457950062 ("aa") for XI.1.1
  const examId = 'EX1786457950062';
  const completedExams = store.completedExams || {};
  const studentExamGrades = store.studentExamGrades || {};
  const studentExamAnswers = store.studentExamAnswers || {};

  xi11Students.forEach((st, idx) => {
    const key = `${st.id}_${examId}`;
    const scoreVal = 82 + (idx % 5) * 4;

    completedExams[key] = {
      completedAt: '2026-08-28T09:45:00.000Z',
      score: scoreVal,
      classId: 'C3',
      examId: examId,
      studentId: st.id
    };

    studentExamGrades[key] = {
      examId: examId,
      studentId: st.id,
      studentName: st.name,
      classId: 'C3',
      className: 'XI.1.1',
      nis: st.nis,
      mcCorrect: 8 + (idx % 3),
      mcTotal: 10,
      mcScore: scoreVal,
      essayScore: 0,
      finalScore: scoreVal,
      gradedAt: '2026-08-28T09:45:00.000Z',
      status: 'SUDAH_DIKOREKSI'
    };

    studentExamAnswers[key] = {
      1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A',
      6: 'B', 7: 'C', 8: 'D', 9: 'A', 10: 'B'
    };
  });

  store.completedExams = completedExams;
  store.studentExamGrades = studentExamGrades;
  store.studentExamAnswers = studentExamAnswers;

  // Write to disk
  const jsonStr = JSON.stringify(store, null, 2);
  const encryptedStr = encrypt(jsonStr);
  fs.writeFileSync('local_store.json', encryptedStr, 'utf8');
  fs.writeFileSync('local_store.json.backup', encryptedStr, 'utf8');

  console.log(`Saved ${fullAttendance.length} total attendance records and ${Object.keys(studentExamGrades).length} total exam grades to local_store.json`);

  // Now post directly to running server
  try {
    await fetch('http://localhost:3000/api/attendance/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: newAttRecords })
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
    console.log('Successfully posted XI.1.1 attendance and grades to running server APIs!');
  } catch (err) {
    console.error('API post warning:', err.message);
  }
}

run();
