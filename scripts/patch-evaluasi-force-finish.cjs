const fs = require('fs');

function replaceExact(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  return text.replace(oldText, newText);
}

function replaceRegex(text, regex, replacement, label) {
  const matches = text.match(regex);
  if (!matches || matches.length !== 1) throw new Error(`${label}: expected exactly 1 match`);
  return text.replace(regex, replacement);
}

// ---- Backend: make admin Force Finish reuse the authoritative finish/scoring path ----
{
  const file = 'server.ts';
  let text = fs.readFileSync(file, 'utf8');

  text = replaceExact(
    text,
    `  const sId = resolveStudentId(req, authUser);\n  const { examId, answers } = req.body;\n  if (!sId || !examId) return res.status(400).json({ success: false, message: \"studentId and examId required\" });`,
    `  const sId = resolveStudentId(req, authUser);\n  const { examId, answers } = req.body;\n  const authRole = String(authUser.role || '').toLowerCase();\n  const isStaffForceFinish = req.body?.forceFinish === true && ['teacher', 'guru', 'admin', 'bos', 'superadmin'].includes(authRole);\n  if (!sId || !examId) return res.status(400).json({ success: false, message: \"studentId and examId required\" });`,
    'finish force role guard'
  );

  text = replaceExact(
    text,
    `  if (!activeExamSessions[key]) {\n    return res.status(409).json({ success: false, message: \"Session ujian tidak aktif sehingga finalisasi ditolak.\" });\n  }`,
    `  // Normal student submit still requires an active session. Staff Force Finish may recover\n  // an interrupted attempt from already-persisted answers even when the live session is gone.\n  if (!activeExamSessions[key] && !isStaffForceFinish) {\n    return res.status(409).json({ success: false, message: \"Session ujian tidak aktif sehingga finalisasi ditolak.\" });\n  }`,
    'finish active session guard'
  );

  text = replaceExact(
    text,
    `  studentExamAnswers[key] = { ...(studentExamAnswers[key] || {}), ...incomingAnswers };\n  const finalAns = studentExamAnswers[key] || {};`,
    `  // Never replace persisted answers with an empty client payload. For Force Finish, also\n  // recover any latest in-memory session answers before server-side scoring.\n  const savedSessionAnswers = (isStaffForceFinish && activeExamSessions[key] && activeExamSessions[key].answers && typeof activeExamSessions[key].answers === 'object')\n    ? activeExamSessions[key].answers\n    : {};\n  studentExamAnswers[key] = { ...(studentExamAnswers[key] || {}), ...savedSessionAnswers, ...incomingAnswers };\n  const finalAns = studentExamAnswers[key] || {};`,
    'finish answer preservation'
  );

  text = replaceExact(
    text,
    `    correctPGCount,\n    totalPGCount: pgQuestions.length,\n    essayGrades: {}\n  };`,
    `    correctPGCount,\n    totalPGCount: pgQuestions.length,\n    totalEssayCount: essayQuestions.length,\n    essayGrades: {},\n    submissionType: isStaffForceFinish ? 'force_finish' : 'normal'\n  };`,
    'finish grade metadata'
  );

  text = replaceExact(
    text,
    `  completedExams[key] = true;\n  await saveDeltaDb('completedExams', key, true);\n  delete activeExamSessions[key];\n  await saveDeltaDb('activeExamSessions', key, null);\n\n  broadcastExamEvent({ type: \"exam_finish\", examId: eId, studentId: sId, grade: finalGrade });\n  res.json({ success: true, message: \"Ujian berhasil diselesaikan dan dinilai oleh server\", grade: finalGrade });`,
    `  const completionValue: any = isStaffForceFinish ? 'force_finish' : true;\n  completedExams[key] = completionValue;\n  const completionWrites: Promise<any>[] = [saveDeltaDb('completedExams', key, completionValue)];\n  if (isStaffForceFinish) {\n    forceFinishedExams[key] = true;\n    completionWrites.push(saveDeltaDb('forceFinishedExams', key, true));\n  }\n  await Promise.all(completionWrites);\n\n  delete activeExamSessions[key];\n  await saveDeltaDb('activeExamSessions', key, null);\n\n  const answeredCount = Object.values(finalAns).filter((value: any) => value !== undefined && value !== null && String(value).trim() !== '').length;\n  broadcastExamEvent({\n    type: \"exam_finish\",\n    examId: eId,\n    studentId: sId,\n    grade: finalGrade,\n    forceFinished: isStaffForceFinish,\n    answered: answeredCount,\n    total: masterQuestions.length\n  });\n  res.json({\n    success: true,\n    message: isStaffForceFinish\n      ? \"Force Finish berhasil. Jawaban tersimpan dipertahankan dan dinilai oleh server.\"\n      : \"Ujian berhasil diselesaikan dan dinilai oleh server\",\n    grade: finalGrade,\n    forceFinished: isStaffForceFinish,\n    answeredCount,\n    totalQuestions: masterQuestions.length\n  });`,
    'finish completion persistence'
  );

  fs.writeFileSync(file, text);
}

