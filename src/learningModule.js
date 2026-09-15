// Madrasah Bisa - Materi / Belajar
// Isolated learning layer. Reuses lessonPlans for material persistence and links to existing LKPD/CBT.
// It intentionally does not alter CBT session/recovery/answer hot paths.

const learningAppState = window.appState || {};
const learningEsc = (v) => typeof window.escapeHtml === 'function' ? window.escapeHtml(v ?? '') : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const learningToast = (m, t='info') => typeof window.showToast === 'function' ? window.showToast(m, t) : console.log(m);
const STUDENT_ROLES = new Set(['student','murid','class_leader','ketua_kelas']);
const STAFF_ROLES = new Set(['teacher','guru','admin','bos','superadmin']);

function learningRole() { return String(learningAppState.role || learningAppState.currentUser?.role || '').toLowerCase(); }
function learningEnabled() { return learningAppState.settings?.learningModuleEnabled !== false; }
function featureEnabled(key) {
    const defaults = { attendance: true, learning: true, cbt: true, games: true };
    const map = learningAppState.settings?.studentFeatures || {};
    return map[key] === undefined ? defaults[key] !== false : map[key] !== false;
}
function isLearningRecord(x) { return x && (x.recordType === 'learning_material' || x.type === 'learning_material'); }
function uid() { return `MAT_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function currentStudentId() { return String(learningAppState.currentUser?.id || ''); }
function currentClassId() { return String(learningAppState.currentUser?.classId || learningAppState.currentUser?.class_id || ''); }
function materialForStudent(m) {
    if (!m || m.status !== 'published') return false;
    const target = String(m.classId || m.class_id || m.targetClass || '').trim();
    return !target || /semua/i.test(target) || target === currentClassId();
}

async function loadLearningMaterials() {
    const r = await fetch('/api/lesson-plans', { cache: 'no-store' });
    const j = await r.json();
    const raw = Array.isArray(j) ? j : (j.data || j.lessonPlans || []);
    const normalized = typeof window.normalizeLessonPlanCollection === 'function' ? window.normalizeLessonPlanCollection(raw) : raw;
    return (Array.isArray(normalized) ? normalized : []).filter(isLearningRecord);
}
async function loadLearningLinks() {
    const [lkpdR, examR] = await Promise.all([
        fetch('/api/lkpds', { cache:'no-store' }).then(r=>r.json()).catch(()=>({})),
        fetch('/api/exams', { cache:'no-store' }).then(r=>r.json()).catch(()=>({}))
    ]);
    return { lkpds: lkpdR.lkpdList || lkpdR.data || [], exams: examR.exams || examR.data || [] };
}

function safeBlocksFromForm() {
    const content = document.getElementById('learning-content')?.value || '';
    const videoUrl = document.getElementById('learning-video')?.value?.trim() || '';
    const resourceUrl = document.getElementById('learning-resource')?.value?.trim() || '';
    const blocks = [{ type:'text', content }];
    if (videoUrl) blocks.push({ type:'video', url:videoUrl });
    if (resourceUrl) blocks.push({ type:'link', url:resourceUrl });
    return blocks;
}
function renderMaterialBlocks(blocks=[]) {
    return blocks.map(b => {
        if (b.type === 'text') return `<div class="prose max-w-none whitespace-pre-wrap text-sm leading-7 text-slate-700">${learningEsc(b.content)}</div>`;
        if (b.type === 'video' || b.type === 'link') {
            const url = String(b.url || '');
            if (!/^https?:\/\//i.test(url)) return '';
            return `<a href="${learningEsc(url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"><i class="fa-solid fa-arrow-up-right-from-square"></i>${b.type === 'video' ? 'Buka Video' : 'Buka Sumber'}</a>`;
        }
        return '';
    }).join('');
}

window.renderLearningTeacher = async function(container) {
    if (!container) return;
    container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat materi...</div>';
    try {
        const [materials, links] = await Promise.all([loadLearningMaterials(), loadLearningLinks()]);
        const cards = materials.map(m => `<div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div class="flex items-start justify-between gap-3"><div><div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">${learningEsc(m.subjectName || m.subjectId || 'Materi')}</div><h3 class="font-black text-slate-800 mt-1">${learningEsc(m.title)}</h3><p class="text-xs text-slate-500 mt-1">${learningEsc(m.topic || '')}</p></div><span class="px-2 py-1 rounded-lg text-[10px] font-bold ${m.status==='published'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}">${m.status==='published'?'Terbit':'Draft'}</span></div>
            <div class="mt-4 flex flex-wrap gap-2"><button onclick="openLearningMaterial('${learningEsc(m.id)}', true)" class="px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold">Lihat</button><button onclick="editLearningMaterial('${learningEsc(m.id)}')" class="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">Edit</button><button onclick="openLearningMonitor('${learningEsc(m.id)}')" class="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold"><i class="fa-solid fa-chart-line mr-1"></i>Monitoring</button></div>
        </div>`).join('');
        container.innerHTML = `<div class="max-w-6xl mx-auto space-y-5 pb-10"><div class="flex items-center justify-between gap-3"><div><h1 class="text-2xl font-black text-slate-900">Materi Pembelajaran</h1><p class="text-xs text-slate-500 mt-1">Materi dapat diteruskan langsung ke LKPD dan/atau asesmen.</p></div><button onclick="showLearningEditor()" class="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"><i class="fa-solid fa-plus mr-1"></i>Buat Materi</button></div><div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${cards || '<div class="col-span-full p-10 text-center bg-white rounded-2xl border text-slate-400 text-sm">Belum ada materi.</div>'}</div></div>`;
        window.__learningLinks = links;
        window.__learningMaterials = materials;
    } catch (e) { container.innerHTML = `<div class="p-8 text-center text-rose-600">Gagal memuat materi.</div>`; }
};

window.showLearningEditor = async function(existing=null) {
    const links = window.__learningLinks || await loadLearningLinks();
    const m = existing || {};
    const classes = learningAppState.classes || [];
    const subjects = learningAppState.subjects || [];
    const lkpdOpts = ['<option value="">Tanpa LKPD</option>', ...links.lkpds.map(x=>`<option value="${learningEsc(x.id)}" ${String(m.lkpdId||'')===String(x.id)?'selected':''}>${learningEsc(x.title || x.name || x.id)}</option>`)].join('');
    const examOpts = ['<option value="">Tanpa Asesmen</option>', ...links.exams.map(x=>`<option value="${learningEsc(x.id)}" ${String(m.examId||'')===String(x.id)?'selected':''}>${learningEsc(x.title || x.name || x.id)}</option>`)].join('');
    const classOpts = ['<option value="Semua Kelas">Semua Kelas</option>', ...classes.map(x=>`<option value="${learningEsc(x.id)}" ${String(m.classId||'')===String(x.id)?'selected':''}>${learningEsc(x.name || x.code || x.id)}</option>`)].join('');
    const subOpts = ['<option value="">Pilih Mapel</option>', ...subjects.map(x=>`<option value="${learningEsc(x.id)}" ${String(m.subjectId||'')===String(x.id)?'selected':''}>${learningEsc(x.name || x.id)}</option>`)].join('');
    const textBlock = (m.blocks||[]).find(b=>b.type==='text')?.content || m.content || '';
    const video = (m.blocks||[]).find(b=>b.type==='video')?.url || '';
    const resource = (m.blocks||[]).find(b=>b.type==='link')?.url || '';
    const html = `<div id="learning-editor-modal" class="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"><div class="max-w-3xl mx-auto my-6 bg-white rounded-3xl p-6 shadow-2xl space-y-4"><div class="flex justify-between"><div><h2 class="text-xl font-black">${m.id?'Edit':'Buat'} Materi</h2><p class="text-xs text-slate-500">Hubungkan materi dengan LKPD/asesmen tanpa menggandakan datanya.</p></div><button onclick="document.getElementById('learning-editor-modal')?.remove()" class="w-9 h-9 rounded-xl bg-slate-100">×</button></div>
    <input id="learning-id" type="hidden" value="${learningEsc(m.id||'')}"><div class="grid md:grid-cols-2 gap-3"><label class="text-xs font-bold">Judul<input id="learning-title" value="${learningEsc(m.title||'')}" class="mt-1 w-full p-3 border rounded-xl font-normal"></label><label class="text-xs font-bold">Topik<input id="learning-topic" value="${learningEsc(m.topic||'')}" class="mt-1 w-full p-3 border rounded-xl font-normal"></label><label class="text-xs font-bold">Mapel<select id="learning-subject" class="mt-1 w-full p-3 border rounded-xl font-normal">${subOpts}</select></label><label class="text-xs font-bold">Kelas<select id="learning-class" class="mt-1 w-full p-3 border rounded-xl font-normal">${classOpts}</select></label></div>
    <label class="text-xs font-bold block">Isi Materi<textarea id="learning-content" rows="10" class="mt-1 w-full p-3 border rounded-xl font-normal" placeholder="Tulis materi pembelajaran...">${learningEsc(textBlock)}</textarea></label>
    <div class="grid md:grid-cols-2 gap-3"><label class="text-xs font-bold">Video/tautan video<input id="learning-video" value="${learningEsc(video)}" class="mt-1 w-full p-3 border rounded-xl font-normal" placeholder="https://..."></label><label class="text-xs font-bold">Sumber/PDF/link<input id="learning-resource" value="${learningEsc(resource)}" class="mt-1 w-full p-3 border rounded-xl font-normal" placeholder="https://..."></label></div>
    <div class="p-4 rounded-2xl bg-slate-50"><div class="font-bold text-sm mb-3">Aktivitas setelah materi</div><div class="grid md:grid-cols-2 gap-3"><label class="text-xs font-bold">LKPD<select id="learning-lkpd" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">${lkpdOpts}</select></label><label class="text-xs font-bold">Asesmen/CBT<select id="learning-exam" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">${examOpts}</select></label></div></div>
    <div class="flex justify-end gap-2"><button onclick="saveLearningMaterial('draft')" class="px-4 py-2.5 bg-slate-100 rounded-xl text-xs font-bold">Simpan Draft</button><button onclick="saveLearningMaterial('published')" class="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">Publikasikan</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};
