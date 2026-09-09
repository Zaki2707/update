const fs = require('fs');

function replaceExact(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  return text.replace(oldText, newText);
}

const file = 'server.ts';
let text = fs.readFileSync(file, 'utf8');

text = replaceExact(
  text,
  `  const authRole = String(authUser.role || '').toLowerCase();\n  const isStaffForceFinish = req.body?.forceFinish === true && ['teacher', 'guru', 'admin', 'bos', 'superadmin'].includes(authRole);\n  if (!sId || !examId) return res.status(400).json({ success: false, message: \"studentId and examId required\" });`,
  `  const authRole = String(authUser.role || '').toLowerCase();\n  const staffRoles = ['teacher', 'guru', 'admin', 'bos', 'superadmin'];\n  const isStaffRole = staffRoles.includes(authRole);\n  const isStaffForceFinish = req.body?.forceFinish === true && isStaffRole;\n  if (req.body?.forceFinish === true && !isStaffRole) {\n    return res.status(403).json({ success: false, message: \"Force Finish hanya dapat dilakukan oleh guru/admin yang berwenang.\" });\n  }\n  if (isStaffRole && !isStaffForceFinish) {\n    return res.status(403).json({ success: false, message: \"Akun staf hanya dapat menyelesaikan attempt siswa melalui Force Finish.\" });\n  }\n  if (!sId || !examId) return res.status(400).json({ success: false, message: \"studentId and examId required\" });`,
  'force finish role enforcement'
);

text = replaceExact(
  text,
  `  const allowedIds = new Set(masterQuestions.map((q: any) => String(q.id)));\n  const incomingAnswers: Record<string, any> = {};\n  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {\n    for (const [qid, val] of Object.entries(answers)) if (allowedIds.has(String(qid))) incomingAnswers[String(qid)] = val;\n  }\n  // Never replace persisted answers with an empty client payload. For Force Finish, also\n  // recover any latest in-memory session answers before server-side scoring.\n  const savedSessionAnswers = (isStaffForceFinish && activeExamSessions[key] && activeExamSessions[key].answers && typeof activeExamSessions[key].answers === 'object')\n    ? activeExamSessions[key].answers\n    : {};\n  studentExamAnswers[key] = { ...(studentExamAnswers[key] || {}), ...savedSessionAnswers, ...incomingAnswers };\n  const finalAns = studentExamAnswers[key] || {};`,
  `  const allowedIds = new Set(masterQuestions.map((q: any) => String(q.id)));\n  const filterAllowedAnswers = (source: any): Record<string, any> => {\n    const filtered: Record<string, any> = {};\n    if (!source || typeof source !== 'object' || Array.isArray(source)) return filtered;\n    for (const [qid, val] of Object.entries(source)) {\n      const normalizedId = String(qid);\n      if (allowedIds.has(normalizedId)) filtered[normalizedId] = val;\n    }\n    return filtered;\n  };\n\n  // Normal student submit may send the student's own final answer payload.\n  // Staff Force Finish must NEVER trust answers supplied by the admin browser.\n  const incomingAnswers = isStaffForceFinish ? {} : filterAllowedAnswers(answers);\n  const persistedAnswers = filterAllowedAnswers(studentExamAnswers[key]);\n  const savedSessionAnswers = isStaffForceFinish\n    ? filterAllowedAnswers(activeExamSessions[key]?.answers)\n    : {};\n\n  // Server-authoritative precedence: persisted answers -> latest live-session answers ->\n  // student's own final payload (normal submit only). Invalid/stale question IDs are dropped.\n  studentExamAnswers[key] = { ...persistedAnswers, ...savedSessionAnswers, ...incomingAnswers };\n  const finalAns = studentExamAnswers[key];`,
  'authoritative answer filtering'
);

fs.writeFileSync(file, text);
console.log('Force Finish authoritative hardening applied.');
