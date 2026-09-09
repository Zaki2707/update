from pathlib import Path

src = Path('src/settingsAndMisc.js')
s = src.read_text(encoding='utf-8')

wrong = "        const incSettings = cbSettings ? cbSettings.checked : true;\n        const isOfflineRestoreMode = (window.isOfflineMode === true || appState.isOfflineMode === true);\n\n        // Helper to convert single image URL to base64"
correct_backup = "        const incSettings = cbSettings ? cbSettings.checked : true;\n\n        // Helper to convert single image URL to base64"
if wrong in s:
    s = s.replace(wrong, correct_backup, 1)

restore_start = s.find('async function restoreSystemData(event) {')
if restore_start < 0:
    raise SystemExit('restoreSystemData not found')
restore_end = s.find('// Login Page Customization Functions', restore_start)
if restore_end < 0:
    raise SystemExit('restoreSystemData end marker not found')
segment = s[restore_start:restore_end]
marker = "        const incSettings = cbSettings ? cbSettings.checked : true;\n"
insert = marker + "        const isOfflineRestoreMode = (window.isOfflineMode === true || appState.isOfflineMode === true);\n"
if 'const isOfflineRestoreMode =' not in segment:
    if marker not in segment:
        raise SystemExit('restore incSettings marker not found')
    segment = segment.replace(marker, insert, 1)
    s = s[:restore_start] + segment + s[restore_end:]

# Runtime guard: ensure exactly one restore-mode declaration exists and it is inside restore.
if s.count('const isOfflineRestoreMode =') != 1:
    raise SystemExit(f'unexpected restore mode declaration count: {s.count("const isOfflineRestoreMode =")}')
restore_start = s.find('async function restoreSystemData(event) {')
restore_end = s.find('// Login Page Customization Functions', restore_start)
if 'const isOfflineRestoreMode =' not in s[restore_start:restore_end]:
    raise SystemExit('restore mode declaration is not inside restoreSystemData')

src.write_text(s, encoding='utf-8')
Path('public/settingsAndMisc.js').write_text(s, encoding='utf-8')
