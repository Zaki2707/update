const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

function replaceOnce(oldText, newText, label) {
  const i = s.indexOf(oldText);
  if (i < 0) throw new Error(`Marker not found: ${label}`);
  if (s.indexOf(oldText, i + oldText.length) >= 0) throw new Error(`Ambiguous marker: ${label}`);
  s = s.slice(0, i) + newText + s.slice(i + oldText.length);
}
function replaceBetween(start, end, replacement, label) {
  const i = s.indexOf(start);
  if (i < 0) throw new Error(`Start marker not found: ${label}`);
  const j = s.indexOf(end, i + start.length);
  if (j < 0) throw new Error(`End marker not found: ${label}`);
  if (s.indexOf(start, i + start.length) >= 0 && s.indexOf(start, i + start.length) < j) throw new Error(`Ambiguous start marker: ${label}`);
  s = s.slice(0, i) + replacement + '\n\n' + s.slice(j);
}

const helperMarker = '// Phase 2 Endpoint: Server-Authoritative Exam Attempt Start (POST /api/exam/attempt/start)';
if (!s.includes('function getExamAttemptContext(')) {
  replaceOnce(helperMarker, `function getExamAttemptContext(req: any, authUser: AuthSession, studentId: string, examId: string) {
  const allExams = getMemoryKeyValue('exams') || exams || [];
  const exam = allExams.find((e: any) => String(e.id) === String(examId));
  if (!exam) return { error: { status: 404, message: 'Ujian tidak ditemukan.' } };

  const role = String(authUser.role || '').toLowerCase();
  const isBos = role === 'bos' || role === 'superadmin';
  if (!isBos && !isItemForCurrentMadrasah(exam, req)) {
    return { error: { status: 403, message: 'Ujian bukan milik madrasah Anda.' } };
  }

  const allStudents = getMemoryKeyValue('students') || students || [];
  const student = allStudents.find((st: any) => String(st.id) === String(studentId));
  if (!student) return { error: { status: 404, message: 'Data siswa tidak ditemukan.' } };
  if (!isBos && !isItemForCurrentMadrasah(student, req)) {
    return { error: { status: 403, message: 'Siswa bukan milik madrasah Anda.' } };
  }

  const studentRoles = ['student', 'siswa', 'class_leader', 'ketua_kelas'];
  if (studentRoles.includes(role)) {
    const targets = Array.isArray(exam.classes) ? exam.classes.map((v: any) => String(v)) : [];
    const unrestricted = targets.length === 0 || targets.some((v: string) => v.toUpperCase() === 'ALL');
    if (!unrestricted) {
      const studentClasses = [student.classId, student.class_id, student.className, student.class]
        .filter(Boolean).map((v: any) => String(v));
      if (!targets.some((target: string) => studentClasses.includes(target))) {
        return { error: { status: 403, message: 'Siswa tidak terdaftar pada kelas sasaran ujian ini.' } };
      }
    }
  }

  return { exam, student };
}

function rejectExamAttemptContext(res: any, context: any): boolean {
  if (!context?.error) return false;
  res.status(context.error.status || 403).json({ success: false, message: context.error.message || 'Akses ujian ditolak.' });
  return true;
}

${helperMarker}`, 'insert authoritative attempt context helper');
}

