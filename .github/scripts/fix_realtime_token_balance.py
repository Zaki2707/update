from pathlib import Path
import re

app_path = Path('src/appScript.js')
server_path = Path('server.ts')
app = app_path.read_text(encoding='utf-8')
server = server_path.read_text(encoding='utf-8')

# ---------------------------------------------------------------------------
# 1. Cloud Run realtime: server is authoritative; never write stale RAM back
#    merely because a server read returned an empty list.
# ---------------------------------------------------------------------------
for state_field in ('attendance', 'teacherAttendance', 'grades'):
    old = f"}} else if (stateField === '{state_field}' && Array.isArray(newData) && newData.length === 0"
    new = f"}} else if (!isOnlineServerAuthoritativeStorage() && stateField === '{state_field}' && Array.isArray(newData) && newData.length === 0"
    if old not in app:
        raise SystemExit(f'online-authoritative marker not found for {state_field}')
    app = app.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 2. Coalesce realtime state-update events. One noisy key can cause at most one
#    active fetch plus one queued refresh, instead of N concurrent GETs.
# ---------------------------------------------------------------------------
queue_marker = "function getStoredRealtimeAuthToken() {"
if queue_marker not in app:
    raise SystemExit('realtime auth marker not found')
queue_code = r'''const realtimeKeySyncState = new Map();

function queueRealtimeKeySync(key) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;

    let state = realtimeKeySyncState.get(normalizedKey);
    if (!state) {
        state = { running: false, pending: false, timer: null, lastStartedAt: 0 };
        realtimeKeySyncState.set(normalizedKey, state);
    }

    state.pending = true;

    const run = async () => {
        state.timer = null;
        if (state.running || !state.pending) return;
        state.pending = false;
        state.running = true;
        state.lastStartedAt = Date.now();
        try {
            await syncKeyFromServer(normalizedKey);
        } finally {
            state.running = false;
            if (state.pending) {
                const elapsed = Date.now() - state.lastStartedAt;
                state.timer = setTimeout(run, Math.max(0, 300 - elapsed));
            }
        }
    };

    if (state.running || state.timer) return;
    const elapsed = Date.now() - state.lastStartedAt;
    state.timer = setTimeout(run, Math.max(0, 300 - elapsed));
}
window.queueRealtimeKeySync = queueRealtimeKeySync;

'''
app = app.replace(queue_marker, queue_code + queue_marker, 1)

# Reconnect timer must clear its handle once fired.
old_reconnect = r'''    const scheduleReconnect = (delay = 1500) => {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, delay);
    };'''
new_reconnect = r'''    const scheduleReconnect = (delay = 1500) => {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connect();
        }, delay);
    };'''
if old_reconnect not in app:
    raise SystemExit('scheduleReconnect marker not found')
app = app.replace(old_reconnect, new_reconnect, 1)

old_event = r'''                    if (payload.senderClientId !== appState.clientId) {
                        console.log('Real-time update received for key:', payload.key);
                        syncKeyFromServer(payload.key);
                    }'''
new_event = r'''                    if (payload.senderClientId !== appState.clientId) {
                        queueRealtimeKeySync(payload.key);
                    }'''
if old_event not in app:
    raise SystemExit('realtime state-update handler marker not found')
app = app.replace(old_event, new_event, 1)

# ---------------------------------------------------------------------------
# 3. Authoritative token balance refresh. The JWT/session copy can be stale
#    after an activation, so fetch current Cloud SQL-backed server state.
# ---------------------------------------------------------------------------
token_marker = "function getActiveMadrasahTokenBalance() {"
if token_marker not in app:
    raise SystemExit('token balance function marker not found')
