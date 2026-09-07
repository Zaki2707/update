const fs = require('fs');
const path = require('path');

const baseDir = 'temp_offline_update';

// 1. Simplify top-up UI
const bossModulePath = path.join(baseDir, 'src', 'bossModule.js');
if (fs.existsSync(bossModulePath)) {
    let bossModuleContent = fs.readFileSync(bossModulePath, 'utf8');

    // Replace the form
    const newFormHtml = `
            <form id="topup-token-form" onsubmit="submitTopUpTokenRequest(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Nomor WhatsApp Anda</label>
                    <input type="text" id="topup-wa-number" placeholder="Contoh: 081234567890" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500">
                </div>
                <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Kode Aktivasi</label>
                    <input type="text" id="offline-activation-key-input" placeholder="Masukkan Kode Aktivasi..." required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500">
                </div>
                <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onclick="closeTopUpTokenModal()" class="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-2xl text-xs font-semibold transition">Batal</button>
                    <button type="submit" id="btn-submit-topup" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md shadow-emerald-600/10 transition flex items-center gap-1.5">
                        <i class="fa-solid fa-check"></i> <span>Aktivasi Token</span>
                    </button>
                </div>
            </form>
    `;

    // Simple regex replacement for the form
    bossModuleContent = bossModuleContent.replace(/<form id="topup-token-form"[^>]*>[\s\S]*?<\/form>/, newFormHtml);

    // Remove the crypto card which has references to BOS
    bossModuleContent = bossModuleContent.replace(/<!-- CRYPTOGRAPHIC OFFLINE LICENSE KEY ACTIVATION CARD -->[\s\S]*?<\/div>\s*<\/div>/, '');

    fs.writeFileSync(bossModulePath, bossModuleContent);
    console.log('UI updated.');
}

// 2. Remove BOS references (simplistic approach: comment out)
const serverTsPath = path.join(baseDir, 'server.ts');
if (fs.existsSync(serverTsPath)) {
    let serverTsContent = fs.readFileSync(serverTsPath, 'utf8');
    serverTsContent = serverTsContent.replace(/const bossUserEnv = process.env.BOSS_USERNAME;/g, '// const bossUserEnv = process.env.BOSS_USERNAME;');
    serverTsContent = serverTsContent.replace(/const bossPassEnv = process.env.BOSS_PASSWORD;/g, '// const bossPassEnv = process.env.BOSS_PASSWORD;');
    fs.writeFileSync(serverTsPath, serverTsContent);
    console.log('BOS references removed.');
}