replaceBetween(
  'app.post("/api/exam/attempt/start", async (req, res) => {',
  '// Phase 5 & 6 Endpoint: Server-Authoritative Question Generation & Sanitization (POST /api/exam/attempt/start-questions)',
`app.post("/api/exam/attempt/start", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  const sId = resolveStudentId(req, authUser);
  const { examId } = req.body;
  if (!sId || !examId) return res.status(400).json({ success: false, message: "studentId and examId required" });

  const eId = String(examId);
  const key = sId + "_" + eId;
  const context = getExamAttemptContext(req, authUser, sId, eId);
  if (rejectExamAttemptContext(res, context)) return;
  const matchedExam: any = context.exam;

  if (completedExams[key] || forceFinishedExams[key]) {
    return res.status(409).json({ success: false, message: "Ujian ini sudah selesai dan tidak dapat dimulai ulang." });
  }
  if (blockedStudents[key] || blockedStudents[eId + '_' + sId]) {
    return res.status(403).json({ success: false, message: "Akses ujian sedang diblokir oleh pengawas." });
  }

  const durationMin = Math.max(1, parseInt(matchedExam.duration || 60, 10) || 60);
  const durationSec = durationMin * 60;
  let session = activeExamSessions[key];
  const now = Date.now();

  if (!session) {
    session = {
      startTime: now,
      startedAt: now,
      endsAt: now + (durationSec * 1000),
      durationSec,
      duration: durationMin,
      status: 'active',
      answers: studentExamAnswers[key] || {},
      currentIndex: 0,
      totalQuestions: Array.isArray(studentExamQuestions[key]) ? studentExamQuestions[key].length : 0,
      answeredCount: Object.keys(studentExamAnswers[key] || {}).length,
      timeLeft: durationSec,
      lastSeenAt: now
    };
  } else {
    if (!session.endsAt) {
      const remainingSec = session.timeLeft !== undefined ? session.timeLeft : durationSec;
      session.endsAt = now + (remainingSec * 1000);
      session.startedAt = session.startTime || (now - (durationSec - remainingSec) * 1000);
    }
    if (Number(session.endsAt) <= now) {
      return res.status(409).json({ success: false, message: "Waktu ujian sudah habis." });
    }
    if (!session.answers) session.answers = {};
    if (studentExamAnswers[key]) session.answers = { ...studentExamAnswers[key], ...session.answers };
    session.answeredCount = Object.keys(session.answers).length;
    session.lastSeenAt = now;
    session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1000));
    if (Array.isArray(studentExamQuestions[key]) && studentExamQuestions[key].length > 0) {
      session.totalQuestions = studentExamQuestions[key].length;
    }
  }

  activeExamSessions[key] = session;
  await saveDeltaDb('activeExamSessions', key, session);
  broadcastExamEvent({ type: 'exam_started', examId: eId, studentId: sId, answered: session.answeredCount || 0, total: session.totalQuestions || 0, lastSeenAt: now });

  res.json({ success: true, session: {
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    remainingTime: session.timeLeft,
    currentIndex: session.currentIndex || 0,
    answers: session.answers || {},
    answeredCount: session.answeredCount || 0,
    totalQuestions: session.totalQuestions || 0
  }});
});`,
  'replace attempt start endpoint'
);

// Validate exact exam/student ownership before cached questions can be returned.
replaceOnce(
`  const eId = String(examId);\n  const key = sId + "_" + eId;\n\n  // Poin 6: Kunci urutan soal di server (Never re-shuffle on refresh/reconnect)`,
`  const eId = String(examId);\n  const key = sId + "_" + eId;\n  const context = getExamAttemptContext(req, authUser, sId, eId);\n  if (rejectExamAttemptContext(res, context)) return;\n  const matchedExam: any = context.exam;\n  if (!activeExamSessions[key]) {\n    return res.status(409).json({ success: false, message: "Session ujian belum aktif. Mulai atau lanjutkan ujian terlebih dahulu." });\n  }\n\n  // Poin 6: Kunci urutan soal di server (Never re-shuffle on refresh/reconnect)`,
  'validate start-questions context before cache'
);
replaceOnce(
`  const allExams = getMemoryKeyValue('exams') || exams || [];\n  const matchedExam = allExams.find((e: any) => String(e.id) === eId) || {};\n  let rawQuestions = matchedExam.questions || [];`,
`  let rawQuestions = matchedExam.questions || [];`,
  'reuse validated matched exam in question generation'
);

