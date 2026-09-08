window.renderModulAjar2Module = function(container) {
    if (!container) return;

    if (!appState.subjects || appState.subjects.length === 0) {
        fetch('/api/subjects')
            .then(r => r.json())
            .then(res => {
                if (res.success && Array.isArray(res.subjects)) {
                    appState.subjects = res.subjects;
                    renderModulAjar2Module(container);
                }
            })
            .catch(err => console.error('Gagal mengambil mata pelajaran:', err));
    }

    if (!appState.lessonPlans) {
        appState.lessonPlans = [];
        fetch('/api/lesson-plans')
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    appState.lessonPlans = res.data;
                    renderModulAjar2Module(container);
                }
            })
            .catch(err => console.error('Gagal mengambil modul ajar:', err));
    }

    const selectedSubjectId = appState.selectedModulAjar2SubjectId || '';
    const selectedSubject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(selectedSubjectId)) : null;

    const searchQuery = appState.modulAjar2SearchQuery || '';
    let contentHtml = '';

    if (selectedSubject) {
        if (!appState.modul2Babs) {
            appState.modul2Babs = [{ title: '' }];
        }

        let babsHtml = '';
        appState.modul2Babs.forEach((bab, index) => {
            babsHtml += `
                <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                    <div class="flex items-center space-x-2 shrink-0">
                        <span class="text-xs font-bold text-slate-500 w-12">Bab ${index + 1}</span>
                    </div>
                    <input type="text" class="flex-1 px-4 py-2.5 border border-slate-200 bg-white rounded-xl text-sm font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition outline-none" placeholder="Judul/Materi Pembelajaran (misal: Sholat)" value="${escapeHtml(bab.title)}" oninput="appState.modul2Babs[${index}].title = this.value">
                    <div class="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                        <button type="button" onclick="removeModul2Bab(${index})" class="px-3.5 py-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 bg-white border border-slate-200 rounded-xl transition active:scale-95 flex items-center space-x-1" title="Hapus Bab">
                            <i class="fa-solid fa-trash text-xs"></i><span class="text-xs font-bold">Hapus</span>
                        </button>
                    </div>
                </div>
            `;
        });

        // Get lesson plans for this subject
        const subjectPlans = appState.lessonPlans ? appState.lessonPlans.filter(lp => String(lp.subjectId) === String(selectedSubjectId)) : [];

        // Sort lesson plans so that they appear in the exact numerical order (1. to 12.)
        subjectPlans.sort((a, b) => {
            const getNum = (title) => {
                const match = title.match(/^(\d+)\./);
                return match ? parseInt(match[1], 10) : 999;
            };
            const numA = getNum(a.title);
            const numB = getNum(b.title);
            if (numA !== numB) return numA - numB;
            return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
        });

        let plansListHtml = '';
        if (subjectPlans.length === 0) {
            plansListHtml = `
                <div class="py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-3xl col-span-full">
                    <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
                        <i class="fa-solid fa-folder-open text-2xl"></i>
                    </div>
                    <h4 class="text-sm font-bold text-slate-700">Belum ada Modul/Administrasi Tergenerasi</h4>
                    <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Gunakan form di atas untuk mengisi judul bab, lalu klik tombol generate untuk menyusun 12 dokumen Kurikulum KBC secara otomatis sekaligus.</p>
                </div>
            `;
        } else {
            plansListHtml = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5 col-span-full">
                    ${subjectPlans.map(lp => `
                        <div class="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
                            <div class="space-y-1">
                                <div class="flex items-center justify-between">
                                    <span class="px-2.5 py-1 ${lp.isHtml ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'} text-[10px] font-bold rounded-lg uppercase">${lp.isHtml ? 'Administrasi / RPP' : 'Modul Ajar'}</span>
                                    <span class="text-[10px] text-slate-400 font-medium">KBC (Kurikulum Berbasis Cinta)</span>
                                </div>
                                <h4 class="text-sm sm:text-base font-bold text-slate-800 line-clamp-1">${escapeHtml(lp.title)}</h4>
                                <p class="text-xs text-slate-500 line-clamp-2"><span class="font-semibold text-slate-700">Materi/Topik:</span> ${escapeHtml(lp.topic || '-')}</p>
                            </div>
                            <div class="flex items-center justify-between pt-3 border-t border-slate-50">
                                <button type="button" onclick="deleteLessonPlan2('${lp.id}')" class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-xs rounded-xl transition animate-fade-in" title="Hapus">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                                <div class="flex items-center space-x-1.5">
                                    <button type="button" onclick="window.openPreviewLessonPlan('${lp.id}')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition flex items-center space-x-1">
                                        <i class="fa-solid fa-eye text-[10px]"></i><span>Pratinjau</span>
                                    </button>
                                    <button type="button" onclick="window.downloadModulAsWord('${lp.id}')" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-xl transition flex items-center space-x-1">
                                        <i class="fa-solid fa-file-word text-[10px]"></i><span>Unduh Word</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        contentHtml = `
            <div class="space-y-6 max-w-5xl mx-auto animate-fade-in">
                <div class="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm mb-6">
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <h2 class="text-lg font-bold text-slate-800">Generate Modul KBC - ${escapeHtml(selectedSubject.name)}</h2>
                            <p class="text-xs text-slate-500 mt-1">Masukkan daftar bab pembelajaran yang akan di-generate otomatis oleh AI menjadi 12 dokumen administrasi KBC lengkap.</p>
                        </div>
                        <button onclick="appState.selectedModulAjar2SubjectId = ''; renderModulAjar2Module(document.getElementById('view-container'))" class="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition">
                            <i class="fa-solid fa-arrow-left mr-1.5"></i> Kembali
                        </button>
                    </div>

                    <div class="space-y-4 mb-2">
                        ${babsHtml}
                        <button type="button" onclick="addModul2Bab()" class="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-emerald-600 font-bold text-sm hover:border-emerald-400 hover:bg-emerald-50 transition">
                            <i class="fa-solid fa-plus mr-2"></i> Tambah Bab Baru
                        </button>
                        
                        ${appState.showKbcConfigForm ? `
                        <!-- Form Konfigurasi Tanda Tangan & Pilihan Dokumen -->
                        <div id="kbc-config-form" class="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-6 animate-fade-in text-left">
                            <div class="flex items-center space-x-2 text-slate-800 pb-3 border-b border-slate-200">
                                <i class="fa-solid fa-file-signature text-emerald-600 text-lg"></i>
                                <h3 class="font-extrabold text-sm sm:text-base">Pengaturan Identitas & Pilihan Dokumen</h3>
                            </div>
                            
                            <!-- Grid Identitas Guru & Kepsek -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="space-y-3">
                                    <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Identitas Guru Pengajar</h4>
                                    <div>
                                        <label class="block text-[11px] font-bold text-slate-500 mb-1">Nama Guru</label>
                                        <input type="text" id="kbc-guru-name" class="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-medium focus:border-emerald-500 outline-none" placeholder="Contoh: Ahmad Fauzi, S.Pd." value="${escapeHtml(appState.kbcGuruName || '')}" oninput="appState.kbcGuruName = this.value">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold text-slate-500 mb-1">NIP Guru (Opsional)</label>
                                        <input type="text" id="kbc-guru-nip" class="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-medium focus:border-emerald-500 outline-none" placeholder="Contoh: 198201012010011002" value="${escapeHtml(appState.kbcGuruNip || '')}" oninput="appState.kbcGuruNip = this.value">
                                    </div>
                                </div>
                                <div class="space-y-3">
                                    <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Identitas Kepala Madrasah</h4>
                                    <div>
                                        <label class="block text-[11px] font-bold text-slate-500 mb-1">Nama Kepala Madrasah</label>
                                        <input type="text" id="kbc-kepsek-name" class="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-medium focus:border-emerald-500 outline-none" placeholder="Contoh: Dr. H. Maimun, M.Ag." value="${escapeHtml(appState.kbcKepsekName || '')}" oninput="appState.kbcKepsekName = this.value">
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold text-slate-500 mb-1">NIP Kepala Madrasah (Opsional)</label>
                                        <input type="text" id="kbc-kepsek-nip" class="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-medium focus:border-emerald-500 outline-none" placeholder="Contoh: 197508152003121001" value="${escapeHtml(appState.kbcKepsekNip || '')}" oninput="appState.kbcKepsekNip = this.value">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Pilihan Dokumen (12 Dokumen) -->
                            <div class="space-y-3">
                                <div class="flex items-center justify-between">
                                    <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Pilih Dokumen Administrasi KBC yang Ingin Digenerate</h4>
                                    <div class="flex space-x-2">
                                        <button type="button" onclick="toggleAllKbcDocs(true)" class="text-[10px] text-emerald-600 hover:underline font-bold">Pilih Semua</button>
                                        <span class="text-slate-300 text-[10px]">•</span>
                                        <button type="button" onclick="toggleAllKbcDocs(false)" class="text-[10px] text-rose-600 hover:underline font-bold">Hapus Semua</button>
                                    </div>
                                </div>
                                
                                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2" id="kbc-docs-selection-grid">
                                    ${getKbcDocTypesList().map(doc => {
                                        const isChecked = appState.selectedKbcDocs ? appState.selectedKbcDocs.includes(doc.id) : true;
                                        return `
                                            <label class="flex items-start space-x-2.5 p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition text-xs select-none">
                                                <input type="checkbox" name="kbc_doc_type" value="${doc.id}" ${isChecked ? 'checked' : ''} onchange="toggleKbcDocSelection('${doc.id}', this.checked)" class="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500">
                                                <div class="leading-tight">
                                                    <span class="font-bold text-slate-700 block">${doc.num}. ${doc.name}</span>
                                                    <span class="text-[10px] text-slate-400 font-medium">${doc.desc}</span>
                                                </div>
                                            </label>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                            
                            <!-- Aksi Form -->
                            <div class="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
                                <button type="button" onclick="appState.showKbcConfigForm = false; renderModulAjar2Module(document.getElementById('view-container'))" class="flex-1 py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition active:scale-95 cursor-pointer">
                                    Batal
                                </button>
                                <button type="button" id="btn-submit-generate-kbc" onclick="executeKbcGeneration()" class="flex-[2] py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-extrabold text-xs shadow-md transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer">
                                    <i class="fa-solid fa-wand-magic-sparkles text-xs animate-pulse"></i>
                                    <span>Mulai / Lanjutkan Generate Dokumen Terpilih</span>
                                </button>
                            </div>
                        </div>
                        ` : `
                        <div class="pt-6 border-t border-slate-100 mt-6 flex justify-center">
                            <button type="button" id="btn-generate-kbc-all" onclick="showKbcGenerationForm()" class="w-full py-5 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:via-teal-700 hover:to-emerald-800 text-white rounded-2xl font-extrabold text-sm sm:text-base shadow-xl shadow-emerald-600/10 hover:scale-[1.01] transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 cursor-pointer">
                                <i class="fa-solid fa-wand-magic-sparkles text-base animate-pulse"></i>
                                <span>Generate Lengkap Perangkat Pembelajaran KBC (12 Dokumen)</span>
                            </button>
                        </div>
                        `}
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="text-base font-bold text-slate-800">Daftar Modul Ajar & Administrasi Tergenerasi (Kurikulum KBC)</h3>
                    </div>
                    <div id="modul-2-result-container" class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        ${plansListHtml}
                    </div>
                </div>
            </div>
        `;
    } else {
        let filteredSubjects = [];
        let subjectsHtml = '';

        if (!searchQuery) {
            subjectsHtml = `
                <div class="col-span-full py-12 flex flex-col items-center justify-center text-center">
                    <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-3">
                        <i class="fa-solid fa-magnifying-glass text-2xl"></i>
                    </div>
                    <p class="text-sm font-bold text-slate-600">Ketik untuk mencari mata pelajaran</p>
                    <p class="text-[11px] text-slate-400 mt-1">Silakan masukkan nama mata pelajaran pada kolom pencarian di atas untuk mulai mengelola.</p>
                </div>
            `;
        } else {
            filteredSubjects = (appState.subjects || []).filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
            if (filteredSubjects.length > 0) {
                filteredSubjects.forEach(subject => {
                    subjectsHtml += `
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-emerald-300 hover:shadow-md transition cursor-pointer" onclick="selectModul2Subject('${subject.id}')">
                            <div class="flex items-center space-x-4">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-50 text-indigo-600 flex items-center justify-center shrink-0">
                                    <i class="fa-solid fa-wand-magic-sparkles text-xl"></i>
                                </div>
                                <div>
                                    <h3 class="text-sm font-bold text-slate-800">${escapeHtml(subject.name)}</h3>
                                    <p class="text-[11px] text-slate-400 mt-0.5">Kelola Modul Ajar 2</p>
                                </div>
                            </div>
                            <button type="button" class="px-4 py-2 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-xl text-xs font-bold transition border border-slate-200">
                                Kelola Modul
                            </button>
                        </div>
                    `;
                });
            } else {
                subjectsHtml = `
                    <div class="col-span-full py-12 flex flex-col items-center justify-center text-center">
                        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-3">
                            <i class="fa-solid fa-folder-open text-2xl"></i>
                        </div>
                        <p class="text-sm font-bold text-slate-600">Tidak ada mata pelajaran</p>
                        <p class="text-[11px] text-slate-400 mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
                    </div>
                `;
            }
        }

        contentHtml = `
            <div class="space-y-6 max-w-5xl mx-auto">
                <!-- Clean Simple Title Header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <div>
                        <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Modul Ajar 2</h2>
                        <p class="text-xs text-slate-500 font-medium">Silakan pilih mata pelajaran untuk membuat modul ajar berbasis template.</p>
                    </div>
                </div>

                <!-- Subject Search & Selection Card -->
                <div class="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h3 class="text-sm sm:text-base font-extrabold text-slate-900">Mata Pelajaran</h3>
                            <p class="text-[11px] text-slate-400">Pilih mata pelajaran di bawah ini</p>
                        </div>
                        <div class="relative w-full sm:w-72">
                            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                            <input type="text" id="mapel-2-search-input" value="${searchQuery}" oninput="searchMapelModulAjar2(this.value)" placeholder="Cari mata pelajaran..." class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold" autocomplete="off">
                        </div>
                    </div>

                    <!-- Results container -->
                    <div id="mapel-2-results-container" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[480px] overflow-y-auto pr-1">
                        ${subjectsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="animate-fade-in space-y-6">
            ${contentHtml}
        </div>
    `;

    // Focus search input if not selected
    if (!selectedSubject) {
        setTimeout(() => {
            const si = document.getElementById('mapel-2-search-input');
            if (si && document.activeElement !== si) {
                const val = si.value;
                si.value = '';
                si.focus();
                si.value = val;
            }
        }, 100);
    }
};

window.searchMapelModulAjar2 = function(query) {
    appState.modulAjar2SearchQuery = query;
    const container = document.getElementById('mapel-2-results-container');
    if (!container) return;
    
    if (!query) {
        container.innerHTML = `
            <div class="col-span-full py-12 flex flex-col items-center justify-center text-center">
                <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-3">
                    <i class="fa-solid fa-magnifying-glass text-2xl"></i>
                </div>
                <p class="text-sm font-bold text-slate-600">Ketik untuk mencari mata pelajaran</p>
                <p class="text-[11px] text-slate-400 mt-1">Silakan masukkan nama mata pelajaran pada kolom pencarian di atas untuk mulai mengelola.</p>
            </div>
        `;
        return;
    }
    
    let filteredSubjects = (appState.subjects || []).filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

    if (filteredSubjects.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 flex flex-col items-center justify-center text-center">
                <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-3">
                    <i class="fa-solid fa-search text-2xl"></i>
                </div>
                <p class="text-sm font-bold text-slate-600">Mata pelajaran tidak ditemukan</p>
                <p class="text-[11px] text-slate-400 mt-1">Coba gunakan kata kunci pencarian yang lain.</p>
            </div>
        `;
        return;
    }

    let subjectsHtml = '';
    filteredSubjects.forEach(subject => {
        subjectsHtml += `
            <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-emerald-300 hover:shadow-md transition cursor-pointer" onclick="selectModul2Subject('${subject.id}')">
                <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-wand-magic-sparkles text-xl"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-slate-800">${escapeHtml(subject.name)}</h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">Kelola Modul Ajar 2</p>
                    </div>
                </div>
                <button type="button" class="px-4 py-2 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-xl text-xs font-bold transition border border-slate-200">
                    Kelola Modul
                </button>
            </div>
        `;
    });
    container.innerHTML = subjectsHtml;
};

window.selectModul2Subject = function(id) {
    appState.selectedModulAjar2SubjectId = id;
    appState.modul2Babs = [{ title: '' }];
    renderModulAjar2Module(document.getElementById('view-container'));
};

window.addModul2Bab = function() {
    if (!appState.modul2Babs) appState.modul2Babs = [];
    appState.modul2Babs.push({ title: '' });
    renderModulAjar2Module(document.getElementById('view-container'));
};

window.removeModul2Bab = function(index) {
    if (!appState.modul2Babs) return;
    appState.modul2Babs.splice(index, 1);
    renderModulAjar2Module(document.getElementById('view-container'));
};

window.deleteLessonPlan2 = async function(id) {
    showConfirmModal('Apakah Anda yakin ingin menghapus dokumen ini?', async () => {
        try {
            const res = await fetch(`/api/lesson-plans/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast(data.message || 'Dokumen berhasil dihapus!', 'success');
                // Re-fetch and re-render
                const plansRes = await fetch('/api/lesson-plans');
                const plansData = await plansRes.json();
                if (plansData.success) {
                    appState.lessonPlans = plansData.data;
                    renderModulAjar2Module(document.getElementById('view-container'));
                }
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
};

window.getKbcDocTypesList = function() {
    return [
        { id: 'alokasi_waktu', num: '1', name: 'Analisis Alokasi Waktu', desc: 'Satu dokumen per jenjang' },
        { id: 'ki_kd', num: '2', name: 'Analisis KI-KD', desc: 'Satu dokumen per jenjang' },
        { id: 'rpp', num: '3', name: 'RPP (Rencana Pelaksanaan Pembelajaran)', desc: 'Satu per bab' },
        { id: 'silabus', num: '4', name: 'Silabus', desc: 'Satu dokumen komprehensif' },
        { id: 'atp', num: '5', name: 'Alur Tujuan Pembelajaran (ATP)', desc: 'Satu dokumen kronologis' },
        { id: 'cp', num: '6', name: 'Capaian Pembelajaran (CP)', desc: 'Satu dokumen elemen' },
        { id: 'kktp', num: '7', name: 'Kriteria Ketuntasan (KKTP)', desc: 'Satu dokumen interval nilai KBC' },
        { id: 'modul_ajar', num: '8', name: 'Modul Ajar', desc: 'Satu per bab' },
        { id: 'prosem', num: '9', name: 'Program Semester (Prosem)', desc: 'Satu dokumen tabel mingguan' },
        { id: 'prota', num: '10', name: 'Program Tahunan (Prota)', desc: 'Satu dokumen alokasi tahunan' },
        { id: 'tp', num: '11', name: 'Tujuan Pembelajaran (TP)', desc: 'Satu dokumen pemetaan' },
        { id: 'lkpd', num: '12', name: 'Lembar Kerja Siswa (LKPD)', desc: 'Satu per bab' }
    ];
};

window.showKbcGenerationForm = function() {
    appState.showKbcConfigForm = true;
    if (!appState.selectedKbcDocs) {
        appState.selectedKbcDocs = getKbcDocTypesList().map(d => d.id);
    }
    renderModulAjar2Module(document.getElementById('view-container'));
};

window.toggleAllKbcDocs = function(select) {
    if (select) {
        appState.selectedKbcDocs = getKbcDocTypesList().map(d => d.id);
    } else {
        appState.selectedKbcDocs = [];
    }
    renderModulAjar2Module(document.getElementById('view-container'));
};

window.toggleKbcDocSelection = function(docId, checked) {
    if (!appState.selectedKbcDocs) {
        appState.selectedKbcDocs = getKbcDocTypesList().map(d => d.id);
    }
    if (checked) {
        if (!appState.selectedKbcDocs.includes(docId)) {
            appState.selectedKbcDocs.push(docId);
        }
    } else {
        appState.selectedKbcDocs = appState.selectedKbcDocs.filter(id => id !== docId);
    }
};

window.generateAllKbcDocuments = function() {
    window.showKbcGenerationForm();
};

window.executeKbcGeneration = async function() {
    const babs = appState.modul2Babs.map(b => b.title.trim()).filter(b => b.length > 0);
    if (babs.length === 0) {
        showToast('Minimal satu bab harus diisi', 'error');
        return;
    }
    
    if (!appState.selectedKbcDocs || appState.selectedKbcDocs.length === 0) {
        showToast('Pilih minimal satu jenis dokumen yang ingin digenerate!', 'error');
        return;
    }

    const selectedSubjectId = appState.selectedModulAjar2SubjectId;
    const selectedSubject = appState.subjects.find(s => String(s.id) === String(selectedSubjectId));
    if (!selectedSubject) return;

    // Save latest input values from form to appState
    const guruNameEl = document.getElementById('kbc-guru-name');
    const guruNipEl = document.getElementById('kbc-guru-nip');
    const kepsekNameEl = document.getElementById('kbc-kepsek-name');
    const kepsekNipEl = document.getElementById('kbc-kepsek-nip');
    
    if (guruNameEl) appState.kbcGuruName = guruNameEl.value;
    if (guruNipEl) appState.kbcGuruNip = guruNipEl.value;
    if (kepsekNameEl) appState.kbcKepsekName = kepsekNameEl.value;
    if (kepsekNipEl) appState.kbcKepsekNip = kepsekNipEl.value;

    const btn = document.getElementById('btn-submit-generate-kbc');
    const resultContainer = document.getElementById('modul-2-result-container');
    
    if (btn) btn.disabled = true;
    const originalBtnHtml = btn ? btn.innerHTML : '';

    // Define chosen tasks
    const tasks = [];
    
    // 1. Analisis Alokasi Waktu
    if (appState.selectedKbcDocs.includes('alokasi_waktu')) {
        tasks.push({ id: 'alokasi_waktu', name: '1. Analisis Alokasi Waktu KBC', docType: 'alokasi_waktu', titlePrefix: '1. Analisis Alokasi Waktu KBC' });
    }
    
    // 2. Analisis KI-KD
    if (appState.selectedKbcDocs.includes('ki_kd')) {
        tasks.push({ id: 'ki_kd', name: '2. Analisis KI-KD KBC', docType: 'ki_kd', titlePrefix: '2. Analisis KI-KD KBC' });
    }
    
    // 3. RPP (Per Bab)
    if (appState.selectedKbcDocs.includes('rpp')) {
        babs.forEach((babTitle, index) => {
            tasks.push({ 
                id: `rpp_${index}`, 
                name: `3. RPP KBC: Bab ${index + 1}`, 
                docType: 'rpp', 
                babIndex: index, 
                babTitle, 
                titlePrefix: `3. RPP KBC: Bab ${index + 1} - ${babTitle}` 
            });
        });
    }
    
    // 4. Silabus
    if (appState.selectedKbcDocs.includes('silabus')) {
        tasks.push({ id: 'silabus', name: '4. Silabus KBC', docType: 'silabus', titlePrefix: '4. Silabus KBC' });
    }
    
    // 5. ATP
    if (appState.selectedKbcDocs.includes('atp')) {
        tasks.push({ id: 'atp', name: '5. ATP KBC', docType: 'atp', titlePrefix: '5. ATP KBC' });
    }
    
    // 6. CP
    if (appState.selectedKbcDocs.includes('cp')) {
        tasks.push({ id: 'cp', name: '6. Capaian Pembelajaran (CP) KBC', docType: 'cp', titlePrefix: '6. Capaian Pembelajaran (CP) KBC' });
    }
    
    // 7. KKTP
    if (appState.selectedKbcDocs.includes('kktp')) {
        tasks.push({ id: 'kktp', name: '7. KKTP KBC', docType: 'kktp', titlePrefix: '7. KKTP KBC' });
    }
    
    // 8. Modul Ajar (Per Bab)
    if (appState.selectedKbcDocs.includes('modul_ajar')) {
        babs.forEach((babTitle, index) => {
            tasks.push({ 
                id: `modul_ajar_${index}`, 
                name: `8. Modul Ajar KBC: Bab ${index + 1}`, 
                docType: 'modul_ajar', 
                babIndex: index, 
                babTitle, 
                titlePrefix: `8. Modul Ajar KBC: Bab ${index + 1} - ${babTitle}` 
            });
        });
    }
    
    // 9. Prosem
    if (appState.selectedKbcDocs.includes('prosem')) {
        tasks.push({ id: 'prosem', name: '9. Program Semester (Prosem) KBC', docType: 'prosem', titlePrefix: '9. Program Semester (Prosem) KBC' });
    }
    
    // 10. Prota
    if (appState.selectedKbcDocs.includes('prota')) {
        tasks.push({ id: 'prota', name: '10. Program Tahunan (Prota) KBC', docType: 'prota', titlePrefix: '10. Program Tahunan (Prota) KBC' });
    }
    
    // 11. TP
    if (appState.selectedKbcDocs.includes('tp')) {
        tasks.push({ id: 'tp', name: '11. Tujuan Pembelajaran (TP) KBC', docType: 'tp', titlePrefix: '11. Tujuan Pembelajaran (TP) KBC' });
    }
    
    // 12. LKPD (Per Bab)
    if (appState.selectedKbcDocs.includes('lkpd')) {
        babs.forEach((babTitle, index) => {
            tasks.push({ 
                id: `lkpd_${index}`, 
                name: `12. LKPD KBC: Bab ${index + 1}`, 
                docType: 'lkpd', 
                babIndex: index, 
                babTitle, 
                titlePrefix: `12. LKPD KBC: Bab ${index + 1} - ${babTitle}` 
            });
        });
    }

    // Render Progress Interface
    resultContainer.innerHTML = `
        <div class="col-span-full py-8 px-6 bg-white border border-slate-200/80 rounded-3xl shadow-md space-y-6 animate-fade-in">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-spinner fa-spin text-lg"></i>
                    </div>
                    <div>
                        <h4 class="text-sm sm:text-base font-extrabold text-slate-800">Menyusun Perangkat KBC Terpilih (${tasks.length} Dokumen)</h4>
                        <p class="text-[11px] sm:text-xs text-slate-400 mt-0.5">Memproses berkas secara berurutan agar menghasilkan isi yang sangat detail & profesional.</p>
                    </div>
                </div>
                <div class="shrink-0 bg-slate-100 px-3.5 py-1.5 rounded-full text-xs font-extrabold text-slate-600">
                    Selesai: <span id="kbc-progress-counter" class="text-emerald-600">0</span> / ${tasks.length}
                </div>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1" id="kbc-progress-grid">
                ${tasks.map(t => `
                    <div id="task-card-${t.id}" class="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between transition duration-200">
                        <div class="flex items-center space-x-3 overflow-hidden">
                            <div id="task-icon-${t.id}" class="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-clock text-xs"></i>
                            </div>
                            <div class="overflow-hidden">
                                <p class="text-xs font-bold text-slate-700 truncate">${escapeHtml(t.name)}</p>
                                <p id="task-status-${t.id}" class="text-[9px] text-slate-400 font-medium truncate">Menunggu antrean...</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    let successCount = 0;

    try {
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            
            // Mark task as active
            const card = document.getElementById(`task-card-${task.id}`);
            const iconBox = document.getElementById(`task-icon-${task.id}`);
            const statusText = document.getElementById(`task-status-${task.id}`);
            
            if (card) {
                card.className = "p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl flex items-center justify-between transition duration-200 ring-1 ring-indigo-100";
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            if (iconBox) iconBox.className = "w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0";
            if (iconBox) iconBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i>';
            if (statusText) statusText.className = "text-[9px] text-indigo-500 font-semibold truncate";
            if (statusText) statusText.innerText = "Menganalisis & menyusun...";

            // Call backend generator
            const res = await fetch('/api/gemini/generate-kbc-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docType: task.docType,
                    subjectName: selectedSubject.name,
                    babs: babs,
                    babIndex: task.babIndex,
                    babTitle: task.babTitle,
                    grade: 'X',
                    guruName: appState.kbcGuruName,
                    guruNip: appState.kbcGuruNip,
                    kepsekName: appState.kbcKepsekName,
                    kepsekNip: appState.kbcKepsekNip
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || `Gagal menyusun ${task.name}`);
            }

            // Save generated document to local list
            const saveRes = await fetch('/api/lesson-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subjectId: selectedSubjectId,
                    title: `${task.titlePrefix}`,
                    topic: task.babTitle || babs.join(', '),
                    grade: 'X',
                    isHtml: true,
                    htmlContent: data.html
                })
            });

            const saveResult = await saveRes.json();
            if (!saveRes.ok || !saveResult.success) {
                throw new Error(saveResult.message || `Gagal menyimpan ${task.name}`);
            }

            // Mark task as success
            if (card) card.className = "p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between transition duration-200";
            if (iconBox) iconBox.className = "w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0";
            if (iconBox) iconBox.innerHTML = '<i class="fa-solid fa-circle-check text-xs animate-bounce"></i>';
            if (statusText) statusText.className = "text-[9px] text-emerald-600 font-bold truncate";
            if (statusText) statusText.innerText = "Selesai Tergenerasi!";

            successCount++;
            const counter = document.getElementById('kbc-progress-counter');
            if (counter) counter.innerText = successCount;
        }

        showToast('Berhasil menggenerasi seluruh dokumen administrasi KBC terpilih secara lengkap!', 'success');

        // Re-fetch plans and render list
        const plansRes = await fetch('/api/lesson-plans');
        const plansData = await plansRes.json();
        if (plansData.success) {
            appState.lessonPlans = plansData.data;
        }

        appState.showKbcConfigForm = false; // Close form on success
        renderModulAjar2Module(document.getElementById('view-container'));

    } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
        
        // Show retry error block in result container
        resultContainer.innerHTML = `
            <div class="col-span-full p-6 text-center bg-rose-50 border border-rose-200 rounded-3xl text-rose-600 space-y-3">
                <i class="fa-solid fa-triangle-exclamation text-3xl text-rose-500 animate-bounce"></i>
                <h4 class="font-extrabold text-sm sm:text-base text-slate-800">Proses Terhenti Akibat Kesalahan</h4>
                <p class="text-xs text-slate-500 max-w-md mx-auto">${escapeHtml(err.message)}</p>
                <div class="pt-2">
                    <button type="button" onclick="executeKbcGeneration()" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 mx-auto active:scale-95 cursor-pointer">
                        <i class="fa-solid fa-rotate-right"></i><span>Coba Lagi / Lanjutkan Dokumen Terpilih</span>
                    </button>
                </div>
            </div>
        `;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }
};
