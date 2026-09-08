from pathlib import Path

p = Path('server.ts')
s = p.read_text(encoding='utf-8')

old_missing = '''    if (!m.tokenSignature) {
      if (isOfflineMode && currentBalance > 1) {
        console.error(`[CRITICAL TOKEN TAMPERING DETECTED] Madrasah \"${m.name}\" (${m.id}) tokens have been modified illegally! Empty signature with balance > 1 is not allowed in offline mode. Resetting tokens to 1.`);
        m.cbtTokenBalance = 1;
        m.tokenSignature = calculateTokenSignature(m.id, 1);
        tampered = true;
      } else {
        // First-time load or newly registered madrasah: compute and assign a valid signature
        m.tokenSignature = expectedSig;
        tampered = true;
      }
    } else if (TOKEN_LOCK_SECRET && m.tokenSignature === expectedLegacySig) {
       // Migrate to new signature
       m.tokenSignature = expectedSig;
       tampered = true;
    } else if (m.tokenSignature !== expectedSig && m.tokenSignature !== expectedLegacySig) {
      // TAMPERING DETECTED!
      console.error(`[CRITICAL TOKEN TAMPERING DETECTED] Madrasah \"${m.name}\" (${m.id}) tokens have been modified illegally! Resetting tokens to 0.`);
      m.cbtTokenBalance = 0;
      m.tokenSignature = calculateTokenSignature(m.id, 0);
      tampered = true;
    }'''

new_missing = '''    if (!m.tokenSignature) {
      if (isOfflineMode && currentBalance > 1) {
        // Preserve the stored balance, but quarantine it until an official token action reseals it.
        m.tokenSignatureInvalid = true;
        console.error(`[TOKEN SIGNATURE INVALID] Madrasah \"${m.name}\" (${m.id}) has balance ${currentBalance} without a valid signature. Balance preserved; token use is blocked until resealed.`);
      } else {
        // First-time load or newly registered madrasah: compute and assign a valid signature
        m.tokenSignature = expectedSig;
        delete m.tokenSignatureInvalid;
        tampered = true;
      }
    } else if (TOKEN_LOCK_SECRET && m.tokenSignature === expectedLegacySig) {
       // Migrate to new signature
       m.tokenSignature = expectedSig;
       delete m.tokenSignatureInvalid;
       tampered = true;
    } else if (m.tokenSignature !== expectedSig && m.tokenSignature !== expectedLegacySig) {
      // Preserve data on mismatch. Do not destructively overwrite the balance.
      m.tokenSignatureInvalid = true;
      console.error(`[TOKEN SIGNATURE INVALID] Madrasah \"${m.name}\" (${m.id}) signature mismatch. Balance ${currentBalance} preserved; token use is blocked until resealed.`);
    } else {
      delete m.tokenSignatureInvalid;
    }'''

if old_missing not in s:
    raise SystemExit('token verification target not found')
s = s.replace(old_missing, new_missing, 1)

old_save = '''  if (key === 'madrasahs' && Array.isArray(value)) {
    for (const m of value) {
      m.tokenSignature = calculateTokenSignature(m.id, m.cbtTokenBalance || 0);
    }
  }'''
new_save = '''  if (key === 'madrasahs' && Array.isArray(value)) {
    for (const m of value) {
      // Never silently legitimize a balance that failed signature verification.
      if (m.tokenSignatureInvalid) continue;
      m.tokenSignature = calculateTokenSignature(m.id, m.cbtTokenBalance || 0);
    }
  }'''
if old_save not in s:
    raise SystemExit('saveData signing target not found')
s = s.replace(old_save, new_save, 1)

# Official madrasah token additions/updates reseal the balance and clear quarantine.
s = s.replace(
    '''    targetM.cbtTokenBalance = (targetM.cbtTokenBalance || 0) + addQty;\n  }''',
    '''    targetM.cbtTokenBalance = (targetM.cbtTokenBalance || 0) + addQty;\n    delete targetM.tokenSignatureInvalid;\n    targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);\n  }'''
)

s = s.replace(
    '''  } else if (deltaTokens !== undefined) {\n    targetM.cbtTokenBalance = Math.max(0, (targetM.cbtTokenBalance || 0) + (parseInt(deltaTokens, 10) || 0));\n  }\n  await saveData('madrasahs', madrasahs);''',
    '''  } else if (deltaTokens !== undefined) {\n    targetM.cbtTokenBalance = Math.max(0, (targetM.cbtTokenBalance || 0) + (parseInt(deltaTokens, 10) || 0));\n  }\n  delete targetM.tokenSignatureInvalid;\n  targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance || 0);\n  await saveData('madrasahs', madrasahs);'''
)

s = s.replace(
    '''    targetM.cbtTokenBalance = (targetM.cbtTokenBalance || 0) + qty;\n    // Seal with HMAC local signature\n    targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);''',
    '''    targetM.cbtTokenBalance = (targetM.cbtTokenBalance || 0) + qty;\n    // Seal with HMAC local signature\n    delete targetM.tokenSignatureInvalid;\n    targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);'''
)

# Prevent quarantined balances from being consumed. Apply to mirrored madrasah token-consumption paths.
needle = '''    if ((targetM.cbtTokenBalance || 0) <= 0) {
      return res.status(400).json({
        success: false,
        message: `Saldo Token Ujian madrasah habis (0 Token). Harga token: Rp ${cbtTokenPrice.toLocaleString('id-ID')}/token.`
      });
    }
    targetM.cbtTokenBalance -= 1;'''
replacement = '''    if (targetM.tokenSignatureInvalid) {
      return res.status(409).json({
        success: false,
        code: 'TOKEN_SIGNATURE_RESEAL_REQUIRED',
        message: 'Saldo token tersimpan tetapi signature perlu diverifikasi ulang melalui jalur resmi BOSS/top-up sebelum digunakan.'
      });
    }
    if ((targetM.cbtTokenBalance || 0) <= 0) {
      return res.status(400).json({
        success: false,
        message: `Saldo Token Ujian madrasah habis (0 Token). Harga token: Rp ${cbtTokenPrice.toLocaleString('id-ID')}/token.`
      });
    }
    targetM.cbtTokenBalance -= 1;'''
if needle not in s:
    raise SystemExit('token consumption target not found')
s = s.replace(needle, replacement)

# Every legitimate consumption already reseals the new balance; clear quarantine defensively before saving.
s = s.replace(
    '''    targetM.cbtTokenBalance -= 1;\n    // Re-sign balance to prevent false-positive tamper detection on next startup\n    targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);''',
    '''    targetM.cbtTokenBalance -= 1;\n    // Re-sign balance to prevent false-positive tamper detection on next startup\n    delete targetM.tokenSignatureInvalid;\n    targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);'''
)

# General madrasah token update path (used outside offline mode) also reseals explicitly.
s = s.replace(
    '''      targetM.cbtTokenBalance = Math.max(0, parseInt(cbtTokenBalance, 10) || 0);\n      targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);''',
    '''      targetM.cbtTokenBalance = Math.max(0, parseInt(cbtTokenBalance, 10) || 0);\n      delete targetM.tokenSignatureInvalid;\n      targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);'''
)

p.write_text(s, encoding='utf-8')
