from pathlib import Path

app_path = Path('src/appScript.js')
app = app_path.read_text(encoding='utf-8')

marker = "function safeSetLocalStorage(key, value) {"
if marker not in app:
    raise SystemExit('safeSetLocalStorage marker not found')

helper = '''const ONLINE_SERVER_AUTH_STORAGE_KEYS = new Set([\n    'madrasah_settings',\n    'madrasah_students',\n    'madrasah_teachers',\n    'madrasah_classes',\n    'madrasah_subjects',\n    'madrasah_attendance',\n    'madrasah_attendance_photos',\n    'madrasah_teacherAttendance',\n    'madrasah_teacher_attendance',\n    'madrasah_teacherAttendance_photos',\n    'madrasah_teacher_attendance_photos',\n    'madrasah_questions',\n    'madrasah_questionBank',\n    'madrasah_questionBankGroups',\n    'madrasah_question_groups',\n    'madrasah_questionBank_photos',\n    'madrasah_schedules',\n    'madrasah_savedRosters',\n    'madrasah_timeSlots',\n    'madrasah_kbmDuration',\n    'madrasah_exams',\n    'madrasah_rooms',\n    'madrasah_journals',\n    'madrasah_gradeCategories',\n    'madrasah_grade_categories',\n    'madrasah_generated_exams',\n    'madrasah_generatedExams',\n    'madrasah_lessonPlans',\n    'madrasah_lesson_plans',\n    'madrasah_grades',\n    'madrasah_customGradeColumns',\n    'madrasah_schoolLocationSettings',\n    'madrasah_madrasahs',\n    'madrasah_photoCloudinaryMap'\n]);\n\nfunction isOnlineServerAuthoritativeStorage() {\n    try {\n        if (window.isOfflineMode === true || appState?.isOfflineMode === true) return false;\n        if (window.isOfflineMode === false || appState?.isOfflineMode === false) return true;\n    } catch (_) {}\n    return false;\n}\n\nfunction purgeOnlineServerAuthoritativeCaches() {\n    if (!isOnlineServerAuthoritativeStorage()) return;\n    try {\n        for (const key of ONLINE_SERVER_AUTH_STORAGE_KEYS) localStorage.removeItem(key);\n        for (let i = localStorage.length - 1; i >= 0; i--) {\n            const key = localStorage.key(i);\n            if (key && (key === 'madrasah_lkpdList' || /^madrasah_.+_lkpdList$/.test(key))) {\n                localStorage.removeItem(key);\n            }\n        }\n    } catch (_) {}\n}\nwindow.isOnlineServerAuthoritativeStorage = isOnlineServerAuthoritativeStorage;\nwindow.purgeOnlineServerAuthoritativeCaches = purgeOnlineServerAuthoritativeCaches;\n\n'''
if 'ONLINE_SERVER_AUTH_STORAGE_KEYS' not in app:
    app = app.replace(marker, helper + marker, 1)

safe_marker = "    if (!storageKey) return false;\n"
safe_add = '''\n    // Cloud Run/online mode is server-authoritative. Keep only session and CBT\n    // recovery/offline-queue data in browser storage; purge replicated datasets.\n    if (isOnlineServerAuthoritativeStorage() && ONLINE_SERVER_AUTH_STORAGE_KEYS.has(storageKey)) {\n        try { localStorage.removeItem(storageKey); } catch (_) {}\n        return true;\n    }\n'''
if 'Cloud Run/online mode is server-authoritative.' not in app:
    app = app.replace(safe_marker, safe_marker + safe_add, 1)

mode_old = "            appState.isOfflineMode = !!data.isOfflineMode;\n            window.isOfflineMode = !!data.isOfflineMode;"
mode_new = mode_old + "\n            if (!window.isOfflineMode) purgeOnlineServerAuthoritativeCaches();"
if mode_old in app and 'if (!window.isOfflineMode) purgeOnlineServerAuthoritativeCaches();' not in app:
    app = app.replace(mode_old, mode_new, 1)

