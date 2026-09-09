const fs = require('fs');

const file = 'src/settingsAndMisc.js';
let text = fs.readFileSync(file, 'utf8');

if (!text.includes('function openResetPasswordModal(userId, currentType)')) {
  const marker = 'function openEditRoleModal(userId, currentType, userName) {';
  const idx = text.indexOf(marker);
  if (idx < 0) throw new Error('openEditRoleModal marker not found');

  const block = `function escapeAccountHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function generateAdminTemporaryPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = new Uint32Array(14);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
    let result = 'Mb#';
    for (let i = 0; i < bytes.length; i++) result += alphabet[bytes[i] % alphabet.length];
    return result;
}

function openResetPasswordModal(userId, currentType) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    const source = currentType === 'teacher' ? (appState.teachers || []) : (appState.students || []);
    const user = source.find(item => String(item.id) === String(userId));
    if (!user) {
        showToast('Akun tidak ditemukan.', 'error');
        return;
    }
    const generated = generateAdminTemporaryPassword();
    modal.innerHTML = \`
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold text-slate-800">Reset Password Akun</h3>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                    Password lama tidak dapat ditampilkan karena disimpan sebagai hash. Admin dapat menetapkan password baru dan melihatnya sekali setelah reset.
                </div>
                <div>
                    <p class="text-xs text-slate-400 font-semibold uppercase">Akun</p>
                    <p class="text-sm font-bold text-slate-800">\${escapeAccountHtml(user.name || user.username || user.id)}</p>
                    <p class="text-xs font-mono text-slate-500">\${escapeAccountHtml(user.username || '')}</p>
                </div>
                <div class="space-y-2">
                    <label class="block text-xs font-bold uppercase text-slate-500">Password Baru</label>
                    <div class="flex gap-2">
                        <input id="admin-reset-password-input" type="text" value="\${escapeAccountHtml(generated)}" autocomplete="new-password" class="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono">
                        <button type="button" onclick="document.getElementById('admin-reset-password-input').value = generateAdminTemporaryPassword()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold">Acak</button>
                    </div>
                    <p class="text-[10px] text-slate-400">Password hanya terlihat pada proses reset ini dan tidak disimpan sebagai plaintext.</p>
                </div>
                <div class="flex justify-end space-x-2 pt-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold">Batal</button>
                    <button type="button" onclick="resetAndShowUserPassword('\${escapeAccountHtml(userId)}', '\${escapeAccountHtml(currentType)}')" class="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700">Reset Password</button>
                </div>
            </div>
        </div>\`;
}

async function resetAndShowUserPassword(userId, currentType) {
    const input = document.getElementById('admin-reset-password-input');
    const newPassword = input ? String(input.value || '').trim() : '';
    if (newPassword.length < 8) {
        showToast('Password baru minimal 8 karakter.', 'error');
        return;
    }
    const endpoint = currentType === 'teacher'
        ? \`/api/teachers/\${encodeURIComponent(userId)}\`
        : \`/api/students/\${encodeURIComponent(userId)}\`;
    try {
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword })
        });
        let data = null;
        try { data = await response.json(); } catch (_) {}
        if (!response.ok || !data || data.success === false) {
            throw new Error((data && data.message) || \`HTTP \${response.status}\`);
        }

        const modal = document.getElementById('modal-container');
        if (modal) {
            modal.innerHTML = \`
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                        <div class="text-center space-y-2">
                            <i class="fa-solid fa-circle-check text-emerald-600 text-3xl"></i>
                            <h3 class="font-bold text-slate-800">Password Berhasil Direset</h3>
                            <p class="text-xs text-slate-500">Salin password ini sekarang. Setelah modal ditutup, password lama tidak dapat ditampilkan kembali.</p>
                        </div>
                        <div class="p-4 bg-slate-900 text-white rounded-2xl font-mono text-center text-sm break-all" id="admin-reset-password-result">\${escapeAccountHtml(newPassword)}</div>
                        <div class="flex justify-center gap-2">
                            <button type="button" onclick="copyAdminResetPassword()" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Salin Password</button>
                            <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold">Tutup</button>
                        </div>
                    </div>
                </div>\`;
        }
        showToast('Password akun berhasil direset.', 'success');
    } catch (err) {
        showToast('Gagal reset password: ' + err.message, 'error');
    }
}

async function copyAdminResetPassword() {
    const el = document.getElementById('admin-reset-password-result');
    if (!el) return;
    try {
        await navigator.clipboard.writeText(el.textContent || '');
        showToast('Password disalin.', 'success');
    } catch (_) {
        showToast('Tidak dapat menyalin otomatis. Silakan salin manual.', 'error');
    }
}

`;
  text = text.slice(0, idx) + block + text.slice(idx);
}

if (!text.includes('onclick="openResetPasswordModal(\'${u.id}\', \'${u.type}\')"')) {
  const needle = 'onclick="openEditRoleModal(\'${u.id}\', \'${u.type}\', \'${escapedName}\')"';
  const pos = text.indexOf(needle);
  if (pos < 0) throw new Error('Edit role button marker not found');
  const buttonStart = text.lastIndexOf('                    <button', pos);
  if (buttonStart < 0) throw new Error('Edit role button start not found');
  const button = `                    <button type="button" onclick="openResetPasswordModal('\${u.id}', '\${u.type}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition flex items-center space-x-1">
                        <i class="fa-solid fa-key text-[10px]"></i><span>Reset Password</span>
                    </button>
`;
  text = text.slice(0, buttonStart) + button + text.slice(buttonStart);
}

if (!text.includes('window.openResetPasswordModal = openResetPasswordModal;')) {
  const marker = 'window.saveUserRole = saveUserRole;';
  if (!text.includes(marker)) throw new Error('window saveUserRole marker not found');
  text = text.replace(marker, `${marker}\nwindow.openResetPasswordModal = openResetPasswordModal;\nwindow.resetAndShowUserPassword = resetAndShowUserPassword;\nwindow.generateAdminTemporaryPassword = generateAdminTemporaryPassword;\nwindow.copyAdminResetPassword = copyAdminResetPassword;`);
}

if (!text.includes('  openResetPasswordModal,\n  resetAndShowUserPassword,')) {
  const marker = '  saveUserRole,\n  selectPresetLogoIcon,';
  if (!text.includes(marker)) throw new Error('Object.assign saveUserRole marker not found');
  text = text.replace(marker, '  saveUserRole,\n  openResetPasswordModal,\n  resetAndShowUserPassword,\n  generateAdminTemporaryPassword,\n  copyAdminResetPassword,\n  selectPresetLogoIcon,');
}

fs.writeFileSync(file, text, 'utf8');
console.log('admin password reset UI patched');
