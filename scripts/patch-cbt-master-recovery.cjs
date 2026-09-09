const fs = require('fs');

function replaceExact(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  return text.replace(oldText, newText);
}

const file = 'server.ts';
let text = fs.readFileSync(file, 'utf8');

const shuffleMarker = `function shuffleArray<T>(arr: T[]): T[] {\n  if (!Array.isArray(arr)) return [];\n  const array = [...arr];\n  for (let i = array.length - 1; i > 0; i--) {\n    const j = Math.floor(Math.random() * (i + 1));\n    [array[i], array[j]] = [array[j], array[i]];\n  }\n  return array;\n}\n\napp.post(\"/api/exam/attempt/start-questions\", async (req, res) => {`;

const helperBlock = `function shuffleArray<T>(arr: T[]): T[] {\n  if (!Array.isArray(arr)) return [];\n  const array = [...arr];\n  for (let i = array.length - 1; i > 0; i--) {\n    const j = Math.floor(Math.random() * (i + 1));\n    [array[i], array[j]] = [array[j], array[i]];\n  }\n  return array;\n}\n\nfunction getRawQuestionsForExamAttempt(matchedExam: any): any[] {\n  let rawQuestions = Array.isArray(matchedExam?.questions) ? matchedExam.questions : [];\n  if (rawQuestions.length > 0) return rawQuestions;\n\n  const allQuestions = getMemoryKeyValue('questions') || questions || [];\n  const exCode = String(matchedExam?.bankCode || matchedExam?.groupCode || '').trim().toLowerCase();\n  const exSub = String(matchedExam?.subject || matchedExam?.subjectId || '').trim().toLowerCase();\n  const exClass = String(matchedExam?.class || matchedExam?.className || matchedExam?.classId || '').trim().toLowerCase();\n  const mId = String(matchedExam?.madrasahId || matchedExam?.madrasahSlug || '').trim();\n\n  return allQuestions.filter((q: any) => {\n    if (!q) return false;\n    if (mId && mId !== 'default' && mId !== 'BOSS') {\n      const qmId = String(q.madrasahId || q.madrasahSlug || '').trim();\n      if (qmId && qmId !== mId) return false;\n    }\n    const qCode = String(q.code || q.bankCode || q.groupCode || '').trim().toLowerCase();\n    const qSub = String(q.subjectId || q.subject || '').trim().toLowerCase();\n    const qClass = String(q.classId || q.className || q.class || '').trim().toLowerCase();\n\n    if (exCode && qCode && qCode === exCode) return true;\n    if (exSub && qSub && (qSub === exSub || qSub.includes(exSub) || exSub.includes(qSub))) {\n      if (exClass && qClass && !exClass.includes('all') && !qClass.includes('all')) {\n        return qClass === exClass || exClass.includes(qClass);\n      }\n      return true;\n    }\n    return false;\n  });\n}\n\nfunction resolveMasterCorrectText(rawQuestion: any, originalOptions: any[]): string {\n  let correctText = String(rawQuestion?.correctOptionText || '').trim();\n  if (correctText) return correctText;\n\n  const rawKey = String(rawQuestion?.answer || '').trim();\n  const letterIdx = ['a', 'b', 'c', 'd', 'e'].indexOf(rawKey.toLowerCase().replace('.', ''));\n  if (letterIdx !== -1 && originalOptions[letterIdx] !== undefined) {\n    return String(originalOptions[letterIdx]).trim();\n  }\n  return rawKey;\n}\n\nfunction rebuildMasterQuestionsFromAssigned(matchedExam: any, assignedQuestions: any[]): any[] {\n  if (!Array.isArray(assignedQuestions) || assignedQuestions.length === 0) return [];\n  const rawQuestions = getRawQuestionsForExamAttempt(matchedExam);\n  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return [];\n\n  const usedIndexes = new Set<number>();\n  const rebuilt: any[] = [];\n\n  for (let idx = 0; idx < assignedQuestions.length; idx++) {\n    const assigned = assignedQuestions[idx];\n    const assignedId = String(assigned?.id || '');\n    let rawIndex = rawQuestions.findIndex((q: any, rawIdx: number) =>\n      !usedIndexes.has(rawIdx) && q?.id !== undefined && q?.id !== null && String(q.id) === assignedId\n    );\n\n    // Legacy/generated IDs may not exist in the bank. Fall back to exact question text/type,\n    // but never to array position alone because that could attach the wrong answer key.\n    if (rawIndex < 0) {\n      rawIndex = rawQuestions.findIndex((q: any, rawIdx: number) => {\n        if (usedIndexes.has(rawIdx) || !q) return false;\n        if (String(q.question || '').trim() !== String(assigned?.question || '').trim()) return false;\n        const rawType = String(q.type || 'mc').toLowerCase();\n        const assignedType = String(assigned?.type || 'mc').toLowerCase();\n        return rawType === assignedType;\n      });\n    }\n\n    if (rawIndex < 0) return [];\n    usedIndexes.add(rawIndex);\n\n    const raw = rawQuestions[rawIndex];\n    const originalOptions = Array.isArray(raw.options) ? [...raw.options] : [];\n    const assignedOptions = Array.isArray(assigned?.options) ? [...assigned.options] : [...originalOptions];\n    const correctText = resolveMasterCorrectText(raw, originalOptions);\n\n    rebuilt.push({\n      ...raw,\n      id: assigned?.id || raw.id || ('Q_' + idx + '_' + String(matchedExam?.id || 'exam')),\n      options: assignedOptions,\n      originalOptions,\n      correctOptionText: correctText,\n      answer: raw.answer || correctText\n    });\n  }\n\n  return rebuilt;\n}\n\nasync function recoverMissingExamMasterQuestions(key: string, matchedExam: any): Promise<any[]> {\n  const existingMaster = studentExamMasterQuestions[key];\n  if (Array.isArray(existingMaster) && existingMaster.length > 0) return existingMaster;\n\n  const assigned = studentExamQuestions[key];\n  const rebuilt = rebuildMasterQuestionsFromAssigned(matchedExam, assigned);\n  if (!Array.isArray(rebuilt) || rebuilt.length === 0 || rebuilt.length !== (Array.isArray(assigned) ? assigned.length : 0)) {\n    return [];\n  }\n\n  studentExamMasterQuestions[key] = rebuilt;\n  await saveDeltaDb('studentExamMasterQuestions', key, rebuilt);\n  return rebuilt;\n}\n\napp.post(\"/api/exam/attempt/start-questions\", async (req, res) => {`;

