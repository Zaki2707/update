from pathlib import Path

p = Path('src/appScript.js')
s = p.read_text(encoding='utf-8')

old = '''            else if (key === 'madrasahs') {
                newData = resData.madrasahs;
                // Update active user's local balance if applicable (Admin only)
                if (appState.currentUser && (appState.role === 'admin' || appState.role === 'administrator')) {
                    const currentMId = appState.currentUser.madrasahId || appState.currentUser.madrasahSlug || 'default';
                    const matchedM = (resData.madrasahs || []).find(m => String(m.id) === String(currentMId));
                    if (matchedM) {
                        appState.currentUser.cbtTokenBalance = matchedM.cbtTokenBalance;
                        safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                    }
                }
                if (typeof window.updateHeaderTokenBadge === 'function') {
                    window.updateHeaderTokenBadge();
                }
            }'''

new = '''            else if (key === 'madrasahs') {
                // /api/madrasahs intentionally returns a sanitized object for non-BOSS users.
                // Preserve the last authoritative token balance when that sanitized payload omits cbtTokenBalance.
                const incomingMadrasahs = Array.isArray(resData.madrasahs) ? resData.madrasahs : [];
                newData = incomingMadrasahs.map(m => {
                    const existingM = (appState.madrasahs || []).find(oldM =>
                        String(oldM.id) === String(m.id) ||
                        (m.slug && String(oldM.slug) === String(m.slug))
                    );
                    if (typeof m.cbtTokenBalance !== 'number' && existingM && typeof existingM.cbtTokenBalance === 'number') {
                        return { ...m, cbtTokenBalance: existingM.cbtTokenBalance };
                    }
                    return m;
                });

                // Update the active admin session only when the server actually supplied a numeric balance.
                // Never overwrite a fresh activation balance with undefined from the sanitized madrasah response.
                if (appState.currentUser && (appState.role === 'admin' || appState.role === 'administrator')) {
                    const currentMId = appState.currentUser.madrasahId || appState.currentUser.madrasahSlug || 'default';
                    const matchedM = newData.find(m =>
                        String(m.id) === String(currentMId) ||
                        String(m.slug) === String(currentMId)
                    );
                    if (matchedM && typeof matchedM.cbtTokenBalance === 'number') {
                        appState.currentUser.cbtTokenBalance = matchedM.cbtTokenBalance;
                        safeSetLocalStorage('madrasah_current_user', appState.currentUser);
                    }
                }
                if (typeof window.updateHeaderTokenBadge === 'function') {
                    window.updateHeaderTokenBadge();
                }
            }'''

count = s.count(old)
if count != 1:
    raise SystemExit(f'expected exactly one madrasah sync block, found {count}')

s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
