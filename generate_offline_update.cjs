
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const SOURCE_DIR = process.cwd();
const OUTPUT_ZIP = path.join(process.cwd(), 'update_offline_v2.zip');

const zip = new AdmZip();

// Helper to add directory recursively
function addDirToZip(zip, dir, zipPath) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        
        // Exclude unnecessary files/directories
        if (['node_modules', '.git', 'temp_offline_update', 'dist', 'update_offline_v2.zip', 'generate_offline_update.cjs', 'test.zip'].includes(file)) return;

        if (stats.isDirectory()) {
            addDirToZip(zip, fullPath, zipPath ? path.join(zipPath, file) : file);
        } else {
            zip.addLocalFile(fullPath, zipPath);
        }
    });
}

console.log('Memulai kompresi dengan adm-zip...');
addDirToZip(zip, SOURCE_DIR, "");
zip.writeZip(OUTPUT_ZIP);
console.log('ZIP berhasil dibuat: ' + OUTPUT_ZIP);

