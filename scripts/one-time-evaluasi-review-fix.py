from pathlib import Path


def replace_region(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f'{label}: start marker not found')
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f'{label}: end marker not found')
    return text[:start] + replacement + text[end:]


server_path = Path('server.ts')
server = server_path.read_text(encoding='utf-8')

review_helper = r'''

function isMasterMultipleChoiceAnswerCorrect(question: any, studentAnswer: any): boolean {
  if (!question || question.type === 'esay' || question.type === 'essay') return false;
  if (studentAnswer === undefined || studentAnswer === null || String(studentAnswer).trim() === '') return false;

  const normStudent = String(studentAnswer).trim().toLowerCase();
  const normKey = String(question.correctOptionText || question.answer || '').trim().toLowerCase();
  if (!normKey) return false;
  if (normStudent === normKey) return true;

  if (Array.isArray(question.options) && /^[a-e]$/i.test(normStudent)) {
    const idx = normStudent.toUpperCase().charCodeAt(0) - 65;
    const selectedOption = question.options[idx];
    if (selectedOption !== undefined && String(selectedOption).trim().toLowerCase() === normKey) return true;
  }

  return false;
}

function scoreMasterMultipleChoice(masterQuestions: any[], answers: Record<string, any>) {
  const pgQuestions = (Array.isArray(masterQuestions) ? masterQuestions : []).filter((q: any) => q.type !== 'esay' && q.type !== 'essay');
  let correctPGCount = 0;
  for (const q of pgQuestions) {
    const value = answers && answers[q.id] !== undefined ? answers[q.id] : answers?.[String(q.id)];
    if (isMasterMultipleChoiceAnswerCorrect(q, value)) correctPGCount++;
  }
  return {
    correctPGCount,
    totalPGCount: pgQuestions.length,
    pgScore: pgQuestions.length > 0 ? Math.round((correctPGCount / pgQuestions.length) * 100) : 0
  };
}

app.get("/api/exam/review", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req: any, res) => {
  try {
    const authUser = req.user || getAuthUser(req);
    const studentId = String(req.query.studentId || '').trim();
    const examId = String(req.query.examId || '').trim();
    if (!authUser || !studentId || !examId) {
      return res.status(400).json({ success: false, message: "studentId dan examId wajib diisi." });
    }

    const context = getExamAttemptContext(req, authUser, studentId, examId);
    if (rejectExamAttemptContext(res, context)) return;

    const key = studentId + '_' + examId;
    let masterQuestions = studentExamMasterQuestions[key];
    if (!Array.isArray(masterQuestions) || masterQuestions.length === 0) {
      masterQuestions = await recoverMissingExamMasterQuestions(key, context.exam);
    }
    if (!Array.isArray(masterQuestions) || masterQuestions.length === 0) {
      return res.status(409).json({
        success: false,
        message: "Paket kunci authoritative untuk attempt siswa ini belum tersedia atau tidak dapat dipulihkan dengan aman."
      });
    }

    const persistedAnswers = studentExamAnswers[key] && typeof studentExamAnswers[key] === 'object' ? studentExamAnswers[key] : {};
    const liveAnswers = activeExamSessions[key]?.answers && typeof activeExamSessions[key].answers === 'object' ? activeExamSessions[key].answers : {};
    const answers = { ...persistedAnswers, ...liveAnswers };
    const pgSummary = scoreMasterMultipleChoice(masterQuestions, answers);

    const reviewQuestions = masterQuestions.map((q: any, idx: number) => {
      const studentAnswer = answers[q.id] !== undefined ? answers[q.id] : answers[String(q.id)];
      const answered = studentAnswer !== undefined && studentAnswer !== null && String(studentAnswer).trim() !== '';
      const isEssay = q.type === 'esay' || q.type === 'essay';
      const correctAnswer = isEssay
        ? String(q.answer || '').trim()
        : String(q.correctOptionText || q.answer || '').trim();
      let correctOptionIndex = -1;
      if (!isEssay && Array.isArray(q.options) && correctAnswer) {
        correctOptionIndex = q.options.findIndex((opt: any) => String(opt).trim().toLowerCase() === correctAnswer.toLowerCase());
      }

      return {
        id: q.id,
        number: idx + 1,
        question: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        type: q.type || 'mc',
        imageUrl: q.imageUrl || q.image || null,
        studentAnswer: studentAnswer === undefined ? null : studentAnswer,
        answered,
        correctAnswer,
        correctOptionIndex,
        correctOptionLetter: correctOptionIndex >= 0 ? String.fromCharCode(65 + correctOptionIndex) : null,
        isCorrect: isEssay ? null : isMasterMultipleChoiceAnswerCorrect(q, studentAnswer)
      };
    });

    return res.json({
      success: true,
      studentId,
      examId,
      questions: reviewQuestions,
      answeredCount: reviewQuestions.filter((q: any) => q.answered).length,
      correctPGCount: pgSummary.correctPGCount,
      totalPGCount: pgSummary.totalPGCount,
      pgScore: pgSummary.pgScore,
      grade: studentExamGrades[key] || null
    });
  } catch (error: any) {
    console.error('[Exam Review Error]:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Gagal memuat review jawaban.' });
  }
});
'''

