from pathlib import Path

p = Path('src/bossModule.js')
s = p.read_text(encoding='utf-8')

old = """            if (isTeacher && typeof data.remainingTokens === 'number') {
                if (appState.currentUser) {
                    appState.currentUser.cbtTokenBalance = data.remainingTokens;
                    if (window.safeSetLocalStorage) window.safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                }
                if (appState.teachers && appState.currentUser) {
                    const tchIdx = appState.teachers.findIndex(t => String(t.id) === String(appState.currentUser.id));
                    if (tchIdx >= 0) {
                        appState.teachers[tchIdx].cbtTokenBalance = data.remainingTokens;
                    }
                }
            }
"""

new = """            if (isTeacher && typeof data.remainingTokens === 'number') {
                if (appState.currentUser) {
                    appState.currentUser.cbtTokenBalance = data.remainingTokens;
                    if (window.safeSetLocalStorage) window.safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                }
                if (appState.teachers && appState.currentUser) {
                    const tchIdx = appState.teachers.findIndex(t => String(t.id) === String(appState.currentUser.id));
                    if (tchIdx >= 0) {
                        appState.teachers[tchIdx].cbtTokenBalance = data.remainingTokens;
                    }
                }
            } else if (!isTeacher && typeof data.remainingTokens === 'number') {
                const newBalance = Number(data.remainingTokens) || 0;

                // Keep the logged-in admin/session copy in sync with the authoritative server balance.
                if (appState.currentUser) {
                    appState.currentUser.cbtTokenBalance = newBalance;
                    if (window.safeSetLocalStorage) {
                        window.safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                    }
                }

                // Also update the matching madrasah object immediately so every badge/helper sees the same value.
                if (Array.isArray(appState.madrasahs) && appState.madrasahs.length > 0) {
                    const currentMId = appState.currentUser && (appState.currentUser.madrasahId || appState.currentUser.madrasahSlug);
                    let mIdx = appState.madrasahs.findIndex(m =>
                        String(m.id) === String(currentMId) ||
                        String(m.slug) === String(currentMId)
                    );
                    if (mIdx < 0 && appState.madrasahs.length === 1) mIdx = 0;
                    if (mIdx >= 0) {
                        appState.madrasahs[mIdx].cbtTokenBalance = newBalance;
                    }
                    if (window.safeSetLocalStorage) {
                        window.safeSetLocalStorage('madrasah_madrasahs', appState.madrasahs);
                    }
                }
            }
"""

if old not in s:
    raise SystemExit('server-success token sync target not found')
s = s.replace(old, new, 1)

old_fallback = """                } else {
                    if (appState.madrasahs && appState.madrasahs.length > 0) {
                        appState.madrasahs[0].cbtTokenBalance = (appState.madrasahs[0].cbtTokenBalance || 0) + qty;
                        if (window.saveState) window.saveState('madrasahs', appState.madrasahs);
                    }
"""

new_fallback = """                } else {
                    if (appState.madrasahs && appState.madrasahs.length > 0) {
                        const currentMId = appState.currentUser && (appState.currentUser.madrasahId || appState.currentUser.madrasahSlug);
                        let mIdx = appState.madrasahs.findIndex(m =>
                            String(m.id) === String(currentMId) ||
                            String(m.slug) === String(currentMId)
                        );
                        if (mIdx < 0 && appState.madrasahs.length === 1) mIdx = 0;
                        if (mIdx >= 0) {
                            appState.madrasahs[mIdx].cbtTokenBalance = (appState.madrasahs[mIdx].cbtTokenBalance || 0) + qty;
                            if (appState.currentUser) {
                                appState.currentUser.cbtTokenBalance = appState.madrasahs[mIdx].cbtTokenBalance;
                                if (window.safeSetLocalStorage) window.safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                            }
                            if (window.saveState) window.saveState('madrasahs', appState.madrasahs);
                        }
                    }
"""

if old_fallback in s:
    s = s.replace(old_fallback, new_fallback, 1)

p.write_text(s, encoding='utf-8')
