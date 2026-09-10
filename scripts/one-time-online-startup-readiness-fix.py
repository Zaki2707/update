from pathlib import Path

p = Path('server.ts')
s = p.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    s = s.replace(old, new, 1)


replace_once(
    'let isRecreatingPool = false;\n',
    '''let isRecreatingPool = false;\nlet onlineRuntimeReady = !isOnlineMode;\nlet onlineRuntimeReadyAt: string | null = isOnlineMode ? null : new Date().toISOString();\nlet onlineRuntimeStartupError: string | null = null;\n''',
    'runtime readiness state'
)

replace_once(
    '// Hydrate from Database or local storage on startup\nasync function hydrate() {',
    '''let hasHydratedPersistentState = false;\n\n// Hydrate from Database or local storage on startup\nasync function hydrate() {''',
    'hydration success marker declaration'
)

replace_once(
    '''    await runOneTimeMigrations();\n    console.log("Database URL / SQL_HOST not set. Using local JSON store.");''',
    '''    await runOneTimeMigrations();\n    hasHydratedPersistentState = true;\n    console.log("Database URL / SQL_HOST not set. Using local JSON store.");''',
    'offline hydration success marker'
)

replace_once(
    '''    await runOneTimeMigrations();\n\n    console.log("All data hydrated successfully from PostgreSQL.");''',
    '''    await runOneTimeMigrations();\n    hasHydratedPersistentState = true;\n\n    console.log("All data hydrated successfully from PostgreSQL.");''',
    'postgres hydration success marker'
)

ensure_block = '''let hydratePromise: Promise<void> | null = null;\nfunction ensureHydrated() {\n  if (!hydratePromise) {\n    hydratePromise = hydrate();\n  }\n  return hydratePromise;\n}\n'''
helper_block = ensure_block + '''\nasync function initializeOnlineRuntimeBeforeListen() {\n  if (!isOnlineMode) return;\n\n  const maxAttempts = 3;\n  let lastErrorMessage = 'Cloud SQL belum siap.';\n\n  for (let attempt = 1; attempt <= maxAttempts; attempt++) {\n    try {\n      // Reuse the module-level initialization first. If it finished without a pool,\n      // create a fresh initialization attempt instead of waiting for a status-page probe.\n      if (dbInitPromise) await dbInitPromise;\n      if (!pool || isDbQuotaExceeded) {\n        isDbQuotaExceeded = false;\n        dbInitPromise = determineAndInitPool();\n        await dbInitPromise;\n      }\n      if (!pool || isDbQuotaExceeded) {\n        throw new Error('Cloud SQL pool belum tersedia.');\n      }\n\n      // A connected socket is not enough: the in-memory source of truth used by the\n      // application must also be fully reconstructed from app_store before traffic.\n      hasHydratedPersistentState = false;\n      hydratePromise = null;\n      await ensureHydrated();\n      if (!hasHydratedPersistentState) {\n        throw new Error('Cloud SQL terhubung tetapi hydration app_store belum selesai.');\n      }\n\n      await pool.query('SELECT 1');\n      onlineRuntimeReady = true;\n      onlineRuntimeReadyAt = new Date().toISOString();\n      onlineRuntimeStartupError = null;\n      console.log(`[Startup Readiness] Cloud SQL + app_store hydration READY (attempt ${attempt}/${maxAttempts}).`);\n      return;\n    } catch (err: any) {\n      lastErrorMessage = err?.message || String(err);\n      onlineRuntimeReady = false;\n      onlineRuntimeStartupError = lastErrorMessage;\n      console.warn(`[Startup Readiness] Attempt ${attempt}/${maxAttempts} belum siap: ${lastErrorMessage}`);\n\n      // If the current pool cannot answer a probe, dispose it so the next attempt\n      // creates a clean pool. This is startup-only and does not alter normal CBT recovery.\n      if (pool) {\n        try {\n          await pool.query('SELECT 1');\n        } catch (_) {\n          const failedPool = pool;\n          pool = null;\n          try { await failedPool.end(); } catch (_) {}\n        }\n      }\n\n      if (attempt < maxAttempts) {\n        await new Promise(resolve => setTimeout(resolve, attempt * 1000));\n      }\n    }\n  }\n\n  onlineRuntimeStartupError = lastErrorMessage;\n  throw new Error('ONLINE_STARTUP_NOT_READY: Cloud SQL dan hydration belum siap setelah retry startup.');\n}\n'''
replace_once(ensure_block, helper_block, 'online readiness initializer')

replace_once(
    '''app.get("/health", (req, res) => res.status(200).send("OK"));\napp.get("/healthz", (req, res) => res.status(200).send("OK"));\napp.get("/api/health", (req, res) => {\n  res.json({ status: "ok" });\n});''',
    '''app.get("/health", (req, res) => res.status(200).send("OK"));\napp.get("/healthz", (req, res) => res.status(200).send("OK"));\napp.get("/readyz", (req, res) => {\n  const ready = !isOnlineMode || Boolean(onlineRuntimeReady && hasHydratedPersistentState && pool && !isDbQuotaExceeded);\n  return res.status(ready ? 200 : 503).json({\n    status: ready ? 'ready' : 'starting',\n    ready,\n    mode: storageMode,\n    readyAt: onlineRuntimeReadyAt\n  });\n});\napp.get("/api/health", (req, res) => {\n  const ready = !isOnlineMode || Boolean(onlineRuntimeReady && hasHydratedPersistentState && pool && !isDbQuotaExceeded);\n  res.json({ status: ready ? "ok" : "starting", ready, mode: storageMode, readyAt: onlineRuntimeReadyAt });\n});''',
    'readiness health endpoint'
)

replace_once(
    '''async function startServer() {\n  if (process.env.NODE_ENV !== "production") {''',
    '''async function startServer() {\n  // ONLINE Cloud Run must not expose its listening port until Cloud SQL is usable\n  // and authoritative app_store state has been hydrated into memory. This removes\n  // the cold-start window where mutating CBT APIs could receive 503 DB-unavailable.\n  if (isOnlineMode) {\n    await initializeOnlineRuntimeBeforeListen();\n  }\n\n  if (process.env.NODE_ENV !== "production") {''',
    'wait before listen'
)

replace_once(
    '''if (!process.env.VERCEL) {\n  startServer();\n}\n''',
    '''if (!process.env.VERCEL) {\n  startServer().catch((err: any) => {\n    onlineRuntimeReady = false;\n    onlineRuntimeStartupError = err?.message || String(err);\n    console.error('[Startup Fatal] Server tidak dibuka karena runtime online belum siap:', onlineRuntimeStartupError);\n    process.exitCode = 1;\n    setTimeout(() => process.exit(1), 100);\n  });\n}\n''',
    'startup fatal handling'
)

p.write_text(s, encoding='utf-8')
print('Applied online startup readiness fix to server.ts')
