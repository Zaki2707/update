const fs = require('fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function replaceOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`PATCH_MISSING:${label}`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`PATCH_AMBIGUOUS:${label}`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}
function replaceRegexOnce(text, re, to, label) {
  let count = 0;
  const out = text.replace(re, (...args) => { count++; return typeof to === 'function' ? to(...args) : to; });
  if (count !== 1) throw new Error(`PATCH_${count === 0 ? 'MISSING' : 'AMBIGUOUS'}:${label}:${count}`);
  return out;
}

let server = read('server.ts');

// ---------------------------------------------------------------------------
// 1) Centralize teacher scope for LKPD/grades and student LKPD class access.
// ---------------------------------------------------------------------------
const examsForRequest = `function examsForRequest(req: any): any[] {
  const tenantExams = filterByMadrasah(exams || [], req);
  return isTeacherRequest(req)
    ? tenantExams.filter((exam: any) => teacherCanUseExamPayload(req, exam))
    : tenantExams;
}
`;
const scopedHelpers = `${examsForRequest}
// TEACHER_MONITOR_SCOPE_V2: all academic monitoring/sync paths reuse the same assignment boundary.
function teacherCanUseLkpdPayload(req: any, lkpdPayload: any): boolean {
  if (!isTeacherRequest(req)) return true;
  if (!lkpdPayload || typeof lkpdPayload !== 'object') return false;
  const subjectRef = lkpdPayload.subjectId || lkpdPayload.subjectName || lkpdPayload.subject;
  return Boolean(subjectRef && teacherCanAccessSubjectRef(req, subjectRef));
}

function lkpdsForRequest(req: any): any[] {
  const tenantLkpds = filterByMadrasah(lkpdList || [], req);
  return isTeacherRequest(req)
    ? tenantLkpds.filter((lkpd: any) => teacherCanUseLkpdPayload(req, lkpd))
    : tenantLkpds;
}

function gradePayloadAllowedForTeacher(req: any, gradePayload: any): boolean {
  if (!isTeacherRequest(req)) return true;
  if (!gradePayload || typeof gradePayload !== 'object') return false;
  const subjectRef = gradePayload.subjectId || gradePayload.subjectName || gradePayload.subject;
  return Boolean(subjectRef && teacherCanAccessSubjectRef(req, subjectRef));
}

function studentCanAccessLkpd(student: any, lkpd: any): boolean {
  if (!student || !lkpd) return false;
  const targets = Array.isArray(lkpd.classes)
    ? lkpd.classes.map((value: any) => String(value))
    : [lkpd.classId, lkpd.class_id, lkpd.className].filter(Boolean).map((value: any) => String(value));
  if (targets.length === 0 || targets.some((value: string) => value.toUpperCase() === 'ALL')) return true;
  const studentClasses = [student.classId, student.class_id, student.className, student.class]
    .filter(Boolean).map((value: any) => String(value));
  return targets.some((target: string) => studentClasses.includes(target));
}
`;
server = replaceOnce(server, examsForRequest, scopedHelpers, 'teacher-scope-helpers');

// ---------------------------------------------------------------------------
// 2) Replace LKPD merge with server-authoritative student submission writes.
// ---------------------------------------------------------------------------
const hardenedLkpdMerge = `function mergeLkpdListDataSmart(globalList: any[], incomingData: any[], req: any): any[] {
  if (!Array.isArray(incomingData)) return Array.isArray(globalList) ? globalList : [];
  if (!Array.isArray(globalList)) globalList = [];

  const authenticatedUser = req.user || getAuthUser(req);
  const userRole = String(authenticatedUser?.role || 'student').trim().toLowerCase();
  const isStudent = ['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(userRole);
  const isTeacher = ['teacher', 'guru'].includes(userRole);
  const currentSchoolExisting = globalList.filter(item => isItemForCurrentMadrasah(item, req));
  const otherItems = globalList.filter(item => !isItemForCurrentMadrasah(item, req));
  if (incomingData.length === 0) return globalList;

  const existingMap = new Map<string, any>();
  for (const item of currentSchoolExisting) {
    if (item?.id !== undefined && item?.id !== null) existingMap.set(String(item.id), { ...item });
  }
  const mergedItemsMap = new Map(existingMap);
  const authenticatedStudent = isStudent
    ? (students || []).find((item: any) => String(item.id) === String(authenticatedUser?.id || '') && isItemForCurrentMadrasah(item, req))
    : null;

  for (const rawIncoming of incomingData) {
    if (!rawIncoming || typeof rawIncoming !== 'object' || Array.isArray(rawIncoming) || rawIncoming.id === undefined || rawIncoming.id === null) continue;
    const clean = { ...rawIncoming };
    delete clean.madrasahId;
    delete clean.madrasahSlug;
    const incomingItem = tagNewRecord(clean, req);
    const key = String(incomingItem.id);
    const existing = existingMap.get(key);

    if (isStudent) {
      // LKPD_STUDENT_SUBMISSION_WRITE_SCOPE: students can only submit answers for their own targeted LKPD.
      if (!existing || !authenticatedStudent || !studentCanAccessLkpd(authenticatedStudent, existing)) continue;
      const incomingSubs = Array.isArray(incomingItem.submissions) ? incomingItem.submissions : [];
      const ownIncoming = incomingSubs.find((sub: any) => String(sub?.studentId || '') === String(authenticatedUser.id));
      if (!ownIncoming) continue;

      const existingSubs = Array.isArray(existing.submissions) ? existing.submissions : [];
      const existingOwn = existingSubs.find((sub: any) => String(sub?.studentId || '') === String(authenticatedUser.id));
      const markerIds = new Set((Array.isArray(existing.markers) ? existing.markers : []).map((m: any) => String(m?.id || '')).filter(Boolean));
      const rawAnswers = ownIncoming.answers && typeof ownIncoming.answers === 'object' && !Array.isArray(ownIncoming.answers) ? ownIncoming.answers : {};
      const safeAnswers: Record<string, any> = {};
      let answerCount = 0;
      for (const [answerKey, answerValue] of Object.entries(rawAnswers)) {
        if (answerCount >= 1000 || !markerIds.has(String(answerKey))) continue;
        const value = String(answerValue ?? '');
        if (Buffer.byteLength(value, 'utf8') > 64 * 1024) continue;
        safeAnswers[String(answerKey)] = value;
        answerCount++;
      }

      const classRecord = (classes || []).find((c: any) =>
        isItemForCurrentMadrasah(c, req) &&
        [authenticatedStudent.classId, authenticatedStudent.class_id].filter(Boolean).some((id: any) => String(c.id) === String(id))
      );
      const safeSubmission = {
        ...(existingOwn || {}),
        studentId: String(authenticatedStudent.id),
        studentName: authenticatedStudent.name || existingOwn?.studentName || '',
        nis: authenticatedStudent.nis || existingOwn?.nis || '',
        classId: authenticatedStudent.classId || authenticatedStudent.class_id || existingOwn?.classId || existing.classId || '',
        className: classRecord?.name || authenticatedStudent.className || existingOwn?.className || existing.className || '',
        submittedAt: existingOwn?.submittedAt || new Date().toISOString(),
        answers: { ...(existingOwn?.answers || {}), ...safeAnswers },
        // Grading fields are always server/teacher authoritative.
        scores: existingOwn?.scores || {},
        feedback: existingOwn?.feedback || {},
        totalScore: Number(existingOwn?.totalScore || 0),
        isGraded: existingOwn?.isGraded === true,
        gradedBy: existingOwn?.gradedBy || '',
        gradedAt: existingOwn?.gradedAt || ''
      };
      const nextSubs = existingSubs.filter((sub: any) => String(sub?.studentId || '') !== String(authenticatedUser.id));
      nextSubs.push(safeSubmission);
      mergedItemsMap.set(key, { ...existing, submissions: nextSubs });
      continue;
    }

    if (isTeacher && !teacherCanUseLkpdPayload(req, existing ? { ...existing, ...incomingItem } : incomingItem)) {
      continue;
    }

    if (!existing) {
      mergedItemsMap.set(key, incomingItem);
      continue;
    }

    const mergedSubmissionsMap = new Map<string, any>();
    for (const sub of (Array.isArray(existing.submissions) ? existing.submissions : [])) {
      if (sub?.studentId) mergedSubmissionsMap.set(String(sub.studentId), sub);
    }
    for (const sub of (Array.isArray(incomingItem.submissions) ? incomingItem.submissions : [])) {
      if (!sub?.studentId) continue;
      const existingSub = mergedSubmissionsMap.get(String(sub.studentId));
      mergedSubmissionsMap.set(String(sub.studentId), existingSub ? {
        ...existingSub,
        ...sub,
        answers: { ...(existingSub.answers || {}), ...(sub.answers || {}) },
        scores: { ...(existingSub.scores || {}), ...(sub.scores || {}) },
        feedback: { ...(existingSub.feedback || {}), ...(sub.feedback || {}) }
      } : sub);
    }
    mergedItemsMap.set(key, { ...existing, ...incomingItem, submissions: Array.from(mergedSubmissionsMap.values()) });
  }

  // Preserve omitted LKPDs that the actor is not authorized to delete.
  if (isStudent || isTeacher) {
    for (const existing of currentSchoolExisting) {
      if (!existing?.id) continue;
      if (isStudent || !teacherCanUseLkpdPayload(req, existing)) {
        mergedItemsMap.set(String(existing.id), existing);
      }
    }
  }

  return [...otherItems, ...Array.from(mergedItemsMap.values())];
}
`;
server = replaceRegexOnce(
  server,
  /function mergeLkpdListDataSmart\(globalList: any\[\], incomingData: any\[\], req: any\): any\[\] \{[\s\S]*?\n\}\n\n\/\/ 3\. Teachers API/,
  hardenedLkpdMerge + '\n// 3. Teachers API',
  'harden-lkpd-merge'
);

// ---------------------------------------------------------------------------
// 3) Reuse class access helper in dedicated LKPD student context.
// ---------------------------------------------------------------------------
server = replaceRegexOnce(
  server,
  /  const student = studentMatches\[0\];\n  const lkpd = lkpdMatches\[0\];\n  const targets = Array\.isArray\(lkpd\.classes\)[\s\S]*?\n  return \{ student, lkpd, studentId \};/,
  `  const student = studentMatches[0];\n  const lkpd = lkpdMatches[0];\n  if (!studentCanAccessLkpd(student, lkpd)) {\n    return { error: { status: 403, message: 'Siswa tidak terdaftar pada kelas sasaran LKPD ini.' } };\n  }\n  return { student, lkpd, studentId };`,
  'dedupe-lkpd-class-access'
);

// ---------------------------------------------------------------------------
// 4) Actor-aware monitoring scope for both exam and LKPD legacy state keys.
// ---------------------------------------------------------------------------
const candidateMarker = `function lkpdStateCandidateKeys(req: any, studentId: any, lkpdId: any): string[] {
  return Array.from(new Set([
    lkpdStateKey(req, studentId, lkpdId),
    ...lkpdLegacyStateKeysForRequest(req, studentId, lkpdId)
  ]));
}
`;
const monitoringHelpers = `${candidateMarker}
function monitoringStateKeyAllowedForActor(req: any, rawKey: string): boolean {
  const raw = String(rawKey || '');
  const role = String((req.user || getAuthUser(req))?.role || '').toLowerCase();
  const teacher = role === 'teacher' || role === 'guru';
  const examAllowed = (examId: string) => {
    const item = (exams || []).find((candidate: any) => String(candidate.id) === String(examId) && isItemForCurrentMadrasah(candidate, req));
    return Boolean(item && (!teacher || teacherCanUseExamPayload(req, item)));
  };
  const lkpdAllowed = (lkpdId: string) => {
    const item = (lkpdList || []).find((candidate: any) => String(candidate.id) === String(lkpdId) && isItemForCurrentMadrasah(candidate, req));
    return Boolean(item && (!teacher || teacherCanUseLkpdPayload(req, item)));
  };

  const parsedExam = parseExamStateKeyForRequest(req, raw);
  if (parsedExam) return examAllowed(parsedExam.examId);
  const parsedLkpd = parseLkpdStateKeyForRequest(req, raw);
  if (parsedLkpd) return lkpdAllowed(parsedLkpd.lkpdId);

  const examBcast = parseNamespacedExamBroadcastKey(raw);
  if (examBcast) return canonicalRealtimeTenant(examBcast.tenant) === examStateTenant(req, undefined, examBcast.examId) && examAllowed(examBcast.examId);
  const lkpdBcast = parseNamespacedLkpdBroadcastKey(raw);
  if (lkpdBcast) return canonicalRealtimeTenant(lkpdBcast.tenant) === lkpdStateTenant(req, undefined, lkpdBcast.lkpdId) && lkpdAllowed(lkpdBcast.lkpdId);
  if (raw.startsWith('broadcast_')) {
    const targetId = raw.slice('broadcast_'.length);
    return examAllowed(targetId) || lkpdAllowed(targetId);
  }
  const tenantStudent = (students || []).some((student: any) => String(student.id) === raw && isItemForCurrentMadrasah(student, req));
  return tenantStudent && !teacher;
}
`;
server = replaceOnce(server, candidateMarker, monitoringHelpers, 'monitoring-actor-helper');
server = replaceOnce(
  server,
  `  for (const key of Object.keys(mapObj)) {\n    const lkpdBroadcast = parseNamespacedLkpdBroadcastKey(key);`,
  `  for (const key of Object.keys(mapObj)) {\n    if (!monitoringStateKeyAllowedForActor(req, key)) continue;\n    const lkpdBroadcast = parseNamespacedLkpdBroadcastKey(key);`,
  'monitor-filter-actor-gate'
);

// ---------------------------------------------------------------------------
// 5) Rewrite LKPD heartbeat: validate first, atomic DB delta batch, small SSE event.
// ---------------------------------------------------------------------------
const hardenedStudentState = `app.post("/api/lkpd/student-state", requireAuth, requireRole(['student', 'siswa', 'class_leader', 'ketua_kelas']), async (req: any, res) => {
  const authUser = req.user || getAuthUser(req);
  const lkpdId = String(req.body?.lkpdId || '').trim();
  if (!lkpdId || lkpdId.length > 256) return res.status(400).json({ success: false, message: 'lkpdId tidak valid.' });

  const context = resolveLkpdStudentContext(req, authUser, lkpdId);
  if (context.error) return res.status(context.error.status).json({ success: false, message: context.error.message });

  let validatedLivecamFrame = '';
  if (req.body?.livecamFrame) {
    validatedLivecamFrame = String(req.body.livecamFrame);
    if (Buffer.byteLength(validatedLivecamFrame, 'utf8') > 2 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'Frame livecam LKPD terlalu besar.' });
    }
    if (!parseSafeRasterDataUrl(validatedLivecamFrame)) {
      return res.status(400).json({ success: false, message: 'Format frame livecam LKPD tidak valid.' });
    }
  }

  const studentId = context.studentId;
  const lkpd = context.lkpd;
  const key = lkpdStateKey(req, studentId, lkpdId);
  const existingKey = resolveLkpdStateKey(req, studentId, lkpdId);
  const legacyKeys = lkpdLegacyStateKeysForRequest(req, studentId, lkpdId).filter((candidate) => candidate !== key);
  const candidateKeys = Array.from(new Set([key, existingKey, ...legacyKeys]));
  const active = req.body?.active !== false;
  const now = Date.now();
  const violationReason = String(req.body?.violationReason || '').trim().slice(0, 500);
  const deltaWrites: Array<{ storeName: string; itemKey: string; value: any }> = [];
  const affectedStores = [
    { store: activeExamSessions, name: 'activeExamSessions' },
    { store: studentTabSwitches, name: 'studentTabSwitches' },
    { store: studentOutOfTab, name: 'studentOutOfTab' },
    { store: blockedStudents, name: 'blockedStudents' }
  ];
  const snapshot = affectedStores.map(({ store, name }) => ({
    store, name,
    entries: new Map(candidateKeys.map((candidate) => [candidate, {
      exists: Object.prototype.hasOwnProperty.call(store || {}, candidate),
      value: store?.[candidate]
    }]))
  }));
  const restoreSnapshot = () => {
    for (const state of snapshot) {
      for (const [candidate, entry] of state.entries) {
        if (entry.exists) state.store[candidate] = entry.value;
        else delete state.store[candidate];
      }
    }
  };
  const queueDelta = (storeName: string, itemKey: string, value: any) => {
    deltaWrites.push({ storeName, itemKey, value });
  };

  const migrateDeltaState = (store: any, storeName: string) => {
    if (!Object.prototype.hasOwnProperty.call(store || {}, key)) {
      for (const legacyKey of legacyKeys) {
        if (Object.prototype.hasOwnProperty.call(store || {}, legacyKey)) {
          store[key] = store[legacyKey];
          queueDelta(storeName, key, store[key]);
          break;
        }
      }
    }
    for (const legacyKey of legacyKeys) {
      if (Object.prototype.hasOwnProperty.call(store || {}, legacyKey)) {
        delete store[legacyKey];
        queueDelta(storeName, legacyKey, null);
      }
    }
  };

  migrateDeltaState(studentTabSwitches, 'studentTabSwitches');
  migrateDeltaState(studentOutOfTab, 'studentOutOfTab');
  migrateDeltaState(blockedStudents, 'blockedStudents');

  if (!active) {
    delete activeExamSessions[key];
    queueDelta('activeExamSessions', key, null);
    for (const legacyKey of legacyKeys) {
      delete activeExamSessions[legacyKey];
      queueDelta('activeExamSessions', legacyKey, null);
    }
  } else {
    const existingSession = activeExamSessions[key] || activeExamSessions[existingKey] || {};
    const answeredCount = Math.max(0, Math.min(10000, Math.floor(Number(req.body?.answeredCount ?? existingSession.answeredCount ?? 0) || 0)));
    const session = {
      ...existingSession,
      studentId,
      studentName: context.student?.name || existingSession.studentName || '',
      lkpdId,
      answeredCount,
      totalQuestions: Array.isArray(lkpd?.markers) ? lkpd.markers.length : Number(existingSession.totalQuestions || 0),
      startedAt: existingSession.startedAt || new Date(now).toISOString(),
      lastActiveAt: new Date(now).toISOString(),
      lastSeenAt: now
    };
    activeExamSessions[key] = session;
    queueDelta('activeExamSessions', key, session);
    for (const legacyKey of legacyKeys) {
      delete activeExamSessions[legacyKey];
      queueDelta('activeExamSessions', legacyKey, null);
    }
  }

  if (typeof req.body?.outOfTab === 'boolean') {
    studentOutOfTab[key] = req.body.outOfTab;
    if (existingKey !== key) delete studentOutOfTab[existingKey];
    queueDelta('studentOutOfTab', key, req.body.outOfTab);
  }
  if (violationReason) {
    const currentCount = Number(studentTabSwitches[key] || studentTabSwitches[existingKey] || 0);
    studentTabSwitches[key] = currentCount + 1;
    studentOutOfTab[key] = true;
    if (existingKey !== key) {
      delete studentTabSwitches[existingKey];
      delete studentOutOfTab[existingKey];
    }
    queueDelta('studentTabSwitches', key, studentTabSwitches[key]);
    queueDelta('studentOutOfTab', key, true);
  }

  try {
    await saveDeltaBatchDb(deltaWrites);
  } catch (err: any) {
    restoreSnapshot();
    return res.status(503).json({ success: false, message: safeServerError(err, 'State LKPD belum dapat disimpan. Silakan coba lagi.') });
  }

  if (validatedLivecamFrame) {
    studentLivecamFrames[key] = validatedLivecamFrame;
    if (existingKey !== key) delete studentLivecamFrames[existingKey];
  }

  const personalKeys = lkpdStateCandidateKeys(req, studentId, lkpdId);
  const broadcastKey = lkpdBroadcastStateKey(req, lkpdId);
  const legacyBroadcast = 'broadcast_' + lkpdId;
  const blocked = personalKeys.some((candidate) => blockedStudents[candidate] === true);
  const outOfTabValue = personalKeys.some((candidate) => studentOutOfTab[candidate] === true);
  const tabSwitchCount = Math.max(0, ...personalKeys.map((candidate) => Number(studentTabSwitches[candidate] || 0)));
  const messagePersonalKey = personalKeys.find((candidate) => Object.prototype.hasOwnProperty.call(examMessages || {}, candidate));
  const messagePersonal = messagePersonalKey ? examMessages[messagePersonalKey] : null;
  const messageBroadcast = examMessages[broadcastKey] ??
    (((lkpdList || []).filter((item: any) => String(item.id) === lkpdId).length === 1) ? examMessages[legacyBroadcast] : null);

  const session = activeExamSessions[key] || null;
  // LKPD_REALTIME_EVENT_V2: no full-state invalidation on 5-second student heartbeats.
  broadcastExamEvent({
    type: validatedLivecamFrame ? 'lkpd_frame' : (violationReason ? 'lkpd_violation' : 'lkpd_progress'),
    madrasahId: lkpdStateTenant(req, studentId, lkpdId),
    lkpdId,
    studentId,
    answeredCount: Number(session?.answeredCount || 0),
    totalQuestions: Number(session?.totalQuestions || 0),
    lastSeenAt: Number(session?.lastSeenAt || now),
    outOfTab: outOfTabValue,
    tabSwitches: tabSwitchCount,
    blocked,
    violationReason: violationReason || undefined,
    frame: validatedLivecamFrame || undefined
  });

  return res.json({
    success: true,
    blocked,
    outOfTab: outOfTabValue,
    tabSwitches: tabSwitchCount,
    messagePersonal,
    messageBroadcast,
    session: session ? {
      answeredCount: session.answeredCount || 0,
      totalQuestions: session.totalQuestions || 0,
      lastSeenAt: session.lastSeenAt || now
    } : null
  });
});
`;
server = replaceRegexOnce(
  server,
  /app\.post\("\/api\/lkpd\/student-state"[\s\S]*?\n\}\);\n\napp\.post\("\/api\/lkpd\/message\/ack"/,
  hardenedStudentState + '\napp.post("/api/lkpd/message/ack"',
  'lkpd-student-state-v2'
);

// ---------------------------------------------------------------------------
// 6) Teacher monitoring scope in GET/POST legacy monitor and summary route.
// ---------------------------------------------------------------------------
server = replaceOnce(
  server,
  `  const activeExam = resolvedExam.item;\n  if (!activeExam) return res.status(404).json({ success: false, message: "Ujian tidak ditemukan pada tenant yang diizinkan." });`,
  `  const activeExam = resolvedExam.item;\n  if (!activeExam) return res.status(404).json({ success: false, message: "Ujian tidak ditemukan pada tenant yang diizinkan." });\n  if (isTeacherRequest(req) && !teacherCanUseExamPayload(req, activeExam)) {\n    return res.status(403).json({ success: false, message: "Guru hanya dapat memonitor ujian mata pelajaran/bank soal yang diampu." });\n  }`,
  'monitor-summary-teacher-scope'
);
server = replaceOnce(
  server,
  `  const tenantExams = (getMemoryKeyValue('exams') || exams || []).filter((e: any) =>\n    isItemForCurrentMadrasah(e, req)\n  );`,
  `  const tenantExams = isTeacherRequest(req)\n    ? examsForRequest(req)\n    : (getMemoryKeyValue('exams') || exams || []).filter((e: any) => isItemForCurrentMadrasah(e, req));`,
  'legacy-monitor-exam-list-scope'
);
server = replaceRegexOnce(
  server,
  /    const validateKey = \(rawKey: string\) => \{[\s\S]*?\n      return false;\n    \};/,
  `    const validateKey = (rawKey: string) => {\n      if (!rawKey) return true;\n      return monitoringStateKeyAllowedForActor(req, String(rawKey));\n    };`,
  'legacy-monitor-mutation-scope'
);

// Auto-correction must respect the same teacher subject assignment as monitoring.
server = replaceOnce(
  server,
  `    if (!lkpd) {\n      return res.status(404).json({ success: false, message: "LKPD tidak ditemukan pada tenant yang diizinkan." });\n    }\n\n    const lkpdTenant = canonicalRealtimeTenant(lkpd?.madrasahId || lkpd?.madrasahSlug || 'default');`,
  `    if (!lkpd) {\n      return res.status(404).json({ success: false, message: "LKPD tidak ditemukan pada tenant yang diizinkan." });\n    }\n    if (isTeacherRequest(req) && !teacherCanUseLkpdPayload(req, lkpd)) {\n      return res.status(403).json({ success: false, message: "Guru hanya dapat mengoreksi LKPD mata pelajaran yang diampu." });\n    }\n\n    const lkpdTenant = canonicalRealtimeTenant(lkpd?.madrasahId || lkpd?.madrasahSlug || 'default');`,
  'lkpd-autocorrect-teacher-scope'
);

// ---------------------------------------------------------------------------
// 7) Atomic delta persistence helper (single PostgreSQL transaction).
// ---------------------------------------------------------------------------
const deltaFunctionMarker = `async function saveDeltaDb(deltaType: string, itemKey: string, value: any) {`;
const deltaBatchHelper = `type DeltaBatchWrite = { storeName: string; itemKey: string; value: any };

async function saveDeltaBatchDb(items: DeltaBatchWrite[]) {
  const deduped = new Map<string, DeltaBatchWrite>();
  for (const item of items || []) {
    if (!item?.storeName || !item?.itemKey) continue;
    deduped.set(\`delta::\${item.storeName}::\${item.itemKey}\`, item);
  }
  if (deduped.size === 0) return;
  if (isOnlineMode) {
    if (dbInitPromise) await dbInitPromise;
    if (!pool || isDbQuotaExceeded) throw new Error('ONLINE_DATABASE_UNAVAILABLE: cannot persist atomic delta batch');
  }
  if (!pool || isDbQuotaExceeded) return;

  const dbKeys = Array.from(deduped.keys());
  await runWithDbKeyLocks(dbKeys, async () => {
    let client: any = null;
    let clientError: any = null;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      for (const [dbKey, item] of deduped.entries()) {
        if (item.value === null || item.value === undefined) {
          await client.query('DELETE FROM app_store WHERE key = $1', [dbKey]);
        } else {
          await client.query(\`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          \`, [dbKey, JSON.stringify(item.value)]);
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      clientError = err;
      if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
      if (isOnlineMode) throw err;
      console.error('Atomic delta batch write error:', err);
    } finally {
      if (client) { try { client.release(clientError); } catch (_) {} }
    }
  });
}

${deltaFunctionMarker}`;
server = replaceOnce(server, deltaFunctionMarker, deltaBatchHelper, 'delta-batch-helper');

// ---------------------------------------------------------------------------
// 8) Generic sync RBAC: master data cannot bypass dedicated routes; academic
//    payloads must satisfy teacher assignment scope.
// ---------------------------------------------------------------------------
server = replaceOnce(
  server,
  `    const isStudentSyncRole = ['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(role);\n    const studentSyncKeys = new Set(['attendance', 'lkpdList', 'childguardStatus']);`,
  `    const isStudentSyncRole = ['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(role);\n    const isTeacherSyncRole = role === 'teacher' || role === 'guru';\n    const studentSyncKeys = new Set(['attendance', 'lkpdList', 'childguardStatus']);`,
  'sync-role-flags'
);
server = replaceOnce(
  server,
  `    if ((syncKey === 'settings' || syncKey === 'schoolLocations' || syncKey === 'schoolLocationSettings') && !adminRoles.has(role)) {\n      return res.status(403).json({ success: false, message: 'Pengaturan sistem hanya dapat diubah administrator.' });\n    }\n    key = syncKey;`,
  `    if ((syncKey === 'settings' || syncKey === 'schoolLocations' || syncKey === 'schoolLocationSettings') && !adminRoles.has(role)) {\n      return res.status(403).json({ success: false, message: 'Pengaturan sistem hanya dapat diubah administrator.' });\n    }\n    // TEACHER_SYNC_SCOPE_V2: generic sync must never bypass dedicated master-data RBAC.\n    const teacherAdminOwnedKeys = new Set(['teachers', 'students', 'classes', 'subjects', 'gradeCategories', 'customGradeColumns']);\n    if (isTeacherSyncRole && teacherAdminOwnedKeys.has(syncKey)) {\n      return res.status(403).json({ success: false, message: 'Master data tersebut hanya dapat diubah administrator melalui endpoint khusus.' });\n    }\n    if (isTeacherSyncRole && ['questionBankGroups', 'questionBank', 'questions', 'exams', 'grades'].includes(syncKey) && !Array.isArray(data)) {\n      return res.status(400).json({ success: false, message: 'Payload sinkronisasi akademik guru harus berupa array.' });\n    }\n    if (isTeacherSyncRole && syncKey === 'questionBankGroups') {\n      const denied = data.some((item: any) => !questionBankGroupAllowedForTeacher(req, tagNewRecord({ ...item, madrasahId: undefined, madrasahSlug: undefined }, req)));\n      if (denied) return res.status(403).json({ success: false, message: 'Guru hanya dapat menyinkronkan grup bank soal mata pelajaran yang diampu.' });\n    }\n    if (isTeacherSyncRole && (syncKey === 'questionBank' || syncKey === 'questions')) {\n      const denied = data.some((item: any) => !questionPayloadAllowedForTeacher(req, item));\n      if (denied) return res.status(403).json({ success: false, message: 'Guru hanya dapat menyinkronkan soal mata pelajaran yang diampu.' });\n    }\n    if (isTeacherSyncRole && syncKey === 'exams') {\n      const denied = data.some((item: any) => !teacherCanUseExamPayload(req, item));\n      if (denied) return res.status(403).json({ success: false, message: 'Guru hanya dapat menyinkronkan ujian mata pelajaran/bank soal yang diampu.' });\n    }\n    if (isTeacherSyncRole && syncKey === 'grades') {\n      const denied = data.some((item: any) => !gradePayloadAllowedForTeacher(req, item));\n      if (denied) return res.status(403).json({ success: false, message: 'Guru hanya dapat menyinkronkan nilai mata pelajaran yang diampu.' });\n    }\n    key = syncKey;`,
  'sync-teacher-scope'
);

// Teacher academic sync is always additive/merge-safe, including offline mode, so filtered client lists cannot delete others' records.
server = replaceOnce(
  server,
  `    else if (key === 'questionBankGroups') { questionBankGroups = mergeTenantCrudSyncData(questionBankGroups, data, req); await saveData('questionBankGroups', questionBankGroups); }\n    else if (key === 'questionBank' || key === 'questions') { questions = mergeTenantCrudSyncData(questions, data, req); await saveData('questions', questions); }\n    else if (key === 'exams') { exams = mergeTenantCrudSyncData(exams, data, req); await saveData('exams', exams); }`,
  `    else if (key === 'questionBankGroups') {\n      questionBankGroups = isTeacherSyncRole ? mergeTenantScopedSyncRecords(questionBankGroups, data, req, (item: any) => String(item?.id || '').trim()) : mergeTenantCrudSyncData(questionBankGroups, data, req);\n      await saveData('questionBankGroups', questionBankGroups);\n    }\n    else if (key === 'questionBank' || key === 'questions') {\n      questions = isTeacherSyncRole ? mergeTenantScopedSyncRecords(questions, data, req, (item: any) => String(item?.id || '').trim()) : mergeTenantCrudSyncData(questions, data, req);\n      await saveData('questions', questions);\n    }\n    else if (key === 'exams') {\n      exams = isTeacherSyncRole ? mergeTenantScopedSyncRecords(exams, data, req, (item: any) => String(item?.id || '').trim()) : mergeTenantCrudSyncData(exams, data, req);\n      await saveData('exams', exams);\n    }`,
  'sync-academic-merge-safe'
);
server = replaceOnce(
  server,
  `    else if (key === 'grades') { grades = mergeTenantCrudSyncData(grades, data, req); await saveData('grades', grades); }`,
  `    else if (key === 'grades') {\n      grades = isTeacherSyncRole ? mergeTenantScopedSyncRecords(grades, data, req, (item: any) => String(item?.id || '').trim()) : mergeTenantCrudSyncData(grades, data, req);\n      await saveData('grades', grades);\n    }`,
  'sync-grades-merge-safe'
);

// ---------------------------------------------------------------------------
// 9) /api/lkpds read is actor scoped (teacher assignment, student class).
// ---------------------------------------------------------------------------
server = replaceRegexOnce(
  server,
  /app\.get\("\/api\/lkpds", \(req: any, res\) => \{[\s\S]*?\n\}\);\napp\.post\("\/api\/exams"/,
  `app.get("/api/lkpds", (req: any, res) => {\n  const authUser = req.user || getAuthUser(req);\n  const role = String(authUser?.role || '').toLowerCase();\n  let list = isTeacherRequest(req) ? lkpdsForRequest(req) : filterByMadrasah(lkpdList, req);\n  if (['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(role)) {\n    const ownStudent = (students || []).find((student: any) => String(student.id) === String(authUser?.id || '') && isItemForCurrentMadrasah(student, req));\n    list = ownStudent ? list.filter((lkpd: any) => studentCanAccessLkpd(ownStudent, lkpd)) : [];\n    list = list.map((lkpd: any) => sanitizeLkpdForStudent(lkpd, String(authUser?.id || '')));\n  }\n  res.json({ success: true, lkpdList: list });\n});\napp.post("/api/exams"`,
  'lkpd-read-scope'
);

write('server.ts', server);

// ---------------------------------------------------------------------------
// Frontend: correct LKPD refresh endpoint and consume lightweight LKPD events.
// ---------------------------------------------------------------------------
let app = read('src/appScript.js');
app = replaceOnce(app, `else if (key === 'lkpdList') endpoint = '/api/sync-state?key=lkpdList';`, `else if (key === 'lkpdList') endpoint = '/api/lkpds';`, 'frontend-lkpd-refresh-endpoint');
app = replaceOnce(
  app,
  `                } else if (payload && (payload.type === 'exam_progress' || payload.type === 'student_heartbeat' || payload.type === 'exam_violation' || payload.type === 'exam_finish' || payload.type === 'exam_started' || payload.type === 'exam_presence')) {\n                    if (typeof window.__onExamMonitoringEvent === 'function') {\n                        window.__onExamMonitoringEvent(payload);\n                    }\n                }`,
  `                } else if (payload && (payload.type === 'exam_progress' || payload.type === 'student_heartbeat' || payload.type === 'exam_violation' || payload.type === 'exam_finish' || payload.type === 'exam_started' || payload.type === 'exam_presence')) {\n                    if (typeof window.__onExamMonitoringEvent === 'function') {\n                        window.__onExamMonitoringEvent(payload);\n                    }\n                } else if (payload && (payload.type === 'lkpd_progress' || payload.type === 'lkpd_violation' || payload.type === 'lkpd_frame')) {\n                    if (typeof window.__onLkpdMonitoringEvent === 'function') {\n                        window.__onLkpdMonitoringEvent(payload);\n                    }\n                }`,
  'frontend-lkpd-sse-events'
);
write('src/appScript.js', app);

let lkpd = read('src/lkpdModule.js');
lkpd = lkpd.split("fetch('/api/exam-monitoring-state').then(r => r.json())").join("fetch('/api/lkpds').then(r => r.json())");
if (lkpd.includes("fetch('/api/exam-monitoring-state').then(r => r.json())")) throw new Error('PATCH_REMAINS:lkpd-autocorrect-legacy-refresh');
const monitoringMarker = `// ============================================================================\n// 5. MONITORING LKPD SECTION\n// ============================================================================`;
const lkpdRealtimeHandler = `// ============================================================================\n// 5. MONITORING LKPD SECTION\n// ============================================================================\n// LKPD_REALTIME_CLIENT_V2: consume small per-student events instead of refetching global monitoring state.\nwindow.__onLkpdMonitoringEvent = function(payload) {\n    if (!payload || !payload.studentId || !payload.lkpdId) return;\n    const appState = window.appState || {};\n    const sessionKey = String(payload.studentId) + '_' + String(payload.lkpdId);\n    if (!appState.activeExamSessions) appState.activeExamSessions = {};\n    if (!appState.studentTabSwitches) appState.studentTabSwitches = {};\n    if (!appState.studentOutOfTab) appState.studentOutOfTab = {};\n    if (!appState.blockedStudents) appState.blockedStudents = {};\n    if (!appState.runtimeLivecamFrames) appState.runtimeLivecamFrames = {};\n    appState.activeExamSessions[sessionKey] = {\n        ...(appState.activeExamSessions[sessionKey] || {}),\n        studentId: String(payload.studentId),\n        lkpdId: String(payload.lkpdId),\n        answeredCount: Number(payload.answeredCount || 0),\n        totalQuestions: Number(payload.totalQuestions || 0),\n        lastSeenAt: Number(payload.lastSeenAt || Date.now())\n    };\n    appState.studentTabSwitches[sessionKey] = Number(payload.tabSwitches || 0);\n    appState.studentOutOfTab[sessionKey] = payload.outOfTab === true;\n    appState.blockedStudents[sessionKey] = payload.blocked === true;\n    if (payload.type === 'lkpd_frame' && typeof payload.frame === 'string' && payload.frame.startsWith('data:image/')) {\n        appState.runtimeLivecamFrames[sessionKey] = payload.frame;\n    }\n    if (String(appState.activeMonitoringLkpdId || '') === String(payload.lkpdId)) {\n        clearTimeout(window.__lkpdRealtimeRenderTimer);\n        window.__lkpdRealtimeRenderTimer = setTimeout(() => {\n            const container = document.getElementById('lkpd-monitoring-container');\n            if (container && typeof window.renderLkpdMonitoringSection === 'function') {\n                window.renderLkpdMonitoringSection(container, payload.lkpdId);\n            }\n        }, 250);\n    }\n};`;
lkpd = replaceOnce(lkpd, monitoringMarker, lkpdRealtimeHandler, 'lkpd-realtime-client-handler');
write('src/lkpdModule.js', lkpd);

// ---------------------------------------------------------------------------
// Regression guards: make every discovered blocker fail CI if reintroduced.
// ---------------------------------------------------------------------------
let regression = read('scripts/hardening-regression.ts');
regression = replaceOnce(
  regression,
  `  assert.match(server, /LKPD_STUDENT_STATE_V1/);`,
  `  assert.match(server, /LKPD_STUDENT_STATE_V1/);\n  assert.match(server, /TEACHER_SYNC_SCOPE_V2/);\n  assert.match(server, /TEACHER_MONITOR_SCOPE_V2/);\n  assert.match(server, /LKPD_STUDENT_SUBMISSION_WRITE_SCOPE/);\n  assert.match(server, /LKPD_REALTIME_EVENT_V2/);\n  assert.match(server, /saveDeltaBatchDb/);\n  assert.match(server, /monitoringStateKeyAllowedForActor/);\n  assert.match(server, /teacherCanUseLkpdPayload/);\n  assert.match(server, /Guru hanya dapat memonitor ujian mata pelajaran\/bank soal yang diampu/);`,
  'regression-server-guards'
);
regression = replaceOnce(
  regression,
  `  assert.equal(lkpdModule.includes("const res = await fetch('/api/exam-monitoring-state')"), false);`,
  `  assert.equal(lkpdModule.includes("fetch('/api/exam-monitoring-state')"), false);\n  assert.match(lkpdModule, /LKPD_REALTIME_CLIENT_V2/);\n  assert.match(lkpdModule, /fetch\('\/api\/lkpds'\)/);\n  assert.equal(app.includes("/api/sync-state?key=lkpdList"), false);\n  assert.match(app, /payload.type === 'lkpd_progress'/);`,
  'regression-frontend-guards'
);
write('scripts/hardening-regression.ts', regression);

let audit = read('scripts/security-audit.cjs');
audit = replaceOnce(
  audit,
  `  ['LKPD realtime state is tenant namespaced', server.includes('function lkpdStateKey(') && server.includes('function lkpdBroadcastStateKey(') && server.includes('lkpdv1::')],`,
  `  ['LKPD realtime state is tenant namespaced', server.includes('function lkpdStateKey(') && server.includes('function lkpdBroadcastStateKey(') && server.includes('lkpdv1::')],\n  ['Teacher generic sync cannot bypass master-data RBAC', server.includes('TEACHER_SYNC_SCOPE_V2') && server.includes('teacherAdminOwnedKeys') && server.includes('questionPayloadAllowedForTeacher')],\n  ['Teacher monitoring is assignment scoped', server.includes('TEACHER_MONITOR_SCOPE_V2') && server.includes('monitoringStateKeyAllowedForActor') && server.includes('Guru hanya dapat memonitor ujian mata pelajaran/bank soal yang diampu')],\n  ['Student LKPD grading fields are server authoritative', server.includes('LKPD_STUDENT_SUBMISSION_WRITE_SCOPE') && server.includes('scores: existingOwn?.scores || {}') && server.includes('isGraded: existingOwn?.isGraded === true')],\n  ['LKPD heartbeat uses lightweight realtime events', server.includes('LKPD_REALTIME_EVENT_V2') && fs.readFileSync('src/lkpdModule.js', 'utf8').includes('LKPD_REALTIME_CLIENT_V2') && !fs.readFileSync('src/appScript.js', 'utf8').includes('/api/sync-state?key=lkpdList')],\n  ['LKPD legacy delta migration is atomic', server.includes('async function saveDeltaBatchDb') && server.includes("await client.query('BEGIN')") && server.includes("await client.query('COMMIT')")],`,
  'security-audit-new-checks'
);
write('scripts/security-audit.cjs', audit);

console.log('Redeploy hardening patch applied successfully.');