start_questions_marker = '\napp.post("/api/exam/attempt/start-questions", async (req, res) => {'
if 'app.get("/api/exam/review"' not in server:
    if start_questions_marker not in server:
        raise SystemExit('server review insertion marker not found')
    server = server.replace(start_questions_marker, review_helper + start_questions_marker, 1)

score_start = '  let correctPGCount = 0;\n  const pgQuestions = masterQuestions.filter((q: any) => q.type !== \'esay\' && q.type !== \'essay\');'
score_end = '\n  const finalGrade = {'
if score_start in server:
    score_replacement = '''  const pgQuestions = masterQuestions.filter((q: any) => q.type !== 'esay' && q.type !== 'essay');\n  const essayQuestions = masterQuestions.filter((q: any) => q.type === 'esay' || q.type === 'essay');\n  const pgSummary = scoreMasterMultipleChoice(masterQuestions, finalAns);\n  const correctPGCount = pgSummary.correctPGCount;\n  const pgScore = pgSummary.pgScore;\n'''
    server = replace_region(server, score_start, score_end, score_replacement, 'server final scoring')
elif 'const pgSummary = scoreMasterMultipleChoice(masterQuestions, finalAns);' not in server:
    raise SystemExit('server final scoring block not found')

server_path.write_text(server, encoding='utf-8')

frontend_path = Path('src/assessmentModule.js')
frontend = frontend_path.read_text(encoding='utf-8')

