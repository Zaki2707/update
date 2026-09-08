from pathlib import Path

p = Path('server.ts')
s = p.read_text(encoding='utf-8')

old_gen = '''app.post("/api/boss/generate-activation-key", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  const { quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Jumlah token yang valid diperlukan." });
  }
  try {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(4).toString('hex').toUpperCase();
    const dataToSign = `UNIVERSAL_${nonce}:${qty}:${timestamp}`;

    // Always use deterministic HMAC signature so activation keys are universally valid anywhere
    const secret = TOKEN_LOCK_SECRET || LEGACY_TOKEN_LOCK_SECRET;
    const signature = "HMAC_" + crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');

    const activationKey = Buffer.from(`UNIVERSAL_${nonce}:${qty}:${timestamp}:${signature}`).toString('base64');
    return res.json({ success: true, activationKey });
  } catch (err: any) {
    console.error("Failed to generate activation key:", err);
    return res.status(500).json({ success: false, message: "Gagal menghasilkan kunci: " + err.message });
  }
});'''

new_gen = '''app.post("/api/boss/generate-activation-key", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  const { quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Jumlah token yang valid diperlukan." });
  }
  try {
    // Activation codes are asymmetric: only BOSS owns the private key, while offline madrasah installs
    // verify with the matching public key. TOKEN_LOCK_SECRET remains local and only seals local balances.
    if (!process.env.LICENSE_PRIVATE_KEY) {
      return res.status(503).json({
        success: false,
        code: 'ACTIVATION_SIGNING_KEY_NOT_CONFIGURED',
        message: 'Private key aktivasi BOSS belum dikonfigurasi. Isi LICENSE_PRIVATE_KEY dan LICENSE_PUBLIC_KEY pada environment server BOSS.'
      });
    }

    const privateKey = formatPrivateKeyPem(process.env.LICENSE_PRIVATE_KEY);
    const publicKey = formatPublicKeyPem(process.env.LICENSE_PUBLIC_KEY || LICENSE_PUBLIC_KEY);

    // Refuse to issue codes if the configured public/private keys are not a real pair.
    const probe = `MADRASAH_ACTIVATION_KEYPAIR_CHECK:${Date.now()}`;
    const probeSigner = crypto.createSign('SHA256');
    probeSigner.update(probe);
    probeSigner.end();
    const probeSignature = probeSigner.sign(privateKey, 'base64');
    const probeVerifier = crypto.createVerify('SHA256');
    probeVerifier.update(probe);
    probeVerifier.end();
    if (!probeVerifier.verify(publicKey, probeSignature, 'base64')) {
      return res.status(503).json({
        success: false,
        code: 'ACTIVATION_KEYPAIR_MISMATCH',
        message: 'LICENSE_PRIVATE_KEY dan LICENSE_PUBLIC_KEY pada server BOSS bukan pasangan yang sama.'
      });
    }

    const timestamp = Date.now();
    const nonce = crypto.randomBytes(8).toString('hex').toUpperCase();
    const activationId = `UNIVERSAL_RSA2_${nonce}`;
    const dataToSign = `${activationId}:${qty}:${timestamp}`;

    const signer = crypto.createSign('SHA256');
    signer.update(dataToSign);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');

    const activationKey = Buffer.from(`${dataToSign}:${signature}`).toString('base64');
    return res.json({ success: true, activationKey, signatureVersion: 'RSA2' });
  } catch (err: any) {
    console.error("Failed to generate activation key:", err);
    return res.status(500).json({ success: false, message: "Gagal menghasilkan kunci: " + err.message });
  }
});'''

if old_gen not in s:
    raise SystemExit('activation generator block not found')
s = s.replace(old_gen, new_gen, 1)

old_verify_keys = '''      const keyPair = getServerKeyPair();
      const keysToTry: string[] = [];
      if (keyPair?.publicKey) keysToTry.push(keyPair.publicKey);
      if (LICENSE_PUBLIC_KEY) keysToTry.push(LICENSE_PUBLIC_KEY);
'''
new_verify_keys = '''      const keysToTry: string[] = [];

      // Offline verification must never depend on this installation's TOKEN_LOCK_SECRET or an ephemeral keypair.
      // LICENSE_PUBLIC_KEY is safe to distribute to every offline madrasah installation.
      if (process.env.LICENSE_PUBLIC_KEY) {
        try { keysToTry.push(formatPublicKeyPem(process.env.LICENSE_PUBLIC_KEY)); } catch (_) {}
      }
      if (LICENSE_PUBLIC_KEY) keysToTry.push(formatPublicKeyPem(LICENSE_PUBLIC_KEY));

      // If this same process is also the configured BOSS signer, its configured pair may be used too.
      if (process.env.LICENSE_PRIVATE_KEY) {
        const keyPair = getServerKeyPair();
        if (keyPair?.publicKey) keysToTry.push(keyPair.publicKey);
      }

      const uniqueKeysToTry = Array.from(new Set(keysToTry.filter(Boolean)));
'''
if old_verify_keys not in s:
    raise SystemExit('RSA verifier key block not found')
s = s.replace(old_verify_keys, new_verify_keys, 1)

old_loop = '''      for (const pubKey of keysToTry) {'''
new_loop = '''      for (const pubKey of uniqueKeysToTry) {'''
if old_loop not in s:
    raise SystemExit('RSA verifier loop not found')
s = s.replace(old_loop, new_loop, 1)

p.write_text(s, encoding='utf-8')

# Document the asymmetric activation configuration without committing any private key.
env = Path('.env.example')
e = env.read_text(encoding='utf-8')
anchor = '''# Kunci Garam Rahasia untuk Penguncian Token (Required)\nTOKEN_LOCK_SECRET=\n'''
addition = '''# Kunci Garam Rahasia untuk Penguncian Token (Required)\nTOKEN_LOCK_SECRET=\n\n# Kunci Aktivasi Token Asimetris\n# LICENSE_PRIVATE_KEY hanya boleh ada di server BOSS online. JANGAN salin ke instalasi madrasah.\n# LICENSE_PUBLIC_KEY harus sama di BOSS dan instalasi admin offline; public key aman didistribusikan.\nLICENSE_PRIVATE_KEY=\nLICENSE_PUBLIC_KEY=\n'''
if 'LICENSE_PRIVATE_KEY=' not in e:
    if anchor not in e:
        raise SystemExit('.env.example token anchor not found')
    e = e.replace(anchor, addition, 1)
    env.write_text(e, encoding='utf-8')

# Permanent local helper: generates a pair and writes ignored env snippet files.
helper = Path('scripts/generate-license-keypair.cjs')
helper.write_text(r'''const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

const envValue = (pem) => pem.trim().replace(/\n/g, '\\n');
const bossFile = path.join(process.cwd(), '.env.license-boss');
const offlineFile = path.join(process.cwd(), '.env.license-offline');

fs.writeFileSync(bossFile,
  `LICENSE_PRIVATE_KEY=${envValue(privateKey)}\nLICENSE_PUBLIC_KEY=${envValue(publicKey)}\n`,
  { mode: 0o600 }
);
fs.writeFileSync(offlineFile,
  `LICENSE_PUBLIC_KEY=${envValue(publicKey)}\n`,
  { mode: 0o600 }
);

const fingerprint = crypto.createHash('sha256').update(publicKey).digest('hex');
console.log('Kunci aktivasi berhasil dibuat.');
console.log('BOSS online : .env.license-boss');
console.log('Admin offline: .env.license-offline');
console.log('Public-key fingerprint SHA-256:', fingerprint);
console.log('Jangan upload atau commit .env.license-boss.');
''', encoding='utf-8')
