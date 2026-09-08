from pathlib import Path

p = Path('server.ts')
s = p.read_text(encoding='utf-8')

def rep(old, new, count=1):
    global s
    actual = s.count(old)
    if actual < count:
        raise SystemExit(f'Expected at least {count} occurrence(s), found {actual}: {old[:120]!r}')
    s = s.replace(old, new, count)

# APP_MODE is storage-only; local runtime remains the token-security boundary.
rep("if (isOfflineMode && currentBalance > 1) {", "if (isLocalRuntime && currentBalance > 1) {")
rep("if (isOfflineMode) {\n    return res.status(403).json({ success: false, message: \"Persetujuan top-up tidak diizinkan dalam mode offline.\" });", "if (isLocalRuntime) {\n    return res.status(403).json({ success: false, message: \"Persetujuan top-up hanya diizinkan pada server platform Cloud Run.\" });")
rep("if (isOfflineMode) {\n    return res.status(403).json({ success: false, message: \"Pembaruan saldo token langsung dinonaktifkan dalam mode offline demi mencegah kecurangan.\" });", "if (isLocalRuntime) {\n    return res.status(403).json({ success: false, message: \"Pembaruan saldo token langsung hanya diizinkan pada server platform Cloud Run.\" });")
rep("if (isOfflineMode) {\n      // Ignore token balance changes from the general update API in offline mode to prevent cheating/tampering", "if (isLocalRuntime) {\n      // Never trust APP_MODE for token authority: localhost cannot alter protected token balance directly")

# Online must not bootstrap from local_store.json at all.
rep("const bootStore = readLocalStore();", "const bootStore = isOnlineMode ? {} : readLocalStore();")
rep("  let store: any = {};\n  try {\n    store = readLocalStore();\n  } catch (e) {\n    console.error(\"Failed to parse local_store.json during hydration. Falling back to clean memory state:\", e);\n    localStoreCache = {};\n  }", "  let store: any = {};\n  if (isOfflineMode) {\n    try {\n      store = readLocalStore();\n    } catch (e) {\n      console.error(\"Failed to parse local_store.json during offline hydration. Falling back to clean memory state:\", e);\n      localStoreCache = {};\n    }\n  } else {\n    // ONLINE never seeds runtime state from ephemeral Cloud Run disk. Cloud SQL is authoritative.\n    localStoreCache = {};\n  }")
rep("    if (res.rows.length === 0 && Object.keys(store).length > 0) {", "    if (isOfflineMode && res.rows.length === 0 && Object.keys(store).length > 0) {")
rep("    console.error(\"PostgreSQL hydration warning / timeout (falling back to local JSON store):\", err);", "    console.error(isOnlineMode\n      ? \"PostgreSQL hydration failed in ONLINE mode; local JSON fallback is disabled:\"\n      : \"PostgreSQL hydration warning / timeout (falling back to local JSON store):\", err);")

# Keep runtime logging accurate.
rep('console.log("Firebase Firestore has been completely disconnected per user instructions to avoid daily free-tier read limits. Application is fully using local storage and Cloudinary backup.");', 'console.log(`[Storage] ${isOnlineMode ? \'Cloud SQL + Cloudinary are authoritative\' : \'PostgreSQL/local_store.json + uploads are authoritative; Cloudinary is optional backup\'}.`);')

p.write_text(s, encoding='utf-8')
print('final storage/security cleanup applied')
# trigger