attendance_start = "    if (key === 'attendance' || key === 'teacherAttendance') {\n        try {"
attendance_repl = "    if (key === 'attendance' || key === 'teacherAttendance') {\n        if (isOnlineServerAuthoritativeStorage()) {\n            try {\n                localStorage.removeItem('madrasah_' + key);\n                localStorage.removeItem('madrasah_' + key + '_photos');\n                if (key === 'teacherAttendance') localStorage.removeItem('madrasah_teacher_attendance_photos');\n            } catch (_) {}\n        } else {\n        try {"
if attendance_start in app and "if (isOnlineServerAuthoritativeStorage()) {\n            try {\n                localStorage.removeItem('madrasah_' + key);" not in app:
    app = app.replace(attendance_start, attendance_repl, 1)
    attendance_end = "        } catch(err) {\n            console.error('Error separating photo from ' + key, err);\n            safeSetLocalStorage('madrasah_' + key, appState[key]);\n        }\n    } else {"
    attendance_end_repl = "        } catch(err) {\n            console.error('Error separating photo from ' + key, err);\n            safeSetLocalStorage('madrasah_' + key, appState[key]);\n        }\n        }\n    } else {"
    if attendance_end not in app:
        raise SystemExit('saveState attendance closing marker not found')
    app = app.replace(attendance_end, attendance_end_repl, 1)

app_path.write_text(app, encoding='utf-8')

settings_path = Path('src/settingsAndMisc.js')
s = settings_path.read_text(encoding='utf-8')

backup_marker = "        const backupData = {\n            version: '2.0',"
if backup_marker not in s:
    raise SystemExit('backupData marker not found')
s = s.replace(backup_marker, "        const isOfflineBackupMode = (window.isOfflineMode === true || appState.isOfflineMode === true);\n        const backupData = {\n            version: '2.1',", 1)
s = s.replace("            localStorageDump: {}\n", "            ...(isOfflineBackupMode ? { localStorageDump: {} } : {})\n", 1)

backup_loop = "        if (incSettings) {\n            for (let i = 0; i < localStorage.length; i++) {\n                const key = localStorage.key(i);\n                if (key && key.startsWith('madrasah_')) {\n                    backupData.localStorageDump[key] = localStorage.getItem(key);\n                    backupData[key] = localStorage.getItem(key); // backwards compatibility\n                }\n            }\n        }"
backup_loop_new = "        // Browser cache is not part of an online/Cloud Run backup.\n        // Keep the legacy dump only for true offline installations.\n        if (incSettings && isOfflineBackupMode) {\n            for (let i = 0; i < localStorage.length; i++) {\n                const key = localStorage.key(i);\n                if (key && key.startsWith('madrasah_')) {\n                    backupData.localStorageDump[key] = localStorage.getItem(key);\n                    backupData[key] = localStorage.getItem(key); // offline backwards compatibility\n                }\n            }\n        }"
if backup_loop not in s:
    raise SystemExit('backup localStorage loop marker not found')
s = s.replace(backup_loop, backup_loop_new, 1)

restore_data_marker = "        if (!data || typeof data !== 'object') {\n            throw new Error('Format file backup tidak valid.');\n        }\n"
restore_data_new = restore_data_marker + "\n        const legacyDump = (data.localStorageDump && typeof data.localStorageDump === 'object' && !Array.isArray(data.localStorageDump))\n            ? data.localStorageDump\n            : {};\n"
if 'const legacyDump = (data.localStorageDump' not in s:
    s = s.replace(restore_data_marker, restore_data_new, 1)

arr_loop_old = "            for (const lk of legacyKeys) {\n                if (Array.isArray(data[lk])) return data[lk];\n                if (typeof data[lk] === 'string') {\n                    try {\n                        const parsed = JSON.parse(data[lk]);\n                        if (Array.isArray(parsed)) return parsed;\n                    } catch (e) {}\n                }\n            }"
arr_loop_new = "            for (const lk of legacyKeys) {\n                const candidate = data[lk] !== undefined ? data[lk] : legacyDump[lk];\n                if (Array.isArray(candidate)) return candidate;\n                if (typeof candidate === 'string') {\n                    try {\n                        const parsed = JSON.parse(candidate);\n                        if (Array.isArray(parsed)) return parsed;\n                    } catch (e) {}\n                }\n            }"
if arr_loop_old not in s:
    raise SystemExit('legacy array parser marker not found')