window.editLearningMaterial = function(id) { const m=(window.__learningMaterials||[]).find(x=>String(x.id)===String(id)); if(m) window.showLearningEditor(m); };
window.saveLearningMaterial = async function(status) {
    const id = document.getElementById('learning-id')?.value || uid();
    const payload = { id, recordType:'learning_material', title:document.getElementById('learning-title')?.value?.trim(), topic:document.getElementById('learning-topic')?.value?.trim(), subjectId:document.getElementById('learning-subject')?.value, classId:document.getElementById('learning-class')?.value, blocks:safeBlocksFromForm(), lkpdId:document.getElementById('learning-lkpd')?.value || '', examId:document.getElementById('learning-exam')?.value || '', status, updatedAt:Date.now(), teacherId:learningAppState.currentUser?.id };
    if (!payload.title) return learningToast('Judul materi wajib diisi.', 'warning');
    try {
        const r=await fetch('/api/lesson-plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const j=await r.json();
        if(!r.ok || j.success===false) throw new Error(j.message||'Gagal menyimpan');
        document.getElementById('learning-editor-modal')?.remove(); learningToast(status==='published'?'Materi dipublikasikan.':'Draft materi disimpan.','success');
        const c=document.getElementById('view-container'); if(c) window.renderLearningTeacher(c);
    } catch(e) { learningToast(e.message||'Gagal menyimpan materi.','error'); }
};

window.renderLearningStudent = async function(container) {
    if (!learningEnabled() || !featureEnabled('learning')) { learningToast('Menu Belajar sedang dinonaktifkan.','info'); return; }
    container.innerHTML='<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat pembelajaran...</div>';
    try { const materials=(await loadLearningMaterials()).filter(materialForStudent); window.__learningMaterials=materials;
        container.innerHTML=`<div class="max-w-5xl mx-auto space-y-5 pb-10"><div><h1 class="text-2xl font-black text-slate-900">Belajar</h1><p class="text-xs text-slate-500 mt-1">Pelajari materi, lanjutkan LKPD, lalu asesmen sesuai arahan guru.</p></div><div class="grid md:grid-cols-2 gap-4">${materials.map(m=>`<button onclick="openLearningMaterial('${learningEsc(m.id)}')" class="text-left bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200"><div class="text-[10px] font-bold uppercase text-emerald-600">${learningEsc(m.subjectName||m.subjectId||'Materi')}</div><div class="font-black text-slate-800 mt-1">${learningEsc(m.title)}</div><div class="text-xs text-slate-500 mt-1">${learningEsc(m.topic||'')}</div><div class="mt-4 text-xs font-bold text-emerald-700">Buka materi <i class="fa-solid fa-arrow-right ml-1"></i></div></button>`).join('') || '<div class="col-span-full p-10 text-center bg-white rounded-2xl border text-slate-400 text-sm">Belum ada materi yang dipublikasikan untuk kelasmu.</div>'}</div></div>`;
    } catch(e){container.innerHTML='<div class="p-8 text-center text-rose-600">Gagal memuat materi.</div>';}
};
window.openLearningMaterial = async function(id, staffPreview=false) {
    const m=(window.__learningMaterials||[]).find(x=>String(x.id)===String(id)) || (await loadLearningMaterials()).find(x=>String(x.id)===String(id)); if(!m)return;
    const c=document.getElementById('view-container'); if(!c)return;
    const doneKey=`madrasah_learning_done_${currentStudentId()}_${m.id}`; const done=localStorage.getItem(doneKey)==='1';
    c.innerHTML=`<div class="max-w-3xl mx-auto pb-12"><button onclick="navigateTo('${staffPreview?'learning_teacher':'learning_student'}')" class="text-xs font-bold text-slate-500 mb-4"><i class="fa-solid fa-arrow-left mr-1"></i>Kembali</button><article class="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8"><div class="text-xs font-bold uppercase text-emerald-600">${learningEsc(m.subjectName||m.subjectId||'Materi')}</div><h1 class="text-2xl font-black text-slate-900 mt-1">${learningEsc(m.title)}</h1><p class="text-sm text-slate-500 mt-1">${learningEsc(m.topic||'')}</p><div class="mt-7 space-y-5">${renderMaterialBlocks(m.blocks||[])}</div>${!staffPreview?`<div class="mt-8 pt-6 border-t"><button onclick="completeLearningMaterial('${learningEsc(m.id)}')" class="w-full py-3 rounded-2xl ${done?'bg-emerald-50 text-emerald-700':'bg-emerald-600 text-white'} font-black text-sm">${done?'✓ Materi telah dipelajari':'✓ Saya Sudah Mempelajari Materi'}</button><div id="learning-next-actions" class="mt-3">${done?learningNextActions(m):''}</div></div>`:''}</article></div>`;
};
function learningNextActions(m){ const out=[]; if(m.lkpdId) out.push(`<button onclick="navigateTo('lkpd_siswa')" class="w-full mt-2 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm"><i class="fa-solid fa-clipboard-list mr-2"></i>Lanjut Kerjakan LKPD</button>`); if(m.examId) out.push(`<button onclick="navigateTo('cbt_siswa')" class="w-full mt-2 py-3 rounded-2xl bg-violet-600 text-white font-bold text-sm"><i class="fa-solid fa-file-circle-check mr-2"></i>Lanjut ke Asesmen</button>`); return out.join('') || '<div class="text-center text-xs text-emerald-700 font-bold py-3">✓ Pembelajaran selesai</div>'; }
window.completeLearningMaterial=function(id){ const m=(window.__learningMaterials||[]).find(x=>String(x.id)===String(id)); if(!m)return; localStorage.setItem(`madrasah_learning_done_${currentStudentId()}_${m.id}`,'1'); const el=document.getElementById('learning-next-actions'); if(el)el.innerHTML=learningNextActions(m); learningToast('Materi ditandai selesai.','success'); };
window.openLearningMonitor=function(id){ const m=(window.__learningMaterials||[]).find(x=>String(x.id)===String(id)); const c=document.getElementById('view-container'); if(!c||!m)return; c.innerHTML=`<div class="max-w-5xl mx-auto"><button onclick="navigateTo('learning_teacher')" class="text-xs font-bold text-slate-500 mb-4"><i class="fa-solid fa-arrow-left mr-1"></i>Kembali</button><div class="bg-white rounded-3xl border p-6"><h1 class="text-xl font-black">Monitoring — ${learningEsc(m.title)}</h1><p class="text-xs text-slate-500 mt-1">Fondasi monitoring tersedia. Status lintas perangkat akan diaktifkan setelah endpoint progress server-authoritative ditambahkan; data lokal tidak ditampilkan sebagai seolah-olah realtime.</p><div class="mt-5 p-5 rounded-2xl bg-amber-50 text-amber-800 text-sm"><i class="fa-solid fa-shield-halved mr-2"></i>Monitoring sengaja tidak memakai jalur heartbeat/jawaban CBT agar tidak mengganggu performa ujian.</div></div></div>`; };

function injectLearningMenus() {
    if (!learningEnabled()) return;
    const role=learningRole(); const sidebar=document.getElementById('sidebar-menu') || document.querySelector('aside nav') || document.querySelector('#sidebar nav'); if(!sidebar || sidebar.querySelector('[data-learning-menu]'))return;
    const btn=document.createElement('button'); btn.type='button'; btn.dataset.learningMenu='1'; btn.className='w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left';
    if(STUDENT_ROLES.has(role) && featureEnabled('learning')) { btn.innerHTML='<i class="fa-solid fa-book-open-reader w-5 text-blue-400"></i><span>Belajar</span>'; btn.onclick=()=>window.navigateTo('learning_student'); sidebar.appendChild(btn); }
    else if(STAFF_ROLES.has(role)) { btn.innerHTML='<i class="fa-solid fa-book-open w-5 text-emerald-400"></i><span>Materi Pembelajaran</span>'; btn.onclick=()=>window.navigateTo('learning_teacher'); sidebar.appendChild(btn); }
}

const originalNavigateTo = window.navigateTo;
if (typeof originalNavigateTo === 'function') {
    window.navigateTo = function(route, ...args) {
        if (route === 'learning_student' || route === 'learning_teacher') {
            const c=document.getElementById('view-container');
            if(route==='learning_student') return window.renderLearningStudent(c);
            return window.renderLearningTeacher(c);
        }
        if (STUDENT_ROLES.has(learningRole())) {
            if ((route.includes('game') && !featureEnabled('games')) || (route.includes('cbt') && !featureEnabled('cbt')) || (route.includes('absen') && !featureEnabled('attendance'))) { learningToast('Menu ini sedang dinonaktifkan oleh administrator.','info'); return; }
        }
        const result=originalNavigateTo.call(this,route,...args); setTimeout(injectLearningMenus,0); return result;
    };
}
const originalBuildSidebar=window.buildSidebar;
if(typeof originalBuildSidebar==='function') window.buildSidebar=function(...args){const r=originalBuildSidebar.apply(this,args); setTimeout(injectLearningMenus,0); return r;};
window.setStudentFeatureVisibility = async function(feature, enabled) {
    if(!['attendance','learning','cbt','games'].includes(feature))return;
    learningAppState.settings=learningAppState.settings||{}; learningAppState.settings.studentFeatures={...(learningAppState.settings.studentFeatures||{}),[feature]:Boolean(enabled)};
    if(feature==='learning') learningAppState.settings.learningModuleEnabled=Boolean(enabled);
    if(feature==='games') learningAppState.settings.gameModuleEnabled=Boolean(enabled);
    try { localStorage.setItem('madrasah_settings',JSON.stringify(learningAppState.settings)); const r=await fetch('/api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings:learningAppState.settings})}); if(!r.ok) throw new Error('Gagal menyimpan pengaturan'); learningToast('Pengaturan menu siswa disimpan.','success'); if(window.buildSidebar)window.buildSidebar(); } catch(e){learningToast(e.message||'Gagal menyimpan pengaturan.','error');}
};

setTimeout(injectLearningMenus,0);
