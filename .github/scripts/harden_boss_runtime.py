from pathlib import Path

server = Path('server.ts')
s = server.read_text(encoding='utf-8')

old_top = '''// Initialize Firebase - FORCE DISCONNECTED PER USER INSTRUCTION TO PREVENT QUOTA EXCEEDED
let db: any = null;
const isOfflineMode = true;

console.log("Firebase Firestore has been completely disconnected per user instructions to avoid daily free-tier read limits. Application is fully using local storage and Cloudinary backup.");
'''
new_top = '''// Initialize Firebase - FORCE DISCONNECTED PER USER INSTRUCTION TO PREVENT QUOTA EXCEEDED
let db: any = null;

// Runtime mode is derived from Cloud Run's platform-provided markers, never from APP_MODE/host headers.
// This keeps one source tree for cloud + localhost while preventing a local .env toggle from enabling BOSS.
const isTrustedCloudRunRuntime = Boolean(
  process.env.K_SERVICE &&
  (process.env.K_REVISION || process.env.K_CONFIGURATION)
);
const isOfflineMode = !isTrustedCloudRunRuntime;

console.log(`[Runtime] ${isOfflineMode ? 'OFFLINE_LOCAL' : 'ONLINE_CLOUD_RUN'} mode detected.`);
console.log("Firebase Firestore has been completely disconnected per user instructions to avoid daily free-tier read limits. Application is fully using local storage and Cloudinary backup.");
'''
if old_top not in s:
    raise SystemExit('top runtime block not found')
s = s.replace(old_top, new_top, 1)

old_cloud = '''function isCloudServer(req?: express.Request): boolean {
  if (process.env.K_SERVICE || process.env.CLOUD_RUN_JOB || process.env.IS_CLOUD_SERVER === "true" || process.env.GOOGLE_CLOUD_PROJECT) {
    return true;
  }
  if (req) {
    const host = (req.headers.host || req.hostname || "").toLowerCase();
    if (host.includes("ai.studio") || host.includes("run.app") || host.includes("madrasahku")) {
      return true;
    }
  }
  return false;
}
'''
new_cloud = '''function isCloudServer(_req?: express.Request): boolean {
  return isTrustedCloudRunRuntime;
}

function isBossRuntimeEnabled(): boolean {
  return isTrustedCloudRunRuntime && Boolean(
    process.env.BOSS_USERNAME &&
    process.env.BOSS_PASSWORD &&
    process.env.LICENSE_PRIVATE_KEY &&
    process.env.LICENSE_PUBLIC_KEY
  );
}
'''
if old_cloud not in s:
    raise SystemExit('isCloudServer block not found')
s = s.replace(old_cloud, new_cloud, 1)

old_login = '''  const isBoss =
    Boolean(bossUserEnv && bossPassEnv) &&
    uLower === String(bossUserEnv).toLowerCase() &&
    p === String(bossPassEnv);

  if (isBoss) {
    if (!isCloudServer(req)) {
      return res.status(401).json({
        success: false,
        message: ""
      });
    }

    const bossUser = {
'''
new_login = '''  const isBoss =
    isBossRuntimeEnabled() &&
    Boolean(bossUserEnv && bossPassEnv) &&
    uLower === String(bossUserEnv).toLowerCase() &&
    p === String(bossPassEnv);

  if (isBoss) {
    const bossUser = {
'''
if old_login not in s:
    raise SystemExit('BOSS login block not found')
s = s.replace(old_login, new_login, 1)

old_gen = '''app.post("/api/boss/generate-activation-key", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  const { quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Jumlah token yang valid diperlukan." });
  }
  try {
'''
new_gen = '''app.post("/api/boss/generate-activation-key", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  if (!isBossRuntimeEnabled()) {
    return res.status(403).json({
      success: false,
      code: 'BOSS_RUNTIME_DISABLED',
      message: 'Generator token hanya tersedia pada runtime BOSS Cloud Run yang memiliki kredensial dan private key platform.'
    });
  }

  const { quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Jumlah token yang valid diperlukan." });
  }
  try {
'''
if old_gen not in s:
    raise SystemExit('activation generator route block not found')
s = s.replace(old_gen, new_gen, 1)

server.write_text(s, encoding='utf-8')

env = Path('.env.example')
e = env.read_text(encoding='utf-8')
anchor = '''# Kredensial Super Admin / BOS Platform (Opsional, bawaan: bos / bos123)
# Sangat direkomendasikan untuk diisi di server produksi demi keamanan
BOSS_USERNAME=
BOSS_PASSWORD=
'''
replacement = '''# Kredensial Super Admin / BOS Platform
# BOSS hanya aktif pada runtime Cloud Run yang terdeteksi oleh marker platform (K_SERVICE + K_REVISION/K_CONFIGURATION)
# serta ketika BOSS_USERNAME, BOSS_PASSWORD, LICENSE_PRIVATE_KEY, dan LICENSE_PUBLIC_KEY tersedia.
# APP_MODE / IS_CLOUD_SERVER / hostname tidak dapat mengaktifkan BOSS pada localhost.
BOSS_USERNAME=
BOSS_PASSWORD=
'''
if anchor not in e:
    raise SystemExit('.env.example BOSS block not found')
e = e.replace(anchor, replacement, 1)
env.write_text(e, encoding='utf-8')