s = s.replace(arr_loop_old, arr_loop_new, 1)

obj_loop_old = "            for (const lk of legacyKeys) {\n                if (data[lk] && typeof data[lk] === 'object') return data[lk];\n                if (typeof data[lk] === 'string') {\n                    try {\n                        const parsed = JSON.parse(data[lk]);\n                        if (parsed && typeof parsed === 'object') return parsed;\n                    } catch (e) {}\n                }\n            }"
obj_loop_new = "            for (const lk of legacyKeys) {\n                const candidate = data[lk] !== undefined ? data[lk] : legacyDump[lk];\n                if (candidate && typeof candidate === 'object') return candidate;\n                if (typeof candidate === 'string') {\n                    try {\n                        const parsed = JSON.parse(candidate);\n                        if (parsed && typeof parsed === 'object') return parsed;\n                    } catch (e) {}\n                }\n            }"
if obj_loop_old not in s:
    raise SystemExit('legacy object parser marker not found')
s = s.replace(obj_loop_old, obj_loop_new, 1)

restore_mode_marker = "        const incSettings = cbSettings ? cbSettings.checked : true;\n"
if 'const isOfflineRestoreMode =' not in s:
    s = s.replace(restore_mode_marker, restore_mode_marker + "        const isOfflineRestoreMode = (window.isOfflineMode === true || appState.isOfflineMode === true);\n", 1)

start_marker = "                // Restore via server API with fallback for 413 Payload Too Large"
end_marker = "                // Explicitly persist selected restored data arrays & objects to localStorage & appState"
start = s.find(start_marker)
end = s.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('restore server block markers not found')

new_server_block = '''                // Restore through the dedicated server API. Online/Cloud Run must fail closed:\n                // a failed authoritative write must never be converted into a fake success toast.\n                let serverRestored = false;\n                let mergedServerData = null;\n                let serverRestoreError = null;\n\n                const parseRestoreResponse = async (response, label) => {\n                    let json = null;\n                    try { json = await response.json(); } catch (_) {}\n                    if (!response.ok || !json || json.success === false) {\n                        const detail = json && json.message ? json.message : `HTTP ${response.status}`;\n                        throw new Error(`${label}: ${detail}`);\n                    }\n                    return json;\n                };\n\n                const uploadRestoreChunks = async (payloadString) => {\n                    const chunkSize = 500000;\n                    const uploadId = `restore_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;\n                    const totalChunks = Math.ceil(payloadString.length / chunkSize);\n                    for (let i = 0; i < totalChunks; i++) {\n                        const chunkData = payloadString.slice(i * chunkSize, (i + 1) * chunkSize);\n                        const response = await fetch('/api/system/restore/chunk', {\n                            method: 'POST',\n                            headers: { 'Content-Type': 'application/json' },\n                            body: JSON.stringify({ uploadId, chunkData, chunkIndex: i, totalChunks })\n                        });\n                        const json = await parseRestoreResponse(response, `Restore bagian ${i + 1}/${totalChunks} gagal`);\n                        if (json.merged) mergedServerData = json.merged;\n                    }\n                    serverRestored = true;\n                };\n\n                try {\n                    const payloadString = JSON.stringify(restorePayload);\n                    if (payloadString.length > 500000) {\n                        await uploadRestoreChunks(payloadString);\n                    } else {\n                        const response = await fetch('/api/system/restore', {\n                            method: 'POST',\n                            headers: { 'Content-Type': 'application/json' },\n                            body: payloadString\n                        });\n                        if (response.status === 413) {\n                            await uploadRestoreChunks(payloadString);\n                        } else {\n                            const json = await parseRestoreResponse(response, 'Restore server gagal');\n                            if (json.merged) mergedServerData = json.merged;\n                            serverRestored = true;\n                        }\n                    }\n                } catch (err) {\n                    serverRestoreError = err;\n                    console.warn('Server restore error:', err);\n                }\n\n                if (!serverRestored) {\n                    if (!isOfflineRestoreMode) {\n                        throw serverRestoreError || new Error('Restore Cloud Run gagal disimpan ke server.');\n                    }\n\n                    // Offline-only compatibility fallback. Every write is verified; one failure\n                    // aborts the restore instead of reporting success with partial data.\n                    for (const [key, lsKey, val] of componentsToSync) {\n                        if (val === undefined || val === null) continue;\n                        const response = await fetch('/api/sync-state', {\n                            method: 'POST',\n                            headers: { 'Content-Type': 'application/json' },\n                            body: JSON.stringify({ key, data: val })\n                        });\n                        let json = null;\n                        try { json = await response.json(); } catch (_) {}\n                        if (!response.ok || (json && json.success === false)) {\n                            throw new Error((json && json.message) || `Gagal menyimpan komponen ${key}.`);\n                        }\n                    }\n                    serverRestored = true;\n                }\n\n'''
s = s[:start] + new_server_block + s[end:]

