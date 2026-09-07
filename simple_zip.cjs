
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const SOURCE_DIR = process.cwd();
const TEMP_DIR = path.join(process.cwd(), 'temp_offline_update');
const OUTPUT_ZIP = path.join(process.cwd(), 'update_offline_v2.zip');

function copyRecursiveSync(src, dest) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(childItemName => {
            if (['node_modules', '.git', 'temp_offline_update', 'dist'].includes(childItemName)) return;
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        if (src.endsWith('.zip') || src.endsWith('.log')) return;
        fs.copyFileSync(src, dest);
    }
}

if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR);
copyRecursiveSync(SOURCE_DIR, TEMP_DIR);

const output = fs.createWriteStream(OUTPUT_ZIP);
const archive = archiver.create('zip', { zlib: { level: 9 } });

output.on('close', () => console.log('ZIP selesai.'));
archive.pipe(output);
archive.directory(TEMP_DIR, false);
archive.finalize();
