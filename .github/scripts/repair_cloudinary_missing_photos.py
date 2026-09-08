from pathlib import Path

server = Path('server.ts')
s = server.read_text(encoding='utf-8')

if 'async function repairMissingCloudinaryPhotos()' not in s:
    anchor = '\nasync function saveBase64ToFirestore(base64Str: string): Promise<string> {'
    if anchor not in s:
        raise SystemExit('server insertion anchor not found')

    helper = r'''

function normalizeCloudinaryPhotoId(photoId: string): string {
  return String(photoId || '')
    .replace(/^madrasah_photos\//, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_');
}

async function repairMissingCloudinaryPhotos(): Promise<{
  checked: number;
  alreadyExists: number;
  uploaded: number;
  missingSource: number;
  failed: number;
  mapped: number;
}> {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary belum dikonfigurasi.');
  }

  // Cloudinary API is the source of truth here. Do not trust cached photoCloudinaryMap,
  // because an old mapping can survive even when the actual remote asset was deleted.
  const cloudByCleanId = new Map<string, { url: string; fullId: string }>();
  let nextCursor: string | null = null;
  do {
    const response: any = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'image',
      prefix: 'madrasah_photos',
      max_results: 500,
      next_cursor: nextCursor || undefined
    });

    const resources = Array.isArray(response?.resources) ? response.resources : [];
    for (const item of resources) {
      if (!item?.public_id || !(item.secure_url || item.url)) continue;
      const url = item.secure_url || item.url;
      const fullId = String(item.public_id);
      const cleanId = fullId.replace(/^madrasah_photos\//, '');
      cloudByCleanId.set(cleanId, { url, fullId });
    }
    nextCursor = response?.next_cursor || null;
  } while (nextCursor);

  const candidates = new Set<string>();
  const addPhotoId = (value: any) => {
    if (typeof value !== 'string') return;
    let photoId = value.trim();
    if (!photoId || photoId.startsWith('http') || photoId.startsWith('data:image/')) return;
    if (photoId.startsWith('/api/photos/')) {
      photoId = photoId.replace('/api/photos/', '').split('?')[0].trim();
    }
    if (photoId) candidates.add(photoId);
  };

  (students || []).forEach(student => addPhotoId(student?.photo));
  (teachers || []).forEach(teacher => addPhotoId(teacher?.photo));

  // Include local photo files even if a stale database reference no longer points to them.
  try {
    if (fs.existsSync(uploadsDir)) {
      for (const name of fs.readdirSync(uploadsDir)) {
        if (!name || name.startsWith('.')) continue;
        const filePath = path.join(uploadsDir, name);
        try {
          if (fs.statSync(filePath).isFile()) candidates.add(name);
        } catch (_) {}
      }
    }
  } catch (err: any) {
    console.warn('[Cloudinary Repair] Could not scan uploads directory:', err?.message || err);
  }

  let alreadyExists = 0;
  let uploaded = 0;
  let missingSource = 0;
  let failed = 0;

  for (const photoId of candidates) {
    const normalizedId = normalizeCloudinaryPhotoId(photoId);
    const remote = cloudByCleanId.get(normalizedId) || cloudByCleanId.get(photoId);

    if (remote) {
      // Refresh all equivalent mapping keys from the real Cloudinary asset.
      photoCloudinaryMap[photoId] = remote.url;
      photoCloudinaryMap[normalizedId] = remote.url;
      photoCloudinaryMap[remote.fullId] = remote.url;
      alreadyExists++;
      continue;
    }

    // The cache says nothing reliable here: remove stale aliases before attempting a real upload.
    delete photoCloudinaryMap[photoId];
    delete photoCloudinaryMap[normalizedId];
    delete photoCloudinaryMap[`madrasah_photos/${normalizedId}`];

    const localFile = path.join(uploadsDir, photoId);
    let hasLocalFile = false;
    try {
      hasLocalFile = fs.existsSync(localFile) && fs.statSync(localFile).isFile();
    } catch (_) {}

    if (!hasLocalFile) {
      missingSource++;
      console.warn(`[Cloudinary Repair] Remote asset missing and no local source available for ${photoId}.`);
      continue;
    }

    try {
      const cloudUrl = await uploadToCloudinary(localFile, photoId);
      if (cloudUrl) {
        photoCloudinaryMap[photoId] = cloudUrl;
        photoCloudinaryMap[normalizedId] = cloudUrl;
        photoCloudinaryMap[`madrasah_photos/${normalizedId}`] = cloudUrl;
        uploaded++;
      } else {
        failed++;
      }
    } catch (err: any) {
      failed++;
      console.warn(`[Cloudinary Repair] Upload failed for ${photoId}:`, err?.message || err);
    }
  }

  await saveData('photoCloudinaryMap', photoCloudinaryMap, true);

  console.log(`[Cloudinary Repair] Checked ${candidates.size}; exists ${alreadyExists}; uploaded ${uploaded}; missing source ${missingSource}; failed ${failed}.`);
  return {
    checked: candidates.size,
    alreadyExists,
    uploaded,
    missingSource,
    failed,
    mapped: Object.keys(photoCloudinaryMap).length
  };
}
'''
    s = s.replace(anchor, helper + anchor, 1)

