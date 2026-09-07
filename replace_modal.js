const fs = require('fs');
let content = fs.readFileSync('src/modulAjarModule.js', 'utf8');

// 1. Fix the modal wrapper
content = content.replace(
    /<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900\/60 backdrop-blur-sm p-4 overflow-y-auto" onclick="if\(event.target === this\) closeModal\(\);">\s*<!-- Hidden File Input placed safely outside dropzone so it is never destroyed on innerHTML update -->\s*<input type="file" id="import-file-input" accept="\.docx,\.doc,\.pdf,\.txt" class="hidden" onchange="window.handleModulFileInput\(this.files, '\$\{subjectId\}'\); this.value = '';">\s*<div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 my-8 max-h-\[90vh\] overflow-y-auto flex flex-col text-left">/g,
    `<div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onclick="if(event.target === this) closeModal();">
            <!-- Hidden File Input placed safely outside dropzone so it is never destroyed on innerHTML update -->
            <input type="file" id="import-file-input" accept=".docx,.doc,.pdf,.txt" class="hidden" onchange="window.handleModulFileInput(this.files, '\\\${subjectId}'); this.value = '';">

            <div class="bg-white w-full max-w-2xl mx-auto rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 my-4 sm:my-8 flex flex-col text-left relative">`
);

// 2. Fix the import-form-actions and buttons wrapper
content = content.replace(
    /<div id="import-form-actions" class="hidden space-y-4">\s*<!-- Target Configuration Form -->/g,
    `<div id="import-form-target" class="hidden space-y-3 pt-1">
                        <!-- Target Configuration Form -->`
);

content = content.replace(
    /<\/div>\s*<!-- Modal Actions Footer -->\s*<div class="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0 flex-wrap sm:flex-nowrap gap-2">/g,
    `</div>
                <!-- Modal Actions Footer -->
                <div class="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0 flex-wrap sm:flex-nowrap gap-2">`
);

content = content.replace(
    /<div class="flex items-center space-x-2 flex-wrap gap-y-2">\s*<button type="button" id="btn-save-import-direct"/g,
    `<div id="import-form-actions-btns" class="hidden flex items-center space-x-2 flex-wrap gap-y-2">
                        <button type="button" id="btn-save-import-direct"`
);

content = content.replace(
    /<\/div>\s*<\/div>\s*<\/div>\s*<\/form>/g,
    `</div>
                </div>
            </form>`
);

// 3. Fix handleModulFileInput JS
content = content.replace(
    /const formActions = document.getElementById\('import-form-actions'\);/g,
    `const formTarget = document.getElementById('import-form-target');
    const formActionsBtns = document.getElementById('import-form-actions-btns');`
);

content = content.replace(
    /if \(formActions\) \{\s*formActions\.classList\.add\('hidden'\);\s*\}/g,
    `if (formTarget) formTarget.classList.add('hidden');
    if (formActionsBtns) formActionsBtns.classList.add('hidden');`
);

content = content.replace(
    /if \(formActions\) \{\s*formActions\.classList\.remove\('hidden'\);\s*\}/g,
    `if (formTarget) formTarget.classList.remove('hidden');
        if (formActionsBtns) formActionsBtns.classList.remove('hidden');`
);


fs.writeFileSync('src/modulAjarModule.js', content, 'utf8');
