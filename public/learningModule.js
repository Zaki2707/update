// Madrasah Bisa - Materi / Belajar
// Isolated learning layer. Reuses lessonPlans for material persistence and links to existing LKPD/CBT.
// It intentionally does not alter CBT session/recovery/answer hot paths.

const STUDENT_ROLES = new Set(['student', 'siswa', 'class_leader', 'ketua_kelas']);
const STAFF_ROLES = new Set(['teacher', 'guru', 'admin', 'administrator', 'bos', 'superadmin']);
const LEARNING_QUEUE_KEY = 'madrasah_learning_progress_queue_v1';

function learningState() { return window.appState || {}; }
function learningRole() {
    const state = learningState();
    return String(state.role || state.currentUser?.role || '').toLowerCase();
}
function learningEsc(value) {
    const raw = String(value === undefined || value === null ? '' : value);
    return typeof window.escapeHtml === 'function'
        ? window.escapeHtml(raw)
        : raw.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function learningAttr(value) { return learningEsc(value).replace(/`/g, '&#96;'); }
function learningInlineArg(value) {
    return learningAttr(JSON.stringify(String(value === undefined || value === null ? '' : value))
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026'));
}
function learningToast(message, type = 'info') {
    if (typeof window.showToast === 'function') window.showToast(message, type);
    else console.log(message);
}
function featureEnabled(key) {
    const settings = learningState().settings || {};
    const map = settings.studentFeatures || {};
    const defaults = { attendance: true, learning: true, cbt: true, games: true };
    if (key === 'learning' && settings.learningModuleEnabled === false) return false;
    if (key === 'games' && settings.gameModuleEnabled === false) return false;
    return map[key] === undefined ? defaults[key] !== false : map[key] !== false;
}
function currentStudentId() {
    const state = learningState();
    return String(state.currentUser?.id || '');
}
function progressForMaterial(materialId) {
    const state = learningState();
    const ownId = currentStudentId();
    const rows = Array.isArray(state.learningProgress) ? state.learningProgress : [];
    return rows.find(row => String(row.materialId || '') === String(materialId) && String(row.studentId || '') === ownId) || null;
}
function isCompleted(materialId) {
    const progress = progressForMaterial(materialId);
    return Boolean(progress && (progress.status === 'completed' || Number(progress.progressPercent || 0) >= 100));
}
function materialLocked(material) {
    const prereq = Array.isArray(material?.prerequisiteMaterialIds) ? material.prerequisiteMaterialIds : [];
    return prereq.some(id => !isCompleted(id));
}
function learningPolicy(material) {
    const policy = material?.engagementPolicy || {};
    return {
        minActiveSeconds: Math.max(0, Math.min(3600, Number(policy.minActiveSeconds ?? material?.minActiveSeconds ?? 45) || 0)),
        requireAllBlocks: policy.requireAllBlocks === false ? false : true
    };
}
function materialBlockIds(material) {
    return (Array.isArray(material?.blocks) ? material.blocks : [])
        .map((block, index) => String(block.id || `block_${index + 1}`));
}
function engagementReady(material) {
    const tracker = learningState().__activeLearningTracker;
    if (!tracker || String(tracker.materialId) !== String(material?.id || '')) return { ready: false, message: 'Buka materi terlebih dahulu.' };
    const policy = learningPolicy(material);
    const activeSeconds = trackerActiveSeconds(tracker);
    if (activeSeconds < policy.minActiveSeconds) {
        return { ready: false, message: `Baca materi minimal ${policy.minActiveSeconds} detik aktif sebelum lanjut.` };
    }
    if (policy.requireAllBlocks) {
        const required = materialBlockIds(material);
        const seen = new Set(Array.from(tracker.viewedBlockIds || []).map(String));
        if (required.length > 0 && !required.every(id => seen.has(id))) {
            return { ready: false, message: 'Lihat semua bagian materi terlebih dahulu.' };
        }
    }
    return { ready: true };
}
function trackerActiveSeconds(tracker) {
    if (!tracker) return 0;
    const live = tracker.active && !document.hidden ? Date.now() - tracker.lastStartedAt : 0;
    return Math.floor((tracker.activeMs + Math.max(0, live)) / 1000);
}
function stopLearningTracker() {
    const tracker = learningState().__activeLearningTracker;
    if (!tracker) return;
    if (tracker.active) tracker.activeMs += Math.max(0, Date.now() - tracker.lastStartedAt);
    tracker.active = false;
    if (tracker.interval) window.clearInterval(tracker.interval);
    if (tracker.observer) tracker.observer.disconnect();
    window.removeEventListener('scroll', tracker.onScroll, true);
    window.removeEventListener('focus', tracker.onFocus);
    window.removeEventListener('blur', tracker.onBlur);
    document.removeEventListener('visibilitychange', tracker.onVisibility);
}
function startLearningTracker(material) {
    stopLearningTracker();
    const tracker = {
        materialId: String(material.id),
        activeMs: 0,
        lastStartedAt: Date.now(),
        active: !document.hidden,
        viewedBlockIds: new Set(),
        observer: null,
        onScroll: null,
        onFocus: null,
        onBlur: null,
        onVisibility: null
    };
    const pause = () => {
        if (!tracker.active) return;
        tracker.activeMs += Math.max(0, Date.now() - tracker.lastStartedAt);
        tracker.active = false;
    };
    const resume = () => {
        if (tracker.active || document.hidden) return;
        tracker.lastStartedAt = Date.now();
        tracker.active = true;
    };
    const markVisibleBlocks = () => {
        document.querySelectorAll('[data-learning-block-id]').forEach(el => {
            const rect = el.getBoundingClientRect();
            const visible = rect.top < window.innerHeight * 0.85 && rect.bottom > window.innerHeight * 0.15;
            if (visible) tracker.viewedBlockIds.add(String(el.getAttribute('data-learning-block-id') || ''));
        });
        updateEngagementUi(material);
    };
    tracker.onScroll = () => window.requestAnimationFrame(markVisibleBlocks);
    tracker.onFocus = resume;
    tracker.onBlur = pause;
    tracker.onVisibility = () => document.hidden ? pause() : resume();
    window.addEventListener('scroll', tracker.onScroll, true);
    window.addEventListener('focus', tracker.onFocus);
    window.addEventListener('blur', tracker.onBlur);
    document.addEventListener('visibilitychange', tracker.onVisibility);
    if ('IntersectionObserver' in window) {
        tracker.observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
                    tracker.viewedBlockIds.add(String(entry.target.getAttribute('data-learning-block-id') || ''));
                }
            });
            updateEngagementUi(material);
        }, { threshold: [0.55] });
        document.querySelectorAll('[data-learning-block-id]').forEach(el => tracker.observer.observe(el));
    }
    learningState().__activeLearningTracker = tracker;
    markVisibleBlocks();
    tracker.interval = window.setInterval(() => updateEngagementUi(material), 1000);
}
function learningCompletionPayload(material) {
    const tracker = learningState().__activeLearningTracker;
    return {
        materialId: material.id,
        status: 'completed',
        progressPercent: 100,
        activeSeconds: trackerActiveSeconds(tracker),
        viewedBlockIds: tracker ? Array.from(tracker.viewedBlockIds || []) : []
    };
}
function updateEngagementUi(material) {
    const tracker = learningState().__activeLearningTracker;
    if (!tracker || String(tracker.materialId) !== String(material?.id || '')) return;
    const policy = learningPolicy(material);
    const activeSeconds = trackerActiveSeconds(tracker);
    const required = materialBlockIds(material);
    const seenCount = required.filter(id => tracker.viewedBlockIds.has(id)).length;
    const ready = engagementReady(material).ready;
    const button = document.getElementById('learning-complete-button');
    if (button) {
        button.disabled = !ready;
        button.classList.toggle('opacity-60', !ready);
        button.classList.toggle('cursor-not-allowed', !ready);
    }
    const status = document.getElementById('learning-engagement-status');
    if (status) {
        status.textContent = `Aktif membaca ${Math.min(activeSeconds, policy.minActiveSeconds)}/${policy.minActiveSeconds} detik` +
            (policy.requireAllBlocks ? ` • bagian terlihat ${seenCount}/${required.length || 1}` : '');
    }
}
function queueLearningProgress(payload) {
    try {
        const queue = JSON.parse(localStorage.getItem(LEARNING_QUEUE_KEY) || '[]');
        queue.push({ ...payload, queuedAt: Date.now() });
        localStorage.setItem(LEARNING_QUEUE_KEY, JSON.stringify(queue.slice(-200)));
    } catch (_) {}
}
async function flushLearningProgressQueue() {
    let queue = [];
    try { queue = JSON.parse(localStorage.getItem(LEARNING_QUEUE_KEY) || '[]'); } catch (_) {}
    if (!Array.isArray(queue) || queue.length === 0) return;
    const remaining = [];
    for (const item of queue) {
        try {
            const response = await fetch('/api/learning/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!response.ok) remaining.push(item);
        } catch (_) {
            remaining.push(item);
        }
    }
    try { localStorage.setItem(LEARNING_QUEUE_KEY, JSON.stringify(remaining.slice(-200))); } catch (_) {}
}

async function loadLearningMaterials() {
    const response = await fetch('/api/learning/materials', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(data.message || 'Gagal memuat materi.');
    const state = learningState();
    state.learningProgress = Array.isArray(data.progress) ? data.progress : (state.learningProgress || []);
    state.lessonPlans = Array.isArray(data.materials) ? data.materials : (state.lessonPlans || []);
    return Array.isArray(data.materials) ? data.materials : [];
}
async function loadLearningLinks() {
    const [lkpdResponse, examResponse] = await Promise.all([
        fetch('/api/lkpds', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
        fetch('/api/exams', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    ]);
    return {
        lkpds: lkpdResponse.lkpdList || lkpdResponse.data || [],
        exams: examResponse.exams || examResponse.data || []
    };
}
async function postLearningProgress(payload) {
    const optimistic = {
        id: `local_${payload.materialId}_${Date.now()}`,
        materialId: payload.materialId,
        studentId: currentStudentId(),
        status: payload.status === 'completed' ? 'completed' : 'in_progress',
        progressPercent: payload.status === 'completed' ? 100 : Math.max(10, Number(payload.progressPercent || 10)),
        updatedAt: new Date().toISOString(),
        pendingSync: true
    };
    const state = learningState();
    state.learningProgress = (Array.isArray(state.learningProgress) ? state.learningProgress : [])
        .filter(row => !(String(row.materialId || '') === String(payload.materialId) && String(row.studentId || '') === currentStudentId()));
    state.learningProgress.push(optimistic);

    try {
        const response = await fetch('/api/learning/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || data.success === false) {
            const error = new Error(data.message || 'Progress belum tersimpan.');
            error.noOfflineQueue = response.status >= 400 && response.status < 500;
            throw error;
        }
        state.learningProgress = state.learningProgress
            .filter(row => !(String(row.materialId || '') === String(payload.materialId) && String(row.studentId || '') === currentStudentId()));
        state.learningProgress.push(data.progress);
        return data.progress;
    } catch (err) {
        if (err && err.noOfflineQueue) {
            state.learningProgress = state.learningProgress.filter(row => row.id !== optimistic.id);
            learningToast(err.message || 'Progress ditolak server.', 'error');
            return { rejected: true, message: err.message || 'Progress ditolak server.' };
        }
        queueLearningProgress(payload);
        return optimistic;
    }
}
function renderMaterialBlocks(blocks = []) {
    return blocks.map((block, index) => {
        const type = String(block.type || 'text').toLowerCase();
        const blockId = learningAttr(block.id || `block_${index + 1}`);
        if (type === 'text') {
            return `<div data-learning-block-id="${blockId}" class="whitespace-pre-wrap text-sm leading-7 text-slate-700">${learningEsc(block.content || block.text || '')}</div>`;
        }
        if (type === 'video' || type === 'link') {
            const url = String(block.url || '');
            if (!/^https?:\/\//i.test(url)) return '';
            return `<div data-learning-block-id="${blockId}"><a href="${learningAttr(url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"><i class="fa-solid fa-arrow-up-right-from-square"></i>${type === 'video' ? 'Buka Video' : 'Buka Sumber'}</a></div>`;
        }
        return '';
    }).join('');
}
function safeBlocksFromForm() {
    const blocks = [{ type: 'text', content: document.getElementById('learning-content')?.value || '' }];
    const videoUrl = document.getElementById('learning-video')?.value?.trim() || '';
    const resourceUrl = document.getElementById('learning-resource')?.value?.trim() || '';
    if (videoUrl) blocks.push({ type: 'video', url: videoUrl });
    if (resourceUrl) blocks.push({ type: 'link', url: resourceUrl });
    return blocks;
}

window.renderLearningTeacher = async function(container) {
    stopLearningTracker();
    if (!container) return;
    container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat materi...</div>';
    try {
        const [materials, links] = await Promise.all([loadLearningMaterials(), loadLearningLinks()]);
        window.__learningLinks = links;
        window.__learningMaterials = materials;
        const cards = materials.map(material => `
            <div class="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">${learningEsc(material.subjectName || material.subjectId || 'Materi')}</div>
                        <h3 class="font-black text-slate-800 mt-1">${learningEsc(material.title)}</h3>
                        <p class="text-xs text-slate-500 mt-1">${learningEsc(material.topic || '')}</p>
                    </div>
                    <span class="px-2 py-1 rounded-lg text-[10px] font-bold ${material.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}">${material.status === 'published' ? 'Terbit' : 'Draft'}</span>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="openLearningMaterial(${learningInlineArg(material.id)}, true)" class="px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold">Lihat</button>
                    <button type="button" onclick="showLearningEditorById(${learningInlineArg(material.id)})" class="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">Edit</button>
                    <button type="button" onclick="openLearningMonitor(${learningInlineArg(material.id)})" class="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold"><i class="fa-solid fa-chart-line mr-1"></i>Monitoring</button>
                    <button type="button" onclick="deleteLearningMaterial(${learningInlineArg(material.id)})" class="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold"><i class="fa-solid fa-trash-can mr-1"></i>Hapus</button>
                </div>
            </div>
        `).join('');
        container.innerHTML = `
            <div class="max-w-6xl mx-auto space-y-5 pb-10">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <h1 class="text-2xl font-black text-slate-900">Materi Pembelajaran</h1>
                        <p class="text-xs text-slate-500 mt-1">Materi dapat diteruskan ke LKPD dan/atau asesmen tanpa menggandakan engine.</p>
                    </div>
                    <button type="button" onclick="showLearningEditor()" class="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold"><i class="fa-solid fa-plus mr-1"></i>Buat Materi</button>
                </div>
                <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${cards || '<div class="col-span-full p-10 text-center bg-white rounded-2xl border text-slate-400 text-sm">Belum ada materi.</div>'}</div>
            </div>`;
    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-rose-600">${learningEsc(err.message || 'Gagal memuat materi.')}</div>`;
    }
};

window.showLearningEditorById = function(id) {
    const material = (window.__learningMaterials || []).find(item => String(item.id) === String(id));
    if (material) window.showLearningEditor(material);
};
window.showLearningEditor = async function(existing = null) {
    const state = learningState();
    const links = window.__learningLinks || await loadLearningLinks();
    const material = existing || {};
    const subjects = Array.isArray(state.subjects) ? state.subjects : [];
    const classes = Array.isArray(state.classes) ? state.classes : [];
    const classOpts = ['<option value="ALL">Semua Kelas</option>', ...classes.map(cls =>
        `<option value="${learningAttr(cls.id)}" ${String(material.classId || '') === String(cls.id) ? 'selected' : ''}>${learningEsc(cls.name || cls.code || cls.id)}</option>`
    )].join('');
    const subjectOpts = ['<option value="">Pilih Mapel</option>', ...subjects.map(subject =>
        `<option value="${learningAttr(subject.id)}" ${String(material.subjectId || '') === String(subject.id) ? 'selected' : ''}>${learningEsc(subject.name || subject.id)}</option>`
    )].join('');
    const lkpdOpts = ['<option value="">Tanpa LKPD</option>', ...links.lkpds.map(lkpd =>
        `<option value="${learningAttr(lkpd.id)}" ${String(material.lkpdId || '') === String(lkpd.id) ? 'selected' : ''}>${learningEsc(lkpd.title || lkpd.name || lkpd.id)}</option>`
    )].join('');
    const examOpts = ['<option value="">Tanpa Asesmen</option>', ...links.exams.filter(ex => ex.recordType !== 'EVENT').map(exam =>
        `<option value="${learningAttr(exam.id)}" ${String(material.examId || '') === String(exam.id) ? 'selected' : ''}>${learningEsc(exam.title || exam.name || exam.id)}</option>`
    )].join('');
    const textBlock = (material.blocks || []).find(block => block.type === 'text')?.content || material.content || '';
    const video = (material.blocks || []).find(block => block.type === 'video')?.url || '';
    const resource = (material.blocks || []).find(block => block.type === 'link')?.url || '';
    const policy = learningPolicy(material);
    document.body.insertAdjacentHTML('beforeend', `
        <div id="learning-editor-modal" class="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
            <div class="max-w-3xl mx-auto my-6 bg-white rounded-3xl p-6 shadow-2xl space-y-4">
                <div class="flex justify-between gap-3">
                    <div><h2 class="text-xl font-black">${material.id ? 'Edit' : 'Buat'} Materi</h2><p class="text-xs text-slate-500">Hubungkan materi dengan LKPD/asesmen yang sudah ada.</p></div>
                    <button type="button" onclick="document.getElementById('learning-editor-modal')?.remove()" class="w-9 h-9 rounded-xl bg-slate-100">x</button>
                </div>
                <input id="learning-id" type="hidden" value="${learningAttr(material.id || '')}">
                <div class="grid md:grid-cols-2 gap-3">
                    <label class="text-xs font-bold">Judul<input id="learning-title" value="${learningAttr(material.title || '')}" class="mt-1 w-full p-3 border rounded-xl font-normal"></label>
                    <label class="text-xs font-bold">Topik<input id="learning-topic" value="${learningAttr(material.topic || '')}" class="mt-1 w-full p-3 border rounded-xl font-normal"></label>
                    <label class="text-xs font-bold">Mapel<select id="learning-subject" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">${subjectOpts}</select></label>
                    <label class="text-xs font-bold">Kelas<select id="learning-class" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">${classOpts}</select></label>
                </div>
                <label class="text-xs font-bold block">Isi Materi<textarea id="learning-content" rows="10" class="mt-1 w-full p-3 border rounded-xl font-normal" placeholder="Tulis materi pembelajaran...">${learningEsc(textBlock)}</textarea></label>
                <div class="grid md:grid-cols-2 gap-3">
                    <label class="text-xs font-bold">Video/tautan video<input id="learning-video" value="${learningAttr(video)}" class="mt-1 w-full p-3 border rounded-xl font-normal" placeholder="https://..."></label>
                    <label class="text-xs font-bold">Sumber/PDF/link<input id="learning-resource" value="${learningAttr(resource)}" class="mt-1 w-full p-3 border rounded-xl font-normal" placeholder="https://..."></label>
                </div>
                <div class="p-4 rounded-2xl bg-slate-50">
                    <div class="font-bold text-sm mb-3">Aktivitas setelah materi</div>
                    <div class="grid md:grid-cols-2 gap-3">
                        <label class="text-xs font-bold">LKPD<select id="learning-lkpd" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">${lkpdOpts}</select></label>
                        <label class="text-xs font-bold">Asesmen/CBT<select id="learning-exam" class="mt-1 w-full p-3 border rounded-xl font-normal bg-white">${examOpts}</select></label>
                    </div>
                    <label class="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600"><input id="learning-require-complete" type="checkbox" ${material.requiresCompletionForLinks === false ? '' : 'checked'} class="rounded">Kunci LKPD/asesmen sampai materi ditandai selesai</label>
                </div>
                <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <div class="font-bold text-sm mb-3 text-emerald-900">Syarat materi dianggap dipelajari</div>
                    <div class="grid md:grid-cols-2 gap-3">
                        <label class="text-xs font-bold text-emerald-900">Minimal baca aktif, detik<input id="learning-min-active-seconds" type="number" min="0" max="3600" step="5" value="${learningAttr(policy.minActiveSeconds)}" class="mt-1 w-full p-3 border border-emerald-100 rounded-xl font-normal bg-white"></label>
                        <label class="mt-7 flex items-center gap-2 text-xs font-bold text-emerald-900"><input id="learning-require-all-blocks" type="checkbox" ${policy.requireAllBlocks ? 'checked' : ''} class="rounded">Wajib semua bagian materi terlihat</label>
                    </div>
                </div>
                <div class="flex justify-end gap-2">
                    <button type="button" onclick="saveLearningMaterial('draft')" class="px-4 py-2.5 bg-slate-100 rounded-xl text-xs font-bold">Simpan Draft</button>
                    <button type="button" onclick="saveLearningMaterial('published')" class="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">Publikasikan</button>
                </div>
            </div>
        </div>`);
};
window.saveLearningMaterial = async function(status) {
    const id = document.getElementById('learning-id')?.value || '';
    const subjectId = document.getElementById('learning-subject')?.value || '';
    const subjectName = (learningState().subjects || []).find(subject => String(subject.id) === String(subjectId))?.name || '';
    const classId = document.getElementById('learning-class')?.value || 'ALL';
    const payload = {
        id,
        title: document.getElementById('learning-title')?.value?.trim() || '',
        topic: document.getElementById('learning-topic')?.value?.trim() || '',
        subjectId,
        subjectName,
        classId,
        classes: classId ? [classId] : [],
        blocks: safeBlocksFromForm(),
        lkpdId: document.getElementById('learning-lkpd')?.value || '',
        examId: document.getElementById('learning-exam')?.value || '',
        requiresCompletionForLinks: document.getElementById('learning-require-complete')?.checked !== false,
        engagementPolicy: {
            minActiveSeconds: Math.max(0, Math.min(3600, Number(document.getElementById('learning-min-active-seconds')?.value || 0) || 0)),
            requireAllBlocks: document.getElementById('learning-require-all-blocks')?.checked !== false
        },
        status
    };
    if (!payload.title) return learningToast('Judul materi wajib diisi.', 'warning');
    try {
        const response = await fetch('/api/learning/materials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.message || 'Gagal menyimpan materi.');
        document.getElementById('learning-editor-modal')?.remove();
        learningToast(status === 'published' ? 'Materi dipublikasikan.' : 'Draft materi disimpan.', 'success');
        window.renderLearningTeacher(document.getElementById('view-container'));
    } catch (err) {
        learningToast(err.message || 'Gagal menyimpan materi.', 'error');
    }
};
window.deleteLearningMaterial = async function(id) {
    if (!confirm('Hapus materi ini? Progress siswa untuk materi ini juga akan dihapus.')) return;
    try {
        const response = await fetch('/api/learning/materials/' + encodeURIComponent(id), { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.message || 'Gagal menghapus materi.');
        learningToast('Materi dihapus.', 'success');
        window.renderLearningTeacher(document.getElementById('view-container'));
    } catch (err) {
        learningToast(err.message || 'Gagal menghapus materi.', 'error');
    }
};

window.renderLearningStudent = async function(container) {
    stopLearningTracker();
    if (!container) return;
    if (!featureEnabled('learning')) {
        learningToast('Menu Belajar sedang dinonaktifkan.', 'info');
        return;
    }
    container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat pembelajaran...</div>';
    await flushLearningProgressQueue();
    try {
        const materials = await loadLearningMaterials();
        window.__learningMaterials = materials;
        const cards = materials.map(material => {
            const progress = material.progress || progressForMaterial(material.id) || {};
            const completed = progress.status === 'completed' || Number(progress.progressPercent || 0) >= 100;
            const locked = material.locked === true || materialLocked(material);
            return `
                <button type="button" onclick="openLearningMaterial(${learningInlineArg(material.id)})" class="text-left bg-white p-5 rounded-2xl border ${locked ? 'border-slate-100 opacity-75' : 'border-slate-100 hover:border-emerald-200'} shadow-sm transition">
                    <div class="flex justify-between gap-3">
                        <div class="text-[10px] font-bold uppercase text-emerald-600">${learningEsc(material.subjectName || material.subjectId || 'Materi')}</div>
                        <span class="text-[10px] font-bold ${completed ? 'text-emerald-700' : locked ? 'text-slate-400' : 'text-amber-600'}">${completed ? 'Selesai' : locked ? 'Terkunci' : 'Belum selesai'}</span>
                    </div>
                    <div class="font-black text-slate-800 mt-1">${learningEsc(material.title)}</div>
                    <div class="text-xs text-slate-500 mt-1">${learningEsc(material.topic || '')}</div>
                    <div class="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-emerald-500" style="width:${Math.max(0, Math.min(100, Number(progress.progressPercent || 0)))}%"></div></div>
                </button>`;
        }).join('');
        container.innerHTML = `
            <div class="max-w-5xl mx-auto space-y-5 pb-10">
                <div><h1 class="text-2xl font-black text-slate-900">Belajar</h1><p class="text-xs text-slate-500 mt-1">Pelajari materi, lanjutkan LKPD, lalu asesmen sesuai arahan guru.</p></div>
                <div class="grid md:grid-cols-2 gap-4">${cards || '<div class="col-span-full p-10 text-center bg-white rounded-2xl border text-slate-400 text-sm">Belum ada materi yang dipublikasikan untuk kelasmu.</div>'}</div>
            </div>`;
    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-rose-600">${learningEsc(err.message || 'Gagal memuat materi.')}</div>`;
    }
};
window.openLearningMaterial = async function(id, staffPreview = false) {
    stopLearningTracker();
    let material = (window.__learningMaterials || []).find(item => String(item.id) === String(id));
    if (!material) material = (await loadLearningMaterials()).find(item => String(item.id) === String(id));
    if (!material) return learningToast('Materi tidak ditemukan.', 'error');
    if (!staffPreview && materialLocked(material)) return learningToast('Selesaikan materi prasyarat terlebih dahulu.', 'info');
    const container = document.getElementById('view-container');
    if (!container) return;
    if (!staffPreview) await postLearningProgress({ materialId: material.id, status: 'viewed', progressPercent: Math.max(10, Number(progressForMaterial(material.id)?.progressPercent || 0)) });
    const completed = staffPreview ? false : isCompleted(material.id);
    const policy = learningPolicy(material);
    container.innerHTML = `
        <div class="max-w-3xl mx-auto pb-12">
            <button type="button" onclick="navigateTo('${staffPreview ? 'learning_teacher' : 'learning_student'}')" class="text-xs font-bold text-slate-500 mb-4"><i class="fa-solid fa-arrow-left mr-1"></i>Kembali</button>
            <article class="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <div class="text-xs font-bold uppercase text-emerald-600">${learningEsc(material.subjectName || material.subjectId || 'Materi')}</div>
                <h1 class="text-2xl font-black text-slate-900 mt-1">${learningEsc(material.title)}</h1>
                <p class="text-sm text-slate-500 mt-1">${learningEsc(material.topic || '')}</p>
                <div class="mt-7 space-y-5">${renderMaterialBlocks(material.blocks || [])}</div>
                ${!staffPreview ? `<div class="mt-8 pt-6 border-t">
                    ${!completed ? `<div id="learning-engagement-status" class="mb-3 text-center text-xs font-bold text-slate-500">Aktif membaca 0/${policy.minActiveSeconds} detik${policy.requireAllBlocks ? ' • bagian terlihat 0/' + Math.max(1, materialBlockIds(material).length) : ''}</div>` : ''}
                    <button id="learning-complete-button" type="button" onclick="completeLearningMaterial(${learningInlineArg(material.id)})" class="w-full py-3 rounded-2xl ${completed ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-600 text-white'} font-black text-sm">${completed ? 'Materi telah dipelajari' : 'Saya Sudah Mempelajari Materi'}</button>
                    <div id="learning-next-actions" class="mt-3">${completed ? learningNextActions(material) : ''}</div>
                </div>` : ''}
            </article>
        </div>`;
    if (!staffPreview && !completed) startLearningTracker(material);
};
window.completeLearningMaterial = async function(id) {
    const material = (window.__learningMaterials || []).find(item => String(item.id) === String(id));
    if (!material) return;
    const ready = engagementReady(material);
    if (!ready.ready) return learningToast(ready.message || 'Selesaikan syarat baca materi terlebih dahulu.', 'info');
    const progress = await postLearningProgress(learningCompletionPayload(material));
    if (progress?.rejected) return;
    stopLearningTracker();
    const actionContainer = document.getElementById('learning-next-actions');
    if (actionContainer) actionContainer.innerHTML = learningNextActions(material);
    const button = document.getElementById('learning-complete-button');
    if (button) {
        button.disabled = false;
        button.classList.remove('opacity-60', 'cursor-not-allowed');
        button.classList.add('bg-emerald-50', 'text-emerald-700');
        button.textContent = 'Materi telah dipelajari';
    }
    learningToast(progress?.pendingSync ? 'Progress disimpan sementara dan akan disinkronkan saat online.' : 'Materi ditandai selesai.', 'success');
};
function learningNextActions(material) {
    if (material.requiresCompletionForLinks !== false && !isCompleted(material.id)) {
        return '<div class="text-center text-xs text-slate-500 font-bold py-3">Tandai materi selesai untuk membuka aktivitas lanjutan.</div>';
    }
    const actions = [];
    if (material.lkpdId) actions.push(`<button type="button" onclick="openLinkedLearningLkpd(${learningInlineArg(material.lkpdId)})" class="w-full mt-2 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm"><i class="fa-solid fa-clipboard-list mr-2"></i>Lanjut Kerjakan LKPD</button>`);
    if (material.examId) actions.push(`<button type="button" onclick="openLinkedLearningExam(${learningInlineArg(material.examId)})" class="w-full mt-2 py-3 rounded-2xl bg-violet-600 text-white font-bold text-sm"><i class="fa-solid fa-file-circle-check mr-2"></i>Lanjut ke Asesmen</button>`);
    return actions.join('') || '<div class="text-center text-xs text-emerald-700 font-bold py-3">Pembelajaran selesai</div>';
}
window.openLinkedLearningLkpd = async function(lkpdId) {
    if (!featureEnabled('cbt')) return learningToast('Menu CBT/LKPD sedang dinonaktifkan.', 'info');
    if (!Array.isArray(learningState().lkpdList) || !learningState().lkpdList.some(item => String(item.id) === String(lkpdId))) {
        const data = await fetch('/api/lkpds').then(r => r.json()).catch(() => ({}));
        if (data.lkpdList) learningState().lkpdList = data.lkpdList;
    }
    if (typeof window.openStudentLkpdWorksheetModal === 'function') window.openStudentLkpdWorksheetModal(lkpdId, currentStudentId());
    else window.navigateTo('asesmen_siswa');
};
window.openLinkedLearningExam = async function(examId) {
    if (!featureEnabled('cbt')) return learningToast('Menu CBT sedang dinonaktifkan.', 'info');
    if (!Array.isArray(learningState().exams) || !learningState().exams.some(item => String(item.id) === String(examId))) {
        const data = await fetch('/api/exams').then(r => r.json()).catch(() => ({}));
        if (data.exams) learningState().exams = data.exams;
    }
    if (typeof window.confirmStartStudentExam === 'function') window.confirmStartStudentExam(examId);
    else if (typeof window.startStudentExam === 'function') window.startStudentExam(examId);
    else window.navigateTo('asesmen_siswa');
};
window.openLearningMonitor = async function(id) {
    const container = document.getElementById('view-container');
    const material = (window.__learningMaterials || []).find(item => String(item.id) === String(id));
    if (!container || !material) return;
    container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Memuat monitoring...</div>';
    try {
        const data = await fetch('/api/learning/progress?materialId=' + encodeURIComponent(id), { cache: 'no-store' }).then(r => r.json());
        if (data.success === false) throw new Error(data.message || 'Gagal memuat monitoring.');
        const rows = data.rows || [];
        container.innerHTML = `
            <div class="max-w-6xl mx-auto space-y-5 pb-10">
                <button type="button" onclick="navigateTo('learning_teacher')" class="text-xs font-bold text-slate-500"><i class="fa-solid fa-arrow-left mr-1"></i>Kembali</button>
                <div class="bg-white rounded-3xl border p-6">
                    <h1 class="text-xl font-black">Monitoring ${learningEsc(material.title)}</h1>
                    <div class="grid sm:grid-cols-3 gap-3 mt-5">
                        <div class="p-4 rounded-2xl bg-slate-50"><div class="text-xs text-slate-500">Siswa Target</div><div class="text-2xl font-black">${rows.length}</div></div>
                        <div class="p-4 rounded-2xl bg-emerald-50"><div class="text-xs text-emerald-700">Selesai</div><div class="text-2xl font-black text-emerald-800">${rows.filter(row => row.status === 'completed' || Number(row.progressPercent || 0) >= 100).length}</div></div>
                        <div class="p-4 rounded-2xl bg-amber-50"><div class="text-xs text-amber-700">Belum Selesai</div><div class="text-2xl font-black text-amber-800">${rows.filter(row => row.status !== 'completed' && Number(row.progressPercent || 0) < 100).length}</div></div>
                    </div>
                    <div class="mt-5 overflow-x-auto border rounded-2xl">
                        <table class="w-full text-xs">
                            <thead class="bg-slate-50 text-slate-500 uppercase"><tr><th class="p-3 text-left">Siswa</th><th class="p-3 text-left">NIS</th><th class="p-3 text-left">Status</th><th class="p-3 text-left">Progress</th><th class="p-3 text-left">Baca Aktif</th><th class="p-3 text-left">Bagian</th><th class="p-3 text-left">Update</th></tr></thead>
                            <tbody>${rows.map(row => `<tr class="border-t"><td class="p-3 font-bold text-slate-800">${learningEsc(row.studentName)}</td><td class="p-3 text-slate-500">${learningEsc(row.nis || '-')}</td><td class="p-3">${learningEsc(row.status)}</td><td class="p-3">${Number(row.progressPercent || 0)}%</td><td class="p-3">${Math.floor(Number(row.activeSeconds || 0))} detik</td><td class="p-3">${Number(row.viewedBlockCount || 0)}</td><td class="p-3 text-slate-500">${learningEsc(row.updatedAt || '-')}</td></tr>`).join('') || '<tr><td colspan="7" class="p-8 text-center text-slate-400">Belum ada siswa target.</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    } catch (err) {
        container.innerHTML = `<div class="p-8 text-center text-rose-600">${learningEsc(err.message || 'Gagal memuat monitoring.')}</div>`;
    }
};

function injectLearningMenus() {
    const role = learningRole();
    const sidebar = document.getElementById('sidebar-menu') || document.querySelector('aside nav') || document.querySelector('#sidebar nav');
    if (!sidebar || sidebar.querySelector('[data-learning-menu]')) return;
    if (STUDENT_ROLES.has(role) && featureEnabled('learning')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.learningMenu = '1';
        btn.className = 'w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left';
        btn.innerHTML = '<i class="fa-solid fa-book-open-reader w-5 text-blue-400"></i><span>Belajar</span>';
        btn.onclick = () => window.navigateTo('learning_student');
        const cbtButton = Array.from(sidebar.querySelectorAll('button')).find(button => /CBT|Ujian/i.test(button.textContent || ''));
        sidebar.insertBefore(btn, cbtButton || sidebar.firstChild?.nextSibling || null);
    } else if (STAFF_ROLES.has(role)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.learningMenu = '1';
        btn.className = 'w-full flex items-center space-x-3 px-3.5 py-3 rounded-2xl hover:bg-slate-800 transition text-left';
        btn.innerHTML = '<i class="fa-solid fa-book-open w-5 text-emerald-400"></i><span>Materi Pembelajaran</span>';
        btn.onclick = () => window.navigateTo('learning_teacher');
        const modulButton = Array.from(sidebar.querySelectorAll('button')).find(button => /Modul Ajar/i.test(button.textContent || ''));
        sidebar.insertBefore(btn, modulButton || null);
    }
}

const originalNavigateTo = window.navigateTo;
if (typeof originalNavigateTo === 'function' && !window.__learningNavigateWrapped) {
    window.__learningNavigateWrapped = true;
    window.navigateTo = function(route, ...args) {
        const routeText = String(route || '');
        if (routeText === 'learning_student') return window.renderLearningStudent(document.getElementById('view-container'));
        if (routeText === 'learning_teacher') return window.renderLearningTeacher(document.getElementById('view-container'));
        if (STUDENT_ROLES.has(learningRole())) {
            if ((/game/i.test(routeText) && !featureEnabled('games')) ||
                (/cbt|asesmen|lkpd/i.test(routeText) && !featureEnabled('cbt')) ||
                (/absen/i.test(routeText) && !featureEnabled('attendance'))) {
                learningToast('Menu ini sedang dinonaktifkan oleh administrator.', 'info');
                return;
            }
        }
        const result = originalNavigateTo.call(this, route, ...args);
        setTimeout(injectLearningMenus, 0);
        return result;
    };
}

window.setStudentFeatureVisibility = async function(feature, enabled) {
    if (!['attendance', 'learning', 'cbt', 'games'].includes(feature)) return;
    const state = learningState();
    state.settings = state.settings || {};
    state.settings.studentFeatures = { ...(state.settings.studentFeatures || {}), [feature]: Boolean(enabled) };
    if (feature === 'learning') state.settings.learningModuleEnabled = Boolean(enabled);
    if (feature === 'games') state.settings.gameModuleEnabled = Boolean(enabled);
    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: state.settings })
        });
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.message || 'Gagal menyimpan pengaturan.');
        if (data.settings) state.settings = data.settings;
        learningToast('Pengaturan menu siswa disimpan.', 'success');
    } catch (err) {
        learningToast(err.message || 'Gagal menyimpan pengaturan.', 'error');
    }
};

window.addEventListener('online', flushLearningProgressQueue);
setTimeout(() => { flushLearningProgressQueue(); injectLearningMenus(); }, 0);
