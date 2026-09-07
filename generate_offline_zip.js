import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { execSync } from 'child_process';

const zip = new JSZip();

console.log('--- PROSES PEMBUATAN ZIP UPDATE OFFLINE ---');

// 1. Jalankan build produksi agar aset dist/ terupdate dengan versi terbaru
try {
  console.log('Menjalankan npm run build untuk mengompilasi aset klien & server terbaru...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build berhasil!');
} catch (err) {
  console.error('Warning: Gagal menjalankan build, melanjutkan dengan aset build yang ada saat ini.', err);
}

// 2. Pastikan folder uploads lokal dan subfolder foto khusus ada
const uploadsDir = './uploads';
const photosDir = './uploads/attendance_photos';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}
// Tambahkan .gitkeep agar folder uploads tersimpan di dalam zip
fs.writeFileSync(path.join(uploadsDir, '.gitkeep'), '');
fs.writeFileSync(path.join(photosDir, '.gitkeep'), '');

function addDirectoryToZip(zipInstance, localPath, zipPath = '') {
  const files = fs.readdirSync(localPath);
  for (const file of files) {
    const fullPath = path.join(localPath, file);
    const relativeZipPath = zipPath ? `${zipPath}/${file}` : file;
    
    // Pola pengecualian berkas/folder agar zip tetap ringan dan aman
    if (
      file === 'node_modules' || 
      file === '.git' || 
      file === '.github' || 
      file === 'update_offline.zip' || 
      file === '.env' ||
      file === 'firebase-applet-config.json' // Lewati konfigurasi firebase agar langsung berjalan offline secara otomatis
    ) {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      addDirectoryToZip(zipInstance, fullPath, relativeZipPath);
    } else {
      zipInstance.file(relativeZipPath, fs.readFileSync(fullPath));
    }
  }
}

console.log('Mengompres file dan melampirkan folder uploads...');
addDirectoryToZip(zip, '.');

// Buat dummy config di dalam zip agar server tidak membuang error file not found, melainkan langsung ke fallback
zip.file('firebase-applet-config.json.example', JSON.stringify({
  apiKey: "OFFLINE_DUMMY",
  authDomain: "offline.local",
  projectId: "offline-madrasah",
  storageBucket: "offline-madrasah.appspot.com",
  messagingSenderId: "0000000000",
  appId: "1:0000000000:web:000000000"
}, null, 2));

console.log('Menghasilkan file zip terkompresi...');
zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
  .then(content => {
    fs.writeFileSync('update_offline.zip', content);
    console.log('========================================================');
    console.log('  BERHASIL: update_offline.zip SIAP DIUNDUH!');
    console.log('========================================================');
    console.log('File dapat diunduh melalui tautan: /update_offline.zip');
  })
  .catch(err => {
    console.error('Gagal membuat zip:', err);
  });