replaceBetween(
  'app.post("/api/exam/attempt/answer", async (req, res) => {',
  '// Dedicated student presence + snapshot endpoint (Saves bandwidth & isolates from admin actions)',
`app.post("/api/exam/attempt/answer", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  const sId = resolveStudentId(req, authUser);
  const { examId, questionId, answer, currentIndex } = req.body;
  if (!sId || !examId || !questionId) return res.status(400).json({ success: false, message: "studentId, examId, and questionId are required" });

  const eId = String(examId);
  const key = sId + "_" + eId;
  const context = getExamAttemptContext(req, authUser, sId, eId);
  if (rejectExamAttemptContext(res, context)) return;
  if (completedExams[key] || forceFinishedExams[key]) return res.status(409).json({ success: false, message: "Ujian sudah selesai." });
  if (blockedStudents[key] || blockedStudents[eId + '_' + sId]) return res.status(403).json({ success: false, message: "Akses ujian sedang diblokir." });

  const session = activeExamSessions[key];
  if (!session) return res.status(409).json({ success: false, message: "Session ujian tidak aktif. Muat ulang dan lanjutkan ujian." });
  const now = Date.now();
  if (session.endsAt && Number(session.endsAt) <= now) return res.status(409).json({ success: false, message: "Waktu ujian sudah habis." });

  const assignedQuestions = Array.isArray(studentExamQuestions[key]) ? studentExamQuestions[key] : [];
  if (!assignedQuestions.some((q: any) => String(q.id) === String(questionId))) {
    return res.status(400).json({ success: false, message: "Soal tidak termasuk dalam paket ujian siswa ini." });
  }

  if (!studentExamAnswers[key]) studentExamAnswers[key] = {};
  studentExamAnswers[key][questionId] = answer;
  if (!session.answers) session.answers = {};
  session.answers[questionId] = answer;
  session.answeredCount = Object.keys(session.answers).length;
  if (currentIndex !== undefined) session.currentIndex = currentIndex;
  session.lastSeenAt = now;
  if (session.endsAt) session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1000));
  activeExamSessions[key] = session;

  await Promise.all([
    saveDeltaDb('studentExamAnswers', key, studentExamAnswers[key]),
    saveDeltaDb('activeExamSessions', key, session)
  ]);
  broadcastExamEvent({ type: "exam_progress", examId: eId, studentId: sId, answered: session.answeredCount, total: session.totalQuestions, currentIndex: session.currentIndex, lastSeenAt: now });
  res.json({ success: true, questionId, answeredCount: session.answeredCount, remainingTime: session.timeLeft });
});`,
  'replace authoritative answer endpoint'
);