refresh_code = r'''async function refreshAuthoritativeTokenBalance() {
    if (window.isOfflineMode === true || appState.isOfflineMode === true) return null;
    if (!appState.currentUser) return null;

    const role = String(appState.role || appState.currentUser.role || '').toLowerCase().trim();
    if (!['admin', 'administrator', 'teacher', 'guru'].includes(role)) return null;

    try {
        const response = await fetch('/api/token-balance', { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.success || typeof data.balance !== 'number') return null;

        const balance = Number(data.balance) || 0;
        appState.currentUser.cbtTokenBalance = balance;
        safeSetLocalStorage('madrasah_current_user', appState.currentUser);

        if (data.scope === 'teacher' && Array.isArray(appState.teachers)) {
            const idx = appState.teachers.findIndex(t =>
                String(t.id) === String(appState.currentUser.id) ||
                String(t.username) === String(appState.currentUser.username)
            );
            if (idx >= 0) appState.teachers[idx].cbtTokenBalance = balance;
        }

        if (data.scope === 'madrasah' && Array.isArray(appState.madrasahs)) {
            const targetId = String(data.madrasahId || appState.currentUser.madrasahId || appState.currentUser.madrasahSlug || '');
            const idx = appState.madrasahs.findIndex(m =>
                String(m.id) === targetId || String(m.slug) === targetId
            );
            if (idx >= 0) appState.madrasahs[idx].cbtTokenBalance = balance;
        }

        if (typeof window.updateHeaderTokenBadge === 'function') window.updateHeaderTokenBadge();
        return balance;
    } catch (err) {
        console.warn('Gagal menyegarkan saldo token authoritative:', err?.message || err);
        return null;
    }
}
window.refreshAuthoritativeTokenBalance = refreshAuthoritativeTokenBalance;

'''
app = app.replace(token_marker, refresh_code + token_marker, 1)

# Admin should prefer the freshly refreshed session balance over a possibly
# partially-hydrated madrasahs array.
admin_pref_marker = r'''function getActiveMadrasahTokenBalance() {
    const role = String(appState.role || '').toLowerCase().trim();
    if (role === 'teacher' || role === 'guru') {'''
admin_pref_repl = r'''function getActiveMadrasahTokenBalance() {
    const role = String(appState.role || '').toLowerCase().trim();
    if (role === 'teacher' || role === 'guru') {'''
if admin_pref_marker not in app:
    raise SystemExit('getActive balance header marker not found')
# Header unchanged; insert admin preference after teacher block's return 0 by
# targeting the next madrasahs branch.
madrasah_branch = r'''    if (appState.madrasahs && appState.madrasahs.length > 0) {'''
admin_preference = r'''    if ((role === 'admin' || role === 'administrator') && appState.currentUser && typeof appState.currentUser.cbtTokenBalance === 'number') {
        return appState.currentUser.cbtTokenBalance;
    }

    if (appState.madrasahs && appState.madrasahs.length > 0) {'''
if madrasah_branch not in app:
    raise SystemExit('madrasah balance branch marker not found')
app = app.replace(madrasah_branch, admin_preference, 1)

# Refresh token after full data hydration during login and session restoration.
login_load = r'''                await fetchLoad();
                if (loginBtn) {'''
login_load_new = r'''                await fetchLoad();
                await refreshAuthoritativeTokenBalance();
                if (loginBtn) {'''
if login_load not in app:
    raise SystemExit('login fetchLoad marker not found')
app = app.replace(login_load, login_load_new, 1)

session_load = r'''        try {
            await fetchLoad();
        } catch(e) {
            console.warn('Gagal loadDataFromServer:', e);'''
session_load_new = r'''        try {
            await fetchLoad();
            await refreshAuthoritativeTokenBalance();
        } catch(e) {
            console.warn('Gagal loadDataFromServer:', e);'''
if session_load not in app:
    raise SystemExit('session fetchLoad marker not found')
app = app.replace(session_load, session_load_new, 1)

# ---------------------------------------------------------------------------
# 4. Server: current balance endpoint and tenant-safe /api/madrasahs response.
# ---------------------------------------------------------------------------
server_marker = "function sanitizeMadrasahPublic(m: any) {"
if server_marker not in server:
    raise SystemExit('server madrasah sanitizer marker not found')
