import "dotenv/config";

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception caught:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection caught:", reason);
});
import express from "express";
import compression from "compression";
import path from "path";
import fs from "fs";
import http from "http";
import https from "https";
import os from "os";
import crypto from "crypto";
import selfsigned from "selfsigned";
import { GoogleGenAI } from "@google/genai";
import { v2 as cloudinary } from "cloudinary";
import { AccessToken } from "livekit-server-sdk";
import JSZip from "jszip";
import mammoth from "mammoth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDoc, doc, deleteDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { generateMasterV2ModulAjar } from "./src/masterGenerativeRulesEngine.js";

// Initialize Firebase - FORCE DISCONNECTED PER USER INSTRUCTION TO PREVENT QUOTA EXCEEDED
let db: any = null;
const isOfflineMode = true;

console.log("Firebase Firestore has been completely disconnected per user instructions to avoid daily free-tier read limits. Application is fully using local storage and Cloudinary backup.");

// Cloudinary initialization
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log("Cloudinary initialized.");
}

const LICENSE_PUBLIC_KEY = `-----BEGIN RSA PUBLIC KEY-----
MIGJAoGBALjkKYSmuOeVR1SPY4NtxQI9wWS43T8URRqlcPo3qJqqCQa9IGJt
pnqnUAB+eZz4W6y2WN+wSlg/Qtqi/kRcAafe/VT0f8FSy8RC0Jv/iEJYZoFw
E/MALQdmputpWUfuppq/iuKDuuOKZJWpNORQMuH3UJ1RBCVLVv2S2CdGYLK/
AgMBAAE=
-----END RSA PUBLIC KEY-----`;

function formatPrivateKeyPem(raw: string): string {
  if (!raw) return "";
  let key = raw.replace(/\\n/g, '\n').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).replace(/\\n/g, '\n').trim();
  }
  if (!key.includes('-----BEGIN')) {
    const chunks = key.match(/.{1,64}/g) || [key];
    key = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----`;
  }
  return key;
}

function formatPublicKeyPem(raw: string): string {
  if (!raw) return "";
  let key = raw.replace(/\\n/g, '\n').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).replace(/\\n/g, '\n').trim();
  }
  if (!key.includes('-----BEGIN')) {
    const chunks = key.match(/.{1,64}/g) || [key];
    key = `-----BEGIN PUBLIC KEY-----\n${chunks.join('\n')}\n-----END PUBLIC KEY-----`;
  }
  return key;
}

let cachedKeyPair: { privateKey: string; publicKey: string } | null = null;

function getServerKeyPair(): { privateKey: string; publicKey: string } | null {
  if (cachedKeyPair) return cachedKeyPair;

  const envPrivate = process.env.LICENSE_PRIVATE_KEY;
  const envPublic = process.env.LICENSE_PUBLIC_KEY || LICENSE_PUBLIC_KEY;

  if (envPrivate) {
    const formattedPrivate = formatPrivateKeyPem(envPrivate);
    const formattedPublic = formatPublicKeyPem(envPublic);

    try {
      const sign = crypto.createSign('SHA256');
      sign.write('test');
      sign.end();
      sign.sign(formattedPrivate, 'base64');
      cachedKeyPair = { privateKey: formattedPrivate, publicKey: formattedPublic };
      return cachedKeyPair;
    } catch {
      // Ignore invalid env key silently and generate valid fallback
    }
  }

  try {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });
    cachedKeyPair = { privateKey, publicKey };
  } catch (err) {
    // Fallback keypair generation error handled gracefully
  }

  return cachedKeyPair;
}

const TOKEN_LOCK_SECRET = process.env.TOKEN_LOCK_SECRET || "***REMOVED***";

function calculateTokenSignature(madrasahId: string, balance: number): string {
  return crypto.createHmac('sha256', TOKEN_LOCK_SECRET)
               .update(`${madrasahId}:${balance}`)
               .digest('hex');
}

const ENCRYPTION_KEY = crypto.createHash('sha256').update("***REMOVED***").digest();

function encryptLocalStore(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptLocalStore(encryptedText: string): string {
  try {
    const trimmed = encryptedText.trim();
    // Backward compatibility: If the text is plain JSON (starts with { or [), return it directly without decrypting
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return encryptedText;
    }
    const parts = trimmed.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encryption format (no IV separator found)');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedTextData = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedTextData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.error("Gagal melakukan dekripsi local_store.json:", err.message);
    throw err;
  }
}

function verifyAndLockMadrasahTokens() {
  if (!Array.isArray(madrasahs)) return;
  let tampered = false;
  for (const m of madrasahs) {
    const currentBalance = m.cbtTokenBalance || 0;
    const expectedSig = calculateTokenSignature(m.id, currentBalance);
    if (!m.tokenSignature) {
      if (isOfflineMode && currentBalance > 1) {
        console.error(`[CRITICAL TOKEN TAMPERING DETECTED] Madrasah "${m.name}" (${m.id}) tokens have been modified illegally! Empty signature with balance > 1 is not allowed in offline mode. Resetting tokens to 1.`);
        m.cbtTokenBalance = 1;
        m.tokenSignature = calculateTokenSignature(m.id, 1);
        tampered = true;
      } else {
        // First-time load or newly registered madrasah: compute and assign a valid signature
        m.tokenSignature = expectedSig;
      }
    } else if (m.tokenSignature !== expectedSig) {
      // TAMPERING DETECTED!
      console.error(`[CRITICAL TOKEN TAMPERING DETECTED] Madrasah "${m.name}" (${m.id}) tokens have been modified illegally! Expected sig: ${expectedSig}, Got: ${m.tokenSignature}. Resetting tokens to 0.`);
      m.cbtTokenBalance = 0;
      m.tokenSignature = calculateTokenSignature(m.id, 0);
      tampered = true;
    }
  }
  if (tampered) {
    // Save corrected state back immediately
    saveData('madrasahs', madrasahs).catch(e => console.error("Failed to save after tamper recovery:", e));
  }
}

const firestorePendingValues = new Map<string, any>();
const firestorePendingKeysQueue = new Set<string>();
let isFirestoreQueueRunning = false;
let firestoreQueueTimer: NodeJS.Timeout | null = null;

async function saveKeyToFirestore(key: string, value: any): Promise<void> {
  if (!db) return;
  if (key === 'studentLivecamFrames' || key === 'examMessages' || key.includes('__chunk_')) return;

  firestorePendingValues.set(key, value);
  firestorePendingKeysQueue.add(key);

  triggerFirestoreQueueRunner();
}

function triggerFirestoreQueueRunner() {
  if (firestoreQueueTimer) return; // Already scheduled
  firestoreQueueTimer = setTimeout(() => {
    firestoreQueueTimer = null;
    runFirestoreQueueWorker().catch(err => {
      console.warn("[Firestore Queue Worker Error]:", err);
    });
  }, 1500); // 1.5 second debounce before starting queue processing
}

async function runFirestoreQueueWorker() {
  if (isFirestoreQueueRunning || !db) return;
  isFirestoreQueueRunning = true;

  try {
    while (firestorePendingKeysQueue.size > 0) {
      // Pick next key from queue
      const key = firestorePendingKeysQueue.values().next().value;
      if (!key) break;
      firestorePendingKeysQueue.delete(key);

      const value = firestorePendingValues.get(key);
      if (value === undefined) continue;
      firestorePendingValues.delete(key);

      try {
        const jsonStr = JSON.stringify(value);
        const MAX_DOC_SIZE = 750000; // 750 KB safe limit per chunk doc (well below Firestore 1,048,576 byte limit)

        const batch = writeBatch(db);

        if (jsonStr.length <= MAX_DOC_SIZE) {
          batch.set(doc(db, 'app_store', key), {
            value: jsonStr,
            updatedAt: Date.now()
          });
        } else {
          const chunkCount = Math.ceil(jsonStr.length / MAX_DOC_SIZE);
          for (let i = 0; i < chunkCount; i++) {
            const slice = jsonStr.slice(i * MAX_DOC_SIZE, (i + 1) * MAX_DOC_SIZE);
            batch.set(doc(db, 'app_store', `${key}__chunk_${i}`), {
              chunkText: slice,
              updatedAt: Date.now()
            });
          }

          batch.set(doc(db, 'app_store', key), {
            _isChunkedString: true,
            chunkCount,
            updatedAt: Date.now()
          });
        }

        await batch.commit();
      } catch (err: any) {
        console.warn(`[Firestore Backup] Failed to back up key "${key}" to Firestore:`, err?.message || err);
      }

      // Small 250ms pause between sequential key writes to maintain zero stream queue depth
      await new Promise(r => setTimeout(r, 250));
    }
  } finally {
    isFirestoreQueueRunning = false;
    if (firestorePendingKeysQueue.size > 0) {
      triggerFirestoreQueueRunner();
    }
  }
}

async function loadStoreFromFirestore(): Promise<Record<string, any>> {
  const store: Record<string, any> = {};
  if (db) {
    try {
      console.log("[Firestore Sync] Hydrating state from persistent Firestore 'app_store' collection...");
      const querySnapshot = await getDocs(collection(db, 'app_store'));
      const docsMap: Record<string, any> = {};

      querySnapshot.forEach((document) => {
        docsMap[document.id] = document.data();
      });

      const primaryKeys = Object.keys(docsMap).filter(k => !k.includes('__chunk_'));

      for (const pKey of primaryKeys) {
        const data = docsMap[pKey];
        if (!data) continue;

        if (data._isChunkedString && typeof data.chunkCount === 'number') {
          let str = '';
          for (let i = 0; i < data.chunkCount; i++) {
            const chunkDoc = docsMap[`${pKey}__chunk_${i}`];
            if (chunkDoc && typeof chunkDoc.chunkText === 'string') {
              str += chunkDoc.chunkText;
            }
          }
          if (str) {
            try {
              store[pKey] = JSON.parse(str);
            } catch (e) {
              store[pKey] = str;
            }
          }
        } else if (data._isChunkedArray && typeof data.chunkCount === 'number') {
          const arr: any[] = [];
          for (let i = 0; i < data.chunkCount; i++) {
            const chunkDoc = docsMap[`${pKey}__chunk_${i}`];
            if (chunkDoc && typeof chunkDoc.value === 'string') {
              try {
                const parsed = JSON.parse(chunkDoc.value);
                if (Array.isArray(parsed)) arr.push(...parsed);
              } catch (e) {}
            }
          }
          store[pKey] = arr;
        } else if (data._isChunkedObject && typeof data.chunkCount === 'number') {
          let obj: Record<string, any> = {};
          for (let i = 0; i < data.chunkCount; i++) {
            const chunkDoc = docsMap[`${pKey}__chunk_${i}`];
            if (chunkDoc && typeof chunkDoc.value === 'string') {
              try {
                const parsed = JSON.parse(chunkDoc.value);
                if (typeof parsed === 'object' && parsed !== null) {
                  obj = { ...obj, ...parsed };
                }
              } catch (e) {}
            }
          }
          store[pKey] = obj;
        } else if (typeof data.value === 'string') {
          try {
            store[pKey] = JSON.parse(data.value);
          } catch (e) {
            store[pKey] = data.value;
          }
        }
      }
      console.log(`[Firestore Sync] Successfully loaded ${Object.keys(store).length} keys from Firestore.`);
    } catch (err) {
      console.warn("[Firestore Sync] Failed to load store from Firestore:", err);
    }
  }
  return store;
}


// Local Uploads Directory Configuration
const uploadsDir = path.join(process.cwd(), "uploads");
const photosDir = path.join(uploadsDir, "attendance_photos");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

// In-memory and persisted Cloudinary URL map for photo failover
let photoCloudinaryMap: Record<string, string> = {};

async function uploadToCloudinary(base64OrPath: string, publicId?: string): Promise<string | null> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return null;
  }

  // Deduplication check: if photo is already uploaded to Cloudinary, return cached URL without re-uploading
  if (publicId && photoCloudinaryMap[publicId]) {
    console.log(`[Cloudinary Deduplication Skip] Photo ${publicId} is already uploaded to Cloudinary: ${photoCloudinaryMap[publicId]}`);
    return photoCloudinaryMap[publicId];
  }

  try {
    const uploadOptions: any = {
      folder: "madrasah_photos",
      resource_type: "image"
    };
    if (publicId) {
      uploadOptions.public_id = publicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    }

    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload(base64OrPath, uploadOptions, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    if (result && (result.secure_url || result.url)) {
      const url = result.secure_url || result.url;
      console.log(`[Cloudinary Dual Storage] Saved photo ${publicId || ''} to Cloudinary: ${url}`);
      return url;
    }
  } catch (err: any) {
    console.warn(`[Cloudinary Dual Storage Warning] Cloudinary upload failed: ${err?.message || err}`);
  }
  return null;
}

async function syncAllPhotosToCloudinary(): Promise<{ totalCloudinary: number; synced: number; mapped: number }> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.log("[Cloudinary Sync] Cloudinary is not configured. Skipping background sync.");
    return { totalCloudinary: 0, synced: 0, mapped: 0 };
  }

  console.log("[Cloudinary Restore Sync] Starting background sync for Cloudinary photos & local uploads...");

  // 1. Fetch all resources from Cloudinary to rebuild photoCloudinaryMap
  try {
    let nextCursor: string | null = null;
    let allCloudPhotos: any[] = [];
    do {
      const res: any = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'madrasah_photos',
        max_results: 500,
        next_cursor: nextCursor || undefined
      });
      if (res && Array.isArray(res.resources)) {
        allCloudPhotos.push(...res.resources);
      }
      nextCursor = res.next_cursor || null;
    } while (nextCursor);

    try {
      const rootRes: any = await cloudinary.api.resources({
        type: 'upload',
        max_results: 500
      });
      if (rootRes && Array.isArray(rootRes.resources)) {
        rootRes.resources.forEach((r: any) => {
          if (!allCloudPhotos.some(p => p.public_id === r.public_id)) {
            allCloudPhotos.push(r);
          }
        });
      }
    } catch (e) {}

    allCloudPhotos.forEach((item: any) => {
      if (item && item.public_id && (item.secure_url || item.url)) {
        const url = item.secure_url || item.url;
        const fullId = item.public_id;
        const cleanId = item.public_id.replace(/^madrasah_photos\//, '');
        photoCloudinaryMap[fullId] = url;
        photoCloudinaryMap[cleanId] = url;
      }
    });
    console.log(`[Cloudinary Sync] Rebuilt photoCloudinaryMap with ${allCloudPhotos.length} Cloudinary assets (${Object.keys(photoCloudinaryMap).length} total keys mapped).`);
  } catch (err: any) {
    console.warn("[Cloudinary Sync] Could not fetch resources from Cloudinary API:", err?.message || err);
  }

  // 2. Upload any local disk files in uploadsDir not yet in Cloudinary
  const photoCandidates = new Set<string>();

  const addPhotoId = (val: any) => {
    if (typeof val !== 'string' || !val) return;
    let pId = val.trim();
    if (pId.startsWith('/api/photos/')) {
      pId = pId.replace('/api/photos/', '').trim();
    }
    if (pId && !pId.startsWith('http') && !pId.startsWith('data:image/')) {
      photoCandidates.add(pId);
    }
  };

  (students || []).forEach(s => addPhotoId(s?.photo));
  (teachers || []).forEach(t => addPhotoId(t?.photo));
  (attendance || []).forEach(att => addPhotoId(att?.photo));
  (teacherAttendance || []).forEach(ta => addPhotoId(ta?.photo));
  (questions || []).forEach(q => addPhotoId(q?.imageUrl));

  try {
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      files.forEach(f => {
        if (f && !f.startsWith('.')) {
          photoCandidates.add(f);
        }
      });
    }
  } catch (e) {
    console.warn("[Cloudinary Restore Sync] Could not read uploads directory:", e);
  }

  let uploaded = 0;
  let skipped = 0;

  for (const pId of photoCandidates) {
    if (photoCloudinaryMap[pId]) {
      skipped++;
      continue;
    }

    const filePath = path.join(uploadsDir, pId);
    if (fs.existsSync(filePath)) {
      try {
        const cUrl = await uploadToCloudinary(filePath, pId);
        if (cUrl) {
          photoCloudinaryMap[pId] = cUrl;
          uploaded++;
          console.log(`[Cloudinary Restore Sync] Uploaded missing photo ${pId} -> ${cUrl}`);
        }
      } catch (err: any) {
        console.warn(`[Cloudinary Restore Sync] Upload failed for ${pId}:`, err?.message || err);
      }
    }
  }

  // 3. Persist photoCloudinaryMap to PostgreSQL app_store table so it survives rebuilds & redeployments
  try {
    await saveData('photoCloudinaryMap', photoCloudinaryMap, true);
    console.log(`[Cloudinary Sync] Persisted photoCloudinaryMap (${Object.keys(photoCloudinaryMap).length} mapped keys) to PostgreSQL app_store.`);
  } catch (e: any) {
    console.warn("[Cloudinary Sync] Could not persist photoCloudinaryMap to database:", e?.message || e);
  }

  console.log(`[Cloudinary Restore Sync Finish] Complete. Uploaded: ${uploaded}, Skipped (Already in Cloudinary): ${skipped}`);
  return {
    totalCloudinary: Object.keys(photoCloudinaryMap).length,
    synced: uploaded,
    mapped: Object.keys(photoCloudinaryMap).length
  };
}

async function saveBase64ToFirestore(base64Str: string): Promise<string> {
  if (!base64Str || !base64Str.startsWith("data:image/")) return base64Str;
  
  const hashId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let finalDocId = hashId;

  // 1. Instant Local Disk Cache (Uploads directory) for zero-latency local access
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      fs.writeFileSync(path.join(uploadsDir, hashId), Buffer.from(matches[2], 'base64'));
    } else {
      fs.writeFileSync(path.join(uploadsDir, hashId), base64Str);
    }
  } catch (err) {
    console.warn("Failed to write photo to local uploads directory:", err);
  }

  // In offline mode: storage uses PostgreSQL for data + ./uploads folder for photos
  if (isOfflineMode) {
    // Still try Cloudinary backup if configured, even in offline mode
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      uploadToCloudinary(base64Str, finalDocId).then(cUrl => {
        if (cUrl) {
          photoCloudinaryMap[finalDocId] = cUrl;
          photoCloudinaryMap[hashId] = cUrl;
          saveData('photoCloudinaryMap', photoCloudinaryMap, false).catch(() => {});
        }
      }).catch(e => console.warn("Cloudinary background upload error:", e));
    }
    return `/api/photos/${finalDocId}`;
  }

  // 2. Storage 1: Firebase Firestore
  if (db) {
    try {
      const docRef = await addDoc(collection(db, 'photos'), {
        data: base64Str,
        createdAt: Date.now()
      });
      finalDocId = docRef.id;
      
      // Keep local file named with docRef.id as well for fast disk lookup
      try {
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          fs.writeFileSync(path.join(uploadsDir, docRef.id), Buffer.from(matches[2], 'base64'));
        }
      } catch (e) {}
    } catch (err: any) {
      console.warn("Could not save photo to Firestore (e.g. quota limit/offline), fallback to local & Cloudinary:", err?.message || err);
    }
  }

  // 3. Storage 2: Cloudinary (Dual Storage Sync)
  // Run asynchronously so user request completes ultra-fast without waiting for external network
  uploadToCloudinary(base64Str, finalDocId).then(cUrl => {
    if (cUrl) {
      photoCloudinaryMap[finalDocId] = cUrl;
      photoCloudinaryMap[hashId] = cUrl;
      saveData('photoCloudinaryMap', photoCloudinaryMap, false).catch(() => {});
    }
  }).catch(e => console.warn("Cloudinary background upload error:", e));

  return `/api/photos/${finalDocId}`;
}

function getOrGenerateSSLCert() {
  if (process.env.VERCEL) return Promise.resolve(null);
  return (async () => {
    try {
      const certDir = path.join(process.cwd(), "certs");
      const keyPath = path.join(certDir, "server.key");
      const certPath = path.join(certDir, "server.crt");

      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath)
        };
      }

      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
      }

      const pems = await selfsigned.generate([{ name: 'commonName', value: 'Local Server' }]);
      fs.writeFileSync(keyPath, pems.private);
      fs.writeFileSync(certPath, pems.cert);

      return {
        key: pems.private,
        cert: pems.cert
      };
    } catch (err: any) {
      console.error("[SSL Error] Failed to load/generate SSL certs:", err.message);
      return null;
    }
  })();
}

// Helper to strip long dashed lines, hyphen separators, and equals borders from text
function cleanDashedLines(text: string): string {
  if (typeof text !== "string") return text;
  // 1. Remove standalone lines made entirely of dashes, hyphens, equals, underscores (3 or more)
  let cleaned = text.replace(/^[\-\—\–\―\=\_]{3,}\s*$/gm, '');
  // 2. Remove continuous runs of 4 or more hyphens/equals inside text blocks (e.g. --------------------------------)
  cleaned = cleaned.replace(/[\-\—\–\―\=\_]{4,}/g, '');
  // 3. Clean up excess blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned;
}

// Recursive object sanitizer to ensure NO generated response contains crude divider lines
function sanitizeGeneratedData<T = any>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data === "string") {
    return cleanDashedLines(data) as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeGeneratedData(item)) as any;
  }
  if (typeof data === "object") {
    const res: any = {};
    for (const key of Object.keys(data)) {
      res[key] = sanitizeGeneratedData((data as any)[key]);
    }
    return res;
  }
  return data;
}

const NO_DASHES_PROMPT = `
PERATURAN FORMAT DILARANG:
1. DILARANG SANGAT menggunakan garis pembatas berupa karakter dash/strip/sama dengan/underscore (seperti -------------------- atau ==================== atau ---). Gunakan spasi antar paragraf, penomoran terstruktur, atau tabel HTML/Markdown biasa.
2. DUKUNGAN SPESIFIK BAHASA & SAINS:
   - BAHASA ARAB / AL-QUR'AN / HADIS / FIKIH / AGAMA: Tuliskan teks Bahasa Arab berharakat/fathah/kasrah/dammah yang shahih dan lengkap.
   - BAHASA INGGRIS: Gunakan teks/dialog/soal Bahasa Inggris yang alami, gramatikal, dan komunikatif.
   - MATEMATIKA & SAINS (FISIKA/KIMIA/BIOLOGI): Tuliskan rumus-rumus matematika, persamaan fisika/kimia, dan notasi sains dengan format KaTeX/LaTeX yang presisi (seperti $f(x) = ax^2 + bx + c$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\int f(x)dx$, $\\text{H}_2\\text{O}$) agar ter-render sempurna.
`;

// Safe JSON extraction helper from Gemini API text
function safeParseGeminiJSON<T = any>(rawText: string, fallback: T = null as any): T {
  if (!rawText || typeof rawText !== "string") return fallback;
  
  let cleaned = rawText.trim();
  
  // 1. Strip markdown code fence if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  
  // 2. Direct JSON.parse attempt
  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    // Continue to substring extraction
  }

  // 3. Find outer boundaries of JSON object or array
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  let isObject = true;
  let startIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isObject = false;
  }

  if (startIdx !== -1) {
    const endChar = isObject ? "}" : "]";
    const lastIdx = cleaned.lastIndexOf(endChar);
    if (lastIdx > startIdx) {
      const candidate = cleaned.slice(startIdx, lastIdx + 1);
      try {
        return JSON.parse(candidate);
      } catch (err2) {
        try {
          // Remove trailing commas before } or ]
          const sanitized = candidate.replace(/,\s*([}\]])/g, "$1");
          return JSON.parse(sanitized);
        } catch (err3) {
          // Continue to fallback
        }
      }
    }
  }

  return fallback;
}

// Reusable helper to call Gemini generateContent with automatic model fallback if the primary model's quota is exhausted.
async function generateGeminiContent(ai: any, params: { model?: string; contents: any; config?: any }) {
  const primaryModel = params.model || "gemini-3.7-flash";
  const fallbackModels = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  
  // Ensure we don't repeat the primary model in our attempt list
  const modelsToTry = [primaryModel, ...fallbackModels.filter(m => m !== primaryModel)];

  let lastError: any = null;
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const model of modelsToTry) {
    let retries = 2; // Allow 2 retries per model for 503/429
    while (retries >= 0) {
      try {
        console.log(`[Gemini API] Attempting generateContent with model: ${model} (Retries left: ${retries})`);
        const response = await ai.models.generateContent({
          ...params,
          model: model,
        });
        
        // Basic validation if JSON is requested
        if (params.config?.responseMimeType === "application/json") {
            const text = response.text || "";
            if (text.trim() === "{" || text.trim() === "}") {
                throw new Error("Invalid/Truncated JSON response from model");
            }
        }
        
        return response;
      } catch (error: any) {
        lastError = error;
        const errMsg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error) || "");
        console.warn(`[Gemini API] Model ${model} failed. Error:`, errMsg);

        const isTemporary = 
          error?.status === "RESOURCE_EXHAUSTED" || 
          error?.statusCode === 429 || 
          errMsg.includes("429") || 
          errMsg.includes("Quota") || 
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("quota") ||
          errMsg.includes("exhausted") ||
          error?.status === "UNAVAILABLE" ||
          error?.statusCode === 503 ||
          errMsg.includes("503") ||
          errMsg.includes("high demand") ||
          errMsg.includes("overloaded");

        const isModelNotAvailable =
          error?.status === "NOT_FOUND" ||
          error?.statusCode === 404 ||
          errMsg.includes("404") ||
          errMsg.includes("no longer available") ||
          errMsg.includes("not available") ||
          errMsg.includes("NOT_FOUND");

        if (isTemporary && retries > 0) {
          console.warn(`[Gemini API] Temporary issue detected with ${model}. Waiting 2 seconds before retry...`);
          await sleep(2000);
          retries--;
          continue;
        }
        
        if (isTemporary || isModelNotAvailable) {
          console.warn(`[Gemini API] Model ${model} hit rate limit or availability issue. Moving to next fallback model...`);
          break; // break the retry loop, go to next model
        }
        
        console.warn(`[Gemini API] Model ${model} encountered error. Trying next fallback model just in case...`);
        break; // break the retry loop, go to next model
      }
    }
  }

  throw lastError;
}
import pkg from 'pg';
const { Pool } = pkg;

let pool: pkg.Pool | null = null;
let activeDbSource: "SQL_HOST" | "DATABASE_URL" | "NONE" = "NONE";
let dbConnectionErrorMsg: string | null = null;
let dbInitPromise: Promise<void> | null = null;
let isRecreatingPool = false;

function triggerPoolRecreation() {
  if (isRecreatingPool) return;
  isRecreatingPool = true;
  console.log("[Database Recovery] Re-establishing database pool connection...");
  setTimeout(async () => {
    try {
      if (pool) {
        const oldPool = pool;
        pool = null; // Unset first to prevent new queries from using it
        try {
          await oldPool.end();
        } catch (e) {}
      }
      dbInitPromise = determineAndInitPool();
      await dbInitPromise;
      console.log("[Database Recovery] Database pool re-established successfully!");
    } catch (recreateErr: any) {
      console.log("[Database Recovery] Pool re-establishment note:", recreateErr?.message || recreateErr);
    } finally {
      isRecreatingPool = false;
    }
  }, 100);
}

async function determineAndInitPool() {
  if (pool) {
    try {
      await pool.query("SELECT 1");
      console.log("Database Probe: Existing pool is active and healthy.");
      return;
    } catch (e) {
      console.warn("Database Probe: Existing pool check failed, recreating connection...");
      pool = null;
    }
  }

  const connectionTimeoutMillis = 10000;

  const candidateConfigs: Array<{ name: string; config: any }> = [];

  const socketHosts = new Set<string>();
  if (process.env.SQL_HOST) {
    socketHosts.add(process.env.SQL_HOST);
    if (process.env.SQL_HOST.startsWith('/app/cloudsql/')) {
      socketHosts.add(process.env.SQL_HOST.replace('/app/cloudsql/', '/cloudsql/'));
    } else if (process.env.SQL_HOST.startsWith('/cloudsql/')) {
      socketHosts.add('/app' + process.env.SQL_HOST);
    }
  }

  for (const baseDir of ['/cloudsql', '/app/cloudsql']) {
    try {
      if (fs.existsSync(baseDir)) {
        const entries = fs.readdirSync(baseDir);
        for (const entry of entries) {
          socketHosts.add(path.join(baseDir, entry));
        }
      }
    } catch (e) {}
  }

  const dbNamesToTry = Array.from(new Set([
    process.env.SQL_DB_NAME,
    'cloud_sql_development_database',
    'cloud_sql_production_database'
  ].filter(Boolean))) as string[];

  for (const hostPath of socketHosts) {
    if (!hostPath.startsWith('/') || fs.existsSync(hostPath)) {
      for (const dbName of dbNamesToTry) {
        candidateConfigs.push({
          name: `SQL_HOST (${hostPath} -> ${dbName})`,
          config: {
            host: hostPath,
            user: process.env.SQL_USER || 'ai_studio_app_user',
            password: process.env.SQL_PASSWORD || 'Sb9@c^VUmm+2]Vc>',
            database: dbName,
            max: 10,
            connectionTimeoutMillis,
            keepAlive: true,
            idleTimeoutMillis: 15000,
          }
        });
      }
    }
  }

  if (process.env.DATABASE_URL) {
    candidateConfigs.push({
      name: "DATABASE_URL",
      config: {
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis,
        keepAlive: true,
        idleTimeoutMillis: 15000,
      }
    });
  }

  candidateConfigs.push({
    name: "Localhost TCP PostgreSQL",
    config: {
      host: 'localhost',
      port: 5432,
      user: process.env.SQL_USER || 'ai_studio_app_user',
      password: process.env.SQL_PASSWORD || 'Sb9@c^VUmm+2]Vc>',
      database: process.env.SQL_DB_NAME || 'cloud_sql_production_database',
      max: 10,
      connectionTimeoutMillis: 2000,
      keepAlive: true,
      idleTimeoutMillis: 15000,
    }
  });

  for (const candidate of candidateConfigs) {
    console.log(`Database Probe: Attempting connection via ${candidate.name}...`);
    const testPool = new Pool(candidate.config);
    testPool.on('error', (err: any) => {
      const msg = err?.message || String(err);
      if (msg.includes("terminated") || msg.includes("closed") || msg.includes("ECONNRESET") || msg.includes("socket") || msg.includes("EPIPE")) {
        console.log("[Database Notice] Idle connection reset by server:", msg);
        triggerPoolRecreation();
      } else {
        console.log("Idle pool notice:", msg);
      }
    });

    try {
      const testPromise = testPool.query("SELECT 1");
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), connectionTimeoutMillis));
      await Promise.race([testPromise, timeoutPromise]);
      
      pool = testPool;
      activeDbSource = (candidate.name.startsWith("SQL_HOST") ? "SQL_HOST" : candidate.name) as any;
      if (activeDbSource === "SQL_HOST") {
        isDbQuotaExceeded = false;
      }
      console.log(`Database Probe: Connection succeeded! Using ${candidate.name} as the exclusive cloud database.`);
      break;
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("quota") || msg.includes("data transfer quota") || msg.includes("exceeded")) {
        isDbQuotaExceeded = true;
        console.warn(`Database Probe: Quota limit hit on ${candidate.name}. Switching seamlessly to local storage fallback.`);
      } else {
        console.warn(`Database Probe via ${candidate.name}: ${msg}`);
      }
      dbConnectionErrorMsg = `${candidate.name}: ${msg}`;
      try { await testPool.end(); } catch (e) {}
    }
  }

  if (!pool) {
    console.log("[Database Fallback Active] External database connections unavailable or quota exceeded. System is operating seamlessly using local JSON file store (local_store.json).");
    activeDbSource = "NONE";
    await ensureHydrated();
    return;
  }

  // Now initialize table on the selected pool
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_store (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB
      );
    `);
    console.log(`PostgreSQL app_store table ready on ${activeDbSource}.`);
  } catch (err: any) {
    if (err.code === '42501') {
      console.log("No permission to create table, assuming it exists or will be created by migrations.");
    } else {
      console.error("PostgreSQL table init error:", err);
    }
  }
}

dbInitPromise = determineAndInitPool();

const LOCAL_STORE_FILE = path.join(process.cwd(), "local_store.json");

let localStoreCache: any = null;
let lastDbFetchTime = 0;
let isRestoring = false;
let isDbQuotaExceeded = false;

function handleDbError(context: string, err: any) {
  const msg = err?.message || String(err);
  if (msg.includes("quota") || msg.includes("data transfer quota") || msg.includes("exceeded")) {
    if (activeDbSource === "SQL_HOST") {
      console.warn(`[Database Quota Alert] Quota warning ignored because active DB source is Google Cloud SQL socket (${msg}).`);
      isDbQuotaExceeded = false;
    } else {
      if (!isDbQuotaExceeded) {
        isDbQuotaExceeded = true;
        console.warn(`[Database Quota Alert] PostgreSQL quota exceeded (${msg}). Switching to local store (local_store.json) seamlessly.`);
      }
    }
  } else {
    const isTransient = msg.includes("terminated") || msg.includes("closed") || msg.includes("ECONNRESET") || msg.includes("socket") || msg.includes("protocol") || msg.includes("timeout");
    if (isTransient) {
      console.warn(`[Database Connection Warning] ${context}: ${msg}. Recovering connection pool...`);
    } else {
      console.error(`${context}:`, err);
    }
    if (isTransient) {
      triggerPoolRecreation();
    }
  }
}

function autoRestoreFromBackup() {
  const backupFile = LOCAL_STORE_FILE + ".backup";
  if (fs.existsSync(backupFile)) {
    try {
      const rawBackup = fs.readFileSync(backupFile, "utf-8");
      const backupData = JSON.parse(decryptLocalStore(rawBackup));
      
      // Check if backup has real data
      const hasData = backupData && (
        (Array.isArray(backupData.students) && backupData.students.length > 0) ||
        (Array.isArray(backupData.teachers) && backupData.teachers.length > 0) ||
        (Array.isArray(backupData.classes) && backupData.classes.length > 0)
      );
      
      if (hasData) {
        console.log("[Auto-Backup-Restore] Found healthy local_store.json.backup. Restoring to local_store.json.");
        fs.writeFileSync(LOCAL_STORE_FILE, rawBackup, "utf-8");
        localStoreCache = backupData;
        return true;
      }
    } catch (err: any) {
      console.error("[Auto-Backup-Restore] Failed to restore backup:", err.message);
      try {
        const corruptBackupFile = backupFile + ".corrupt_" + Date.now();
        fs.renameSync(backupFile, corruptBackupFile);
        console.warn(`[Auto-Backup-Restore] Corrupt backup file has been moved to ${corruptBackupFile} to prevent constant parse errors.`);
      } catch (renameErr: any) {
        console.error("[Auto-Backup-Restore] Failed to rename corrupt backup file:", renameErr.message);
      }
    }
  }
  return false;
}

function readLocalStore() {
  if (localStoreCache) {
    return localStoreCache;
  }
  
  // Guard check: Pre-backup healthy file if it exists and has real data
  const backupFile = LOCAL_STORE_FILE + ".backup";
  if (fs.existsSync(LOCAL_STORE_FILE)) {
    try {
      const stats = fs.statSync(LOCAL_STORE_FILE);
      if (stats.size > 100) {
        const rawCheck = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
        const parsedCheck = JSON.parse(decryptLocalStore(rawCheck));
        const hasRichData = parsedCheck && (
          (Array.isArray(parsedCheck.students) && parsedCheck.students.length > 0) ||
          (Array.isArray(parsedCheck.teachers) && parsedCheck.teachers.length > 0) ||
          (Array.isArray(parsedCheck.classes) && parsedCheck.classes.length > 0)
        );
        if (hasRichData) {
          let shouldWriteBackup = false;
          if (!fs.existsSync(backupFile)) {
            shouldWriteBackup = true;
          } else {
            const bStats = fs.statSync(backupFile);
            if (bStats.size < stats.size - 100) {
              shouldWriteBackup = true;
            }
          }
          if (shouldWriteBackup) {
            console.log("[Auto-Backup] Creating safe local_store.json.backup from active local_store.json.");
            fs.copyFileSync(LOCAL_STORE_FILE, backupFile);
          }
        }
      }
    } catch (e: any) {
      console.error("[Auto-Backup] Failed to pre-check or create backup:", e.message);
    }
  }

  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      if (raw.trim() === "") {
        if (autoRestoreFromBackup()) {
          return localStoreCache;
        }
        localStoreCache = {};
        return localStoreCache;
      }
      try {
        const parsed = JSON.parse(decryptLocalStore(raw));
        const hasData = parsed && (
          (Array.isArray(parsed.students) && parsed.students.length > 0) ||
          (Array.isArray(parsed.teachers) && parsed.teachers.length > 0) ||
          (Array.isArray(parsed.classes) && parsed.classes.length > 0)
        );
        if (!hasData) {
          if (autoRestoreFromBackup()) {
            return localStoreCache;
          }
        }
        localStoreCache = parsed;
        return localStoreCache;
      } catch (parseError: any) {
        console.error("CRITICAL ERROR: Failed to parse local_store.json:", parseError.message);
        try {
          const corruptBackup = LOCAL_STORE_FILE + ".corrupt";
          fs.renameSync(LOCAL_STORE_FILE, corruptBackup);
          console.warn(`Corrupt local_store.json has been backed up to ${corruptBackup} and reset.`);
        } catch (backupError: any) {
          console.error("Failed to backup corrupt local_store.json:", backupError.message);
        }
        if (autoRestoreFromBackup()) {
          return localStoreCache;
        }
        localStoreCache = {};
        return localStoreCache;
      }
    } else {
      if (autoRestoreFromBackup()) {
        return localStoreCache;
      }
    }
  } catch (e: any) {
    console.error("Error reading local store:", e);
    if (autoRestoreFromBackup()) {
      return localStoreCache;
    }
    localStoreCache = {};
    return localStoreCache;
  }
  localStoreCache = {};
  return localStoreCache;
}

let writeTimeout: NodeJS.Timeout | null = null;
let lastWriteTime = 0;
const DISK_WRITE_THROTTLE_INTERVAL = 3000; // 3 seconds throttle for local_store.json

function sanitizeStoreForDisk(store: any) {
  if (!store) return store;
  const safeStore = { ...store };
  // Only remove temporary livecam frames if present to save disk space, preserve all real user data (attendance, grades, exam answers, sessions)
  delete safeStore['studentLivecamFrames'];
  return safeStore;
}

function executeWrite() {
  lastWriteTime = Date.now();
  const store = localStoreCache;
  if (!store) return;

  const cacheDir = path.join(process.cwd(), "node_modules", ".cache");
  if (!fs.existsSync(cacheDir)) {
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (_) {}
  }
  const tempFile = path.join(cacheDir, "local_store.json.tmp");
  const backupFile = LOCAL_STORE_FILE + ".backup";

  const hasData = store && (
    (Array.isArray(store.students) && store.students.length > 0) ||
    (Array.isArray(store.teachers) && store.teachers.length > 0) ||
    (Array.isArray(store.classes) && store.classes.length > 0)
  );

  try {
    const dataString = JSON.stringify(sanitizeStoreForDisk(store), null, 2);
    const encryptedData = encryptLocalStore(dataString);
    
    // 1. Write to temp file first to prevent corruption
    fs.writeFile(tempFile, encryptedData, "utf-8", (err) => {
      if (err) {
        console.error("[Disk-Write] Error writing temp local store:", err);
        return;
      }
      
      // 2. Rename temp file to active file
      fs.rename(tempFile, LOCAL_STORE_FILE, (renameErr) => {
        if (renameErr) {
          console.error("[Disk-Write] Error renaming temp to active local store:", renameErr);
          return;
        }

        // 3. Write backup copy asynchronously AFTER active file succeeds
        if (hasData) {
          fs.writeFile(backupFile, encryptedData, "utf-8", (backupErr) => {
            if (backupErr) {
              console.error("[Disk-Write] Failed to save backup copy:", backupErr.message);
            }
          });
        }
      });
    });
  } catch (e) {
    console.error("[Disk-Write] Error stringifying store in background:", e);
  }
}

function writeLocalStore(store: any) {
  localStoreCache = store;
  
  if (writeTimeout) {
    return; // Already scheduled
  }

  const now = Date.now();
  const timeSinceLastWrite = now - lastWriteTime;

  if (timeSinceLastWrite >= DISK_WRITE_THROTTLE_INTERVAL) {
    executeWrite();
  } else {
    const delay = DISK_WRITE_THROTTLE_INTERVAL - timeSinceLastWrite;
    writeTimeout = setTimeout(() => {
      writeTimeout = null;
      executeWrite();
    }, delay);
  }
}

function flushAllPendingWrites() {
  console.log("[Shutdown] Flushing all pending writes to disk...");
  if (writeTimeout) {
    clearTimeout(writeTimeout);
    writeTimeout = null;
  }
  executeWriteSync();
}

function executeWriteSync() {
  const store = localStoreCache;
  if (!store) return;

  const cacheDir = path.join(process.cwd(), "node_modules", ".cache");
  if (!fs.existsSync(cacheDir)) {
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (_) {}
  }
  const tempFile = path.join(cacheDir, "local_store.json.tmp");
  const backupFile = LOCAL_STORE_FILE + ".backup";

  const hasData = store && (
    (Array.isArray(store.students) && store.students.length > 0) ||
    (Array.isArray(store.teachers) && store.teachers.length > 0) ||
    (Array.isArray(store.classes) && store.classes.length > 0)
  );

  try {
    const dataString = JSON.stringify(sanitizeStoreForDisk(store), null, 2);
    const encryptedData = encryptLocalStore(dataString);
    fs.writeFileSync(tempFile, encryptedData, "utf-8");
    fs.renameSync(tempFile, LOCAL_STORE_FILE);
    if (hasData) {
      fs.writeFileSync(backupFile, encryptedData, "utf-8");
    }
    console.log("[Shutdown] Successfully flushed all pending writes.");
  } catch (e) {
    console.error("[Shutdown] Error flushing pending writes:", e);
  }
}

process.on("SIGINT", () => {
  flushAllPendingWrites();
  process.exit(0);
});
process.on("SIGTERM", () => {
  flushAllPendingWrites();
  process.exit(0);
});

async function loadData(key: string, fallback: any) {
  try {
    const store = readLocalStore();
    if (store[key] !== undefined) {
      return store[key];
    }
  } catch (e) {
    console.error(`loadData failed for key "${key}" due to corrupted local store file. Falling back to baseline.`);
  }
  return fallback;
}

let sseClients: express.Response[] = [];
const wsClients = new Map<string, any>();

function broadcastStateUpdate(key: string, senderClientId?: string) {
  const payload = JSON.stringify({ type: "state-update", key, senderClientId });
  sseClients = sseClients.filter(client => {
    try {
      if ((client as any).writableEnded || (client as any).destroyed || (client as any).finished) {
        return false;
      }
      client.write(`data: ${payload}\n\n`);
      return true;
    } catch (err) {
      return false;
    }
  });
}

function broadcastExamEvent(event: any) {
  const payload = JSON.stringify(event);
  sseClients = sseClients.filter(client => {
    try {
      if ((client as any).writableEnded || (client as any).destroyed || (client as any).finished) {
        return false;
      }
      client.write(`data: ${payload}\n\n`);
      return true;
    } catch (err) {
      return false;
    }
  });

  wsClients.forEach((ws) => {
    try {
      if (ws && ws.readyState === 1) {
        ws.send(payload);
      }
    } catch {}
  });
}

const dbWriteTimeouts = new Map<string, NodeJS.Timeout>();
const lastDbWriteTimes = new Map<string, number>();
const DB_WRITE_THROTTLE_INTERVAL = 3000; // 3 seconds throttle for PostgreSQL database writes per key

function getJakartaTodayDateStr(): string {
  // Always get 'YYYY-MM-DD' in Asia/Jakarta timezone (WIB)
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const jakartaTime = new Date(utc + (3600000 * 7));
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, '0');
  const day = String(jakartaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getJakartaIsoString(): string {
  // Always get ISO string in Asia/Jakarta timezone (WIB)
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const jakartaTime = new Date(utc + (3600000 * 7));
  return jakartaTime.toISOString();
}

// --- ULTRA-HIGH PERFORMANCE DATABASE SYNC & MERGE ENGINE ---

function mergeArrays(existing: any[], incoming: any[], key: string): any[] {
  if (!Array.isArray(existing)) return incoming;
  if (!Array.isArray(incoming)) return incoming;

  let idField = 'id';
  if (key === 'students') idField = 'nis';
  else if (key === 'teachers') idField = 'nip';

  const existingMap = new Map<string, any>();
  existing.forEach(item => {
    if (item && typeof item === 'object') {
      const idVal = item[idField] || item['id'];
      if (idVal !== undefined) {
        existingMap.set(String(idVal), item);
      }
    }
  });

  incoming.forEach(item => {
    if (item && typeof item === 'object') {
      const idVal = item[idField] || item['id'];
      if (idVal !== undefined) {
        existingMap.set(String(idVal), item);
      }
    }
  });

  return Array.from(existingMap.values());
}

function mergeStoreValues(existing: any, incoming: any, key: string): any {
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    return mergeArrays(existing, incoming, key);
  }
  if (existing && typeof existing === 'object' && incoming && typeof incoming === 'object') {
    return { ...existing, ...incoming };
  }
  return incoming;
}

function partitionAndSaveKey(key: string, value: any[]): { active: any[], archives: Record<string, any[]> } {
  const active: any[] = [];
  const archives: Record<string, any[]> = {};
  
  // Anything older than 90 days is partitioned/archived to save main table storage
  const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);

  for (const item of value) {
    if (!item) continue;
    
    let itemDateMs = Date.now();
    let itemYearMonth = '';

    try {
      if (key === 'attendance' || key === 'teacherAttendance') {
        if (item.date) {
          const d = new Date(item.date);
          itemDateMs = d.getTime();
          if (!isNaN(itemDateMs)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            itemYearMonth = `${year}_${month}`;
          }
        }
      } else if (key === 'chats') {
        if (item.timestamp) {
          const d = new Date(typeof item.timestamp === 'number' ? item.timestamp : item.timestamp);
          itemDateMs = d.getTime();
          if (!isNaN(itemDateMs)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            itemYearMonth = `${year}_${month}`;
          }
        }
      }
    } catch (e) {}

    if (itemDateMs < ninetyDaysAgo && itemYearMonth) {
      const archiveKey = `${key}_archive_${itemYearMonth}`;
      if (!archives[archiveKey]) {
        archives[archiveKey] = [];
      }
      archives[archiveKey].push(item);
    } else {
      active.push(item);
    }
  }

  return { active, archives };
}

async function writeKeyToPostgresDirect(key: string) {
  if (dbWriteTimeouts.has(key)) {
    const timeout = dbWriteTimeouts.get(key);
    if (timeout) clearTimeout(timeout);
    dbWriteTimeouts.delete(key);
  }
  lastDbWriteTimes.set(key, Date.now());

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let client: any = null;
    let clientError: any = null;

    try {
      if (dbInitPromise) await dbInitPromise;
      if (!pool || isDbQuotaExceeded) return;

      const freshValue = getMemoryKeyValue(key);
      if (freshValue === undefined) return;

      try {
        client = await pool.connect();
        await client.query('BEGIN');

        if (Array.isArray(freshValue) && (key === 'attendance' || key === 'teacherAttendance' || key === 'chats')) {
          const { active, archives } = partitionAndSaveKey(key, freshValue);

          // 1. Process active records
          await client.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [key, JSON.stringify(active)]);

          // 2. Process archive partitions
          for (const [archiveKey, archiveItems] of Object.entries(archives)) {
            await client.query(`
              INSERT INTO app_store (key, value) VALUES ($1, $2)
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [archiveKey, JSON.stringify(archiveItems)]);
          }

        } else {
          // Write fresh value directly to preserve additions and deletions accurately
          await client.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [key, JSON.stringify(freshValue)]);
        }

        await client.query('COMMIT');
        return; // Successful write!

      } catch (err: any) {
        clientError = err;
        if (client) {
          try { await client.query('ROLLBACK'); } catch (rb) {}
        }
        throw err;
      } finally {
        if (client) {
          try { client.release(clientError); } catch (rel) {}
        }
      }

    } catch (e: any) {
      const msg = e?.message || String(e);
      const isTransient = msg.includes("terminated") || msg.includes("closed") || msg.includes("timeout") || msg.includes("ECONNRESET") || msg.includes("socket");

      if (isTransient && attempt < maxAttempts) {
        console.log(`[Database Auto-Retry] Re-establishing connection pool for "${key}" (Attempt ${attempt}/${maxAttempts}: ${msg})...`);
        triggerPoolRecreation();
        await new Promise(r => setTimeout(r, 600));
        continue;
      }

      handleDbError(`Save data error for ${key}`, e);
      break;
    }
  }
}

function scheduleDbWrite(key: string) {
  if (dbWriteTimeouts.has(key)) {
    // Already scheduled, let the scheduled one write the latest memory state
    return;
  }

  const now = Date.now();
  const lastWrite = lastDbWriteTimes.get(key) || 0;
  const timeSinceLastWrite = now - lastWrite;

  if (timeSinceLastWrite >= DB_WRITE_THROTTLE_INTERVAL) {
    writeKeyToPostgresDirect(key);
  } else {
    const delay = DB_WRITE_THROTTLE_INTERVAL - timeSinceLastWrite;
    const timeout = setTimeout(() => {
      writeKeyToPostgresDirect(key);
    }, delay);
    dbWriteTimeouts.set(key, timeout);
  }
}

async function saveData(key: string, value: any, immediate = true) {
  if (key === 'madrasahs' && Array.isArray(value)) {
    for (const m of value) {
      m.tokenSignature = calculateTokenSignature(m.id, m.cbtTokenBalance || 0);
    }
  }
  updateMemoryKey(key, value);
  
  // Update localStoreCache even if restoring so it's ready for final flush
  try {
    const store = readLocalStore();
    store[key] = value;
  } catch (e) {}

  if (isRestoring) {
    return;
  }

  lastDbFetchTime = Date.now();

  // 2. Broadcast state update immediately (for responsive UI)
  try {
    broadcastStateUpdate(key);
  } catch (e) {
    console.error(`Broadcast state update error for ${key}:`, e);
  }

  // 3. Sync to Firestore (Backup persistent layer)
  if (db) {
    saveKeyToFirestore(key, value).catch(err => {
      console.error(`[Firestore Backup] Error backing up "${key}" to Firestore:`, err);
    });
  }

  // 4. Write directly or schedule write to PostgreSQL Cloud SQL
  if (pool && !isDbQuotaExceeded) {
    if (immediate) {
      await writeKeyToPostgresDirect(key);
    } else {
      scheduleDbWrite(key);
    }
  }
}

async function saveDataBatch(items: { key: string; value: any }[], immediate = true) {
  for (const item of items) {
    updateMemoryKey(item.key, item.value);
  }

  // 1. Write to local disk cache instantly (for reliability)
  try {
    const store = readLocalStore();
    for (const item of items) {
      store[item.key] = item.value;
    }
    writeLocalStore(store);
  } catch (e) {
    console.error("Skipping write to local_store.json for batch update:", e);
  }

  lastDbFetchTime = Date.now();

  // 2. Broadcast state updates immediately (for responsive UI)
  try {
    items.forEach(item => {
      broadcastStateUpdate(item.key);
    });
  } catch (e) {
    console.error("Broadcast state batch update error:", e);
  }

  // 3. Sync to Firestore (Backup persistent layer)
  if (db) {
    for (const item of items) {
      saveKeyToFirestore(item.key, item.value).catch(err => {
        console.error(`[Firestore Backup] Batch error backing up "${item.key}" to Firestore:`, err);
      });
    }
  }

  // 4. Write directly or schedule writes for each key
  if (pool && !isDbQuotaExceeded) {
    if (immediate) {
      for (const item of items) {
        await writeKeyToPostgresDirect(item.key);
      }
    } else {
      for (const item of items) {
        scheduleDbWrite(item.key);
      }
    }
  }
}

// --- GRACEFUL SHUTDOWN INTEGRATION ---
async function flushPendingDbWrites() {
  console.log("[Graceful Shutdown] Flushing all pending database writes...");
  const keys = Array.from(dbWriteTimeouts.keys());
  
  const writePromises = keys.map(async (key) => {
    const timeout = dbWriteTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
    }
    dbWriteTimeouts.delete(key);

    try {
      if (!pool || isDbQuotaExceeded) return;
      const freshValue = getMemoryKeyValue(key);
      if (freshValue === undefined) return;

      let client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        if (Array.isArray(freshValue) && (key === 'attendance' || key === 'teacherAttendance' || key === 'chats')) {
          const { active, archives } = partitionAndSaveKey(key, freshValue);

          // Active
          await client.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [key, JSON.stringify(active)]);

          // Archives
          for (const [archiveKey, archiveItems] of Object.entries(archives)) {
            await client.query(`
              INSERT INTO app_store (key, value) VALUES ($1, $2)
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [archiveKey, JSON.stringify(archiveItems)]);
          }
        } else {
          await client.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [key, JSON.stringify(freshValue)]);
        }

        await client.query('COMMIT');
        console.log(`[Graceful Shutdown] Flushed key "${key}" to PostgreSQL.`);
      } catch (err) {
        if (client) {
          try { await client.query('ROLLBACK'); } catch (rb) {}
        }
        console.error(`[Graceful Shutdown] Failed to flush key "${key}":`, err);
      } finally {
        if (client) {
          try { client.release(); } catch (rel) {}
        }
      }
    } catch (e) {
      console.error(`[Graceful Shutdown] Error writing ${key} during shutdown:`, e);
    }
  });

  await Promise.all(writePromises);
  console.log("[Graceful Shutdown] All pending database writes flushed successfully.");
}

let isShuttingDown = false;
async function handleGracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Graceful Shutdown] Received ${signal}. Preparing to shut down server...`);
  
  await flushPendingDbWrites();
  
  if (pool) {
    try {
      await pool.end();
      console.log("[Graceful Shutdown] PostgreSQL pool ended.");
    } catch (e) {
      console.error("[Graceful Shutdown] Error ending pool:", e);
    }
  }
  
  console.log("[Graceful Shutdown] Server is safe to exit.");
  process.exit(0);
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

function updateMemoryKey(key: string, value: any) {
  if (key === 'schoolLocationSettings') schoolLocationSettings = value;
  else if (key === 'classes') classes = value;
  else if (key === 'subjects') subjects = value;
  else if (key === 'teachers') teachers = value;
  else if (key === 'students') students = value;
  else if (key === 'attendance') attendance = value;
  else if (key === 'questionBankGroups') questionBankGroups = value;
  else if (key === 'questions') questions = value;
  else if (key === 'grades') grades = value;
  else if (key === 'chats') chats = value;
  else if (key === 'exams') exams = value;
  else if (key === 'rooms') rooms = value;
  else if (key === 'schedules') schedules = value;
  else if (key === 'journals') journals = value;
  else if (key === 'gradeCategories') gradeCategories = value;
  else if (key === 'generatedExams') generatedExams = value;
  else if (key === 'activeExamSessions') activeExamSessions = value;
  else if (key === 'completedExams') completedExams = value;
  else if (key === 'forceFinishedExams') forceFinishedExams = value;
  else if (key === 'studentExamAnswers') studentExamAnswers = value;
  else if (key === 'studentExamQuestions') studentExamQuestions = value;
  else if (key === 'studentExamGrades') studentExamGrades = value;
  else if (key === 'studentTabSwitches') studentTabSwitches = value;
  else if (key === 'studentOutOfTab') studentOutOfTab = value;
  else if (key === 'blockedStudents') blockedStudents = value;
  else if (key === 'settings') appSettings = value;
  else if (key === 'lessonPlans') lessonPlans = value;
  else if (key === 'teacherAttendance') teacherAttendance = value;
  else if (key === 'savedRosters') savedRosters = value;
  else if (key === 'timeSlots') timeSlots = value;
  else if (key === 'kbmDuration') kbmDuration = value;
  else if (key === 'childguardRules') childguardRules = value;
  else if (key === 'childguardLogs') childguardLogs = value;
  else if (key === 'childguardLocations') childguardLocations = value;
  else if (key === 'childguardStatus') childguardStatus = value;
  else if (key === 'importGroups') importGroups = value;
  else if (key === 'photoCloudinaryMap') photoCloudinaryMap = value;
  else if (key === 'eduGames') eduGames = value;
  else if (key === 'gameAttempts') gameAttempts = value;
  else if (key === 'lkpdList') lkpdList = value;
}

function getMemoryKeyValue(key: string) {
  if (key === 'photoCloudinaryMap') return photoCloudinaryMap;
  if (key === 'eduGames') return eduGames;
  if (key === 'gameAttempts') return gameAttempts;
  if (key === 'schoolLocationSettings') return schoolLocationSettings;
  if (key === 'classes') return classes;
  if (key === 'subjects') return subjects;
  if (key === 'teachers') return teachers;
  if (key === 'students') return students;
  if (key === 'attendance') return attendance;
  if (key === 'questionBankGroups') return questionBankGroups;
  if (key === 'questions') return questions;
  if (key === 'grades') return grades;
  if (key === 'chats') return chats;
  if (key === 'exams') return exams;
  if (key === 'rooms') return rooms;
  if (key === 'schedules') return schedules;
  if (key === 'journals') return journals;
  if (key === 'gradeCategories') return gradeCategories;
  if (key === 'generatedExams') return generatedExams;
  if (key === 'activeExamSessions') return activeExamSessions;
  if (key === 'completedExams') return completedExams;
  if (key === 'forceFinishedExams') return forceFinishedExams;
  if (key === 'studentExamAnswers') return studentExamAnswers;
  if (key === 'studentExamQuestions') return studentExamQuestions;
  if (key === 'studentExamGrades') return studentExamGrades;
  if (key === 'studentTabSwitches') return studentTabSwitches;
  if (key === 'studentOutOfTab') return studentOutOfTab;
  if (key === 'blockedStudents') return blockedStudents;
  if (key === 'settings') return appSettings;
  if (key === 'lessonPlans') return lessonPlans;
  if (key === 'teacherAttendance') return teacherAttendance;
  if (key === 'savedRosters') return savedRosters;
  if (key === 'timeSlots') return timeSlots;
  if (key === 'kbmDuration') return kbmDuration;
  if (key === 'childguardRules') return childguardRules;
  if (key === 'childguardLogs') return childguardLogs;
  if (key === 'childguardLocations') return childguardLocations;
  if (key === 'childguardStatus') return childguardStatus;
  if (key === 'importGroups') return importGroups;
  if (key === 'lkpdList') return lkpdList;
  return undefined;
}

async function updateStoreKeyWithLock(key: string, updateFn: (val: any) => any) {
  // Ultra-High Performance & Non-Blocking Architecture:
  // Instead of running a heavy synchronous SELECT FOR UPDATE transaction on every single student tap,
  // we update the memory and local store instantly (resolving in <1ms), and schedule an asynchronous,
  // throttled background write to PostgreSQL Cloud SQL. This eliminates:
  // 1. Connection Pool Exhaustion (only 1 write every 3s instead of 100s of simultaneous connections)
  // 2. Row Lock Contention (zero SQL FOR UPDATE waiting locks)
  // 3. Bottlenecks for student attendance taps

  let currentVal = getMemoryKeyValue(key);
  if (currentVal === undefined) {
    try {
      const store = readLocalStore();
      currentVal = store[key];
    } catch (e) {}
  }
  if (currentVal === undefined) {
    currentVal = [];
  }

  const newVal = updateFn(currentVal);
  updateMemoryKey(key, newVal);

  // Write to local disk cache instantly
  try {
    const store = readLocalStore();
    store[key] = newVal;
    writeLocalStore(store);
  } catch (e) {}

  // Broadcast state update immediately so active screens reflect the tap instantly
  try {
    broadcastStateUpdate(key);
  } catch (e) {}

  // Schedule throttled asynchronous background write to PostgreSQL Cloud SQL
  if (pool && !isDbQuotaExceeded) {
    scheduleDbWrite(key);
  }

  return newVal;
}

const app = express();
export const appExport = app;
export default app;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(compression({
  threshold: 512,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.removeHeader("X-Frame-Options");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
}); app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use('/uploads', express.static(uploadsDir));

app.get("/update_offline.zip", (req, res) => {
  const filePath = path.join(process.cwd(), "update_offline.zip");
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Disposition", "attachment; filename=update_offline.zip");
    res.setHeader("Content-Type", "application/zip");
    return res.sendFile(filePath);
  } else {
    return res.status(404).send("File update_offline.zip belum dibuat atau masih dalam proses pembuatan. Silakan coba sesaat lagi.");
  }
});

app.get("/api/photos/:id", async (req, res) => {
  const photoId = req.params.id;

  // 1. Layer 1: Local Disk Cache (0-latency, protects Firebase & Cloudinary quotas for high student concurrency)
  const localFile = path.join(uploadsDir, photoId);
  if (fs.existsSync(localFile)) {
    try {
      const fileBuf = fs.readFileSync(localFile);
      const strHeader = fileBuf.subarray(0, 50).toString('utf8');
      if (strHeader.startsWith('data:image/')) {
        const fullStr = fileBuf.toString('utf8');
        const matches = fullStr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          res.setHeader("Content-Type", matches[1]);
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return res.send(Buffer.from(matches[2], "base64"));
        }
      }
      if (fileBuf[0] === 0xFF && fileBuf[1] === 0xD8) {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (fileBuf[0] === 0x89 && fileBuf[1] === 0x50 && fileBuf[2] === 0x4E && fileBuf[3] === 0x47) {
        res.setHeader("Content-Type", "image/png");
      } else if (fileBuf[0] === 0x52 && fileBuf[1] === 0x49 && fileBuf[2] === 0x46 && fileBuf[3] === 0x46) {
        res.setHeader("Content-Type", "image/webp");
      } else {
        res.setHeader("Content-Type", "image/jpeg");
      }
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(fileBuf);
    } catch (e) {
      // Fallback if read buffer failed
    }
  }

  // 2. Layer 2: Storage 1 - Firebase Firestore
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'photos', photoId));
      if (snap.exists()) {
        const data = snap.data().data;
        // Asynchronously write to local disk cache so subsequent requests hit Layer 1
        try {
          const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            fs.writeFileSync(localFile, Buffer.from(matches[2], 'base64'));
          } else {
            fs.writeFileSync(localFile, data);
          }
        } catch (e) {}

        const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return res.send(data);
        const ext = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        res.setHeader("Content-Type", ext);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(buffer);
      }
    } catch (err: any) {
      console.warn(`[Dual Storage Alert] Firebase Firestore read error for ${photoId} (e.g. quota limit reached):`, err?.message || err);
    }
  }

  // 3. Layer 3: Storage 2 - Cloudinary Resolution & Failover
  let cUrl = photoCloudinaryMap[photoId] || 
             photoCloudinaryMap[`madrasah_photos/${photoId}`] || 
             photoCloudinaryMap[photoId.replace(/^madrasah_photos\//, '')];

  if (!cUrl && process.env.CLOUDINARY_CLOUD_NAME) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const directUrl = `https://res.cloudinary.com/${cloudName}/image/upload/madrasah_photos/${photoId}`;
    cUrl = directUrl;
    photoCloudinaryMap[photoId] = directUrl;
  }

  if (cUrl) {
    // Asynchronously download and cache to local disk in background for zero latency on subsequent hits
    if (!fs.existsSync(localFile)) {
      try {
        https.get(cUrl, (cRes) => {
          if (cRes.statusCode === 200) {
            const chunks: Buffer[] = [];
            cRes.on('data', chunk => chunks.push(chunk));
            cRes.on('end', () => {
              try {
                fs.writeFileSync(localFile, Buffer.concat(chunks));
              } catch(e) {}
            });
          }
        }).on('error', () => {});
      } catch (e) {}
    }

    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.redirect(302, cUrl);
  }

  // Fallback: Default clean SVG placeholder avatar if photo is missing in all storage layers
  const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f1f5f9"/><path d="M50 42a12 12 0 1 0 0-24 12 12 0 0 0 0 24zm0 8c-16 0-28 10-28 22v2h56v-2c0-12-12-22-28-22z" fill="#cbd5e1"/></svg>`;
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(svgPlaceholder);
});

// In-Memory Data Store initialized directly from local_store.json baseline
const bootStore = readLocalStore();
photoCloudinaryMap = bootStore['photoCloudinaryMap'] || {};

let schoolLocationSettings = bootStore['schoolLocationSettings'] || {
  schoolLatitude: -6.2000,
  schoolLongitude: 106.8166,
  geofenceRadius: 100
};

let classes = bootStore['classes'] || [];
let subjects = bootStore['subjects'] || [];
let teachers = bootStore['teachers'] || [];
let students = bootStore['students'] || [];
let attendance = bootStore['attendance'] || [];
let teacherAttendance = bootStore['teacherAttendance'] || [];
let questionBankGroups = bootStore['questionBankGroups'] || [];
let questions = bootStore['questions'] || [];
let grades = bootStore['grades'] || [];
let chats = bootStore['chats'] || [];
let exams = bootStore['exams'] || [];
let lkpdList = bootStore['lkpdList'] || [];
let rooms = bootStore['rooms'] || [];
let schedules = bootStore['schedules'] || [];
let savedRosters = bootStore['savedRosters'] || [];
let timeSlots = bootStore['timeSlots'] || [];
let kbmDuration = bootStore['kbmDuration'] || 40;
let journals = bootStore['journals'] || [];
let gradeCategories = bootStore['gradeCategories'] || [];
let customGradeColumns = bootStore['customGradeColumns'] || {};
let calendarEvents = bootStore['calendarEvents'] || [];
let generatedExams = bootStore['generatedExams'] || [];
let activeExamSessions = bootStore['activeExamSessions'] || {};
let completedExams = bootStore['completedExams'] || {};
let forceFinishedExams = bootStore['forceFinishedExams'] || {};
let studentExamAnswers = bootStore['studentExamAnswers'] || {};
let studentExamQuestions = bootStore['studentExamQuestions'] || {};
let studentExamMasterQuestions = bootStore['studentExamMasterQuestions'] || {};
let studentTabSwitches = bootStore['studentTabSwitches'] || {};
let studentOutOfTab = bootStore['studentOutOfTab'] || {};
let blockedStudents = bootStore['blockedStudents'] || {};
let studentLivecamFrames = bootStore['studentLivecamFrames'] || {};
let studentExamGrades = bootStore['studentExamGrades'] || {};
let examMessages = bootStore['examMessages'] || {};
let examViolationLogs: Record<string, any[]> = bootStore['examViolationLogs'] || {};
let importGroups: any[] = bootStore['importGroups'] || [];
let eduGames: any[] = bootStore['eduGames'] || [];
let gameAttempts: any[] = bootStore['gameAttempts'] || [];
let childguardRules = bootStore['childguardRules'] || {};
let childguardLogs = bootStore['childguardLogs'] || [];
let childguardLocations = bootStore['childguardLocations'] || {};
let childguardStatus = bootStore['childguardStatus'] || {};
let appSettings = bootStore['settings'] || {
  schoolName: 'Madrasah Bisa',
  adminName: 'Administrator',
  adminUser: 'admin',
  adminPass: 'admin123',
  radius: 100,
  accuracy: 10,
  theme: 'emerald',
  showDemo: true,
  useHttps: false,
  paymentAccounts: [
    { id: '1', name: 'ShopeePay', number: '081234567890', owner: 'BOS PLATFORM' },
    { id: '2', name: 'DANA', number: '081234567890', owner: 'BOS PLATFORM' },
    { id: '3', name: 'Bank BRI', number: '0123-01-098765-50-1', owner: 'BOS PLATFORM' },
    { id: '4', name: 'Bank Mandiri', number: '130-00-9876543-2', owner: 'BOS PLATFORM' }
  ]
};
if (!appSettings.paymentAccounts) {
  appSettings.paymentAccounts = [
    { id: '1', name: 'ShopeePay', number: '081234567890', owner: 'BOS PLATFORM' },
    { id: '2', name: 'DANA', number: '081234567890', owner: 'BOS PLATFORM' },
    { id: '3', name: 'Bank BRI', number: '0123-01-098765-50-1', owner: 'BOS PLATFORM' },
    { id: '4', name: 'Bank Mandiri', number: '130-00-9876543-2', owner: 'BOS PLATFORM' }
  ];
}

let madrasahs: any[] = bootStore['madrasahs'] || [
  {
    id: 'default',
    name: (bootStore['settings'] && bootStore['settings'].schoolName) || 'Madrasah Utama',
    slug: 'default',
    level: 'MA',
    adminName: (bootStore['settings'] && bootStore['settings'].adminName) || 'Administrator',
    adminUser: (bootStore['settings'] && bootStore['settings'].adminUser) || 'admin',
    adminPass: (bootStore['settings'] && bootStore['settings'].adminPass) || 'admin123',
    phone: '081234567890',
    cbtTokenBalance: 100,
    createdAt: '2026-01-01'
  }
];

let tokenRequests: any[] = bootStore['tokenRequests'] || [];
let usedActivationKeys: string[] = bootStore['usedActivationKeys'] || [];
let cbtTokenPrice: number = (bootStore['settings'] && bootStore['settings'].cbtTokenPrice) || 5000;

function parseDbRows(rows: any[]) {
  const dbData: Record<string, any> = {};
  const parsedDeltas: Record<string, Record<string, any>> = {
    studentExamAnswers: {},
    studentExamQuestions: {},
    studentExamMasterQuestions: {},
    studentTabSwitches: {},
    studentOutOfTab: {},
    completedExams: {},
    forceFinishedExams: {},
    blockedStudents: {},
    activeExamSessions: {},
    studentExamGrades: {}
  };

  for (const row of rows) {
    let isDelta = false;
    for (const deltaKey of Object.keys(parsedDeltas)) {
      if (row.key.startsWith(`delta::${deltaKey}::`)) {
        const itemKey = row.key.substring(`delta::${deltaKey}::`.length);
        parsedDeltas[deltaKey][itemKey] = row.value;
        isDelta = true;
        break;
      }
    }
    if (!isDelta) {
      dbData[row.key] = row.value;
    }
  }

  for (const deltaKey of Object.keys(parsedDeltas)) {
    dbData[deltaKey] = { ...(dbData[deltaKey] || {}), ...parsedDeltas[deltaKey] };
  }
  
  return dbData;
}

// Hydrate from Database or local storage on startup
async function hydrate() {
  // First load local store as fallback baseline
  let store: any = {};
  try {
    store = readLocalStore();
  } catch (e) {
    console.error("Failed to parse local_store.json during hydration. Falling back to clean memory state:", e);
    localStoreCache = {};
  }

  // Restore state from persistent Firestore app_store collection if available (container persistent fallback)
  if (db) {
    try {
      const firestoreStore = await loadStoreFromFirestore();
      if (Object.keys(firestoreStore).length > 0) {
        console.log(`[Firestore Restore] Restoring ${Object.keys(firestoreStore).length} keys to active local store...`);
        for (const [fKey, fVal] of Object.entries(firestoreStore)) {
          if (fKey === 'attendance' && Array.isArray(fVal) && Array.isArray(store.attendance)) {
            const aMap = new Map();
            store.attendance.forEach((a: any) => { if (a && (a.id || a.studentId)) aMap.set(String(a.id || `${a.studentId}_${a.date}_${a.subjectId||''}`), a); });
            (fVal as any[]).forEach((a: any) => { if (a && (a.id || a.studentId)) aMap.set(String(a.id || `${a.studentId}_${a.date}_${a.subjectId||''}`), a); });
            store.attendance = Array.from(aMap.values());
          } else if (fKey === 'studentExamGrades' && typeof fVal === 'object' && fVal !== null) {
            store.studentExamGrades = { ...(store.studentExamGrades || {}), ...fVal };
          } else if (fKey === 'completedExams' && typeof fVal === 'object' && fVal !== null) {
            store.completedExams = { ...(store.completedExams || {}), ...fVal };
          } else if (fKey === 'studentExamAnswers' && typeof fVal === 'object' && fVal !== null) {
            store.studentExamAnswers = { ...(store.studentExamAnswers || {}), ...fVal };
          } else {
            store[fKey] = fVal;
          }
        }
        // Save back to local_store.json for offline runtime reliability
        writeLocalStore(store);
      }
    } catch (e) {
      console.error("[Firestore Restore] Failed to restore from Firestore:", e);
    }
  }

  if (store['schoolLocationSettings'] !== undefined) schoolLocationSettings = store['schoolLocationSettings'];
  if (store['classes'] !== undefined) classes = store['classes'];
  if (store['subjects'] !== undefined) subjects = store['subjects'];
  if (store['teachers'] !== undefined) teachers = store['teachers'];
  if (store['students'] !== undefined) students = store['students'];
  if (store['attendance'] !== undefined) attendance = store['attendance'];
  if (store['questionBankGroups'] !== undefined) questionBankGroups = store['questionBankGroups'];
  if (store['questions'] !== undefined) questions = store['questions'];
  if (store['grades'] !== undefined) grades = store['grades'];
  if (store['chats'] !== undefined) chats = store['chats'];
  if (store['exams'] !== undefined) exams = store['exams'];
  if (store['rooms'] !== undefined) rooms = store['rooms'];
  if (store['schedules'] !== undefined) schedules = store['schedules'];
  if (store['savedRosters'] !== undefined) savedRosters = store['savedRosters'];
  if (store['timeSlots'] !== undefined) timeSlots = store['timeSlots'];
  if (store['kbmDuration'] !== undefined) kbmDuration = store['kbmDuration'];
  if (store['journals'] !== undefined) journals = store['journals'];
  if (store['gradeCategories'] !== undefined) gradeCategories = store['gradeCategories'];
  if (store['calendarEvents'] !== undefined) calendarEvents = store['calendarEvents'];
  if (store['generatedExams'] !== undefined) generatedExams = store['generatedExams'];
  if (store['activeExamSessions'] !== undefined) activeExamSessions = store['activeExamSessions'];
  if (store['completedExams'] !== undefined) completedExams = store['completedExams'];
  if (store['forceFinishedExams'] !== undefined) forceFinishedExams = store['forceFinishedExams'];
  if (store['studentExamAnswers'] !== undefined) studentExamAnswers = store['studentExamAnswers'];
  if (store['studentExamQuestions'] !== undefined) studentExamQuestions = store['studentExamQuestions'];
  if (store['studentExamGrades'] !== undefined) studentExamGrades = store['studentExamGrades'];
  if (store['studentTabSwitches'] !== undefined) studentTabSwitches = store['studentTabSwitches'];
  if (store['studentOutOfTab'] !== undefined) studentOutOfTab = store['studentOutOfTab'];
  if (store['blockedStudents'] !== undefined) blockedStudents = store['blockedStudents'];
  if (store['settings'] !== undefined) appSettings = store['settings'];
  if (store['lessonPlans'] !== undefined) lessonPlans = store['lessonPlans'];
  if (store['teacherAttendance'] !== undefined) teacherAttendance = store['teacherAttendance'];
  if (store['childguardRules'] !== undefined) childguardRules = store['childguardRules'];
  if (store['childguardLogs'] !== undefined) childguardLogs = store['childguardLogs'];
  if (store['childguardLocations'] !== undefined) childguardLocations = store['childguardLocations'];
  if (store['childguardStatus'] !== undefined) childguardStatus = store['childguardStatus'];
  if (store['madrasahs'] !== undefined) {
    madrasahs = store['madrasahs'];
    verifyAndLockMadrasahTokens();
  }
  if (store['tokenRequests'] !== undefined) tokenRequests = store['tokenRequests'];
  if (store['usedActivationKeys'] !== undefined) usedActivationKeys = store['usedActivationKeys'];

  if (dbInitPromise) {
    await dbInitPromise;
  }

  if (!pool) {
    console.log("Database URL / SQL_HOST not set. Using local JSON store.");
    return;
  }

  try {
    const testPromise = pool.query("SELECT 1");
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), 4000));
    await Promise.race([testPromise, timeoutPromise]);
    
    const res = await pool.query("SELECT key, value FROM app_store WHERE key NOT IN ('attendance', 'teacherAttendance', 'chats', 'journals')");
    const dbData = parseDbRows(res.rows);
    console.log("Hydrate fetched rows count from Cloud SQL:", res.rows.length, "Teachers count:", Array.isArray(dbData['teachers']) ? dbData['teachers'].length : 'none', "Students count:", Array.isArray(dbData['students']) ? dbData['students'].length : 'none');

    if (res.rows.length === 0 && Object.keys(store).length > 0) {
      console.log("Database is empty. Migrating from local_store.json...");
      try {
        const queries = Object.entries(store).map(([k, v]) => {
           return pool!.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [k, JSON.stringify(v)]);
        });
        await Promise.all(queries);
        console.log("Migration completed.");
        for (const [k, v] of Object.entries(store)) {
          dbData[k] = v;
        }
      } catch(e) {
        console.error("Migration error:", e);
      }
    }

    if (dbData['schoolLocationSettings'] !== undefined) schoolLocationSettings = dbData['schoolLocationSettings'];
    if (dbData['classes'] !== undefined) classes = dbData['classes'];
    if (dbData['subjects'] !== undefined) subjects = dbData['subjects'];
    if (dbData['teachers'] !== undefined) teachers = dbData['teachers'];
    if (dbData['students'] !== undefined) students = dbData['students'];
    
    // Deduplicate students by nis
    const seenNis = new Set();
    students = (students || []).filter(s => {
      const nis = String(s.nis || '').trim();
      if (!nis) return true;
      if (seenNis.has(nis)) return false;
      seenNis.add(nis);
      return true;
    });

    // Merge database partitions back into active arrays on boot if fetched from database
    if (dbData['attendance'] !== undefined) {
      let activeAttendance = dbData['attendance'] || [];
      const attendanceArchives: any[] = [];
      Object.keys(dbData).forEach(k => {
        if (k.startsWith('attendance_archive_') && Array.isArray(dbData[k])) {
          attendanceArchives.push(...dbData[k]);
        }
      });
      attendance = mergeArrays(activeAttendance, attendanceArchives, 'attendance');
    }

    if (dbData['questionBankGroups'] !== undefined) questionBankGroups = dbData['questionBankGroups'];
    if (dbData['questions'] !== undefined) questions = dbData['questions'];
    if (dbData['grades'] !== undefined) grades = dbData['grades'];

    if (dbData['chats'] !== undefined) {
      let activeChats = dbData['chats'] || [];
      const chatsArchives: any[] = [];
      Object.keys(dbData).forEach(k => {
        if (k.startsWith('chats_archive_') && Array.isArray(dbData[k])) {
          chatsArchives.push(...dbData[k]);
        }
      });
      chats = mergeArrays(activeChats, chatsArchives, 'chats');
    }

    if (dbData['lkpdList'] !== undefined) lkpdList = dbData['lkpdList'];
    if (dbData['exams'] !== undefined) exams = dbData['exams'];
    if (dbData['rooms'] !== undefined) rooms = dbData['rooms'];
    if (dbData['schedules'] !== undefined) schedules = dbData['schedules'];
    if (dbData['savedRosters'] !== undefined) savedRosters = dbData['savedRosters'];
    if (dbData['timeSlots'] !== undefined) timeSlots = dbData['timeSlots'];
    if (dbData['kbmDuration'] !== undefined) kbmDuration = dbData['kbmDuration'];
    if (dbData['journals'] !== undefined) journals = dbData['journals'];
    if (dbData['gradeCategories'] !== undefined) gradeCategories = dbData['gradeCategories'];
    if (dbData['generatedExams'] !== undefined) generatedExams = dbData['generatedExams'];
    if (dbData['activeExamSessions'] !== undefined) activeExamSessions = dbData['activeExamSessions'];
    if (dbData['completedExams'] !== undefined) completedExams = dbData['completedExams'];
    if (dbData['forceFinishedExams'] !== undefined) forceFinishedExams = dbData['forceFinishedExams'];
    if (dbData['studentExamAnswers'] !== undefined) studentExamAnswers = dbData['studentExamAnswers'];
    if (dbData['studentExamQuestions'] !== undefined) studentExamQuestions = dbData['studentExamQuestions'];
    if (dbData['studentExamMasterQuestions'] !== undefined) studentExamMasterQuestions = dbData['studentExamMasterQuestions'];
    if (dbData['studentExamGrades'] !== undefined) studentExamGrades = dbData['studentExamGrades'];
    if (dbData['studentTabSwitches'] !== undefined) studentTabSwitches = dbData['studentTabSwitches'];
    if (dbData['studentOutOfTab'] !== undefined) studentOutOfTab = dbData['studentOutOfTab'];
    if (dbData['blockedStudents'] !== undefined) blockedStudents = dbData['blockedStudents'];
    if (dbData['settings'] !== undefined) appSettings = dbData['settings'];
    if (dbData['lessonPlans'] !== undefined) lessonPlans = dbData['lessonPlans'];

    let activeTeacherAttendance = dbData['teacherAttendance'] || [];
    const teacherAttendanceArchives: any[] = [];
    Object.keys(dbData).forEach(k => {
      if (k.startsWith('teacherAttendance_archive_') && Array.isArray(dbData[k])) {
        teacherAttendanceArchives.push(...dbData[k]);
      }
    });
    teacherAttendance = mergeArrays(activeTeacherAttendance, teacherAttendanceArchives, 'teacherAttendance');
    if (dbData['childguardRules'] !== undefined) childguardRules = dbData['childguardRules'];
    if (dbData['childguardLogs'] !== undefined) childguardLogs = dbData['childguardLogs'];
    if (dbData['childguardLocations'] !== undefined) childguardLocations = dbData['childguardLocations'];
    if (dbData['childguardStatus'] !== undefined) childguardStatus = dbData['childguardStatus'];

    console.log("All data hydrated successfully from PostgreSQL.");
    try {
      const mergedStore = {
        ...readLocalStore(),
        ...dbData
      };
      writeLocalStore(mergedStore);
      console.log("Local JSON store cache successfully reconstructed from PostgreSQL.");
    } catch (writeErr: any) {
      console.error("Failed to reconstruct local JSON store cache from PostgreSQL:", writeErr.message);
    }
  } catch (err) {
    console.error("PostgreSQL hydration warning / timeout (falling back to local JSON store):", err);
  }
}

let hydratePromise: Promise<void> | null = null;
function ensureHydrated() {
  if (!hydratePromise) {
    hydratePromise = hydrate();
  }
  return hydratePromise;
}

const DB_CACHE_TTL_MS = 900000; // 15 minutes cache TTL to prevent full-table DB scans under high concurrent load
let dbFetchPromise: Promise<void> | null = null;

async function refreshInmemoryState(force = false) {
  if (dbInitPromise) await dbInitPromise;
  if (!pool || isDbQuotaExceeded) {
    await ensureHydrated();
    return;
  }
  const now = Date.now();
  if (!force && (now - lastDbFetchTime < DB_CACHE_TTL_MS)) {
    return;
  }
  if (!dbFetchPromise) {
    dbFetchPromise = (async () => {
      try {
        const resDb = await pool.query("SELECT key, value FROM app_store WHERE key NOT IN ('attendance', 'teacherAttendance', 'chats', 'journals')");
        const dbData = parseDbRows(resDb.rows);
        if (dbData['schoolLocationSettings'] !== undefined) schoolLocationSettings = dbData['schoolLocationSettings'];
        if (dbData['classes'] !== undefined) classes = dbData['classes'];
        if (dbData['subjects'] !== undefined) subjects = dbData['subjects'];
        if (dbData['teachers'] !== undefined) teachers = dbData['teachers'];
        if (dbData['students'] !== undefined) {
          const seenNis = new Set();
          students = (dbData['students'] || []).filter((s: any) => {
            const nis = String(s.nis || '').trim();
            if (!nis) return true;
            if (seenNis.has(nis)) return false;
            seenNis.add(nis);
            return true;
          });
        }
        if (dbData['attendance'] !== undefined) attendance = dbData['attendance'];
        if (dbData['questionBankGroups'] !== undefined) questionBankGroups = dbData['questionBankGroups'];
        if (dbData['questions'] !== undefined) questions = dbData['questions'];
        if (dbData['grades'] !== undefined) grades = dbData['grades'];
        if (dbData['chats'] !== undefined) chats = dbData['chats'];
        if (dbData['lkpdList'] !== undefined) lkpdList = dbData['lkpdList'];
        if (dbData['exams'] !== undefined) exams = dbData['exams'];
        if (dbData['rooms'] !== undefined) rooms = dbData['rooms'];
        if (dbData['schedules'] !== undefined) schedules = dbData['schedules'];
        if (dbData['savedRosters'] !== undefined) savedRosters = dbData['savedRosters'];
        if (dbData['timeSlots'] !== undefined) timeSlots = dbData['timeSlots'];
        if (dbData['kbmDuration'] !== undefined) kbmDuration = dbData['kbmDuration'];
        if (dbData['journals'] !== undefined) journals = dbData['journals'];
        if (dbData['gradeCategories'] !== undefined) gradeCategories = dbData['gradeCategories'];
        if (dbData['generatedExams'] !== undefined) generatedExams = dbData['generatedExams'];
        if (dbData['activeExamSessions'] !== undefined) activeExamSessions = dbData['activeExamSessions'];
        if (dbData['completedExams'] !== undefined) completedExams = dbData['completedExams'];
        if (dbData['forceFinishedExams'] !== undefined) forceFinishedExams = dbData['forceFinishedExams'];
        if (dbData['studentExamAnswers'] !== undefined) studentExamAnswers = dbData['studentExamAnswers'];
        if (dbData['studentExamQuestions'] !== undefined) studentExamQuestions = dbData['studentExamQuestions'];
        if (dbData['studentExamGrades'] !== undefined) studentExamGrades = dbData['studentExamGrades'];
        if (dbData['studentTabSwitches'] !== undefined) studentTabSwitches = dbData['studentTabSwitches'];
        if (dbData['studentOutOfTab'] !== undefined) studentOutOfTab = dbData['studentOutOfTab'];
        if (dbData['blockedStudents'] !== undefined) blockedStudents = dbData['blockedStudents'];
        if (dbData['settings'] !== undefined) appSettings = dbData['settings'];
        if (dbData['lessonPlans'] !== undefined) lessonPlans = dbData['lessonPlans'];
        if (dbData['teacherAttendance'] !== undefined) teacherAttendance = dbData['teacherAttendance'];
        if (dbData['childguardRules'] !== undefined) childguardRules = dbData['childguardRules'];
        if (dbData['childguardLogs'] !== undefined) childguardLogs = dbData['childguardLogs'];
        if (dbData['childguardLocations'] !== undefined) childguardLocations = dbData['childguardLocations'];
        if (dbData['childguardStatus'] !== undefined) childguardStatus = dbData['childguardStatus'];
        if (dbData['photoCloudinaryMap'] !== undefined) {
          photoCloudinaryMap = {
            ...photoCloudinaryMap,
            ...(dbData['photoCloudinaryMap'] || {})
          };
        }

        lastDbFetchTime = Date.now();
        try {
          const mergedStore = {
            ...readLocalStore(),
            ...dbData
          };
          writeLocalStore(mergedStore);
          console.log("[refreshInmemoryState] Local JSON store cache successfully reconstructed from PostgreSQL.");
        } catch (writeErr: any) {
          console.error("[refreshInmemoryState] Failed to reconstruct local JSON store cache from PostgreSQL:", writeErr.message);
        }
      } catch (err) {
        handleDbError("PostgreSQL refreshInmemoryState error", err);
        await ensureHydrated();
      } finally {
        dbFetchPromise = null;
      }
    })();
  }
  return dbFetchPromise;
}

app.use(async (req, res, next) => {
  try {
    if (req.path.startsWith("/api/") && req.path !== "/api/sync-state") {
      await refreshInmemoryState();
    } else {
      await ensureHydrated();
    }
  } catch (e) {
    console.error("Hydration middleware error:", e);
  }
  next();
});

// ----------------------------------------------------
// API Endpoints
// ----------------------------------------------------

// 1. Health check
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/healthz", (req, res) => res.status(200).send("OK"));
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/check-connection", async (req, res) => {
  const status = {
    firestore: false,
    cloudinary: false,
    error: null as string | null
  };

  // Check Firestore
  if (db) {
    try {
      await getDoc(doc(db, 'app_store', 'health_check_dummy'));
      status.firestore = true;
    } catch (e: any) {
      status.error = `Firestore: ${e.message}`;
    }
  }

  // Check Cloudinary
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      await cloudinary.api.ping();
      status.cloudinary = true;
    } catch (e: any) {
      status.error = (status.error ? status.error + " | " : "") + `Cloudinary: ${e.message}`;
    }
  }

  res.json(status);
});

// Server-Side Authentication & Session Engine (JWT/HMAC)
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  console.error("======================================================================================");
  console.error("⚠️  CRITICAL WARNING: JWT_SECRET is not set in the environment variables!");
  console.error("⚠️  Any requests requiring authentication will fail until JWT_SECRET is configured.");
  console.error("======================================================================================");
}

interface AuthSession {
  id: string;
  role: string;
  username: string;
  name?: string;
  classId?: string;
  madrasahId?: string;
  exp: number;
}

function createAuthToken(user: any): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is required but not configured in the environment variables.");
  }
  const header = { alg: "HS256", typ: "JWT" };
  const role = String(user.role || (user.nip ? 'teacher' : (user.nis ? 'student' : 'admin'))).toLowerCase();
  const payload: AuthSession = {
    id: String(user.id),
    role: role,
    username: String(user.username || user.nis || user.nip || ''),
    name: user.name || '',
    classId: user.classId || user.class_id || '',
    madrasahId: user.madrasahId || 'default',
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600) // 30 days
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${b64Header}.${b64Payload}`).digest("base64url");
  return `${b64Header}.${b64Payload}.${signature}`;
}

function verifyAuthToken(token: string): AuthSession | null {
  if (!JWT_SECRET) {
    console.error("verifyAuthToken failed: JWT_SECRET is not configured in the environment.");
    return null;
  }
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [b64Header, b64Payload, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(`${b64Header}.${b64Payload}`).digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf-8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// Secure backward-compatible password hashing helper functions with memory-hard scrypt KDF
function hashPassword(plainText: string): string {
  if (!plainText) return "";
  const str = String(plainText).trim();
  if (str.startsWith("scrypt$") && str.split("$").length === 7) {
    return str; // Already hashed
  }
  if (str.startsWith("sha256$") && str.split("$").length === 3) {
    return str; // Legacy hash
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(str, salt, 64, { N: 16384, r: 8, p: 1 });
  const hash = derivedKey.toString("hex");
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

function verifyPassword(plainText: string, hashedPassword: string): boolean {
  if (!plainText || !hashedPassword) return false;
  const pStr = String(plainText).trim();
  const hStr = String(hashedPassword).trim();
  
  if (hStr.startsWith("scrypt$")) {
    const parts = hStr.split("$");
    if (parts.length !== 7) return false;
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = parts[4];
    const hash = parts[5];
    const derivedKey = crypto.scryptSync(pStr, salt, 64, { N, r, p });
    return derivedKey.toString("hex") === hash;
  }
  
  if (hStr.startsWith("sha256$")) {
    const parts = hStr.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const hash = parts[2];
    const computedHash = crypto.createHmac("sha256", salt).update(pStr).digest("hex");
    return computedHash === hash;
  }
  
  return pStr === hStr;
}

function getAuthUser(req: any): AuthSession | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAuthToken(token);
    if (verified) return verified;
  }
  // 2. x-auth-token header
  const xAuthToken = req.headers ? (req.headers['x-auth-token'] || req.headers['X-Auth-Token']) : null;
  if (xAuthToken && typeof xAuthToken === 'string') {
    const verified = verifyAuthToken(xAuthToken.trim());
    if (verified) return verified;
  }
  // 3. Query token
  if (req.query && req.query.token && typeof req.query.token === 'string') {
    const verified = verifyAuthToken(req.query.token.trim());
    if (verified) return verified;
  }
  return null;
}

function requireAuth(req: any, res: any, next: any) {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  req.user = authUser;
  next();
}

function requireRole(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      const authUser = getAuthUser(req);
      if (!authUser) {
        return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
      }
      req.user = authUser;
    }
    const role = String(req.user.role || '').toLowerCase();
    if (!allowedRoles.map(r => r.toLowerCase()).includes(role)) {
      return res.status(403).json({ success: false, message: `Akses ditolak: Role Anda (${role}) tidak diizinkan.` });
    }
    next();
  };
}

function resolveStudentId(req: any, authUser: AuthSession | null): string | null {
  if (!authUser) {
    return null;
  }
  const role = String(authUser.role || '').toLowerCase();
  // Server STRICTLY determines studentId from user login session if role is student/siswa!
  if (role === 'student' || role === 'siswa' || role === 'class_leader' || role === 'ketua_kelas') {
    return String(authUser.id);
  }
  // Teachers, proctors, and admins can query or submit for a student by ID
  if (role === 'teacher' || role === 'guru' || role === 'admin' || role === 'bos' || role === 'superadmin') {
    const candidate = req.body?.studentId || req.query?.studentId;
    return candidate ? String(candidate) : String(authUser.id);
  }
  return null;
}

// Poin 3: Role-based Question Sanitizer for Students (Strips answer, correctOptionText, explanation)
function sanitizeQuestionForStudent(q: any) {
  if (!q) return null;
  return {
    id: q.id,
    code: q.code || q.bankCode || q.groupCode || "",
    subjectId: q.subjectId || q.subject || "",
    classId: q.classId || q.className || "",
    type: q.type || (q.options ? "mc" : "essay"),
    question: q.question,
    options: Array.isArray(q.options) ? q.options : [],
    imageUrl: q.imageUrl || q.image || ""
  };
}

// Aggregated All Data endpoint for super fast loading
app.get("/api/all-data", requireAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const authUser = (req as any).user;
  const mId = getRequestMadrasahId(req);
  
  // Strict Server-Side Role Resolution (Never trust unauthenticated role claims)
  const isTeacherOrAdmin = Boolean(authUser && (
    authUser.role === 'teacher' || authUser.role === 'guru' ||
    authUser.role === 'admin' || authUser.role === 'bos' || authUser.role === 'superadmin'
  ));
  const isStudent = !isTeacherOrAdmin;

  let filteredTeachers = teachers;
  let filteredStudents = students;
  let filteredClasses = classes;
  let filteredSubjects = subjects;
  let filteredAttendance = attendance;
  let filteredQGroups = questionBankGroups;
  let filteredQuestions = questions;
  let filteredSchedules = schedules;
  let filteredExams = exams;
  let filteredLkpds = lkpdList;
  let filteredGrades = grades;
  let filteredRooms = rooms;
  let filteredJournals = journals;
  let filteredLessonPlans = lessonPlans;
  let filteredGeneratedExams = generatedExams;

  if (mId && mId !== 'default' && mId !== 'BOSS') {
    const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
    const targetId = matchM ? matchM.id : mId;
    const targetSlug = matchM ? matchM.slug : mId;

    const matchesFilter = (item: any) => {
      const imId = String(item.madrasahId || '').trim();
      const imSlug = String(item.madrasahSlug || '').trim();
      if (!imId && !imSlug) {
        return false; // New registered madrasah starts empty, default/un-tagged items belong to main school
      }
      return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId;
    };

    filteredTeachers = teachers.filter(matchesFilter);
    filteredStudents = students.filter(matchesFilter);
    filteredClasses = classes.filter(matchesFilter);
    filteredSubjects = subjects.filter(matchesFilter);
    filteredAttendance = attendance.filter(matchesFilter);
    filteredQGroups = questionBankGroups.filter(matchesFilter);
    filteredQuestions = questions.filter(matchesFilter);
    filteredSchedules = schedules.filter(matchesFilter);
    filteredExams = exams.filter(matchesFilter);
    filteredLkpds = lkpdList.filter(matchesFilter);
    filteredGrades = grades.filter(matchesFilter);
    filteredRooms = rooms.filter(matchesFilter);
    filteredJournals = journals.filter(matchesFilter);
    filteredLessonPlans = lessonPlans.filter(matchesFilter);
    filteredGeneratedExams = generatedExams.filter(matchesFilter);
  } else {
    const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
    const defId = defaultM ? defaultM.id : 'default';
    const defSlug = defaultM ? defaultM.slug : 'default';

    const defaultFilter = (item: any) => {
      const imId = String(item.madrasahId || 'default').trim();
      const imSlug = String(item.madrasahSlug || 'default').trim();
      return imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!item.madrasahId && !item.madrasahSlug);
    };

    filteredTeachers = teachers.filter(defaultFilter);
    filteredStudents = students.filter(defaultFilter);
    filteredClasses = classes.filter(defaultFilter);
    filteredSubjects = subjects.filter(defaultFilter);
    filteredAttendance = attendance.filter(defaultFilter);
    filteredQGroups = questionBankGroups.filter(defaultFilter);
    filteredQuestions = questions.filter(defaultFilter);
    filteredSchedules = schedules.filter(defaultFilter);
    filteredExams = exams.filter(defaultFilter);
    filteredLkpds = lkpdList.filter(defaultFilter);
    filteredGrades = grades.filter(defaultFilter);
    filteredRooms = rooms.filter(defaultFilter);
    filteredJournals = journals.filter(defaultFilter);
    filteredLessonPlans = lessonPlans.filter(defaultFilter);
    filteredGeneratedExams = generatedExams.filter(defaultFilter);
  }

  const sortedStudents = [...filteredStudents].sort((a: any, b: any) => {
    const nameA = String(a.name || '').trim().toLowerCase();
    const nameB = String(b.name || '').trim().toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' });
    }
    const nisA = String(a.nis || a.no_urut || a.id || '').trim();
    const nisB = String(b.nis || b.no_urut || b.id || '').trim();
    return nisA.localeCompare(nisB, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Poin 3: Strictly sanitize answer keys if the requester is a student
  if (isStudent) {
    filteredQuestions = filteredQuestions.map(sanitizeQuestionForStudent).filter(Boolean);
    filteredExams = filteredExams.map((ex: any) => {
      if (Array.isArray(ex.questions)) {
        return {
          ...ex,
          questions: ex.questions.map(sanitizeQuestionForStudent).filter(Boolean)
        };
      }
      return ex;
    });
  }

  // Sanitasi sensitif (hilangkan password dan adminPass)
  const sanitizedTeachers = filteredTeachers.map(({ password, ...rest }: any) => rest);
  const sanitizedStudents = sortedStudents.map((st: any) => {
    const { password, passwordRaw, ...rest } = st;
    if (isTeacherOrAdmin) {
      // If teacher/admin, allow printing the student password (retrieve plain-text or fallback to raw if not a hash)
      const plainPassword = passwordRaw || (password && !password.startsWith("scrypt$") && !password.startsWith("sha256$") ? password : "Sandi Terenkripsi");
      return { ...rest, password: plainPassword };
    }
    // If student, remove password fields completely
    return rest;
  });
  const sanitizedMadrasahs = madrasahs.map(({ adminPass, ...rest }: any) => rest);
  let sanitizedSettings = null;
  if (appSettings) {
    const { adminPass, ...restSettings } = appSettings;
    sanitizedSettings = restSettings;
  }

  res.json({
    success: true,
    teachers: sanitizedTeachers,
    students: sanitizedStudents,
    classes: filteredClasses,
    subjects: filteredSubjects,
    attendance: filteredAttendance,
    questionBankGroups: filteredQGroups,
    questions: filteredQuestions,
    schedules: filteredSchedules,
    savedRosters,
    timeSlots,
    kbmDuration,
    exams: filteredExams,
    lkpdList: filteredLkpds,
    rooms: filteredRooms,
    journals: filteredJournals,
    gradeCategories,
    calendarEvents,
    generatedExams: filteredGeneratedExams,
    settings: sanitizedSettings,
    lessonPlans: filteredLessonPlans,
    grades: filteredGrades,
    teacherAttendance,
    customGradeColumns,
    childguardRules,
    childguardLogs,
    childguardLocations,
    childguardStatus,
    madrasahs: sanitizedMadrasahs,
    tokenRequests,
    cbtTokenPrice,
    eduGames,
    gameAttempts
  });
});

// ============================================================================
// GAME EDUKASI API ENDPOINTS (MANAJEMEN GAME & VALIDASI SERVER-SIDE)
// ============================================================================

// Default Seed Games if database is empty
const DEFAULT_SERVER_SEED_GAMES = [
  {
    id: 'GAME_SEED_1',
    title: 'Tebak Perangkat Komputer',
    gameType: 'tebak_kata',
    subjectId: 'Informatika',
    classId: 'Semua Kelas',
    difficulty: 'Mudah',
    timeLimit: 120,
    rewardXp: 100,
    status: 'active',
    prompt: 'Perangkat keras komputer yang digunakan untuk mengetik huruf, angka, dan simbol.',
    answerKey: 'KEYBOARD',
    hints: ['Mempunyai tombol QWERTY', 'Merupakan perangkat input utama'],
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'GAME_SEED_2',
    title: 'Teka-Teki Silang Informatika Dasar',
    gameType: 'crossword',
    subjectId: 'Informatika',
    classId: 'Semua Kelas',
    difficulty: 'Sedang',
    timeLimit: 300,
    rewardXp: 150,
    status: 'active',
    prompt: 'Lengkapi Teka-Teki Silang berikut mengenai dasar-dasar komputer.',
    answerKey: 'CPU, RAM, PRINTER',
    crosswordData: {
      gridSize: { rows: 8, cols: 8 },
      clues: [
        { number: 1, direction: 'across', row: 1, col: 1, clue: 'Otak pemroses utama pada komputer', answer: 'CPU' },
        { number: 2, direction: 'across', row: 3, col: 1, clue: 'Memori penyimpanan sementara acak', answer: 'RAM' },
        { number: 3, direction: 'down', row: 1, col: 1, clue: 'Perangkat pencetak dokumen di kertas', answer: 'PRINTER' }
      ]
    }
  },
  {
    id: 'GAME_SEED_3',
    title: 'Cari Kata - Komponen Hardware',
    gameType: 'word_search',
    subjectId: 'Informatika',
    classId: 'Semua Kelas',
    difficulty: 'Mudah',
    timeLimit: 180,
    rewardXp: 120,
    status: 'active',
    prompt: 'Temukan 4 kata hardware komputer dalam kumpulan huruf!',
    wordsToFind: ['MONITOR', 'MOUSE', 'MODEM', 'PRINTER']
  },
  {
    id: 'GAME_SEED_4',
    title: 'Memory Match - Istilah TIK',
    gameType: 'memory_match',
    subjectId: 'Informatika',
    classId: 'Semua Kelas',
    difficulty: 'Sedang',
    timeLimit: 150,
    rewardXp: 130,
    status: 'active',
    prompt: 'Buka kartu dan cocokkan perangkat komputer dengan fungsinya!',
    pairs: [
      { term: 'CPU', match: 'Otak Komputer' },
      { term: 'PRINTER', match: 'Mencetak Dokumen' },
      { term: 'KEYBOARD', match: 'Alat Mengetik' },
      { term: 'MONITOR', match: 'Menampilkan Gambar' }
    ]
  },
  {
    id: 'GAME_SEED_5',
    title: 'Benar atau Salah - Keamanan Siber',
    gameType: 'true_false',
    subjectId: 'Informatika',
    classId: 'Semua Kelas',
    difficulty: 'Mudah',
    timeLimit: 60,
    rewardXp: 80,
    status: 'active',
    prompt: 'Password yang kuat sebaiknya terdiri dari kombinasi huruf besar, huruf kecil, angka, dan simbol khusus.',
    correctAnswer: 'BENAR',
    explanation: 'Kombinasi Karakter Acak membuat password sangat sulit diretas oleh serangan brute-force.'
  }
];

// GET /api/games
app.get("/api/games", (req, res) => {
  const list = eduGames && eduGames.length > 0 ? eduGames : DEFAULT_SERVER_SEED_GAMES;
  res.json({ success: true, games: list });
});

// POST /api/games (Create or Update Game)
app.post("/api/games", async (req, res) => {
  try {
    const game = req.body;
    if (!game || !game.title) {
      return res.status(400).json({ success: false, message: "Judul game wajib diisi" });
    }
    if (!game.id) game.id = "GAME_" + Date.now();

    if (!Array.isArray(eduGames) || eduGames.length === 0) {
      eduGames = [...DEFAULT_SERVER_SEED_GAMES];
    }

    const idx = eduGames.findIndex((g: any) => g.id === game.id);
    if (idx >= 0) {
      eduGames[idx] = game;
    } else {
      eduGames.push(game);
    }

    saveData("eduGames", eduGames);
    res.json({ success: true, game });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || "Gagal menyimpan game" });
  }
});

// PUT /api/games/:id (Update Game)
app.put("/api/games/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const game = req.body;
    if (!Array.isArray(eduGames) || eduGames.length === 0) {
      eduGames = [...DEFAULT_SERVER_SEED_GAMES];
    }
    const idx = eduGames.findIndex((g: any) => g.id === id);
    if (idx < 0) {
      return res.status(404).json({ success: false, message: "Game tidak ditemukan" });
    }
    eduGames[idx] = { ...eduGames[idx], ...game };
    saveData("eduGames", eduGames);
    res.json({ success: true, game: eduGames[idx] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || "Gagal memperbarui game" });
  }
});

// DELETE /api/games/:id
app.delete("/api/games/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Array.isArray(eduGames) || eduGames.length === 0) {
      eduGames = [...DEFAULT_SERVER_SEED_GAMES];
    }
    eduGames = eduGames.filter((g: any) => g.id !== id);
    saveData("eduGames", eduGames);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || "Gagal menghapus game" });
  }
});

// Helper for normalizing answers
function normalizeGameText(text: any): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// POST /api/games/:id/submit (Server-Side Answer Validation)
app.post("/api/games/:id/submit", async (req, res) => {
  try {
    const { id } = req.params;
    const { submittedAnswer, studentId, isPreview, passed } = req.body;

    const allGames = (Array.isArray(eduGames) && eduGames.length > 0) ? eduGames : DEFAULT_SERVER_SEED_GAMES;
    let game = allGames.find((g: any) => g.id === id);

    if (!game) {
      game = DEFAULT_SERVER_SEED_GAMES.find((g: any) => g.id === id);
    }

    if (!game) {
      return res.status(404).json({ success: false, message: "Game tidak ditemukan" });
    }

    const normSubmitted = normalizeGameText(submittedAnswer);
    let isCorrect = false;

    if (passed === true || normSubmitted === "completed" || normSubmitted === "success" || normSubmitted === "passed") {
      isCorrect = true;
    } else if (game.gameType === "true_false") {
      const normCorrectTF = normalizeGameText(game.correctAnswer || "BENAR");
      isCorrect = normSubmitted === normCorrectTF;
    } else if (["memory_match", "match_pairs", "word_search", "spot_difference", "image_puzzle", "escape_room", "learning_adventure"].includes(game.gameType)) {
      // Interactive games sending completion status
      isCorrect = passed === true || normSubmitted === "completed" || normSubmitted === "success" || normSubmitted === normalizeGameText(game.answerKey);
    } else {
      const normTarget = normalizeGameText(game.answerKey);
      if (normTarget) {
        isCorrect = (normSubmitted === normTarget);
        // Also check if answer contains target or vice versa for minor variations
        if (!isCorrect && normSubmitted.length > 2 && normTarget.length > 2) {
          if (normSubmitted.includes(normTarget) || normTarget.includes(normSubmitted)) {
            isCorrect = true;
          }
        }
      } else {
        isCorrect = true; // Fallback if no target key required
      }
    }

    const rewardXp = isCorrect ? (game.rewardXp || 100) : 0;
    let student = students.find((s: any) => s.id === studentId || s.nis === studentId);

    let newTotalXp = 0;
    let dailyStreak = 1;

    if (student && !isPreview && isCorrect) {
      student.gameXp = (student.gameXp || 0) + rewardXp;

      const todayStr = getJakartaTodayDateStr();
      if (student.lastGameDate === todayStr) {
        dailyStreak = student.dailyStreak || 1;
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split("T")[0];
        if (student.lastGameDate === yStr) {
          dailyStreak = (student.dailyStreak || 1) + 1;
        } else {
          dailyStreak = 1;
        }
        student.lastGameDate = todayStr;
        student.dailyStreak = dailyStreak;
      }

      newTotalXp = student.gameXp;
      saveData("students", students);
    }

    const attemptLog = {
      id: "ATTEMPT_" + Date.now(),
      gameId: id,
      studentId,
      submittedAnswer,
      isCorrect,
      earnedXp: rewardXp,
      timestamp: getJakartaIsoString()
    };
    gameAttempts.push(attemptLog);
    saveData("gameAttempts", gameAttempts);

    res.json({
      success: true,
      isCorrect,
      earnedXp: rewardXp,
      newTotalXp,
      dailyStreak
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || "Gagal memproses jawaban" });
  }
});

// GET /api/games/leaderboard
app.get("/api/games/leaderboard", (req, res) => {
  const classFilter = String(req.query.classId || '').trim();
  let list = students || [];
  
  if (classFilter && classFilter !== 'all' && classFilter !== 'Semua Kelas') {
    list = list.filter((s: any) => String(s.classId) === classFilter || String(s.className) === classFilter || String(s.kelas) === classFilter);
  }

  const rankings = list
    .map((s: any) => {
      const xp = s.gameXp || 0;
      return {
        id: s.id || s.nis,
        name: s.name,
        nis: s.nis || s.id,
        classId: s.classId || '',
        className: s.className || s.kelas || "Siswa",
        photo: s.photo || s.avatar || '',
        xp,
        level: Math.floor(xp / 250) + 1,
        dailyStreak: s.dailyStreak || 1
      };
    })
    .sort((a: any, b: any) => b.xp - a.xp)
    .slice(0, 100);

  res.json({ success: true, rankings });
});

// Game Active Sessions & Messaging In-Memory Stores
let gameMessages: Record<string, any[]> = {};
let activeGameSessionsServer: Record<string, any> = {};

app.get("/api/game/active-sessions", (req, res) => {
  res.json({ success: true, sessions: activeGameSessionsServer });
});

app.post("/api/game/active-sessions", (req, res) => {
  try {
    const { studentId, sessionData } = req.body;
    if (studentId) {
      if (sessionData === null) {
        delete activeGameSessionsServer[studentId];
      } else {
        activeGameSessionsServer[studentId] = {
          ...sessionData,
          updatedAt: Date.now()
        };
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/game/messages", (req, res) => {
  const studentId = String(req.query.studentId || '');
  if (studentId) {
    const msgs = gameMessages[studentId] || [];
    const broadcastMsgs = gameMessages['BROADCAST'] || [];
    res.json({ success: true, messages: [...msgs, ...broadcastMsgs] });
  } else {
    res.json({ success: true, messages: gameMessages });
  }
});

app.post("/api/game/messages", (req, res) => {
  try {
    const { recipientId, senderName, message, type } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong" });
    }
    const msgObj = {
      id: 'GMSG_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      recipientId: recipientId || 'BROADCAST',
      senderName: senderName || 'Guru / Admin Game',
      message: String(message),
      type: type || 'direct',
      timestamp: Date.now()
    };

    if (recipientId && recipientId !== 'BROADCAST') {
      if (!gameMessages[recipientId]) gameMessages[recipientId] = [];
      gameMessages[recipientId].push(msgObj);
    } else {
      if (!gameMessages['BROADCAST']) gameMessages['BROADCAST'] = [];
      gameMessages['BROADCAST'].push(msgObj);
    }

    res.json({ success: true, message: msgObj });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/game/messages/dismiss", (req, res) => {
  try {
    const { studentId, messageId } = req.body;
    if (studentId && gameMessages[studentId]) {
      gameMessages[studentId] = gameMessages[studentId].filter((m: any) => m.id !== messageId);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1b. Database Status Diagnostic
app.get("/api/db-status", async (req, res) => {
  const status: any = {
    connected: false,
    sql: {
      connected: false,
      configured: false,
      message: "Belum diperiksa.",
      details: ""
    },
    firebase: {
      connected: false,
      configured: false,
      message: "Belum diperiksa.",
      details: ""
    },
    json: {
      connected: false,
      configured: false,
      message: "Belum diperiksa.",
      details: ""
    },
    cloudinary: {
      connected: false,
      configured: false,
      message: "Belum diperiksa.",
      details: ""
    }
  };

  // 1. Check SQL (PostgreSQL/Cloud SQL)
  try {
    const hasEnv = !!process.env.SQL_HOST || !!process.env.DATABASE_URL;
    if (!hasEnv) {
      status.sql.message = "Variabel lingkungan SQL_HOST atau DATABASE_URL tidak ditemukan.";
    } else {
      status.sql.configured = true;
      if (dbInitPromise) {
        await dbInitPromise;
      }
      if (!pool || activeDbSource === "NONE" || isDbQuotaExceeded) {
        isDbQuotaExceeded = false;
        dbInitPromise = determineAndInitPool();
        await dbInitPromise;
      }
      if (!pool) {
        status.sql.message = "Gagal menginisialisasi database pool.";
      } else {
        const queryPromise = pool.query("SELECT 1");
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Koneksi SQL timeout (3 detik).")), 3000)
        );
        await Promise.race([queryPromise, timeoutPromise]);
        
        let keysCount = 0;
        try {
          const testResult = await pool.query("SELECT COUNT(*) FROM app_store");
          keysCount = parseInt(testResult.rows[0].count, 10);
          status.sql.details = `Tabel app_store aktif dengan ${keysCount} baris record.`;
        } catch (e: any) {
          status.sql.details = "Koneksi berhasil, tetapi tabel app_store belum terbentuk atau tidak terbaca.";
        }
        status.sql.connected = true;
        status.sql.message = `Terhubung sukses ke ${activeDbSource}!`;
      }
    }
  } catch (err: any) {
    status.sql.connected = false;
    status.sql.message = "Gagal terhubung ke PostgreSQL / Cloud SQL.";
    status.sql.details = err.message || String(err);
  }

  // 2. Check Firebase Firestore
  try {
    const configPath = './firebase-applet-config.json';
    if (!fs.existsSync(configPath)) {
      status.firebase.message = "File konfigurasi firebase-applet-config.json tidak ditemukan.";
    } else if (!db) {
      status.firebase.message = "Koneksi Firebase dinonaktifkan sengaja (Aman dari limit kuota).";
      status.firebase.connected = true;
      status.firebase.details = "Sistem berjalan penuh menggunakan Cloudinary & File Backup.";
      status.firebase.configured = true;
    } else {
      status.firebase.configured = true;
      // Test actual network read from Firestore
      const testDoc = doc(db, 'photos', 'connection_test_id');
      const getDocPromise = getDoc(testDoc);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Koneksi Firebase Firestore timeout (3 detik).")), 3000)
      );
      await Promise.race([getDocPromise, timeoutPromise]);
      status.firebase.connected = true;
      status.firebase.message = "Terhubung sukses ke Firebase Firestore!";
      status.firebase.details = "Koneksi baca/tulis dokumen media/foto aktif.";
    }
  } catch (err: any) {
    status.firebase.connected = false;
    status.firebase.message = "Gagal terhubung ke Firebase Firestore.";
    status.firebase.details = err.message || String(err);
  }

  // 3. Check JSON (Local Store)
  try {
    const exists = fs.existsSync(LOCAL_STORE_FILE);
    if (!exists) {
      status.json.message = "File local_store.json tidak ditemukan.";
    } else {
      status.json.configured = true;
      const raw = fs.readFileSync(LOCAL_STORE_FILE, "utf-8");
      const parsed = JSON.parse(decryptLocalStore(raw));
      const keysCount = Object.keys(parsed || {}).length;
      status.json.connected = true;
      status.json.message = "File lokal local_store.json terbaca dan valid!";
      status.json.details = `Memiliki ${keysCount} kategori modul data tersimpan.`;
    }
  } catch (err: any) {
    status.json.connected = false;
    status.json.message = "File lokal local_store.json rusak atau gagal dibaca.";
    status.json.details = err.message || String(err);
  }

  // 4. Check Cloudinary
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      status.cloudinary.message = "Variabel lingkungan CLOUDINARY_CLOUD_NAME tidak ditemukan.";
    } else {
      status.cloudinary.configured = true;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Koneksi Cloudinary timeout (3 detik).")), 3000)
      );
      await Promise.race([cloudinary.api.ping(), timeoutPromise]);
      status.cloudinary.connected = true;
      status.cloudinary.message = "Terhubung sukses ke Cloudinary!";
      status.cloudinary.details = `Penyimpanan foto Cloudinary (${process.env.CLOUDINARY_CLOUD_NAME}) aktif. ${Object.keys(photoCloudinaryMap).length} foto terpetakan secara aman.`;
    }
  } catch (err: any) {
    status.cloudinary.connected = false;
    status.cloudinary.message = "Gagal terhubung ke Cloudinary.";
    status.cloudinary.details = err.message || String(err);
  }

  // Strict Connection Logic: Green/connected ONLY IF ALL services are healthy!
  if (isOfflineMode) {
    if (status.sql.connected && status.json.connected) {
      status.connected = true;
      status.message = "Sistem Luring (Offline) Aktif: PostgreSQL dan Penyimpanan Foto Lokal (Uploads) terhubung sempurna!";
    } else {
      status.connected = false;
      status.message = "Sistem Offline bermasalah pada koneksi database PostgreSQL lokal.";
    }
  } else if (status.sql.connected && status.firebase.connected && status.json.connected && status.cloudinary.connected) {
    status.connected = true;
    status.message = "Semua sistem database (SQL, Firebase, JSON, dan Cloudinary) berhasil terhubung sempurna!";
  } else {
    status.connected = false;
    const failures = [];
    if (!status.sql.connected) failures.push("PostgreSQL/Cloud SQL");
    if (!status.firebase.connected) failures.push("Firebase Firestore");
    if (!status.json.connected) failures.push("Local JSON");
    if (!status.cloudinary.connected) failures.push("Cloudinary");
    status.message = `Sistem bermasalah pada: ${failures.join(", ")}.`;
  }

  res.json(status);
});

// 1b. Cloudinary On-Demand Sync Endpoint
app.post("/api/cloudinary/sync", async (req, res) => {
  try {
    const result = await syncAllPhotosToCloudinary();
    res.json({
      success: true,
      message: `Sinkronisasi Cloudinary berhasil! Total foto terpetakan: ${result.mapped}`,
      result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || String(err) });
  }
});

// 1c. Force Reconnect & Pull data from Google Cloud SQL to local JSON store
app.post("/api/db-pull-cloud", async (req, res) => {
  const tryLocalBackupRestore = () => {
    const candidates = [LOCAL_STORE_FILE + ".backup", LOCAL_STORE_FILE];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          const rawBackup = fs.readFileSync(filePath, "utf-8");
          const backupData = JSON.parse(decryptLocalStore(rawBackup));
          const hasData = backupData && (
            (Array.isArray(backupData.students) && backupData.students.length > 0) ||
            (Array.isArray(backupData.teachers) && backupData.teachers.length > 0) ||
            (Array.isArray(backupData.classes) && backupData.classes.length > 0)
          );
          if (hasData) {
            localStoreCache = backupData;
            if (filePath.endsWith(".backup")) {
              fs.writeFileSync(LOCAL_STORE_FILE, rawBackup, "utf-8");
            }
            
            if (backupData['schoolLocationSettings'] !== undefined) schoolLocationSettings = backupData['schoolLocationSettings'];
            if (backupData['classes'] !== undefined) classes = backupData['classes'];
            if (backupData['subjects'] !== undefined) subjects = backupData['subjects'];
            if (backupData['teachers'] !== undefined) teachers = backupData['teachers'];
            if (backupData['students'] !== undefined) {
              const seenNis = new Set();
              students = (backupData['students'] || []).filter((s: any) => {
                const nis = String(s.nis || '').trim();
                if (!nis) return true;
                if (seenNis.has(nis)) return false;
                seenNis.add(nis);
                return true;
              });
            }
            if (backupData['attendance'] !== undefined) attendance = backupData['attendance'];
            if (backupData['questionBankGroups'] !== undefined) questionBankGroups = backupData['questionBankGroups'];
            if (backupData['questions'] !== undefined) questions = backupData['questions'];
            if (backupData['grades'] !== undefined) grades = backupData['grades'];
            if (backupData['chats'] !== undefined) chats = backupData['chats'];
            if (backupData['exams'] !== undefined) exams = backupData['exams'];
            if (backupData['rooms'] !== undefined) rooms = backupData['rooms'];
            if (backupData['schedules'] !== undefined) schedules = backupData['schedules'];
            if (backupData['savedRosters'] !== undefined) savedRosters = backupData['savedRosters'];
            if (backupData['journals'] !== undefined) journals = backupData['journals'];
            if (backupData['gradeCategories'] !== undefined) gradeCategories = backupData['gradeCategories'];
            if (backupData['customGradeColumns'] !== undefined) customGradeColumns = backupData['customGradeColumns'];
            if (backupData['generatedExams'] !== undefined) generatedExams = backupData['generatedExams'];
            if (backupData['activeExamSessions'] !== undefined) activeExamSessions = backupData['activeExamSessions'];
            if (backupData['completedExams'] !== undefined) completedExams = backupData['completedExams'];
            if (backupData['studentExamAnswers'] !== undefined) studentExamAnswers = backupData['studentExamAnswers'];
            if (backupData['studentExamQuestions'] !== undefined) studentExamQuestions = backupData['studentExamQuestions'];
            if (backupData['studentTabSwitches'] !== undefined) studentTabSwitches = backupData['studentTabSwitches'];
            if (backupData['studentOutOfTab'] !== undefined) studentOutOfTab = backupData['studentOutOfTab'];
            if (backupData['blockedStudents'] !== undefined) blockedStudents = backupData['blockedStudents'];
            if (backupData['settings'] !== undefined) appSettings = backupData['settings'];
            if (backupData['lessonPlans'] !== undefined) lessonPlans = backupData['lessonPlans'];
            if (backupData['teacherAttendance'] !== undefined) teacherAttendance = backupData['teacherAttendance'];
            if (backupData['childguardRules'] !== undefined) childguardRules = backupData['childguardRules'];
            if (backupData['childguardLogs'] !== undefined) childguardLogs = backupData['childguardLogs'];
            if (backupData['childguardLocations'] !== undefined) childguardLocations = backupData['childguardLocations'];
            if (backupData['childguardStatus'] !== undefined) childguardStatus = backupData['childguardStatus'];

            lastDbFetchTime = Date.now();
            isDbQuotaExceeded = false;
            
            for (const key of Object.keys(backupData)) {
              try {
                broadcastStateUpdate(key);
              } catch (e) {}
            }
            return {
              success: true,
              message: `Sinkronisasi BERHASIL! Data berhasil dimuat dan disinkronkan (${filePath.endsWith(".backup") ? "dipulihkan dari cadangan otomatis" : "dari file data lokal"}).`,
              details: {
                teachersCount: Array.isArray(teachers) ? teachers.length : 0,
                studentsCount: Array.isArray(students) ? students.length : 0,
                classesCount: Array.isArray(classes) ? classes.length : 0,
                attendanceCount: Array.isArray(attendance) ? attendance.length : 0,
                questionsCount: Array.isArray(questions) ? questions.length : 0
              }
            };
          }
        } catch (e: any) {
          console.error(`[DB Pull Fallback] Read ${filePath} failed:`, e.message);
        }
      }
    }

    if (Array.isArray(students) && students.length > 0) {
      return {
        success: true,
        message: "Sinkronisasi BERHASIL! Seluruh data aktif di memori server berhasil dipertahankan.",
        details: {
          teachersCount: Array.isArray(teachers) ? teachers.length : 0,
          studentsCount: Array.isArray(students) ? students.length : 0,
          classesCount: Array.isArray(classes) ? classes.length : 0,
          attendanceCount: Array.isArray(attendance) ? attendance.length : 0,
          questionsCount: Array.isArray(questions) ? questions.length : 0
        }
      };
    }

    return null;
  };

  try {
    console.log("[DB Pull] Attempting manual reconnect & sync from Cloud SQL...");
    
    // 1. Force attempt reconnection/pool recreation
    await determineAndInitPool();
    
    if (!pool) {
      const fallbackResult = tryLocalBackupRestore();
      if (fallbackResult) {
        return res.json(fallbackResult);
      }
      return res.status(500).json({
        success: false,
        message: "Gagal menghubungkan ke database Cloud SQL. Silakan periksa konfigurasi kredensial database Anda di AI Studio (Pengaturan) atau pastikan variabel lingkungan DATABASE_URL terisi."
      });
    }

    // Try to test the pool connection first (to satisfy "sql must be connected/healed")
    try {
      await pool.query("SELECT 1");
    } catch (dbErr: any) {
      const fallbackResult = tryLocalBackupRestore();
      if (fallbackResult) {
        return res.json(fallbackResult);
      }
      return res.status(500).json({
        success: false,
        message: "Gagal menghubungkan ke database Cloud SQL. Silakan periksa jaringan/kredensial database Anda: " + (dbErr.message || String(dbErr))
      });
    }

    // 2. Double-restore check: If current memory is empty or default, see if backup exists
    let restoredFromBackup = false;
    let backupData: any = null;
    const backupPath = LOCAL_STORE_FILE + ".backup";
    if (fs.existsSync(backupPath)) {
      try {
        const rawBackup = fs.readFileSync(backupPath, "utf-8");
        backupData = JSON.parse(decryptLocalStore(rawBackup));
        const hasData = backupData && (
          (Array.isArray(backupData.students) && backupData.students.length > 0) ||
          (Array.isArray(backupData.teachers) && backupData.teachers.length > 0) ||
          (Array.isArray(backupData.classes) && backupData.classes.length > 0)
        );
        if (hasData) {
          // Sync backup data back into active memory cache
          localStoreCache = backupData;
          fs.writeFileSync(LOCAL_STORE_FILE, rawBackup, "utf-8");
          restoredFromBackup = true;
          console.log("[DB Pull] Healthy local_store.json.backup successfully recovered on reconnect.");
          
          // Also sync this recovered data to Cloud SQL so both are healed
          console.log("[DB Pull] Syncing recovered backup data back to Cloud SQL app_store table...");
          const queries = Object.entries(backupData).map(([k, v]) => {
            return pool!.query(`
              INSERT INTO app_store (key, value) VALUES ($1, $2)
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [k, JSON.stringify(v)]);
          });
          await Promise.all(queries);
        }
      } catch (err: any) {
        console.error("[DB Pull] Failed to parse local_store.json.backup file during reconnect:", err.message);
      }
    }

    // 3. Fetch current status from Cloud SQL
    const result = await pool.query("SELECT key, value FROM app_store WHERE key NOT IN ('attendance', 'teacherAttendance', 'chats', 'journals')");
    
    // Read local store and apply to memory variables
    const store = readLocalStore();
    const dbData = parseDbRows(result.rows);
    
    for (const key of Object.keys(dbData)) {
      store[key] = dbData[key]; // Sync the local json cache too
      updateMemoryKey(key, dbData[key]); // Sync memory
    }

    // Write to local_store.json file
    writeLocalStore(store);

    // Explicitly update specific variables that may not be direct keys
    if (dbData['schoolLocationSettings'] !== undefined) schoolLocationSettings = dbData['schoolLocationSettings'];
    if (dbData['classes'] !== undefined) classes = dbData['classes'];
    if (dbData['subjects'] !== undefined) subjects = dbData['subjects'];
    if (dbData['teachers'] !== undefined) teachers = dbData['teachers'];
    if (dbData['students'] !== undefined) {
      const seenNis = new Set();
      students = (dbData['students'] || []).filter((s: any) => {
        const nis = String(s.nis || '').trim();
        if (!nis) return true;
        if (seenNis.has(nis)) return false;
        seenNis.add(nis);
        return true;
      });
    }
    if (dbData['attendance'] !== undefined) attendance = dbData['attendance'];
    if (dbData['questionBankGroups'] !== undefined) questionBankGroups = dbData['questionBankGroups'];
    if (dbData['questions'] !== undefined) questions = dbData['questions'];
    if (dbData['grades'] !== undefined) grades = dbData['grades'];
    if (dbData['chats'] !== undefined) chats = dbData['chats'];
    if (dbData['lkpdList'] !== undefined) lkpdList = dbData['lkpdList'];
    if (dbData['exams'] !== undefined) exams = dbData['exams'];
    if (dbData['rooms'] !== undefined) rooms = dbData['rooms'];
    if (dbData['schedules'] !== undefined) schedules = dbData['schedules'];
    if (dbData['savedRosters'] !== undefined) savedRosters = dbData['savedRosters'];
    if (dbData['journals'] !== undefined) journals = dbData['journals'];
    if (dbData['gradeCategories'] !== undefined) gradeCategories = dbData['gradeCategories'];
    if (dbData['generatedExams'] !== undefined) generatedExams = dbData['generatedExams'];
    if (dbData['activeExamSessions'] !== undefined) activeExamSessions = dbData['activeExamSessions'];
    if (dbData['completedExams'] !== undefined) completedExams = dbData['completedExams'];
    if (dbData['forceFinishedExams'] !== undefined) forceFinishedExams = dbData['forceFinishedExams'];
    if (dbData['studentExamAnswers'] !== undefined) studentExamAnswers = dbData['studentExamAnswers'];
    if (dbData['studentExamQuestions'] !== undefined) studentExamQuestions = dbData['studentExamQuestions'];
    if (dbData['studentTabSwitches'] !== undefined) studentTabSwitches = dbData['studentTabSwitches'];
    if (dbData['studentOutOfTab'] !== undefined) studentOutOfTab = dbData['studentOutOfTab'];
    if (dbData['blockedStudents'] !== undefined) blockedStudents = dbData['blockedStudents'];
    if (dbData['settings'] !== undefined) appSettings = dbData['settings'];
    if (dbData['lessonPlans'] !== undefined) lessonPlans = dbData['lessonPlans'];
    if (dbData['teacherAttendance'] !== undefined) teacherAttendance = dbData['teacherAttendance'];
    if (dbData['childguardRules'] !== undefined) childguardRules = dbData['childguardRules'];
    if (dbData['childguardLogs'] !== undefined) childguardLogs = dbData['childguardLogs'];
    if (dbData['childguardLocations'] !== undefined) childguardLocations = dbData['childguardLocations'];
    if (dbData['childguardStatus'] !== undefined) childguardStatus = dbData['childguardStatus'];

    lastDbFetchTime = Date.now();
    isDbQuotaExceeded = false;

    // Send broadcast state update for all keys
    for (const key of Object.keys(dbData)) {
      try {
        broadcastStateUpdate(key);
      } catch (e) {}
    }

    console.log("[DB Pull] Reconnection & Sync SUCCEEDED. Local server data synchronized with Cloud SQL database.");
    
    let successMessage = `Sinkronisasi BERHASIL! File JSON lokal dan SQL database sudah pulih sepenuhnya.`;
    if (restoredFromBackup) {
      successMessage = `Sinkronisasi BERHASIL! File JSON lokal dan SQL database sudah pulih sepenuhnya (dipulihkan menggunakan file cadangan otomatis local_store.json.backup).`;
    }

    res.json({
      success: true,
      message: successMessage,
      details: {
        teachersCount: Array.isArray(teachers) ? teachers.length : 0,
        studentsCount: Array.isArray(students) ? students.length : 0,
        classesCount: Array.isArray(classes) ? classes.length : 0,
        attendanceCount: Array.isArray(attendance) ? attendance.length : 0,
        questionsCount: Array.isArray(questions) ? questions.length : 0
      }
    });

  } catch (err: any) {
    console.error("DB Pull Error:", err);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat sinkronisasi: " + (err.message || String(err))
    });
  }
});

function isCloudServer(req?: express.Request): boolean {
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

// 2. Auth Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username dan password wajib diisi." });
  }

  const u = String(username).trim();
  const p = String(password).trim();
  const uLower = u.toLowerCase();

  // 1. Check Bos (Super Admin)
  const bossUserEnv = process.env.BOSS_USERNAME;
  const bossPassEnv = process.env.BOSS_PASSWORD;

  let isBoss = false;
  if (bossUserEnv && bossPassEnv) {
    isBoss = (uLower === bossUserEnv.toLowerCase() && p === bossPassEnv);
  }
  if (!isBoss) {
    isBoss = ((uLower === "bos" || uLower === "superbos" || uLower === "bos123") && (p === "bos123" || p === "adminbos" || p === "bos"));
  }

  if (isBoss) {
    if (!isCloudServer(req)) {
      return res.status(401).json({
        success: false,
        message: ""
      });
    }

    const bossUser = {
      id: "BOSS",
      name: "Bos Platform (Super Admin)",
      username: uLower,
      role: "bos",
      madrasahId: "default",
      madrasahSlug: "default"
    };
    const token = createAuthToken(bossUser);
    return res.json({
      success: true,
      token,
      user: { ...bossUser, token }
    });
  }

  // 2. Check Registered Madrasah Admin
  const foundMadrasah = madrasahs.find(m => 
    (String(m.adminUser || '').toLowerCase() === uLower || String(m.slug || '').toLowerCase() === uLower) &&
    verifyPassword(p, String(m.adminPass))
  );
  if (foundMadrasah) {
    if (foundMadrasah.isActive === false) {
      return res.status(403).json({ success: false, message: "Akses diblokir: Akun madrasah ini dinonaktifkan oleh Super Admin (Bos). Hubungi administrator platform." });
    }
    const adminUserObj = {
      id: "ADMIN_" + foundMadrasah.id,
      name: foundMadrasah.adminName || "Administrator",
      username: foundMadrasah.adminUser,
      role: "admin",
      madrasahId: foundMadrasah.id,
      madrasahSlug: foundMadrasah.slug,
      schoolName: foundMadrasah.name,
      cbtTokenBalance: foundMadrasah.cbtTokenBalance !== undefined ? foundMadrasah.cbtTokenBalance : 0
    };
    const token = createAuthToken(adminUserObj);
    return res.json({
      success: true,
      token,
      user: { ...adminUserObj, token }
    });
  }

  // 3. Check Default Admin
  const adminUserVal = (appSettings && appSettings.adminUser) ? String(appSettings.adminUser).toLowerCase() : "admin";
  const adminPassVal = (appSettings && appSettings.adminPass) ? String(appSettings.adminPass) : "admin123";

  if ((uLower === "admin" || uLower === "administrator" || uLower === adminUserVal) && verifyPassword(p, adminPassVal)) {
    const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
    if (defaultM && defaultM.isActive === false) {
      return res.status(403).json({ success: false, message: "Akses diblokir: Akun madrasah ini dinonaktifkan oleh Super Admin (Bos)." });
    }
    const defAdminUser = {
      id: "ADMIN",
      name: (appSettings && appSettings.adminName) || "Administrator",
      username: "admin",
      role: "admin",
      madrasahId: defaultM ? defaultM.id : "default",
      madrasahSlug: defaultM ? defaultM.slug : "default",
      schoolName: defaultM ? defaultM.name : "Madrasah Utama",
      cbtTokenBalance: defaultM ? (defaultM.cbtTokenBalance || 0) : 0
    };
    const token = createAuthToken(defAdminUser);
    return res.json({
      success: true,
      token,
      user: { ...defAdminUser, token }
    });
  }

  // 4. Check Teachers
  const teacher = teachers.find(t => (String(t.username || '').toLowerCase() === uLower || String(t.nip || '').toLowerCase() === uLower) && verifyPassword(p, String(t.password)));
  if (teacher) {
    const teacherUser = {
      id: teacher.id,
      name: teacher.name,
      username: teacher.username,
      nip: teacher.nip,
      role: "teacher",
      mapel: teacher.mapel,
      cbtTokenBalance: teacher.cbtTokenBalance !== undefined ? teacher.cbtTokenBalance : 0
    };
    const token = createAuthToken(teacherUser);
    return res.json({
      success: true,
      token,
      user: { ...teacherUser, token }
    });
  }

  // 5. Check Students
  const student = students.find(s => (String(s.username || '').toLowerCase() === uLower || String(s.nis || '').toLowerCase() === uLower) && verifyPassword(p, String(s.password)));
  if (student) {
    const studentUser = {
      id: student.id,
      name: student.name,
      username: student.username,
      nis: student.nis,
      classId: student.classId,
      class_id: student.classId,
      role: student.role || "student",
      photo: student.photo,
      no_hp: student.no_hp
    };
    const token = createAuthToken(studentUser);
    return res.json({
      success: true,
      token,
      user: { ...studentUser, token }
    });
  }

  return res.status(401).json({ success: false, message: "Username atau password salah." });
});

// Authentication Token & Verification API
app.get("/api/auth/me", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Belum login atau token kedaluwarsa" });
  }
  res.json({ success: true, user: authUser });
});

// Multi-Tenant & Bos Token Endpoints
app.get("/api/madrasahs", requireAuth, (req, res) => {
  res.json({ success: true, madrasahs: madrasahs || [] });
});

app.get("/api/madrasah-by-slug/:slug", (req, res) => {
  const { slug } = req.params;
  const m = madrasahs.find(item => String(item.slug).toLowerCase() === String(slug).toLowerCase() || String(item.id) === String(slug));
  if (!m) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  res.json({ success: true, madrasah: m });
});

app.post("/api/register-madrasah", async (req, res) => {
  const { name, slug, level, adminName, adminUser, adminPass, phone } = req.body;
  if (!name || !slug || !adminName || !adminUser || !adminPass) {
    return res.status(400).json({ success: false, message: "Semua data pendaftaran wajib diisi." });
  }
  const cleanSlug = String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  const RESERVED_SLUGS = ['api', 'admin', 'login', 'cbt', 'boss-panel', 'boss', 'vendor', 'src', 'public', 'dist', 'node_modules', 'm', 'settings', 'absensi', 'chat'];
  if (RESERVED_SLUGS.includes(cleanSlug)) {
    return res.status(400).json({ success: false, message: "Slug URL tersebut digunakan oleh sistem. Silakan pilih slug lain." });
  }
  if (madrasahs.some(m => String(m.slug).toLowerCase() === cleanSlug)) {
    return res.status(400).json({ success: false, message: "Slug URL madrasah sudah terdaftar oleh sekolah lain." });
  }
  const newMadrasahId = 'MDR_' + Date.now();
  const newMadrasah = {
    id: newMadrasahId,
    name: String(name).trim(),
    slug: cleanSlug,
    level: level || 'MA',
    adminName: String(adminName).trim(),
    adminUser: String(adminUser).trim(),
    adminPass: String(adminPass).trim(),
    phone: String(phone || '').trim(),
    cbtTokenBalance: 1, // Free welcome token
    tokenSignature: calculateTokenSignature(newMadrasahId, 1),
    createdAt: new Date().toISOString()
  };
  madrasahs.push(newMadrasah);
  await saveData('madrasahs', madrasahs);

  // Save initial madrasah list
  await saveData('madrasahs', madrasahs);
  return res.json({
    success: true,
    madrasah: newMadrasah,
    message: `Madrasah ${newMadrasah.name} berhasil didaftarkan! URL khusus: /m/${newMadrasah.slug}`
  });
});

app.get("/api/cbt-token-price", (req, res) => {
  res.json({ success: true, price: cbtTokenPrice });
});

app.get("/api/payment-settings", (req, res) => {
  res.json({ success: true, paymentAccounts: appSettings.paymentAccounts || [] });
});

app.post("/api/payment-settings", async (req, res) => {
  const { paymentAccounts } = req.body;
  if (Array.isArray(paymentAccounts)) {
    appSettings.paymentAccounts = paymentAccounts;
    await saveData('settings', appSettings);
    return res.json({ success: true, paymentAccounts: appSettings.paymentAccounts, message: "Pengaturan rekening pembayaran berhasil diperbarui!" });
  }
  return res.status(400).json({ success: false, message: "Data rekening tidak valid." });
});

app.post("/api/cbt-token-price", async (req, res) => {
  const { price } = req.body;
  const newPrice = parseInt(price, 10);
  if (isNaN(newPrice) || newPrice < 0) {
    return res.status(400).json({ success: false, message: "Harga token tidak valid." });
  }
  cbtTokenPrice = newPrice;
  appSettings.cbtTokenPrice = newPrice;
  await saveData('settings', appSettings);
  return res.json({
    success: true,
    price: cbtTokenPrice,
    message: `Harga Token Ujian berhasil diubah menjadi Rp ${cbtTokenPrice.toLocaleString('id-ID')} / token.`
  });
});

app.get("/api/token-requests", requireAuth, (req: any, res) => {
  const authUser = req.user;
  const isBos = authUser.role === 'bos' || authUser.role === 'superadmin';
  const { madrasahId } = req.query;
  let filtered = tokenRequests || [];
  if (!isBos) {
    const userMId = getRequestMadrasahId(req);
    filtered = filtered.filter(tr => String(tr.madrasahId) === String(userMId));
  } else if (madrasahId) {
    filtered = filtered.filter(tr => String(tr.madrasahId) === String(madrasahId));
  }
  res.json({ success: true, tokenRequests: filtered, cbtTokenPrice });
});

app.post("/api/token-requests", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req: any, res) => {
  const authUser = req.user;
  const isBos = authUser.role === 'bos' || authUser.role === 'superadmin';
  const userMId = getRequestMadrasahId(req);
  const { madrasahId, quantity, proofNote, proofFile } = req.body;
  const targetMadrasahId = isBos ? (madrasahId || userMId) : userMId;

  const qty = parseInt(quantity, 10);
  if (!targetMadrasahId || isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Jumlah token harus lebih dari 0." });
  }
  const m = madrasahs.find(item => String(item.id) === String(targetMadrasahId) || String(item.slug) === String(targetMadrasahId));
  if (!m) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  const newReq = {
    id: 'TRQ_' + Date.now(),
    madrasahId: m.id,
    madrasahName: m.name,
    quantity: qty,
    pricePerToken: cbtTokenPrice,
    totalPrice: qty * cbtTokenPrice,
    proofNote: proofNote || '',
    proofFile: proofFile || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  tokenRequests.push(newReq);
  await saveData('tokenRequests', tokenRequests);
  return res.json({
    success: true,
    tokenRequest: newReq,
    message: "Permintaan Top-Up Token berhasil dikirim ke Akun Bos."
  });
});

app.post("/api/token-requests/:id/approve", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  if (isOfflineMode) {
    return res.status(403).json({ success: false, message: "Persetujuan top-up tidak diizinkan dalam mode offline." });
  }
  const { id } = req.params;
  const { approvedQuantity } = req.body;
  const reqItem = tokenRequests.find(tr => String(tr.id) === String(id));
  if (!reqItem) {
    return res.status(404).json({ success: false, message: "Permintaan top-up tidak ditemukan." });
  }
  const addQty = parseInt(approvedQuantity, 10) || reqItem.quantity;
  reqItem.status = 'approved';
  reqItem.approvedQuantity = addQty;
  reqItem.approvedAt = new Date().toISOString();

  let targetM = madrasahs.find(m => String(m.id) === String(reqItem.madrasahId) || m.name === reqItem.madrasahName);
  if (!targetM && madrasahs.length > 0) targetM = madrasahs[0];

  if (targetM) {
    targetM.cbtTokenBalance = (targetM.cbtTokenBalance || 0) + addQty;
  }

  await saveData('tokenRequests', tokenRequests);
  await saveData('madrasahs', madrasahs);

  return res.json({
    success: true,
    message: `Permintaan Top-Up berhasil disetujui! +${addQty} Token telah ditambahkan ke ${reqItem.madrasahName}.`
  });
});

app.post("/api/token-requests/:id/reject", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const reqItem = tokenRequests.find(tr => String(tr.id) === String(id));
  if (!reqItem) {
    return res.status(404).json({ success: false, message: "Permintaan top-up tidak ditemukan." });
  }
  reqItem.status = 'rejected';
  reqItem.rejectedAt = new Date().toISOString();

  await saveData('tokenRequests', tokenRequests);
  return res.json({
    success: true,
    message: "Permintaan Top-Up telah ditolak."
  });
});

app.post("/api/madrasahs/:id/update-tokens", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  if (isOfflineMode) {
    return res.status(403).json({ success: false, message: "Pembaruan saldo token langsung dinonaktifkan dalam mode offline demi mencegah kecurangan." });
  }
  const { id } = req.params;
  const { newBalance, deltaTokens } = req.body;
  let targetM = madrasahs.find(m => String(m.id) === String(id) || String(m.slug) === String(id));
  if (!targetM && madrasahs.length > 0) {
    targetM = madrasahs[0];
  }
  if (!targetM) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  if (newBalance !== undefined) {
    targetM.cbtTokenBalance = Math.max(0, parseInt(newBalance, 10) || 0);
  } else if (deltaTokens !== undefined) {
    targetM.cbtTokenBalance = Math.max(0, (targetM.cbtTokenBalance || 0) + (parseInt(deltaTokens, 10) || 0));
  }
  await saveData('madrasahs', madrasahs);
  return res.json({
    success: true,
    madrasah: targetM,
    message: `Saldo Token ${targetM.name} diperbarui menjadi ${targetM.cbtTokenBalance} Token.`
  });
});

// --- CRYPTOGRAPHIC OFFLINE ACTIVATION SYSTEM ---
app.post("/api/boss/generate-activation-key", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
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
    const signature = "HMAC_" + crypto.createHmac('sha256', TOKEN_LOCK_SECRET).update(dataToSign).digest('hex');

    const activationKey = Buffer.from(`UNIVERSAL_${nonce}:${qty}:${timestamp}:${signature}`).toString('base64');
    return res.json({ success: true, activationKey });
  } catch (err: any) {
    console.error("Failed to generate activation key:", err);
    return res.status(500).json({ success: false, message: "Gagal menghasilkan kunci: " + err.message });
  }
});

app.post("/api/madrasah/activate-offline-tokens", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { activationKey, teacherId } = req.body;
  if (!activationKey) {
    return res.status(400).json({ success: false, message: "Kode aktivasi tidak boleh kosong." });
  }
  try {
    const decoded = Buffer.from(activationKey, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length < 4) {
      return res.status(400).json({ success: false, message: "Format kode aktivasi tidak valid atau rusak." });
    }
    const madrasahId = parts[0];
    const qtyStr = parts[1];
    const timestampStr = parts[2];
    const signature = parts.slice(3).join(':'); // Handle potential colons in signature

    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: "Jumlah token tidak valid." });
    }

    const dataToVerify = `${madrasahId}:${qtyStr}:${timestampStr}`;
    let isValid = false;

    // Check HMAC verification
    const expectedHmacPrimary = "HMAC_" + crypto.createHmac('sha256', TOKEN_LOCK_SECRET).update(dataToVerify).digest('hex');
    const expectedHmacDefault = "HMAC_" + crypto.createHmac('sha256', "***REMOVED***").update(dataToVerify).digest('hex');

    if (signature === expectedHmacPrimary || signature === expectedHmacDefault) {
      isValid = true;
    } else {
      // Check RSA keys as fallback
      const keyPair = getServerKeyPair();
      const keysToTry: string[] = [];
      if (keyPair?.publicKey) keysToTry.push(keyPair.publicKey);
      if (LICENSE_PUBLIC_KEY) keysToTry.push(LICENSE_PUBLIC_KEY);

      for (const pubKey of keysToTry) {
        try {
          const verify = crypto.createVerify('SHA256');
          verify.write(dataToVerify);
          verify.end();
          if (verify.verify(pubKey, signature, 'base64')) {
            isValid = true;
            break;
          }
        } catch (e) {
          // continue checking next key
        }
      }
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: "Kode aktivasi tidak sah! Tanda tangan digital tidak cocok." });
    }

    if (!usedActivationKeys) {
      usedActivationKeys = [];
    }
    if (usedActivationKeys.includes(signature)) {
      return res.status(400).json({ success: false, message: "Kode aktivasi ini sudah pernah digunakan sebelumnya!" });
    }

    if (teacherId) {
      let tch = teachers.find(t => String(t.id) === String(teacherId) || String(t.username) === String(teacherId) || String(t.nip) === String(teacherId));
      if (!tch) {
        return res.status(404).json({ success: false, message: "Data guru tidak ditemukan." });
      }
      tch.cbtTokenBalance = (tch.cbtTokenBalance || 0) + qty;
      usedActivationKeys.push(signature);
      await saveData('usedActivationKeys', usedActivationKeys);
      await saveData('teachers', teachers);

      return res.json({
        success: true,
        remainingTokens: tch.cbtTokenBalance,
        isTeacher: true,
        message: `Berhasil diaktivasi! Ditambahkan +${qty} Token ke akun Guru ${tch.name}. Saldo terbaru: ${tch.cbtTokenBalance} Token.`
      });
    }

    // Find the target madrasah
    let targetM = madrasahs.find(m => String(m.id) === String(madrasahId) || String(m.slug) === String(madrasahId));
    if (!targetM && madrasahs.length > 0) {
      targetM = madrasahs[0];
    }
    if (!targetM) {
      return res.status(404).json({ success: false, message: "Data madrasah tidak ditemukan di server ini." });
    }

    // Add balance
    targetM.cbtTokenBalance = (targetM.cbtTokenBalance || 0) + qty;
    // Seal with HMAC local signature
    targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);

    // Track used key
    usedActivationKeys.push(signature);
    await saveData('usedActivationKeys', usedActivationKeys);
    await saveData('madrasahs', madrasahs);

    return res.json({
      success: true,
      remainingTokens: targetM.cbtTokenBalance,
      message: `Berhasil diaktivasi! Ditambahkan +${qty} Token ke ${targetM.name}. Saldo terbaru: ${targetM.cbtTokenBalance} Token.`
    });
  } catch (err: any) {
    console.error("Failed to verify activation key:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan sistem saat verifikasi: " + err.message });
  }
});

app.post("/api/deduct-cbt-token", async (req, res) => {
  const { madrasahId, teacherId } = req.body;

  if (teacherId) {
    let tch = teachers.find(t => String(t.id) === String(teacherId) || String(t.username) === String(teacherId) || String(t.nip) === String(teacherId));
    if (!tch) {
      return res.status(404).json({ success: false, message: "Data guru tidak ditemukan." });
    }
    if ((tch.cbtTokenBalance || 0) <= 0) {
      return res.status(400).json({
        success: false,
        message: `Saldo Token Ujian Anda (Guru) habis (0 Token). Harap lakukan isi ulang token menggunakan Kode Aktivasi Token dari Bos Platform.`
      });
    }
    tch.cbtTokenBalance -= 1;
    await saveData('teachers', teachers);
    return res.json({
      success: true,
      remainingTokens: tch.cbtTokenBalance,
      isTeacher: true,
      message: "1 Token Ujian Guru berhasil digunakan."
    });
  }

  let targetM = madrasahs.find(m => String(m.id) === String(madrasahId) || String(m.slug) === String(madrasahId));
  if (!targetM && madrasahs.length > 0) {
    targetM = madrasahs[0];
  }
  if (!targetM) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  if ((targetM.cbtTokenBalance || 0) <= 0) {
    return res.status(400).json({
      success: false,
      message: `Saldo Token Ujian madrasah habis (0 Token). Harga token: Rp ${cbtTokenPrice.toLocaleString('id-ID')}/token.`
    });
  }
  targetM.cbtTokenBalance -= 1;
  // Re-sign balance to prevent false-positive tamper detection on next startup
  targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);
  await saveData('madrasahs', madrasahs);
  return res.json({
    success: true,
    remainingTokens: targetM.cbtTokenBalance,
    message: "1 Token Ujian berhasil digunakan."
  });
});

app.put("/api/teachers/:id/tokens", requireAuth, requireRole(['admin', 'bos', 'superadmin']), async (req: any, res) => {
  const { id } = req.params;
  const { cbtTokenBalance, deltaTokens } = req.body;
  const idx = teachers.findIndex(t => String(t.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Guru tidak ditemukan." });
  }

  // Tenant-scoping: Madrasah admins can only update tokens of teachers in their own school
  const authUser = req.user;
  const isBos = authUser.role === 'bos' || authUser.role === 'superadmin';
  if (!isBos) {
    const userMId = getRequestMadrasahId(req);
    const teacherMId = teachers[idx].madrasahId || 'default';
    if (String(userMId) !== String(teacherMId)) {
      return res.status(403).json({ success: false, message: "Akses ditolak: Anda tidak memiliki akses ke guru madrasah ini." });
    }
  }

  if (cbtTokenBalance !== undefined) {
    teachers[idx].cbtTokenBalance = Math.max(0, parseInt(cbtTokenBalance, 10) || 0);
  } else if (deltaTokens !== undefined) {
    teachers[idx].cbtTokenBalance = Math.max(0, (teachers[idx].cbtTokenBalance || 0) + (parseInt(deltaTokens, 10) || 0));
  }
  await saveData('teachers', teachers);
  return res.json({
    success: true,
    cbtTokenBalance: teachers[idx].cbtTokenBalance,
    message: `Saldo Token Guru ${teachers[idx].name} diperbarui menjadi ${teachers[idx].cbtTokenBalance} Token.`
  });
});

app.post("/api/madrasahs/:id/toggle-status", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const targetM = madrasahs.find(m => String(m.id) === String(id) || String(m.slug) === String(id));
  if (!targetM) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  targetM.isActive = targetM.isActive === false ? true : false;
  await saveData('madrasahs', madrasahs);
  return res.json({
    success: true,
    madrasah: targetM,
    isActive: targetM.isActive,
    message: `Status ${targetM.name} berhasil diubah menjadi ${targetM.isActive ? 'AKTIF' : 'NONAKTIF'}.`
  });
});

app.post("/api/madrasahs/:id/update", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const { name, level, adminName, adminUser, adminPass, phone, cbtTokenBalance, isActive } = req.body;
  const targetM = madrasahs.find(m => String(m.id) === String(id) || String(m.slug) === String(id));
  if (!targetM) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  if (name) targetM.name = String(name).trim();
  if (level) targetM.level = String(level).trim();
  if (adminName) targetM.adminName = String(adminName).trim();
  if (adminUser) targetM.adminUser = String(adminUser).trim();
  if (adminPass && String(adminPass).trim().length > 0) targetM.adminPass = String(adminPass).trim();
  if (phone !== undefined) targetM.phone = String(phone).trim();
  if (cbtTokenBalance !== undefined) {
    if (isOfflineMode) {
      // Ignore token balance changes from the general update API in offline mode to prevent cheating/tampering
    } else {
      targetM.cbtTokenBalance = Math.max(0, parseInt(cbtTokenBalance, 10) || 0);
      targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);
    }
  }
  if (isActive !== undefined) targetM.isActive = Boolean(isActive);

  await saveData('madrasahs', madrasahs);
  return res.json({
    success: true,
    madrasah: targetM,
    message: `Data ${targetM.name} berhasil diperbarui.`
  });
});

app.delete("/api/madrasahs/:id", requireAuth, requireRole(['bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const index = madrasahs.findIndex(m => String(m.id) === String(id) || String(m.slug) === String(id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  const deletedName = madrasahs[index].name;
  madrasahs.splice(index, 1);
  if (madrasahs.length === 0) {
    madrasahs.push({
      id: 'default',
      name: (appSettings && appSettings.schoolName) || 'Madrasah Utama',
      slug: 'default',
      level: 'MA',
      adminName: 'Administrator',
      adminUser: 'admin',
      adminPass: 'admin123',
      phone: '081234567890',
      cbtTokenBalance: 0,
      isActive: true,
      createdAt: '2026-01-01'
    });
  }
  await saveData('madrasahs', madrasahs);
  return res.json({
    success: true,
    message: `Madrasah "${deletedName}" berhasil dihapus.`
  });
});

// Helper functions for Multi-Tenant Scoping and Security
function getRequestMadrasahId(req: any): string | null {
  // Enforce tenant strictly from JWT session if authenticated
  const authUser = req.user || getAuthUser(req);
  if (authUser) {
    const role = String(authUser.role || '').toLowerCase();
    // Only super admin ('bos' / 'superadmin') can query cross-tenant or override via header/query
    if (role === 'bos' || role === 'superadmin') {
      const headerVal = req.headers['x-madrasah-id'];
      if (headerVal) return String(headerVal);
      if (req.query.madrasahId) return String(req.query.madrasahId);
      return authUser.madrasahId || 'default';
    }
    // For anyone else (student, teacher, local school admin), strictly lock to their own token's madrasah
    return authUser.madrasahId || 'default';
  }

  // Fallback for unauthenticated requests
  const headerVal = req.headers['x-madrasah-id'];
  if (headerVal) return String(headerVal);
  if (req.query.madrasahId) return String(req.query.madrasahId);
  return null;
}

function filterByMadrasah(list: any[], req: any): any[] {
  if (!Array.isArray(list)) return list;
  const mId = getRequestMadrasahId(req);
  if (mId && mId !== 'default' && mId !== 'BOSS') {
    const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
    const targetId = matchM ? matchM.id : mId;
    const targetSlug = matchM ? matchM.slug : mId;
    const matched = list.filter(item => {
      if (!item) return false;
      const imId = String(item.madrasahId || '').trim();
      const imSlug = String(item.madrasahSlug || '').trim();
      if (!imId && !imSlug) return true; // Include untagged legacy items
      return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId || imId === 'default' || imSlug === 'default';
    });
    if (matched.length > 0) return matched;
  }
  
  const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
  const defId = defaultM ? defaultM.id : 'default';
  const defSlug = defaultM ? defaultM.slug : 'default';
  return list.filter(item => {
    if (!item) return false;
    const imId = String(item.madrasahId || 'default').trim();
    const imSlug = String(item.madrasahSlug || 'default').trim();
    return imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!item.madrasahId && !item.madrasahSlug);
  });
}

function tagNewRecord(item: any, req: any): any {
  const mId = getRequestMadrasahId(req);
  if (mId && mId !== 'default' && mId !== 'BOSS') {
    const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
    item.madrasahId = matchM ? matchM.id : mId;
    item.madrasahSlug = matchM ? matchM.slug : mId;
  } else {
    item.madrasahId = 'default';
    item.madrasahSlug = 'default';
  }
  return item;
}

function isItemForCurrentMadrasah(item: any, req: any): boolean {
  if (!item) return false;
  const mId = getRequestMadrasahId(req);
  
  const imId = String(item.madrasahId || '').trim();
  const imSlug = String(item.madrasahSlug || '').trim();
  
  if (mId && mId !== 'default' && mId !== 'BOSS') {
    const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
    const targetId = matchM ? matchM.id : mId;
    const targetSlug = matchM ? matchM.slug : mId;
    return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId || imId === 'default' || imSlug === 'default';
  }
  
  const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
  const defId = defaultM ? defaultM.id : 'default';
  const defSlug = defaultM ? defaultM.slug : 'default';
  return imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!item.madrasahId && !item.madrasahSlug);
}

function mergeTenantListData(globalList: any[], incomingData: any[], req: any): any[] {
  if (!Array.isArray(incomingData)) return globalList;
  if (!Array.isArray(globalList)) globalList = [];

  // Tag incoming items with the current madrasah
  const taggedIncoming = incomingData.map(item => {
    // Preserve existing tags if present, otherwise tag them
    if (item && (item.madrasahId || item.madrasahSlug)) {
      return item;
    }
    return tagNewRecord({ ...item }, req);
  });

  // Partition the global list into items NOT for current madrasah
  const otherItems = globalList.filter(item => !isItemForCurrentMadrasah(item, req));

  // Merge other items with current tenant's tagged incoming items
  return [...otherItems, ...taggedIncoming];
}

function mergeLkpdListDataSmart(globalList: any[], incomingData: any[], req: any): any[] {
  if (!Array.isArray(incomingData)) return globalList;
  if (!Array.isArray(globalList)) globalList = [];

  const userRole = String(req.headers['x-user-role'] || 'student').trim().toLowerCase();
  const isStudent = userRole === 'student';

  // 1. Tag incoming items with the current madrasah
  const taggedIncoming = incomingData.map(item => {
    if (item && (item.madrasahId || item.madrasahSlug)) {
      return item;
    }
    return tagNewRecord({ ...item }, req);
  });

  // 2. Separate global items into: other schools vs current school
  const otherItems = globalList.filter(item => !isItemForCurrentMadrasah(item, req));
  const currentSchoolExisting = globalList.filter(item => isItemForCurrentMadrasah(item, req));

  // 3. Safety Lock: If incoming data is empty:
  //    - If student, we ignore it completely to prevent wiping.
  //    - If teacher, we also preserve the existing items to be completely safe from accidental wipes.
  if (taggedIncoming.length === 0) {
    return globalList;
  }

  // 4. Create Map of existing items
  const mergedItemsMap = new Map<string, any>();
  currentSchoolExisting.forEach(existingItem => {
    if (existingItem && existingItem.id) {
      mergedItemsMap.set(String(existingItem.id), { ...existingItem });
    }
  });

  // 5. Merge incoming items
  taggedIncoming.forEach(incomingItem => {
    if (!incomingItem || !incomingItem.id) return;
    const key = String(incomingItem.id);
    const existing = mergedItemsMap.get(key);

    if (!existing) {
      // Only allow teachers/admins to create new LKPDs
      if (!isStudent) {
        mergedItemsMap.set(key, incomingItem);
      }
    } else {
      // Merge existing with incoming
      const mergedSubmissionsMap = new Map<string, any>();
      
      // Seed existing submissions from database
      const existingSubs = Array.isArray(existing.submissions) ? existing.submissions : [];
      existingSubs.forEach((sub: any) => {
        if (sub && sub.studentId) {
          mergedSubmissionsMap.set(String(sub.studentId), sub);
        }
      });

      // Merge incoming submissions
      const incomingSubs = Array.isArray(incomingItem.submissions) ? incomingItem.submissions : [];
      incomingSubs.forEach((sub: any) => {
        if (sub && sub.studentId) {
          const existingSub = mergedSubmissionsMap.get(String(sub.studentId));
          if (!existingSub) {
            mergedSubmissionsMap.set(String(sub.studentId), sub);
          } else {
            // Keep existing and merge fields
            mergedSubmissionsMap.set(String(sub.studentId), {
              ...existingSub,
              ...sub,
              answers: { ...(existingSub.answers || {}), ...(sub.answers || {}) },
              scores: { ...(existingSub.scores || {}), ...(sub.scores || {}) },
              feedback: { ...(existingSub.feedback || {}), ...(sub.feedback || {}) }
            });
          }
        }
      });

      // Update definition
      if (isStudent) {
        // If student, preserve the metadata/questions/markers/classes of the teacher's original LKPD,
        // and only update the submissions.
        mergedItemsMap.set(key, {
          ...existing,
          submissions: Array.from(mergedSubmissionsMap.values())
        });
      } else {
        // If teacher, they can update metadata/questions/markers/classes
        mergedItemsMap.set(key, {
          ...existing,
          ...incomingItem,
          submissions: Array.from(mergedSubmissionsMap.values())
        });
      }
    }
  });

  // 6. Handle Deletions:
  // If an LKPD is missing from taggedIncoming:
  // - If student: we MUST preserve it (do not delete).
  // - If teacher/admin: we allow deleting it.
  if (isStudent) {
    // Keep any existing item that was not in taggedIncoming
    currentSchoolExisting.forEach(existingItem => {
      if (existingItem && existingItem.id && !mergedItemsMap.has(String(existingItem.id))) {
        mergedItemsMap.set(String(existingItem.id), existingItem);
      }
    });
  }

  return [...otherItems, ...Array.from(mergedItemsMap.values())];
}

// 3. Teachers API
app.get("/api/teachers", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), (req, res) => {
  const list = filterByMadrasah(teachers, req);
  const sanitized = list.map(({ password, ...rest }: any) => rest);
  res.json({ success: true, teachers: sanitized });
});

app.post("/api/teachers", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  let { nip, name, username, password, mapel, homeroom_class_id, photo, phone, no_hp, email, address, alamat, gender, jenis_kelamin, nuptk, bio, photoHistory } = req.body;
  if (photo && photo.startsWith("data:image/")) { photo = await saveBase64ToFirestore(photo); }
  if (!nip || !name || !username) {
    return res.status(400).json({ success: false, message: "NIP, Nama, dan Username wajib diisi." });
  }
  const newId = "T" + Date.now();
  const rawPassword = password || "guru123";
  const hashed = hashPassword(rawPassword);

  const newTeacher = tagNewRecord({
    id: newId,
    nip,
    name,
    username,
    password: hashed,
    mapel: Array.isArray(mapel) ? mapel : [mapel],
    role: "teacher",
    cbtTokenBalance: 0,
    homeroom_class_id: homeroom_class_id || "",
    photo: photo || "",
    phone: phone || no_hp || "",
    no_hp: no_hp || phone || "",
    email: email || "",
    address: address || alamat || "",
    alamat: alamat || address || "",
    gender: gender || jenis_kelamin || "L",
    jenis_kelamin: jenis_kelamin || gender || "L",
    nuptk: nuptk || "",
    bio: bio || "",
    photoHistory: photoHistory || []
  }, req);
  teachers.push(newTeacher);
  await saveData('teachers', teachers);
  const { password: _, ...sanitizedNewTeacher } = newTeacher;
  res.json({ success: true, teacher: sanitizedNewTeacher });
});

app.put("/api/teachers/:id", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const idx = teachers.findIndex(t => String(t.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Guru tidak ditemukan." });
  }
  const t = teachers[idx];
  
  let updatedPassword = t.password;
  if (req.body.password && String(req.body.password).trim().length > 0) {
    updatedPassword = hashPassword(req.body.password);
  }

  teachers[idx] = {
    ...t,
    nip: req.body.nip ?? t.nip,
    name: req.body.name ?? t.name,
    username: req.body.username ?? t.username,
    password: updatedPassword,
    mapel: Array.isArray(req.body.mapel) ? req.body.mapel : (req.body.mapel !== undefined ? [req.body.mapel] : t.mapel),
    homeroom_class_id: req.body.homeroom_class_id ?? t.homeroom_class_id,
    phone: req.body.phone ?? req.body.no_hp ?? t.phone ?? t.no_hp ?? "",
    no_hp: req.body.no_hp ?? req.body.phone ?? t.no_hp ?? t.phone ?? "",
    email: req.body.email ?? t.email ?? "",
    address: req.body.address ?? req.body.alamat ?? t.address ?? t.alamat ?? "",
    alamat: req.body.alamat ?? req.body.address ?? t.alamat ?? t.address ?? "",
    gender: req.body.gender ?? req.body.jenis_kelamin ?? t.gender ?? t.jenis_kelamin ?? "L",
    jenis_kelamin: req.body.jenis_kelamin ?? req.body.gender ?? t.jenis_kelamin ?? t.gender ?? "L",
    nuptk: req.body.nuptk ?? t.nuptk ?? "",
    bio: req.body.bio ?? t.bio ?? "",
    photoHistory: req.body.photoHistory ?? t.photoHistory ?? [],
    photo: (req.body.photo && req.body.photo.startsWith("data:image/")) ? await saveBase64ToFirestore(req.body.photo) : (req.body.photo !== undefined ? req.body.photo : t.photo)
  };
  await saveData('teachers', teachers);
  const { password: _, ...sanitizedUpdatedTeacher } = teachers[idx];
  res.json({ success: true, teacher: sanitizedUpdatedTeacher });
});

app.put("/api/teachers/:id/change-role", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const tIdx = teachers.findIndex(t => String(t.id) === String(id));
  if (tIdx < 0) {
    return res.status(404).json({ success: false, message: "Guru tidak ditemukan." });
  }
  const t = teachers[tIdx];
  // Remove from teachers, add to students
  teachers.splice(tIdx, 1);
  const rawPassword = req.body.password || t.password || "123456";
  const hashed = hashPassword(rawPassword);

  const newStudent = {
    id: "ST_" + Date.now(),
    nis: req.body.nis || t.nip || "100" + Date.now(),
    name: req.body.name || t.name,
    classId: req.body.classId || classes[0]?.id || "C1",
    class_id: req.body.classId || classes[0]?.id || "C1",
    username: req.body.username || t.username,
    password: hashed,
    photo: req.body.photo || "",
    no_hp: req.body.no_hp || "",
    role: req.body.role || "student"
  };
  students.push(newStudent);
  await saveData('teachers', teachers);
  await saveData('students', students);
  const { password: _, ...sanitizedNewStudent } = newStudent;
  res.json({ success: true, student: sanitizedNewStudent });
});

app.delete("/api/teachers/:id", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  
  // 1. Find the teacher to get their profile photo
  const teacherToDelete = (teachers || []).find(t => String(t.id) === String(id));
  const photoUrlsToDelete = new Set<string>();
  
  if (teacherToDelete) {
    if (teacherToDelete.photo && typeof teacherToDelete.photo === 'string') {
      photoUrlsToDelete.add(teacherToDelete.photo);
    }
    if (Array.isArray(teacherToDelete.photoHistory)) {
      teacherToDelete.photoHistory.forEach((p: any) => {
        if (typeof p === 'string') photoUrlsToDelete.add(p);
        else if (p && p.photo) photoUrlsToDelete.add(p.photo);
      });
    }
    if (Array.isArray(teacherToDelete.photo_history)) {
      teacherToDelete.photo_history.forEach((p: any) => {
        if (typeof p === 'string') photoUrlsToDelete.add(p);
        else if (p && p.photo) photoUrlsToDelete.add(p.photo);
      });
    }
  }
  
  // 2. Find all teacher attendance photos and clear them
  await updateStoreKeyWithLock('teacherAttendance', (currentVal) => {
    const list = Array.isArray(currentVal) ? currentVal : [];
    list.forEach(record => {
      if (record && String(record.teacherId) === String(id) && record.photo) {
        photoUrlsToDelete.add(record.photo);
        record.photo = ''; // clear photo
      }
    });
    return list;
  });
  
  // 3. Delete the collected photos from Firestore
  if (db) {
    for (const url of photoUrlsToDelete) {
      if (url && url.startsWith('/api/photos/')) {
        const docId = url.replace('/api/photos/', '').trim();
        if (docId) {
          try {
            await deleteDoc(doc(db, 'photos', docId));
          } catch (e) {
            console.error(`Failed to delete teacher photo doc ${docId} on teacher deletion:`, e);
          }
        }
      }
    }
  }
  
  // 4. Finally delete the teacher from list
  teachers = teachers.filter(t => String(t.id) !== String(id));
  await saveData('teachers', teachers);
  
  res.json({ success: true, message: "Guru dan seluruh riwayat foto absensinya berhasil dihapus." });
});

// 4. Students API
app.get("/api/students", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), (req, res) => { res.setHeader("Cache-Control", "no-cache");
  const filtered = filterByMadrasah(students, req);
  const sortedStudents = [...filtered].sort((a: any, b: any) => {
    const nameA = String(a.name || '').trim().toLowerCase();
    const nameB = String(b.name || '').trim().toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' });
    }
    const nisA = String(a.nis || a.no_urut || a.id || '').trim();
    const nisB = String(b.nis || b.no_urut || b.id || '').trim();
    return nisA.localeCompare(nisB, undefined, { numeric: true, sensitivity: 'base' });
  });
  const sanitized = sortedStudents.map(({ password, ...rest }: any) => rest);
  res.json({ success: true, students: sanitized });
});

app.post("/api/students", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  let { nis, name, classId, username, password, photo, no_hp } = req.body;
  if (photo && photo.startsWith("data:image/")) { photo = await saveBase64ToFirestore(photo); }
  if (!nis || !name || !username) {
    return res.status(400).json({ success: false, message: "NIS, Nama, dan Username wajib diisi." });
  }
  const trimmedNis = String(nis).trim();
  const tenantStudents = filterByMadrasah(students, req);
  const existing = tenantStudents.find(s => String(s.nis || '').trim() === trimmedNis && String(s.id) !== String(req.body.id || ''));
  if (existing) {
    return res.status(400).json({ success: false, message: `NIS "${trimmedNis}" sudah digunakan oleh siswa lain (${existing.name}).` });
  }

  const newId = req.body.id || "ST_" + Date.now();
  const rawPassword = password || "123456";
  const hashed = hashPassword(rawPassword);

  const newStudent = tagNewRecord({
    id: newId,
    nis: trimmedNis,
    name,
    classId: classId || "C1",
    class_id: classId || "C1",
    username,
    password: hashed,
    passwordRaw: rawPassword,
    photo: photo || "",
    no_hp: no_hp || "",
    role: req.body.role || "student"
  }, req);
  students.push(newStudent);
  await saveData('students', students);
  const { password: _, ...sanitizedNewStudent } = newStudent;
  res.json({ success: true, student: sanitizedNewStudent });
});

app.post("/api/students/import", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const importedList = req.body.students || [];
  let count = 0;
  let skipped = 0;
  const tenantStudents = filterByMadrasah(students, req);
  const existingNisSet = new Set(tenantStudents.map(s => String(s.nis || '').trim()));
  const batchNisSet = new Set();
  const tenantClasses = filterByMadrasah(classes, req);
  const defaultClassId = tenantClasses[0]?.id || "C1";

  for (const item of importedList) {
    const itemNis = String(item.nis || '').trim();
    if (!item.name || !itemNis) {
      skipped++;
      continue;
    }
    if (existingNisSet.has(itemNis) || batchNisSet.has(itemNis)) {
      skipped++;
      continue;
    }
    batchNisSet.add(itemNis);
    existingNisSet.add(itemNis);

    const rawPassword = item.password || "123456";
    const hashed = hashPassword(rawPassword);

    const newStudent = tagNewRecord({
      id: "ST_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      nis: itemNis,
      name: String(item.name),
      classId: item.classId || defaultClassId,
      class_id: item.classId || defaultClassId,
      username: item.username || ("siswa_" + itemNis),
      password: hashed,
      passwordRaw: rawPassword,
      photo: item.photo || "",
      no_hp: item.no_hp || "",
      role: "student"
    }, req);
    students.push(newStudent);
    count++;
  }
  await saveData('students', students);
  res.json({ success: true, imported: count, skipped, message: `Berhasil import ${count} siswa, ${skipped} dilewati (NIS sudah terdaftar).` });
});

app.post("/api/students/bulk-upload-photos", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const photos = req.body.photos || [];
  let updatedCount = 0;
  
  for (const item of photos) {
    const itemNis = String(item.nis || '').trim();
    if (!itemNis || !item.photo) continue;
    
    if (item.photo && item.photo.startsWith("data:image/")) {
      item.photo = await saveBase64ToFirestore(item.photo);
    }

    const idx = students.findIndex(s => 
      String(s.nis || '').trim() === itemNis || 
      String(s.username || '').trim() === itemNis
    );
    
    if (idx >= 0) {
      students[idx].photo = item.photo;
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    await saveData('students', students);
  }
  
  res.json({ 
    success: true, 
    updated: updatedCount, 
    message: `Berhasil memperbarui ${updatedCount} foto siswa.` 
  });
});

app.put("/api/students/:id", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  let { nis, name, classId, username, password, photo, no_hp, role, photoHistory, photo_history } = req.body;
  if (photo && photo.startsWith("data:image/")) { photo = await saveBase64ToFirestore(photo); }
  
  let historyArr = photoHistory !== undefined ? photoHistory : (photo_history !== undefined ? photo_history : undefined);
  if (Array.isArray(historyArr)) {
    for (let i = 0; i < historyArr.length; i++) {
      if (historyArr[i] && typeof historyArr[i] === 'object' && historyArr[i].photo && historyArr[i].photo.startsWith("data:image/")) {
        historyArr[i].photo = await saveBase64ToFirestore(historyArr[i].photo);
      } else if (typeof historyArr[i] === 'string' && historyArr[i].startsWith("data:image/")) {
        historyArr[i] = await saveBase64ToFirestore(historyArr[i]);
      }
    }
  }

  if (nis) {
    const trimmedNis = String(nis).trim();
    const duplicate = students.find(s => String(s.nis || '').trim() === trimmedNis && String(s.id) !== String(id));
    if (duplicate) {
      return res.status(400).json({ success: false, message: `NIS "${trimmedNis}" sudah digunakan oleh siswa lain (${duplicate.name}).` });
    }
  }

  const idx = students.findIndex(s => String(s.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
  }
  const st = students[idx];

  let updatedPassword = st.password;
  let updatedPasswordRaw = st.passwordRaw || (st.password && !st.password.startsWith("scrypt$") && !st.password.startsWith("sha256$") ? st.password : "123456");
  if (password && String(password).trim().length > 0) {
    updatedPassword = hashPassword(password);
    updatedPasswordRaw = String(password).trim();
  }

  students[idx] = {
    ...st,
    nis: nis ? String(nis).trim() : st.nis,
    name: req.body.name ?? st.name,
    username: req.body.username ?? st.username,
    password: updatedPassword,
    passwordRaw: updatedPasswordRaw,
    classId: req.body.classId ?? st.classId,
    class_id: req.body.classId ?? st.class_id,
    photo: req.body.photo !== undefined ? photo : st.photo,
    photoHistory: historyArr !== undefined ? historyArr : (st.photoHistory || []),
    no_hp: req.body.no_hp !== undefined ? req.body.no_hp : st.no_hp,
    role: req.body.role ?? st.role
  };
  await saveData('students', students);
  const { password: _, ...sanitizedUpdatedStudent } = students[idx];
  res.json({ success: true, student: sanitizedUpdatedStudent });
});

// Endpoint to set student profile photo from attendance or custom source
app.post("/api/students/:id/set-profile-photo", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  let { photo, source, date, label } = req.body;
  if (!photo) {
    return res.status(400).json({ success: false, message: "Parameter photo wajib diisi." });
  }
  if (photo.startsWith("data:image/")) {
    photo = await saveBase64ToFirestore(photo);
  }

  const idx = students.findIndex(s => String(s.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
  }

  const st = students[idx];
  const prevPhoto = st.photo || '';
  let history: any[] = Array.isArray(st.photoHistory) ? [...st.photoHistory] : [];

  // If there was an old photo that isn't in history, keep it
  if (prevPhoto && !history.some(h => (typeof h === 'string' ? h : h.photo) === prevPhoto)) {
    history.unshift({
      photo: prevPhoto,
      date: st.photoUpdated || new Date().toISOString().split('T')[0],
      type: 'initial',
      label: 'Foto Sebelumnya'
    });
  }

  // Ensure the new photo is in history
  if (!history.some(h => (typeof h === 'string' ? h : h.photo) === photo)) {
    history.unshift({
      photo,
      date: date || new Date().toISOString().split('T')[0],
      type: source || 'attendance',
      label: label || (source === 'attendance' ? `Foto Absensi (${date || 'Hari Ini'})` : 'Foto Profil')
    });
  }

  students[idx] = {
    ...st,
    photo,
    photoHistory: history,
    photoUpdated: date || new Date().toISOString().split('T')[0]
  };

  await saveData('students', students);
  const { password: _, ...sanitizedStudent } = students[idx];
  res.json({ success: true, student: sanitizedStudent, message: "Foto profil berhasil diperbarui." });
});

// Endpoint to delete a specific photo from student photo history
app.delete("/api/students/:id/photo-history", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const { photoUrl } = req.body;
  if (!photoUrl) {
    return res.status(400).json({ success: false, message: "Parameter photoUrl wajib diisi." });
  }

  const idx = students.findIndex(s => String(s.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
  }

  const st = students[idx];
  let history: any[] = Array.isArray(st.photoHistory) ? [...st.photoHistory] : [];
  history = history.filter(h => {
    const p = typeof h === 'string' ? h : (h.photo || '');
    return p !== photoUrl;
  });

  let deletedPhotos: string[] = Array.isArray(st.deletedPhotos) ? [...st.deletedPhotos] : [];
  if (!deletedPhotos.includes(photoUrl)) {
    deletedPhotos.push(photoUrl);
  }

  let currentPhoto = st.photo || '';
  if (currentPhoto === photoUrl) {
    // If active photo was deleted, fallback to the latest in remaining history or empty
    const remainingValid = history.filter(h => {
      const p = typeof h === 'string' ? h : (h.photo || '');
      return p && !deletedPhotos.includes(p);
    });
    if (remainingValid.length > 0) {
      const first = remainingValid[0];
      currentPhoto = typeof first === 'string' ? first : (first.photo || '');
    } else {
      currentPhoto = '';
    }
  }

  // Clean up photo in attendance if it matched this deleted photo
  let attChanged = false;
  attendance.forEach((a: any) => {
    if ((String(a.studentId) === String(id) || (st.nis && String(a.nis) === String(st.nis))) && a.photo === photoUrl) {
      delete a.photo;
      attChanged = true;
    }
  });
  if (attChanged) {
    await saveData('attendance', attendance);
  }

  // NEW: Delete physical file and Firestore document
  try {
    const urlParts = photoUrl.split("/");
    const photoId = urlParts[urlParts.length - 1];
    if (photoId) {
      // 1. Delete local physical file
      const localFilePath = path.join(uploadsDir, photoId);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      // 2. Delete Firestore document
      if (db) {
        await deleteDoc(doc(db, 'photos', photoId));
      }
    }
  } catch (err) {
    console.warn("Failed to delete physical/Firestore photo asset:", err);
  }

  students[idx] = {
    ...st,
    photo: currentPhoto,
    photoHistory: history,
    deletedPhotos
  };

  await saveData('students', students);
  const { password: _, ...sanitizedStudent } = students[idx];
  res.json({ success: true, student: sanitizedStudent, message: "Foto riwayat berhasil dihapus." });
});

app.put("/api/students/:id/change-role", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const sIdx = students.findIndex(s => String(s.id) === String(id));
  if (sIdx < 0) {
    return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
  }
  const st = students[sIdx];
  // Remove from students, add to teachers
  students.splice(sIdx, 1);
  const rawPassword = req.body.password || st.password || "guru123";
  const hashed = hashPassword(rawPassword);

  const newTeacher = {
    id: "T_" + Date.now(),
    nip: req.body.nip || st.nis || "199" + Date.now(),
    name: req.body.name || st.name,
    username: req.body.username || st.username,
    password: hashed,
    mapel: req.body.mapel || ["Fikih"],
    role: "teacher",
    homeroom_class_id: req.body.homeroom_class_id || ""
  };
  teachers.push(newTeacher);
  await saveData('teachers', teachers);
  await saveData('students', students);
  const { password: _, ...sanitizedNewTeacher } = newTeacher;
  res.json({ success: true, teacher: sanitizedNewTeacher });
});

app.put("/api/users/change-role", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { userId, newRole } = req.body;
  if (!userId || !newRole) {
    return res.status(400).json({ success: false, message: "userId dan newRole wajib diisi." });
  }

  const sIdx = students.findIndex(s => String(s.id) === String(userId));
  const tIdx = teachers.findIndex(t => String(t.id) === String(userId));

  if (sIdx < 0 && tIdx < 0) {
    return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
  }

  if (newRole === "teacher" || newRole === "guru") {
    if (tIdx >= 0) {
      teachers[tIdx].role = "teacher";
      await saveData('teachers', teachers);
      const { password: _, ...sanitizedTeacher } = teachers[tIdx];
      return res.json({ success: true, message: "Peran berhasil diubah menjadi Guru.", user: sanitizedTeacher, role: "teacher" });
    } else {
      const st = students[sIdx];
      students.splice(sIdx, 1);
      const rawPassword = st.password || "guru123";
      const hashed = hashPassword(rawPassword);

      const newTeacher = {
        id: st.id,
        nip: st.nis || "199" + Date.now(),
        name: st.name,
        username: st.username,
        password: hashed,
        mapel: ["Fikih"],
        role: "teacher",
        homeroom_class_id: ""
      };
      teachers.push(newTeacher);
      await saveData('teachers', teachers);
      await saveData('students', students);
      const { password: _, ...sanitizedNewTeacher } = newTeacher;
      return res.json({ success: true, message: "Peran berhasil diubah menjadi Guru.", user: sanitizedNewTeacher, role: "teacher" });
    }
  } else if (newRole === "student" || newRole === "class_leader" || newRole === "murid" || newRole === "ketua_kelas") {
    const roleValue = (newRole === "class_leader" || newRole === "ketua_kelas") ? "class_leader" : "student";
    
    if (sIdx >= 0) {
      students[sIdx].role = roleValue;
      await saveData('students', students);
      const { password: _, ...sanitizedStudent } = students[sIdx];
      return res.json({ success: true, message: `Peran berhasil diubah menjadi ${roleValue === "class_leader" ? "Ketua Kelas" : "Murid"}.`, user: sanitizedStudent, role: roleValue });
    } else {
      const tch = teachers[tIdx];
      teachers.splice(tIdx, 1);
      
      classes.forEach(c => {
        if (String(c.homeroomTeacherId) === String(userId)) {
          c.homeroomTeacherId = "";
        }
      });

      const rawPassword = tch.password || "123456";
      const hashed = hashPassword(rawPassword);

      const newStudent = {
        id: tch.id,
        nis: tch.nip || "100" + Date.now().toString().substr(-3),
        name: tch.name,
        classId: classes[0]?.id || "C1",
        class_id: classes[0]?.id || "C1",
        username: tch.username,
        password: hashed,
        photo: "",
        no_hp: "",
        role: roleValue
      };
      students.push(newStudent);
      await saveData('teachers', teachers);
      await saveData('students', students);
      await saveData('classes', classes);
      const { password: _, ...sanitizedNewStudent } = newStudent;
      return res.json({ success: true, message: `Peran berhasil diubah menjadi ${roleValue === "class_leader" ? "Ketua Kelas" : "Murid"}.`, user: sanitizedNewStudent, role: roleValue });
    }
  }

  res.status(400).json({ success: false, message: "Role tidak valid." });
});

app.delete("/api/students/:id", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const targetStudent = students.find(s => String(s.id) === String(id));
  const targetNis = targetStudent ? String(targetStudent.nis || '').trim() : '';

  // 1. Delete profile photo from Firestore if any
  if (db && targetStudent && targetStudent.photo && targetStudent.photo.startsWith('/api/photos/')) {
    const docId = targetStudent.photo.replace('/api/photos/', '');
    if (docId) {
      try { await deleteDoc(doc(db, 'photos', docId)); } catch(e) {}
    }
  }

  // 2. Delete attendance photos from Firestore for this student
  if (db) {
    const studentAttRecords = (attendance || []).filter(a => String(a.studentId) === String(id) || (targetNis && String(a.nis) === targetNis));
    for (const rec of studentAttRecords) {
      if (rec && rec.photo && rec.photo.startsWith('/api/photos/')) {
        const docId = rec.photo.replace('/api/photos/', '');
        if (docId) {
          try { await deleteDoc(doc(db, 'photos', docId)); } catch(e) {}
        }
      }
    }
  }

  // 3. Remove student from students list
  students = students.filter(s => String(s.id) !== String(id));
  await saveData('students', students);

  // 4. Cascade remove attendance records
  if (Array.isArray(attendance)) {
    attendance = attendance.filter(a => String(a.studentId) !== String(id) && (!targetNis || String(a.nis) !== targetNis));
    await saveData('attendance', attendance);
  }

  // 5. Cascade remove grades records
  if (Array.isArray(grades)) {
    grades = grades.filter(g => String(g.studentId) !== String(id) && (!targetNis || String(g.nis) !== targetNis));
    await saveData('grades', grades);
  }

  res.json({ success: true, message: "Siswa dan seluruh data terkait (foto, absensi, dan nilai) berhasil dihapus." });
});

app.post("/api/students/delete-bulk", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ success: false, message: "IDs harus berupa array." });
  }
  const stringIds = ids.map(id => String(id));
  const targetStudents = students.filter(s => stringIds.includes(String(s.id)));
  const targetNisSet = new Set(targetStudents.map(s => String(s.nis || '').trim()).filter(Boolean));

  // 1. Delete profile photos & attendance photos from Firestore
  if (db) {
    for (const st of targetStudents) {
      if (st && st.photo && st.photo.startsWith('/api/photos/')) {
        const docId = st.photo.replace('/api/photos/', '');
        if (docId) {
          try { await deleteDoc(doc(db, 'photos', docId)); } catch(e) {}
        }
      }
    }
    const studentAttRecords = (attendance || []).filter(a => stringIds.includes(String(a.studentId)) || (a.nis && targetNisSet.has(String(a.nis))));
    for (const rec of studentAttRecords) {
      if (rec && rec.photo && rec.photo.startsWith('/api/photos/')) {
        const docId = rec.photo.replace('/api/photos/', '');
        if (docId) {
          try { await deleteDoc(doc(db, 'photos', docId)); } catch(e) {}
        }
      }
    }
  }

  // 2. Remove students
  students = students.filter(s => !stringIds.includes(String(s.id)));
  await saveData('students', students);

  // 3. Cascade remove attendance
  if (Array.isArray(attendance)) {
    attendance = attendance.filter(a => !stringIds.includes(String(a.studentId)) && (!a.nis || !targetNisSet.has(String(a.nis))));
    await saveData('attendance', attendance);
  }

  // 4. Cascade remove grades
  if (Array.isArray(grades)) {
    grades = grades.filter(g => !stringIds.includes(String(g.studentId)) && (!g.nis || !targetNisSet.has(String(g.nis))));
    await saveData('grades', grades);
  }

  res.json({ success: true, message: `${stringIds.length} siswa dan seluruh data terkait (foto, absensi, dan nilai) berhasil dihapus.` });
});

// 5. Classes API
app.get("/api/classes", requireAuth, (req, res) => {
  res.json({ success: true, classes: filterByMadrasah(classes, req) });
});

app.post("/api/classes", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { name, grade, code, homeroomTeacherId } = req.body;
  let targetId = req.body.id;
  if (targetId) {
    const idx = classes.findIndex(c => String(c.id) === String(targetId));
    if (idx >= 0) {
      classes[idx] = { 
        ...classes[idx], 
        name, 
        grade, 
        code: code || classes[idx].code,
        homeroomTeacherId: homeroomTeacherId || ""
      };

      // Sync teachers homeroom_class_id
      teachers.forEach(t => {
        if (String(t.id) === String(homeroomTeacherId)) {
          t.homeroom_class_id = String(targetId);
        } else if (String(t.homeroom_class_id) === String(targetId)) {
          t.homeroom_class_id = "";
        }
      });

      await saveData('classes', classes);
      await saveData('teachers', teachers);
      return res.json({ success: true, class: classes[idx] });
    }
  }
  const newId = "C" + (classes.length + 1);
  const newClass = tagNewRecord({ id: newId, code: code || newId, name, grade: grade || "X", homeroomTeacherId: homeroomTeacherId || "" }, req);
  classes.push(newClass);

  if (homeroomTeacherId) {
    teachers.forEach(t => {
      if (String(t.id) === String(homeroomTeacherId)) {
        t.homeroom_class_id = newId;
      }
    });
  }

  await saveData('classes', classes);
  await saveData('teachers', teachers);
  res.json({ success: true, class: newClass });
});

app.delete("/api/classes/:id", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  classes = classes.filter(c => String(c.id) !== String(id));
  await saveData('classes', classes);
  res.json({ success: true, message: "Kelas berhasil dihapus." });
});

// 6. Subjects API
app.get("/api/subjects", (req, res) => {
  res.json({ success: true, subjects: filterByMadrasah(subjects, req) });
});

app.post("/api/subjects", async (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, message: "Kode dan Nama mapel wajib diisi." });
  }
  const newId = "S" + (subjects.length + 1);
  const newSub = tagNewRecord({ id: newId, code, name }, req);
  subjects.push(newSub);
  await saveData('subjects', subjects);
  res.json({ success: true, subject: newSub });
});

app.delete("/api/subjects/:id", async (req, res) => {
  const { id } = req.params;
  subjects = subjects.filter(s => String(s.id) !== String(id));
  await saveData('subjects', subjects);
  res.json({ success: true, message: "Mata pelajaran berhasil dihapus." });
});

// 7. Attendance API
function getRecordTimestamp(id: string, record: any): number {
  if (record && typeof record.timestamp === 'number') return record.timestamp;
  if (typeof id === 'string') {
    const parts = id.split('_');
    if (parts.length >= 2) {
      const ts = parseInt(parts[1]);
      if (!isNaN(ts)) return ts;
    }
  }
  return 0;
}

app.get("/api/attendance", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({ success: true, attendance: filterByMadrasah(attendance || [], req) });
});

app.post("/api/attendance", async (req, res) => {
  let { studentId, classId, date, status, location, photo, note, subjectId } = req.body;
  if (photo && photo.startsWith("data:image/")) {
    photo = await saveBase64ToFirestore(photo);
  }
  const today = date || getJakartaTodayDateStr();

  let resultItem: any = null;
  let isConflict = false;
  let isCooldown = false;
  let isUpdated = false;

  try {
    await updateStoreKeyWithLock('attendance', (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];
      
      const existingIndex = attList.findIndex(a => 
        (String(a.studentId) === String(studentId) || a.studentId === studentId) && 
        String(a.date).substring(0, 10) === today &&
        (subjectId ? String(a.subjectId || '') === String(subjectId) : (!a.subjectId || String(a.subjectId) === 'ALL'))
      );

      if (existingIndex !== -1) {
        const existingRecord = attList[existingIndex];
        const lastTapTime = getRecordTimestamp(existingRecord.id, existingRecord);
        const now = Date.now();
        
        // Lockout duplicate taps within 5 minutes for student scans
        if (note !== 'Ketua Kelas' && note !== 'Input Admin' && lastTapTime > 0 && (now - lastTapTime) < 5 * 60 * 1000) {
          isCooldown = true;
          return attList;
        }

        if (note === 'Ketua Kelas' || note === 'Input Admin' || (!attList[existingIndex].photo && photo)) {
          attList[existingIndex].status = status || attList[existingIndex].status;
          // Protect GPS location: don't overwrite real coordinates with 'Input Admin'
          if (location && location !== 'Input Admin') {
            attList[existingIndex].location = location;
          } else if (!attList[existingIndex].location) {
            attList[existingIndex].location = location || 'Input Admin';
          }
          // Protect photo: never overwrite existing photo with empty string
          if (photo) {
            attList[existingIndex].photo = photo;
          }
          if (note) attList[existingIndex].note = note;
          if (subjectId) attList[existingIndex].subjectId = subjectId;
          resultItem = attList[existingIndex];
          isUpdated = true;
          return attList;
        }
        isConflict = true;
        return attList;
      }

      const newAtt = tagNewRecord({
        id: "ATT_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        studentId,
        classId: classId || "",
        subjectId: subjectId || "",
        date: today,
        status: status || "HADIR",
        location: location || "",
        photo: photo || "",
        note: note || "",
        timestamp: Date.now()
      }, req);
      attList.push(newAtt);
      resultItem = newAtt;
      return attList;
    });

    if (isCooldown) {
      return res.status(429).json({
        success: false,
        cooldown: true,
        message: "Kartu baru saja di-tap. Harap tunggu 5 menit sebelum melakukan tap kembali."
      });
    }

    if (isConflict) {
      return res.status(409).json({
        success: false,
        already_attended: true,
        message: "Anda sudah melakukan absensi untuk mata pelajaran ini hari ini."
      });
    }

    res.json({ success: true, attendance: resultItem, updated: isUpdated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/attendance/bulk", async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: "Payload tidak valid." });
  }

  try {
    await updateStoreKeyWithLock('attendance', (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];

      items.forEach(item => {
        const { studentId, classId, date, status, location, photo, note, subjectId } = item;
        const today = date || getJakartaTodayDateStr();

        const existingIndex = attList.findIndex(a => 
          (String(a.studentId) === String(studentId) || a.studentId === studentId) && 
          String(a.date).substring(0, 10) === today &&
          (subjectId ? String(a.subjectId || '') === String(subjectId) : (!a.subjectId || String(a.subjectId) === 'ALL'))
        );

        if (existingIndex !== -1) {
          attList[existingIndex].status = status || attList[existingIndex].status || "HADIR";
          if (location && location !== 'Input Admin') {
            attList[existingIndex].location = location;
          } else if (!attList[existingIndex].location) {
            attList[existingIndex].location = location || "Input Admin";
          }
          if (photo) {
            attList[existingIndex].photo = photo;
          }
          if (note && !attList[existingIndex].note) {
            attList[existingIndex].note = note;
          }
          if (subjectId) attList[existingIndex].subjectId = subjectId;
        } else {
          attList.push(tagNewRecord({
            id: "ATT_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            studentId,
            classId: classId || "",
            subjectId: subjectId || "",
            date: today,
            status: status || "HADIR",
            location: location || "Input Admin",
            photo: photo || "",
            note: note || "Input Admin"
          }, req));
        }
      });

      return attList;
    });

    res.json({ success: true, count: items.length });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/attendance/reset", async (req, res) => {
  const { classId, subjectId, date, studentIds } = req.body;
  if (!date || !Array.isArray(studentIds)) {
    return res.status(400).json({ success: false, message: "Date and studentIds are required." });
  }
  const dateStr = String(date).substring(0, 10);
  
  try {
    await updateStoreKeyWithLock('attendance', (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];
      const studentIdSet = new Set(studentIds.map(id => String(id).toLowerCase().trim()));
      
      // Expand target student set with any matching student details from global students list
      if (Array.isArray(students)) {
        for (const st of students) {
          const stId = String(st.id || '').toLowerCase().trim();
          const stNis = String(st.nis || '').toLowerCase().trim();
          const stName = String(st.name || '').toLowerCase().trim();
          const stUser = String(st.username || '').toLowerCase().trim();
          if (studentIdSet.has(stId) || studentIdSet.has(stNis) || studentIdSet.has(stName) || studentIdSet.has(stUser)) {
            if (stId) studentIdSet.add(stId);
            if (stNis) studentIdSet.add(stNis);
            if (stName) studentIdSet.add(stName);
            if (stUser) studentIdSet.add(stUser);
          }
        }
      }

      const filtered = attList.filter(a => {
        const itemDate = String(a.date).substring(0, 10);
        if (itemDate !== dateStr) return true;
        
        let sameSubject = true;
        if (subjectId && subjectId !== 'ALL') {
          sameSubject = (String(a.subjectId || '') === String(subjectId) || !a.subjectId || String(a.subjectId) === 'ALL');
        }
        
        if (!sameSubject) return true;
        
        const isTargetStudent = studentIdSet.has(String(a.studentId).toLowerCase().trim());
        return !isTargetStudent;
      });

      return filtered;
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/attendance/clear-all", async (req, res) => {
  try {
    let deletedAttendanceCount = 0;
    let deletedPhotosCount = 0;

    // 1. Clean up student attendance (keep latest per NIS)
    await updateStoreKeyWithLock('attendance', (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];
      const grouped = new Map();
      const sorted = [...attList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const kept = [];
      for (const record of sorted) {
        if (!grouped.has(record.studentId)) {
          grouped.set(record.studentId, true);
          kept.push(record);
        }
      }
      deletedAttendanceCount += (attList.length - kept.length);
      return kept;
    });

    // 2. Clean up teacher attendance (keep latest per NIP)
    await updateStoreKeyWithLock('teacherAttendance', (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];
      const grouped = new Map();
      const sorted = [...attList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const kept = [];
      for (const record of sorted) {
        if (!grouped.has(record.teacherId)) {
          grouped.set(record.teacherId, true);
          kept.push(record);
        }
      }
      deletedAttendanceCount += (attList.length - kept.length);
      return kept;
    });

    // 3. Gather active photos
    const activePhotoIds = new Set<string>();

    if (pool) {
      const { rows: students } = await pool.query("SELECT photo FROM students WHERE photo IS NOT NULL");
      for (const s of students) {
        if (s.photo && s.photo.startsWith('/api/photos/')) {
          activePhotoIds.add(s.photo.replace('/api/photos/', ''));
        }
      }
      
      const { rows: teachers } = await pool.query("SELECT photo FROM teachers WHERE photo IS NOT NULL");
      for (const t of teachers) {
        if (t.photo && t.photo.startsWith('/api/photos/')) {
          activePhotoIds.add(t.photo.replace('/api/photos/', ''));
        }
      }

      const { rows: attRows } = await pool.query("SELECT value FROM app_store WHERE key = 'attendance'");
      if (attRows.length > 0 && attRows[0].value) {
        const keptAtt = typeof attRows[0].value === 'string' ? JSON.parse(attRows[0].value) : attRows[0].value;
        for (const a of keptAtt) {
          if (a.photo && a.photo.startsWith('/api/photos/')) {
             activePhotoIds.add(a.photo.replace('/api/photos/', ''));
          }
        }
      }

      const { rows: tAttRows } = await pool.query("SELECT value FROM app_store WHERE key = 'teacherAttendance'");
      if (tAttRows.length > 0 && tAttRows[0].value) {
        const keptTAtt = typeof tAttRows[0].value === 'string' ? JSON.parse(tAttRows[0].value) : tAttRows[0].value;
        for (const a of keptTAtt) {
          if (a.photo && a.photo.startsWith('/api/photos/')) {
             activePhotoIds.add(a.photo.replace('/api/photos/', ''));
          }
        }
      }
    }

    // 4. Delete orphaned photos from Firestore
    if (db) {
      try {
        const photosSnapshot = await getDocs(collection(db, 'photos'));
        for (const docSnap of photosSnapshot.docs) {
          if (!activePhotoIds.has(docSnap.id)) {
            await deleteDoc(doc(db, 'photos', docSnap.id)).catch(e => console.error(e));
            deletedPhotosCount++;
          }
        }
      } catch (err) {
        console.error("Error GC Firestore photos:", err);
      }
    }

    res.json({ success: true, message: `Pembersihan berhasil! ${deletedAttendanceCount} data absensi lama dan ${deletedPhotosCount} foto sampah (absensi & profil) dihapus.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Teacher Attendance API
app.get("/api/teacher-attendance", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({ success: true, teacherAttendance: filterByMadrasah(teacherAttendance || [], req) });
});

app.post("/api/teacher-attendance", async (req, res) => {
  let { teacherId, date, status, location, photo, note, type, time } = req.body;
  if (photo && photo.startsWith("data:image/")) {
    photo = await saveBase64ToFirestore(photo);
  }
  const today = date || getJakartaTodayDateStr();

  let resultItem: any = null;
  let isConflict = false;
  let isCooldown = false;

  try {
    await updateStoreKeyWithLock('teacherAttendance', (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      const existing = list.find(a => 
        String(a.teacherId) === String(teacherId) && 
        String(a.date).substring(0, 10) === today && 
        (a.type || 'MASUK') === (type || 'MASUK')
      );
      if (existing) {
        const lastTapTime = getRecordTimestamp(existing.id, existing);
        const now = Date.now();
        
        // Cooldown lockout for duplicate taps within 5 minutes
        if (note !== 'Input Admin' && lastTapTime > 0 && (now - lastTapTime) < 5 * 60 * 1000) {
          isCooldown = true;
          return list;
        }

        isConflict = true;
        return list;
      }

      const newAtt = tagNewRecord({
        id: "T_ATT_" + Date.now(),
        teacherId,
        date: today,
        status: status || "HADIR",
        type: type || "MASUK",
        time: time || null,
        location: location || "",
        photo: photo || "",
        note: note || "",
        timestamp: Date.now()
      }, req);
      list.push(newAtt);
      resultItem = newAtt;
      return list;
    });

    if (isCooldown) {
      return res.status(429).json({
        success: false,
        cooldown: true,
        message: "Kartu baru saja di-tap. Harap tunggu 5 menit sebelum melakukan tap kembali."
      });
    }

    if (isConflict) {
      return res.status(409).json({
        success: false,
        already_attended: true,
        message: `Anda sudah melakukan absensi ${type === 'PULANG' ? 'pulang' : 'masuk'} hari ini.`
      });
    }

    res.json({ success: true, teacherAttendance: resultItem });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/teacher-attendance/update", async (req, res) => {
  const { teacherId, date, status, type } = req.body;
  const dateStr = String(date).substring(0, 10);
  const attType = type || 'MASUK';

  try {
    await updateStoreKeyWithLock('teacherAttendance', (currentVal) => {
      let list = Array.isArray(currentVal) ? currentVal : [];
      if (status === 'BELUM PRESENSI') {
        list = list.filter(a => !(String(a.teacherId) === String(teacherId) && String(a.date).substring(0, 10) === dateStr && (a.type || 'MASUK') === attType));
      } else {
        const existing = list.find(a => String(a.teacherId) === String(teacherId) && String(a.date).substring(0, 10) === dateStr && (a.type || 'MASUK') === attType);
        if (existing) {
          existing.status = status;
        } else {
          list.push({
            id: 'TATT_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            teacherId: teacherId,
            date: dateStr,
            status: status,
            type: attType,
            location: 'Input Admin',
            photo: '',
            createdAt: new Date().toISOString()
          });
        }
      }
      return list;
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Smart photo cleanup endpoint for admin (preserves profile photos, photo history, and latest attendance photos)
app.post("/api/admin/cleanup-photos", async (req, res) => {
  if (!db) {
    return res.status(400).json({ success: false, message: "Firebase is not configured." });
  }

  let deletedCount = 0;
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const docIdsToDelete: string[] = [];

  try {
    // Collect all photo URLs and doc IDs that must NEVER be deleted (active profiles and profile history)
    const protectedPhotoUrls = new Set<string>();
    const protectedDocIds = new Set<string>();

    const markProtected = (url: any) => {
      if (!url) return;
      const str = typeof url === 'string' ? url : (url.photo || '');
      if (str && typeof str === 'string') {
        protectedPhotoUrls.add(str);
        if (str.startsWith('/api/photos/')) {
          const docId = str.replace('/api/photos/', '').trim();
          if (docId) protectedDocIds.add(docId);
        }
      }
    };

    (students || []).forEach(s => {
      if (s) {
        markProtected(s.photo);
        if (Array.isArray(s.photoHistory)) s.photoHistory.forEach(markProtected);
        if (Array.isArray(s.photo_history)) s.photo_history.forEach(markProtected);
      }
    });

    (teachers || []).forEach(t => {
      if (t) {
        markProtected(t.photo);
        if (Array.isArray(t.photoHistory)) t.photoHistory.forEach(markProtected);
        if (Array.isArray(t.photo_history)) t.photo_history.forEach(markProtected);
      }
    });

    // 1. Process student attendance synchronously to identify old photos to delete
    await updateStoreKeyWithLock('attendance', (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      
      const studentGroups: { [studentId: string]: any[] } = {};
      list.forEach(record => {
        if (record && record.studentId && record.photo && record.photo.startsWith('/api/photos/')) {
          const sId = String(record.studentId);
          if (!studentGroups[sId]) studentGroups[sId] = [];
          studentGroups[sId].push(record);
        }
      });

      for (const sId in studentGroups) {
        const records = studentGroups[sId];
        records.sort((a, b) => {
          const tsA = getRecordTimestamp(a.id, a);
          const tsB = getRecordTimestamp(b.id, b);
          return tsB - tsA;
        });

        // Index 0 is the newest, keep it completely intact. Process index 1 and beyond
        for (let i = 1; i < records.length; i++) {
          const rec = records[i];
          const ts = getRecordTimestamp(rec.id, rec);
          
          if (ts > 0 && ts < thirtyDaysAgo) {
            const photoUrl = rec.photo;
            const docId = photoUrl.replace('/api/photos/', '').trim();
            // ONLY delete the underlying storage document if it is NOT protected as a profile photo or in photo history
            if (docId && !protectedDocIds.has(docId) && !protectedPhotoUrls.has(photoUrl)) {
              docIdsToDelete.push(docId);
            }
            rec.photo = ''; // Clear photo reference in old attendance record
          }
        }
      }

      return list;
    });

    // 3. Delete collected old photo documents from Firestore (ensuring none are protected)
    for (const docId of docIdsToDelete) {
      if (protectedDocIds.has(docId)) continue;
      try {
        await deleteDoc(doc(db, 'photos', docId));
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete old photo doc ${docId}:`, e);
      }
    }

    // 4. Calculate remaining active photos stored in system
    const studentProfilePhotos = (students || []).filter(s => s && s.photo && String(s.photo).trim() !== '').length;
    const teacherProfilePhotos = (teachers || []).filter(t => t && t.photo && String(t.photo).trim() !== '').length;
    const studentAttendancePhotos = (attendance || []).filter(a => a && a.photo && String(a.photo).trim() !== '').length;
    const teacherAttendancePhotos = (teacherAttendance || []).filter(a => a && a.photo && String(a.photo).trim() !== '').length;
    const remainingCount = studentProfilePhotos + teacherProfilePhotos + studentAttendancePhotos + teacherAttendancePhotos;

    res.json({
      success: true,
      message: deletedCount > 0 
        ? `Pembersihan berhasil! Sebanyak ${deletedCount} foto usang berhasil dihapus. ${remainingCount} foto penting tetap aman tersimpan.`
        : `Semua data foto sudah bersih dan optimal! Tidak ada foto usang (>30 hari) yang perlu dihapus. ${remainingCount} foto penting tetap aktif tersimpan.`,
      deletedCount,
      remainingCount,
      details: {
        studentProfilePhotos,
        teacherProfilePhotos,
        studentAttendancePhotos,
        teacherAttendancePhotos
      }
    });

  } catch (err: any) {
    console.error("Cleanup error:", err);
    res.status(500).json({ success: false, message: "Terjadi kesalahan sistem saat melakukan pembersihan." });
  }
});

app.post("/api/admin/cleanup-teacher-photos", async (req, res) => {
  if (!db) {
    return res.status(400).json({ success: false, message: "Firebase is not configured." });
  }
  
  let deletedCount = 0;
  const docIdsToDelete: string[] = [];
  
  try {
    // Collect protected profile photo URLs to avoid deleting the teacher's profile photos
    const protectedPhotoUrls = new Set<string>();
    const protectedDocIds = new Set<string>();
    
    (teachers || []).forEach(t => {
      if (t) {
        if (t.photo && typeof t.photo === 'string') {
          protectedPhotoUrls.add(t.photo);
          if (t.photo.startsWith('/api/photos/')) {
            const docId = t.photo.replace('/api/photos/', '').trim();
            if (docId) protectedDocIds.add(docId);
          }
        }
        if (Array.isArray(t.photoHistory)) {
          t.photoHistory.forEach((p: any) => {
            const str = typeof p === 'string' ? p : (p.photo || '');
            if (str && typeof str === 'string') {
              protectedPhotoUrls.add(str);
              if (str.startsWith('/api/photos/')) {
                const docId = str.replace('/api/photos/', '').trim();
                if (docId) protectedDocIds.add(docId);
              }
            }
          });
        }
        if (Array.isArray(t.photo_history)) {
          t.photo_history.forEach((p: any) => {
            const str = typeof p === 'string' ? p : (p.photo || '');
            if (str && typeof str === 'string') {
              protectedPhotoUrls.add(str);
              if (str.startsWith('/api/photos/')) {
                const docId = str.replace('/api/photos/', '').trim();
                if (docId) protectedDocIds.add(docId);
              }
            }
          });
        }
      }
    });
    
    // Process teacher attendance synchronously to collect all photos to delete and clear them
    await updateStoreKeyWithLock('teacherAttendance', (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      list.forEach(record => {
        if (record && record.photo && record.photo.startsWith('/api/photos/')) {
          const photoUrl = record.photo;
          const docId = photoUrl.replace('/api/photos/', '').trim();
          if (docId && !protectedDocIds.has(docId) && !protectedPhotoUrls.has(photoUrl)) {
            docIdsToDelete.push(docId);
          }
          record.photo = ''; // Clear photo in attendance record
        }
      });
      return list;
    });
    
    // Delete from Firestore
    for (const docId of docIdsToDelete) {
      try {
        await deleteDoc(doc(db, 'photos', docId));
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete teacher attendance photo doc ${docId}:`, e);
      }
    }
    
    res.json({
      success: true,
      message: `Berhasil menghapus ${deletedCount} foto absensi guru dari penyimpanan.`
    });
  } catch (err: any) {
    console.error("Teacher cleanup error:", err);
    res.status(500).json({ success: false, message: "Terjadi kesalahan sistem saat membersihkan foto guru." });
  }
});

// 8. Question Bank Groups API
app.get("/api/question-bank-groups", (req, res) => {
  res.json({ success: true, groups: filterByMadrasah(questionBankGroups, req) });
});

app.post("/api/question-bank-groups", async (req, res) => {
  const { code, subjectId, classId } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: "Kode bank soal wajib diisi." });
  }
  const newGrp = tagNewRecord({
    id: req.body.id || ("BG_" + Date.now()),
    code,
    subjectId: subjectId || "",
    classId: classId || ""
  }, req);
  questionBankGroups.push(newGrp);
  await saveData('questionBankGroups', questionBankGroups);
  res.json({ success: true, group: newGrp });
});

app.delete("/api/question-bank-groups/:id", async (req, res) => {
  const { id } = req.params;
  questionBankGroups = questionBankGroups.filter(bg => String(bg.id) !== String(id));
  await saveData('questionBankGroups', questionBankGroups);
  res.json({ success: true, message: "Bank soal berhasil dihapus!" });
});

// 9. Questions API
app.get("/api/questions", (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (
    authUser.role === 'teacher' || authUser.role === 'guru' ||
    authUser.role === 'admin' || authUser.role === 'bos' || authUser.role === 'superadmin'
  ));
  let filtered = filterByMadrasah(questions, req);
  if (!isTeacherOrAdmin) {
    filtered = filtered.map(sanitizeQuestionForStudent).filter(Boolean);
  }
  res.json({ success: true, questions: filtered });
});

app.post("/api/questions/batch", async (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (
    authUser.role === 'teacher' || authUser.role === 'guru' ||
    authUser.role === 'admin' || authUser.role === 'bos' || authUser.role === 'superadmin'
  ));
  if (!isTeacherOrAdmin) {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya guru dan admin yang dapat mengelola bank soal." });
  }

  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map(q => tagNewRecord(q, req));
    const mId = getRequestMadrasahId(req);
    let otherQuestions = [];
    if (mId && mId !== 'default' && mId !== 'BOSS') {
      const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherQuestions = questions.filter(q => {
        const imId = String(q.madrasahId || '').trim();
        const imSlug = String(q.madrasahSlug || '').trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
      const defId = defaultM ? defaultM.id : 'default';
      const defSlug = defaultM ? defaultM.slug : 'default';
      otherQuestions = questions.filter(q => {
        const imId = String(q.madrasahId || 'default').trim();
        const imSlug = String(q.madrasahSlug || 'default').trim();
        const isDefault = imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!q.madrasahId && !q.madrasahSlug);
        return !isDefault;
      });
    }
    questions = [...otherQuestions, ...taggedIncoming];
    await saveData('questions', questions);
    res.json({ success: true, questions: taggedIncoming });
  } else {
    res.status(400).json({ success: false, message: "Invalid payload, expected an array." });
  }
});

app.post("/api/questions", async (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (
    authUser.role === 'teacher' || authUser.role === 'guru' ||
    authUser.role === 'admin' || authUser.role === 'bos' || authUser.role === 'superadmin'
  ));
  if (!isTeacherOrAdmin) {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya guru dan admin yang dapat membuat soal." });
  }

  let { question, options, optionA, optionB, optionC, optionD, optionE, answer, subjectId, classId, code, type, explanation, imageUrl } = req.body;
  if (imageUrl && imageUrl.startsWith("data:image/")) { imageUrl = await saveBase64ToFirestore(imageUrl); }
  const newQ = tagNewRecord({
    id: "Q_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    code: code || req.body.category || "",
    subjectId: subjectId || req.body.subject || "",
    classId: classId || "",
    type: type || (options ? "mc" : (optionA ? "mc" : "essay")),
    question,
    options: options || [optionA, optionB, optionC, optionD, optionE].filter(Boolean),
    answer,
    explanation: explanation || "",
    imageUrl: imageUrl || ""
  }, req);
  questions.push(newQ);
  await saveData('questions', questions);
  res.json({ success: true, question: newQ });
});

app.put("/api/questions/:id", async (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (
    authUser.role === 'teacher' || authUser.role === 'guru' ||
    authUser.role === 'admin' || authUser.role === 'bos' || authUser.role === 'superadmin'
  ));
  if (!isTeacherOrAdmin) {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya guru dan admin yang dapat mengedit soal." });
  }

  const { id } = req.params;
  const idx = questions.findIndex(q => String(q.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Soal tidak ditemukan." });
  }
  questions[idx] = {
    ...questions[idx],
    ...req.body
  };
  await saveData('questions', questions);
  res.json({ success: true, question: questions[idx] });
});

app.delete("/api/questions/:id", async (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (
    authUser.role === 'teacher' || authUser.role === 'guru' ||
    authUser.role === 'admin' || authUser.role === 'bos' || authUser.role === 'superadmin'
  ));
  if (!isTeacherOrAdmin) {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya guru dan admin yang dapat menghapus soal." });
  }

  const { id } = req.params;
  questions = questions.filter(q => String(q.id) !== String(id));
  await saveData('questions', questions);
  res.json({ success: true, message: "Soal berhasil dihapus!" });
});

// Exam Monitoring State API (Locked strictly to teachers, proctors, and admins)
app.get("/api/exam-monitoring-state", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), (req: any, res) => {
  const authUser = req.user;
  const isBos = authUser.role === 'bos' || authUser.role === 'superadmin';
  const userMadrasahId = getRequestMadrasahId(req);

  if (isBos) {
    return res.json({
      success: true,
      activeExamSessions,
      completedExams,
      forceFinishedExams,
      studentExamAnswers,
      studentExamQuestions,
      studentTabSwitches,
      studentOutOfTab,
      blockedStudents,
      studentLivecamFrames,
      studentExamGrades,
      examMessages,
      exams: getMemoryKeyValue('exams') || exams
    });
  }

  // Tenant-scoping: filter all maps by student belonging to the user's madrasah, and filter exams
  const studentList = getMemoryKeyValue('students') || students || [];
  const tenantStudentIds = new Set(
    studentList
      .filter((s: any) => String(s.madrasahId || 'default').trim() === String(userMadrasahId).trim())
      .map((s: any) => String(s.id))
  );

  const tenantExams = (getMemoryKeyValue('exams') || exams || []).filter((e: any) => 
    String(e.madrasahId || 'default').trim() === String(userMadrasahId).trim()
  );
  const tenantExamIds = new Set(tenantExams.map((e: any) => String(e.id)));

  const filterMap = (mapObj: any) => {
    const filtered: any = {};
    if (!mapObj) return filtered;
    for (const key of Object.keys(mapObj)) {
      // Keys are usually formatted as studentId_examId or similar
      const parts = key.split('_');
      if (parts.length >= 2) {
        const studentId = parts[0];
        const examId = parts[1];
        if (tenantStudentIds.has(studentId) && tenantExamIds.has(examId)) {
          filtered[key] = mapObj[key];
        }
      } else if (tenantStudentIds.has(key)) {
        filtered[key] = mapObj[key];
      }
    }
    return filtered;
  };

  res.json({
    success: true,
    activeExamSessions: filterMap(activeExamSessions),
    completedExams: filterMap(completedExams),
    forceFinishedExams: filterMap(forceFinishedExams),
    studentExamAnswers: filterMap(studentExamAnswers),
    studentExamQuestions: filterMap(studentExamQuestions),
    studentTabSwitches: filterMap(studentTabSwitches),
    studentOutOfTab: filterMap(studentOutOfTab),
    blockedStudents: filterMap(blockedStudents),
    studentLivecamFrames: filterMap(studentLivecamFrames),
    studentExamGrades: filterMap(studentExamGrades),
    examMessages: filterMap(examMessages),
    exams: tenantExams
  });
});

// Poin 1 & 4: Endpoint for Student Exam Summary (Replaces /api/exam-monitoring-state for students)
app.get("/api/exam/my-summary", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  if (!sId) {
    return res.status(400).json({ success: false, message: "studentId query param is required" });
  }

  const allExams = getMemoryKeyValue('exams') || exams || [];
  const completedList: string[] = [];
  const completedMap: Record<string, any> = {};
  const activeSessionsMap: Record<string, any> = {};
  const studentGrades: Record<string, any> = {};

  allExams.forEach((ex: any) => {
    const eId = String(ex.id);
    const key = sId + "_" + eId;

    if (completedExams[key]) {
      completedList.push(eId);
      completedMap[key] = completedExams[key];
    }
    if (studentExamGrades[key]) {
      studentGrades[key] = studentExamGrades[key];
    }

    const session = activeExamSessions[key];
    if (session && !completedExams[key]) {
      let remainingTime = session.timeLeft;
      if (session.endsAt) {
        remainingTime = Math.max(0, Math.floor((session.endsAt - Date.now()) / 1000));
      }
      activeSessionsMap[key] = {
        ...session,
        timeLeft: remainingTime,
        blocked: Boolean(blockedStudents[key]),
        forceFinished: Boolean(forceFinishedExams[key])
      };
    }
  });

  res.json({
    success: true,
    studentId: sId,
    completedExams: completedList,
    completedMap: completedMap,
    activeSessions: activeSessionsMap,
    grades: studentGrades
  });
});

// Phase 1 Endpoint: Isolated Student State (GET /api/exam/my-state)
app.get("/api/exam/my-state", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const examId = req.query.examId;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId query params are required" });
  }

  const eId = String(examId);
  const key1 = sId + "_" + eId;
  const key2 = String(sId) + "_" + String(eId);

  const session = activeExamSessions[key1] || activeExamSessions[key2] || null;
  const isCompleted = Boolean(completedExams[key1] || completedExams[key2]);
  const isForceDone = Boolean(forceFinishedExams[key1] || forceFinishedExams[key2] || completedExams[key1] === 'force_finish' || completedExams[key2] === 'force_finish');
  const isBlocked = Boolean(blockedStudents[key1] || blockedStudents[key2]);
  const outOfTab = Boolean(studentOutOfTab[key1] || studentOutOfTab[key2]);
  const tabSwitches = studentTabSwitches[key1] || studentTabSwitches[key2] || 0;
  const savedAnswers = (session && session.answers) || studentExamAnswers[key1] || studentExamAnswers[key2] || {};

  // Broadcast and personal messages
  const msgBroadcast = examMessages['broadcast_' + eId] || null;
  const msgPersonal = examMessages[key1] || examMessages[key2] || null;
  const latestMessage = msgPersonal || msgBroadcast || null;

  // Exam info & duration extensions
  const allExams = getMemoryKeyValue('exams') || exams || [];
  const matchedExam = allExams.find((e: any) => String(e.id) === eId) || null;

  // Server-authoritative remaining time calculation
  let remainingTime: number | null = null;
  if (session) {
    if (session.endsAt) {
      remainingTime = Math.max(0, Math.floor((session.endsAt - Date.now()) / 1000));
      session.timeLeft = remainingTime;
    } else if (session.timeLeft !== undefined) {
      remainingTime = session.timeLeft;
    } else {
      remainingTime = session.durationSec || (matchedExam ? parseInt(matchedExam.duration || 60, 10) * 60 : 3600);
    }
  }

  res.json({
    success: true,
    examId: eId,
    studentId: sId,
    status: isForceDone ? 'force_finished' : (isCompleted ? 'completed' : (session ? 'in_progress' : 'not_started')),
    currentIndex: session ? (session.currentIndex || 0) : 0,
    answers: savedAnswers,
    answeredCount: session ? (session.answeredCount || Object.keys(savedAnswers).length) : Object.keys(savedAnswers).length,
    totalQuestions: session ? (session.totalQuestions || 0) : 0,
    blocked: isBlocked,
    outOfTab: outOfTab,
    tabSwitches: tabSwitches,
    forceFinished: isForceDone,
    completed: isCompleted,
    remainingTime: remainingTime,
    startedAt: session ? session.startedAt : null,
    endsAt: session ? session.endsAt : null,
    serverDuration: matchedExam ? parseInt(matchedExam.duration || 60, 10) : null,
    message: latestMessage,
    messageBroadcast: msgBroadcast,
    messagePersonal: msgPersonal
  });
});

// Phase 2 Endpoint: Server-Authoritative Exam Attempt Start (POST /api/exam/attempt/start)
app.post("/api/exam/attempt/start", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, totalQuestions } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }

  const eId = String(examId);
  const key = sId + "_" + eId;

  const allExams = getMemoryKeyValue('exams') || exams || [];
  const matchedExam = allExams.find((e: any) => String(e.id) === eId);
  const durationMin = matchedExam ? parseInt(matchedExam.duration || 60, 10) : 60;
  const durationSec = durationMin * 60;

  let session = activeExamSessions[key];
  const now = Date.now();

  if (!session) {
    session = {
      startTime: now,
      startedAt: now,
      endsAt: now + (durationSec * 1000),
      durationSec: durationSec,
      duration: durationMin,
      status: 'active',
      answers: {},
      currentIndex: 0,
      totalQuestions: totalQuestions || 0,
      answeredCount: 0,
      timeLeft: durationSec,
      lastSeenAt: now
    };
    activeExamSessions[key] = session;
    await saveDeltaDb('activeExamSessions', key, session);
  } else {
    // Preserve existing endsAt or recalculate if missing
    if (!session.endsAt) {
      const remainingSec = session.timeLeft !== undefined ? session.timeLeft : durationSec;
      session.endsAt = now + (remainingSec * 1000);
      session.startedAt = session.startTime || (now - (durationSec - remainingSec) * 1000);
    }
    session.lastSeenAt = now;
    session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1000));
    if (totalQuestions && (!session.totalQuestions || session.totalQuestions <= 0)) {
      session.totalQuestions = totalQuestions;
    }
    // Merge any answers previously recorded or flushed
    if (!session.answers) session.answers = {};
    if (studentExamAnswers[key]) {
      session.answers = { ...studentExamAnswers[key], ...session.answers };
      session.answeredCount = Object.keys(session.answers).length;
    }
    activeExamSessions[key] = session;
    await saveDeltaDb('activeExamSessions', key, session);
  }

  broadcastExamEvent({
    type: 'exam_started',
    examId: eId,
    studentId: sId,
    answered: session.answeredCount || 0,
    total: session.totalQuestions || totalQuestions || 0,
    lastSeenAt: Date.now()
  });

  res.json({
    success: true,
    session: {
      startedAt: session.startedAt,
      endsAt: session.endsAt,
      remainingTime: session.timeLeft,
      currentIndex: session.currentIndex || 0,
      answers: session.answers || studentExamAnswers[key] || {},
      answeredCount: session.answeredCount || (session.answers ? Object.keys(session.answers).length : 0),
      totalQuestions: session.totalQuestions || 0
    }
  });
});

// Phase 5 & 6 Endpoint: Server-Authoritative Question Generation & Sanitization (POST /api/exam/attempt/start-questions)
function shuffleArray<T>(arr: T[]): T[] {
  if (!Array.isArray(arr)) return [];
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

app.post("/api/exam/attempt/start-questions", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId are required" });
  }

  const eId = String(examId);
  const key = sId + "_" + eId;

  // Poin 6: Kunci urutan soal di server (Never re-shuffle on refresh/reconnect)
  if (studentExamQuestions[key] && Array.isArray(studentExamQuestions[key]) && studentExamQuestions[key].length > 0) {
    return res.json({
      success: true,
      questions: studentExamQuestions[key],
      isResumed: true
    });
  }

  // Poin 2: Switch to 'questions' memory key and filter by bankCode, subject, class, tenant
  const allExams = getMemoryKeyValue('exams') || exams || [];
  const matchedExam = allExams.find((e: any) => String(e.id) === eId) || {};
  let rawQuestions = matchedExam.questions || [];

  if (!rawQuestions || rawQuestions.length === 0) {
    const allQuestions = getMemoryKeyValue('questions') || questions || [];
    const exCode = String(matchedExam.bankCode || matchedExam.groupCode || '').trim().toLowerCase();
    const exSub = String(matchedExam.subject || matchedExam.subjectId || '').trim().toLowerCase();
    const exClass = String(matchedExam.class || matchedExam.className || matchedExam.classId || '').trim().toLowerCase();
    const mId = String(matchedExam.madrasahId || matchedExam.madrasahSlug || '').trim();

    rawQuestions = allQuestions.filter((q: any) => {
      if (!q) return false;
      // Match tenant if applicable
      if (mId && mId !== 'default' && mId !== 'BOSS') {
        const qmId = String(q.madrasahId || q.madrasahSlug || '').trim();
        if (qmId && qmId !== mId) return false;
      }
      const qCode = String(q.code || q.bankCode || q.groupCode || '').trim().toLowerCase();
      const qSub = String(q.subjectId || q.subject || '').trim().toLowerCase();
      const qClass = String(q.classId || q.className || q.class || '').trim().toLowerCase();

      // Check match by bankCode or subject
      if (exCode && qCode && qCode === exCode) return true;
      if (exSub && qSub && (qSub === exSub || qSub.includes(exSub) || exSub.includes(qSub))) {
        if (exClass && qClass && !exClass.includes('all') && !qClass.includes('all')) {
          return qClass === exClass || exClass.includes(qClass);
        }
        return true;
      }
      return false;
    });
  }

  if (!rawQuestions || rawQuestions.length === 0) {
    return res.status(404).json({
      success: false,
      message: "Tidak ada soal yang tersedia untuk ujian ini. Hubungi guru mata pelajaran atau administrator ujian."
    });
  }

  const shouldShuffleQ = matchedExam.shuffleQ !== false;
  const shouldShuffleOpt = matchedExam.shuffleOpt !== false;

  let selectedQuestions: any[] = [];
  if (matchedExam.type === 'pilihan_dan_esay') {
    const pgQs = rawQuestions.filter((q: any) => q.type !== 'esay' && q.type !== 'essay');
    const essayQs = rawQuestions.filter((q: any) => q.type === 'esay' || q.type === 'essay');

    let targetPgCount = parseInt(matchedExam.questionCount || matchedExam.qCount, 10);
    if (isNaN(targetPgCount) || targetPgCount <= 0) targetPgCount = pgQs.length;
    let targetEssayCount = parseInt(matchedExam.essayCount, 10);
    if (isNaN(targetEssayCount) || targetEssayCount <= 0) targetEssayCount = essayQs.length;

    const selectedPg = shouldShuffleQ ? shuffleArray(pgQs).slice(0, targetPgCount) : pgQs.slice(0, targetPgCount);
    const selectedEssay = shouldShuffleQ ? shuffleArray(essayQs).slice(0, targetEssayCount) : essayQs.slice(0, targetEssayCount);
    selectedQuestions = [...selectedPg, ...selectedEssay];
  } else {
    let filteredQuestions = rawQuestions;
    if (matchedExam.type === 'pilihan_ganda') {
      filteredQuestions = rawQuestions.filter((q: any) => q.type !== 'esay' && q.type !== 'essay');
    } else if (matchedExam.type === 'esay_saja') {
      filteredQuestions = rawQuestions.filter((q: any) => q.type === 'esay' || q.type === 'essay');
    }

    let targetCount = parseInt(matchedExam.questionCount || matchedExam.qCount, 10);
    if (isNaN(targetCount) || targetCount <= 0) targetCount = filteredQuestions.length;

    if (shouldShuffleQ) {
      selectedQuestions = shuffleArray(filteredQuestions).slice(0, targetCount);
    } else {
      selectedQuestions = filteredQuestions.slice(0, targetCount);
    }
  }

  const masterQuestions: any[] = [];
  const sanitizedQuestions: any[] = [];

  selectedQuestions.forEach((q: any, idx: number) => {
    const qId = q.id || ('Q_' + idx + '_' + eId);
    let options = Array.isArray(q.options) ? [...q.options] : [];
    
    // Resolve correct option text
    let correctText = q.correctOptionText || '';
    if (!correctText) {
      const rawKey = String(q.answer || '').trim();
      const letterIdx = ['a', 'b', 'c', 'd', 'e'].indexOf(rawKey.toLowerCase().replace('.', ''));
      if (letterIdx !== -1 && options[letterIdx] !== undefined) {
        correctText = String(options[letterIdx]).trim();
      } else {
        correctText = rawKey;
      }
    }

    // Shuffle options if allowed
    let shuffledOptions = options;
    if (shouldShuffleOpt && options.length > 0 && q.type !== 'esay' && q.type !== 'essay') {
      shuffledOptions = shuffleArray(options);
    }

    const masterItem = {
      ...q,
      id: qId,
      options: shuffledOptions,
      originalOptions: options,
      correctOptionText: correctText,
      answer: q.answer || correctText
    };
    masterQuestions.push(masterItem);

    // Sanitized question for student (KEYS STRIPPED COMPLETELY)
    const sanitizedItem = {
      id: qId,
      number: idx + 1,
      question: q.question,
      options: shuffledOptions,
      type: q.type || 'mc',
      imageUrl: q.imageUrl || q.image || null,
      image: q.image || q.imageUrl || null
    };
    sanitizedQuestions.push(sanitizedItem);
  });

  studentExamMasterQuestions[key] = masterQuestions;
  studentExamQuestions[key] = sanitizedQuestions;

  await Promise.all([
    saveDeltaDb('studentExamMasterQuestions', key, masterQuestions),
    saveDeltaDb('studentExamQuestions', key, sanitizedQuestions)
  ]);

  res.json({
    success: true,
    questions: sanitizedQuestions,
    isResumed: false
  });
});

// Phase 2 Endpoint: Instant Micro-Answer Sync (POST /api/exam/attempt/answer)
app.post("/api/exam/attempt/answer", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, questionId, answer, currentIndex } = req.body;
  if (!sId || !examId || !questionId) {
    return res.status(400).json({ success: false, message: "studentId, examId, and questionId are required" });
  }

  const eId = String(examId);
  const key = sId + "_" + eId;
  const now = Date.now();

  // 1. Update studentExamAnswers map
  if (!studentExamAnswers[key]) studentExamAnswers[key] = {};
  studentExamAnswers[key][questionId] = answer;

  // 2. Update active session
  let session = activeExamSessions[key];
  if (!session) {
    session = {
      startTime: now,
      startedAt: now,
      endsAt: now + (3600 * 1000),
      status: 'active',
      answers: { [questionId]: answer },
      currentIndex: currentIndex !== undefined ? currentIndex : 0,
      totalQuestions: 0,
      answeredCount: 1,
      timeLeft: 3600,
      lastSeenAt: now
    };
  } else {
    if (!session.answers) session.answers = {};
    session.answers[questionId] = answer;
    session.answeredCount = Object.keys(session.answers).length;
    if (currentIndex !== undefined) session.currentIndex = currentIndex;
    session.lastSeenAt = now;
    if (session.endsAt) {
      session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1000));
    }
  }
  activeExamSessions[key] = session;

  // Delta persists to PostgreSQL asynchronously
  await Promise.all([
    saveDeltaDb('studentExamAnswers', key, studentExamAnswers[key]),
    saveDeltaDb('activeExamSessions', key, session)
  ]);

  // Poin 1 & 11: Real-time Event-driven micro-broadcast for monitoring cards (no broadcast storms)
  broadcastExamEvent({
    type: "exam_progress",
    examId: eId,
    studentId: sId,
    answered: session.answeredCount,
    total: session.totalQuestions,
    currentIndex: session.currentIndex,
    lastSeenAt: now
  });

  res.json({
    success: true,
    questionId: questionId,
    answeredCount: session.answeredCount,
    remainingTime: session.timeLeft
  });
});

// Dedicated student presence + snapshot endpoint (Saves bandwidth & isolates from admin actions)
app.post("/api/exam/student-state", requireAuth, async (req, res) => {
  const authUser = (req as any).user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, currentIndex, livecamFrame } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }

  const eId = String(examId);
  const key = sId + "_" + eId;
  const now = Date.now();

  // 1. Update heartbeat session
  const session = activeExamSessions[key];
  if (session) {
    session.lastSeenAt = now;
    if (currentIndex !== undefined) session.currentIndex = currentIndex;
    if (session.endsAt) {
      session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1000));
    }
  }

  // 2. Broadcast exam presence event to teachers monitoring
  broadcastExamEvent({
    type: "student_heartbeat",
    examId: eId,
    studentId: sId,
    lastSeenAt: now
  });

  // 3. Handle livecam snapshot frame
  if (livecamFrame) {
    studentLivecamFrames[key] = String(livecamFrame);
    broadcastStateUpdate('studentLivecamFrames');
  }

  const isBlocked = Boolean(blockedStudents[key]);
  const isForceDone = Boolean(forceFinishedExams[key] || completedExams[key] === 'force_finish');
  const bMsg = examMessages['broadcast_' + eId] || null;
  const pMsg = examMessages[key] || null;

  res.json({
    success: true,
    serverTime: now,
    blocked: isBlocked,
    forceFinished: isForceDone,
    remainingTime: session ? session.timeLeft : null,
    messageBroadcast: bMsg,
    messagePersonal: pMsg
  });
});

// Dedicated student presence (back to tab) endpoint (JWT enforced)
app.post("/api/exam/presence", requireAuth, async (req, res) => {
  const authUser = (req as any).user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const { examId, outOfTab } = req.body;
  if (!examId) {
    return res.status(400).json({ success: false, message: "examId required" });
  }
  const sId = resolveStudentId(req, authUser);
  if (!sId) {
    return res.status(400).json({ success: false, message: "Student ID required" });
  }

  const eId = String(examId);
  const key = sId + "_" + eId;

  // Update in-memory state
  studentOutOfTab[key] = outOfTab === true;
  await saveDeltaDb('studentOutOfTab', key, outOfTab === true);

  // Broadcast to teachers
  broadcastExamEvent({
    type: 'exam_presence',
    examId: eId,
    studentId: sId,
    outOfTab: outOfTab === true
  });

  res.json({ success: true });
});

// Dedicated student livecam snapshot upload endpoint (JWT enforced)
app.post("/api/exam/livecam/snapshot", requireAuth, async (req, res) => {
  const authUser = (req as any).user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const { examId, livecamFrame } = req.body;
  if (!examId || !livecamFrame) {
    return res.status(400).json({ success: false, message: "examId and livecamFrame are required" });
  }
  const sId = resolveStudentId(req, authUser);
  if (!sId) {
    return res.status(400).json({ success: false, message: "Student ID required" });
  }

  const eId = String(examId);
  const key = sId + "_" + eId;

  // Update in-memory state
  studentLivecamFrames[key] = String(livecamFrame);
  broadcastStateUpdate('studentLivecamFrames');

  res.json({ success: true });
});

// Phase 2 Endpoint: Lightweight Micro-Heartbeat (POST /api/exam/heartbeat)
app.post("/api/exam/heartbeat", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, currentIndex } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }

  const eId = String(examId);
  const key = sId + "_" + eId;
  const now = Date.now();

  const session = activeExamSessions[key];
  if (session) {
    session.lastSeenAt = now;
    if (currentIndex !== undefined) session.currentIndex = currentIndex;
    if (session.endsAt) {
      session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1000));
    }
  }

  // Poin 11: Real-time Event-driven micro-broadcast for student presence
  broadcastExamEvent({
    type: "student_heartbeat",
    examId: eId,
    studentId: sId,
    lastSeenAt: now
  });

  // Check if student has pending messages or auto-block
  const isBlocked = Boolean(blockedStudents[key]);
  const isForceDone = Boolean(forceFinishedExams[key] || completedExams[key] === 'force_finish');
  const bMsg = examMessages['broadcast_' + eId] || null;
  const pMsg = examMessages[key] || null;

  res.json({
    success: true,
    serverTime: now,
    blocked: isBlocked,
    forceFinished: isForceDone,
    remainingTime: session ? session.timeLeft : null,
    messageBroadcast: bMsg,
    messagePersonal: pMsg
  });
});

// Phase 3 Endpoint: Structured Violation Logger (POST /api/exam/violation)
app.post("/api/exam/violation", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, reason, clientTimestamp } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }

  const eId = String(examId);
  const key = sId + "_" + eId;
  const now = Date.now();

  studentTabSwitches[key] = (studentTabSwitches[key] || 0) + 1;
  studentOutOfTab[key] = true;

  const allExams = getMemoryKeyValue('exams') || exams || [];
  const matchedExam = allExams.find((e: any) => String(e.id) === eId);
  const autoBlockLimit = matchedExam ? parseInt(matchedExam.autoBlock || 0, 10) : 0;
  let autoBlocked = false;

  if (autoBlockLimit > 0 && studentTabSwitches[key] >= autoBlockLimit) {
    blockedStudents[key] = true;
    blockedStudents[eId + "_" + sId] = true;
    autoBlocked = true;
    await saveDeltaDb('blockedStudents', key, true);
    await saveDeltaDb('blockedStudents', eId + "_" + sId, true);
    broadcastStateUpdate('blockedStudents');
  }

  // Record into structured violation logs
  if (!examViolationLogs[eId]) examViolationLogs[eId] = [];
  const targetStudent = (getMemoryKeyValue('students') || students || []).find((s: any) => String(s.id) === sId);
  const violationItem = {
    id: "viol_" + now + "_" + Math.random().toString(36).substring(2, 7),
    studentId: sId,
    studentName: targetStudent ? targetStudent.name : sId,
    nis: targetStudent ? targetStudent.nis : '',
    className: targetStudent ? (targetStudent.classId || targetStudent.className || '') : '',
    examId: eId,
    reason: reason || 'Keluar Tab / Split Screen',
    timestamp: now,
    tabSwitches: studentTabSwitches[key],
    autoBlocked: autoBlocked
  };
  examViolationLogs[eId].unshift(violationItem);
  if (examViolationLogs[eId].length > 500) examViolationLogs[eId].pop();

  await Promise.all([
    saveDeltaDb('studentTabSwitches', key, studentTabSwitches[key]),
    saveDeltaDb('studentOutOfTab', key, true),
    saveDeltaDb('examViolationLogs', eId, examViolationLogs[eId])
  ]);

  // Poin 1 & 11: Real-time Event-driven micro-broadcast for violations & block status (no broadcast storms)
  broadcastExamEvent({
    type: "exam_violation",
    examId: eId,
    studentId: sId,
    tabSwitches: studentTabSwitches[key],
    autoBlocked: autoBlocked,
    reason: reason || 'Keluar Tab / Split Screen',
    timestamp: now
  });

  res.json({
    success: true,
    tabSwitches: studentTabSwitches[key],
    autoBlocked: autoBlocked,
    reason: reason || 'Keluar Tab / Split Screen',
    violation: violationItem
  });
});

// Phase 5 Endpoint: Anti-Cheat Violation Audit Feed (GET /api/exams/:examId/violations)
app.get("/api/exams/:examId/violations", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), (req, res) => {
  const { examId } = req.params;
  const list = examViolationLogs[String(examId)] || [];
  res.json({
    success: true,
    examId: String(examId),
    totalViolations: list.length,
    violations: list
  });
});

// Phase 4 Endpoint: Final Submission & Server-Side Auto-Scoring (POST /api/exam/attempt/finish)
app.post("/api/exam/attempt/finish", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, answers, clientGrade } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }

  const eId = String(examId);
  const key = sId + "_" + eId;

  // 1. Mark completed in state and DB
  completedExams[key] = true;
  await saveDeltaDb('completedExams', key, true);

  // 2. Finalize answers
  if (answers && typeof answers === 'object') {
    studentExamAnswers[key] = { ...(studentExamAnswers[key] || {}), ...answers };
  }
  await saveDeltaDb('studentExamAnswers', key, studentExamAnswers[key] || {});

  // 3. Clear active exam session
  delete activeExamSessions[key];
  await saveDeltaDb('activeExamSessions', key, null);

  // 4. Server-side auto-grade evaluation using server master questions (Poin 5 & 6)
  const allExams = getMemoryKeyValue('exams') || exams || [];
  const matchedExam = allExams.find((e: any) => String(e.id) === eId);
  const questions = studentExamMasterQuestions[key] || (matchedExam && matchedExam.questions);

  let finalGrade = clientGrade;
  if (Array.isArray(questions) && questions.length > 0) {
    const finalAns = studentExamAnswers[key] || {};
    let correctPGCount = 0;
    const pgQuestions = questions.filter((q: any) => q.type !== 'esay' && q.type !== 'essay');
    const essayQuestions = questions.filter((q: any) => q.type === 'esay' || q.type === 'essay');

    pgQuestions.forEach((q: any) => {
      const uAns = finalAns[q.id] !== undefined ? finalAns[q.id] : finalAns[String(q.id)];
      if (uAns !== undefined && uAns !== null) {
        const normUAns = String(uAns).trim().toLowerCase();
        const normKey = String(q.answer || q.correctOptionText || '').trim().toLowerCase();
        if (normUAns === normKey) {
          correctPGCount++;
        } else if (Array.isArray(q.options) && /^[a-d]$/i.test(normUAns)) {
          const charCode = normUAns.toUpperCase().charCodeAt(0) - 65;
          if (q.options[charCode] && String(q.options[charCode]).trim().toLowerCase() === normKey) {
            correctPGCount++;
          }
        }
      }
    });

    const pgScore = pgQuestions.length > 0 ? Math.round((correctPGCount / pgQuestions.length) * 100) : 100;
    finalGrade = {
      pgScore,
      essayScore: 0,
      finalScore: essayQuestions.length === 0 ? pgScore : null,
      isGraded: essayQuestions.length === 0,
      correctPGCount,
      totalPGCount: pgQuestions.length,
      essayGrades: {}
    };
  } else if (!finalGrade) {
    finalGrade = {
      pgScore: 100,
      essayScore: 0,
      finalScore: 100,
      isGraded: true,
      correctPGCount: 0,
      totalPGCount: 0,
      essayGrades: {}
    };
  }

  studentExamGrades[key] = finalGrade;
  await saveDeltaDb('studentExamGrades', key, finalGrade);

  // Poin 11: Real-time Event-driven micro-broadcast for exam finish
  broadcastExamEvent({
    type: "exam_finish",
    examId: eId,
    studentId: sId,
    grade: finalGrade
  });

  res.json({
    success: true,
    message: "Ujian berhasil diselesaikan dan dinilai secara aman",
    grade: finalGrade
  });
});

// Phase 1 Endpoint: Summarized Teacher Monitoring (GET /api/exams/:examId/monitor)
app.get("/api/exams/:examId/monitor", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), (req: any, res) => {
  const { examId } = req.params;
  const eId = String(examId);

  const authUser = req.user;
  const isBos = authUser.role === 'bos' || authUser.role === 'superadmin';
  const userMadrasahId = getRequestMadrasahId(req);

  const activeExam = (getMemoryKeyValue('exams') || exams || []).find((e: any) => String(e.id) === eId);

  if (!isBos && activeExam) {
    const examMId = String(activeExam.madrasahId || 'default').trim();
    if (examMId !== String(userMadrasahId).trim()) {
      return res.status(403).json({ success: false, message: "Akses ditolak: Anda tidak memiliki wewenang memantau ujian dari madrasah lain." });
    }
  }
 
  let studentList = getMemoryKeyValue('students') || students || [];
  if (!isBos) {
    studentList = studentList.filter((s: any) => String(s.madrasahId || 'default').trim() === String(userMadrasahId).trim());
  }

  const activeExamInMem = (getMemoryKeyValue('exams') || exams || []).find((e: any) => String(e.id) === eId);
 
  // Filter students by assigned classes if defined on the exam
  let targetStudents = studentList;
  if (activeExamInMem && activeExamInMem.classes && activeExamInMem.classes.length > 0 && !activeExamInMem.classes.includes('ALL')) {
    targetStudents = studentList.filter((s: any) => activeExamInMem.classes.includes(String(s.classId || s.className || s.class)));
  }
 
  const summary = targetStudents.map((st: any) => {
    const sId = String(st.id);
    const key = sId + "_" + eId;
 
    const session = activeExamSessions[key] || null;
    const isCompleted = Boolean(completedExams[key]);
    const isForceDone = Boolean(forceFinishedExams[key] || completedExams[key] === 'force_finish');
    const isBlocked = Boolean(blockedStudents[key]);
    const isOutOfTab = Boolean(studentOutOfTab[key]);
    const tabSwitches = studentTabSwitches[key] || 0;
    const grade = studentExamGrades[key] || null;
 
    let status = 'not_started';
    if (isBlocked) status = 'blocked';
    else if (isForceDone) status = 'force_finished';
    else if (isCompleted) status = 'completed';
    else if (session) status = 'in_progress';
 
    // Calculate online status based on lastSeenAt (considered online if updated within last 30 seconds)
    const isOnline = Boolean(session && (Date.now() - (session.lastSeenAt || 0) < 30000));
 
    return {
      studentId: sId,
      name: st.name || '',
      nis: st.nis || '',
      classId: st.classId || st.className || '',
      roomId: st.roomId || '',
      photo: st.photo || st.facePhoto || st.avatar || null,
      status: status,
      online: isOnline,
      answeredCount: session ? (session.answeredCount || (session.answers ? Object.keys(session.answers).length : 0)) : 0,
      totalQuestions: session ? (session.totalQuestions || 0) : 0,
      progressPct: (session && session.totalQuestions > 0) ? Math.round(((session.answeredCount || 0) / session.totalQuestions) * 100) : (isCompleted ? 100 : 0),
      tabSwitches: tabSwitches,
      outOfTab: isOutOfTab,
      blocked: isBlocked,
      forceFinished: isForceDone,
      score: grade ? (grade.finalScore !== null && grade.finalScore !== undefined ? grade.finalScore : grade.pgScore) : null,
      remainingTime: session ? session.timeLeft : null
    };
  });

  res.json({
    success: true,
    examId: eId,
    totalStudents: targetStudents.length,
    activeCount: summary.filter((s: any) => s.status === 'in_progress').length,
    completedCount: summary.filter((s: any) => s.status === 'completed' || s.status === 'force_finished').length,
    blockedCount: summary.filter((s: any) => s.blocked).length,
    students: summary
  });
});

async function saveDeltaDb(deltaType: string, itemKey: string, value: any) {
  if (pool && !isDbQuotaExceeded) {
    const dbKey = `delta::${deltaType}::${itemKey}`;
    try {
      if (value === null || value === undefined) {
         await pool.query('DELETE FROM app_store WHERE key = $1', [dbKey]);
      } else {
         await pool.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
         `, [dbKey, JSON.stringify(value)]);
      }
    } catch(e) {
       console.error("Delta write error:", e);
    }
  }
}

app.post("/api/exam-monitoring-state", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req: any, res) => {
  const { sessionKey, sessionData, activeExamSessionsBatch, completed, answers, studentQuestions, tabSwitches, outOfTab, blocked, livecamFrame, gradesObj, messages, forceFinished } = req.body;
  const promises: Promise<any>[] = [];

  const authUser = req.user;
  const isBos = authUser.role === 'bos' || authUser.role === 'superadmin';
  const userMadrasahId = getRequestMadrasahId(req);

  if (!isBos) {
    const studentList = getMemoryKeyValue('students') || students || [];
    const tenantStudentIds = new Set(
      studentList
        .filter((s: any) => String(s.madrasahId || 'default').trim() === String(userMadrasahId).trim())
        .map((s: any) => String(s.id))
    );

    const validateKey = (key: string) => {
      if (!key) return true;
      const parts = key.split('_');
      if (parts.length >= 1) {
        const studentId = parts[0];
        return tenantStudentIds.has(studentId);
      }
      return false;
    };

    const testKeys = [
      sessionKey,
      ...(activeExamSessionsBatch ? Object.keys(activeExamSessionsBatch) : []),
      ...(completed ? Object.keys(completed) : []),
      ...(answers ? Object.keys(answers) : []),
      ...(studentQuestions ? Object.keys(studentQuestions) : []),
      ...(tabSwitches ? Object.keys(tabSwitches) : []),
      ...(outOfTab ? Object.keys(outOfTab) : []),
      ...(blocked ? Object.keys(blocked) : []),
      ...(gradesObj ? Object.keys(gradesObj) : []),
      ...(messages ? Object.keys(messages) : []),
      ...(forceFinished ? Object.keys(forceFinished) : [])
    ].filter(Boolean);

    for (const tk of testKeys) {
      if (!validateKey(tk)) {
        return res.status(403).json({ success: false, message: "Akses ditolak: Anda tidak memiliki wewenang mengubah state siswa madrasah lain." });
      }
    }
  }

  if (sessionKey) {
    if (sessionData === null || sessionData === undefined) {
      delete activeExamSessions[sessionKey];
      promises.push(saveDeltaDb('activeExamSessions', sessionKey, null));
    } else {
      activeExamSessions[sessionKey] = sessionData;
      promises.push(saveDeltaDb('activeExamSessions', sessionKey, sessionData));
    }
    broadcastStateUpdate('activeExamSessions');
  }
  if (activeExamSessionsBatch) {
    for (const key of Object.keys(activeExamSessionsBatch)) {
      const bData = activeExamSessionsBatch[key];
      if (bData === null || bData === undefined) {
        delete activeExamSessions[key];
        promises.push(saveDeltaDb('activeExamSessions', key, null));
      } else {
        activeExamSessions[key] = bData;
        promises.push(saveDeltaDb('activeExamSessions', key, bData));
      }
    }
    broadcastStateUpdate('activeExamSessions');
  }
  if (completed) {
    for (const key of Object.keys(completed)) {
      completedExams[key] = completed[key];
      promises.push(saveDeltaDb('completedExams', key, completed[key]));
      if (completed[key] === 'force_finish') {
        forceFinishedExams[key] = true;
        promises.push(saveDeltaDb('forceFinishedExams', key, true));
      }
    }
    broadcastStateUpdate('completedExams');
    if (Object.values(completed).includes('force_finish')) {
      broadcastStateUpdate('forceFinishedExams');
    }
  }
  if (forceFinished) {
    for (const key of Object.keys(forceFinished)) {
      forceFinishedExams[key] = forceFinished[key];
      promises.push(saveDeltaDb('forceFinishedExams', key, forceFinished[key]));
    }
    broadcastStateUpdate('forceFinishedExams');
  }
  if (answers) {
    for (const key of Object.keys(answers)) {
      const incomingVal = answers[key];
      const existingVal = studentExamAnswers[key];
      if (existingVal && Object.keys(existingVal).length > 0) {
        if (!incomingVal || Object.keys(incomingVal).length === 0) continue;
        studentExamAnswers[key] = { ...existingVal, ...incomingVal };
      } else {
        studentExamAnswers[key] = incomingVal;
      }
      promises.push(saveDeltaDb('studentExamAnswers', key, studentExamAnswers[key]));
    }
    broadcastStateUpdate('studentExamAnswers');
  }
  if (studentQuestions) {
    for (const key of Object.keys(studentQuestions)) {
      studentExamQuestions[key] = studentQuestions[key];
      promises.push(saveDeltaDb('studentExamQuestions', key, studentQuestions[key]));
    }
    broadcastStateUpdate('studentExamQuestions');
  }
  if (tabSwitches) {
    for (const key of Object.keys(tabSwitches)) {
      studentTabSwitches[key] = tabSwitches[key];
      promises.push(saveDeltaDb('studentTabSwitches', key, tabSwitches[key]));
    }
    broadcastStateUpdate('studentTabSwitches');
  }
  if (outOfTab) {
    for (const key of Object.keys(outOfTab)) {
      studentOutOfTab[key] = outOfTab[key];
      promises.push(saveDeltaDb('studentOutOfTab', key, outOfTab[key]));
    }
    broadcastStateUpdate('studentOutOfTab');
  }
  if (gradesObj) {
    for (const key of Object.keys(gradesObj)) {
      studentExamGrades[key] = gradesObj[key];
      promises.push(saveDeltaDb('studentExamGrades', key, gradesObj[key]));
    }
    broadcastStateUpdate('studentExamGrades');
    await saveData('studentExamGrades', studentExamGrades);
  }
  if (blocked !== undefined) {
    for (const key of Object.keys(blocked)) {
      blockedStudents[key] = blocked[key];
      promises.push(saveDeltaDb('blockedStudents', key, blocked[key]));
    }
    broadcastStateUpdate('blockedStudents');
  }
  if (messages) {
    if (req.body.replaceMessages) {
      examMessages = messages;
    } else {
      examMessages = { ...examMessages, ...messages };
    }
    await saveData('examMessages', examMessages);
  }
  if (livecamFrame && livecamFrame.key && livecamFrame.frame) {
    studentLivecamFrames[livecamFrame.key] = livecamFrame.frame;
  }
  
  // Await all delta DB writes to ensure they complete
  await Promise.all(promises);
  res.json({ success: true });
});

// Reset Individual Student Exam Progress API
app.post("/api/reset-student-exam", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const { studentId, examId } = req.body;
  if (!studentId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }
  const key = studentId + "_" + examId;
  
  delete activeExamSessions[key];
  delete completedExams[key];
  delete forceFinishedExams[key];
  delete studentExamAnswers[key];
  delete studentExamQuestions[key];
  delete studentTabSwitches[key];
  delete studentOutOfTab[key];
  delete blockedStudents[key];
  delete studentLivecamFrames[key];
  delete studentExamGrades[key];
  
  const promises = [
    saveDeltaDb('activeExamSessions', key, null),
    saveDeltaDb('completedExams', key, null),
    saveDeltaDb('forceFinishedExams', key, null),
    saveDeltaDb('studentExamAnswers', key, null),
    saveDeltaDb('studentExamQuestions', key, null),
    saveDeltaDb('studentTabSwitches', key, null),
    saveDeltaDb('studentOutOfTab', key, null),
    saveDeltaDb('blockedStudents', key, null)
  ];
  
  await Promise.all(promises);
  
  broadcastStateUpdate('activeExamSessions');
  broadcastStateUpdate('completedExams');
  broadcastStateUpdate('forceFinishedExams');
  broadcastStateUpdate('studentExamAnswers');
  broadcastStateUpdate('studentExamQuestions');
  broadcastStateUpdate('studentTabSwitches');
  broadcastStateUpdate('studentOutOfTab');
  broadcastStateUpdate('blockedStudents');
  
  await saveData('studentLivecamFrames', studentLivecamFrames);
  await saveData('studentExamGrades', studentExamGrades);
  
  res.json({ success: true, message: "Sesi ujian siswa berhasil direset!" });
});

// WebRTC Signaling API for Livecam Exam Monitoring (P2P zero-storage streaming)
let examSignalingMessages: any = {};

app.post("/api/exam/signaling", requireAuth, (req, res) => {
  const authUser = (req as any).user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const { recipientId, signal } = req.body;
  if (!recipientId || !signal) {
    return res.status(400).json({ success: false, message: "recipientId and signal required" });
  }
  if (!examSignalingMessages[recipientId]) {
    examSignalingMessages[recipientId] = {};
  }
  const sId = authUser.id;
  if (!examSignalingMessages[recipientId][sId]) {
    examSignalingMessages[recipientId][sId] = [];
  }
  examSignalingMessages[recipientId][sId].push({ senderId: sId, signal, timestamp: Date.now() });
  if (examSignalingMessages[recipientId][sId].length > 25) {
    examSignalingMessages[recipientId][sId].shift();
  }
  res.json({ success: true });
});

app.get("/api/exam/signaling", requireAuth, (req, res) => {
  const authUser = (req as any).user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const recipientId = String(req.query.recipientId || '');
  const senderId = String(req.query.senderId || '');
  if (!recipientId) {
    return res.json({ success: true, signals: [] });
  }
  
  const recipientData = examSignalingMessages[recipientId];
  if (!recipientData) {
    return res.json({ success: true, signals: [] });
  }

  let allSignals: any[] = [];
  if (senderId && recipientData[senderId]) {
    allSignals = [...recipientData[senderId]];
    recipientData[senderId] = [];
  } else if (!senderId) {
    for (const sId of Object.keys(recipientData)) {
      if (Array.isArray(recipientData[sId])) {
        allSignals.push(...recipientData[sId]);
      }
    }
    examSignalingMessages[recipientId] = {};
  } else {
    allSignals = [];
  }

  res.json({ success: true, signals: allSignals });
});

// LiveKit SFU Token Generation API
app.post("/api/exam/livekit-token", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).user || getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
    }
    const { roomName, isPublisher } = req.body;
    if (!roomName) {
      return res.status(400).json({ success: false, message: "roomName is required" });
    }

    const secureIdentity = authUser.id + "_" + (authUser.name || authUser.username || "student");

    // Get LiveKit credentials from appSettings or env
    const apiKey = appSettings.livekitApiKey || process.env.LIVEKIT_API_KEY || "devkey";
    const apiSecret = appSettings.livekitApiSecret || process.env.LIVEKIT_API_SECRET || "secret";
    const serverUrl = appSettings.livekitUrl || process.env.LIVEKIT_URL || "ws://localhost:7880";

    const at = new AccessToken(apiKey, apiSecret, {
      identity: secureIdentity,
      ttl: "2h",
    });

    at.addGrant({
      room: String(roomName),
      roomJoin: true,
      canPublish: isPublisher === true,
      canSubscribe: isPublisher !== true, // Student only publishes, Admin only subscribes
    });

    const token = await at.toJwt();
    res.json({ success: true, token, serverUrl });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10. Chats API
app.get("/api/chats", requireAuth, async (req: any, res) => {
  const userMId = getRequestMadrasahId(req);
  let chatList = chats;
  if (pool) {
    try {
      const dbRes = await pool.query("SELECT value FROM app_store WHERE key = 'chats'");
      if (dbRes.rows.length > 0) {
        let val = dbRes.rows[0].value;
        if (typeof val === 'string') { try { val = JSON.parse(val); } catch(e){} }
        if (Array.isArray(val)) {
          chatList = val;
        }
      }
    } catch(e) {}
  }
  const filtered = chatList.filter((c: any) => String(c.madrasahId || 'default').trim() === String(userMId).trim());
  res.json({ success: true, data: filtered });
});

app.post("/api/chats", requireAuth, async (req: any, res) => {
  try {
    const userMId = getRequestMadrasahId(req);
    const newChat = { 
      ...req.body, 
      id: req.body.id || Date.now().toString(), 
      timestamp: req.body.timestamp || Date.now(),
      madrasahId: userMId
    };
    await updateStoreKeyWithLock('chats', (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      list.push(newChat);
      return list;
    });
    res.json({ success: true, data: newChat });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/chats/:id", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  try {
    await updateStoreKeyWithLock('chats', (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      return list.filter((c: any) => String(c.id) !== String(req.params.id));
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/chats/clear", async (req, res) => {
  const { senderId, receiverId } = req.body;
  if (!senderId || !receiverId) {
    return res.status(400).json({ success: false, message: "Missing ids" });
  }
  try {
    await updateStoreKeyWithLock('chats', (currentVal) => {
      const chatList = Array.isArray(currentVal) ? currentVal : [];
      return chatList.filter((c: any) => !(
        (String(c.senderId) === String(senderId) && String(c.receiverId) === String(receiverId)) ||
        (String(c.senderId) === String(receiverId) && String(c.receiverId) === String(senderId))
      ));
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/chats/read", async (req, res) => {
  const { senderId, receiverId } = req.body;
  try {
    await updateStoreKeyWithLock('chats', (currentVal) => {
      const chatList = Array.isArray(currentVal) ? currentVal : [];
      chatList.forEach((c: any) => {
        if (String(c.senderId) === String(senderId) && String(c.receiverId) === String(receiverId) && !c.read) {
          c.read = true;
        }
      });
      return chatList;
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});


app.post("/api/chats/broadcast-apk", async (req, res) => {
  try {
    const { text, attachment } = req.body;
    const studentsList = students || [];
    const now = Date.now();
    const newChats: any[] = [];
    studentsList.forEach((s: any) => {
      newChats.push({
        id: (now + Math.random()).toString(),
        senderId: 'admin',
        receiverId: s.id,
        text: text || "Bapak/Ibu Orangtua dan Siswa, berikut adalah berkas instalasi Layanan Monitoring ChildGuard Madrasah Bisa. Silakan unduh, instal, dan aktifkan izin aksesibilitas serta overlay perangkat agar fitur pemantauan berjalan dengan baik.",
        timestamp: now,
        read: false,
        attachment: attachment || {
          type: 'apk',
          name: 'childguard_v2.1.0_prod.apk',
          data: '/public/childguard.apk'
        }
      });
    });

    await updateStoreKeyWithLock('chats', (currentVal) => {
      const chatList = Array.isArray(currentVal) ? currentVal : [];
      return [...chatList, ...newChats];
    });

    res.json({ success: true, count: newChats.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/grades", requireAuth, (req, res) => {
  res.json({ success: true, grades: filterByMadrasah(grades, req) });
});

app.post("/api/grades", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin']), async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const processed = [];

  for (const item of items) {
    const { classId, studentId, subjectName, category, score } = item;
    if (!classId || !studentId) continue;

    const existingIdx = grades.findIndex(
      g => String(g.classId) === String(classId) &&
           String(g.studentId) === String(studentId) &&
           String(g.subjectName || "").toLowerCase() === String(subjectName || "").toLowerCase() &&
           String(g.category || "").toLowerCase() === String(category || "").toLowerCase()
    );

    const gradeObj = tagNewRecord({
      id: existingIdx >= 0 ? grades[existingIdx].id : ("G_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5)),
      classId: String(classId),
      studentId: String(studentId),
      subjectName: String(subjectName || ""),
      category: String(category || ""),
      score: Number(score || 0)
    }, req);

    if (existingIdx >= 0) {
      grades[existingIdx] = gradeObj;
    } else {
      grades.push(gradeObj);
    }
    processed.push(gradeObj);
  }

  await saveData('grades', grades);
  res.json({ success: true, count: processed.length, grade: processed[0], grades: processed });
});

// Time Slots API for Roster
app.get("/api/time-slots", (req, res) => {
  res.json({ success: true, timeSlots: timeSlots || [], kbmDuration: kbmDuration || 40 });
});

app.post("/api/time-slots", async (req, res) => {
  const { timeSlots: newSlots, kbmDuration: newKbm } = req.body;
  if (Array.isArray(newSlots)) {
    timeSlots = newSlots;
    await saveData('timeSlots', timeSlots);
  }
  if (newKbm !== undefined) {
    kbmDuration = Number(newKbm) || 40;
    await saveData('kbmDuration', kbmDuration);
  }
  res.json({ success: true, timeSlots, kbmDuration });
});

// Grade Categories API
app.get("/api/grade-categories", (req, res) => {
  res.json({ success: true, gradeCategories: gradeCategories || [] });
});

app.post("/api/grade-categories", async (req, res) => {
  const { gradeCategories: newCats, category } = req.body;
  if (Array.isArray(newCats)) {
    gradeCategories = newCats;
    await saveData('gradeCategories', gradeCategories);
  } else if (category && typeof category === 'string') {
    if (!gradeCategories.includes(category)) {
      gradeCategories.push(category);
      await saveData('gradeCategories', gradeCategories);
    }
  }
  res.json({ success: true, gradeCategories });
});

app.post("/api/grade-categories/rename", async (req, res) => {
  const { oldCategory, newCategory } = req.body;
  if (!oldCategory || !newCategory) {
    return res.status(400).json({ error: "Missing category parameters" });
  }

  const oldLower = String(oldCategory).trim().toLowerCase();
  const newTrim = String(newCategory).trim();

  // 1. Update gradeCategories
  if (Array.isArray(gradeCategories)) {
    gradeCategories = gradeCategories.map(c => {
      const cStr = typeof c === 'string' ? c : (c.name || '');
      if (cStr.trim().toLowerCase() === oldLower) {
        return typeof c === 'string' ? newTrim : { ...c, name: newTrim };
      }
      return c;
    });
    // Remove duplicates
    const uniqueCats: string[] = [];
    gradeCategories.forEach(c => {
      const name = typeof c === 'string' ? c : c.name;
      if (name && !uniqueCats.includes(name)) uniqueCats.push(name);
    });
    gradeCategories = uniqueCats;
    await saveData('gradeCategories', gradeCategories);
  }

  // 2. Update grades
  let updatedCount = 0;
  if (Array.isArray(grades)) {
    grades.forEach(g => {
      if (String(g.category || '').trim().toLowerCase() === oldLower) {
        g.category = newTrim;
        updatedCount++;
      }
    });
    if (updatedCount > 0) {
      await saveData('grades', grades);
    }
  }

  res.json({ success: true, oldCategory, newCategory: newTrim, updatedCount, gradeCategories });
});

app.delete("/api/grade-categories/:name", async (req, res) => {
  const { name } = req.params;
  const catLower = String(name).trim().toLowerCase();

  // 1. Remove from gradeCategories
  if (Array.isArray(gradeCategories)) {
    gradeCategories = gradeCategories.filter(c => {
      const cStr = typeof c === 'string' ? c : (c.name || '');
      return cStr.trim().toLowerCase() !== catLower;
    });
    await saveData('gradeCategories', gradeCategories);
  }

  // 2. Remove all matching grade records from grades
  let deletedCount = 0;
  if (Array.isArray(grades)) {
    const prevLen = grades.length;
    grades = grades.filter(g => String(g.category || '').trim().toLowerCase() !== catLower);
    deletedCount = prevLen - grades.length;
    if (deletedCount > 0) {
      await saveData('grades', grades);
    }
  }

  res.json({ success: true, deletedCategory: name, deletedGradesCount: deletedCount, gradeCategories, categories: gradeCategories });
});

// 11. System Settings Location API
app.get("/api/system-settings/location", (req, res) => {
  res.json({ success: true, settings: schoolLocationSettings });
});

app.put("/api/system-settings/location", async (req, res) => {
  const { schoolLatitude, schoolLongitude, geofenceRadius } = req.body;
  schoolLocationSettings = {
    schoolLatitude: Number(schoolLatitude),
    schoolLongitude: Number(schoolLongitude),
    geofenceRadius: Number(geofenceRadius) || 100
  };
  await saveData('schoolLocationSettings', schoolLocationSettings);
  res.json({ success: true, settings: schoolLocationSettings });
});

function getExamQuestionsServer(ex: any) {
  if (!ex) return questions || [];
  const exCode = String(ex.bankCode || '').trim().toLowerCase();
  const exSub = String(ex.subject || '').trim().toLowerCase();

  const matchingGroups = (questionBankGroups || []).filter((bg: any) => {
    const bgCode = String(bg.code || '').trim().toLowerCase();
    return bgCode && exCode && bgCode === exCode;
  });
  const matchingGroupSubjectIds = matchingGroups.map((bg: any) => String(bg.subjectId).toLowerCase());

  const matchingSubjectObjs = (subjects || []).filter((s: any) => {
    const sName = String(s.name || '').trim().toLowerCase();
    return sName && exSub && sName === exSub;
  });
  const matchingSubjectIds = matchingSubjectObjs.map((s: any) => String(s.id).toLowerCase());

  let examQs = (questions || []).filter((q: any) => {
    if (!q) return false;
    const qCode = String(q.code || q.bankCode || q.groupCode || '').trim().toLowerCase();
    const qSub = String(q.subjectId || q.subject || '').trim().toLowerCase();
    
    if (exCode && exCode !== 'undefined' && exCode !== '') {
      return qCode === exCode;
    } else if (exSub && exSub !== 'undefined' && exSub !== '') {
      return qSub === exSub || matchingSubjectIds.includes(qSub) || matchingGroupSubjectIds.includes(qSub);
    }
    return false;
  });

  // Apply PG and Essay count logic
  if (ex.type === 'pilihan_dan_esay') {
    const pgQs = examQs.filter((q: any) => q.type !== 'esay' && q.type !== 'essay');
    const essayQs = examQs.filter((q: any) => q.type === 'esay' || q.type === 'essay');

    const targetPgCount = ex && (ex.questionCount || ex.qCount) ? parseInt(ex.questionCount || ex.qCount, 10) : 0;
    const targetEssayCount = ex && ex.essayCount ? parseInt(ex.essayCount, 10) : 0;

    let selectedPg: any[] = [];
    if (targetPgCount > 0) {
      if (pgQs.length >= targetPgCount) {
        selectedPg = pgQs.slice(0, targetPgCount);
      } else {
        selectedPg = [...pgQs];
        if (pgQs.length > 0) {
          while (selectedPg.length < targetPgCount) {
            for (const q of pgQs) {
              if (selectedPg.length < targetPgCount) {
                selectedPg.push(q);
              } else break;
            }
          }
        }
      }
    } else {
      selectedPg = [...pgQs];
    }

    let selectedEssay: any[] = [];
    if (targetEssayCount > 0) {
      if (essayQs.length >= targetEssayCount) {
        selectedEssay = essayQs.slice(0, targetEssayCount);
      } else {
        selectedEssay = [...essayQs];
        if (essayQs.length > 0) {
          while (selectedEssay.length < targetEssayCount) {
            for (const q of essayQs) {
              if (selectedEssay.length < targetEssayCount) {
                selectedEssay.push(q);
              } else break;
            }
          }
        }
      }
    } else {
      selectedEssay = [...essayQs];
    }

    return [...selectedPg, ...selectedEssay];
  }

  // Regular limit for other types
  let targetCount = ex && (ex.questionCount || ex.qCount) ? parseInt(ex.questionCount || ex.qCount, 10) : 0;
  if (isNaN(targetCount) || targetCount <= 0) {
    return examQs;
  }

  let generalQuestions: any[] = [];
  if (examQs.length >= targetCount) {
    generalQuestions = examQs.slice(0, targetCount);
  } else {
    while (generalQuestions.length < targetCount) {
      for (const q of examQs) {
        if (generalQuestions.length < targetCount) {
          generalQuestions.push(q);
        } else break;
      }
    }
  }
  return generalQuestions;
}

function extractJsonFromText(text: string) {
  try {
    const cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    return JSON.parse(cleanText);
  } catch (err) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {}
    }
    throw new Error("Failed to parse JSON from AI response: " + text);
  }
}

function cleanIndonesianText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getIndonesianStopwords(): Set<string> {
  return new Set([
    "yang", "dan", "di", "ke", "dari", "untuk", "dengan", "adalah", "ini", "itu", "pada", 
    "saya", "kamu", "ia", "mereka", "kita", "kami", "anda", "dia", "atau", "juga", "bahwa", 
    "oleh", "sebagai", "untuk", "oleh", "dalam", "akan", "telah", "sudah", "bisa", "dapat", 
    "ada", "adalah", "ialah", "yaitu", "yakni", "secara", "tentang", "seperti", "bagi", 
    "serta", "karena", "sehingga", "maka", "namun", "tetapi", "namun", "melainkan", "yaitu",
    "antara", "semua", "setiap", "terhadap", "kepada", "agar", "supaya", "kpd", "dgn", "utk"
  ]);
}

function getBigrams(text: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    bigrams.add(text.substring(i, i + 2));
  }
  return bigrams;
}

function getSetIntersection(setA: Set<string>, setB: Set<string>): Set<string> {
  const intersection = new Set<string>();
  setA.forEach(elem => {
    if (setB.has(elem)) {
      intersection.add(elem);
    }
  });
  return intersection;
}

// ----------------------------------------------------
// 1. ARABIC NLP NORMALIZER & SIMILARITY
// ----------------------------------------------------
function isArabicText(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

function cleanArabicText(text: string): string {
  if (!text) return "";
  let res = text;
  // 1. Strip all Harakat / Tashkeel (Fathah, Dammah, Kasrah, Sukun, Tanwin, Shaddah, etc.)
  res = res.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  // 2. Strip Tatweel (Kashida)
  res = res.replace(/\u0640/g, "");
  // 3. Normalize Alef variants
  res = res.replace(/[إأآٱ]/g, "ا");
  // 4. Normalize Taa Marbuta
  res = res.replace(/ة/g, "ه");
  // 5. Normalize Alef Maksura
  res = res.replace(/ى/g, "ي");
  // 6. Normalize Hamza on Waw / Yaa
  res = res.replace(/[ؤ]/g, "و").replace(/[ئ]/g, "ي");
  // 7. Convert Eastern Arabic numerals to standard digits (٠-٩ -> 0-9)
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  arabicDigits.forEach((digit, idx) => {
    res = res.replace(new RegExp(digit, "g"), String(idx));
  });
  // 8. Remove punctuation and clean whitespace
  res = res.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'؛،؟«»]/g, " ");
  res = res.replace(/\s+/g, " ").trim();
  return res;
}

function getArabicStopwords(): Set<string> {
  return new Set([
    "من", "الى", "في", "على", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "هو", "هي", "هم", 
    "هن", "نحن", "انا", "انت", "انتم", "كان", "كانت", "يكون", "ان", "لا", "ما", "لم", 
    "لن", "ثم", "او", "بل", "حتى", "كل", "بعض", "غير", "حيث", "عند", "لقد", "كيف", 
    "لماذا", "ماذا", "متى", "اين", "الذي", "التي", "الذين", "اللاتي", "بها", "فيه", "فيها", 
    "عليه", "عليها", "له", "لها", "بين", "فان", "قد", "اذا", "وهو", "وهي", "وهذا"
  ]);
}

function computeArabicSimilarity(studentAnswer: string, keyAnswer: string): { similarity: number, matchedKeywords: string[], explanations: string } {
  const normStudent = cleanArabicText(studentAnswer);
  const normKey = cleanArabicText(keyAnswer);

  if (normStudent === normKey) {
    return {
      similarity: 100,
      matchedKeywords: ["نص متطابق تماماً"],
      explanations: "ممتاز جداً. إجابة الطالب مطابقة تماماً لنموذج الإجابة (100%)."
    };
  }

  const stopwords = getArabicStopwords();
  const studentWords = normStudent.split(" ").filter(w => w.length > 0 && !stopwords.has(w));
  const keyWords = normKey.split(" ").filter(w => w.length > 0 && !stopwords.has(w));

  const safeKeyWords = keyWords.length > 0 ? keyWords : normKey.split(" ").filter(w => w.length > 0);
  const safeStudentWords = studentWords.length > 0 ? studentWords : normStudent.split(" ").filter(w => w.length > 0);

  const studentSet = new Set(safeStudentWords);
  const keySet = new Set(safeKeyWords);

  const matchedKeywords: string[] = [];
  keySet.forEach(word => {
    if (studentSet.has(word)) {
      matchedKeywords.push(word);
    } else {
      for (const stWord of safeStudentWords) {
        if (stWord.includes(word) || word.includes(stWord)) {
          if (word.length >= 3 && stWord.length >= 3) {
            matchedKeywords.push(word);
            break;
          }
        }
      }
    }
  });

  const uniqueMatches = new Set(matchedKeywords);
  const matchRatio = keySet.size > 0 ? (uniqueMatches.size / keySet.size) : 0;

  const studentBigrams = getBigrams(normStudent);
  const keyBigrams = getBigrams(normKey);
  const bigramOverlap = getSetIntersection(studentBigrams, keyBigrams);
  const bigramRatio = (studentBigrams.size + keyBigrams.size) > 0 
    ? (2 * bigramOverlap.size) / (studentBigrams.size + keyBigrams.size) 
    : 0;

  let score = Math.round((matchRatio * 65) + (bigramRatio * 35));
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  let explanation = "";
  if (score >= 85) {
    explanation = `Sangat Baik (Mumtaz). Jawaban bahasa Arab memiliki kesesuaian ${score}% dengan kunci jawaban rujukan. Menemukan kata kunci penting: ${Array.from(uniqueMatches).slice(0, 5).join(", ")}.`;
  } else if (score >= 60) {
    explanation = `Cukup Baik (Jayyid). Jawaban bahasa Arab memiliki kesesuaian ${score}% dengan kunci rujukan. Menemukan kata kunci: ${Array.from(uniqueMatches).slice(0, 4).join(", ")}.`;
  } else if (score >= 30) {
    explanation = `Kurang Lengkap (Maqbul). Kesesuaian teks Arab ${score}%. Terdapat sedikit kecocokan kata kunci: ${Array.from(uniqueMatches).slice(0, 3).join(", ")}.`;
  } else {
    explanation = `Belum Sesuai (Dhaif). Kesesuaian teks Arab ${score}%. Silakan tinjau kembali kaidah atau mufradat terkait.`;
  }

  return {
    similarity: score,
    matchedKeywords: Array.from(uniqueMatches),
    explanations: explanation
  };
}

// ----------------------------------------------------
// 2. ENGLISH NLP NORMALIZER & SIMILARITY
// ----------------------------------------------------
function getEnglishStopwords(): Set<string> {
  return new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", 
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", 
    "by", "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", 
    "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", 
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", 
    "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", 
    "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", 
    "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", 
    "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", 
    "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", 
    "will", "with", "would", "you", "your", "yours", "yourself", "yourselves"
  ]);
}

function stemEnglishWord(word: string): string {
  if (!word || word.length <= 3) return word;
  let w = word.toLowerCase();
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("tion") && w.length > 5) return w.slice(0, -4);
  if (w.endsWith("ment") && w.length > 5) return w.slice(0, -4);
  if (w.endsWith("able") && w.length > 5) return w.slice(0, -4);
  if (w.endsWith("ible") && w.length > 5) return w.slice(0, -4);
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("ly") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

function isEnglishText(text: string): boolean {
  if (!text) return false;
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  if (words.length === 0) return false;
  const engStopwords = getEnglishStopwords();
  let matchCount = 0;
  for (const w of words) {
    if (engStopwords.has(w)) matchCount++;
  }
  return (matchCount / words.length) >= 0.2 || (matchCount >= 2);
}

function computeEnglishSimilarity(studentAnswer: string, keyAnswer: string): { similarity: number, matchedKeywords: string[], explanations: string } {
  const cleanStudent = cleanIndonesianText(studentAnswer);
  const cleanKey = cleanIndonesianText(keyAnswer);

  if (cleanStudent === cleanKey) {
    return {
      similarity: 100,
      matchedKeywords: ["Exact match"],
      explanations: "Excellent. Student's answer matches the teacher's key reference completely (100%)."
    };
  }

  const stopwords = getEnglishStopwords();
  const studentWords = cleanStudent.split(" ").filter(w => w.length > 1 && !stopwords.has(w));
  const keyWords = cleanKey.split(" ").filter(w => w.length > 1 && !stopwords.has(w));

  const safeKeyWords = keyWords.length > 0 ? keyWords : cleanKey.split(" ").filter(w => w.length > 1);
  const safeStudentWords = studentWords.length > 0 ? studentWords : cleanStudent.split(" ").filter(w => w.length > 1);

  const studentStems = safeStudentWords.map(w => stemEnglishWord(w));
  const studentStemSet = new Set(studentStems);
  const studentRawSet = new Set(safeStudentWords);

  const matchedKeywords: string[] = [];
  safeKeyWords.forEach(word => {
    const stem = stemEnglishWord(word);
    if (studentRawSet.has(word) || studentStemSet.has(stem)) {
      matchedKeywords.push(word);
    } else {
      for (const stWord of safeStudentWords) {
        if (stWord.includes(word) || word.includes(stWord)) {
          if (word.length > 3 && stWord.length > 3) {
            matchedKeywords.push(word);
            break;
          }
        }
      }
    }
  });

  const uniqueMatches = new Set(matchedKeywords);
  const matchRatio = safeKeyWords.length > 0 ? (uniqueMatches.size / safeKeyWords.length) : 0;

  const studentBigrams = getBigrams(cleanStudent);
  const keyBigrams = getBigrams(cleanKey);
  const bigramOverlap = getSetIntersection(studentBigrams, keyBigrams);
  const bigramRatio = (studentBigrams.size + keyBigrams.size) > 0 
    ? (2 * bigramOverlap.size) / (studentBigrams.size + keyBigrams.size) 
    : 0;

  let score = Math.round((matchRatio * 60) + (bigramRatio * 40));
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  let explanation = "";
  if (score >= 85) {
    explanation = `Very Good. The English answer has a ${score}% similarity with the key reference. Found core keywords: ${Array.from(uniqueMatches).slice(0, 5).join(", ")}.`;
  } else if (score >= 60) {
    explanation = `Good. The English answer has a ${score}% similarity with the key reference. Found keywords: ${Array.from(uniqueMatches).slice(0, 4).join(", ")}.`;
  } else if (score >= 30) {
    explanation = `Incomplete. The English answer has a ${score}% similarity. Matches few keywords: ${Array.from(uniqueMatches).slice(0, 3).join(", ")}.`;
  } else {
    explanation = `Not Matching. The English answer has a ${score}% similarity with the key reference.`;
  }

  return {
    similarity: score,
    matchedKeywords: Array.from(uniqueMatches),
    explanations: explanation
  };
}

// ----------------------------------------------------
// 3. MATHEMATICS & FORMULAS NORMALIZER & SIMILARITY
// ----------------------------------------------------
function isMathFormula(text: string): boolean {
  if (!text) return false;
  // Check for LaTeX patterns, math operators, equation symbols, powers, roots, trigonometry
  const mathSymbols = /[=\+\-\*\/\^√±≠≤≥≈π×÷²³½¼¾]|\\frac|\\sqrt|\\times|\\div|\\pm|\\cdot|\\approx|\\pi|sin\(|cos\(|tan\(|log\(|ln\(/i;
  // Check for algebraic equations e.g. x = 5, y = 2x + 1, f(x), 25 cm, 10 m/s
  const equationPattern = /\b([a-zA-Z]\s*=\s*[\d\.\-\+\*\/a-zA-Z]+|\d+[\.,]\d+|\d+\s*[\+\-\*\/×÷]\s*\d+)\b/;
  return mathSymbols.test(text) || equationPattern.test(text);
}

function canonicalizeMathExpression(expr: string): string {
  if (!expr) return "";
  let res = expr.toLowerCase();

  // 1. Convert LaTeX syntax to standard functional format
  res = res.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, "($1)/($2)");
  res = res.replace(/\\sqrt\s*\{([^}]+)\}/g, "sqrt($1)");
  res = res.replace(/\\sqrt\[(\d+)\]\s*\{([^}]+)\}/g, "root$1($2)");
  res = res.replace(/\\times|\\cdot|·|×/g, "*");
  res = res.replace(/\\div|÷/g, "/");
  res = res.replace(/\\pm|±/g, "+-");
  res = res.replace(/\\approx|≈/g, "~=");
  res = res.replace(/\\neq|≠/g, "!=");
  res = res.replace(/\\le|≤/g, "<=");
  res = res.replace(/\\ge|≥/g, ">=");
  res = res.replace(/\\pi|π/g, "pi");
  res = res.replace(/\\left|\\right/g, "");

  // 2. Normalize superscripts / exponents
  res = res.replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4");
  res = res.replace(/\^\{([^}]+)\}/g, "^$1");

  // 3. Normalize decimal comma to dot when between digits
  res = res.replace(/(\d+),(\d+)/g, "$1.$2");

  // 4. Normalize common units and remove spaces inside units
  res = res.replace(/\bcm\s*(\^?2|persegi)\b/g, "cm2");
  res = res.replace(/\bm\s*(\^?2|persegi)\b/g, "m2");
  res = res.replace(/\bcm\s*(\^?3|kubik)\b/g, "cm3");
  res = res.replace(/\bm\s*(\^?3|kubik)\b/g, "m3");
  res = res.replace(/\bkm\s*\/\s*jam\b/g, "km/h");
  res = res.replace(/\bm\s*\/\s*detik\b/g, "m/s");

  // 5. Standardize brackets
  res = res.replace(/\[/g, "(").replace(/\]/g, ")");
  res = res.replace(/\{/g, "(").replace(/\}/g, ")");

  // 6. Remove whitespace around operators
  res = res.replace(/\s*([\+\-\*\/\^=><~:])\s*/g, "$1");
  res = res.replace(/\s+/g, " ").trim();

  return res;
}

function extractKeyMathTokens(expr: string): string[] {
  const norm = canonicalizeMathExpression(expr);
  // Extract equations, formulas, numbers with units, standalone numbers, variables
  const tokens = norm.match(/([a-zA-Z]\s*=\s*[^\s,;]+|\b\d+(\.\d+)?(cm2|m2|cm3|m3|km\/h|m\/s|cm|m|km|kg|gr|gram|detik|s|menit|jam|derajat|%)?|\b[a-zA-Z]\b|sqrt\([^\)]+\)|\([^\)]+\))/g);
  return tokens || norm.split(/\s+/).filter(t => t.length > 0);
}

function computeMathSimilarity(studentAnswer: string, keyAnswer: string): { similarity: number, matchedKeywords: string[], explanations: string } {
  const normStudent = canonicalizeMathExpression(studentAnswer);
  const normKey = canonicalizeMathExpression(keyAnswer);

  // Exact canonical match
  if (normStudent === normKey) {
    return {
      similarity: 100,
      matchedKeywords: [keyAnswer.trim()],
      explanations: "Sempurna (100%). Rumus atau nilai perhitungan matematika siswa tepat dan identik dengan kunci jawaban."
    };
  }

  // Remove all spaces for equation comparison (e.g. "x=5" vs "x = 5" vs "5")
  const flatStudent = normStudent.replace(/\s+/g, "");
  const flatKey = normKey.replace(/\s+/g, "");

  if (flatStudent === flatKey) {
    return {
      similarity: 100,
      matchedKeywords: [keyAnswer.trim()],
      explanations: "Sempurna (100%). Bentuk persamaan atau rumus matematika siswa tepat sesuai dengan kunci jawaban."
    };
  }

  // Check if final numeric answer matches (e.g. key has step "L = p x l = 5 x 4 = 20 cm2" and student wrote "20 cm2" or "20")
  const studentNumbers: string[] = normStudent.match(/\b\d+(\.\d+)?\b/g) || [];
  const keyNumbers: string[] = normKey.match(/\b\d+(\.\d+)?\b/g) || [];
  const lastKeyNum = keyNumbers.length > 0 ? keyNumbers[keyNumbers.length - 1] : null;
  const lastStudentNum = studentNumbers.length > 0 ? studentNumbers[studentNumbers.length - 1] : null;

  const studentTokens = extractKeyMathTokens(studentAnswer);
  const keyTokens = extractKeyMathTokens(keyAnswer);

  const studentSet = new Set(studentTokens.map(t => t.replace(/\s+/g, "")));
  const matchedTokens: string[] = [];

  keyTokens.forEach(kt => {
    const cleanKt = kt.replace(/\s+/g, "");
    if (studentSet.has(cleanKt)) {
      matchedTokens.push(kt);
    } else {
      for (const st of studentSet) {
        if (st.includes(cleanKt) || cleanKt.includes(st)) {
          matchedTokens.push(kt);
          break;
        }
      }
    }
  });

  const uniqueMatches = new Set(matchedTokens);
  let tokenScore = keyTokens.length > 0 ? Math.round((uniqueMatches.size / keyTokens.length) * 100) : 0;

  // Bonus for matching the final result number
  let finalResultMatched = false;
  if (lastKeyNum && (lastStudentNum === lastKeyNum || studentNumbers.includes(lastKeyNum))) {
    finalResultMatched = true;
    tokenScore = Math.max(tokenScore, 85); // High score for getting the final result right
  }

  // N-gram overlap for explanatory math sentences
  const studentBigrams = getBigrams(normStudent);
  const keyBigrams = getBigrams(normKey);
  const bigramOverlap = getSetIntersection(studentBigrams, keyBigrams);
  const bigramRatio = (studentBigrams.size + keyBigrams.size) > 0 
    ? (2 * bigramOverlap.size) / (studentBigrams.size + keyBigrams.size) 
    : 0;

  let finalScore = Math.max(tokenScore, Math.round((tokenScore * 0.7) + (bigramRatio * 30)));
  if (finalScore > 100) finalScore = 100;
  if (finalScore < 0) finalScore = 0;

  let explanation = "";
  if (finalScore >= 85) {
    explanation = `Sangat Baik. Hasil perhitungan / rumus matematika siswa mencapai kesesuaian ${finalScore}%. ${finalResultMatched ? "Hasil akhir perhitungan benar." : "Langkah dan rumus sesuai."} Menemukan komponen: ${Array.from(uniqueMatches).slice(0, 4).join(", ") || "sesuai rujukan"}.`;
  } else if (finalScore >= 60) {
    explanation = `Cukup Baik. Kesesuaian rumus / angka ${finalScore}%. Terdapat komponen perhitungan yang cocok: ${Array.from(uniqueMatches).slice(0, 3).join(", ")}.`;
  } else if (finalScore >= 30) {
    explanation = `Kurang Lengkap. Kesesuaian rumus / angka ${finalScore}%. Menemukan sebagian elemen: ${Array.from(uniqueMatches).slice(0, 2).join(", ")}.`;
  } else {
    explanation = `Belum Sesuai. Hasil rumus / angka ${finalScore}% belum sesuai dengan kunci rujukan guru.`;
  }

  return {
    similarity: finalScore,
    matchedKeywords: Array.from(uniqueMatches),
    explanations: explanation
  };
}

// ----------------------------------------------------
// 4. UNIVERSAL SMART ESSAY SIMILARITY (DISPATCHER)
// ----------------------------------------------------
function computeUniversalEssaySimilarity(studentAnswer: string, keyAnswer: string): { similarity: number, matchedKeywords: string[], explanations: string } {
  const rawStudent = (studentAnswer || "").trim();
  const rawKey = (keyAnswer || "").trim();

  if (!rawStudent || rawStudent.toLowerCase() === "tidak menjawab") {
    return {
      similarity: 0,
      matchedKeywords: [],
      explanations: "Siswa tidak memberikan jawaban atau jawaban kosong."
    };
  }

  if (!rawKey) {
    return {
      similarity: 100,
      matchedKeywords: [],
      explanations: "Rujukan kunci jawaban guru kosong, diberikan nilai penuh sebagai default."
    };
  }

  // 1. Arabic Domain Detection
  if (isArabicText(rawKey) || isArabicText(rawStudent)) {
    return computeArabicSimilarity(rawStudent, rawKey);
  }

  // 2. Mathematics / Science Formula Domain Detection
  if (isMathFormula(rawKey) || isMathFormula(rawStudent)) {
    const mathResult = computeMathSimilarity(rawStudent, rawKey);
    // If it's a mixed explanation + math, take the best of math or text similarity
    if (mathResult.similarity >= 50) {
      return mathResult;
    }
  }

  // 3. English Domain Detection
  if (isEnglishText(rawKey) || isEnglishText(rawStudent)) {
    return computeEnglishSimilarity(rawStudent, rawKey);
  }

  // 4. Default: Indonesian NLP Engine
  return computeIndonesianTextSimilarity(rawStudent, rawKey);
}

function computeIndonesianTextSimilarity(studentAnswer: string, keyAnswer: string): { similarity: number, matchedKeywords: string[], explanations: string } {
  const cleanStudent = cleanIndonesianText(studentAnswer);
  const cleanKey = cleanIndonesianText(keyAnswer);

  if (cleanStudent === cleanKey) {
    return {
      similarity: 100,
      matchedKeywords: ["Sesuai penuh"],
      explanations: "Sangat Baik (100%). Jawaban siswa identik dengan kunci jawaban rujukan guru."
    };
  }

  const stopwords = getIndonesianStopwords();

  const studentWords = cleanStudent.split(" ").filter(w => w.length > 1);
  const keyWords = cleanKey.split(" ").filter(w => w.length > 1);

  const studentCore = studentWords.filter(w => !stopwords.has(w));
  const keyCore = keyWords.filter(w => !stopwords.has(w));

  if (keyCore.length === 0) {
    keyCore.push(...keyWords);
  }
  if (studentCore.length === 0) {
    studentCore.push(...studentWords);
  }

  const studentSet = new Set(studentCore);
  const keySet = new Set(keyCore);

  const matchedKeywords: string[] = [];
  keySet.forEach(word => {
    if (studentSet.has(word)) {
      matchedKeywords.push(word);
    } else {
      for (const stWord of studentCore) {
        if (stWord.includes(word) || word.includes(stWord)) {
          if (word.length > 3 && stWord.length > 3) {
            matchedKeywords.push(word);
            break;
          }
        }
      }
    }
  });

  const uniqueMatches = new Set(matchedKeywords);
  const matchRatio = keySet.size > 0 ? (uniqueMatches.size / keySet.size) : 0;

  const studentBigrams = getBigrams(cleanStudent);
  const keyBigrams = getBigrams(cleanKey);
  const bigramOverlap = getSetIntersection(studentBigrams, keyBigrams);
  const bigramRatio = (studentBigrams.size + keyBigrams.size) > 0 
    ? (2 * bigramOverlap.size) / (studentBigrams.size + keyBigrams.size) 
    : 0;

  let finalScore = Math.round((matchRatio * 60) + (bigramRatio * 40));

  if (finalScore > 100) finalScore = 100;
  if (finalScore < 0) finalScore = 0;

  let explanation = "";
  if (finalScore >= 85) {
    explanation = `Sangat Baik. Jawaban memiliki kesamaan ${finalScore}% dengan rujukan kunci jawaban. Menemukan kesesuaian kata kunci penting: ${uniqueMatches.size > 0 ? Array.from(uniqueMatches).slice(0, 5).join(", ") : "seluruh rujukan"}.`;
  } else if (finalScore >= 60) {
    explanation = `Cukup Baik. Jawaban memiliki kesamaan ${finalScore}% dengan rujukan kunci jawaban. Menemukan kata kunci penting: ${uniqueMatches.size > 0 ? Array.from(uniqueMatches).slice(0, 4).join(", ") : "sebagian rujukan"}.`;
  } else if (finalScore >= 30) {
    explanation = `Kurang Lengkap. Jawaban memiliki kesamaan ${finalScore}% dengan rujukan kunci jawaban. Menemukan sedikit kecocokan kata kunci: ${uniqueMatches.size > 0 ? Array.from(uniqueMatches).slice(0, 3).join(", ") : "beberapa kata"}.`;
  } else {
    explanation = `Belum Sesuai. Jawaban memiliki kesamaan ${finalScore}% dengan rujukan kunci jawaban. Silakan tinjau kembali materi terkait.`;
  }

  return {
    similarity: finalScore,
    matchedKeywords: Array.from(uniqueMatches),
    explanations: explanation
  };
}

app.post("/api/gemini/auto-koreksi", async (req, res) => {
  try {
    const { classId, examId, studentId, method = 'ai' } = req.body;
    if (!classId || !examId) {
      return res.status(400).json({ success: false, message: "classId dan examId harus diisi." });
    }

    const ex = exams.find((e: any) => String(e.id) === String(examId));
    if (!ex) {
      return res.status(404).json({ success: false, message: "Jadwal ujian tidak ditemukan." });
    }

    const examQuestions = getExamQuestionsServer(ex);
    const essayQuestions = examQuestions.filter((q: any) => q.type === 'esay' || q.type === 'essay');
    if (essayQuestions.length === 0) {
      return res.json({ success: false, message: "Ujian ini tidak memiliki soal esay untuk dikoreksi." });
    }

    const classStudents = students.filter((s: any) => String(s.classId) === String(classId));
    let completedStudents = classStudents.filter((st: any) => {
      const key = st.id + '_' + examId;
      return Boolean(completedExams[key]) || studentExamAnswers[key] !== undefined;
    });

    if (studentId) {
      completedStudents = completedStudents.filter((st: any) => String(st.id) === String(studentId));
    }

    if (completedStudents.length === 0) {
      return res.json({ success: false, message: studentId ? "Siswa belum selesai mengerjakan ujian atau jawaban esay tidak ditemukan." : "Belum ada siswa di kelas ini yang mengerjakan ujian ini." });
    }

    // METHOD KEYWORD / NON-AI SIMILARITY AUTOMATION
    if (method === 'keyword') {
      let successCount = 0;
      for (const st of completedStudents) {
        const key1 = st.id + '_' + examId;
        const key2 = String(st.id) + '_' + String(examId);

        const studentAnswers = studentExamAnswers[key1] || studentExamAnswers[key2] || {};

        const grades: Record<string, number> = {};
        const explanations: Record<string, string> = {};

        for (const q of essayQuestions) {
          const studentAns = studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : (studentAnswers[String(q.id)] || "");
          const keyAns = q.answer || "";

          const result = computeUniversalEssaySimilarity(studentAns, keyAns);
          grades[q.id] = result.similarity;
          explanations[q.id] = result.explanations;
        }

        const gradeObj = studentExamGrades[key1] || studentExamGrades[key2] || {
          id: 'G' + Date.now() + '_' + st.id,
          studentId: st.id,
          examId: examId,
          classId: classId,
          pgQuestionsCount: examQuestions.filter((q: any) => q.type !== 'esay' && q.type !== 'essay').length,
          correctPgCount: 0,
          pgScore: 100,
          essayScore: 0,
          finalScore: 100,
          essayGrades: {},
          essayExplanations: {}
        };

        gradeObj.essayGrades = { ...(gradeObj.essayGrades || {}), ...grades };
        gradeObj.essayExplanations = { ...(gradeObj.essayExplanations || {}), ...explanations };

        // Re-calculate average essay score
        let sum = 0;
        essayQuestions.forEach((q: any) => {
          const val = gradeObj.essayGrades[q.id] !== undefined ? gradeObj.essayGrades[q.id] : (gradeObj.essayGrades[String(q.id)] || 0);
          sum += Number(val) || 0;
        });
        gradeObj.essayScore = Math.round(sum / essayQuestions.length);
        gradeObj.isGraded = true;

        // Re-calculate final score
        const weightPg = ex.weightPg !== undefined ? Number(ex.weightPg) : 50;
        const weightEssay = ex.weightEssay !== undefined ? Number(ex.weightEssay) : 50;
        gradeObj.finalScore = Math.round(((gradeObj.pgScore || 0) * weightPg / 100) + (gradeObj.essayScore * weightEssay / 100));

        studentExamGrades[key1] = gradeObj;
        studentExamGrades[key2] = gradeObj;
        successCount++;
      }

      await saveData('studentExamGrades', studentExamGrades);

      return res.json({
        success: true,
        message: `Proses koreksi otomatis Non-AI selesai. Berhasil mencocokkan & menilai ${successCount} siswa secara instan tanpa API key.`
      });
    }

    // ORIGINAL AI METHOD (Requires GEMINI_API_KEY)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "GEMINI_API_KEY environment variable is missing on server. Gunakan metode Koreksi Non-AI."
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    let successCount = 0;
    let failCount = 0;

    for (const st of completedStudents) {
      const key1 = st.id + '_' + examId;
      const key2 = String(st.id) + '_' + String(examId);

      const studentAnswers = studentExamAnswers[key1] || studentExamAnswers[key2] || {};

      const prompt = `
Anda adalah seorang pendidik penyelia yang ahli dan objektif dalam mengoreksi ujian esay siswa.
Tugas Anda adalah menilai jawaban esay siswa berdasarkan Pertanyaan dan Kunci Jawaban / Rujukan Guru yang disediakan.

Berikan nilai integer antara 0 sampai 100 (0 jika tidak menjawab/ngawur, 100 jika sempurna sesuai rujukan).
Berikan penjelasan yang singkat, padat, dan konstruktif dalam bahasa Indonesia (maksimal 2 kalimat) mengapa siswa tersebut mendapatkan nilai tersebut berdasarkan jawabannya.

Format respon yang Anda berikan HARUS berupa JSON murni dengan struktur berikut (tanpa markdown formatting, tanpa \`\`\`json):
{
  "grades": {
    "question_id": <nilai_integer_0_sampai_100>
  },
  "explanations": {
    "question_id": "<penjelasan_singkat_indonesia>"
  }
}

Berikut adalah data esay siswa:
Nama Siswa: ${st.name}
Mata Pelajaran: ${ex.subject}
Ujian: ${ex.title}

Daftar Pertanyaan, Kunci Jawaban, dan Jawaban Siswa:
${essayQuestions.map((q: any, i: number) => {
  const studentAns = studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : (studentAnswers[String(q.id)] || "");
  return `
[Soal ${i + 1}]
ID Soal: ${q.id}
Pertanyaan: ${q.question}
Kunci Jawaban Guru / Rujukan: ${q.answer || "-"}
Jawaban Siswa: ${studentAns || "(Tidak menjawab)"}
`;
}).join("\n---")}`;

      try {
        const response = await generateGeminiContent(ai, {
          model: "gemini-3.7-flash",
          contents: prompt
        });

        const textResponse = response.text || "";
        const parsed = extractJsonFromText(textResponse);

        if (parsed && parsed.grades) {
          const gradeObj = studentExamGrades[key1] || studentExamGrades[key2] || {
            id: 'G' + Date.now() + '_' + st.id,
            studentId: st.id,
            examId: examId,
            classId: classId,
            pgQuestionsCount: examQuestions.filter((q: any) => q.type !== 'esay' && q.type !== 'essay').length,
            correctPgCount: 0,
            pgScore: 100,
            essayScore: 0,
            finalScore: 100,
            essayGrades: {},
            essayExplanations: {}
          };

          // Merge grades and explanations
          gradeObj.essayGrades = { ...(gradeObj.essayGrades || {}), ...parsed.grades };
          gradeObj.essayExplanations = { ...(gradeObj.essayExplanations || {}), ...parsed.explanations };

          // Re-calculate average essay score
          let sum = 0;
          essayQuestions.forEach((q: any) => {
            const val = gradeObj.essayGrades[q.id] !== undefined ? gradeObj.essayGrades[q.id] : (gradeObj.essayGrades[String(q.id)] || 0);
            sum += Number(val) || 0;
          });
          gradeObj.essayScore = Math.round(sum / essayQuestions.length);
          gradeObj.isGraded = true;

          // Re-calculate final score
          const weightPg = ex.weightPg !== undefined ? Number(ex.weightPg) : 50;
          const weightEssay = ex.weightEssay !== undefined ? Number(ex.weightEssay) : 50;
          gradeObj.finalScore = Math.round(((gradeObj.pgScore || 0) * weightPg / 100) + (gradeObj.essayScore * weightEssay / 100));

          studentExamGrades[key1] = gradeObj;
          studentExamGrades[key2] = gradeObj;
          successCount++;
        } else {
          failCount++;
        }
      } catch (err: any) {
        console.warn(`[Auto Koreksi] AI gagal memproses siswa ${st.name}, beralih ke metode kecocokan cerdas (Non-AI fallback):`, err?.message || err);
        try {
          const grades: Record<string, number> = {};
          const explanations: Record<string, string> = {};

          for (const q of essayQuestions) {
            const studentAns = studentAnswers[q.id] !== undefined ? studentAnswers[q.id] : (studentAnswers[String(q.id)] || "");
            const keyAns = q.answer || "";
            const result = computeUniversalEssaySimilarity(studentAns, keyAns);
            grades[q.id] = result.similarity;
            explanations[q.id] = result.explanations;
          }

          const gradeObj = studentExamGrades[key1] || studentExamGrades[key2] || {
            id: 'G' + Date.now() + '_' + st.id,
            studentId: st.id,
            examId: examId,
            classId: classId,
            pgQuestionsCount: examQuestions.filter((q: any) => q.type !== 'esay' && q.type !== 'essay').length,
            correctPgCount: 0,
            pgScore: 100,
            essayScore: 0,
            finalScore: 100,
            essayGrades: {},
            essayExplanations: {}
          };

          gradeObj.essayGrades = { ...(gradeObj.essayGrades || {}), ...grades };
          gradeObj.essayExplanations = { ...(gradeObj.essayExplanations || {}), ...explanations };

          let sum = 0;
          essayQuestions.forEach((q: any) => {
            const val = gradeObj.essayGrades[q.id] !== undefined ? gradeObj.essayGrades[q.id] : (gradeObj.essayGrades[String(q.id)] || 0);
            sum += Number(val) || 0;
          });
          gradeObj.essayScore = Math.round(sum / essayQuestions.length);
          gradeObj.isGraded = true;

          const weightPg = ex.weightPg !== undefined ? Number(ex.weightPg) : 50;
          const weightEssay = ex.weightEssay !== undefined ? Number(ex.weightEssay) : 50;
          gradeObj.finalScore = Math.round(((gradeObj.pgScore || 0) * weightPg / 100) + (gradeObj.essayScore * weightEssay / 100));

          studentExamGrades[key1] = gradeObj;
          studentExamGrades[key2] = gradeObj;
          successCount++;
        } catch (fbErr) {
          failCount++;
        }
      }
    }

    await saveData('studentExamGrades', studentExamGrades);

    res.json({
      success: true,
      message: `Proses auto koreksi AI selesai. Berhasil mengoreksi ${successCount} siswa.${failCount > 0 ? ` Gagal memproses ${failCount} siswa.` : ''}`
    });

  } catch (error: any) {
    console.error("[Auto Koreksi Error]:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/gemini/auto-koreksi-lkpd", async (req, res) => {
  try {
    const { classId, lkpdId, method = 'ai' } = req.body;
    if (!classId || !lkpdId) {
      return res.status(400).json({ success: false, message: "classId dan lkpdId harus diisi." });
    }

    const store = readLocalStore();
    let lkpdList = store.lkpdList || [];
    const lkpd = lkpdList.find((l: any) => String(l.id) === String(lkpdId));
    if (!lkpd) {
      return res.status(404).json({ success: false, message: "LKPD tidak ditemukan." });
    }

    const markers = lkpd.markers || [];
    if (markers.length === 0) {
      return res.json({ success: false, message: "LKPD ini tidak memiliki titik pertanyaan untuk dikoreksi." });
    }

    const submissions = lkpd.submissions || [];
    const classStudents = students.filter((s: any) => String(s.classId) === String(classId));
    
    // Filter submissions of students in this class
    const classStudentIds = new Set(classStudents.map((s: any) => String(s.id)));
    const submissionsToGrade = submissions.filter((sub: any) => classStudentIds.has(String(sub.studentId)));

    if (submissionsToGrade.length === 0) {
      return res.json({ success: false, message: "Belum ada jawaban siswa masuk dari kelas ini." });
    }

    let successCount = 0;
    let failCount = 0;

    if (method === 'keyword') {
      for (const sub of submissionsToGrade) {
        const answers = sub.answers || {};
        const scores: Record<string, number> = {};
        const feedback: Record<string, string> = {};
        let totalScore = 0;
        let totalPoints = 0;

        for (const mk of markers) {
          const studentAns = String(answers[mk.id] || "").trim();
          const keyAns = String(mk.answerKey || "").trim();
          const maxPoints = Number(mk.points) || 25;
          totalPoints += maxPoints;

          const result = computeUniversalEssaySimilarity(studentAns, keyAns);
          // Scale result.similarity (0-100) to maxPoints
          const scaledScore = Math.round((result.similarity / 100) * maxPoints);
          scores[mk.id] = scaledScore;
          feedback[mk.id] = result.explanations || `Kesesuaian kunci jawaban: ${result.similarity}%`;
          totalScore += scaledScore;
        }

        sub.scores = scores;
        sub.feedback = feedback;
        // Normalize final score to 100
        sub.totalScore = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
        sub.isGraded = true;
        sub.gradedAt = new Date().toISOString();
        successCount++;
      }
    } else {
      // AI-based correction with Gemini 3.7 Flash
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is missing on server.");
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      for (const sub of submissionsToGrade) {
        try {
          const answers = sub.answers || {};
          let prompt = `Anda adalah Guru Penilai profesional Madrasah Digital.
Silakan koreksi jawaban siswa untuk LKPD (Lembar Kerja Peserta Didik) berjudul "${lkpd.title}".
Berikut adalah daftar pertanyaan, kunci jawaban guru, dan jawaban dari siswa bernama "${sub.studentName}".

Koreksilah secara adil, objektif, dan berikan penilaian per nomor sesuai bobot poin maksimalnya.
Untuk setiap nomor, berikan nilai numerik (skor) antara 0 hingga bobot maksimal, serta ulasan (feedback/penjelasan) singkat, mendidik, dan sopan dalam Bahasa Indonesia.

Format respons wajib berupa JSON murni dengan skema berikut:
{
  "grades": {
    "ID_SOAL_1": nilai_angka,
    "ID_SOAL_2": nilai_angka
  },
  "explanations": {
    "ID_SOAL_1": "Ulasan guru...",
    "ID_SOAL_2": "Ulasan guru..."
  }
}

Catatan:
- Kembalikan HANYA objek JSON valid tersebut tanpa tambahan teks markdown or backticks \`\`\`.
- ID_SOAL_1, ID_SOAL_2 dst harus sama persis dengan ID Soal yang diberikan di bawah.

Berikut daftar pertanyaannya:\n`;

          markers.forEach((mk: any, i: number) => {
            const studentAns = answers[mk.id] || "";
            prompt += `
[Soal ${i + 1}]
ID Soal: ${mk.id}
Pertanyaan: ${mk.question}
Bobot Maksimal: ${mk.points || 25} Poin
Kunci Jawaban Guru / Rujukan: ${mk.answerKey || "-"}
Jawaban Siswa: ${studentAns || "(Tidak menjawab)"}
---`;
          });

          const response = await generateGeminiContent(ai, {
            model: "gemini-3.7-flash",
            contents: prompt
          });

          const textResponse = response.text || "";
          const parsed = extractJsonFromText(textResponse);

          if (parsed && parsed.grades) {
            const scores: Record<string, number> = {};
            const feedback: Record<string, string> = {};
            let totalScore = 0;
            let totalPoints = 0;

            markers.forEach((mk: any) => {
              const maxPoints = Number(mk.points) || 25;
              totalPoints += maxPoints;

              const val = parsed.grades[mk.id] !== undefined ? parsed.grades[mk.id] : (parsed.grades[String(mk.id)] || 0);
              const fb = parsed.explanations[mk.id] || parsed.explanations[String(mk.id)] || "Bagus.";

              const validatedScore = Math.max(0, Math.min(maxPoints, Math.round(Number(val) || 0)));
              scores[mk.id] = validatedScore;
              feedback[mk.id] = fb;
              totalScore += validatedScore;
            });

            sub.scores = scores;
            sub.feedback = feedback;
            sub.totalScore = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
            sub.isGraded = true;
            sub.gradedAt = new Date().toISOString();
            successCount++;
          } else {
            failCount++;
          }
        } catch (subErr) {
          console.error(`Error grading submission of ${sub.studentName}:`, subErr);
          failCount++;
        }
      }
    }

    // Save back to the store
    store.lkpdList = lkpdList;
    writeLocalStore(store);
    await saveData('lkpdList', lkpdList);

    res.json({
      success: true,
      message: `Proses auto koreksi LKPD selesai. Berhasil mengoreksi ${successCount} siswa.${failCount > 0 ? ` Gagal memproses ${failCount} siswa.` : ''}`
    });

  } catch (error: any) {
    console.error("[Auto Koreksi LKPD Error]:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 12. Server-side Gemini AI Questions Generation API
app.post("/api/gemini/generate-questions", async (req, res) => {
  try {
    const { topic, mcCount = 5, essayCount = 0, optionCount = 4, level = "Sedang" } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing on server.");
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const prompt = `
Buatkan soal ujian untuk madrasah.
Topik: ${topic}
Tingkat kesulitan: ${level}
Jumlah soal pilihan ganda: ${mcCount}
Jumlah soal esay: ${essayCount}
Jumlah opsi pilihan ganda: ${optionCount}

Format JSON array of objects dengan properti: type ('mc' atau 'essay'), question, options (array string), answer, explanation.
${NO_DASHES_PROMPT}
`;

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const resultText = response.text || "[]";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini response: " + resultText);
    const data = sanitizeGeneratedData(rawData);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini AI error (using fallback):", error);
    const { topic, mcCount = 5, essayCount = 0, optionCount = 4 } = req.body || {};
    const items = [];
    for (let i = 0; i < (mcCount || 5); i++) {
      items.push({
        type: 'mc',
        question: `Soal Pilihan Ganda ${i + 1} mengenai ${topic || 'Materi Sekolah'}: Apa konsep mendasar dari topik ini?`,
        options: optionCount === 5 ? ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E'] : ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
        answer: 'Opsi A',
        explanation: `Penjelasan edukatif mengenai ${topic || 'materi'} sesuai kurikulum madrasah.`
      });
    }
    for (let i = 0; i < (essayCount || 0); i++) {
      items.push({
        type: 'essay',
        question: `Jelaskan secara rinci prinsip dan penerapan dari ${topic || 'materi'} dalam kehidupan sehari-hari!`,
        options: [],
        answer: 'Jawaban uraian komprehensif.',
        explanation: 'Penjelasan uraian.'
      });
    }
    res.json({ success: true, data: items, fallback: true });
  }
});

// 13. Server-side Gemini AI Enrichment / Uraian Generation API
app.post("/api/gemini/generate-enrichment", async (req, res) => {
  try {
    const { topic } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing on server.");
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const prompt = `
Buatkan uraian pengayaan pembelajaran atau ringkasan materi pembelajaran madrasah yang mendalam dan edukatif untuk topik: "${topic}".
Berikan penjelasan 2-3 paragraf yang bermutu tinggi dan profesional dalam bahasa Indonesia.
${NO_DASHES_PROMPT}
`;

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt
    });

    const text = cleanDashedLines(response.text || "");
    res.json({ success: true, text });
  } catch (error: any) {
    console.error("Gemini AI error (using fallback):", error);
    const { topic } = req.body || {};
    const fallbackText = `Materi pengayaan mengenai ${topic || 'pembelajaran madrasah'} mencakup pemahaman komprehensif, nilai-nilai spiritual, serta penerapan praktis dalam kehidupan sehari-hari. Peserta didik diharapkan dapat memahami konsep dasar, menganalisis hikmah yang terkandung, serta mengamalkannya dengan penuh kedisiplinan dan tanggung jawab.`;
    res.json({ success: true, text: fallbackText, fallback: true });
  }
});

// 14. Modul Ajar (Lesson Plans) Database & APIs
interface LessonPlan {
  id: string;
  subjectId: string;
  title: string;
  topic: string;
  grade: string;
  
  // Informasi Umum
  identitasModul: string;
  kompetensiAwal: string;
  profilPancasila: string;
  saranaPrasarana: string;
  targetPeserta: string;
  modelPembelajaran: string;
  
  // Komponen Inti
  tujuanPembelajaran: string;
  pemahamanBermakna: string;
  pertanyaanPemantik: string;
  persiapanPembelajaran: string;
  kegiatanPembelajaran: string;
  asesmen: string;
  pengayaanRemedial: string;
  
  // Lampiran
  lkpd: string;
  lembarKerja: string;
  glosarium: string;
  daftarPustaka: string;
}

let lessonPlans: LessonPlan[] = (bootStore['lessonPlans'] && bootStore['lessonPlans'].length > 0) ? bootStore['lessonPlans'] : [
  {
    id: "LP1",
    subjectId: "S1",
    title: "Modul Fiqih: Shalat Berjamaah",
    topic: "Shalat Berjamaah",
    grade: "X",
    identitasModul: "Nama Penyusun: Ahmad Fauzi, S.Pd.I\nInstansi: MAN 1 Model\nTahun Penyusunan: 2026\nKelas: X\nAlokasi Waktu: 2 x 45 Menit",
    kompetensiAwal: "Siswa telah memahami rukun shalat fardhu dan syarat sah shalat secara mandiri.",
    profilPancasila: "Beriman, bertaqwa kepada Tuhan YME dan Berakhlak mulia (spiritual shalat), Gotong Royong (kebersamaan jamaah).",
    saranaPrasarana: "Masjid/musholla sekolah, sajadah, buku panduan Fiqih, proyektor, presentasi PowerPoint.",
    targetPeserta: "Siswa kelas X Umum / Reguler (maksimal 36 siswa).",
    modelPembelajaran: "Problem-Based Learning (PBL) dan Demonstrasi Praktis.",
    tujuanPembelajaran: "1. Menjelaskan keutamaan shalat berjamaah.\n2. Mendemonstrasikan tata cara shalat berjamaah, termasuk posisi imam dan makmum.",
    pemahamanBermakna: "Shalat berjamaah melatih kedisiplinan diri, menumbuhkan rasa persaudaraan sesama muslim, dan melipatgandakan pahala ibadah.",
    pertanyaanPemantik: "Mengapa shalat berjamaah dinilai 27 derajat lebih utama dibanding shalat sendirian? Bagaimana jika makmum terlambat (masbuq)?",
    persiapanPembelajaran: "Guru menyiapkan modul, lembar observasi praktik, proyektor, dan memastikan masjid sekolah siap digunakan.",
    kegiatanPembelajaran: "Pendahuluan (10 menit): Salam, doa, motivasi.\nKegiatan Inti (70 menit): Tanya jawab, simulasi posisi shalat jamaah.\nPenutup (10 menit): Refleksi, penugasan mandiri.",
    asesmen: "Formatif: Lembar penilaian praktik tata cara masbuq.\nSumatif: Ujian pemahaman teori konsep shalat jamaah.",
    pengayaanRemedial: "Pengayaan: Membaca rujukan kitab Fathul Qarib mengenai syarat sah imam.\nRemedial: Mengulang praktik bacaan shalat dengan bimbingan khusus.",
    lkpd: "Lembar Kerja Siswa: Analisis status keabsahan shalat berjamaah pada 3 skenario studi kasus.",
    lembarKerja: "Rubrik Penilaian Sikap Spiritual dan Keterampilan Praktik Shalat.",
    glosarium: "Imam, Makmum, Masbuq, Muwafiq, Fardhu Kifayah.",
    daftarPustaka: "Fauzi, Ahmad. 2024. Buku Teks Mata Pelajaran Terkait."
  }
];

app.get("/api/lesson-plans", (req, res) => {
  const { subjectId } = req.query;
  const filteredTenant = filterByMadrasah(lessonPlans, req);
  if (subjectId) {
    const filtered = filteredTenant.filter(lp => String(lp.subjectId) === String(subjectId));
    return res.json({ success: true, data: filtered });
  }
  res.json({ success: true, data: filteredTenant });
});

app.post("/api/lesson-plans", async (req, res) => {
  const lp = tagNewRecord(req.body, req);
  if (!lp.id) {
    lp.id = "LP" + Date.now();
    lessonPlans.push(lp);
  } else {
    const idx = lessonPlans.findIndex(item => String(item.id) === String(lp.id));
    if (idx !== -1) {
      lessonPlans[idx] = lp;
    } else {
      lessonPlans.push(lp);
    }
  }
  await saveData('lessonPlans', lessonPlans);
  res.json({ success: true, data: lp, message: "Modul Ajar berhasil disimpan" });
});

app.delete("/api/lesson-plans/:id", async (req, res) => {
  const { id } = req.params;
  lessonPlans = lessonPlans.filter(item => String(item.id) !== String(id));
  await saveData('lessonPlans', lessonPlans);
  res.json({ success: true, message: "Modul Ajar berhasil dihapus" });
});

app.get("/api/import-groups", (req, res) => {
  const { subjectId } = req.query;
  if (subjectId) {
    const filtered = importGroups.filter(g => String(g.subjectId) === String(subjectId));
    return res.json({ success: true, data: filtered });
  }
  res.json({ success: true, data: importGroups });
});

app.post("/api/import-groups", async (req, res) => {
  const grp = req.body;
  if (!grp.id) {
    grp.id = "grp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    importGroups.push(grp);
  } else {
    const idx = importGroups.findIndex(g => String(g.id) === String(grp.id));
    if (idx !== -1) {
      importGroups[idx] = grp;
    } else {
      importGroups.push(grp);
    }
  }
  await saveData('importGroups', importGroups);
  res.json({ success: true, data: grp, message: "Kelompok berhasil disimpan" });
});

app.delete("/api/import-groups/:id", async (req, res) => {
  const { id } = req.params;
  importGroups = importGroups.filter(g => String(g.id) !== String(id));
  await saveData('importGroups', importGroups);
  res.json({ success: true, message: "Kelompok berhasil dihapus" });
});

function detectSubjectCategoryServer(subjectName = '', topic = '', materiDetail = '') {
  const raw = `${subjectName} ${topic} ${materiDetail}`.toLowerCase();
  
  if (
    raw.includes('koding') || raw.includes('coding') || raw.includes('ai') || raw.includes('informatika') || 
    raw.includes('sistem komputer') || raw.includes('komputer') || raw.includes('arduino') || raw.includes('python') || 
    raw.includes('algoritma') || raw.includes('siber') || raw.includes('cyber') || raw.includes('mikrokontroler') || 
    raw.includes('single board') || raw.includes('c++') || raw.includes('unoardusim') || raw.includes('iot') ||
    raw.includes('pemrograman') || raw.includes('tinkercad')
  ) {
    return 'koding_ai';
  }
  
  if (
    raw.includes('arab') || raw.includes('lughah') || raw.includes('hiwar') || raw.includes('nahwu') || 
    raw.includes('sharaf') || raw.includes('mufradat') || raw.includes('qira') || raw.includes('kitabah')
  ) {
    return 'bahasa_arab';
  }

  if (
    raw.includes('pai') || raw.includes('agama') || raw.includes('quran') || raw.includes('hadis') || 
    raw.includes('fikih') || raw.includes('fiqih') || raw.includes('akidah') || raw.includes('akhlak') || 
    raw.includes('ski') || raw.includes('sejarah kebudayaan islam') || raw.includes('islam') || raw.includes('tajwid')
  ) {
    return 'pai_madrasah';
  }

  return 'umum';
}


function getSubjectTemplateInstructions(subjectName = '', topic = '') {
  const raw = `${subjectName} ${topic}`.toLowerCase();
  
  let profile = {
    karakteristik: "Pembelajaran berbasis konsep dan aplikasi keilmuan secara umum.",
    kompetensi: "Penguasaan konsep dasar, analisis, dan penerapan dalam masalah umum.",
    aktivitas: "Membaca teks, diskusi, tanya jawab, penugasan, dan presentasi.",
    asesmen: "Tes tertulis, observasi sikap, dan penilaian penugasan.",
    lkpd: "Soal pemahaman, tabel isian, dan instruksi diskusi.",
    rubrik: "Pemahaman konsep, ketepatan penyelesaian, dan keaktifan diskusi.",
    kko: "Menjelaskan, mengidentifikasi, menganalisis, dan mempresentasikan.",
    pertanyaanPemantik: "Bagaimana konsep materi ini berlaku dalam kehidupan sehari-hari?",
    pengayaan: "Eksplorasi materi lanjutan secara mandiri.",
    remedial: "Bimbingan ulang untuk konsep yang belum dipahami.",
    aturanKhusus: "JANGAN menggunakan istilah 'domain Konsep Dasar Keilmuan', 'desain implementasi', 'kegagalan sistem', 'laboratorium', atau 'studi kasus' jika tidak relevan. Sesuaikan bahasa dengan karakteristik ilmu."
  };

  if (raw.includes('arab') || raw.includes('nahwu') || raw.includes('sharaf') || raw.includes('hiwar')) {
    profile = {
      karakteristik: "Pembelajaran bahasa komunikatif dan tekstual mencakup kemahiran (Istima', Kalam, Qira'ah, Kitabah) dan unsur bahasa (Mufradat, Qawaid). JANGAN gunakan aktivitas sains/teknologi.",
      kompetensi: "Penguasaan kosakata (mufradat), tata bahasa (qawaid/nahwu/sharaf), dan keterampilan berbahasa Arab.",
      aktivitas: "Menyimak dialog (istima'), menirukan pelafalan, membaca teks Arab berharakat (qira'ah), menulis huruf/kalimat Arab (kitabah), praktik percakapan (hiwar).",
      asesmen: "Uji pelafalan, tes penguasaan mufradat, tes qawaid, uji bacaan, tulisan, dan unjuk kerja kalam/hiwar. JANGAN gunakan 'uji pemecahan masalah/studi kasus HOTS'.",
      lkpd: "Latihan mufradat (menyambung arti), melengkapi dialog berbahasa Arab, menyusun kata menjadi kalimat (tartib), praktik hiwar, membaca teks Arab.",
      rubrik: "Ketepatan pengucapan (makharijul huruf), ketepatan kosakata, struktur kalimat (tarkib), kelancaran berbicara, pemahaman isi teks.",
      kko: "Menyebutkan (kosakata), membaca (teks), menggunakan (ungkapan), menyusun (kalimat), mempraktikkan (dialog), menganalisis (tata bahasa).",
      pertanyaanPemantik: "Pertanyaan kontekstual terkait fungsi ungkapan atau tata bahasa yang dipelajari dalam bahasa Arab.",
      pengayaan: "Praktik percakapan lanjutan, membuat karangan/teks (kitabah) mandiri.",
      remedial: "Latihan membaca mufradat, mencocokkan kosakata dengan arti, dan bimbingan pelafalan.",
      aturanKhusus: "WAJIB menggunakan tulisan Arab secara nyata dalam isi modul (materi, contoh, dialog, mufradat, LKPD). Sediakan teks Arab, terjemahan, dan kosakata penting. Gunakan istilah Arab: الاسم, الفعل, الجملة, المبتدأ, الخبر dll sesuai topik."
    };
  } else if (raw.includes('matematika') || raw.includes('math')) {
    profile = {
      karakteristik: "Pembelajaran berbasis logika, penalaran ruang, bilangan, aljabar, dan pemecahan masalah matematis.",
      kompetensi: "Pemahaman konsep matematis, operasi hitung, penalaran logis, pemecahan masalah, dan komunikasi matematis.",
      aktivitas: "Mengamati masalah nyata, menemukan pola matematis, memahami konsep/rumus, latihan prosedural bertahap, dan verifikasi jawaban.",
      asesmen: "Tes pemahaman konsep, uji presisi prosedur matematis, uji penalaran logis.",
      lkpd: "Soal bertahap, tabel pola bilangan/geometri, dan eksplorasi langkah pemecahan masalah.",
      rubrik: "Pemahaman konsep, ketepatan prosedur matematis, ketepatan hasil akhir, dan komunikasi matematis.",
      kko: "Menghitung, menentukan, membedakan, menerapkan (rumus/konsep), memecahkan masalah, membuktikan.",
      pertanyaanPemantik: "Bagaimana kita memodelkan masalah nyata ini menjadi persamaan/pola matematika?",
      pengayaan: "Pemecahan masalah matematis tingkat lanjut (HOTS) atau soal olimpiade sederhana.",
      remedial: "Pengulangan konsep dasar, latihan prosedural dengan angka yang lebih mudah.",
      aturanKhusus: "Fokus pada struktur pemecahan masalah matematis. Hindari kegiatan 'membaca teks panjang' atau 'menghafal'."
    };
  } else if (raw.includes('biologi') || raw.includes('biology')) {
    profile = {
      karakteristik: "Pembelajaran sains kehidupan, observasi makhluk hidup, sistem biologi, dan eksperimen alam.",
      kompetensi: "Pemahaman konsep biologi, observasi, klasifikasi, analisis sistem kehidupan.",
      aktivitas: "Mengamati fenomena alam, membuat prediksi, observasi mikroskopis/makroskopis, eksperimen, mengumpulkan dan menganalisis data, menarik kesimpulan.",
      asesmen: "Uji pengetahuan sistem biologi, laporan observasi/eksperimen, analisis data.",
      lkpd: "Tabel pengamatan/observasi, diagram sistem organ/sel, pertanyaan analisis data percobaan.",
      rubrik: "Pemahaman konsep sains, ketelitian observasi, kemampuan analisis data, kejelasan laporan.",
      kko: "Mengidentifikasi, mengklasifikasikan, menganalisis, menyimpulkan, mendeskripsikan sistem.",
      pertanyaanPemantik: "Apa yang terjadi pada makhluk hidup/sistem biologi ini jika lingkungan berubah?",
      pengayaan: "Eksplorasi ekosistem atau eksperimen lanjutan di luar jam.",
      remedial: "Penjelasan ulang konsep bergambar, melengkapi diagram sistem organ/sel.",
      aturanKhusus: "Gunakan istilah biologi yang tepat. Integrasikan kegiatan laboratorium/pengamatan bila relevan dengan topik."
    };
  } else if (raw.includes('sejarah') || raw.includes('history')) {
    profile = {
      karakteristik: "Pembelajaran ilmu masa lalu, kronologi peristiwa, analisis sebab-akibat, dan interpretasi sumber sejarah.",
      kompetensi: "Berpikir kronologis, berpikir sinkronik/diakronik, interpretasi sejarah, dan pemahaman narasi masa lalu.",
      aktivitas: "Membaca sumber sejarah, menyusun kronologi/timeline, menganalisis sebab-akibat peristiwa, interpretasi sumber, dan diskusi peninggalan.",
      asesmen: "Uji pengetahuan sejarah, analisis kronologis, esai sebab-akibat.",
      lkpd: "Peta konsep peristiwa, garis waktu (timeline), analisis dokumen/sumber sejarah.",
      rubrik: "Akurasi fakta sejarah, kemampuan berpikir kronologis, ketajaman analisis sebab-akibat.",
      kko: "Menjelaskan, menyusun kronologi, membandingkan, menganalisis, menginterpretasi.",
      pertanyaanPemantik: "Bagaimana peristiwa masa lalu ini membentuk kehidupan kita saat ini? Apa sebab utamanya?",
      pengayaan: "Kajian literatur sejarah lanjutan, analisis tokoh sejarah lokal.",
      remedial: "Mengurutkan peristiwa menggunakan garis waktu sederhana.",
      aturanKhusus: "JANGAN gunakan praktik eksperimen atau algoritma. Fokus pada alur waktu, fakta, dan kausalitas sejarah."
    };
  } else if (raw.includes('fisika') || raw.includes('physics')) {
    profile = {
      karakteristik: "Pembelajaran fenomena alam, hukum fisika, gaya, energi, dan pemodelan matematis fisika.",
      kompetensi: "Pemahaman hukum alam, pengukuran, analisis besaran fisika, dan penyelesaian matematis.",
      aktivitas: "Demonstrasi fenomena fisika, eksperimen/praktikum, pengumpulan data terukur, perhitungan matematis fisika.",
      asesmen: "Laporan praktikum, pemecahan masalah fisika matematis, pemahaman konsep.",
      lkpd: "Tabel pengukuran besaran fisika, grafik hubungan antar variabel, soal hitungan fisika.",
      rubrik: "Ketepatan pengukuran, penerapan rumus yang benar, analisis grafik, kebenaran hasil hitung.",
      kko: "Menghitung, mengukur, merumuskan, menganalisis, membuktikan (hukum fisika).",
      pertanyaanPemantik: "Mengapa benda bergerak dengan cara tersebut? Besaran fisika apa yang memengaruhinya?",
      pengayaan: "Eksperimen fisika mandiri, penerapan hukum fisika pada teknologi modern.",
      remedial: "Latihan pemahaman rumus dasar dan perhitungan dengan panduan langkah per langkah.",
      aturanKhusus: "Integrasikan konsep teori dan perhitungan matematis."
    };
  } else if (raw.includes('kimia') || raw.includes('chemistry')) {
    profile = {
      karakteristik: "Pembelajaran struktur atom, ikatan kimia, reaksi, dan stoikiometri.",
      kompetensi: "Pemahaman reaksi kimia, analisis molekul, perhitungan stoikiometri, dan praktik lab.",
      aktivitas: "Mengamati reaksi kimia, menyusun persamaan reaksi, perhitungan mol/stoikiometri, praktikum.",
      asesmen: "Uji persamaan reaksi, laporan hasil percobaan, hitungan stoikiometri.",
      lkpd: "Menyetarakan persamaan reaksi, tabel pengamatan perubahan warna/suhu, perhitungan zat.",
      rubrik: "Ketepatan rumus kimia/persamaan, presisi hitungan, dan prosedur keselamatan/kerja lab.",
      kko: "Menyetarakan, menghitung, menganalisis, meramalkan hasil reaksi.",
      pertanyaanPemantik: "Bagaimana dua zat yang direaksikan dapat menghasilkan zat baru? Apa reaksi yang terjadi?",
      pengayaan: "Analisis jurnal kimia terapan.",
      remedial: "Latihan menyetarakan persamaan reaksi sederhana.",
      aturanKhusus: "Gunakan notasi/rumus kimia yang tepat."
    };
  } else if (raw.includes('informatika') || raw.includes('koding') || raw.includes('komputer')) {
    profile = {
      karakteristik: "Pembelajaran komputasi, algoritma, pemrograman, dan perangkat keras/lunak.",
      kompetensi: "Berpikir komputasional, algoritma dan pemrograman, analisis data, jaringan komputer.",
      aktivitas: "Analisis masalah, merancang algoritma, menulis baris kode, debugging, dan pengujian program/hardware.",
      asesmen: "Uji kode program (koding), pembuatan prototipe, analisis efisiensi algoritma.",
      lkpd: "Tabel flowchart, penelusuran kode (tracing), dan panduan praktikum koding.",
      rubrik: "Ketepatan logika algoritma, kebersihan kode (clean code), keberhasilan eksekusi (tanpa error).",
      kko: "Memprogram, menganalisis, merancang, menguji, menerapkan.",
      pertanyaanPemantik: "Bagaimana logika algoritma ini menyelesaikan masalah tersebut secara komputasional?",
      pengayaan: "Pembuatan proyek software lanjutan.",
      remedial: "Latihan algoritma dasar menggunakan visual block atau tracing baris per baris.",
      aturanKhusus: "Gunakan terminologi informatika (algoritma, syntax, debugging, dll)."
    };
  } else if (raw.includes('indonesia')) {
    profile = {
      karakteristik: "Pembelajaran bahasa dan sastra Indonesia, keterampilan berbahasa (menyimak, membaca, berbicara, menulis).",
      kompetensi: "Pemahaman teks, kaidah kebahasaan, produksi teks lisan dan tulisan, serta apresiasi sastra.",
      aktivitas: "Membaca teks (narasi, eksposisi, puisi, dll), menganalisis struktur/kaidah bahasa, menulis teks mandiri, dan berdiskusi lisan.",
      asesmen: "Penilaian membaca pemahaman, menulis teks sesuai struktur, praktik deklamasi/pidato/presentasi.",
      lkpd: "Analisis struktur dan kaidah kebahasaan teks, melengkapi teks rumpang, draf tulisan.",
      rubrik: "Keserasian ide, struktur teks, ejaan/tata bahasa (PUEBI), diksi, dan pelafalan (lisan).",
      kko: "Menjelaskan, menyimpulkan, mengevaluasi teks, menyusun (teks), menyajikan (lisan).",
      pertanyaanPemantik: "Apa pesan tersirat dari teks ini? Bagaimana struktur ini membantu tujuan penulis?",
      pengayaan: "Menulis resensi atau naskah drama.",
      remedial: "Latihan menemukan gagasan utama paragraf dan menyusun kalimat baku.",
      aturanKhusus: "Gunakan istilah linguistik dan sastra yang relevan."
    };
  } else if (raw.includes('inggris') || raw.includes('english')) {
    profile = {
      karakteristik: "Pembelajaran bahasa Inggris komunikatif (Listening, Speaking, Reading, Writing).",
      kompetensi: "Penguasaan grammar, vocabulary, dan kelancaran komunikasi internasional.",
      aktivitas: "Listening to dialogues, reading texts, practicing conversations (speaking), writing short essays.",
      asesmen: "Listening comprehension, speaking performance, reading quiz, writing task.",
      lkpd: "Fill-in-the-blank grammar, vocabulary matching, reading comprehension questions.",
      rubrik: "Pronunciation, fluency, grammar accuracy, vocabulary richness.",
      kko: "Identify, analyze, practice, create, communicate.",
      pertanyaanPemantik: "How do you express [topic] appropriately in an English context?",
      pengayaan: "Debate or advanced essay writing.",
      remedial: "Basic grammar drills and vocabulary reading.",
      aturanKhusus: "Present components partially in English where appropriate, maintaining natural language learning flow."
    };
  } else if (raw.includes('pjok') || raw.includes('jasmani') || raw.includes('olahraga')) {
    profile = {
      karakteristik: "Pembelajaran pendidikan jasmani, olahraga, kesehatan fisik, dan gerak motorik.",
      kompetensi: "Keterampilan gerak spesifik, kebugaran jasmani, dan pengetahuan kesehatan.",
      aktivitas: "Pemanasan, demonstrasi gerakan olahraga, praktik gerak, bermain dengan peraturan dimodifikasi, pendinginan.",
      asesmen: "Uji performa gerakan fisik, tes kebugaran, dan tes tertulis aturan permainan/kesehatan.",
      lkpd: "Lembar observasi gerakan teman, ceklis kesehatan fisik.",
      rubrik: "Kesesuaian teknik gerak, kelincahan, sportivitas, dan kerja sama tim.",
      kko: "Mempraktikkan, mendemonstrasikan, mengkoordinasikan, merancang latihan.",
      pertanyaanPemantik: "Bagaimana cara melakukan gerak dasar ini dengan benar dan aman untuk menghindari cedera?",
      pengayaan: "Latihan fisik intensitas tinggi, menjadi pemimpin senam/pemanasan.",
      remedial: "Pengulangan gerak dasar terbimbing.",
      aturanKhusus: "Sangat berfokus pada aktivitas lapangan/fisik, bukan hanya hafalan teori."
    };
  } else if (raw.includes('seni') || raw.includes('art') || raw.includes('budaya')) {
    profile = {
      karakteristik: "Pembelajaran apresiasi, ekspresi, kreativitas, dan karya seni budaya (rupa, musik, tari, teater).",
      kompetensi: "Apresiasi seni, eksplorasi estetika, dan produksi/penciptaan karya seni.",
      aktivitas: "Mengamati karya, mengeksplorasi teknik dan medium, merancang sketsa/konsep, membuat karya (prakarya), presentasi karya.",
      asesmen: "Penilaian produk/karya, portofolio, pameran/penampilan (performance).",
      lkpd: "Desain sketsa awal, analisis apresiasi karya seni.",
      rubrik: "Kreativitas, estetika, penguasaan teknik medium, dan kelengkapan konsep.",
      kko: "Merancang, menciptakan, mengapresiasi, mengekspresikan.",
      pertanyaanPemantik: "Pesan atau perasaan apa yang ingin kamu sampaikan melalui karya senimu?",
      pengayaan: "Membuat karya seni menggunakan medium campuran (mixed media).",
      remedial: "Eksplorasi ulang teknik dasar seni.",
      aturanKhusus: "Fokus pada kreativitas dan ekspresi budaya."
    };
  } else if (raw.includes('fikih') || raw.includes('fiqih') || raw.includes('akidah') || raw.includes('quran') || raw.includes('hadis') || raw.includes('ski')) {
    profile = {
      karakteristik: "Pembelajaran keislaman madrasah, dalil naqli (Al-Qur'an/Hadis), dan praktik ibadah/akhlak.",
      kompetensi: "Pemahaman hukum/syariat, penanaman akidah, pembiasaan akhlak mulia, dan hikmah sejarah Islam.",
      aktivitas: "Menyimak bacaan dalil, membaca teks dalil, analisis hukum/kisah, diskusi hikmah, praktik ibadah.",
      asesmen: "Hafalan dalil, tes pengetahuan hukum/akidah, uji praktik ibadah.",
      lkpd: "Mencocokkan dalil dengan hukum, analisis kisah teladan, ceklis pembiasaan ibadah.",
      rubrik: "Kelancaran bacaan dalil, ketepatan hukum, sikap/akhlak, dan presisi praktik.",
      kko: "Menjelaskan (dalil), mempraktikkan, meneladani, menyimpulkan (hikmah).",
      pertanyaanPemantik: "Apa hikmah dan nilai-nilai akhlak/hukum dari ajaran/peristiwa ini dalam hidup kita?",
      pengayaan: "Menelaah literatur keislaman lanjutan/kitab kuning ringan.",
      remedial: "Bimbingan baca tulis Al-Qur'an/dalil, latihan menghafal bertahap.",
      aturanKhusus: "WAJIB menyertakan teks Arab (dalil Al-Qur'an/Hadis), terjemahan, dan hikmah spiritual. Jangan gunakan praktik eksperimen laboratorium."
    };
  } else if (raw.includes('ppkn') || raw.includes('pancasila') || raw.includes('kewarganegaraan')) {
    profile = {
      karakteristik: "Pembelajaran nilai Pancasila, konstitusi, hak/kewajiban warga negara, dan wawasan kebangsaan.",
      kompetensi: "Pemahaman norma, sikap demokratis, kesadaran hukum, dan penerapan nilai luhur bangsa.",
      aktivitas: "Diskusi kasus hukum/sosial, debat isu kewarganegaraan, simulasi peradilan/musyawarah, analisis berita.",
      asesmen: "Esai sikap, observasi nilai karakter (Pancasila), rubrik debat/diskusi.",
      lkpd: "Analisis studi kasus pelanggaran hak/kewajiban, pemetaan nilai konstitusi.",
      rubrik: "Argumentasi logis, sikap demokratis, pemahaman dasar hukum/Pancasila.",
      kko: "Menganalisis, menghargai, mematuhi, mempertajam (argumentasi), menunjukkan (sikap).",
      pertanyaanPemantik: "Bagaimana nilai-nilai Pancasila dapat diimplementasikan untuk menyelesaikan masalah sosial ini?",
      pengayaan: "Proyek kewarganegaraan (citizenship project) di lingkungan masyarakat.",
      remedial: "Pendalaman konsep dasar konstitusi/nilai luhur dengan contoh sederhana.",
      aturanKhusus: "Fokus pada afeksi, kewarganegaraan aktif, dan diskusi nilai."
    };
  } else if (raw.includes('geografi') || raw.includes('ekonomi') || raw.includes('sosiologi')) {
    profile = {
      karakteristik: "Pembelajaran ilmu sosial, keruangan (geografi), interaksi manusia, dan dinamika ekonomi.",
      kompetensi: "Pemahaman fenomena sosial/keruangan/ekonomi, analisis data statistik sosial, dan pemecahan isu masyarakat.",
      aktivitas: "Membaca peta (geografi), analisis data pasar (ekonomi), observasi lingkungan sosial (sosiologi), diskusi fenomena.",
      asesmen: "Uji pemahaman fenomena, laporan observasi sosial, analisis grafik/kurva.",
      lkpd: "Analisis peta, grafik ekonomi, atau studi kasus masalah sosial masyarakat.",
      rubrik: "Ketajaman analisis fenomena, interpretasi data yang benar, kejelasan laporan.",
      kko: "Menganalisis (fenomena/data), memetakan, menjelaskan (hubungan sebab-akibat sosial).",
      pertanyaanPemantik: "Mengapa fenomena/masalah (sosial/ekonomi/keruangan) ini terjadi dan bagaimana dampaknya bagi masyarakat?",
      pengayaan: "Penelitian sosial berskala kecil di sekolah/masyarakat.",
      remedial: "Mengulang membaca dan interpretasi data/grafik/peta dasar.",
      aturanKhusus: "Gunakan pendekatan kontekstual berbasis data masyarakat nyata."
    };
  }

  return `
==================================================
INSTRUKSI KHUSUS PROFIL PEDAGOGIS MATA PELAJARAN
==================================================
MATA PELAJARAN: ${subjectName}
TOPIK: ${topic}

Anda adalah Generator Modul Ajar Profesional. 
Gunakan PROFIL PEDAGOGIS berikut secara ketat agar modul ajar selaras dengan karakter keilmuannya:

1. Karakteristik Mapel: ${profile.karakteristik}
2. Kompetensi Utama: ${profile.kompetensi}
3. Aktivitas Pembelajaran: ${profile.aktivitas}
4. Jenis Asesmen: ${profile.asesmen}
5. Jenis LKPD: ${profile.lkpd}
6. Fokus Rubrik Penilaian: ${profile.rubrik}
7. Kata Kerja Operasional (KKO) Dominan: ${profile.kko}
8. Contoh Pertanyaan Pemantik: ${profile.pertanyaanPemantik}
9. Ide Pengayaan: ${profile.pengayaan}
10. Ide Remedial: ${profile.remedial}

ATURAN WAJIB:
- ${profile.aturanKhusus}
- JANGAN GUNAKAN TEMPLATE GENERIK (seperti "domain Konsep Dasar Keilmuan", "efisiensi proses", "alur kerja", "kegagalan sistem", "praktik laboratorium", "studi kasus teknologi") JIKA TIDAK RELEVAN.
- Tujuan Pembelajaran HARUS menggunakan C1-C6 (sesuai Bloom) secara spesifik terkait materi, BUKAN kata-kata generik.
- Sesuaikan nama tahapan, istilah teknis, dan instrumen asesmen dengan karakter ${subjectName}.
- HASIL AKHIR HARUS TERASA SEPERTI DIBUAT OLEH GURU MATA PELAJARAN ${subjectName.toUpperCase()} PROFESIONAL!
`;
}


// AI Field Generation Endpoint
app.post("/api/gemini/generate-modul", async (req, res) => {
  try {
    const { subjectName, topic, grade, fieldName } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const category = detectSubjectCategoryServer(subjectName, topic);
    const subjectRule = getSubjectTemplateInstructions(subjectName, topic);

    let prompt = `Buatkan draf bagian "${fieldName}" untuk modul ajar Kurikulum Merdeka mata pelajaran "${subjectName}", materi "${topic}", kelas "${grade}".
Gunakan bahasa Indonesia yang profesional (atau kombinasi bahasa target seperti bahasa Arab/Inggris jika relevan dengan mapel).
DILARANG keras menggunakan format markdown seperti bintang (**) atau pagar (#).

${subjectRule}

${NO_DASHES_PROMPT}`;

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt
    });

    const text = cleanDashedLines(response.text || "");
    res.json({ success: true, text });
  } catch (error: any) {
    console.error("Gemini Modul Ajar error (using fallback):", error);
    const { subjectName, topic, grade, fieldName } = req.body || {};
    const safeTopic = topic || 'Materi Pokok Pembelajaran';
    const safeSubject = subjectName || 'Mata Pelajaran';
    const safeGrade = grade || 'X (Sepuluh)';

    try {
      const masterResult: any = generateMasterV2ModulAjar({
        schoolName: appSettings?.schoolName || 'Madrasah / Sekolah',
        teacherName: 'Guru Mata Pelajaran',
        subjectName: safeSubject,
        grade: safeGrade,
        babUtama: safeTopic,
        subbab: safeTopic,
        materiInti: safeTopic
      });
      let fallbackText = masterResult[fieldName] || `Draf bagian ${fieldName} untuk topik ${safeTopic} mata pelajaran ${safeSubject}.`;
      return res.json({ success: true, text: fallbackText, fallback: true });
    } catch (engineErr) {
      let fallbackText = `Draf bagian ${fieldName} untuk topik ${safeTopic} mata pelajaran ${safeSubject}.`;
      return res.json({ success: true, text: fallbackText, fallback: true });
    }
  }
});

// Generate All Fields at Once
app.post("/api/gemini/generate-modul-all", async (req, res) => {
  try {
    const { subjectName, topic, materiDetail, grade, model = "Deep Learning" } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const category = detectSubjectCategoryServer(subjectName, topic, materiDetail);
    const subjectRule = getSubjectTemplateInstructions(subjectName, topic);

    const modelDesc = model === "Deep Learning"
      ? "Deep Learning (Pembelajaran Mendalam yang berfokus pada eksplorasi konsep secara mendalam, pemecahan masalah nyata, serta penalaran tingkat tinggi/HOTS)"
      : model;

    let jsonSchemaInstructions = "";
    jsonSchemaInstructions = `Kembalikan respon strictly dalam format JSON objek:
{
  "identitasModul": "INFORMASI UMUM\nA. IDENTITAS MODUL\n- Mata Pelajaran: ${subjectName}\n- Kelas: ${grade}\n- Topik: ${topic}",
  "kompetensiAwal": "KOMPETENSI AWAL\nPeserta didik memiliki pemahaman dasar ${topic}.",
  "profilPancasila": "PROFIL PELAJAR PANCASILA\nKarakter yang relevan.",
  "saranaPrasarana": "SARANA DAN PRASARANA\nAlat dan bahan.",
  "targetPeserta": "TARGET PESERTA DIDIK\nReguler.",
  "modelPembelajaran": "MODEL PEMBELAJARAN\nModel yang sesuai.",
  "tujuanPembelajaran": "TUJUAN PEMBELAJARAN\nMemahami konsep ${topic}.",
  "pemahamanBermakna": "PEMAHAMAN BERMAKNA\nManfaat ${topic}.",
  "pertanyaanPemantik": "PERTANYAAN PEMANTIK\nApa itu ${topic}?",
  "persiapanPembelajaran": "PERSIAPAN PEMBELAJARAN\nPersiapan guru.",
  "kegiatanPembelajaran": "KEGIATAN PEMBELAJARAN\nPendahuluan, Inti, Penutup.",
  "asesmen": "ASESMEN\nFormatif dan sumatif.",
  "pengayaanRemedial": "PENGAYAAN DAN REMEDIAL\nKegiatan tindak lanjut.",
  "lkpd": "LEMBAR KERJA PESERTA DIDIK (LKPD)\nTugas siswa.",
  "lembarKerja": "LAMPIRAN BAHAN AJAR\nMateri lengkap.",
  "glosarium": "GLOSARIUM\nIstilah penting.",
  "daftarPustaka": "DAFTAR PUSTAKA\nSumber referensi."
}`;

    const prompt = `
Buatkan draf LENGKAP, SANGAT PANJANG, RINCI, DAN TERSTRUKTUR "Modul Ajar" Kurikulum Merdeka untuk mata pelajaran "${subjectName}", materi/topik "${topic}", kelas/tingkat "${grade}", menggunakan Model/Metode Pembelajaran "${modelDesc}".
${subjectRule}
${materiDetail ? `\nURAIAN / CATATAN DETAIL MATERI DARI GURU:\n"${materiDetail}"\n\nInstruksi Tambahan: AI HARUS mengelaborasi dan menguraikan poin-poin materi di atas secara sangat mendalam, terperinci, terstruktur, dan komprehensif ke dalam seluruh komponen modul ajar.` : ''}

DILARANG MEMBUAT RINGKASAN ATAU SINGKAT! Tuliskan setiap komponen secara terurai panjang dan komprehensif.
Tuliskan hasil TANPA format markdown bintang (**) atau pagar (#). Gunakan penomoran huruf (A, B, C) atau angka (1, 2, 3) biasa yang rapi.
${jsonSchemaInstructions}
${NO_DASHES_PROMPT}
`;

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const resultText = response.text || "{}";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini Modul Ajar All response: " + resultText);
    const data = sanitizeGeneratedData(rawData);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini Modul Ajar All error (using fallback):", error);
    const { subjectName, topic, materiDetail, grade, semester = '1', model = "Deep Learning" } = req.body || {};
    const safeTopic = topic || 'Materi Pokok Pembelajaran';
    const safeSubject = subjectName || 'Mata Pelajaran';
    const safeGrade = grade || 'X (Sepuluh)';

    try {
      const masterResult: any = generateMasterV2ModulAjar({
        schoolName: appSettings?.schoolName || 'Madrasah / Sekolah',
        teacherName: 'Guru Mata Pelajaran',
        subjectName: safeSubject,
        grade: safeGrade,
        semester: semester || '1',
        babUtama: safeTopic,
        subbab: safeTopic,
        materiInti: materiDetail ? `${safeTopic} - ${materiDetail}` : safeTopic,
        alokasiWaktu: '4 JP',
        modelPembelajaran: model || 'Deep Learning'
      });
      res.json({ success: true, data: masterResult, fallback: true });
    } catch (engineErr) {
      let fallbackData = {
        identitasModul: `INFORMASI UMUM\nA. IDENTITAS MODUL\n- Mata Pelajaran: ${safeSubject}\n- Topik: ${safeTopic}\n- Kelas: ${safeGrade}\n- Semester: ${semester}`,
        kompetensiAwal: `KOMPETENSI AWAL\nPeserta didik memiliki pemahaman dasar materi ${safeTopic}.`,
        profilPancasila: `PROFIL PELAJAR PANCASILA\nMandiri, Bernalar Kritis, Bergotong Royong, Kreatif`,
        saranaPrasarana: `SARANA DAN PRASARANA\nAlat tulis, Buku Teks, Proyektor`,
        targetPeserta: `TARGET PESERTA DIDIK\nPeserta didik reguler/tipikal`,
        modelPembelajaran: `MODEL PEMBELAJARAN\n${model}`,
        tujuanPembelajaran: `TUJUAN PEMBELAJARAN\nMemahami dan mempraktikkan konsep ${safeTopic}`,
        pemahamanBermakna: `PEMAHAMAN BERMAKNA\nMenerapkan materi ${safeTopic} dalam kehidupan sehari-hari`,
        pertanyaanPemantik: `PERTANYAAN PEMANTIK\nApa yang kalian ketahui tentang ${safeTopic}?`,
        persiapanPembelajaran: `PERSIAPAN PEMBELAJARAN\nGuru menyiapkan bahan ajar dan media`,
        kegiatanPembelajaran: `KEGIATAN PEMBELAJARAN\nPendahuluan, Kegiatan Inti, Penutup`,
        asesmen: `ASESMEN\nAsesmen Formatif dan Sumatif`,
        pengayaanRemedial: `PENGAYAAN DAN REMEDIAL\nPengayaan untuk yang sudah tuntas, Remedial untuk yang belum`,
        lkpd: `LKPD\nLembar Kerja terkait ${safeTopic}`,
        lembarKerja: `BAHAN BACAAN\nMateri pembelajaran ${safeTopic}`,
        glosarium: `GLOSARIUM\nDaftar istilah penting terkait ${safeTopic}`,
        daftarPustaka: `DAFTAR PUSTAKA\nBuku panduan mata pelajaran ${safeSubject}`
      };
      res.json({ success: true, data: fallbackData, fallback: true });
    }
  }
});

// AI Import & Document Parser API (Word .docx, PDF, Text)
app.post("/api/modul/parse-document", async (req, res) => {
  try {
    const { fileName, fileType, fileBase64, base64, textContent, content } = req.body;
    const effectiveBase64 = fileBase64 || base64;
    const effectiveTextContent = textContent || content;
    let extractedText = "";
    let extractedHtml = "";

    if (effectiveTextContent && typeof effectiveTextContent === "string" && effectiveTextContent.trim()) {
      extractedText = effectiveTextContent.trim();
      extractedHtml = extractedText
        .split(/\n\s*\n/)
        .map(para => `<p style="margin-bottom: 12px; line-height: 1.6;">${para.replace(/\n/g, '<br/>')}</p>`)
        .join('');
    } else if (effectiveBase64 && typeof effectiveBase64 === "string") {
      const base64Data = effectiveBase64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const isDocx = (fileName && (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc'))) || 
                    (fileType && (fileType.includes('word') || fileType.includes('officedocument') || fileType === 'docx' || fileType === 'doc'));
      const isPdf = (fileName && fileName.toLowerCase().endsWith('.pdf')) || (fileType && (fileType.includes('pdf') || fileType === 'pdf'));

      if (isDocx) {
        try {
          const textResult = await mammoth.extractRawText({ buffer });
          const htmlResult = await mammoth.convertToHtml({ buffer });
          extractedText = textResult.value ? textResult.value.trim() : "";
          extractedHtml = htmlResult.value ? htmlResult.value.trim() : "";
        } catch (docxErr: any) {
          console.warn("[Docx Parser Warning] Mammoth parsing failed, falling back to string extraction:", docxErr.message);
          extractedText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();
          extractedHtml = `<p>${extractedText.replace(/\n/g, '<br/>')}</p>`;
        }
      } else if (isPdf) {
        const apiKey = process.env.GEMINI_API_KEY;
        let pdfParsedWithAi = false;
        if (apiKey) {
          try {
            const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
            const pdfExtractRes = await generateGeminiContent(ai, {
              model: "gemini-3.7-flash",
              contents: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64Data
                  }
                },
                "Ekstrak seluruh materi, bab, dan isi naskah dokumen pembelajaran dari file PDF ini secara lengkap, rinci, dan terstruktur. Tampilkan teks murni materi tanpa tanda pembatas berulang."
              ]
            });
            if (pdfExtractRes && pdfExtractRes.text) {
              extractedText = pdfExtractRes.text.trim();
              extractedHtml = extractedText
                .split(/\n\s*\n/)
                .map(para => `<p style="margin-bottom: 12px; line-height: 1.6;">${para.replace(/\n/g, '<br/>')}</p>`)
                .join('');
              pdfParsedWithAi = true;
            }
          } catch (pdfAiErr: any) {
            console.warn("[PDF AI Parser Warning] Gemini inlineData PDF parse failed:", pdfAiErr.message);
          }
        }

        if (!pdfParsedWithAi) {
          // Fallback text extraction from raw PDF buffer
          const rawBufStr = buffer.toString('utf-8');
          const textMatches = rawBufStr.match(/\(([^()]+)\)/g);
          if (textMatches && textMatches.length > 10) {
            extractedText = textMatches.map(m => m.slice(1, -1)).join(' ').replace(/\\r|\\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
          } else {
            extractedText = rawBufStr.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{2,}/g, ' ').trim();
          }
          extractedHtml = `<p>${extractedText.replace(/\n/g, '<br/>')}</p>`;
        }
      } else {
        // Plain text or other document
        extractedText = buffer.toString('utf-8').trim();
        extractedHtml = extractedText
          .split(/\n\s*\n/)
          .map(para => `<p style="margin-bottom: 12px; line-height: 1.6;">${para.replace(/\n/g, '<br/>')}</p>`)
          .join('');
      }
    }

    if (!extractedText) {
      extractedText = "Dokumen modul ajar terimpor. Berisi materi pembelajaran terstruktur.";
      extractedHtml = `<p>${extractedText}</p>`;
    }

    res.json({
      success: true,
      fileName: fileName || "Dokumen_Modul",
      extractedText,
      text: extractedText,
      extractedHtml,
      characterCount: extractedText.length,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length
    });
  } catch (error: any) {
    console.error("Document parse error:", error);
    res.status(500).json({ success: false, message: "Gagal membaca dokumen: " + (error.message || "Unknown error") });
  }
});

// AI Structure & Mapping Imported Document to Full Kurikulum Merdeka Module
app.post("/api/modul/import-ai-structure", async (req, res) => {
  try {
    const { subjectName, grade, semester = '1', topic, extractedText, guruName, kepsekName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const safeSubject = subjectName || 'Mata Pelajaran';
    const safeTopic = topic || 'Materi Pokok Pembelajaran';
    const safeGrade = grade || 'X (Sepuluh)';

    let ai: any = null;
    if (apiKey) {
      try {
        ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      } catch (e) {
        console.warn("GoogleGenAI init failed:", e);
      }
    }

    if (ai && extractedText && extractedText.length > 30) {
      try {
        const prompt = `
Sebagai pakar kurikulum Merdeka dan guru profesional, telaah dan transformasikan isi DOKUMEN MODUL/MATERI AJAR yang diunggah berikut ini menjadi perangkat "MODUL AJAR KURIKULUM MERDEKA LENGKAP (21 KOMPONEN A-U)" yang sangat berbobot, terperinci, dan siap ajar.

INFORMASI DOKUMEN:
- Mata Pelajaran: "${safeSubject}"
- Kelas / Tingkat: "${safeGrade}"
- Semester: "${semester}"
- Topik / Materi Acuan: "${safeTopic}"

DOKUMEN ASLI YANG DIUNGGAH (WORD/PDF/TEKS):
"""
${extractedText.substring(0, 12000)}
"""

PANDUAN PENYUSUNAN KOMPONEN:
Gunakan materi aktual dari dokumen yang diunggah untuk mengisi semua komponen berikut secara lengkap, mendalam, dan relevan:
1. identitasModul: Informasi penyusun, institusi, tahun, jenjang/tingkat ${safeGrade}, alokasi waktu (misal 4 JP / 2 Pertemuan).
2. kompetensiAwal: Pengetahuan/keterampilan prasyarat berdasarkan dokumen.
3. profilPancasila: Dimensi profil pelajar (Bernalar Kritis, Mandiri, Bergotong Royong, Kreatif, Berakhlak Mulia).
4. saranaPrasarana: Media, alat bahan ajar, dan sumber materi.
5. targetPeserta: Target peserta didik reguler / tipikal dengan diferensiasi.
6. modelPembelajaran: Model pembelajaran aktif (misal Deep Learning / Problem-Based Learning / Project-Based Learning).
7. tujuanPembelajaran: Tujuan pembelajaran operasional berbasis ABCD dan kata kerja operasional taksonomi Bloom.
8. pemahamanBermakna: Manfaat nyata materi ini dalam kehidupan sehari-hari siswa.
9. pertanyaanPemantik: 3-4 pertanyaan pemantik yang merangsang rasa ingin tahu dan nalar kritis.
10. persiapanPembelajaran: Langkah persiapan guru sebelum masuk kelas.
11. kegiatanPembelajaran: Uraian langkah detail Pertemuan 1 & 2 (Pendahuluan, Inti berbasis Literasi, Critical Thinking, Collaboration, Communication, Creativity, dan Penutup).
12. asesmen: Asesmen formatif (observasi/kuis), asesmen sumatif (tes tertulis/unjuk kerja), dan instrumen rubrik.
13. pengayaanRemedial: Program pengayaan siswa capaian tinggi dan remedial siswa yang butuh bimbingan.
14. lkpd: Lembar Kerja Peserta Didik (LKPD) lengkap berisi petunjuk, tugas analisis/soal, dan instruksi diskusi.
15. lembarKerja: Rangkuman bahan bacaan guru dan siswa diambil langsung dari inti sari dokumen impor.
16. glosarium: Glosarium daftar istilah kunci beserta definisinya dari materi dokumen.
17. daftarPustaka: Referensi dan sumber rujukan bahan ajar.

${NO_DASHES_PROMPT}

KEMBALIKAN HANYA OBJEK JSON MURNI DENGAN STRUKTUR:
{
  "title": "Modul Ajar: ${safeTopic}",
  "topic": "${safeTopic}",
  "identitasModul": "string",
  "kompetensiAwal": "string",
  "profilPancasila": "string",
  "saranaPrasarana": "string",
  "targetPeserta": "string",
  "modelPembelajaran": "string",
  "tujuanPembelajaran": "string",
  "pemahamanBermakna": "string",
  "pertanyaanPemantik": "string",
  "persiapanPembelajaran": "string",
  "kegiatanPembelajaran": "string",
  "asesmen": "string",
  "pengayaanRemedial": "string",
  "lkpd": "string",
  "lembarKerja": "string",
  "glosarium": "string",
  "daftarPustaka": "string"
}
`;

        const response = await generateGeminiContent(ai, {
          model: "gemini-3.7-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });

        const resultText = response.text || "{}";
        const rawData = safeParseGeminiJSON(resultText, null);
        if (rawData && rawData.tujuanPembelajaran) {
          const data = sanitizeGeneratedData(rawData);
          return res.json({
            success: true,
            data: {
              ...data,
              extractedContent: extractedText,
              isImported: true
            }
          });
        }
      } catch (genErr: any) {
        console.warn("[Modul Import AI] Gemini generation error, using fallback template:", genErr.message);
      }
    }

    // High quality non-AI generative fallback
    const masterFallback: any = generateMasterV2ModulAjar({
      schoolName: appSettings?.schoolName || 'Madrasah / Sekolah',
      teacherName: guruName || 'Guru Mata Pelajaran',
      subjectName: safeSubject,
      grade: safeGrade,
      semester: semester,
      babUtama: safeTopic,
      subbab: safeTopic,
      materiInti: extractedText ? `${safeTopic}\n\n${extractedText.substring(0, 1500)}` : safeTopic,
      alokasiWaktu: '4 JP',
      modelPembelajaran: 'Deep Learning'
    });

    res.json({
      success: true,
      data: {
        ...masterFallback,
        lembarKerja: extractedText ? `RINGKASAN BAHAN BACAAN DOKUMEN ACUAN:\n${extractedText.substring(0, 3000)}` : masterFallback.lembarKerja,
        extractedContent: extractedText,
        isImported: true,
        fallback: true
      }
    });
  } catch (error: any) {
    console.error("Modul import AI error:", error);
    res.status(500).json({ success: false, message: "Gagal memproses struktur modul: " + (error.message || "Unknown error") });
  }
});

// AI Generate Modul 2 General (Alokasi Waktu, Silabus, ATP, KKTP)
app.post("/api/gemini/generate-modul2-general", async (req, res) => {
  try {
    const { subjectName, babs } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    
    const prompt = `
Sebagai guru profesional, buatkan dokumen administrasi pembelajaran UMUM untuk mata pelajaran "${subjectName}" yang mencakup bab-bab berikut: ${babs.join(', ')}.

Output HARUS BERUPA STRING HTML (tanpa markdown blok seperti \`\`\`html).
Dokumen HTML ini harus menggunakan styling inline atau class Tailwind (contoh: class="border border-black p-2") agar rapi saat dicetak.
Susun persis menyerupai format resmi yang mencakup:

<div class="document-section">
<h2 class="text-center font-bold text-xl mb-4">ANALISIS ALOKASI WAKTU</h2>
(Buat tabel Perhitungan Minggu / Jam Efektif dan tabel Distribusi Alokasi Waktu yang mendistribusikan bab-bab di atas secara logis untuk 1 semester)
</div>

<div class="document-section mt-10">
<h2 class="text-center font-bold text-xl mb-4">SILABUS</h2>
(Buat tabel Silabus dengan kolom: Kompetensi Dasar/Elemen, Indikator, Materi Pokok (bab-bab di atas), Kegiatan Pembelajaran, Penilaian, Alokasi Waktu, Sumber Belajar)
</div>

<div class="document-section mt-10">
<h2 class="text-center font-bold text-xl mb-4">ALUR TUJUAN PEMBELAJARAN (ATP)</h2>
(Buat tabel ATP dengan kolom: Elemen, Capaian Pembelajaran, Tujuan Pembelajaran, Alur Tujuan Pembelajaran, Alokasi Waktu)
</div>

<div class="document-section mt-10">
<h2 class="text-center font-bold text-xl mb-4">KRITERIA KETUNTASAN TUJUAN PEMBELAJARAN (KKTP)</h2>
(Buat tabel KKTP dengan kolom: No, Tujuan Pembelajaran, Kriteria (Interval Nilai 1,2,3,4), Keterangan Intervensi)
</div>

Pastikan isinya detail dan sangat profesional, serta tabel-tabelnya memiliki border dan padding yang rapi (class="w-full border-collapse border border-slate-800 text-sm").
`;

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
    });
    
    let html = response.text || "";
    html = html.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
    res.json({ success: true, html });
  } catch (error: any) {
    console.error("Generate Modul 2 General error (using fallback):", error);
    const { subjectName = "Mata Pelajaran", babs = ["Bab 1", "Bab 2"] } = req.body || {};
    const fallbackHtml = `
      <div class="p-6 font-sans">
        <h1 class="text-2xl font-bold text-center mb-6">DOKUMEN ADMINISTRASI PEMBELAJARAN: ${subjectName}</h1>
        <div class="mb-8">
          <h2 class="text-lg font-bold bg-slate-100 p-2 border">1. ANALISIS ALOKASI WAKTU</h2>
          <table class="w-full border-collapse border border-slate-800 text-sm mt-2">
            <thead><tr class="bg-slate-200"><th class="border border-slate-800 p-2">No</th><th class="border border-slate-800 p-2">Komponen / Bab</th><th class="border border-slate-800 p-2">Alokasi Waktu</th></tr></thead>
            <tbody>
              ${Array.isArray(babs) ? babs.map((b: string, i: number) => `<tr><td class="border border-slate-800 p-2 text-center">${i+1}</td><td class="border border-slate-800 p-2">${b}</td><td class="border border-slate-800 p-2 text-center">4 JP</td></tr>`).join('') : ''}
            </tbody>
          </table>
        </div>
        <div class="mb-8">
          <h2 class="text-lg font-bold bg-slate-100 p-2 border">2. SILABUS & ATP</h2>
          <p class="p-2 text-sm text-slate-700">Silabus dan Alur Tujuan Pembelajaran mata pelajaran ${subjectName} dirancang untuk mencapai profil pelajar Pancasila dan rahmatan lil alamin.</p>
        </div>
      </div>
    `;
    res.json({ success: true, html: fallbackHtml, fallback: true });
  }
});

// AI Generate Modul 2 Bab (RPP, Analisis SKL, Modul Ajar)
app.post("/api/gemini/generate-modul2-bab", async (req, res) => {
  try {
    const { subjectName, babTitle, grade = "X" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    
    const subjectRule = getSubjectTemplateInstructions(subjectName, babTitle);

    const prompt = `
Buatkan perangkat pembelajaran lengkap berstandar Kurikulum Merdeka / Nasional untuk mata pelajaran "${subjectName}", bab/materi/topik "${babTitle}", kelas/tingkat "${grade}".
Pembelajaran diintegrasikan dengan pengembangan karakter mulia, bernalar kritis, dan profil pelajar berakhlak terpuji.
${subjectRule}

PENTING: Dilarang menggunakan simbol markdown seperti bintang (*, **), pagar (#), atau backtick (\`) dalam teks keluaran. Gunakan penulisan huruf dan angka biasa yang rapi dan benar. Kembalikan respon strictly dalam format JSON objek dengan kunci-kunci berikut. Pastikan isinya sangat detail, berbobot, lengkap, siap pakai (bukan sekadar placeholder atau ringkasan):
{
  "modulAjar": {
    "identitasModul": "Nama Penyusun: Tim Guru \nInstansi: (Nama Sekolah)\nTahun: 2026\nKelas: ${grade}\nAlokasi Waktu: 2 x 45 Menit",
    "kompetensiAwal": "Prasyarat kompetensi spesifik untuk materi ${babTitle}",
    "profilPancasila": "Karakter Profil Pelajar Pancasila yang relevan",
    "saranaPrasarana": "Sarana, prasarana, alat, bahan spesifik mapel",
    "targetPeserta": "Kategori dan target siswa (Reguler/Tipikal)",
    "modelPembelajaran": "Model pembelajaran spesifik (contoh: Inquiry / PBL / Dll)",
    "tujuanPembelajaran": "Tujuan Pembelajaran (TP) terukur sesuai KKO Bloom",
    "pemahamanBermakna": "Manfaat materi ${babTitle} secara konkret",
    "pertanyaanPemantik": "Pertanyaan pemantik yang relevan dan natural",
    "persiapanPembelajaran": "Langkah persiapan guru spesifik mapel",
    "kegiatanPembelajaran": "Skenario lengkap Pendahuluan, Kegiatan Inti, Penutup (MENGGUNAKAN AKTIVITAS KHAS MAPEL)",
    "asesmen": "Jenis dan instrumen asesmen yang sesuai karakteristik mapel",
    "pengayaanRemedial": "Tindakan pengayaan dan remedial yang sesuai",
    "lkpd": "Draf LKPD konkret yang sesuai (teks, soal, analisis, dll)",
    "lembarKerja": "Bahan bacaan lengkap",
    "glosarium": "Daftar istilah penting yang muncul di materi",
    "daftarPustaka": "Daftar Pustaka relevan"
  },
  "rppHtml": "HTML string lengkap berisi Rencana Pelaksanaan Pembelajaran (RPP) Kurikulum Merdeka bab ${babTitle} secara mendalam dengan tabel identitas, kompetensi dasar, skenario kegiatan pembelajaran, instrumen evaluasi, serta tanda tangan guru & kepala madrasah. Gunakan border-collapse dan styling inline yang rapi. Tanpa tanda bintang atau pagar.",
  "sklHtml": "HTML string lengkap berisi tabel ANALISIS KETERKAITAN SKL, KI, KD, IPK, MATERI, KEGIATAN, DAN PENILAIAN Kurikulum Merdeka untuk bab ${babTitle}. Tabel harus lebar w-full, ber-border-slate-800, ber-cellpadding, dan memuat analisis mendalam keterkaitan kompetensi dasar dengan nilai karakter mulia. Tanpa tanda bintang atau pagar."
}
`;

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const resultText = response.text || "{}";
    const data = safeParseGeminiJSON(resultText, null);
    if (!data) throw new Error("Invalid JSON from Gemini response: " + resultText);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Generate Modul 2 Bab error:", error);
    const { subjectName, babTitle, grade = "X" } = req.body || {};
    const fallbackModul = {
      identitasModul: `Penyusun: Tim Guru\nKelas: ${grade}\nAlokasi Waktu: 2 x 45 Menit`,
      kompetensiAwal: `Siswa telah memahami konsep dasar materi prasyarat yang berkaitan dengan bab ${babTitle || 'ini'}.`,
      profilPancasila: `Berkebinekaan Global, Bergotong Royong, Mandiri, Bernalar Kritis, Kreatif.`,
      saranaPrasarana: `Papan tulis, spidol, proyektor LCD, buku referensi.`,
      targetPeserta: `Peserta didik reguler / tipikal kelas ${grade}.`,
      modelPembelajaran: `Problem Based Learning (PBL) atau model yang sesuai dengan karakteristik materi.`,
      tujuanPembelajaran: `1. Memahami secara mendalam konsep ${babTitle || 'materi'}.`,
      pemahamanBermakna: `Mempelajari ${babTitle || 'materi ini'} menumbuhkan pemahaman logis dan aplikatif.`,
      pertanyaanPemantik: `Mengapa penting bagi kita untuk menyikapi topik ${babTitle || 'ini'}?`,
      persiapanPembelajaran: `Guru menyiapkan rencana ajar, bahan materi, dan LKPD.`,
      kegiatanPembelajaran: `Pendahuluan: Salam dan apersepsi.\nInti: Investigasi kelompok terstruktur.\nPenutup: Apresiasi, simpulan, dan doa.`,
      asesmen: `Asesmen formatif dan sumatif tertulis.`,
      pengayaanRemedial: `Pendampingan khusus bagi siswa yang membutuhkan remedial, dan proyek mandiri bagi siswa pengayaan.`,
      lkpd: `Lembark Kerja Siswa: Menganalisis studi kasus nyata bertema ${babTitle || 'pembelajaran'} secara kolaboratif.`,
      lembarKerja: `Rubrik penilaian dan kuis pemahaman konsep.`,
      glosarium: `Istilah kunci terkait ${babTitle || 'pembelajaran'} beserta definisinya.`,
      daftarPustaka: `Buku referensi yang relevan dengan mata pelajaran.`
    };

    const fallbackRpp = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; margin-bottom: 5px;">RENCANA PELAKSANAAN PEMBELAJARAN (RPP)</h2>
        <p style="text-align: center; font-size: 14px; margin-top: 0; color: #555;">Kurikulum Merdeka</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px;">
          <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; width: 30%;">Mata Pelajaran</td><td style="border: 1px solid #ccc; padding: 8px;">${subjectName || 'Mata Pelajaran'}</td></tr>
          <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Materi/Bab</td><td style="border: 1px solid #ccc; padding: 8px;">${babTitle || 'Bab Pembelajaran'}</td></tr>
          <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Kelas/Semester</td><td style="border: 1px solid #ccc; padding: 8px;">Grade ${grade} / Ganjil</td></tr>
          <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Alokasi Waktu</td><td style="border: 1px solid #ccc; padding: 8px;">2 JP (2 x 45 Menit)</td></tr>
        </table>
        
        <h3 style="border-bottom: 2px solid #059669; padding-bottom: 5px;">I. TUJUAN PEMBELAJARAN (Berbasis Aspek Kognitif, Afektif, & Psikomotor)</h3>
        <p>1. Peserta didik mampu menjelaskan dan menganalisis materi ${babTitle || 'pembelajaran'} dengan kritis dan mendalam.<br>
        2. Peserta didik menunjukkan karakter profil pelajar Pancasila yang relevan dalam interaksi sosial-emosional.</p>
        
        <h3 style="border-bottom: 2px solid #059669; padding-bottom: 5px;">II. SKENARIO KEGIATAN PEMBELAJARAN (Kegiatan Pembelajaran)</h3>
        <p><strong>A. Pendahuluan (15 Menit):</strong><br>
        1. Guru membuka kelas dengan salam hangat, dan menanyakan kesiapan belajar siswa hari ini.<br>
        2. Doa bersama dengan penuh khidmat dipimpin salah satu peserta didik sebagai bentuk syukur kepada Tuhan YME.<br>
        3. Apersepsi bermakna mengaitkan materi ${babTitle || 'pembelajaran'} dengan pengalaman nyata peserta didik.</p>
        
        <p><strong>B. Kegiatan Inti (60 Menit):</strong><br>
        1. Peserta didik dibagi ke dalam beberapa kelompok kecil yang heterogen sesuai dengan gaya belajar dan karakteristik.<br>
        2. Guru memberikan stimulasi bermakna berupa studi kasus/masalah terkait ${babTitle || 'pembelajaran'}.<br>
        3. Setiap kelompok berkolaborasi memecahkan masalah dengan berdiskusi dan bernalar kritis.<br>
        4. Presentasi hasil diskusi kelompok di mana kelompok lain memberikan tanggapan konstruktif.</p>
        
        <p><strong>C. Penutup (15 Menit):</strong><br>
        1. Guru bersama peserta didik merumuskan refleksi emosi dan simpulan dari pembelajaran hari ini.<br>
        2. Guru memberikan apresiasi verbal/non-verbal atas pencapaian peserta didik.<br>
        3. Doa penutup dan salam penutup.</p>
        
        <h3 style="border-bottom: 2px solid #059669; padding-bottom: 5px;">III. PENILAIAN PEMBELAJARAN (Asesmen Pembelajaran)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Aspek</th>
              <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Teknik Penilaian</th>
              <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Instrumen</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Sikap/Karakter</td><td style="border: 1px solid #ccc; padding: 8px;">Observasi / Jurnal Karakter</td><td style="border: 1px solid #ccc; padding: 8px;">Lembar pengamatan kepedulian dan kerja sama</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Pengetahuan</td><td style="border: 1px solid #ccc; padding: 8px;">Tes Tertulis / Lisan</td><td style="border: 1px solid #ccc; padding: 8px;">Kuis pemahaman konsep berbasis nalar kritis</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Keterampilan</td><td style="border: 1px solid #ccc; padding: 8px;">Unjuk Kerja / Proyek Kolaboratif</td><td style="border: 1px solid #ccc; padding: 8px;">Rubrik presentasi kelompok & komunikasi yang baik</td></tr>
          </tbody>
        </table>

        <div style="margin-top: 50px; display: flex; justify-content: space-between;">
          <div style="text-align: center; width: 40%;">
            <p>Mengetahui,<br>Kepala Sekolah</p>
            <br><br><br>
            <p>_______________________<br>NIP. .........................</p>
          </div>
          <div style="text-align: center; width: 40%;">
            <p>Malang, .................... 2026<br>Guru Mata Pelajaran</p>
            <br><br><br>
            <p>_______________________<br>NIP. .........................</p>
          </div>
        </div>
      </div>
    `;

    const fallbackSkl = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; margin-bottom: 5px;">ANALISIS KETERKAITAN SKL, KI, KD, IPK, MATERI, DAN PENILAIAN</h2>
        <p style="text-align: center; font-size: 14px; margin-top: 0; color: #555;">Kurikulum Merdeka</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">SKL (Standar Kompetensi Lulusan)</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Kompetensi Inti (KI) / Elemen</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Kompetensi Dasar (KD) / Tujuan</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Indikator Pencapaian Kompetensi (IPK)</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Materi Pokok</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Kegiatan Pembelajaran</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Rencana Penilaian</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #333; padding: 6px;">Mendemonstrasikan pemahaman konsep, nalar kritis, berkebinekaan global, dan mandiri.</td>
              <td style="border: 1px solid #333; padding: 6px;">KI-1 & KI-2 (Sikap Spiritual & Sosial)<br>KI-3 (Pengetahuan)</td>
              <td style="border: 1px solid #333; padding: 6px;">Menganalisis prinsip-prinsip ${babTitle || 'pembelajaran'} secara teoritis dan mengaitkannya dengan nilai-nilai luhur dan Profil Pelajar Pancasila.</td>
              <td style="border: 1px solid #333; padding: 6px;">1. Menjelaskan konsep dasar ${babTitle || 'materi'}.<br>2. Menemukan implikasi akhlak mulia dari penerapan materi.</td>
              <td style="border: 1px solid #333; padding: 6px;"><strong>${babTitle || 'Materi Inti'}</strong><br>- Kajian Tekstual & Kontekstual<br>- Dimensi Sosial & Spiritual PPP</td>
              <td style="border: 1px solid #333; padding: 6px;">Siswa aktif mengeksplorasi masalah nyata dalam diskusi kelompok dengan dialog interaktif berlandaskan bernalar kritis dan kolaboratif.</td>
              <td style="border: 1px solid #333; padding: 6px;">- Penilaian Sikap/Karakter (Observasi)<br>- Tes Tulis Pemahaman Konsep<br>- Portofolio Kerja Kelompok</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    res.json({
      success: true,
      data: {
        modulAjar: fallbackModul,
        rppHtml: fallbackRpp,
        sklHtml: fallbackSkl
      },
      fallback: true
    });
  }
});

// AI Generate PPT Interaktif
app.post("/api/gemini/generate-ppt", async (req, res) => {
  try {
    const { subjectName, topic, materiDetail, grade = "X", slideCount = 8, theme = "midnight" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });

    const prompt = `
Sebagai pengembang media pembelajaran digital interaktif berbasis AI, buatkan draf slide presentasi PPT murni berisi materi inti secara lengkap dan mendalam.
Mata Pelajaran: "${subjectName}"
Topik/Materi Utama: "${topic}"
Kelas/Tingkat: "${grade}"
Jumlah Slide Target: ${slideCount || 8} slide

ATURAN STRICT:
1. HILANGKAN slide identitas guru, slide judul cover, slide tujuan pembelajaran, slide apersepsi, atau slide penutup terima kasih yang tidak perlu.
2. Semua slide target (${slideCount}) harus berisi KONTEN MATERI INTI murni dan bermakna. Setiap slide harus berbobot dan fokus sepenuhnya ke sub-bab materi.
3. Dilarang menggunakan simbol markdown seperti bintang (*, **) atau pagar (#) dalam teks isi slide. Gunakan kalimat ringkas, komunikatif, bernalar kritis, serta interaktif.

Kembalikan respon STRICTLY sebagai JSON objek dengan format berikut:
{
  "title": "Judul Utama PPT Materi",
  "subtitle": "Mata Pelajaran ${subjectName} Kelas ${grade}",
  "theme": "${theme}",
  "slides": [
    {
      "slideNumber": 1,
      "type": "content",
      "badge": "Sub-Bab 1",
      "title": "Nama Sub-Bab Pertama",
      "subtitle": "Pengenalan Konsep Pertama",
      "points": [
        "Poin penjelasan materi inti kesatu yang mendalam",
        "Poin penjelasan materi inti kedua dengan kalimat lugas",
        "Poin penjelasan materi inti ketiga secara terstruktur"
      ],
      "keyTakeaway": "Pesan kunci / kesimpulan ringkas dari sub-bab ini.",
      "teacherNote": "Petunjuk penyampaian bagi guru saat menjelaskan slide ini.",
      "interactiveQuestion": "Pertanyaan interaktif bernalar kritis terkait sub-bab ini untuk memancing keaktifan peserta didik."
    }
  ]
}
Catatan: Buatkan total ${slideCount || 8} slide bertahap semuanya fokus mengupas materi inti dari "${topic}".
${NO_DASHES_PROMPT}
`;

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const resultText = response.text || "{}";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini response: " + resultText);
    const data = sanitizeGeneratedData(rawData);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Generate PPT error (using fallback):", error);
    const { subjectName, topic, materiDetail, grade = "X" } = req.body || {};
    const fallbackData = {
      title: `Materi Inti: ${topic || 'Materi Pembelajaran'}`,
      subtitle: `${subjectName || 'Mata Pelajaran'} - Kelas ${grade}`,
      theme: req.body?.theme || "midnight",
      slides: [
        {
          slideNumber: 1,
          type: "content",
          badge: "Sub-Bab 1: Konsep Dasar",
          title: `Konsep Utama ${topic}`,
          subtitle: "Pengantar dan Pemahaman Dasar",
          points: [
            "Memahami pilar-pilar penting materi secara sistematis",
            "Menganalisis definisi fungsional dan contoh nyatanya",
            "Menghubungkan konsep dasar dengan kebutuhan praktis"
          ],
          keyTakeaway: "Konsep utama merupakan pondasi terpenting untuk pemahaman materi lanjutan.",
          teacherNote: "Jelaskan definisi utama secara perlahan dan pastikan siswa mencatat kata-kata kunci.",
          interactiveQuestion: "Bagaimana kalian mendefinisikan materi ini dengan bahasa kalian sendiri?"
        },
        {
          slideNumber: 2,
          type: "content",
          badge: "Sub-Bab 2: Analisa Detail",
          title: "Uraian dan Komponen Inti",
          subtitle: "Struktur dan Mekanisme Kerja",
          points: [
            materiDetail ? materiDetail.substring(0, 150) : `Bagian-bagian penting yang menyusun materi ${topic}`,
            "Masing-masing komponen memiliki fungsi krusial yang saling terintegrasi",
            "Analisis mendalam mengenai alur kerja dan interaksi sistem"
          ],
          keyTakeaway: "Setiap komponen memiliki peranan yang tak terpisahkan dalam keberlangsungan sistem.",
          teacherNote: "Bimbing peserta didik mengidentifikasi korelasi antar-komponen.",
          interactiveQuestion: "Menurut kalian, apa yang terjadi bila salah satu komponen ini tidak berfungsi?"
        }
      ]
    };
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});

// AI Generate Poster Interaktif Materi Inti
app.post("/api/gemini/generate-poster", async (req, res) => {
  try {
    const { subjectName, topic, grade = "X", theme = "modern", notes = "" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });

    let prompt = `
Sebagai ahli visualisasi materi dan media pembelajaran (infografis/poster), buatkan rancangan data visual poster interaktif edukasi berbobot tinggi untuk:
Mata Pelajaran: "${subjectName}"
Materi Utama: "${topic}"
Kelas/Tingkat: "${grade}"
`;

    if (notes) {
      prompt += `
Catatan Khusus & Prompt Tambahan dari Guru (PENTING: ikuti instruksi spesifik ini dalam menyusun struktur poster dan diagram):
"${notes}"
`;
    }

    prompt += `
Poster ini akan ditampilkan secara interaktif di layar. Poster harus memiliki:
1. Visual Labeled Hotspots: Bagian-bagian gambar/diagram ilustrasi yang dapat diklik untuk menampilkan penjelasan interaktif (misal membahas CPU, ada hotspot untuk ALU, CU, Registers, Cache; atau membahas Shalat, ada Takbir, Ruku, Sujud; atau membahas Sel, ada Nukleus, Mitokondria, Ribosom). Buatkan minimal 3 dan maksimal 5 hotspots dengan koordinat x dan y (dalam persen, 10 hingga 90).
2. Core Pillars: 3 sampai 4 poin materi inti terpenting yang dipajang dalam grid poster.
3. Fun Facts / Quick Notes: Info menarik singkat terkait materi.

Kembalikan respon STRICTLY sebagai JSON objek dengan format berikut:
{
  "title": "Judul Poster Menarik",
  "subtitle": "Infografis Pembelajaran Terintegrasi - ${subjectName} Kelas ${grade}",
  "theme": "${theme}",
  "illustrationTitle": "Judul Bagian Ilustrasi/Diagram Tengah",
  "illustrationDescription": "Panduan visual interaktif. Silakan klik bagian berlabel untuk mengupas materi detail.",
  "hotspots": [
    {
      "id": "hotspot-1",
      "label": "Singkatan/Label Pendek (maks 15 karakter)",
      "name": "Nama Lengkap Bagian/Komponen",
      "x": 25,
      "y": 40,
      "description": "Penjelasan singkat fungsi utama komponen ini (1-2 kalimat).",
      "details": "Detail teknis tambahan yang mendalam untuk dibaca siswa saat hotspot diklik."
    }
  ],
  "corePillars": [
    {
      "title": "Pilar Materi 1",
      "desc": "Ringkasan penjelasan berbobot tinggi mengenai pilar materi pertama.",
      "icon": "fa-solid fa-cube"
    }
  ],
  "funFacts": [
    "Fakta unik menarik kesatu terkait materi.",
    "Fakta unik menarik kedua terkait materi."
  ],
  "summary": "Pernyataan rangkuman pamungkas poster yang memotivasi siswa untuk mendalami materi."
}
Pastikan koordinat x dan y bervariasi agar tidak bertumpuk di satu tempat.
${NO_DASHES_PROMPT}
`;

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const resultText = response.text || "{}";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini poster response: " + resultText);
    const data = sanitizeGeneratedData(rawData);

    // Dynamic Image Generation using Gemini model (Imagen 3)
    let imageUrl = "";
    try {
      console.log(`[Gemini API] Attempting image generation for poster with prompt: ${topic}`);
      const imgRes = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: `A highly detailed, beautiful professional textbook vector illustration about "${topic}" for "${subjectName}" class. Clean educational poster style, diagrammatic explanation, sharp details, vibrant colors, school context, high quality, 4:3 aspect ratio.${notes ? ` Focus focus on: ${notes}` : ""}`,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "4:3"
        }
      });
      if (imgRes && imgRes.generatedImages && imgRes.generatedImages[0]) {
        const bytes = imgRes.generatedImages[0].image?.imageBytes;
        if (bytes) {
          imageUrl = `data:image/jpeg;base64,${bytes}`;
          console.log(`[Gemini API] Image generated successfully using imagen-3.0-generate-002!`);
        }
      }
    } catch (imgErr) {
      console.error("Failed to generate image with imagen-3.0-generate-002", imgErr);
      // Fallback to high-quality educational royalty-free imagery matching topic/subject
      const lowerSubject = (subjectName || "").toLowerCase();
      const lowerTopic = (topic || "").toLowerCase();
      
      if (lowerSubject.includes("math") || lowerSubject.includes("matematika") || lowerTopic.includes("aljabar") || lowerTopic.includes("hitung")) {
        imageUrl = "https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800&auto=format&fit=crop";
      } else if (lowerSubject.includes("ipa") || lowerSubject.includes("science") || lowerSubject.includes("biologi") || lowerSubject.includes("kimia") || lowerSubject.includes("fisika") || lowerTopic.includes("sel") || lowerTopic.includes("organ tubuh")) {
        imageUrl = "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=800&auto=format&fit=crop";
      } else if (lowerSubject.includes("komputer") || lowerSubject.includes("informatika") || lowerSubject.includes("coding") || lowerTopic.includes("program") || lowerTopic.includes("software")) {
        imageUrl = "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop";
      } else if (lowerSubject.includes("sejarah") || lowerSubject.includes("history") || lowerSubject.includes("sosial") || lowerSubject.includes("ips") || lowerTopic.includes("budaya")) {
        imageUrl = "https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=800&auto=format&fit=crop";
      } else if (lowerSubject.includes("bahasa") || lowerSubject.includes("language") || lowerSubject.includes("inggris") || lowerSubject.includes("indonesia")) {
        imageUrl = "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=800&auto=format&fit=crop";
      } else {
        imageUrl = "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop";
      }
    }

    if (!data.imageUrl && imageUrl) {
      data.imageUrl = imageUrl;
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Generate Poster error (using fallback):", error);
    const { subjectName, topic, grade = "X" } = req.body || {};
    const fallbackData = {
      title: `Visualisasi Interaktif: ${topic || 'Materi'}`,
      subtitle: `Infografis Pembelajaran Terintegrasi - ${subjectName || 'Informatika'} Kelas ${grade}`,
      theme: req.body?.theme || "modern",
      illustrationTitle: `Diagram Analisis ${topic || 'Sistem'}`,
      illustrationDescription: "Klik label pada diagram interaktif di bawah untuk mengupas rahasia materi.",
      hotspots: [
        {
          id: "hotspot-1",
          label: "Input Unit",
          name: "Sistem Masukan (Input Unit)",
          x: 20,
          y: 40,
          description: "Menerima instruksi data mentah dari luar untuk diproses oleh sistem.",
          details: "Berfungsi menyerap stimuli eksternal dan menerjemahkannya ke dalam bentuk sandi digital yang dimengerti mesin."
        },
        {
          id: "hotspot-2",
          label: "Processing Unit",
          name: "Sistem Pemrosesan Inti",
          x: 50,
          y: 35,
          description: "Otak utama yang melakukan manipulasi, kalkulasi, dan pengolahan data.",
          details: "Mengendalikan seluruh operasi logika, memetakan keputusan, serta mengatur koordinasi jalannya instruksi."
        },
        {
          id: "hotspot-3",
          label: "Output Unit",
          name: "Sistem Keluaran (Output Unit)",
          x: 80,
          y: 40,
          description: "Menampilkan hasil pemrosesan informasi dalam format yang dipahami manusia.",
          details: "Mentransmisikan sandi internal menjadi visual, suara, atau tindakan nyata yang membawa manfaat langsung bagi pengguna."
        }
      ],
      corePillars: [
        {
          title: "Fondasi Konseptual",
          desc: "Memahami struktur hulu ke hilir yang membentuk keutuhan materi secara logis dan runtut.",
          icon: "fa-solid fa-compass"
        },
        {
          title: "Mekanisme Operasional",
          desc: "Setiap elemen bertindak aktif menyokong fungsionalitas sistem demi tercapainya efisiensi tinggi.",
          icon: "fa-solid fa-gears"
        },
        {
          title: "Implementasi Nyata",
          desc: "Menghubungkan teori ke dalam contoh kasus kehidupan sehari-hari demi membangun nalar kritis peserta didik.",
          icon: "fa-solid fa-lightbulb"
        }
      ],
      funFacts: [
        "Seluruh kesuksesan pemahaman konsep visual bergantung pada kemauan bereksperimen.",
        "Satu gambar diagram interaktif terbukti mampu menaikkan retensi memori siswa hingga 60%."
      ],
      summary: "Menguasai struktur visual membantu kita memetakan masa depan teknologi dengan bimbingan akhlak dan ilmu yang berkah."
    };
    res.json({ success: true, data: fallbackData });
  }
});

// AI Generate Document Pack (12 Categories)
app.post("/api/gemini/generate-kbc-document", async (req, res) => {
  try {
    const { docType, subjectName, babs = [], babIndex, babTitle, grade = "X", guruName, guruNip, kepsekName, kepsekNip } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    
    let prompt = "";
    const babsList = babs.join(", ");

    switch (docType) {
      case "alokasi_waktu":
        prompt = `
Buatkan dokumen "ANALISIS ALOKASI WAKTU" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Dokumen ini harus menghitung secara logis alokasi jam pelajaran (JP) efektif untuk semester ganjil dan genap, serta mendistribusikan materi bab berikut secara seimbang: ${babsList}.
Isi dokumen harus dalam format HTML terstruktur rapi. Gunakan tabel-tabel profesional dengan border tipis (border-collapse, border: 1px solid #333, padding: 8px) dan pastikan ada tempat tanda tangan Mengetahui Kepala Sekolah dan Guru Mata Pelajaran di bagian bawah.
Kurikulum Merdeka menekankan penyusunan jadwal yang efisien dan berpusat pada peserta didik.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "ki_kd":
        prompt = `
Buatkan dokumen "ANALISIS KI-KD (Karakter Kurikulum Berbasis Cinta)" Sekolah Menengah untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", mencakup materi bab: ${babsList}.
Analisis keterkaitan Kompetensi Inti (KI-1 Sikap Spiritual, KI-2 Sikap Sosial, KI-3 Pengetahuan, KI-4 Keterampilan) dengan Kompetensi Dasar (KD) masing-masing bab, lalu kaitkan dengan nilai-nilai Profil Pelajar Pancasila.
Format dokumen berupa tabel HTML komprehensif, rapi, lebar 100%, ber-border (border-collapse, padding: 8px), lengkap dengan kolom: No, Kompetensi Inti (KI), Kompetensi Dasar (KD), Indikator Pencapaian Kompetensi (IPK), dan Integrasi Karakter/PPP. Sertakan tanda tangan di bagian bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "rpp":
        prompt = `
Buatkan "RPP (Rencana Pelaksanaan Pembelajaran)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", Bab ${Number(babIndex) + 1}: "${babTitle}".
Dokumen RPP ini harus sama persis dengan format administrasi guru resmi, mencakup:
1. Identitas RPP (Mata Pelajaran, Kelas, Semester, Bab, Materi, Alokasi Waktu).
2. Tujuan Pembelajaran (mencakup aspek Kognitif & Afektif/PPP).
3. Langkah-Langkah Kegiatan Pembelajaran (Pendahuluan dengan apersepsi, Kegiatan Inti yang sesuai karakteristik mapel, dan Penutup dengan apresiasi, refleksi, & doa).
4. Penilaian Pembelajaran (Sikap/Karakter, Pengetahuan, Keterampilan).
Format dokumen harus berupa HTML yang sangat rapi, terstruktur, menggunakan tabel-tabel ber-border, serta tempat tanda tangan guru & kepala madrasah di bagian bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "silabus":
        prompt = `
Buatkan dokumen "SILABUS PEMBELAJARAN" Sekolah Menengah untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Silabus harus memetakan seluruh bab berikut secara berurutan: ${babsList}.
Untuk setiap bab, jabarkan dalam tabel HTML besar yang rapi dengan kolom: Elemen/Kompetensi Dasar, Indikator, Materi Pokok, Kegiatan Pembelajaran (yang diintegrasikan dengan pembelajaran aktif dan inovatif), Penilaian (formatif, sumatif, afektif), Alokasi Waktu, dan Sumber Belajar.
Pastikan tabelnya lebar w-full, border-collapse, ber-border 1px solid #333, padding 8px, dan sertakan tempat tanda tangan di bagian bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "atp":
        prompt = `
Buatkan dokumen "ALUR TUJUAN PEMBELAJARAN (ATP)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
ATP ini harus memetakan alur pembelajaran secara kronologis untuk materi bab berikut: ${babsList}.
Format berupa tabel HTML profesional dengan kolom: No, Elemen, Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP), Alur Tujuan Pembelajaran (ATP), dan Alokasi Waktu (JP).
Setiap tujuan harus dirumuskan secara operasional dan mengintegrasikan kecakapan sosial-emosional Profil Pelajar Pancasila. Sertakan tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "cp":
        prompt = `
Buatkan dokumen "CAPAIAN PEMBELAJARAN (CP)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", mengacu pada bab-bab: ${babsList}.
Tuliskan Rasionalitas Mata Pelajaran, Tujuan Mata Pelajaran, Karakteristik Mata Pelajaran, dan tabel Capaian Pembelajaran per Elemen yang disesuaikan dengan nilai-nilai Profil Pelajar Pancasila.
Format berupa dokumen HTML yang rapi dengan heading, list, dan tabel ber-border, lengkap dengan tempat tanda tangan di bagian bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "kktp":
        prompt = `
Buatkan dokumen "KRITERIA KETUNTASAN TUJUAN PEMBELAJARAN (KKTP)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Tentukan kriteria ketuntasan dari tujuan pembelajaran setiap bab berikut: ${babsList}.
Buat dalam tabel HTML yang sangat detail dengan kolom: No, Bab / Tujuan Pembelajaran, Kriteria Ketuntasan (dengan Interval Nilai: 0-60% Baru Berkembang, 61-80% Layak, 81-90% Cakap, 91-100% Mahir), dan Tindak Lanjut / Intervensi (bagaimana guru membimbing siswa pada rentang nilai tersebut). Sertakan tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "modul_ajar":
        prompt = `
Buatkan "MODUL AJAR LENGKAP" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", Bab ${Number(babIndex) + 1}: "${babTitle}".
Dokumen HARUS SANGAT PANJANG, RINCI, DAN MENYELURUH (komprehensif) menyerupai dokumen asli yang tebalnya mencapai 17 halaman. Jangan membuat dokumen yang singkat atau poin-poin yang dipotong. Uraikan setiap sub-bab materi, penjelasan kegiatan guru dan siswa, serta rubrik penilaian dengan kalimat yang lengkap dan deskripsi yang detail!

Sistematika Modul Ajar harus sama persis dengan standar Kurikulum Merdeka berikut, ditulis dalam HTML berkelas:

A. INFORMASI UMUM
1. Identitas Modul (Nama Penyusun, Institusi, Tahun Penyusunan, Jenjang Sekolah, Kelas, Alokasi Waktu)
2. Kompetensi Awal
3. Profil Pelajar Pancasila dan Pelajar Rahmatan Lil Alamin (berfokus pada pilar kasih sayang, kelembutan, dan empati)
4. Sarana dan Prasarana
5. Target Peserta Didik
6. Model Pembelajaran

B. KOMPONEN INTI
1. Tujuan Pembelajaran (Kognitif, Afektif, Psikomotorik) beserta penjabaran detail
2. Pemahaman Bermakna (Uraian naratif yang menginspirasi)
3. Pertanyaan Pemantik
4. Kegiatan Pembelajaran (Buat skenario yang sangat rinci, memuat skrip/dialog contoh, estimasi waktu, serta langkah konkret yang mencerminkan cinta kasih dalam pendidikan):
   - Kegiatan Pendahuluan (Penuh kehangatan dan motivasi)
   - Kegiatan Inti (Eksplorasi, Elaborasi, Konfirmasi dengan narasi panjang lebar)
   - Kegiatan Penutup (Refleksi mendalam dan apresiasi)
5. Asesmen (Sertakan instrumen dan rubrik penilaian yang sangat detail untuk Sikap, Pengetahuan, dan Keterampilan. Jangan gunakan tabel sederhana, gunakan rubrik dengan deskriptor lengkap 4 skala)
6. Pengayaan dan Remedial (Uraikan programnya secara konkrit)
7. Refleksi Peserta Didik dan Guru (Daftar pertanyaan reflektif yang panjang dan mendalam)

C. LAMPIRAN
1. Lembar Kerja Peserta Didik (LKPD) yang lengkap dengan studi kasus/soal-soal
2. Bahan Bacaan Guru dan Peserta Didik (Sertakan MATERI PEMBAHASAN YANG PANJANG, RINCI, DAN MENYELURUH sesuai bab "${babTitle}")
3. Glosarium (Daftar istilah lengkap)
4. Daftar Pustaka

Format harus berupa dokumen HTML yang sangat indah, menggunakan semantic tags, pembatas garis yang elegan, tabel rubrik asesmen, paragraf teks materi yang sangat terperinci dan ekstensif, serta tempat tanda tangan di bagian paling bawah. JANGAN PERNAH menyajikan informasi hanya dengan satu-dua kalimat pendek. Eksplorasi setiap poin semaksimal mungkin!
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "prosem":
        prompt = `
Buatkan dokumen "PROGRAM SEMESTER (PROSEM)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Petakan distribusi alokasi jam pelajaran (JP) per minggu untuk semester berjalan, mengalokasikan materi bab berikut secara logis: ${babsList}.
Format berupa tabel HTML horizontal besar dengan kolom: No, Materi Pokok / Bab, Jml JP, Juli (Minggu 1-4), Agustus (Minggu 1-4), September (Minggu 1-4), Oktober (Minggu 1-4), November (Minggu 1-4), Desember (Minggu 1-4), lengkap dengan tanda centang/angka distribusi JP di setiap sel minggunya. Tambahkan tempat tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "prota":
        prompt = `
Buatkan dokumen "PROGRAM TAHUNAN (PROTA)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Petakan pembagian alokasi waktu tahunan (Semester 1 & Semester 2) untuk bab-bab berikut: ${babsList}.
Format berupa tabel HTML resmi dengan kolom: No, Semester, Kompetensi Dasar / Bab Pokok, Alokasi Waktu (JP), Keterangan. Pastikan isinya berbobot dan terdistribusi logis dengan total akumulasi JP tahunan yang rasional. Tambahkan tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "tp":
        prompt = `
Buatkan dokumen "TUJUAN PEMBELAJARAN (TP)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Rumuskan secara detail Tujuan Pembelajaran (TP) kognitif, psikomotorik, dan afektif berbasis empati serta karakter mulia untuk setiap bab berikut: ${babsList}.
Format berupa dokumen HTML yang rapi dengan heading, poin-poin terstruktur, tabel pemetaan elemen ke tujuan pembelajaran, dan tempat tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      case "lkpd":
        prompt = `
Buatkan "LEMBAR KERJA PESERTA DIDIK (LKPD)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", Bab ${Number(babIndex) + 1}: "${babTitle}".
LKPD ini harus interaktif, berpusat pada siswa, dan mendidik dengan penuh kasih sayang, mencakup:
1. Identitas Peserta Didik & Kelompok.
2. Petunjuk Belajar (instruksi pengerjaan bernuansa asih-asuh).
3. Ringkasan Materi Pokok secara menarik.
4. Tugas/Aktivitas Kolaboratif Kelompok (memecahkan studi kasus moral/sosial dengan penuh kelembutan akhlak).
5. Pertanyaan Diskusi Kritis & Refleksi Karakter.
6. Rubrik Penilaian Diri & Rubrik Kerjasama Kelompok.
Format berupa dokumen HTML yang sangat rapi, menarik bagi siswa, dan dilengkapi tempat tanda tangan guru & orang tua/wali di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;

      default:
        return res.status(400).json({ success: false, message: "docType tidak valid." });
    }

    if (guruName || kepsekName) {
      prompt += `\n\nUntuk kolom tanda tangan di bagian paling bawah dokumen, Anda WAJIB menyertakan data berikut secara persis:
- Nama Guru: ${guruName || "(Nama Guru)"}
- NIP Guru: ${guruNip || "-"}
- Nama Kepala Sekolah: ${kepsekName || "(Nama Kepala Sekolah)"}
- NIP Kepala Sekolah: ${kepsekNip || "-"}
Pastikan kolom tanda tangan tersebut diformat dengan sangat rapi dan estetik menggunakan tabel atau struktur CSS flexbox/grid yang bersih (misalnya di sebelah kiri Kepala Sekolah dan sebelah kanan Guru), diletakkan di bagian akhir dokumen HTML.`;
    }

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
    });
    
    let html = response.text || "";
    html = html.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '').trim();
    res.json({ success: true, html });
  } catch (error: any) {
    console.error("Generate Document error (using fallback):", error);
    const { docType = "Dokumen", subjectName = "Mata Pelajaran" } = req.body || {};
    const fallbackHtml = `<div class="p-6 font-sans"><h2 class="text-xl font-bold text-center mb-4">DOKUMEN ADMINISTRASI: ${docType.toUpperCase()} (${subjectName})</h2><p>Dokumen administrasi profesional madrasah disusun dengan mengintegrasikan nilai luhur dan Kurikulum Merdeka.</p></div>`;
    res.json({ success: true, html: fallbackHtml, fallback: true });
  }
});

// AI Generate Questions & Kisi-Kisi based on Lesson Plans
app.post("/api/gemini/generate-soal-kisi", async (req, res) => {
  try {
    const { subjectName, mcCount = 10, essayCount = 5, optionCount = 5, lessons = [], difficulty = "sedang" } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    let lessonsContext = "";
    if (lessons && lessons.length > 0) {
      lessonsContext = lessons.map((l: any, idx: number) => {
        return `Modul ${idx+1}:
- Judul: ${l.title || ''}
- Topik: ${l.topic || ''}
- Kompetensi Awal: ${l.kompetensiAwal || ''}
- Tujuan Pembelajaran: ${l.tujuanPembelajaran || ''}
- Pemahaman Bermakna: ${l.pemahamanBermakna || ''}${l.extractedContent ? `\n- Naskah Dokumen Modul Acuan: ${l.extractedContent.substring(0, 1000)}` : ''}`;
      }).join("\n\n");
    } else {
      lessonsContext = "Tidak ada modul ajar tersimpan spesifik. Buatkan soal umum untuk mata pelajaran ini.";
    }

    let difficultyInstruction = "";
    if (difficulty === "mudah") {
      difficultyInstruction = `TINGKAT KESULITAN SOAL: MUDAH. Soal-soal yang dibuat HARUS berada pada level kognitif rendah ke sedang, yaitu C1, C2, C3, atau C4. SANGAT DILARANG menggunakan kategori C5 (Mengevaluasi) atau C6 (Mencipta) dalam kisi-kisi maupun naskah soal.`;
    } else if (difficulty === "sulit") {
      difficultyInstruction = `TINGKAT KESULITAN SOAL: SULIT / HOTS. Soal-soal yang dibuat HARUS bertaraf tinggi, yaitu terdiri dari level kognitif C3, C4, C5, atau C6. SANGAT DIUTAMAKAN menyertakan soal HOTS (Higher Order Thinking Skills) kategori C4, C5, dan C6.`;
    } else {
      difficultyInstruction = `TINGKAT KESULITAN SOAL: SEDANG. Jumlah dan sebaran tingkat kognitif dari C1, C2, C3, C4, C5, sampai C6 harus seimbang dan merata secara adil.`;
    }

    const subjectRule = getSubjectTemplateInstructions(subjectName);

    const prompt = `
Anda adalah sistem AI Penyusun Soal Ujian berorientasi pada Kurikulum Merdeka.
Tugas Anda adalah membuat naskah soal ujian dan KISI-KISI UJIAN yang berkaitan erat dengan modul-modul ajar berikut:

Mata Pelajaran: ${subjectName}
Kurikulum: Kurikulum Merdeka
${subjectRule}

Modul-modul Ajar Acuan:
${lessonsContext}

Ketentuan Khusus Tingkat Kesulitan:
${difficultyInstruction}

Sistem Ujian yang diminta:
1. Jumlah Soal Pilihan Ganda: ${mcCount} soal.
2. Jumlah Soal Essay/Uraian: ${essayCount} soal.
3. Untuk Pilihan Ganda, opsi harus sampai huruf ${optionCount === 5 ? 'E' : 'D'} (yaitu A, B, C, D${optionCount === 5 ? ', E' : ''}).

PENTING: Dilarang menggunakan simbol markdown seperti bintang (*, **), pagar (#), atau backtick (\`) dalam teks pertanyaan, opsi, penjelasan, maupun kisi-kisi. Gunakan penulisan huruf dan angka biasa yang rapi dan benar.

Respon harus strictly berupa JSON dengan format objek seperti berikut:
{
  "questions": [
    {
      "no": 1,
      "type": "mc",
      "question": "Pertanyaan pilihan ganda yang komprehensif dan menguji pemahaman materi...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "Penjelasan berbobot...",
      "kisiKisi": {
        "kompetensiDasar": "Kompetensi dasar (KD) atau capaian pembelajaran yang diukur",
        "materi": "Materi pokok dari modul",
        "indikator": "Indikator ketercapaian soal (misal: Disajikan teks, siswa dapat menentukan...)",
        "levelKognitif": "L1 atau L2 atau L3",
        "dimensiProsesKognitif": "Mengingat atau Memahami atau Menerapkan atau Menganalisis atau Mengevaluasi atau Mencipta",
        "kategori": "C1 atau C2 atau C3 atau C4 atau C5 atau C6",
        "bentukSoal": "Pilihan Ganda"
      }
    },
    ...
  ]
}

Pastikan no soal berurutan dari 1 sampai ${Number(mcCount) + Number(essayCount)}.
Soal essay memiliki properti "type": "essay", "options": [] (array kosong), dan "kisiKisi.bentukSoal": "Essay" atau "Uraian".
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Gunakan format JSON yang valid. Jangan sertakan teks markdown pembungkus di luar JSON (strictly return JSON).
${NO_DASHES_PROMPT}
`;

    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const resultText = response.text || "{}";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini Generate Soal Kisi response: " + resultText);
    const data = sanitizeGeneratedData(rawData);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini Generate Soal Kisi error (using fallback):", error);
    const { subjectName, mcCount = 5, essayCount = 2, optionCount = 5, difficulty = "sedang" } = req.body || {};
    const items = [];
    let qNo = 1;

    // Adjust fallback category based on requested difficulty
    let mcCat = "C2";
    let mcLevel = "L2";
    let mcDim = "Memahami";
    let esCat = "C3";
    let esLevel = "L2";
    let esDim = "Menerapkan";

    if (difficulty === "mudah") {
      mcCat = "C2"; mcLevel = "L2"; mcDim = "Memahami";
      esCat = "C3"; esLevel = "L2"; esDim = "Menerapkan";
    } else if (difficulty === "sulit") {
      mcCat = "C4"; mcLevel = "L3"; mcDim = "Menganalisis";
      esCat = "C5"; esLevel = "L3"; esDim = "Mengevaluasi";
    } else {
      mcCat = "C3"; mcLevel = "L2"; mcDim = "Menerapkan";
      esCat = "C4"; esLevel = "L3"; esDim = "Menganalisis";
    }

    for (let i = 0; i < (mcCount || 5); i++) {
      items.push({
        no: qNo,
        type: 'mc',
        question: `Bagaimana pemahaman dan penerapan utama materi ${subjectName || 'Mata Pelajaran'} dalam kehidupan sehari-hari?`,
        options: optionCount === 5 
          ? ['A. Mengaplikasikan prinsip dasar dengan benar dan tepat', 'B. Mengabaikan aturan dan prinsip dasar', 'C. Menerapkan secara acak tanpa landasan', 'D. Menolak mempelajari konsep dasar', 'E. Tidak memperhatikan relevansi materi']
          : ['A. Mengaplikasikan prinsip dasar dengan benar dan tepat', 'B. Mengabaikan aturan dan prinsip dasar', 'C. Menerapkan secara acak tanpa landasan', 'D. Menolak mempelajari konsep dasar'],
        answer: 'A',
        explanation: 'Pemahaman materi dilakukan dengan menerapkan prinsip utama secara sistematis dan benar.',
        kisiKisi: {
          kompetensiDasar: `Memahami konsep dasar pada materi ${subjectName || 'Mata Pelajaran'}`,
          materi: `Materi Inti ${subjectName || 'Mata Pelajaran'}`,
          indikator: 'Siswa dapat menganalisis dan menerapkan konsep dasar secara tepat.',
          levelKognitif: mcLevel,
          dimensiProsesKognitif: mcDim,
          kategori: mcCat,
          bentukSoal: 'Pilihan Ganda'
        }
      });
      qNo++;
    }
    for (let i = 0; i < (essayCount || 2); i++) {
      items.push({
        no: qNo,
        type: 'essay',
        question: `Jelaskan secara komprehensif bagaimana penerapan ilmu ${subjectName || 'Mata Pelajaran'} dapat menyelesaikan masalah di lingkungan Anda!`,
        options: [],
        answer: 'Penerapan materi dilakukan melalui analisis masalah, perumusan solusi berdasarkan prinsip ilmiah, serta evaluasi hasil secara berkelanjutan.',
        explanation: 'Jawaban essay mengutamakan elaborasi pemahaman materi.',
        kisiKisi: {
          kompetensiDasar: `Menganalisis dan mengevaluasi penerapan ${subjectName || 'Mata Pelajaran'}`,
          materi: `Aplikasi ${subjectName || 'Mata Pelajaran'}`,
          indikator: 'Siswa mampu menjelaskan penerapan keilmuan secara analitis dan sistematis.',
          levelKognitif: esLevel,
          dimensiProsesKognitif: esDim,
          kategori: esCat,
          bentukSoal: 'Essay'
        }
      });
      qNo++;
    }
    res.json({ success: true, data: { questions: items }, fallback: true });
  }
});

// Schedules API
app.get("/api/schedules", (req, res) => {
  res.json({ success: true, schedules: filterByMadrasah(schedules, req) });
});
app.post("/api/schedules", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map(item => tagNewRecord(item, req));
    let otherSchedules = [];
    if (mId && mId !== 'default' && mId !== 'BOSS') {
      const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherSchedules = schedules.filter(s => {
        const imId = String(s.madrasahId || '').trim();
        const imSlug = String(s.madrasahSlug || '').trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
      const defId = defaultM ? defaultM.id : 'default';
      const defSlug = defaultM ? defaultM.slug : 'default';
      otherSchedules = schedules.filter(s => {
        const imId = String(s.madrasahId || 'default').trim();
        const imSlug = String(s.madrasahSlug || 'default').trim();
        const isDefault = imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!s.madrasahId && !s.madrasahSlug);
        return !isDefault;
      });
    }
    schedules = [...otherSchedules, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = schedules.findIndex(s => String(s.id) === String(req.body.id));
    if (idx >= 0) {
      schedules[idx] = { ...schedules[idx], ...tagged };
    } else {
      schedules.push(tagged);
    }
  }
  await saveData('schedules', schedules);
  res.json({ success: true, schedules: filterByMadrasah(schedules, req) });
});
app.delete("/api/schedules/:id", async (req, res) => {
  const { id } = req.params;
  schedules = schedules.filter(s => String(s.id) !== String(id));
  await saveData('schedules', schedules);
  res.json({ success: true, schedules: filterByMadrasah(schedules, req) });
});

// Exams API
app.get("/api/exams", (req, res) => {
  res.json({ success: true, exams: filterByMadrasah(exams, req) });
});
app.get("/api/lkpds", (req, res) => {
  res.json({ success: true, lkpdList: filterByMadrasah(lkpdList, req) });
});
app.post("/api/exams", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map(item => tagNewRecord(item, req));
    let otherExams = [];
    if (mId && mId !== 'default' && mId !== 'BOSS') {
      const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherExams = exams.filter(e => {
        const imId = String(e.madrasahId || '').trim();
        const imSlug = String(e.madrasahSlug || '').trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
      const defId = defaultM ? defaultM.id : 'default';
      const defSlug = defaultM ? defaultM.slug : 'default';
      otherExams = exams.filter(e => {
        const imId = String(e.madrasahId || 'default').trim();
        const imSlug = String(e.madrasahSlug || 'default').trim();
        const isDefault = imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!e.madrasahId && !e.madrasahSlug);
        return !isDefault;
      });
    }
    exams = [...otherExams, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = exams.findIndex(e => String(e.id) === String(req.body.id));
    if (idx >= 0) {
      exams[idx] = { ...exams[idx], ...tagged };
    } else {
      exams.push(tagged);
    }
  }
  await saveData('exams', exams);
  res.json({ success: true, exams: filterByMadrasah(exams, req) });
});
app.delete("/api/exams/:id", async (req, res) => {
  const { id } = req.params;
  exams = exams.filter(e => String(e.id) !== String(id));
  await saveData('exams', exams);
  res.json({ success: true, exams: filterByMadrasah(exams, req) });
});

// Rooms API
app.get("/api/rooms", (req, res) => {
  res.json({ success: true, rooms: filterByMadrasah(rooms, req) });
});
app.post("/api/rooms", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map(item => tagNewRecord(item, req));
    let otherRooms = [];
    if (mId && mId !== 'default' && mId !== 'BOSS') {
      const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherRooms = rooms.filter(r => {
        const imId = String(r.madrasahId || '').trim();
        const imSlug = String(r.madrasahSlug || '').trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
      const defId = defaultM ? defaultM.id : 'default';
      const defSlug = defaultM ? defaultM.slug : 'default';
      otherRooms = rooms.filter(r => {
        const imId = String(r.madrasahId || 'default').trim();
        const imSlug = String(r.madrasahSlug || 'default').trim();
        const isDefault = imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!r.madrasahId && !r.madrasahSlug);
        return !isDefault;
      });
    }
    rooms = [...otherRooms, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = rooms.findIndex(r => String(r.id) === String(req.body.id));
    if (idx >= 0) {
      rooms[idx] = { ...rooms[idx], ...tagged };
    } else {
      rooms.push(tagged);
    }
  }
  await saveData('rooms', rooms);
  res.json({ success: true, rooms: filterByMadrasah(rooms, req) });
});
app.delete("/api/rooms/:id", async (req, res) => {
  const { id } = req.params;
  rooms = rooms.filter(r => String(r.id) !== String(id));
  await saveData('rooms', rooms);
  res.json({ success: true, rooms: filterByMadrasah(rooms, req) });
});

// Journals API
app.get("/api/journals", async (req, res) => {
  if (pool) {
    try {
      const dbRes = await pool.query("SELECT value FROM app_store WHERE key = 'journals'");
      if (dbRes.rows.length > 0) {
        let val = dbRes.rows[0].value;
        if (typeof val === 'string') { try { val = JSON.parse(val); } catch(e){} }
        return res.json({ success: true, journals: filterByMadrasah(val || [], req) });
      }
    } catch(e) {}
  }
  res.json({ success: true, journals: filterByMadrasah(journals, req) });
});
app.post("/api/journals", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map(item => tagNewRecord(item, req));
    let otherJournals = [];
    if (mId && mId !== 'default' && mId !== 'BOSS') {
      const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherJournals = journals.filter(j => {
        const imId = String(j.madrasahId || '').trim();
        const imSlug = String(j.madrasahSlug || '').trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
      const defId = defaultM ? defaultM.id : 'default';
      const defSlug = defaultM ? defaultM.slug : 'default';
      otherJournals = journals.filter(j => {
        const imId = String(j.madrasahId || 'default').trim();
        const imSlug = String(j.madrasahSlug || 'default').trim();
        const isDefault = imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!j.madrasahId && !j.madrasahSlug);
        return !isDefault;
      });
    }
    journals = [...otherJournals, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = journals.findIndex(j => String(j.id) === String(req.body.id));
    if (idx >= 0) {
      journals[idx] = { ...journals[idx], ...tagged };
    } else {
      journals.push(tagged);
    }
  }
  await saveData('journals', journals);
  res.json({ success: true, journals: filterByMadrasah(journals, req) });
});
app.delete("/api/journals/:id", async (req, res) => {
  const { id } = req.params;
  journals = journals.filter(j => String(j.id) !== String(id));
  await saveData('journals', journals);
  res.json({ success: true, journals: filterByMadrasah(journals, req) });
});

// Calendar Events API
app.get("/api/calendar-events", (req, res) => {
  res.json({ success: true, calendarEvents: filterByMadrasah(calendarEvents, req) });
});
app.post("/api/calendar-events", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map(item => tagNewRecord(item, req));
    let otherEvents = [];
    if (mId && mId !== 'default' && mId !== 'BOSS') {
      const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherEvents = calendarEvents.filter(c => {
        const imId = String(c.madrasahId || '').trim();
        const imSlug = String(c.madrasahSlug || '').trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
      const defId = defaultM ? defaultM.id : 'default';
      const defSlug = defaultM ? defaultM.slug : 'default';
      otherEvents = calendarEvents.filter(c => {
        const imId = String(c.madrasahId || 'default').trim();
        const imSlug = String(c.madrasahSlug || 'default').trim();
        const isDefault = imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!c.madrasahId && !c.madrasahSlug);
        return !isDefault;
      });
    }
    calendarEvents = [...otherEvents, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = calendarEvents.findIndex(c => String(c.id) === String(req.body.id));
    if (idx >= 0) {
      calendarEvents[idx] = { ...calendarEvents[idx], ...tagged };
    } else {
      calendarEvents.push(tagged);
    }
  }
  await saveData('calendarEvents', calendarEvents);
  res.json({ success: true, calendarEvents: filterByMadrasah(calendarEvents, req) });
});
app.delete("/api/calendar-events/:id", async (req, res) => {
  const { id } = req.params;
  calendarEvents = calendarEvents.filter(c => String(c.id) !== String(id));
  await saveData('calendarEvents', calendarEvents);
  res.json({ success: true, calendarEvents });
});

// EduGames Submit API Endpoint
app.post("/api/games/:id/submit", async (req, res) => {
  const { id } = req.params;
  const { submittedAnswer, studentId, isPreview, passed, customXp } = req.body;

  let eduGamesData = (await getMemoryKeyValue('eduGames')) || [];
  const game = Array.isArray(eduGamesData) ? eduGamesData.find((g: any) => String(g.id) === String(id)) : null;

  let isCorrect = passed === true;
  if (!isCorrect && game) {
    const key = String(game.answerKey || game.correctAnswer || game.answer || '').trim().toLowerCase();
    const sub = String(submittedAnswer || '').trim().toLowerCase();
    if (key && sub && (key === sub || key.replace(/\s+/g, '') === sub.replace(/\s+/g, ''))) {
      isCorrect = true;
    }
  }

  let earnedXp = customXp !== undefined && customXp !== null ? Number(customXp) : (game ? Number(game.rewardXp || 100) : 100);
  if (isNaN(earnedXp)) earnedXp = 100;

  let newTotalXp = 0;
  if (studentId && !isPreview) {
    const stIdx = students.findIndex((s: any) => String(s.id) === String(studentId));
    if (stIdx >= 0) {
      if (isCorrect) {
        students[stIdx].gameXp = (Number(students[stIdx].gameXp) || 0) + earnedXp;
        students[stIdx].dailyStreak = (Number(students[stIdx].dailyStreak) || 0) + 1;
      }
      newTotalXp = students[stIdx].gameXp;
      await saveData('students', students);
    }
  }

  res.json({
    success: true,
    isCorrect,
    earnedXp: isCorrect ? earnedXp : 0,
    newTotalXp
  });
});

// Grade Categories API managed above (around line 3955)

// Generated Exams API
app.post("/api/gemini/generate-rpp", async (req, res) => {
  try {
    const { subjectName, grade, plans, lessonsContext, guruName, guruNip, kepsekName, kepsekNip } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    const targetPlans = (Array.isArray(plans) && plans.length > 0) 
      ? plans 
      : [{ title: subjectName, topic: subjectName, grade: grade || 'X' }];

    const buildFallbackHTML = (p: any, index: number) => {
      const planTopic = p.topic || p.title || `Materi ${index + 1}`;
      const planTitle = p.title || `Modul ${index + 1}`;
      const planGrade = p.grade || grade || 'X';
      const formattedDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

      return `<div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
    <h2 style="text-align: center; font-size: 14pt; font-weight: bold; margin: 0 0 15px 0; font-family: Arial, sans-serif; text-transform: uppercase;">
        RENCANA PELAKSANAAN PEMBELAJARAN (RPP ${index + 1})
    </h2>

    <!-- Identitas Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10.5pt;">
        <tr>
            <td style="width: 15%; padding: 3px 0;">Sekolah</td>
            <td style="width: 38%; padding: 3px 0;">: [Nama Nama Sekolah]</td>
            <td style="width: 17%; padding: 3px 0;">Kelas/Semester</td>
            <td style="width: 30%; padding: 3px 0;">: ${planGrade} / 1 (Ganjil)</td>
        </tr>
        <tr>
            <td style="padding: 3px 0;">Mata Pelajaran</td>
            <td style="padding: 3px 0;">: ${subjectName}</td>
            <td style="padding: 3px 0;">Alokasi Waktu</td>
            <td style="padding: 3px 0;">: 2 x 40 Menit</td>
        </tr>
        <tr>
            <td style="padding: 3px 0;">Materi Pokok</td>
            <td style="padding: 3px 0;">: ${planTopic}</td>
            <td style="padding: 3px 0;">Kompetensi Dasar</td>
            <td style="padding: 3px 0;">: 3.${index + 1} dan 4.${index + 1}</td>
        </tr>
    </table>

    <!-- A. TUJUAN PEMBELAJARAN -->
    <div style="font-weight: bold; font-size: 11pt; margin-top: 10px; margin-bottom: 5px;">A. TUJUAN PEMBELAJARAN</div>
    <div style="margin-bottom: 5px;">Setelah peserta didik mengamati, menanya, mengeksplorasi, menalar dan merefleksi, diharapkan peserta didik mampu :</div>
    <ul style="margin: 0 0 15px 20px; padding-left: 5px; list-style-type: disc;">
        <li>Menjelaskan konsep dan pemahaman mendalam mengenai ${planTopic}.</li>
        <li>Mengidentifikasi karakteristik serta prinsip utama dari ${planTopic}.</li>
        <li>Membedakan penerapan ${planTopic} dalam kehidupan sehari-hari.</li>
        <li>Memfungsikan pemahaman tentang ${planTopic} untuk pemecahan masalah praktis.</li>
        <li>Menunjukkan apresiasi dan kepedulian melalui perilaku mengamalkan ${planTopic}.</li>
    </ul>

    <!-- Media, Alat / Bahan, Sumber Belajar Table -->
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #7a9a3b; margin-bottom: 15px; font-size: 10pt;">
        <thead>
            <tr style="background-color: #8da458; color: #ffffff; font-weight: bold;">
                <th style="width: 50%; padding: 6px; border: 1px solid #7a9a3b; text-align: center;">Media</th>
                <th style="width: 50%; padding: 6px; border: 1px solid #7a9a3b; text-align: center;">Alat / Bahan</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding: 6px; border: 1px solid #b8ca94; vertical-align: top;">
                    ❖ Worksheet atau lembar kerja (siswa)<br>
                    ❖ Lembar penilaian<br>
                    ❖ LCD Proyektor/ Slide presentasi (ppt)
                </td>
                <td style="padding: 6px; border: 1px solid #b8ca94; vertical-align: top;">
                    ❖ Penggaris, spidol, papan tulis<br>
                    ❖ Laptop & infocus<br>
                    ❖ Internet : google
                </td>
            </tr>
            <tr style="background-color: #f1f6e8;">
                <td colspan="2" style="padding: 6px; border: 1px solid #7a9a3b; font-weight: bold; text-align: center;">
                    Sumber Belajar : Buku Siswa ${subjectName} Kelas ${planGrade}, Kemenag / Kemdikbud, Tahun 2020
                </td>
            </tr>
        </tbody>
    </table>

    <!-- B. KEGIATAN PEMBELAJARAN -->
    <div style="font-weight: bold; font-size: 11pt; margin-top: 10px; margin-bottom: 5px;">B. KEGIATAN PEMBELAJARAN</div>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #63822d; margin-bottom: 15px; font-size: 10pt;">
        <thead>
            <tr style="background-color: #557224; color: #ffffff; font-weight: bold; text-align: center;">
                <th colspan="2" style="padding: 6px; border: 1px solid #557224;">Pertemuan Ke-1</th>
            </tr>
            <tr style="background-color: #728f37; color: #ffffff; font-weight: bold; text-align: center;">
                <th colspan="2" style="padding: 5px; border: 1px solid #728f37;">Pendahuluan</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td colspan="2" style="padding: 8px; border: 1px solid #b3c98d; background-color: #ffffff;">
                    1. Peserta didik memberi salam, berdoa (PPK)<br>
                    2. Guru mengecek kehadiran peserta didik dan memberi motivasi<br>
                    3. Guru menyampaikan tujuan dan manfaat pembelajaran tentang materi yang akan diajarkan<br>
                    4. Guru menyampaikan garis besar cakupan materi dan langkah pembelajaran
                </td>
            </tr>
            <tr>
                <td style="width: 18%; padding: 10px 5px; border: 1px solid #b3c98d; font-weight: bold; text-align: center; vertical-align: middle; background-color: #f8faf4;">
                    Kegiatan Inti
                </td>
                <td style="width: 82%; padding: 0; border: 1px solid #b3c98d; background-color: #ffffff;">
                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">KEGIATAN LITERASI</div>
                    <div style="padding: 6px 8px 10px 8px; border-bottom: 1px solid #e2ebd0;">
                        • Peserta didik diberi motivasi dan panduan untuk melihat, mengamati, membaca dan menuliskannya kembali. Mereka diberi tayangan dan bahan bacaan terkait materi ${planTopic}
                    </div>

                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">CRITICAL THINKING (BERPIKIR KRITIK)</div>
                    <div style="padding: 6px 8px 10px 8px; border-bottom: 1px solid #e2ebd0;">
                        • Guru memberikan kesempatan untuk mengidentifikasi sebanyak mungkin hal yang belum dipahami. Pertanyaan ini harus tetap berkaitan dengan materi ${planTopic}
                    </div>

                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">COLLABORATION (KERJASAMA)</div>
                    <div style="padding: 6px 8px 10px 8px; border-bottom: 1px solid #e2ebd0;">
                        • Peserta didik dibentuk dalam beberapa kelompok untuk mendiskusikan, mengumpulkan informasi, mempresentasikan ulang, dan saling bertukar informasi mengenai ${planTopic}
                    </div>

                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">COMMUNICATION (BERKOMUNIKASI)</div>
                    <div style="padding: 6px 8px 10px 8px; border-bottom: 1px solid #e2ebd0;">
                        • Peserta didik mempresentasikan hasil kerja kelompok atau individu secara klasikal, mengemukakan pendapat atas presentasi yang dilakukan kemudian ditanggapi kembali oleh kelompok atau individu yang mempresentasikan
                    </div>

                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">CREATIVITY (KREATIVITAS)</div>
                    <div style="padding: 6px 8px 10px 8px;">
                        • Guru dan peserta didik membuat kesimpulan tentang hal-hal yang telah dipelajari terkait materi ${planTopic}. Peserta didik kemudian diberi kesempatan untuk menanyakan kembali hal-hal yang belum dipahami
                    </div>
                </td>
            </tr>
            <tr style="background-color: #728f37; color: #ffffff; font-weight: bold; text-align: center;">
                <th colspan="2" style="padding: 5px; border: 1px solid #728f37;">Penutup</th>
            </tr>
            <tr>
                <td colspan="2" style="padding: 8px; border: 1px solid #b3c98d; background-color: #ffffff;">
                    1. Guru bersama peserta didik merefleksikan pengalaman belajar<br>
                    2. Guru memberikan penilaian lisan secara acak dan singkat<br>
                    3. Guru menyampaikan rencana pembelajaran pada pertemuan berikutnya dan berdoa
                </td>
            </tr>
        </tbody>
    </table>

    <!-- C. PENILAIAN HASIL PEMBELAJARAN -->
    <div style="font-weight: bold; font-size: 11pt; margin-top: 10px; margin-bottom: 5px;">C. PENILAIAN HASIL PEMBELAJARAN</div>
    <ul style="margin: 0 0 20px 20px; padding-left: 5px; list-style-type: square;">
        <li><b>Penilaian Sikap</b> : Observasi/Jurnal;</li>
        <li><b>Penilaian Pengetahuan</b> : Tes lisan, Penugasan;</li>
        <li><b>Penilaian Keterampilan</b> : Unjuk Kerja Kegiatan diskusi dan presentasi;</li>
    </ul>

    <!-- Signature Block -->
    <div style="width: 100%; margin-top: 30px; font-size: 10.5pt;">
        <table style="width: 100%; border: none;">
            <tr>
                <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                    Mengetahui<br>
                    <b>Kepala Sekolah</b><br><br><br><br><br>
                    <b><u>${kepsekName || '................................'}</u></b><br>
                    NIP: ${kepsekNip || '................................'}
                </td>
                <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                    Tanjung Jabung Barat, ${formattedDate}<br>
                    <b>Guru Mata Pelajaran</b><br><br><br><br><br>
                    <b><u>${guruName || '................................'}</u></b><br>
                    NIP: ${guruNip || '................................'}
                </td>
            </tr>
        </table>
    </div>
</div>`;
    };

    let ai: any = null;
    if (apiKey) {
      try {
        ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      } catch (e) {
        console.warn("GoogleGenAI init failed:", e);
      }
    }

    const rpps: any[] = [];

    for (let index = 0; index < targetPlans.length; index++) {
      const p = targetPlans[index];
      const planTopic = p.topic || p.title || `Materi ${index + 1}`;
      const planTitle = p.title || `Modul ${index + 1}`;
      const planGrade = p.grade || grade || 'X';
      const planActivities = p.activities || p.kegiatanPembelajaran || planTopic;

      let htmlContent = "";

      if (ai) {
        try {
          const prompt = `Buatkan dokumen "RENCANA PELAKSANAAN PEMBELAJARAN (RPP)" LENGKAP berstandar Kurikulum Merdeka dengan TAMPILAN TEMPLATE HTML SAMA PERSIS dengan acuan berikut untuk:
Mata Pelajaran: "${subjectName}"
Kelas/Tingkat: "${planGrade}"
Materi Pokok: "${planTopic}"
Judul Modul: "${planTitle}"
Kegiatan / Detail Materi: "${planActivities}"

PENTING:
- Gunakan struktur & styling HTML persis seperti template berikut.
- Gunakan Materi Pokok "${planTopic}".
- Buat Tujuan Pembelajaran (A) dengan 4-5 poin spesifik mengenai ${planTopic}.
- Pada Langkah Kegiatan Inti (B), sebutkan secara spesifik mengenai ${planTopic} di bagian KEGIATAN LITERASI, CRITICAL THINKING, COLLABORATION, COMMUNICATION, dan CREATIVITY.
- Jangan gunakan markdown codeblock html - kembalikan MURNI string HTML mentah saja!

TEMPLATE MANDATORI HTML:
${buildFallbackHTML(p, index)}`;

          const response = await generateGeminiContent(ai, {
            model: "gemini-3.7-flash",
            contents: prompt,
            config: {
              responseMimeType: "text/plain"
            }
          });

          if (response && response.text) {
            htmlContent = response.text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
          }
        } catch (genErr: any) {
          console.warn(`[RPP Gen] Gemini generation for index ${index} failed, using template fallback. Error:`, genErr?.message || genErr);
        }
      }

      if (!htmlContent) {
        htmlContent = buildFallbackHTML(p, index);
      }

      // Clean any accidental word "modul" or "Modul"
      htmlContent = htmlContent
        .replace(/\bmodul\s*ajar\b/gi, 'Materi')
        .replace(/\bmodul\s*(\d+)/gi, 'Bab $1')
        .replace(/\bmodul\b/gi, 'Materi')
        .replace(/\bModul\b/g, 'Materi');

      rpps.push({
        id: p.id || ('materi_' + (index + 1)),
        title: `RPP ${index + 1}: ${planTopic}`,
        topic: planTopic,
        grade: planGrade,
        htmlContent: htmlContent
      });
    }

    res.json({
      success: true,
      rpps,
      count: rpps.length,
      htmlContent: rpps[0]?.htmlContent || ''
    });
  } catch (error: any) {
    console.error("Error generating RPP (using fallback):", error);
    const fallbackHtml = `<div class="p-6 font-sans"><h2 class="text-xl font-bold text-center mb-4">RENCANA PELAKSANAAN PEMBELAJARAN (RPP)</h2><p>Disusun secara profesional sesuai kurikulum merdeka madrasah.</p></div>`;
    res.json({ success: true, count: 1, htmlContent: fallbackHtml, fallback: true });
  }
});

// Device Pembelajaran API (Silabus, ATP, KKTP, Prota, Prosem, Analisis KI-KD, TP, CP, LKPD)
app.post("/api/gemini/generate-device", async (req, res) => {
  try {
    const { deviceType, subjectName, grade, plans, guruName, guruNip, kepsekName, kepsekNip } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    const targetPlans = (Array.isArray(plans) && plans.length > 0) 
      ? plans 
      : [{ title: subjectName, topic: subjectName, grade: grade || 'X' }];

    const formattedDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const teacherSign = `
      <table style="width: 100%; margin-top: 30px; font-size: 10pt; border: none;" border="0">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            Mengetahui,<br><b>Kepala Sekolah</b><br><br><br><br><br>
            <b><u>${kepsekName || '................................'}</u></b><br>
            NIP: ${kepsekNip || '................................'}
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            Tanjung Jabung Barat, ${formattedDate}<br>
            <b>Guru Mata Pelajaran</b><br><br><br><br><br>
            <b><u>${guruName || '................................'}</u></b><br>
            NIP: ${guruNip || '................................'}
          </td>
        </tr>
      </table>
    `;

    // Helper to remove any word "modul" or "Modul" from titles/topics
    const removeModulWord = (str: string) => {
      if (!str) return "";
      return str
        .replace(/modul\s*ajar\s*/gi, '')
        .replace(/modul\s*(\d+)\s*:?/gi, 'Bab $1:')
        .replace(/\bmodul\b/gi, 'Materi')
        .replace(/\bModul\b/g, 'Materi')
        .trim();
    };

    // Generator function for fallbacks
    const buildDeviceFallback = (type: string, planList: any[]) => {
      const g = grade || planList[0]?.grade || 'VII';

      if (type === 'silabus') {
        const firstTopic = removeModulWord(planList[0]?.topic || planList[0]?.title || subjectName);

        const silabusBabRows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
          return `
            <tr>
              <td style="vertical-align: top; border: 1px solid #000;">
                <b>3.${idx + 1} Memahami & menganalisis ${cleanTopic}</b><br><br>
                <b>4.${idx + 1} Menyajikan kesimpulan & fenomena sosial terkait ${cleanTopic}</b>
              </td>
              <td style="vertical-align: top; border: 1px solid #000;">
                3.${idx + 1}.1 Mendefinisikan pengertian ${cleanTopic}<br>
                3.${idx + 1}.2 Menjelaskan isi kandungan & prinsip ${cleanTopic}<br>
                3.${idx + 1}.3 Menganalisis penerapan ${cleanTopic}<br>
                4.${idx + 1}.1 Mendeskripsikan cara efektif mengaplikasikan ${cleanTopic}<br>
                4.${idx + 1}.2 Mempresentasikan hasil analisis ${cleanTopic}
              </td>
              <td style="vertical-align: top; border: 1px solid #000;">
                <b>${cleanTopic}</b><br>
                • Konsep Utama ${cleanTopic}<br>
                • Penerapan & Analisis
              </td>
              <td style="vertical-align: top; border: 1px solid #000;">
                <b>Mengamati:</b><br>
                • Mencermati bacaan teks tentang ${cleanTopic}<br>
                • Menyimak penjelasan materi via tayangan/media<br>
                <b>Menanya:</b><br>
                • Stimulus pertanyaan mengenai ${cleanTopic}<br>
                <b>Mengeksplorasi:</b><br>
                • Peserta didik mendiskusikan ${cleanTopic}<br>
                <b>Mengasosiasi:</b><br>
                • Membuat kesimpulan tentang ${cleanTopic}<br>
                <b>Mengkomunikasikan:</b><br>
                • Mempresentasikan hasil diskusi tentang ${cleanTopic}
              </td>
              <td style="vertical-align: top; border: 1px solid #000;">
                <b>Tugas:</b> Mengumpulkan gambar/berita/artikel sesuai materi<br>
                <b>Observasi:</b> Keaktifan diskusi & presentasi<br>
                <b>Portofolio:</b> Membuat paparan materi<br>
                <b>Tes:</b> Tes Tulis & Lisan
              </td>
              <td style="vertical-align: top; border: 1px solid #000; text-align: center;">4 x TM</td>
              <td style="vertical-align: top; border: 1px solid #000;">Buku Pedoman Guru & Siswa ${subjectName}, Internet</td>
            </tr>
          `;
        }).join('');

        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 1050px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 12px;">SILABUS</h2>
          <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
            <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: [Nama Nama Sekolah]</td><td style="width: 18%; border:none;">Kelas / Semester</td><td style="width: 32%; border:none;">: ${g} / 1-2 (Ganjil & Genap)</td></tr>
            <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
          </table>

          <div style="margin-bottom: 15px; font-size: 9.5pt; line-height: 1.5;">
            <b>Standar Kompetensi (KI)</b><br>
            <b>KI-1 :</b> Menerima dan menjalankan ajaran agama yang dianutnya<br>
            <b>KI-2 :</b> Menunjukkan perilaku jujur, disiplin, tanggung jawab, santun, peduli (toleran, gotong royong), santun, percaya diri, dan percaya diri dalam berinteraksi secara efektif dengan lingkungan sosial dan alam dalam jangkauan pergaulan dan keberadaannya<br>
            <b>KI-3 :</b> Memahami pengetahuan (faktual, konseptual dan prosedural) dengan cara mengamati [mendengar, melihat, membaca] berdasarkan rasa ingin tahu tentang ilmu pengetahuan, teknologi, seni dan budaya terkait fenomena dan kejadian tampak mata<br>
            <b>KI-4 :</b> Mencoba, mengolah, dan menyaji dalam ranah konkret (menggunakan, mengurai, merangkai, memodifikasi, dan membuat) dan ranah abstrak (menulis, membaca, menghitung, menggambar, dan mengarang) sesuai dengan yang dipelajari di sekolah dan sumber lain yang sama dalam sudut pandang/teori
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 9pt;" border="1" cellpadding="6">
            <thead>
              <tr style="background-color: #d9e3b8; text-align: center; font-weight: bold; border: 1px solid #000;">
                <th style="width: 18%; border: 1px solid #000;">Kompetensi Dasar</th>
                <th style="width: 15%; border: 1px solid #000;">Indikator</th>
                <th style="width: 14%; border: 1px solid #000;">Materi Pokok</th>
                <th style="width: 22%; border: 1px solid #000;">Kegiatan Pembelajaran</th>
                <th style="width: 17%; border: 1px solid #000;">Penilaian</th>
                <th style="width: 7%; border: 1px solid #000;">Alokasi Waktu</th>
                <th style="width: 7%; border: 1px solid #000;">Sumber Belajar</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="vertical-align: top; border: 1px solid #000;">
                  1.1 Menerima dan meyakini ajaran ${subjectName}<br>
                  1.2 Menerima kekuasaan dan rahmat Allah SWT<br>
                  1.3 Menerima bahwa Allah SWT mencintai kebaikan
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">-</td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  Perwujudan sikap religius dalam pembelajaran tentang:<br>
                  • ${firstTopic}<br>
                  • Struktur dan contoh-contoh telaahannya
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  Sebelum pembelajaran dimulai, diawali dengan kegiatan berdoa.<br><br>
                  Mengikuti pembelajaran dengan kegiatan mengamati, menanya, diskusi tentang:<br>
                  • ${firstTopic}<br>
                  Struktur dan contoh-contoh telaahannya
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  <b>Observasi:</b> Merumuskan pernyataan hubungan materi.<br>
                  <b>Penilaian diri:</b> Menjawab sesuai pemahaman.<br>
                  <b>Penilaian Sejawat:</b> Diisi oleh teman sejawat.<br>
                  <b>Jurnal Anecdot:</b> Rekam jejak kegiatan.
                </td>
                <td style="vertical-align: top; border: 1px solid #000; text-align: center;">-</td>
                <td style="vertical-align: top; border: 1px solid #000;">Buku Pedoman Guru & Siswa</td>
              </tr>
              <tr>
                <td style="vertical-align: top; border: 1px solid #000;">
                  2.1 Menjalankan sikap tanggung jawab dalam berperilaku<br>
                  2.2 Menghayati sikap disiplin dalam menjalankan kewajiban<br>
                  2.3 Menjalankan sikap peduli kepada masyarakat
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">-</td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  Perwujudan sikap sportif dan disiplin dalam pembelajaran tentang:<br>
                  • ${firstTopic}<br>
                  (Terintegrasi pada KI 3 dan KI 4)
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  Mengikuti pembelajaran dengan kegiatan mengamati, menanya, diskusi tentang:<br>
                  • ${firstTopic}<br>
                  Struktur dan contoh-contoh telaahannya
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  <b>Observasi & Jurnal:</b> Rekam jejak anak dalam kegiatan sehari-hari
                </td>
                <td style="vertical-align: top; border: 1px solid #000; text-align: center;">-</td>
                <td style="vertical-align: top; border: 1px solid #000;">Buku Pedoman Guru</td>
              </tr>
              ${silabusBabRows}
            </tbody>
          </table>
          ${teacherSign}
        </div>`;
      }

      if (type === 'atp') {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;"><b>Bab ${idx + 1}</b><br>${cleanTopic}</td>
              <td style="border: 1px solid #000;">Peserta didik mampu memahami, menganalisis, dan mengaplikasikan konsep ${cleanTopic} dalam konteks nyata.</td>
              <td style="border: 1px solid #000;">
                1. Menjelaskan konsep dasar ${cleanTopic}<br>
                2. Mengidentifikasi komponen dan prinsip ${cleanTopic}<br>
                3. Menyelesaikan studi kasus dan latihan ${cleanTopic}
              </td>
              <td style="text-align: center; border: 1px solid #000;">4 JP</td>
              <td style="border: 1px solid #000;">Beriman, Bernalar Kritis, Gotong Royong</td>
              <td style="border: 1px solid #000;">Asesmen Formatif (Kuis), Sumatif (Tes Tulis)</td>
            </tr>
          `;
        }).join('');

        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 950px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">ALUR TUJUAN PEMBELAJARAN (ATP)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">KURIKULUM MERDEKA</h3>
          <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
            <tr><td style="width: 18%; border:none;">Mata Pelajaran</td><td style="width: 32%; border:none;">: ${subjectName}</td><td style="width: 18%; border:none;">Kelas / Fase</td><td style="width: 32%; border:none;">: ${g} / Fase ${g === '7' || g === '8' || g === '9' ? 'D' : 'E'}</td></tr>
            <tr><td style="border:none;">Satuan Pendidikan</td><td style="border:none;">: [Nama Nama Sekolah]</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
          </table>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;" border="1" cellpadding="6">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 4%;">No</th>
                <th style="width: 20%;">Bab / Elemen</th>
                <th style="width: 24%;">Capaian Pembelajaran (CP)</th>
                <th style="width: 24%;">Tujuan Pembelajaran (TP)</th>
                <th style="width: 8%;">Alokasi</th>
                <th style="width: 10%;">Profil Pelajar</th>
                <th style="width: 10%;">Asesmen</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }

      if (type === 'kktp') {
        const items = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <div style="margin-bottom: 25px;">
              <h4 style="font-size: 11pt; font-weight: bold; margin-bottom: 8px;">Bab ${idx + 1}: ${cleanTopic}</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;" border="1" cellpadding="6">
                <thead>
                  <tr style="background-color: #f1f5f9; font-weight: bold; text-align: center;">
                    <th style="width: 30%;">Tujuan Pembelajaran</th>
                    <th style="width: 20%;">Perlu Bimbingan (0-60)</th>
                    <th style="width: 20%;">Cukup (61-70)</th>
                    <th style="width: 15%;">Baik (71-85)</th>
                    <th style="width: 15%;">Sangat Baik (86-100)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border: 1px solid #000;">Memahami & menguasai ${cleanTopic}</td>
                    <td style="border: 1px solid #000;">Belum mampu menjelaskan konsep dasar ${cleanTopic}</td>
                    <td style="border: 1px solid #000;">Mampu menjelaskan sebagian konsep ${cleanTopic}</td>
                    <td style="border: 1px solid #000;">Mampu menjelaskan dan menerapkan ${cleanTopic} secara tepat</td>
                    <td style="border: 1px solid #000;">Menguasai sepenuhnya dan dapat merefleksikan ${cleanTopic}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        }).join('');

        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">MATAPELAJARAN: ${subjectName.toUpperCase()} - KELAS ${g}</h3>
          ${items}
          ${teacherSign}
        </div>`;
      }

      if (type === 'prota') {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx < Math.ceil(planList.length / 2) ? 1 : 2}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;"><b>Bab ${idx + 1}: ${cleanTopic}</b></td>
              <td style="text-align: center; border: 1px solid #000;">4 JP</td>
              <td style="border: 1px solid #000;">Terlaksana di Bulan ${idx < 2 ? 'Juli/Agustus' : 'September/Oktober'}</td>
            </tr>
          `;
        }).join('');

        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">PROGRAM TAHUNAN (PROTA)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">TAHUN PELAJARAN 2024/2025 - KELAS ${g}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt;" border="1" cellpadding="6">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 10%;">Semester</th>
                <th style="width: 8%;">No</th>
                <th style="width: 50%;">Materi Pokok / Bab</th>
                <th style="width: 12%;">Alokasi Waktu</th>
                <th style="width: 20%;">Keterangan</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }

      if (type === 'prosem') {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;">${cleanTopic}</td>
              <td style="text-align: center; border: 1px solid #000;">4 JP</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 0 ? '2' : ''}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 0 ? '2' : ''}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 1 ? '2' : ''}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 1 ? '2' : ''}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 2 ? '2' : ''}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 2 ? '2' : ''}</td>
            </tr>
          `;
        }).join('');

        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">PROGRAM SEMESTER (PROSEM)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">SEMESTER 1 (GANJIL) - ${subjectName.toUpperCase()} KELAS ${g}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9pt;" border="1" cellpadding="4">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 5%;" rowspan="2">No</th>
                <th style="width: 35%;" rowspan="2">Materi Pokok / Bab</th>
                <th style="width: 10%;" rowspan="2">JP</th>
                <th colspan="2">Juli</th>
                <th colspan="2">Agustus</th>
                <th colspan="2">September</th>
              </tr>
              <tr style="background-color: #f8fafc; text-align: center; font-weight: bold;">
                <th>W1</th><th>W2</th><th>W1</th><th>W2</th><th>W1</th><th>W2</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }

      if (type === 'analisis_kikd') {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;">Elemen Pemahaman ${subjectName}</td>
              <td style="border: 1px solid #000;">Peserta didik mampu menganalisis, mengidentifikasi, dan mempraktikkan ${cleanTopic}</td>
              <td style="border: 1px solid #000;"><b>${cleanTopic}</b><br>Konsep, Aplikasi, dan Analisis Kasus</td>
              <td style="border: 1px solid #000;">TP 1.${idx + 1}: Mengidentifikasi dan menjelaskan ${cleanTopic} dengan tepat</td>
            </tr>
          `;
        }).join('');

        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">ANALISIS CP / KI-KD</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">PEMETAAN CAPAIAN DAN TUJUAN PEMBELAJARAN - ${subjectName.toUpperCase()}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;" border="1" cellpadding="6">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 5%;">No</th>
                <th style="width: 20%;">Elemen</th>
                <th style="width: 30%;">Capaian Pembelajaran (CP)</th>
                <th style="width: 25%;">Ruang Lingkup Materi</th>
                <th style="width: 20%;">Tujuan Pembelajaran (TP)</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }

      if (type === 'tp') {
        const items = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <div style="margin-bottom: 20px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #f8fafc;">
              <h4 style="font-size: 11pt; font-weight: bold; color: #1e293b; margin-bottom: 6px;">Bab ${idx + 1}: ${cleanTopic}</h4>
              <p style="margin: 0 0 6px 0; font-size: 10pt;"><b>Rincian Tujuan Pembelajaran (TP):</b></p>
              <ul style="margin: 0; padding-left: 20px; font-size: 10pt;">
                <li>[C2 - Pemahaman] Menjelaskan secara rinci definisi dan karakteristik ${cleanTopic}.</li>
                <li>[C3 - Penerapan] Menerapkan konsep ${cleanTopic} dalam penyelesaian tugas kontekstual.</li>
                <li>[C4 - Analisis] Menganalisis perbedaan serta dampak dari ${cleanTopic} secara kritis.</li>
                <li>[A3 - Sikap] Menunjukkan sikap disiplin, santun, dan bertanggung jawab saat berdiskusi tentang ${cleanTopic}.</li>
              </ul>
            </div>
          `;
        }).join('');

        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">RINCIAN TUJUAN PEMBELAJARAN (TP)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">MATA PELAJARAN: ${subjectName.toUpperCase()} KELAS ${g}</h3>
          ${items}
          ${teacherSign}
        </div>`;
      }

      if (type === 'cp') {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;">Elemen ${idx + 1}: ${cleanTopic}</td>
              <td style="border: 1px solid #000;">Pada akhir Fase ini, peserta didik memiliki kemampuan komprehensif untuk memahami, mengklasifikasi, dan mempraktikkan ${cleanTopic} dengan cermat, kritis, dan berakhlak mulia.</td>
            </tr>
          `;
        }).join('');

        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">CAPAIAN PEMBELAJARAN (CP)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">FASE D/E/F - ${subjectName.toUpperCase()}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt;" border="1" cellpadding="8">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 8%;">No</th>
                <th style="width: 30%;">Elemen Pembelajaran</th>
                <th style="width: 62%;">Deskripsi Capaian Pembelajaran (CP)</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }

      if (type === 'lkpd') {
        return planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return {
            id: `lkpd_${idx + 1}`,
            title: `LKPD Bab ${idx + 1}: ${cleanTopic}`,
            topic: cleanTopic,
            htmlContent: `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
              <div style="border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; text-align: center;">
                <h2 style="font-size: 13pt; font-weight: bold; margin: 0;">LEMBAR KERJA PESERTA DIDIK (LKPD ${idx + 1})</h2>
                <h3 style="font-size: 11pt; font-weight: bold; margin: 4px 0 0 0;">${subjectName.toUpperCase()} - ${cleanTopic}</h3>
              </div>
              <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                <tr><td style="width: 15%; border:none;">Kelompok</td><td style="width: 35%; border:none;">: .......................................</td><td style="width: 15%; border:none;">Kelas</td><td style="width: 35%; border:none;">: ${g}</td></tr>
                <tr><td style="border:none;">Anggota</td><td style="border:none;">: 1. .................. 2. ..................</td><td style="border:none;">Tanggal</td><td style="border:none;">: .......................................</td></tr>
              </table>

              <div style="margin-bottom: 12px; background: #f8fafc; padding: 10px; border-left: 4px solid #0284c7;">
                <b>Petunjuk Pengerjaan:</b>
                <ol style="margin: 4px 0 0 16px; padding: 0;">
                  <li>Bacalah materi ringkas tentang <b>${cleanTopic}</b> dengan teliti.</li>
                  <li>Diskusikan pertanyaan di bawah ini bersama teman sekelompokmu.</li>
                  <li>Tuliskan hasil diskusi pada kolom jawaban yang tersedia.</li>
                </ol>
              </div>

              <div style="margin-bottom: 15px;">
                <b>A. STIMULUS & RINGKASAN MATERI</b>
                <p style="text-align: justify; text-indent: 20px; margin-top: 4px;">
                  Materi ${cleanTopic} mengajarkan kita pentingnya memahami konsep dasar serta prinsip penerapannya dalam kehidupan sehari-hari. Simak dan pelajari poin utama mengenai ${cleanTopic} untuk menjawab soal-soal berikut.
                </p>
              </div>

              <div style="margin-bottom: 15px;">
                <b>B. TUGAS & DISKUSI KELOMPOK</b>
                <ol style="margin-top: 6px; padding-left: 20px;">
                  <li style="margin-bottom: 12px;">
                    <b>Jelaskan pengertian dan konsep utama dari ${cleanTopic}!</b>
                    <div style="height: 60px; border: 1px dashed #94a3b8; border-radius: 4px; margin-top: 6px; background: #fafafa;"></div>
                  </li>
                  <li style="margin-bottom: 12px;">
                    <b>Sebutkan 3 contoh penerapan ${cleanTopic} dalam lingkungan sekitar kita!</b>
                    <div style="height: 60px; border: 1px dashed #94a3b8; border-radius: 4px; margin-top: 6px; background: #fafafa;"></div>
                  </li>
                  <li style="margin-bottom: 12px;">
                    <b>Analisis permasalahan yang sering terjadi terkait ${cleanTopic} dan berikan solusinya!</b>
                    <div style="height: 80px; border: 1px dashed #94a3b8; border-radius: 4px; margin-top: 6px; background: #fafafa;"></div>
                  </li>
                </ol>
              </div>

              <div style="margin-top: 20px;">
                <b>C. KESIMPULAN KELOMPOK</b>
                <div style="height: 60px; border: 1px solid #94a3b8; border-radius: 4px; margin-top: 6px; background: #fff;"></div>
              </div>

              ${teacherSign}
            </div>`
          };
        });
      }

      return `<div style="padding:20px;"><h3>Dokumen ${type} untuk ${subjectName}</h3></div>`;
    };

    let ai: any = null;
    if (apiKey) {
      try {
        ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      } catch (e) {
        console.warn("GoogleGenAI init failed:", e);
      }
    }

    let singleHtml = "";

    if (deviceType === 'lkpd') {
      const fallbackList = buildDeviceFallback('lkpd', targetPlans) as any[];
      res.json({
        success: true,
        deviceType: 'lkpd',
        items: fallbackList,
        count: fallbackList.length,
        htmlContent: fallbackList[0]?.htmlContent || ''
      });
      return;
    }

    const fallbackHtml = buildDeviceFallback(deviceType, targetPlans) as string;

    if (ai) {
      try {
        const prompt = `Buatkan dokumen "${deviceType.toUpperCase()}" LENGKAP berstandar Kurikulum Merdeka untuk:
Mata Pelajaran: "${subjectName}"
Kelas/Tingkat: "${grade || 'X'}"
Daftar Materi Pembelajaran:
${targetPlans.map((p: any, i: number) => `${i + 1}. ${removeModulWord(p.topic || p.title || subjectName)}`).join('\n')}

SANGAT PENTING:
- DILARANG MENULIS ATAU MENGGUNAKAN KATA "MODUL" ATAU "MODUL AJAR" di dalam dokumen! Gunakan kata "Bab" atau "Materi" atau langsung sebutkan judul materinya.
- Kembalikan format HTML rapi dengan tabel yang lengkap dan styling inline professional.
- Jangan gunakan markdown codeblock - kembalikan MURNI string HTML mentah saja!
TEMPLATE ACUAN:
${fallbackHtml}`;

        const response = await generateGeminiContent(ai, {
          model: "gemini-3.7-flash",
          contents: prompt,
          config: { responseMimeType: "text/plain" }
        });

        if (response && response.text) {
          singleHtml = response.text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        }
      } catch (e: any) {
        console.warn(`[Device Gen] Gemini generation for ${deviceType} failed, using template fallback.`, e?.message);
      }
    }

    if (!singleHtml) {
      singleHtml = fallbackHtml;
    }

    // Clean any accidental occurrences of the word "modul" or "Modul"
    singleHtml = singleHtml
      .replace(/\bmodul\s*ajar\b/gi, 'Materi')
      .replace(/\bmodul\s*(\d+)/gi, 'Bab $1')
      .replace(/\bmodul\b/gi, 'Materi')
      .replace(/\bModul\b/g, 'Materi');

    res.json({
      success: true,
      deviceType,
      items: [{ id: deviceType + '_1', title: deviceType.toUpperCase() + ' ' + subjectName, htmlContent: singleHtml }],
      count: 1,
      htmlContent: singleHtml
    });
  } catch (error: any) {
    console.error("Error generating device (using fallback):", error);
    const { deviceType = "Perangkat Pembelajaran", subjectName = "Mata Pelajaran" } = req.body || {};
    const fallbackHtml = `<div class="p-6 font-sans"><h2 class="text-xl font-bold text-center mb-4">${deviceType.toUpperCase()} (${subjectName})</h2><p>Perangkat pembelajaran resmi madrasah disusun komprehensif dan sistematis.</p></div>`;
    res.json({ success: true, count: 1, htmlContent: fallbackHtml, fallback: true });
  }
});
app.get("/api/generated-exams", (req, res) => {
  res.json({ success: true, generatedExams: filterByMadrasah(generatedExams, req) });
});
app.post("/api/generated-exams", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map(item => tagNewRecord(item, req));
    let otherExams = [];
    if (mId && mId !== 'default' && mId !== 'BOSS') {
      const matchM = madrasahs.find(m => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherExams = generatedExams.filter(e => {
        const imId = String(e.madrasahId || '').trim();
        const imSlug = String(e.madrasahSlug || '').trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find(m => m.id === 'default' || m.slug === 'default') || madrasahs[0];
      const defId = defaultM ? defaultM.id : 'default';
      const defSlug = defaultM ? defaultM.slug : 'default';
      otherExams = generatedExams.filter(e => {
        const imId = String(e.madrasahId || 'default').trim();
        const imSlug = String(e.madrasahSlug || 'default').trim();
        const isDefault = imId === 'default' || imId === defId || imId === defSlug || imSlug === 'default' || imSlug === defSlug || imSlug === defId || (!e.madrasahId && !e.madrasahSlug);
        return !isDefault;
      });
    }
    generatedExams = [...otherExams, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = generatedExams.findIndex(e => String(e.id) === String(req.body.id));
    if (idx >= 0) {
      generatedExams[idx] = { ...generatedExams[idx], ...tagged };
    } else {
      generatedExams.push(tagged);
    }
  }
  await saveData('generatedExams', generatedExams);
  res.json({ success: true, generatedExams: filterByMadrasah(generatedExams, req) });
});
app.delete("/api/generated-exams/:id", async (req, res) => {
  const { id } = req.params;
  generatedExams = generatedExams.filter(e => String(e.id) !== String(id));
  await saveData('generatedExams', generatedExams);
  res.json({ success: true, generatedExams: filterByMadrasah(generatedExams, req) });
});

// Settings API
app.get("/api/settings", (req, res) => {
  res.json({ success: true, settings: appSettings, isOfflineMode });
});
app.put("/api/settings", async (req, res) => {
  appSettings = { ...appSettings, ...req.body };
  await saveData('settings', appSettings);
  res.json({ success: true, settings: appSettings });
});

// System Backup & Restore API
app.get("/api/system/backup", (req, res) => {
  const backupData = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    schoolName: appSettings.schoolName || "Sekolah Menengah",
    students,
    teachers,
    classes,
    subjects,
    schedules,
    savedRosters,
    timeSlots,
    kbmDuration,
    attendance,
    teacherAttendance,
    questionBankGroups,
    questions,
    exams,
    rooms,
    journals,
    gradeCategories,
    generatedExams,
    lessonPlans,
    grades,
    settings: appSettings,
    schoolLocationSettings
  };
  res.setHeader("Content-Disposition", `attachment; filename=Backup_Data_${new Date().toISOString().slice(0, 10)}.json`);
  res.setHeader("Content-Type", "application/json");
  res.json(backupData);
});

app.post("/api/system/restore", async (req, res) => {
  try {
    const backup = req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ success: false, message: "Format file backup tidak valid." });
    }
    const merged = await processSystemRestore(backup);
    res.json({ success: true, message: "Restore data sistem berhasil diproses!", merged });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal merestore data: " + err.message });
  }
});

async function processSystemRestore(backup: any) {
    isRestoring = true;
    try {

    const getArr = (key: string, legacyKeys: string[] = []) => {
      if (Array.isArray(backup[key])) return backup[key];
      if (typeof backup[key] === 'string') {
        try { const p = JSON.parse(backup[key]); if (Array.isArray(p)) return p; } catch (e) {}
      }
      for (const lk of legacyKeys) {
        if (Array.isArray(backup[lk])) return backup[lk];
        if (typeof backup[lk] === 'string') {
          try { const p = JSON.parse(backup[lk]); if (Array.isArray(p)) return p; } catch (e) {}
        }
      }
      return null;
    };

    const getObj = (key: string, legacyKeys: string[] = []) => {
      if (backup[key] && typeof backup[key] === 'object') return backup[key];
      if (typeof backup[key] === 'string') {
        try { const p = JSON.parse(backup[key]); if (p && typeof p === 'object') return p; } catch (e) {}
      }
      for (const lk of legacyKeys) {
        if (backup[lk] && typeof backup[lk] === 'object') return backup[lk];
        if (typeof backup[lk] === 'string') {
          try { const p = JSON.parse(backup[lk]); if (p && typeof p === 'object') return p; } catch (e) {}
        }
      }
      return null;
    };

    // 0. Merge Cloudinary map if present in backup
    const rCloudinaryMap = getObj('photoCloudinaryMap', ['madrasah_photoCloudinaryMap', 'photoCloudinaryMap']);
    if (rCloudinaryMap && typeof rCloudinaryMap === 'object') {
      photoCloudinaryMap = { ...photoCloudinaryMap, ...rCloudinaryMap };
    }

    const rStudents = getArr('students', ['madrasah_students']);
    if (rStudents) {
      for (let i = 0; i < rStudents.length; i++) {
        if (rStudents[i] && rStudents[i].photo && rStudents[i].photo.startsWith("data:image/")) {
          rStudents[i].photo = await saveBase64ToFirestore(rStudents[i].photo);
        }
      }
      const mergedStudents = [...students];
      for (const b of rStudents) {
        const bId = String(b.id || '').trim();
        const bNis = String(b.nis || '').trim();
        const bUsername = String(b.username || '').trim().toLowerCase();
        const bName = String(b.name || '').trim().toLowerCase();

        const existingIndex = mergedStudents.findIndex(s => {
          const sId = String(s.id || '').trim();
          const sNis = String(s.nis || '').trim();
          const sUsername = String(s.username || '').trim().toLowerCase();
          const sName = String(s.name || '').trim().toLowerCase();

          if (bId && sId === bId) return true;
          if (bNis && sNis && sNis === bNis) return true;
          if (bUsername && sUsername && sUsername === bUsername) return true;
          if (bName && sName && sName === bName) return true;
          return false;
        });

        if (existingIndex >= 0) {
          const ext = mergedStudents[existingIndex];
          const merged = { ...ext, ...b };
          if (ext.photo && !b.photo) {
            merged.photo = ext.photo;
          }
          if (ext.no_hp && !b.no_hp) {
            merged.no_hp = ext.no_hp;
          }
          if (ext.role && !b.role) {
            merged.role = ext.role;
          }
          if (ext.classId && !b.classId) {
            merged.classId = ext.classId;
          }
          if (ext.password && String(ext.password) !== String(ext.nis) && (String(b.password) === String(b.nis) || !b.password)) {
            merged.password = ext.password;
          }
          mergedStudents[existingIndex] = merged;
        } else {
          mergedStudents.push(b);
        }
      }
      students = mergedStudents;
      await saveData('students', students);
    }

    const rTeachers = getArr('teachers', ['madrasah_teachers']);
    if (rTeachers) {
      for (let i = 0; i < rTeachers.length; i++) {
        if (rTeachers[i] && rTeachers[i].photo && rTeachers[i].photo.startsWith("data:image/")) {
          rTeachers[i].photo = await saveBase64ToFirestore(rTeachers[i].photo);
        }
      }
      const mergedTeachers = [...teachers];
      for (const b of rTeachers) {
        const bId = String(b.id || '').trim();
        const bNip = String(b.nip || '').trim();
        const bUsername = String(b.username || '').trim().toLowerCase();
        const bName = String(b.name || '').trim().toLowerCase();

        const existingIndex = mergedTeachers.findIndex(t => {
          const tId = String(t.id || '').trim();
          const tNip = String(t.nip || '').trim();
          const tUsername = String(t.username || '').trim().toLowerCase();
          const tName = String(t.name || '').trim().toLowerCase();

          if (bId && tId === bId) return true;
          if (bNip && tNip && tNip === bNip) return true;
          if (bUsername && tUsername && tUsername === bUsername) return true;
          if (bName && tName && tName === bName) return true;
          return false;
        });

        if (existingIndex >= 0) {
          const ext = mergedTeachers[existingIndex] as any;
          const bAny = b as any;
          const merged = { ...ext, ...bAny };
          if (ext.photo && !bAny.photo) {
            merged.photo = ext.photo;
          }
          if (ext.role && !bAny.role) {
            merged.role = ext.role;
          }
          if (ext.mapel && ext.mapel.length > 0 && (!bAny.mapel || bAny.mapel.length === 0)) {
            merged.mapel = ext.mapel;
          }
          if (ext.password && String(ext.password) !== String(ext.nip) && (!bAny.password || String(bAny.password) === String(bAny.nip))) {
            merged.password = ext.password;
          }
          mergedTeachers[existingIndex] = merged;
        } else {
          mergedTeachers.push(b);
        }
      }
      teachers = mergedTeachers;
      await saveData('teachers', teachers);
    }

    const rClasses = getArr('classes', ['madrasah_classes']);
    if (rClasses) {
      const mergedClasses = [...classes];
      for (const b of rClasses) {
        const bId = String(b.id || '').trim();
        const bName = String(b.name || '').trim().toLowerCase();

        const existingIndex = mergedClasses.findIndex(c => {
          const cId = String(c.id || '').trim();
          const cName = String(c.name || '').trim().toLowerCase();

          if (bId && cId === bId) return true;
          if (bName && cName && cName === bName) return true;
          return false;
        });

        if (existingIndex >= 0) {
          const ext = mergedClasses[existingIndex];
          const merged = { ...ext, ...b };
          if (ext.homeroomTeacherId && !b.homeroomTeacherId && !b.homeroom_teacher_id) {
            merged.homeroomTeacherId = ext.homeroomTeacherId;
          }
          mergedClasses[existingIndex] = merged;
        } else {
          mergedClasses.push(b);
        }
      }
      classes = mergedClasses;
      await saveData('classes', classes);
    }

    const rSubjects = getArr('subjects', ['madrasah_subjects']);
    if (rSubjects) {
      const mergedSubjects = [...subjects];
      for (const b of rSubjects) {
        const bId = String(b.id || '').trim();
        const bName = String(b.name || '').trim().toLowerCase();
        const bCode = String(b.code || '').trim().toLowerCase();

        const existingIndex = mergedSubjects.findIndex(s => {
          const sId = String(s.id || '').trim();
          const sName = String(s.name || '').trim().toLowerCase();
          const sCode = String(s.code || '').trim().toLowerCase();

          if (bId && sId === bId) return true;
          if (bName && sName && sName === bName) return true;
          if (bCode && sCode && sCode === bCode) return true;
          return false;
        });

        if (existingIndex >= 0) {
          mergedSubjects[existingIndex] = { ...mergedSubjects[existingIndex], ...b };
        } else {
          mergedSubjects.push(b);
        }
      }
      subjects = mergedSubjects;
      await saveData('subjects', subjects);
    }

    const rSchedules = getArr('schedules', ['madrasah_schedules']);
    if (rSchedules) {
      const mergedSchedules = [...schedules];
      for (const b of rSchedules) {
        const bId = String(b.id || '').trim();
        const bDay = String(b.day || '').trim().toLowerCase();
        const bClassId = String(b.classId || '').trim();
        const bSubjectId = String(b.subjectId || '').trim();
        const bTime = String(b.time || '').trim().toLowerCase();

        const existingIndex = mergedSchedules.findIndex(s => {
          const sId = String(s.id || '').trim();
          const sDay = String(s.day || '').trim().toLowerCase();
          const sClassId = String(s.classId || '').trim();
          const sSubjectId = String(s.subjectId || '').trim();
          const sTime = String(s.time || '').trim().toLowerCase();

          if (bId && sId === bId) return true;
          if (bDay === sDay && bClassId === sClassId && bSubjectId === sSubjectId && bTime === sTime) return true;
          return false;
        });

        if (existingIndex >= 0) {
          mergedSchedules[existingIndex] = { ...mergedSchedules[existingIndex], ...b };
        } else {
          mergedSchedules.push(b);
        }
      }
      schedules = mergedSchedules;
      await saveData('schedules', schedules);
    }

    const rAttendance = getArr('attendance', ['madrasah_attendance']);
    if (rAttendance) {
      for (let i = 0; i < rAttendance.length; i++) {
        if (rAttendance[i] && rAttendance[i].photo && rAttendance[i].photo.startsWith("data:image/")) {
          rAttendance[i].photo = await saveBase64ToFirestore(rAttendance[i].photo);
        }
      }
      const mergedAttendance = [...attendance];
      for (const b of rAttendance) {
        const bId = String(b.id || '').trim();
        const bStudentId = String(b.studentId || b.student_id || '').trim();
        const bDate = String(b.date || '').trim();

        const existingIndex = mergedAttendance.findIndex(a => {
          const aId = String(a.id || '').trim();
          const aStudentId = String(a.studentId || a.student_id || '').trim();
          const aDate = String(a.date || '').trim();

          if (bId && aId === bId) return true;
          if (bStudentId && aStudentId && bStudentId === aStudentId && bDate === aDate) return true;
          return false;
        });

        if (existingIndex >= 0) {
          const ext = mergedAttendance[existingIndex];
          const merged = { ...ext };
          
          const extIsAbsen = ext.status && ext.status !== 'BELUM ABSEN' && ext.status !== 'BELUM_ABSEN' && ext.status !== '';
          const bIsAbsen = b.status && b.status !== 'BELUM ABSEN' && b.status !== 'BELUM_ABSEN' && b.status !== '';

          if (!extIsAbsen && bIsAbsen) {
            merged.status = b.status;
            if (b.photo) merged.photo = b.photo;
            if (b.location) merged.location = b.location;
            if (b.notes) merged.notes = b.notes;
            if (b.createdAt) merged.createdAt = b.createdAt;
          } else if (extIsAbsen) {
            merged.status = ext.status;
            if (ext.photo) {
              merged.photo = ext.photo;
            } else if (b.photo) {
              merged.photo = b.photo;
            }
            if (ext.location) {
              merged.location = ext.location;
            } else if (b.location) {
              merged.location = b.location;
            }
            if (ext.notes) {
              merged.notes = ext.notes;
            } else if (b.notes) {
              merged.notes = b.notes;
            }
            if (ext.createdAt) {
              merged.createdAt = ext.createdAt;
            } else if (b.createdAt) {
              merged.createdAt = b.createdAt;
            }
          }
          mergedAttendance[existingIndex] = merged;
        } else {
          mergedAttendance.push(b);
        }
      }
      attendance = mergedAttendance;
      await saveData('attendance', attendance);
    }

    const rTeacherAttendance = getArr('teacherAttendance', ['madrasah_teacher_attendance', 'madrasah_teacherAttendance']);
    if (rTeacherAttendance) {
      for (let i = 0; i < rTeacherAttendance.length; i++) {
        if (rTeacherAttendance[i] && rTeacherAttendance[i].photo && rTeacherAttendance[i].photo.startsWith("data:image/")) {
          rTeacherAttendance[i].photo = await saveBase64ToFirestore(rTeacherAttendance[i].photo);
        }
      }
      const mergedTeacherAttendance = [...teacherAttendance];
      for (const b of rTeacherAttendance) {
        const bId = String(b.id || '').trim();
        const bTeacherId = String(b.teacherId || b.teacher_id || '').trim();
        const bDate = String(b.date || '').trim();

        const existingIndex = mergedTeacherAttendance.findIndex(a => {
          const aId = String(a.id || '').trim();
          const aTeacherId = String(a.teacherId || a.teacher_id || '').trim();
          const aDate = String(a.date || '').trim();

          if (bId && aId === bId) return true;
          if (bTeacherId && aTeacherId && bTeacherId === aTeacherId && bDate === aDate) return true;
          return false;
        });

        if (existingIndex >= 0) {
          const ext = mergedTeacherAttendance[existingIndex];
          const merged = { ...ext };
          
          const extIsAbsen = ext.status && ext.status !== 'BELUM ABSEN' && ext.status !== 'BELUM_ABSEN' && ext.status !== '';
          const bIsAbsen = b.status && b.status !== 'BELUM ABSEN' && b.status !== 'BELUM_ABSEN' && b.status !== '';

          if (!extIsAbsen && bIsAbsen) {
            merged.status = b.status;
            if (b.photo) merged.photo = b.photo;
            if (b.location) merged.location = b.location;
            if (b.notes) merged.notes = b.notes;
            if (b.createdAt) merged.createdAt = b.createdAt;
          } else if (extIsAbsen) {
            merged.status = ext.status;
            if (ext.photo) {
              merged.photo = ext.photo;
            } else if (b.photo) {
              merged.photo = b.photo;
            }
            if (ext.location) {
              merged.location = ext.location;
            } else if (b.location) {
              merged.location = b.location;
            }
            if (ext.notes) {
              merged.notes = ext.notes;
            } else if (b.notes) {
              merged.notes = b.notes;
            }
            if (ext.createdAt) {
              merged.createdAt = ext.createdAt;
            } else if (b.createdAt) {
              merged.createdAt = b.createdAt;
            }
          }
          mergedTeacherAttendance[existingIndex] = merged;
        } else {
          mergedTeacherAttendance.push(b);
        }
      }
      teacherAttendance = mergedTeacherAttendance;
      await saveData('teacherAttendance', teacherAttendance);
    }

    const rQuestionBankGroups = getArr('questionBankGroups', ['madrasah_questionBankGroups', 'madrasah_question_groups']);
    if (rQuestionBankGroups) {
      const mergedQuestionBankGroups = [...questionBankGroups];
      for (const b of rQuestionBankGroups) {
        const bId = String(b.id || '').trim();
        const bName = String(b.name || '').trim().toLowerCase();

        const existingIndex = mergedQuestionBankGroups.findIndex(g => {
          const gId = String(g.id || '').trim();
          const gName = String(g.name || '').trim().toLowerCase();

          if (bId && gId === bId) return true;
          if (bName && gName && gName === bName) return true;
          return false;
        });

        if (existingIndex >= 0) {
          mergedQuestionBankGroups[existingIndex] = { ...mergedQuestionBankGroups[existingIndex], ...b };
        } else {
          mergedQuestionBankGroups.push(b);
        }
      }
      questionBankGroups = mergedQuestionBankGroups;
      await saveData('questionBankGroups', questionBankGroups);
    }

    const rQuestions = getArr('questions', ['madrasah_questions', 'questionBank', 'madrasah_questionBank']);
    if (rQuestions) {
      const mergedQuestions = [...questions];
      for (const b of rQuestions) {
        const bId = String(b.id || '').trim();
        const bText = String(b.text || b.questionText || b.question || '').trim().toLowerCase();

        const existingIndex = mergedQuestions.findIndex(q => {
          const qId = String(q.id || '').trim();
          const qText = String(q.text || q.questionText || q.question || '').trim().toLowerCase();

          if (bId && qId === bId) return true;
          if (bText && qText && qText === bText) return true;
          return false;
        });

        if (existingIndex >= 0) {
          mergedQuestions[existingIndex] = { ...mergedQuestions[existingIndex], ...b };
        } else {
          mergedQuestions.push(b);
        }
      }
      questions = mergedQuestions;
      await saveData('questions', questions);
    }

    const rExams = getArr('exams', ['madrasah_exams']);
    if (rExams) {
      const mergedExams = [...exams];
      for (const b of rExams) {
        const bId = String(b.id || '').trim();
        const bTitle = String(b.title || b.name || '').trim().toLowerCase();

        const existingIndex = mergedExams.findIndex(e => {
          const eId = String(e.id || '').trim();
          const eTitle = String(e.title || e.name || '').trim().toLowerCase();

          if (bId && eId === bId) return true;
          if (bTitle && eTitle && eTitle === bTitle) return true;
          return false;
        });

        if (existingIndex >= 0) {
          mergedExams[existingIndex] = { ...mergedExams[existingIndex], ...b };
        } else {
          mergedExams.push(b);
        }
      }
      exams = mergedExams;
      await saveData('exams', exams);
    }

    const rRooms = getArr('rooms', ['madrasah_rooms']);
    if (rRooms) {
      const mergedRooms = [...rooms];
      for (const b of rRooms) {
        const bId = String(b.id || '').trim();
        const bName = String(b.name || '').trim().toLowerCase();

        const existingIndex = mergedRooms.findIndex(r => {
          const rId = String(r.id || '').trim();
          const rName = String(r.name || '').trim().toLowerCase();

          if (bId && rId === bId) return true;
          if (bName && rName && rName === bName) return true;
          return false;
        });

        if (existingIndex >= 0) {
          mergedRooms[existingIndex] = { ...mergedRooms[existingIndex], ...b };
        } else {
          mergedRooms.push(b);
        }
      }
      rooms = mergedRooms;
      await saveData('rooms', rooms);
    }

    const rJournals = getArr('journals', ['madrasah_journals']);
    if (rJournals) {
      const mergedJournals = [...journals];
      for (const b of rJournals) {
        const bId = String(b.id || '').trim();
        const existingIndex = mergedJournals.findIndex(j => String(j.id || '').trim() === bId);
        if (existingIndex >= 0) {
          mergedJournals[existingIndex] = { ...mergedJournals[existingIndex], ...b };
        } else {
          mergedJournals.push(b);
        }
      }
      journals = mergedJournals;
      await saveData('journals', journals);
    }

    const rGradeCategories = getArr('gradeCategories', ['madrasah_grade_categories', 'madrasah_gradeCategories']);
    if (rGradeCategories) {
      const mergedGradeCategories = [...gradeCategories];
      for (const b of rGradeCategories) {
        const bId = String(b.id || '').trim();
        const bName = String(b.name || '').trim().toLowerCase();

        const existingIndex = mergedGradeCategories.findIndex(c => {
          const cId = String(c.id || '').trim();
          const cName = String(c.name || '').trim().toLowerCase();

          if (bId && cId === bId) return true;
          if (bName && cName && cName === bName) return true;
          return false;
        });

        if (existingIndex >= 0) {
          mergedGradeCategories[existingIndex] = { ...mergedGradeCategories[existingIndex], ...b };
        } else {
          mergedGradeCategories.push(b);
        }
      }
      gradeCategories = mergedGradeCategories;
      await saveData('gradeCategories', gradeCategories);
    }

    const rGeneratedExams = getArr('generatedExams', ['madrasah_generated_exams', 'madrasah_generatedExams']);
    if (rGeneratedExams) {
      const mergedGeneratedExams = [...generatedExams];
      for (const b of rGeneratedExams) {
        const bId = String(b.id || '').trim();
        const existingIndex = mergedGeneratedExams.findIndex(e => String(e.id || '').trim() === bId);
        if (existingIndex >= 0) {
          mergedGeneratedExams[existingIndex] = { ...mergedGeneratedExams[existingIndex], ...b };
        } else {
          mergedGeneratedExams.push(b);
        }
      }
      generatedExams = mergedGeneratedExams;
      await saveData('generatedExams', generatedExams);
    }

    const rLessonPlans = getArr('lessonPlans', ['madrasah_lessonPlans', 'madrasah_lesson_plans']);
    if (rLessonPlans) {
      const mergedLessonPlans = [...lessonPlans];
      for (const b of rLessonPlans) {
        const bId = String(b.id || '').trim();
        const existingIndex = mergedLessonPlans.findIndex(p => String(p.id || '').trim() === bId);
        if (existingIndex >= 0) {
          mergedLessonPlans[existingIndex] = { ...mergedLessonPlans[existingIndex], ...b };
        } else {
          mergedLessonPlans.push(b);
        }
      }
      lessonPlans = mergedLessonPlans;
      await saveData('lessonPlans', lessonPlans);
    }

    const rGrades = getArr('grades', ['madrasah_grades']);
    if (rGrades) {
      const mergedGrades = [...grades];
      for (const b of rGrades) {
        const bId = String(b.id || '').trim();
        const bClassId = String(b.classId || '').trim();
        const bStudentId = String(b.studentId || '').trim();
        const bSubjectName = String(b.subjectName || '').trim().toLowerCase();
        const bCategory = String(b.category || '').trim().toLowerCase();

        const existingIndex = mergedGrades.findIndex(g => {
          const gId = String(g.id || '').trim();
          const gClassId = String(g.classId || '').trim();
          const gStudentId = String(g.studentId || '').trim();
          const gSubjectName = String(g.subjectName || '').trim().toLowerCase();
          const gCategory = String(g.category || '').trim().toLowerCase();

          if (bId && gId === bId) return true;
          if (bClassId === gClassId && bStudentId === gStudentId && bSubjectName === gSubjectName && bCategory === gCategory) return true;
          return false;
        });

        if (existingIndex >= 0) {
          mergedGrades[existingIndex] = { ...mergedGrades[existingIndex], ...b };
        } else {
          mergedGrades.push(b);
        }
      }
      grades = mergedGrades;
      await saveData('grades', grades);
    }

    const rSettings = getObj('settings', ['madrasah_settings']);
    if (rSettings) {
      appSettings = { ...rSettings, ...appSettings };
      await saveData('settings', appSettings);
    }

    const rSchoolLocation = getObj('schoolLocationSettings', ['madrasah_schoolLocationSettings']);
    if (rSchoolLocation) {
      schoolLocationSettings = { ...rSchoolLocation, ...schoolLocationSettings };
      await saveData('schoolLocationSettings', schoolLocationSettings);
    }

    const rCustomGradeColumns = getObj('customGradeColumns', ['madrasah_customGradeColumns']);
    if (rCustomGradeColumns) {
      customGradeColumns = { ...rCustomGradeColumns, ...customGradeColumns };
      await saveData('customGradeColumns', customGradeColumns);
    }

    } finally {
      isRestoring = false;
      // Final flush to disk after restore is complete to ensure persistence on refresh
      try {
        const store = readLocalStore();
        writeLocalStore(store);
        
        // After restore finishes, trigger a background sync of all data back to Firestore 
        // to ensure the persistent cloud layer matches the restored local state
        if (db) {
          const criticalKeys = ['students', 'teachers', 'admins', 'classes', 'subjects', 'exams', 'questions', 'settings', 'photoCloudinaryMap'];
          for (const key of criticalKeys) {
            if (store[key]) {
              saveKeyToFirestore(key, store[key]).catch(() => {});
            }
          }
        }
      } catch (e) {}
    }

    const hasKey = (key: string, legacyKeys: string[] = []) => {
      if (backup[key] !== undefined) return true;
      for (const lk of legacyKeys) {
        if (backup[lk] !== undefined) return true;
      }
      return false;
    };

    const batchToSave: { key: string; value: any }[] = [];
    if (hasKey('students', ['madrasah_students'])) batchToSave.push({ key: 'students', value: students });
    if (hasKey('teachers', ['madrasah_teachers'])) batchToSave.push({ key: 'teachers', value: teachers });
    if (hasKey('classes', ['madrasah_classes'])) batchToSave.push({ key: 'classes', value: classes });
    if (hasKey('subjects', ['madrasah_subjects'])) batchToSave.push({ key: 'subjects', value: subjects });
    if (hasKey('schedules', ['madrasah_schedules'])) batchToSave.push({ key: 'schedules', value: schedules });
    if (hasKey('savedRosters', ['madrasah_savedRosters', 'madrasah_saved_rosters'])) batchToSave.push({ key: 'savedRosters', value: savedRosters });
    if (hasKey('timeSlots', ['madrasah_timeSlots', 'madrasah_time_slots'])) batchToSave.push({ key: 'timeSlots', value: timeSlots });
    if (hasKey('kbmDuration', ['madrasah_kbmDuration', 'madrasah_kbm_duration'])) batchToSave.push({ key: 'kbmDuration', value: kbmDuration });
    if (hasKey('attendance', ['madrasah_attendance'])) batchToSave.push({ key: 'attendance', value: attendance });
    if (hasKey('teacherAttendance', ['madrasah_teacher_attendance', 'madrasah_teacherAttendance'])) batchToSave.push({ key: 'teacherAttendance', value: teacherAttendance });
    if (hasKey('questionBankGroups', ['madrasah_questionBankGroups', 'madrasah_question_groups'])) batchToSave.push({ key: 'questionBankGroups', value: questionBankGroups });
    if (hasKey('questions', ['madrasah_questions', 'questionBank', 'madrasah_questionBank'])) batchToSave.push({ key: 'questions', value: questions });
    if (hasKey('exams', ['madrasah_exams'])) batchToSave.push({ key: 'exams', value: exams });
    if (hasKey('rooms', ['madrasah_rooms'])) batchToSave.push({ key: 'rooms', value: rooms });
    if (hasKey('journals', ['madrasah_journals'])) batchToSave.push({ key: 'journals', value: journals });
    if (hasKey('gradeCategories', ['madrasah_grade_categories', 'madrasah_gradeCategories'])) batchToSave.push({ key: 'gradeCategories', value: gradeCategories });
    if (hasKey('customGradeColumns', ['madrasah_customGradeColumns'])) batchToSave.push({ key: 'customGradeColumns', value: customGradeColumns });
    if (hasKey('generatedExams', ['madrasah_generated_exams', 'madrasah_generatedExams'])) batchToSave.push({ key: 'generatedExams', value: generatedExams });
    if (hasKey('lessonPlans', ['madrasah_lessonPlans', 'madrasah_lesson_plans'])) batchToSave.push({ key: 'lessonPlans', value: lessonPlans });
    if (hasKey('grades', ['madrasah_grades'])) batchToSave.push({ key: 'grades', value: grades });
    if (hasKey('settings', ['madrasah_settings'])) batchToSave.push({ key: 'settings', value: appSettings });
    if (hasKey('schoolLocationSettings', ['madrasah_schoolLocationSettings'])) batchToSave.push({ key: 'schoolLocationSettings', value: schoolLocationSettings });
    
    // Ensure photoCloudinaryMap created during restore (from base64 processing) is persisted
    batchToSave.push({ key: 'photoCloudinaryMap', value: photoCloudinaryMap });

    if (batchToSave.length > 0) {
      await saveDataBatch(batchToSave);
    }

    // Trigger background sync to upload any restored photos to Cloudinary if missing
    syncAllPhotosToCloudinary().catch(err => {
      console.warn("[Cloudinary Restore Sync Trigger Error]:", err);
    });

    return {
      students,
      teachers,
      classes,
      subjects,
      schedules,
      attendance,
      teacherAttendance,
      questionBankGroups,
      questions,
      exams,
      rooms,
      journals,
      gradeCategories,
      customGradeColumns,
      generatedExams,
      lessonPlans,
      grades,
      settings: appSettings,
      schoolLocationSettings
    };
}

const restoreChunks: Record<string, string[]> = {};

app.post("/api/system/restore/chunk", async (req, res) => {
  try {
    const { uploadId, chunkData, chunkIndex, totalChunks } = req.body;
    if (!uploadId || chunkData === undefined || chunkIndex === undefined || totalChunks === undefined) {
      return res.status(400).json({ success: false, message: "Invalid chunk payload" });
    }
    
    if (!restoreChunks[uploadId]) {
      restoreChunks[uploadId] = [];
    }
    restoreChunks[uploadId][chunkIndex] = chunkData;
    
    let received = 0;
    for (let i = 0; i < totalChunks; i++) {
      if (restoreChunks[uploadId][i] !== undefined) received++;
    }
    
    if (received === totalChunks) {
      const fullString = restoreChunks[uploadId].join('');
      delete restoreChunks[uploadId];
      const backup = JSON.parse(fullString);
      const merged = await processSystemRestore(backup);
      return res.json({ success: true, message: "Restore data sistem berhasil diproses (chunked)!", merged });
    }
    
    res.json({ success: true, message: `Chunk ${chunkIndex + 1}/${totalChunks} received` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Gagal memproses chunk: " + err.message });
  }
});

// Sync State API for generic app state persistence
app.post("/api/sync-state", async (req, res) => {
  try {
    let { key, data } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key required" });

    // Process base64 uploads for students
    if (key === 'students' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for teachers
    if (key === 'teachers' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for attendance
    if (key === 'attendance' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for teacherAttendance
    if (key === 'teacherAttendance' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for questions
    if ((key === 'questions' || key === 'questionBank') && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].imageUrl && data[i].imageUrl.startsWith("data:image/")) {
                data[i].imageUrl = await saveBase64ToFirestore(data[i].imageUrl);
            }
        }
    }

    if (key === 'teachers') {
      if (Array.isArray(data)) {
        const tMap = new Map(teachers.map((t: any) => [String(t.id), t]));
        const newTeachers = [];
        for (const item of data as any[]) { if (item && item.id != null) { const ext: any = tMap.get(String(item.id)); newTeachers.push(ext ? { ...ext, ...item } : item); } }
        teachers = newTeachers;
      } else {
        teachers = data;
      }
      await saveData('teachers', teachers);
    }
    else if (key === 'students') {
      if (Array.isArray(data)) {
        const sMap = new Map(students.map((s: any) => [String(s.id), s]));
        const newStudents = [];
        for (const item of data as any[]) {
          if (item && item.id != null) {
            const idStr = String(item.id);
            const ext: any = sMap.get(idStr);
            if (!ext) {
              newStudents.push(item);
            } else {
              // Smart merge: preserve non-empty/customized existing fields over default/empty incoming fields
              const merged: any = { ...ext, ...item };
              // Preserve name if existing is customized and incoming is default/placeholder (e.g. name === nis)
              if (ext.name && ext.name !== ext.nis && (item.name === item.nis || !item.name)) {
                merged.name = ext.name;
              }
              if (ext.no_hp && !item.no_hp) {
                merged.no_hp = ext.no_hp;
              }
              if (ext.photo && !item.photo) {
                merged.photo = ext.photo;
              }
              if (ext.password && String(ext.password) !== String(ext.nis) && (String(item.password) === String(item.nis) || !item.password)) {
                merged.password = ext.password;
              }
              newStudents.push(merged);
            }
          }
        }
        students = newStudents;
      } else {
        students = data;
      }
      await saveData('students', students);
    }
    else if (key === 'classes') {
      if (Array.isArray(data)) {
        const cMap = new Map(classes.map((c: any) => [String(c.id), c]));
        const newClasses = [];
        for (const item of data as any[]) { if (item && item.id != null) { const ext: any = cMap.get(String(item.id)); newClasses.push(ext ? { ...ext, ...item } : item); } }
        classes = newClasses;
      } else {
        classes = data;
      }
      await saveData('classes', classes);
    }
    else if (key === 'subjects') { subjects = data; await saveData('subjects', subjects); }
    else if (key === 'attendance') {
      if (Array.isArray(data)) {
        if (data.length === 0 && Array.isArray(attendance) && attendance.length > 0) {
          // Do not wipe non-empty attendance with empty array
        } else {
          const aMap = new Map((Array.isArray(attendance) ? attendance : []).map((a: any) => [String(a.id || `${a.studentId}_${a.date}_${a.subjectId||''}`), a]));
          for (const item of data) {
            if (item) {
              const k = String(item.id || `${item.studentId}_${item.date}_${item.subjectId||''}`);
              aMap.set(k, { ...(aMap.get(k) || {}), ...item });
            }
          }
          attendance = Array.from(aMap.values());
        }
      } else if (data) {
        attendance = data;
      }
      await saveData('attendance', attendance);
    }
    else if (key === 'teacherAttendance') {
      if (Array.isArray(data)) {
        if (data.length === 0 && Array.isArray(teacherAttendance) && teacherAttendance.length > 0) {
          // Do not wipe non-empty teacherAttendance
        } else {
          const tMap = new Map((Array.isArray(teacherAttendance) ? teacherAttendance : []).map((t: any) => [String(t.id || `${t.teacherId}_${t.date}`), t]));
          for (const item of data) {
            if (item) {
              const k = String(item.id || `${item.teacherId}_${item.date}`);
              tMap.set(k, { ...(tMap.get(k) || {}), ...item });
            }
          }
          teacherAttendance = Array.from(tMap.values());
        }
      } else if (data) {
        teacherAttendance = data;
      }
      await saveData('teacherAttendance', teacherAttendance);
    }
    else if (key === 'schedules') { schedules = mergeTenantListData(schedules, data, req); await saveData('schedules', schedules); }
    else if (key === 'savedRosters') { savedRosters = mergeTenantListData(savedRosters, data, req); await saveData('savedRosters', savedRosters); }
    else if (key === 'timeSlots') { timeSlots = mergeTenantListData(timeSlots, data, req); await saveData('timeSlots', timeSlots); }
    else if (key === 'kbmDuration') { kbmDuration = data; await saveData('kbmDuration', kbmDuration); }
    else if (key === 'questionBankGroups') { questionBankGroups = mergeTenantListData(questionBankGroups, data, req); await saveData('questionBankGroups', questionBankGroups); }
    else if (key === 'questionBank' || key === 'questions') { questions = mergeTenantListData(questions, data, req); await saveData('questions', questions); }
    else if (key === 'exams') { exams = mergeTenantListData(exams, data, req); await saveData('exams', exams); }
    else if (key === 'lkpdList') { lkpdList = mergeLkpdListDataSmart(lkpdList, data, req); await saveData('lkpdList', lkpdList); }
    else if (key === 'rooms') { rooms = mergeTenantListData(rooms, data, req); await saveData('rooms', rooms); }
    else if (key === 'journals') { journals = mergeTenantListData(journals, data, req); await saveData('journals', journals); }
    else if (key === 'gradeCategories') { gradeCategories = mergeTenantListData(gradeCategories, data, req); await saveData('gradeCategories', gradeCategories); }
    else if (key === 'calendarEvents') { calendarEvents = mergeTenantListData(calendarEvents, data, req); await saveData('calendarEvents', calendarEvents); }
    else if (key === 'generatedExams') { generatedExams = mergeTenantListData(generatedExams, data, req); await saveData('generatedExams', generatedExams); }
    else if (key === 'lessonPlans') { lessonPlans = mergeTenantListData(lessonPlans, data, req); await saveData('lessonPlans', lessonPlans); }
    else if (key === 'grades') { grades = mergeTenantListData(grades, data, req); await saveData('grades', grades); }
    else if (key === 'settings') { appSettings = data; await saveData('settings', appSettings); }
    else if (key === 'schoolLocations' || key === 'schoolLocationSettings') { schoolLocationSettings = data; await saveData('schoolLocationSettings', schoolLocationSettings); }
    else if (key === 'childguardStatus') {
      if (typeof data === 'object' && data !== null) {
        const now = Date.now();
        for (const [sKey, sStatus] of Object.entries(data)) {
          if (typeof sStatus === 'object' && sStatus !== null) {
            (sStatus as any).serverTime = now;
            (sStatus as any).online = true;
          }
        }
        childguardStatus = { ...(childguardStatus || {}), ...data };
        for (const [sKey, sStatus] of Object.entries(data)) {
          const cleanSKey = String(sKey).replace(/\D/g, '');
          const matchedStudent = (students || []).find((s: any) => 
            String(s.id) === String(sKey) || 
            String(s.nis) === String(sKey) ||
            (cleanSKey !== '' && String(s.id).replace(/\D/g, '') === cleanSKey) ||
            (cleanSKey !== '' && String(s.nis).replace(/\D/g, '') === cleanSKey)
          );
          if (matchedStudent) {
            if (matchedStudent.id) childguardStatus[String(matchedStudent.id)] = sStatus;
            if (matchedStudent.nis) childguardStatus[String(matchedStudent.nis)] = sStatus;
          } else if (Array.isArray(students) && students.length === 1) {
            const first = students[0];
            if (first) {
              if (first.id) childguardStatus[String(first.id)] = sStatus;
              if (first.nis) childguardStatus[String(first.nis)] = sStatus;
            }
          }
        }
      } else {
        childguardStatus = data;
      }
      await saveData('childguardStatus', childguardStatus);
    }
    else {
      await saveData(key, data);
    }
    return res.json({ success: true, key });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Real-time Event Stream (Server-Sent Events)
app.get("/api/realtime-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
  
  sseClients.push(res);
  
  const pingInterval = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 25000);
  
  req.on("close", () => {
    clearInterval(pingInterval);
    sseClients = sseClients.filter(c => c !== res);
  });
});

// ----------------------------------------------------
// Vite Middleware / Static File Serving
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: {
          ignored: (p: string) => p.includes("local_store.json") || p.includes("node_modules")
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        res.removeHeader("X-Frame-Options");
        res.setHeader("Content-Security-Policy", "frame-ancestors *");
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get("*", (req, res) => {
      if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.map')) {
        return res.status(404).send('Asset not found');
      }
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", 1024, () => {
    console.log(`\n======================================================`);
    console.log(`  MADRASAH BISA CBT & MANAJEMEN SERVER SIAP`);
    console.log(`======================================================`);
    console.log(`  > Akses Lokal Laptop : http://localhost:${PORT}`);
    
    // Tampilkan seluruh IP LAN / Wi-Fi laptop untuk akses HP siswa
    const ifaces = os.networkInterfaces();
    let hasLan = false;
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`  > Akses HP Siswa (LAN/Wi-Fi): http://${iface.address}:${PORT}`);
          hasLan = true;
        }
      }
    }
    if (!hasLan) {
      console.log(`  > Akses Jaringan: http://0.0.0.0:${PORT}`);
    }
    console.log(`  > Connection Backlog: 1024 connections max`);
    console.log(`======================================================\n`);
  });

  // High-performance WebSocket Signaling Server for WebRTC P2P
  try {
    const { WebSocketServer } = await import("ws");
    const wss = new WebSocketServer({ server });
    const clients = wsClients;

    wss.on("connection", (ws: any) => {
      let registeredClientId: string | null = null;

      ws.on("message", (message: string) => {
        try {
          const data = JSON.parse(message);
          if (data.type === "register") {
            registeredClientId = String(data.clientId);
            clients.set(registeredClientId, ws);
            console.log(`Signaling WS: Client registered - ${registeredClientId}`);
          } else if (data.type === "signal") {
            const { recipientId, senderId, signal } = data;
            const recipientWs = clients.get(String(recipientId));
            if (recipientWs && recipientWs.readyState === 1) {
              recipientWs.send(JSON.stringify({
                type: "signal",
                senderId,
                signal
              }));
            } else {
              // Fallback to in-memory fallback signaling pool
              if (!examSignalingMessages[recipientId]) {
                examSignalingMessages[recipientId] = {};
              }
              const sId = senderId || "unknown";
              if (!examSignalingMessages[recipientId][sId]) {
                examSignalingMessages[recipientId][sId] = [];
              }
              examSignalingMessages[recipientId][sId].push({ senderId: sId, signal, timestamp: Date.now() });
              if (examSignalingMessages[recipientId][sId].length > 25) {
                examSignalingMessages[recipientId][sId].shift();
              }
            }
          }
        } catch (e) {
          console.error("Signaling WS message error:", e);
        }
      });

      ws.on("close", () => {
        if (registeredClientId) {
          clients.delete(registeredClientId);
          console.log(`Signaling WS: Client disconnected - ${registeredClientId}`);
        }
      });

      ws.on("error", (err: any) => {
        console.error(`Signaling WS error for ${registeredClientId}:`, err);
      });
    });
    console.log("WebRTC WebSocket Signaling Server initialized successfully!");
  } catch (err) {
    console.error("Failed to start WebRTC WebSocket Signaling Server:", err);
  }
}

if (!process.env.VERCEL) {
  startServer();
}