preview_block = r'''async function fetchEvaluasiReview(studentId, examId) {
    const response = await fetch(`/api/exam/review?studentId=${encodeURIComponent(studentId)}&examId=${encodeURIComponent(examId)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}`);
    }
    return data;
}

function evaluasiReviewOptionState(question, option, optionIndex) {
    const studentRaw = String(question.studentAnswer ?? '').trim();
    const letter = String.fromCharCode(65 + optionIndex);
    const selected = studentRaw === String(option).trim() || studentRaw.toUpperCase() === letter;
    const isKey = Number(question.correctOptionIndex) === optionIndex || String(question.correctAnswer || '').trim().toLowerCase() === String(option).trim().toLowerCase();
    return { selected, isKey, letter };
}

async function openPreviewJawabanEvaluasi(studentId) {
    const examId = appState.evaluasiSelectedExamId;
    const st = (appState.students || []).find(s => String(s.id) === String(studentId));
    const ex = (appState.exams || []).find(e => String(e.id) === String(examId));
    if (!st || !ex) return showToast('Data siswa atau ujian tidak ditemukan.', 'error');

    try {
        const review = await fetchEvaluasiReview(st.id, examId);
        const questions = Array.isArray(review.questions) ? review.questions : [];
        const items = questions.length ? questions.map((q, idx) => {
            const isEssay = q.type === 'esay' || q.type === 'essay';
            let statusLabel = q.answered ? 'Terjawab' : 'Kosong';
            let statusClass = q.answered ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-500 bg-slate-50 border-slate-200';
            let responseHtml = '';

            if (isEssay) {
                responseHtml = `
                    <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl text-xs text-slate-800">
                            <p class="text-[9px] font-black uppercase tracking-wider text-amber-700 mb-2">Jawaban Siswa</p>
                            <div class="whitespace-pre-wrap leading-relaxed">${q.answered ? evaluasiEscapeHtml(q.studentAnswer) : '<span class="text-slate-400 italic">Tidak dijawab</span>'}</div>
                        </div>
                        <div class="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl text-xs text-slate-800">
                            <p class="text-[9px] font-black uppercase tracking-wider text-emerald-700 mb-2">Kunci Jawaban / Rujukan Guru</p>
                            <div class="whitespace-pre-wrap leading-relaxed">${q.correctAnswer ? evaluasiEscapeHtml(q.correctAnswer) : '<span class="text-slate-400 italic">Kunci kosong</span>'}</div>
                        </div>
                    </div>`;
            } else {
                if (q.answered) {
                    statusLabel = q.isCorrect ? 'Benar' : 'Salah';
                    statusClass = q.isCorrect ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200';
                }
                responseHtml = `<div class="mt-3 grid grid-cols-1 gap-2">${(q.options || []).map((opt, oIdx) => {
                    const state = evaluasiReviewOptionState(q, opt, oIdx);
                    let cls = 'bg-slate-50 border-slate-200 text-slate-600';
                    if (state.selected && state.isKey) cls = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold';
                    else if (state.selected) cls = 'bg-rose-50 border-rose-400 text-rose-950 font-bold';
                    else if (state.isKey) cls = 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-semibold';
                    const badge = state.selected && state.isKey
                        ? '<span class="text-[9px] uppercase text-emerald-700 font-black">Dipilih • Kunci</span>'
                        : (state.selected
                            ? '<span class="text-[9px] uppercase text-rose-700 font-black">Dipilih</span>'
                            : (state.isKey ? '<span class="text-[9px] uppercase text-emerald-700 font-black">Kunci Jawaban</span>' : ''));
                    return `<div class="p-3 rounded-2xl border flex items-center gap-3 text-xs ${cls}"><span class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${state.isKey ? 'bg-emerald-600 text-white' : (state.selected ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600')}">${state.letter}</span><span class="flex-1">${evaluasiEscapeHtml(opt)}</span>${badge}</div>`;
                }).join('')}</div>`;
            }

            return `<div class="bg-white border border-slate-200 rounded-3xl p-5"><div class="flex items-center justify-between gap-2"><span class="text-[10px] font-black px-2.5 py-1 bg-slate-800 text-white rounded-xl">Soal ${idx + 1}</span><span class="text-[10px] font-bold ${statusClass} border px-2.5 py-1 rounded-xl">${statusLabel}</span></div><div class="mt-3 text-xs font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">${evaluasiEscapeHtml(q.question || '')}</div>${responseHtml}</div>`;
        }).join('') : `<div class="p-8 text-center text-slate-400 text-xs">Paket review siswa belum tersedia.</div>`;

        const modal = document.getElementById('modal-container');
        if (!modal) return;
        modal.innerHTML = `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-6"><div class="bg-slate-50 w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200"><div class="p-5 bg-white border-b flex items-center justify-between shrink-0"><div><h3 class="font-extrabold text-slate-800 text-sm flex items-center gap-2"><i class="fa-solid fa-eye text-indigo-600"></i> Preview Jawaban: ${evaluasiEscapeHtml(st.name)}</h3><p class="text-[10px] text-slate-500 mt-1">${evaluasiEscapeHtml(ex.title)} &bull; ${review.answeredCount || 0}/${questions.length} soal terjawab &bull; PG benar ${review.correctPGCount || 0}/${review.totalPGCount || 0}</p></div><button type="button" onclick="closeModal()" class="w-9 h-9 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-600"><i class="fa-solid fa-xmark"></i></button></div><div class="px-5 py-3 bg-indigo-50 border-b border-indigo-100 text-[10px] text-indigo-800 font-semibold">Review ini memakai kunci authoritative server. Pilihan hijau adalah kunci jawaban; pilihan merah adalah jawaban siswa yang salah. Mode baca saja dan tidak mengubah nilai.</div><div class="flex-1 overflow-y-auto p-5 space-y-4" id="evaluasi-answer-preview-content">${items}</div><div class="p-4 bg-white border-t flex justify-end"><button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold">Tutup</button></div></div></div>`;
        if (typeof window.renderMathInElementSafely === 'function') window.renderMathInElementSafely(document.getElementById('evaluasi-answer-preview-content'));
    } catch (error) {
        console.error('[Evaluasi Review Error]:', error);
        showToast(`Gagal memuat review jawaban: ${error.message || error}`, 'error');
    }
}

'''

