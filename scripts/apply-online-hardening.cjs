const fs = require('fs');

function replaceExactlyOnce(text, oldText, newText, label) {
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`Patch marker not found: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Patch marker is ambiguous: ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
}

let server = fs.readFileSync('server.ts', 'utf8');

if (!server.includes('const DB_WRITE_THROTTLE_INTERVAL = 3000;')) {
  server = replaceExactlyOnce(
    server,
    'async function writeKeyToPostgresDirect(key: string) {',
    `const DB_WRITE_THROTTLE_INTERVAL = 3000;\nconst dbWriteTimeouts = new Map<string, NodeJS.Timeout>();\nconst lastDbWriteTimes = new Map<string, number>();\n\nasync function writeKeyToPostgresDirect(key: string) {`,
    'database write throttle declarations'
  );
}

server = replaceExactlyOnce(
  server,
  `      if (!imId && !imSlug) return true; // Include untagged legacy items\n      return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId || imId === 'default' || imSlug === 'default';`,
  `      if (isOnlineMode) {\n        // Production isolation is strict: never leak untagged/default legacy rows into another tenant.\n        return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId;\n      }\n      if (!imId && !imSlug) return true; // Offline-only legacy compatibility.\n      return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId || imId === 'default' || imSlug === 'default';`,
  'strict online filterByMadrasah isolation'
);

server = replaceExactlyOnce(
  server,
  `    return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId || imId === 'default' || imSlug === 'default';\n  }\n  \n  const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];`,
  `    if (isOnlineMode) {\n      return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId;\n    }\n    return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId || imId === 'default' || imSlug === 'default';\n  }\n  \n  const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];`,
  'strict online isItemForCurrentMadrasah isolation'
);

server = replaceExactlyOnce(
  server,
  `  const userRole = String(req.headers['x-user-role'] || 'student').trim().toLowerCase();\n  const isStudent = userRole === 'student';`,
  `  const authenticatedUser = req.user || getAuthUser(req);\n  const userRole = String(authenticatedUser?.role || 'student').trim().toLowerCase();\n  const isStudent = ['student', 'siswa', 'class_leader', 'ketua_kelas'].includes(userRole);`,
  'LKPD role from authenticated session'
);

server = replaceExactlyOnce(
  server,
  `    // Check HMAC verification\n    const secret = TOKEN_LOCK_SECRET || LEGACY_TOKEN_LOCK_SECRET;\n    const expectedHmacPrimary = "HMAC_" + crypto.createHmac('sha256', secret).update(dataToVerify).digest('hex');\n    const expectedHmacDefault = "HMAC_" + crypto.createHmac('sha256', LEGACY_TOKEN_LOCK_SECRET).update(dataToVerify).digest('hex');\n\n    if (signature === expectedHmacPrimary || signature === expectedHmacDefault) {\n      isValid = true;\n    } else {\n      // Check RSA keys as fallback`,
  `    // RSA is authoritative. Legacy HMAC activation is forgeable when based on a shared legacy secret,\n    // so it is disabled by default and may only be enabled explicitly for a short OFFLINE migration.\n    const allowLegacyHmacActivation = isOfflineMode && String(process.env.ALLOW_LEGACY_HMAC_ACTIVATION || '').toLowerCase() === 'true';\n    if (allowLegacyHmacActivation) {\n      const secret = TOKEN_LOCK_SECRET || LEGACY_TOKEN_LOCK_SECRET;\n      const expectedHmacPrimary = "HMAC_" + crypto.createHmac('sha256', secret).update(dataToVerify).digest('hex');\n      const expectedHmacDefault = "HMAC_" + crypto.createHmac('sha256', LEGACY_TOKEN_LOCK_SECRET).update(dataToVerify).digest('hex');\n      if (signature === expectedHmacPrimary || signature === expectedHmacDefault) isValid = true;\n    }\n\n    if (!isValid) {\n      // Check RSA keys (authoritative path)`,
  'disable legacy HMAC activation by default'
);

// Constrain optional teacher top-up target to the authenticated tenant/identity.
server = replaceExactlyOnce(
  server,
  `    if (teacherId) {\n      let tch = teachers.find(t => String(t.id) === String(teacherId) || String(t.username) === String(teacherId) || String(t.nip) === String(teacherId));\n      if (!tch) {\n        return res.status(404).json({ success: false, message: "Data guru tidak ditemukan." });\n      }`,
  `    if (teacherId) {\n      const authUser = (req as any).user || getAuthUser(req);\n      const authRole = String(authUser?.role || '').toLowerCase();\n      let tch = teachers.find(t => String(t.id) === String(teacherId) || String(t.username) === String(teacherId) || String(t.nip) === String(teacherId));\n      if (!tch || !isItemForCurrentMadrasah(tch, req)) {\n        return res.status(404).json({ success: false, message: "Data guru tidak ditemukan." });\n      }\n      if ((authRole === 'teacher' || authRole === 'guru') && String(tch.id) !== String(authUser.id)) {\n        return res.status(403).json({ success: false, message: "Guru hanya dapat mengaktifkan token untuk akun sendiri." });\n      }`,
  'teacher activation target ownership'
);

fs.writeFileSync('server.ts', server);

let env = fs.readFileSync('.env.example', 'utf8');
if (!env.includes('ALLOW_LEGACY_HMAC_ACTIVATION=')) {
  env += `\n# Hanya untuk migrasi kode aktivasi HMAC lama di mode offline. Default/produksi: false.\nALLOW_LEGACY_HMAC_ACTIVATION=false\n`;
  fs.writeFileSync('.env.example', env);
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.engines = { ...(pkg.engines || {}), node: '>=22.13.0' };
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

let audit = fs.readFileSync('scripts/security-audit.cjs', 'utf8');
if (!audit.includes('DB write throttle declarations exist')) {
  const marker = `  ['Student grade privacy exists', server.includes("item.studentId || item.student_id")],`;
  const addition = `${marker}\n  ['DB write throttle declarations exist', server.includes('const DB_WRITE_THROTTLE_INTERVAL = 3000;') && server.includes('const dbWriteTimeouts = new Map<string, NodeJS.Timeout>()') && server.includes('const lastDbWriteTimes = new Map<string, number>()')],\n  ['LKPD role uses authenticated identity', server.includes('const authenticatedUser = req.user || getAuthUser(req)')],\n  ['Online tenant isolation is strict', server.includes('Production isolation is strict')],\n  ['Legacy HMAC activation disabled by default', server.includes('ALLOW_LEGACY_HMAC_ACTIVATION')],\n  ['Teacher activation target is identity scoped', server.includes('Guru hanya dapat mengaktifkan token untuk akun sendiri')],`;
  if (!audit.includes(marker)) throw new Error('Security audit insertion marker not found');
  audit = audit.replace(marker, addition);
  fs.writeFileSync('scripts/security-audit.cjs', audit);
}

console.log('Guarded online hardening patches applied.');
