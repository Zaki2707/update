var appState = window.appState || {};
// Assessment Module: Exam Schedule, CBT Player with PiP Camera & Countdown, Live Monitoring & Evaluation

function safeSetStorage(key, value) {
    if (typeof window.safeSetLocalStorage === 'function') {
        window.safeSetLocalStorage(key, value);
    } else if (typeof safeSetLocalStorage === 'function') {
        safeSetLocalStorage(key, value);
    } else {
        try {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (e) {
            console.warn('Storage set fallback error for ' + key, e);
        }
    }
}
window.safeSetStorage = safeSetStorage;

let activeExamSession = null;
let examTimerInterval = null;

async function syncExamStateToServer(payload) {
    try {
        await fetch('/api/exam-monitoring-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => null);
    } catch (e) {}
}
window.syncExamStateToServer = syncExamStateToServer;

function shuffleArray(arr) {
    if (!Array.isArray(arr)) return [];
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function prepareQuestionsForStudent(rawQuestions, ex) {
    if (!rawQuestions || !Array.isArray(rawQuestions) || rawQuestions.length === 0) return [];

    const shouldShuffleQ = ex ? (ex.shuffleQ !== false) : true;
    const shouldShuffleOpt = ex ? (ex.shuffleOpt !== false) : true;
    
    let selectedQuestions = [];

    if (ex && ex.type === 'pilihan_dan_esay') {
        const pgQs = rawQuestions.filter(q => q.type !== 'esay' && q.type !== 'essay');
        const essayQs = rawQuestions.filter(q => q.type === 'esay' || q.type === 'essay');

        let targetPgCount = ex && (ex.questionCount || ex.qCount) ? parseInt(ex.questionCount || ex.qCount, 10) : 0;
        if (isNaN(targetPgCount) || targetPgCount <= 0) targetPgCount = pgQs.length;

        let targetEssayCount = ex && ex.essayCount ? parseInt(ex.essayCount, 10) : 0;
        if (isNaN(targetEssayCount) || targetEssayCount <= 0) targetEssayCount = essayQs.length;

        let selectedPg = [];
        if (shouldShuffleQ) {
            selectedPg = shuffleArray(pgQs).slice(0, targetPgCount);
        } else {
            selectedPg = pgQs.slice(0, targetPgCount);
        }

        let selectedEssay = [];
        if (shouldShuffleQ) {
            selectedEssay = shuffleArray(essayQs).slice(0, targetEssayCount);
        } else {
            selectedEssay = essayQs.slice(0, targetEssayCount);
        }

        selectedQuestions = [...selectedPg, ...selectedEssay];
    } else {
        let filteredQuestions = rawQuestions;
        if (ex && ex.type === 'pilihan_ganda') {
            filteredQuestions = rawQuestions.filter(q => q.type !== 'esay' && q.type !== 'essay');
        } else if (ex && ex.type === 'esay_saja') {
            filteredQuestions = rawQuestions.filter(q => q.type === 'esay' || q.type === 'essay');
        }

        let targetCount = ex && (ex.questionCount || ex.qCount) ? parseInt(ex.questionCount || ex.qCount, 10) : 0;
        if (isNaN(targetCount) || targetCount <= 0) {
            targetCount = filteredQuestions.length;
        }

        if (shouldShuffleQ) {
            if (filteredQuestions.length >= targetCount) {
                // Shuffle full pool and pick targetCount
                const shuffledPool = shuffleArray(filteredQuestions);
                selectedQuestions = shuffledPool.slice(0, targetCount);
            } else {
                // Repeat with random selections until reaching targetCount
                while (selectedQuestions.length < targetCount) {
                    const pass = shuffleArray(filteredQuestions);
                    if (pass.length === 0) break; // Prevent infinite loop if no questions available
                    for (let q of pass) {
                        if (selectedQuestions.length < targetCount) {
                            selectedQuestions.push(q);
                        } else break;
                    }
                }
            }
        } else {
            if (filteredQuestions.length >= targetCount) {
                // Sequential first targetCount
                selectedQuestions = filteredQuestions.slice(0, targetCount);
            } else {
                // Sequential repeat until targetCount
                while (selectedQuestions.length < targetCount) {
                    if (filteredQuestions.length === 0) break; // Prevent infinite loop
                    for (let q of filteredQuestions) {
                        if (selectedQuestions.length < targetCount) {
                            selectedQuestions.push(q);
                        } else break;
                    }
                }
            }
        }
    }

    // Now clone each selected question and process options
    const processed = selectedQuestions.map((q, idx) => {
        const cloned = { 
            ...q,
            // Ensure unique ID if repeated
            id: q.id ? (q.id + (selectedQuestions.filter((item, i) => i < idx && item.id === q.id).length > 0 ? '_rep' + idx : '')) : 'Q_' + idx
        };

        if (cloned.options && Array.isArray(cloned.options) && cloned.options.length > 0) {
            if (!cloned.originalOptions) cloned.originalOptions = [...cloned.options];
            
            // Extract correct option text before option shuffling
            let correctText = cloned.correctOptionText || '';
            if (!correctText) {
                const rawKey = String(cloned.answer || '').trim();
                const letterIdx = ['a', 'b', 'c', 'd', 'e'].indexOf(rawKey.toLowerCase().replace('.', ''));
                if (letterIdx !== -1 && cloned.options[letterIdx] !== undefined) {
                    correctText = cloned.options[letterIdx];
                } else if (!isNaN(parseInt(rawKey)) && cloned.options[parseInt(rawKey)] !== undefined) {
                    correctText = cloned.options[parseInt(rawKey)];
                } else {
                    const foundOpt = cloned.options.find(o => String(o).trim().toLowerCase() === rawKey.toLowerCase());
                    correctText = foundOpt !== undefined ? foundOpt : (cloned.options[0] || rawKey);
                }
            }
            cloned.correctOptionText = correctText;

            // Shuffle choices if shuffleOpt is enabled on exam
            if (shouldShuffleOpt) {
                cloned.options = shuffleArray(cloned.options);
            }
        }

        return cloned;
    });

    return processed;
}

function isCorrectAnswer(q, studentAns) {
    if (studentAns === undefined || studentAns === null || String(studentAns).trim() === '') return false;
    if (!q) return false;
    if (q.type === 'esay' || q.type === 'essay') return false;

    const sAns = String(studentAns).trim();
    const rawKey = String(q.answer || '').trim();

    // 1. Direct text match with raw answer key
    if (sAns.toLowerCase() === rawKey.toLowerCase()) return true;

    // 2. Correct option text check
    let correctText = q.correctOptionText || '';
    const opts = q.originalOptions || q.options || [];

    if (!correctText) {
        const letterIdx = ['a', 'b', 'c', 'd', 'e'].indexOf(rawKey.toLowerCase().replace('.', ''));
        if (letterIdx !== -1 && opts[letterIdx] !== undefined) {
            correctText = opts[letterIdx];
        } else if (!isNaN(parseInt(rawKey)) && opts[parseInt(rawKey)] !== undefined) {
            correctText = opts[parseInt(rawKey)];
        } else {
            for (let i = 0; i < opts.length; i++) {
                const optStr = String(opts[i]).trim();
                if (optStr.toLowerCase() === rawKey.toLowerCase()) {
                    correctText = optStr;
                    break;
                }
            }
        }
    }

    if (correctText && String(correctText).trim() !== '') {
        const normCorrectText = String(correctText).trim().toLowerCase();
        
        // If student answer text matches correct text
        if (sAns.toLowerCase() === normCorrectText) return true;

        // If student answer is a letter ('A', 'B', 'C', 'D') pointing to current q.options
        const currOpts = q.options || [];
        const sLetterIdx = ['a', 'b', 'c', 'd', 'e'].indexOf(sAns.toLowerCase().replace('.', ''));
        if (sLetterIdx !== -1 && currOpts[sLetterIdx] !== undefined) {
            if (String(currOpts[sLetterIdx]).trim().toLowerCase() === normCorrectText) {
                return true;
            }
        }
    }

    // 3. Single letter match fallback if no option text could be resolved
    const sLetter = sAns.toLowerCase().replace('.', '');
    const keyLetter = rawKey.toLowerCase().replace('.', '');
    if (sLetter.length === 1 && sLetter === keyLetter && ['a','b','c','d','e'].includes(sLetter)) {
        return true;
    }

    return false;
}

function isOptionAnswerKey(q, opt) {
    if (!q || !opt) return false;
    const normOpt = String(opt).trim().toLowerCase();
    
    // 1. Check if q.correctOptionText matches opt
    if (q.correctOptionText && String(q.correctOptionText).trim().toLowerCase() === normOpt) return true;
    
    // 2. Check if q.answer matches opt
    const rawKey = String(q.answer || '').trim().toLowerCase();
    if (rawKey === normOpt) return true;
    
    // 3. Check if q.answer is letter 'a', 'b', 'c', 'd' and opt is at that index in originalOptions or options
    const opts = q.originalOptions || q.options || [];
    const letterIdx = ['a', 'b', 'c', 'd', 'e'].indexOf(rawKey.replace('.', ''));
    if (letterIdx !== -1 && opts[letterIdx] !== undefined) {
        if (String(opts[letterIdx]).trim().toLowerCase() === normOpt) return true;
    }
    
    return false;
}

function getExamQuestions(ex, studentId = null) {
    if (!ex) return appState.questionBank || [];

    // 1. If studentId is provided, check if we have saved exact exam questions for this student & exam
    if (studentId) {
        if (!appState.studentExamQuestions) {
            appState.studentExamQuestions = JSON.parse(localStorage.getItem('madrasah_student_exam_questions')) || {};
        }
        const key1 = studentId + '_' + ex.id;
        const key2 = String(studentId) + '_' + String(ex.id);
        const savedQs = appState.studentExamQuestions[key1] || appState.studentExamQuestions[key2];
        if (savedQs && Array.isArray(savedQs) && savedQs.length > 0) {
            return savedQs;
        }
    }

    // 2. Otherwise filter from questionBank by bankCode or subject
    const exCode = String(ex.bankCode || '').trim().toLowerCase();
    const exSub = String(ex.subject || '').trim().toLowerCase();

    // Check matching group from questionBankGroups
    const matchingGroups = (appState.questionBankGroups || []).filter(bg => {
        const bgCode = String(bg.code || '').trim().toLowerCase();
        return bgCode && exCode && bgCode === exCode;
    });
    const matchingGroupSubjectIds = matchingGroups.map(bg => String(bg.subjectId).toLowerCase());

    const matchingSubjectObjs = (appState.subjects || []).filter(s => {
        const sName = String(s.name || '').trim().toLowerCase();
        return sName && exSub && sName === exSub;
    });
    const matchingSubjectIds = matchingSubjectObjs.map(s => String(s.id).toLowerCase());

    let questions = (appState.questionBank || []).filter(q => {
        if (!q) return false;
        const qCode = String(q.code || q.bankCode || q.groupCode || '').trim().toLowerCase();
        const qSub = String(q.subjectId || q.subject || '').trim().toLowerCase();
        
        if (exCode && exCode !== 'undefined' && exCode !== '') {
            return qCode === exCode;
        } else if (exSub && exSub !== 'undefined' && exSub !== '') {
            return qSub === exSub || matchingSubjectIds.includes(qSub) || matchingGroupSubjectIds.includes(qSub);
        }
        return false;
    });

    // 3. No fallback questions on client-side to ensure secure server-side questions retrieval only
    if (questions.length === 0) {
        questions = [];
    }

    if (studentId) {
        questions = prepareQuestionsForStudent(questions, ex);
        const key1 = studentId + '_' + ex.id;
        const key2 = String(studentId) + '_' + String(ex.id);
        if (!appState.studentExamQuestions) appState.studentExamQuestions = {};
        appState.studentExamQuestions[key1] = questions;
        appState.studentExamQuestions[key2] = questions;
        
        // Prune older cached question keys if too large
        const qKeys = Object.keys(appState.studentExamQuestions);
        if (qKeys.length > 25) {
            qKeys.slice(0, qKeys.length - 15).forEach(k => delete appState.studentExamQuestions[k]);
        }
        safeSetStorage('madrasah_student_exam_questions', appState.studentExamQuestions);
        syncExamStateToServer({ studentQuestions: { [key1]: questions, [key2]: questions } });
        return questions;
    }

    // Apply PG and Essay count logic
    if (ex.type === 'pilihan_dan_esay') {
        const pgQs = questions.filter(q => q.type !== 'esay' && q.type !== 'essay');
        const essayQs = questions.filter(q => q.type === 'esay' || q.type === 'essay');

        const targetPgCount = ex && (ex.questionCount || ex.qCount) ? parseInt(ex.questionCount || ex.qCount, 10) : 0;
        const targetEssayCount = ex && ex.essayCount ? parseInt(ex.essayCount, 10) : 0;

        let selectedPg = [];
        if (targetPgCount > 0) {
            if (pgQs.length >= targetPgCount) {
                selectedPg = pgQs.slice(0, targetPgCount);
            } else {
                selectedPg = [...pgQs];
                if (pgQs.length > 0) {
                    while (selectedPg.length < targetPgCount) {
                        for (let q of pgQs) {
                            if (selectedPg.length < targetPgCount) {
                                selectedPg.push(q);
                            } else break;
                        }
                    }
                }
            }
        } else {
            selectedPg = [...pgQs];
        }

        let selectedEssay = [];
        if (targetEssayCount > 0) {
            if (essayQs.length >= targetEssayCount) {
                selectedEssay = essayQs.slice(0, targetEssayCount);
            } else {
                selectedEssay = [...essayQs];
                if (essayQs.length > 0) {
                    while (selectedEssay.length < targetEssayCount) {
                        for (let q of essayQs) {
                            if (selectedEssay.length < targetEssayCount) {
                                selectedEssay.push(q);
                            } else break;
                        }
                    }
                }
            }
        } else {
            selectedEssay = [...essayQs];
        }

        return [...selectedPg, ...selectedEssay];
    }

    let filteredQuestions = questions;
    if (ex.type === 'pilihan_ganda') {
        filteredQuestions = questions.filter(q => q.type !== 'esay' && q.type !== 'essay');
    } else if (ex.type === 'esay_saja') {
        filteredQuestions = questions.filter(q => q.type === 'esay' || q.type === 'essay');
    }

    let targetCount = ex && (ex.questionCount || ex.qCount) ? parseInt(ex.questionCount || ex.qCount, 10) : 0;
    if (isNaN(targetCount) || targetCount <= 0) {
        return filteredQuestions;
    }

    let generalQuestions = [];
    if (filteredQuestions.length >= targetCount) {
        generalQuestions = filteredQuestions.slice(0, targetCount);
    } else {
        if (filteredQuestions.length > 0) {
            while (generalQuestions.length < targetCount) {
                for (let q of filteredQuestions) {
                    if (generalQuestions.length < targetCount) {
                        generalQuestions.push(q);
                    } else break;
                }
            }
        }
    }
    return generalQuestions;
}

function stopEvaluasiPolling() {
    if (window.__evaluasiPollInterval) {
        clearInterval(window.__evaluasiPollInterval);
        window.__evaluasiPollInterval = null;
    }
}

function startEvaluasiPolling() {
    if (window.__evaluasiPollInterval) return;
    window.__evaluasiPollInterval = setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        if (appState.lastAssessmentSubTab !== 'evaluasi') {
            stopEvaluasiPolling();
            return;
        }
        try {
            const res = await fetch('/api/exam-monitoring-state');
            const data = await res.json();
            if (data && data.success) {
                let hasChanges = false;
                if (data.activeExamSessions) {
                    appState.activeExamSessions = data.activeExamSessions;
                    safeSetStorage('madrasah_active_exam_sessions', data.activeExamSessions);
                    hasChanges = true;
                }
                if (data.completedExams && (Object.keys(data.completedExams).length > 0 || !appState.completedExams || Object.keys(appState.completedExams).length === 0)) {
                    appState.completedExams = data.completedExams;
                    safeSetStorage('madrasah_completed_exams', data.completedExams);
                    hasChanges = true;
                }
                if (data.forceFinishedExams) {
                    appState.forceFinishedExams = data.forceFinishedExams;
                    safeSetStorage('madrasah_force_finished_exams', data.forceFinishedExams);
                    hasChanges = true;
                }
                if (data.studentExamGrades && (Object.keys(data.studentExamGrades).length > 0 || !appState.studentExamGrades || Object.keys(appState.studentExamGrades).length === 0)) {
                    appState.studentExamGrades = data.studentExamGrades;
                    safeSetStorage('madrasah_student_exam_grades', data.studentExamGrades);
                    hasChanges = true;
                }
                if (data.studentExamAnswers && (Object.keys(data.studentExamAnswers).length > 0 || !appState.studentExamAnswers || Object.keys(appState.studentExamAnswers).length === 0)) {
                    appState.studentExamAnswers = data.studentExamAnswers;
                    safeSetStorage('madrasah_student_exam_answers', data.studentExamAnswers);
                    hasChanges = true;
                }

                const isModalOpen = document.querySelector('.modal-open, #koreksi-modal, #modal-container:not(.hidden)');
                const isInputActive = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
                if (!isModalOpen && !isInputActive && hasChanges) {
                    const containerEl = document.getElementById('view-container');
                    if (containerEl && appState.lastAssessmentSubTab === 'evaluasi') {
                        renderAssessmentModule(containerEl, 'evaluasi', appState.evaluasiSelectedExamId);
                    }
                }
            }
        } catch (e) {}
    }, 10000);
}

function renderAssessmentModule(container, activeSubTab = 'jadwal', examId = null) {
    appState.lastAssessmentSubTab = activeSubTab;
    if (activeSubTab === 'monitoring') {
        appState.activeMonitoringExamId = examId;
        stopEvaluasiPolling();
    } else if (activeSubTab === 'evaluasi') {
        if (examId) appState.evaluasiSelectedExamId = examId;
        appState.activeEvaluationExamId = examId;
        const validExams = (appState.exams || []).filter(e => e.recordType !== 'EVENT');
        const foundSelected = validExams.find(e => String(e.id) === String(appState.evaluasiSelectedExamId));
        if (!foundSelected && validExams.length > 0) {
            appState.evaluasiSelectedExamId = validExams[0].id;
        }
        if (appState.evaluasiSelectedExamId && !appState.evaluasiSelectedClassId) {
            const foundEx = (appState.exams || []).find(e => String(e.id) === String(appState.evaluasiSelectedExamId));
            if (foundEx && Array.isArray(foundEx.classes) && foundEx.classes.length > 0 && foundEx.classes[0] !== 'ALL') {
                appState.evaluasiSelectedClassId = foundEx.classes[0];
            } else if (appState.classes && appState.classes.length > 0) {
                appState.evaluasiSelectedClassId = appState.classes[0].id;
            }
        }
        startEvaluasiPolling();
    } else {
        stopEvaluasiPolling();
    }

    const currentTab = activeSubTab;
    const isTeacher = appState.role === 'teacher';

    const getTeacherAllowedExamSubjects = () => {
        if (!isTeacher) return null;
        const currentTeacher = appState.currentUser;
        if (!currentTeacher) return [];
        const mapels = Array.isArray(currentTeacher.mapel) 
            ? currentTeacher.mapel 
            : (currentTeacher.mapel ? [currentTeacher.mapel] : []);
        
        if (appState.teachers) {
            const found = appState.teachers.find(t => String(t.id) === String(currentTeacher.id));
            if (found && Array.isArray(found.mapel)) {
                found.mapel.forEach(m => {
                    if (!mapels.includes(m)) mapels.push(m);
                });
            }
        }
        return mapels.map(m => String(m).toLowerCase().trim());
    };

    const allowedMapels = getTeacherAllowedExamSubjects();
    const displayExams = [...(appState.exams || [])]
        .filter(e => {
            if (!allowedMapels) return true;
            return e && e.subject && allowedMapels.includes(String(e.subject).toLowerCase().trim());
        })
        .sort((a, b) => {
            const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (tA && tB && tA !== tB) return tB - tA;
            return (appState.exams.indexOf(b) - appState.exams.indexOf(a));
        });

    const activeExam = displayExams.find(e => e.id === appState.activeMonitoringExamId);
    const activeEvalExam = displayExams.find(e => e.id === appState.activeEvaluationExamId);

    const currentTokens = (typeof window.getActiveMadrasahTokenBalance === 'function')
        ? window.getActiveMadrasahTokenBalance()
        : ((appState.currentUser && appState.currentUser.cbtTokenBalance) || 0);

    container.innerHTML = `
        <div class="space-y-6 pb-8">
            ${!isTeacher ? `
                <div class="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-amber-600/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl font-black text-amber-100 shadow-inner">
                            <i class="fa-solid fa-coins"></i>
                        </div>
                        <div>
                            <span class="text-xs uppercase font-extrabold tracking-wider text-amber-200 block">Saldo Token Ujian CBT Madrasah</span>
                            <div class="flex items-baseline gap-2 mt-0.5">
                                <span id="token-balance-display-card" class="text-2xl sm:text-3xl font-black text-white">${currentTokens} Token</span>
                                <span class="text-xs text-amber-100/90 font-medium">tersedia untuk pembuatan jadwal ujian</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 w-full sm:w-auto">
                        <button type="button" onclick="if (typeof openTopUpTokenModal === 'function') openTopUpTokenModal();" class="w-full sm:w-auto px-5 py-3 bg-white hover:bg-amber-50 text-amber-900 font-extrabold text-xs rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-cart-plus text-amber-700"></i> <span>Beli / Top-Up Token</span>
                        </button>
                    </div>
                </div>
            ` : `
                <div class="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-amber-700/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl font-black text-amber-100 shadow-inner">
                            <i class="fa-solid fa-coins"></i>
                        </div>
                        <div>
                            <span class="text-xs uppercase font-extrabold tracking-wider text-amber-200 block">Saldo Token Ujian Guru (${(appState.currentUser && appState.currentUser.name) || 'Akun Guru'})</span>
                            <div class="flex items-baseline gap-2 mt-0.5">
                                <span id="token-balance-display-card" class="text-2xl sm:text-3xl font-black text-white">${currentTokens} Token</span>
                                <span class="text-xs text-amber-100/90 font-medium">tersedia untuk live video monitoring ujian</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 w-full sm:w-auto">
                        <button type="button" onclick="if (typeof openTopUpTokenModal === 'function') openTopUpTokenModal();" class="w-full sm:w-auto px-5 py-3 bg-white hover:bg-amber-50 text-amber-900 font-extrabold text-xs rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-cart-plus text-amber-700"></i> <span>Top-Up Token Guru</span>
                        </button>
                    </div>
                </div>
            `}

            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div><h1 class="text-xl sm:text-2xl font-bold text-slate-800">Asesmen & CBT Madrasah</h1><p class="text-xs text-slate-400">Jadwal Ujian, Live Monitoring, dan Evaluasi Hasil</p></div>
                <div class="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button type="button" onclick="appState.activeMonitoringExamId = null; appState.activeEvaluationExamId = null; renderAssessmentModule(document.getElementById('view-container'), 'jadwal', null)" class="px-4 py-2.5 rounded-2xl text-xs font-semibold ${currentTab === 'jadwal' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700'}">Jadwal Ujian</button>
                    <button type="button" id="btn-cbt-lkpd" onclick="appState.activeMonitoringExamId = null; appState.activeEvaluationExamId = null; renderAssessmentModule(document.getElementById('view-container'), 'lkpd', null);" class="px-4 py-2.5 rounded-2xl text-xs font-semibold ${currentTab === 'lkpd' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700'} flex items-center gap-1.5 cursor-pointer" title="Lembar Kerja Peserta Didik (LKPD)">
                        <i class="fa-solid fa-file-pen text-amber-500"></i>
                        <span>LKPD</span>
                    </button>
                    ${!isTeacher ? `<button type="button" onclick="appState.activeMonitoringExamId = null; appState.activeEvaluationExamId = null; renderAssessmentModule(document.getElementById('view-container'), 'ruang', null)" class="px-4 py-2.5 rounded-2xl text-xs font-semibold ${currentTab === 'ruang' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700'}">Ruang Ujian</button>` : ''}
                    ${!isTeacher ? `<button type="button" onclick="appState.activeMonitoringExamId = null; appState.activeEvaluationExamId = null; renderAssessmentModule(document.getElementById('view-container'), 'kartu_peserta', null)" class="px-4 py-2.5 rounded-2xl text-xs font-semibold ${currentTab === 'kartu_peserta' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700'}">Generate Nomor Peserta</button>` : ''}
                    <button type="button" onclick="appState.activeEvaluationExamId = null; renderAssessmentModule(document.getElementById('view-container'), 'monitoring', null)" class="px-4 py-2.5 rounded-2xl text-xs font-semibold ${currentTab === 'monitoring' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700'} flex items-center gap-1.5 relative">
                        <span>Monitoring</span>
                        ${Object.keys(appState.activeExamSessions || {}).length > 0 ? `
                            <span class="inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[9px] font-black rounded-full shadow-sm animate-pulse">
                                ${Object.keys(appState.activeExamSessions || {}).length}
                            </span>
                        ` : ''}
                    </button>
                    <button type="button" onclick="appState.activeMonitoringExamId = null; renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', appState.evaluasiSelectedExamId || null)" class="px-4 py-2.5 rounded-2xl text-xs font-semibold ${currentTab === 'evaluasi' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-700'}">Evaluasi</button>
                </div>
            </div>
 
            ${currentTab === 'lkpd' ? `
                <div id="lkpd-tab-wrapper" class="w-full"></div>
            ` : currentTab === 'jadwal' ? (() => {
                const isViewingEvent = !!appState.assessmentEventId;
                
                if (!isViewingEvent) {
                    const eventExams = displayExams.filter(e => e.recordType === 'EVENT');
                    return `
                    <div class="space-y-6">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
                            <div>
                                <h3 class="font-bold text-slate-800 text-lg">Daftar & Konfigurasi Jadwal Ujian (Event)</h3>
                                <p class="text-xs text-slate-400">Jadwal dikelompokkan ke dalam event (seperti Event Harian, UTS, UAS)</p>
                            </div>
                            ${!isTeacher ? `
                                <div class="flex items-center gap-2.5 flex-wrap">
                                    <button type="button" onclick="openEventModal()" class="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold rounded-2xl text-xs shadow transition flex items-center space-x-2 cursor-pointer">
                                        <i class="fa-solid fa-folder-plus"></i><span>Buat Event</span>
                                    </button>
                                    <button type="button" onclick="openExamModal()" class="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold rounded-2xl text-xs shadow flex items-center space-x-2 transition cursor-pointer">
                                        <i class="fa-solid fa-plus"></i><span>Buat Jadwal</span>
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${eventExams.map(ev => {
                                const evJadwals = displayExams.filter(ex => ex.eventId === ev.id && ex.recordType !== 'EVENT');
                                const isHarian = ev.id === 'EV_HARIAN' || String(ev.title || '').toLowerCase().includes('harian');
                                return `
                                <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-indigo-200 transition space-y-4 flex flex-col justify-between">
                                    <div class="space-y-3">
                                        <div class="flex justify-between items-start">
                                            <div class="flex items-center gap-3">
                                                <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                                    <i class="fa-solid fa-calendar-check"></i>
                                                </div>
                                                <div>
                                                    <h4 class="font-bold text-slate-800 text-base flex items-center gap-2">
                                                        ${ev.title}
                                                        ${isHarian ? '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Default Harian</span>' : ''}
                                                    </h4>
                                                    <p class="text-xs text-slate-400 mt-0.5 line-clamp-1">${ev.description || 'Kelompok jadwal ujian'}</p>
                                                </div>
                                            </div>
                                            ${!isTeacher ? `
                                            <div class="flex items-center space-x-2">
                                                <button type="button" onclick="openEventModal('${ev.id}')" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition" title="Edit Event"><i class="fa-solid fa-pen"></i></button>
                                                ${!isHarian ? `<button type="button" onclick="deleteExam('${ev.id}')" class="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition" title="Hapus Event"><i class="fa-solid fa-trash"></i></button>` : ''}
                                            </div>
                                            ` : ''}
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                                <i class="fa-solid fa-clipboard-list"></i> ${evJadwals.length} Jadwal Ujian
                                            </span>
                                        </div>
                                    </div>
                                    <div class="pt-2 flex gap-2">
                                        <button type="button" onclick="openEventManagement('${ev.id}')" class="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-2xl text-xs shadow transition flex items-center justify-center space-x-2">
                                            <i class="fa-solid fa-layer-group"></i><span>Kelola Jadwal (${evJadwals.length})</span>
                                        </button>
                                        ${!isTeacher ? `
                                        <button type="button" onclick="openExamModal(null, '${ev.id}')" class="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-2xl text-xs border border-emerald-200 transition flex items-center space-x-1.5" title="Tambah Jadwal ke Event Ini">
                                            <i class="fa-solid fa-plus"></i><span>Tambah Jadwal</span>
                                        </button>
                                        ` : ''}
                                    </div>
                                </div>
                                `;
                            }).join('')}
                            ${eventExams.length === 0 ? `
                                <div class="col-span-full bg-white p-12 rounded-3xl text-center border text-slate-400">
                                    <i class="fa-solid fa-calendar-star text-3xl mb-2"></i>
                                    <p>Belum ada event ujian yang dibuat.</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    `;
                } else {
                    const currentEvent = displayExams.find(e => e.id === appState.assessmentEventId);
                    const eventExamsList = displayExams.filter(ex => ex.eventId === appState.assessmentEventId && ex.recordType !== 'EVENT');
                    
                    return `
                    <div class="space-y-6">
                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
                            <div>
                                <h3 class="font-bold text-slate-800">Daftar Jadwal Ujian: ${currentEvent ? currentEvent.title : 'Event Tidak Ditemukan'}</h3>
                                <p class="text-xs text-slate-400">Atur parameter lengkap ujian</p>
                            </div>
                            <div class="flex gap-2">
                                <button type="button" onclick="appState.assessmentEventId = null; renderAssessmentModule(document.getElementById('view-container'), 'jadwal', null);" class="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-2xl text-xs transition flex items-center space-x-2"><i class="fa-solid fa-arrow-left"></i><span>Kembali ke Event</span></button>
                                ${!isTeacher ? `<button type="button" onclick="openExamModal(null, '${appState.assessmentEventId}')" class="px-5 py-3 bg-emerald-600 text-white font-semibold rounded-2xl text-xs shadow flex items-center space-x-2"><i class="fa-solid fa-plus"></i><span>Buat Jadwal</span></button>` : ''}
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${eventExamsList.map(ex => `
                                <div class="bg-white p-6 rounded-3xl shadow-sm border space-y-3">
                                    <div class="flex justify-between items-start">
                                        <h4 class="font-bold text-slate-800 text-base">${ex.title}</h4>
                                        ${!isTeacher ? `<div class="flex items-center space-x-3">
                                            <button type="button" onclick="openExamModal('${ex.id}', '${ex.eventId}')" class="text-slate-400 hover:text-emerald-500 transition" title="Edit Jadwal"><i class="fa-solid fa-pen"></i></button>
                                            <button type="button" onclick="deleteExam('${ex.id}')" class="text-rose-400 hover:text-rose-600 transition" title="Hapus Jadwal"><i class="fa-solid fa-trash"></i></button>
                                        </div>` : ''}
                                    </div>
                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl">
                                        <div><span class="text-slate-400">Mapel:</span> <b class="block truncate">${ex.subject}</b></div>
                                        <div><span class="text-slate-400">Bank Soal:</span> <b class="block font-mono font-bold">${ex.bankCode}</b></div>
                                        <div><span class="text-slate-400">Tanggal & Jam:</span> <b class="block">${ex.date} (${ex.startTime || '07:30'})</b></div>
                                        <div><span class="text-slate-400">Durasi:</span> <b class="block">${ex.duration} Mins</b></div>
                                        <div><span class="text-slate-400">Jml Soal:</span> <b class="block text-emerald-600 font-bold">${ex.questionCount || ex.qCount ? (ex.questionCount || ex.qCount) + ' Soal' : getExamQuestions(ex).length + ' Soal'}</b></div>
                                        <div><span class="text-slate-400">Status Schedule:</span> <b class="block">${(() => {
                                            const sInfo = getExamScheduleInfo(ex);
                                            if (sInfo.status === 'not_started') return '<span class="text-sky-600 font-bold">Belum Dimulai</span>';
                                            if (sInfo.status === 'expired') return '<span class="text-rose-600 font-bold">Jadwal Berakhir</span>';
                                            return '<span class="text-emerald-600 font-bold">Ujian Aktif</span>';
                                        })()}</b></div>
                                    </div>
                                </div>
                            `).join('')}
                            ${eventExamsList.length === 0 ? `
                                <div class="col-span-full bg-white p-12 rounded-3xl text-center border text-slate-400">
                                    <i class="fa-solid fa-clipboard-list text-3xl mb-2"></i>
                                    <p>Belum ada jadwal ujian di dalam event ini.</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    `;
                }
            })() : currentTab === 'ruang' ? `
                <div class="space-y-6">
                    <div class="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <div><h3 class="font-bold text-slate-800">Daftar Ruang Ujian</h3><p class="text-xs text-slate-400">Atur ruangan dan anggota peserta ujian</p></div>
                        <button type="button" onclick="openRoomModal()" class="px-5 py-3 bg-emerald-600 text-white font-semibold rounded-2xl text-xs shadow flex items-center space-x-2"><i class="fa-solid fa-plus"></i><span>Tambah Ruang</span></button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${(appState.rooms || []).map(room => `
                            <div class="bg-white p-6 rounded-3xl shadow-sm border space-y-4">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h4 class="font-bold text-slate-800 text-base">${room.name}</h4>
                                        <p class="text-xs text-slate-400 mt-1">${(room.members || []).length} Anggota Peserta</p>
                                    </div>
                                    <button type="button" onclick="deleteRoom('${room.id}')" class="text-rose-400 hover:text-rose-600"><i class="fa-solid fa-trash"></i></button>
                                </div>
                                <div class="pt-2 flex gap-2">
                                    <button type="button" onclick="openManageRoomModal('${room.id}')" class="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-2xl text-xs shadow flex items-center justify-center space-x-2 transition">
                                        <i class="fa-solid fa-users-gear"></i><span>Kelola Ruang & Anggota</span>
                                    </button>
                                    <button type="button" onclick="openAttendanceModal('${room.id}')" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl text-xs shadow flex items-center justify-center space-x-2 transition">
                                        <i class="fa-solid fa-file-word"></i><span>Cetak Daftar Hadir</span>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        ${(!appState.rooms || appState.rooms.length === 0) ? `
                            <div class="col-span-full bg-white p-12 rounded-3xl text-center border text-slate-400">
                                <i class="fa-solid fa-door-closed text-3xl mb-2"></i>
                                <p>Belum ada ruang ujian yang dibuat.</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : currentTab === 'kartu_peserta' ? (() => {
                initKartuPesertaConfigIfNeeded();
                
                const classes = appState.classes || [];
                const rooms = appState.rooms || [];
                const students = appState.students || [];
                
                let filtered = [...students];
                if (window.kartuPesertaConfig.selectedClassIds && window.kartuPesertaConfig.selectedClassIds.length > 0) {
                    filtered = filtered.filter(s => window.kartuPesertaConfig.selectedClassIds.includes(String(s.classId || s.class_id)));
                } else if (window.kartuPesertaConfig.filterClassId) {
                    filtered = filtered.filter(s => String(s.classId || s.class_id) === String(window.kartuPesertaConfig.filterClassId));
                }
                if (window.kartuPesertaConfig.filterRoomId) {
                    const selectedRoom = rooms.find(r => String(r.id) === String(window.kartuPesertaConfig.filterRoomId));
                    if (selectedRoom) {
                        filtered = filtered.filter(s => (selectedRoom.members || []).some(mId => String(mId) === String(s.id)));
                    }
                }
                
                const logoKiriSrc = getLogoKiri();
                const logoKananSrc = getLogoKanan();
                const stampSvg = getStempelSvg(window.kartuPesertaConfig.kop3);
                const ttdHtml = getTtdHtml();
                
                const previewLimit = 4;
                const previewStudents = filtered.slice(0, previewLimit);
                
                return `
                <div class="space-y-6">
                    <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 class="font-extrabold text-lg text-slate-800">Generate & Download PDF Kartu Peserta Ujian</h3>
                            <p class="text-xs text-slate-400 mt-0.5">Konfigurasi Kop, Logo, Stempel, TTD, dan Download Kartu Peserta dalam Format PDF (Pilih 'Save as PDF' saat dialog cetak muncul)</p>
                        </div>
                        <button type="button" onclick="cetakKartuUjian()" class="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow flex items-center space-x-2 transition duration-150 cursor-pointer">
                            <i class="fa-solid fa-file-pdf"></i><span>Download PDF (${filtered.length} Kartu)</span>
                        </button>
                    </div>
                    
                    <div class="flex flex-col lg:flex-row gap-6">
                        <!-- Left Column: Form Settings -->
                        <div class="w-full lg:w-[350px] shrink-0 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
                            <div class="flex items-center justify-between border-b pb-2">
                                <h4 class="font-bold text-slate-800 text-sm">Pengaturan Kartu</h4>
                            </div>
                            
                            <!-- Tab Header Buttons -->
                            <div class="flex bg-slate-100 p-1 rounded-xl gap-1">
                                <button type="button" onclick="window.kartuPesertaActiveTab = 'konten'; renderAssessmentModule(document.getElementById('view-container'), 'kartu_peserta');" 
                                    class="flex-1 text-[10px] font-bold py-1.5 px-1 rounded-lg transition-all duration-150 cursor-pointer ${window.kartuPesertaActiveTab === 'konten' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
                                    Konten
                                </button>
                                <button type="button" onclick="window.kartuPesertaActiveTab = 'media'; renderAssessmentModule(document.getElementById('view-container'), 'kartu_peserta');" 
                                    class="flex-1 text-[10px] font-bold py-1.5 px-1 rounded-lg transition-all duration-150 cursor-pointer ${window.kartuPesertaActiveTab === 'media' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
                                    Logo/TTD
                                </button>
                                <button type="button" onclick="window.kartuPesertaActiveTab = 'ukuran'; renderAssessmentModule(document.getElementById('view-container'), 'kartu_peserta');" 
                                    class="flex-1 text-[10px] font-bold py-1.5 px-1 rounded-lg transition-all duration-150 cursor-pointer ${window.kartuPesertaActiveTab === 'ukuran' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
                                    Atur Ukuran
                                </button>
                            </div>

                            <!-- Tab 1: Konten -->
                            ${window.kartuPesertaActiveTab === 'konten' ? `
                            <div class="space-y-4">
                                <!-- Filters -->
                                <div class="space-y-3">
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tambah Kelas</label>
                                        <select id="kartu-class-filter" onchange="addClassToPrint(this.value); this.value = '';" class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                            <option value="" selected disabled>+ Tambah Kelas...</option>
                                            ${classes.filter(c => !(window.kartuPesertaConfig.selectedClassIds || []).includes(String(c.id))).map(c => `
                                                <option value="${c.id}">${c.name}</option>
                                            `).join('')}
                                        </select>
                                        
                                        <!-- Selected Classes Badges -->
                                        <div class="flex flex-wrap gap-1.5 mt-2">
                                            ${(window.kartuPesertaConfig.selectedClassIds || []).map(id => {
                                                const c = classes.find(cls => String(cls.id) === String(id));
                                                if (!c) return '';
                                                return `
                                                    <span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold border border-emerald-100">
                                                        <span>${c.name}</span>
                                                        <button type="button" onclick="removeClassFromPrint('${c.id}')" class="hover:text-emerald-900 focus:outline-none font-bold cursor-pointer">
                                                            <i class="fa-solid fa-xmark text-[9px]"></i>
                                                        </button>
                                                    </span>
                                                `;
                                            }).join('') || `
                                                <span class="text-[10px] text-slate-400 italic">Semua kelas terpilih. Silakan tambah kelas untuk mencetak per kelas.</span>
                                            `}
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Filter Ruang Ujian</label>
                                        <select id="kartu-room-filter" onchange="updateKartuConfig('filterRoomId', this.value)" class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                            <option value="">Semua Ruang</option>
                                            ${rooms.map(r => `<option value="${r.id}" ${window.kartuPesertaConfig.filterRoomId === String(r.id) ? 'selected' : ''}>${r.name}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                                
                                <hr class="border-slate-100">
                                
                                <!-- Header Config -->
                                <div class="space-y-3">
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Kop Baris 1 (Yayasan)</label>
                                        <input type="text" id="cfg-kop1" value="${window.kartuPesertaConfig.kop1}" oninput="updateKartuConfig('kop1', this.value)" class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Kop Baris 2 (Nama Sekolah)</label>
                                        <input type="text" id="cfg-kop2" value="${window.kartuPesertaConfig.kop2}" oninput="updateKartuConfig('kop2', this.value)" class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Kop Baris 3 (Nama Madrasah)</label>
                                        <input type="text" id="cfg-kop3" value="${window.kartuPesertaConfig.kop3}" oninput="updateKartuConfig('kop3', this.value)" class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Alamat Sekolah</label>
                                        <textarea id="cfg-alamat" oninput="updateKartuConfig('alamat', this.value)" rows="2" class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none">${window.kartuPesertaConfig.alamat}</textarea>
                                    </div>
                                </div>
                                
                                <hr class="border-slate-100">
                                
                                <!-- Signatures Config -->
                                <div class="space-y-3">
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Judul Kartu Peserta</label>
                                        <input type="text" id="cfg-titleText" value="${window.kartuPesertaConfig.titleText || 'KARTU PESERTA'}" oninput="updateKartuConfig('titleText', this.value)" class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tanggal & Tempat Kartu</label>
                                        <input type="text" id="cfg-tanggalUjian" value="${window.kartuPesertaConfig.tanggalUjian}" oninput="updateKartuConfig('tanggalUjian', this.value)" class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nama Kepala Sekolah</label>
                                        <input type="text" id="cfg-kepalaSekolah" value="${window.kartuPesertaConfig.kepalaSekolah}" oninput="updateKartuConfig('kepalaSekolah', this.value)" class="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                    </div>
                                    <div class="pt-1">
                                        <label class="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500 mb-1 cursor-pointer select-none">
                                            <input type="checkbox" id="cfg-showPassword" 
                                                ${window.kartuPesertaConfig.showPassword !== false ? 'checked' : ''} 
                                                onchange="updateKartuConfig('showPassword', this.checked)" 
                                                class="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5">
                                            <span>Tampilkan Password Siswa</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            ` : ''}

                            <!-- Tab 2: Media/Upload -->
                            ${window.kartuPesertaActiveTab === 'media' ? `
                            <div class="space-y-4">
                                <div class="space-y-3">
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1 flex justify-between">
                                            <span>Logo Kiri (Yayasan)</span>
                                            ${window.kartuPesertaConfig.logoKiri ? `<button onclick="updateKartuConfig('logoKiri', '')" class="text-rose-500 text-[9px] font-semibold underline">Reset</button>` : ''}
                                        </label>
                                        <input type="file" accept="image/*" onchange="handleKartuImageUpload(event, 'logoKiri')" class="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1 flex justify-between">
                                            <span>Logo Kanan (Madrasah)</span>
                                            ${window.kartuPesertaConfig.logoKanan ? `<button onclick="updateKartuConfig('logoKanan', '')" class="text-rose-500 text-[9px] font-semibold underline">Reset</button>` : ''}
                                        </label>
                                        <input type="file" accept="image/*" onchange="handleKartuImageUpload(event, 'logoKanan')" class="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1 flex justify-between">
                                            <span>Stempel Sekolah (Unggah)</span>
                                            ${window.kartuPesertaConfig.stempel ? `<button onclick="updateKartuConfig('stempel', '')" class="text-rose-500 text-[9px] font-semibold underline">Reset</button>` : ''}
                                        </label>
                                        <input type="file" accept="image/*" onchange="handleKartuImageUpload(event, 'stempel')" class="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1 flex justify-between">
                                            <span>Tanda Tangan (Unggah)</span>
                                            ${window.kartuPesertaConfig.ttd ? `<button onclick="updateKartuConfig('ttd', '')" class="text-rose-500 text-[9px] font-semibold underline">Reset</button>` : ''}
                                        </label>
                                        <input type="file" accept="image/*" onchange="handleKartuImageUpload(event, 'ttd')" class="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer">
                                    </div>
                                </div>
                            </div>
                            ` : ''}

                            <!-- Tab 3: Ukuran & Posisi -->
                            ${window.kartuPesertaActiveTab === 'ukuran' ? `
                            <div class="space-y-4">
                                <div class="space-y-3.5">
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Lebar Kartu (Seret Pinggir / Geser)</span>
                                            <span id="cfg-cardWidth-val" class="text-emerald-600 font-bold">${window.kartuPesertaConfig.cardWidth}px</span>
                                        </div>
                                        <input type="range" id="cfg-cardWidth" min="280" max="600" value="${window.kartuPesertaConfig.cardWidth}" 
                                            oninput="updateKartuConfig('cardWidth', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Tinggi Kartu (Seret Bawah / Geser)</span>
                                            <span id="cfg-cardHeight-val" class="text-emerald-600 font-bold">${window.kartuPesertaConfig.cardHeight}px</span>
                                        </div>
                                        <input type="range" id="cfg-cardHeight" min="180" max="450" value="${window.kartuPesertaConfig.cardHeight}" 
                                            oninput="updateKartuConfig('cardHeight', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    
                                    <hr class="border-slate-100">

                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Ukuran Logo</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.logoSize}px</span>
                                        </div>
                                        <input type="range" id="cfg-logoSize" min="30" max="80" value="${window.kartuPesertaConfig.logoSize}" 
                                            oninput="updateKartuConfig('logoSize', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    
                                    <hr class="border-slate-100">
                                    
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Ukuran Stempel</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.stempelSize}px</span>
                                        </div>
                                        <input type="range" id="cfg-stempelSize" min="40" max="140" value="${window.kartuPesertaConfig.stempelSize}" 
                                            oninput="updateKartuConfig('stempelSize', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Geser Stempel Kiri/Kanan</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.stempelOffsetLeft}px</span>
                                        </div>
                                        <input type="range" id="cfg-stempelOffsetLeft" min="-80" max="40" value="${window.kartuPesertaConfig.stempelOffsetLeft}" 
                                            oninput="updateKartuConfig('stempelOffsetLeft', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Geser Stempel Atas/Bawah</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.stempelOffsetTop}px</span>
                                        </div>
                                        <input type="range" id="cfg-stempelOffsetTop" min="-60" max="40" value="${window.kartuPesertaConfig.stempelOffsetTop}" 
                                            oninput="updateKartuConfig('stempelOffsetTop', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>

                                    <hr class="border-slate-100">

                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Ukuran Tanda Tangan</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.ttdSize}px</span>
                                        </div>
                                        <input type="range" id="cfg-ttdSize" min="30" max="120" value="${window.kartuPesertaConfig.ttdSize}" 
                                            oninput="updateKartuConfig('ttdSize', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Geser TTD Kiri/Kanan</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.ttdOffsetLeft}px</span>
                                        </div>
                                        <input type="range" id="cfg-ttdOffsetLeft" min="-40" max="60" value="${window.kartuPesertaConfig.ttdOffsetLeft}" 
                                            oninput="updateKartuConfig('ttdOffsetLeft', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Geser TTD Atas/Bawah</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.ttdOffsetTop}px</span>
                                        </div>
                                        <input type="range" id="cfg-ttdOffsetTop" min="-40" max="40" value="${window.kartuPesertaConfig.ttdOffsetTop}" 
                                            oninput="updateKartuConfig('ttdOffsetTop', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    
                                    <hr class="border-slate-100">
                                    
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Geser Kelompok TTD Kiri/Kanan</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.signatureGroupOffsetLeft}px</span>
                                        </div>
                                        <input type="range" id="cfg-signatureGroupOffsetLeft" min="-60" max="60" value="${window.kartuPesertaConfig.signatureGroupOffsetLeft}" 
                                            oninput="updateKartuConfig('signatureGroupOffsetLeft', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Geser Kelompok TTD Atas/Bawah</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.signatureGroupOffsetTop}px</span>
                                        </div>
                                        <input type="range" id="cfg-signatureGroupOffsetTop" min="-60" max="60" value="${window.kartuPesertaConfig.signatureGroupOffsetTop}" 
                                            oninput="updateKartuConfig('signatureGroupOffsetTop', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    
                                    <hr class="border-slate-100">

                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Margin Atas Kop Kartu</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.paddingTop}px</span>
                                        </div>
                                        <input type="range" id="cfg-paddingTop" min="0" max="24" value="${window.kartuPesertaConfig.paddingTop}" 
                                            oninput="updateKartuConfig('paddingTop', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                        <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                            <span>Margin Bawah TTD Kartu</span>
                                            <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.paddingBottom}px</span>
                                        </div>
                                        <input type="range" id="cfg-paddingBottom" min="0" max="24" value="${window.kartuPesertaConfig.paddingBottom}" 
                                            oninput="updateKartuConfig('paddingBottom', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>

                                    <hr class="border-slate-100">

                                    <div>
                                        <label class="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500 mb-1 cursor-pointer select-none">
                                            <input type="checkbox" id="cfg-showStudentPhoto" 
                                                ${window.kartuPesertaConfig.showStudentPhoto ? 'checked' : ''} 
                                                onchange="updateKartuConfig('showStudentPhoto', this.checked)" 
                                                class="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5">
                                            <span>Tampilkan Foto Siswa</span>
                                        </label>
                                    </div>

                                    ${window.kartuPesertaConfig.showStudentPhoto ? `
                                    <div>
                                         <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                             <span>Lebar Foto Siswa</span>
                                             <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.studentPhotoWidth}px</span>
                                         </div>
                                         <input type="range" id="cfg-studentPhotoWidth" min="20" max="100" value="${window.kartuPesertaConfig.studentPhotoWidth}" 
                                             oninput="updateKartuConfig('studentPhotoWidth', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                         <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                             <span>Tinggi Foto Siswa</span>
                                             <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.studentPhotoHeight}px</span>
                                         </div>
                                         <input type="range" id="cfg-studentPhotoHeight" min="30" max="120" value="${window.kartuPesertaConfig.studentPhotoHeight}" 
                                             oninput="updateKartuConfig('studentPhotoHeight', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                         <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                             <span>Geser Foto Kiri/Kanan</span>
                                             <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.studentPhotoOffsetLeft}px</span>
                                         </div>
                                         <input type="range" id="cfg-studentPhotoOffsetLeft" min="-180" max="60" value="${window.kartuPesertaConfig.studentPhotoOffsetLeft}" 
                                             oninput="updateKartuConfig('studentPhotoOffsetLeft', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    <div>
                                         <div class="flex justify-between text-[11px] font-bold uppercase text-slate-500 mb-1">
                                             <span>Geser Foto Atas/Bawah</span>
                                             <span class="text-emerald-600 font-bold">${window.kartuPesertaConfig.studentPhotoOffsetTop}px</span>
                                         </div>
                                         <input type="range" id="cfg-studentPhotoOffsetTop" min="-80" max="80" value="${window.kartuPesertaConfig.studentPhotoOffsetTop}" 
                                             oninput="updateKartuConfig('studentPhotoOffsetTop', parseInt(this.value))" class="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer">
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <!-- Right Column: Live Interactive Preview -->
                        <div class="flex-1 space-y-4">
                            <div class="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-start space-x-3 text-xs">
                                <i class="fa-solid fa-circle-info text-base text-amber-600 mt-0.5 shrink-0"></i>
                                <div>
                                    <p class="font-bold">Pratinjau Hasil Cetak</p>
                                    <p class="mt-0.5 opacity-90 leading-relaxed">Berikut adalah contoh tampilan langsung kartu peserta ujian. Ketika Anda menekan tombol <b>Cetak Semua</b>, sistem akan mengunduh atau mencetak seluruh <b>${filtered.length} siswa</b> yang cocok dengan filter di atas dengan ukuran standar kartu ujian Indonesia (2 kolom x 5 baris per halaman A4).</p>
                                </div>
                            </div>
                            
                            <div class="flex flex-wrap gap-6 justify-center items-start p-4 bg-slate-50/60 rounded-3xl border border-slate-100/80 overflow-auto min-h-[300px]">
                                ${previewStudents.length > 0 ? previewStudents.map(st => {
                                    const cls = classes.find(c => String(c.id) === String(st.classId || st.class_id));
                                    const className = cls ? cls.name : '-';
                                    
                                    const room = (rooms || []).find(r => (r.members || []).some(mId => String(mId) === String(st.id)));
                                    const roomName = room ? room.name : '-';
                                    
                                    return getKartuPesertaHtml(st, className, roomName, false);
                                }).join('') : `
                                    <div class="w-full bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3 shadow-sm">
                                        <div class="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto text-xl animate-pulse">
                                            <i class="fa-solid fa-user-slash"></i>
                                        </div>
                                        <h4 class="font-bold text-slate-700 text-sm">Tidak Ada Siswa Terpilih</h4>
                                        <p class="text-xs text-slate-400 leading-relaxed">Tidak ditemukan data siswa yang cocok dengan filter kelas dan ruang yang dipilih.</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
                `;
            })() : currentTab === 'monitoring' ? `
                <div class="space-y-6">
                    ${appState.activeMonitoringLkpdId ? `
                        <div class="flex items-center justify-between">
                            <button type="button" onclick="appState.activeMonitoringLkpdId = null; renderAssessmentModule(document.getElementById('view-container'), 'monitoring', null);" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center gap-1.5 transition cursor-pointer">
                                <i class="fa-solid fa-arrow-left"></i> <span>Kembali ke Pilihan Monitoring</span>
                            </button>
                        </div>
                        <div id="lkpd-monitoring-container"></div>
                    ` : !activeExam ? `
                        <div class="space-y-6">
                            ${!appState.selectedMonitoringType ? `
                                <!-- DUA KARTU UTAMA MONITORING BERDAMPINGAN -->
                                <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                                    <div class="space-y-1">
                                        <h3 class="font-extrabold text-slate-800 text-lg sm:text-xl flex items-center gap-2">
                                            <i class="fa-solid fa-desktop text-emerald-600"></i> Pusat Monitoring Terpadu
                                        </h3>
                                        <p class="text-xs text-slate-400">Pilih tipe monitoring aktivitas madrasah yang ingin Anda pantau secara live real-time.</p>
                                    </div>

                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <!-- KARTU 1: MONITORING ASESMEN CBT -->
                                        <div onclick="appState.selectedMonitoringType = 'cbt'; renderAssessmentModule(document.getElementById('view-container'), 'monitoring', null);" class="group relative bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-8 rounded-3xl border border-indigo-800 hover:border-indigo-500 shadow-xl hover:shadow-indigo-950/20 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between min-h-[220px] cursor-pointer">
                                            <div class="absolute top-5 right-5 w-16 h-16 bg-white/5 group-hover:bg-white/10 rounded-2xl flex items-center justify-center text-3xl transition duration-300">
                                                <i class="fa-solid fa-laptop text-indigo-400"></i>
                                            </div>
                                            <div class="space-y-2 max-w-[75%]">
                                                <span class="px-3 py-1 bg-indigo-500/20 text-indigo-300 font-black text-[10px] rounded-full border border-indigo-400/30 uppercase tracking-widest">
                                                    Asesmen CBT
                                                </span>
                                                <h4 class="font-black text-lg sm:text-xl text-white">Monitoring Asesmen CBT</h4>
                                                <p class="text-xs text-indigo-100/70 leading-relaxed">Pantau pengerjaan ujian, kecurangan siswa keluar tab, livecam snapshot, dan force-finish kontrol ujian.</p>
                                            </div>
                                            <div class="flex items-center justify-between border-t border-indigo-800/60 pt-4 mt-4">
                                                <span class="text-xs font-extrabold text-indigo-300">${displayExams.filter(ex => ex.recordType !== 'EVENT').length} Ujian Terjadwal</span>
                                                <span class="text-[10px] bg-indigo-600 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-wider group-hover:bg-indigo-500 transition">PILIH &rarr;</span>
                                            </div>
                                        </div>

                                        <!-- KARTU 2: MONITORING LKPD -->
                                        <div onclick="appState.selectedMonitoringType = 'lkpd'; renderAssessmentModule(document.getElementById('view-container'), 'monitoring', null);" class="group relative bg-gradient-to-br from-emerald-900 to-teal-950 text-white p-8 rounded-3xl border border-emerald-800 hover:border-emerald-500 shadow-xl hover:shadow-emerald-950/20 hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between min-h-[220px] cursor-pointer">
                                            <div class="absolute top-5 right-5 w-16 h-16 bg-white/5 group-hover:bg-white/10 rounded-2xl flex items-center justify-center text-3xl transition duration-300">
                                                <i class="fa-solid fa-file-signature text-emerald-400"></i>
                                            </div>
                                            <div class="space-y-2 max-w-[75%]">
                                                <span class="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-black text-[10px] rounded-full border border-emerald-400/30 uppercase tracking-widest">
                                                    LKPD Siswa
                                                </span>
                                                <h4 class="font-black text-lg sm:text-xl text-white">Monitoring Lembar Kerja (LKPD)</h4>
                                                <p class="text-xs text-emerald-100/70 leading-relaxed">Pantau pengumpulan lembar kerja, letak nomor koordinat, live absen foto, dan ulasan penilaian jawaban siswa.</p>
                                            </div>
                                            <div class="flex items-center justify-between border-t border-emerald-800/60 pt-4 mt-4">
                                                <span class="text-xs font-extrabold text-emerald-300">${(Array.isArray(appState.lkpdList) ? appState.lkpdList.length : 0)} LKPD Aktif</span>
                                                <span class="text-[10px] bg-emerald-600 text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-wider group-hover:bg-emerald-500 transition">PILIH &rarr;</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <!-- DETAIL SELECTION BERDASARKAN TIPE MONITORING -->
                                <div class="bg-white p-6 rounded-3xl shadow-sm border space-y-6">
                                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-4">
                                        <div>
                                            <h3 class="font-extrabold text-slate-800 text-base sm:text-lg">
                                                ${appState.selectedMonitoringType === 'cbt' ? 'Pilih Ujian CBT yang Dipantau' : 'Pilih Lembar Kerja (LKPD) yang Dipantau'}
                                            </h3>
                                            <p class="text-xs text-slate-400">Silakan pilih salah satu jadwal aktif di bawah untuk memulai sesi pemantauan.</p>
                                        </div>
                                        <button type="button" onclick="appState.selectedMonitoringType = null; renderAssessmentModule(document.getElementById('view-container'), 'monitoring', null);" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer">
                                            <i class="fa-solid fa-arrow-left"></i> <span>Ganti Tipe Monitoring</span>
                                        </button>
                                    </div>

                                    ${appState.selectedMonitoringType === 'lkpd' ? `
                                        <!-- DAFTAR LKPD -->
                                        ${(Array.isArray(appState.lkpdList) && appState.lkpdList.length > 0) ? `
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                ${appState.lkpdList.map(lk => `
                                                    <div class="bg-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 space-y-4 flex flex-col justify-between">
                                                        <div>
                                                            <div class="flex items-center gap-2 mb-2">
                                                                <span class="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-black text-[10px] rounded-full border border-emerald-400/30">
                                                                    LKPD Interaktif
                                                                </span>
                                                                <span class="text-xs text-emerald-200 font-semibold">${lk.className || 'Semua Kelas'}</span>
                                                            </div>
                                                            <h4 class="font-black text-base text-white">${lk.title}</h4>
                                                            <p class="text-xs text-slate-400 line-clamp-1 mt-1">${lk.markers?.length || 0} Titik Penanda Soal &bull; ${lk.submissions?.length || 0} Jawaban Siswa Masuk</p>
                                                        </div>
                                                        <button type="button" onclick="appState.activeMonitoringLkpdId = '${lk.id}'; renderAssessmentModule(document.getElementById('view-container'), 'monitoring', null);" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
                                                            <i class="fa-solid fa-desktop"></i> <span>Mulai Live Monitoring LKPD</span>
                                                        </button>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : `
                                            <div class="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed text-xs">Belum ada LKPD terdaftar untuk kelas ini.</div>
                                        `}
                                    ` : `
                                        <!-- DAFTAR UJIAN CBT -->
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            ${displayExams.filter(ex => ex.recordType !== 'EVENT').map(ex => `
                                                <div class="bg-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 space-y-4 flex flex-col justify-between">
                                                    <div>
                                                        <div class="flex items-center gap-2 mb-2">
                                                            <span class="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 font-black text-[10px] rounded-full border border-indigo-400/30">
                                                                CBT Exam
                                                            </span>
                                                            <span class="text-xs text-slate-400 font-semibold">${ex.className || 'Semua Kelas'}</span>
                                                        </div>
                                                        <h4 class="font-bold text-base text-white">${ex.title}</h4>
                                                        <p class="text-xs text-slate-400 mt-1">${ex.subjectName || ex.subject || 'Mapel'}</p>
                                                    </div>
                                                    <button type="button" onclick="renderAssessmentModule(document.getElementById('view-container'), 'monitoring', '${ex.id}')" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs shadow transition cursor-pointer">Mulai Live Monitoring CBT</button>
                                                </div>
                                            `).join('')}
                                        </div>
                                    `}
                                </div>
                            `}
                        </div>
                    ` : (() => {
                        if (appState.monitoringFilterClassId === undefined) appState.monitoringFilterClassId = '';
                        if (appState.monitoringFilterRoomId === undefined) appState.monitoringFilterRoomId = '';
                        if (!appState.livecamMode) appState.livecamMode = 'gambar';

                        // Poin 11: Event-Driven Monitoring - remove heavy 10-second full page polling
                        if (window.__monitoringPollInterval) {
                            clearInterval(window.__monitoringPollInterval);
                            window.__monitoringPollInterval = null;
                        }

                        // Attach event listener for real-time surgical updates from SSE/WS
                        window.__onExamMonitoringEvent = function(event) {
                            if (!event || !event.studentId) return;
                            if (appState.lastAssessmentSubTab !== 'monitoring') return;
                            if (event.examId && appState.activeMonitoringExamId && String(event.examId) !== String(appState.activeMonitoringExamId)) {
                                return;
                            }
                            if (typeof window.updateStudentMonitoringCard === 'function') {
                                window.updateStudentMonitoringCard(event);
                            }
                        };

                        const activeSessions = appState.activeExamSessions || JSON.parse(localStorage.getItem('madrasah_active_exam_sessions')) || {};
                        const completedExams = appState.completedExams || JSON.parse(localStorage.getItem('madrasah_completed_exams')) || {};
                        const forceFinishedExams = appState.forceFinishedExams || JSON.parse(localStorage.getItem('madrasah_force_finished_exams')) || {};
                        const tabSwitchesMap = JSON.parse(localStorage.getItem('madrasah_student_tab_switches')) || {};
                        const outOfTabMap = JSON.parse(localStorage.getItem('madrasah_student_out_of_tab')) || {};
                        const blockedMap = JSON.parse(localStorage.getItem('madrasah_blocked_students')) || {};
                        const livecamFrames = appState.runtimeLivecamFrames || {};

                        // Filter the students list
                        let filteredStudentsForMonitor = appState.students || [];

                        // 1. First, only show students who are in the classes assigned to this exam
                        if (activeExam.classes && activeExam.classes.length > 0 && !activeExam.classes.includes('ALL')) {
                            filteredStudentsForMonitor = filteredStudentsForMonitor.filter(st => {
                                return activeExam.classes.some(cId => String(cId) === String(st.classId));
                            });
                        }

                        // 2. Filter by Class if selected
                        if (appState.monitoringFilterClassId) {
                            filteredStudentsForMonitor = filteredStudentsForMonitor.filter(st => String(st.classId) === String(appState.monitoringFilterClassId));
                        }

                        // 3. Filter by Room if selected
                        if (appState.monitoringFilterRoomId) {
                            const selectedRoomObj = (appState.rooms || []).find(r => String(r.id) === String(appState.monitoringFilterRoomId));
                            if (selectedRoomObj) {
                                const roomMembers = selectedRoomObj.members || [];
                                filteredStudentsForMonitor = filteredStudentsForMonitor.filter(st => roomMembers.includes(st.id) || roomMembers.includes(String(st.id)));
                            } else {
                                filteredStudentsForMonitor = [];
                            }
                        }

                        // 4. Filter by Search Query (Nama / NIS)
                        if (appState.monitoringFilterSearch && appState.monitoringFilterSearch.trim() !== '') {
                            const q = appState.monitoringFilterSearch.trim().toLowerCase();
                            filteredStudentsForMonitor = filteredStudentsForMonitor.filter(st => {
                                const name = (st.name || '').toLowerCase();
                                const nis = (st.nis || '').toLowerCase();
                                return name.includes(q) || nis.includes(q);
                            });
                        }

                        const examClasses = appState.classes.filter(c => {
                            return !activeExam.classes || activeExam.classes.length === 0 || activeExam.classes.includes('ALL') || activeExam.classes.some(cId => String(cId) === String(c.id));
                        });

                        return `
                            <div class="space-y-4">
                                <div class="bg-white p-6 rounded-3xl shadow-sm border flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                                    <div class="space-y-2">
                                        <button type="button" onclick="appState.activeMonitoringExamId = null; renderAssessmentModule(document.getElementById('view-container'), 'monitoring', null);" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-extrabold rounded-2xl text-xs inline-flex items-center gap-2 transition cursor-pointer border border-slate-200/80 shadow-sm">
                                            <i class="fa-solid fa-arrow-left"></i> <span>Kembali ke Pilih Jadwal Ujian</span>
                                        </button>
                                        <div>
                                            <h3 class="font-extrabold text-slate-800 text-lg">Live Monitoring: ${activeExam.title}</h3>
                                            <p class="text-xs text-slate-400">Pantau kehadiran, status pengerjaan, livecam, pelanggaran keluar tab, dan kontrol peserta.</p>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                                        <!-- Search Nama / NIS -->
                                        <div class="relative min-w-[180px] sm:min-w-[220px]">
                                            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                            <input type="text" id="monitor-search-input" value="${appState.monitoringFilterSearch || ''}" oninput="onMonitoringFilterChange('${activeExam.id}')" placeholder="Cari Nama / NIS..." class="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 transition">
                                        </div>
                                        <!-- Filter Kelas -->
                                        <div class="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 px-3.5 py-2 rounded-2xl transition duration-150">
                                            <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Kelas</span>
                                            <select id="monitor-class-filter" onchange="onMonitoringFilterChange('${activeExam.id}')" class="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                                                <option value="">Semua Kelas</option>
                                                ${examClasses.map(c => `<option value="${c.id}" ${appState.monitoringFilterClassId === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
                                            </select>
                                        </div>
                                        <!-- Filter Ruang -->
                                        <div class="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 px-3.5 py-2 rounded-2xl transition duration-150">
                                            <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Ruang</span>
                                            <select id="monitor-room-filter" onchange="onMonitoringFilterChange('${activeExam.id}')" class="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer">
                                                <option value="">Semua Ruang</option>
                                                ${(appState.rooms || []).map(r => `<option value="${r.id}" ${appState.monitoringFilterRoomId === String(r.id) ? 'selected' : ''}>${r.name}</option>`).join('')}
                                            </select>
                                        </div>
                                        <!-- Kirim Pesan ke Semua -->
                                        <button type="button" onclick="openBroadcastMessageModal('${activeExam.id}')" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow flex items-center space-x-1.5 transition cursor-pointer">
                                            <i class="fa-solid fa-bullhorn text-[11px]"></i><span>Kirim Pesan</span>
                                        </button>
                                        <!-- Toggle Mode Livecam -->
                                        <button type="button" onclick="toggleLivecamMode('${activeExam.id}')" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl text-xs shadow flex items-center space-x-1.5 transition cursor-pointer">
                                            <i class="fa-solid ${appState.livecamMode === 'video' ? 'fa-video' : 'fa-image'} text-[11px]"></i>
                                            <span>Mode Semua: ${appState.livecamMode === 'video' ? 'Video Live' : 'Foto Absen'}</span>
                                        </button>
                                        <!-- Log Pelanggaran Anti-Cheat -->
                                        <button type="button" onclick="openViolationsLogModal('${activeExam.id}')" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs shadow flex items-center space-x-1.5 transition cursor-pointer">
                                            <i class="fa-solid fa-triangle-exclamation text-[11px]"></i><span>Log Pelanggaran</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- Local IP / Offline WebRTC Expose Helper Banner -->
                                <div id="admin-local-ip-bypass-banner" class="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                                    <div class="space-y-1">
                                        <h4 class="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
                                            <i class="fa-solid fa-shield-halved text-amber-600 text-sm"></i>
                                            Kelancaran Video Live P2P (Jaringan Offline / Lokal)
                                        </h4>
                                        <p class="text-[11px] text-amber-700/90 leading-relaxed max-w-xl">
                                            Untuk menghubungkan video live WebRTC langsung di jaringan lokal tanpa internet, Chrome membutuhkan izin kamera agar dapat membaca IP lokal asli komputer pengawas. Kamera pengawas <strong>tidak akan disiarkan</strong> ke mana pun.
                                        </p>
                                    </div>
                                    <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                        <button type="button" onclick="event.stopPropagation(); window.refreshMonitoringState('${activeExam.id}', this)" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-2xl text-[10px] font-bold shadow-md flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer">
                                            <i class="fa-solid fa-arrows-rotate"></i>
                                            <span>Refresh Data</span>
                                        </button>
                                        <button type="button" onclick="event.stopPropagation(); triggerAdminCameraPermissionBypass()" id="admin-bypass-btn" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-[10px] font-bold shadow-md flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer">
                                            <i class="fa-solid fa-key"></i>
                                            <span>Buka Akses IP Lokal</span>
                                        </button>
                                    </div>
                                </div>
                                <script>
                                    // Auto-check if already authorized in background
                                    if (navigator.permissions && navigator.permissions.query) {
                                        navigator.permissions.query({ name: 'camera' }).then(res => {
                                            if (res.state === 'granted') {
                                                navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                                                    .then(stream => {
                                                        stream.getTracks().forEach(t => t.stop());
                                                        const btn = document.getElementById('admin-bypass-btn');
                                                        if (btn) {
                                                            btn.className = "px-4 py-2.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-bold shadow-md flex items-center space-x-1.5 transition cursor-pointer";
                                                            btn.innerHTML = \`<i class="fa-solid fa-circle-check"></i><span>Akses IP Lokal Aktif</span>\`;
                                                        }
                                                    }).catch(()=>{});
                                            }
                                        }).catch(()=>{});
                                    }
                                </script>

                                ${filteredStudentsForMonitor.length === 0 ? `
                                    <div class="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3 max-w-md mx-auto shadow-sm">
                                        <div class="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto text-xl animate-pulse">
                                            <i class="fa-solid fa-user-slash"></i>
                                        </div>
                                        <h4 class="font-bold text-slate-700 text-sm">Tidak Ada Siswa Terpantau</h4>
                                        <p class="text-xs text-slate-400 leading-relaxed">Tidak ditemukan peserta ujian yang terdaftar untuk filter Kelas atau Ruang yang Anda pilih.</p>
                                    </div>
                                ` : `
                                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        ${filteredStudentsForMonitor.map((st, idx) => {
                                            const k1 = st.id + '_' + activeExam.id;
                                            const k2 = String(st.id) + '_' + String(activeExam.id);
                                            const tabSwitches = tabSwitchesMap[k1] || tabSwitchesMap[k2] || 0;
                                            const isBlocked = isStudentBlocked(activeExam.id, st.id);
                                            const forceFinishedMap = appState.forceFinishedExams || JSON.parse(localStorage.getItem('madrasah_force_finished_exams') || '{}') || {};
                                            const isForceDone = Boolean(forceFinishedMap[k1] || forceFinishedMap[k2] || completedExams[k1] === 'force_finish' || completedExams[k2] === 'force_finish');
                                            const isDone = (completedExams[k1] === true || completedExams[k2] === true) || isForceDone;
                                            const sessionData = activeSessions[k1] || activeSessions[k2];
                                            const isActive = sessionData !== undefined;
                                            const answeredCount = sessionData ? (sessionData.answeredCount || 0) : 0;
                                            const totalQs = sessionData ? (sessionData.totalQuestions || 0) : 0;
                                            const stCamMode = (appState.livecamModes && appState.livecamModes[st.id]) ? appState.livecamModes[st.id] : (appState.livecamMode || 'gambar');
                                            const isStudentVideo = stCamMode === 'video';
                                            const isCurrentlyOutOfTab = isActive && !isDone && (outOfTabMap[k1] === true || outOfTabMap[k2] === true);
                                            
                                            // Get student's latest attendance photo for Mode Gambar
                                            const attRecord = (appState.attendance || []).slice().reverse().find(a => 
                                                String(a.studentId || a.student_id) === String(st.id) || 
                                                (st.nis && String(a.nis) === String(st.nis))
                                            );
                                            const attPhoto = attRecord ? (attRecord.photo || attRecord.imageUrl || attRecord.facePhoto || attRecord.photoUrl || attRecord.image) : null;
                                            const studentPhoto = attPhoto || st.photo || st.facePhoto || st.image || st.avatar;
                                            
                                            let progressHtml = '';
                                            if (isActive && totalQs > 0) {
                                                const pct = Math.round((answeredCount / totalQs) * 100);
                                                progressHtml = `
                                                    <div class="w-full">
                                                        <div class="w-full bg-slate-950/80 border border-white/10 h-1.5 rounded-full overflow-hidden">
                                                            <div class="bg-emerald-400 h-full transition-all duration-300" style="width: ${pct}%"></div>
                                                        </div>
                                                        <div class="text-[9px] text-slate-300 mt-1 flex justify-between font-mono">
                                                            <span>${pct}%</span>
                                                            <span>Terjawab: ${answeredCount}/${totalQs}</span>
                                                        </div>
                                                    </div>
                                                `;
                                            } else if (isForceDone) {
                                                progressHtml = `
                                                    <div class="w-full">
                                                        <div class="w-full bg-slate-950/80 border border-white/10 h-1.5 rounded-full overflow-hidden">
                                                            <div class="bg-amber-500 h-full w-full"></div>
                                                        </div>
                                                        <div class="text-[9px] text-amber-400 mt-1 text-center font-bold flex items-center justify-center gap-1">
                                                            <i class="fa-solid fa-flag-checkered text-[8px]"></i><span>Force Finish oleh Admin</span>
                                                        </div>
                                                    </div>
                                                `;
                                            } else if (isDone) {
                                                progressHtml = `
                                                    <div class="w-full">
                                                        <div class="w-full bg-slate-950/80 border border-white/10 h-1.5 rounded-full overflow-hidden">
                                                            <div class="bg-emerald-500 h-full w-full"></div>
                                                        </div>
                                                        <div class="text-[9px] text-emerald-400 mt-1 text-center font-bold">100% Selesai</div>
                                                    </div>
                                                `;
                                            } else {
                                                progressHtml = `
                                                    <div class="w-full text-center py-1">
                                                        <span class="text-[10px] text-slate-400 font-sans">Belum Memulai Ujian</span>
                                                    </div>
                                                `;
                                            }

                                            return `
                                                <div id="monitor-card-${st.id}" onclick="focusStudentLivecam('${st.id}')" class="relative bg-slate-900 text-white rounded-3xl shadow-xl flex flex-col justify-between overflow-hidden border ${isBlocked ? 'border-rose-500 ring-2 ring-rose-500/30' : (isCurrentlyOutOfTab ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-slate-800')} min-h-[300px] cursor-pointer hover:scale-[1.02] transition-transform duration-300">
                                                    <!-- Full Card Background Image / Video Frame -->
                                                    <div class="absolute inset-0 z-0 bg-slate-950 overflow-hidden">
                                                        ${isStudentVideo ? (isActive ? `
                                                            <video id="webrtc-video-${st.id}" autoplay playsinline muted class="w-full h-full object-cover"></video>
                                                            <div id="webrtc-fallback-${st.id}" class="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500 bg-slate-950 overflow-hidden">
                                                                ${(livecamFrames[st.id + '_' + activeExam.id] || studentPhoto) ? `
                                                                    <img src="${livecamFrames[st.id + '_' + activeExam.id] || studentPhoto}" alt="Snapshot" class="w-full h-full object-cover opacity-80">
                                                                    <div class="absolute inset-0 bg-slate-950/40"></div>
                                                                ` : `
                                                                    <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                                                                        <i class="fa-solid fa-video text-emerald-400 animate-pulse text-3xl mb-2"></i>
                                                                    </div>
                                                                `}
                                                                <div class="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900/85 backdrop-blur-md text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-full flex items-center space-x-1.5 shadow-lg">
                                                                    <i class="fa-solid fa-circle-notch fa-spin text-emerald-400"></i>
                                                                    <span>Menghubungkan Video Live...</span>
                                                                </div>
                                                            </div>
                                                        ` : `
                                                            <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                                                                <i class="fa-solid fa-video text-slate-600 text-4xl mb-2"></i>
                                                                <span class="text-xs font-bold text-slate-500">${isForceDone ? 'Force Finish' : (isDone ? 'Selesai' : 'Belum Mulai')}</span>
                                                            </div>
                                                        `) : `
                                                            ${studentPhoto ? `
                                                                <img src="${studentPhoto}" alt="Foto Absen" class="w-full h-full object-cover">
                                                            ` : `
                                                                <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                                                                    <div class="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-300 text-xl font-bold uppercase mb-2 shadow">
                                                                        ${st.name ? st.name.charAt(0) : '?'}
                                                                    </div>
                                                                    <span class="text-xs text-slate-300 font-bold">${st.name}</span>
                                                                    <span class="text-[10px] text-slate-400 mt-1 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">Foto Absen Siswa</span>
                                                                </div>
                                                            `}
                                                        `}
                                                        <!-- Subtle gradient overlay for card readability -->
                                                        <div class="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/30 to-slate-950/70 pointer-events-none"></div>
                                                    </div>

                                                    <!-- Floating Card Content Overlay (z-10) -->
                                                    <div class="relative z-10 p-4 flex flex-col justify-between h-full space-y-3 min-h-[300px]">
                                                        <!-- Top Bar: Student Name (Left) & Corner Badges (Right) -->
                                                        <div class="flex justify-between items-start gap-2">
                                                            <div class="bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-md max-w-[65%] flex items-center space-x-2">
                                                                <span id="monitor-hb-${st.id}" title="Indikator Komunikasi Siswa" class="w-2 h-2 rounded-full bg-emerald-400 ${isActive ? 'opacity-100' : 'opacity-30'} transition-all duration-300 shrink-0"></span>
                                                                <div class="min-w-0">
                                                                    <span class="text-xs text-emerald-300 font-bold block truncate" title="${st.name}">${st.name}</span>
                                                                    <span class="text-[10px] text-slate-300 font-mono block truncate">NIS: ${st.nis || '-'}</span>
                                                                </div>
                                                            </div>

                                                            <!-- Notifikasi Pojok -->
                                                            <div id="monitor-corner-${st.id}" class="flex items-center space-x-1.5">
                                                                ${isCurrentlyOutOfTab ? `
                                                                    <span id="monitor-tab-badge-${st.id}" title="Keluar Tab (${tabSwitches}x)" class="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-lg animate-pulse backdrop-blur-md border border-rose-400">
                                                                        <i class="fa-solid fa-triangle-exclamation"></i>
                                                                    </span>
                                                                ` : (tabSwitches > 0 ? `
                                                                    <span id="monitor-tab-badge-${st.id}" title="Total Keluar Tab: ${tabSwitches}x" class="w-7 h-7 rounded-full bg-slate-950/80 text-amber-300 flex items-center justify-center text-xs shadow backdrop-blur-md border border-amber-500/40">
                                                                        <i class="fa-solid fa-triangle-exclamation"></i>
                                                                    </span>
                                                                ` : '')}

                                                                <!-- Status Icon Badge -->
                                                                <span id="monitor-status-icon-${st.id}" class="monitor-status-badge w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg backdrop-blur-md ${isBlocked ? 'bg-rose-600 text-white border border-rose-400' : (isForceDone ? 'bg-amber-600 text-white border border-amber-400' : (isActive ? 'bg-emerald-500 text-slate-900 font-bold animate-pulse border border-emerald-300' : (isDone ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-900/80 text-slate-300 border border-white/10')))}">
                                                                    <i class="fa-solid ${isBlocked ? 'fa-ban' : (isForceDone ? 'fa-flag-checkered' : (isActive ? 'fa-circle-dot' : (isDone ? 'fa-check' : 'fa-clock')))}"></i>
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <!-- Space Filler & Blocked Status -->
                                                        <div id="monitor-blocked-filler-${st.id}" class="my-auto monitor-blocked-filler">
                                                            ${isBlocked ? `<span class="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-full shadow-lg border border-rose-400">Diblokir</span>` : ''}
                                                        </div>

                                                        <!-- Bottom Section: Progress Bar & Buttons -->
                                                        <div class="space-y-2 bg-slate-950/85 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
                                                            <div id="monitor-progress-${st.id}">
                                                                ${progressHtml}
                                                            </div>

                                                            <div id="monitor-actions-${st.id}" class="flex gap-2 pt-1">
                                                                <button type="button" title="${isBlocked ? 'Unblock Siswa' : 'Blokir Siswa'}" onclick="event.stopPropagation(); toggleBlockStudent('${activeExam.id}', '${st.id}')" class="flex-1 py-2 rounded-xl text-xs font-semibold ${isBlocked ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'} shadow flex items-center justify-center gap-1.5 cursor-pointer transition">
                                                                    <i class="fa-solid ${isBlocked ? 'fa-user-check' : 'fa-ban'}"></i>
                                                                    ${isBlocked ? '<span class="text-[10px] font-bold">Unblok</span>' : ''}
                                                                </button>
                                                                <button type="button" title="${isStudentVideo ? 'Mode Foto Absen' : 'Mode Video Live'}" onclick="event.stopPropagation(); toggleStudentLivecamMode('${activeExam.id}', '${st.id}')" class="flex-1 py-2 rounded-xl text-xs font-semibold ${isStudentVideo ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'} shadow flex items-center justify-center cursor-pointer transition">
                                                                    <i class="fa-solid ${isStudentVideo ? 'fa-video' : 'fa-image'}"></i>
                                                                </button>
                                                                <button type="button" title="Kirim Pesan" onclick="event.stopPropagation(); openSendMessageModal('${activeExam.id}', '${st.id}')" class="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow flex items-center justify-center cursor-pointer transition">
                                                                    <i class="fa-solid fa-comment-dots"></i>
                                                                </button>
                                                                ${(isActive && !isDone) ? `
                                                                <button type="button" title="Force Finish Siswa" onclick="event.stopPropagation(); confirmAdminForceSubmitExam('${st.id}', '${activeExam.id}')" class="flex-1 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow flex items-center justify-center cursor-pointer transition">
                                                                    <i class="fa-solid fa-flag-checkered"></i>
                                                                </button>
                                                                ` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `}
                            </div>
                        `;
                    })()}
                </div>
            ` : `
                <div class="space-y-6">
                    <!-- Section Header -->
                    <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 class="font-extrabold text-lg text-slate-800">Evaluasi Hasil & Koreksi Nilai</h3>
                            <p class="text-xs text-slate-400 mt-0.5">Koreksi lembar jawaban siswa, input nilai, dan cetak laporan hasil.</p>
                        </div>
                        <div class="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                            <button type="button" onclick="appState.evaluasiMode = 'cbt'; renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', appState.evaluasiSelectedExamId || null);" class="px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${(!appState.evaluasiMode || appState.evaluasiMode === 'cbt') ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}">
                                <i class="fa-solid fa-laptop text-indigo-600"></i> <span>Ujian CBT</span>
                            </button>
                            <button type="button" onclick="appState.evaluasiMode = 'lkpd'; renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', null);" class="px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${appState.evaluasiMode === 'lkpd' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}">
                                <i class="fa-solid fa-file-pen text-amber-400"></i> <span>Lembar Kerja (LKPD)</span>
                            </button>
                        </div>
                    </div>

                    ${appState.evaluasiMode === 'lkpd' ? `
                        <div id="lkpd-evaluation-container" class="w-full"></div>
                    ` : `
                        <!-- Filter Toolbar -->
                        <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 max-w-4xl mx-auto">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">1. Pilih Rombel / Kelas</label>
                                <select id="eval-class-select" onchange="onEvaluasiFilterChange()" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700">
                                    <option value="">-- Pilih Kelas --</option>
                                    ${appState.classes.map(c => `<option value="${c.id}" ${String(appState.evaluasiSelectedClassId) === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">2. Pilih Jadwal Ujian CBT</label>
                                <select id="eval-exam-select" onchange="onEvaluasiFilterChange()" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700">
                                    <option value="">-- Pilih Jadwal Ujian --</option>
                                    ${displayExams.filter(e => e.recordType !== 'EVENT').map(e => `<option value="${e.id}" ${String(appState.evaluasiSelectedExamId) === String(e.id) ? 'selected' : ''}>${e.title}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">3. Cari Nama / NIS Siswa</label>
                                <div class="relative">
                                    <input type="text" id="eval-search-student-input" onkeyup="filterEvaluasiStudentTable()" placeholder="Ketik nama / NIS siswa..." class="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700">
                                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-400 text-xs"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- List of Students and Grading Panel -->
                    ${(() => {
                        const classId = appState.evaluasiSelectedClassId;
                        const examId = appState.evaluasiSelectedExamId;
                        if (!classId || !examId) {
                            return `
                                <div class="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3 max-w-xl mx-auto shadow-sm">
                                    <div class="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto text-xl">
                                        <i class="fa-solid fa-folder-open"></i>
                                    </div>
                                    <h4 class="font-bold text-slate-700 text-sm">Pilih Kelas & Jadwal Ujian</h4>
                                    <p class="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">Silakan gunakan pilihan kelas dan jadwal ujian di atas untuk membuka lembar evaluasi siswa.</p>
                                </div>
                            `;
                        }

                        // Ensure realistic mock data is populated for seamless UX
                        ensureEvaluasiDataPopulated(classId, examId);

                        const cls = appState.classes.find(c => String(c.id) === String(classId));
                        const ex = appState.exams.find(e => String(e.id) === String(examId));
                        
                        if (!cls || !ex) {
                            return `
                                <div class="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3 max-w-xl mx-auto shadow-sm">
                                    <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto text-xl">
                                        <i class="fa-solid fa-triangle-exclamation"></i>
                                    </div>
                                    <h4 class="font-bold text-slate-700 text-sm">Data Ujian / Kelas Tidak Ditemukan</h4>
                                    <p class="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">Silakan pilih kelas dan jadwal ujian lain dari menu di atas.</p>
                                </div>
                            `;
                        }

                        const clsStudents = appState.students.filter(st => String(st.classId) === String(classId));
                        const grades = JSON.parse(localStorage.getItem('madrasah_student_exam_grades')) || {};
                        const completedMap = appState.completedExams || JSON.parse(localStorage.getItem('madrasah_completed_exams') || '{}') || {};
                        const forceFinishedMap = appState.forceFinishedExams || JSON.parse(localStorage.getItem('madrasah_force_finished_exams') || '{}') || {};
                        const activeSessions = appState.activeExamSessions || JSON.parse(localStorage.getItem('madrasah_active_exam_sessions') || '{}') || {};
                        const storedAnswers = appState.studentExamAnswers || JSON.parse(localStorage.getItem('madrasah_student_exam_answers') || '{}') || {};

                        // Check if exam has essay questions
                        let questions = getExamQuestions(ex);
                        const hasEssay = questions.some(q => q.type === 'esay' || q.type === 'essay');

                        // Calculate summary counts across clsStudents
                        let countWorking = 0;
                        let countSelesai = 0;
                        let countForceFinish = 0;
                        let countBelumMulai = 0;

                        clsStudents.forEach(st => {
                            const k1 = st.id + '_' + examId;
                            const k2 = String(st.id) + '_' + String(examId);
                            const isFF = Boolean(forceFinishedMap[k1] || forceFinishedMap[k2] || completedMap[k1] === 'force_finish' || completedMap[k2] === 'force_finish');
                            const isComp = Boolean(completedMap[k1] || completedMap[k2]) || isFF;
                            const sess = activeSessions[k1] || activeSessions[k2];
                            const ans = storedAnswers[k1] || storedAnswers[k2] || (sess && sess.answers);
                            const isWork = !isComp && Boolean((sess && (sess.status === 'active' || (sess.timeLeft !== undefined && sess.timeLeft > 0) || (sess.answeredCount && sess.answeredCount > 0))) || (ans && Object.keys(ans).length > 0));

                            if (isFF) countForceFinish++;
                            else if (isComp) countSelesai++;
                            else if (isWork) countWorking++;
                            else countBelumMulai++;
                        });

                        return `
                            <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-6 p-6">
                                <!-- Top Action Panel -->
                                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
                                    <div class="space-y-1">
                                        <h4 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <span>Tindakan Evaluasi Kelas</span>
                                            <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">Live Sync</span>
                                        </h4>
                                        <p class="text-[10px] text-slate-400 font-medium">Lakukan pengoreksian lembar jawaban esai, refresh nilai, force finish, atau ekspor laporan PDF / Excel</p>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <!-- Refresh Nilai -->
                                        <button type="button" onclick="refreshEvaluasiData('${classId}', '${examId}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/10 transition cursor-pointer" title="Perbarui Data Nilai Tanpa Keluar Halaman">
                                            <i class="fa-solid fa-rotate"></i><span>Refresh Nilai</span>
                                        </button>
                                        <!-- Auto Koreksi AI / Non-AI -->
                                        ${hasEssay ? `
                                        <button id="btn-auto-koreksi-non-ai" type="button" onclick="runAutoKoreksiNonAI('${classId}', '${examId}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition cursor-pointer" title="Koreksi Otomatis Non-AI (Mendukung Bhs Indonesia, Arab, Inggris & Rumus Matematika)">
                                            <i class="fa-solid fa-calculator text-emerald-200"></i><span>Auto Koreksi Non-AI</span>
                                        </button>
                                        <button id="btn-auto-koreksi" type="button" onclick="runAutoKoreksiAI('${classId}', '${examId}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/10 transition cursor-pointer animate-pulse" title="Koreksi Otomatis Jawaban Esay Siswa Menggunakan AI">
                                            <i class="fa-solid fa-wand-magic-sparkles text-purple-200"></i><span>Auto Koreksi AI</span>
                                        </button>
                                        ` : ''}
                                        <!-- Import ke Nilai Harian -->
                                        <button type="button" onclick="openImportToHarianModal('${classId}', '${examId}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/10 transition cursor-pointer" title="Impor nilai evaluasi ini ke rekap Nilai Harian siswa">
                                            <i class="fa-solid fa-file-import"></i><span>Import ke Harian</span>
                                        </button>
                                        <!-- Cetak Nilai PDF -->
                                        <button type="button" onclick="cetakNilaiEvaluasi()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition cursor-pointer">
                                            <i class="fa-solid fa-file-pdf"></i><span>Cetak PDF</span>
                                        </button>
                                        <!-- Cetak Nilai Excel -->
                                        <button type="button" onclick="exportNilaiExcelEvaluasi()" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-600/10 transition cursor-pointer">
                                            <i class="fa-solid fa-file-excel"></i><span>Ekspor Excel (.xlsx)</span>
                                        </button>
                                        <!-- Cetak Jawaban -->
                                        <button type="button" onclick="openCetakJawabanModal()" class="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-slate-700/10 transition cursor-pointer">
                                            <i class="fa-solid fa-download"></i><span>Download Jawaban</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- Summary Cards -->
                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div class="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-3.5 flex items-center justify-between">
                                        <div>
                                            <p class="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Sedang Mengerjakan</p>
                                            <p class="text-xl font-extrabold text-blue-800 mt-0.5">${countWorking} <span class="text-xs font-normal text-blue-600">siswa</span></p>
                                        </div>
                                        <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-sm shadow-xs">
                                            <i class="fa-solid fa-spinner animate-spin"></i>
                                        </div>
                                    </div>
                                    <div class="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between">
                                        <div>
                                            <p class="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Selesai (Normal)</p>
                                            <p class="text-xl font-extrabold text-emerald-800 mt-0.5">${countSelesai} <span class="text-xs font-normal text-emerald-600">siswa</span></p>
                                        </div>
                                        <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm shadow-xs">
                                            <i class="fa-solid fa-circle-check"></i>
                                        </div>
                                    </div>
                                    <div class="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 flex items-center justify-between">
                                        <div>
                                            <p class="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Force Finish (Admin)</p>
                                            <p class="text-xl font-extrabold text-amber-800 mt-0.5">${countForceFinish} <span class="text-xs font-normal text-amber-700">siswa</span></p>
                                        </div>
                                        <div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm shadow-xs">
                                            <i class="fa-solid fa-flag-checkered"></i>
                                        </div>
                                    </div>
                                    <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between">
                                        <div>
                                            <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Belum Mulai</p>
                                            <p class="text-xl font-extrabold text-slate-700 mt-0.5">${countBelumMulai} <span class="text-xs font-normal text-slate-500">siswa</span></p>
                                        </div>
                                        <div class="w-9 h-9 rounded-xl bg-slate-200/80 text-slate-600 flex items-center justify-center text-sm shadow-xs">
                                            <i class="fa-solid fa-clock"></i>
                                        </div>
                                    </div>
                                </div>

                                <!-- Student List Table -->
                                <div class="overflow-x-auto">
                                    <table id="evaluasi-student-table" class="w-full text-xs text-left text-slate-600">
                                        <thead class="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50/60 border-b">
                                            <tr>
                                                <th class="px-4 py-3.5 font-bold text-center w-12">No</th>
                                                <th class="px-4 py-3.5 font-bold">Nama Siswa</th>
                                                <th class="px-4 py-3.5 font-bold text-center w-28">NIS</th>
                                                <th class="px-4 py-3.5 font-bold text-center w-36">Status</th>
                                                <th class="px-4 py-3.5 font-bold text-center w-36">Nilai PG (${ex.weightPg !== undefined ? ex.weightPg : 50}%)</th>
                                                <th class="px-4 py-3.5 font-bold text-center w-32">Nilai Esay (${ex.weightEssay !== undefined ? ex.weightEssay : 50}%)</th>
                                                <th class="px-4 py-3.5 font-bold text-center w-28 bg-emerald-50/40 text-emerald-800">Nilai Akhir</th>
                                                <th class="px-4 py-3.5 font-bold text-center w-32">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-slate-100">
                                            ${clsStudents.map((st, idx) => {
                                                const key1 = st.id + '_' + examId;
                                                const key2 = String(st.id) + '_' + String(examId);

                                                let gradeObj = (grades && (grades[key1] || grades[key2])) || (appState.studentExamGrades && (appState.studentExamGrades[key1] || appState.studentExamGrades[key2]));

                                                const isForceFinished = Boolean(
                                                    forceFinishedMap[key1] ||
                                                    forceFinishedMap[key2] ||
                                                    completedMap[key1] === 'force_finish' ||
                                                    completedMap[key2] === 'force_finish' ||
                                                    (gradeObj && gradeObj.submissionType === 'force_finish')
                                                );

                                                const isCompleted = Boolean(completedMap[key1] || completedMap[key2]) || isForceFinished;

                                                const currentSession = activeSessions[key1] || activeSessions[key2] || null;

                                                const studentAnswers = (storedAnswers && (storedAnswers[key1] || storedAnswers[key2])) ||
                                                    (currentSession && currentSession.answers) ||
                                                    null;

                                                const stQuestions = getExamQuestions(ex, st.id);
                                                const pgQuestions = stQuestions.filter(q => q.type !== 'esay' && q.type !== 'essay');
                                                const essayQuestions = stQuestions.filter(q => q.type === 'esay' || q.type === 'essay');

                                                let answeredPGCount = 0;
                                                let correctPGCount = 0;
                                                pgQuestions.forEach(q => {
                                                    const userAns = studentAnswers ? (studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : studentAnswers[String(q.id)]) : undefined;
                                                    if (userAns !== undefined && userAns !== null && String(userAns).trim() !== '') {
                                                        answeredPGCount++;
                                                        if (isCorrectAnswer(q, userAns)) {
                                                            correctPGCount++;
                                                        }
                                                    }
                                                });

                                                let answeredEssayCount = 0;
                                                essayQuestions.forEach(q => {
                                                    const userAns = studentAnswers ? (studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : studentAnswers[String(q.id)]) : undefined;
                                                    if (userAns !== undefined && userAns !== null && String(userAns).trim() !== '') {
                                                        answeredEssayCount++;
                                                    }
                                                });

                                                const totalAnsweredCount = (currentSession && currentSession.answeredCount !== undefined && currentSession.answeredCount > 0)
                                                    ? currentSession.answeredCount
                                                    : (answeredPGCount + answeredEssayCount);

                                                const totalQuestionsCount = (currentSession && currentSession.totalQuestions)
                                                    ? currentSession.totalQuestions
                                                    : stQuestions.length;

                                                const isCurrentlyWorking = !isCompleted && Boolean(
                                                    (currentSession && (currentSession.status === 'active' || (currentSession.timeLeft !== undefined && currentSession.timeLeft > 0) || (currentSession.answeredCount && currentSession.answeredCount > 0))) ||
                                                    totalAnsweredCount > 0 ||
                                                    (studentAnswers && Object.keys(studentAnswers).length > 0)
                                                );

                                                const hasPgScore = Boolean(gradeObj && gradeObj.pgScore !== null && gradeObj.pgScore !== undefined);

                                                // Only calculate grade if student completed the exam and score has not been recorded yet
                                                if (isCompleted && studentAnswers && !hasPgScore) {
                                                    const pgScore = pgQuestions.length > 0 ? Math.round((correctPGCount / pgQuestions.length) * 100) : 100;
                                                    const isGraded = essayQuestions.length === 0;
                                                    const finalScore = isGraded ? pgScore : null;

                                                    gradeObj = {
                                                        pgScore,
                                                        essayScore: 0,
                                                        finalScore,
                                                        isGraded,
                                                        correctPGCount,
                                                        totalPGCount: pgQuestions.length,
                                                        essayGrades: {},
                                                        submissionType: isForceFinished ? 'force_finish' : 'normal'
                                                    };

                                                    if (!appState.studentExamGrades) appState.studentExamGrades = {};
                                                    appState.studentExamGrades[key1] = gradeObj;
                                                    appState.studentExamGrades[key2] = gradeObj;
                                                    if (grades) {
                                                        grades[key1] = gradeObj;
                                                        grades[key2] = gradeObj;
                                                    }
                                                    safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);
                                                } else if (isCompleted && gradeObj && !hasEssay && (gradeObj.finalScore === null || gradeObj.finalScore === undefined)) {
                                                    gradeObj.finalScore = gradeObj.pgScore;
                                                    gradeObj.isGraded = true;
                                                    if (!appState.studentExamGrades) appState.studentExamGrades = {};
                                                    appState.studentExamGrades[key1] = gradeObj;
                                                    appState.studentExamGrades[key2] = gradeObj;
                                                    if (grades) {
                                                        grades[key1] = gradeObj;
                                                        grades[key2] = gradeObj;
                                                    }
                                                    safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);
                                                }

                                                const pctAccuracy = pgQuestions.length > 0 ? Math.round((correctPGCount / pgQuestions.length) * 100) : 0;
                                                const pctProgressTotal = totalQuestionsCount > 0 ? Math.round((totalAnsweredCount / totalQuestionsCount) * 100) : 0;

                                                let statusBadgeHTML = '';
                                                if (isForceFinished) {
                                                    statusBadgeHTML = `
                                                        <div class="flex flex-col items-center justify-center">
                                                            <span class="text-amber-800 font-bold bg-amber-100 px-2.5 py-1 rounded-xl border border-amber-300 text-[10px] flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap">
                                                                <i class="fa-solid fa-flag-checkered text-[9px] text-amber-700"></i>
                                                                <span>Force Finish</span>
                                                            </span>
                                                            <span class="text-[9px] text-amber-700/80 font-medium mt-0.5">Oleh Admin</span>
                                                        </div>
                                                    `;
                                                } else if (isCompleted) {
                                                    statusBadgeHTML = `
                                                        <div class="flex flex-col items-center justify-center">
                                                            <span class="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/80 text-[10px] flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap">
                                                                <i class="fa-solid fa-circle-check text-[9px] text-emerald-600"></i>
                                                                <span>Selesai</span>
                                                            </span>
                                                            <span class="text-[9px] text-emerald-600/80 font-medium mt-0.5">Ujian Ditutup</span>
                                                        </div>
                                                    `;
                                                } else if (isCurrentlyWorking) {
                                                    statusBadgeHTML = `
                                                        <div class="flex flex-col items-center justify-center">
                                                            <span class="text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200/80 text-[10px] flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap animate-pulse">
                                                                <i class="fa-solid fa-spinner animate-spin text-[9px] text-blue-600"></i>
                                                                <span>Sedang Mengerjakan</span>
                                                            </span>
                                                            <span class="text-[9px] text-blue-600 font-semibold mt-0.5">
                                                                ${totalAnsweredCount}/${totalQuestionsCount} Soal (${pctProgressTotal}%)
                                                            </span>
                                                        </div>
                                                    `;
                                                } else {
                                                    statusBadgeHTML = `
                                                        <span class="text-slate-400 font-medium bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/60 text-[10px] flex items-center justify-center gap-1.5 whitespace-nowrap">
                                                            <i class="fa-solid fa-clock text-[9px] text-slate-400"></i>
                                                            <span>Belum Mulai</span>
                                                        </span>
                                                    `;
                                                }

                                                let pgScoreDisplay = '-';
                                                if (isCompleted) {
                                                    const score = (gradeObj && gradeObj.pgScore !== undefined) ? gradeObj.pgScore : (pgQuestions.length > 0 ? Math.round((correctPGCount / pgQuestions.length) * 100) : 100);
                                                    pgScoreDisplay = `
                                                        <div class="flex flex-col items-center justify-center">
                                                            <span class="font-extrabold text-slate-800 text-xs">${score}%</span>
                                                            <span class="text-[9px] text-slate-400 mt-0.5">${gradeObj?.correctPGCount !== undefined ? gradeObj.correctPGCount : correctPGCount}/${pgQuestions.length} Benar</span>
                                                        </div>
                                                    `;
                                                } else if (isCurrentlyWorking) {
                                                    pgScoreDisplay = `
                                                        <div class="flex flex-col items-center justify-center">
                                                            <span class="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/80 text-xs shadow-xs">
                                                                ${pctAccuracy}%
                                                            </span>
                                                            <span class="text-[9px] text-slate-500 font-semibold mt-0.5 whitespace-nowrap">
                                                                ${correctPGCount}/${pgQuestions.length} benar (${answeredPGCount} terjawab)
                                                            </span>
                                                        </div>
                                                    `;
                                                } else {
                                                    pgScoreDisplay = `<span class="text-slate-400 italic font-medium text-xs">-</span>`;
                                                }

                                                let essayScoreDisplay = '-';
                                                if (!hasEssay) {
                                                    essayScoreDisplay = `<span class="text-slate-400 italic text-[10px]">Tanpa Esai</span>`;
                                                } else if (isCompleted) {
                                                    if (gradeObj && gradeObj.isGraded) {
                                                        essayScoreDisplay = `
                                                            <div class="flex flex-col items-center justify-center">
                                                                <span class="font-extrabold text-slate-800 text-xs">${gradeObj.essayScore}%</span>
                                                                <span class="text-[9px] text-emerald-600 font-medium mt-0.5">Sudah Koreksi</span>
                                                            </div>
                                                        `;
                                                    } else if (gradeObj && gradeObj.pgScore !== undefined) {
                                                        essayScoreDisplay = '<span class="text-rose-600 font-bold bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 text-[10px]">Belum Koreksi</span>';
                                                    } else {
                                                        essayScoreDisplay = `<span class="text-slate-400 italic font-medium text-xs">-</span>`;
                                                    }
                                                } else if (isCurrentlyWorking) {
                                                    essayScoreDisplay = `
                                                        <div class="flex flex-col items-center justify-center">
                                                            <span class="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/80 text-[10px] font-semibold">
                                                                ${answeredEssayCount}/${essayQuestions.length} Terjawab
                                                            </span>
                                                            <span class="text-[9px] text-slate-400 mt-0.5">Sedang Berjalan</span>
                                                        </div>
                                                    `;
                                                } else {
                                                    essayScoreDisplay = `<span class="text-slate-400 italic font-medium text-xs">-</span>`;
                                                }

                                                let finalScoreDisplay = '<span class="text-slate-400 italic font-medium">-</span>';
                                                if (isCompleted) {
                                                    const fScore = (gradeObj && gradeObj.finalScore !== null && gradeObj.finalScore !== undefined) ? gradeObj.finalScore : ((gradeObj && gradeObj.pgScore !== undefined) ? gradeObj.pgScore : null);
                                                    if (fScore !== null && fScore !== undefined) {
                                                        finalScoreDisplay = `
                                                            <div class="flex flex-col items-center justify-center">
                                                                <span class="w-9 h-9 rounded-full ${isForceFinished ? 'bg-amber-600' : 'bg-emerald-600'} text-white font-black text-xs flex items-center justify-center shadow-xs mx-auto">
                                                                    ${fScore}
                                                                </span>
                                                                <span class="text-[9px] ${isForceFinished ? 'text-amber-700' : 'text-emerald-700'} font-bold mt-0.5">
                                                                    ${isForceFinished ? 'Force Finish' : 'Final'}
                                                                </span>
                                                            </div>
                                                        `;
                                                    } else {
                                                        finalScoreDisplay = `
                                                            <div class="flex flex-col items-center justify-center">
                                                                <span class="text-amber-700 font-semibold bg-amber-50 px-2 py-1 rounded-xl text-[10px] border border-amber-200/80 inline-block whitespace-nowrap">
                                                                    Pending Koreksi
                                                                </span>
                                                            </div>
                                                        `;
                                                    }
                                                } else if (isCurrentlyWorking) {
                                                    finalScoreDisplay = `
                                                        <div class="flex flex-col items-center justify-center">
                                                            <span class="w-9 h-9 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs mx-auto">
                                                                ${pctAccuracy}
                                                            </span>
                                                            <span class="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/80 mt-1 inline-block whitespace-nowrap">
                                                                Nilai Sementara
                                                            </span>
                                                        </div>
                                                    `;
                                                } else {
                                                    finalScoreDisplay = `<span class="text-slate-400 italic font-medium">-</span>`;
                                                }

                                                let actionButtonsHTML = '';
                                                if (isCompleted) {
                                                    let koreksiBtn = '';
                                                    if (hasEssay) {
                                                        if (gradeObj && gradeObj.isGraded) {
                                                            koreksiBtn = `
                                                                <button type="button" onclick="openKoreksiModal('${st.id}')" class="w-28 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer">
                                                                    <i class="fa-solid fa-circle-check text-xs"></i><span>Koreksi Ulang</span>
                                                                </button>
                                                            `;
                                                        } else {
                                                            const escapedName = String(st.name || '').replace(/'/g, "\\'");
                                                            koreksiBtn = `
                                                                <button type="button" onclick="clickKoreksiBelum('${st.id}', '${escapedName}')" class="w-28 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer">
                                                                    <i class="fa-solid fa-pen-to-square text-xs"></i><span>Koreksi</span>
                                                                </button>
                                                            `;
                                                        }
                                                    }
                                                    actionButtonsHTML = `
                                                        <div class="flex flex-col gap-1.5 items-center justify-center">
                                                            ${koreksiBtn}
                                                            <button type="button" onclick="resetStudentExam('${st.id}')" class="w-28 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-200">
                                                                <i class="fa-solid fa-rotate-left text-xs text-slate-500"></i><span>Ulang Ujian</span>
                                                            </button>
                                                        </div>
                                                    `;
                                                } else if (isCurrentlyWorking) {
                                                    actionButtonsHTML = `
                                                        <div class="flex flex-col gap-1.5 items-center justify-center">
                                                            <button type="button" onclick="confirmAdminForceSubmitExam('${st.id}', '${examId}')" class="w-28 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-[10px] flex items-center justify-center gap-1 shadow-sm transition cursor-pointer" title="Selesaikan ujian secara paksa dengan jawaban asli siswa saat ini">
                                                                <i class="fa-solid fa-flag-checkered text-[9px]"></i><span>Force Finish</span>
                                                            </button>
                                                            <button type="button" onclick="resetStudentExam('${st.id}')" class="w-28 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-200">
                                                                <i class="fa-solid fa-rotate-left text-xs text-slate-500"></i><span>Reset Status</span>
                                                            </button>
                                                        </div>
                                                    `;
                                                } else {
                                                    actionButtonsHTML = `
                                                        <div class="flex flex-col gap-1.5 items-center justify-center">
                                                            <span class="text-slate-400 italic text-[10px] mb-0.5">Belum Ujian</span>
                                                            <button type="button" onclick="resetStudentExam('${st.id}')" class="w-28 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-[10px] flex items-center justify-center gap-1 transition cursor-pointer border border-slate-200">
                                                                <i class="fa-solid fa-rotate-left"></i><span>Reset Status</span>
                                                            </button>
                                                        </div>
                                                    `;
                                                }

                                                return `
                                                    <tr class="hover:bg-slate-50/60 transition">
                                                        <td class="px-4 py-4 text-center font-bold text-slate-400">${idx + 1}</td>
                                                        <td class="px-4 py-4">
                                                            <div class="flex items-center space-x-2.5">
                                                                <div class="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs shrink-0 overflow-hidden">
                                                                    ${st.photo ? `<img src="${st.photo}" class="w-full h-full rounded-xl object-cover" referrerPolicy="no-referrer">` : st.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p class="font-bold text-slate-800 leading-none">${st.name}</p>
                                                                    <p class="text-[10px] text-slate-400 mt-1">${st.nis ? `NIS: ${st.nis}` : 'Siswa Terdaftar'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td class="px-4 py-4 text-center font-mono font-bold text-slate-500">${st.nis || '-'}</td>
                                                        <td class="px-4 py-4 text-center">${statusBadgeHTML}</td>
                                                        <td class="px-4 py-4 text-center">${pgScoreDisplay}</td>
                                                        <td class="px-4 py-4 text-center">${essayScoreDisplay}</td>
                                                        <td class="px-4 py-4 text-center bg-emerald-50/10 font-bold">${finalScoreDisplay}</td>
                                                        <td class="px-4 py-4 text-center">${actionButtonsHTML}</td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `;
                    })()}
                </div>
                `}
            `}
        </div>
    `;

    if (currentTab === 'lkpd') {
        const lkpdWrapper = document.getElementById('lkpd-tab-wrapper');
        if (lkpdWrapper && typeof window.renderLkpdCardsView === 'function') {
            window.renderLkpdCardsView(lkpdWrapper);
        }
    }

    if (currentTab === 'monitoring' && appState.activeMonitoringLkpdId) {
        const monContainer = document.getElementById('lkpd-monitoring-container');
        if (monContainer && typeof window.renderLkpdMonitoringSection === 'function') {
            window.renderLkpdMonitoringSection(monContainer, appState.activeMonitoringLkpdId);
        }
    }

    if (currentTab === 'evaluasi' && appState.evaluasiMode === 'lkpd') {
        const evalContainer = document.getElementById('lkpd-evaluation-container');
        if (evalContainer && typeof window.renderLkpdEvaluationSection === 'function') {
            window.renderLkpdEvaluationSection(evalContainer, appState.activeEvaluationLkpdId || null);
        }
    }
}

let tempExamClasses = [];

function openExamModal(editId = null, eventId = null) {
    if (editId) {
        renderExamModalForm(editId, eventId);
        return;
    }

    const tokenBalance = (typeof window.getActiveMadrasahTokenBalance === 'function')
        ? window.getActiveMadrasahTokenBalance()
        : ((appState.currentUser && appState.currentUser.cbtTokenBalance) || 0);

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    // 1. If Token is 0, BLOCK and show popup warning
    if (tokenBalance <= 0) {
        modal.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
                <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 text-center border border-rose-100 my-8">
                    <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-inner">
                        <i class="fa-solid fa-ban"></i>
                    </div>
                    <div class="space-y-2">
                        <span class="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 font-extrabold rounded-xl text-xs uppercase tracking-wider inline-block">Saldo: 0 Token</span>
                        <h3 class="text-lg font-bold text-slate-800">Saldo Token Ujian Kosong</h3>
                        <p class="text-xs text-slate-600 leading-relaxed">
                            Anda tidak dapat membuat jadwal ujian baru karena saldo token madrasah Anda kosong (<strong class="text-rose-600 font-bold">0 Token</strong>). 
                            Setiap pembuatan 1 jadwal ujian CBT membutuhkan <strong class="text-slate-800">1 Token Ujian</strong>.
                        </p>
                    </div>
                    <div class="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-900 text-left flex items-start gap-2.5">
                        <i class="fa-solid fa-lightbulb text-amber-600 text-sm mt-0.5"></i>
                        <span>Silakan ajukan <strong>Top-Up Token</strong> sekarang. Permintaan akan langsung dikonfirmasi oleh Super Admin (Bos).</span>
                    </div>
                    <div class="flex gap-2 pt-2">
                        <button type="button" onclick="closeModal()" class="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition">
                            Tutup
                        </button>
                        <button type="button" onclick="closeModal(); if (typeof openTopUpTokenModal === 'function') openTopUpTokenModal();" class="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-cart-plus"></i> <span>Top-Up Sekarang</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // 2. If Token > 0, show Early Confirmation Popup
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 border border-amber-100">
                <div class="flex items-center gap-3.5 border-b border-slate-100 pb-4">
                    <div class="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center text-xl font-black">
                        <i class="fa-solid fa-coins"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-800">Peringatan Konsumsi Token</h3>
                        <p class="text-xs text-slate-500">Konfirmasi Pembuatan Jadwal Ujian CBT</p>
                    </div>
                </div>
                <div class="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2.5">
                    <div class="flex justify-between items-center text-xs pb-2 border-b border-amber-200/60">
                        <span class="text-slate-600 font-medium">Saldo Token Anda Saat Ini:</span>
                        <span class="font-black text-amber-950 px-2 py-0.5 bg-amber-200/70 rounded-lg">${tokenBalance} Token</span>
                    </div>
                    <div class="flex justify-between items-center text-xs pb-2 border-b border-amber-200/60">
                        <span class="text-slate-600 font-medium">Biaya Pembuatan Jadwal:</span>
                        <span class="font-bold text-rose-600">-1 Token</span>
                    </div>
                    <div class="flex justify-between items-center text-xs font-bold">
                        <span class="text-slate-700">Sisa Token Setelah Dibuat:</span>
                        <span class="font-black text-emerald-700">${tokenBalance - 1} Token</span>
                    </div>
                </div>
                <p class="text-xs text-slate-600 leading-relaxed">
                    Membuat 1 jadwal ujian akan memotong <strong>1 token</strong> secara otomatis saat jadwal disimpan. Apakah Anda ingin melanjutkan ke formulir pembuatan jadwal?
                </p>
                <div class="flex gap-2 pt-2">
                    <button type="button" onclick="closeModal()" class="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition">
                        Batal
                    </button>
                    <button type="button" onclick="renderExamModalForm(null, '${eventId || ''}')" class="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer">
                        <span>Lanjutkan Buat Jadwal</span> <i class="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderExamModalForm(editId = null, eventId = null) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    const subjects = appState.subjects || [];
    const classes = appState.classes || [];
    const questionBankGroups = appState.questionBankGroups || [];
    
    let ex = null;
    if (editId) {
        ex = appState.exams.find(e => String(e.id) === String(editId));
    }
    
    tempExamClasses = ex ? [...(ex.classes || [])] : [];
    
    const defaultDate = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4 my-8 max-h-none sm:max-h-none overflow-visible">
                <div class="flex justify-between items-center shrink-0"><h3 class="font-bold text-slate-800">${ex ? 'Edit Jadwal Ujian CBT' : 'Buat Jadwal Ujian CBT'}</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark"></i></button></div>
                <form onsubmit="saveExam(event)" class="space-y-3 text-xs sm:text-sm">
                    <input type="hidden" id="ex-edit-id" value="${editId || ''}">
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Pilih Event Ujian</label>
                        <select id="ex-event-id" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500">
                            ${(appState.exams || []).filter(e => e.recordType === 'EVENT').map(ev => {
                                const isSel = (eventId && String(eventId) === String(ev.id)) || (ex && String(ex.eventId) === String(ev.id)) || (!eventId && !ex && ev.id === 'EV_HARIAN');
                                return `<option value="${ev.id}" ${isSel ? 'selected' : ''}>${ev.title}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div><label class="block text-xs uppercase text-slate-500 mb-1">Nama Ujian</label><input type="text" id="ex-title" value="${ex ? ex.title : ''}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" placeholder="Contoh: UTS Fikih Semester Genap"></div>
                    
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Mata Pelajaran</label>
                        <select id="ex-subject" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" required>
                            ${subjects.map(s => `<option value="${s.name}" ${ex && ex.subject === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Pilih Kelas (Bisa Lebih Dari Satu)</label>
                        <div class="mb-2">
                            <select id="ex-class-dropdown" onchange="addExamClass(this.value)" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-xs sm:text-sm cursor-pointer focus:ring-2 focus:ring-emerald-500">
                                <option value="">-- Pilih Kelas untuk Ditambahkan --</option>
                                <option value="ALL">Semua Kelas / Semua Tingkat</option>
                                ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div id="ex-selected-classes-container" class="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border min-h-[48px] items-center">
                            <span class="text-slate-400 text-xs italic">Belum ada kelas dipilih (Default: Semua Kelas)</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Kode Bank Soal</label>
                            <select id="ex-bank-code" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" required>
                                ${questionBankGroups.map(bg => `<option value="${bg.code}" ${ex && ex.bankCode === bg.code ? 'selected' : ''}>${bg.code} (${bg.code})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label id="q-count-label" class="block text-xs uppercase text-slate-500 mb-1">Jumlah Soal${ex && ex.type === 'pilihan_dan_esay' ? ' Pilihan Ganda' : ''}</label>
                            <input type="number" id="ex-question-count" value="${ex && (ex.questionCount || ex.qCount) ? (ex.questionCount || ex.qCount) : ''}" min="1" placeholder="Kosongkan jika semua (misal: 10)" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div><label class="block text-xs uppercase text-slate-500 mb-1">Durasi (Menit)</label><input type="number" id="ex-duration" value="${ex && ex.duration ? ex.duration : '60'}" min="5" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                        <div><label class="block text-xs uppercase text-slate-500 mb-1">Tanggal</label><input type="date" id="ex-date" value="${ex && ex.date ? ex.date : defaultDate}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                        <div><label class="block text-xs uppercase text-slate-500 mb-1">Waktu Mulai</label><input type="time" id="ex-time" value="${ex && ex.startTime ? ex.startTime : '07:30'}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                        <div><label class="block text-xs uppercase text-slate-500 mb-1">Waktu Selesai (Opsional)</label><input type="time" id="ex-end-time" value="${ex && ex.endTime ? ex.endTime : ''}" placeholder="23:59" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Tipe Soal Ujian</label>
                            <select id="ex-type" onchange="toggleEssayCountField(this.value)" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                                <option value="pilihan_ganda" ${ex && ex.type === 'pilihan_ganda' ? 'selected' : ''}>Pilihan Ganda Saja</option>
                                <option value="esay_saja" ${ex && ex.type === 'esay_saja' ? 'selected' : ''}>Esay Saja</option>
                                <option value="pilihan_dan_esay" ${ex && ex.type === 'pilihan_dan_esay' ? 'selected' : ''}>Pilihan Ganda & Esay</option>
                            </select>
                        </div>
                        <div id="essay-count-container" class="${ex && ex.type === 'pilihan_dan_esay' ? '' : 'hidden'}">
                            <label class="block text-xs uppercase text-slate-500 mb-1">Jumlah Soal Esay</label>
                            <input type="number" id="ex-essay-count" value="${ex && ex.essayCount ? ex.essayCount : ''}" min="1" placeholder="Misal: 5" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Bobot Nilai</label>
                            <select id="ex-weight-type" onchange="toggleCustomWeight(this.value)" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                                <option value="auto" ${ex && ex.weightType === 'auto' ? 'selected' : ''}>Otomatis (Sistem)</option>
                                <option value="custom" ${ex && ex.weightType === 'custom' ? 'selected' : ''}>Kustom Bobot Manual</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Blokir Otomatis Pelanggaran</label>
                            <select id="ex-auto-block" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                                <option value="0" ${ex && ex.autoBlock == 0 ? 'selected' : ''}>Nonaktif (Hanya Peringatan)</option>
                                <option value="3" ${ex && ex.autoBlock == 3 ? 'selected' : ''}>Blokir Setelah 3x Peringatan</option>
                                <option value="5" ${ex && ex.autoBlock == 5 ? 'selected' : ''}>Blokir Setelah 5x Peringatan</option>
                            </select>
                        </div>
                    </div>

                    <div id="custom-weight-fields" class="grid grid-cols-2 gap-3 ${ex && ex.weightType === 'custom' ? '' : 'hidden'}">
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Bobot PG (%)</label>
                            <input type="number" id="ex-weight-pg" value="${ex && ex.weightPg !== undefined ? ex.weightPg : '50'}" min="0" max="100" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                        </div>
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Bobot Esay (%)</label>
                            <input type="number" id="ex-weight-essay" value="${ex && ex.weightEssay !== undefined ? ex.weightEssay : '50'}" min="0" max="100" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                        </div>
                    </div>

                    <div class="space-y-2 pt-2">
                        <label class="flex items-center space-x-2 text-xs text-slate-600">
                            <input type="checkbox" id="ex-shuffle-q" ${ex && ex.shuffleQ ? 'checked' : ''} class="rounded text-emerald-600 focus:ring-emerald-500">
                            <span>Acak Urutan Soal</span>
                        </label>
                        <label class="flex items-center space-x-2 text-xs text-slate-600">
                            <input type="checkbox" id="ex-shuffle-opt" ${ex && ex.shuffleOpt ? 'checked' : ''} class="rounded text-emerald-600 focus:ring-emerald-500">
                            <span>Acak Pilihan Jawaban (Opsi)</span>
                        </label>
                        <label class="flex items-center space-x-2 text-xs text-slate-600">
                            <input type="checkbox" id="ex-show-score" ${ex && ex.showScore ? 'checked' : ''} class="rounded text-emerald-600 focus:ring-emerald-500">
                            <span>Tampilkan Nilai ke Siswa Setelah Selesai</span>
                        </label>
                        <label class="flex items-center space-x-2 text-xs text-slate-600">
                            <input type="checkbox" id="ex-allow-download" ${ex && ex.allowDownloadResult ? 'checked' : ''} class="rounded text-emerald-600 focus:ring-emerald-500">
                            <span>Izinkan Siswa Unduh Hasil Jawaban/Sertifikat</span>
                        </label>
                    </div>

                    <div class="pt-4 flex justify-end space-x-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 text-slate-600 rounded-2xl">Batal</button>
                        <button type="submit" id="btn-save-exam-submit" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl shadow flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-floppy-disk"></i> <span>Simpan Jadwal Ujian</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    renderExamClassChips();
}

function addExamClass(paramVal = null) {
    const dropdown = document.getElementById('ex-class-dropdown');
    const val = paramVal || (dropdown ? dropdown.value : '');
    if (!val) return;
    if (val === 'ALL') {
        tempExamClasses = ['ALL'];
    } else {
        if (tempExamClasses.includes('ALL')) {
            tempExamClasses = [];
        }
        if (!tempExamClasses.includes(val)) {
            tempExamClasses.push(val);
        }
    }
    renderExamClassChips();
    if (dropdown) dropdown.value = '';
}

function removeExamClass(val) {
    tempExamClasses = tempExamClasses.filter(c => c !== val);
    renderExamClassChips();
}

function renderExamClassChips() {
    const container = document.getElementById('ex-selected-classes-container');
    if (!container) return;
    if (tempExamClasses.length === 0) {
        container.innerHTML = `<span class="text-slate-400 text-xs italic">Belum ada kelas dipilih (Default: Semua Kelas)</span>`;
        return;
    }
    const classes = appState.classes || [];
    container.innerHTML = tempExamClasses.map(id => {
        if (id === 'ALL') {
            return `<span class="inline-flex items-center px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">Semua Kelas <button type="button" onclick="removeExamClass('ALL')" class="ml-1.5 text-emerald-600 hover:text-emerald-900 font-bold">&times;</button></span>`;
        }
        const cls = classes.find(c => String(c.id) === String(id));
        const name = cls ? cls.name : id;
        return `<span class="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold">${name} <button type="button" onclick="removeExamClass('${id}')" class="ml-1.5 text-indigo-500 hover:text-indigo-900 font-bold">&times;</button></span>`;
    }).join('');
}

function toggleCustomWeight(val) {
    const container = document.getElementById('custom-weight-fields');
    if (!container) return;
    if (val === 'custom') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}
const toggleCustomWeights = toggleCustomWeight;

function toggleEssayCountField(val) {
    const container = document.getElementById('essay-count-container');
    const qCountLabel = document.getElementById('q-count-label');
    if (!container) return;
    if (val === 'pilihan_dan_esay') {
        container.classList.remove('hidden');
        if (qCountLabel) qCountLabel.textContent = 'Jumlah Soal Pilihan Ganda';
    } else {
        container.classList.add('hidden');
        if (qCountLabel) qCountLabel.textContent = 'Jumlah Soal';
    }
}

async function saveExam(e) {
    e.preventDefault();
    const editId = document.getElementById('ex-edit-id') ? document.getElementById('ex-edit-id').value : '';
    const eventId = document.getElementById('ex-event-id') ? document.getElementById('ex-event-id').value : '';
    const title = document.getElementById('ex-title').value;
    const subject = document.getElementById('ex-subject').value;
    const bankCode = document.getElementById('ex-bank-code').value;
    const duration = document.getElementById('ex-duration').value;
    const date = document.getElementById('ex-date').value;
    const startTime = document.getElementById('ex-time') ? document.getElementById('ex-time').value : '07:30';
    const endTime = document.getElementById('ex-end-time') ? document.getElementById('ex-end-time').value : '';
    const type = document.getElementById('ex-type').value;
    const weightType = document.getElementById('ex-weight-type').value;
    const autoBlock = document.getElementById('ex-auto-block') ? document.getElementById('ex-auto-block').value : 0;
    
    const shuffleQ = document.getElementById('ex-shuffle-q').checked;
    const shuffleOpt = document.getElementById('ex-shuffle-opt').checked;
    const showScore = document.getElementById('ex-show-score').checked;
    const allowDownloadResult = document.getElementById('ex-allow-download') ? document.getElementById('ex-allow-download').checked : false;

    let weightPg = 50;
    let weightEssay = 50;
    if (weightType === 'custom') {
        weightPg = parseFloat(document.getElementById('ex-weight-pg').value) || 0;
        weightEssay = parseFloat(document.getElementById('ex-weight-essay').value) || 0;
    }

    const qCountVal = document.getElementById('ex-question-count')?.value;
    const questionCount = qCountVal && !isNaN(parseInt(qCountVal, 10)) && parseInt(qCountVal, 10) > 0 ? parseInt(qCountVal, 10) : null;

    const essayCountVal = document.getElementById('ex-essay-count')?.value;
    const essayCount = essayCountVal && !isNaN(parseInt(essayCountVal, 10)) && parseInt(essayCountVal, 10) > 0 ? parseInt(essayCountVal, 10) : null;

    const finalClasses = tempExamClasses.length === 0 ? ['ALL'] : tempExamClasses;

    // Token validation and deduction for NEW exams
    if (!editId) {
        const tokenBalance = (typeof window.getActiveMadrasahTokenBalance === 'function')
            ? window.getActiveMadrasahTokenBalance()
            : ((appState.currentUser && appState.currentUser.cbtTokenBalance) || 0);

        if (tokenBalance <= 0) {
            if (window.showToast) window.showToast('Saldo Token Ujian habis (0 Token)! Anda tidak dapat membuat jadwal ujian baru.', 'error');
            openExamModal(null); // Show the blocking popup
            return;
        }

        const role = String(appState.role || '').toLowerCase().trim();
        const isTeacher = role === 'teacher' || role === 'guru';
        const teacherId = isTeacher ? appState.currentUser?.id : null;

        const currentMadrasah = (appState.madrasahs && appState.madrasahs.find(m => String(m.id) === String(appState.currentUser?.madrasahId) || String(m.slug) === String(appState.currentUser?.madrasahSlug))) || (appState.madrasahs && appState.madrasahs[0]) || {};
        const madrasahId = currentMadrasah.id || (appState.currentUser && appState.currentUser.madrasahId) || 'default';

        try {
            const deductRes = await fetch('/api/deduct-cbt-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ madrasahId, teacherId, amount: 1 })
            });
            const deductData = await deductRes.json();
            if (!deductData.success) {
                if (window.showToast) window.showToast(deductData.message || 'Gagal mengonsumsi token ujian.', 'error');
                return;
            }
            const remaining = typeof deductData.remainingTokens === 'number' ? deductData.remainingTokens : (typeof deductData.cbtTokenBalance === 'number' ? deductData.cbtTokenBalance : 0);
            if (isTeacher) {
                if (appState.currentUser) {
                    appState.currentUser.cbtTokenBalance = remaining;
                    if (window.safeSetLocalStorage) window.safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                }
                if (appState.teachers && appState.currentUser) {
                    const tchIdx = appState.teachers.findIndex(t => String(t.id) === String(appState.currentUser.id));
                    if (tchIdx >= 0) appState.teachers[tchIdx].cbtTokenBalance = remaining;
                }
            } else {
                if (currentMadrasah) currentMadrasah.cbtTokenBalance = remaining;
                if (appState.madrasah) appState.madrasah.cbtTokenBalance = remaining;
                if (appState.currentUser) appState.currentUser.cbtTokenBalance = remaining;
            }
            if (window.updateHeaderTokenBadge) window.updateHeaderTokenBadge();
        } catch (err) {
            console.error('Error deduct token:', err);
            if (window.showToast) window.showToast('Gagal memproses konsumsi token ke server.', 'error');
            return;
        }
    }

    const examData = {
        title,
        eventId,
        subject,
        bankCode,
        questionCount,
        qCount: questionCount,
        essayCount,
        duration,
        date,
        startTime,
        endTime,
        type,
        weightType,
        weightPg,
        weightEssay,
        autoBlock,
        classes: finalClasses,
        shuffleQ,
        shuffleOpt,
        showScore,
        allowDownloadResult,
        status: 'Active'
    };

    if (editId) {
        const idx = appState.exams.findIndex(ex => String(ex.id) === String(editId));
        if (idx !== -1) {
            const oldExam = appState.exams[idx];
            const originalStatus = oldExam.status || 'Active';
            const oldDuration = parseInt(oldExam.duration || 60, 10);
            const newDuration = parseInt(duration || 60, 10);
            const durationDiffSec = (newDuration - oldDuration) * 60;

            // Preserve all active sessions and dynamically extend timeLeft if duration was increased
            if (!appState.activeExamSessions) {
                appState.activeExamSessions = JSON.parse(localStorage.getItem('madrasah_active_exam_sessions')) || {};
            }
            const batchToSync = {};
            let extendedCount = 0;
            Object.keys(appState.activeExamSessions).forEach(sessKey => {
                const sess = appState.activeExamSessions[sessKey];
                if (!sess) return;
                const isMatch = String(sess.examId) === String(editId) || sessKey.endsWith('_' + editId) || (sess.exam && String(sess.exam.id) === String(editId));
                if (isMatch) {
                    if (durationDiffSec > 0) {
                        sess.timeLeft = Math.max(10, (sess.timeLeft || 0) + durationDiffSec);
                        sess.duration = newDuration;
                        sess.extraTimeAdded = (sess.extraTimeAdded || 0) + durationDiffSec;
                        if (sess.exam) sess.exam.duration = newDuration;
                        batchToSync[sessKey] = sess;
                        extendedCount++;
                    } else {
                        sess.duration = newDuration;
                        if (sess.exam) sess.exam.duration = newDuration;
                        batchToSync[sessKey] = sess;
                    }
                }
            });

            if (Object.keys(batchToSync).length > 0) {
                safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
                fetch('/api/exam-monitoring-state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activeExamSessionsBatch: batchToSync })
                }).catch(err => console.warn('Error syncing active exam session duration:', err));
            }

            appState.exams[idx] = { 
                ...oldExam, 
                ...examData, 
                status: originalStatus,
                addedTimeSec: (oldExam.addedTimeSec || 0) + (durationDiffSec > 0 ? durationDiffSec : 0),
                lastScheduleEdit: Date.now()
            };

            if (durationDiffSec > 0) {
                showToast(`Jadwal ujian diperbarui! Durasi bertambah ${Math.round(durationDiffSec / 60)} menit & waktu pengerjaan ${extendedCount} siswa aktif otomatis bertambah.`, 'success');
            } else {
                showToast('Jadwal ujian berhasil diperbarui! Seluruh data pengerjaan, nilai, dan siswa tetap aman terjaga.', 'success');
            }
        }
    } else {
        appState.exams.push({ id: 'EX' + Date.now(), ...examData, createdAt: new Date().toISOString() });
        showToast('Jadwal ujian CBT berhasil dibuat! 1 Token Ujian telah dikonsumsi.', 'success');
    }

    saveState('exams');
    fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appState.exams)
    }).catch(err => console.warn('Error syncing exams API:', err));

    closeModal();
    renderAssessmentModule(document.getElementById('view-container'), 'jadwal');
}

function deleteExam(id) {
    showConfirmModal('Apakah Anda yakin ingin menghapus jadwal ujian ini?', () => {
        appState.exams = (appState.exams || []).filter(e => String(e.id) !== String(id));
        saveState('exams');
        fetch(`/api/exams/${id}`, { method: 'DELETE' }).catch(err => console.warn('Error deleting exam API:', err));
        showToast('Jadwal ujian berhasil dihapus!', 'success');
        renderAssessmentModule(document.getElementById('view-container'), 'jadwal');
    });
}

function getExamScheduleInfo(ex) {
    if (!ex) return { status: 'open', canStart: true, message: 'Ujian Aktif' };
    if (!ex.date) return { status: 'open', canStart: true, message: 'Ujian Aktif' };

    let year = 0, month = 0, day = 0;
    const dateStr = String(ex.date).trim();
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
    } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts[0].length === 4) { // YYYY/MM/DD
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[2], 10);
        } else { // DD/MM/YYYY
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
        }
    }

    if (!year || isNaN(month) || !day) {
        return { status: 'open', canStart: true, message: 'Ujian Aktif' };
    }

    let startHour = 7, startMinute = 30;
    if (ex.startTime && String(ex.startTime).includes(':')) {
        const tParts = String(ex.startTime).split(':');
        startHour = parseInt(tParts[0], 10) || 0;
        startMinute = parseInt(tParts[1], 10) || 0;
    }

    const startDate = new Date(year, month, day, startHour, startMinute, 0, 0);

    let endYear = year, endMonth = month, endDay = day;
    if (ex.endDate && String(ex.endDate).trim().includes('-')) {
        const eParts = String(ex.endDate).trim().split('-');
        endYear = parseInt(eParts[0], 10);
        endMonth = parseInt(eParts[1], 10) - 1;
        endDay = parseInt(eParts[2], 10);
    }

    let endHour = 23, endMinute = 59, endSecond = 59;
    if (ex.endTime && String(ex.endTime).includes(':')) {
        const eParts = String(ex.endTime).split(':');
        endHour = parseInt(eParts[0], 10) || 23;
        endMinute = parseInt(eParts[1], 10) || 59;
        endSecond = 0;
    }

    const endDate = new Date(endYear, endMonth, endDay, endHour, endMinute, endSecond, 999);

    const now = new Date();
    const nowMs = now.getTime();
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    if (nowMs < startMs) {
        const formattedDate = `${day < 10 ? '0' + day : day}/${(month + 1) < 10 ? '0' + (month + 1) : (month + 1)}/${year}`;
        const formattedTime = `${startHour < 10 ? '0' + startHour : startHour}:${startMinute < 10 ? '0' + startMinute : startMinute}`;
        return {
            status: 'not_started',
            canStart: false,
            message: `Belum Dimulai (Jadwal: ${ex.date || formattedDate} jam ${ex.startTime || formattedTime})`,
            startDate,
            endDate
        };
    } else if (nowMs > endMs) {
        return {
            status: 'expired',
            canStart: false,
            message: `Jadwal Berakhir (Sampai ${ex.endDate || ex.date} ${ex.endTime || '23:59'})`,
            startDate,
            endDate
        };
    } else {
        return {
            status: 'open',
            canStart: true,
            message: 'Ujian Aktif / Siap Dikerjakan',
            startDate,
            endDate
        };
    }
}

window.getExamScheduleInfo = getExamScheduleInfo;

window.showScheduleNotStartedAlert = function(examId) {
    const ex = (appState.exams || []).find(e => String(e.id) === String(examId));
    if (!ex) return;
    const modal = document.getElementById('modal-container');
    if (modal) {
        modal.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 text-center space-y-4">
                    <div class="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">Ujian Belum Bisa Dikerjakan</h3>
                        <p class="text-xs text-slate-500 mt-1">Ujian ini dijadwalkan pada waktu tertentu.</p>
                    </div>
                    <div class="bg-sky-50 border border-sky-100 p-4 rounded-2xl text-xs text-sky-800 text-left space-y-1.5">
                        <p><span class="font-bold">Mata Pelajaran:</span> ${ex.subject || '-'}</p>
                        <p><span class="font-bold">Judul Ujian:</span> ${ex.title}</p>
                        <p><span class="font-bold">Tanggal Ujian:</span> ${ex.date || '-'}</p>
                        <p><span class="font-bold">Waktu Mulai:</span> ${ex.startTime || '07:30'} WIB</p>
                    </div>
                    <p class="text-xs text-slate-400">Silakan kembali saat waktu ujian telah tiba sesuai jadwal di atas.</p>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-2xl text-xs transition cursor-pointer">Mengerti</button>
                </div>
            </div>
        `;
    }
};

window.showScheduleExpiredAlert = function(examId) {
    const ex = (appState.exams || []).find(e => String(e.id) === String(examId));
    if (!ex) return;
    const modal = document.getElementById('modal-container');
    if (modal) {
        modal.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
                <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 text-center space-y-4">
                    <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                        <i class="fa-solid fa-calendar-xmark"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">Jadwal Ujian Telah Berakhir</h3>
                        <p class="text-xs text-slate-500 mt-1">Batas waktu pelaksanaan ujian ini sudah melewati jadwal.</p>
                    </div>
                    <div class="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-xs text-rose-800 text-left space-y-1.5">
                        <p><span class="font-bold">Mata Pelajaran:</span> ${ex.subject || '-'}</p>
                        <p><span class="font-bold">Judul Ujian:</span> ${ex.title}</p>
                        <p><span class="font-bold">Tanggal Pelaksanaan:</span> ${ex.date || '-'}</p>
                        <p><span class="font-bold">Waktu Mulai:</span> ${ex.startTime || '07:30'} WIB</p>
                        ${ex.endTime ? `<p><span class="font-bold">Batas Waktu Selesai:</span> ${ex.endTime} WIB</p>` : ''}
                    </div>
                    <p class="text-xs text-slate-400">Apabila Anda belum mengerjakan, silakan hubungi guru / proktor untuk memperbarui jadwal ujian.</p>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="w-full py-3 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-2xl text-xs transition cursor-pointer">Tutup</button>
                </div>
            </div>
        `;
    }
};

window.openStudentExamReviewModal = function(examId) {
    const ex = (appState.exams || []).find(e => String(e.id) === String(examId));
    if (!ex) {
        showToast('Ujian tidak ditemukan!', 'error');
        return;
    }
    const currUser = appState.currentUser || {};
    const st = (appState.students || []).find(s => 
        String(s.id) === String(currUser.id) || 
        (currUser.username && String(s.username).toLowerCase() === String(currUser.username).toLowerCase()) ||
        (currUser.nis && String(s.nis) === String(currUser.nis)) ||
        (currUser.id && String(s.id).toLowerCase() === String(currUser.id).toLowerCase())
    ) || currUser || {};

    const stId = st.id || currUser.id || '';
    const key1 = stId + '_' + ex.id;
    const key2 = String(stId) + '_' + String(ex.id);
    
    // Retrieve student exam questions
    const questions = getExamQuestions(ex, st.id);
    const answers = (appState.studentExamAnswers && (appState.studentExamAnswers[key1] || appState.studentExamAnswers[key2])) || {};
    const grades = appState.studentExamGrades || {};
    const gr = grades[key1] || grades[key2];
    const scoreText = gr ? (gr.finalScore !== null && gr.finalScore !== undefined ? `${gr.finalScore} / 100` : 'Sedang Dikoreksi') : 'Belum Dinilai / Ujian Tidak Dikerjakan';

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    let questionItemsHtml = '';
    if (!questions || questions.length === 0) {
        questionItemsHtml = `
            <div class="p-8 text-center text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <i class="fa-solid fa-folder-open text-4xl mb-2 text-slate-300"></i>
                <p class="text-xs font-bold">Tidak ada soal yang terdata pada ujian ini.</p>
            </div>
        `;
    } else {
        questionItemsHtml = questions.map((q, idx) => {
            const studentAns = answers[q.id] !== undefined ? answers[q.id] : answers[String(q.id)];
            const hasAnswered = studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '';
            
            let isCorrect = false;
            let statusBadge = '';
            
            if (q.type === 'esay' || q.type === 'essay') {
                statusBadge = `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-xl text-[10px] font-bold">Soal Esay</span>`;
            } else {
                isCorrect = isCorrectAnswer(q, studentAns);
                if (hasAnswered) {
                    statusBadge = isCorrect 
                        ? `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-[10px] font-bold"><i class="fa-solid fa-circle-check mr-1"></i> Benar</span>`
                        : `<span class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-xl text-[10px] font-bold"><i class="fa-solid fa-circle-xmark mr-1"></i> Salah</span>`;
                } else {
                    statusBadge = `<span class="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-bold"><i class="fa-solid fa-circle-minus mr-1"></i> Tidak Dijawab</span>`;
                }
            }

            // Options display
            let optionsHtml = '';
            if (q.type !== 'esay' && q.type !== 'essay') {
                const opts = q.options || [];
                optionsHtml = `
                    <div class="grid grid-cols-1 gap-2.5 mt-3">
                        ${opts.map((opt, oIdx) => {
                            const optLetter = String.fromCharCode(65 + oIdx);
                            const isStudentSelection = String(studentAns).trim().toLowerCase() === optLetter.toLowerCase() || String(studentAns).trim() === String(opt).trim();
                            const isCorrectOpt = isOptionAnswerKey(q, opt) || String(q.answer || '').trim().toLowerCase() === optLetter.toLowerCase();
                            
                            let optClass = 'bg-slate-50 border-slate-200 text-slate-700';
                            let iconHtml = `<span class="w-6 h-6 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-black">${optLetter}</span>`;
                            
                            if (isCorrectOpt) {
                                optClass = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold';
                                iconHtml = `<span class="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black"><i class="fa-solid fa-check"></i></span>`;
                            } else if (isStudentSelection) {
                                optClass = 'bg-rose-50 border-rose-300 text-rose-950 font-semibold';
                                iconHtml = `<span class="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center text-xs font-black"><i class="fa-solid fa-xmark"></i></span>`;
                            }
                            
                            return `
                                <div class="p-3 rounded-2xl border flex items-center gap-3 text-xs transition ${optClass}">
                                    ${iconHtml}
                                    <div class="flex-1 leading-relaxed">${opt}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                // Essay
                optionsHtml = `
                    <div class="mt-3 space-y-2">
                        <p class="text-[10px] uppercase tracking-wider font-bold text-slate-400">Jawaban Anda:</p>
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-wrap">
                            ${studentAns || '<span class="text-slate-400 italic font-normal">Tidak ada jawaban esay yang diserahkan.</span>'}
                        </div>
                    </div>
                `;
            }

            // Image display
            const imgHtml = (q.imageUrl || q.image) ? `
                <div class="mt-3">
                    <img src="${q.imageUrl || q.image}" class="max-h-48 rounded-2xl border border-slate-200 object-contain bg-slate-50 p-1" />
                </div>
            ` : '';

            // Explanation
            const explain = q.explanation || q.explain || q.pembahasan;
            const explainHtml = explain ? `
                <div class="mt-4 p-4 bg-indigo-50/50 border border-indigo-100/60 rounded-2xl text-xs space-y-1">
                    <p class="font-extrabold text-indigo-950 flex items-center gap-1.5"><i class="fa-solid fa-circle-info text-indigo-600"></i> Pembahasan / Penjelasan:</p>
                    <p class="text-indigo-900 leading-relaxed font-medium">${explain}</p>
                </div>
            ` : '';

            return `
                <div class="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs space-y-3">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <span class="px-3 py-1 bg-slate-800 text-white rounded-xl text-[10px] font-black">Soal No. ${idx + 1}</span>
                        ${statusBadge}
                    </div>
                    
                    <div class="text-xs font-bold text-slate-800 leading-relaxed">${q.question || q.text || ''}</div>
                    
                    ${imgHtml}
                    ${optionsHtml}
                    ${explainHtml}
                </div>
            `;
        }).join('');
    }

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6">
            <div class="bg-slate-50 w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-fade-in">
                <!-- Header -->
                <div class="p-5 sm:p-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                    <div>
                        <h3 class="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                            <i class="fa-solid fa-graduation-cap text-indigo-600"></i> Review Lembar Kerja & Soal Ujian
                        </h3>
                        <p class="text-[11px] text-slate-500 font-medium mt-0.5">${ex.title} &nbsp;|&nbsp; Mapel: ${ex.subject || '-'}</p>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="w-9 h-9 bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-500 rounded-full flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Info Banner -->
                <div class="bg-white px-5 sm:px-6 py-4 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0 text-xs font-bold text-slate-700">
                    <div class="space-y-0.5">
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nama Peserta</p>
                        <p class="text-slate-900 font-black truncate">${st.name || currUser.name || 'Siswa Contoh'}</p>
                    </div>
                    <div class="space-y-0.5">
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kelas</p>
                        <p class="text-slate-900 font-black">${st.className || 'Semua Kelas'}</p>
                    </div>
                    <div class="space-y-0.5">
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Soal</p>
                        <p class="text-slate-900 font-black">${questions.length} Butir Soal</p>
                    </div>
                    <div class="space-y-0.5">
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nilai Perolehan</p>
                        <p class="text-emerald-700 font-black text-sm">${scoreText}</p>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4" id="exam-review-scroll-container">
                    ${questionItemsHtml}
                </div>

                <!-- Footer -->
                <div class="p-4 sm:p-5 bg-white border-t border-slate-200 flex justify-end shrink-0">
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer">
                        Selesai Meninjau
                    </button>
                </div>
            </div>
        </div>
    `;

    // Process KaTeX math typesetting
    if (window.renderMathInElementSafely) {
        window.renderMathInElementSafely(document.getElementById('exam-review-scroll-container'));
    }
};

async function renderStudentCBTList(container, isRefresh = false) {
    if (!container) return;

    // Helper to get current student context consistently
    const currUser = appState.currentUser || {};
    const st = (appState.students || []).find(s => 
        String(s.id) === String(currUser.id) || 
        (currUser.username && String(s.username).toLowerCase() === String(currUser.username).toLowerCase()) ||
        (currUser.nis && String(s.nis) === String(currUser.nis)) ||
        (currUser.id && String(s.id).toLowerCase() === String(currUser.id).toLowerCase())
    ) || currUser || {};

    // 1. If an exam session is actively running for this student, stay in active exam view!
    if (activeExamSession && activeExamSession.exam && activeExamSession.timeLeft > 0) {
        renderActiveExamScreen();
        return;
    }

    // Clean up streams only if no active exam session is running
    if (window.__studentWebcamStream) {
        if (window.stopCameraStreamTrack) {
            window.stopCameraStreamTrack(window.__studentWebcamStream);
        } else {
            try {
                window.__studentWebcamStream.getTracks().forEach(t => t.stop());
            } catch(e) {}
        }
        window.__studentWebcamStream = null;
    }
    try { stopStudentLiveKit(); } catch(e){}
    const pipContainer = document.getElementById('student-pip-container');
    if (pipContainer) pipContainer.remove();
    if (window.__examTimerInterval) {
        clearInterval(window.__examTimerInterval);
        window.__examTimerInterval = null;
    }
    activeExamSession = null;
    
    // Performance Optimization: Non-blocking data refresh
    // We fetch fresh data in the background while showing the student the list instantly
    const refreshData = async () => {
        try {
            const stId = String(st.id || currUser.id || '');
            const [exRes, lkRes, mySumRes] = await Promise.all([
                fetch('/api/exams').then(r => r.json()).catch(() => ({ success: false })),
                fetch('/api/lkpds').then(r => r.json()).catch(() => ({ success: false })),
                stId ? fetch(`/api/exam/my-summary?studentId=${encodeURIComponent(stId)}`).then(r => r.json()).catch(() => ({ success: false })) : Promise.resolve({ success: false })
            ]);
            
            let changed = false;
            if (exRes.success) { appState.exams = exRes.exams || []; changed = true; }
            if (lkRes.success) { appState.lkpdList = lkRes.lkpdList || []; changed = true; }
            if (mySumRes.success) {
                if (!appState.completedExams) appState.completedExams = {};
                if (Array.isArray(mySumRes.completedExams)) {
                    mySumRes.completedExams.forEach(eId => {
                        const key = stId + '_' + eId;
                        appState.completedExams[key] = true;
                    });
                }
                if (mySumRes.completedMap) {
                    appState.completedExams = { ...appState.completedExams, ...mySumRes.completedMap };
                }
                if (mySumRes.grades) {
                    appState.studentExamGrades = { ...(appState.studentExamGrades || {}), ...mySumRes.grades };
                }
                if (mySumRes.activeSessions) {
                    const localSessions = JSON.parse(localStorage.getItem('madrasah_active_exam_sessions')) || {};
                    appState.activeExamSessions = { ...localSessions, ...(appState.activeExamSessions || {}), ...mySumRes.activeSessions };
                }
                changed = true;
            }
            if (changed) {
                // If data changed significantly, re-render to show updates
                const containerNow = document.getElementById('view-container');
                if (containerNow && containerNow.querySelector('h1')?.innerText?.includes('Ujian')) {
                    renderStudentCBTList(containerNow, true);
                }
            }
        } catch (e) {}
    };

    if (!isRefresh) {
        refreshData(); 
    }

    const stClassId = String(st.classId || st.class_id || st.class || currUser.classId || currUser.class_id || '').trim();
    const stClassObj = (appState.classes || []).find(c => 
        String(c.id).toLowerCase() === stClassId.toLowerCase() || 
        String(c.name).toLowerCase() === stClassId.toLowerCase()
    );
    const stClassName = stClassObj ? stClassObj.name : '';

    if (!appState.completedExams) appState.completedExams = JSON.parse(localStorage.getItem('madrasah_completed_exams')) || {};
    if (!appState.activeExamSessions) appState.activeExamSessions = JSON.parse(localStorage.getItem('madrasah_active_exam_sessions')) || {};

    // Match any active exam session key corresponding to this student (by ID, username, or NIS)
    const possiblePrefixes = [
        (st.id || '') + '_',
        (currUser.id || '') + '_',
        (currUser.username || '') + '_',
        (st.username || '') + '_'
    ].filter(p => p.length > 1);

    const activeSessionKeys = Object.keys(appState.activeExamSessions || {});
    const currentActiveExamKey = activeSessionKeys.find(k => possiblePrefixes.some(pref => k.startsWith(pref)));

    if (currentActiveExamKey) {
        const exId = currentActiveExamKey.split('_')[1];
        const exExists = (appState.exams || []).find(e => String(e.id) === String(exId));
        if (exExists) {
            startStudentExam(exId);
            return;
        } else {
            delete appState.activeExamSessions[currentActiveExamKey];
            safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
        }
    }

    // Filter exams assigned to ALL or to the student's specific class (exclude event containers)
    const displayExams = (appState.exams || []).filter(ex => {
        if (ex.recordType === 'EVENT') return false;
        if (!ex.classes || !Array.isArray(ex.classes) || ex.classes.length === 0) return true;
        const clsArr = ex.classes;
        if (clsArr.includes('ALL') || clsArr.includes('Semua Kelas')) return true;
        if (!stClassId && !stClassName) return true; // If student class is unassigned, show exams so list isn't blank
        return clsArr.some(c => {
            const cStr = String(c).toLowerCase().trim();
            return cStr === 'all' ||
                   cStr === 'semua kelas' ||
                   cStr === stClassId.toLowerCase() || 
                   (stClassName && cStr === stClassName.toLowerCase()) || 
                   (stClassObj && cStr === String(stClassObj.id).toLowerCase());
        });
    });

    // Fetch LKPDs assigned to student class & active
    let studentLkpds = [];
    try {
        const storageKey = typeof window.getLkpdStorageKey === 'function' ? window.getLkpdStorageKey() : 'madrasah_lkpdList';
        const lkpdList = typeof initLkpdState === 'function' ? initLkpdState() : (JSON.parse(localStorage.getItem(storageKey)) || []);
        studentLkpds = (lkpdList || []).filter(lk => {
            if (lk.status === 'inactive') return false;
            const rawClassId = String(lk.classId || '').toLowerCase().trim();
            const rawClassName = String(lk.className || '').toLowerCase().trim();
            
            if (!lk.classId || rawClassId === 'all' || rawClassName === 'semua kelas') return true;
            if (!stClassId && !stClassName) return true;
            
            const sIdStr = stClassId.toLowerCase();
            const sNameStr = (stClassName || '').toLowerCase().trim();

            return rawClassId === 'all' ||
                   rawClassId === 'semua kelas' ||
                   rawClassId === sIdStr ||
                   rawClassName === sIdStr ||
                   (sNameStr && rawClassName === sNameStr) ||
                   (sNameStr && rawClassId === sNameStr) ||
                   (stClassObj && rawClassId === String(stClassObj.id).toLowerCase());
        });
    } catch(e) {
        console.warn('Gagal memuat LKPD:', e);
    }

    // Sort newest created exams first
    displayExams.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (tA && tB && tA !== tB) return tB - tA;
        return (appState.exams.indexOf(b) - appState.exams.indexOf(a));
    });

    // 1. Helper to check LKPD expiry (by date only)
    const isLkpdExpired = (lk) => {
        if (!lk.date) return false;
        const now = new Date();
        now.setHours(0,0,0,0);
        let lkDate;
        if (lk.date.includes('-')) {
            const p = lk.date.split('-');
            lkDate = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
        } else {
            return false;
        }
        lkDate.setHours(0,0,0,0);
        return lkDate.getTime() < now.getTime();
    };

    const activeCards = [];
    const historyCards = [];

    displayExams.forEach(ex => {
        const stId = st.id || currUser.id || '';
        const key1 = stId + '_' + ex.id;
        const key2 = String(stId) + '_' + String(ex.id);

        const isDone = Boolean(
            (appState.completedExams && (appState.completedExams[key1] || appState.completedExams[key2])) ||
            (localStorage.getItem('madrasah_completed_exams') && (JSON.parse(localStorage.getItem('madrasah_completed_exams'))[key1] || JSON.parse(localStorage.getItem('madrasah_completed_exams'))[key2]))
        );

        const activeSessions = appState.activeExamSessions || JSON.parse(localStorage.getItem('madrasah_active_exam_sessions') || '{}') || {};
        const hasActiveSession = Boolean(
            (activeSessions[key1] && activeSessions[key1].status === 'active' && activeSessions[key1].timeLeft > 0) ||
            (activeSessions[key2] && activeSessions[key2].status === 'active' && activeSessions[key2].timeLeft > 0)
        );

        const schedInfo = getExamScheduleInfo(ex);

        const grades = appState.studentExamGrades || JSON.parse(localStorage.getItem('madrasah_student_exam_grades') || '{}') || {};
        const gr = grades[key1] || grades[key2];
        const scoreText = gr ? (gr.finalScore !== null && gr.finalScore !== undefined ? `Nilai: ${gr.finalScore}` : 'Nilai: Sedang Dikoreksi') : 'Selesai';

        let badgeHtml = '';
        let actionBtnHtml = '';
        let statusNoticeHtml = '';

        if (isDone) {
            badgeHtml = `<span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold">Sudah Dikerjakan</span>`;
            let downloadBtnHtml = '';
            if (ex.allowDownloadResult) {
                downloadBtnHtml = `
                    <button type="button" onclick="downloadStudentExamPDF('${ex.id}')" class="mt-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm">
                        <i class="fa-solid fa-file-pdf"></i> Download Hasil Ujian
                    </button>
                `;
            }
            actionBtnHtml = `
                <div class="space-y-2 w-full">
                    <div class="p-3 bg-slate-50 rounded-2xl text-xs font-bold text-emerald-700 text-center border border-slate-100">✓ Ujian Selesai. ${scoreText}</div>
                    <button type="button" onclick="window.openStudentExamReviewModal('${ex.id}')" class="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-200">
                        <i class="fa-solid fa-eye"></i> Lihat & Review Soal
                    </button>
                    ${downloadBtnHtml}
                </div>
            `;
        } else if (hasActiveSession) {
            badgeHtml = `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-xl text-[10px] font-bold animate-pulse">Sedang Berlangsung</span>`;
            actionBtnHtml = `<button type="button" onclick="confirmStartStudentExam('${ex.id}')" class="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl text-xs shadow transition cursor-pointer flex items-center justify-center gap-1.5"><i class="fa-solid fa-play"></i> Lanjutkan Ujian</button>`;
        } else if (!schedInfo.canStart) {
            if (schedInfo.status === 'not_started') {
                badgeHtml = `<span class="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-xl text-[10px] font-bold">Belum Dimulai</span>`;
                actionBtnHtml = `<button type="button" onclick="showScheduleNotStartedAlert('${ex.id}')" class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"><i class="fa-solid fa-lock text-sky-600"></i> Belum Waktu Ujian</button>`;
                statusNoticeHtml = `<div class="p-2.5 bg-sky-50 border border-sky-100 rounded-2xl text-[11px] text-sky-700 flex items-center gap-1.5"><i class="fa-solid fa-clock text-sky-500"></i> Dimulai tanggal <b>${ex.date || '-'}</b> pukul <b>${ex.startTime || '07:30'} WIB</b></div>`;
            } else {
                badgeHtml = `<span class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-xl text-[10px] font-bold">Jadwal Berakhir</span>`;
                actionBtnHtml = `
                    <div class="space-y-2 w-full">
                        <button type="button" onclick="showScheduleExpiredAlert('${ex.id}')" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-semibold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"><i class="fa-solid fa-calendar-xmark text-rose-500"></i> Jadwal Sudah Lewat</button>
                        <button type="button" onclick="window.openStudentExamReviewModal('${ex.id}')" class="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-eye"></i> Lihat Soal Ujian
                        </button>
                    </div>
                `;
                statusNoticeHtml = `<div class="p-2.5 bg-rose-50 border border-rose-100 rounded-2xl text-[11px] text-rose-700 flex items-center gap-1.5"><i class="fa-solid fa-triangle-exclamation text-rose-500"></i> Batas jadwal pelaksanaan ujian ini telah berakhir</div>`;
            }
        } else {
            badgeHtml = `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-[10px] font-bold">Ujian Aktif</span>`;
            actionBtnHtml = `<button type="button" onclick="confirmStartStudentExam('${ex.id}')" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-xs shadow transition cursor-pointer flex items-center justify-center gap-1.5"><i class="fa-solid fa-pen-to-square"></i> Kerjakan Ujian</button>`;
        }

        const html = `
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 flex flex-col justify-between hover:border-emerald-200 transition">
                <div>
                    <div class="flex justify-between items-start gap-2">
                        ${badgeHtml}
                        <span class="text-xs font-mono text-slate-400"><i class="fa-solid fa-clock mr-1 text-slate-400"></i>${ex.duration} Menit</span>
                    </div>
                    <h3 class="font-bold text-slate-800 text-lg mt-2">${ex.title}</h3>
                    <p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-calendar-days mr-1.5 text-emerald-600"></i>${ex.date || '-'} &nbsp;|&nbsp; <i class="fa-solid fa-clock mr-1 text-emerald-600"></i>${ex.startTime || '07:30'}${ex.endTime ? ' - ' + ex.endTime : ''} WIB</p>
                    ${ex.subject ? `<p class="text-xs text-slate-400 mt-1 font-medium"><i class="fa-solid fa-book mr-1.5 text-slate-400"></i>${ex.subject}</p>` : ''}
                    ${statusNoticeHtml ? `<div class="mt-3">${statusNoticeHtml}</div>` : ''}
                </div>
                ${actionBtnHtml}
            </div>
        `;

        if (isDone || schedInfo.status === 'expired') {
            historyCards.push(html);
        } else {
            activeCards.push(html);
        }
    });

    studentLkpds.forEach(lk => {
        const safeStId = String(st.id || currUser.id || '');
        const safeStName = String(st.name || currUser.name || currUser.username || '').toLowerCase();
        
        const isLkpdDone = (lk.submissions || []).some(s => 
            String(s.studentId) === safeStId || 
            (safeStName && String(s.studentName || '').toLowerCase() === safeStName)
        );
        const sub = (lk.submissions || []).find(s => 
            String(s.studentId) === safeStId || 
            (safeStName && String(s.studentName || '').toLowerCase() === safeStName)
        );
        const scoreStr = sub && sub.score !== undefined ? `Nilai: ${sub.score}` : 'Selesai';
        const expired = isLkpdExpired(lk);

        const html = `
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4 flex flex-col justify-between hover:border-teal-200 transition">
                <div>
                    <div class="flex justify-between items-start gap-2">
                        <span class="px-2.5 py-1 bg-teal-100 text-teal-800 rounded-xl text-[10px] font-bold">LKPD Interaktif</span>
                        <span class="text-xs font-mono text-slate-400"><i class="fa-solid fa-clock mr-1 text-slate-400"></i>${lk.durationMinutes || 45} Menit</span>
                    </div>
                    <h3 class="font-bold text-slate-800 text-lg mt-2">${lk.title}</h3>
                    <p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-calendar-days mr-1.5 text-teal-600"></i>${lk.date || '-'} &nbsp;|&nbsp; <i class="fa-solid fa-book mr-1.5 text-teal-600"></i>${lk.subjectName || lk.subjectId || 'Mata Pelajaran'} &nbsp;|&nbsp; <i class="fa-solid fa-users mr-1 text-teal-600"></i>${lk.className || 'Kelas'}</p>
                    <p class="text-xs text-slate-400 mt-2 line-clamp-2">${lk.description || 'Lembar kerja peserta didik interaktif.'}</p>
                </div>
                ${isLkpdDone ? `
                    <div class="space-y-2 w-full">
                        <div class="p-3 bg-slate-50 rounded-2xl text-xs font-bold text-teal-700 text-center border border-slate-100">✓ LKPD Selesai. ${scoreStr}</div>
                        ${sub && sub.isGraded ? `
                            <button type="button" onclick="window.downloadLkpdStudentPdf('${lk.id}', '${safeStId}')" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm">
                                <i class="fa-solid fa-file-pdf"></i> Download Hasil LKPD
                            </button>
                        ` : ''}
                        <button type="button" onclick="window.openStudentLkpdWorksheetModal('${lk.id}', '${safeStId}')" class="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-eye"></i> Lihat Hasil Pengerjaan
                        </button>
                    </div>
                ` : (expired ? `
                     <div class="space-y-2 w-full">
                        <div class="p-3 bg-rose-50 rounded-2xl text-xs font-bold text-rose-700 text-center border border-rose-100"><i class="fa-solid fa-calendar-xmark mr-1.5"></i> Batas Waktu Terlewati</div>
                        <button type="button" onclick="window.openStudentLkpdWorksheetModal('${lk.id}', '${safeStId}')" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-eye"></i> Lihat Soal LKPD
                        </button>
                    </div>
                ` : `
                    <button type="button" onclick="openStudentLkpdWorksheetModal('${lk.id}', '${st.id}')" class="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-2xl text-xs shadow transition cursor-pointer flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-pen-nib"></i> Kerjakan LKPD
                    </button>
                `)}
            </div>
        `;

        if (isLkpdDone || expired) {
            historyCards.push(html);
        } else {
            activeCards.push(html);
        }
    });

    const activeSectionHtml = activeCards.length > 0 ? `
        <div class="space-y-4">
            <h2 class="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                <span class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><i class="fa-solid fa-calendar-check"></i></span>
                Jadwal Ujian & LKPD Aktif
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${activeCards.join('')}
            </div>
        </div>
    ` : '';

    const historySectionHtml = historyCards.length > 0 ? `
        <div class="space-y-4 pt-6 border-t border-slate-100">
            <div class="flex items-center justify-between">
                <h2 class="text-sm font-black text-slate-500 flex items-center gap-2 uppercase tracking-wider">
                    <span class="w-8 h-8 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center"><i class="fa-solid fa-clock-rotate-left"></i></span>
                    Kartu Jadwal yang Sudah Dikerjakan / Selesai
                </h2>
                <span class="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">${historyCards.length} Item Terdata</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${historyCards.join('')}
            </div>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="space-y-6 pb-8">
            <!-- Back to Dashboard Header -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-2">
                <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="flex items-center gap-2 text-slate-600 hover:text-slate-850 transition font-bold text-xs sm:text-sm cursor-pointer">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>Kembali ke Dashboard Utama</span>
                </button>
                <span class="text-xs font-bold text-slate-400">Portal Ujian CBT & LKPD</span>
            </div>

            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800">CBT / Ujian Online & LKPD Murid</h1>
                    <p class="text-xs text-slate-400 mt-0.5">Daftar ujian dan LKPD aktif yang siap dikerjakan untuk kelas: <span class="font-bold text-emerald-600">${stClassName || stClassId || 'Semua Kelas'}</span></p>
                </div>
                <button type="button" onclick="renderStudentCBTList(document.getElementById('view-container'))" class="self-start sm:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-2xl transition flex items-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-rotate mr-1"></i> Refresh Jadwal
                </button>
            </div>

            <div class="space-y-10">
                ${activeCards.length === 0 && historyCards.length === 0 ? `
                    <div class="bg-white p-12 rounded-3xl text-center text-slate-400 text-sm border border-slate-100 space-y-3">
                        <i class="fa-solid fa-calendar-xmark text-4xl text-slate-200"></i>
                        <div>
                            <p class="font-bold text-slate-600">Belum ada jadwal ujian atau LKPD.</p>
                            <p class="text-xs text-slate-400">Jadwal yang dibuat oleh guru akan muncul di sini secara otomatis.</p>
                        </div>
                    </div>
                ` : `
                    ${activeSectionHtml}
                    ${historySectionHtml}
                `}
            </div>
        </div>
    `;
}

window.confirmStartStudentExam = function(examId) {
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!ex) return;
    
    const currUser = appState.currentUser || {};
    const st = (appState.students || []).find(s => 
        String(s.id) === String(currUser.id) || 
        (currUser.username && String(s.username).toLowerCase() === String(currUser.username).toLowerCase()) ||
        (currUser.nis && String(s.nis) === String(currUser.nis))
    ) || currUser || {};

    const stId = st.id || currUser.id || '';
    const key1 = stId + '_' + ex.id;
    const key2 = String(stId) + '_' + String(ex.id);

    const activeSessions = appState.activeExamSessions || JSON.parse(localStorage.getItem('madrasah_active_exam_sessions') || '{}') || {};
    const hasActiveSession = Boolean(
        (activeSessions[key1] && activeSessions[key1].status === 'active' && activeSessions[key1].timeLeft > 0) ||
        (activeSessions[key2] && activeSessions[key2].status === 'active' && activeSessions[key2].timeLeft > 0)
    );

    const schedInfo = getExamScheduleInfo(ex);

    if (!hasActiveSession && !schedInfo.canStart) {
        if (schedInfo.status === 'not_started') {
            showScheduleNotStartedAlert(examId);
        } else {
            showScheduleExpiredAlert(examId);
        }
        return;
    }
    
    const modal = document.getElementById('modal-container');
    if (modal) {
        modal.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
                <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[calc(100vh-4rem)]">
                    <div class="p-6 border-b border-slate-100 flex items-center space-x-4 shrink-0">
                        <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-xl">
                            <i class="fa-solid fa-laptop-file"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800 text-lg">Mulai Ujian CBT</h3>
                            <p class="text-xs text-slate-500">Konfirmasi kesiapan Anda</p>
                        </div>
                    </div>
                    <div class="p-6 space-y-4 text-sm text-slate-700 overflow-y-auto flex-1 custom-scrollbar">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-xs text-slate-400">Mata Pelajaran</p>
                                <p class="font-bold text-slate-800">${ex.subject || 'Ujian Madrasah'}</p>
                            </div>
                            <div>
                                <p class="text-xs text-slate-400">Judul Ujian</p>
                                <p class="font-bold text-slate-800">${ex.title}</p>
                            </div>
                            <div>
                                <p class="text-xs text-slate-400">Jadwal</p>
                                <p class="font-bold text-slate-800">${ex.date} - ${ex.startTime || '07:30'}</p>
                            </div>
                            <div>
                                <p class="text-xs text-slate-400">Durasi Waktu</p>
                                <p class="font-bold text-slate-800">${ex.duration} Menit</p>
                            </div>
                        </div>
                        <div class="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-xs text-rose-700 space-y-1">
                            <p class="font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Peraturan Ujian:</p>
                            <ul class="list-disc list-inside space-y-0.5 ml-1">
                                <li>Dilarang berdiskusi.</li>
                                <li>Dilarang keluar tab atau membuka aplikasi lain.</li>
                                <li>Pelanggaran akan otomatis dilaporkan ke pengawas.</li>
                            </ul>
                        </div>
                    </div>
                    <div class="p-6 bg-slate-50 flex justify-end gap-3 rounded-b-3xl">
                        <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition">Batal</button>
                        <button type="button" onclick="document.getElementById('modal-container').innerHTML=''; startStudentExam('${ex.id}');" class="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm transition">Mulai Ujian</button>
                    </div>
                </div>
            </div>
        `;
    }
}

function showExamMessageModal(title, message, examId = '', studentId = '', isBroadcast = false) {
    const container = document.body;
    let modal = document.getElementById('exam-message-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'exam-message-overlay';
        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-blue-900/60 backdrop-blur-md p-4';
        container.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="bg-blue-600 w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6 text-center border border-blue-400">
            <div class="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto text-4xl text-white shadow-inner">
                <i class="fa-solid fa-bell"></i>
            </div>
            <div>
                <h3 class="text-2xl font-bold text-white mb-2">${title}</h3>
                <p class="text-blue-100 text-lg leading-relaxed">${message}</p>
            </div>
            <button type="button" onclick="dismissStudentExamMessage('${examId}', '${studentId}', ${Boolean(isBroadcast)}); const el = document.getElementById('exam-message-overlay'); if (el) el.remove();" class="px-8 py-3 bg-white text-blue-700 font-bold rounded-2xl shadow hover:bg-blue-50 transition w-full cursor-pointer">Mengerti</button>
        </div>
    `;
}

async function startStudentExam(examId) {
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!ex) {
        showToast('Ujian tidak ditemukan!', 'error');
        return;
    }

    const currUser = appState.currentUser || {};
    const st = appState.currentUser && appState.currentUser.id ? 
        (appState.students.find(s => String(s.id) === String(appState.currentUser.id)) || appState.currentUser) : 
        (appState.students[0] || { id: 'STU001', name: 'Siswa Contoh' });

    const stId = st.id || currUser.id || '';
    const key1 = stId + '_' + ex.id;
    const key2 = String(stId) + '_' + String(ex.id);

    const activeSessions = appState.activeExamSessions || JSON.parse(localStorage.getItem('madrasah_active_exam_sessions') || '{}') || {};
    const hasActiveSession = Boolean(
        (activeSessions[key1] && activeSessions[key1].status === 'active' && activeSessions[key1].timeLeft > 0) ||
        (activeSessions[key2] && activeSessions[key2].status === 'active' && activeSessions[key2].timeLeft > 0)
    );

    const schedInfo = getExamScheduleInfo(ex);

    if (!hasActiveSession && !schedInfo.canStart) {
        if (schedInfo.status === 'not_started') {
            showScheduleNotStartedAlert(examId);
        } else {
            showScheduleExpiredAlert(examId);
        }
        return;
    }
    
    // 1. Poin 5 & 6: Fetch server-generated, server-shuffled, and sanitized questions
    if (!appState.studentExamQuestions) appState.studentExamQuestions = JSON.parse(localStorage.getItem('madrasah_student_exam_questions')) || {};
    let questions = appState.studentExamQuestions[st.id + '_' + ex.id];
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        try {
            const qRes = await fetch('/api/exam/attempt/start-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: st.id, examId: ex.id })
            });
            const qData = await qRes.json();
            if (qData.success && Array.isArray(qData.questions) && qData.questions.length > 0) {
                questions = qData.questions;
            }
        } catch (err) {
            console.warn('Network error fetching server questions, falling back to local sanitized set:', err);
        }

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            questions = [];
        }
        appState.studentExamQuestions[st.id + '_' + ex.id] = questions;
        safeSetStorage('madrasah_student_exam_questions', appState.studentExamQuestions);
    }

    // 2. Ensure active exam session & answers & timer continuation
    if (!appState.activeExamSessions) appState.activeExamSessions = JSON.parse(localStorage.getItem('madrasah_active_exam_sessions')) || {};
    let sessionData = appState.activeExamSessions[st.id + '_' + ex.id];
    const durationSec = parseInt(ex.duration || 60) * 60;

    if (!sessionData) {
        sessionData = {
            startTime: Date.now(),
            startedAt: Date.now(),
            endsAt: Date.now() + (durationSec * 1000),
            durationSec: durationSec,
            duration: ex.duration,
            status: 'active',
            answers: {},
            currentIndex: 0,
            totalQuestions: questions.length,
            answeredCount: 0,
            timeLeft: durationSec
        };
        appState.activeExamSessions[st.id + '_' + ex.id] = sessionData;
        safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
        
        // Poin 10: Authoritative attempt start with answer & state recovery
        try {
            const startController = new AbortController();
            const startTimeout = setTimeout(() => startController.abort(), 2500);
            const startRes = await fetch('/api/exam/attempt/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: st.id, examId: ex.id, totalQuestions: questions.length }),
                signal: startController.signal
            });
            clearTimeout(startTimeout);
            const res = await startRes.json();
            if (res.success && res.session) {
                if (res.session.endsAt) sessionData.endsAt = res.session.endsAt;
                if (typeof res.session.remainingTime === 'number') sessionData.timeLeft = res.session.remainingTime;
                if (res.session.answers && Object.keys(res.session.answers).length > 0) {
                    sessionData.answers = { ...sessionData.answers, ...res.session.answers };
                    sessionData.answeredCount = Object.keys(sessionData.answers).length;
                }
                if (typeof res.session.currentIndex === 'number') {
                    sessionData.currentIndex = res.session.currentIndex;
                }
                safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
            }
        } catch (e) {}
    } else {
        // Continue from existing session: accurately preserve timeLeft and apply any schedule duration additions
        const oldDurSec = sessionData.durationSec || (parseInt(sessionData.duration || 60, 10) * 60);
        if (durationSec > oldDurSec) {
            const addedSec = durationSec - oldDurSec;
            sessionData.timeLeft = Math.max(10, (sessionData.timeLeft || 0) + addedSec);
            sessionData.durationSec = durationSec;
            sessionData.duration = ex.duration;
            sessionData.extraTimeAdded = (sessionData.extraTimeAdded || 0) + addedSec;
            if (sessionData.endsAt) sessionData.endsAt += (addedSec * 1000);
        } else if (!sessionData.durationSec) {
            sessionData.durationSec = durationSec;
            sessionData.duration = ex.duration;
        }

        if (sessionData.timeLeft === undefined || sessionData.timeLeft === null) {
            sessionData.timeLeft = durationSec;
        }

        // Re-align startTime and endsAt
        if (!sessionData.endsAt) {
            sessionData.endsAt = Date.now() + (sessionData.timeLeft * 1000);
        }
        sessionData.startTime = Date.now() - Math.max(0, (durationSec - sessionData.timeLeft) * 1000);

        if (!sessionData.answers) sessionData.answers = {};
        if (sessionData.currentIndex === undefined) sessionData.currentIndex = 0;
        sessionData.totalQuestions = questions.length;
        sessionData.answeredCount = Object.keys(sessionData.answers).length;
        safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
        
        // Poin 10: Sync attempt continuation & restore answers from server
        try {
            const startController = new AbortController();
            const startTimeout = setTimeout(() => startController.abort(), 2500);
            const startRes = await fetch('/api/exam/attempt/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: st.id, examId: ex.id, totalQuestions: questions.length }),
                signal: startController.signal
            });
            clearTimeout(startTimeout);
            const res = await startRes.json();
            if (res.success && res.session) {
                if (res.session.endsAt) sessionData.endsAt = res.session.endsAt;
                if (typeof res.session.remainingTime === 'number') sessionData.timeLeft = res.session.remainingTime;
                if (res.session.answers && Object.keys(res.session.answers).length > 0) {
                    sessionData.answers = { ...sessionData.answers, ...res.session.answers };
                    sessionData.answeredCount = Object.keys(sessionData.answers).length;
                }
                if (typeof res.session.currentIndex === 'number') {
                    sessionData.currentIndex = res.session.currentIndex;
                }
                safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
            }
        } catch (e) {}
    }

    activeExamSession = {
        exam: ex,
        questions: questions,
        currentIndex: sessionData.currentIndex || 0,
        answers: sessionData.answers || {},
        timeLeft: sessionData.timeLeft
    };

    // If remaining time is already expired, trigger immediate submit
    if (activeExamSession.timeLeft <= 0) {
        showToast('Waktu ujian telah habis.', 'info');
        submitExamFinal();
        return;
    }

    // Hide UI layout chrome
    const sidebar = document.getElementById('sidebar');
    const header = document.querySelector('header');
    if (sidebar) sidebar.style.display = 'none';
    if (header) header.style.display = 'none';

    // 3. DND & Screen Protection Init
    window._examInitWidth = window.innerWidth;
    window._examInitHeight = window.innerHeight;

    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => {
            window._examWakeLock = lock;
        }).catch(() => {});
    }

    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
    }

    // Global Violation Handler
    window.triggerExamViolation = function(reason) {
        if (!activeExamSession) return;
        const now = Date.now();
        if (window._lastViolationTime && (now - window._lastViolationTime < 3500)) return;
        window._lastViolationTime = now;

        const currentStudent = appState.currentUser && appState.currentUser.id ? appState.currentUser : (appState.students[0] || {});
        const key = currentStudent.id + '_' + activeExamSession.exam.id;

        if (!appState.studentTabSwitches) appState.studentTabSwitches = JSON.parse(localStorage.getItem('madrasah_student_tab_switches')) || {};
        if (!appState.studentOutOfTab) appState.studentOutOfTab = JSON.parse(localStorage.getItem('madrasah_student_out_of_tab')) || {};

        appState.studentTabSwitches[key] = (appState.studentTabSwitches[key] || 0) + 1;
        appState.studentOutOfTab[key] = true;
        safeSetStorage('madrasah_student_tab_switches', appState.studentTabSwitches);
        safeSetStorage('madrasah_student_out_of_tab', appState.studentOutOfTab);

        const count = appState.studentTabSwitches[key];
        showToast(`PERINGATAN: ${reason} (${count}x)!`, 'error');
        
        // Structured Violation Logger API call
        fetch('/api/exam/violation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId: currentStudent.id,
                examId: activeExamSession.exam.id,
                reason: reason,
                clientTimestamp: now
            })
        }).then(r => r.json()).then(res => {
            if (res.success && res.autoBlocked) {
                setStudentBlockState(activeExamSession.exam.id, currentStudent.id, true);
                showToast('Ujian diblokir otomatis oleh sistem karena melanggar batas aturan.', 'error');
                renderActiveExamScreen();
            }
        }).catch(() => {
            syncExamStateToServer({ tabSwitches: { [key]: count }, outOfTab: { [key]: true } });
        });

        const autoBlock = parseInt(activeExamSession.exam.autoBlock) || 0;
        if (autoBlock > 0 && count >= autoBlock) {
            setStudentBlockState(activeExamSession.exam.id, currentStudent.id, true);
            syncExamStateToServer({ blocked: { [activeExamSession.exam.id + '_' + currentStudent.id]: true, [currentStudent.id + '_' + activeExamSession.exam.id]: true } });
            showToast('Ujian diblokir otomatis oleh sistem karena melanggar batas aturan.', 'error');
            renderActiveExamScreen();
            return;
        }

        const modal = document.getElementById('modal-container');
        if (modal) {
            modal.innerHTML = `
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-fade-in">
                    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 text-center space-y-4 border-2 border-rose-500">
                        <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <h3 class="font-bold text-slate-900 text-lg">Peringatan Pelanggaran Layar Ujian!</h3>
                        <div class="p-3 bg-rose-50 rounded-2xl text-xs text-rose-800 font-semibold space-y-1 text-left border border-rose-200">
                            <p><i class="fa-solid fa-circle-info mr-1"></i> <strong>Jenis Pelanggaran:</strong> ${reason}</p>
                            <p><i class="fa-solid fa-clock-rotate-left mr-1"></i> <strong>Jumlah Pelanggaran:</strong> Pelanggaran ke-${count}</p>
                        </div>
                        <p class="text-xs text-slate-600 leading-relaxed">
                            Sistem mendeteksi bahwa layar Anda di-split screen, diubah ukurannya, atau Anda meninggalkan aplikasi ujian. Harap gunakan <strong>layar penuh (Fullscreen)</strong> dan tidak membuka aplikasi lain!
                        </p>
                        <button type="button" onclick="document.getElementById('modal-container').innerHTML=''; if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});" class="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs shadow-md transition cursor-pointer">
                            <i class="fa-solid fa-expand mr-1.5"></i> Saya Mengerti & Kembalikan Layar Penuh
                        </button>
                    </div>
                </div>
            `;
        }
    };

    if (!window._cbtVisibilityListenerAdded) {
        window._cbtVisibilityListenerAdded = true;
        
        document.addEventListener('visibilitychange', () => {
            if (!activeExamSession) return;
            if (document.hidden) {
                window.triggerExamViolation('Keluar Tab / Aplikasi Ujian');
            } else {
                const currentStudent = appState.currentUser && appState.currentUser.id ? appState.currentUser : (appState.students[0] || {});
                const key = currentStudent.id + '_' + activeExamSession.exam.id;
                appState.studentOutOfTab[key] = false;
                safeSetStorage('madrasah_student_out_of_tab', appState.studentOutOfTab);
                syncExamStateToServer({ outOfTab: { [key]: false } });
                showToast('Anda telah kembali ke tab ujian. Tetap fokus!', 'success');
            }
        });

        window.addEventListener('blur', () => {
            if (!activeExamSession) return;
            if (document.hidden) return; // Handled by visibilitychange

            const isInputActive = document.activeElement && 
                (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable);

            if (!isInputActive) {
                window.triggerExamViolation('Keluar Fokus / Aplikasi Melayang (Pop-up/Floating)');
            } else {
                setTimeout(() => {
                    if (!document.hasFocus() && !document.hidden) {
                        window.triggerExamViolation('Keluar Fokus / Aplikasi Melayang (Pop-up/Floating)');
                    }
                }, 800);
            }
        });

        window.addEventListener('resize', () => {
            if (!activeExamSession) return;
            checkMultiWindowOrFloatingApp();
        });
    }

    // Helper function to detect Multi-Window, Split-Screen, Floating Pop-up Apps, and Picture-in-Picture
    function checkMultiWindowOrFloatingApp() {
        if (!activeExamSession || document.hidden) return;

        const isInputActive = document.activeElement && 
            (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable);

        // 1. Detect Split-Screen / Multi-Window / Pop-up View by viewport dimension shrinkage
        const screenW = screen.width || window.outerWidth || 360;
        const screenH = screen.height || window.outerHeight || 640;
        const currW = window.innerWidth;
        const currH = window.innerHeight;

        // Virtual keyboard on mobile reduces height, but width NEVER changes!
        // Therefore, width reduction < 82% of screen width indicates split-screen or pop-up view.
        const isWidthShrunk = currW < (screenW * 0.82);
        // Height reduction < 55% of screen height without active typing indicates top/bottom split-screen.
        const isHeightShrunkWithoutKeyboard = !isInputActive && (currH < (screenH * 0.55));

        if (isWidthShrunk || isHeightShrunkWithoutKeyboard) {
            if (!window._lastSplitScreenViolationTime || (Date.now() - window._lastSplitScreenViolationTime > 4000)) {
                window._lastSplitScreenViolationTime = Date.now();
                window.triggerExamViolation('Tampilan Multi-Window / Split-Screen / Pop-up View Terdeteksi');
            }
        }

        // 2. Detect Picture-in-Picture
        if (document.pictureInPictureElement) {
            window.triggerExamViolation('Picture-in-Picture (PiP) Terdeteksi');
        }

        // 3. Detect focus loss when interacting with floating window / pop-up view app
        if (!document.hasFocus() && !isInputActive) {
            if (!window._focusLostStartTime) {
                window._focusLostStartTime = Date.now();
            } else if (Date.now() - window._focusLostStartTime > 1000) { // Lost focus for > 1 sec
                window._focusLostStartTime = null;
                window.triggerExamViolation('Aplikasi Melayang / Pop-up View Terdeteksi');
            }
        } else {
            window._focusLostStartTime = null;
        }
    }

    if (window.__examTimerInterval) clearInterval(window.__examTimerInterval);
    window.__examTimerInterval = setInterval(() => {
        if (activeExamSession && activeExamSession.timeLeft > 0) {
            checkMultiWindowOrFloatingApp();
            activeExamSession.timeLeft--;
            const timerDisplay = document.getElementById('exam-timer-display');
            if (timerDisplay) {
                const m = Math.floor(activeExamSession.timeLeft / 60);
                const s = String(activeExamSession.timeLeft % 60).padStart(2, '0');
                timerDisplay.textContent = `${m}:${s}`;
            }

            // Synchronize server-authoritative endsAt timer and lightweight micro-heartbeat every 5 seconds
            if (activeExamSession.timeLeft % 5 === 0) {
                // Micro-Heartbeat to keep session alive and sync exact server-authoritative timer
                fetch('/api/exam/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        studentId: st.id,
                        examId: ex.id,
                        currentIndex: activeExamSession.currentIndex
                    })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            // Server-authoritative timer synchronization
                            if (data.remainingTime !== null && data.remainingTime !== undefined) {
                                const diff = Math.abs(data.remainingTime - activeExamSession.timeLeft);
                                if (diff > 4) { // Re-align if local clock drifted by > 4s or was modified
                                    activeExamSession.timeLeft = data.remainingTime;
                                    if (appState.activeExamSessions && appState.activeExamSessions[st.id + '_' + ex.id]) {
                                        appState.activeExamSessions[st.id + '_' + ex.id].timeLeft = data.remainingTime;
                                        safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
                                    }
                                    const m = Math.floor(activeExamSession.timeLeft / 60);
                                    const s = String(activeExamSession.timeLeft % 60).padStart(2, '0');
                                    if (timerDisplay) timerDisplay.textContent = `${m}:${s}`;
                                }
                            }

                            // Check blocked state
                            const wasBlocked = isStudentBlocked(ex.id, st.id);
                            if (!appState.blockedStudents) appState.blockedStudents = {};
                            appState.blockedStudents[st.id + '_' + ex.id] = data.blocked;
                            safeSetStorage('madrasah_blocked_students', appState.blockedStudents);

                            if (data.blocked && !wasBlocked) {
                                showToast('Ujian diblokir oleh pengawas.', 'error');
                                renderActiveExamScreen();
                                return;
                            } else if (!data.blocked && wasBlocked) {
                                const modalContainer = document.getElementById('modal-container');
                                if (modalContainer) modalContainer.innerHTML = '';
                                const msgOverlay = document.getElementById('exam-message-overlay');
                                if (msgOverlay) msgOverlay.remove();
                                const blockModal = document.getElementById('exam-blocked-modal');
                                if (blockModal) blockModal.remove();
                                showToast('Akses ujian Anda telah dibuka kembali oleh pengawas.', 'success');
                                renderActiveExamScreen();
                            }

                            // Check force finish state
                            if (data.forceFinished) {
                                showToast('Ujian diselesaikan oleh pengawas.', 'info');
                                submitExamFinal();
                                return;
                            }

                            // Check broadcast and personal messages
                            const oldMessages = JSON.parse(localStorage.getItem('madrasah_exam_messages')) || {};
                            if (!appState.examMessages) appState.examMessages = {};
                            
                            if (data.messageBroadcast) {
                                const bKey = 'broadcast_' + ex.id;
                                if (data.messageBroadcast !== oldMessages[bKey]) {
                                    appState.examMessages[bKey] = data.messageBroadcast;
                                    safeSetStorage('madrasah_exam_messages', appState.examMessages);
                                    showExamMessageModal('Pengumuman Ujian', data.messageBroadcast, ex.id, st.id, true);
                                }
                            }
                            if (data.messagePersonal) {
                                const pKey = st.id + '_' + ex.id;
                                if (data.messagePersonal !== oldMessages[pKey]) {
                                    appState.examMessages[pKey] = data.messagePersonal;
                                    safeSetStorage('madrasah_exam_messages', appState.examMessages);
                                    showExamMessageModal('Pesan dari Pengawas', data.messagePersonal, ex.id, st.id, false);
                                }
                            }
                        }
                    })
                    .catch(() => {});

                if (window.flushPendingOfflineAnswers) {
                    window.flushPendingOfflineAnswers();
                }
            }

            // WebRTC P2P Livecam Monitoring Signaling Poller (Zero-storage fallback when WebSocket is not active and LiveKit is not configured)
            if (!isLiveKitConfigured() && (!window._signalingWs || window._signalingWs.readyState !== 1)) {
                fetch(`/api/exam/signaling?recipientId=${String(st.id)}`)
                    .then(res => res.json())
                    .then(async data => {
                        if (data.success && data.signals && data.signals.length > 0) {
                            for (const item of data.signals) {
                                await window.handleSingleIncomingSignalForStudent(item.senderId, item.signal, st.id);
                            }
                        }
                    }).catch(e => {});
            }
        } else if (activeExamSession && activeExamSession.timeLeft <= 0) {
            clearInterval(window.__examTimerInterval);
            submitExamFinal();
        }
    }, 1000);

    // Setup PiP webcam (Hidden completely on student side but active for admin monitoring)
    let pipContainer = document.getElementById('student-pip-container');
    if (!pipContainer) {
        pipContainer = document.createElement('div');
        pipContainer.id = 'student-pip-container';
        pipContainer.className = 'fixed left-[-9999px] top-[-9999px] w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden select-none';
        pipContainer.innerHTML = `
            <video id="student-webcam-preview" autoplay muted playsinline class="w-full h-full object-cover" style="transform: scaleX(-1);"></video>
        `;
        document.body.appendChild(pipContainer);

        let isDragging = false;
        let startX, startY, initialX, initialY;

        const dragStart = (e) => {
            isDragging = true;
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            startX = clientX;
            startY = clientY;
            const rect = pipContainer.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;
            pipContainer.style.bottom = 'auto';
            pipContainer.style.right = 'auto';
            pipContainer.style.left = initialX + 'px';
            pipContainer.style.top = initialY + 'px';
            pipContainer.style.cursor = 'grabbing';
            if (e.type === 'touchstart') e.preventDefault();
        };

        const dragMove = (e) => {
            if (!isDragging) return;
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            const dx = clientX - startX;
            const dy = clientY - startY;
            pipContainer.style.left = (initialX + dx) + 'px';
            pipContainer.style.top = (initialY + dy) + 'px';
            if (e.cancelable) e.preventDefault();
        };

        const dragEnd = () => {
            isDragging = false;
            pipContainer.style.cursor = 'grab';
        };

        pipContainer.addEventListener('mousedown', dragStart);
        window.addEventListener('mousemove', dragMove);
        window.addEventListener('mouseup', dragEnd);

        pipContainer.addEventListener('touchstart', dragStart, { passive: false });
        window.addEventListener('touchmove', dragMove, { passive: false });
        window.addEventListener('touchend', dragEnd);

        window.initStudentExamCamera();
    }

    renderActiveExamScreen();
}

window.sendStudentSingleSnapshot = function() {
    if (window.__studentWebcamStream && activeExamSession && activeExamSession.exam) {
        const st = appState.currentUser && appState.currentUser.id ? appState.currentUser : (appState.students[0] || {});
        const previewEl = document.getElementById('student-webcam-preview');
        if (previewEl && previewEl.videoWidth > 0 && previewEl.videoHeight > 0) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 280;
                canvas.height = 210;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(previewEl, 0, 0, canvas.width, canvas.height);
                const frameData = canvas.toDataURL('image/jpeg', 0.5);
                const key = st.id + '_' + activeExamSession.exam.id;
                if (!appState.runtimeLivecamFrames) appState.runtimeLivecamFrames = {};
                appState.runtimeLivecamFrames[key] = frameData;
                syncExamStateToServer({ livecamFrame: { key, frame: frameData } });
                console.log("Attendance snapshot sent successfully");
            } catch (e) {}
        }
    }
};

window.startStudentConnectingSnapshots = function() {
    if (window._studentSnapshotInterval) clearInterval(window._studentSnapshotInterval);
    console.log("Starting connecting snapshots (3s interval)...");
    window._studentSnapshotInterval = setInterval(() => {
        window.sendStudentSingleSnapshot();
    }, 3000); // 3-second rapid snapshot interval during WebRTC handshakes
};

window.stopStudentSnapshots = function() {
    if (window._studentSnapshotInterval) {
        console.log("Stopping snapshots completely to maximize bandwidth savings");
        clearInterval(window._studentSnapshotInterval);
        window._studentSnapshotInterval = null;
    }
};

window.initStudentExamCamera = function() {
    const pipContainer = document.getElementById('student-pip-container');
    if (!pipContainer) return;

    if (window.__studentWebcamStream) {
        if (window.stopCameraStreamTrack) {
            window.stopCameraStreamTrack(window.__studentWebcamStream);
        } else {
            try {
                window.__studentWebcamStream.getTracks().forEach(t => t.stop());
            } catch(e) {}
        }
        window.__studentWebcamStream = null;
    }

    pipContainer.innerHTML = `
        <video id="student-webcam-preview" autoplay muted playsinline class="w-full h-full object-cover" style="transform: scaleX(-1);"></video>
    `;

    const requestFn = window.requestCameraStream || function() {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    };

    requestFn()
        .then(stream => {
            const videoEl = document.getElementById('student-webcam-preview');
            if (videoEl) {
                videoEl.srcObject = stream;
                videoEl.muted = true;
                videoEl.play().catch(e => console.warn('Exam video play err:', e));
            }
            window.__studentWebcamStream = stream;

            // Clear any active snapshots by default
            if (window._studentSnapshotInterval) {
                clearInterval(window._studentSnapshotInterval);
                window._studentSnapshotInterval = null;
            }

            // Capture only a single initial snapshot ("Foto Absen") after 2.5s as attendance photo
            setTimeout(() => {
                window.sendStudentSingleSnapshot();
            }, 2500);
            
            // Start LiveKit publishing if configured, else register WebSocket signaling for P2P
            const st = appState.currentUser && appState.currentUser.id ? appState.currentUser : (appState.students[0] || {});
            if (activeExamSession && activeExamSession.exam) {
                if (isLiveKitConfigured()) {
                    startStudentLiveKit(activeExamSession.exam.id, st.id);
                } else {
                    // Start WebSocket signaling for WebRTC P2P if LiveKit is not configured
                    window.initSignalingWebSocket(String(st.id), (senderId, signal) => {
                        window.handleSingleIncomingSignalForStudent(senderId, signal, st.id);
                    });
                }
            }
        })
        .catch(err => {
            const getErrFn = window.getCameraErrorMessage || function(e) { return { msg: 'Kamera Tidak Aktif', solution: 'Izin kamera ditolak atau tidak tersedia.' }; };
            const errInfo = getErrFn(err);
            pipContainer.innerHTML = `
                <div class="text-[9px] text-amber-300 text-center p-1 leading-tight flex flex-col items-center justify-center h-full space-y-1">
                    <i class="fa-solid fa-triangle-exclamation text-amber-400 text-base"></i>
                    <span class="font-bold">${errInfo.msg}</span>
                    <button type="button" onclick="initStudentExamCamera()" class="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[8px] font-bold cursor-pointer shadow">
                        <i class="fa-solid fa-arrows-rotate mr-0.5"></i> Coba Lagi
                    </button>
                </div>
            `;
        });
};

function renderActiveExamScreen() {
    const container = document.getElementById('view-container');
    const sess = activeExamSession;
    if (!sess) return;
    const q = sess.questions[sess.currentIndex];

    const st = appState.currentUser && appState.currentUser.id ? appState.currentUser : (appState.students[0] || {});
    const isBlocked = isStudentBlocked(sess.exam.id, st.id);
    if (isBlocked) {
        container.innerHTML = `
            <div class="max-w-md mx-auto mt-20 bg-white p-8 rounded-3xl shadow-2xl text-center space-y-4 border border-rose-200">
                <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl"><i class="fa-solid fa-ban"></i></div>
                <h2 class="text-lg font-bold text-slate-800">Ujian Diblokir</h2>
                <p class="text-xs text-slate-500">Anda telah diblokir oleh pengawas untuk ujian ini. Silakan hubungi pengawas ruang.</p>
                <button type="button" onclick="renderStudentCBTList(document.getElementById('view-container'))" class="px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-semibold">Keluar Ujian</button>
            </div>
        `;
        return;
    }

    if (!appState.examMessages) appState.examMessages = JSON.parse(localStorage.getItem('madrasah_exam_messages')) || {};
    const msgKey = st.id + '_' + sess.exam.id;
    const broadcastKey = 'broadcast_' + sess.exam.id;
    const activeMsg = appState.examMessages[msgKey] || appState.examMessages[broadcastKey];

    let modalOverlay = '';
    if (activeMsg) {
        modalOverlay = `
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
                <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 text-center space-y-4 border">
                    <div class="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <h3 class="font-bold text-slate-800 text-lg">Pesan Penting dari Pengawas</h3>
                    <p class="text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border">${activeMsg}</p>
                    <button type="button" onclick="dismissStudentExamMessage('${sess.exam.id}', '${st.id}', ${Boolean(appState.examMessages[broadcastKey])})" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-xs shadow">OK / Mengerti</button>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="space-y-4 max-w-3xl mx-auto pb-16 relative">
            ${modalOverlay}

            <!-- DND & Protection Status Banner -->
            <div class="bg-slate-900 text-white p-3 rounded-2xl flex flex-wrap items-center justify-between text-xs font-medium border border-slate-700 shadow-sm gap-2">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span class="font-bold text-emerald-300"><i class="fa-solid fa-shield-halved mr-1"></i> Mode Bebas Gangguan (DND) Aktif</span>
                    <span class="text-slate-400 text-[11px] hidden sm:inline">| Deteksi Split-Screen & Layar Nyala</span>
                </div>
                <div class="flex items-center gap-2 text-[11px]">
                    <button type="button" onclick="if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl border border-slate-600 cursor-pointer">
                        <i class="fa-solid fa-expand mr-1"></i> Fullscreen
                    </button>
                </div>
            </div>

            <!-- Sticky Header Timer -->
            <div class="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border flex justify-between items-center sticky top-2 z-20">
                <div>
                    <h2 class="text-xs sm:text-sm font-bold text-slate-800">${sess.exam.title}</h2>
                    <p class="text-[11px] text-slate-500 font-medium">Soal Ke-${sess.currentIndex + 1} dari ${sess.questions.length}</p>
                </div>
                <div class="flex items-center gap-2">
                    <div id="cbt-sync-status-badge" class="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-bold flex items-center space-x-1.5 border border-emerald-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span id="cbt-sync-status-text">${(window._pendingOfflineAnswers && window._pendingOfflineAnswers.length > 0) ? `Offline (${window._pendingOfflineAnswers.length})` : 'Tersinkron'}</span>
                    </div>
                    <div class="px-3.5 py-2 bg-rose-50 text-rose-700 rounded-2xl text-xs font-mono font-bold flex items-center space-x-2 border border-rose-200">
                        <i class="fa-solid fa-stopwatch animate-pulse"></i>
                        <span id="exam-timer-display">${Math.floor(sess.timeLeft / 60)}:${String(sess.timeLeft % 60).padStart(2, '0')}</span>
                    </div>
                </div>
            </div>

            <!-- Question Box -->
            <div class="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border space-y-6">
                <p class="font-semibold text-slate-800 text-base leading-relaxed select-none">${q.question}</p>
                ${((q.imageUrl || q.image) && (!q.question || !q.question.includes(q.imageUrl || q.image))) ? `<div class="my-3 flex justify-center"><img src="${q.imageUrl || q.image}" class="max-h-64 rounded-2xl border border-slate-200 object-contain shadow-sm" alt="Gambar Soal"/></div>` : ''}
                <div class="space-y-3">
                    ${(q.type === 'esay' || q.type === 'essay') ? `
                        <textarea onchange="saveExamAnswer('${q.id}', this.value)" rows="6" class="w-full p-4 border rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none text-sm" placeholder="Ketik jawaban esay Anda di sini...">${sess.answers[q.id] || ''}</textarea>
                    ` : (q.options || []).map((opt, oIdx) => `
                        <div onclick="selectExamOption(${oIdx})" class="flex items-center space-x-3 p-4 rounded-2xl border cursor-pointer transition select-none ${sess.answers[q.id] === opt ? 'bg-emerald-50 border-emerald-500 font-bold text-emerald-900 shadow-sm' : 'bg-slate-50 hover:bg-slate-100'}">
                            <span class="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${sess.answers[q.id] === opt ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}">${String.fromCharCode(65 + oIdx)}</span>
                            <span class="text-sm">${opt}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="flex justify-between items-center pt-4 border-t">
                    <button type="button" onclick="prevExamQuestion()" ${sess.currentIndex === 0 ? 'disabled class="px-5 py-2.5 bg-slate-100 text-slate-400 rounded-2xl text-xs font-semibold cursor-not-allowed"' : 'class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-semibold cursor-pointer"'}>Sebelumnya</button>
                    ${sess.currentIndex < sess.questions.length - 1 ? `
                        <button type="button" onclick="nextExamQuestion()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-semibold shadow cursor-pointer">Selanjutnya</button>
                    ` : `
                        <button type="button" onclick="confirmStudentExamSubmit()" class="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-semibold shadow cursor-pointer">Selesai & Kirim</button>
                    `}
                </div>
            </div>

            <!-- Question Number Matrix Grid -->
            <div class="bg-white p-4 rounded-3xl shadow-sm border space-y-2">
                <div class="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span><i class="fa-solid fa-list-ol text-emerald-600 mr-1.5"></i> Navigasi Soal (${Object.keys(sess.answers).length}/${sess.questions.length} Terjawab)</span>
                </div>
                <div class="flex flex-wrap gap-1.5 pt-1">
                    ${sess.questions.map((qItem, idx) => {
                        const isCurrent = idx === sess.currentIndex;
                        const isAnswered = Boolean(sess.answers[qItem.id] && String(sess.answers[qItem.id]).trim() !== '');
                        return `
                            <button type="button" onclick="jumpToExamQuestion(${idx})" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isCurrent ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow' : isAnswered ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                                ${idx + 1}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    if (window.renderMathInElementSafely) {
        window.renderMathInElementSafely(container);
    }
}

window.jumpToExamQuestion = function(idx) {
    if (activeExamSession && idx >= 0 && idx < activeExamSession.questions.length) {
        activeExamSession.currentIndex = idx;
        const st = appState.currentUser && appState.currentUser.id ? appState.currentUser : (appState.students[0] || {});
        const key = st.id + '_' + activeExamSession.exam.id;
        if (appState.activeExamSessions && appState.activeExamSessions[key]) {
            appState.activeExamSessions[key].currentIndex = idx;
            safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
        }
        renderActiveExamScreen();
    }
};

// Phase 6: Persistent Offline Resiliency & Queue Auto-Resync (Poin 12)
function getPendingOfflineQueue() {
    try {
        return JSON.parse(localStorage.getItem('cbt_pending_offline_answers') || '[]') || [];
    } catch(e) { return []; }
}

function setPendingOfflineQueue(q) {
    try {
        if (!q || q.length === 0) {
            localStorage.removeItem('cbt_pending_offline_answers');
        } else {
            localStorage.setItem('cbt_pending_offline_answers', JSON.stringify(q));
        }
    } catch(e) {}
}

window._pendingOfflineAnswers = getPendingOfflineQueue();

window.updateCbtSyncBadge = function(status) {
    const badge = document.getElementById('cbt-sync-status-badge');
    const text = document.getElementById('cbt-sync-status-text');
    if (!badge || !text) return;
    const queueLen = (window._pendingOfflineAnswers && window._pendingOfflineAnswers.length) || 0;
    if (status === 'syncing') {
        badge.className = 'px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-2xl text-[10px] font-bold flex items-center space-x-1.5 border border-amber-200';
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span><span id="cbt-sync-status-text">Menyinkron (${queueLen})...</span>`;
    } else if (status === 'offline' || queueLen > 0) {
        badge.className = 'px-2.5 py-1.5 bg-rose-50 text-rose-700 rounded-2xl text-[10px] font-bold flex items-center space-x-1.5 border border-rose-200';
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span id="cbt-sync-status-text">Offline (Tersimpan Lokal ${queueLen})</span>`;
    } else {
        badge.className = 'px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-bold flex items-center space-x-1.5 border border-emerald-200';
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span id="cbt-sync-status-text">Tersinkron</span>`;
    }
};

window.flushPendingOfflineAnswers = async function() {
    const queue = getPendingOfflineQueue();
    if (!queue || queue.length === 0) {
        window._pendingOfflineAnswers = [];
        window.updateCbtSyncBadge('synced');
        return;
    }
    window.updateCbtSyncBadge('syncing');

    const remaining = [];
    for (const item of queue) {
        try {
            const res = await fetch('/api/exam/attempt/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!res.ok) throw new Error('Sync failed');
        } catch(e) {
            remaining.push(item);
        }
    }

    setPendingOfflineQueue(remaining);
    window._pendingOfflineAnswers = remaining;
    if (remaining.length === 0) {
        window.updateCbtSyncBadge('synced');
    } else {
        window.updateCbtSyncBadge('offline');
    }
};

if (!window._offlineSyncListenerAdded) {
    window._offlineSyncListenerAdded = true;
    window.addEventListener('online', () => {
        window.flushPendingOfflineAnswers();
    });
    // Check and flush any pending queue on startup
    setTimeout(() => {
        if (getPendingOfflineQueue().length > 0) {
            window.flushPendingOfflineAnswers();
        }
    }, 1500);
}

function saveExamAnswer(qId, val) {
    if (activeExamSession) {
        activeExamSession.answers[qId] = val;
        
        // Save progress to global state so admin can monitor & persist across refreshes
        const st = appState.currentUser && appState.currentUser.id ? appState.currentUser : (appState.students[0] || {});
        const key = st.id + '_' + activeExamSession.exam.id;
        if (!appState.activeExamSessions) appState.activeExamSessions = JSON.parse(localStorage.getItem('madrasah_active_exam_sessions')) || {};
        
        if (appState.activeExamSessions[key]) {
             appState.activeExamSessions[key].answeredCount = Object.keys(activeExamSession.answers).length;
             appState.activeExamSessions[key].totalQuestions = activeExamSession.questions.length;
             appState.activeExamSessions[key].answers = activeExamSession.answers;
             appState.activeExamSessions[key].currentIndex = activeExamSession.currentIndex;
             safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
        }

        const payload = {
            studentId: st.id,
            examId: activeExamSession.exam.id,
            questionId: qId,
            answer: val,
            currentIndex: activeExamSession.currentIndex
        };

        // Instant Micro-Payload Answer Sync (<150 bytes payload) with Persistent Offline Queue Fallback
        window.updateCbtSyncBadge('syncing');
        fetch('/api/exam/attempt/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(r => r.json()).then(res => {
            if (res.success && res.remainingTime !== undefined && res.remainingTime !== null) {
                activeExamSession.timeLeft = res.remainingTime;
            }
            // If answer was in persistent queue, remove it
            const curQ = getPendingOfflineQueue().filter(i => !(i.studentId === payload.studentId && i.examId === payload.examId && i.questionId === payload.questionId));
            setPendingOfflineQueue(curQ);
            window._pendingOfflineAnswers = curQ;
            if (curQ.length === 0) {
                window.updateCbtSyncBadge('synced');
            } else {
                window.updateCbtSyncBadge('offline');
            }
        }).catch(() => {
            // Deduplicate & save in persistent offline queue
            const curQ = getPendingOfflineQueue();
            const existingIdx = curQ.findIndex(i => i.studentId === payload.studentId && i.examId === payload.examId && i.questionId === payload.questionId);
            if (existingIdx >= 0) {
                curQ[existingIdx] = payload;
            } else {
                curQ.push(payload);
            }
            setPendingOfflineQueue(curQ);
            window._pendingOfflineAnswers = curQ;
            window.updateCbtSyncBadge('offline');
        });
        
        renderActiveExamScreen();
    }
}

function selectExamOption(oIdx) {
    if (activeExamSession) {
        const q = activeExamSession.questions[activeExamSession.currentIndex];
        if (q && q.options && q.options[oIdx] !== undefined) {
            saveExamAnswer(q.id, q.options[oIdx]);
        }
    }
}

function nextExamQuestion() {
    if (activeExamSession && activeExamSession.currentIndex < activeExamSession.questions.length - 1) {
        window.jumpToExamQuestion(activeExamSession.currentIndex + 1);
    }
}

function prevExamQuestion() {
    if (activeExamSession && activeExamSession.currentIndex > 0) {
        window.jumpToExamQuestion(activeExamSession.currentIndex - 1);
    }
}

function submitExamFinal() {
    const sidebar = document.getElementById('sidebar');
    const header = document.querySelector('header');
    if (sidebar) sidebar.style.display = '';
    if (header) header.style.display = '';

    const st = appState.currentUser && appState.currentUser.id ? (appState.students.find(s => String(s.id) === String(appState.currentUser.id)) || appState.currentUser) : appState.students[0] || {};
    const ex = activeExamSession.exam;

    if (!appState.completedExams) appState.completedExams = {};
    appState.completedExams[st.id + '_' + ex.id] = true;
    safeSetStorage('madrasah_completed_exams', appState.completedExams);

    const answers = activeExamSession.answers || {};
    if (!appState.studentExamAnswers) appState.studentExamAnswers = JSON.parse(localStorage.getItem('madrasah_student_exam_answers')) || {};
    appState.studentExamAnswers[st.id + '_' + ex.id] = answers;
    safeSetStorage('madrasah_student_exam_answers', appState.studentExamAnswers);

    let questions = (activeExamSession && activeExamSession.questions) ? activeExamSession.questions : (appState.studentExamQuestions ? appState.studentExamQuestions[st.id + '_' + ex.id] : []);
    if (!appState.studentExamQuestions) appState.studentExamQuestions = JSON.parse(localStorage.getItem('madrasah_student_exam_questions')) || {};
    appState.studentExamQuestions[st.id + '_' + ex.id] = questions;
    safeSetStorage('madrasah_student_exam_questions', appState.studentExamQuestions);
    let pgQuestions = questions.filter(q => q.type !== 'esay' && q.type !== 'essay');
    let essayQuestions = questions.filter(q => q.type === 'esay' || q.type === 'essay');

    // Server is the single source of truth for answer key and grading (Poin 5 & 6)
    if (!appState.studentExamGrades) appState.studentExamGrades = JSON.parse(localStorage.getItem('madrasah_student_exam_grades')) || {};
    appState.studentExamGrades[st.id + '_' + ex.id] = {
        pgScore: null,
        essayScore: 0,
        finalScore: null,
        isGraded: false,
        correctPGCount: 0,
        totalPGCount: pgQuestions.length,
        essayGrades: {}
    };
    safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);

    if (!appState.activeExamSessions) appState.activeExamSessions = JSON.parse(localStorage.getItem('madrasah_active_exam_sessions')) || {};
    delete appState.activeExamSessions[st.id + '_' + ex.id];
    safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);

    // Phase 4: Server-Authoritative Exam Finalization & Scoring
    fetch('/api/exam/attempt/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentId: st.id,
            examId: ex.id,
            answers: answers
        })
    }).then(r => r.json()).then(res => {
        if (res.success && res.grade) {
            appState.studentExamGrades[st.id + '_' + ex.id] = res.grade;
            safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);
        }
    }).catch(() => {
        syncExamStateToServer({
            completed: { [st.id + '_' + ex.id]: true },
            answers: { [st.id + '_' + ex.id]: answers },
            sessionKey: st.id + '_' + ex.id,
            sessionData: null,
            gradesObj: { [st.id + '_' + ex.id]: appState.studentExamGrades[st.id + '_' + ex.id] }
        });
    });

    if (window.__studentWebcamStream) {
        if (window.stopCameraStreamTrack) {
            window.stopCameraStreamTrack(window.__studentWebcamStream);
        } else {
            try {
                window.__studentWebcamStream.getTracks().forEach(t => t.stop());
            } catch(e) {}
        }
        window.__studentWebcamStream = null;
    }
    try { stopStudentLiveKit(); } catch(e){}

    const pipContainer = document.getElementById('student-pip-container');
    if (pipContainer) {
        pipContainer.remove();
    }

    if (window.__examTimerInterval) {
        clearInterval(window.__examTimerInterval);
        window.__examTimerInterval = null;
    }

    activeExamSession = null;
    showToast('Ujian berhasil diselesaikan dan dikirim!', 'success');
    renderStudentCBTList(document.getElementById('view-container'));
}

// Room Management Functions
function openRoomModal() {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800">Tambah Ruang Ujian</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark"></i></button></div>
                <form onsubmit="saveRoom(event)" class="space-y-3 text-xs sm:text-sm">
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Nama Ruang</label>
                        <input type="text" id="room-name-input" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" placeholder="Contoh: Ruang 01 / Lab Komputer A">
                    </div>
                    <div class="flex justify-end space-x-2 pt-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl">Batal</button>
                        <button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function saveRoom(e) {
    e.preventDefault();
    const name = document.getElementById('room-name-input').value.trim();
    if (!name) return;

    if (!appState.rooms) appState.rooms = [];
    const newRoom = {
        id: 'ROOM_' + Date.now(),
        name,
        members: []
    };
    appState.rooms.push(newRoom);
    saveState('rooms');
    closeModal();
    showToast('Ruang ujian berhasil ditambahkan!', 'success');
    renderAssessmentModule(document.getElementById('view-container'), 'ruang');
}

function deleteRoom(roomId) {
    showConfirmModal('Hapus ruang ujian ini?', () => {
        appState.rooms = (appState.rooms || []).filter(r => String(r.id) !== String(roomId));
        saveState('rooms');
        showToast('Ruang ujian dihapus', 'success');
        renderAssessmentModule(document.getElementById('view-container'), 'ruang');
    });
}

function openManageRoomModal(roomId) {
    const room = (appState.rooms || []).find(r => String(r.id) === String(roomId));
    if (!room) return;

    const modal = document.getElementById('modal-container');
    const students = appState.students || [];

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-slate-800 text-lg">Kelola Anggota: ${room.name}</h3>
                        <p class="text-xs text-slate-400">Tambah anggota manual atau import via Excel / CSV template</p>
                    </div>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border">
                    <div class="space-y-2">
                        <label class="block text-xs uppercase font-bold text-slate-600">Tambah Anggota Manual</label>
                        <div class="flex gap-2">
                            <select id="room-select-student" class="flex-1 px-3 py-2 bg-white border rounded-xl text-xs">
                                <option value="">-- Pilih Siswa --</option>
                                ${students.map(st => `<option value="${st.id}">${st.name} (${st.nis || 'Tanpa NIS'})</option>`).join('')}
                            </select>
                            <button type="button" onclick="addStudentToRoom('${room.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold">Tambah</button>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="block text-xs uppercase font-bold text-slate-600">Import Anggota (Excel / Template)</label>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="downloadRoomTemplate()" class="px-3 py-2 bg-white hover:bg-slate-100 border rounded-xl text-xs font-semibold text-slate-700 flex items-center space-x-1">
                                <i class="fa-solid fa-download text-emerald-600"></i><span>Template</span>
                            </button>
                            <input type="file" id="room-excel-file" accept=".csv, .xlsx, .xls" onchange="handleRoomExcelImport(event, '${room.id}')" class="text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"/>
                        </div>
                    </div>
                </div>

                <div class="space-y-3">
                    <h4 class="font-bold text-slate-700 text-sm">Daftar Anggota di Ruang Ini (${(room.members || []).length})</h4>
                    <div class="max-h-60 overflow-y-auto space-y-2 border rounded-2xl p-3 bg-white">
                        ${(room.members || []).length > 0 ? (room.members || []).map(mId => {
                            const st = students.find(s => String(s.id) === String(mId)) || { name: mId, nis: '-' };
                            return `
                                <div class="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border text-xs">
                                    <div>
                                        <p class="font-bold text-slate-800">${st.name}</p>
                                        <p class="text-[10px] text-slate-400">NIS: ${st.nis || '-'}</p>
                                    </div>
                                    <button type="button" onclick="removeStudentFromRoom('${room.id}', '${mId}')" class="text-rose-400 hover:text-rose-600 px-2 py-1"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            `;
                        }).join('') : `
                            <div class="text-center py-6 text-xs text-slate-400">
                                <i class="fa-solid fa-user-group text-xl mb-1"></i>
                                <p>Belum ada anggota dalam ruang ini.</p>
                            </div>
                        `}
                    </div>
                </div>

                <div class="flex justify-end pt-2">
                    <button type="button" onclick="closeModal(); renderAssessmentModule(document.getElementById('view-container'), 'ruang');" class="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-semibold">Tutup</button>
                </div>
            </div>
        </div>
    `;
}

function addStudentToRoom(roomId) {
    const select = document.getElementById('room-select-student');
    const studentId = select ? select.value : '';
    if (!studentId) {
        showToast('Pilih siswa terlebih dahulu!', 'error');
        return;
    }

    const room = (appState.rooms || []).find(r => String(r.id) === String(roomId));
    if (!room) return;

    if (!room.members) room.members = [];
    if (room.members.includes(studentId)) {
        showToast('Siswa sudah ada di dalam ruang ini.', 'info');
        return;
    }

    room.members.push(studentId);
    saveState('rooms');
    showToast('Siswa berhasil ditambahkan ke ruang!', 'success');
    openManageRoomModal(roomId);
}

function removeStudentFromRoom(roomId, studentId) {
    const room = (appState.rooms || []).find(r => String(r.id) === String(roomId));
    if (!room) return;

    room.members = (room.members || []).filter(id => String(id) !== String(studentId));
    saveState('rooms');
    showToast('Siswa dikeluarkan dari ruang', 'success');
    openManageRoomModal(roomId);
}

function downloadRoomTemplate() {
    if (typeof XLSX === 'undefined') {
        showToast('Library XLSX belum dimuat.', 'error');
        return;
    }
    const ws_data = [
        ["NIS", "Nama Siswa"],
        ["1001", "Muhammad Al Fatih"],
        ["1002", "Fatimah Az-Zahra"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anggota_Ruang");
    XLSX.writeFile(wb, "template_anggota_ruang.xlsx");
    showToast('Template Excel (.xlsx) berhasil diunduh!', 'success');
}

function handleRoomExcelImport(e, roomId) {
    const file = e.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        showToast('Library XLSX belum dimuat.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});

        const room = (appState.rooms || []).find(r => String(r.id) === String(roomId));
        if (!room) return;
        if (!room.members) room.members = [];

        let addedCount = 0;
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            const nis = row[0] ? String(row[0]).trim() : '';
            const name = row[1] ? String(row[1]).trim() : '';

            if (!nis && !name) continue;

            const st = (appState.students || []).find(s => (s.nis && String(s.nis) === nis) || (s.name && s.name.toLowerCase() === name.toLowerCase()));
            if (st && !room.members.includes(st.id)) {
                room.members.push(st.id);
                addedCount++;
            }
        }

        saveState('rooms');
        showToast(`Berhasil import ${addedCount} anggota ke ruang!`, 'success');
        openManageRoomModal(roomId);
    };
    reader.readAsArrayBuffer(file);
}

// Monitoring & Messaging Control Functions
function isStudentBlocked(examId, studentId) {
    if (!examId || !studentId) return false;
    const map = appState.blockedStudents || JSON.parse(localStorage.getItem('madrasah_blocked_students')) || {};
    const eId = String(examId);
    const sId = String(studentId);
    const k1 = eId + '_' + sId;
    const k2 = sId + '_' + eId;
    return map[k1] === true || map[k1] === 'true' || map[k2] === true || map[k2] === 'true';
}

function setStudentBlockState(examId, studentId, blockState) {
    if (!appState.blockedStudents) appState.blockedStudents = JSON.parse(localStorage.getItem('madrasah_blocked_students')) || {};
    const eId = String(examId);
    const sId = String(studentId);
    const k1 = eId + '_' + sId;
    const k2 = sId + '_' + eId;
    
    if (blockState) {
        appState.blockedStudents[k1] = true;
        appState.blockedStudents[k2] = true;
    } else {
        delete appState.blockedStudents[k1];
        delete appState.blockedStudents[k2];
        appState.blockedStudents[k1] = false;
        appState.blockedStudents[k2] = false;

        if (!appState.studentOutOfTab) appState.studentOutOfTab = JSON.parse(localStorage.getItem('madrasah_student_out_of_tab')) || {};
        delete appState.studentOutOfTab[k1];
        delete appState.studentOutOfTab[k2];
        appState.studentOutOfTab[k1] = false;
        appState.studentOutOfTab[k2] = false;
        safeSetStorage('madrasah_student_out_of_tab', appState.studentOutOfTab);
    }
    safeSetStorage('madrasah_blocked_students', appState.blockedStudents);
}

function toggleBlockStudent(examId, studentId) {
    const currentlyBlocked = isStudentBlocked(examId, studentId);
    const nextState = !currentlyBlocked;
    setStudentBlockState(examId, studentId, nextState);

    const k1 = examId + '_' + studentId;
    const k2 = studentId + '_' + examId;

    if (!nextState) {
        if (!appState.examMessages) appState.examMessages = JSON.parse(localStorage.getItem('madrasah_exam_messages')) || {};
        delete appState.examMessages[k1];
        delete appState.examMessages[k2];
        safeSetStorage('madrasah_exam_messages', appState.examMessages);
    }

    syncExamStateToServer({ 
        blocked: { [k1]: nextState, [k2]: nextState },
        outOfTab: { [k1]: false, [k2]: false },
        messages: appState.examMessages || {},
        replaceMessages: true
    });

    showToast(nextState ? 'Siswa berhasil diblokir dari ujian' : 'Siswa di-unblock (Akses dibuka kembali)', nextState ? 'error' : 'success');
    const containerEl = document.getElementById('view-container');
    if (containerEl) renderAssessmentModule(containerEl, 'monitoring', examId);
}

function openSendMessageModal(examId, studentId) {
    const st = (appState.students || []).find(s => String(s.id) === String(studentId)) || { name: 'Siswa' };
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800">Kirim Pesan ke ${st.name}</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark"></i></button></div>
                <form onsubmit="sendStudentExamMessage(event, '${examId}', '${studentId}')" class="space-y-3 text-xs sm:text-sm">
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Isi Pesan Peringatan / Instruksi</label>
                        <textarea id="exam-msg-text" required rows="3" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" placeholder="Contoh: Jangan melihat ke samping atau mencontek!"></textarea>
                    </div>
                    <div class="flex justify-end space-x-2 pt-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl">Batal</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold">Kirim Pesan</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function sendStudentExamMessage(e, examId, studentId) {
    e.preventDefault();
    const text = document.getElementById('exam-msg-text').value.trim();
    if (!text) return;
    if (!appState.examMessages) appState.examMessages = {};
    appState.examMessages[studentId + '_' + examId] = text;
    safeSetStorage('madrasah_exam_messages', appState.examMessages);
    syncExamStateToServer({ messages: { [studentId + '_' + examId]: text } });
    closeModal();
    showToast('Pesan berhasil dikirim ke siswa!', 'success');
}

function openBroadcastMessageModal(examId) {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800">Kirim Pesan ke Semua Peserta Ujian</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark"></i></button></div>
                <form onsubmit="sendBroadcastExamMessage(event, '${examId}')" class="space-y-3 text-xs sm:text-sm">
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Isi Pesan Broadcast</label>
                        <textarea id="exam-broadcast-text" required rows="3" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" placeholder="Contoh: Sisa waktu ujian tinggal 10 menit lagi!"></textarea>
                    </div>
                    <div class="flex justify-end space-x-2 pt-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl">Batal</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold">Kirim ke Semua</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function sendBroadcastExamMessage(e, examId) {
    e.preventDefault();
    const text = document.getElementById('exam-broadcast-text').value.trim();
    if (!text) return;
    if (!appState.examMessages) appState.examMessages = {};
    appState.examMessages['broadcast_' + examId] = text;
    safeSetStorage('madrasah_exam_messages', appState.examMessages);
    syncExamStateToServer({ messages: { ['broadcast_' + examId]: text } });
    closeModal();
    showToast('Pesan broadcast berhasil dikirim ke semua siswa!', 'success');
}

function dismissStudentExamMessage(examId, studentId, isBroadcast) {
    if (!appState.examMessages) appState.examMessages = {};
    if (isBroadcast) {
        delete appState.examMessages['broadcast_' + examId];
    } else {
        if (studentId && examId) {
            delete appState.examMessages[studentId + '_' + examId];
            delete appState.examMessages[examId + '_' + studentId];
        }
    }
    safeSetStorage('madrasah_exam_messages', appState.examMessages);
    syncExamStateToServer({ messages: appState.examMessages, replaceMessages: true });
    
    const overlay = document.getElementById('exam-message-overlay');
    if (overlay) overlay.remove();
    renderActiveExamScreen();
}

// Phase 5: Interactive Real-time Violation Audit Modal
window.openViolationsLogModal = async function(examId) {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col border border-slate-100">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-slate-800 text-base flex items-center gap-2">
                            <i class="fa-solid fa-triangle-exclamation text-rose-600"></i>
                            Log Pelanggaran Anti-Cheat Peserta
                        </h3>
                        <p class="text-xs text-slate-500">Catatan riwayat keluar tab, multi-window, dan tindakan pengamanan otomatis.</p>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="flex items-center justify-between gap-3">
                    <div class="relative flex-1">
                        <i class="fa-solid fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                        <input type="text" id="violation-search-input" onkeyup="filterViolationsTable()" placeholder="Cari nama siswa atau alasan..." class="w-full pl-8 pr-4 py-2 bg-slate-50 border rounded-2xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"/>
                    </div>
                    <button type="button" onclick="openViolationsLogModal('${examId}')" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm">
                        <i class="fa-solid fa-arrows-rotate text-[10px]"></i>
                        <span>Refresh</span>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto space-y-2 pr-1" id="violations-log-list">
                    <div class="text-center py-10 text-slate-400 text-xs">
                        <i class="fa-solid fa-spinner animate-spin text-lg mb-2"></i>
                        <p>Memuat riwayat pelanggaran...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    try {
        const res = await fetch(`/api/exams/${encodeURIComponent(examId)}/violations`);
        const data = await res.json();
        const container = document.getElementById('violations-log-list');
        if (!container) return;

        window.__currentViolationsList = (data.success && Array.isArray(data.violations)) ? data.violations : [];
        renderViolationsListUI(window.__currentViolationsList);
    } catch(e) {
        const container = document.getElementById('violations-log-list');
        if (container) container.innerHTML = `<div class="text-center py-8 text-rose-500 text-xs">Gagal memuat log pelanggaran.</div>`;
    }
};

window.renderViolationsListUI = function(list) {
    const container = document.getElementById('violations-log-list');
    if (!container) return;
    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-slate-400 text-xs space-y-2">
                <i class="fa-solid fa-shield-halved text-emerald-500 text-3xl"></i>
                <p class="font-bold text-slate-600">Belum ada pelanggaran yang terdeteksi.</p>
                <p class="text-[11px]">Seluruh peserta ujian masih disiplin berada dalam tab ujian.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map((v, i) => {
        const d = new Date(v.timestamp);
        const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `
            <div class="violation-row-item p-3 rounded-2xl border ${v.autoBlocked ? 'bg-rose-50/80 border-rose-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80'} flex items-center justify-between gap-3 text-xs transition">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl ${v.autoBlocked ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-700'} flex items-center justify-center text-xs font-bold shrink-0">
                        ${v.autoBlocked ? '<i class="fa-solid fa-lock text-[11px]"></i>' : (v.tabSwitches || i + 1)}
                    </div>
                    <div>
                        <div class="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>${v.studentName || 'Peserta Ujian'}</span>
                            ${v.className ? `<span class="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-lg text-[10px]">${v.className}</span>` : ''}
                            ${v.autoBlocked ? `<span class="px-2 py-0.5 bg-rose-600 text-white rounded-lg text-[9px] font-bold">DIBLOKIR OTOMATIS</span>` : ''}
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">
                            <i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1"></i>
                            ${v.reason || 'Keluar Tab / Aplikasi Ujian'} &bull; Pelanggaran ke-${v.tabSwitches || 1}
                        </p>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <span class="px-2.5 py-1 bg-white border rounded-xl text-[10px] font-mono text-slate-600 shadow-sm">${timeStr}</span>
                </div>
            </div>
        `;
    }).join('');
};

window.filterViolationsTable = function() {
    const query = (document.getElementById('violation-search-input')?.value || '').toLowerCase();
    if (!window.__currentViolationsList) return;
    const filtered = window.__currentViolationsList.filter(v => 
        (v.studentName || '').toLowerCase().includes(query) || 
        (v.reason || '').toLowerCase().includes(query) ||
        (v.className || '').toLowerCase().includes(query)
    );
    window.renderViolationsListUI(filtered);
};

async function deductTokenForVideo() {
    const role = String(appState.role || '').toLowerCase().trim();
    const isTeacher = role === 'teacher' || role === 'guru';
    const teacherId = isTeacher ? appState.currentUser?.id : null;

    const tokenBalance = (typeof window.getActiveMadrasahTokenBalance === 'function')
        ? window.getActiveMadrasahTokenBalance()
        : ((appState.currentUser && appState.currentUser.cbtTokenBalance) || 0);

    if (tokenBalance <= 0) {
        if (window.showToast) {
            window.showToast(isTeacher 
                ? 'Saldo Token Ujian Guru habis (0 Token)! Harap isi ulang token Anda dengan Kode Aktivasi Token dari Bos.' 
                : 'Saldo Token Ujian habis (0 Token)! Harap isi ulang token Anda untuk menggunakan fitur Video Live.', 'error');
        } else {
            alert('Saldo Token Ujian habis (0 Token)! Harap isi ulang token Anda.');
        }
        return false;
    }

    const currentMadrasah = (appState.madrasahs && appState.madrasahs.find(m => String(m.id) === String(appState.currentUser?.madrasahId) || String(m.slug) === String(appState.currentUser?.madrasahSlug))) || (appState.madrasahs && appState.madrasahs[0]) || {};
    const madrasahId = currentMadrasah.id || (appState.currentUser && appState.currentUser.madrasahId) || 'default';

    try {
        const deductRes = await fetch('/api/deduct-cbt-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ madrasahId, teacherId })
        });
        const deductData = await deductRes.json();
        if (!deductData.success) {
            if (window.showToast) {
                window.showToast(deductData.message || 'Gagal mengonsumsi token ujian.', 'error');
            } else {
                alert(deductData.message || 'Gagal mengonsumsi token.');
            }
            return false;
        }
        const remaining = typeof deductData.remainingTokens === 'number' ? deductData.remainingTokens : (typeof deductData.cbtTokenBalance === 'number' ? deductData.cbtTokenBalance : 0);
        
        if (isTeacher) {
            if (appState.currentUser) {
                appState.currentUser.cbtTokenBalance = remaining;
                if (window.safeSetLocalStorage) window.safeSetLocalStorage('madrasah_current_user', appState.currentUser);
            }
            if (appState.teachers && appState.currentUser) {
                const tchIdx = appState.teachers.findIndex(t => String(t.id) === String(appState.currentUser.id));
                if (tchIdx >= 0) {
                    appState.teachers[tchIdx].cbtTokenBalance = remaining;
                }
            }
        } else {
            if (currentMadrasah) currentMadrasah.cbtTokenBalance = remaining;
            if (appState.madrasah) appState.madrasah.cbtTokenBalance = remaining;
            if (appState.currentUser) appState.currentUser.cbtTokenBalance = remaining;
            if (appState.madrasahs) {
                const fm = appState.madrasahs.find(m => String(m.id) === String(madrasahId));
                if (fm) fm.cbtTokenBalance = remaining;
            }
        }

        if (window.updateHeaderTokenBadge) window.updateHeaderTokenBadge();

        const tokenDisplay = document.getElementById('token-balance-display-card');
        if (tokenDisplay) {
            tokenDisplay.innerHTML = `<span class="text-2xl sm:text-3xl font-black text-white">${remaining} Token</span>`;
        }

        if (window.showToast) {
            window.showToast('1 Token Ujian dikonsumsi untuk mengaktifkan Video Live.', 'success');
        }
        return true;
    } catch (err) {
        console.error('Error deduct token for video:', err);
        if (window.showToast) {
            window.showToast('Gagal memproses konsumsi token ke server.', 'error');
        } else {
            alert('Gagal memproses konsumsi token.');
        }
        return false;
    }
}


window.promptVideoDurationAndDeductTokens = function(onSuccess) {
    const role = String(appState.role || '').toLowerCase().trim();
    const isTeacher = role === 'teacher' || role === 'guru';
    const tokenBalance = (typeof window.getActiveMadrasahTokenBalance === 'function')
        ? window.getActiveMadrasahTokenBalance()
        : ((appState.currentUser && appState.currentUser.cbtTokenBalance) || 0);

    if (tokenBalance <= 0) {
        if (window.showToast) {
            window.showToast('Saldo Token Ujian habis (0 Token)! Harap isi ulang token Anda untuk menggunakan fitur Video Live (1 Token = 1 Menit).', 'error');
        } else {
            alert('Saldo Token Ujian habis (0 Token)! Harap isi ulang token Anda.');
        }
        return;
    }

    const modal = document.getElementById('modal-container');
    if (!modal) {
        if (onSuccess) onSuccess(1);
        return;
    }
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
    }
    modal.innerHTML = `
        <div class="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 border border-slate-100 text-slate-800">
                <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-xl shadow-inner">
                    <i class="fa-solid fa-video"></i>
                </div>
                <div class="text-center space-y-1">
                    <h3 class="font-black text-lg">Konfirmasi Mode Video Live</h3>
                    <p class="text-xs text-slate-500">Ketentuan: <strong>1 Token = 1 Menit Video Live</strong> (Bisa Custom)</p>
                </div>
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div class="flex justify-between items-center text-xs font-bold text-slate-600 pb-1 border-b border-slate-200/80">
                        <span>Saldo Token Anda:</span>
                        <span class="text-amber-600 font-black bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/80">${tokenBalance} Token</span>
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-black text-slate-700">Durasi Video Live (Menit):</label>
                        <div class="relative flex items-center">
                            <input type="number" id="video-duration-minutes-input" min="1" max="${tokenBalance}" value="1" placeholder="Tulis durasi menit..." class="w-full pl-4 pr-24 py-2.5 bg-white border border-slate-300 rounded-xl font-black text-sm text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-sm">
                            <span class="absolute right-3 text-xs font-bold text-slate-500 pointer-events-none">Menit / Token</span>
                        </div>
                    </div>

                    <div class="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 flex justify-between items-center font-medium">
                        <span>Total Pemotongan Token:</span>
                        <strong class="text-amber-700 font-black text-xs"><span id="total-tokens-preview">1</span> Token (<span id="total-minutes-preview">1</span> Menit)</strong>
                    </div>
                </div>

                <div class="flex space-x-3 pt-1">
                    <button type="button" onclick="closeModal()" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" id="confirm-video-token-btn" class="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-check"></i> <span>Konfirmasi & Potong Token</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    const inputEl = document.getElementById('video-duration-minutes-input');
    const previewEl = document.getElementById('total-tokens-preview');
    const minPreviewEl = document.getElementById('total-minutes-preview');

    const updateUI = (val) => {
        let num = parseInt(val) || 1;
        if (num < 1) num = 1;
        if (num > tokenBalance) num = tokenBalance;
        if (inputEl) inputEl.value = num;
        if (previewEl) previewEl.textContent = num;
        if (minPreviewEl) minPreviewEl.textContent = num;

        // Highlight active preset button
        const presetBtns = document.querySelectorAll('.preset-token-btn');
        presetBtns.forEach(btn => {
            btn.className = "preset-token-btn px-2.5 py-2 bg-white text-slate-700 border border-slate-200 hover:border-amber-400 rounded-xl font-bold text-xs transition cursor-pointer";
        });

        const activePreset = document.getElementById(`preset-token-btn-${num}`);
        if (activePreset) {
            activePreset.className = "preset-token-btn px-2.5 py-2 bg-amber-500 text-white border border-amber-500 rounded-xl font-bold text-xs shadow-sm transition cursor-pointer";
        } else {
            const customBtn = document.getElementById('preset-token-btn-custom');
            if (customBtn) customBtn.className = "preset-token-btn px-2.5 py-2 bg-amber-500 text-white border border-amber-500 rounded-xl font-bold text-xs shadow-sm transition cursor-pointer";
        }
    };

    window._setPresetVideoToken = (preset) => {
        if (preset === 'custom') {
            if (inputEl) {
                inputEl.focus();
                inputEl.select();
            }
            updateUI(inputEl ? inputEl.value : 1);
        } else {
            updateUI(preset);
        }
    };

    if (inputEl) {
        inputEl.oninput = () => {
            updateUI(inputEl.value);
        };
    }

    // Default selection: 1 Menit (1 Token)
    updateUI(1);

    const btn = document.getElementById('confirm-video-token-btn');
    if (btn) {
        btn.onclick = async () => {
            const minutes = parseInt(inputEl?.value) || 1;
            if (minutes > tokenBalance) {
                if (window.showToast) window.showToast('Durasi melebihi saldo token Anda!', 'error');
                return;
            }
            closeModal();

            let successCount = 0;
            for (let i = 0; i < minutes; i++) {
                const res = await deductTokenForVideo();
                if (res) {
                    successCount++;
                } else {
                    break;
                }
            }

            if (successCount > 0) {
                if (window.showToast) window.showToast(`${successCount} Token berhasil dipotong untuk durasi video ${successCount} menit.`, 'success');
                if (onSuccess) onSuccess(successCount);

                // Set automatic revert timer to photo mode when duration expires
                if (window._videoModeTimer) clearTimeout(window._videoModeTimer);
                window._videoModeTimer = setTimeout(() => {
                    appState.livecamMode = 'gambar';
                    appState.gameMonitoringLivecamMode = 'gambar';
                    appState.lkpdLivecamMode = 'gambar';
                    if (appState.livecamModes) appState.livecamModes = {};
                    if (appState.gameMonitoringStudentModes) appState.gameMonitoringStudentModes = {};
                    if (appState.lkpdLivecamModes) appState.lkpdLivecamModes = {};

                    if (typeof renderAssessmentModule === 'function' && document.getElementById('view-container')) {
                        const activeExam = appState.activeExamId || (appState.exams && appState.exams[0]?.id);
                        if (activeExam) renderAssessmentModule(document.getElementById('view-container'), 'monitoring', activeExam);
                    }
                    if (typeof renderGameMonitoringDashboard === 'function') renderGameMonitoringDashboard();
                    if (typeof window.renderLkpdMonitoringSection === 'function' && document.getElementById('lkpd-monitoring-container')) {
                        window.renderLkpdMonitoringSection(document.getElementById('lkpd-monitoring-container'), appState.activeMonitoringLkpdId);
                    }
                    if (window.showToast) {
                        window.showToast(`Waktu video live (${successCount} menit) telah habis. Kamera otomatis dikembalikan ke mode foto absen.`, 'info');
                    }
                }, successCount * 60 * 1000);
            }
        };
    }
};

function showTokenDeductionConfirmModal(message, onConfirm) {
    const modal = document.getElementById('modal-container');
    if (!modal) {
        if (onConfirm) onConfirm();
        return;
    }
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
    }
    modal.innerHTML = `
        <div class="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center space-y-4 border border-slate-100">
                <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-xl">
                    <i class="fa-solid fa-coins"></i>
                </div>
                <h3 class="font-bold text-slate-800 text-base">Konfirmasi Akses Video Live</h3>
                <p class="text-xs text-slate-500 leading-relaxed">${message}</p>
                <div class="flex space-x-3 pt-2">
                    <button type="button" onclick="closeModal()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" id="confirm-token-deduct-btn" class="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-2xl text-xs shadow transition cursor-pointer">
                        Ya, Aktifkan
                    </button>
                </div>
            </div>
        </div>
    `;
    const btn = document.getElementById('confirm-token-deduct-btn');
    if (btn) {
        btn.onclick = () => {
            closeModal();
            if (onConfirm) onConfirm();
        };
    }
}

async function toggleLivecamMode(examId) {
    const currentMode = appState.livecamMode || 'gambar';
    const targetMode = currentMode === 'gambar' ? 'video' : 'gambar';
    
    if (targetMode === 'video') {
        if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
            window.promptVideoDurationAndDeductTokens((minutes) => {
                appState.livecamMode = 'video';
                renderAssessmentModule(document.getElementById('view-container'), 'monitoring', examId);
            });
        } else {
            appState.livecamMode = 'video';
            renderAssessmentModule(document.getElementById('view-container'), 'monitoring', examId);
        }
    } else {
        appState.livecamMode = 'gambar';
        renderAssessmentModule(document.getElementById('view-container'), 'monitoring', examId);
    }
}

async function toggleStudentLivecamMode(examId, studentId) {
    if (!appState.livecamModes) appState.livecamModes = {};
    const currentMode = appState.livecamModes[studentId] || 'gambar';
    const targetMode = currentMode === 'gambar' ? 'video' : 'gambar';
    
    if (targetMode === 'video') {
        if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
            window.promptVideoDurationAndDeductTokens((minutes) => {
                appState.livecamModes[studentId] = 'video';
                renderAssessmentModule(document.getElementById('view-container'), 'monitoring', examId);
            });
        } else {
            appState.livecamModes[studentId] = 'video';
            renderAssessmentModule(document.getElementById('view-container'), 'monitoring', examId);
        }
    } else {
        appState.livecamModes[studentId] = 'gambar';
        renderAssessmentModule(document.getElementById('view-container'), 'monitoring', examId);
    }
}

function onMonitoringFilterChange(examId) {
    const classIdEl = document.getElementById('monitor-class-filter');
    const roomIdEl = document.getElementById('monitor-room-filter');
    const searchInputEl = document.getElementById('monitor-search-input');

    const classId = classIdEl ? classIdEl.value : '';
    const roomId = roomIdEl ? roomIdEl.value : '';
    const searchVal = searchInputEl ? searchInputEl.value : '';

    appState.monitoringFilterClassId = classId;
    appState.monitoringFilterRoomId = roomId;
    appState.monitoringFilterSearch = searchVal;
    
    // Refresh monitoring view
    renderAssessmentModule(document.getElementById('view-container'), 'monitoring', examId);

    // Restore focus and cursor position if user was searching
    const newSearchInput = document.getElementById('monitor-search-input');
    if (newSearchInput && searchVal) {
        newSearchInput.focus();
        newSearchInput.setSelectionRange(searchVal.length, searchVal.length);
    }
}

// ==========================================
// KARTU PESERTA / NOMOR PESERTA GENERATOR
// ==========================================

function initKartuPesertaConfigIfNeeded() {
    if (!window.kartuPesertaConfig) {
        window.kartuPesertaConfig = {
            kop1: 'YAYASAN PENDIDIKAN ISLAM',
            kop2: 'MADRASAH TSANAWIYAH',
            kop3: 'SABILUL MUTTAQIN',
            alamat: 'Dsn simpang raya Ds Karya Maju Kec. Pengabuan Kab. Tanjung Jabung Barat, Jambi',
            kepalaSekolah: 'M. Zainal Fausi, S.Pd.I',
            tanggalUjian: 'Pengabuan, 04 Desember 2024',
            logoKiri: '',
            logoKanan: '',
            stempel: '',
            ttd: '',
            filterClassId: '',
            filterRoomId: '',
            selectedClassIds: [],
            logoSize: 44,
            stempelSize: 85,
            stempelOffsetLeft: -32,
            stempelOffsetTop: -12,
            ttdSize: 75,
            ttdOffsetLeft: 10,
            ttdOffsetTop: 1,
            paddingTop: 4,
            paddingBottom: 4,
            studentPhotoWidth: 50,
            studentPhotoHeight: 65,
            studentPhotoOffsetLeft: -115,
            studentPhotoOffsetTop: -5,
            showStudentPhoto: true,
            titleText: 'KARTU PESERTA',
            showPassword: true,
            signatureGroupOffsetLeft: 0,
            signatureGroupOffsetTop: 0,
            cardWidth: 380,
            cardHeight: 260
        };
    } else {
        if (!window.kartuPesertaConfig.selectedClassIds) window.kartuPesertaConfig.selectedClassIds = [];
        if (window.kartuPesertaConfig.cardWidth === undefined) window.kartuPesertaConfig.cardWidth = 380;
        if (window.kartuPesertaConfig.cardHeight === undefined) window.kartuPesertaConfig.cardHeight = 260;
        if (window.kartuPesertaConfig.logoSize === undefined) window.kartuPesertaConfig.logoSize = 44;
        if (window.kartuPesertaConfig.stempelSize === undefined) window.kartuPesertaConfig.stempelSize = 85;
        if (window.kartuPesertaConfig.stempelOffsetLeft === undefined) window.kartuPesertaConfig.stempelOffsetLeft = -32;
        if (window.kartuPesertaConfig.stempelOffsetTop === undefined) window.kartuPesertaConfig.stempelOffsetTop = -12;
        if (window.kartuPesertaConfig.ttdSize === undefined) window.kartuPesertaConfig.ttdSize = 75;
        if (window.kartuPesertaConfig.ttdOffsetLeft === undefined) window.kartuPesertaConfig.ttdOffsetLeft = 10;
        if (window.kartuPesertaConfig.ttdOffsetTop === undefined) window.kartuPesertaConfig.ttdOffsetTop = 1;
        if (window.kartuPesertaConfig.paddingTop === undefined) window.kartuPesertaConfig.paddingTop = 4;
        if (window.kartuPesertaConfig.paddingBottom === undefined) window.kartuPesertaConfig.paddingBottom = 4;
        if (window.kartuPesertaConfig.studentPhotoWidth === undefined) window.kartuPesertaConfig.studentPhotoWidth = 50;
        if (window.kartuPesertaConfig.studentPhotoHeight === undefined) window.kartuPesertaConfig.studentPhotoHeight = 65;
        if (window.kartuPesertaConfig.studentPhotoOffsetLeft === undefined) window.kartuPesertaConfig.studentPhotoOffsetLeft = -115;
        if (window.kartuPesertaConfig.studentPhotoOffsetTop === undefined) window.kartuPesertaConfig.studentPhotoOffsetTop = -5;
        if (window.kartuPesertaConfig.showStudentPhoto === undefined) window.kartuPesertaConfig.showStudentPhoto = true;
        if (window.kartuPesertaConfig.titleText === undefined) window.kartuPesertaConfig.titleText = 'KARTU PESERTA';
        if (window.kartuPesertaConfig.showPassword === undefined) window.kartuPesertaConfig.showPassword = true;
        if (window.kartuPesertaConfig.signatureGroupOffsetLeft === undefined) window.kartuPesertaConfig.signatureGroupOffsetLeft = 0;
        if (window.kartuPesertaConfig.signatureGroupOffsetTop === undefined) window.kartuPesertaConfig.signatureGroupOffsetTop = 0;
    }
    if (!window.kartuPesertaActiveTab) {
        window.kartuPesertaActiveTab = 'konten';
    }
}

function getLogoKiri() {
    initKartuPesertaConfigIfNeeded();
    const size = window.kartuPesertaConfig.logoSize || 44;
    if (window.kartuPesertaConfig.logoKiri) {
        return `<img src="${window.kartuPesertaConfig.logoKiri}" style="max-width: 100%; max-height: ${size}px; object-fit: contain;" />`;
    }
    return `
    <svg viewBox="0 0 100 100" style="width: ${size}px; height: ${size}px; display: inline-block;">
        <!-- Green outer shield with golden/white border -->
        <path d="M 15,15 C 35,12 40,5 50,15 C 60,5 65,12 85,15 C 85,50 78,75 50,92 C 22,75 15,50 15,15 Z" fill="#22c55e" stroke="#15803d" stroke-width="1.5" />
        <path d="M 18,18 C 35,15 40,9 50,18 C 60,9 65,15 82,18 C 82,48 75,71 50,87 C 25,71 18,48 18,18 Z" fill="none" stroke="#ffffff" stroke-width="1" />
        <!-- Book/Al-Quran inside -->
        <path d="M 32,55 C 40,50 48,53 50,55 C 52,53 60,50 68,55 L 68,43 C 60,38 52,41 50,43 C 48,41 40,38 32,43 Z" fill="#ffffff" stroke="#15803d" stroke-width="0.5" />
        <line x1="50" y1="43" x2="50" y2="55" stroke="#15803d" stroke-width="1" />
        <!-- Star on top -->
        <path d="M 50,22 L 52,27 L 57,27 L 53,30 L 55,35 L 50,32 L 45,35 L 47,30 L 43,27 L 48,27 Z" fill="#f59e0b" />
        <!-- Wheat/Paddy leaves around circle -->
        <path d="M 28,52 A 22,22 0 0,0 50,74 A 22,22 0 0,0 72,52" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="2,2" />
        <!-- Letters "YPISM" or similar inside -->
        <text x="50" y="66" font-family="sans-serif" font-weight="extrabold" font-size="6.5" fill="#ffffff" text-anchor="middle">YPISM</text>
    </svg>
    `;
}

function getLogoKanan() {
    initKartuPesertaConfigIfNeeded();
    const size = window.kartuPesertaConfig.logoSize || 44;
    if (window.kartuPesertaConfig.logoKanan) {
        return `<img src="${window.kartuPesertaConfig.logoKanan}" style="max-width: 100%; max-height: ${size}px; object-fit: contain;" />`;
    }
    return `
    <svg viewBox="0 0 100 100" style="width: ${size}px; height: ${size}px; display: inline-block;">
        <!-- Pentagon Outer -->
        <polygon points="50,5 92,36 76,86 24,86 8,36" fill="#15803d" stroke="#f59e0b" stroke-width="2" />
        <polygon points="50,9 88,38 73,83 27,83 12,38" fill="none" stroke="#ffffff" stroke-width="1" />
        <!-- Inner circle/emblem -->
        <circle cx="50" cy="50" r="24" fill="#166534" stroke="#f59e0b" stroke-width="1.5" />
        <!-- Star at the top of the circle -->
        <path d="M 50,30 L 52,34 L 56,34 L 53,36 L 54,40 L 50,38 L 46,40 L 47,36 L 44,34 L 48,34 Z" fill="#f59e0b" />
        <!-- Rehal (book stand) with Al-Quran inside -->
        <path d="M 38,58 L 62,58 M 38,58 L 50,50 L 62,58 M 50,50 L 50,58" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
        <path d="M 42,48 C 46,45 49,47 50,48 C 51,47 54,45 58,48" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
        <!-- Leaves left and right -->
        <path d="M 32,50 A 18,18 0 0,0 50,68 A 18,18 0 0,0 68,50" fill="none" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="1.5,1.5" />
        <!-- Text "IKHLAS BERAMAL" at bottom -->
        <rect x="30" y="71" width="40" height="6" rx="1" fill="#f59e0b" />
        <text x="50" y="75.5" font-family="sans-serif" font-weight="bold" font-size="4" fill="#15803d" text-anchor="middle">IKHLAS BERAMAL</text>
    </svg>
    `;
}

function getStempelSvg(schoolName) {
    initKartuPesertaConfigIfNeeded();
    const size = window.kartuPesertaConfig.stempelSize || 85;
    if (window.kartuPesertaConfig.stempel) {
        return `<img src="${window.kartuPesertaConfig.stempel}" style="max-width: 100%; max-height: ${size}px; object-fit: contain;" />`;
    }
    return `
    <svg viewBox="0 0 120 120" style="width: ${size}px; height: ${size}px; opacity: 0.85; display: inline-block;">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#2b3094" stroke-width="2" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="#2b3094" stroke-width="1" />
        <circle cx="60" cy="60" r="32" fill="none" stroke="#2b3094" stroke-width="1.5" />
        
        <!-- Parallel lines in the middle -->
        <line x1="28" y1="46" x2="92" y2="46" stroke="#2b3094" stroke-width="1.5" />
        <line x1="28" y1="74" x2="92" y2="74" stroke="#2b3094" stroke-width="1.5" />
        
        <!-- Text inside middle section -->
        <text x="60" y="57" font-family="sans-serif" font-weight="900" font-size="10" fill="#2b3094" text-anchor="middle" letter-spacing="0.5">MTs</text>
        <text x="60" y="69" font-family="sans-serif" font-weight="800" font-size="5" fill="#2b3094" text-anchor="middle" letter-spacing="0.2">SABILUL MUTTAQIN</text>
        
        <!-- Text inside lower section of inner circle -->
        <text x="60" y="87" font-family="sans-serif" font-weight="bold" font-size="5.5" fill="#2b3094" text-anchor="middle" letter-spacing="0.5">TERDAFTAR</text>
        
        <!-- Text inside upper section of inner circle (Registration/NSM Number) -->
        <text x="60" y="38" font-family="sans-serif" font-weight="bold" font-size="5" fill="#2b3094" text-anchor="middle">121215060027</text>
        
        <!-- Circular texts on the outer rings -->
        <g fill="#2b3094" font-family="sans-serif" font-weight="bold" font-size="7.2" text-anchor="middle">
            <path id="stampTextPathUpper" d="M 15,60 A 45,45 0 0,1 105,60" fill="none" />
            <path id="stampTextPathLower" d="M 105,60 A 45,45 0 0,1 15,60" fill="none" />
            <text><textPath href="#stampTextPathUpper" startOffset="50%">MADRASAH TSANAWIYAH</textPath></text>
            <text><textPath href="#stampTextPathLower" startOffset="50%">* KEC. PENGABUAN *</textPath></text>
        </g>
    </svg>
    `;
}

function getTtdHtml() {
    initKartuPesertaConfigIfNeeded();
    const size = window.kartuPesertaConfig.ttdSize || 75;
    if (window.kartuPesertaConfig.ttd) {
        return `<img src="${window.kartuPesertaConfig.ttd}" style="max-width: 100%; max-height: ${Math.round(size * 0.53)}px; object-fit: contain;" />`;
    }
    return `
    <svg viewBox="0 0 100 50" style="width: ${size}px; height: ${Math.round(size * 0.5)}px; display: inline-block; pointer-events: none; opacity: 0.95;">
        <!-- Clean hand drawn cursive signature path matching 'Jmy' signature in reference image -->
        <path d="M 12,28 C 22,25 35,22 42,24 C 48,26 45,35 42,40 C 38,45 32,45 35,38 C 38,30 48,15 54,20 C 60,25 58,35 62,38 C 66,40 76,30 84,32 M 52,26 L 76,44 M 26,34 C 36,34 46,32 56,32" fill="none" stroke="#1e3a8a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    `;
}

function getKartuPesertaHtml(st, className, roomName, isPrintMode) {
    initKartuPesertaConfigIfNeeded();
    
    const logoKiriSrc = getLogoKiri();
    const logoKananSrc = getLogoKanan();
    const stampSvg = getStempelSvg(window.kartuPesertaConfig.kop3);
    const ttdHtml = getTtdHtml();
    
    const atts = (appState.attendance || []).filter(a => 
        (String(a.studentId) === String(st.id) || String(a.studentId) === String(st.name)) && 
        a.photo && a.photo.trim() !== ''
    );
    atts.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
    });
    const lastAttPhoto = atts.length > 0 ? atts[0].photo : '';
    const studentPhoto = lastAttPhoto || st.photo || '';
    
    const studentPhotoHtml = studentPhoto 
        ? `<img src="${studentPhoto}" style="width: 100%; height: 100%; object-fit: cover;" referrerPolicy="no-referrer" />`
        : `<div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #fafafa; border: 1px solid #ddd; text-align: center; font-size: 7px; line-height: 1.1; font-weight: bold; color: #94a3b8; box-sizing: border-box; padding: 2px;"><div style="font-size: 11px; margin-bottom: 2px; color: #cbd5e1;">👤</div>No Foto<br>Absensi</div>`;

    const widthVal = window.kartuPesertaConfig.cardWidth || 380;
    const heightVal = window.kartuPesertaConfig.cardHeight || 260;
    const contentHeight = heightVal - 100;

    const cardStyle = isPrintMode 
        ? `box-sizing: border-box; border: 1.5px solid #000; width: ${widthVal}px; height: ${heightVal}px; float: left; margin: 5px; padding-top: ${window.kartuPesertaConfig.paddingTop}px; padding-bottom: ${window.kartuPesertaConfig.paddingBottom}px; padding-left: 14px; padding-right: 14px; position: relative; font-family: Arial, sans-serif; page-break-inside: avoid; background-color: #fff; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;`
        : `box-sizing: border-box; border: 1.5px solid #000; width: ${widthVal}px; height: ${heightVal}px; padding-top: ${window.kartuPesertaConfig.paddingTop}px; padding-bottom: ${window.kartuPesertaConfig.paddingBottom}px; padding-left: 14px; padding-right: 14px; position: relative; font-family: Arial, sans-serif; background-color: #fff; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; user-select: none;`;

    const cardClass = isPrintMode ? 'card' : 'card preview-card-item shadow-md hover:shadow-lg transition-shadow';

    return `
    <div class="${cardClass}" style="${cardStyle}">
      <!-- KOP -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 2px;">
         <div style="width: 15%; text-align: left; display: flex; align-items: center; justify-content: center;">
            ${!isPrintMode ? `
               <div class="relative group cursor-col-resize select-none" 
                    title="Seret kiri-kanan untuk mengubah ukuran logo" 
                    onmousedown="initCardElementDrag(event, 'logoSize')" 
                    ontouchstart="initCardElementDrag(event, 'logoSize')"
                    style="display: flex; align-items: center; justify-content: center; position: relative;">
                  <div class="absolute -inset-1 border border-dashed border-emerald-400 opacity-0 group-hover:opacity-100 rounded transition-opacity pointer-events-none"></div>
                  <div class="absolute -top-5 bg-emerald-600 text-white text-[7px] font-bold px-1 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">↔ Logo: ${window.kartuPesertaConfig.logoSize}px</div>
                  ${logoKiriSrc}
               </div>
            ` : logoKiriSrc}
         </div>
         <div style="width: 70%; text-align: center; line-height: 1.1;">
            <div style="font-size: 8pt; font-weight: bold; letter-spacing: 0.1px; font-family: 'Times New Roman', Times, serif; color: #000; text-transform: uppercase; word-break: break-word;">${window.kartuPesertaConfig.kop1}</div>
            <div style="font-size: 9.5pt; font-weight: bold; font-family: 'Times New Roman', Times, serif; color: #000; text-transform: uppercase; word-break: break-word;">${window.kartuPesertaConfig.kop2}</div>
            <div style="font-size: 11pt; font-weight: bold; color: #065f46; letter-spacing: 0.1px; font-family: 'Times New Roman', Times, serif; text-transform: uppercase; word-break: break-word;">${window.kartuPesertaConfig.kop3}</div>
            <div style="font-size: 5.5pt; font-weight: bold; margin-top: 1px; font-family: Arial, sans-serif; color: #000; line-height: 1.1; word-break: break-word;">${window.kartuPesertaConfig.alamat}</div>
         </div>
         <div style="width: 15%; text-align: right; display: flex; align-items: center; justify-content: center;">
            ${!isPrintMode ? `
               <div class="relative group cursor-col-resize select-none" 
                    title="Seret kiri-kanan untuk mengubah ukuran logo" 
                    onmousedown="initCardElementDrag(event, 'logoSize')" 
                    ontouchstart="initCardElementDrag(event, 'logoSize')"
                    style="display: flex; align-items: center; justify-content: center; position: relative;">
                  <div class="absolute -inset-1 border border-dashed border-emerald-400 opacity-0 group-hover:opacity-100 rounded transition-opacity pointer-events-none"></div>
                  <div class="absolute -top-5 bg-emerald-600 text-white text-[7px] font-bold px-1 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">↔ Logo: ${window.kartuPesertaConfig.logoSize}px</div>
                  ${logoKananSrc}
               </div>
            ` : logoKananSrc}
         </div>
      </div>
      <div style="width: 100%; height: 4px; background-color: #000; margin-bottom: 5px;"></div>
      
      <!-- TITLE -->
      <div style="text-align: center; font-size: 9pt; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px; color: #000; text-transform: uppercase;">${window.kartuPesertaConfig.titleText || 'KARTU PESERTA'}</div>
      
      <!-- CONTENT -->
      <div class="card-content-area" style="display: flex; justify-content: space-between; height: ${contentHeight}px; overflow: hidden; position: relative;">
         <!-- Left Details (60%) -->
         <div style="width: 60%; font-size: 8pt; line-height: 1.35; display: flex; flex-direction: column; justify-content: start; gap: 3px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 8pt; color: #000; table-layout: fixed;">
               <tr>
                  <td style="width: 32%; vertical-align: top; white-space: nowrap; font-weight: bold;">Nama Siswa</td>
                  <td style="width: 5%; vertical-align: top; text-align: center; font-weight: bold;">:</td>
                  <td style="font-weight: 900; vertical-align: top; text-transform: uppercase; font-size: 8pt; word-break: break-word;" title="${st.name}">${st.name}</td>
               </tr>
               <tr>
                  <td style="white-space: nowrap; font-weight: bold; vertical-align: top;">Kelas</td>
                  <td style="text-align: center; font-weight: bold; vertical-align: top;">:</td>
                  <td style="font-weight: 900; vertical-align: top; text-transform: uppercase; word-break: break-word;">${className}</td>
               </tr>
               <tr>
                  <td style="white-space: nowrap; font-weight: bold; vertical-align: top;">User Name</td>
                  <td style="text-align: center; font-weight: bold; vertical-align: top;">:</td>
                  <td style="font-weight: 900; font-family: monospace; font-size: 8.5pt; vertical-align: top; word-break: break-all;">${st.username}</td>
               </tr>
               ${window.kartuPesertaConfig.showPassword !== false ? `
               <tr>
                  <td style="white-space: nowrap; font-weight: bold; vertical-align: top;">Password</td>
                  <td style="text-align: center; font-weight: bold; vertical-align: top;">:</td>
                  <td style="font-weight: 900; font-family: monospace; font-size: 8.5pt; vertical-align: top; word-break: break-all;">${st.password}</td>
               </tr>
               ` : ''}
               <tr>
                  <td style="white-space: nowrap; font-weight: bold; vertical-align: top;">Ruang</td>
                  <td style="text-align: center; font-weight: bold; vertical-align: top;">:</td>
                  <td style="font-weight: 900; vertical-align: top; text-transform: uppercase; word-break: break-word;">${roomName}</td>
               </tr>
            </table>
         </div>
         
         <!-- Right Signature (40%) -->
         <div class="${!isPrintMode ? 'group relative border border-dashed border-transparent hover:border-amber-400 p-0.5 rounded transition-colors' : ''}"
              style="width: 40%; position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; padding-bottom: 0px; padding-left: 15px; box-sizing: border-box; height: 100%; transform: translate(${window.kartuPesertaConfig.signatureGroupOffsetLeft || 0}px, ${window.kartuPesertaConfig.signatureGroupOffsetTop || 0}px);">
            
            ${!isPrintMode ? `
            <div class="absolute inset-x-0 top-0 h-4.5 cursor-move flex items-center justify-center bg-amber-500/10 hover:bg-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity z-30 border-b border-dashed border-amber-300"
                 onmousedown="initCardElementDrag(event, \'sigGroup\')"
                 ontouchstart="initCardElementDrag(event, \'sigGroup\')"
                 title="Seret baris ini untuk menggeser seluruh Kelompok TTD">
               <span style="font-size: 6px; font-weight: bold; color: #b45309; text-transform: uppercase; letter-spacing: 0.3px;">↔ Geser Kelompok TTD ↕</span>
            </div>
            ` : ''}

            <!-- Place & Date -->
            <div style="font-size: 8pt; line-height: 1.1; text-align: left; color: #000; white-space: nowrap;">${window.kartuPesertaConfig.tanggalUjian}</div>
            <div style="font-size: 8pt; font-weight: bold; line-height: 1.1; margin-top: 2px; text-align: left; color: #000; white-space: nowrap;">Kepala Sekolah,</div>
            
            <!-- Overlapping container for TTD, Stamp and Name -->
            <div style="position: relative; width: 100%; height: 70px; margin-top: 2px;">
               <!-- Student Photo (Diambil dari absensi terakhir / profil) -->
               ${window.kartuPesertaConfig.showStudentPhoto ? (
                  !isPrintMode ? `
                  <div class="absolute group/photo cursor-move select-none" 
                       title="Seret untuk memindahkan Foto Siswa" 
                       onmousedown="initCardElementDrag(event, \'studentPhoto\')" 
                       ontouchstart="initCardElementDrag(event, \'studentPhoto\')"
                       style="position: absolute; border: 1.5px dashed #10b981; overflow: visible; z-index: 25; background-color: #fff; box-sizing: border-box; 
                               left: ${window.kartuPesertaConfig.studentPhotoOffsetLeft}px; 
                               top: ${window.kartuPesertaConfig.studentPhotoOffsetTop}px; 
                               width: ${window.kartuPesertaConfig.studentPhotoWidth}px; 
                               height: ${window.kartuPesertaConfig.studentPhotoHeight}px;">
                     <!-- Hover tooltip -->
                     <div class="absolute -top-4.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[6px] font-bold px-1 py-0.2 rounded shadow opacity-0 group-hover/photo:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">↕ Geser Foto</div>
                     
                     <div style="width: 100%; height: 100%; overflow: hidden;">
                        ${studentPhotoHtml}
                     </div>
                     
                     <!-- Mini Corner Resize Handle for Photo Width/Height -->
                     <div class="absolute right-0 bottom-0 w-3 h-3 cursor-se-resize bg-emerald-500 rounded-tl-sm border border-white z-40 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity" 
                          onmousedown="initCardElementDrag(event, \'studentPhotoResize\')" 
                          ontouchstart="initCardElementDrag(event, \'studentPhotoResize\')">
                        <svg class="w-1.5 h-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                           <path stroke-linecap="round" stroke-linejoin="round" d="M19 19H5M19 19V5M19 19L5 5" />
                        </svg>
                     </div>
                  </div>
                  ` : `
                  <div style="position: absolute; border: 1px solid #000; overflow: hidden; z-index: 12; background-color: #fff; box-sizing: border-box; 
                               left: ${window.kartuPesertaConfig.studentPhotoOffsetLeft}px; 
                               top: ${window.kartuPesertaConfig.studentPhotoOffsetTop}px; 
                               width: ${window.kartuPesertaConfig.studentPhotoWidth}px; 
                               height: ${window.kartuPesertaConfig.studentPhotoHeight}px;">
                     ${studentPhotoHtml}
                  </div>
                  `
               ) : ''}

               <!-- Stamp (Stempel) - Shifted left and overlapping everything heavily, placed on top -->
               ${!isPrintMode ? `
               <div class="absolute group/stempel cursor-move select-none" 
                    title="Seret untuk memindahkan Stempel" 
                    onmousedown="initCardElementDrag(event, \'stempel\')" 
                    ontouchstart="initCardElementDrag(event, \'stempel\')"
                    style="position: absolute; left: ${window.kartuPesertaConfig.stempelOffsetLeft}px; top: ${window.kartuPesertaConfig.stempelOffsetTop}px; width: ${window.kartuPesertaConfig.stempelSize}px; height: ${window.kartuPesertaConfig.stempelSize}px; opacity: 0.95; z-index: 20; display: flex; align-items: center; justify-content: center;">
                  <div class="absolute -inset-1 border border-dashed border-emerald-400 opacity-0 group-hover/stempel:opacity-100 rounded-full transition-opacity pointer-events-none"></div>
                  <div class="absolute -top-4.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[6px] font-bold px-1 py-0.2 rounded shadow opacity-0 group-hover/stempel:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">↕ Geser Stempel</div>
                  ${stampSvg}
                  
                  <!-- Mini corner handle for Stamp resizing -->
                  <div class="absolute right-0 bottom-0 w-3 h-3 cursor-se-resize bg-emerald-500 rounded-full border border-white z-40 flex items-center justify-center opacity-0 group-hover/stempel:opacity-100 transition-opacity" 
                       onmousedown="initCardElementDrag(event, \'stempelResize\')" 
                       ontouchstart="initCardElementDrag(event, \'stempelResize\')">
                     <svg class="w-1.5 h-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 19H5M19 19V5M19 19L5 5" />
                     </svg>
                  </div>
               </div>
               ` : `
               <div style="position: absolute; left: ${window.kartuPesertaConfig.stempelOffsetLeft}px; top: ${window.kartuPesertaConfig.stempelOffsetTop}px; width: ${window.kartuPesertaConfig.stempelSize}px; height: ${window.kartuPesertaConfig.stempelSize}px; opacity: 0.9; pointer-events: none; z-index: 20; display: flex; align-items: center; justify-content: center;">
                  ${stampSvg}
               </div>
               `}

               <!-- TTD (Signature) - Positioned centrally, overlapping -->
               ${!isPrintMode ? `
               <div class="absolute group/ttd cursor-move select-none" 
                    title="Seret untuk memindahkan Tanda Tangan" 
                    onmousedown="initCardElementDrag(event, \'ttd\')" 
                    ontouchstart="initCardElementDrag(event, \'ttd\')"
                    style="position: absolute; left: ${window.kartuPesertaConfig.ttdOffsetLeft}px; top: ${window.kartuPesertaConfig.ttdOffsetTop}px; width: ${window.kartuPesertaConfig.ttdSize}px; height: ${Math.round(window.kartuPesertaConfig.ttdSize * 0.5)}px; z-index: 10; display: flex; align-items: center; justify-content: center;">
                  <div class="absolute -inset-1 border border-dashed border-emerald-400 opacity-0 group-hover/ttd:opacity-100 rounded transition-opacity pointer-events-none"></div>
                  <div class="absolute -top-4.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[6px] font-bold px-1 py-0.2 rounded shadow opacity-0 group-hover/ttd:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">↕ Geser TTD</div>
                  ${ttdHtml}
                  
                  <!-- Mini corner handle for TTD resizing -->
                  <div class="absolute right-0 bottom-0 w-3 h-3 cursor-se-resize bg-emerald-500 rounded-full border border-white z-40 flex items-center justify-center opacity-0 group-hover/ttd:opacity-100 transition-opacity" 
                       onmousedown="initCardElementDrag(event, \'ttdResize\')" 
                       ontouchstart="initCardElementDrag(event, \'ttdResize\')">
                     <svg class="w-1.5 h-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 19H5M19 19V5M19 19L5 5" />
                     </svg>
                  </div>
               </div>
               ` : `
               <div style="position: absolute; left: ${window.kartuPesertaConfig.ttdOffsetLeft}px; top: ${window.kartuPesertaConfig.ttdOffsetTop}px; width: ${window.kartuPesertaConfig.ttdSize}px; height: ${Math.round(window.kartuPesertaConfig.ttdSize * 0.5)}px; z-index: 10; display: flex; align-items: center; justify-content: center;">
                  ${ttdHtml}
               </div>
               `}

               <!-- Principal Name - Positioned at the bottom, overlapping signature and stamp, NO underline -->
               <div style="position: absolute; left: 0; bottom: 0px; font-size: 9.5pt; font-weight: bold; white-space: nowrap; z-index: 15; text-align: left; color: #000;">
                  ${window.kartuPesertaConfig.kepalaSekolah}
               </div>
            </div>
         </div>
      </div>
      ${!isPrintMode ? `
      <!-- Dynamic Resize Drag Handles -->
      <!-- Right Edge Resize Handle -->
      <div class="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-emerald-500/30 active:bg-emerald-500/50 z-30 transition-colors" onmousedown="initCardResize(event, 'width')" ontouchstart="initCardResize(event, 'width')"></div>
      <!-- Bottom Edge Resize Handle -->
      <div class="absolute left-0 bottom-0 w-full h-1.5 cursor-row-resize hover:bg-emerald-500/30 active:bg-emerald-500/50 z-30 transition-colors" onmousedown="initCardResize(event, 'height')" ontouchstart="initCardResize(event, 'height')"></div>
      <!-- Both Edge (Bottom-Right) Resize Handle -->
      <div class="absolute right-0 bottom-0 w-4.5 h-4.5 cursor-se-resize flex items-end justify-end p-0.5 z-40 bg-emerald-50 hover:bg-emerald-100 border-l border-t border-emerald-200 rounded-tl-lg" onmousedown="initCardResize(event, 'both')" ontouchstart="initCardResize(event, 'both')">
          <svg class="w-2.5 h-2.5 text-emerald-600 opacity-60 hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 19H5M19 19V5M19 19L5 5" />
          </svg>
      </div>
      ` : ''}
    </div>
    `;
}

function updateKartuConfig(key, val) {
    initKartuPesertaConfigIfNeeded();
    window.kartuPesertaConfig[key] = val;
    
    const viewContainer = document.getElementById('view-container');
    const scrollTop = viewContainer ? viewContainer.scrollTop : 0;
    
    const activeEl = document.activeElement;
    let activeId = null;
    let selectionStart = null;
    let selectionEnd = null;
    
    if (activeEl) {
        activeId = activeEl.id || null;
        if (activeId) {
            try {
                selectionStart = activeEl.selectionStart;
                selectionEnd = activeEl.selectionEnd;
            } catch (e) {}
        }
    }
    
    renderAssessmentModule(viewContainer, 'kartu_peserta');
    
    if (viewContainer) {
        viewContainer.scrollTop = scrollTop;
    }
    
    if (activeId) {
        const restoredEl = document.getElementById(activeId);
        if (restoredEl) {
            restoredEl.focus();
            if (selectionStart !== null && selectionEnd !== null) {
                try {
                    restoredEl.setSelectionRange(selectionStart, selectionEnd);
                } catch (e) {}
            }
        }
    }
}

window.initCardResize = function(e, direction) {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    initKartuPesertaConfigIfNeeded();
    const startWidth = window.kartuPesertaConfig.cardWidth || 380;
    const startHeight = window.kartuPesertaConfig.cardHeight || 260;
    
    // Create an overlay so dragging over iframe or other components stays responsive
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '99999';
    overlay.style.cursor = direction === 'width' ? 'col-resize' : (direction === 'height' ? 'row-resize' : 'se-resize');
    document.body.appendChild(overlay);
    
    function onMove(moveEvent) {
        // Prevent default touch scroll when dragging
        if (moveEvent.cancelable) {
            moveEvent.preventDefault();
        }
        const currentX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0] ? moveEvent.touches[0].clientX : 0);
        const currentY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0] ? moveEvent.touches[0].clientY : 0);
        
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        
        if (direction === 'width' || direction === 'both') {
            const newWidth = Math.max(280, Math.min(600, startWidth + deltaX));
            window.kartuPesertaConfig.cardWidth = newWidth;
        }
        if (direction === 'height' || direction === 'both') {
            const newHeight = Math.max(180, Math.min(450, startHeight + deltaY));
            window.kartuPesertaConfig.cardHeight = newHeight;
        }
        
        // Instant visual feedback for ALL preview cards
        const cards = document.querySelectorAll('.preview-card-item');
        cards.forEach(card => {
            if (window.kartuPesertaConfig.cardWidth) {
                card.style.width = window.kartuPesertaConfig.cardWidth + 'px';
            }
            if (window.kartuPesertaConfig.cardHeight) {
                card.style.height = window.kartuPesertaConfig.cardHeight + 'px';
                const contentArea = card.querySelector('.card-content-area');
                if (contentArea) {
                    contentArea.style.height = (window.kartuPesertaConfig.cardHeight - 100) + 'px';
                }
            }
        });
        
        // Dynamically update the display texts in settings panel if currently open
        const widthDisplay = document.getElementById('cfg-cardWidth-val');
        if (widthDisplay) widthDisplay.innerText = (window.kartuPesertaConfig.cardWidth || 380) + 'px';
        const heightDisplay = document.getElementById('cfg-cardHeight-val');
        if (heightDisplay) heightDisplay.innerText = (window.kartuPesertaConfig.cardHeight || 260) + 'px';
        
        const widthSlider = document.getElementById('cfg-cardWidth');
        if (widthSlider) widthSlider.value = window.kartuPesertaConfig.cardWidth || 380;
        const heightSlider = document.getElementById('cfg-cardHeight');
        if (heightSlider) heightSlider.value = window.kartuPesertaConfig.cardHeight || 260;
    }
    
    function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        updateKartuConfig('cardWidth', window.kartuPesertaConfig.cardWidth || 380);
    }
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
};

window.initCardElementDrag = function(e, type) {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const startY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    initKartuPesertaConfigIfNeeded();
    
    // Store original values
    const startStempelLeft = window.kartuPesertaConfig.stempelOffsetLeft || 0;
    const startStempelTop = window.kartuPesertaConfig.stempelOffsetTop || 0;
    const startStempelSize = window.kartuPesertaConfig.stempelSize || 85;
    
    const startTtdLeft = window.kartuPesertaConfig.ttdOffsetLeft || 0;
    const startTtdTop = window.kartuPesertaConfig.ttdOffsetTop || 0;
    const startTtdSize = window.kartuPesertaConfig.ttdSize || 75;
    
    const startPhotoLeft = window.kartuPesertaConfig.studentPhotoOffsetLeft || 0;
    const startPhotoTop = window.kartuPesertaConfig.studentPhotoOffsetTop || 0;
    const startPhotoWidth = window.kartuPesertaConfig.studentPhotoWidth || 50;
    const startPhotoHeight = window.kartuPesertaConfig.studentPhotoHeight || 65;
    
    const startSigGroupLeft = window.kartuPesertaConfig.signatureGroupOffsetLeft || 0;
    const startSigGroupTop = window.kartuPesertaConfig.signatureGroupOffsetTop || 0;
    
    const startLogoSize = window.kartuPesertaConfig.logoSize || 44;
    
    // Create drag overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '99999';
    overlay.style.cursor = type.includes('Resize') || type === 'logoSize' ? 'se-resize' : 'move';
    document.body.appendChild(overlay);
    
    function onMove(moveEvent) {
        if (moveEvent.cancelable) {
            moveEvent.preventDefault();
        }
        const currentX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0] ? moveEvent.touches[0].clientX : 0);
        const currentY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0] ? moveEvent.touches[0].clientY : 0);
        
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        
        if (type === 'stempel') {
            window.kartuPesertaConfig.stempelOffsetLeft = Math.max(-150, Math.min(150, startStempelLeft + deltaX));
            window.kartuPesertaConfig.stempelOffsetTop = Math.max(-150, Math.min(150, startStempelTop + deltaY));
        } else if (type === 'stempelResize') {
            window.kartuPesertaConfig.stempelSize = Math.max(40, Math.min(160, startStempelSize + deltaX));
        } else if (type === 'ttd') {
            window.kartuPesertaConfig.ttdOffsetLeft = Math.max(-150, Math.min(150, startTtdLeft + deltaX));
            window.kartuPesertaConfig.ttdOffsetTop = Math.max(-150, Math.min(150, startTtdTop + deltaY));
        } else if (type === 'ttdResize') {
            window.kartuPesertaConfig.ttdSize = Math.max(30, Math.min(150, startTtdSize + deltaX));
        } else if (type === 'studentPhoto') {
            window.kartuPesertaConfig.studentPhotoOffsetLeft = Math.max(-250, Math.min(150, startPhotoLeft + deltaX));
            window.kartuPesertaConfig.studentPhotoOffsetTop = Math.max(-150, Math.min(150, startPhotoTop + deltaY));
        } else if (type === 'studentPhotoResize') {
            window.kartuPesertaConfig.studentPhotoWidth = Math.max(20, Math.min(150, startPhotoWidth + deltaX));
            window.kartuPesertaConfig.studentPhotoHeight = Math.max(30, Math.min(180, startPhotoHeight + deltaY));
        } else if (type === 'sigGroup') {
            window.kartuPesertaConfig.signatureGroupOffsetLeft = Math.max(-100, Math.min(100, startSigGroupLeft + deltaX));
            window.kartuPesertaConfig.signatureGroupOffsetTop = Math.max(-100, Math.min(100, startSigGroupTop + deltaY));
        } else if (type === 'logoSize') {
            window.kartuPesertaConfig.logoSize = Math.max(25, Math.min(100, startLogoSize + deltaX));
        }
        
        // Instant visual feedback for ALL preview cards!
        const cards = document.querySelectorAll('.preview-card-item');
        cards.forEach(card => {
            if (type === 'stempel' || type === 'stempelResize') {
                const stempelEl = card.querySelector('[title="Seret untuk memindahkan Stempel"]');
                if (stempelEl) {
                    stempelEl.style.left = window.kartuPesertaConfig.stempelOffsetLeft + 'px';
                    stempelEl.style.top = window.kartuPesertaConfig.stempelOffsetTop + 'px';
                    stempelEl.style.width = window.kartuPesertaConfig.stempelSize + 'px';
                    stempelEl.style.height = window.kartuPesertaConfig.stempelSize + 'px';
                    const img = stempelEl.querySelector('img, svg');
                    if (img) {
                        img.style.maxHeight = window.kartuPesertaConfig.stempelSize + 'px';
                        img.style.width = window.kartuPesertaConfig.stempelSize + 'px';
                        img.style.height = window.kartuPesertaConfig.stempelSize + 'px';
                    }
                }
            }
            if (type === 'ttd' || type === 'ttdResize') {
                const ttdEl = card.querySelector('[title="Seret untuk memindahkan Tanda Tangan"]');
                if (ttdEl) {
                    ttdEl.style.left = window.kartuPesertaConfig.ttdOffsetLeft + 'px';
                    ttdEl.style.top = window.kartuPesertaConfig.ttdOffsetTop + 'px';
                    ttdEl.style.width = window.kartuPesertaConfig.ttdSize + 'px';
                    ttdEl.style.height = Math.round(window.kartuPesertaConfig.ttdSize * 0.5) + 'px';
                    const img = ttdEl.querySelector('img, svg');
                    if (img) {
                        img.style.maxHeight = Math.round(window.kartuPesertaConfig.ttdSize * 0.53) + 'px';
                        img.style.width = window.kartuPesertaConfig.ttdSize + 'px';
                        img.style.height = Math.round(window.kartuPesertaConfig.ttdSize * 0.5) + 'px';
                    }
                }
            }
            if (type === 'studentPhoto' || type === 'studentPhotoResize') {
                const photoEl = card.querySelector('[title="Seret untuk memindahkan Foto Siswa"]');
                if (photoEl) {
                    photoEl.style.left = window.kartuPesertaConfig.studentPhotoOffsetLeft + 'px';
                    photoEl.style.top = window.kartuPesertaConfig.studentPhotoOffsetTop + 'px';
                    photoEl.style.width = window.kartuPesertaConfig.studentPhotoWidth + 'px';
                    photoEl.style.height = window.kartuPesertaConfig.studentPhotoHeight + 'px';
                }
            }
            if (type === 'sigGroup') {
                const sigGroupEl = card.querySelector('[title="Seret baris ini untuk menggeser seluruh Kelompok TTD"]');
                if (sigGroupEl && sigGroupEl.parentNode) {
                    sigGroupEl.parentNode.style.transform = `translate(${window.kartuPesertaConfig.signatureGroupOffsetLeft}px, ${window.kartuPesertaConfig.signatureGroupOffsetTop}px)`;
                }
            }
            if (type === 'logoSize') {
                const logos = card.querySelectorAll('[title="Seret kiri-kanan untuk mengubah ukuran logo"]');
                logos.forEach(logo => {
                    const img = logo.querySelector('img, svg');
                    if (img) {
                        img.style.maxHeight = window.kartuPesertaConfig.logoSize + 'px';
                        img.style.width = window.kartuPesertaConfig.logoSize + 'px';
                        img.style.height = window.kartuPesertaConfig.logoSize + 'px';
                    }
                    const textBadge = logo.querySelector('.absolute.-top-5');
                    if (textBadge) {
                        textBadge.innerText = `↔ Logo: ${window.kartuPesertaConfig.logoSize}px`;
                    }
                });
            }
        });
        
        // Dynamically update corresponding slider and text inside sidebar settings panel if open
        if (type === 'stempel' || type === 'stempelResize') {
            updateSliderDisplay('cfg-stempelOffsetLeft', window.kartuPesertaConfig.stempelOffsetLeft);
            updateSliderDisplay('cfg-stempelOffsetTop', window.kartuPesertaConfig.stempelOffsetTop);
            updateSliderDisplay('cfg-stempelSize', window.kartuPesertaConfig.stempelSize);
        } else if (type === 'ttd' || type === 'ttdResize') {
            updateSliderDisplay('cfg-ttdOffsetLeft', window.kartuPesertaConfig.ttdOffsetLeft);
            updateSliderDisplay('cfg-ttdOffsetTop', window.kartuPesertaConfig.ttdOffsetTop);
            updateSliderDisplay('cfg-ttdSize', window.kartuPesertaConfig.ttdSize);
        } else if (type === 'studentPhoto' || type === 'studentPhotoResize') {
            updateSliderDisplay('cfg-studentPhotoOffsetLeft', window.kartuPesertaConfig.studentPhotoOffsetLeft);
            updateSliderDisplay('cfg-studentPhotoOffsetTop', window.kartuPesertaConfig.studentPhotoOffsetTop);
            updateSliderDisplay('cfg-studentPhotoWidth', window.kartuPesertaConfig.studentPhotoWidth);
            updateSliderDisplay('cfg-studentPhotoHeight', window.kartuPesertaConfig.studentPhotoHeight);
        } else if (type === 'sigGroup') {
            updateSliderDisplay('cfg-signatureGroupOffsetLeft', window.kartuPesertaConfig.signatureGroupOffsetLeft);
            updateSliderDisplay('cfg-signatureGroupOffsetTop', window.kartuPesertaConfig.signatureGroupOffsetTop);
        } else if (type === 'logoSize') {
            updateSliderDisplay('cfg-logoSize', window.kartuPesertaConfig.logoSize);
        }
    }
    
    function updateSliderDisplay(id, value) {
        const slider = document.getElementById(id);
        if (slider) {
            slider.value = value;
            const container = slider.parentNode;
            if (container) {
                const labelSpan = container.querySelector('.text-emerald-600');
                if (labelSpan) {
                    labelSpan.innerText = value + 'px';
                }
            }
        }
    }
    
    function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        
        // Persist all updated values to storage/db
        if (type === 'stempel') {
            updateKartuConfig('stempelOffsetLeft', window.kartuPesertaConfig.stempelOffsetLeft);
            updateKartuConfig('stempelOffsetTop', window.kartuPesertaConfig.stempelOffsetTop);
        } else if (type === 'stempelResize') {
            updateKartuConfig('stempelSize', window.kartuPesertaConfig.stempelSize);
        } else if (type === 'ttd') {
            updateKartuConfig('ttdOffsetLeft', window.kartuPesertaConfig.ttdOffsetLeft);
            updateKartuConfig('ttdOffsetTop', window.kartuPesertaConfig.ttdOffsetTop);
        } else if (type === 'ttdResize') {
            updateKartuConfig('ttdSize', window.kartuPesertaConfig.ttdSize);
        } else if (type === 'studentPhoto') {
            updateKartuConfig('studentPhotoOffsetLeft', window.kartuPesertaConfig.studentPhotoOffsetLeft);
            updateKartuConfig('studentPhotoOffsetTop', window.kartuPesertaConfig.studentPhotoOffsetTop);
        } else if (type === 'studentPhotoResize') {
            updateKartuConfig('studentPhotoWidth', window.kartuPesertaConfig.studentPhotoWidth);
            updateKartuConfig('studentPhotoHeight', window.kartuPesertaConfig.studentPhotoHeight);
        } else if (type === 'sigGroup') {
            updateKartuConfig('signatureGroupOffsetLeft', window.kartuPesertaConfig.signatureGroupOffsetLeft);
            updateKartuConfig('signatureGroupOffsetTop', window.kartuPesertaConfig.signatureGroupOffsetTop);
        } else if (type === 'logoSize') {
            updateKartuConfig('logoSize', window.kartuPesertaConfig.logoSize);
        }
    }
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
};

function addClassToPrint(classId) {
    if (!classId) return;
    initKartuPesertaConfigIfNeeded();
    if (!window.kartuPesertaConfig.selectedClassIds) {
        window.kartuPesertaConfig.selectedClassIds = [];
    }
    if (!window.kartuPesertaConfig.selectedClassIds.includes(String(classId))) {
        window.kartuPesertaConfig.selectedClassIds.push(String(classId));
    }
    renderAssessmentModule(document.getElementById('view-container'), 'kartu_peserta');
}

function removeClassFromPrint(classId) {
    initKartuPesertaConfigIfNeeded();
    if (window.kartuPesertaConfig.selectedClassIds) {
        window.kartuPesertaConfig.selectedClassIds = window.kartuPesertaConfig.selectedClassIds.filter(id => id !== String(classId));
    }
    renderAssessmentModule(document.getElementById('view-container'), 'kartu_peserta');
}

function handleKartuImageUpload(event, key) {
    initKartuPesertaConfigIfNeeded();
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            window.kartuPesertaConfig[key] = e.target.result;
            renderAssessmentModule(document.getElementById('view-container'), 'kartu_peserta');
        };
        reader.readAsDataURL(file);
    }
}

function cetakKartuUjian() {
    initKartuPesertaConfigIfNeeded();
    
    const students = appState.students || [];
    const rooms = appState.rooms || [];
    const classes = appState.classes || [];
    
    let filtered = [...students];
    if (window.kartuPesertaConfig.selectedClassIds && window.kartuPesertaConfig.selectedClassIds.length > 0) {
        filtered = filtered.filter(s => window.kartuPesertaConfig.selectedClassIds.includes(String(s.classId || s.class_id)));
    } else if (window.kartuPesertaConfig.filterClassId) {
        filtered = filtered.filter(s => String(s.classId || s.class_id) === String(window.kartuPesertaConfig.filterClassId));
    }
    if (window.kartuPesertaConfig.filterRoomId) {
        const selectedRoom = rooms.find(r => String(r.id) === String(window.kartuPesertaConfig.filterRoomId));
        if (selectedRoom) {
            filtered = filtered.filter(s => (selectedRoom.members || []).some(mId => String(mId) === String(s.id)));
        }
    }
    
    if (filtered.length === 0) {
        alert('Tidak ada siswa yang terpilih untuk dicetak.');
        return;
    }
    
    const printWin = window.open('', '_blank');
    if (!printWin) {
        alert('Gagal membuka jendela cetak. Pastikan pop-up diblokir dinonaktifkan.');
        return;
    }
    
    const logoKiriSrc = getLogoKiri();
    const logoKananSrc = getLogoKanan();
    const stampSvg = getStempelSvg(window.kartuPesertaConfig.kop3);
    const ttdHtml = getTtdHtml();
    let cardsHtml = '';
    filtered.forEach((st, idx) => {
        const cls = classes.find(c => String(c.id) === String(st.classId || st.class_id));
        const className = cls ? cls.name : '-';
        
        const room = (rooms || []).find(r => (r.members || []).some(mId => String(mId) === String(st.id)));
        const roomName = room ? room.name : '-';
        
        cardsHtml += getKartuPesertaHtml(st, className, roomName, true);
        
        // Add clearing div every 2 cards
        if ((idx + 1) % 2 === 0) {
            cardsHtml += '<div style="clear: both;"></div>';
        }
        
        // Page break every 10 cards
        if ((idx + 1) % 10 === 0 && idx < filtered.length - 1) {
            cardsHtml += '<div style="page-break-after: always; clear: both; height: 1px;"></div>';
        }
    });
    
    // Add missing clear float if final index is odd
    if (filtered.length % 2 !== 0) {
        cardsHtml += '<div style="clear: both;"></div>';
    }
    
    printWin.document.write(`
    <html>
    <head>
        <title>Cetak Kartu Ujian</title>
        <style>
            @page {
                size: A4;
                margin: 15mm 10mm 15mm 10mm;
            }
            body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                background-color: #fff;
            }
            .print-container {
                width: 100%;
                max-width: 210mm;
                margin: 0 auto;
                box-sizing: border-box;
            }
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                }
                .card {
                    border: 1.5px solid #000 !important;
                }
            }
        </style>
    </head>
    <body>
        <div class="print-container">
            ${cardsHtml}
        </div>
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                }, 500);
            };
        </script>
    </body>
    </html>
    `);
    
    printWin.document.close();
}

// ==========================================
// EVALUASI & GRADING MODULE HELPERS
// ==========================================

function toggleEvaluasiSelectForm() {
    const panel = document.getElementById('evaluasi-filter-panel');
    const chevron = document.getElementById('evaluasi-chevron');
    if (panel) {
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            if (chevron) chevron.classList.add('rotate-180');
            appState.evaluasiPanelOpen = true;
        } else {
            panel.classList.add('hidden');
            if (chevron) chevron.classList.remove('rotate-180');
            appState.evaluasiPanelOpen = false;
        }
    }
}

function onEvaluasiFilterChange() {
    const classId = document.getElementById('eval-class-select').value;
    const examId = document.getElementById('eval-exam-select').value;
    appState.evaluasiSelectedClassId = classId;
    appState.evaluasiSelectedExamId = examId;
    
    // Refresh evaluation view
    renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', null);
}

function filterEvaluasiStudentTable() {
    const input = document.getElementById('eval-search-student-input');
    if (!input) return;
    const filter = input.value.toLowerCase().trim();
    const table = document.getElementById('evaluasi-student-table');
    if (!table) return;
    const rows = table.getElementsByTagName('tr');

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const text = row.textContent || row.innerText;
        if (text.toLowerCase().indexOf(filter) > -1) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
}

function ensureEvaluasiDataPopulated(classId, examId) {
    if (!appState.completedExams) {
        appState.completedExams = JSON.parse(localStorage.getItem('madrasah_completed_exams')) || {};
    }
    if (!appState.studentExamAnswers) {
        appState.studentExamAnswers = JSON.parse(localStorage.getItem('madrasah_student_exam_answers')) || {};
    }
    if (!appState.studentExamGrades) {
        appState.studentExamGrades = JSON.parse(localStorage.getItem('madrasah_student_exam_grades')) || {};
    }
}

function resetStudentExam(studentId) {
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const st = appState.students.find(s => String(s.id) === String(studentId));
    if (!st) return;

    showConfirmModal(`Apakah Anda yakin ingin menyetel ulang (reset) ujian untuk <b>${st.name}</b>? Semua jawaban, rekaman kecurangan, dan nilai saat ini akan dihapus permanen, dan siswa dapat mengikuti ujian ini kembali dari awal.`, () => {
        const keysToDelete = [
            studentId + '_' + examId,
            st.id + '_' + examId,
            String(studentId) + '_' + String(examId),
            String(st.id) + '_' + String(examId)
        ];

        keysToDelete.forEach(key => {
            if (appState.completedExams) delete appState.completedExams[key];
            if (appState.studentExamAnswers) delete appState.studentExamAnswers[key];
            if (appState.studentExamQuestions) delete appState.studentExamQuestions[key];
            if (appState.studentExamGrades) delete appState.studentExamGrades[key];
            if (appState.activeExamSessions) delete appState.activeExamSessions[key];
            if (appState.studentTabSwitches) delete appState.studentTabSwitches[key];
            if (appState.studentOutOfTab) delete appState.studentOutOfTab[key];
            if (appState.blockedStudents) delete appState.blockedStudents[key];
            if (appState.studentLivecamFrames) delete appState.studentLivecamFrames[key];
        });

        safeSetStorage('madrasah_completed_exams', appState.completedExams || {});
        safeSetStorage('madrasah_student_exam_answers', appState.studentExamAnswers || {});
        safeSetStorage('madrasah_student_exam_questions', appState.studentExamQuestions || {});
        safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades || {});
        safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions || {});

        fetch('/api/reset-student-exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: st.id, examId })
        })
        .then(res => res.json())
        .then(data => {
            showToast(`Sesi ujian ${st.name} berhasil disetel ulang!`, 'success');
            renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', null);
        })
        .catch(err => {
            console.error(err);
            showToast(`Sesi ujian ${st.name} berhasil disetel ulang!`, 'success');
            renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', null);
        });
    });
}

async function adminForceSubmitExam(studentId, explicitExamId = null) {
    const examId = explicitExamId || appState.evaluasiSelectedExamId || appState.activeMonitoringExamId;
    if (!examId) {
        showToast('Ujian tidak ditemukan!', 'error');
        return;
    }

    const ex = (appState.exams || []).find(e => String(e.id) === String(examId));
    if (!ex) {
        showToast('Ujian tidak ditemukan!', 'error');
        return;
    }

    const st = (appState.students || []).find(s => String(s.id) === String(studentId));
    if (!st) {
        showToast('Siswa tidak ditemukan!', 'error');
        return;
    }

    const key1 = studentId + '_' + examId;
    const key2 = String(studentId) + '_' + String(examId);

    // Fetch the absolute latest student answer status from the server first before forcing finish!
    try {
        const monRes = await fetch('/api/exam-monitoring-state');
        const monData = await monRes.json();
        if (monData && monData.success) {
            if (monData.studentExamAnswers) {
                appState.studentExamAnswers = { ...(appState.studentExamAnswers || {}), ...monData.studentExamAnswers };
                safeSetStorage('madrasah_student_exam_answers', appState.studentExamAnswers);
            }
            if (monData.activeExamSessions) {
                appState.activeExamSessions = { ...(appState.activeExamSessions || {}), ...monData.activeExamSessions };
                safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);
            }
            if (monData.studentExamGrades) {
                appState.studentExamGrades = { ...(appState.studentExamGrades || {}), ...monData.studentExamGrades };
                safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);
            }
        }
    } catch (e) {
        console.warn("Could not fetch latest exam state before force submit (network/offline):", e.message || e);
    }

    if (!appState.studentExamAnswers) appState.studentExamAnswers = JSON.parse(localStorage.getItem('madrasah_student_exam_answers')) || {};
    let answers = appState.studentExamAnswers[key1] || appState.studentExamAnswers[key2] || {};

    if (!appState.activeExamSessions) appState.activeExamSessions = JSON.parse(localStorage.getItem('madrasah_active_exam_sessions')) || {};

    if (Object.keys(answers).length === 0) {
        if (appState.activeExamSessions[key1]?.answers) {
            answers = appState.activeExamSessions[key1].answers;
        } else if (appState.activeExamSessions[key2]?.answers) {
            answers = appState.activeExamSessions[key2].answers;
        }
    }

    appState.studentExamAnswers[key1] = answers;
    appState.studentExamAnswers[key2] = answers;
    safeSetStorage('madrasah_student_exam_answers', appState.studentExamAnswers);

    if (!appState.completedExams) appState.completedExams = JSON.parse(localStorage.getItem('madrasah_completed_exams')) || {};
    appState.completedExams[key1] = 'force_finish';
    appState.completedExams[key2] = 'force_finish';
    safeSetStorage('madrasah_completed_exams', appState.completedExams);

    if (!appState.forceFinishedExams) appState.forceFinishedExams = JSON.parse(localStorage.getItem('madrasah_force_finished_exams')) || {};
    appState.forceFinishedExams[key1] = true;
    appState.forceFinishedExams[key2] = true;
    safeSetStorage('madrasah_force_finished_exams', appState.forceFinishedExams);

    const questions = getExamQuestions(ex, studentId);
    if (!appState.studentExamQuestions) appState.studentExamQuestions = JSON.parse(localStorage.getItem('madrasah_student_exam_questions')) || {};
    appState.studentExamQuestions[key1] = questions;
    appState.studentExamQuestions[key2] = questions;
    safeSetStorage('madrasah_student_exam_questions', appState.studentExamQuestions);

    const pgQuestions = questions.filter(q => q.type !== 'esay' && q.type !== 'essay');
    const essayQuestions = questions.filter(q => q.type === 'esay' || q.type === 'essay');

    let correctPGCount = 0;
    pgQuestions.forEach(q => {
        const userAns = answers[q.id] !== undefined ? answers[q.id] : answers[String(q.id)];
        if (isCorrectAnswer(q, userAns)) correctPGCount++;
    });

    const pgScore = pgQuestions.length > 0 ? (correctPGCount / pgQuestions.length) * 100 : 100;

    if (!appState.studentExamGrades) appState.studentExamGrades = JSON.parse(localStorage.getItem('madrasah_student_exam_grades')) || {};
    
    let existingGrade = appState.studentExamGrades[key1] || appState.studentExamGrades[key2] || {};
    
    const gradeObj = {
        pgScore: Math.round(pgScore),
        essayScore: existingGrade.essayScore || 0,
        finalScore: essayQuestions.length === 0 ? Math.round(pgScore) : (existingGrade.finalScore || null),
        isGraded: essayQuestions.length === 0 ? true : (existingGrade.isGraded || false),
        correctPGCount,
        totalPGCount: pgQuestions.length,
        essayGrades: existingGrade.essayGrades || {},
        submissionType: 'force_finish'
    };

    appState.studentExamGrades[key1] = gradeObj;
    appState.studentExamGrades[key2] = gradeObj;
    safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);

    if (!appState.activeExamSessions) appState.activeExamSessions = JSON.parse(localStorage.getItem('madrasah_active_exam_sessions')) || {};
    delete appState.activeExamSessions[key1];
    delete appState.activeExamSessions[key2];
    safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions);

    syncExamStateToServer({
        completed: { [key1]: 'force_finish', [key2]: 'force_finish' },
        forceFinished: { [key1]: true, [key2]: true },
        answers: { [key1]: answers, [key2]: answers },
        sessionKey: key1,
        sessionData: null,
        gradesObj: { [key1]: gradeObj, [key2]: gradeObj }
    });

    showToast(`Ujian untuk siswa ${st.name} berhasil diselesaikan secara paksa oleh Admin!`, 'success');

    const containerEl = document.getElementById('view-container');
    if (containerEl) {
        if (appState.lastAssessmentSubTab === 'monitoring' && appState.activeMonitoringExamId) {
            renderAssessmentModule(containerEl, 'monitoring', appState.activeMonitoringExamId);
        } else {
            renderAssessmentModule(containerEl, 'evaluasi', examId);
        }
    }
}

function confirmAdminForceSubmitExam(studentId, explicitExamId = null) {
    const examId = explicitExamId || appState.evaluasiSelectedExamId || appState.activeMonitoringExamId;
    const st = (appState.students || []).find(s => String(s.id) === String(studentId));
    const stName = st ? st.name : 'siswa ini';

    if (typeof showConfirmModal === 'function') {
        showConfirmModal(`Apakah Anda yakin ingin menyelesaikan ujian secara paksa (<b>Force Finish</b>) untuk <b>${stName}</b>? Ujian akan langsung ditutup dan jawaban yang telah tersimpan saat ini akan dinilai.`, async () => {
            await adminForceSubmitExam(studentId, examId);
        });
    } else {
        if (confirm(`Apakah Anda yakin ingin menyelesaikan ujian secara paksa (Force Finish) untuk ${stName}?`)) {
            adminForceSubmitExam(studentId, examId);
        }
    }
}

function confirmStudentExamSubmit() {
    const modal = document.getElementById('modal-container');
    if (!modal) {
        submitExamFinal();
        return;
    }
    
    modal.innerHTML = `
        <div class="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center space-y-4 border border-slate-100">
                <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                    <i class="fa-solid fa-circle-check"></i>
                </div>
                <h3 class="font-extrabold text-slate-800 text-base">Konfirmasi Selesai Ujian</h3>
                <p class="text-xs text-slate-500 leading-relaxed">
                    Apakah Anda yakin sudah menyelesaikan seluruh soal dengan benar dan jujur serta ingin mengakhiri ujian sekarang?
                </p>
                <div class="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start space-x-3 text-left">
                    <input type="checkbox" id="chk-confirm-selesai" class="mt-0.5 h-4 w-4 text-emerald-600 border-slate-300 rounded cursor-pointer" onchange="toggleConfirmSelesaiBtn(this.checked)">
                    <label for="chk-confirm-selesai" class="text-xs font-bold text-slate-600 cursor-pointer select-none">
                        Saya menyatakan telah selesai mengerjakan dan siap mengumpulkan ujian ini.
                    </label>
                </div>
                <div class="flex space-x-3 pt-2">
                    <button type="button" onclick="closeModal()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs transition cursor-pointer">
                        Kembali
                    </button>
                    <button type="button" id="btn-submit-cbt-final" disabled class="flex-1 py-2.5 bg-slate-300 text-slate-500 font-semibold rounded-2xl text-xs transition cursor-not-allowed opacity-50">
                        Oke, Selesai
                    </button>
                </div>
            </div>
        </div>
    `;

    window.toggleConfirmSelesaiBtn = function(checked) {
        const btn = document.getElementById('btn-submit-cbt-final');
        if (btn) {
            if (checked) {
                btn.removeAttribute('disabled');
                btn.className = "flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-xs shadow transition cursor-pointer";
            } else {
                btn.setAttribute('disabled', 'true');
                btn.className = "flex-1 py-2.5 bg-slate-300 text-slate-500 font-semibold rounded-2xl text-xs transition cursor-not-allowed opacity-50";
            }
        }
    };

    const btn = document.getElementById('btn-submit-cbt-final');
    if (btn) {
        btn.onclick = () => {
            closeModal();
            submitExamFinal();
        };
    }
}

function openKoreksiModal(studentId) {
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const st = appState.students.find(s => String(s.id) === String(studentId));
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!st || !ex) return;

    const key1 = studentId + '_' + examId;
    const key2 = String(studentId) + '_' + String(examId);

    const questions = getExamQuestions(ex, studentId);

    const allAnswers = appState.studentExamAnswers || JSON.parse(localStorage.getItem('madrasah_student_exam_answers') || '{}') || {};
    const activeSess = (appState.activeExamSessions && (appState.activeExamSessions[key1] || appState.activeExamSessions[key2])) || {};

    const studentAnswers = allAnswers[key1] || allAnswers[key2] || activeSess.answers || {};

    const grades = appState.studentExamGrades || JSON.parse(localStorage.getItem('madrasah_student_exam_grades') || '{}') || {};
    const gradeObj = grades[key1] || grades[key2] || { essayGrades: {} };
    const currentEssayGrades = gradeObj.essayGrades || {};
    const currentEssayExplanations = gradeObj.essayExplanations || {};

    let modalHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                        <h3 class="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Koreksi Jawaban: ${st.name}</h3>
                        <p class="text-[10px] text-slate-400 font-medium">Ujian: ${ex.title}</p>
                    </div>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-slate-400 hover:text-slate-600"></i></button>
                </div>

                <form onsubmit="saveKoreksi(event, '${st.id}')" class="space-y-4 text-xs sm:text-sm">
                    <div class="space-y-4">
                        ${questions.map((q, idx) => {
                            const ansVal = studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : (studentAnswers[String(q.id)] !== undefined ? studentAnswers[String(q.id)] : '');
                            const isCorrect = isCorrectAnswer(q, ansVal);

                            let qBody = '';
                            if (q.type !== 'esay' && q.type !== 'essay') {
                                qBody = `
                                    <div class="mt-2 space-y-1.5 pl-4 border-l-2 border-slate-200">
                                        ${(q.options || []).map(opt => {
                                            const isStudentAns = String(ansVal).trim() === String(opt).trim();
                                            const isKey = isOptionAnswerKey(q, opt);
                                            let bgClass = 'bg-slate-50 border-slate-100';
                                            if (isStudentAns) {
                                                bgClass = isCorrect ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900' : 'bg-rose-50 border-rose-300 font-bold text-rose-900';
                                            } else if (isKey) {
                                                bgClass = 'bg-emerald-50/55 border-emerald-100/50 text-emerald-800 font-semibold';
                                            }
                                            return `
                                                <div class="p-2.5 rounded-xl border flex justify-between items-center text-xs ${bgClass}">
                                                    <span>${opt}</span>
                                                    ${isStudentAns ? `<span class="text-[9px] font-bold uppercase ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}">${isCorrect ? 'Benar (✓)' : 'Salah (✗)'}</span>` : ''}
                                                    ${!isStudentAns && isKey ? '<span class="text-[9px] text-emerald-600 font-bold uppercase">Kunci Jawab</span>' : ''}
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                `;
                            } else {
                                const expText = currentEssayExplanations[q.id] || currentEssayExplanations[String(q.id)];
                                qBody = `
                                    <div class="mt-2 space-y-3 pl-4 border-l-2 border-slate-200">
                                        <div class="p-3 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs">
                                            <p class="font-bold text-amber-800 uppercase tracking-wider text-[9px] mb-1">Jawaban Siswa (Esay):</p>
                                            <p class="leading-relaxed whitespace-pre-wrap">${ansVal ? ansVal : '<span class="italic text-slate-400">Tidak menjawab</span>'}</p>
                                        </div>
                                        <div class="p-3 bg-emerald-50/40 border border-emerald-100 rounded-2xl text-xs">
                                            <p class="font-bold text-emerald-800 uppercase tracking-wider text-[9px] mb-1">Kunci Jawaban Guru / Bahan Rujukan:</p>
                                            <p class="leading-relaxed whitespace-pre-wrap">${q.answer || '-'}</p>
                                        </div>
                                        ${expText ? `
                                        <div class="p-3 bg-purple-50 border border-purple-100 rounded-2xl text-xs space-y-1">
                                            <p class="font-bold text-purple-800 uppercase tracking-wider text-[9px] flex items-center gap-1"><i class="fa-solid fa-wand-magic-sparkles text-purple-600"></i> Penjelasan AI Auto-Koreksi:</p>
                                            <p class="leading-relaxed italic text-slate-700">${expText}</p>
                                        </div>
                                        ` : ''}
                                        <div class="flex items-center space-x-3 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                                            <label class="text-[10px] font-bold text-slate-600 uppercase">Beri Nilai Esay (0-100):</label>
                                            <div class="relative w-24">
                                                <input type="number" min="0" max="100" name="essay-grade-${q.id}" required value="${(currentEssayGrades[q.id] !== undefined ? currentEssayGrades[q.id] : (currentEssayGrades[String(q.id)] !== undefined ? currentEssayGrades[String(q.id)] : ''))}" class="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs text-center" placeholder="0 - 100">
                                                <span class="absolute right-3 top-2 text-[10px] font-bold text-slate-400">%</span>
                                            </div>
                                            <span class="text-[10px] text-slate-400">Persentase kontribusi</span>
                                        </div>
                                    </div>
                                `;
                            }

                            return `
                                <div class="bg-white border border-slate-100 p-4 rounded-2xl space-y-2">
                                    <div class="flex justify-between items-center text-[10px] font-semibold text-slate-400">
                                        <span>PERTANYAAN ${idx + 1}</span>
                                        <span class="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold uppercase tracking-wide text-slate-600">${q.type === 'esay' || q.type === 'essay' ? 'Esay' : 'Pilihan Ganda'}</span>
                                    </div>
                                    <p class="font-bold text-slate-800 text-xs leading-relaxed">${q.question}</p>
                                    ${qBody}
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">Batal</button>
                        <button type="submit" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer transition">
                            <i class="fa-solid fa-cloud-arrow-up"></i><span>Simpan Koreksi</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const modal = document.getElementById('modal-container');
    if (modal) {
        modal.innerHTML = modalHTML;
        if (typeof window.renderMathInElementSafely === 'function') {
            window.renderMathInElementSafely(modal);
        }
    }
}

function saveKoreksi(e, studentId) {
    e.preventDefault();
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const st = appState.students.find(s => String(s.id) === String(studentId));
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!ex) return;

    const stId = st ? st.id : studentId;
    const key1 = stId + '_' + examId;
    const key2 = String(stId) + '_' + String(examId);

    const questions = getExamQuestions(ex, stId);

    const grades = appState.studentExamGrades || JSON.parse(localStorage.getItem('madrasah_student_exam_grades') || '{}') || {};
    const gradeObj = grades[key1] || grades[key2] || { essayGrades: {} };

    const essayQuestions = questions.filter(q => q.type === 'esay' || q.type === 'essay');
    const newEssayGrades = {};

    essayQuestions.forEach(q => {
        const input = document.getElementsByName(`essay-grade-${q.id}`)[0];
        if (input) {
            const val = parseFloat(input.value) || 0;
            newEssayGrades[q.id] = val;
            newEssayGrades[String(q.id)] = val;
        }
    });

    gradeObj.essayGrades = newEssayGrades;

    let essayScore = 0;
    if (essayQuestions.length > 0) {
        let sum = 0;
        essayQuestions.forEach(q => {
            sum += newEssayGrades[q.id] !== undefined ? newEssayGrades[q.id] : (newEssayGrades[String(q.id)] || 0);
        });
        essayScore = sum / essayQuestions.length;
    }
    gradeObj.essayScore = Math.round(essayScore);
    gradeObj.isGraded = true;

    const weightPg = ex.weightPg !== undefined ? ex.weightPg : 50;
    const weightEssay = ex.weightEssay !== undefined ? ex.weightEssay : 50;
    
    gradeObj.finalScore = Math.round((gradeObj.pgScore * weightPg / 100) + (gradeObj.essayScore * weightEssay / 100));

    if (!appState.studentExamGrades) appState.studentExamGrades = {};
    appState.studentExamGrades[key1] = gradeObj;
    appState.studentExamGrades[key2] = gradeObj;

    safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);
    syncExamStateToServer({ gradesObj: { [key1]: gradeObj, [key2]: gradeObj } });

    closeModal();
    showToast('Berhasil mengoreksi dan memberikan nilai esay!', 'success');
    renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', null);
}

function clickKoreksiBelum(studentId, studentName) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center space-y-4 border border-slate-100">
                <div class="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto text-xl">
                    <i class="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                </div>
                <h3 class="font-bold text-slate-800 text-base">Metode Koreksi Esai</h3>
                <p class="text-xs text-slate-500 leading-relaxed">
                    Jawaban esai milik <b>${studentName}</b> belum dikoreksi. Silakan pilih metode pengoreksian di bawah ini:
                </p>
                <div class="flex flex-col gap-2 pt-2">
                    <button type="button" id="single-auto-koreksi-non-ai-btn" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-600/10 transition cursor-pointer flex items-center justify-center gap-1.5" title="Mendukung Bahasa Indonesia, Arab (Harakat/Gundul), Inggris & Rumus Matematika">
                        <i class="fa-solid fa-calculator"></i><span>Auto Koreksi Non-AI (Indo / Arab / Eng / Math)</span>
                    </button>
                    <button type="button" id="single-auto-koreksi-btn" class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-purple-600/10 transition cursor-pointer flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-wand-magic-sparkles"></i><span>Auto Koreksi dengan AI (Gemini)</span>
                    </button>
                    <button type="button" id="single-manual-koreksi-btn" class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs shadow transition cursor-pointer flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-pen-to-square"></i><span>Koreksi Manual / Isi Sendiri</span>
                    </button>
                    <button type="button" onclick="closeModal()" class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center">
                        Batal
                    </button>
                </div>
            </div>
        </div>
    `;

    const btnManual = document.getElementById('single-manual-koreksi-btn');
    if (btnManual) {
        btnManual.onclick = () => {
            closeModal();
            openKoreksiModal(studentId);
        };
    }

    const btnAutoAI = document.getElementById('single-auto-koreksi-btn');
    if (btnAutoAI) {
        btnAutoAI.onclick = () => {
            runSingleStudentAutoKoreksiAI(studentId);
        };
    }

    const btnAutoNonAI = document.getElementById('single-auto-koreksi-non-ai-btn');
    if (btnAutoNonAI) {
        btnAutoNonAI.onclick = () => {
            runSingleStudentAutoKoreksiNonAI(studentId);
        };
    }
}

async function runSingleStudentAutoKoreksiNonAI(studentId) {
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const btn = document.getElementById('single-auto-koreksi-non-ai-btn');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memproses...`;
    }
    showToast('Memulai koreksi otomatis esai Non-AI...', 'info');

    try {
        const res = await fetch('/api/gemini/auto-koreksi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId, examId, studentId, method: 'keyword' })
        }).then(r => r.json());

        if (res && res.success) {
            showToast('Koreksi otomatis Non-AI berhasil disimpan!', 'success');
            closeModal();
            await refreshEvaluasiData(classId, examId);
        } else {
            showToast(res ? res.message : 'Gagal melakukan auto koreksi.', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    } catch (err) {
        console.error('[runSingleStudentAutoKoreksiNonAI Error]:', err);
        showToast('Terjadi kesalahan saat menghubungi server.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

async function runSingleStudentAutoKoreksiAI(studentId) {
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const btn = document.getElementById('single-auto-koreksi-btn');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memproses Auto Koreksi...`;
    }
    showToast('Memulai koreksi otomatis esai dengan AI...', 'info');

    try {
        const res = await fetch('/api/gemini/auto-koreksi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId, examId, studentId })
        }).then(r => r.json());

        if (res && res.success) {
            showToast('Koreksi otomatis dengan AI berhasil disimpan!', 'success');
            closeModal();
            await refreshEvaluasiData(classId, examId);
        } else {
            showToast(res ? res.message : 'Gagal melakukan auto koreksi.', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    } catch (err) {
        console.error('[runSingleStudentAutoKoreksiAI Error]:', err);
        showToast('Terjadi kesalahan saat menghubungi server.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

async function refreshEvaluasiData(classId, examId) {
    showToast('Memperbarui data nilai dari server...', 'info');
    try {
        const monRes = await fetch('/api/exam-monitoring-state').then(r => r.json()).catch(() => null);
        if (monRes && monRes.success) {
            if (monRes.completedExams) appState.completedExams = { ...(appState.completedExams || {}), ...monRes.completedExams };
            if (monRes.studentExamGrades) appState.studentExamGrades = { ...(appState.studentExamGrades || {}), ...monRes.studentExamGrades };
            if (monRes.studentExamAnswers) appState.studentExamAnswers = { ...(appState.studentExamAnswers || {}), ...monRes.studentExamAnswers };
            if (monRes.activeExamSessions) appState.activeExamSessions = { ...(appState.activeExamSessions || {}), ...monRes.activeExamSessions };
            if (monRes.studentQuestions) appState.studentExamQuestions = { ...(appState.studentExamQuestions || {}), ...monRes.studentQuestions };
            safeSetStorage('madrasah_completed_exams', appState.completedExams || {});
            safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades || {});
            safeSetStorage('madrasah_student_exam_answers', appState.studentExamAnswers || {});
            safeSetStorage('madrasah_active_exam_sessions', appState.activeExamSessions || {});
            safeSetStorage('madrasah_student_exam_questions', appState.studentExamQuestions || {});
        }
    } catch (e) {
        console.warn('Refresh error:', e);
    }
    if (classId) appState.evaluasiSelectedClassId = classId;
    if (examId) appState.evaluasiSelectedExamId = examId;
    renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', examId || null);
    showToast('Data nilai berhasil diperbarui!', 'success');
}

async function runAutoKoreksiNonAI(classId, examId) {
    const btn = document.getElementById('btn-auto-koreksi-non-ai');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Proses...`;
    }
    showToast('Proses koreksi otomatis Non-AI dimulai, harap tunggu sebentar...', 'info');

    try {
        const res = await fetch('/api/gemini/auto-koreksi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId, examId, method: 'keyword' })
        }).then(r => r.json());

        if (res && res.success) {
            showToast(res.message, 'success');
            await refreshEvaluasiData(classId, examId);
        } else {
            showToast(res ? res.message : 'Gagal melakukan auto koreksi.', 'error');
        }
    } catch (err) {
        console.error('[runAutoKoreksiNonAI Error]:', err);
        showToast('Terjadi kesalahan jaringan atau server saat melakukan auto koreksi.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

async function runAutoKoreksiAI(classId, examId) {
    const btn = document.getElementById('btn-auto-koreksi');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Proses Auto Koreksi AI...`;
    }
    showToast('Proses koreksi otomatis dengan AI dimulai, harap tunggu sebentar...', 'info');

    try {
        const res = await fetch('/api/gemini/auto-koreksi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId, examId })
        }).then(r => r.json());

        if (res && res.success) {
            showToast(res.message, 'success');
            await refreshEvaluasiData(classId, examId);
        } else {
            showToast(res ? res.message : 'Gagal melakukan auto koreksi.', 'error');
        }
    } catch (err) {
        console.error('[runAutoKoreksiAI Error]:', err);
        showToast('Terjadi kesalahan jaringan atau server saat melakukan auto koreksi.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

function generateNilaiEvaluasi() {
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!classId || !examId || !ex) return;

    showConfirmModal('Apakah Anda juga ingin menghasilkan (generate) nilai simulasi otomatis bagi siswa yang belum mengikuti ujian?', () => {
        const clsStudents = appState.students.filter(st => String(st.classId) === String(classId));
        
        if (!appState.completedExams) appState.completedExams = {};
        if (!appState.studentExamAnswers) appState.studentExamAnswers = {};
        if (!appState.studentExamGrades) appState.studentExamGrades = {};

        let changed = false;
        let simulatedCount = 0;
        let gradedCount = 0;

        clsStudents.forEach(st => {
            const key = st.id + '_' + examId;
            let questions = getExamQuestions(ex, st.id);
            
            if (!appState.completedExams[key] || !appState.studentExamAnswers[key]) {
                // Generate simulated data
                appState.completedExams[key] = true;
                
                const answers = {};
                questions.forEach(q => {
                    if (q.type === 'esay' || q.type === 'essay') {
                        if (q.question.toLowerCase().includes('rukun') || q.question.toLowerCase().includes('islam')) {
                            answers[q.id] = `Rukun shalat/rukun Islam merupakan pilar utama yang sangat krusial dalam beribadah bagi saya sebagai muslim. Menurut pandangan saya, hal ini harus dilaksanakan secara runtut, tulus, dan khusyu agar ibadah kita diridhai Allah SWT.`;
                        } else if (q.question.toLowerCase().includes('tajwid') || q.question.toLowerCase().includes('baca')) {
                            answers[q.id] = `Tajwid adalah hukum tata cara membaguskan bacaan kitab suci Al-Quran. Mempelajari ilmunya adalah fardhu kifayah, namun melafalkannya sesuai tajwid saat shalat adalah fardhu ain agar terhindar dari salah tafsir.`;
                        } else {
                            answers[q.id] = `Jawaban esay sistematis siswa ${st.name}. Melalui analisis fikih mendalam, hal ini merujuk pada ketentuan syar'i tentang syarat sah wajib suatu amalan.`;
                        }
                    } else {
                        const isCorrect = Math.random() < 0.85;
                        const correctOpt = q.correctOptionText || q.answer;
                        if (isCorrect) {
                            answers[q.id] = correctOpt;
                        } else {
                            const wrongOpts = (q.options || []).filter(o => o !== correctOpt);
                            answers[q.id] = wrongOpts.length > 0 ? wrongOpts[Math.floor(Math.random() * wrongOpts.length)] : correctOpt;
                        }
                    }
                });
                appState.studentExamAnswers[key] = answers;

                let pgQuestions = questions.filter(q => q.type !== 'esay' && q.type !== 'essay');
                let essayQuestions = questions.filter(q => q.type === 'esay' || q.type === 'essay');

                let correctPGCount = 0;
                pgQuestions.forEach(q => {
                    if (isCorrectAnswer(q, answers[q.id])) {
                        correctPGCount++;
                    }
                });

                let pgScore = pgQuestions.length > 0 ? (correctPGCount / pgQuestions.length) * 100 : 100;

                const isGraded = Math.random() < 0.5;
                const essayGrades = {};
                let essayScore = 0;

                essayQuestions.forEach(q => {
                    essayGrades[q.id] = isGraded ? Math.floor(75 + Math.random() * 21) : 0;
                });

                if (essayQuestions.length > 0) {
                    if (isGraded) {
                        const sum = Object.values(essayGrades).reduce((a, b) => a + b, 0);
                        essayScore = sum / essayQuestions.length;
                    } else {
                        essayScore = 0;
                    }
                }

                const weightPg = ex.weightPg !== undefined ? ex.weightPg : 50;
                const weightEssay = ex.weightEssay !== undefined ? ex.weightEssay : 50;

                let finalScore = null;
                if (essayQuestions.length === 0) {
                    finalScore = Math.round(pgScore);
                } else if (isGraded) {
                    finalScore = Math.round((pgScore * weightPg / 100) + (essayScore * weightEssay / 100));
                }

                appState.studentExamGrades[key] = {
                    pgScore: Math.round(pgScore),
                    essayScore: Math.round(essayScore),
                    finalScore: finalScore,
                    isGraded: essayQuestions.length > 0 ? isGraded : true,
                    correctPGCount,
                    totalPGCount: pgQuestions.length,
                    essayGrades: essayGrades
                };

                simulatedCount++;
                changed = true;
            } else {
                // For actual completed students, recalculate/ensure final score
                const gradeObj = appState.studentExamGrades[key];
                if (gradeObj && (gradeObj.finalScore === null || gradeObj.finalScore === undefined || !gradeObj.isGraded)) {
                    const weightPg = ex.weightPg !== undefined ? ex.weightPg : 50;
                    const weightEssay = ex.weightEssay !== undefined ? ex.weightEssay : 50;
                    const pgPart = gradeObj.pgScore * weightPg / 100;
                    const essayPart = (gradeObj.essayScore || 0) * weightEssay / 100;
                    gradeObj.finalScore = Math.round(pgPart + essayPart);
                    gradeObj.isGraded = true;
                    appState.studentExamGrades[key] = gradeObj;
                    gradedCount++;
                    changed = true;
                }
            }
        });

        if (changed) {
            safeSetStorage('madrasah_completed_exams', appState.completedExams);
            safeSetStorage('madrasah_student_exam_answers', appState.studentExamAnswers);
            safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);
            syncExamStateToServer({
                completed: appState.completedExams,
                answers: appState.studentExamAnswers,
                gradesObj: appState.studentExamGrades
            });
        }

        let toastMsg = 'Berhasil memproses final score!';
        if (simulatedCount > 0 && gradedCount > 0) {
            toastMsg = `Berhasil menghasilkan ${simulatedCount} nilai simulasi & memperbarui ${gradedCount} skor final!`;
        } else if (simulatedCount > 0) {
            toastMsg = `Berhasil menghasilkan nilai simulasi untuk ${simulatedCount} siswa!`;
        } else if (gradedCount > 0) {
            toastMsg = `Berhasil memperbarui skor final untuk ${gradedCount} siswa!`;
        }
        
        showToast(toastMsg, 'success');
        renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', null);
    }, () => {
        // Callback if they press cancel on simulation generation: only calculate final scores of actual finished students!
        const clsStudents = appState.students.filter(st => String(st.classId) === String(classId));
        if (!appState.studentExamGrades) appState.studentExamGrades = {};
        
        let changed = false;
        let count = 0;

        clsStudents.forEach(st => {
            const key = st.id + '_' + examId;
            const gradeObj = appState.studentExamGrades[key];
            if (gradeObj) {
                const weightPg = ex.weightPg !== undefined ? ex.weightPg : 50;
                const weightEssay = ex.weightEssay !== undefined ? ex.weightEssay : 50;

                const pgPart = gradeObj.pgScore * weightPg / 100;
                const essayPart = (gradeObj.essayScore || 0) * weightEssay / 100;

                gradeObj.finalScore = Math.round(pgPart + essayPart);
                gradeObj.isGraded = true;
                appState.studentExamGrades[key] = gradeObj;
                count++;
                changed = true;
            }
        });

        if (changed) {
            safeSetStorage('madrasah_student_exam_grades', appState.studentExamGrades);
            syncExamStateToServer({
                gradesObj: appState.studentExamGrades
            });
            showToast(`Berhasil menggenerasi final score untuk ${count} siswa yang sudah ujian!`, 'success');
            renderAssessmentModule(document.getElementById('view-container'), 'evaluasi', null);
        } else {
            showToast('Tidak ada data siswa ujian baru untuk dikalkulasi.', 'info');
        }
    });
}

function openCetakJawabanModal() {
    const classId = appState.evaluasiSelectedClassId;
    const cls = appState.classes.find(c => c.id === classId);
    if (!cls) return;

    const clsStudents = appState.students.filter(st => String(st.classId) === String(classId));
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Cetak Lembar Jawaban</h3>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-slate-400"></i></button>
                </div>
                <div class="space-y-4 text-xs sm:text-sm">
                    <p class="text-slate-500 leading-relaxed text-xs">Pilih apakah Anda ingin mencetak lembar jawaban lengkap beserta kunci jawaban untuk satu siswa saja atau seluruh siswa dalam kelas ini.</p>
                    
                    <div>
                        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Metode Cetak</label>
                        <select id="print-scope-select" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            <option value="ALL">Cetak Seluruh Kelas (${clsStudents.length} Siswa)</option>
                            ${clsStudents.map(st => `<option value="${st.id}">Cetak Khusus: ${st.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="flex justify-end space-x-2 pt-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">Batal</button>
                        <button type="button" onclick="cetakJawabanEvaluasi()" class="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer">
                            <i class="fa-solid fa-print"></i><span>Mulai Cetak</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updatePrintSetting(key, val) {
    if (!window.__printSettings) window.__printSettings = {};
    window.__printSettings[key] = val;
    
    // Regenerate report
    const newContent = generateReportHTML();
    window.__currentPrintPayload = newContent;
    
    // Update live preview paper
    const rawContainer = document.getElementById('raw-print-payload');
    if (rawContainer) {
        rawContainer.innerHTML = newContent;
    }
}

function generateReportHTML() {
    const type = window.__activePrintType;
    const params = window.__activePrintParams;
    if (!type || !params) return '';

    const settings = window.__printSettings || {};
    const classId = params.classId;
    const examId = params.examId;
    const cls = appState.classes.find(c => String(c.id) === String(classId));
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!cls || !ex) return '';

    const kopHTML = `
        <!-- Kop Surat Madrasah -->
        <div class="text-center border-b-4 border-double border-gray-800 pb-4 mb-6" style="text-align: center; border-bottom: 4px double #1f2937; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 16px; font-weight: 800; line-height: 1.25; margin: 0; text-transform: uppercase; color: #111827;">${settings.kopLine1 || ''}</h1>
            <h2 style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 900; line-height: 1.25; margin: 4px 0 0 0; text-transform: uppercase; color: #047857;">${settings.kopLine2 || ''}</h2>
            <p style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; margin: 4px 0 0 0; color: #6b7280;">${settings.kopLine3 || ''}</p>
        </div>
    `;

    const footerHTML = `
        <!-- Penutup & Tanda Tangan Guru Mapel saja (Tanpa Kepala Sekolah) -->
        <div class="flex justify-end pt-12 text-sm" style="display: flex; justify-content: flex-end; padding-top: 48px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif;">
            <div style="text-align: right; width: 256px;">
                <p style="margin: 0; color: #374151;">${settings.footerPlaceDate || ''}</p>
                <p style="font-weight: bold; margin: 4px 0 0 0; color: #111827;">${settings.footerRole || ''}</p>
                <div style="height: 64px;"></div>
                <p style="font-weight: bold; text-decoration: underline; margin: 0; color: #111827;">${settings.footerTeacherName || ''}</p>
                <p style="font-size: 12px; margin: 2px 0 0 0; color: #6b7280;">NIP. ${settings.footerTeacherNip || ''}</p>
            </div>
        </div>
    `;

    if (type === 'nilai') {
        const clsStudents = appState.students.filter(st => String(st.classId) === String(classId));
        const grades = JSON.parse(localStorage.getItem('madrasah_student_exam_grades')) || {};
        const completedMap = appState.completedExams || JSON.parse(localStorage.getItem('madrasah_completed_exams') || '{}') || {};
        const forceFinishedMap = appState.forceFinishedExams || JSON.parse(localStorage.getItem('madrasah_force_finished_exams') || '{}') || {};
        const activeSessions = appState.activeExamSessions || JSON.parse(localStorage.getItem('madrasah_active_exam_sessions') || '{}') || {};
        const storedAnswers = appState.studentExamAnswers || JSON.parse(localStorage.getItem('madrasah_student_exam_answers') || '{}') || {};

        let tableRows = clsStudents.map((st, idx) => {
            const k1 = st.id + '_' + examId;
            const k2 = String(st.id) + '_' + String(examId);
            const gradeObj = grades[k1] || grades[k2] || {};
            const isFF = Boolean(forceFinishedMap[k1] || forceFinishedMap[k2] || completedMap[k1] === 'force_finish' || completedMap[k2] === 'force_finish' || gradeObj.submissionType === 'force_finish');
            const isComp = Boolean(completedMap[k1] || completedMap[k2]) || isFF;
            const sess = activeSessions[k1] || activeSessions[k2];
            const ans = storedAnswers[k1] || storedAnswers[k2] || (sess && sess.answers);
            const isWork = !isComp && Boolean((sess && (sess.status === 'active' || (sess.timeLeft !== undefined && sess.timeLeft > 0))) || (ans && Object.keys(ans).length > 0));

            let status = 'Belum Mulai';
            if (isFF) status = 'Force Finish (Admin)';
            else if (isComp) status = 'Selesai';
            else if (isWork) status = 'Sedang Mengerjakan';

            const pgVal = gradeObj.pgScore !== undefined ? gradeObj.pgScore : '-';
            const essayVal = gradeObj.isGraded ? gradeObj.essayScore : (gradeObj.pgScore !== undefined ? 'Belum Dikoreksi' : '-');
            const finalVal = gradeObj.finalScore !== null && gradeObj.finalScore !== undefined ? gradeObj.finalScore : '-';
            
            return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; font-family: monospace; color: #374151;">${idx + 1}</td>
                    <td style="border: 1px solid #d1d5db; padding: 10px; font-weight: 600; color: #111827;">${st.name}</td>
                    <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; font-family: monospace; color: #374151;">${st.nis || '-'}</td>
                    <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; color: #374151;">${pgVal !== '-' ? pgVal + '%' : '-'}</td>
                    <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; color: #374151;">${essayVal !== '-' && gradeObj.isGraded ? essayVal + '%' : essayVal}</td>
                    <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; font-weight: bold; color: ${isFF ? '#d97706' : '#047857'}; background-color: ${isFF ? 'rgba(254, 243, 199, 0.4)' : 'rgba(236, 253, 245, 0.4)'};">${finalVal}</td>
                </tr>
            `;
        }).join('');

        return `
            <div style="color: #1f2937; font-family: 'Plus Jakarta Sans', sans-serif;">
                ${kopHTML}

                <!-- Judul Laporan -->
                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 16px; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; color: #1f2937; margin: 0 0 12px 0;">DAFTAR NILAI CBT (COMPUTER BASED TEST)</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); background-color: #f9fafb; padding: 16px; border-radius: 12px; border: 1px solid #f3f4f6; font-size: 14px; color: #4b5563;">
                        <div>
                            <p style="margin: 0 0 4px 0;"><strong>Ujian:</strong> ${ex.title}</p>
                            <p style="margin: 0;"><strong>Mata Pelajaran:</strong> ${ex.subject}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0 0 4px 0;"><strong>Kelas:</strong> ${cls.name}</p>
                            <p style="margin: 0;"><strong>Tanggal Cetak:</strong> ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </div>
                </div>

                <!-- Tabel Nilai -->
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; font-size: 13px; margin-bottom: 24px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 48px; color: #374151;">No</th>
                            <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; color: #374151;">Nama Lengkap Siswa</th>
                            <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 112px; color: #374151;">NIS</th>
                            <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 96px; color: #374151;">Nilai PG (${ex.weightPg || 50}%)</th>
                            <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 112px; color: #374151;">Nilai Esay (${ex.weightEssay || 50}%)</th>
                            <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 96px; background-color: #ecfdf5; color: #047857;">Nilai Akhir</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>

                ${footerHTML}
            </div>
        `;
    } else if (type === 'jawaban') {
        const scope = params.scope;
        const clsStudents = appState.students.filter(st => String(st.classId) === String(classId));
        const targetStudents = scope === 'ALL' ? clsStudents : clsStudents.filter(st => st.id === scope);

        const answers = JSON.parse(localStorage.getItem('madrasah_student_exam_answers')) || {};
        const grades = JSON.parse(localStorage.getItem('madrasah_student_exam_grades')) || {};

        let printableHTML = '';

        targetStudents.forEach((st, idx) => {
            let questions = getExamQuestions(ex, st.id);
            const studentAns = answers[st.id + '_' + examId] || {};
            const studentGr = grades[st.id + '_' + examId] || {};

            let questionsHTML = questions.map((q, qIdx) => {
                const rawUserAns = studentAns[q.id] !== undefined ? studentAns[q.id] : studentAns[String(q.id)];
                const ansVal = (rawUserAns !== undefined && rawUserAns !== null && String(rawUserAns).trim() !== '') ? rawUserAns : '<span style="color: #ef4444; font-style: italic;">Tidak menjawab</span>';
                const isCorrect = isCorrectAnswer(q, rawUserAns);
                const essayPoints = q.type === 'esay' || q.type === 'essay' ? (studentGr.essayGrades?.[q.id] !== undefined ? studentGr.essayGrades[q.id] : (studentGr.essayGrades?.[String(q.id)] !== undefined ? studentGr.essayGrades[String(q.id)] : '-')) : null;
                const keyDisplay = q.correctOptionText || q.answer;

                let details = '';
                if (q.type !== 'esay' && q.type !== 'essay') {
                    details = `
                        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; font-size: 12px; margin-top: 8px;">
                            <p style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 8px; border-radius: 6px; margin: 0; color: #374151;"><strong>Jawaban Siswa:</strong> ${ansVal} ${isCorrect ? '<span style="color: #059669; font-weight: bold; margin-left: 4px;">✓ Benar</span>' : '<span style="color: #dc2626; font-weight: bold; margin-left: 4px;">✗ Salah</span>'}</p>
                            <p style="background-color: #ecfdf5; border: 1px solid #d1fae5; padding: 8px; border-radius: 6px; margin: 0; color: #047857;"><strong>Kunci Jawaban:</strong> ${keyDisplay}</p>
                        </div>
                    `;
                } else {
                    details = `
                        <div style="margin-top: 8px;">
                            <div style="background-color: rgba(254, 243, 199, 0.5); border: 1px solid #fde68a; padding: 12px; border-radius: 8px; font-size: 13px; color: #374151; margin-bottom: 8px;">
                                <strong>Jawaban Siswa (Esay):</strong>
                                <p style="margin: 4px 0 0 0; leading-relaxed: 1.5; whitespace-pre-wrap: break-spaces;">${ansVal}</p>
                            </div>
                            <div style="background-color: rgba(209, 250, 229, 0.5); border: 1px solid #a7f3d0; padding: 12px; border-radius: 8px; font-size: 13px; color: #047857; margin-bottom: 8px;">
                                <strong>Kunci Jawaban / Acuan Penilaian:</strong>
                                <p style="margin: 4px 0 0 0; leading-relaxed: 1.5; whitespace-pre-wrap: break-spaces;">${q.answer}</p>
                            </div>
                            <div style="font-size: 12px; font-weight: bold; color: #4b5563;">
                                Pemberian Nilai Esay: <span style="color: #047857; background-color: #ecfdf5; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">${essayPoints !== '-' ? essayPoints + '%' : 'Belum Dinilai'}</span>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div style="background-color: #fff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                        <p style="font-weight: bold; font-size: 13px; color: #1f2937; margin: 0 0 6px 0;">Soal No. ${qIdx + 1} (${q.type === 'esay' || q.type === 'essay' ? 'Esay' : 'Pilihan Ganda'})</p>
                        <p style="font-size: 13px; line-height: 1.625; color: #374151; margin: 0;">${q.question}</p>
                        ${details}
                    </div>
                `;
            }).join('');

            printableHTML += `
                <div class="${idx > 0 ? 'page-break mt-12' : ''}" style="color: #1f2937; font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 48px;">
                    ${kopHTML}

                    <!-- Info Lembar Jawaban -->
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); background-color: #f9fafb; padding: 16px; border-radius: 12px; border: 1px solid #f3f4f6; font-size: 13px; color: #4b5563; gap: 16px; margin-bottom: 24px;">
                        <div>
                            <p style="margin: 0 0 4px 0;"><strong>Nama Lengkap:</strong> ${st.name}</p>
                            <p style="margin: 0 0 4px 0;"><strong>NIS:</strong> ${st.nis || '-'}</p>
                            <p style="margin: 0;"><strong>Kelas / Rombel:</strong> ${cls.name}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0 0 4px 0;"><strong>Ujian CBT:</strong> ${ex.title}</p>
                            <p style="margin: 0 0 4px 0;"><strong>Mata Pelajaran:</strong> ${ex.subject}</p>
                            <p style="margin: 0;"><strong>Nilai Akhir:</strong> <span style="font-weight: bold; color: #047857; background-color: #ecfdf5; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">${studentGr.finalScore !== null && studentGr.finalScore !== undefined ? studentGr.finalScore : 'Proses'}</span></p>
                        </div>
                    </div>

                    <!-- Lembar Jawaban List -->
                    <div style="margin-top: 16px; margin-bottom: 24px;">
                        <h4 style="font-size: 13px; font-weight: bold; text-transform: uppercase; color: #374151; letter-spacing: 0.05em; margin: 0 0 12px 0;">Rincian Pertanyaan & Jawaban Siswa</h4>
                        ${questionsHTML}
                    </div>

                    ${footerHTML}
                </div>
            `;
        });

        return printableHTML;
    }

    return '';
}

function openDownloadPreviewModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
        <div class="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
            <div class="bg-white w-full max-w-6xl mx-auto rounded-3xl shadow-2xl flex flex-col h-full max-h-[90vh] overflow-hidden border border-slate-100">
                <!-- Header -->
                <div class="bg-slate-50 px-6 py-4 border-b border-slate-200/60 flex justify-between items-center shrink-0">
                    <div>
                        <h3 class="font-extrabold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                            <i class="fa-solid fa-file-pdf text-emerald-600"></i>
                            Pratinjau Unduh Laporan / Hasil CBT
                        </h3>
                        <p class="text-[10px] text-slate-400 font-semibold mt-0.5">Silakan tinjau dan sesuaikan pengaturan download sebelum mengunduh PDF.</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="exportNilaiExcelEvaluasi()" class="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer">
                            <i class="fa-solid fa-file-excel"></i><span>Ekspor Excel</span>
                        </button>
                        <button type="button" onclick="triggerDirectPrint()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition cursor-pointer">
                            <i class="fa-solid fa-download"></i><span>Download PDF</span>
                        </button>
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">
                            Tutup
                        </button>
                    </div>
                </div>

                <!-- Main Content (Two Columns) -->
                <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
                    <!-- Left Column: Download Settings (Inputs) -->
                    <div class="w-full md:w-80 bg-slate-50 border-r border-slate-200/60 p-5 overflow-y-auto shrink-0 flex flex-col space-y-4">
                        <div class="space-y-1">
                            <h4 class="font-extrabold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <i class="fa-solid fa-sliders text-indigo-500"></i>
                                Download Setting
                            </h4>
                            <p class="text-[10px] text-slate-400">Atur tulisan kop surat dan info tanda tangan dewan guru secara instan.</p>
                        </div>

                        <div class="border-t border-slate-200/60 pt-3 space-y-3">
                            <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Bagian Kop Surat</span>
                            
                            <div>
                                <label class="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Baris 1 (Instansi/Yayasan)</label>
                                <input type="text" id="setting-kop-1" value="${window.__printSettings.kopLine1}" oninput="updatePrintSetting('kopLine1', this.value)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            </div>
                            
                            <div>
                                <label class="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Baris 2 (Nama Madrasah)</label>
                                <input type="text" id="setting-kop-2" value="${window.__printSettings.kopLine2}" oninput="updatePrintSetting('kopLine2', this.value)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            </div>
                            
                            <div>
                                <label class="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Baris 3 (Akreditasi/Sub-detail)</label>
                                <input type="text" id="setting-kop-3" value="${window.__printSettings.kopLine3}" oninput="updatePrintSetting('kopLine3', this.value)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            </div>
                        </div>

                        <div class="border-t border-slate-200/60 pt-3 space-y-3">
                            <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Bagian Tanda Tangan</span>
                            
                            <div>
                                <label class="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tempat & Tanggal</label>
                                <input type="text" id="setting-footer-dated" value="${window.__printSettings.footerPlaceDate}" oninput="updatePrintSetting('footerPlaceDate', this.value)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            </div>

                            <div>
                                <label class="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Jabatan Peran</label>
                                <input type="text" id="setting-footer-role" value="${window.__printSettings.footerRole}" oninput="updatePrintSetting('footerRole', this.value)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            </div>

                            <div>
                                <label class="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Guru Mapel</label>
                                <input type="text" id="setting-footer-name" value="${window.__printSettings.footerTeacherName}" oninput="updatePrintSetting('footerTeacherName', this.value)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            </div>

                            <div>
                                <label class="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">NIP Guru</label>
                                <input type="text" id="setting-footer-nip" value="${window.__printSettings.footerTeacherNip}" oninput="updatePrintSetting('footerTeacherNip', this.value)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            </div>
                        </div>
                        
                        <div class="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl space-y-1 mt-auto">
                            <h5 class="text-[9px] font-extrabold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                                <i class="fa-solid fa-circle-info"></i> Info Guru Mapel
                            </h5>
                            <p class="text-[9px] text-indigo-950/80 leading-relaxed font-semibold">Sistem mendeteksi guru yang ditugaskan untuk mapel ini secara otomatis. Sesuai instruksi, tanda tangan Kepala Sekolah ditiadakan.</p>
                        </div>
                    </div>

                    <!-- Right Column: Live Paper Preview -->
                    <div class="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-10" id="print-preview-content-area">
                        <div class="bg-white p-8 sm:p-16 shadow-lg rounded-xl border border-slate-200/80 max-w-3xl mx-auto text-slate-800" id="raw-print-payload">
                            <!-- Dynamic Content Rendered Here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Populate initial content
    const initialContent = generateReportHTML();
    window.__currentPrintPayload = initialContent;
    const rawContainer = document.getElementById('raw-print-payload');
    if (rawContainer) {
        rawContainer.innerHTML = initialContent;
    }
}

function printHTML(content) {
    // Legacy fallback, we now use openDownloadPreviewModal() directly
    openDownloadPreviewModal();
}

function triggerDirectPrint() {
    const content = window.__currentPrintPayload;
    if (!content) return;

    const printSectionId = 'print-section';
    const printStyleId = 'print-style';

    const oldSection = document.getElementById(printSectionId);
    if (oldSection) oldSection.remove();
    const oldStyle = document.getElementById(printStyleId);
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = printStyleId;
    style.innerHTML = `
        @media print {
            body > *:not(#${printSectionId}) {
                display: none !important;
            }
            #${printSectionId} {
                display: block !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
                color: black !important;
                padding: 20px !important;
            }
            .page-break {
                page-break-after: always;
                page-break-inside: avoid;
            }
        }
    `;
    document.head.appendChild(style);

    const printSection = document.createElement('div');
    printSection.id = printSectionId;
    printSection.innerHTML = content;
    document.body.appendChild(printSection);

    if (typeof window.renderMathInElementSafely === 'function') {
        window.renderMathInElementSafely(printSection);
    }

    setTimeout(() => {
        try {
            window.print();
        } catch (e) {
            console.error("Print error:", e);
            showToast("Gagal mendownload. Harap gunakan tombol 'Buka di Tab Baru' di kanan atas layar untuk hasil terbaik.", "error");
        }
        
        setTimeout(() => {
            if (printSection) printSection.remove();
            if (style) style.remove();
        }, 1000);
    }, 250);
}

function cetakNilaiEvaluasi() {
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const cls = appState.classes.find(c => String(c.id) === String(classId));
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!cls || !ex) return;

    window.__activePrintType = 'nilai';
    window.__activePrintParams = { classId, examId };

    // Automatic assigned teacher search
    const teacher = (appState.teachers || []).find(t => {
        const tMapels = Array.isArray(t.mapel) ? t.mapel : (t.mapel ? [t.mapel] : []);
        return tMapels.some(m => String(m).toLowerCase() === String(ex.subject).toLowerCase());
    });
    const defaultTeacherName = teacher ? teacher.name : (appState.currentUser ? appState.currentUser.name : 'Dewan Guru');
    const defaultTeacherNip = teacher ? teacher.nip : (appState.currentUser && appState.currentUser.nip ? appState.currentUser.nip : '198501012010011001');

    window.__printSettings = {
        kopLine1: "Yayasan Pendidikan Islam Madrasah",
        kopLine2: appState.settings.schoolName || "MA Al-Ukhuwah",
        kopLine3: "Status Terakreditasi A &middot; Portal Madrasah Terintegrasi",
        footerPlaceDate: `Madrasah Aliyah, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        footerRole: "Guru Mata Pelajaran",
        footerTeacherName: defaultTeacherName,
        footerTeacherNip: defaultTeacherNip
    };

    openDownloadPreviewModal();
}

function cetakJawabanEvaluasi() {
    const scopeSelect = document.getElementById('print-scope-select');
    const scope = scopeSelect ? scopeSelect.value : 'ALL';
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const cls = appState.classes.find(c => String(c.id) === String(classId));
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!cls || !ex) return;

    closeModal();

    window.__activePrintType = 'jawaban';
    window.__activePrintParams = { scope, classId, examId };

    // Automatic assigned teacher search
    const teacher = (appState.teachers || []).find(t => {
        const tMapels = Array.isArray(t.mapel) ? t.mapel : (t.mapel ? [t.mapel] : []);
        return tMapels.some(m => String(m).toLowerCase() === String(ex.subject).toLowerCase());
    });
    const defaultTeacherName = teacher ? teacher.name : (appState.currentUser ? appState.currentUser.name : 'Dewan Guru');
    const defaultTeacherNip = teacher ? teacher.nip : (appState.currentUser && appState.currentUser.nip ? appState.currentUser.nip : '198501012010011001');

    window.__printSettings = {
        kopLine1: "Yayasan Pendidikan Islam Madrasah",
        kopLine2: appState.settings.schoolName || "MA Al-Ukhuwah",
        kopLine3: "Status Terakreditasi A &middot; Portal Madrasah Terintegrasi",
        footerPlaceDate: `Madrasah Aliyah, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        footerRole: "Guru Mata Pelajaran",
        footerTeacherName: defaultTeacherName,
        footerTeacherNip: defaultTeacherNip
    };

    openDownloadPreviewModal();
}

// Window Globals
window.updatePrintSetting = updatePrintSetting;
window.generateReportHTML = generateReportHTML;
window.openDownloadPreviewModal = openDownloadPreviewModal;
window.renderAssessmentModule = renderAssessmentModule;
window.openExamModal = openExamModal;
window.addExamClass = addExamClass;
window.removeExamClass = removeExamClass;
window.toggleCustomWeight = toggleCustomWeight;
window.toggleEssayCountField = toggleEssayCountField;
window.saveExam = saveExam;
window.deleteExam = deleteExam;
window.openRoomModal = openRoomModal;
window.saveRoom = saveRoom;
window.deleteRoom = deleteRoom;
window.openManageRoomModal = openManageRoomModal;
window.addStudentToRoom = addStudentToRoom;
window.removeStudentFromRoom = removeStudentFromRoom;
window.downloadRoomTemplate = downloadRoomTemplate;
window.handleRoomExcelImport = handleRoomExcelImport;
window.toggleBlockStudent = toggleBlockStudent;
window.openSendMessageModal = openSendMessageModal;
window.sendStudentExamMessage = sendStudentExamMessage;
window.openBroadcastMessageModal = openBroadcastMessageModal;
window.sendBroadcastExamMessage = sendBroadcastExamMessage;
window.dismissStudentExamMessage = dismissStudentExamMessage;
window.onMonitoringFilterChange = onMonitoringFilterChange;
window.renderStudentCBTList = renderStudentCBTList;
window.startStudentExam = startStudentExam;
window.saveExamAnswer = saveExamAnswer;
window.nextExamQuestion = nextExamQuestion;
window.prevExamQuestion = prevExamQuestion;
window.submitExamFinal = submitExamFinal;
window.toggleLivecamMode = toggleLivecamMode;
window.toggleStudentLivecamMode = toggleStudentLivecamMode;

// Evaluasi window globals
window.toggleEvaluasiSelectForm = toggleEvaluasiSelectForm;
window.onEvaluasiFilterChange = onEvaluasiFilterChange;
window.openKoreksiModal = openKoreksiModal;
window.clickKoreksiBelum = clickKoreksiBelum;
window.runAutoKoreksiNonAI = runAutoKoreksiNonAI;
window.runSingleStudentAutoKoreksiNonAI = runSingleStudentAutoKoreksiNonAI;
window.runSingleStudentAutoKoreksiAI = runSingleStudentAutoKoreksiAI;
window.runAutoKoreksiAI = runAutoKoreksiAI;
window.saveKoreksi = saveKoreksi;
window.generateNilaiEvaluasi = generateNilaiEvaluasi;
window.openCetakJawabanModal = openCetakJawabanModal;
window.cetakNilaiEvaluasi = cetakNilaiEvaluasi;
window.cetakJawabanEvaluasi = cetakJawabanEvaluasi;
window.triggerDirectPrint = triggerDirectPrint;

// Kartu Peserta global functions
window.updateKartuConfig = updateKartuConfig;
window.addClassToPrint = addClassToPrint;
window.removeClassFromPrint = removeClassFromPrint;
window.handleKartuImageUpload = handleKartuImageUpload;
window.cetakKartuUjian = cetakKartuUjian;



function exportNilaiExcelEvaluasi() {
    const classId = appState.evaluasiSelectedClassId;
    const examId = appState.evaluasiSelectedExamId;
    const cls = (appState.classes || []).find(c => String(c.id) === String(classId));
    const ex = (appState.exams || []).find(e => String(e.id) === String(examId));
    if (!cls || !ex) {
        showToast('Pilih Kelas dan Jadwal Ujian terlebih dahulu.', 'warning');
        return;
    }

    const clsStudents = (appState.students || []).filter(st => String(st.classId || st.class_id) === String(classId));
    const grades = JSON.parse(localStorage.getItem('madrasah_student_exam_grades')) || {};
    const completedMap = appState.completedExams || JSON.parse(localStorage.getItem('madrasah_completed_exams') || '{}') || {};
    const forceFinishedMap = appState.forceFinishedExams || JSON.parse(localStorage.getItem('madrasah_force_finished_exams') || '{}') || {};
    const activeSessions = appState.activeExamSessions || JSON.parse(localStorage.getItem('madrasah_active_exam_sessions') || '{}') || {};
    const storedAnswers = appState.studentExamAnswers || JSON.parse(localStorage.getItem('madrasah_student_exam_answers') || '{}') || {};

    const data = clsStudents.map((st, idx) => {
        const k1 = st.id + '_' + examId;
        const k2 = String(st.id) + '_' + String(examId);
        const gradeObj = grades[k1] || grades[k2] || {};
        const isFF = Boolean(forceFinishedMap[k1] || forceFinishedMap[k2] || completedMap[k1] === 'force_finish' || completedMap[k2] === 'force_finish' || gradeObj.submissionType === 'force_finish');
        const isComp = Boolean(completedMap[k1] || completedMap[k2]) || isFF;
        const sess = activeSessions[k1] || activeSessions[k2];
        const ans = storedAnswers[k1] || storedAnswers[k2] || (sess && sess.answers);
        const isWork = !isComp && Boolean((sess && (sess.status === 'active' || (sess.timeLeft !== undefined && sess.timeLeft > 0))) || (ans && Object.keys(ans).length > 0));

        let statusStr = 'Belum Mulai';
        if (isFF) statusStr = 'Force Finish (Admin)';
        else if (isComp) statusStr = 'Selesai';
        else if (isWork) statusStr = 'Sedang Mengerjakan';

        const pgVal = gradeObj.pgScore !== undefined ? gradeObj.pgScore : '-';
        const essayVal = gradeObj.isGraded ? gradeObj.essayScore : (gradeObj.pgScore !== undefined ? 'Belum Koreksi' : '-');
        const finalVal = gradeObj.finalScore !== null && gradeObj.finalScore !== undefined ? gradeObj.finalScore : '-';

        return {
            'No': idx + 1,
            'NIS': st.nis || '-',
            'Nama Siswa': st.name,
            'Kelas': cls.name,
            'Mata Pelajaran': ex.subject || '-',
            'Judul Ujian': ex.title || '-',
            [`Nilai PG (${ex.weightPg || 50}%)`]: pgVal,
            [`Nilai Esay (${ex.weightEssay || 50}%)`]: essayVal,
            'Nilai Akhir': finalVal
        };
    });

    if (window.XLSX) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Evaluasi CBT");
        
        const max_width = data.reduce((w, r) => Math.max(w, String(r['Nama Siswa'] || '').length), 10);
        worksheet['!cols'] = [
            { wch: 5 }, { wch: 12 }, { wch: Math.max(max_width, 22) }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }
        ];

        XLSX.writeFile(workbook, `Nilai_Evaluasi_CBT_${cls.name}_${ex.subject || 'Ujian'}.xlsx`);
        showToast('File Excel Nilai Evaluasi berhasil diunduh!', 'success');
    } else {
        let csvContent = "data:text/csv;charset=utf-8,No,NIS,Nama Siswa,Kelas,Mata Pelajaran,Judul Ujian,Nilai PG,Nilai Esay,Nilai Akhir,Status Evaluasi\n";
        data.forEach(r => {
            csvContent += `${r['No']},"${r['NIS']}","${r['Nama Siswa']}","${r['Kelas']}","${r['Mata Pelajaran']}","${r['Judul Ujian']}","${r[`Nilai PG (${ex.weightPg || 50}%)`]}","${r[`Nilai Esay (${ex.weightEssay || 50}%)`]}","${r['Nilai Akhir']}","${r['Status Evaluasi']}"\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Nilai_Evaluasi_CBT_${cls.name}_${ex.subject || 'Ujian'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('File CSV Nilai Evaluasi berhasil diunduh!', 'success');
    }
}

window.openImportToHarianModal = function(classId, examId) {
    const cls = appState.classes.find(c => String(c.id) === String(classId));
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!cls || !ex) {
        showToast('Data kelas atau ujian tidak ditemukan!', 'error');
        return;
    }

    const clsStudents = appState.students.filter(st => String(st.classId) === String(classId));
    const grades = JSON.parse(localStorage.getItem('madrasah_student_exam_grades')) || appState.studentExamGrades || {};

    let gradedCount = 0;
    clsStudents.forEach(st => {
        const key1 = st.id + '_' + examId;
        const key2 = String(st.id) + '_' + String(examId);
        const gr = grades[key1] || grades[key2];
        if (gr && (gr.finalScore !== null && gr.finalScore !== undefined || gr.pgScore !== null && gr.pgScore !== undefined)) {
            gradedCount++;
        }
    });

    const defaultTitle = ex.title || `Nilai CBT ${ex.subject || ''}`;
    const defaultSubject = ex.subject || (appState.subjects && appState.subjects[0] ? appState.subjects[0].name : 'Mata Pelajaran');

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                <div class="p-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                            <i class="fa-solid fa-file-import"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-base">Import Nilai Evaluasi ke Nilai Harian</h3>
                            <p class="text-xs text-indigo-100">Kirim nilai hasil ujian secara otomatis ke Rekap Nilai Harian</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-white/80 hover:text-white text-lg cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-6 space-y-4 text-xs text-slate-700">
                    <div class="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl space-y-2">
                        <div class="flex justify-between items-center text-indigo-900 font-semibold">
                            <span><i class="fa-solid fa-users mr-1.5 text-indigo-600"></i> Kelas: <b>${cls.name}</b></span>
                            <span class="bg-indigo-200/80 text-indigo-800 px-2.5 py-1 rounded-xl text-[11px] font-bold">${clsStudents.length} Siswa (${gradedCount} Memiliki Nilai)</span>
                        </div>
                        <p class="text-[11px] text-indigo-700">
                            Nilai akhir dari evaluasi ujian <b>"${ex.title}"</b> akan otomatis dimasukkan ke dalam daftar Penilaian Harian seluruh siswa kelas ${cls.name}.
                        </p>
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Judul Penilaian Harian <span class="text-rose-500">*</span></label>
                        <input type="text" id="import-harian-title" value="${defaultTitle}" placeholder="Contoh: UH 1 Bahasa Indonesia, PH Bab 2, Assesmen Sumatif 1" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <p class="text-[10px] text-slate-400 mt-1">Judul ini akan menjadi nama kolom pada tabel Rekap Nilai Harian / e-Rapor.</p>
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Mata Pelajaran <span class="text-rose-500">*</span></label>
                        <input type="text" id="import-harian-subject" value="${defaultSubject}" placeholder="Contoh: Bahasa Indonesia, Matematika" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                    </div>
                </div>

                <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-100 transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" onclick="confirmImportEvaluasiToHarian('${classId}', '${examId}')" class="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 rounded-2xl transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-check"></i><span>OK / Impor Nilai</span>
                    </button>
                </div>
            </div>
        </div>
    `;
};

window.confirmImportEvaluasiToHarian = async function(classId, examId) {
    const titleInput = document.getElementById('import-harian-title');
    const subjectInput = document.getElementById('import-harian-subject');

    const categoryTitle = titleInput ? titleInput.value.trim() : '';
    const subjectName = subjectInput ? subjectInput.value.trim() : '';

    if (!categoryTitle) {
        showToast('Judul nilai harian tidak boleh kosong!', 'error');
        return;
    }

    const cls = appState.classes.find(c => String(c.id) === String(classId));
    const ex = appState.exams.find(e => String(e.id) === String(examId));
    if (!cls || !ex) {
        showToast('Data kelas atau ujian tidak ditemukan!', 'error');
        return;
    }

    const clsStudents = appState.students.filter(st => String(st.classId) === String(classId));
    const grades = JSON.parse(localStorage.getItem('madrasah_student_exam_grades')) || appState.studentExamGrades || {};

    if (!appState.gradeCategories) {
        appState.gradeCategories = JSON.parse(localStorage.getItem('madrasah_gradeCategories') || localStorage.getItem('madrasah_grade_categories') || '["Harian 1"]');
    }
    if (!appState.gradeCategories.some(c => String(c).toLowerCase() === String(categoryTitle).toLowerCase())) {
        appState.gradeCategories.push(categoryTitle);
        if (typeof saveState === 'function') saveState('gradeCategories');
        safeSetLocalStorage('madrasah_gradeCategories', appState.gradeCategories);
        safeSetLocalStorage('madrasah_grade_categories', appState.gradeCategories);
        try {
            await fetch('/api/grade-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: categoryTitle, gradeCategories: appState.gradeCategories })
            });
        } catch(e) {}
    }

    if (!appState.grades) {
        appState.grades = JSON.parse(localStorage.getItem('madrasah_grades')) || [];
    }

    let count = 0;
    const payloadItems = [];

    clsStudents.forEach(st => {
        const key1 = st.id + '_' + examId;
        const key2 = String(st.id) + '_' + String(examId);
        const gr = grades[key1] || grades[key2];

        let scoreVal = null;
        if (gr && gr.finalScore !== null && gr.finalScore !== undefined) {
            scoreVal = Math.round(Number(gr.finalScore));
        } else if (gr && gr.pgScore !== null && gr.pgScore !== undefined) {
            scoreVal = Math.round(Number(gr.pgScore));
        }

        if (scoreVal !== null && !isNaN(scoreVal)) {
            const finalSubject = subjectName || ex.subject || 'Mata Pelajaran';
            const activeKey = String(classId) + '_' + String(finalSubject);
            
            if (!appState.customGradeColumns) appState.customGradeColumns = {};
            if (!appState.customGradeColumns[activeKey]) appState.customGradeColumns[activeKey] = [];
            if (!appState.customGradeColumns[activeKey].some(c => String(c).toLowerCase() === String(categoryTitle).toLowerCase())) {
                appState.customGradeColumns[activeKey].push(categoryTitle);
                safeSetLocalStorage('madrasah_customGradeColumns', appState.customGradeColumns);
                if (typeof saveState === 'function') saveState('customGradeColumns');
            }

            const existingIdx = appState.grades.findIndex(g => 
                String(g.classId) === String(classId) &&
                (String(g.studentId) === String(st.id) || String(g.studentId) === String(st.nis)) &&
                String(g.subjectName || '').trim().toLowerCase() === String(finalSubject).trim().toLowerCase() &&
                String(g.category || '').trim().toLowerCase() === String(categoryTitle).trim().toLowerCase()
            );

            const gradeObj = {
                id: existingIdx >= 0 ? appState.grades[existingIdx].id : ('GRD_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
                classId: String(classId),
                studentId: String(st.id),
                studentName: st.name,
                className: cls.name,
                subjectName: finalSubject,
                category: categoryTitle,
                score: scoreVal
            };

            if (existingIdx >= 0) {
                appState.grades[existingIdx] = gradeObj;
            } else {
                appState.grades.push(gradeObj);
            }

            payloadItems.push(gradeObj);
            count++;
        }
    });

    if (count === 0) {
        showToast('Tidak ada siswa dengan nilai yang siap diimpor!', 'warning');
        return;
    }

    // Update active class and subject so user immediately sees imported grades in Rekap Nilai
    appState.activeGradeClassId = String(classId);
    appState.activeGradeSubject = subjectName || ex.subject || 'ALL';
    safeSetLocalStorage('madrasah_activeGradeClassId', String(classId));
    safeSetLocalStorage('madrasah_activeGradeSubject', appState.activeGradeSubject);

    safeSetLocalStorage('madrasah_grades', appState.grades);
    if (typeof saveState === 'function') saveState('grades');

    try {
        await fetch('/api/grades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadItems)
        });
    } catch(e) {}

    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';

    showToast(`Berhasil mengimpor ${count} nilai siswa ke Nilai Harian ("${categoryTitle}") untuk ${cls.name}!`, 'success');

    // If currently on grades/nilai view, re-render
    const viewContainer = document.getElementById('view-container');
    if (viewContainer && typeof renderGradesModule === 'function' && appState.currentRoute === 'nilai') {
        renderGradesModule(viewContainer);
    }
};

window._adminPeerConnections = window._adminPeerConnections || {};
window._adminPendingCandidates = window._adminPendingCandidates || {};
window._signalingWs = null;

// Helper to get WebSocket URL for signaling
function getWebSocketUrl() {
    const loc = window.location;
    let new_uri;
    if (loc.protocol === "https:") {
        new_uri = "wss:";
    } else {
        new_uri = "ws:";
    }
    new_uri += "//" + loc.host;
    return new_uri;
}

// Client-side persistent WebSocket signaling manager
window.initSignalingWebSocket = function(clientId, onSignalReceived) {
    if (window._signalingWs && window._signalingWs.readyState === 1) {
        try {
            window._signalingWs.send(JSON.stringify({ type: 'register', clientId: clientId }));
        } catch(e){}
        return;
    }
    
    const wsUrl = getWebSocketUrl();
    console.log(`Connecting to WebRTC Signaling WebSocket: ${wsUrl} for client ${clientId}...`);
    
    try {
        const ws = new WebSocket(wsUrl);
        window._signalingWs = ws;
        
        ws.onopen = () => {
            console.log("WebRTC Signaling WebSocket connected!");
            ws.send(JSON.stringify({ type: 'register', clientId: clientId }));
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'signal') {
                    onSignalReceived(data.senderId, data.signal);
                } else if (data.type === 'exam_progress' || data.type === 'student_heartbeat' || data.type === 'exam_violation' || data.type === 'exam_finish') {
                    if (typeof window.__onExamMonitoringEvent === 'function') {
                        window.__onExamMonitoringEvent(data);
                    }
                }
            } catch (e) {
                console.warn("WebSocket message parse error:", e);
            }
        };
        
        ws.onclose = () => {
            console.log("WebRTC Signaling WebSocket disconnected. Retrying in 4s...");
            setTimeout(() => {
                if (window._signalingWs === ws) {
                    window.initSignalingWebSocket(clientId, onSignalReceived);
                }
            }, 4000);
        };
        
        ws.onerror = (err) => {
            console.warn("WebRTC Signaling WebSocket error:", err);
        };
    } catch (err) {
        console.warn("WebRTC Signaling WebSocket initiation error:", err);
    }
};

// Unified function to send signal using WS (if connected) or HTTP POST (fallback)
function sendSignalingMessage(recipientId, senderId, signal) {
    if (window._signalingWs && window._signalingWs.readyState === 1) {
        try {
            window._signalingWs.send(JSON.stringify({
                type: 'signal',
                recipientId: recipientId,
                senderId: senderId,
                signal: signal
            }));
            return;
        } catch(e) {
            console.warn("Error sending signal over WS, falling back to HTTP", e);
        }
    }
    
    fetch('/api/exam/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: recipientId, senderId: senderId, signal: signal })
    }).catch(e => {});
}

// Requirement 5: Adaptive Bitrate Stats Monitor
async function monitorAndAdaptBandwidth(pc) {
    if (!pc || pc.connectionState !== 'connected') return;
    try {
        const stats = await pc.getStats();
        let currentPacketLoss = 0;
        let rtt = 100; // default safe ms
        
        stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                if (typeof report.currentRoundTripTime === 'number') {
                    rtt = report.currentRoundTripTime * 1000;
                }
            }
            if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
                if (typeof report.packetsLost === 'number') {
                    currentPacketLoss = report.packetsLost;
                }
            }
        });
        
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
            const params = videoSender.getParameters();
            if (params.encodings && params.encodings[0]) {
                const oldBitrate = params.encodings[0].maxBitrate || 300000;
                let newBitrate = oldBitrate;
                
                if (rtt > 250 || currentPacketLoss > 5) {
                    // Poor connection detected -> lower bitrate and framerate
                    newBitrate = Math.max(150000, oldBitrate - 50000);
                    params.encodings[0].maxFramerate = 8;
                    console.warn(`Adaptive Bitrate: Network Congestion! (RTT: ${rtt}ms, Loss: ${currentPacketLoss}). Drop bitrate to ${newBitrate} bps, FPS to 8.`);
                } else if (rtt < 100 && currentPacketLoss === 0) {
                    // Healthy connection -> scale up safely
                    newBitrate = Math.min(400000, oldBitrate + 50000);
                    params.encodings[0].maxFramerate = 12;
                    console.log(`Adaptive Bitrate: Network Healthy! (RTT: ${rtt}ms). Scale bitrate to ${newBitrate} bps, FPS to 12.`);
                }
                
                params.encodings[0].maxBitrate = newBitrate;
                await videoSender.setParameters(params);
            }
        }
    } catch(e) {
        console.warn("Adaptive bitrate check error:", e);
    }
}

// Manual pull & sync for monitoring state
window.refreshMonitoringState = async function(examId, buttonEl) {
    let originalHtml = "";
    if (buttonEl) {
        originalHtml = buttonEl.innerHTML;
        buttonEl.disabled = true;
        buttonEl.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i><span>Menyinkronkan...</span>`;
    }
    try {
        const url = examId ? `/api/exams/${encodeURIComponent(examId)}/monitor` : '/api/exam-monitoring-state';
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
            const students = Array.isArray(data.students) ? data.students : (Array.isArray(data) ? data : []);
            if (students.length > 0 && typeof window.updateStudentMonitoringCard === 'function') {
                students.forEach(item => {
                    window.updateStudentMonitoringCard({
                        type: (item.status === 'completed' || item.status === 'force_finished') ? 'exam_finish' : 'exam_progress',
                        studentId: item.studentId,
                        examId: examId,
                        answered: item.answeredCount !== undefined ? item.answeredCount : item.answered,
                        total: item.totalQuestions !== undefined ? item.totalQuestions : item.total,
                        tabSwitches: item.tabSwitches,
                        autoBlocked: item.blocked,
                        outOfTab: item.outOfTab,
                        lastSeenAt: item.lastSeenAt
                    });
                });
            }
            if (typeof showToast !== 'undefined') {
                showToast('Data monitoring berhasil disinkronkan!', 'success');
            } else if (window.showToast) {
                window.showToast('Data monitoring berhasil disinkronkan!', 'success');
            }
        }
    } catch (e) {
        console.error("Refresh monitoring error:", e);
        if (typeof showToast !== 'undefined') {
            showToast('Gagal melakukan sinkronisasi data!', 'error');
        } else if (window.showToast) {
            window.showToast('Gagal melakukan sinkronisasi data!', 'error');
        }
    } finally {
        if (buttonEl) {
            buttonEl.disabled = false;
            buttonEl.innerHTML = originalHtml;
        }
    }
};

// Background trigger for exposing local IP address by bypassing WebRTC mDNS anonymization
window.triggerAdminCameraPermissionBypass = function() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
            stream.getTracks().forEach(t => t.stop());
            const btn = document.getElementById('admin-bypass-btn');
            if (btn) {
                btn.className = "px-4 py-2.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-bold shadow-md flex items-center space-x-1.5 transition cursor-pointer";
                btn.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>Akses IP Lokal Aktif</span>`;
            }
            showToast('Akses IP Lokal diaktifkan! Koneksi WebRTC lokal kini 100% lancar.', 'success');
        })
        .catch(err => {
            console.warn('Camera permission for local IP bypass denied:', err);
            showToast('Gagal mengaktifkan akses IP Lokal. Berikan izin kamera di browser.', 'error');
        });
};

// Requirement 3: Spotlight HD Livecam Modal Controls
window.focusStudentLivecam = function(studentId) {
    if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
        window.promptVideoDurationAndDeductTokens((minutes) => {
            _executeFocusStudentLivecam(studentId);
        });
    } else {
        _executeFocusStudentLivecam(studentId);
    }
};

function _executeFocusStudentLivecam(studentId) {
    const student = appState.students.find(s => String(s.id) === String(studentId));
    if (!student) return;
    
    let modal = document.getElementById('livecam-focus-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'livecam-focus-modal';
        modal.className = 'fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-6 transition-all opacity-0 pointer-events-none duration-300 overflow-y-auto';
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeStudentLivecamFocus();
            }
        };
        document.body.appendChild(modal);
    }

    if (!window._spotlightKeyHandlerAttached) {
        window._spotlightKeyHandlerAttached = true;
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeStudentLivecamFocus();
            }
        });
    }
    
    modal.innerHTML = `
        <div onclick="event.stopPropagation()" class="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl relative flex flex-col my-auto">
            <!-- Modal Header -->
            <div class="p-4 sm:p-5 border-b border-white/10 flex justify-between items-center bg-slate-950/80 shrink-0 z-10">
                <div class="pr-2">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Spotlight Livecam HD: ${student.name}
                    </h3>
                    <p class="text-[10px] text-slate-400 mt-0.5">Memantau detail aktivitas siswa dengan resolusi tinggi (Simulcast HD)</p>
                </div>
                <button onclick="closeStudentLivecamFocus()" title="Tutup Spotlight" class="w-9 h-9 rounded-full bg-rose-500/20 text-rose-300 hover:bg-rose-600 hover:text-white transition flex items-center justify-center cursor-pointer border border-rose-500/30 shrink-0">
                    <i class="fa-solid fa-xmark text-base"></i>
                </button>
            </div>

            <!-- Video Container -->
            <div class="relative bg-black flex items-center justify-center flex-1 min-h-[250px] max-h-[60vh] overflow-hidden">
                <video id="focus-livecam-video" autoplay playsinline class="w-full h-full max-h-[60vh] object-contain"></video>
                <div id="focus-livecam-loader" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 space-y-3 z-10">
                    <i class="fa-solid fa-spinner fa-spin text-emerald-400 text-3xl"></i>
                    <span class="text-xs text-slate-400">Menghubungkan stream HD...</span>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="p-3 sm:p-4 bg-slate-950/90 border-t border-white/10 flex justify-between items-center text-[10px] text-slate-400 shrink-0 z-10">
                <span class="flex items-center gap-1.5"><i class="fa-solid fa-gauge-high text-emerald-400"></i> Adaptive HD Simulcast Active</span>
                <span id="focus-livecam-stats">Resolusi: -- | FPS: --</span>
            </div>
        </div>
    `;
    
    modal.classList.remove('pointer-events-none', 'opacity-0');
    
    const examId = appState.activeMonitoringExamId;
    const room = window._adminLiveKitRooms ? window._adminLiveKitRooms[examId] : null;
    let bound = false;
    
    if (room && room.state === 'connected') {
        const participant = Array.from(room.participants.values()).find(p => p.identity === `student_${studentId}`);
        if (participant) {
            participant.videoTracks.forEach(pub => {
                if (pub.track) {
                    try {
                        import('livekit-client').then(({ VideoQuality }) => {
                            if (typeof pub.setVideoQuality === 'function') {
                                pub.setVideoQuality(VideoQuality.HIGH);
                                console.log(`Upgraded LiveKit track to HIGH quality for focused student: ${studentId}`);
                            }
                        });
                    } catch(e){}
                    
                    const videoEl = document.getElementById('focus-livecam-video');
                    const loaderEl = document.getElementById('focus-livecam-loader');
                    if (videoEl) {
                        pub.track.attach(videoEl);
                        videoEl.play().catch(e => {});
                        if (loaderEl) loaderEl.style.display = 'none';
                        bound = true;
                        
                        if (window._focusStatsInterval) clearInterval(window._focusStatsInterval);
                        window._focusStatsInterval = setInterval(() => {
                            const statsEl = document.getElementById('focus-livecam-stats');
                            if (!statsEl || !videoEl) {
                                clearInterval(window._focusStatsInterval);
                                return;
                            }
                            if (videoEl.videoWidth > 0) {
                                statsEl.innerText = `Resolusi: ${videoEl.videoWidth}x${videoEl.videoHeight} | FPS: 15 | Codec: VP8`;
                            }
                        }, 2000);
                    }
                }
            });
        }
    }
    
    if (!bound) {
        // Dynamic On-Demand WebRTC P2P initiation
        window._focusedStudentId = String(studentId);
        
        // Close and clean up any existing peer connection to start a fresh connection focused on this spotlight modal
        if (window._adminPeerConnections && window._adminPeerConnections[studentId]) {
            try { window._adminPeerConnections[studentId].close(); } catch(e){}
            delete window._adminPeerConnections[studentId];
        }
        
        // Start WebRTC connection targeted to the focus-livecam-video element
        initAdminWebRTCForStudent(studentId);
        
        const pc = window._adminPeerConnections[studentId];
        if (pc) {
            const oldOnTrack = pc.ontrack;
            pc.ontrack = (event) => {
                if (typeof oldOnTrack === 'function') oldOnTrack(event);
                const loaderEl = document.getElementById('focus-livecam-loader');
                if (loaderEl) loaderEl.style.display = 'none';
                
                const focusVideoEl = document.getElementById('focus-livecam-video');
                if (window._focusStatsInterval) clearInterval(window._focusStatsInterval);
                window._focusStatsInterval = setInterval(() => {
                    const statsEl = document.getElementById('focus-livecam-stats');
                    if (!statsEl || !focusVideoEl) {
                        clearInterval(window._focusStatsInterval);
                        return;
                    }
                    if (focusVideoEl.videoWidth > 0) {
                        statsEl.innerText = `Resolusi: ${focusVideoEl.videoWidth}x${focusVideoEl.videoHeight} | FPS: 15 | Codec: VP8`;
                    }
                }, 2000);
            };
        }
        
        // Fallback snapshot display if WebRTC is slow or failing
        setTimeout(() => {
            const loaderEl = document.getElementById('focus-livecam-loader');
            if (loaderEl && loaderEl.style.display !== 'none') {
                const frames = appState.runtimeLivecamFrames || {};
                const examId = appState.activeMonitoringExamId;
                const snap = frames[studentId + '_' + examId];
                if (snap) {
                    loaderEl.innerHTML = `
                        <img src="${snap}" alt="Focused Snapshot" class="w-full h-full object-cover">
                        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900/90 text-amber-300 border border-amber-500/30 text-[10px] font-bold rounded-full flex items-center space-x-1 shadow-lg">
                            <i class="fa-solid fa-circle-exclamation text-amber-400"></i>
                            <span>Menggunakan Snapshot (WebRTC Menghubungkan...)</span>
                        </div>
                    `;
                } else {
                    loaderEl.innerHTML = `
                        <i class="fa-solid fa-video-slash text-slate-500 text-3xl mb-2"></i>
                        <span class="text-xs text-slate-400">Stream video belum tersedia</span>
                    `;
                }
            }
        }, 4000);
    }
};

window.closeStudentLivecamFocus = function() {
    const modal = document.getElementById('livecam-focus-modal');
    if (modal) {
        modal.classList.add('pointer-events-none', 'opacity-0');
    }
    if (window._focusStatsInterval) {
        clearInterval(window._focusStatsInterval);
        window._focusStatsInterval = null;
    }
    
    const studentId = window._focusedStudentId;
    if (studentId) {
        const examId = appState.activeMonitoringExamId;
        const room = window._adminLiveKitRooms ? window._adminLiveKitRooms[examId] : null;
        if (room && room.state === 'connected') {
            const participant = Array.from(room.participants.values()).find(p => p.identity === `student_${studentId}`);
            if (participant) {
                participant.videoTracks.forEach(pub => {
                    try {
                        import('livekit-client').then(({ VideoQuality }) => {
                            if (typeof pub.setVideoQuality === 'function') {
                                pub.setVideoQuality(VideoQuality.LOW);
                                console.log(`Downgraded LiveKit track to LOW quality for student: ${studentId}`);
                            }
                        });
                    } catch(e){}
                });
            }
        } else {
            // Teardown P2P WebRTC focused stream to save bandwidth and resources on modal close (Poin 13: On-demand)
            if (window._adminPeerConnections && window._adminPeerConnections[studentId]) {
                try {
                    sendSignalingMessage(String(studentId), 'admin', { type: 'stop_stream' });
                    window._adminPeerConnections[studentId].close();
                } catch(e){}
                delete window._adminPeerConnections[studentId];
                console.log(`Successfully torn down P2P connection for student: ${studentId}`);
            }
        }
    }
    window._focusedStudentId = null;
};

// Unified signaling answer & candidate processing
window.handleSingleIncomingSignalForAdmin = async function(studentId, pc, signal) {
    if (signal.type === 'answer') {
        if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            if (window._adminPendingCandidates[studentId]) {
                for (const cand of window._adminPendingCandidates[studentId]) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch(e){}
                }
                window._adminPendingCandidates[studentId] = [];
            }
        }
    } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch(e) {}
        } else {
            window._adminPendingCandidates[studentId] = window._adminPendingCandidates[studentId] || [];
            window._adminPendingCandidates[studentId].push(signal.candidate);
        }
    }
};

window.handleSingleIncomingSignalForStudent = async function(senderId, signal, studentId) {
    // Poin 13: On-Demand Livecam - handle stop_stream when teacher closes spotlight
    if (signal && signal.type === 'stop_stream') {
        if (window._studentPeerConnections && window._studentPeerConnections[senderId]) {
            try { window._studentPeerConnections[senderId].close(); } catch(e){}
            delete window._studentPeerConnections[senderId];
        }
        window.stopStudentSnapshots();
        console.log("Spotlight modal closed by teacher: Video stream stopped on-demand.");
        return;
    }

    window._studentPeerConnections = window._studentPeerConnections || {};
    window._studentPendingCandidates = window._studentPendingCandidates || {};
    let pc = window._studentPeerConnections[senderId];
    
    if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        const s = appState && appState.settings;
        let iceServers = [];
        const disablePublicStun = (s && s.disablePublicStun) || (window.navigator && window.navigator.onLine === false);
        if (!disablePublicStun) {
            iceServers = [
                { urls: 'stun:stun.l.google.com:19302' }, 
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ];
        }
        if (s && s.turnUrl) {
            iceServers.push({
                urls: s.turnUrl,
                username: s.turnUsername || '',
                credential: s.turnCredential || ''
            });
        }

        pc = new RTCPeerConnection({ iceServers: iceServers });
        window._studentPeerConnections[senderId] = pc;
        window._studentPendingCandidates[senderId] = [];

        // Start rapid 3s snapshots during the connecting phase
        window.startStudentConnectingSnapshots();

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignalingMessage(senderId, String(studentId), { type: 'candidate', candidate: event.candidate });
            }
        };

        // Requirement 6: ICE Restart + Reconnect bertahap
        pc.oniceconnectionstatechange = () => {
            console.log(`Student ICE connection state: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                console.log("Student WebRTC live video successfully connected! Stopping all snapshots for bandwidth efficiency.");
                window.stopStudentSnapshots();
            } else if (pc.iceConnectionState === 'disconnected') {
                console.warn(`Student P2P: ICE disconnected. Initiating ICE restart & fallback snapshots...`);
                window.startStudentConnectingSnapshots();
                try {
                    pc.restartIce();
                } catch(e){}
            } else if (pc.iceConnectionState === 'failed') {
                console.warn(`Student P2P: ICE failed. Reconnecting P2P channel & starting fallback snapshots...`);
                window.startStudentConnectingSnapshots();
                setTimeout(() => {
                    if (window._studentPeerConnections[senderId] === pc) {
                        try { pc.close(); } catch(e){}
                        delete window._studentPeerConnections[senderId];
                    }
                }, 4000);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`Student overall connection state: ${pc.connectionState}`);
            if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                console.log("WebRTC connection closed. Ensuring snapshots are stopped.");
                window.stopStudentSnapshots();
            }
        };

        // Setup adaptive bitrate loop
        if (window._studentAdaptiveBitrateIntervals === undefined) {
            window._studentAdaptiveBitrateIntervals = {};
        }
        if (window._studentAdaptiveBitrateIntervals[senderId]) {
            clearInterval(window._studentAdaptiveBitrateIntervals[senderId]);
        }
        window._studentAdaptiveBitrateIntervals[senderId] = setInterval(() => {
            if (window._studentPeerConnections[senderId] === pc) {
                monitorAndAdaptBandwidth(pc);
            } else {
                clearInterval(window._studentAdaptiveBitrateIntervals[senderId]);
            }
        }, 5000);
    }

    if (window.__studentWebcamStream) {
        const currentSenders = pc.getSenders();
        window.__studentWebcamStream.getTracks().forEach(track => {
            const exists = currentSenders.some(s => s.track === track);
            if (!exists) {
                try { 
                    const sender = pc.addTrack(track, window.__studentWebcamStream); 
                    // Requirement 4: Set initial P2P bitrate to 200-400 kbps (300kbps)
                    if (track.kind === 'video') {
                        setTimeout(() => {
                            try {
                                const params = sender.getParameters();
                                if (!params.encodings) params.encodings = [{}];
                                params.encodings[0].maxBitrate = 300000;
                                sender.setParameters(params);
                                console.log("Set P2P video maxBitrate to 300kbps");
                            } catch(e){}
                        }, 500);
                    }
                } catch(e){}
            }
        });
    }

    if (signal.type === 'offer') {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignalingMessage(senderId, String(studentId), pc.localDescription);

            if (window._studentPendingCandidates[senderId]) {
                for (const cand of window._studentPendingCandidates[senderId]) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch(e){}
                }
                window._studentPendingCandidates[senderId] = [];
            }
        } catch(e) {
            console.warn('WebRTC offer handling err:', e);
        }
    } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch(e) {}
        } else {
            window._studentPendingCandidates[senderId] = window._studentPendingCandidates[senderId] || [];
            window._studentPendingCandidates[senderId].push(signal.candidate);
        }
    }
};

function initAdminWebRTCForStudent(studentId) {
    let videoEl = document.getElementById(`webrtc-video-${studentId}`);
    const isFocused = window._focusedStudentId === String(studentId);
    if (isFocused) {
        const focusVideoEl = document.getElementById('focus-livecam-video');
        if (focusVideoEl) {
            videoEl = focusVideoEl;
        }
    }
    if (!videoEl) return;

    if (window._adminPeerConnections[studentId]) {
        const existingPc = window._adminPeerConnections[studentId];
        const state = existingPc.connectionState;
        const iceState = existingPc.iceConnectionState;
        if (state === 'failed' || state === 'closed' || iceState === 'failed') {
            try { existingPc.close(); } catch(e){}
            delete window._adminPeerConnections[studentId];
        } else {
            return;
        }
    }

    window._adminPendingCandidates[studentId] = [];
    
    // Requirement 2: Robust ICE Servers + optional custom TURN
    const s = appState && appState.settings;
    let iceServers = [];
    const disablePublicStun = (s && s.disablePublicStun) || (window.navigator && window.navigator.onLine === false);
    if (!disablePublicStun) {
        iceServers = [
            { urls: 'stun:stun.l.google.com:19302' }, 
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ];
    }
    if (s && s.turnUrl) {
        iceServers.push({
            urls: s.turnUrl,
            username: s.turnUsername || '',
            credential: s.turnCredential || ''
        });
    }

    const pc = new RTCPeerConnection({ iceServers: iceServers });
    window._adminPeerConnections[studentId] = pc;

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    let connected = false;
    pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
            connected = true;
            videoEl.srcObject = event.streams[0];
            videoEl.play().catch(e => {});
            
            // Also update webrtc-video on grid if we are in focused mode, just in case
            if (isFocused) {
                const gridVideo = document.getElementById(`webrtc-video-${studentId}`);
                if (gridVideo) {
                    gridVideo.srcObject = event.streams[0];
                    gridVideo.play().catch(e => {});
                }
            }
            
            const fallbackEl = document.getElementById(`webrtc-fallback-${studentId}`);
            if (fallbackEl) fallbackEl.style.opacity = '0';
            
            const focusLoader = document.getElementById('focus-livecam-loader');
            if (focusLoader) focusLoader.style.display = 'none';
        }
    };

    // Requirement 6: ICE Restart + reconnect bertahap
    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            connected = true;
            const fallbackEl = document.getElementById(`webrtc-fallback-${studentId}`);
            if (fallbackEl) fallbackEl.style.opacity = '0';
            const focusLoader = document.getElementById('focus-livecam-loader');
            if (focusLoader) focusLoader.style.display = 'none';
        } else if (pc.iceConnectionState === 'disconnected') {
            console.warn(`ICE Connection disconnected for student ${studentId}. Initiating ICE Restart...`);
            try {
                pc.restartIce();
                pc.createOffer({ iceRestart: true }).then(async offer => {
                    await pc.setLocalDescription(offer);
                    sendSignalingMessage(String(studentId), 'admin', pc.localDescription);
                }).catch(e => {});
            } catch(e) {
                console.warn("ICE restart failed:", e);
            }
        } else if (pc.iceConnectionState === 'failed') {
            console.warn(`ICE Connection failed for student ${studentId}. Reconnecting in 3s...`);
            setTimeout(() => {
                if (window._adminPeerConnections[studentId] === pc) {
                    try { pc.close(); } catch(e){}
                    delete window._adminPeerConnections[studentId];
                    initAdminWebRTCForStudent(studentId);
                }
            }, 3000);
        }
    };

    setTimeout(() => {
        if (!connected) {
            const fallbackEl = document.getElementById(`webrtc-fallback-${studentId}`);
            if (fallbackEl) {
                const frames = appState.runtimeLivecamFrames || {};
                const examId = appState.activeMonitoringExamId;
                const snap = frames[studentId + '_' + examId];
                if (snap) {
                    fallbackEl.innerHTML = `
                        <img src="${snap}" alt="Live Snapshot" class="w-full h-full object-cover">
                        <div class="absolute top-2 right-2 px-2 py-0.5 bg-emerald-600/90 text-white text-[9px] font-bold rounded-full flex items-center space-x-1 shadow animate-pulse">
                            <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                            <span>SNAPSHOT LIVE</span>
                        </div>
                    `;
                    fallbackEl.style.opacity = '1';
                }
            }
        }
    }, 3000);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignalingMessage(String(studentId), 'admin', { type: 'candidate', candidate: event.candidate });
        }
    };

    pc.createOffer().then(async offer => {
        await pc.setLocalDescription(offer);
        sendSignalingMessage(String(studentId), 'admin', pc.localDescription);
    }).catch(e => {});

    const pollInterval = setInterval(() => {
        const checkEl = document.getElementById(`webrtc-video-${studentId}`);
        if (!checkEl) {
            clearInterval(pollInterval);
            if (window._adminPeerConnections[studentId]) {
                try { window._adminPeerConnections[studentId].close(); } catch(e){}
                delete window._adminPeerConnections[studentId];
            }
            return;
        }

        if (!connected) {
            const frames = appState.runtimeLivecamFrames || {};
            const examId = appState.activeMonitoringExamId;
            const snap = frames[studentId + '_' + examId];
            const fallbackEl = document.getElementById(`webrtc-fallback-${studentId}`);
            if (snap && fallbackEl && fallbackEl.querySelector('img') === null) {
                fallbackEl.innerHTML = `
                    <img src="${snap}" alt="Live Snapshot" class="w-full h-full object-cover">
                    <div class="absolute top-2 right-2 px-2 py-0.5 bg-emerald-600/90 text-white text-[9px] font-bold rounded-full flex items-center space-x-1 shadow animate-pulse">
                        <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                        <span>SNAPSHOT LIVE</span>
                    </div>
                `;
            }
        }

        // Only do poll fallback if WebSocket connection is not active
        if (!window._signalingWs || window._signalingWs.readyState !== 1) {
            fetch(`/api/exam/signaling?recipientId=admin&senderId=${String(studentId)}`)
                .then(res => res.json())
                .then(async data => {
                    if (data.success && data.signals && data.signals.length > 0) {
                        for (const item of data.signals) {
                            await window.handleSingleIncomingSignalForAdmin(studentId, pc, item.signal);
                        }
                    }
                }).catch(e => {});
        }
    }, 1500);
}

window._adminLiveKitRooms = window._adminLiveKitRooms || {};

function isLiveKitConfigured() {
    const s = appState && appState.settings;
    if (!s) return false;
    const url = s.livekitUrl || '';
    const key = s.livekitApiKey || '';
    return url.trim() !== '' && !url.includes('localhost') && !url.includes('127.0.0.1') && key.trim() !== '';
}

async function startAdminLiveKit(examId) {
    if (!isLiveKitConfigured()) {
        return;
    }
    try {
        const roomName = `room_exam_${examId}`;
        
        if (window._adminLiveKitRooms && window._adminLiveKitRooms[examId]) {
            return;
        }
        
        console.log(`Admin connecting to LiveKit room: ${roomName}...`);
        const response = await fetch('/api/exam/livekit-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomName: roomName,
                identity: 'admin_' + Math.floor(Math.random() * 100000),
                isPublisher: false
            })
        });
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || "Gagal mendapatkan token LiveKit untuk admin");
        }
        
        const { token, serverUrl } = data;
        const { Room, RoomEvent, VideoQuality } = await import('livekit-client');
        
        const room = new Room();
        window._adminLiveKitRooms = window._adminLiveKitRooms || {};
        window._adminLiveKitRooms[examId] = room;
        
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log(`Subscribed to track ${track.sid} from participant ${participant.identity}`);
            const identity = participant.identity;
            if (identity.startsWith('student_')) {
                const studentId = identity.replace('student_', '');
                
                // Requirement 3: Admin Grid default quality LOW for Simulcast
                if (publication && typeof publication.setVideoQuality === 'function') {
                    publication.setVideoQuality(VideoQuality.LOW);
                    console.log(`LiveKit Simulcast: Subscribed to ${participant.identity} with LOW quality`);
                }

                setTimeout(() => {
                    const videoEl = document.getElementById(`webrtc-video-${studentId}`);
                    if (videoEl) {
                        track.attach(videoEl);
                        videoEl.play().catch(e => {});
                        const fallbackEl = document.getElementById(`webrtc-fallback-${studentId}`);
                        if (fallbackEl) fallbackEl.style.opacity = '0';
                        console.log(`Successfully bound LiveKit track to student video box: ${studentId}`);
                    }
                }, 300);
            }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            const identity = participant.identity;
            if (identity.startsWith('student_')) {
                const studentId = identity.replace('student_', '');
                const videoEl = document.getElementById(`webrtc-video-${studentId}`);
                if (videoEl) {
                    track.detach(videoEl);
                }
            }
        });
        
        await room.connect(serverUrl, token);
        console.log("Admin connected to LiveKit SFU room:", roomName);
        
        room.participants.forEach((participant) => {
            participant.videoTracks.forEach((pub) => {
                if (pub.track && pub.isSubscribed) {
                    const identity = participant.identity;
                    if (identity.startsWith('student_')) {
                        const studentId = identity.replace('student_', '');
                        
                        // Requirement 3: Admin Grid default quality LOW for Simulcast
                        if (typeof pub.setVideoQuality === 'function') {
                            pub.setVideoQuality(VideoQuality.LOW);
                        }

                        setTimeout(() => {
                            const videoEl = document.getElementById(`webrtc-video-${studentId}`);
                            if (videoEl) {
                                pub.track.attach(videoEl);
                                videoEl.play().catch(e => {});
                                const fallbackEl = document.getElementById(`webrtc-fallback-${studentId}`);
                                if (fallbackEl) fallbackEl.style.opacity = '0';
                            }
                        }, 300);
                    }
                }
            });
        });
        
    } catch (err) {
        const isCancelled = err && (err.name === "ConnectionError" || (err.message && (err.message.includes("Cancelled") || err.message.includes("abort"))));
        if (isCancelled) {
            console.log("LiveKit subscriber connection aborted gracefully.");
        } else {
            console.warn("LiveKit subscriber connection error:", err);
        }
        if (window._adminLiveKitRooms && window._adminLiveKitRooms[examId]) {
            const r = window._adminLiveKitRooms[examId];
            if (r && r.state !== 'disconnected') {
                try { r.disconnect(); } catch(e){}
            }
            delete window._adminLiveKitRooms[examId];
        }
    }
}

function stopAdminLiveKit(examId) {
    if (window._adminLiveKitRooms && window._adminLiveKitRooms[examId]) {
        const room = window._adminLiveKitRooms[examId];
        delete window._adminLiveKitRooms[examId];
        try { 
            if (room.state !== 'disconnected') {
                room.disconnect(); 
            }
        } catch(e){}
        console.log(`Admin disconnected from LiveKit room for exam: ${examId}`);
    }
}

window._studentLiveKitRoom = null;

async function startStudentLiveKit(examId, studentId) {
    if (!isLiveKitConfigured()) {
        return;
    }
    if (!window.__studentWebcamStream) {
        console.warn("No active webcam stream to publish to LiveKit.");
        return;
    }
    
    try {
        console.log("Requesting LiveKit token for student...");
        const roomName = `room_exam_${examId}`;
        const response = await fetch('/api/exam/livekit-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomName: roomName,
                identity: `student_${studentId}`,
                isPublisher: true
            })
        });
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || "Gagal mendapatkan token LiveKit");
        }
        
        const { token, serverUrl } = data;
        const { Room } = await import('livekit-client');
        
        if (window._studentLiveKitRoom) {
            const prevRoom = window._studentLiveKitRoom;
            window._studentLiveKitRoom = null;
            try { 
                if (prevRoom.state !== 'disconnected') {
                    await prevRoom.disconnect(); 
                }
            } catch(e){}
        }
        
        const room = new Room();
        window._studentLiveKitRoom = room;
        
        await room.connect(serverUrl, token);
        console.log("Connected to LiveKit SFU room:", roomName);
        
        const videoTrack = window.__studentWebcamStream.getVideoTracks()[0];
        if (videoTrack) {
            await room.localParticipant.publishTrack(videoTrack, {
                simulcast: true,
                videoCodec: 'vp8',
                videoEncoding: {
                    maxBitrate: 300000, // 300 kbps
                    maxFramerate: 12
                }
            });
            console.log("Successfully published student camera track to LiveKit SFU with Simulcast + Bitrate (300kbps) enabled!");
        }
    } catch (err) {
        const isCancelled = err && (err.name === "ConnectionError" || (err.message && (err.message.includes("Cancelled") || err.message.includes("abort"))));
        if (isCancelled) {
            console.log("LiveKit publisher connection aborted gracefully.");
        } else {
            console.warn("LiveKit publisher connection error:", err);
        }
        if (window._studentLiveKitRoom) {
            const r = window._studentLiveKitRoom;
            window._studentLiveKitRoom = null;
            try { 
                if (r.state !== 'disconnected') {
                    r.disconnect(); 
                }
            } catch(e){}
        }
    }
}

function stopStudentLiveKit() {
    if (window._studentLiveKitRoom) {
        const room = window._studentLiveKitRoom;
        window._studentLiveKitRoom = null;
        try { 
            if (room.state !== 'disconnected') {
                room.disconnect(); 
            }
        } catch(e){}
        console.log("Disconnected student from LiveKit room.");
    }
}

setInterval(() => {
    if (appState.lastAssessmentSubTab === 'monitoring' && appState.activeMonitoringExamId) {
        // Always initiate Admin LiveKit SFU room
        startAdminLiveKit(appState.activeMonitoringExamId);
        
        // Connect admin to the signaling WebSocket if LiveKit is NOT configured (P2P mode)
        if (!isLiveKitConfigured()) {
            window.initSignalingWebSocket('admin', (senderId, signal) => {
                const pc = window._adminPeerConnections && window._adminPeerConnections[senderId];
                if (pc) {
                    window.handleSingleIncomingSignalForAdmin(senderId, pc, signal);
                }
            });
        }
        
        document.querySelectorAll('[id^="webrtc-video-"]').forEach(vid => {
            const sId = vid.id.replace('webrtc-video-', '');
            const room = window._adminLiveKitRooms ? window._adminLiveKitRooms[appState.activeMonitoringExamId] : null;
            let connectedViaLiveKit = false;

            if (room && room.state === 'connected') {
                const participant = Array.from(room.participants.values()).find(p => p.identity === `student_${sId}`);
                if (participant) {
                    participant.videoTracks.forEach(pub => {
                        if (pub.track && pub.isSubscribed) {
                            if (vid.srcObject !== pub.track.mediaStream) {
                                pub.track.attach(vid);
                                vid.play().catch(e => {});
                            }
                            connectedViaLiveKit = true;
                            const fallbackEl = document.getElementById(`webrtc-fallback-${sId}`);
                            if (fallbackEl) fallbackEl.style.opacity = '0';
                        }
                    });
                }
            }

            if (!connectedViaLiveKit && !isLiveKitConfigured()) {
                // If LiveKit is not active/configured for this student, initialize WebRTC P2P fallback
                if (!window._adminPeerConnections || !window._adminPeerConnections[sId]) {
                    initAdminWebRTCForStudent(sId);
                } else {
                    const pc = window._adminPeerConnections[sId];
                    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                        initAdminWebRTCForStudent(sId);
                    }
                }

                const fallbackEl = document.getElementById(`webrtc-fallback-${sId}`);
                if (fallbackEl) {
                    const pc = window._adminPeerConnections && window._adminPeerConnections[sId];
                    const isP2PConnected = pc && (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed');
                    if (isP2PConnected) {
                        fallbackEl.style.opacity = '0';
                    } else {
                        const frames = appState.runtimeLivecamFrames || {};
                        const snap = frames[sId + '_' + appState.activeMonitoringExamId];
                        const stObj = (appState.students || []).find(s => String(s.id) === String(sId));
                        const attRec = stObj ? (appState.attendance || []).slice().reverse().find(a => String(a.studentId || a.student_id) === String(stObj.id) || (stObj.nis && String(a.nis) === String(stObj.nis))) : null;
                        const attPhoto = attRec ? (attRec.photo || attRec.imageUrl || attRec.facePhoto || attRec.photoUrl || attRec.image) : null;
                        const fallbackPhoto = snap || attPhoto || (stObj ? (stObj.photo || stObj.facePhoto || stObj.image || stObj.avatar) : null);
                        
                        fallbackEl.style.opacity = '1';
                        if (fallbackPhoto) {
                            fallbackEl.innerHTML = `
                                <img src="${fallbackPhoto}" alt="Snapshot" class="w-full h-full object-cover opacity-80">
                                <div class="absolute inset-0 bg-slate-950/40"></div>
                                <div class="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900/85 backdrop-blur-md text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-full flex items-center space-x-1.5 shadow-lg">
                                    <i class="fa-solid fa-circle-notch fa-spin text-emerald-400"></i>
                                    <span>Menghubungkan Video Live...</span>
                                </div>
                            `;
                        }
                    }
                }
            }
        });
    } else {
        if (window._adminLiveKitRooms) {
            Object.keys(window._adminLiveKitRooms).forEach(examId => {
                stopAdminLiveKit(examId);
            });
        }
    }
}, 3000);

function downloadStudentExamPDF(examId) {
    if (!window.jspdf) {
        showToast('Library PDF belum siap.', 'error');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const st = appState.currentUser || {};
    const ex = (appState.exams || []).find(e => String(e.id) === String(examId));
    if (!ex) {
        showToast('Jadwal ujian tidak ditemukan.', 'error');
        return;
    }

    const key1 = st.id + '_' + ex.id;
    const key2 = String(st.id) + '_' + String(ex.id);
    const grades = appState.studentExamGrades || {};
    const gr = grades[key1] || grades[key2] || {};
    
    const answers = (appState.studentExamAnswers && (appState.studentExamAnswers[key1] || appState.studentExamAnswers[key2])) || {};
    const questions = getExamQuestions(ex, st.id);

    // Header Sekolah / Madrasah
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129); // Emerald-600
    doc.text((appState.settings?.schoolName || 'MADRASAH ALIYAH BISA').toUpperCase(), 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Laporan Hasil Ujian CBT Siswa", 14, 25);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 28, 196, 28);

    // Detail Siswa & Ujian
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont("helvetica", "bold");
    doc.text("INFORMASI PESERTA & UJIAN", 14, 35);
    
    doc.setFont("helvetica", "normal");
    doc.text("Nama Siswa:", 14, 42);
    doc.setFont("helvetica", "bold");
    doc.text(String(st.name || '-'), 45, 42);

    doc.setFont("helvetica", "normal");
    doc.text("NISN / ID:", 14, 48);
    doc.setFont("helvetica", "bold");
    doc.text(String(st.username || st.id || '-'), 45, 48);

    doc.setFont("helvetica", "normal");
    doc.text("Mata Pelajaran:", 14, 54);
    doc.setFont("helvetica", "bold");
    doc.text(String(ex.subject || '-'), 45, 54);

    doc.setFont("helvetica", "normal");
    doc.text("Nama Ujian:", 105, 42);
    doc.setFont("helvetica", "bold");
    doc.text(String(ex.title || '-'), 135, 42);

    doc.setFont("helvetica", "normal");
    doc.text("Tanggal Ujian:", 105, 48);
    doc.setFont("helvetica", "bold");
    doc.text(String(ex.date || '-'), 135, 48);

    doc.setFont("helvetica", "normal");
    doc.text("Nilai Ujian:", 105, 54);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38); // red-600
    const finalScoreStr = gr.finalScore !== null && gr.finalScore !== undefined ? String(gr.finalScore) : 'Sedang Dikoreksi';
    doc.text(finalScoreStr, 135, 54);

    doc.setTextColor(51, 65, 85); // reset slate-700
    doc.line(14, 60, 196, 60);

    // List of questions and answers
    doc.setFont("helvetica", "bold");
    doc.text("DAFTAR SOAL, KUNCI JAWABAN, DAN JAWABAN SISWA", 14, 68);
    
    let y = 75;
    const pageHeight = doc.internal.pageSize.height;

    questions.forEach((q, idx) => {
        if (!q) return;
        
        // Calculate estimated height needed for this question block
        const rawQuestionText = String(q.question || '').replace(/<[^>]*>/g, ''); // strip HTML tags
        const questionLines = doc.splitTextToSize(`${idx + 1}. ${rawQuestionText}`, 175);
        
        const userAns = answers[q.id] !== undefined ? answers[q.id] : (answers[String(q.id)] || '-');
        const correctAns = String(q.answer || '-');
        
        const userAnsLines = doc.splitTextToSize(`Jawaban Siswa: ${userAns}`, 175);
        const correctAnsLines = doc.splitTextToSize(`Kunci Jawaban: ${correctAns}`, 175);
        
        const explanationText = q.explanation ? String(q.explanation) : 'Tidak ada penjelasan.';
        const explanationLines = doc.splitTextToSize(`Penjelasan: ${explanationText}`, 175);
        
        let blockHeight = (questionLines.length * 5) + (userAnsLines.length * 5) + (correctAnsLines.length * 5) + (explanationLines.length * 5) + 12;

        if (q.options && Array.isArray(q.options) && q.options.length > 0) {
            q.options.forEach(opt => {
                const optLines = doc.splitTextToSize(`  - ${opt}`, 170);
                blockHeight += (optLines.length * 4.5);
            });
        }

        // Check page overflow
        if (y + blockHeight > pageHeight - 15) {
            doc.addPage();
            y = 20; // reset y
        }

        // Draw a light grey background card border for each question block
        doc.setDrawColor(241, 245, 249); // slate-100
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(13, y - 4, 184, blockHeight, "F");
        
        // Write Soal
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59); // slate-800
        questionLines.forEach(line => {
            doc.text(line, 15, y);
            y += 5;
        });

        // Write Options if MC
        if (q.options && Array.isArray(q.options) && q.options.length > 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105); // slate-600
            q.options.forEach((opt, oIdx) => {
                const optLetter = ['A', 'B', 'C', 'D', 'E'][oIdx] || '';
                const optLines = doc.splitTextToSize(`  [ ${optLetter} ]  ${opt}`, 170);
                optLines.forEach(optLine => {
                    doc.text(optLine, 18, y);
                    y += 4.5;
                });
            });
        }

        y += 1.5;

        // Write User Answer
        doc.setFontSize(9);
        const isCorrect = q.type === 'esay' || q.type === 'essay' ? null : isCorrectAnswer(q, userAns);
        
        doc.setFont("helvetica", "bold");
        if (isCorrect === true) {
            doc.setTextColor(16, 185, 129); // emerald-600 (Correct)
            doc.text(`Jawaban Anda: ${userAns} (Benar)`, 15, y);
        } else if (isCorrect === false) {
            doc.setTextColor(220, 38, 38); // red-600 (Incorrect)
            doc.text(`Jawaban Anda: ${userAns} (Salah)`, 15, y);
        } else {
            doc.setTextColor(202, 138, 4); // yellow-600 (Essay - Needs Grading)
            doc.text(`Jawaban Anda: ${userAns}`, 15, y);
        }
        y += 4.5;

        // Write Correct Answer
        doc.setFont("helvetica", "bold");
        doc.setTextColor(79, 70, 229); // indigo-600
        doc.text(`Kunci Jawaban: ${correctAns}`, 15, y);
        y += 4.5;

        // Write Explanation
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 116, 139); // slate-500
        explanationLines.forEach((line, lIdx) => {
            if (lIdx === 0) {
                const prefix = "Penjelasan: ";
                doc.text(prefix + (q.explanation || 'Tidak ada penjelasan.'), 15, y);
            } else {
                doc.text(line, 15, y);
            }
            y += 4.5;
        });

        y += 6; // Spacing between blocks
    });

    const safeTitle = String(ex.title).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`hasil_ujian_${safeTitle}_${st.name || 'siswa'}.pdf`);
    showToast('Laporan hasil ujian berhasil didownload!', 'success');
}

// Automatically expose functions and state to window for global inline handlers
Object.assign(window, {
  renderAssessmentModule,
  openExamModal,
  renderExamModalForm,
  addExamClass,
  removeExamClass,
  renderExamClassChips,
  toggleCustomWeight,
  saveExam,
  deleteExam,
  renderStudentCBTList,
  startStudentExam,
  renderActiveExamScreen,
  saveExamAnswer,
  selectExamOption,
  nextExamQuestion,
  prevExamQuestion,
  submitExamFinal,
  toggleLivecamMode,
  toggleStudentLivecamMode,
  downloadStudentExamPDF,
  toggleStudentLivecamMode,
  openRoomModal,
  saveRoom,
  deleteRoom,
  openManageRoomModal,
  addStudentToRoom,
  removeStudentFromRoom,
  downloadRoomTemplate,
  handleRoomExcelImport,
  toggleBlockStudent,
  openSendMessageModal,
  sendStudentExamMessage,
  openBroadcastMessageModal,
  sendBroadcastExamMessage,
  dismissStudentExamMessage,
  onMonitoringFilterChange,
  toggleEvaluasiSelectForm,
  onEvaluasiFilterChange,
  filterEvaluasiStudentTable,
  ensureEvaluasiDataPopulated,
  openKoreksiModal,
  saveKoreksi,
  refreshEvaluasiData,
  runAutoKoreksiAI,
  runAutoKoreksiNonAI,
  runSingleStudentAutoKoreksiNonAI,
  generateNilaiEvaluasi,
  resetStudentExam,
  adminForceSubmitExam,
  confirmAdminForceSubmitExam,
  stopEvaluasiPolling,
  startEvaluasiPolling,
  confirmStudentExamSubmit,
  openCetakJawabanModal,
  updatePrintSetting,
  generateReportHTML,
  openDownloadPreviewModal,
  printHTML,
  triggerDirectPrint,
  cetakNilaiEvaluasi,
  exportNilaiExcelEvaluasi,
  openImportToHarianModal,
  confirmImportEvaluasiToHarian,
  cetakJawabanEvaluasi,
  initAdminWebRTCForStudent
});


function ensureEventHarian() {
    if (!appState.exams) appState.exams = [];
    
    let harianEvent = appState.exams.find(e => e.recordType === 'EVENT' && (e.id === 'EV_HARIAN' || String(e.title || '').toLowerCase().includes('harian')));
    if (!harianEvent) {
        harianEvent = {
            id: 'EV_HARIAN',
            recordType: 'EVENT',
            title: 'Event Harian',
            description: 'Kelompok jadwal ujian harian & asesmen reguler',
            createdAt: new Date().toISOString()
        };
        appState.exams.unshift(harianEvent);
    }
    
    let updated = false;
    const validEventIds = new Set(appState.exams.filter(e => e.recordType === 'EVENT').map(e => String(e.id)));
    
    appState.exams.forEach(ex => {
        if (ex.recordType !== 'EVENT') {
            if (!ex.eventId || !validEventIds.has(String(ex.eventId))) {
                ex.eventId = harianEvent.id;
                updated = true;
            }
        }
    });
    
    if (updated) {
        saveState('exams');
        fetch('/api/exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appState.exams)
        }).catch(err => console.warn('Error syncing exams API:', err));
    }
}
window.ensureEventHarian = ensureEventHarian;

function openEventManagement(eventId) {
    appState.assessmentEventId = eventId;
    renderAssessmentModule(document.getElementById('view-container'), 'jadwal', null);
}

function openEventModal(editId = null) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    
    let ev = null;
    if (editId) {
        ev = (appState.exams || []).find(e => String(e.id) === String(editId) && e.recordType === 'EVENT');
    }
    
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800">${ev ? 'Edit Event Ujian' : 'Buat Event Ujian'}</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark"></i></button></div>
                <form onsubmit="saveEvent(event)" class="space-y-3 text-sm">
                    <input type="hidden" id="ev-edit-id" value="${editId || ''}">
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Nama Event</label>
                        <input type="text" id="ev-title" value="${ev ? ev.title : ''}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" placeholder="Contoh: Ujian Tengah Semester Genap">
                    </div>
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Deskripsi (Opsional)</label>
                        <textarea id="ev-desc" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" rows="3" placeholder="Contoh: Event untuk seluruh ujian mapel di UTS genap">${ev ? (ev.description || '') : ''}</textarea>
                    </div>
                    <div class="pt-2">
                        <button type="submit" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow transition">Simpan Event</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function saveEvent(e) {
    e.preventDefault();
    const editId = document.getElementById('ev-edit-id').value;
    const title = document.getElementById('ev-title').value;
    const desc = document.getElementById('ev-desc').value;
    
    if (!appState.exams) appState.exams = [];
    
    if (editId) {
        const idx = appState.exams.findIndex(ex => String(ex.id) === String(editId));
        if (idx !== -1) {
            appState.exams[idx].title = title;
            appState.exams[idx].description = desc;
        }
    } else {
        appState.exams.push({
            id: 'EV' + Date.now(),
            recordType: 'EVENT',
            title: title,
            description: desc,
            createdAt: new Date().toISOString()
        });
    }
    
    saveState('exams');
    fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appState.exams)
    }).catch(err => console.warn('Error syncing exams API:', err));
    
    closeModal();
    renderAssessmentModule(document.getElementById('view-container'), 'jadwal', null);
}

window.openEventManagement = openEventManagement;
window.openEventModal = openEventModal;
window.saveEvent = saveEvent;

function getAttendanceSettings() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem('madrasah_attendance_settings') || '{}');
    } catch(e) {}
    
    const settings = appState.settings || {};
    return {
        kopLine1: saved?.kopLine1 || settings.kopLine1 || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
        kopLine2: saved?.kopLine2 || settings.schoolName || 'MADRASAH ALIYAH / TSANAWIYAH',
        kopLine3: saved?.kopLine3 || (settings.schoolAddress ? settings.schoolAddress + (settings.schoolPhone ? ' | Telp: ' + settings.schoolPhone : '') : 'Status Terakreditasi A - Portal CBT Madrasah'),
        docTitle: saved?.docTitle || 'DAFTAR HADIR PESERTA ASESMEN / UJIAN',
        subTitle: saved?.subTitle || ('TAHUN AJARAN ' + (settings.academicYear || '2025/2026')),
        examEvent: saved?.examEvent || 'Asesmen Madrasah Berbasis Komputer (CBT)',
        examSession: saved?.examSession || 'Sesi 1 (07:30 - 09:30 WIB)',
        examDate: saved?.examDate || new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        subjectName: saved?.subjectName || '',
        showLogo: saved?.showLogo !== undefined ? saved.showLogo : true,
        logoUrl: saved?.logoUrl || (window.kartuPesertaConfig?.logoKiri || ''),
        supervisorName: saved?.supervisorName || (appState.currentUser?.name || 'Pengawas Ruang, S.Pd'),
        supervisorNip: saved?.supervisorNip || '19800101 200501 1 001',
        supervisor2Name: saved?.supervisor2Name || '',
        supervisor2Nip: saved?.supervisor2Nip || '',
        proctorName: saved?.proctorName || 'Proktor CBT, S.Kom',
        proctorNip: saved?.proctorNip || '19850202 201001 1 002',
        cityDate: saved?.cityDate || ((settings.city || 'Madrasah') + ', ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }))
    };
}

function saveAttendanceSettingsFromUI() {
    const config = {
        kopLine1: document.getElementById('att-kop1')?.value || '',
        kopLine2: document.getElementById('att-kop2')?.value || '',
        kopLine3: document.getElementById('att-kop3')?.value || '',
        docTitle: document.getElementById('att-doc-title')?.value || '',
        subTitle: document.getElementById('att-sub-title')?.value || '',
        examEvent: document.getElementById('att-exam-event')?.value || '',
        examSession: document.getElementById('att-session')?.value || '',
        examDate: document.getElementById('att-exam-date')?.value || '',
        subjectName: document.getElementById('att-subject')?.value || '',
        showLogo: document.getElementById('att-show-logo')?.checked ?? true,
        logoUrl: document.getElementById('att-logo-url')?.value || '',
        supervisorName: document.getElementById('att-spv-name')?.value || '',
        supervisorNip: document.getElementById('att-spv-nip')?.value || '',
        supervisor2Name: document.getElementById('att-spv2-name')?.value || '',
        supervisor2Nip: document.getElementById('att-spv2-nip')?.value || '',
        proctorName: document.getElementById('att-proctor-name')?.value || '',
        proctorNip: document.getElementById('att-proctor-nip')?.value || '',
        cityDate: document.getElementById('att-city-date')?.value || ''
    };
    
    safeSetStorage('madrasah_attendance_settings', config);
    return config;
}

function handleAttendanceLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const base64 = evt.target.result;
        const inputUrl = document.getElementById('att-logo-url');
        if (inputUrl) inputUrl.value = base64;
        const preview = document.getElementById('att-logo-preview');
        if (preview) {
            preview.src = base64;
            preview.classList.remove('hidden');
        }
        showToast('Logo berhasil diunggah!', 'success');
    };
    reader.readAsDataURL(file);
}

function openAttendanceModal(roomId) {
    const room = (appState.rooms || []).find(r => String(r.id) === String(roomId));
    if (!room) {
        showToast('Ruang ujian tidak ditemukan.', 'error');
        return;
    }

    const config = getAttendanceSettings();
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    
    const subjects = appState.subjects || [];

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-6 space-y-5 my-6 max-h-[92vh] overflow-y-auto">
                <div class="flex justify-between items-center border-b pb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
                            <i class="fa-solid fa-print"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-base sm:text-lg">Pengaturan Cetak Daftar Hadir Ujian</h3>
                            <p class="text-xs text-slate-400">Ruang: <b class="text-slate-700">${room.name}</b> (${(room.members || []).length} Anggota Peserta)</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs sm:text-sm">
                    <!-- KOLOM 1: KOP & IDENTITAS MADRASAH -->
                    <div class="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3.5">
                        <div class="flex items-center justify-between border-b pb-2">
                            <h4 class="font-bold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-2">
                                <i class="fa-solid fa-landmark text-emerald-600"></i> Kop & Identitas Madrasah
                            </h4>
                            <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                                <input type="checkbox" id="att-show-logo" class="rounded accent-emerald-600" ${config.showLogo ? 'checked' : ''}>
                                <span>Tampilkan Logo</span>
                            </label>
                        </div>

                        <div>
                            <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Logo Kop Surat</label>
                            <div class="flex items-center gap-3">
                                <div class="w-14 h-14 rounded-2xl border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                                    <img id="att-logo-preview" src="${config.logoUrl || ''}" class="${config.logoUrl ? '' : 'hidden'} w-full h-full object-contain p-1" alt="Logo">
                                    <i id="att-logo-placeholder" class="${config.logoUrl ? 'hidden' : ''} fa-solid fa-image text-slate-300 text-xl"></i>
                                </div>
                                <div class="flex-1 space-y-1.5">
                                    <input type="file" accept="image/*" onchange="handleAttendanceLogoUpload(event)" class="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer">
                                    <input type="text" id="att-logo-url" value="${config.logoUrl || ''}" placeholder="Atau tempel URL / Base64 logo..." class="w-full px-3 py-1.5 bg-white border rounded-xl text-xs">
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Kop Baris 1 (Instansi / Yayasan)</label>
                            <input type="text" id="att-kop1" value="${config.kopLine1}" class="w-full px-3.5 py-2 bg-white border rounded-xl font-semibold">
                        </div>

                        <div>
                            <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Kop Baris 2 (Nama Madrasah / Satuan)</label>
                            <input type="text" id="att-kop2" value="${config.kopLine2}" class="w-full px-3.5 py-2 bg-white border rounded-xl font-bold text-emerald-800">
                        </div>

                        <div>
                            <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Kop Baris 3 (Alamat / Kontak / Akreditasi)</label>
                            <input type="text" id="att-kop3" value="${config.kopLine3}" class="w-full px-3.5 py-2 bg-white border rounded-xl text-xs">
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Judul Dokumen</label>
                                <input type="text" id="att-doc-title" value="${config.docTitle}" class="w-full px-3 py-2 bg-white border rounded-xl font-bold text-xs">
                            </div>
                            <div>
                                <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Sub Judul / TP</label>
                                <input type="text" id="att-sub-title" value="${config.subTitle}" class="w-full px-3 py-2 bg-white border rounded-xl font-bold text-xs">
                            </div>
                        </div>
                    </div>

                    <!-- KOLOM 2: INFORMASI UJIAN & TANDA TANGAN -->
                    <div class="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3.5">
                        <div class="border-b pb-2">
                            <h4 class="font-bold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-2">
                                <i class="fa-solid fa-file-pen text-indigo-600"></i> Informasi Pelaksanaan & Tanda Tangan
                            </h4>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Kegiatan / Asesmen</label>
                                <input type="text" id="att-exam-event" value="${config.examEvent}" class="w-full px-3.5 py-2 bg-white border rounded-xl">
                            </div>
                            <div>
                                <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Sesi / Waktu</label>
                                <input type="text" id="att-session" value="${config.examSession}" class="w-full px-3.5 py-2 bg-white border rounded-xl">
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Mata Pelajaran</label>
                                <div class="relative">
                                    <input type="text" id="att-subject" list="att-subject-list" value="${config.subjectName}" placeholder="Pilih / Ketik Mapel..." class="w-full px-3.5 py-2 bg-white border rounded-xl font-semibold">
                                    <datalist id="att-subject-list">
                                        ${subjects.map(s => `<option value="${s.name}">`).join('')}
                                    </datalist>
                                </div>
                            </div>
                            <div>
                                <label class="block text-[11px] uppercase font-bold text-slate-500 mb-1">Hari & Tanggal</label>
                                <input type="text" id="att-exam-date" value="${config.examDate}" class="w-full px-3.5 py-2 bg-white border rounded-xl font-medium">
                            </div>
                        </div>

                        <div class="border-t pt-2 mt-2 space-y-2.5">
                            <div class="flex items-center justify-between">
                                <span class="font-bold text-slate-700 text-xs uppercase"><i class="fa-solid fa-signature text-amber-600"></i> Pengawas & Proktor</span>
                                <input type="text" id="att-city-date" value="${config.cityDate}" placeholder="Kota, Tanggal..." class="text-right text-xs bg-transparent border-b border-dashed border-slate-400 font-semibold px-1 py-0.5 focus:outline-none">
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div class="space-y-1">
                                    <label class="block text-[10px] uppercase font-bold text-slate-500">Nama Pengawas 1</label>
                                    <input type="text" id="att-spv-name" value="${config.supervisorName}" class="w-full px-3 py-1.5 bg-white border rounded-xl font-semibold text-xs" placeholder="Nama Lengkap & Gelar">
                                    <input type="text" id="att-spv-nip" value="${config.supervisorNip}" class="w-full px-3 py-1.5 bg-white border rounded-xl text-xs" placeholder="NIP / NIK Pengawas">
                                </div>
                                <div class="space-y-1">
                                    <label class="block text-[10px] uppercase font-bold text-slate-500">Nama Proktor CBT</label>
                                    <input type="text" id="att-proctor-name" value="${config.proctorName}" class="w-full px-3 py-1.5 bg-white border rounded-xl font-semibold text-xs" placeholder="Nama Proktor & Gelar">
                                    <input type="text" id="att-proctor-nip" value="${config.proctorNip}" class="w-full px-3 py-1.5 bg-white border rounded-xl text-xs" placeholder="NIP / NIK Proktor">
                                </div>
                            </div>

                            <div class="space-y-1 pt-1">
                                <label class="block text-[10px] uppercase font-bold text-slate-400">Pengawas 2 (Opsional)</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <input type="text" id="att-spv2-name" value="${config.supervisor2Name}" class="w-full px-3 py-1.5 bg-white border rounded-xl text-xs" placeholder="Nama Pengawas 2">
                                    <input type="text" id="att-spv2-nip" value="${config.supervisor2Nip}" class="w-full px-3 py-1.5 bg-white border rounded-xl text-xs" placeholder="NIP Pengawas 2">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TOMBOL AKSI CETAK & UNDUH -->
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
                    <button type="button" onclick="saveAttendanceSettingsFromUI(); showToast('Pengaturan berhasil disimpan!', 'success');" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition flex items-center gap-2">
                        <i class="fa-solid fa-floppy-disk"></i> <span>Simpan Pengaturan</span>
                    </button>
                    <div class="flex items-center gap-2.5 w-full sm:w-auto">
                        <button type="button" onclick="downloadAttendanceDocx('${roomId}')" class="flex-1 sm:flex-none px-5 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-2xl text-xs shadow-md transition flex items-center justify-center gap-2">
                            <i class="fa-solid fa-file-word"></i> <span>Unduh Word (.doc)</span>
                        </button>
                        <button type="button" onclick="printAttendanceSheet('${roomId}')" class="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2">
                            <i class="fa-solid fa-print"></i> <span>Cetak / Print Langsung (A4)</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateAttendanceHTML(roomId, isWord = false) {
    const room = (appState.rooms || []).find(r => String(r.id) === String(roomId));
    if (!room) return '';

    const config = saveAttendanceSettingsFromUI();
    const members = room.members || [];
    
    let membersHtml = '';
    if (members.length > 0) {
        members.forEach((memberId, idx) => {
            const st = (appState.students || []).find(s => String(s.id) === String(memberId));
            const num = idx + 1;
            const isOdd = num % 2 !== 0;
            const nis = st ? (st.nis || st.username || '-') : '-';
            const name = st ? (st.name || '-') : 'Peserta ' + memberId;
            const className = st ? (st.className || (appState.classes || []).find(c => String(c.id) === String(st.classId))?.name || '-') : '-';

            membersHtml += `
                <tr style="height: 36px;">
                    <td style="border: 1px solid #000; padding: 5px 3px; text-align: center; font-size: 10pt;">${num}</td>
                    <td style="border: 1px solid #000; padding: 5px 6px; text-align: center; font-family: monospace; font-size: 10pt; font-weight: bold;">${nis}</td>
                    <td style="border: 1px solid #000; padding: 5px 6px; font-size: 10pt; text-transform: uppercase;">${name}</td>
                    <td style="border: 1px solid #000; padding: 5px 6px; text-align: center; font-size: 10pt;">${className}</td>
                    <td style="border: 1px solid #000; padding: 4px 6px; font-size: 9pt; width: 100px; vertical-align: middle;">
                        ${isOdd ? `${num}. ............` : ''}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px 6px; font-size: 9pt; width: 100px; vertical-align: middle;">
                        ${!isOdd ? `${num}. ............` : ''}
                    </td>
                    <td style="border: 1px solid #000; padding: 4px 4px; text-align: center; font-size: 9pt; width: 45px;"></td>
                </tr>
            `;
        });
    } else {
        membersHtml = `<tr><td colspan="7" style="border: 1px solid #000; padding: 12px; text-align: center; font-style: italic;">Belum ada peserta yang terdaftar di ruang ini</td></tr>`;
    }

    const logoHtml = (config.showLogo && config.logoUrl) ? `
        <div style="width: 80px; text-align: center; flex-shrink: 0;">
            <img src="${config.logoUrl}" style="max-height: 70px; max-width: 75px; object-fit: contain;" alt="Logo" />
        </div>
    ` : `<div style="width: 50px;"></div>`;

    const html = `
        <div class="attendance-print-page" style="font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; padding: 20px; max-width: 850px; margin: 0 auto; line-height: 1.25;">
            <!-- KOP -->
            <table style="width: 100%; border: none; border-bottom: 3px double #000; padding-bottom: 6px; margin-bottom: 10px;">
                <tr>
                    <td style="width: 80px; text-align: center; vertical-align: middle;">
                        ${(config.showLogo && config.logoUrl) ? `<img src="${config.logoUrl}" style="max-height: 70px; max-width: 75px;" alt="Logo" />` : ''}
                    </td>
                    <td style="text-align: center; vertical-align: middle; padding: 0 10px;">
                        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 0;">${config.kopLine1}</div>
                        <div style="font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 2px 0;">${config.kopLine2}</div>
                        <div style="font-size: 8.5pt; font-style: italic; color: #222; margin: 0;">${config.kopLine3}</div>
                    </td>
                    <td style="width: 80px;"></td>
                </tr>
            </table>

            <!-- JUDUL -->
            <div style="text-align: center; margin-bottom: 12px;">
                <h3 style="font-size: 13pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin: 0;">${config.docTitle}</h3>
                <div style="font-size: 10.5pt; font-weight: bold; text-transform: uppercase; margin-top: 2px;">${config.subTitle}</div>
            </div>

            <!-- META INFO -->
            <table style="width: 100%; border: none; font-size: 10pt; margin-bottom: 10px; line-height: 1.35;">
                <tr>
                    <td style="width: 17%; font-weight: bold;">Satuan Pendidikan</td>
                    <td style="width: 2%;">:</td>
                    <td style="width: 41%; font-weight: bold;">${config.kopLine2}</td>
                    <td style="width: 16%; font-weight: bold;">Ruang Ujian</td>
                    <td style="width: 2%;">:</td>
                    <td style="width: 22%; font-weight: bold;">${room.name}</td>
                </tr>
                <tr>
                    <td>Kegiatan / Asesmen</td>
                    <td>:</td>
                    <td>${config.examEvent}</td>
                    <td>Sesi / Waktu</td>
                    <td>:</td>
                    <td>${config.examSession}</td>
                </tr>
                <tr>
                    <td>Mata Pelajaran</td>
                    <td>:</td>
                    <td style="font-weight: bold;">${config.subjectName || '-'}</td>
                    <td>Hari / Tanggal</td>
                    <td>:</td>
                    <td>${config.examDate}</td>
                </tr>
            </table>

            <!-- TABEL PESERTA -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10pt;">
                <thead>
                    <tr style="background-color: #f2f2f2; text-align: center; font-weight: bold; height: 30px;">
                        <th style="border: 1px solid #000; padding: 5px 3px; width: 5%;">No</th>
                        <th style="border: 1px solid #000; padding: 5px 6px; width: 17%;">No. Peserta / NIS</th>
                        <th style="border: 1px solid #000; padding: 5px 6px; width: 35%;">Nama Lengkap Siswa</th>
                        <th style="border: 1px solid #000; padding: 5px 6px; width: 12%;">Kelas</th>
                        <th style="border: 1px solid #000; padding: 5px 6px; width: 23%;" colspan="2">Tanda Tangan</th>
                        <th style="border: 1px solid #000; padding: 5px 3px; width: 8%;">Ket.</th>
                    </tr>
                </thead>
                <tbody>
                    ${membersHtml}
                </tbody>
            </table>

            <!-- REKAPITULASI -->
            <div style="font-size: 9pt; margin-bottom: 16px; border: 1px solid #000; padding: 6px 10px;">
                <b>Rekapitulasi:</b> Total Peserta: <b>${members.length}</b> Siswa &nbsp;|&nbsp; Jumlah Hadir: ......... Orang &nbsp;|&nbsp; Jumlah Tidak Hadir: ......... Orang
            </div>

            <!-- TANDA TANGAN -->
            <table style="width: 100%; border: none; font-size: 10pt; margin-top: 10px; page-break-inside: avoid;">
                <tr>
                    <td style="width: 50%; text-align: center; vertical-align: top;">
                        <p style="margin: 0;">Mengetahui / Memverifikasi,</p>
                        <p style="margin: 2px 0 0 0; font-weight: bold;">Proktor CBT Ruang</p>
                        <div style="height: 60px;"></div>
                        <p style="margin: 0; font-weight: bold; text-decoration: underline;">( ${config.proctorName || '...........................................'} )</p>
                        <p style="margin: 2px 0 0 0; font-size: 9pt;">NIP: ${config.proctorNip || '-'}</p>
                    </td>
                    <td style="width: 50%; text-align: center; vertical-align: top;">
                        <p style="margin: 0;">${config.cityDate}</p>
                        <p style="margin: 2px 0 0 0; font-weight: bold;">Pengawas Ruang Ujian</p>
                        <div style="height: 60px;"></div>
                        <p style="margin: 0; font-weight: bold; text-decoration: underline;">( ${config.supervisorName || '...........................................'} )</p>
                        <p style="margin: 2px 0 0 0; font-size: 9pt;">NIP: ${config.supervisorNip || '-'}</p>
                        ${config.supervisor2Name ? `
                            <div style="margin-top: 10px;">
                                <p style="margin: 0; font-weight: bold; text-decoration: underline;">( ${config.supervisor2Name} )</p>
                                <p style="margin: 2px 0 0 0; font-size: 9pt;">NIP: ${config.supervisor2Nip || '-'}</p>
                            </div>
                        ` : ''}
                    </td>
                </tr>
            </table>
        </div>
    `;

    return html;
}

function printAttendanceSheet(roomId) {
    const htmlContent = generateAttendanceHTML(roomId, false);
    if (!htmlContent) return;

    const printSectionId = 'print-attendance-section';
    const printStyleId = 'print-attendance-style';
    
    const oldSection = document.getElementById(printSectionId);
    if (oldSection) oldSection.remove();
    const oldStyle = document.getElementById(printStyleId);
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = printStyleId;
    style.innerHTML = `
        @media print {
            body > *:not(#${printSectionId}) {
                display: none !important;
            }
            #${printSectionId} {
                display: block !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
                color: black !important;
                padding: 10px !important;
            }
            @page {
                size: A4 portrait;
                margin: 1.2cm;
            }
        }
    `;
    document.head.appendChild(style);

    const printSection = document.createElement('div');
    printSection.id = printSectionId;
    printSection.innerHTML = htmlContent;
    document.body.appendChild(printSection);

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            printSection.remove();
            style.remove();
        }, 1500);
    }, 300);
}

function downloadAttendanceDocx(roomId) {
    const room = (appState.rooms || []).find(r => String(r.id) === String(roomId));
    if (!room) return;

    const bodyHtml = generateAttendanceHTML(roomId, true);
    const fullHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Daftar Hadir - ${room.name}</title>
            <style>
                @page {
                    size: 21.0cm 29.7cm;
                    margin: 1.5cm 1.5cm 1.5cm 1.5cm;
                }
                body {
                    font-family: 'Times New Roman', Times, serif;
                }
                table {
                    border-collapse: collapse;
                }
            </style>
        </head>
        <body>
            ${bodyHtml}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', fullHtml], {
        type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Daftar_Hadir_${room.name.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('Daftar Hadir Word (.doc) berhasil diunduh.', 'success');
}

window.openAttendanceModal = openAttendanceModal;
window.handleAttendanceLogoUpload = handleAttendanceLogoUpload;
window.saveAttendanceSettingsFromUI = saveAttendanceSettingsFromUI;
window.printAttendanceSheet = printAttendanceSheet;
window.downloadAttendanceDocx = downloadAttendanceDocx;

// Poin 11: Event-Driven Real-Time Surgical Monitoring Card Updates
window.updateStudentMonitoringCard = function(event) {
    if (!event || !event.studentId) return;
    const stId = String(event.studentId);
    const cardEl = document.getElementById(`monitor-card-${stId}`);
    if (!cardEl) return;

    if (event.type === 'exam_progress') {
        const answered = Number(event.answered || 0);
        const total = Number(event.total || 1);
        const pct = Math.min(100, Math.round((answered / total) * 100));

        const progressContainer = document.getElementById(`monitor-progress-${stId}`);
        if (progressContainer) {
            progressContainer.innerHTML = `
                <div class="w-full">
                    <div class="w-full bg-slate-950/80 border border-white/10 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-emerald-400 h-full transition-all duration-300" style="width: ${pct}%"></div>
                    </div>
                    <div class="text-[9px] text-slate-300 mt-1 flex justify-between font-mono">
                        <span>${pct}%</span>
                        <span>Terjawab: ${answered}/${total}</span>
                    </div>
                </div>
            `;
        }
        const statusBadge = document.getElementById(`monitor-status-icon-${stId}`);
        if (statusBadge) {
            statusBadge.className = 'monitor-status-badge w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg backdrop-blur-md bg-emerald-500 text-slate-900 font-bold animate-pulse border border-emerald-300';
            statusBadge.innerHTML = '<i class="fa-solid fa-circle-dot"></i>';
            statusBadge.title = 'Aktif Mengerjakan';
        }
    } else if (event.type === 'student_heartbeat') {
        const hbDot = document.getElementById(`monitor-hb-${stId}`);
        if (hbDot) {
            hbDot.classList.remove('opacity-30');
            hbDot.classList.add('opacity-100', 'scale-125');
            setTimeout(() => {
                if (hbDot) hbDot.classList.remove('scale-125');
            }, 300);
        }
    } else if (event.type === 'exam_violation') {
        const tabSwitches = Number(event.tabSwitches || 1);
        const cornerBadges = document.getElementById(`monitor-corner-${stId}`);
        if (cornerBadges) {
            let tabBadge = document.getElementById(`monitor-tab-badge-${stId}`);
            if (!tabBadge) {
                tabBadge = document.createElement('span');
                tabBadge.id = `monitor-tab-badge-${stId}`;
                cornerBadges.insertBefore(tabBadge, cornerBadges.firstChild);
            }
            tabBadge.className = 'w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-lg animate-pulse backdrop-blur-md border border-rose-400';
            tabBadge.title = `Keluar Tab (${tabSwitches}x)`;
            tabBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        }
        if (event.autoBlocked) {
            cardEl.classList.remove('border-slate-800');
            cardEl.classList.add('border-rose-500', 'ring-2', 'ring-rose-500/30');
            const filler = document.getElementById(`monitor-blocked-filler-${stId}`);
            if (filler) {
                filler.innerHTML = '<span class="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-full shadow-lg border border-rose-400">Diblokir</span>';
            }
        }
    } else if (event.type === 'exam_finish') {
        const progressContainer = document.getElementById(`monitor-progress-${stId}`);
        if (progressContainer) {
            progressContainer.innerHTML = `
                <div class="w-full">
                    <div class="w-full bg-slate-950/80 border border-white/10 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-emerald-500 h-full w-full"></div>
                    </div>
                    <div class="text-[9px] text-emerald-400 mt-1 text-center font-bold">100% Selesai</div>
                </div>
            `;
        }
        const statusBadge = document.getElementById(`monitor-status-icon-${stId}`);
        if (statusBadge) {
            statusBadge.className = 'monitor-status-badge w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg backdrop-blur-md bg-emerald-800 text-emerald-200';
            statusBadge.innerHTML = '<i class="fa-solid fa-check"></i>';
            statusBadge.title = 'Selesai';
        }
        const actions = document.getElementById(`monitor-actions-${stId}`);
        if (actions) {
            const ffBtn = actions.querySelector('button[title*="Force Finish"]');
            if (ffBtn) ffBtn.remove();
        }
    }
};

