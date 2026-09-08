const fs = require('fs');

function fail(message) {
  console.error(`[redeploy-hardening] ${message}`);
  process.exit(1);
}

function replaceOnce(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) fail(`marker not found: ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) fail(`marker is not unique: ${label}`);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

let server = fs.readFileSync('server.ts', 'utf8');
const tokenMatch = server.match(/const LEGACY_TOKEN_LOCK_SECRET = "([^"\r\n]+)";/);
const encryptionMatch = server.match(/const LEGACY_ENCRYPTION_SECRET = "([^"\r\n]+)";/);
if (!tokenMatch || !encryptionMatch) fail('legacy secret markers are missing or already changed');

const historyReplacementPath = process.env.HISTORY_REPLACEMENTS_FILE || '/tmp/madrasah-history-replacements.txt';
const encodeReplacement = (value) => `literal:${value}==>***REMOVED***`;
fs.writeFileSync(historyReplacementPath, `${encodeReplacement(tokenMatch[1])}\n${encodeReplacement(encryptionMatch[1])}\n`, { encoding: 'utf8', mode: 0o600 });

const startMarker = 'const LEGACY_TOKEN_LOCK_SECRET = ';
const endMarker = 'function verifyAndLockMadrasahTokens() {';
const start = server.indexOf(startMarker);
const end = server.indexOf(endMarker);
if (start < 0 || end <= start || server.lastIndexOf(startMarker) !== start || server.lastIndexOf(endMarker) !== end) {
  fail('secret block boundaries are invalid');
}

const hardened = `const RUNTIME_SECRETS_DIR = path.join(process.cwd(), '.madrasah-secrets');

function readConfiguredSecret(envName: string): string | null {
  const value = String(process.env[envName] || '').trim();
  return value || null;
}

function resolveRuntimeSecret(envName: string, fileName: string): string {
  const configured = readConfiguredSecret(envName);
  if (configured) return configured;
  // Cloud/online deployments must never silently fall back to a public or generated secret.
  if (isOnlineMode || isTrustedCloudRunRuntime) {
    throw new Error(\`\${envName} wajib dikonfigurasi pada environment untuk mode online.\`);
  }
  fs.mkdirSync(RUNTIME_SECRETS_DIR, { recursive: true, mode: 0o700 });
  const secretPath = path.join(RUNTIME_SECRETS_DIR, fileName);
  if (fs.existsSync(secretPath)) {
    const stored = fs.readFileSync(secretPath, 'utf8').trim();
    if (!stored) throw new Error(\`Secret lokal \${envName} kosong: \${secretPath}\`);
    return stored;
  }
  const generated = crypto.randomBytes(48).toString('base64url');
  try {
    fs.writeFileSync(secretPath, generated, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return generated;
  } catch (err: any) {
    if (err?.code === 'EEXIST') {
      const stored = fs.readFileSync(secretPath, 'utf8').trim();
      if (stored) return stored;
    }
    throw err;
  }
}

const TOKEN_LOCK_SECRET = resolveRuntimeSecret('TOKEN_LOCK_SECRET', 'token-lock.secret');
const TOKEN_LOCK_LEGACY_SECRET = readConfiguredSecret('TOKEN_LOCK_LEGACY_SECRET');
// Compatibility alias for the explicitly enabled legacy-HMAC migration path only.
// It never contains a hardcoded/shared value: legacy ENV when supplied, otherwise the active private secret.
const LEGACY_TOKEN_LOCK_SECRET = TOKEN_LOCK_LEGACY_SECRET || TOKEN_LOCK_SECRET;

function calculateTokenSignature(madrasahId: string, balance: number, useLegacy: boolean = false): string {
  const secret = useLegacy ? TOKEN_LOCK_LEGACY_SECRET : TOKEN_LOCK_SECRET;
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(\`\${madrasahId}:\${balance}\`).digest('hex');
}

const LOCAL_STORE_SECRET = resolveRuntimeSecret('LOCAL_STORE_SECRET', 'local-store.secret');
const LOCAL_STORE_LEGACY_SECRET = readConfiguredSecret('LOCAL_STORE_LEGACY_SECRET');
const ENCRYPTION_KEY = crypto.createHash('sha256').update(LOCAL_STORE_SECRET).digest();
const LOCAL_STORE_LEGACY_KEY = LOCAL_STORE_LEGACY_SECRET ? crypto.createHash('sha256').update(LOCAL_STORE_LEGACY_SECRET).digest() : null;

function encryptLocalStore(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptLocalStoreWithKey(encryptedText: string, key: Buffer): string {
  const parts = encryptedText.trim().split(':');
  if (parts.length !== 2) throw new Error('Invalid encryption format (no IV separator found)');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(parts[0], 'hex'));
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function decryptLocalStore(encryptedText: string): string {
  const trimmed = encryptedText.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return encryptedText;
  try {
    return decryptLocalStoreWithKey(encryptedText, ENCRYPTION_KEY);
  } catch {
    if (!LOCAL_STORE_LEGACY_KEY) {
      throw new Error('local_store menggunakan kunci lama. Konfigurasikan LOCAL_STORE_LEGACY_SECRET hanya untuk migrasi satu kali.');
    }
    return decryptLocalStoreWithKey(encryptedText, LOCAL_STORE_LEGACY_KEY);
  }
}

function migrateLocalStoreEncryptionAtStartup() {
  if (!isOfflineMode) return;
  for (const fileName of ['local_store.json', 'local_store.json.backup']) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    const trimmed = raw.trim();
    let plaintext: string | null = null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      plaintext = raw;
    } else {
      try {
        decryptLocalStoreWithKey(raw, ENCRYPTION_KEY);
        continue;
      } catch {
        if (!LOCAL_STORE_LEGACY_KEY) continue;
        try { plaintext = decryptLocalStoreWithKey(raw, LOCAL_STORE_LEGACY_KEY); } catch { continue; }
      }
    }
    if (plaintext !== null) {
      const tempPath = \`\${filePath}.migrating-\${process.pid}\`;
      fs.writeFileSync(tempPath, encryptLocalStore(plaintext), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tempPath, filePath);
      console.log(\`[Security] \${fileName} berhasil dienkripsi ulang dengan secret aktif.\`);
    }
  }
}

migrateLocalStoreEncryptionAtStartup();

`;
server = server.slice(0, start) + hardened + server.slice(end);
server = replaceOnce(server,
  '    const expectedLegacySig = calculateTokenSignature(m.id, currentBalance, true);',
  '    const expectedLegacySig = TOKEN_LOCK_LEGACY_SECRET ? calculateTokenSignature(m.id, currentBalance, true) : null;',
  'expected legacy token signature');
server = replaceOnce(server,
  '    } else if (TOKEN_LOCK_SECRET && m.tokenSignature === expectedLegacySig) {',
  '    } else if (expectedLegacySig && m.tokenSignature === expectedLegacySig) {',
  'legacy token migration condition');
server = replaceOnce(server,
  '    } else if (m.tokenSignature !== expectedSig && m.tokenSignature !== expectedLegacySig) {',
  '    } else if (m.tokenSignature !== expectedSig && (!expectedLegacySig || m.tokenSignature !== expectedLegacySig)) {',
  'legacy token mismatch condition');
fs.writeFileSync('server.ts', server);

let gitignore = fs.readFileSync('.gitignore', 'utf8').replace(/\s+$/, '') + '\n';
if (!gitignore.includes('local_store.json.*')) {
  gitignore += `
# Runtime state, uploads, and machine-local secrets must never be committed.
local_store.json
local_store.json.*
.madrasah-secrets/
uploads/*
!uploads/.gitkeep
!uploads/attendance_photos/
uploads/attendance_photos/*
!uploads/attendance_photos/.gitkeep
`;
}
fs.writeFileSync('.gitignore', gitignore);

let envExample = fs.readFileSync('.env.example', 'utf8');
envExample = replaceOnce(envExample,
  '# Kunci Enkripsi untuk local_store.json (Required)\nLOCAL_STORE_SECRET=\n\n# Kunci Garam Rahasia untuk Penguncian Token (Required)\nTOKEN_LOCK_SECRET=',
  `# Kunci enkripsi local_store. Wajib pada mode online.\n# Offline: jika kosong, aplikasi membuat secret acak di .madrasah-secrets/ (tidak masuk Git).\nLOCAL_STORE_SECRET=\n# Hanya untuk migrasi satu kali instalasi lama; jangan commit nilainya dan hapus setelah migrasi berhasil.\nLOCAL_STORE_LEGACY_SECRET=\n\n# Kunci penguncian token. Wajib pada mode online.\n# Offline: jika kosong, aplikasi membuat secret acak di .madrasah-secrets/ (tidak masuk Git).\nTOKEN_LOCK_SECRET=\n# Hanya untuk migrasi satu kali signature token lama; jangan commit nilainya dan hapus setelah migrasi berhasil.\nTOKEN_LOCK_LEGACY_SECRET=`,
  'environment secret documentation');
fs.writeFileSync('.env.example', envExample);

fs.writeFileSync('firestore.rules', `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Firestore is not an active persistence backend for Madrasah Bisa.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`);

let audit = fs.readFileSync('scripts/security-audit.cjs', 'utf8');
if (!audit.includes("const { execFileSync } = require('child_process');")) {
  audit = replaceOnce(audit, "const fs = require('fs');", "const fs = require('fs');\nconst { execFileSync } = require('child_process');", 'audit import');
}
if (!audit.includes("const gitignore = fs.readFileSync('.gitignore', 'utf8');")) {
  audit = replaceOnce(audit,
    "const assessment = fs.readFileSync('src/assessmentModule.js', 'utf8');",
    `const assessment = fs.readFileSync('src/assessmentModule.js', 'utf8');
const gitignore = fs.readFileSync('.gitignore', 'utf8');
const firestoreRules = fs.readFileSync('firestore.rules', 'utf8');
const trackedFiles = new Set(execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split(/\\r?\\n/).filter(Boolean));
const trackedRuntimeUploads = [...trackedFiles].filter((p) => p.startsWith('uploads/') && !p.endsWith('/.gitkeep') && p !== 'uploads/.gitkeep');`,
    'audit metadata');
}
if (!audit.includes('Runtime local_store files are not tracked')) {
  const marker = "  ['CBT finish requires server master questions', server.includes('Kunci soal server tidak tersedia. Finalisasi ditolak')],\n];";
  audit = replaceOnce(audit, marker,
    `  ['CBT finish requires server master questions', server.includes('Kunci soal server tidak tersedia. Finalisasi ditolak')],
  ['Runtime local_store files are not tracked', !trackedFiles.has('local_store.json') && !trackedFiles.has('local_store.json.backup')],
  ['Runtime uploads are not tracked', trackedRuntimeUploads.length === 0],
  ['Runtime state and secrets are gitignored', gitignore.includes('local_store.json.*') && gitignore.includes('.madrasah-secrets/') && gitignore.includes('uploads/*')],
  ['Firestore is deny-all', firestoreRules.includes('allow read, write: if false') && !firestoreRules.includes('allow read, write: if true')],
  ['Local-store legacy key is environment-only', !server.includes('const LEGACY_ENCRYPTION_SECRET = "') && server.includes("readConfiguredSecret('LOCAL_STORE_LEGACY_SECRET')")],
  ['Token-lock legacy key is environment-only', !server.includes('const LEGACY_TOKEN_LOCK_SECRET = "') && server.includes("readConfiguredSecret('TOKEN_LOCK_LEGACY_SECRET')")],
  ['Online runtime secrets fail closed', server.includes('Cloud/online deployments must never silently fall back') && server.includes("resolveRuntimeSecret('LOCAL_STORE_SECRET'") && server.includes("resolveRuntimeSecret('TOKEN_LOCK_SECRET'")],
];`, 'audit blocker checks');
}
fs.writeFileSync('scripts/security-audit.cjs', audit);

let gate = fs.readFileSync('.github/workflows/redeploy-gate.yml', 'utf8');
if (!gate.includes('fetch-depth: 0')) {
  gate = replaceOnce(gate,
    '      - name: Checkout\n        uses: actions/checkout@v4',
    '      - name: Checkout\n        uses: actions/checkout@v4\n        with:\n          fetch-depth: 0', 'gate fetch depth');
}
if (!gate.includes('Verify sensitive runtime history is clean')) {
  gate = replaceOnce(gate,
    '      - name: Application security audit\n        run: npm run security:audit',
    `      - name: Application security audit
        run: npm run security:audit

      - name: Verify sensitive runtime history is clean
        shell: bash
        run: |
          leaked_paths="$(git rev-list --objects --all | grep -E ' (local_store\\.json(\\.backup)?|uploads/.+)$' | grep -v -E ' uploads/(attendance_photos/)?\\.gitkeep$' || true)"
          if [ -n "$leaked_paths" ]; then
            echo "Sensitive runtime files are still reachable in Git history."
            exit 1
          fi`, 'gate history check');
}
fs.writeFileSync('.github/workflows/redeploy-gate.yml', gate);
console.log('[redeploy-hardening] blocker patch staged successfully.');
