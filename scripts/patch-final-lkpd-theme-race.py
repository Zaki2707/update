from pathlib import Path

lkpd_path = Path('src/lkpdModule.js')
lkpd = lkpd_path.read_text(encoding='utf-8')
old = """    try {
        if (typeof window.saveState === 'function') {
            window.saveState('lkpdList');
        } else {
            await fetch('/api/sync-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'lkpdList', data: window.appState.lkpdList })
            }).catch(() => {});
        }
    } catch (err) {
        console.error(\"Error saving LKPD state:\", err);
    }
"""
new = """    try {
        // Commit directly and await the server before any managed asset is released.
        // This prevents a delete/reset race where Cloudinary still sees the old
        // LKPD reference and incorrectly protects an asset that should be removed.
        const response = await fetch('/api/sync-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'lkpdList', data: window.appState.lkpdList })
        });
        const data = await response.json();
        if (!response.ok || (data && data.success === false)) {
            throw new Error((data && data.message) || 'Server gagal menyimpan LKPD.');
        }
    } catch (err) {
        console.error(\"Error saving LKPD state:\", err);
        throw err;
    }
"""
if lkpd.count(old) != 1:
    raise SystemExit(f'LKPD save block expected 1 match, got {lkpd.count(old)}')
lkpd = lkpd.replace(old, new, 1)
lkpd_path.write_text(lkpd, encoding='utf-8')
Path('public/lkpdModule.js').write_text(lkpd, encoding='utf-8')

theme_path = Path('src/themePackageModule.js')
theme = theme_path.read_text(encoding='utf-8')
old_theme = """const originalSelectTheme = window.selectSystemTheme;
if (typeof originalSelectTheme === 'function') {
    window.selectSystemTheme = function(name) { if (name !== 'package') clearThemePackageVisual(); return originalSelectTheme.apply(this, arguments); };
}
"""
new_theme = """const originalSelectTheme = window.selectSystemTheme;
if (typeof originalSelectTheme === 'function') {
    window.selectSystemTheme = function(name) {
        const oldPkg = window.appState?.settings?.themePackage;
        if (name !== 'package') {
            clearThemePackageVisual();
            if (window.appState?.settings && oldPkg) delete window.appState.settings.themePackage;
        }
        const result = originalSelectTheme.apply(this, arguments);
        if (name !== 'package' && oldPkg) {
            Promise.resolve()
                .then(() => persistThemeSettings())
                .then(() => releaseThemeAssets(getPackageAssetRefs(oldPkg)))
                .catch(err => console.warn('Gagal membersihkan aset tema lama:', err));
        }
        return result;
    };
}
"""
if theme.count(old_theme) != 1:
    raise SystemExit(f'Theme wrapper expected 1 match, got {theme.count(old_theme)}')
theme = theme.replace(old_theme, new_theme, 1)
theme_path.write_text(theme, encoding='utf-8')
Path('public/themePackageModule.js').write_text(theme, encoding='utf-8')
print('Final LKPD/theme race patch applied.')