endpoint = r'''app.get("/api/token-balance", requireAuth, (req: any, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const authUser = req.user || getAuthUser(req);
  const role = String(authUser?.role || '').toLowerCase().trim();

  if (role === 'teacher' || role === 'guru') {
    const teacher = (teachers || []).find((t: any) =>
      String(t.id) === String(authUser?.id || '') ||
      (authUser?.username && String(t.username) === String(authUser.username))
    );
    if (!teacher) return res.status(404).json({ success: false, message: "Data guru tidak ditemukan." });
    return res.json({ success: true, scope: 'teacher', balance: Number(teacher.cbtTokenBalance || 0) });
  }

  if (role === 'admin' || role === 'administrator') {
    const targetId = String(authUser?.madrasahId || authUser?.madrasahSlug || '').trim();
    const target = (madrasahs || []).find((m: any) =>
      String(m.id) === targetId || String(m.slug) === targetId
    );
    if (!target) return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
    return res.json({
      success: true,
      scope: 'madrasah',
      madrasahId: target.id,
      balance: Number(target.cbtTokenBalance || 0),
      locked: Boolean(target.tokenSignatureInvalid)
    });
  }

  return res.status(403).json({ success: false, message: "Saldo token tidak tersedia untuk peran ini." });
});

'''
server = server.replace(server_marker, endpoint + server_marker, 1)

# Scope /api/madrasahs to the authenticated tenant for ordinary users and
# include their own token balance. BOSS still receives the management list.
route_pattern = re.compile(
    r'app\.get\("/api/madrasahs", requireAuth, \(req: any, res\) => \{.*?\n\}\);\n\n(?=app\.get\("/api/madrasah-by-slug/:slug")',
    re.S,
)
route_match = route_pattern.search(server)
if not route_match:
    raise SystemExit('/api/madrasahs route block not found')
route_replacement = r'''app.get("/api/madrasahs", requireAuth, (req: any, res) => {
  const authUser = req.user || getAuthUser(req);
  const role = String(authUser?.role || '').toLowerCase().trim();
  const isBos = role === 'bos' || role === 'superadmin';

  if (isBos) {
    return res.json({
      success: true,
      madrasahs: (madrasahs || []).map(({ adminPass, tokenSignature, tokenSignatureInvalid, ...rest }: any) => rest)
    });
  }

  const targetId = String(authUser?.madrasahId || authUser?.madrasahSlug || '').trim();
  const ownMadrasahs = (madrasahs || []).filter((m: any) =>
    String(m.id) === targetId || String(m.slug) === targetId
  );
  return res.json({
    success: true,
    madrasahs: ownMadrasahs.map(({ adminPass, tokenSignature, tokenSignatureInvalid, ...rest }: any) => rest)
  });
});

'''
server = server[:route_match.start()] + route_replacement + server[route_match.end():]

# /api/all-data should not leak every tenant's token balance to ordinary users.
old_all_data = "const sanitizedMadrasahs = madrasahs.map(({ adminPass, ...rest }: any) => rest);"
new_all_data = r'''const isBosUser = Boolean(authUser && (authUser.role === 'bos' || authUser.role === 'superadmin'));
  const visibleMadrasahs = isBosUser
    ? (madrasahs || [])
    : (madrasahs || []).filter((m: any) => {
        const requestId = String(mId || authUser?.madrasahId || authUser?.madrasahSlug || 'default');
        return String(m.id) === requestId || String(m.slug) === requestId;
      });
  const sanitizedMadrasahs = visibleMadrasahs.map(({ adminPass, tokenSignature, tokenSignatureInvalid, ...rest }: any) => rest);'''
if old_all_data not in server:
    raise SystemExit('all-data sanitizedMadrasahs marker not found')
server = server.replace(old_all_data, new_all_data, 1)

# Make token-related madrasah writes explicit immediate Cloud SQL writes.
server = server.replace("await saveData('madrasahs', madrasahs);", "await saveData('madrasahs', madrasahs, true);")

app_path.write_text(app, encoding='utf-8')
server_path.write_text(server, encoding='utf-8')
print('Patched src/appScript.js and server.ts')