persist_start_marker = "                // Explicitly persist selected restored data arrays & objects to localStorage & appState"
toast_marker = "                if (window.showToast) {\n                    window.showToast('Data berhasil dipulihkan! Memuat ulang sistem...', 'success');\n                }"
pstart = s.find(persist_start_marker)
pend = s.find(toast_marker, pstart)
if pstart < 0 or pend < 0:
    raise SystemExit('restore local persistence block markers not found')

new_persist_block = '''                if (isOfflineRestoreMode) {\n                    // Offline installations still need browser/local cache for continuity.\n                    for (const [key, lsKey, val] of componentsToSync) {\n                        let finalVal = val;\n                        if (mergedServerData && mergedServerData[key] !== undefined) finalVal = mergedServerData[key];\n                        if (finalVal === undefined || finalVal === null) continue;\n                        if (key === 'students') appState[key] = sortStudentsByNis(finalVal);\n                        else appState[key] = finalVal;\n                        if (key === 'questions') appState.questionBank = finalVal;\n                        if (window.safeSetLocalStorage) window.safeSetLocalStorage(lsKey, appState[key]);\n                        else {\n                            try { localStorage.setItem(lsKey, JSON.stringify(appState[key])); } catch (_) {}\n                        }\n                        if (lsKey === 'madrasah_questionBankGroups') {\n                            if (window.safeSetLocalStorage) window.safeSetLocalStorage('madrasah_question_groups', finalVal);\n                            else {\n                                try { localStorage.setItem('madrasah_question_groups', JSON.stringify(finalVal)); } catch (_) {}\n                            }\n                        }\n                    }\n                } else {\n                    // Cloud Run: never duplicate restored server datasets into localStorage.\n                    // Remove legacy/stale caches and reload authoritative data from the server.\n                    if (typeof window.purgeOnlineServerAuthoritativeCaches === 'function') {\n                        window.purgeOnlineServerAuthoritativeCaches();\n                    } else {\n                        for (const [, lsKey] of componentsToSync) {\n                            try { localStorage.removeItem(lsKey); } catch (_) {}\n                        }\n                        try { localStorage.removeItem('madrasah_question_groups'); } catch (_) {}\n                    }\n\n                    if (typeof window.loadDataFromServer === 'function') {\n                        await window.loadDataFromServer();\n                    } else if (mergedServerData) {\n                        for (const [key, , val] of componentsToSync) {\n                            const finalVal = mergedServerData[key] !== undefined ? mergedServerData[key] : val;\n                            if (finalVal === undefined || finalVal === null) continue;\n                            if (key === 'students') appState.students = sortStudentsByNis(finalVal);\n                            else appState[key] = finalVal;\n                            if (key === 'questions') appState.questionBank = finalVal;\n                        }\n                    }\n                }\n\n'''
s = s[:pstart] + new_persist_block + s[pend:]
s = s.replace("window.showToast('Data berhasil dipulihkan! Memuat ulang sistem...', 'success');",
              "window.showToast(isOfflineRestoreMode ? 'Data berhasil dipulihkan! Memuat ulang sistem...' : 'Restore Cloud Run berhasil disimpan ke server dan data telah dimuat ulang dari sumber utama.', 'success');", 1)

settings_path.write_text(s, encoding='utf-8')
Path('public/appScript.js').write_text(app, encoding='utf-8')
Path('public/settingsAndMisc.js').write_text(s, encoding='utf-8')
