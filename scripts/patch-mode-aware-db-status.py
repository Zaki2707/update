from pathlib import Path
import re


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


server_path = Path('server.ts')
server = server_path.read_text(encoding='utf-8')

marker = "const status: any = {\n    connected: false,"
require(server.count(marker) == 1, 'db-status object marker not found exactly once')
server = server.replace(marker, "const status: any = {\n    connected: false,\n    mode: storageMode,", 1)

firebase_pattern = re.compile(
    r"  // 2\. Check Firebase Firestore\n.*?(?=  // 3\. Check JSON \(Local Store\))",
    re.S,
)
match = firebase_pattern.search(server)
require(match is not None, 'firebase diagnostic block not found')
firebase_replacement = (
    "  // 2. Firebase Firestore is intentionally disabled in the current architecture.\n"
    "  // Do not probe it as a health dependency.\n"
    "  status.firebase.configured = false;\n"
    "  status.firebase.connected = false;\n"
    "  status.firebase.skipped = true;\n"
    "  status.firebase.message = \"Dinonaktifkan sesuai arsitektur aplikasi.\";\n"
    "  status.firebase.details = \"\";\n\n"
)
server = server[:match.start()] + firebase_replacement + server[match.end():]

json_pattern = re.compile(
    r"  // 3\. Check JSON \(Local Store\)\n(?P<body>.*?)(?=\n  // 4\. Check Cloudinary)",
    re.S,
)
match = json_pattern.search(server)
require(match is not None, 'json diagnostic block not found')
body = match.group('body')
indented_body = '\n'.join(('  ' + line) if line else line for line in body.splitlines())
json_replacement = (
    "  // 3. Local JSON is only a health dependency in OFFLINE mode.\n"
    "  if (isOfflineMode) {\n"
    + indented_body
    + "\n  } else {\n"
      "    status.json.configured = false;\n"
      "    status.json.connected = false;\n"
      "    status.json.skipped = true;\n"
      "    status.json.message = \"Tidak digunakan pada mode online; Cloud SQL adalah source of truth.\";\n"
      "    status.json.details = \"\";\n"
      "  }\n"
)
server = server[:match.start()] + json_replacement + server[match.end():]

strict_pattern = re.compile(
    r"  // Strict Connection Logic: Green/connected ONLY IF ALL services are healthy!\n.*?  res\.json\(status\);",
    re.S,
)
match = strict_pattern.search(server)
require(match is not None, 'strict status block not found')
strict_replacement = '''  // Mode-aware connection logic: only authoritative services determine health.
  if (isOfflineMode) {
    status.connected = Boolean(status.sql.connected && status.json.connected);
    if (status.connected) {
      status.message = "Sistem Luring (Offline) Aktif: PostgreSQL dan local_store.json terhubung.";
    } else {
      const failures = [];
      if (!status.sql.connected) failures.push("PostgreSQL lokal");
      if (!status.json.connected) failures.push("Local JSON");
      status.message = `Sistem Offline bermasalah pada: ${failures.join(', ')}.`;
    }
  } else {
    status.connected = Boolean(status.sql.connected && status.cloudinary.connected);
    if (status.connected) {
      status.message = "Sistem Online Aktif: Cloud SQL dan Cloudinary terhubung.";
    } else {
      const failures = [];
      if (!status.sql.connected) failures.push("PostgreSQL/Cloud SQL");
      if (!status.cloudinary.connected) failures.push("Cloudinary");
      status.message = `Sistem Online bermasalah pada: ${failures.join(', ')}.`;
    }
  }

  res.json(status);'''
server = server[:match.start()] + strict_replacement + server[match.end():]
server_path.write_text(server, encoding='utf-8')