function patchAssessmentFile(file) {
  let text = fs.readFileSync(file, 'utf8');

  text = replaceExact(
    text,
    `function stopEvaluasiPolling() {`,
    `async function syncEvaluasiStateFromServer() {\n    const res = await fetch('/api/exam-monitoring-state', { cache: 'no-store' });\n    const data = await res.json().catch(() => null);\n    if (!res.ok || !data || !data.success) return false;\n\n    // This endpoint returns a complete tenant-scoped snapshot for staff. Replace the maps\n    // instead of merging so sessions removed by server do not survive as stale local cache.\n    appState.activeExamSessions = data.activeExamSessions || {};\n    appState.completedExams = data.completedExams || {};\n    appState.forceFinishedExams = data.forceFinishedExams || {};\n    appState.studentExamGrades = data.studentExamGrades || {};\n    appState.studentExamAnswers = data.studentExamAnswers || {};\n    appState.studentExamQuestions = data.studentExamQuestions || data.studentQuestions || {};\n\n    safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);\n    safeSetStorage('madrasah_completed_exams', appState.completedExams);\n    safeSetStorage('madrasah_force_finished_exams', appState.forceFinishedExams);\n    safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);\n    safeSetStorage('madrasah_student_exam_answers', appState.studentExamAnswers);\n    safeSetStorage('madrasah_student_exam_questions', appState.studentExamQuestions);\n    return true;\n}\n\nfunction stopEvaluasiPolling() {`,
    `${file}: add authoritative evaluation sync helper`
  );

  text = replaceRegex(
    text,
    /function startEvaluasiPolling\(\) \{[\s\S]*?\n\}\n\nasync function refreshAssessmentStudentsFromServer\(\) \{/,
    `function startEvaluasiPolling() {\n    if (window.__evaluasiPollInterval) return;\n    window.__evaluasiPollInterval = setInterval(async () => {\n        if (document.visibilityState !== 'visible') return;\n        if (appState.lastAssessmentSubTab !== 'evaluasi') {\n            stopEvaluasiPolling();\n            return;\n        }\n        try {\n            const hasChanges = await syncEvaluasiStateFromServer();\n            const isModalOpen = document.querySelector('.modal-open, #koreksi-modal, #modal-container:not(.hidden)');\n            const isInputActive = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);\n            if (!isModalOpen && !isInputActive && hasChanges) {\n                const containerEl = document.getElementById('view-container');\n                if (containerEl && appState.lastAssessmentSubTab === 'evaluasi') {\n                    renderAssessmentModule(containerEl, 'evaluasi', appState.evaluasiSelectedExamId);\n                }\n            }\n        } catch (e) {\n            console.warn('Evaluasi polling sync gagal:', e);\n        }\n    }, 10000);\n}\n\nasync function refreshAssessmentStudentsFromServer() {`,
    `${file}: replace evaluation polling`
  );

  text = replaceExact(
    text,
    `        startEvaluasiPolling();`,
    `        startEvaluasiPolling();\n\n        // Sync immediately when entering Evaluation; the 10s poll remains only as a fallback.\n        const evalSyncNow = Date.now();\n        const evalLastSync = Number(window.__evaluasiImmediateSyncAt || 0);\n        if (!window.__evaluasiImmediateSyncInProgress && (evalSyncNow - evalLastSync) > 1500) {\n            window.__evaluasiImmediateSyncInProgress = true;\n            window.__evaluasiImmediateSyncAt = evalSyncNow;\n            setTimeout(() => {\n                syncEvaluasiStateFromServer()\n                    .then(synced => {\n                        if (!synced || appState.lastAssessmentSubTab !== 'evaluasi') return;\n                        const viewContainer = document.getElementById('view-container');\n                        if (viewContainer) renderAssessmentModule(viewContainer, 'evaluasi', appState.evaluasiSelectedExamId || null);\n                    })\n                    .catch(err => console.warn('Sinkron awal Evaluasi gagal:', err))\n                    .finally(() => { window.__evaluasiImmediateSyncInProgress = false; });\n            }, 0);\n        }`,
    `${file}: immediate evaluation sync`
  );

  text = replaceRegex(
    text,
    /async function adminForceSubmitExam\(studentId, explicitExamId = null\) \{[\s\S]*?\n\}\n\nfunction confirmAdminForceSubmitExam/,
    `async function adminForceSubmitExam(studentId, explicitExamId = null) {\n    const examId = explicitExamId || appState.evaluasiSelectedExamId || appState.activeMonitoringExamId;\n    if (!examId) {\n        showToast('Ujian tidak ditemukan!', 'error');\n        return;\n    }\n\n    const st = (appState.students || []).find(s => String(s.id) === String(studentId));\n    if (!st) {\n        showToast('Siswa tidak ditemukan!', 'error');\n        return;\n    }\n\n    try {\n        // Do not send answers from browser cache. The server merges its persisted answers\n        // with the authoritative live session and scores that exact saved state.\n        const response = await fetch('/api/exam/attempt/finish', {\n            method: 'POST',\n            headers: { 'Content-Type': 'application/json' },\n            body: JSON.stringify({\n                studentId: st.id,\n                examId,\n                forceFinish: true\n            })\n        });\n        const data = await response.json().catch(() => null);\n        if (!response.ok || !data || !data.success) {\n            showToast((data && data.message) || 'Force Finish gagal. Jawaban siswa tidak diubah.', 'error');\n            return;\n        }\n\n        await syncEvaluasiStateFromServer().catch(() => false);\n\n        const answered = Number.isFinite(Number(data.answeredCount)) ? Number(data.answeredCount) : null;\n        const total = Number.isFinite(Number(data.totalQuestions)) ? Number(data.totalQuestions) : null;\n        const progressText = answered !== null && total !== null ? \` (\${answered}/\${total} jawaban tersimpan)\` : '';\n        showToast(\`Ujian \${st.name} berhasil di-Force Finish dan dinilai dari jawaban yang tersimpan\${progressText}.\`, 'success');\n\n        const containerEl = document.getElementById('view-container');\n        if (containerEl) {\n            if (appState.lastAssessmentSubTab === 'monitoring' && appState.activeMonitoringExamId) {\n                renderAssessmentModule(containerEl, 'monitoring', appState.activeMonitoringExamId);\n            } else {\n                renderAssessmentModule(containerEl, 'evaluasi', examId);\n            }\n        }\n    } catch (e) {\n        console.error('Force Finish gagal:', e);\n        showToast('Force Finish gagal terhubung ke server. Jawaban siswa tetap aman dan tidak dihapus.', 'error');\n    }\n}\n\nfunction confirmAdminForceSubmitExam`,
    `${file}: replace force finish frontend`
  );

  text = replaceExact(
    text,
    `showConfirmModal(\`Apakah Anda yakin ingin menyelesaikan ujian secara paksa (<b>Force Finish</b>) untuk <b>\${stName}</b>? Ujian akan langsung ditutup dan jawaban yang telah tersimpan saat ini akan dinilai.\`, async () => {`,
    `showConfirmModal(\`Apakah Anda yakin ingin menyelesaikan ujian secara paksa (<b>Force Finish</b>) untuk <b>\${stName}</b>? Semua jawaban yang SUDAH tersimpan akan dipertahankan dan dinilai oleh server. Soal yang belum dijawab tetap dianggap kosong; jawaban yang ada tidak akan dihapus.\`, async () => {`,
    `${file}: force finish confirmation text`
  );

  text = replaceRegex(
    text,
    /async function refreshEvaluasiData\(classId, examId\) \{[\s\S]*?\n\}\n\nasync function runAutoKoreksiNonAI/,
    `async function refreshEvaluasiData(classId, examId) {\n    showToast('Memperbarui data nilai dari server...', 'info');\n    let synced = false;\n    try {\n        synced = await syncEvaluasiStateFromServer();\n    } catch (e) {\n        console.warn('Refresh error:', e);\n    }\n    if (classId) appState.evaluasiSelectedClassId = classId;\n    if (examId) appState.evaluasiSelectedExamId = examId;\n    renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', examId || null);\n    showToast(synced ? 'Data nilai berhasil diperbarui!' : 'Data server belum dapat diperbarui. Menampilkan cache terakhir.', synced ? 'success' : 'warning');\n}\n\nasync function runAutoKoreksiNonAI`,
    `${file}: replace manual evaluation refresh`
  );

  fs.writeFileSync(file, text);
}

patchAssessmentFile('src/assessmentModule.js');
patchAssessmentFile('public/assessmentModule.js');

console.log('Evaluation/Force Finish patch applied safely.');