frontend = replace_region(
    frontend,
    'function openPreviewJawabanEvaluasi(studentId) {',
    'function downloadSelectedEvaluasiAnswers() {',
    preview_block,
    'frontend preview review'
)

koreksi_block = r'''async function openKoreksiModal(studentId) {
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const st = appState.students.find(s => String(s.id) === String(studentId));
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!st || !ex) return;

    const key1 = studentId + '_' + examId;
    const key2 = String(studentId) + '_' + String(examId);
    const grades = appState.studentExamGrades || JSON.parse(localStorage.getItem('madrasah_student_exam_grades') || '{}') || {};
    let gradeObj = grades[key1] || grades[key2] || { essayGrades: {} };

    try {
        const review = await fetchEvaluasiReview(st.id, examId);
        const questions = Array.isArray(review.questions) ? review.questions : [];
        if (review.grade) {
            gradeObj = { ...gradeObj, ...review.grade };
            if (!appState.studentExamGrades) appState.studentExamGrades = {};
            appState.studentExamGrades[key1] = gradeObj;
            appState.studentExamGrades[key2] = gradeObj;
        }
        const currentEssayGrades = gradeObj.essayGrades || {};
        const currentEssayExplanations = gradeObj.essayExplanations || {};

        let modalHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
                <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center pb-2 border-b border-slate-100">
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Koreksi Jawaban: ${evaluasiEscapeHtml(st.name)}</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Ujian: ${evaluasiEscapeHtml(ex.title)} • PG benar ${review.correctPGCount || 0}/${review.totalPGCount || 0}</p>
                        </div>
                        <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-slate-400 hover:text-slate-600"></i></button>
                    </div>

                    <div class="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-[10px] text-indigo-800 font-semibold">Status Benar/Salah dan kunci pilihan ganda di bawah dihitung langsung dari paket master authoritative server, sama dengan penilaian final CBT.</div>

                    <form onsubmit="saveKoreksi(event, '${st.id}')" class="space-y-4 text-xs sm:text-sm">
                        <div class="space-y-4">
                            ${questions.map((q, idx) => {
                                const ansVal = q.studentAnswer ?? '';
                                const isEssay = q.type === 'esay' || q.type === 'essay';
                                let qBody = '';

                                if (!isEssay) {
                                    qBody = `
                                        <div class="mt-2 space-y-1.5 pl-4 border-l-2 border-slate-200">
                                            ${(q.options || []).map((opt, oIdx) => {
                                                const state = evaluasiReviewOptionState(q, opt, oIdx);
                                                let bgClass = 'bg-slate-50 border-slate-100';
                                                if (state.selected && state.isKey) bgClass = 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900';
                                                else if (state.selected) bgClass = 'bg-rose-50 border-rose-300 font-bold text-rose-900';
                                                else if (state.isKey) bgClass = 'bg-emerald-50/70 border-emerald-200 text-emerald-800 font-semibold';
                                                return `
                                                    <div class="p-2.5 rounded-xl border flex justify-between items-center gap-2 text-xs ${bgClass}">
                                                        <span><b>${state.letter}.</b> ${evaluasiEscapeHtml(opt)}</span>
                                                        <span class="shrink-0">
                                                            ${state.selected ? `<span class="text-[9px] font-bold uppercase ${q.isCorrect ? 'text-emerald-700' : 'text-rose-700'}">${q.isCorrect ? 'Benar (✓)' : 'Salah (✗)'}</span>` : ''}
                                                            ${state.isKey ? '<span class="ml-2 text-[9px] text-emerald-700 font-black uppercase">Kunci Jawab</span>' : ''}
                                                        </span>
                                                    </div>`;
                                            }).join('')}
                                        </div>`;
                                } else {
                                    const expText = currentEssayExplanations[q.id] || currentEssayExplanations[String(q.id)];
                                    qBody = `
                                        <div class="mt-2 space-y-3 pl-4 border-l-2 border-slate-200">
                                            <div class="p-3 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs">
                                                <p class="font-bold text-amber-800 uppercase tracking-wider text-[9px] mb-1">Jawaban Siswa (Esai):</p>
                                                <p class="leading-relaxed whitespace-pre-wrap">${q.answered ? evaluasiEscapeHtml(ansVal) : '<span class="italic text-slate-400">Tidak menjawab</span>'}</p>
                                            </div>
                                            <div class="p-3 bg-emerald-50/40 border border-emerald-100 rounded-2xl text-xs">
                                                <p class="font-bold text-emerald-800 uppercase tracking-wider text-[9px] mb-1">Kunci Jawaban Guru / Bahan Rujukan:</p>
                                                <p class="leading-relaxed whitespace-pre-wrap">${q.correctAnswer ? evaluasiEscapeHtml(q.correctAnswer) : '-'}</p>
                                            </div>
                                            ${expText ? `
                                            <div class="p-3 bg-purple-50 border border-purple-100 rounded-2xl text-xs space-y-1">
                                                <p class="font-bold text-purple-800 uppercase tracking-wider text-[9px] flex items-center gap-1"><i class="fa-solid fa-wand-magic-sparkles text-purple-600"></i> Penjelasan AI Auto-Koreksi:</p>
                                                <p class="leading-relaxed italic text-slate-700">${evaluasiEscapeHtml(expText)}</p>
                                            </div>` : ''}
                                            <div class="flex items-center space-x-3 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                                                <label class="text-[10px] font-bold text-slate-600 uppercase">Beri Nilai Esai (0-100):</label>
                                                <div class="relative w-24">
                                                    <input type="number" min="0" max="100" name="essay-grade-${q.id}" required value="${(currentEssayGrades[q.id] !== undefined ? currentEssayGrades[q.id] : (currentEssayGrades[String(q.id)] !== undefined ? currentEssayGrades[String(q.id)] : ''))}" class="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs text-center" placeholder="0 - 100">
                                                    <span class="absolute right-3 top-2 text-[10px] font-bold text-slate-400">%</span>
                                                </div>
                                                <span class="text-[10px] text-slate-400">Persentase kontribusi</span>
                                            </div>
                                        </div>`;
                                }

                                return `
                                    <div class="bg-white border border-slate-100 p-4 rounded-2xl space-y-2">
                                        <div class="flex justify-between items-center text-[10px] font-semibold text-slate-400">
                                            <span>PERTANYAAN ${idx + 1}</span>
                                            <span class="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold uppercase tracking-wide text-slate-600">${isEssay ? 'Esai' : 'Pilihan Ganda'}</span>
                                        </div>
                                        <p class="font-bold text-slate-800 text-xs leading-relaxed">${evaluasiEscapeHtml(q.question || '')}</p>
                                        ${qBody}
                                    </div>`;
                            }).join('')}
                        </div>

                        <div class="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                            <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">Batal</button>
                            <button type="submit" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition">
                                <i class="fa-solid fa-cloud-arrow-up"></i><span>Simpan Koreksi Esai</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>`;

        const modal = document.getElementById('modal-container');
        if (modal) {
            modal.innerHTML = modalHTML;
            if (typeof window.renderMathInElementSafely === 'function') window.renderMathInElementSafely(modal);
        }
    } catch (error) {
        console.error('[Open Koreksi Review Error]:', error);
        showToast(`Gagal memuat kunci authoritative: ${error.message || error}`, 'error');
    }
}

'''

frontend = replace_region(
    frontend,
    'function openKoreksiModal(studentId) {',
    'function saveKoreksi(e, studentId) {',
    koreksi_block,
    'frontend manual correction review'
)

frontend_path.write_text(frontend, encoding='utf-8')

print('Authoritative evaluasi review patch applied.')