replaceBetween(
  '// Phase 4 Endpoint: Final Submission & Server-Side Auto-Scoring (POST /api/exam/attempt/finish)',
  '// Phase 1 Endpoint: Summarized Teacher Monitoring (GET /api/exams/:examId/monitor)',
`// Phase 4 Endpoint: Final Submission & Server-Side Auto-Scoring (POST /api/exam/attempt/finish)
app.post("/api/exam/attempt/finish", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  const sId = resolveStudentId(req, authUser);
  const { examId, answers } = req.body;
  if (!sId || !examId) return res.status(400).json({ success: false, message: "studentId and examId required" });

  const eId = String(examId);
  const key = sId + "_" + eId;
  const context = getExamAttemptContext(req, authUser, sId, eId);
  if (rejectExamAttemptContext(res, context)) return;
  if (completedExams[key] || forceFinishedExams[key]) {
    return res.status(409).json({ success: false, message: "Ujian sudah pernah diselesaikan." });
  }
  if (!activeExamSessions[key]) {
    return res.status(409).json({ success: false, message: "Session ujian tidak aktif sehingga finalisasi ditolak." });
  }

  const masterQuestions = studentExamMasterQuestions[key];
  if (!Array.isArray(masterQuestions) || masterQuestions.length === 0) {
    return res.status(409).json({ success: false, message: "Kunci soal server tidak tersedia. Finalisasi ditolak agar nilai tidak salah; muat ulang paket soal lalu coba lagi." });
  }

  const allowedIds = new Set(masterQuestions.map((q: any) => String(q.id)));
  const incomingAnswers: Record<string, any> = {};
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    for (const [qid, val] of Object.entries(answers)) if (allowedIds.has(String(qid))) incomingAnswers[String(qid)] = val;
  }
  studentExamAnswers[key] = { ...(studentExamAnswers[key] || {}), ...incomingAnswers };
  const finalAns = studentExamAnswers[key] || {};

  let correctPGCount = 0;
  const pgQuestions = masterQuestions.filter((q: any) => q.type !== 'esay' && q.type !== 'essay');
  const essayQuestions = masterQuestions.filter((q: any) => q.type === 'esay' || q.type === 'essay');
  pgQuestions.forEach((q: any) => {
    const uAns = finalAns[q.id] !== undefined ? finalAns[q.id] : finalAns[String(q.id)];
    if (uAns === undefined || uAns === null) return;
    const normUAns = String(uAns).trim().toLowerCase();
    const normKey = String(q.answer || q.correctOptionText || '').trim().toLowerCase();
    if (normUAns === normKey) correctPGCount++;
    else if (Array.isArray(q.options) && /^[a-e]$/i.test(normUAns)) {
      const idx = normUAns.toUpperCase().charCodeAt(0) - 65;
      if (q.options[idx] && String(q.options[idx]).trim().toLowerCase() === normKey) correctPGCount++;
    }
  });

  const pgScore = pgQuestions.length > 0 ? Math.round((correctPGCount / pgQuestions.length) * 100) : 0;
  const finalGrade = {
    pgScore,
    essayScore: 0,
    finalScore: essayQuestions.length === 0 ? pgScore : null,
    isGraded: essayQuestions.length === 0,
    correctPGCount,
    totalPGCount: pgQuestions.length,
    essayGrades: {}
  };

  // Persist authoritative result first; only then mark the attempt completed and clear the live session.
  studentExamGrades[key] = finalGrade;
  await Promise.all([
    saveDeltaDb('studentExamAnswers', key, studentExamAnswers[key]),
    saveDeltaDb('studentExamGrades', key, finalGrade)
  ]);
  completedExams[key] = true;
  await saveDeltaDb('completedExams', key, true);
  delete activeExamSessions[key];
  await saveDeltaDb('activeExamSessions', key, null);

  broadcastExamEvent({ type: "exam_finish", examId: eId, studentId: sId, grade: finalGrade });
  res.json({ success: true, message: "Ujian berhasil diselesaikan dan dinilai oleh server", grade: finalGrade });
});`,
  'replace finish grading endpoint'
);

fs.writeFileSync('server.ts', s);

let audit = fs.readFileSync('scripts/security-audit.cjs', 'utf8');
if (!audit.includes('CBT finish ignores client grade')) {
  const marker = `  ['Teacher activation target is identity scoped', server.includes('Guru hanya dapat mengaktifkan token untuk akun sendiri')],`;
  if (!audit.includes(marker)) throw new Error('Audit marker missing');
  const extra = `${marker}\n  ['CBT attempt context is server validated', server.includes('function getExamAttemptContext(')],\n  ['CBT answer requires active session', server.includes('Session ujian tidak aktif. Muat ulang dan lanjutkan ujian.')],\n  ['CBT answer validates assigned question', server.includes('Soal tidak termasuk dalam paket ujian siswa ini.')],\n  ['CBT finish ignores client grade', !server.includes('const { examId, answers, clientGrade } = req.body')],\n  ['CBT finish has no fabricated 100 fallback', !server.includes('finalScore: 100')],\n  ['CBT finish requires server master questions', server.includes('Kunci soal server tidak tersedia. Finalisasi ditolak')],`;
  audit = audit.replace(marker, extra);
  fs.writeFileSync('scripts/security-audit.cjs', audit);
}
console.log('CBT integrity hardening applied.');