ui_path = Path('src/settingsAndMisc.js')
ui = ui_path.read_text(encoding='utf-8')
ui_pattern = re.compile(
    r"async function checkDatabaseConnection\(\) \{.*?\n\}\n\nasync function forceSyncCloudToLocal\(\)",
    re.S,
)
match = ui_pattern.search(ui)
require(match is not None, 'checkDatabaseConnection block not found')
ui_replacement = '''async function checkDatabaseConnection() {
    const statusResultEl = document.getElementById('db-connection-test-result');
    if (statusResultEl) {
        statusResultEl.innerHTML = `<div class="p-3 bg-blue-50 text-blue-700 rounded-xl text-xs flex items-center gap-2"><i class="fa-solid fa-spinner fa-spin"></i><span>Sedang menguji layanan penyimpanan yang aktif...</span></div>`;
    }

    try {
        const res = await fetch('/api/db-status');
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            if (statusResultEl) {
                statusResultEl.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs"><div class="font-bold mb-1">Respons diagnostik tidak valid</div><p class="text-[11px] text-slate-600">Status HTTP ${res.status}. Periksa log backend.</p></div>`;
            }
            return;
        }

        if (statusResultEl) {
            const mode = String(data.mode || '').toLowerCase() === 'offline' ? 'offline' : 'online';
            const sqlObj = data.sql || { connected: false, message: 'Tidak terbaca' };
            const jsonObj = data.json || { connected: false, message: 'Tidak terbaca' };
            const cloudinaryObj = data.cloudinary || { connected: false, message: 'Tidak terbaca' };
            const isAllOk = data.connected === true;

            const renderIcon = (isOk) => isOk
                ? `<i class="fa-solid fa-circle-check text-emerald-500 text-base"></i>`
                : `<i class="fa-solid fa-circle-xmark text-rose-500 text-base"></i>`;
            const renderBadge = (isOk) => isOk
                ? `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">ONLINE</span>`
                : `<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">OFFLINE</span>`;
            const serviceCard = (number, title, obj) => `
                <div class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50/50 transition duration-150 border border-slate-50">
                    <div class="mt-0.5">${renderIcon(obj.connected)}</div>
                    <div class="flex-1 space-y-0.5 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <span class="font-bold text-slate-800 text-xs">${number}. ${title}</span>
                            ${renderBadge(obj.connected)}
                        </div>
                        <p class="text-[11px] text-slate-600">${obj.message || ''}</p>
                        ${obj.details ? `<p class="text-[10px] text-slate-400 font-mono bg-slate-50 p-1.5 rounded border border-slate-100/60 overflow-x-auto whitespace-pre-wrap">${obj.details}</p>` : ''}
                    </div>
                </div>`;

            const cards = mode === 'online'
                ? [
                    serviceCard(1, 'Database SQL (Google Cloud SQL)', sqlObj),
                    serviceCard(2, 'Cloudinary (Penyimpanan Foto)', cloudinaryObj)
                  ].join('')
                : [
                    serviceCard(1, 'Database PostgreSQL Lokal', sqlObj),
                    serviceCard(2, 'Local File System (local_store.json)', jsonObj)
                  ].join('');

            statusResultEl.innerHTML = `
                <div class="space-y-4 animate-in fade-in duration-300">
                    <div class="p-4 ${isAllOk ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'} border rounded-2xl text-xs space-y-1 shadow-sm">
                        <div class="font-bold flex items-center gap-2 text-sm">
                            <i class="fa-solid ${isAllOk ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-rose-600'}"></i>
                            <span>${mode === 'online' ? 'Status Penyimpanan Online' : 'Status Penyimpanan Offline'}</span>
                        </div>
                        <p class="text-slate-700">${data.message || (isAllOk ? 'Layanan utama terhubung.' : 'Ada layanan utama yang belum terhubung.')}</p>
                    </div>
                    <div class="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3.5">
                        <h4 class="text-xs font-bold text-slate-700 tracking-wide uppercase">Layanan yang Aktif</h4>
                        ${cards}
                    </div>
                    <p class="text-[10px] text-slate-400">Firebase Firestore tidak digunakan sebagai backend aktif. Local JSON hanya diperiksa pada mode offline.</p>
                </div>`;
        }
    } catch (err) {
        if (statusResultEl) {
            statusResultEl.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs"><div class="font-bold mb-1">Gagal menghubungi server diagnostik</div><p class="text-slate-700">${err?.message || String(err)}</p></div>`;
        }
    }
}

async function forceSyncCloudToLocal()'''
ui = ui[:match.start()] + ui_replacement + ui[match.end():]
ui_path.write_text(ui, encoding='utf-8')

print('Mode-aware DB status patch applied.')