text = replaceExact(text, shuffleMarker, helperBlock, 'insert master recovery helpers');

const oldResume = `  // Poin 6: Kunci urutan soal di server (Never re-shuffle on refresh/reconnect)\n  if (studentExamQuestions[key] && Array.isArray(studentExamQuestions[key]) && studentExamQuestions[key].length > 0) {\n    return res.json({\n      success: true,\n      questions: studentExamQuestions[key],\n      isResumed: true\n    });\n  }`;

const newResume = `  // Poin 6: Kunci urutan soal di server (Never re-shuffle on refresh/reconnect).\n  // Legacy attempts may have the sanitized assigned packet persisted without the private master key.\n  // Recover the master from the exact assigned packet + server bank before returning resume.\n  if (studentExamQuestions[key] && Array.isArray(studentExamQuestions[key]) && studentExamQuestions[key].length > 0) {\n    const recoveredMaster = await recoverMissingExamMasterQuestions(key, matchedExam);\n    if (!Array.isArray(recoveredMaster) || recoveredMaster.length === 0) {\n      const savedAnswerCount = Object.keys(studentExamAnswers[key] || activeExamSessions[key]?.answers || {}).length;\n      if (savedAnswerCount > 0) {\n        return res.status(409).json({\n          success: false,\n          message: \"Paket soal lama ditemukan tetapi kunci penilaiannya tidak dapat dipulihkan dengan aman. Jawaban siswa tetap disimpan; admin perlu reset attempt ini sebelum ujian diulang.\"\n        });\n      }\n      // No answers exist, so regenerating a fresh packet is safe.\n      delete studentExamQuestions[key];\n      await saveDeltaDb('studentExamQuestions', key, null);\n    } else {\n      return res.json({\n        success: true,\n        questions: studentExamQuestions[key],\n        isResumed: true,\n        masterRecovered: true\n      });\n    }\n  }`;

text = replaceExact(text, oldResume, newResume, 'recover master on resume');

const oldFinishMaster = `  const masterQuestions = studentExamMasterQuestions[key];\n  if (!Array.isArray(masterQuestions) || masterQuestions.length === 0) {\n    return res.status(409).json({ success: false, message: \"Kunci soal server tidak tersedia. Finalisasi ditolak agar nilai tidak salah; muat ulang paket soal lalu coba lagi.\" });\n  }`;

const newFinishMaster = `  let masterQuestions = studentExamMasterQuestions[key];\n  if (!Array.isArray(masterQuestions) || masterQuestions.length === 0) {\n    masterQuestions = await recoverMissingExamMasterQuestions(key, context.exam);\n  }\n  if (!Array.isArray(masterQuestions) || masterQuestions.length === 0) {\n    return res.status(409).json({\n      success: false,\n      message: \"Kunci soal server tidak tersedia. Finalisasi ditolak karena kunci tidak dapat dipulihkan dengan aman; jawaban siswa tetap tersimpan agar nilai tidak salah.\"\n    });\n  }`;

text = replaceExact(text, oldFinishMaster, newFinishMaster, 'recover master on finish');

text = replaceExact(
  text,
  `    const normKey = String(q.answer || q.correctOptionText || '').trim().toLowerCase();`,
  `    // Prefer resolved correct option text because q.answer may be the pre-shuffle letter.\n    const normKey = String(q.correctOptionText || q.answer || '').trim().toLowerCase();`,
  'prefer correct option text for grading'
);

text = replaceExact(
  text,
  `  delete studentExamAnswers[key];\n  delete studentExamQuestions[key];\n  delete studentTabSwitches[key];`,
  `  delete studentExamAnswers[key];\n  delete studentExamQuestions[key];\n  delete studentExamMasterQuestions[key];\n  delete studentTabSwitches[key];`,
  'clear master on reset memory'
);

text = replaceExact(
  text,
  `    saveDeltaDb('studentExamAnswers', key, null),\n    saveDeltaDb('studentExamQuestions', key, null),\n    saveDeltaDb('studentTabSwitches', key, null),`,
  `    saveDeltaDb('studentExamAnswers', key, null),\n    saveDeltaDb('studentExamQuestions', key, null),\n    saveDeltaDb('studentExamMasterQuestions', key, null),\n    saveDeltaDb('studentTabSwitches', key, null),`,
  'clear master on reset persistence'
);

fs.writeFileSync(file, text);
console.log('CBT master recovery patch applied.');
