from pathlib import Path

# 1) Never fake token activation success on the client. Token balance is server-authoritative.
p = Path('src/bossModule.js')
s = p.read_text(encoding='utf-8')

s = s.replace("    let serverProcessed = false;\n", "", 1)
s = s.replace("            serverProcessed = true;\n", "", 1)

start_marker = """        } else {\n            console.warn('Server activation returned error message, attempting offline client validation fallback:', data.message);\n        }\n    } catch (err) {\n        console.warn('Network request failed for activation token, falling back to offline client validation:', err);\n    }\n\n    // Client-side local offline validation fallback\n"""
end_marker = """    if (window.showToast) window.showToast('Kode aktivasi tidak valid atau sudah pernah digunakan.', 'error');\n    else alert('Kode aktivasi tidak valid atau sudah pernah digunakan.');\n}\nwindow.submitOfflineActivationKey = submitOfflineActivationKey;\n"""

start = s.find(start_marker)
end = s.find(end_marker)
if start == -1 or end == -1 or end < start:
    raise SystemExit('bossModule activation fallback block not found')

replacement = """        } else {\n            const message = data.message || 'Kode aktivasi ditolak oleh server.';\n            console.warn('Server activation rejected:', message);\n            if (window.showToast) window.showToast(message, 'error');\n            else alert(message);\n            return;\n        }\n    } catch (err) {\n        console.warn('Network request failed for activation token:', err);\n        const message = 'Server lokal tidak dapat dihubungi. Aktivasi token tidak dilakukan agar saldo tidak hanya berubah sementara.';\n        if (window.showToast) window.showToast(message, 'error');\n        else alert(message);\n        return;\n    }\n}\nwindow.submitOfflineActivationKey = submitOfflineActivationKey;\n"""

s = s[:start] + replacement + s[end + len(end_marker):]
p.write_text(s, encoding='utf-8')

# 2) Preserve a valid current token balance during full-data refresh and only overwrite it with numeric server data.
p = Path('src/settingsAndMisc.js')
s = p.read_text(encoding='utf-8')
old = """            if (res.madrasahs) {\n                appState.madrasahs = res.madrasahs;\n                safeSetLocalStorage('madrasah_madrasahs', appState.madrasahs);\n                if (appState.currentUser && (appState.role === 'admin' || appState.role === 'administrator')) {\n                    const currentMId = appState.currentUser.madrasahId || appState.currentUser.madrasahSlug || 'default';\n                    const matchedM = (res.madrasahs || []).find(m => String(m.id) === String(currentMId));\n                    if (matchedM) {\n                        appState.currentUser.cbtTokenBalance = matchedM.cbtTokenBalance;\n                        safeSetLocalStorage('madrasah_current_user', appState.currentUser);\n                    }\n                }\n            }\n"""
new = """            if (res.madrasahs) {\n                const incomingMadrasahs = Array.isArray(res.madrasahs) ? res.madrasahs : [];\n                appState.madrasahs = incomingMadrasahs.map(m => {\n                    const existingM = (appState.madrasahs || []).find(oldM =>\n                        String(oldM.id) === String(m.id) ||\n                        (m.slug && String(oldM.slug) === String(m.slug))\n                    );\n                    if (typeof m.cbtTokenBalance !== 'number' && existingM && typeof existingM.cbtTokenBalance === 'number') {\n                        return { ...m, cbtTokenBalance: existingM.cbtTokenBalance };\n                    }\n                    return m;\n                });\n                safeSetLocalStorage('madrasah_madrasahs', appState.madrasahs);\n                if (appState.currentUser && (appState.role === 'admin' || appState.role === 'administrator')) {\n                    const currentMId = appState.currentUser.madrasahId || appState.currentUser.madrasahSlug || 'default';\n                    const matchedM = appState.madrasahs.find(m =>\n                        String(m.id) === String(currentMId) ||\n                        String(m.slug) === String(currentMId)\n                    );\n                    if (matchedM && typeof matchedM.cbtTokenBalance === 'number') {\n                        appState.currentUser.cbtTokenBalance = matchedM.cbtTokenBalance;\n                        safeSetLocalStorage('madrasah_current_user', appState.currentUser);\n                    }\n                }\n            }\n"""
if old not in s:
    raise SystemExit('settingsAndMisc madrasah refresh block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 3) Persist madrasah/token changes to local_store.json as well as RAM/DB.
p = Path('server.ts')
s = p.read_text(encoding='utf-8')
old = """  // Update localStoreCache even if restoring so it's ready for final flush\n  try {\n    const store = readLocalStore();\n    store[key] = value;\n  } catch (e) {}\n"""
new = """  // Update localStoreCache even if restoring so it's ready for final flush\n  try {\n    const store = readLocalStore();\n    store[key] = value;\n    // Token/madrasah balance must survive browser/server refresh even when PostgreSQL is unavailable.\n    // writeLocalStore is already throttled, so this does not create a disk-write hot path.\n    if (key === 'madrasahs') writeLocalStore(store);\n  } catch (e) {}\n"""
if old not in s:
    raise SystemExit('server saveData local cache block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 4) Student CBT question number: answered = dark green, number stays clearly visible.
p = Path('src/assessmentModule.js')
s = p.read_text(encoding='utf-8')
old = """                    ${sess.questions.map((qItem, idx) => {\n                        const isCurrent = idx === sess.currentIndex;\n                        const isAnswered = Boolean(sess.answers[qItem.id] && String(sess.answers[qItem.id]).trim() !== '');\n                        return `\n                            <button type=\"button\" onclick=\"jumpToExamQuestion(${idx})\" class=\"w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isCurrent ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow' : isAnswered ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}\">\n                                ${idx + 1}\n                            </button>\n                        `;\n                    }).join('')}\n"""
new = """                    ${sess.questions.map((qItem, idx) => {\n                        const isCurrent = idx === sess.currentIndex;\n                        const isAnswered = Boolean(sess.answers[qItem.id] && String(sess.answers[qItem.id]).trim() !== '');\n                        const navClass = isAnswered\n                            ? (isCurrent\n                                ? 'bg-emerald-800 text-white border border-emerald-900 ring-2 ring-emerald-300 shadow'\n                                : 'bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-900 shadow-sm')\n                            : (isCurrent\n                                ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow'\n                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200');\n                        return `\n                            <button type=\"button\" onclick=\"jumpToExamQuestion(${idx})\" class=\"w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${navClass}\">\n                                ${idx + 1}\n                            </button>\n                        `;\n                    }).join('')}\n"""
if old not in s:
    raise SystemExit('assessment question navigation block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