if '"/api/cloudinary/repair-missing"' not in s:
    route_anchor = '\n// 1c. Force Reconnect & Pull data from Google Cloud SQL to local JSON store\n'
    if route_anchor not in s:
        raise SystemExit('cloudinary route insertion anchor not found')

    route = r'''

// 1b.2 Cloudinary integrity audit: verify actual remote assets and upload only missing photos.
app.post("/api/cloudinary/repair-missing", requireAuth, requireRole(['admin', 'bos', 'superadmin']), async (req, res) => {
  try {
    const result = await repairMissingCloudinaryPhotos();
    return res.json({
      success: true,
      message: `Pemeriksaan selesai. ${result.uploaded} foto yang belum ada berhasil di-upload ke Cloudinary.`,
      result
    });
  } catch (err: any) {
    console.error('[Cloudinary Repair Endpoint] Failed:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Gagal memeriksa dan memperbaiki foto Cloudinary.'
    });
  }
});
'''
    s = s.replace(route_anchor, route + route_anchor, 1)

server.write_text(s, encoding='utf-8')

settings = Path('src/settingsAndMisc.js')
f = settings.read_text(encoding='utf-8')

if 'repairMissingCloudinaryPhotos()' not in f:
    old_button = '''                        <button type="button" onclick="forceSyncCloudinaryPhotos()" class="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer" title="Periksa dan sinkronkan semua foto siswa/guru dari penyimpanan Cloudinary">
                            <i class="fa-solid fa-images"></i>
                            <span>Sinkronkan Foto Cloudinary</span>
                        </button>'''
    if old_button not in f:
        raise SystemExit('Cloudinary sync button not found')

    new_button = old_button + '''
                        <button type="button" id="repair-cloudinary-missing-btn" onclick="repairMissingCloudinaryPhotos()" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-2 cursor-pointer" title="Cek aset Cloudinary yang benar-benar ada dan upload foto lokal yang masih belum tersimpan di Cloudinary">
                            <i class="fa-solid fa-cloud-arrow-up"></i>
                            <span>Periksa & Upload Foto Hilang</span>
                        </button>'''
    f = f.replace(old_button, new_button)

    fn_anchor = 'window.forceSyncCloudinaryPhotos = forceSyncCloudinaryPhotos;\n'
    if fn_anchor not in f:
        raise SystemExit('forceSyncCloudinaryPhotos export anchor not found')

    frontend_fn = r'''

async function repairMissingCloudinaryPhotos() {
    const statusResultEl = document.getElementById('db-connection-test-result');
    const button = document.getElementById('repair-cloudinary-missing-btn');
    if (button) button.disabled = true;

    if (statusResultEl) {
        statusResultEl.innerHTML = `<div class="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs flex flex-col gap-2 animate-pulse">
            <div class="font-bold flex items-center gap-2">
                <i class="fa-solid fa-spinner fa-spin text-sm"></i>
                <span>Memeriksa aset Cloudinary & mencari foto yang belum ter-backup...</span>
            </div>
            <p class="text-slate-600 text-[11px]">Foto yang sudah benar-benar ada di Cloudinary akan dilewati. Foto yang belum ada akan di-upload dari penyimpanan lokal bila sumber filenya masih tersedia.</p>
        </div>`;
    }

    try {
        const res = await fetch('/api/cloudinary/repair-missing', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Gagal memeriksa foto Cloudinary.');
        }

        const result = data.result || {};
        const missingWarning = Number(result.missingSource || 0) > 0
            ? `<p class="text-[11px] text-amber-700 font-semibold mt-2">⚠ ${result.missingSource} foto tidak ada di Cloudinary dan sumber file lokalnya juga tidak tersedia, sehingga tidak dapat di-upload ulang.</p>`
            : `<p class="text-[11px] text-emerald-700 font-semibold mt-2">✓ Semua foto yang dapat diperiksa memiliki backup Cloudinary atau berhasil di-upload.</p>`;

        if (statusResultEl) {
            statusResultEl.innerHTML = `<div class="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs space-y-2">
                <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-circle-check text-emerald-600"></i><span>Pemeriksaan & Backup Foto Selesai</span></div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                    <div class="bg-white/70 border rounded-xl p-2">Diperiksa: <strong>${result.checked || 0}</strong></div>
                    <div class="bg-white/70 border rounded-xl p-2">Sudah ada: <strong>${result.alreadyExists || 0}</strong></div>
                    <div class="bg-white/70 border rounded-xl p-2">Di-upload: <strong>${result.uploaded || 0}</strong></div>
                    <div class="bg-white/70 border rounded-xl p-2">Gagal: <strong>${result.failed || 0}</strong></div>
                </div>
                ${missingWarning}
            </div>`;
        }

        if (window.showToast) {
            window.showToast(`Cloudinary diperiksa: ${result.uploaded || 0} foto baru di-upload.`, 'success');
        }
    } catch (err) {
        if (statusResultEl) {
            statusResultEl.innerHTML = `<div class="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs">
                <div class="font-bold mb-1"><i class="fa-solid fa-circle-xmark mr-1"></i>Pemeriksaan Cloudinary Gagal</div>
                <p class="text-slate-700">${err?.message || String(err)}</p>
            </div>`;
        }
        if (window.showToast) window.showToast(err?.message || 'Pemeriksaan Cloudinary gagal.', 'error');
    } finally {
        if (button) button.disabled = false;
    }
}
window.repairMissingCloudinaryPhotos = repairMissingCloudinaryPhotos;
'''
    f = f.replace(fn_anchor, fn_anchor + frontend_fn, 1)

settings.write_text(f, encoding='utf-8')
