// ============================================================================
// MODUL GAME EDUKASI (EDUCATIONAL GAMES & GAMIFICATION ENGINE)
// CBT MADRASAH TERPADU - ALL 15 GAME MODES, XP, LEVEL, STREAK & LEADERBOARD
// ============================================================================

const appState = window.appState || {};
const safeSetLocalStorage = window.safeSetLocalStorage || function(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch(e){} };
const showToast = window.showToast || function(m, t) { console.log(m); };

function gameEscapeHtml(value) {
    if (window.escapeHtml) return window.escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

function gameEscapeAttr(value) {
    return gameEscapeHtml(value);
}

function gameEncodedArg(value) {
    return encodeURIComponent(String(value ?? ''));
}

function gameSafeImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(raw)) return raw;
    if (/^\/api\/photos\/[A-Za-z0-9._-]+$/.test(raw)) return raw;
    try {
        const url = new URL(raw, window.location.origin);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
        return url.href.replace(/['"()\\]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
    } catch (_) {
        return '';
    }
}

// --- CONFIRMATION MODAL POPUP HELPER ---
export function showGameConfirmModal({ title, message, confirmText = 'Ya, Hapus', cancelText = 'Batal', isDanger = true, onConfirm }) {
    const modalHtml = `
        <div id="game-confirm-modal-bg" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-sm w-full overflow-hidden text-center p-6 space-y-4 my-8">
                <div class="w-16 h-16 ${isDanger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'} rounded-3xl flex items-center justify-center text-2xl mx-auto shadow-inner">
                    <i class="fa-solid ${isDanger ? 'fa-trash-can' : 'fa-triangle-exclamation'}"></i>
                </div>
                <div>
                    <h3 class="text-lg font-black text-slate-900">${gameEscapeHtml(title || 'Konfirmasi Tindakan')}</h3>
                    <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">${gameEscapeHtml(message || 'Apakah Anda yakin ingin melanjutkan tindakan ini? Data yang dihapus tidak dapat dipulihkan.')}</p>
                </div>
                <div class="grid grid-cols-2 gap-2.5 pt-2">
                    <button type="button" id="game-confirm-cancel-btn" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer">
                        ${gameEscapeHtml(cancelText)}
                    </button>
                    <button type="button" id="game-confirm-ok-btn" class="w-full py-2.5 ${isDanger ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-slate-950'} font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer">
                        ${gameEscapeHtml(confirmText)}
                    </button>
                </div>
            </div>
        </div>
    `;

    const old = document.getElementById('game-confirm-modal-bg');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const bg = document.getElementById('game-confirm-modal-bg');
    const cancelBtn = document.getElementById('game-confirm-cancel-btn');
    const okBtn = document.getElementById('game-confirm-ok-btn');

    if (cancelBtn) cancelBtn.onclick = () => bg?.remove();
    if (okBtn) {
        okBtn.onclick = async () => {
            bg?.remove();
            if (typeof onConfirm === 'function') {
                await onConfirm();
            }
        };
    }
}
window.showGameConfirmModal = showGameConfirmModal;

// Master visibility toggle for student dashboard/sidebar
window.toggleGameModuleVisibilityMaster = async function(isEnabled) {
    if (!appState.settings) appState.settings = {};
    appState.settings.gameModuleEnabled = isEnabled;
    try {
        localStorage.setItem('madrasah_settings', JSON.stringify(appState.settings));
        await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: appState.settings })
        });
    } catch(err) {
        console.warn('Failed to save gameModuleEnabled setting to server:', err);
    }
    
    if (typeof window.buildSidebar === 'function') {
        window.buildSidebar();
    }
    
    showToast(
        isEnabled 
            ? '✓ Menu Game Edukasi DIAKTIFKAN di dashboard & navigasi siswa.' 
            : '✓ Menu Game Edukasi DINONAKTIFKAN dari dashboard & navigasi siswa.',
        isEnabled ? 'success' : 'info'
    );
    renderGameAdminModule(document.getElementById('view-container'));
};

// --- GAMIFICATION HELPERS ---
export function calculateLevel(xp) {
    const safeXp = Math.max(0, parseInt(xp, 10) || 0);
    return Math.floor(safeXp / 250) + 1;
}

export function getXpProgress(xp) {
    const safeXp = Math.max(0, parseInt(xp, 10) || 0);
    const currentLevel = calculateLevel(safeXp);
    const currentLevelBaseXp = (currentLevel - 1) * 250;
    const nextLevelXp = currentLevel * 250;
    const currentLevelXp = safeXp - currentLevelBaseXp;
    const neededXp = 250;
    const percentage = Math.min(100, Math.round((currentLevelXp / neededXp) * 100));
    return {
        level: currentLevel,
        currentXp: currentLevelXp,
        neededXp,
        totalXp: safeXp,
        nextLevelTotalXp: nextLevelXp,
        percentage
    };
}

// 15 Game Mode Labels & Descriptions
export const GAME_TYPES = [
    { id: 'tebak_gambar', name: 'Tebak Gambar', icon: 'fa-image', color: 'emerald', desc: 'Lihat gambar & tebak nama atau fungsinya' },
    { id: 'tebak_kata', name: 'Tebak Kata', icon: 'fa-font', color: 'blue', desc: 'Isi petunjuk menggunakan kotak-kotak huruf' },
    { id: 'crossword', name: 'Teka-Teki Silang', icon: 'fa-puzzle-piece', color: 'indigo', desc: 'Kata mendatar & menurun saling bersilangan' },
    { id: 'susun_kata', name: 'Susun Kata', icon: 'fa-arrow-down-short-wide', color: 'violet', desc: 'Susun huruf yang diacak menjadi kata benar' },
    { id: 'word_search', name: 'Cari Kata', icon: 'fa-magnifying-glass', color: 'purple', desc: 'Cari istilah tersembunyi secara mendatar, menurun, atau diagonal' },
    { id: 'memory_match', name: 'Memory Match', icon: 'fa-brain', color: 'pink', desc: 'Cocokkan istilah dengan definisi' },
    { id: 'labirin', name: 'Labirin Benang Kusut', icon: 'fa-route', color: 'amber', desc: 'Susuri benang kusut dari item atas ke pasangan jawaban bawah' },
    { id: 'image_puzzle', name: 'Puzzle Gambar', icon: 'fa-border-all', color: 'lime', desc: 'Susun kembali 9 potongan gambar (3x3 grid) yang diacak' },
    { id: 'spot_difference', name: 'Cari Perbedaan', icon: 'fa-eye', color: 'rose', desc: 'Temukan titik perbedaan pada dua gambar' },
    { id: 'true_false', name: 'Benar atau Salah', icon: 'fa-circle-half-stroke', color: 'sky', desc: 'Tentukan apakah pernyataan benar atau salah' }
];

// Default Sample Seed Games if empty
export const SAMPLE_SEED_GAMES = [
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
        prompt: 'Lengkapi Teka-Teki Silang berikut mengenai komponen komputer. Perhatikan kolom mendatar dan menurun!',
        crosswordData: {
            gridSize: { rows: 8, cols: 8 },
            clues: [
                { number: 1, direction: 'across', row: 1, col: 1, clue: 'Otak pemroses utama pada komputer (3 Huruf)', answer: 'CPU', points: 30, initialHint: true },
                { number: 2, direction: 'down', row: 1, col: 1, clue: 'Perangkat keras pengolah data utama (8 Huruf)', answer: 'COMPUTER', points: 50, initialHint: true },
                { number: 3, direction: 'across', row: 3, col: 1, clue: 'Modulasi sinyal jaringan internet (5 Huruf)', answer: 'MODEM', points: 30, initialHint: true },
                { number: 4, direction: 'across', row: 4, col: 1, clue: 'Perangkat pencetak dokumen kertas (7 Huruf)', answer: 'PRINTER', points: 40, initialHint: true }
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

// Default Sample Seed Game Modes (Adventure & Tower)
export const SAMPLE_SEED_GAME_MODES = [
    {
        id: 'MODE_SEED_1',
        title: 'Petualangan Peta Harta Karun TIK',
        modeType: 'adventure',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        description: 'Jelajahi lokasi peta petualangan dari lokasi awal hingga menemukan peti harta karun TIK!',
        status: 'active',
        locations: [
            { id: 'loc_1', name: 'Pulau Pemula Komputer', gameId: 'GAME_SEED_1', icon: 'fa-island-tropical', desc: 'Selesaikan tebak perangkat komputer untuk membuka jalur petualangan.', x: 18, y: 78 },
            { id: 'loc_2', name: 'Hutan Kosakata TIK', gameId: 'GAME_SEED_3', icon: 'fa-tree', desc: 'Cari kata istilah hardware dalam hutan rimba.', x: 34, y: 48 },
            { id: 'loc_3', name: 'Gurun Teka-Teki Silang', gameId: 'GAME_SEED_2', icon: 'fa-mountain', desc: 'Pecahkan teka-teki silang komputer di gurun pasir.', x: 74, y: 30 },
            { id: 'loc_4', name: 'Peti Harta Karun AI & Siber', gameId: 'GAME_SEED_4', icon: 'fa-vault', desc: 'Buka peti harta karun dengan menyelesaikan game memory match!', x: 50, y: 62 }
        ]
    },
    {
        id: 'MODE_SEED_2',
        title: 'Quest Menara TIK & Siber',
        modeType: 'tower',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        description: 'Panjat menara dari lantai paling bawah hingga puncak master TIK secara berurutan!',
        status: 'active',
        floors: [
            { id: 'flr_1', floorNumber: 1, name: 'Lantai 1: Perangkat Keras', gameId: 'GAME_SEED_1', desc: 'Uji pemahaman hardware dasar di pintu gerbang menara.' },
            { id: 'flr_2', floorNumber: 2, name: 'Lantai 2: Keamanan Siber', gameId: 'GAME_SEED_5', desc: 'Kuasai prinsip keamanan password di lantai 2.' },
            { id: 'flr_3', floorNumber: 3, name: 'Lantai 3: Kosakata TIK', gameId: 'GAME_SEED_3', desc: 'Temukan kata tersembunyi untuk naik ke lantai berikutnya.' },
            { id: 'flr_4', floorNumber: 4, name: 'Puncak Menara: Teka-Teki Silang', gameId: 'GAME_SEED_2', desc: 'Selesaikan teka-teki puncak menara untuk meraih gelar Master Menara!' }
        ]
    }
];

export function getActiveStudentId() {
    const currUser = appState.currentUser || {};
    return String(currUser.id || currUser.nisn || currUser.username || currUser.nis || 'default_student');
}

export function getStudentProgressForMode(modeId) {
    if (!appState.studentGameProgress) {
        try {
            appState.studentGameProgress = JSON.parse(localStorage.getItem('madrasah_student_game_progress')) || {};
        } catch(e) {
            appState.studentGameProgress = {};
        }
    }
    const studentId = getActiveStudentId();
    if (!appState.studentGameProgress[studentId]) {
        appState.studentGameProgress[studentId] = {};
    }
    if (!appState.studentGameProgress[studentId][modeId]) {
        appState.studentGameProgress[studentId][modeId] = { completedLocations: [], completedFloors: [], completedCatalogGames: [] };
    }
    return appState.studentGameProgress[studentId][modeId];
}

export function getGameModes() {
    if (!Array.isArray(appState.gameModes) || appState.gameModes.length === 0) {
        appState.gameModes = [...SAMPLE_SEED_GAME_MODES];
    }
    if (!appState.studentGameProgress) {
        try {
            appState.studentGameProgress = JSON.parse(localStorage.getItem('madrasah_student_game_progress')) || {};
        } catch(e) {
            appState.studentGameProgress = {};
        }
    }
    return appState.gameModes;
}

export async function saveGameModesToBackend() {
    try {
        await fetch('/api/sync-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'gameModes', data: appState.gameModes })
        });
    } catch (e) {
        console.warn("Sync gameModes failed, stored locally", e);
    }
}

// State for active played game session
let activeGameSession = null;
let activeGameTimer = null;

// ============================================================================
// ADMIN & GURU VIEW: RENDER GAME MANAGEMENT
// ============================================================================
window.toggleGameVisibilityForStudent = async function(isActive) {
    if (!appState.settings) appState.settings = {};
    appState.settings.isGameMenuVisibleForStudent = isActive;
    
    try {
        if (typeof window.saveSettingsToServer === 'function') {
            await window.saveSettingsToServer();
        } else {
            await fetch('/api/sync-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'settings', data: appState.settings })
            });
        }
        showToast(`Menu Game Edukasi kini ${isActive ? 'Aktif' : 'Nonaktif'} di akun siswa.`, isActive ? 'success' : 'info');
    } catch (e) {
        console.warn("Gagal simpan status visibilitas game:", e);
    }
};

export function renderGameAdminModule(container) {
    if (!container) return;

    const activeSubTab = window.__adminGameSubTab || 'kelola';

    if (!appState.gameMonitoringClassId) appState.gameMonitoringClassId = 'all';
    if (!appState.gameMonitoringGameId) appState.gameMonitoringGameId = 'all';
    if (!appState.gameMonitoringStatus) appState.gameMonitoringStatus = 'all';
    if (!appState.gameMonitoringSearch) appState.gameMonitoringSearch = '';
    if (!appState.gameMonitoringLivecamMode) appState.gameMonitoringLivecamMode = 'gambar';
    if (!appState.gameMonitoringStudentModes) appState.gameMonitoringStudentModes = {};

    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = games;
    }

    const modes = getGameModes();

    const subjects = Array.isArray(appState.subjects) ? appState.subjects : [];
    const classes = Array.isArray(appState.classes) ? appState.classes : [];

    const activeFilterType = window.__gameFilterType || 'all';
    const activeFilterSubject = window.__gameFilterSubject || 'all';

    const filteredGames = games.filter(g => {
        if (activeFilterType !== 'all' && g.gameType !== activeFilterType) return false;
        if (activeFilterSubject !== 'all' && g.subjectId !== activeFilterSubject) return false;
        return true;
    });

    const totalActive = games.filter(g => g.status === 'active').length;
    const attempts = Array.isArray(appState.gameAttempts) ? appState.gameAttempts : [];
    const totalAttempts = attempts.length;
    const isGameModuleEnabled = appState.settings?.gameModuleEnabled !== false;

    if (activeSubTab === 'monitoring') {
        container.innerHTML = `
            <div class="space-y-6 pb-12 animate-fade-in">
                <!-- Sub-tab Navigation Header -->
                <div class="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
                    <button type="button" onclick="window.__adminGameSubTab = 'kelola'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm">
                        <i class="fa-solid fa-gamepad text-sm"></i>
                        <span>Kelola Game & Mode</span>
                    </button>
                    <button type="button" onclick="window.__adminGameSubTab = 'monitoring'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-purple-600 text-white shadow-md">
                        <i class="fa-solid fa-desktop text-sm"></i>
                        <span>Dashboard Monitoring Game</span>
                        <span class="px-2 py-0.5 bg-emerald-500 text-white font-extrabold text-[9px] rounded-full animate-pulse ml-1">LIVE</span>
                    </button>
                </div>

                <!-- Dedicated Monitoring Banner -->
                <div class="bg-slate-950 border border-slate-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-600/30">
                            <i class="fa-solid fa-gamepad"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="font-extrabold text-lg sm:text-xl text-white">Dashboard Live Monitoring Game Edukasi</h2>
                                <span class="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                                    LIVE AKTIF
                                </span>
                            </div>
                            <p class="text-xs text-slate-400">Pantau login aplikasi, aktivitas permainan, perolehan XP, dan foto/kamera live peserta secara terpisah.</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                        <button type="button" onclick="openBroadcastGameMessageModal()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid fa-bullhorn"></i>
                            <span>Kirim Siaran (Broadcast)</span>
                        </button>
                        <button type="button" onclick="toggleGameMonitoringLivecamMode()" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-extrabold border border-slate-700 shadow transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid ${appState.gameMonitoringLivecamMode === 'video' ? 'fa-video text-amber-400' : 'fa-image text-indigo-400'}"></i>
                            <span>Mode: ${appState.gameMonitoringLivecamMode === 'video' ? 'Video Live' : 'Foto Absen'}</span>
                        </button>
                        <button type="button" onclick="refreshGameMonitoringData()" class="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm transition cursor-pointer border border-slate-700" title="Refresh Data">
                            <i class="fa-solid fa-arrows-rotate"></i>
                        </button>
                    </div>
                </div>

                <!-- Main Monitoring Body -->
                <div class="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-5" id="game-monitoring-content">
                    <div class="p-8 text-center text-slate-400 font-bold">
                        <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-indigo-400 block"></i>
                        Menyiapkan dashboard monitoring game...
                    </div>
                </div>
            </div>
        `;

        renderGameMonitoringDashboard();

        // Start auto polling interval
        if (gameMonitoringPollTimer) clearInterval(gameMonitoringPollTimer);
        gameMonitoringPollTimer = setInterval(() => {
            refreshGameMonitoringData(false);
        }, 2500);
        return;
    }

    if (gameMonitoringPollTimer) {
        clearInterval(gameMonitoringPollTimer);
        gameMonitoringPollTimer = null;
    }

    container.innerHTML = `
        <div class="space-y-6 pb-12 animate-fade-in">
            <!-- Sub-tab Navigation Header -->
            <div class="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
                <button type="button" onclick="window.__adminGameSubTab = 'kelola'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-slate-900 text-white shadow-md">
                    <i class="fa-solid fa-gamepad text-sm"></i>
                    <span>Kelola Game & Mode</span>
                </button>
                <button type="button" onclick="window.__adminGameSubTab = 'monitoring'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm">
                    <i class="fa-solid fa-desktop text-sm"></i>
                    <span>Dashboard Monitoring Game</span>
                    <span class="px-2 py-0.5 bg-emerald-500 text-white font-extrabold text-[9px] rounded-full animate-pulse ml-1">LIVE</span>
                </button>
            </div>

            <!-- Header Banner -->
            <div class="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                <div class="absolute -right-10 -bottom-10 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div class="space-y-2">
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="text-xs font-bold tracking-widest text-emerald-200 uppercase bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-500/30 inline-flex items-center gap-1.5">
                                <i class="fa-solid fa-gamepad"></i> Modul Pembelajaran Interaktif
                            </span>
                            
                            <!-- Master Toggle Switch: Tampilkan di Siswa -->
                            <label class="inline-flex items-center gap-2 cursor-pointer bg-emerald-950/80 hover:bg-emerald-950 px-3 py-1 rounded-full border border-emerald-400/40 transition select-none shadow-sm" title="Saklar On/Off: Aktifkan untuk memunculkan menu Game Edukasi pada dashboard & navigasi siswa">
                                <span class="text-[11px] font-bold ${isGameModuleEnabled ? 'text-emerald-300' : 'text-slate-300'}">
                                    ${isGameModuleEnabled ? '🟢 Menu Siswa Aktif' : '⚪ Menu Siswa Nonaktif'}
                                </span>
                                <div class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" onchange="toggleGameModuleVisibilityMaster(this.checked)" class="sr-only peer" ${isGameModuleEnabled ? 'checked' : ''}>
                                    <div class="w-8 h-4.5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-400"></div>
                                </div>
                            </label>
                        </div>
                        <h1 class="text-2xl sm:text-3xl font-black tracking-tight">Manajemen Game Edukasi</h1>
                        <p class="text-xs sm:text-sm text-emerald-100 max-w-xl">
                            Buat dan kelola permainan edukasi interaktif serta Mode Adventure Roadmap & Mode Quest Tower untuk siswa.
                        </p>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
                        <button type="button" onclick="openCreateGameModal()" class="px-5 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-extrabold text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-plus text-sm"></i> <span>Buat Game Baru</span>
                        </button>
                        <button type="button" onclick="openCreateGameModeModal()" class="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-map-location-dot text-sm"></i> <span>Buat Mode Game</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats Overview -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-gamepad"></i>
                    </div>
                    <div>
                        <span class="text-xs font-bold text-slate-400 block uppercase">Total Game</span>
                        <span class="text-xl font-black text-slate-800">${games.length}</span>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-map"></i>
                    </div>
                    <div>
                        <span class="text-xs font-bold text-slate-400 block uppercase">Mode Game</span>
                        <span class="text-xl font-black text-indigo-700">${modes.length} Mode</span>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-users-viewfinder"></i>
                    </div>
                    <div>
                        <span class="text-xs font-bold text-slate-400 block uppercase">Dimainkan Siswa</span>
                        <span class="text-xl font-black text-slate-800">${totalAttempts} Kali</span>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-trophy"></i>
                    </div>
                    <div>
                        <span class="text-xs font-bold text-slate-400 block uppercase">Leaderboard</span>
                        <button type="button" onclick="openGameLeaderboardModal()" class="text-xs font-bold text-emerald-600 hover:underline">Lihat Peringkat &rarr;</button>
                    </div>
                </div>
            </div>

            <!-- SECTION: KARTU MODE GAME (ADVENTURE ROADMAP & TOWER QUEST) -->
            <div class="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl space-y-5 border border-indigo-500/30">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                        <span class="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/40 inline-block mb-1">
                            <i class="fa-solid fa-map-location-dot"></i> Mode Pembelajaran Berurutan
                        </span>
                        <h2 class="text-xl sm:text-2xl font-black text-slate-100">Pilihan Mode Game (Adventure Roadmap & Quest Tower)</h2>
                        <div class="flex items-center mt-1">
                            <p class="text-xs text-slate-300">
                                Pilih dan kelola alur permainan petualangan roadmap atau quest menara bertingkat untuk dimainkan oleh siswa.
                            </p>
                            <label class="flex items-center gap-2 cursor-pointer ml-4 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/10 transition group">
                                <input type="checkbox" onchange="window.toggleGameVisibilityForStudent(this.checked)" ${(appState.settings.isGameMenuVisibleForStudent !== false) ? 'checked' : ''} class="w-4 h-4 accent-emerald-500 cursor-pointer">
                                <span class="text-[10px] font-black uppercase tracking-wider text-slate-100 group-hover:text-emerald-400">Aktif di Siswa</span>
                            </label>
                        </div>
                    </div>
                    <div class="flex items-center gap-2.5 flex-wrap shrink-0">
                        <button type="button" onclick="openCreateGameModeModal()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-plus"></i> <span>Tambah Mode Baru</span>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    ${modes.length === 0 ? `
                        <div class="col-span-full p-8 text-center text-slate-400 text-xs bg-slate-900/60 rounded-2xl border border-slate-800">
                            Belum ada Mode Game. Klik "Tambah Mode Baru" untuk membuat Mode Adventure atau Mode Tower.
                        </div>
                    ` : modes.map(m => {
                        const isAdventure = m.modeType === 'adventure';
                        const locationsCount = Array.isArray(m.locations) ? m.locations.length : 0;
                        const floorsCount = Array.isArray(m.floors) ? m.floors.length : 0;
                        const isActive = m.status !== 'inactive';

                        return `
                            <div class="bg-slate-800/90 rounded-2xl border ${!isActive ? 'border-slate-700 opacity-60' : isAdventure ? 'border-amber-500/40 hover:border-amber-400' : 'border-indigo-500/40 hover:border-indigo-400'} p-5 space-y-4 shadow-lg transition duration-200">
                                <div class="flex items-center justify-between gap-2">
                                    <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        isAdventure ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    }">
                                        <i class="fa-solid ${isAdventure ? 'fa-map' : 'fa-chess-rook'} mr-1"></i>
                                        ${isAdventure ? 'Mode Adventure (Roadmap)' : 'Mode Tower (Quest Menara)'}
                                    </span>
                                    <div class="flex items-center gap-2">
                                        <button type="button" onclick="toggleGameModeStatus('${m.id}')" class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'}" title="Klik untuk mengubah status mode (Aktif/Nonaktif)">
                                            <span class="w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}"></span>
                                            <span>${isActive ? 'Aktif' : 'Nonaktif'}</span>
                                        </button>
                                        <span class="text-[11px] font-bold text-slate-400">
                                            <i class="fa-solid fa-graduation-cap text-indigo-400 mr-1"></i> ${m.classId || 'Semua Kelas'}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <h3 class="text-lg font-black text-white leading-tight">${m.title}</h3>
                                    <p class="text-xs text-slate-300 mt-1 line-clamp-2">${m.description || 'Alur tantangan berurutan bagi siswa.'}</p>
                                </div>

                                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs font-bold text-slate-300">
                                    <span>Status Jalur:</span>
                                    <span class="${isAdventure ? 'text-amber-400' : 'text-indigo-400'} font-extrabold">
                                        ${isAdventure ? `${locationsCount} Lokasi Roadmap` : `${floorsCount} Lantai Quest Menara`}
                                    </span>
                                </div>

                                <div class="flex flex-wrap items-center gap-2 pt-1">
                                    <button type="button" onclick="${isAdventure ? `openManageAdventureRoadmapModal('${m.id}')` : `openManageTowerQuestModal('${m.id}')`}" class="flex-1 min-w-[140px] py-2.5 ${isAdventure ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'} font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
                                        <i class="fa-solid fa-sliders"></i> <span>Kelola (${isAdventure ? 'Peta Harta' : 'Lantai Tower'})</span>
                                    </button>
                                    <button type="button" onclick="previewGameMode('${m.id}')" class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer" title="Pratinjau Mode Siswa">
                                        <i class="fa-solid fa-eye"></i> <span>Pratinjau</span>
                                    </button>
                                    <button type="button" onclick="openCreateGameModeModal('${m.id}')" class="p-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition cursor-pointer" title="Edit Metadata Mode">
                                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                                    </button>
                                    <button type="button" onclick="deleteGameModeEntry('${m.id}')" class="p-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/50 rounded-xl transition cursor-pointer" title="Hapus Mode">
                                        <i class="fa-solid fa-trash-can text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Filters & Controls for Individual Games -->
            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-slate-500">Katalog Game:</span>
                        <select onchange="window.__gameFilterType = this.value; renderGameAdminModule(document.getElementById('view-container'));" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                            <option value="all" ${activeFilterType === 'all' ? 'selected' : ''}>Semua 15 Jenis Game</option>
                            ${GAME_TYPES.map(t => `<option value="${t.id}" ${activeFilterType === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-slate-500">Mapel:</span>
                        <select onchange="window.__gameFilterSubject = this.value; renderGameAdminModule(document.getElementById('view-container'));" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                            <option value="all" ${activeFilterSubject === 'all' ? 'selected' : ''}>Semua Mata Pelajaran</option>
                            ${subjects.map(s => `<option value="${s.name || s.id}" ${activeFilterSubject === (s.name || s.id) ? 'selected' : ''}>${s.name || s.id}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="text-xs text-slate-400 font-semibold">
                    Menampilkan <span class="text-slate-800 font-extrabold">${filteredGames.length}</span> game individu
                </div>
            </div>

            <!-- Games Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                ${filteredGames.length === 0 ? `
                    <div class="col-span-full bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
                        <div class="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                            <i class="fa-solid fa-gamepad"></i>
                        </div>
                        <h3 class="font-bold text-slate-700 text-base">Belum Ada Game Edukasi</h3>
                        <p class="text-xs text-slate-400 max-w-md mx-auto">
                            Klik tombol "Buat Game Baru" di atas untuk menambahkan tantangan permainan baru bagi siswa.
                        </p>
                    </div>
                ` : filteredGames.map(g => {
                    const typeInfo = GAME_TYPES.find(t => t.id === g.gameType) || { name: g.gameType, icon: 'fa-gamepad', color: 'emerald' };
                    const isInactive = g.status === 'inactive';

                    return `
                        <div class="bg-white rounded-3xl border ${isInactive ? 'border-slate-200 opacity-60' : 'border-slate-100'} shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 relative group">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-3">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                        <i class="fa-solid ${typeInfo.icon} text-emerald-600"></i> ${typeInfo.name}
                                    </span>
                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        g.difficulty === 'Mudah' ? 'bg-emerald-100 text-emerald-800' :
                                        g.difficulty === 'Sedang' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                    }">
                                        ${g.difficulty || 'Mudah'}
                                    </span>
                                </div>
                                <h3 class="font-extrabold text-base text-slate-800 group-hover:text-emerald-700 transition line-clamp-1">${gameEscapeHtml(g.title)}</h3>
                                <p class="text-xs text-slate-500 mt-1 line-clamp-2">${gameEscapeHtml(g.prompt || 'Selesaikan tantangan untuk mendapatkan XP.')}</p>
                            </div>

                            <div class="space-y-3 pt-3 border-t border-slate-100 text-xs">
                                <div class="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                                    <div><i class="fa-solid fa-book text-emerald-500 mr-1"></i> ${g.subjectId || 'Umum'}</div>
                                    <div><i class="fa-solid fa-graduation-cap text-indigo-500 mr-1"></i> ${g.classId || 'Semua Kelas'}</div>
                                    <div><i class="fa-solid fa-stopwatch text-amber-500 mr-1"></i> ${g.timeLimit ? g.timeLimit + ' Detik' : 'Tanpa Waktu'}</div>
                                    <div><i class="fa-solid fa-star text-yellow-500 mr-1"></i> +${g.rewardXp || 100} XP</div>
                                </div>

                                <button type="button" onclick="openGameContentEditorModal('${g.id}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer">
                                    <i class="fa-solid fa-sliders"></i> Kelola Aturan & Soal Game
                                </button>

                                <div class="flex items-center gap-2 pt-1">
                                    <button type="button" onclick="launchGamePlayPreview('${g.id}')" class="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition text-center cursor-pointer" title="Uji Coba Langsung">
                                        <i class="fa-solid fa-play text-[10px] mr-1"></i> Uji Coba
                                    </button>
                                    <button type="button" onclick="openEditGameMetadataModal('${g.id}')" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer" title="Edit Metadata (Judul, Mapel, Kelas, Waktu, XP)">
                                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                                    </button>
                                    <button type="button" onclick="toggleGameStatus('${g.id}')" class="p-2 ${g.status === 'active' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'} rounded-xl transition cursor-pointer" title="${g.status === 'active' ? 'Nonaktifkan Game' : 'Aktifkan Game'}">
                                        <i class="fa-solid ${g.status === 'active' ? 'fa-eye-slash' : 'fa-eye'} text-xs"></i>
                                    </button>
                                    <button type="button" onclick="deleteGameEntry('${g.id}')" class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer" title="Hapus Game">
                                        <i class="fa-solid fa-trash-can text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Global functions for Game Admin
window.renderGameAdminModule = renderGameAdminModule;

// ============================================================================
// GAME MODE MANAGEMENT MODALS (ADVENTURE & TOWER)
// ============================================================================
window.openCreateGameModeModal = function(existingMode = null) {
    if (typeof existingMode === 'string') {
        const modes = getGameModes();
        existingMode = modes.find(m => m.id === existingMode) || null;
    }
    const isEdit = !!existingMode;
    const mode = existingMode || {
        id: 'MODE_' + Date.now(),
        title: '',
        modeType: 'adventure',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        description: '',
        status: 'active',
        locations: [],
        floors: []
    };

    const modalHtml = `
        <div id="game-mode-modal-bg" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
                <div class="bg-gradient-to-r from-indigo-800 to-purple-900 p-6 text-white flex items-center justify-between shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-md">
                            <i class="fa-solid fa-map-location-dot"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-lg">${isEdit ? 'Edit Mode Game' : 'Buat Mode Game Baru'}</h3>
                            <p class="text-xs text-indigo-200">Pilih mode Adventure Roadmap atau Quest Tower.</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeGameModeModal()" class="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form onsubmit="handleSaveGameModeForm(event, '${mode.id}')" class="p-6 space-y-4 text-xs font-medium text-slate-700">
                    <div>
                        <label class="block font-bold text-slate-800 mb-1">Judul Mode Game <span class="text-rose-500">*</span></label>
                        <input type="text" id="gm-title" value="${mode.title}" required placeholder="Contoh: Petualangan Harta Karun TIK" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block font-bold text-slate-800 mb-1">Mata Pelajaran</label>
                            <select id="gm-subject" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500">
                                ${(appState.subjects || [{name:'Informatika'}]).map(s => `
                                    <option value="${s.name || s.id}" ${mode.subjectId === (s.name || s.id) ? 'selected' : ''}>${s.name || s.id}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold text-slate-800 mb-1">Target Kelas</label>
                            <select id="gm-class" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500">
                                <option value="Semua Kelas" ${mode.classId === 'Semua Kelas' ? 'selected' : ''}>Semua Kelas</option>
                                ${(appState.classes || []).map(c => `
                                    <option value="${c.name || c.id}" ${mode.classId === (c.name || c.id) ? 'selected' : ''}>${c.name || c.id}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block font-bold text-slate-800 mb-2">Pilih Jenis Mode Game <span class="text-rose-500">*</span></label>
                        <div class="grid grid-cols-2 gap-3">
                            <label id="lbl-mode-adventure" class="p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 ${mode.modeType === 'adventure' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-slate-50'}" onclick="selectModeTypeChoice('adventure')">
                                <input type="radio" name="modeTypeRadio" value="adventure" ${mode.modeType === 'adventure' ? 'checked' : ''} class="hidden">
                                <span class="text-2xl">🗺️</span>
                                <span class="font-extrabold text-slate-800 text-xs">Mode Adventure</span>
                                <span class="text-[10px] text-slate-500 leading-tight">Road Map peta petualangan lokasi berurutan</span>
                            </label>

                            <label id="lbl-mode-tower" class="p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 ${mode.modeType === 'tower' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-slate-50'}" onclick="selectModeTypeChoice('tower')">
                                <input type="radio" name="modeTypeRadio" value="tower" ${mode.modeType === 'tower' ? 'checked' : ''} class="hidden">
                                <span class="text-2xl">🏰</span>
                                <span class="font-extrabold text-slate-800 text-xs">Mode Tower</span>
                                <span class="text-[10px] text-slate-500 leading-tight">Sistem Quest Menara bertingkat dari bawah</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label class="block font-bold text-slate-800 mb-1">Deskripsi Ringkas</label>
                        <textarea id="gm-desc" rows="2" placeholder="Selesaikan tantangan berurutan ini..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500">${mode.description || ''}</textarea>
                    </div>

                    <div class="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                        <button type="button" onclick="closeGameModeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">
                            Batal
                        </button>
                        <button type="submit" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid fa-floppy-disk"></i> Simpan & Kelola Mode
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('game-mode-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    window.__selectedModeType = mode.modeType || 'adventure';
};

window.selectModeTypeChoice = function(type) {
    window.__selectedModeType = type;
    const lblAdv = document.getElementById('lbl-mode-adventure');
    const lblTwr = document.getElementById('lbl-mode-tower');
    if (type === 'adventure') {
        if (lblAdv) { lblAdv.className = "p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 border-amber-500 bg-amber-50"; }
        if (lblTwr) { lblTwr.className = "p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 border-slate-200 bg-slate-50"; }
    } else {
        if (lblAdv) { lblAdv.className = "p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 border-slate-200 bg-slate-50"; }
        if (lblTwr) { lblTwr.className = "p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 border-indigo-600 bg-indigo-50"; }
    }
};

window.closeGameModeModal = function() {
    const el = document.getElementById('game-mode-modal-bg');
    if (el) el.remove();
};

window.handleSaveGameModeForm = async function(e, modeId) {
    if (e) e.preventDefault();
    const modes = getGameModes();
    let mode = modes.find(m => m.id === modeId);
    const isNew = !mode;

    const title = (document.getElementById('gm-title')?.value || '').trim();
    const subjectId = document.getElementById('gm-subject')?.value || 'Informatika';
    const classId = document.getElementById('gm-class')?.value || 'Semua Kelas';
    const modeType = window.__selectedModeType || 'adventure';
    const description = (document.getElementById('gm-desc')?.value || '').trim();

    if (!title) {
        showToast("Judul Mode Game wajib diisi", "error");
        return;
    }

    if (isNew) {
        const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
        mode = {
            id: modeId,
            title,
            subjectId,
            classId,
            modeType,
            description,
            status: 'active',
            locations: modeType === 'adventure' ? [
                { id: 'loc_1', name: 'Pulau Pemula', gameId: games[0]?.id || 'GAME_SEED_1', icon: 'fa-island-tropical', desc: 'Lokasi pertama petualangan' },
                { id: 'loc_2', name: 'Hutan Tantangan', gameId: games[1]?.id || 'GAME_SEED_2', icon: 'fa-tree', desc: 'Lokasi kedua petualangan' }
            ] : [],
            floors: modeType === 'tower' ? [
                { id: 'flr_1', floorNumber: 1, name: 'Lantai 1: Gerbang', gameId: games[0]?.id || 'GAME_SEED_1', desc: 'Dasar tantangan lantai 1' },
                { id: 'flr_2', floorNumber: 2, name: 'Lantai 2: Ruang Uji', gameId: games[1]?.id || 'GAME_SEED_2', desc: 'Tantangan lantai 2' }
            ] : []
        };
        modes.push(mode);
    } else {
        mode.title = title;
        mode.subjectId = subjectId;
        mode.classId = classId;
        mode.modeType = modeType;
        mode.description = description;
    }

    await saveGameModesToBackend();
    closeGameModeModal();
    showToast(`Mode Game "${title}" berhasil disimpan!`, 'success');
    renderGameAdminModule(document.getElementById('view-container'));

    if (modeType === 'adventure') {
        openManageAdventureRoadmapModal(mode.id);
    } else {
        openManageTowerQuestModal(mode.id);
    }
};

window.deleteGameModeEntry = function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    showGameConfirmModal({
        title: 'Hapus Mode Game',
        message: `Apakah Anda yakin ingin menghapus mode game "${mode?.title || 'ini'}"? Semua konfigurasi petualangan/menara di dalamnya akan dihapus.`,
        confirmText: 'Ya, Hapus Mode',
        onConfirm: async () => {
            appState.gameModes = modes.filter(m => m.id !== modeId);
            await saveGameModesToBackend();
            showToast("Mode Game telah dihapus.", "success");
            renderGameAdminModule(document.getElementById('view-container'));
        }
    });
};

window.toggleGameModeStatus = async function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    mode.status = mode.status === 'inactive' ? 'active' : 'inactive';
    await saveGameModesToBackend();
    showToast(`Mode "${mode.title}" sekarang ${mode.status === 'active' ? 'Aktif (Ditampilkan ke Siswa)' : 'Nonaktif (Disembunyikan dari Siswa)'}.`, 'success');
    renderGameAdminModule(document.getElementById('view-container'));
};

// ============================================================================
// TREASURE MAP COMPONENT (MULTI-THEME & CUSTOM IMAGE CARTOGRAPHY ENGINE)
// ============================================================================
export function renderTreasureMapComponent(mode, options = {}) {
    const {
        isEditable = false,
        isPreview = false,
        completedLocations = [],
        activeLocationId = null
    } = options;

    const locations = Array.isArray(mode.locations) ? mode.locations : [];
    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    const theme = mode.theme || (mode.customMapImage ? 'custom' : 'pirate');

    const defaultCoords = [
        { x: 18, y: 78 },
        { x: 34, y: 48 },
        { x: 74, y: 30 },
        { x: 50, y: 62 },
        { x: 22, y: 26 },
        { x: 78, y: 72 },
        { x: 48, y: 18 }
    ];

    // Ensure all locations have normalized x, y percentages
    const mappedLocs = locations.map((loc, idx) => {
        const def = defaultCoords[idx % defaultCoords.length];
        const x = typeof loc.x === 'number' ? loc.x : def.x;
        const y = typeof loc.y === 'number' ? loc.y : def.y;
        return { ...loc, x, y, originalIndex: idx };
    });

    // Generate SVG path coordinate strings (viewBox 0 0 1000 650)
    let pathD = '';
    if (mappedLocs.length > 1) {
        const p0 = { x: mappedLocs[0].x * 10, y: mappedLocs[0].y * 6.5 };
        pathD = `M ${p0.x} ${p0.y}`;
        for (let i = 1; i < mappedLocs.length; i++) {
            const prev = { x: mappedLocs[i - 1].x * 10, y: mappedLocs[i - 1].y * 6.5 };
            const curr = { x: mappedLocs[i].x * 10, y: mappedLocs[i].y * 6.5 };
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const cx1 = prev.x + dx * 0.3 - dy * 0.25;
            const cy1 = prev.y + dy * 0.3 + dx * 0.25;
            const cx2 = curr.x - dx * 0.3 - dy * 0.25;
            const cy2 = curr.y - dy * 0.3 + dx * 0.25;
            pathD += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
        }
    }

    // THEME-SPECIFIC CONFIGURATION
    let containerStyle = '';
    let containerBorder = '';
    let trailStroke = '#dc2626';
    let trailShadow = '#785328';
    let compassHtml = '';
    let svgBackgroundContent = '';

    if (theme === 'custom' && gameSafeImageUrl(mode.customMapImage)) {
        // --- THEME: CUSTOM UPLOADED IMAGE ---
        const safeMapImage = gameSafeImageUrl(mode.customMapImage);
        containerBorder = 'border-4 border-slate-700 shadow-2xl';
        trailStroke = '#f59e0b';
        trailShadow = '#0f172a';
        svgBackgroundContent = `
            <image href="${gameEscapeAttr(safeMapImage)}" x="0" y="0" width="1000" height="650" preserveAspectRatio="xMidYMid slice" />
            <rect width="1000" height="650" fill="black" opacity="0.15" />
        `;
    } else if (theme === 'galaxy') {
        // --- THEME: GALAXY / SPACE EXPEDITION ---
        containerBorder = 'border-4 border-cyan-500/60 shadow-2xl shadow-cyan-950/50';
        containerStyle = 'background: radial-gradient(ellipse at 50% 50%, #090d16 0%, #020617 100%);';
        trailStroke = '#06b6d4';
        trailShadow = '#3b82f6';
        compassHtml = `
            <div class="absolute top-4 right-5 z-10 opacity-80 pointer-events-none flex flex-col items-center">
                <svg width="60" height="60" viewBox="0 0 100 100" class="drop-shadow">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#06b6d4" stroke-width="1.5" stroke-dasharray="3 3"/>
                    <circle cx="50" cy="50" r="32" fill="none" stroke="#38bdf8" stroke-width="1"/>
                    <line x1="50" y1="10" x2="50" y2="90" stroke="#06b6d4" stroke-width="1.5"/>
                    <line x1="10" y1="50" x2="90" y2="50" stroke="#06b6d4" stroke-width="1.5"/>
                    <polygon points="50,15 54,45 50,50 46,45" fill="#38bdf8"/>
                    <circle cx="50" cy="50" r="4" fill="#06b6d4"/>
                    <text x="50" y="10" text-anchor="middle" font-size="8" font-weight="900" fill="#38bdf8" font-family="sans-serif">NAV-SYS</text>
                </svg>
            </div>
        `;
        svgBackgroundContent = `
            <!-- Stars & Constellations -->
            <g fill="#ffffff" opacity="0.8">
                <circle cx="80" cy="80" r="1.5"/><circle cx="150" cy="120" r="2"/><circle cx="280" cy="70" r="1"/>
                <circle cx="420" cy="110" r="1.8"/><circle cx="620" cy="60" r="2.2"/><circle cx="780" cy="130" r="1.5"/>
                <circle cx="910" cy="80" r="2"/><circle cx="120" cy="300" r="1.2"/><circle cx="880" cy="340" r="1.8"/>
                <circle cx="100" cy="540" r="2"/><circle cx="340" cy="580" r="1.5"/><circle cx="680" cy="560" r="2"/>
                <circle cx="920" cy="520" r="1.5"/><circle cx="500" cy="320" r="2.5"/>
            </g>
            <!-- Nebulae Clouds -->
            <ellipse cx="280" cy="220" rx="140" ry="80" fill="#6366f1" opacity="0.15" filter="blur(20px)" />
            <ellipse cx="720" cy="400" rx="160" ry="90" fill="#a855f7" opacity="0.15" filter="blur(20px)" />
            <!-- Giant Ringed Planet (Saturn-like) -->
            <g transform="translate(740, 200)">
                <ellipse cx="0" cy="0" rx="70" ry="18" fill="none" stroke="#38bdf8" stroke-width="4" transform="rotate(-20)" opacity="0.7"/>
                <circle cx="0" cy="0" r="36" fill="#1e293b" stroke="#0ea5e9" stroke-width="2"/>
                <ellipse cx="0" cy="0" rx="60" ry="14" fill="none" stroke="#06b6d4" stroke-width="2" transform="rotate(-20)" opacity="0.9"/>
                <text x="0" y="55" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#38bdf8" opacity="0.8">Planet Alpha</text>
            </g>
            <!-- Space Station / Colony Moon -->
            <g transform="translate(200, 480)">
                <circle cx="0" cy="0" r="42" fill="#0f172a" stroke="#818cf8" stroke-width="2"/>
                <circle cx="-12" cy="-10" r="8" fill="#1e1b4b" opacity="0.6"/>
                <circle cx="15" cy="12" r="10" fill="#1e1b4b" opacity="0.6"/>
                <text x="0" y="60" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#a5b4fc" opacity="0.8">Stasiun Orbital</text>
            </g>
            <!-- Asteroid Field -->
            <g fill="#475569" stroke="#334155" stroke-width="1" opacity="0.7">
                <polygon points="450,180 460,175 465,185 455,190" />
                <polygon points="480,210 495,205 490,220 475,218" />
                <polygon points="520,195 530,190 535,202 525,205" />
            </g>
            <!-- Space Shuttle / Rocket -->
            <g transform="translate(380, 420) rotate(-45) scale(0.7)" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5">
                <polygon points="0,-30 15,20 0,10 -15,20" />
                <polygon points="0,10 6,28 -6,28" fill="#f59e0b" stroke="none"/>
            </g>
        `;
    } else if (theme === 'jungle') {
        // --- THEME: JUNGLE / TROPICAL RAINFOREST ---
        containerBorder = 'border-4 border-[#14532d] shadow-2xl';
        containerStyle = 'background: radial-gradient(ellipse at 50% 50%, #064e3b 0%, #022c22 100%);';
        trailStroke = '#f59e0b';
        trailShadow = '#022c22';
        compassHtml = `
            <div class="absolute top-4 right-5 z-10 opacity-75 pointer-events-none flex flex-col items-center">
                <svg width="60" height="60" viewBox="0 0 100 100" class="drop-shadow">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" stroke-width="2"/>
                    <circle cx="50" cy="50" r="32" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 2"/>
                    <polygon points="50,10 56,44 50,50 44,44" fill="#fbbf24"/>
                    <polygon points="50,90 56,56 50,50 44,56" fill="#047857"/>
                    <circle cx="50" cy="50" r="6" fill="#10b981" stroke="#064e3b" stroke-width="2"/>
                    <text x="50" y="8" text-anchor="middle" font-size="9" font-weight="900" fill="#fde68a" font-family="serif">N</text>
                </svg>
            </div>
        `;
        svgBackgroundContent = `
            <!-- River Flow (Cyan meandering path) -->
            <path d="M 0 350 C 200 320, 350 420, 500 360 C 650 300, 800 480, 1000 420" fill="none" stroke="#0284c7" stroke-width="22" opacity="0.6" stroke-linecap="round" />
            <path d="M 0 350 C 200 320, 350 420, 500 360 C 650 300, 800 480, 1000 420" fill="none" stroke="#38bdf8" stroke-width="6" opacity="0.8" stroke-linecap="round" />
            <!-- Ancient Mayan Temple Pyramid (Center Left) -->
            <g transform="translate(240, 240)" fill="#047857" stroke="#065f46" stroke-width="2">
                <polygon points="0,80 120,80 100,50 20,50" fill="#065f46"/>
                <polygon points="20,50 100,50 85,25 35,25" fill="#047857"/>
                <polygon points="35,25 85,25 75,5 45,5" fill="#059669"/>
                <rect x="52" y="5" width="16" height="20" fill="#022c22" />
                <text x="60" y="102" text-anchor="middle" font-family="serif" font-size="12" font-weight="bold" fill="#6ee7b7">Kuil Kuno Maya</text>
            </g>
            <!-- Jungle Trees Canopy Clusters -->
            <g fill="#065f46" stroke="#022c22" stroke-width="1.5">
                <circle cx="100" cy="140" r="30"/><circle cx="130" cy="130" r="35"/><circle cx="160" cy="150" r="28"/>
                <circle cx="780" cy="220" r="35"/><circle cx="820" cy="200" r="40"/><circle cx="850" cy="230" r="30"/>
                <circle cx="480" cy="520" r="35"/><circle cx="520" cy="500" r="40"/>
            </g>
            <!-- Tropical Waterfall Lagoon (Right) -->
            <g transform="translate(800, 480)">
                <ellipse cx="0" cy="0" rx="60" ry="35" fill="#0284c7" stroke="#38bdf8" stroke-width="2" opacity="0.8"/>
                <text x="0" y="45" text-anchor="middle" font-family="serif" font-size="12" font-weight="bold" fill="#6ee7b7">Danau Zamrud</text>
            </g>
        `;
    } else if (theme === 'fantasy') {
        // --- THEME: FANTASY / MAGIC KINGDOM ---
        containerBorder = 'border-4 border-[#581c87] shadow-2xl shadow-purple-950/60';
        containerStyle = 'background: radial-gradient(ellipse at 50% 50%, #2e1065 0%, #0f051d 100%);';
        trailStroke = '#ec4899';
        trailShadow = '#4c1d95';
        compassHtml = `
            <div class="absolute top-4 right-5 z-10 opacity-80 pointer-events-none flex flex-col items-center">
                <svg width="60" height="60" viewBox="0 0 100 100" class="drop-shadow">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#ec4899" stroke-width="1.5"/>
                    <circle cx="50" cy="50" r="30" fill="none" stroke="#c084fc" stroke-width="1" stroke-dasharray="3 3"/>
                    <polygon points="50,12 55,45 50,50 45,45" fill="#f472b6"/>
                    <polygon points="50,88 55,55 50,50 45,55" fill="#a855f7"/>
                    <circle cx="50" cy="50" r="5" fill="#f43f5e"/>
                    <text x="50" y="9" text-anchor="middle" font-size="8" font-weight="900" fill="#f472b6" font-family="serif">ARCANE</text>
                </svg>
            </div>
        `;
        svgBackgroundContent = `
            <!-- Floating Magic Islands with Crystals -->
            <g transform="translate(220, 240)">
                <path d="M -70,0 C -50,-30, 50,-30, 70,0 C 50,40, 0,70, -70,0 Z" fill="#3b0764" stroke="#a855f7" stroke-width="2"/>
                <!-- Magic Crystals -->
                <polygon points="0,-45 -12,-15 12,-15" fill="#f472b6" stroke="#fff" stroke-width="1"/>
                <polygon points="-25,-35 -32,-15 -18,-15" fill="#c084fc" stroke="#fff" stroke-width="1"/>
                <polygon points="25,-35 18,-15 32,-15" fill="#c084fc" stroke="#fff" stroke-width="1"/>
                <text x="0" y="30" text-anchor="middle" font-family="serif" font-size="11" font-weight="bold" fill="#fbcfe8">Pulau Kristal Ajaib</text>
            </g>
            <!-- Royal Fantasy Spire Castle (Center Right) -->
            <g transform="translate(720, 260)" fill="#4c1d95" stroke="#c084fc" stroke-width="2">
                <rect x="-40" y="0" width="80" height="60" fill="#3b0764" />
                <polygon points="-40,0 -20,-50 0,0" fill="#7e22ce" />
                <polygon points="0,0 20,-50 40,0" fill="#7e22ce" />
                <polygon points="-15,0 0,-70 15,0" fill="#a855f7" />
                <polygon points="0,-70 10,-75 0,-80" fill="#f43f5e" stroke="none"/>
                <text x="0" y="85" text-anchor="middle" font-family="serif" font-size="12" font-weight="bold" fill="#fbcfe8">Kastil Mahkota</text>
            </g>
            <!-- Dragon Flying Silhouette -->
            <g transform="translate(480, 140) scale(0.6)" fill="#c084fc" opacity="0.6">
                <path d="M 0,0 Q 20,-40 60,-20 Q 20,-10 0,0 Q -20,-10 -60,-20 Q -20,-40 0,0 Z"/>
            </g>
        `;
    } else {
        // --- THEME: PIRATE ISLAND (DEFAULT AUTHENTIC PARCHMENT) ---
        containerBorder = 'border-4 border-[#785328] shadow-2xl';
        containerStyle = 'background: radial-gradient(ellipse at 50% 50%, #fbf3dc 0%, #f4e3be 60%, #dec498 100%);';
        trailStroke = '#dc2626';
        trailShadow = '#785328';
        compassHtml = `
            <div class="absolute top-4 right-5 z-10 opacity-75 pointer-events-none flex flex-col items-center">
                <svg width="64" height="64" viewBox="0 0 100 100" class="drop-shadow">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#785328" stroke-width="1.5" stroke-dasharray="3 3"/>
                    <circle cx="50" cy="50" r="36" fill="none" stroke="#785328" stroke-width="2"/>
                    <polygon points="50,8 55,45 50,50 45,45" fill="#991b1b"/>
                    <polygon points="50,8 50,50 45,45" fill="#b91c1c"/>
                    <polygon points="50,92 55,55 50,50 45,55" fill="#785328"/>
                    <polygon points="92,50 55,55 50,50 55,45" fill="#785328"/>
                    <polygon points="8,50 45,55 50,50 45,45" fill="#785328"/>
                    <polygon points="76,24 53,47 50,50 47,53" fill="#a16207"/>
                    <polygon points="24,24 47,47 50,50 53,47" fill="#a16207"/>
                    <polygon points="76,76 53,53 50,50 47,47" fill="#a16207"/>
                    <polygon points="24,76 47,53 50,50 53,53" fill="#a16207"/>
                    <circle cx="50" cy="50" r="5" fill="#dc2626" stroke="#451a03" stroke-width="1.5"/>
                    <text x="50" y="7" text-anchor="middle" font-size="10" font-weight="900" fill="#7f1d1d" font-family="serif">N</text>
                    <text x="50" y="99" text-anchor="middle" font-size="9" font-weight="900" fill="#785328" font-family="serif">S</text>
                    <text x="98" y="53" text-anchor="middle" font-size="9" font-weight="900" fill="#785328" font-family="serif">E</text>
                    <text x="3" y="53" text-anchor="middle" font-size="9" font-weight="900" fill="#785328" font-family="serif">W</text>
                </svg>
            </div>
        `;
        svgBackgroundContent = `
            <!-- Ocean Waves Textures (~ ~ ~) -->
            <g stroke="#8c6239" stroke-width="1.2" fill="none" opacity="0.45" stroke-linecap="round">
                <path d="M 50 120 Q 60 115 70 120 T 90 120" />
                <path d="M 120 180 Q 130 175 140 180 T 160 180" />
                <path d="M 820 100 Q 830 95 840 100 T 860 100" />
                <path d="M 880 150 Q 890 145 900 150 T 920 150" />
                <path d="M 70 560 Q 80 555 90 560 T 110 560" />
                <path d="M 450 600 Q 460 595 470 600 T 490 600" />
                <path d="M 850 560 Q 860 555 870 560 T 890 560" />
            </g>

            <!-- Island 1: West Coast Beach -->
            <g>
                <path d="M 60 420 C 80 360, 120 340, 180 350 C 260 360, 320 420, 310 520 C 300 600, 210 630, 130 620 C 70 610, 40 500, 60 420 Z" fill="none" stroke="#785328" stroke-width="1" stroke-dasharray="2 2" opacity="0.5" />
                <path d="M 70 430 C 90 375, 130 355, 190 365 C 250 375, 300 430, 295 515 C 285 585, 205 610, 140 600 C 85 590, 55 495, 70 430 Z" fill="#edd9ad" stroke="#5c3a1e" stroke-width="2.5" stroke-linejoin="round" />
                <g transform="translate(110, 480) scale(0.9)" stroke="#451a03" stroke-width="1.8" fill="#5c3a1e">
                    <path d="M 0 0 Q 8 -18 12 -32" fill="none"/>
                    <path d="M 12 -32 Q 5 -44 -6 -40 Q 3 -36 12 -32"/>
                    <path d="M 12 -32 Q 18 -48 30 -42 Q 22 -36 12 -32"/>
                    <path d="M 12 -32 Q 24 -28 34 -20 Q 22 -24 12 -32"/>
                </g>
                <text x="140" y="585" font-family="serif" font-size="12" font-style="italic" font-weight="bold" fill="#785328" opacity="0.8">Teluk Pemula</text>
            </g>

            <!-- Island 2: Central Mountains -->
            <g>
                <path d="M 220 220 C 260 140, 360 120, 440 150 C 520 180, 560 260, 530 350 C 490 440, 380 460, 300 440 C 230 420, 190 290, 220 220 Z" fill="none" stroke="#785328" stroke-width="1" stroke-dasharray="2 2" opacity="0.5" />
                <path d="M 230 230 C 270 155, 355 135, 430 160 C 505 185, 545 260, 515 340 C 480 425, 375 445, 305 425 C 240 405, 205 295, 230 230 Z" fill="#ebd4a2" stroke="#5c3a1e" stroke-width="2.5" stroke-linejoin="round" />
                <g stroke="#451a03" stroke-width="2" fill="#d8bc87">
                    <polygon points="320,290 355,230 390,290" />
                    <polygon points="270,320 305,255 340,320" />
                    <polygon points="370,310 405,245 440,310" />
                </g>
                <text x="315" y="380" font-family="serif" font-size="13" font-style="italic" font-weight="bold" fill="#785328" opacity="0.8">Rimba Pegunungan</text>
            </g>

            <!-- Island 3: East Cliff -->
            <g>
                <path d="M 640 140 C 720 80, 840 90, 900 160 C 960 240, 940 360, 880 410 C 800 460, 680 440, 640 370 C 600 300, 590 190, 640 140 Z" fill="none" stroke="#785328" stroke-width="1" stroke-dasharray="2 2" opacity="0.5" />
                <path d="M 650 150 C 725 95, 830 105, 885 170 C 940 245, 925 350, 870 395 C 795 440, 685 425, 650 360 C 615 295, 605 195, 650 150 Z" fill="#ebd4a2" stroke="#5c3a1e" stroke-width="2.5" stroke-linejoin="round" />
                <text x="710" y="220" font-family="serif" font-size="13" font-style="italic" font-weight="bold" fill="#785328" opacity="0.8">Tanjung Harta</text>
            </g>

            <!-- Island 4: Skull Rock Lagoon -->
            <g>
                <path d="M 420 480 C 470 440, 560 450, 590 510 C 620 570, 580 640, 500 645 C 430 650, 390 590, 410 530 Z" fill="#edd9ad" stroke="#5c3a1e" stroke-width="2.5" stroke-linejoin="round" />
                <g transform="translate(500, 540) scale(0.7)" stroke="#451a03" stroke-width="2" fill="#d1b27c">
                    <path d="M -20 -10 C -20 -30, 20 -30, 20 -10 C 20 10, 12 18, 12 25 L -12 25 C -12 18, -20 10, -20 -10 Z" />
                    <ellipse cx="-8" cy="-8" rx="4" ry="6" fill="#451a03" />
                    <ellipse cx="8" cy="-8" rx="4" ry="6" fill="#451a03" />
                </g>
                <text x="445" y="620" font-family="serif" font-size="12" font-style="italic" font-weight="bold" fill="#785328" opacity="0.8">Gua Rahasia</text>
            </g>

            <!-- Sailing Galleon Ship ⛵ -->
            <g transform="translate(180, 80) scale(0.65)" stroke="#451a03" stroke-width="2" fill="#785328">
                <path d="M 0 40 C 20 55, 60 55, 80 40 L 70 25 L 10 25 Z" fill="#5c3a1e" />
                <line x1="25" y1="25" x2="25" y2="-10" stroke-width="3" />
                <path d="M 25 -8 Q 45 -4 25 15 Z" fill="#f5f0dc" />
                <polygon points="55,-20 70,-26 55,-32" fill="#0f172a" />
            </g>

            <!-- Kraken Tentacles 🐙 -->
            <g transform="translate(730, 510) scale(0.6)" stroke="#451a03" stroke-width="2.5" fill="none">
                <path d="M 0 40 Q 15 0 35 10 Q 45 20 30 35 Q 20 20 15 40" fill="#a16207" opacity="0.7"/>
            </g>
        `;
    }

    return `
        <div class="relative w-full rounded-3xl overflow-hidden ${containerBorder} select-none" style="${containerStyle}">
            ${compassHtml}

            <!-- SVG Cartography Background Canvas -->
            <svg viewBox="0 0 1000 650" class="w-full h-auto block pointer-events-none" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
                ${svgBackgroundContent}

                <!-- THE DASHED TREASURE TRAIL PATH -->
                ${pathD ? `
                    <path class="adventure-trail-path" d="${pathD}" fill="none" stroke="${trailShadow}" stroke-width="7" stroke-dasharray="12 10" stroke-linecap="round" opacity="0.4" transform="translate(1, 2)" />
                    <path class="adventure-trail-path" d="${pathD}" fill="none" stroke="${trailStroke}" stroke-width="5" stroke-dasharray="12 10" stroke-linecap="round" />
                ` : ''}

                <!-- "X" Marks the Spot on Final Destination -->
                ${mappedLocs.length > 0 ? `
                    <g transform="translate(${mappedLocs[mappedLocs.length - 1].x * 10}, ${mappedLocs[mappedLocs.length - 1].y * 6.5})">
                        <line x1="-20" y1="-20" x2="20" y2="20" stroke="${trailStroke}" stroke-width="7" stroke-linecap="round" opacity="0.9" />
                        <line x1="20" y1="-20" x2="-20" y2="20" stroke="${trailStroke}" stroke-width="7" stroke-linecap="round" opacity="0.9" />
                    </g>
                ` : ''}
            </svg>

            <!-- HTML INTERACTIVE LOCATION PINS OVERLAY -->
            <div class="absolute inset-0 z-30 pointer-events-auto">
                ${mappedLocs.map((loc, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === mappedLocs.length - 1;
                    const assignedGame = games.find(g => g.id === loc.gameId) || { id: games[0]?.id || 'GAME_SEED_1', title: 'Tantangan Game', rewardXp: 100 };
                    
                    const isDone = completedLocations.includes(loc.id);
                    const isUnlocked = isFirst || completedLocations.includes(mappedLocs[idx - 1]?.id);

                    const isCustomImage = loc.icon && (loc.icon.startsWith('http') || loc.icon.startsWith('data:'));
                    const iconHtml = isCustomImage 
                        ? `<img src="${loc.icon}" class="w-8 h-8 rounded-lg object-cover pointer-events-none" referrerPolicy="no-referrer" />` 
                        : `<i class="fa-solid ${loc.icon || (isLast ? 'fa-vault' : 'fa-compass')} ${isEditable ? '' : 'animate-bounce'} pointer-events-none"></i>`;

                    if (isEditable) {
                        // ADMIN / EDITOR MODE PIN: Draggable and Clickable to edit
                        return `
                            <div style="left: ${loc.x}%; top: ${loc.y}%; transform: translate(-50%, -50%);" 
                                 onmousedown="window.startDraggingMapPin(event, '${mode.id}', ${idx})" 
                                 ontouchstart="window.startDraggingMapPin(event, '${mode.id}', ${idx})" 
                                 class="adventure-map-pin absolute group cursor-move select-none z-40">
                                <div class="relative flex flex-col items-center justify-center p-1 transition transform hover:scale-115">
                                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 text-white font-black shadow-2xl border-2 border-white flex items-center justify-center text-xl hover:ring-4 hover:ring-amber-400/50">
                                        ${iconHtml}
                                    </div>
                                    <span class="absolute -top-2 -right-2 w-6 h-6 bg-slate-950 text-amber-300 font-black text-[10px] rounded-full border border-amber-400 flex items-center justify-center shadow-lg">
                                        #${idx + 1}
                                    </span>
                                </div>

                                <!-- Tooltip / Badge Info Card -->
                                <div class="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap bg-slate-950/95 text-white p-2.5 rounded-xl text-[11px] shadow-2xl border border-amber-500/40 pointer-events-none transition z-40 text-center">
                                    <strong class="text-amber-400 block font-extrabold">${gameEscapeHtml(loc.name || `Lokasi #${idx + 1}`)}</strong>
                                    <span class="text-slate-300 text-[10px] block">Game: ${assignedGame.title}</span>
                                    <span class="text-[9px] text-emerald-400 font-bold block mt-0.5">🖱️ Tahan untuk Seret / Klik untuk Atur Game</span>
                                </div>
                            </div>
                        `;
                    }

                    // STUDENT VIEW & PREVIEW MODE PIN
                    return `
                        <div style="left: ${loc.x}%; top: ${loc.y}%; transform: translate(-50%, -50%);" class="absolute group z-30">
                            ${isDone ? `
                                <!-- Completed Location -->
                                <div class="flex flex-col items-center">
                                    <button type="button" onclick="launchInteractiveGameModal('${assignedGame.id}', ${isPreview}, { modeId: '${mode.id}', locationId: '${loc.id}' })" class="w-12 h-12 rounded-2xl bg-emerald-600 border-2 border-emerald-300 text-white font-black shadow-lg flex items-center justify-center text-xl cursor-pointer hover:scale-110 transition" title="Selesai (Klik untuk main lagi)">
                                        <i class="fa-solid fa-circle-check"></i>
                                    </button>
                                    <span class="mt-1 px-2.5 py-0.5 bg-emerald-950 text-emerald-200 font-extrabold text-[10px] rounded-full shadow-lg border border-emerald-500/40 whitespace-nowrap">
                                        ✓ ${loc.name}
                                    </span>
                                </div>
                            ` : isUnlocked ? `
                                <!-- Active & Unlocked Location -->
                                <div class="flex flex-col items-center">
                                    <div class="relative">
                                        <div class="absolute -inset-2 bg-amber-400/50 rounded-full blur-sm animate-ping"></div>
                                        <button type="button" onclick="launchInteractiveGameModal('${assignedGame.id}', ${isPreview}, { modeId: '${mode.id}', locationId: '${loc.id}' })" class="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-slate-950 font-black shadow-2xl border-3 border-white flex items-center justify-center text-2xl cursor-pointer hover:scale-115 active:scale-95 transition">
                                            ${iconHtml}
                                        </button>
                                        <span class="absolute -top-2.5 -right-2.5 px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full border border-white shadow animate-pulse">
                                            ${isLast ? 'Peti Harta' : 'Buka!'}
                                        </span>
                                    </div>
                                    <button type="button" onclick="launchInteractiveGameModal('${assignedGame.id}', ${isPreview}, { modeId: '${mode.id}', locationId: '${loc.id}' })" class="mt-1.5 px-3 py-1 bg-slate-950 text-amber-300 hover:bg-slate-900 font-black text-xs rounded-xl shadow-xl border border-amber-400/60 whitespace-nowrap cursor-pointer transition flex items-center gap-1.5">
                                        <i class="fa-solid fa-play text-amber-400 text-[10px]"></i>
                                        <span>${loc.name}</span>
                                    </button>
                                </div>
                            ` : `
                                <!-- Locked Location -->
                                <div class="flex flex-col items-center opacity-70">
                                    <div class="w-11 h-11 rounded-2xl bg-slate-950/80 text-slate-300 border border-slate-700 flex items-center justify-center text-base shadow">
                                        <i class="fa-solid fa-lock"></i>
                                    </div>
                                    <span class="mt-1 px-2 py-0.5 bg-slate-950/90 text-slate-300 font-bold text-[9px] rounded-full border border-slate-700 whitespace-nowrap">
                                        🔒 ${loc.name}
                                    </span>
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// DRAG AND DROP HANDLER FOR ADVENTURE MAP PINS
window.startDraggingMapPin = function(event, modeId, locIndex) {
    if (event.type === 'mousedown' && event.button !== 0) return;
    
    event.preventDefault();
    event.stopPropagation();

    const isTouch = event.type.startsWith('touch');
    const startX = isTouch ? event.touches[0].clientX : event.clientX;
    const startY = isTouch ? event.touches[0].clientY : event.clientY;
    
    const pinEl = event.currentTarget;
    const mapWrapper = pinEl.closest('.relative.w-full');
    if (!mapWrapper) return;
    
    let hasMoved = false;
    let finalX = parseFloat(pinEl.style.left) || 50;
    let finalY = parseFloat(pinEl.style.top) || 50;
    
    const moveEvent = isTouch ? 'touchmove' : 'mousemove';
    const endEvent = isTouch ? 'touchend' : 'mouseup';
    
    const onMove = function(e) {
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        
        if (Math.abs(clientX - startX) > 6 || Math.abs(clientY - startY) > 6) {
            hasMoved = true;
        }
        
        const rect = mapWrapper.getBoundingClientRect();
        let xPercent = ((clientX - rect.left) / rect.width) * 100;
        let yPercent = ((clientY - rect.top) / rect.height) * 100;
        
        xPercent = Math.max(3, Math.min(97, xPercent));
        yPercent = Math.max(3, Math.min(97, yPercent));
        
        pinEl.style.left = `${xPercent}%`;
        pinEl.style.top = `${yPercent}%`;
        
        finalX = xPercent;
        finalY = yPercent;

        // Live update adventure trail path d attribute
        const allPins = mapWrapper.querySelectorAll('.adventure-map-pin');
        let pts = [];
        allPins.forEach(p => {
            const lPx = parseFloat(p.style.left) / 100 * rect.width;
            const tPx = parseFloat(p.style.top) / 100 * rect.height;
            pts.push({
                x: (lPx / rect.width) * 1000,
                y: (tPx / rect.height) * 650
            });
        });
        if (pts.length > 1) {
            let newPathD = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
            for (let i = 1; i < pts.length; i++) {
                const prev = pts[i - 1];
                const curr = pts[i];
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const cx1 = prev.x + dx * 0.3 - dy * 0.25;
                const cy1 = prev.y + dy * 0.3 + dx * 0.25;
                const cx2 = curr.x - dx * 0.3 - dy * 0.25;
                const cy2 = curr.y - dy * 0.3 + dx * 0.25;
                newPathD += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
            }
            const paths = mapWrapper.querySelectorAll('.adventure-trail-path');
            paths.forEach(pathEl => pathEl.setAttribute('d', newPathD));
        }
    };
    
    const onEnd = async function(e) {
        document.removeEventListener(moveEvent, onMove);
        document.removeEventListener(endEvent, onEnd);
        
        if (!hasMoved) {
            openAddLocationModal(modeId, locIndex);
            return;
        }
        
        const modes = getGameModes();
        const mode = modes.find(m => m.id === modeId);
        if (mode && mode.locations && mode.locations[locIndex]) {
            mode.locations[locIndex].x = parseFloat(finalX.toFixed(1));
            mode.locations[locIndex].y = parseFloat(finalY.toFixed(1));
            await saveGameModesToBackend();
            showToast(`Posisi "${mode.locations[locIndex].name}" berhasil dipindahkan ke (${mode.locations[locIndex].x}%, ${mode.locations[locIndex].y}%)`, "success");
            renderGameAdminModule(document.getElementById('view-container'));
        }
    };
    
    document.addEventListener(moveEvent, onMove, { passive: false });
    document.addEventListener(endEvent, onEnd);
};

// ============================================================================
// PREVIEW GAME MODE MODAL (ADVENTURE & TOWER FOR TEACHERS)
// ============================================================================
window.previewGameMode = function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    const isAdventure = mode.modeType === 'adventure';

    const modalHtml = `
        <div id="mode-preview-modal-bg" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
            <div class="bg-slate-900 border-2 ${isAdventure ? 'border-amber-500/50' : 'border-indigo-500/50'} rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
                <!-- Header Banner -->
                <div class="bg-gradient-to-r ${isAdventure ? 'from-amber-900 via-yellow-900 to-amber-950' : 'from-indigo-950 via-slate-900 to-purple-950'} p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="w-11 h-11 ${isAdventure ? 'bg-amber-500 text-slate-950' : 'bg-indigo-600 text-white'} rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg">
                            ${isAdventure ? '🗺️' : '🏰'}
                        </div>
                        <div>
                            <span class="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full inline-block">
                                <i class="fa-solid fa-eye mr-1"></i> Mode Pratinjau Guru (Simulasi Siswa)
                            </span>
                            <h3 class="text-lg font-black text-white">${mode.title}</h3>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('mode-preview-modal-bg').remove()" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-5 sm:p-6 max-h-[82vh] overflow-y-auto space-y-4">
                    <div class="bg-indigo-950/60 p-3.5 rounded-2xl border border-indigo-700/40 text-xs text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <span>ℹ️ Ini adalah simulasi tampilan yang akan dimainkan oleh siswa. Uji coba klik pada titik/lantai untuk mencoba permainan.</span>
                        <span class="text-[11px] font-bold text-amber-300 shrink-0">${isAdventure ? `${mode.locations?.length || 0} Titik Lokasi Peta` : `${mode.floors?.length || 0} Lantai Menara`}</span>
                    </div>

                    ${isAdventure ? renderTreasureMapComponent(mode, { isEditable: false, isPreview: true, completedLocations: [] }) : renderStudentTowerTab(games, mode.id, true)}
                </div>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('mode-preview-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// ============================================================================
// ADVENTURE ROADMAP EDITOR MODAL
// ============================================================================
window.openManageAdventureRoadmapModal = function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    if (!Array.isArray(mode.locations)) mode.locations = [];
    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    const currentTheme = mode.theme || (mode.customMapImage ? 'custom' : 'pirate');

    const modalHtml = `
        <div id="manage-roadmap-modal-bg" class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-start justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
            <div class="bg-amber-50 border-2 border-amber-300 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] relative">
                <!-- Header Banner -->
                <div class="bg-gradient-to-r from-amber-900 via-amber-800 to-yellow-900 p-5 sm:p-6 text-amber-100 flex items-center justify-between shadow-md relative overflow-hidden shrink-0">
                    <div class="absolute right-2 -bottom-6 text-7xl opacity-15 pointer-events-none">🏴‍☠️</div>
                    <div class="flex items-center space-x-3 relative z-10">
                        <div class="w-12 h-12 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg">
                            🗺️
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold text-amber-300 uppercase tracking-widest bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-600/40 inline-block">
                                Kelola Peta Petualangan Harta Karun
                            </span>
                            <h3 class="font-black text-xl text-white">${mode.title}</h3>
                            <p class="text-xs text-amber-200">Klik langsung titik pada peta untuk mengatur game edukasi yang dipasang.</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 relative z-10">
                        <button type="button" onclick="previewGameMode('${mode.id}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-eye"></i> <span>Pratinjau Siswa</span>
                        </button>
                        <button type="button" onclick="closeRoadmapModal()" class="w-9 h-9 bg-black/20 hover:bg-black/40 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="p-5 sm:p-6 space-y-6 max-h-[78vh] overflow-y-auto">
                    <!-- THEME SELECTION & CUSTOM MAP UPLOAD PANEL -->
                    <div class="bg-white p-4.5 rounded-2xl border-2 border-amber-200 shadow-sm space-y-3">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h4 class="font-black text-sm text-slate-800 flex items-center gap-2">
                                    <i class="fa-solid fa-palette text-amber-600"></i> Tema Desain Visual Peta
                                </h4>
                                <p class="text-[11px] text-slate-500">Pilih salah satu tema visual ilustrasi peta atau unggah gambar peta buatan Anda sendiri.</p>
                            </div>
                            ${mode.customMapImage ? `
                                <button type="button" onclick="clearCustomMapImage('${mode.id}')" class="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 self-start sm:self-center">
                                    <i class="fa-solid fa-rotate-left"></i> <span>Reset ke Tema Vektor</span>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Theme Selection Pills -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <button type="button" onclick="setAdventureMapTheme('${mode.id}', 'pirate')" class="p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${currentTheme === 'pirate' && !mode.customMapImage ? 'border-amber-600 bg-amber-100/70 shadow-sm ring-2 ring-amber-400' : 'border-slate-200 hover:border-amber-300 bg-slate-50'}">
                                <span class="text-xl">🏴‍☠️</span>
                                <div class="mt-1">
                                    <strong class="text-xs font-bold text-slate-800 block">Bajak Laut</strong>
                                    <span class="text-[10px] text-slate-500">Perkamen Antik</span>
                                </div>
                            </button>

                            <button type="button" onclick="setAdventureMapTheme('${mode.id}', 'galaxy')" class="p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${currentTheme === 'galaxy' && !mode.customMapImage ? 'border-cyan-500 bg-slate-900 text-white shadow-sm ring-2 ring-cyan-400' : 'border-slate-200 hover:border-cyan-300 bg-slate-50'}">
                                <span class="text-xl">🌌</span>
                                <div class="mt-1">
                                    <strong class="text-xs font-bold ${currentTheme === 'galaxy' && !mode.customMapImage ? 'text-cyan-300' : 'text-slate-800'} block">Galaksi Kosmik</strong>
                                    <span class="text-[10px] ${currentTheme === 'galaxy' && !mode.customMapImage ? 'text-slate-400' : 'text-slate-500'}">Antariksa & Planet</span>
                                </div>
                            </button>

                            <button type="button" onclick="setAdventureMapTheme('${mode.id}', 'jungle')" class="p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${currentTheme === 'jungle' && !mode.customMapImage ? 'border-emerald-600 bg-emerald-950 text-white shadow-sm ring-2 ring-emerald-400' : 'border-slate-200 hover:border-emerald-300 bg-slate-50'}">
                                <span class="text-xl">🌴</span>
                                <div class="mt-1">
                                    <strong class="text-xs font-bold ${currentTheme === 'jungle' && !mode.customMapImage ? 'text-emerald-300' : 'text-slate-800'} block">Rimba Maya</strong>
                                    <span class="text-[10px] ${currentTheme === 'jungle' && !mode.customMapImage ? 'text-slate-400' : 'text-slate-500'}">Hutan & Kuil Kuno</span>
                                </div>
                            </button>

                            <button type="button" onclick="setAdventureMapTheme('${mode.id}', 'fantasy')" class="p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${currentTheme === 'fantasy' && !mode.customMapImage ? 'border-purple-600 bg-purple-950 text-white shadow-sm ring-2 ring-purple-400' : 'border-slate-200 hover:border-purple-300 bg-slate-50'}">
                                <span class="text-xl">🔮</span>
                                <div class="mt-1">
                                    <strong class="text-xs font-bold ${currentTheme === 'fantasy' && !mode.customMapImage ? 'text-purple-300' : 'text-slate-800'} block">Kerajaan Sihir</strong>
                                    <span class="text-[10px] ${currentTheme === 'fantasy' && !mode.customMapImage ? 'text-slate-400' : 'text-slate-500'}">Kastil & Kristal</span>
                                </div>
                            </button>
                        </div>

                        <!-- Custom Map Image Upload -->
                        <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-cloud-arrow-up text-amber-600 text-lg"></i>
                                <div>
                                    <strong class="text-xs text-slate-800 block">Atau Unggah Gambar Peta Sendiri (JPG / PNG):</strong>
                                    <span class="text-[10px] text-slate-500">${mode.customMapImage ? '✅ Gambar peta custom aktif digunakan.' : 'Gunakan gambar ilustrasi/peta sekolah/denah Anda sendiri.'}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <label class="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition flex items-center gap-1.5">
                                    <i class="fa-solid fa-file-image"></i>
                                    <span>${mode.customMapImage ? 'Ganti Gambar Peta' : 'Pilih File Gambar'}</span>
                                    <input type="file" accept="image/*" class="hidden" onchange="handleUploadCustomMapImage('${mode.id}', this)">
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Instruction Card -->
                    <div class="bg-amber-100/90 p-4 rounded-2xl border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div class="space-y-0.5">
                            <strong class="font-black">💡 Titik Lokasi Peta Interaktif:</strong>
                            <p class="text-[11px]">Klik titik lokasi mana saja pada peta di bawah ini untuk mengubah nama, posisi koordinat, atau memasang game edukasi.</p>
                        </div>
                        <button type="button" onclick="openAddLocationModal('${mode.id}', null)" class="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-extrabold rounded-xl shadow transition shrink-0 flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-plus text-xs"></i> <span>Tambah Titik Lokasi Baru</span>
                        </button>
                    </div>

                    <!-- INTERACTIVE TREASURE MAP VIEW (Clickable Pins on Map) -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between text-xs font-bold text-amber-900 px-1">
                            <span>🗺️ Tampilan Visual Peta Petualangan:</span>
                            <span class="text-[11px] text-amber-700 font-extrabold">${mode.locations.length} Titik Lokasi Terpasang</span>
                        </div>
                        ${renderTreasureMapComponent(mode, { isEditable: true, isPreview: false, completedLocations: [] })}
                    </div>

                    <!-- LIST OF LOCATIONS TABLE / CARDS -->
                    <div class="space-y-3 pt-2">
                        <h4 class="font-black text-sm text-slate-800 flex items-center gap-2">
                            <i class="fa-solid fa-list-check text-amber-600"></i> Daftar Rincian Urutan Lokasi
                        </h4>

                        <div class="space-y-3">
                            ${mode.locations.length === 0 ? `
                                <div class="p-8 text-center text-amber-800/60 text-xs bg-amber-100/50 rounded-2xl border-2 border-dashed border-amber-300">
                                    Belum ada lokasi pada Roadmap ini. Klik "Tambah Titik Lokasi Baru" untuk memulai!
                                </div>
                            ` : mode.locations.map((loc, idx) => {
                                const assignedGame = games.find(g => g.id === loc.gameId) || { title: 'Belum dipasang game', gameType: 'tebak_kata' };
                                const isFirst = idx === 0;
                                const isLast = idx === mode.locations.length - 1;

                                return `
                                    <div class="bg-white p-4 rounded-2xl border-2 ${isFirst ? 'border-amber-500 bg-amber-50/40' : 'border-amber-200'} shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:shadow-md transition">
                                        <div class="flex items-center space-x-3.5">
                                            <div class="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-lg font-black shadow shrink-0">
                                                <i class="fa-solid ${loc.icon || 'fa-island-tropical'}"></i>
                                            </div>
                                            <div>
                                                <div class="flex items-center gap-2">
                                                    <span class="px-2 py-0.5 bg-amber-200 text-amber-900 font-black text-[10px] rounded-full uppercase">
                                                        Titik #${idx + 1}
                                                    </span>
                                                    ${isFirst ? '<span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">🚩 Mulai</span>' : ''}
                                                    ${isLast ? '<span class="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">❌ Puncak Harta Karun</span>' : ''}
                                                </div>
                                                <h5 class="font-extrabold text-slate-800 text-sm mt-0.5">${gameEscapeHtml(loc.name || `Lokasi ${idx + 1}`)}</h5>
                                                <p class="text-xs text-slate-500">Game: <strong class="text-indigo-700 font-bold">${assignedGame.title}</strong> (X: ${loc.x}%, Y: ${loc.y}%)</p>
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-1.5 self-end sm:self-center">
                                            ${idx > 0 ? `
                                                <button type="button" onclick="moveLocationOrder('${mode.id}', ${idx}, -1)" class="p-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl transition cursor-pointer" title="Naikkan Urutan">
                                                    <i class="fa-solid fa-arrow-up text-xs"></i>
                                                </button>
                                            ` : ''}
                                            ${idx < mode.locations.length - 1 ? `
                                                <button type="button" onclick="moveLocationOrder('${mode.id}', ${idx}, 1)" class="p-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl transition cursor-pointer" title="Turunkan Urutan">
                                                    <i class="fa-solid fa-arrow-down text-xs"></i>
                                                </button>
                                            ` : ''}
                                            <button type="button" onclick="openAddLocationModal('${mode.id}', ${idx})" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1">
                                                <i class="fa-solid fa-pen-to-square text-xs"></i> <span>Edit</span>
                                            </button>
                                            <button type="button" onclick="deleteLocationFromRoadmap('${mode.id}', ${idx})" class="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl transition cursor-pointer" title="Hapus Lokasi">
                                                <i class="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-amber-100/90 border-t border-amber-300 flex items-center justify-between">
                    <span class="text-xs font-bold text-amber-900">${mode.locations.length} Lokasi Terdaftar</span>
                    <button type="button" onclick="closeRoadmapModal(); renderGameAdminModule(document.getElementById('view-container'));" class="px-6 py-2.5 bg-amber-800 hover:bg-amber-900 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer">
                        ✓ Selesai & Simpan Roadmap
                    </button>
                </div>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('manage-roadmap-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.setAdventureMapTheme = async function(modeId, theme) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    mode.theme = theme;
    delete mode.customMapImage;
    await saveGameModesToBackend();
    showToast(`Tema peta diubah menjadi ${theme.toUpperCase()}`, 'success');
    openManageAdventureRoadmapModal(modeId);
};

window.handleUploadCustomMapImage = function(modeId, inputElement) {
    if (!inputElement || !inputElement.files || !inputElement.files[0]) return;
    const file = inputElement.files[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(String(file.type || '').toLowerCase())) {
        showToast("Harap pilih file gambar JPG, PNG, atau WebP.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result;
        const modes = getGameModes();
        const mode = modes.find(m => m.id === modeId);
        if (!mode) return;

        mode.customMapImage = base64Data;
        mode.theme = 'custom';
        await saveGameModesToBackend();
        showToast("Gambar peta kustom berhasil diunggah!", "success");
        openManageAdventureRoadmapModal(modeId);
    };
    reader.readAsDataURL(file);
};

window.clearCustomMapImage = async function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    delete mode.customMapImage;
    mode.theme = 'pirate';
    await saveGameModesToBackend();
    showToast("Gambar kustom dihapus. Kembali ke tema Bajak Laut.", "success");
    openManageAdventureRoadmapModal(modeId);
};

window.closeRoadmapModal = function() {
    const el = document.getElementById('manage-roadmap-modal-bg');
    if (el) el.remove();
};

window.openAddLocationModal = function(modeId, locIndex = null) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const defaultCoords = [
        { x: 18, y: 78 },
        { x: 34, y: 48 },
        { x: 74, y: 30 },
        { x: 50, y: 62 },
        { x: 22, y: 26 },
        { x: 78, y: 72 },
        { x: 48, y: 18 }
    ];

    const isEdit = locIndex !== null && mode.locations[locIndex];
    const defCoord = defaultCoords[(locIndex !== null ? locIndex : mode.locations.length) % defaultCoords.length];

    const loc = isEdit ? mode.locations[locIndex] : {
        id: 'loc_' + Date.now(),
        name: `Lokasi #${mode.locations.length + 1}`,
        gameId: '',
        icon: 'fa-island-tropical',
        desc: '',
        x: defCoord.x,
        y: defCoord.y
    };

    const posX = typeof loc.x === 'number' ? loc.x : defCoord.x;
    const posY = typeof loc.y === 'number' ? loc.y : defCoord.y;

    // Load or initialize direct game content
    if (!Array.isArray(appState.eduGames)) {
        appState.eduGames = [];
    }
    const actualGameId = loc.gameId || 'GAME_LOC_' + loc.id;
    let game = appState.eduGames.find(g => g.id === actualGameId);
    if (!game) {
        game = {
            id: actualGameId,
            title: `Game ${loc.name}`,
            gameType: 'tebak_kata',
            subjectId: mode.subjectId || 'Semua Subject',
            classId: mode.classId || 'Semua Kelas',
            difficulty: 'Mudah',
            timeLimit: 120,
            rewardXp: 100,
            status: 'active',
            prompt: 'Selesaikan tantangan berikut dengan cermat!',
            answerKey: 'KOMPUTER',
            hints: ['Perangkat komputasi utama'],
            wordsToFind: ['MONITOR', 'MOUSE', 'MODEM'],
            pairs: [
                { term: 'RAM', match: 'Memori Sementara' }
            ],
            crosswordData: {
                gridSize: { rows: 8, cols: 8 },
                clues: [
                    { number: 1, direction: 'across', row: 1, col: 1, clue: 'Pertanyaan mendatar', answer: 'JAWAB' }
                ]
            }
        };
    }

    // Keep deep copy in temp editing state
    window._tempEditingGame = JSON.parse(JSON.stringify(game));
    window._customIconBase64 = gameSafeImageUrl(loc.icon);

    const isCustomIcon = !!window._customIconBase64;
    const presetIconOptions = [
        { val: 'fa-island-tropical', label: '🏝️ Pulau Utama' },
        { val: 'fa-tree', label: '🌴 Hutan Rimba' },
        { val: 'fa-mountain', label: '🏔️ Gurun Pasir' },
        { val: 'fa-vault', label: '🏴‍☠️ Peti Harta Karun' },
        { val: 'fa-chess-castle', label: '🏰 Kastil Tua' },
        { val: 'fa-skull', label: '☠️ Gua Rahasia' },
        { val: 'fa-anchor', label: '⚓ Pelabuhan Kapal' },
        { val: 'fa-gem', label: '💎 Permata Ajaib' }
    ];

    const iconOptionsHtml = presetIconOptions.map(opt => `
        <option value="${opt.val}" ${loc.icon === opt.val ? 'selected' : ''}>${opt.label}</option>
    `).join('');

    const modalHtml = `
        <div id="add-loc-modal-bg" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-60 flex items-center justify-center p-3 overflow-y-auto animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-4xl w-full overflow-hidden my-4 flex flex-col max-h-[92vh]">
                <!-- Modal Header -->
                <div class="bg-amber-700 p-5 text-white flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-amber-600/80 rounded-xl flex items-center justify-center text-white text-lg">
                            <i class="fa-solid fa-map-location-dot"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-sm">${isEdit ? 'Ubah Titik Lokasi & Buat Game Langsung' : 'Tambah Titik Lokasi & Buat Game Langsung'}</h4>
                            <p class="text-[10px] text-amber-100 font-semibold">Konfigurasikan lokasi peta di panel kiri dan buat gamenya langsung di panel kanan.</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('add-loc-modal-bg').remove()" class="text-white hover:text-amber-200 transition cursor-pointer p-1">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <!-- Dual Column Form -->
                <form onsubmit="window.handleSaveLocationForm(event, '${mode.id}', ${locIndex})" class="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-medium text-slate-700">
                    
                    <!-- Left Panel: Location Settings -->
                    <div class="space-y-4 border-r border-slate-100 pr-0 md:pr-6">
                        <div class="bg-amber-50 p-3 rounded-2xl border border-amber-100 flex items-center gap-2 text-amber-950 mb-2">
                            <i class="fa-solid fa-circle-info text-amber-600 text-lg"></i>
                            <div>
                                <h5 class="font-extrabold text-[12px]">Pengaturan Titik Peta</h5>
                                <p class="text-[10px] text-amber-800">Tentukan nama, deskripsi petunjuk, serta ikon penanda untuk titik lokasi harta ini.</p>
                            </div>
                        </div>

                        <div>
                            <label class="block font-bold text-slate-800 mb-1">Nama Titik Lokasi <span class="text-rose-500">*</span></label>
                            <input type="text" id="loc-name" value="${gameEscapeAttr(loc.name)}" required placeholder="Contoh: Hutan Kosakata TIK" oninput="if(document.getElementById('game-title')){document.getElementById('game-title').value = 'Game ' + this.value}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 font-bold">
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block font-bold text-slate-800 mb-1">Ikon Titik Lokasi</label>
                                <select id="loc-icon" onchange="window.handleLocIconChange(this.value)" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs">
                                    ${iconOptionsHtml}
                                    <option value="custom" ${isCustomIcon ? 'selected' : ''}>🖼️ Upload Gambar Custom...</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-2 pt-5">
                                <div id="custom-icon-preview-container" class="${isCustomIcon ? '' : 'hidden'} shrink-0">
                                    ${isCustomIcon ? `<img src="${gameEscapeAttr(window._customIconBase64)}" class="w-10 h-10 rounded-xl border border-amber-300 object-cover shadow-sm" />` : ''}
                                </div>
                                <div id="custom-icon-upload-div" class="${isCustomIcon ? '' : 'hidden'} flex-1">
                                    <input type="file" id="custom-icon-file" accept="image/*" onchange="window.uploadCustomIconImage(this)" class="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 cursor-pointer" />
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block font-bold text-slate-800 mb-1">Posisi di Peta (Preset)</label>
                                <select onchange="window.applyLocationCoordPreset(this.value)" class="w-full px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-[11px]">
                                    <option value="">Pilih Posisi Preset...</option>
                                    <option value="18,78">Pantai Kiri Bawah</option>
                                    <option value="34,48">Rimba Tengah</option>
                                    <option value="74,30">Bukit Kanan Atas</option>
                                    <option value="50,62">Pusat Harta Karun</option>
                                    <option value="22,26">Puncak Barat Laut</option>
                                    <option value="78,72">Laguna Tenggara</option>
                                </select>
                            </div>
                            <div class="p-1 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] text-slate-500 flex flex-col justify-center text-center">
                                <span class="font-bold text-amber-700">💡 Tips Seret-Drop</span>
                                <span>Kamu juga bisa menyeret langsung titik lokasi ini di peta tanpa menyetel manual koordinat!</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200/50">
                            <div>
                                <label class="block font-bold text-amber-950 mb-1">Posisi X (% Kiri): <span id="val-loc-x" class="font-extrabold text-amber-700">${posX}%</span></label>
                                <input type="range" id="loc-x" min="3" max="97" value="${posX}" oninput="document.getElementById('val-loc-x').innerText = this.value + '%'" class="w-full accent-amber-600">
                            </div>
                            <div>
                                <label class="block font-bold text-amber-950 mb-1">Posisi Y (% Atas): <span id="val-loc-y" class="font-extrabold text-amber-700">${posY}%</span></label>
                                <input type="range" id="loc-y" min="3" max="97" value="${posY}" oninput="document.getElementById('val-loc-y').innerText = this.value + '%'" class="w-full accent-amber-600">
                            </div>
                        </div>

                        <div>
                            <label class="block font-bold text-slate-800 mb-1">Deskripsi / Petunjuk Penjelajah</label>
                            <textarea id="loc-desc" rows="2" placeholder="Petunjuk khusus atau pesan rintangan bagi siswa ketika mengklik lokasi ini..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white">${gameEscapeHtml(loc.desc || '')}</textarea>
                        </div>
                    </div>

                    <!-- Right Panel: Direct Game Creator / Editor (Langkah ke-2) -->
                    <div id="loc-game-editor-container" class="space-y-4">
                        <!-- Rendered Reactively via renderLocGameFields -->
                    </div>

                    <!-- Footer Options -->
                    <div class="col-span-1 md:col-span-2 pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                        <button type="button" onclick="document.getElementById('add-loc-modal-bg').remove()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs">
                            Batal
                        </button>
                        <button type="submit" class="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-extrabold rounded-xl shadow-md transition cursor-pointer text-xs flex items-center gap-1.5">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>Simpan Titik & Konten Game</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('add-loc-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Initial render of Game Fields
    window.renderLocGameFields();
};

window.handleLocIconChange = function(val) {
    const uploadDiv = document.getElementById('custom-icon-upload-div');
    const previewDiv = document.getElementById('custom-icon-preview-container');
    if (val === 'custom') {
        if (uploadDiv) uploadDiv.classList.remove('hidden');
        if (previewDiv) previewDiv.classList.remove('hidden');
    } else {
        if (uploadDiv) uploadDiv.classList.add('hidden');
        if (previewDiv) previewDiv.classList.add('hidden');
        window._customIconBase64 = '';
        if (previewDiv) previewDiv.innerHTML = '';
    }
};

window.uploadCustomIconImage = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(String(file.type || '').toLowerCase())) {
            showToast('Ikon harus JPG, PNG, atau WebP.', 'error');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            window._customIconBase64 = base64;
            const previewDiv = document.getElementById('custom-icon-preview-container');
            if (previewDiv) {
                const safe = gameSafeImageUrl(base64);
                previewDiv.replaceChildren();
                if (safe) {
                    const img = document.createElement('img');
                    img.src = safe;
                    img.className = 'w-10 h-10 rounded-xl border border-amber-300 object-cover shadow-sm animate-pulse';
                    previewDiv.appendChild(img);
                }
            }
        };
        reader.readAsDataURL(file);
    }
};

window.renderLocGameFields = function() {
    const game = window._tempEditingGame;
    const container = document.getElementById('loc-game-editor-container');
    if (!container || !game) return;

    const gameTypesHtml = GAME_TYPES.map(t => `
        <option value="${t.id}" ${game.gameType === t.id ? 'selected' : ''}>${t.name}</option>
    `).join('');

    container.innerHTML = `
        <div class="space-y-4 text-slate-700">
            <div class="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100/60 flex items-center gap-2.5 text-emerald-950">
                <div class="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center text-base shrink-0 font-bold">
                    <i class="fa-solid fa-gamepad"></i>
                </div>
                <div>
                    <h5 class="font-extrabold text-[12px]">Konfigurasi Game Langsung (Instan)</h5>
                    <p class="text-[10px] text-emerald-800 leading-normal">Buat & atur konten pertanyaan game langsung pada titik ini, tanpa terikat katalog eksternal.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Judul Game <span class="text-rose-500">*</span></label>
                    <input type="text" id="game-title" value="${gameEscapeAttr(game.title || '')}" required placeholder="Contoh: Game Tebak Hardware" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white text-xs">
                </div>
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Jenis Game <span class="text-rose-500">*</span></label>
                    <select id="game-type" onchange="window.handleLocGameTypeChange(this.value)" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-emerald-800 focus:bg-white text-xs">
                        ${gameTypesHtml}
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Kesulitan</label>
                    <select id="game-difficulty" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] focus:bg-white">
                        <option value="Mudah" ${game.difficulty === 'Mudah' ? 'selected' : ''}>Mudah</option>
                        <option value="Sedang" ${game.difficulty === 'Sedang' ? 'selected' : ''}>Sedang</option>
                        <option value="Sulit" ${game.difficulty === 'Sulit' ? 'selected' : ''}>Sulit</option>
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Waktu (Detik)</label>
                    <input type="number" id="game-timelimit" value="${game.timeLimit || 120}" min="10" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-bold">
                </div>
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Reward XP</label>
                    <input type="number" id="game-xp" value="${game.rewardXp || 100}" min="10" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-black text-amber-700">
                </div>
            </div>

            <div>
                <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Instruksi / Soal Utama Game <span class="text-rose-500">*</span></label>
                <textarea id="edit-content-prompt" rows="2" placeholder="Masukkan instruksi atau narasi tantangan bagi siswa..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white text-xs">${gameEscapeHtml(game.prompt || '')}</textarea>
            </div>

            <!-- Dynamic Question Content Area -->
            <div id="loc-specialized-editor-body" class="max-h-[35vh] overflow-y-auto pr-1 space-y-4">
                ${renderSpecializedGameEditor(game)}
            </div>
        </div>
    `;
};

window.handleLocGameTypeChange = function(newType) {
    if (!window._tempEditingGame) return;
    window._tempEditingGame.gameType = newType;
    
    const typeInfo = GAME_TYPES.find(t => t.id === newType) || { name: 'Game' };
    window._tempEditingGame.prompt = `Selesaikan tantangan ${typeInfo.name} berikut dengan cermat!`;
    
    if (newType === 'word_search') {
        window._tempEditingGame.wordsToFind = ['MONITOR', 'MOUSE', 'MODEM'];
    } else if (newType === 'memory_match' || newType === 'labirin') {
        window._tempEditingGame.pairs = [{ term: 'A', match: 'B' }];
    } else if (newType === 'crossword') {
        window._tempEditingGame.crosswordData = {
            gridSize: { rows: 8, cols: 8 },
            clues: [
                { number: 1, direction: 'across', row: 1, col: 1, clue: 'Pertanyaan mendatar', answer: 'JAWAB' }
            ]
        };
    }
    
    window.renderLocGameFields();
};

window.applyLocationCoordPreset = function(val) {
    if (!val) return;
    const parts = val.split(',');
    if (parts.length === 2) {
        const xInput = document.getElementById('loc-x');
        const yInput = document.getElementById('loc-y');
        if (xInput) {
            xInput.value = parts[0];
            document.getElementById('val-loc-x').innerText = parts[0] + '%';
        }
        if (yInput) {
            yInput.value = parts[1];
            document.getElementById('val-loc-y').innerText = parts[1] + '%';
        }
    }
};

window.handleSaveLocationForm = async function(e, modeId, locIndex) {
    if (e) e.preventDefault();
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const name = (document.getElementById('loc-name')?.value || '').trim();
    const desc = (document.getElementById('loc-desc')?.value || '').trim();
    const x = parseInt(document.getElementById('loc-x')?.value || '50', 10);
    const y = parseInt(document.getElementById('loc-y')?.value || '50', 10);

    let icon = document.getElementById('loc-icon')?.value || 'fa-island-tropical';
    if (icon === 'custom' && window._customIconBase64) {
        icon = window._customIconBase64;
    }

    // Save direct game
    const game = window._tempEditingGame;
    if (game) {
        game.title = (document.getElementById('game-title')?.value || '').trim() || `Game ${name}`;
        game.difficulty = document.getElementById('game-difficulty')?.value || 'Mudah';
        game.timeLimit = parseInt(document.getElementById('game-timelimit')?.value, 10) || 120;
        game.rewardXp = parseInt(document.getElementById('game-xp')?.value, 10) || 100;
        
        const promptEl = document.getElementById('edit-content-prompt');
        if (promptEl) game.prompt = promptEl.value.trim();

        // Read specific type fields
        const type = game.gameType;
        if (type === 'tebak_gambar') {
            const h1 = document.getElementById('edit-tg-hint-1')?.value.trim();
            const h2 = document.getElementById('edit-tg-hint-2')?.value.trim();
            const h3 = document.getElementById('edit-tg-hint-3')?.value.trim();
            const h4 = document.getElementById('edit-tg-hint-4')?.value.trim();
            game.hints = [
                h1 || 'Clue 1: Perhatikan bentuk awal gambar',
                h2 || 'Clue 2: Perhatikan fungsi utama objek ini',
                h3 || 'Clue 3: Perhatikan warna dan karakteristiknya',
                h4 || 'Clue 4: Nama objek ini sangat populer'
            ];
            
            const imgEl = document.getElementById('edit-content-image');
            if (imgEl) game.imageUrl = imgEl.value.trim();
            const answerEl = document.getElementById('edit-content-answer');
            if (answerEl) game.answerKey = answerEl.value.trim().toUpperCase();
        } else if (type === 'tebak_kata' || type === 'susun_kata') {
            const answerEl = document.getElementById('edit-content-answer');
            if (answerEl) game.answerKey = answerEl.value.trim().toUpperCase();
            const imgEl = document.getElementById('edit-content-image');
            if (imgEl) game.imageUrl = imgEl.value.trim();
            const hintEl = document.getElementById('edit-content-hint');
            if (hintEl && hintEl.value.trim()) game.hints = [hintEl.value.trim()];
        } else if (type === 'true_false') {
            const tfEl = document.getElementById('edit-content-tf-correct');
            if (tfEl) game.correctAnswer = tfEl.value;
            const expEl = document.getElementById('edit-content-explanation');
            if (expEl) game.explanation = expEl.value.trim();
            const imgEl = document.getElementById('edit-content-image');
            if (imgEl) game.imageUrl = imgEl.value.trim();
        } else if (type === 'word_search') {
            const wordTagsContainer = document.getElementById('word-search-tags');
            if (wordTagsContainer) {
                const wordSpans = wordTagsContainer.querySelectorAll('span');
                if (wordSpans.length > 0) {
                    game.wordsToFind = [];
                    wordSpans.forEach(span => {
                        let text = span.innerText || span.textContent || '';
                        text = text.replace(/×/g, '').trim().toUpperCase();
                        if (text) game.wordsToFind.push(text);
                    });
                }
            }
        } else if (type === 'labirin') {
            const labirinOptInputs = document.querySelectorAll('.labirin-opt-text');
            if (labirinOptInputs.length > 0) {
                const options = [];
                let correctKey = '';
                labirinOptInputs.forEach((optInput) => {
                    const val = optInput.value.trim();
                    if (val) {
                        options.push(val);
                        const parent = optInput.closest('div');
                        const radio = parent ? parent.querySelector('.labirin-opt-radio') : null;
                        if (radio && radio.checked) {
                            correctKey = val;
                        }
                    }
                });
                if (options.length > 0) {
                    game.options = options;
                    if (correctKey) game.answerKey = correctKey;
                    else if (!game.answerKey) game.answerKey = options[0];
                }
            }
        } else if (type === 'memory_match') {
            const pairTermInputs = document.querySelectorAll('.pair-term-input');
            const pairMatchInputs = document.querySelectorAll('.pair-match-input');
            if (pairTermInputs.length > 0) {
                game.pairs = [];
                pairTermInputs.forEach((tInput, idx) => {
                    const term = tInput.value.trim();
                    const match = pairMatchInputs[idx] ? pairMatchInputs[idx].value.trim() : '';
                    if (term && match) game.pairs.push({ term, match });
                });
            }
        } else if (type === 'crossword') {
            const cwRows = document.querySelectorAll('.cw-clue-row');
            if (cwRows.length > 0) {
                const clues = [];
                cwRows.forEach((row, idx) => {
                    const num = parseInt(row.querySelector('.cw-no')?.value, 10) || (idx + 1);
                    const dir = row.querySelector('.cw-dir')?.value || 'across';
                    const r = parseInt(row.querySelector('.cw-row')?.value, 10) || 1;
                    const c = parseInt(row.querySelector('.cw-col')?.value, 10) || 1;
                    const clue = row.querySelector('.cw-clue')?.value.trim() || '';
                    const answer = row.querySelector('.cw-answer')?.value.trim().toUpperCase() || '';
                    const points = parseInt(row.querySelector('.cw-points')?.value, 10) || 20;
                    const initialHint = row.querySelector('.cw-hint-check')?.checked !== false;

                    if (clue && answer) {
                        clues.push({ number: num, direction: dir, row: r, col: c, clue, answer, points, initialHint });
                    }
                });
                if (clues.length > 0) {
                    game.crosswordData = { gridSize: { rows: 8, cols: 8 }, clues };
                }
            }
        }

        // Add or update to appState.eduGames
        if (!Array.isArray(appState.eduGames)) {
            appState.eduGames = [];
        }
        const existingIdx = appState.eduGames.findIndex(g => g.id === game.id);
        if (existingIdx !== -1) {
            appState.eduGames[existingIdx] = game;
        } else {
            appState.eduGames.push(game);
        }

        // Try putting to server
        try {
            await fetch(`/api/games/${game.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(game)
            });
        } catch (err) {
            console.error("Local save only for direct game");
        }
    }

    const newLoc = {
        id: locIndex !== null && mode.locations[locIndex] ? mode.locations[locIndex].id : 'loc_' + Date.now(),
        name,
        gameId: game ? game.id : (locIndex !== null && mode.locations[locIndex] ? mode.locations[locIndex].gameId : ''),
        icon,
        desc,
        x,
        y
    };

    if (locIndex !== null && mode.locations[locIndex]) {
        mode.locations[locIndex] = newLoc;
    } else {
        mode.locations.push(newLoc);
    }

    await saveGameModesToBackend();
    document.getElementById('add-loc-modal-bg')?.remove();
    showToast("Titik lokasi peta & Konten Game berhasil disimpan!", "success");
    openManageAdventureRoadmapModal(modeId);
};

window.moveLocationOrder = async function(modeId, index, delta) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !mode.locations) return;

    const newIdx = index + delta;
    if (newIdx < 0 || newIdx >= mode.locations.length) return;

    const temp = mode.locations[index];
    mode.locations[index] = mode.locations[newIdx];
    mode.locations[newIdx] = temp;

    await saveGameModesToBackend();
    openManageAdventureRoadmapModal(modeId);
};

window.deleteLocationFromRoadmap = function(modeId, index) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !mode.locations) return;
    const loc = mode.locations[index];

    showGameConfirmModal({
        title: 'Hapus Titik Lokasi Peta',
        message: `Apakah Anda yakin ingin menghapus titik lokasi "${loc?.name || `Lokasi #${index + 1}`}" dari peta petualangan ini?`,
        confirmText: 'Ya, Hapus Lokasi',
        onConfirm: async () => {
            mode.locations.splice(index, 1);
            await saveGameModesToBackend();
            document.getElementById('add-loc-modal-bg')?.remove();
            showToast("Titik lokasi telah dihapus.", "success");
            openManageAdventureRoadmapModal(modeId);
        }
    });
};

// ============================================================================
// TOWER QUEST EDITOR MODAL
// ============================================================================
window.openManageTowerQuestModal = function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    if (!Array.isArray(mode.floors)) mode.floors = [];
    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;

    const modalHtml = `
        <div id="manage-tower-modal-bg" class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
            <div class="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] relative text-white">
                <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-6 text-white flex items-center justify-between shadow-md border-b border-indigo-800/60 shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg">
                            🏰
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-800 inline-block">
                                Quest Menara Bertingkat
                            </span>
                            <h3 class="font-black text-xl text-white">${mode.title}</h3>
                            <p class="text-xs text-slate-300">Kelola jumlah lantai quest menara dari paling bawah hingga puncak, beserta warna background tiap lantai.</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeTowerModal()" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    <div class="bg-indigo-950/80 p-4 rounded-2xl border border-indigo-700/60 text-indigo-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div class="space-y-0.5">
                            <strong class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-wand-magic-sparkles text-amber-400"></i> Warna & Aturan Menara:</strong>
                            <p class="text-[11px] text-slate-300">Setiap naik lantai, warna background quest berubah otomatis atau dapat diatur manual per lantai.</p>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <button type="button" onclick="autoApplyTowerFloorColors('${mode.id}')" class="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-amber-500 hover:opacity-90 text-white font-extrabold rounded-xl shadow transition shrink-0 flex items-center gap-1.5 cursor-pointer text-xs" title="Otomatisasi gradasi warna lantai dari bawah hingga puncak">
                                <i class="fa-solid fa-palette text-xs"></i> <span>Otomatisasi Warna</span>
                            </button>
                            <button type="button" onclick="openAddFloorModal('${mode.id}', null)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow transition shrink-0 flex items-center gap-1.5 cursor-pointer text-xs">
                                <i class="fa-solid fa-plus text-xs"></i> <span>Tambah Lantai</span>
                            </button>
                        </div>
                    </div>

                    <div class="space-y-3">
                        ${mode.floors.length === 0 ? `
                            <div class="p-10 text-center text-slate-400 text-xs bg-slate-950 rounded-2xl border-2 border-dashed border-slate-800">
                                Belum ada lantai menara. Klik "Tambah Lantai" untuk menambahkan lantai baru!
                            </div>
                        ` : `
                            <div class="space-y-3">
                                <div class="text-center py-2.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 rounded-2xl border border-amber-500/40 text-amber-300 text-xs font-black flex items-center justify-center gap-2 shadow-sm">
                                    <span>👑</span> <span>PUNCAK MENARA QUEST (MAHKOTA EMAS)</span>
                                </div>

                                ${[...mode.floors].reverse().map((flr, revIdx) => {
                                    const actualIdx = mode.floors.length - 1 - revIdx;
                                    const assignedGame = games.find(g => g.id === flr.gameId) || { title: 'Belum dipasang game' };
                                    const isBottom = actualIdx === 0;
                                    const bgStyle = getTowerFloorBgStyle(flr, actualIdx, mode.floors.length);

                                    return `
                                        <div class="p-5 rounded-2xl border ${isBottom ? 'border-amber-500/60' : 'border-slate-700/80'} shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition duration-200" style="background: ${bgStyle};">
                                            <div class="flex items-center space-x-4">
                                                <div class="w-12 h-12 rounded-2xl ${isBottom ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/20 text-white font-bold backdrop-blur-xs'} flex items-center justify-center text-base shadow-md shrink-0 border border-white/20">
                                                    L${actualIdx + 1}
                                                </div>
                                                <div>
                                                    <div class="flex items-center gap-2 flex-wrap">
                                                        <span class="px-2.5 py-0.5 bg-slate-950/80 text-amber-400 font-extrabold text-[10px] rounded-full uppercase border border-amber-500/30">
                                                            Lantai #${actualIdx + 1}
                                                        </span>
                                                        ${isBottom ? '<span class="text-[10px] font-bold text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-full border border-emerald-700">🚪 Lantai Pintu Gerbang (Terbuka)</span>' : ''}
                                                        <span class="text-[10px] font-bold text-slate-200 bg-slate-950/60 px-2 py-0.5 rounded-full border border-white/10">
                                                            ${flr.bgMode === 'manual' ? '🎨 Manual' : '⚡ Otomatis'}
                                                        </span>
                                                    </div>
                                                    <h4 class="font-extrabold text-white text-sm mt-1 drop-shadow-sm">${flr.name || `Lantai ${actualIdx + 1}`}</h4>
                                                    <p class="text-xs text-slate-200 mt-0.5">Game: <span class="font-bold text-amber-300">${assignedGame.title}</span></p>
                                                </div>
                                            </div>

                                            <div class="flex items-center gap-2 self-end sm:self-center bg-slate-950/70 backdrop-blur-xs p-1.5 rounded-2xl border border-white/10">
                                                ${actualIdx < mode.floors.length - 1 ? `
                                                    <button type="button" onclick="moveFloorOrder('${mode.id}', ${actualIdx}, 1)" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer" title="Naikkan Ke Atas">
                                                        <i class="fa-solid fa-arrow-up text-xs"></i>
                                                    </button>
                                                ` : ''}
                                                ${actualIdx > 0 ? `
                                                    <button type="button" onclick="moveFloorOrder('${mode.id}', ${actualIdx}, -1)" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer" title="Turunkan Ke Bawah">
                                                        <i class="fa-solid fa-arrow-down text-xs"></i>
                                                    </button>
                                                ` : ''}
                                                <button type="button" onclick="openAddFloorModal('${mode.id}', ${actualIdx})" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1">
                                                    <i class="fa-solid fa-pen-to-square text-xs"></i> <span>Edit</span>
                                                </button>
                                                <button type="button" onclick="deleteFloorFromTower('${mode.id}', ${actualIdx})" class="p-2 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded-xl transition cursor-pointer" title="Hapus Lantai">
                                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>
                </div>

                <div class="p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-400">${mode.floors.length} Lantai Menara Dikonfigurasi</span>
                    <button type="button" onclick="closeTowerModal(); renderGameAdminModule(document.getElementById('view-container'));" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer">
                        ✓ Selesai & Simpan Menara
                    </button>
                </div>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('manage-tower-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.closeTowerModal = function() {
    const el = document.getElementById('manage-tower-modal-bg');
    if (el) el.remove();
};

const TOWER_COLOR_PRESETS = [
    { id: 'slate', name: 'Dungeon Slate (Dasar)', gradient: 'linear-gradient(135deg, #0f172a, #1e293b)', bgHex: '#0f172a' },
    { id: 'emerald', name: 'Obsidian Emerald (Hutan)', gradient: 'linear-gradient(135deg, #064e3b, #047857)', bgHex: '#064e3b' },
    { id: 'cyan', name: 'Glacial Ice (Kubah Es)', gradient: 'linear-gradient(135deg, #0e7490, #0284c7)', bgHex: '#0e7490' },
    { id: 'sapphire', name: 'Deep Sapphire (Samudra)', gradient: 'linear-gradient(135deg, #1e3a8a, #2563eb)', bgHex: '#1e3a8a' },
    { id: 'purple', name: 'Mystic Spire (Kastil Sihir)', gradient: 'linear-gradient(135deg, #581c87, #9333ea)', bgHex: '#581c87' },
    { id: 'twilight', name: 'Twilight Sunset (Senja)', gradient: 'linear-gradient(135deg, #7c2d12, #ea580c)', bgHex: '#7c2d12' },
    { id: 'magma', name: 'Magma Crimson (Bara Api)', gradient: 'linear-gradient(135deg, #7f1d1d, #dc2626)', bgHex: '#7f1d1d' },
    { id: 'amber', name: 'Amber Treasury (Harta Karun)', gradient: 'linear-gradient(135deg, #78350f, #d97706)', bgHex: '#78350f' },
    { id: 'gold', name: 'Golden Apex (Puncak Emas)', gradient: 'linear-gradient(135deg, #854d0e, #eab308)', bgHex: '#854d0e' },
    { id: 'cyber', name: 'Cyber Teal (Futuristik)', gradient: 'linear-gradient(135deg, #022c22, #0d9488)', bgHex: '#022c22' },
    { id: 'dragon', name: 'Dragon Blood (Kastil Merah)', gradient: 'linear-gradient(135deg, #4c0519, #be123c)', bgHex: '#4c0519' }
];

window.getTowerFloorBgStyle = function(flr, floorIndex, totalFloors) {
    if (flr && flr.bgMode === 'manual') {
        if (flr.bgGradient && flr.bgGradient !== 'auto') return flr.bgGradient;
        if (flr.bgColor) return flr.bgColor;
    }
    if (flr && flr.bgGradient && flr.bgGradient !== 'auto') {
        return flr.bgGradient;
    }

    // Progressive automatic gradients based on floor elevation:
    const autoGradients = [
        'linear-gradient(135deg, #0f172a, #1e293b)', // L1: Deep Slate Ground
        'linear-gradient(135deg, #064e3b, #047857)', // L2: Emerald Grove
        'linear-gradient(135deg, #0e7490, #0284c7)', // L3: Cyan Spire
        'linear-gradient(135deg, #1e3a8a, #2563eb)', // L4: Sapphire Bastion
        'linear-gradient(135deg, #581c87, #9333ea)', // L5: Mystic Purple
        'linear-gradient(135deg, #7c2d12, #ea580c)', // L6: Twilight Citadel
        'linear-gradient(135deg, #7f1d1d, #dc2626)', // L7: Magma Chambers
        'linear-gradient(135deg, #78350f, #d97706)', // L8: Amber Vault
        'linear-gradient(135deg, #854d0e, #eab308)'  // L9+: Golden Peak
    ];

    if (!totalFloors || totalFloors <= 1) return autoGradients[0];
    const pct = Math.min(Math.max(floorIndex / (totalFloors - 1), 0), 1);
    const gradIdx = Math.min(Math.floor(pct * (autoGradients.length - 1)), autoGradients.length - 1);
    return autoGradients[gradIdx];
};

window.autoApplyTowerFloorColors = async function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !Array.isArray(mode.floors) || mode.floors.length === 0) {
        showToast("Belum ada lantai untuk diwarnai", "warning");
        return;
    }
    const total = mode.floors.length;
    mode.floors.forEach((flr, idx) => {
        flr.bgMode = 'auto';
        flr.bgGradient = getTowerFloorBgStyle(null, idx, total);
        flr.bgColor = '';
        flr.bgPreset = 'auto';
    });
    await saveGameModesToBackend();
    showToast("✨ Warna latar gradasi semua lantai menara berhasil diotomatisasi!", "success");
    openManageTowerQuestModal(modeId);
};

window.openAddFloorModal = function(modeId, floorIndex = null) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const isEdit = floorIndex !== null && mode.floors[floorIndex];
    const flr = isEdit ? mode.floors[floorIndex] : {
        id: 'flr_' + Date.now(),
        name: `Lantai #${mode.floors.length + 1}`,
        gameId: appState.eduGames[0]?.id || '',
        desc: '',
        bgMode: 'auto',
        bgPreset: 'auto',
        bgGradient: '',
        bgColor: '#0f172a'
    };

    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    const currentActualIdx = isEdit ? floorIndex : mode.floors.length;
    const currentTotal = isEdit ? mode.floors.length : mode.floors.length + 1;
    const currentStyle = getTowerFloorBgStyle(flr, currentActualIdx, currentTotal);

    const modalHtml = `
        <div id="add-flr-modal-bg" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-60 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div class="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden my-8">
                <div class="bg-gradient-to-r from-indigo-900 to-purple-900 p-5 text-white flex items-center justify-between border-b border-indigo-800">
                    <h4 class="font-black text-base">${isEdit ? 'Edit Lantai Menara' : 'Tambah Lantai Menara Baru'}</h4>
                    <button type="button" onclick="document.getElementById('add-flr-modal-bg').remove()" class="text-white hover:text-indigo-200 transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form onsubmit="handleSaveFloorForm(event, '${mode.id}', ${floorIndex})" class="p-6 space-y-4 text-xs font-medium text-slate-300">
                    <div>
                        <label class="block font-bold text-white mb-1">Nama Lantai <span class="text-rose-500">*</span></label>
                        <input type="text" id="flr-name" value="${flr.name}" required placeholder="Contoh: Lantai 1: Hardware Dasar" class="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:bg-slate-950 font-bold text-white">
                    </div>

                    <div>
                        <label class="block font-bold text-white mb-1">Pilih Game Edukasi Terhubung <span class="text-rose-500">*</span></label>
                        <select id="flr-game" class="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:bg-slate-950 font-bold text-white">
                            ${games.map(g => `
                                <option value="${g.id}" ${flr.gameId === g.id ? 'selected' : ''}>[${g.gameType}] ${gameEscapeHtml(g.title)}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block font-bold text-white mb-1">Deskripsi Lantai</label>
                        <textarea id="flr-desc" rows="2" placeholder="Petunjuk khusus lantai ini..." class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white">${flr.desc || ''}</textarea>
                    </div>

                    <!-- PENGATURAN WARNA BACKGROUND LANTAI -->
                    <div class="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                        <div class="flex items-center justify-between">
                            <label class="block font-black text-white text-xs flex items-center gap-1.5">
                                <i class="fa-solid fa-palette text-amber-400"></i> Warna Background Quest Lantai
                            </label>
                            <div class="flex items-center gap-2">
                                <label class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 cursor-pointer">
                                    <input type="radio" name="flr-bg-mode" value="auto" ${flr.bgMode !== 'manual' ? 'checked' : ''} onchange="toggleFloorBgMode(this.value)" class="accent-indigo-500">
                                    <span>Otomatis</span>
                                </label>
                                <label class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 cursor-pointer">
                                    <input type="radio" name="flr-bg-mode" value="manual" ${flr.bgMode === 'manual' ? 'checked' : ''} onchange="toggleFloorBgMode(this.value)" class="accent-indigo-500">
                                    <span>Manual</span>
                                </label>
                            </div>
                        </div>

                        <!-- Live Swatch Preview -->
                        <div id="flr-preview-swatch" class="p-4 rounded-xl border border-white/20 text-center transition-all duration-300 shadow-inner" style="background: ${currentStyle};">
                            <span class="font-extrabold text-white text-xs drop-shadow-md">Preview Tampilan Lantai Quest</span>
                        </div>

                        <!-- Manual Color Picker Options -->
                        <div id="flr-manual-color-section" class="${flr.bgMode === 'manual' ? '' : 'hidden'} space-y-3 pt-1">
                            <div>
                                <label class="block text-[11px] font-bold text-slate-400 mb-1.5">Pilih Preset Tema Warna:</label>
                                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    ${TOWER_COLOR_PRESETS.map(p => `
                                        <button type="button" onclick="selectFloorColorPreset('${p.gradient}', '${p.bgHex}')" class="p-2 rounded-xl text-left border border-white/10 hover:border-amber-400 transition cursor-pointer flex items-center gap-2 group" style="background: ${p.gradient};">
                                            <span class="w-3 h-3 rounded-full bg-white/40 group-hover:scale-125 transition"></span>
                                            <span class="text-[10px] font-black text-white truncate drop-shadow-xs">${p.name}</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-400 mb-1">Custom Warna Hex (Solid):</label>
                                    <div class="flex items-center gap-2">
                                        <input type="color" id="flr-color-picker" value="${flr.bgColor || '#0f172a'}" onchange="updateFloorCustomColor(this.value)" class="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0">
                                        <input type="text" id="flr-color-hex" value="${flr.bgColor || '#0f172a'}" oninput="updateFloorCustomColor(this.value)" class="flex-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono uppercase">
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-400 mb-1">Custom CSS Gradient:</label>
                                    <input type="text" id="flr-gradient-val" value="${flr.bgGradient || ''}" placeholder="linear-gradient(...)" oninput="updateFloorCustomGradient(this.value)" class="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                        <button type="button" onclick="document.getElementById('add-flr-modal-bg').remove()" class="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer">
                            Batal
                        </button>
                        <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow cursor-pointer">
                            Simpan Lantai
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('add-flr-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.toggleFloorBgMode = function(mode) {
    const sec = document.getElementById('flr-manual-color-section');
    const swatch = document.getElementById('flr-preview-swatch');
    if (mode === 'manual') {
        if (sec) sec.classList.remove('hidden');
        const grad = document.getElementById('flr-gradient-val')?.value;
        const hex = document.getElementById('flr-color-hex')?.value;
        if (swatch) swatch.style.background = grad || hex || '#0f172a';
    } else {
        if (sec) sec.classList.add('hidden');
        if (swatch) swatch.style.background = 'linear-gradient(135deg, #0f172a, #1e293b)';
    }
};

window.selectFloorColorPreset = function(gradient, bgHex) {
    const gradInput = document.getElementById('flr-gradient-val');
    const hexInput = document.getElementById('flr-color-hex');
    const colorPicker = document.getElementById('flr-color-picker');
    const swatch = document.getElementById('flr-preview-swatch');

    if (gradInput) gradInput.value = gradient;
    if (hexInput) hexInput.value = bgHex;
    if (colorPicker) colorPicker.value = bgHex;
    if (swatch) swatch.style.background = gradient;
};

window.updateFloorCustomColor = function(hex) {
    const hexInput = document.getElementById('flr-color-hex');
    const colorPicker = document.getElementById('flr-color-picker');
    const swatch = document.getElementById('flr-preview-swatch');

    if (hexInput) hexInput.value = hex;
    if (colorPicker) colorPicker.value = hex;
    if (swatch) swatch.style.background = hex;
};

window.updateFloorCustomGradient = function(grad) {
    const swatch = document.getElementById('flr-preview-swatch');
    if (swatch && grad) swatch.style.background = grad;
};

window.handleSaveFloorForm = async function(e, modeId, floorIndex) {
    if (e) e.preventDefault();
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const name = (document.getElementById('flr-name')?.value || '').trim();
    const gameId = document.getElementById('flr-game')?.value;
    const desc = (document.getElementById('flr-desc')?.value || '').trim();
    
    const bgModeRadio = document.querySelector('input[name="flr-bg-mode"]:checked');
    const bgMode = bgModeRadio ? bgModeRadio.value : 'auto';
    const bgGradient = (document.getElementById('flr-gradient-val')?.value || '').trim();
    const bgColor = (document.getElementById('flr-color-hex')?.value || '').trim();

    const newFlr = {
        id: floorIndex !== null && mode.floors[floorIndex] ? mode.floors[floorIndex].id : 'flr_' + Date.now(),
        name,
        gameId,
        desc,
        bgMode,
        bgGradient: bgMode === 'manual' ? bgGradient : '',
        bgColor: bgMode === 'manual' ? bgColor : ''
    };

    if (floorIndex !== null && mode.floors[floorIndex]) {
        mode.floors[floorIndex] = newFlr;
    } else {
        mode.floors.push(newFlr);
    }

    await saveGameModesToBackend();
    document.getElementById('add-flr-modal-bg')?.remove();
    showToast("Lantai menara & tema warna berhasil disimpan!", "success");
    openManageTowerQuestModal(modeId);
};

window.moveFloorOrder = async function(modeId, index, delta) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !mode.floors) return;

    const newIdx = index + delta;
    if (newIdx < 0 || newIdx >= mode.floors.length) return;

    const temp = mode.floors[index];
    mode.floors[index] = mode.floors[newIdx];
    mode.floors[newIdx] = temp;

    await saveGameModesToBackend();
    openManageTowerQuestModal(modeId);
};

window.deleteFloorFromTower = function(modeId, index) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !mode.floors) return;
    const flr = mode.floors[index];

    showGameConfirmModal({
        title: 'Hapus Lantai Menara',
        message: `Apakah Anda yakin ingin menghapus "${flr?.name || `Lantai #${index + 1}`}" dari Quest Menara ini?`,
        confirmText: 'Ya, Hapus Lantai',
        onConfirm: async () => {
            mode.floors.splice(index, 1);
            await saveGameModesToBackend();
            document.getElementById('add-flr-modal-bg')?.remove();
            showToast("Lantai menara telah dihapus.", "success");
            openManageTowerQuestModal(modeId);
        }
    });
};

window.toggleGameStatus = async function(gameId) {
    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = [...SAMPLE_SEED_GAMES];
    }
    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) return;

    game.status = game.status === 'active' ? 'inactive' : 'active';
    try {
        await fetch(`/api/games/${gameId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(game)
        });
        showToast(`Status game ${gameEscapeHtml(game.title)} diubah menjadi ${game.status === 'active' ? 'Aktif' : 'Nonaktif'}.`, 'success');
        renderGameAdminModule(document.getElementById('view-container'));
    } catch (err) {
        showToast("Gagal memperbarui status game", "error");
    }
};

window.deleteGameEntry = function(gameId) {
    if (!Array.isArray(appState.eduGames)) appState.eduGames = [];
    const game = appState.eduGames.find(g => g.id === gameId);
    const gameTitle = game?.title || 'Game Edukasi';

    showGameConfirmModal({
        title: 'Hapus Game Edukasi',
        message: `Apakah Anda yakin ingin menghapus game "${gameTitle}"? Data dan riwayat skor game ini akan dihapus secara permanen.`,
        confirmText: 'Ya, Hapus Game',
        onConfirm: async () => {
            try {
                await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
                appState.eduGames = appState.eduGames.filter(g => g.id !== gameId);
                showToast("Game berhasil dihapus", "success");
                renderGameAdminModule(document.getElementById('view-container'));
            } catch (err) {
                showToast("Gagal menghapus game", "error");
            }
        }
    });
};

// ============================================================================
// GAME EDITOR MODAL (2-STEP CREATION & SPECIALIZED GAME CONTENT MANAGER)
// ============================================================================

// STEP 1: Form Inisialisasi Metadata Game Baru
window.openCreateGameModal = function() {
    window.openGameMetadataModal(null);
};

// Edit Metadata untuk Game yang sudah ada
window.openEditGameMetadataModal = function(gameId) {
    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = [...SAMPLE_SEED_GAMES];
    }
    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) return;
    window.openGameMetadataModal(game);
};

// Backwards compatibility wrapper
window.openEditGameModal = function(gameId) {
    window.openGameContentEditorModal(gameId);
};

// Step 1 Modal: Inisialisasi Jenis Game, Mapel, Kelas, Waktu, XP
window.openGameMetadataModal = function(existingGame = null) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const isEdit = !!existingGame;
    const g = existingGame || {
        id: 'GAME_' + Date.now(),
        title: '',
        gameType: 'tebak_kata',
        subjectId: 'Semua Subject',
        classId: 'Semua Kelas',
        difficulty: 'Mudah',
        timeLimit: 120,
        rewardXp: 100,
        status: 'active'
    };

    const subjects = Array.isArray(appState.subjects) ? appState.subjects : [];

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
                <!-- Header -->
                <div class="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-md">
                            <i class="fa-solid fa-gamepad"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-base">${isEdit ? 'Edit Metadata Game Edukasi' : 'Buat Game Baru (Langkah 1/2)'}</h3>
                            <p class="text-xs text-slate-400">${isEdit ? 'Ubah informasi umum game edukasi.' : 'Atur jenis game, mata pelajaran, target kelas, durasi & reward nilai.'}</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-white p-2 text-lg">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Form Metadata -->
                <form id="game-metadata-form" onsubmit="${isEdit ? 'saveGameMetadataOnly(event)' : 'saveInitialGameMetadata(event)'}" class="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                    <input type="hidden" id="edit-game-id" value="${g.id}">

                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700 uppercase">Judul Permainan <span class="text-rose-500">*</span></label>
                        <input type="text" id="edit-game-title" required value="${gameEscapeAttr(g.title || '')}" placeholder="Contoh: Teka-Teki Silang Komputer Dasar" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Jenis Game <span class="text-rose-500">*</span></label>
                            <select id="edit-game-type" ${isEdit ? 'disabled' : ''} class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-emerald-800">
                                ${GAME_TYPES.map(t => `<option value="${t.id}" ${g.gameType === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Mata Pelajaran</label>
                            <select id="edit-game-subject" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                                <option value="Semua Subject">Semua Mata Pelajaran</option>
                                ${subjects.map(s => `<option value="${s.name || s.id}" ${g.subjectId === (s.name || s.id) ? 'selected' : ''}>${s.name || s.id}</option>`).join('')}
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Target Kelas</label>
                            <select id="edit-game-class" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                                <option value="Semua Kelas" ${g.classId === 'Semua Kelas' ? 'selected' : ''}>Semua Kelas</option>
                                <option value="Kelas X" ${g.classId === 'Kelas X' ? 'selected' : ''}>Kelas X</option>
                                <option value="Kelas XI" ${g.classId === 'Kelas XI' ? 'selected' : ''}>Kelas XI</option>
                                <option value="Kelas XII" ${g.classId === 'Kelas XII' ? 'selected' : ''}>Kelas XII</option>
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Tingkat Kesulitan</label>
                            <select id="edit-game-difficulty" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                                <option value="Mudah" ${g.difficulty === 'Mudah' ? 'selected' : ''}>Mudah</option>
                                <option value="Sedang" ${g.difficulty === 'Sedang' ? 'selected' : ''}>Sedang</option>
                                <option value="Sulit" ${g.difficulty === 'Sulit' ? 'selected' : ''}>Sulit</option>
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Batas Waktu (Detik)</label>
                            <input type="number" id="edit-game-timelimit" value="${g.timeLimit || 120}" min="0" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Point / Nilai (Reward XP)</label>
                            <input type="number" id="edit-game-xp" value="${g.rewardXp || 100}" min="10" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-amber-700">
                        </div>
                    </div>

                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700 uppercase">Status Permainan</label>
                        <select id="edit-game-status" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold">
                            <option value="active" ${g.status === 'active' ? 'selected' : ''}>Aktif</option>
                            <option value="inactive" ${g.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
                        </select>
                    </div>

                    <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-2.5 text-emerald-800 text-[11px] font-medium">
                        <i class="fa-solid fa-circle-info text-emerald-600 text-base"></i>
                        <span>${isEdit ? 'Perubahan metadata akan memperbarui kartu game ini.' : 'Setelah mengklik "Simpan & Atur Soal", kartu game ini akan otomatis dibuat & editor aturan khusus gamenya akan dibuka.'}</span>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">Batal</button>
                        <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer">
                            <span>${isEdit ? 'Simpan Metadata' : 'Oke / Simpan & Lanjut Atur Soal'}</span> <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

// Simpan Inisialisasi Metadata (Langkah 1) & Langsung Buka Editor Soal Khusus (Langkah 2)
window.saveInitialGameMetadata = async function(event) {
    event.preventDefault();

    const id = document.getElementById('edit-game-id').value;
    const title = document.getElementById('edit-game-title').value.trim();
    const gameType = document.getElementById('edit-game-type').value;
    const subjectId = document.getElementById('edit-game-subject').value;
    const classId = document.getElementById('edit-game-class').value;
    const difficulty = document.getElementById('edit-game-difficulty').value;
    const timeLimit = parseInt(document.getElementById('edit-game-timelimit').value, 10) || 120;
    const rewardXp = parseInt(document.getElementById('edit-game-xp').value, 10) || 100;
    const status = document.getElementById('edit-game-status').value;

    const typeInfo = GAME_TYPES.find(t => t.id === gameType) || { name: 'Game' };

    // Default structure according to game type
    const newGame = {
        id,
        title,
        gameType,
        subjectId,
        classId,
        difficulty,
        timeLimit,
        rewardXp,
        status,
        prompt: `Selesaikan tantangan ${typeInfo.name} berikut dengan cermat!`,
        answerKey: 'KEYBOARD',
        hints: ['Petunjuk 1'],
        imageUrl: '',
        correctAnswer: 'BENAR',
        explanation: '',
        wordsToFind: ['MONITOR', 'MOUSE', 'MODEM'],
        pairs: [
            { term: 'CPU', match: 'Otak Komputer' },
            { term: 'RAM', match: 'Memori Sementara' }
        ],
        crosswordData: {
            gridSize: { rows: 8, cols: 8 },
            clues: [
                { number: 1, direction: 'across', row: 1, col: 1, clue: 'Otak pemroses utama komputer', answer: 'CPU' },
                { number: 2, direction: 'across', row: 3, col: 1, clue: 'Memori penyimpanan sementara', answer: 'RAM' }
            ]
        }
    };

    try {
        const res = await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newGame)
        });
        const data = await res.json();
        if (data.success || res.ok) {
            if (!Array.isArray(appState.eduGames)) appState.eduGames = [];
            appState.eduGames.push(newGame);

            showToast(`Kartu game "${title}" berhasil dibuat! Silakan kelola aturan & soal gamenya.`, "success");
            
            // Refresh view to show newly created card in background
            if (typeof renderGameAdminModule === 'function') {
                renderGameAdminModule(document.getElementById('view-container'));
            }

            // Immediately open Specialized Content Editor
            window.openGameContentEditorModal(newGame.id);
        } else {
            showToast(data.message || "Gagal membuat game baru", "error");
        }
    } catch (err) {
        // Fallback local state save
        if (!Array.isArray(appState.eduGames)) appState.eduGames = [];
        appState.eduGames.push(newGame);
        showToast(`Kartu game "${title}" dibuat (Lokal)!`, "success");
        if (typeof renderGameAdminModule === 'function') {
            renderGameAdminModule(document.getElementById('view-container'));
        }
        window.openGameContentEditorModal(newGame.id);
    }
};

window.saveGameMetadataOnly = async function(event) {
    event.preventDefault();
    const id = document.getElementById('edit-game-id').value;
    const game = appState.eduGames.find(g => g.id === id);
    if (!game) return;

    game.title = document.getElementById('edit-game-title').value.trim();
    game.subjectId = document.getElementById('edit-game-subject').value;
    game.classId = document.getElementById('edit-game-class').value;
    game.difficulty = document.getElementById('edit-game-difficulty').value;
    game.timeLimit = parseInt(document.getElementById('edit-game-timelimit').value, 10) || 120;
    game.rewardXp = parseInt(document.getElementById('edit-game-xp').value, 10) || 100;
    game.status = document.getElementById('edit-game-status').value;

    try {
        await fetch(`/api/games/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(game)
        });
        showToast("Metadata game berhasil diperbarui!", "success");
        document.getElementById('modal-container').innerHTML = '';
        renderGameAdminModule(document.getElementById('view-container'));
    } catch (err) {
        showToast("Metadata game diperbarui (Lokal)", "info");
        document.getElementById('modal-container').innerHTML = '';
        renderGameAdminModule(document.getElementById('view-container'));
    }
};

// STEP 2: SPECIALIZED CONTENT & RULES EDITOR PER GAME MODE
window.openGameContentEditorModal = function(gameId) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = [...SAMPLE_SEED_GAMES];
    }

    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) {
        showToast("Game tidak ditemukan", "error");
        return;
    }

    const typeInfo = GAME_TYPES.find(t => t.id === game.gameType) || { name: game.gameType, icon: 'fa-gamepad' };

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div class="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
                <!-- Header Banner -->
                <div class="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                            <i class="fa-solid ${typeInfo.icon}"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-extrabold uppercase text-[10px] rounded-full border border-emerald-500/30">
                                    ${typeInfo.name}
                                </span>
                                <span class="text-xs text-slate-400 font-semibold">${game.subjectId || 'Umum'} • ${game.classId || 'Semua Kelas'}</span>
                            </div>
                            <h3 class="font-extrabold text-base text-white mt-0.5">${gameEscapeHtml(game.title)}</h3>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-white p-2 text-lg">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Info Notice -->
                <div class="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between text-xs font-semibold text-amber-900">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-sliders text-amber-600"></i>
                        <span>Kelola Aturan, Petunjuk & Soal Khusus Game <strong>${typeInfo.name}</strong></span>
                    </div>
                    <span class="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">${game.timeLimit} Detik • +${game.rewardXp} XP</span>
                </div>

                <!-- Form Content Specific Editor -->
                <form id="game-content-form" onsubmit="saveGameContent(event, '${game.id}')" class="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                    
                    <!-- Common Prompt Field -->
                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700 uppercase">Instruksi / Soal Utama Game <span class="text-rose-500">*</span></label>
                        <textarea id="edit-content-prompt" rows="2" placeholder="Masukkan instruksi atau narasi tantangan bagi siswa..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">${gameEscapeHtml(game.prompt || '')}</textarea>
                    </div>

                    <!-- Dynamic Editor Content Container -->
                    <div id="specialized-game-editor-body">
                        ${renderSpecializedGameEditor(game)}
                    </div>

                    <!-- Footer Actions -->
                    <div class="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onclick="launchGamePlayPreview('${game.id}')" class="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-play"></i> <span>Uji Coba Game</span>
                        </button>
                        
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">Batal</button>
                            <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer">
                                <i class="fa-solid fa-floppy-disk"></i> <span>Simpan Konten Game</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
};

// Renderer khusus untuk masing-masing jenis game
function renderSpecializedGameEditor(game) {
    const type = game.gameType || 'tebak_kata';

    // 1. TEKA-TEKI SILANG (CROSSWORD)
    if (type === 'crossword') {
        const clues = game.crosswordData?.clues || [
            { number: 1, direction: 'across', row: 1, col: 1, clue: 'Otak pemroses utama pada komputer (3 Huruf)', answer: 'CPU', points: 30, initialHint: true },
            { number: 2, direction: 'down', row: 1, col: 1, clue: 'Perangkat keras pengolah data utama (8 Huruf)', answer: 'COMPUTER', points: 50, initialHint: true },
            { number: 3, direction: 'across', row: 3, col: 1, clue: 'Modulasi sinyal jaringan internet (5 Huruf)', answer: 'MODEM', points: 30, initialHint: true },
            { number: 4, direction: 'across', row: 4, col: 1, clue: 'Perangkat pencetak dokumen kertas (7 Huruf)', answer: 'PRINTER', points: 40, initialHint: true }
        ];

        return `
            <div class="space-y-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-indigo-950 uppercase flex items-center gap-1.5 text-xs">
                        <i class="fa-solid fa-puzzle-piece text-indigo-600"></i> Daftar Petunjuk Teka-Teki Silang (Clues TTS)
                    </h4>
                    <button type="button" onclick="addCrosswordClueRowInput()" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition cursor-pointer">
                        + Tambah Soal TTS
                    </button>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-indigo-100/70 text-indigo-900 font-bold">
                                <th class="p-2 rounded-l-lg w-10 text-center">No</th>
                                <th class="p-2 w-28">Arah</th>
                                <th class="p-2 w-20">Posisi (B,K)</th>
                                <th class="p-2">Petunjuk Soal</th>
                                <th class="p-2 w-32">Kunci Jawaban</th>
                                <th class="p-2 w-16 text-center">Poin</th>
                                <th class="p-2 w-12 text-center">Clue</th>
                                <th class="p-2 w-10 text-center rounded-r-lg">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="crossword-clues-list" class="divide-y divide-indigo-100">
                            ${clues.map((c, idx) => `
                                <tr class="cw-clue-row">
                                    <td class="p-1 text-center">
                                        <input type="number" class="cw-no w-9 px-1 py-1 text-center bg-white border border-slate-200 rounded-lg font-bold text-xs" value="${c.number || idx+1}">
                                    </td>
                                    <td class="p-1">
                                        <select class="cw-dir w-full px-1.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-xs">
                                            <option value="across" ${c.direction === 'across' ? 'selected' : ''}>Mendatar</option>
                                            <option value="down" ${c.direction === 'down' ? 'selected' : ''}>Menurun</option>
                                        </select>
                                    </td>
                                    <td class="p-1">
                                        <div class="flex items-center gap-1 text-[11px]">
                                            <input type="number" min="1" max="15" class="cw-row w-9 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-center" value="${c.row || 1}" title="Baris (Row)">
                                            <input type="number" min="1" max="15" class="cw-col w-9 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-center" value="${c.col || 1}" title="Kolom (Col)">
                                        </div>
                                    </td>
                                    <td class="p-1">
                                        <input type="text" class="cw-clue w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium text-xs" value="${c.clue || ''}" placeholder="Petunjuk pertanyaan...">
                                    </td>
                                    <td class="p-1">
                                        <input type="text" class="cw-answer w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-extrabold uppercase text-indigo-700 text-xs" value="${c.answer || ''}" placeholder="JAWABAN">
                                    </td>
                                    <td class="p-1">
                                        <input type="number" min="5" step="5" class="cw-points w-14 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-amber-700 text-center text-xs" value="${c.points || 20}" title="Poin Kolom">
                                    </td>
                                    <td class="p-1 text-center">
                                        <input type="checkbox" class="cw-hint-check accent-emerald-600 w-4 h-4 cursor-pointer" ${c.initialHint !== false ? 'checked' : ''} title="Tampilkan huruf awal sebagai petunjuk">
                                    </td>
                                    <td class="p-1 text-center">
                                        <button type="button" onclick="this.closest('tr').remove()" class="text-rose-500 hover:text-rose-700 p-1">
                                            <i class="fa-solid fa-trash-can"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // 2. CARI KATA (WORD SEARCH)
    if (type === 'word_search') {
        const words = Array.isArray(game.wordsToFind) && game.wordsToFind.length > 0 ? game.wordsToFind : ['MONITOR', 'KEYBOARD', 'MOUSE'];
        const clue = (game.hints && game.hints[0]) || game.prompt || 'Hardware Computer';
        return `
            <div class="space-y-4 bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-purple-950 uppercase flex items-center gap-1.5 text-xs">
                        <i class="fa-solid fa-magnifying-glass text-purple-600"></i> Aturan Soal & Clue Cari Kata (Word Search)
                    </h4>
                </div>

                <div class="space-y-1 bg-white p-3 rounded-2xl border border-purple-200">
                    <label class="block font-bold text-slate-700 text-xs uppercase">Clue / Petunjuk Utama Game <span class="text-rose-500">*</span></label>
                    <input type="text" id="edit-content-hint" value="${clue}" placeholder="Misal: Hardware Computer / Perangkat Keras Komputer" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-extrabold text-purple-950 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none">
                    <p class="text-[10px] text-slate-500 font-medium mt-1">Siswa akan melihat clue ini untuk menebak kata-kata kunci tersembunyi pada papan huruf.</p>
                </div>
                
                <div class="space-y-2 bg-white p-3 rounded-2xl border border-purple-200">
                    <label class="block font-bold text-slate-700 text-xs uppercase">Kunci Jawaban (Kata-kata Tersembunyi Dalam Grid):</label>
                    <div id="word-search-tags" class="flex items-center gap-2 flex-wrap min-h-[40px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                        ${words.map((w, idx) => `
                            <span class="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-900 font-extrabold rounded-full text-xs shadow-2xs">
                                ${w}
                                <button type="button" onclick="removeWordSearchTag(${idx})" class="text-purple-500 hover:text-purple-900 font-black ml-1 cursor-pointer">×</button>
                            </span>
                        `).join('')}
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                        <input type="text" id="new-word-search-input" onkeydown="if(event.key==='Enter'){event.preventDefault();addWordSearchTag();}" placeholder="Masukkan kata baru (misal: MONITOR, KEYBOARD, MOUSE)..." class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-purple-950 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none">
                        <button type="button" onclick="addWordSearchTag()" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-sm">
                            + Tambah Kata
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 3. MEMORY MATCH
    if (type === 'memory_match') {
        const pairs = Array.isArray(game.pairs) && game.pairs.length > 0 ? game.pairs : [{ term: '', match: '' }];
        return `
            <div class="space-y-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-amber-950 uppercase flex items-center gap-1.5 text-xs">
                        <i class="fa-solid fa-link text-amber-600"></i> Pasangan Pertanyaan & Definisi
                    </h4>
                    <button type="button" onclick="addPairRowInput()" class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer">
                        + Tambah Pasangan
                    </button>
                </div>

                <div id="pairs-inputs-list" class="space-y-2">
                    ${pairs.map((p, idx) => `
                        <div class="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-2xs">
                            <input type="text" class="pair-term-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-amber-900" placeholder="Istilah / Soal ${idx+1} (misal: CPU)" value="${p.term || ''}">
                            <span class="text-amber-500 font-extrabold text-sm">&leftrightarrow;</span>
                            <input type="text" class="pair-match-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium" placeholder="Definisi / Jawaban (misal: Otak Komputer)" value="${p.match || ''}">
                            <button type="button" onclick="this.closest('div').remove()" class="p-1.5 text-rose-500 hover:text-rose-700">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 3B. LABIRIN BENANG KUSUT
    if (type === 'labirin') {
        const options = Array.isArray(game.options) && game.options.length > 0 
            ? game.options 
            : (game.answerKey ? [game.answerKey, 'RAM', 'Printer'] : ['CPU', 'RAM', 'Printer']);
        const currentAnswer = game.answerKey || options[0];

        return `
            <div class="space-y-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-amber-950 uppercase flex items-center gap-1.5 text-xs">
                        <i class="fa-solid fa-flag-checkered text-amber-600"></i> Pilihan Jawaban Finish (Baris Atas)
                    </h4>
                    <button type="button" onclick="addLabirinOptionRowInput()" class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer">
                        + Tambah Pilihan
                    </button>
                </div>
                <p class="text-[11px] text-slate-600 font-medium">Tentukan pilihan jawaban yang tampil di baris ATAS (FINISH). Pilih salah satu radio button sebagai Kunci Jawaban Benar.</p>

                <div id="labirin-options-list" class="space-y-2">
                    ${options.map((opt, idx) => `
                        <div class="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-2xs">
                            <label class="flex items-center gap-1.5 cursor-pointer bg-amber-100/80 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg border border-amber-300 transition">
                                <input type="radio" name="labirin-correct-opt" class="labirin-opt-radio w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer" ${opt === currentAnswer || (idx === 0 && !options.includes(currentAnswer)) ? 'checked' : ''}>
                                <span class="text-[11px] font-black text-amber-950">Kunci Benar</span>
                            </label>
                            <input type="text" class="labirin-opt-text flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800" placeholder="Pilihan ${idx+1} (misal: ${idx===0?'CPU':(idx===1?'RAM':'Printer')})" value="${opt || ''}">
                            <button type="button" onclick="this.closest('div').remove()" class="p-1.5 text-rose-500 hover:text-rose-700">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 4. BENAR ATAU SALAH (TRUE / FALSE)
    if (type === 'true_false') {
        return `
            <div class="space-y-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                <h4 class="font-bold text-emerald-950 uppercase flex items-center gap-1.5 text-xs">
                    <i class="fa-solid fa-circle-check text-emerald-600"></i> Aturan Kunci Benar atau Salah
                </h4>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700">Pernyataan Di Atas Adalah:</label>
                        <select id="edit-content-tf-correct" class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-extrabold text-emerald-700 text-sm">
                            <option value="BENAR" ${game.correctAnswer === 'BENAR' ? 'selected' : ''}>BENAR</option>
                            <option value="SALAH" ${game.correctAnswer === 'SALAH' ? 'selected' : ''}>SALAH</option>
                        </select>
                    </div>

                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700">Penjelasan / Umbal Balik (Feedback)</label>
                        <input type="text" id="edit-content-explanation" value="${game.explanation || ''}" placeholder="Penjelasan edukatif setelah siswa menjawab..." class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-medium">
                    </div>
                </div>
            </div>
        `;
    }

    // 5. TEBAK GAMBAR
    if (type === 'tebak_gambar') {
        return `
            <div class="space-y-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <h4 class="font-bold text-blue-950 uppercase flex items-center gap-1.5 text-xs">
                    <i class="fa-solid fa-image text-blue-600"></i> Upload Gambar Soal & Kunci Jawaban
                </h4>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="space-y-2 sm:col-span-2 bg-white p-3.5 rounded-2xl border border-blue-200">
                        <label class="block font-bold text-slate-800 text-xs">Upload File Gambar Soal (Bukan URL)</label>
                        <div class="flex items-center gap-3 flex-wrap">
                            <label class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-sm inline-flex items-center gap-2">
                                <i class="fa-solid fa-file-image"></i> Pilih File Gambar
                                <input type="file" accept="image/*" class="hidden" onchange="handleImageFileUpload(event, 'tg-img-preview', 'edit-content-image')">
                            </label>
                            <button type="button" onclick="clearUploadedImage('tg-img-preview', 'edit-content-image')" class="px-3 py-2 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 font-bold rounded-xl text-xs transition">
                                <i class="fa-solid fa-trash-can mr-1"></i> Hapus Gambar
                            </button>
                        </div>
                        <input type="hidden" id="edit-content-image" value="${gameEscapeAttr(gameSafeImageUrl(game.imageUrl))}">
                        <div class="mt-2">
                            <img id="tg-img-preview" src="${gameEscapeAttr(gameSafeImageUrl(game.imageUrl))}" class="${game.imageUrl ? 'w-48 h-36 object-cover rounded-2xl border-2 border-blue-300 shadow-md' : 'hidden'}">
                        </div>
                    </div>

                    <div class="space-y-1 sm:col-span-2">
                        <label class="block font-bold text-slate-700">Kunci Jawaban (Satu Kata/Frasa)</label>
                        <input type="text" id="edit-content-answer" value="${game.answerKey || ''}" placeholder="Contoh: MONITOR" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-black uppercase text-blue-800 tracking-widest text-sm">
                    </div>

                    <!-- 4 Progressive Hints Input -->
                    <div class="space-y-3 sm:col-span-2 bg-white p-3.5 rounded-2xl border border-blue-200">
                        <label class="block font-bold text-blue-950 text-xs uppercase flex items-center gap-1.5">
                            <i class="fa-solid fa-key text-blue-600"></i> 4 Petunjuk Bantuan (Sejalan Dengan 4 Bagian Gambar Terbuka)
                        </label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                                <span class="font-bold text-slate-600 block mb-1">Clue 1 (1/4 Gambar Terbuka)</span>
                                <input type="text" id="edit-tg-hint-1" value="${(game.hints && game.hints[0]) || ''}" placeholder="Petunjuk ke-1 (misal: Perangkat keras output)..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                            </div>
                            <div>
                                <span class="font-bold text-slate-600 block mb-1">Clue 2 (2/4 Gambar Terbuka)</span>
                                <input type="text" id="edit-tg-hint-2" value="${(game.hints && game.hints[1]) || ''}" placeholder="Petunjuk ke-2 (misal: Menampilkan grafik visual)..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                            </div>
                            <div>
                                <span class="font-bold text-slate-600 block mb-1">Clue 3 (3/4 Gambar Terbuka)</span>
                                <input type="text" id="edit-tg-hint-3" value="${(game.hints && game.hints[2]) || ''}" placeholder="Petunjuk ke-3 (misal: Memiliki port HDMI/VGA)..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                            </div>
                            <div>
                                <span class="font-bold text-slate-600 block mb-1">Clue 4 (4/4 Gambar Terbuka Penuh)</span>
                                <input type="text" id="edit-tg-hint-4" value="${(game.hints && game.hints[3]) || ''}" placeholder="Petunjuk ke-4 (misal: Berada di atas meja kerja)..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 6. PUZZLE GAMBAR (3x3 IMAGE PUZZLE)
    if (type === 'image_puzzle') {
        const defaultImg = game.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80';
        return `
            <div class="space-y-4 bg-lime-50/50 p-4 rounded-2xl border border-lime-100">
                <h4 class="font-bold text-lime-950 uppercase flex items-center gap-1.5 text-xs">
                    <i class="fa-solid fa-border-all text-lime-600"></i> Form File Gambar Puzzle (3x3 Grid - 9 Potongan)
                </h4>

                <div class="space-y-2 bg-white p-3.5 rounded-2xl border border-lime-200">
                    <label class="block font-bold text-slate-800 text-xs">Upload File Gambar Utama Untuk Dipecah Jadi 9 Bagian <span class="text-rose-500">*</span></label>
                    <div class="flex items-center gap-3 flex-wrap">
                        <label class="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-sm inline-flex items-center gap-2">
                            <i class="fa-solid fa-file-image"></i> Pilih File Gambar
                            <input type="file" accept="image/*" class="hidden" onchange="handleImageFileUpload(event, 'pz-img-preview', 'edit-content-image')">
                        </label>
                        <button type="button" onclick="clearUploadedImage('pz-img-preview', 'edit-content-image')" class="px-3 py-2 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 font-bold rounded-xl text-xs transition">
                            <i class="fa-solid fa-trash-can mr-1"></i> Hapus Gambar
                        </button>
                    </div>
                    <input type="hidden" id="edit-content-image" value="${defaultImg}">
                    <div class="mt-2">
                        <img id="pz-img-preview" src="${defaultImg}" class="w-44 h-44 object-cover rounded-2xl border-2 border-lime-400 shadow-md">
                    </div>
                    <p class="text-[10px] text-slate-500 font-medium mt-1">Sistem secara otomatis memotong gambar ini menjadi 9 bagian (3x3) dan mengacak posisinya. Tugas siswa menyusun gambar kembali hingga utuh dengan menukar bagian-bagian gambar.</p>
                </div>
            </div>
        `;
    }

    // DEFAULT / TEBAK KATA / SUSUN KATA
    return `
        <div class="space-y-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
            <h4 class="font-bold text-emerald-950 uppercase flex items-center gap-1.5 text-xs">
                <i class="fa-solid fa-key text-emerald-600"></i> Kunci Jawaban & Upload Gambar Soal
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="space-y-1">
                    <label class="block font-bold text-slate-700">Kunci Jawaban Utuh <span class="text-rose-500">*</span></label>
                    <input type="text" id="edit-content-answer" value="${game.answerKey || ''}" placeholder="Contoh: KEYBOARD" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-black uppercase text-emerald-800 tracking-widest text-sm">
                </div>

                <div class="space-y-2 bg-white p-3 rounded-2xl border border-emerald-200">
                    <label class="block font-bold text-slate-700 text-xs">Upload Gambar (File Gambar)</label>
                    <div class="flex items-center gap-2 flex-wrap">
                        <label class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-xs inline-flex items-center gap-1.5">
                            <i class="fa-solid fa-upload"></i> Pilih File
                            <input type="file" accept="image/*" class="hidden" onchange="handleImageFileUpload(event, 'gen-img-preview', 'edit-content-image')">
                        </label>
                        <button type="button" onclick="clearUploadedImage('gen-img-preview', 'edit-content-image')" class="px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:text-rose-600 font-bold rounded-xl text-xs transition">
                            Hapus
                        </button>
                    </div>
                    <input type="hidden" id="edit-content-image" value="${gameEscapeAttr(gameSafeImageUrl(game.imageUrl))}">
                    <img id="gen-img-preview" src="${gameEscapeAttr(gameSafeImageUrl(game.imageUrl))}" class="${game.imageUrl ? 'w-32 h-24 object-cover rounded-xl border border-emerald-300 mt-1' : 'hidden'}">
                </div>

                <div class="space-y-1 sm:col-span-2">
                    <label class="block font-bold text-slate-700">Petunjuk / Clue Tambahan</label>
                    <input type="text" id="edit-content-hint" value="${(game.hints && game.hints[0]) || ''}" placeholder="Clue bantuan jika siswa kesulitan..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium">
                </div>
            </div>
        </div>
    `;
}

// SIMPAN KONTEN KHUSUS GAME
window.saveGameContent = async function(event, gameId) {
    event.preventDefault();

    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) return;

    const promptEl = document.getElementById('edit-content-prompt');
    if (promptEl) game.prompt = promptEl.value.trim();

    const answerEl = document.getElementById('edit-content-answer');
    if (answerEl) game.answerKey = answerEl.value.trim().toUpperCase();

    const imgEl = document.getElementById('edit-content-image');
    if (imgEl) game.imageUrl = imgEl.value.trim();

    const hintEl = document.getElementById('edit-content-hint');
    if (hintEl && hintEl.value.trim()) game.hints = [hintEl.value.trim()];

    if (game.gameType === 'tebak_gambar') {
        const h1 = document.getElementById('edit-tg-hint-1')?.value.trim();
        const h2 = document.getElementById('edit-tg-hint-2')?.value.trim();
        const h3 = document.getElementById('edit-tg-hint-3')?.value.trim();
        const h4 = document.getElementById('edit-tg-hint-4')?.value.trim();
        game.hints = [
            h1 || 'Clue 1: Perhatikan bentuk awal gambar',
            h2 || 'Clue 2: Perhatikan fungsi utama objek ini',
            h3 || 'Clue 3: Perhatikan warna dan karakteristiknya',
            h4 || 'Clue 4: Nama objek ini sangat populer'
        ];
    }

    const tfEl = document.getElementById('edit-content-tf-correct');
    if (tfEl) game.correctAnswer = tfEl.value;

    const expEl = document.getElementById('edit-content-explanation');
    if (expEl) game.explanation = expEl.value.trim();

    // Save Word Search Words
    const wordTagsContainer = document.getElementById('word-search-tags');
    if (wordTagsContainer) {
        const wordSpans = wordTagsContainer.querySelectorAll('span');
        if (wordSpans.length > 0) {
            game.wordsToFind = [];
            wordSpans.forEach(span => {
                let text = span.innerText || span.textContent || '';
                text = text.replace(/×/g, '').trim().toUpperCase();
                if (text) game.wordsToFind.push(text);
            });
        }
    }

    // Save Labirin Options
    const labirinOptInputs = document.querySelectorAll('.labirin-opt-text');
    if (labirinOptInputs.length > 0) {
        const options = [];
        let correctKey = '';
        labirinOptInputs.forEach((optInput) => {
            const val = optInput.value.trim();
            if (val) {
                options.push(val);
                const parent = optInput.closest('div');
                const radio = parent ? parent.querySelector('.labirin-opt-radio') : null;
                if (radio && radio.checked) {
                    correctKey = val;
                }
            }
        });
        if (options.length > 0) {
            game.options = options;
            if (correctKey) game.answerKey = correctKey;
            else if (!game.answerKey) game.answerKey = options[0];
        }
    }

    // Save Pairs
    const pairTermInputs = document.querySelectorAll('.pair-term-input');
    const pairMatchInputs = document.querySelectorAll('.pair-match-input');
    if (pairTermInputs.length > 0) {
        game.pairs = [];
        pairTermInputs.forEach((tInput, idx) => {
            const term = tInput.value.trim();
            const match = pairMatchInputs[idx] ? pairMatchInputs[idx].value.trim() : '';
            if (term && match) game.pairs.push({ term, match });
        });
    }

    // Save Crossword Clues
    const cwRows = document.querySelectorAll('.cw-clue-row');
    if (cwRows.length > 0) {
        const clues = [];
        cwRows.forEach((row, idx) => {
            const num = parseInt(row.querySelector('.cw-no')?.value, 10) || (idx + 1);
            const dir = row.querySelector('.cw-dir')?.value || 'across';
            const r = parseInt(row.querySelector('.cw-row')?.value, 10) || 1;
            const c = parseInt(row.querySelector('.cw-col')?.value, 10) || 1;
            const clue = row.querySelector('.cw-clue')?.value.trim() || '';
            const answer = row.querySelector('.cw-answer')?.value.trim().toUpperCase() || '';
            const points = parseInt(row.querySelector('.cw-points')?.value, 10) || 20;
            const initialHint = row.querySelector('.cw-hint-check')?.checked !== false;

            if (clue && answer) {
                clues.push({ number: num, direction: dir, row: r, col: c, clue, answer, points, initialHint });
            }
        });
        if (clues.length > 0) {
            game.crosswordData = { gridSize: { rows: 8, cols: 8 }, clues };
        }
    }

    try {
        await fetch(`/api/games/${gameId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(game)
        });
        showToast("Konten & aturan game berhasil disimpan!", "success");
        document.getElementById('modal-container').innerHTML = '';
        renderGameAdminModule(document.getElementById('view-container'));
    } catch (err) {
        showToast("Konten game disimpan (Lokal)", "info");
        document.getElementById('modal-container').innerHTML = '';
        renderGameAdminModule(document.getElementById('view-container'));
    }
};

// Helper row adders
window.addLabirinOptionRowInput = function() {
    const list = document.getElementById('labirin-options-list');
    if (!list) return;
    const idx = list.children.length + 1;
    const div = document.createElement('div');
    div.className = "flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-2xs";
    div.innerHTML = `
        <label class="flex items-center gap-1.5 cursor-pointer bg-amber-100/80 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg border border-amber-300 transition">
            <input type="radio" name="labirin-correct-opt" class="labirin-opt-radio w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer">
            <span class="text-[11px] font-black text-amber-950">Kunci Benar</span>
        </label>
        <input type="text" class="labirin-opt-text flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800" placeholder="Pilihan ${idx}" value="">
        <button type="button" onclick="this.closest('div').remove()" class="p-1.5 text-rose-500 hover:text-rose-700">
            <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    list.appendChild(div);
};

window.addCrosswordClueRowInput = function() {
    const list = document.getElementById('crossword-clues-list');
    if (!list) return;
    const count = list.children.length + 1;
    const tr = document.createElement('tr');
    tr.className = "cw-clue-row";
    tr.innerHTML = `
        <td class="p-1 text-center">
            <input type="number" class="cw-no w-9 px-1 py-1 text-center bg-white border border-slate-200 rounded-lg font-bold text-xs" value="${count}">
        </td>
        <td class="p-1">
            <select class="cw-dir w-full px-1.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-xs">
                <option value="across">Mendatar</option>
                <option value="down">Menurun</option>
            </select>
        </td>
        <td class="p-1">
            <div class="flex items-center gap-1 text-[11px]">
                <input type="number" min="1" max="15" class="cw-row w-9 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-center" value="1" title="Baris (Row)">
                <input type="number" min="1" max="15" class="cw-col w-9 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-center" value="1" title="Kolom (Col)">
            </div>
        </td>
        <td class="p-1">
            <input type="text" class="cw-clue w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium text-xs" placeholder="Petunjuk pertanyaan ${count}...">
        </td>
        <td class="p-1">
            <input type="text" class="cw-answer w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-extrabold uppercase text-indigo-700 text-xs" placeholder="JAWABAN">
        </td>
        <td class="p-1">
            <input type="number" min="5" step="5" class="cw-points w-14 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-amber-700 text-center text-xs" value="20" title="Poin Kolom">
        </td>
        <td class="p-1 text-center">
            <input type="checkbox" class="cw-hint-check accent-emerald-600 w-4 h-4 cursor-pointer" checked title="Tampilkan huruf awal sebagai petunjuk">
        </td>
        <td class="p-1 text-center">
            <button type="button" onclick="this.closest('tr').remove()" class="text-rose-500 hover:text-rose-700 p-1">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;
    list.appendChild(tr);
};

window.addPairRowInput = function() {
    const list = document.getElementById('pairs-inputs-list');
    if (!list) return;
    const count = list.children.length + 1;
    const div = document.createElement('div');
    div.className = "flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-2xs";
    div.innerHTML = `
        <input type="text" class="pair-term-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-amber-900" placeholder="Istilah ${count}">
        <span class="text-amber-500 font-extrabold text-sm">&leftrightarrow;</span>
        <input type="text" class="pair-match-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium" placeholder="Definisi / Pasangan ${count}">
        <button type="button" onclick="this.closest('div').remove()" class="p-1.5 text-rose-500 hover:text-rose-700">
            <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    list.appendChild(div);
};

window.addWordSearchTag = function() {
    const input = document.getElementById('new-word-search-input');
    if (!input || !input.value.trim()) return;
    const val = input.value.trim().toUpperCase();
    input.value = '';

    const container = document.getElementById('word-search-tags');
    if (!container) return;

    const span = document.createElement('span');
    span.className = "inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-900 font-extrabold rounded-full text-xs";
    span.innerHTML = `
        ${val}
        <button type="button" onclick="this.parentElement.remove()" class="text-purple-500 hover:text-purple-900 font-black ml-1">×</button>
    `;
    container.appendChild(span);
};

window.removeWordSearchTag = function(idx) {
    const container = document.getElementById('word-search-tags');
    if (!container) return;
    if (container.children[idx]) {
        container.children[idx].remove();
    }
};

// ============================================================================
// STUDENT VIEW: GAME HUB, GAMIFICATION BANNER & LEADERBOARD
// ============================================================================
export function renderGameStudentModule(container) {
    if (!container) return;

    // Visibility Check
    if (appState.settings.isGameMenuVisibleForStudent === false) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 animate-fade-in">
                <div class="w-24 h-24 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center text-5xl">
                    <i class="fa-solid fa-gamepad"></i>
                </div>
                <div>
                    <h2 class="text-xl font-black text-slate-800">Menu Game Sedang Nonaktif</h2>
                    <p class="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
                        Mohon maaf, menu Game Edukasi saat ini sedang dinonaktifkan oleh Bapak/Ibu Guru. Silakan fokus pada pengerjaan tugas atau materi lainnya.
                    </p>
                </div>
                <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="px-6 py-3 bg-slate-900 text-white font-extrabold text-xs rounded-2xl shadow-lg transition active:scale-95">
                    Kembali ke Dashboard
                </button>
            </div>
        `;
        return;
    }

    const currentStudent = appState.currentUser || {};
    const xp = currentStudent.gameXp || 0;
    const progress = getXpProgress(xp);
    const streak = currentStudent.dailyStreak || 1;

    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    
    // Mode status checking for conditional visibility
    const allModes = getGameModes();
    const activeAdventureModes = allModes.filter(m => m.modeType === 'adventure' && m.status !== 'inactive');
    const activeTowerModes = allModes.filter(m => m.modeType === 'tower' && m.status !== 'inactive');
    const hasAdventure = activeAdventureModes.length > 0;
    const hasTower = activeTowerModes.length > 0;

    let activeSubTab = window.__studentGameSubTab || 'katalog';
    if (activeSubTab === 'adventure' && !hasAdventure) activeSubTab = 'katalog';
    if (activeSubTab === 'tower' && !hasTower) activeSubTab = 'katalog';
    if (activeSubTab === 'escape') activeSubTab = 'katalog';
    window.__studentGameSubTab = activeSubTab;

    const showSubTabs = hasAdventure || hasTower;

    container.innerHTML = `
        <div class="space-y-6 pb-16 animate-fade-in">
            <!-- Back to Dashboard Header -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-2">
                <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="flex items-center gap-2 text-slate-600 hover:text-slate-850 transition font-bold text-xs sm:text-sm cursor-pointer">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>Kembali ke Dashboard Utama</span>
                </button>
                <span class="text-xs font-bold text-slate-400">Game Edukasi Siswa</span>
            </div>

            <!-- Gamification Header Profile Banner -->
            <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-indigo-500/20">
                <div class="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div class="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <!-- Left Student Info -->
                    <div class="flex items-center space-x-4 text-center sm:text-left">
                        <div class="relative">
                            <div class="w-20 h-20 bg-gradient-to-tr from-amber-400 to-amber-200 rounded-3xl p-1 shadow-lg shadow-amber-500/20">
                                <div class="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center text-3xl font-black text-amber-300 overflow-hidden">
                                    ${currentStudent.photo ? `<img src="${currentStudent.photo}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-gamepad"></i>`}
                                </div>
                            </div>
                            <span class="absolute -bottom-2 -right-2 px-2.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded-full shadow-md uppercase tracking-wider">
                                Lvl ${progress.level}
                            </span>
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest bg-indigo-950 px-2.5 py-1 rounded-full border border-indigo-800">
                                <i class="fa-solid fa-graduation-cap mr-1"></i> ${currentStudent.className || 'Siswa Madrasah'}
                            </span>
                            <h2 class="text-xl sm:text-2xl font-black mt-1 text-slate-100">${currentStudent.name || 'Siswa'}</h2>
                            
                            <!-- XP Progress Bar -->
                            <div class="mt-2 space-y-1 w-60 sm:w-72">
                                <div class="flex justify-between text-[11px] font-bold text-slate-300">
                                    <span>XP: ${progress.totalXp}</span>
                                    <span class="text-indigo-400">${progress.percentage}%</span>
                                </div>
                                <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                                    <div class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 rounded-full transition-all duration-500" style="width: ${progress.percentage}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Stats Counter Pills -->
                    <div class="flex items-center gap-3">
                        <div class="bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-2xl text-center min-w-[100px]">
                            <span class="text-amber-400 text-lg block font-black">🔥 ${streak}</span>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daily Streak</span>
                        </div>
                        <div class="bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-2xl text-center min-w-[100px]">
                            <span class="text-indigo-400 text-lg block font-black">⭐ ${progress.totalXp}</span>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total XP</span>
                        </div>
                        <button type="button" onclick="openGameLeaderboardModal()" class="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 px-4 py-3.5 rounded-2xl font-extrabold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-trophy text-sm"></i>
                            <span>Peringkat</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Sub Tabs Navigation (Conditional: Only visible if modes are active) -->
            ${showSubTabs ? `
                <div class="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
                    <button type="button" onclick="window.__studentGameSubTab='katalog'; renderGameStudentModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeSubTab === 'katalog' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}">
                        🎮 Katalog Semua Game
                    </button>
                    ${hasAdventure ? `
                        <button type="button" onclick="window.__studentGameSubTab='adventure'; renderGameStudentModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeSubTab === 'adventure' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}">
                            🗺️ Peta Petualangan Harta Karun (${activeAdventureModes.length})
                        </button>
                    ` : ''}
                    ${hasTower ? `
                        <button type="button" onclick="window.__studentGameSubTab='tower'; renderGameStudentModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeSubTab === 'tower' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}">
                            🏰 Quest Menara (${activeTowerModes.length})
                        </button>
                    ` : ''}
                </div>
            ` : ''}

            <!-- TAB CONTENT -->
            ${activeSubTab === 'adventure' && hasAdventure ? renderStudentAdventureTab(games) :
              activeSubTab === 'tower' && hasTower ? renderStudentTowerTab(games) :
              renderStudentKatalogTab(games)}
        </div>
    `;
}

window.renderGameStudentModule = renderGameStudentModule;

function renderStudentKatalogTab(games) {
    const activeGames = games.filter(g => g.status === 'active');
    const catProg = getStudentProgressForMode('CATALOG');
    const completedCatalog = catProg.completedCatalogGames || [];

    return `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
            ${activeGames.map(g => {
                const typeInfo = GAME_TYPES.find(t => t.id === g.gameType) || { name: g.gameType, icon: 'fa-gamepad' };
                const isDone = completedCatalog.includes(g.id);

                return `
                    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex flex-col justify-between space-y-4 group">
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                                    <i class="fa-solid ${typeInfo.icon}"></i> ${typeInfo.name}
                                </span>
                                ${isDone ? '<span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase">🏆 Quest Selesai</span>' : '<span class="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase">Belum Selesai</span>'}
                            </div>

                            <h3 class="font-extrabold text-lg text-slate-850 group-hover:text-indigo-600 transition leading-snug">${gameEscapeHtml(g.title)}</h3>
                            <p class="text-xs text-slate-500 line-clamp-2">${gameEscapeHtml(g.prompt || 'Selesaikan permainan ini untuk menguji pengetahuanmu.')}</p>
                        </div>

                        <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
                            <div class="text-xs font-bold text-amber-600 flex items-center gap-1">
                                <i class="fa-solid fa-star"></i> +${g.rewardXp || 100} XP
                            </div>
                            <button type="button" onclick="launchInteractiveGameModal('${g.id}')" class="px-5 py-2.5 ${isDone ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} active:scale-95 font-extrabold text-xs rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer">
                                <span>${isDone ? 'Main Lagi' : 'Mainkan'}</span> <i class="fa-solid fa-play text-xs"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderStudentAdventureTab(games) {
    const activeModes = getGameModes().filter(m => m.modeType === 'adventure' && m.status !== 'inactive');
    if (activeModes.length === 0) {
        return `
            <div class="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
                <div class="text-4xl">🗺️</div>
                <h3 class="font-extrabold text-slate-800 text-lg">Belum Ada Mode Adventure Aktif</h3>
                <p class="text-xs text-slate-500">Mode Petualangan sedang dinonaktifkan oleh guru. Silakan periksa tab Katalog Game.</p>
            </div>
        `;
    }

    const selectedModeId = window.__studentActiveAdventureModeId || activeModes[0].id;
    const mode = activeModes.find(m => m.id === selectedModeId) || activeModes[0];

    const progressObj = getStudentProgressForMode(mode.id);
    const completedLocs = progressObj.completedLocations || [];

    const locations = Array.isArray(mode.locations) ? mode.locations : [];
    const allCompleted = locations.length > 0 && locations.every(l => completedLocs.includes(l.id));

    return `
        <div class="space-y-6 animate-fade-in">
            <!-- Mode Selector & Header -->
            <div class="bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-900 rounded-3xl p-6 sm:p-8 text-amber-100 shadow-xl border-2 border-amber-500/40 relative overflow-hidden">
                <div class="absolute -right-8 -bottom-8 text-8xl opacity-10 pointer-events-none">🏴‍☠️</div>
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div>
                        <div class="flex items-center gap-2 mb-2">
                            <span class="px-3 py-1 bg-amber-500 text-slate-950 text-[10px] font-black uppercase rounded-full tracking-wider shadow">
                                🗺️ Mode Peta Harta Karun (Adventure)
                            </span>
                            <span class="text-xs text-amber-200 font-bold bg-amber-950/60 px-3 py-1 rounded-full border border-amber-600/30">
                                Target: ${mode.classId || 'Semua Kelas'}
                            </span>
                        </div>
                        <h2 class="text-2xl sm:text-3xl font-black text-white leading-tight">${mode.title}</h2>
                        <p class="text-xs text-amber-100 max-w-xl mt-1">${mode.description || 'Klik titik lokasi pada peta harta karun untuk menaklukkan tantangan!'}</p>
                    </div>

                    ${activeModes.length > 1 ? `
                        <div class="bg-amber-950/80 p-3 rounded-2xl border border-amber-600/50 space-y-1 shrink-0 w-full sm:w-auto">
                            <label class="block text-[10px] font-extrabold text-amber-300 uppercase">Pilih Peta Petualangan:</label>
                            <select onchange="window.__studentActiveAdventureModeId=this.value; renderGameStudentModule(document.getElementById('view-container'));" class="w-full px-3 py-1.5 bg-amber-900 text-white font-bold text-xs rounded-xl border border-amber-600 focus:outline-none cursor-pointer">
                                ${activeModes.map(m => `<option value="${m.id}" ${m.id === mode.id ? 'selected' : ''}>${m.title}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${allCompleted ? `
                <div class="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 text-white text-center shadow-lg animate-bounce">
                    <div class="text-4xl mb-2">🎉🏆</div>
                    <h3 class="text-xl font-black">Selamat! Seluruh Peta Petualangan Telah Ditaklukkan!</h3>
                    <p class="text-xs text-emerald-100 mt-1">Kamu telah menyelesaikan semua tantangan lokasi pada peta ini. Raih peringkat tertinggi di Leaderboard!</p>
                </div>
            ` : ''}

            <!-- VISUAL TREASURE MAP VIEW (AUTHENTIC PIRATE MAP) -->
            <div class="space-y-4">
                <div class="flex items-center justify-between px-1">
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
                        <span class="text-xs font-black text-amber-950 uppercase tracking-wider">
                            Peta Eksplorasi Interaktif:
                        </span>
                    </div>
                    <span class="text-xs font-bold text-slate-500">
                        Progres: <strong class="text-amber-700">${completedLocs.length} / ${locations.length} Selesai</strong>
                    </span>
                </div>

                ${renderTreasureMapComponent(mode, { isEditable: false, isPreview: false, completedLocations: completedLocs })}
            </div>
        </div>
    `;
}

function renderStudentTowerTab(games, forceModeId = null, isPreview = false) {
    const allTowerModes = getGameModes().filter(m => m.modeType === 'tower');
    const modes = isPreview ? allTowerModes : allTowerModes.filter(m => m.status !== 'inactive');
    
    if (modes.length === 0) {
        return `
            <div class="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
                <div class="text-4xl">🏰</div>
                <h3 class="font-extrabold text-slate-800 text-lg">Belum Ada Quest Menara Aktif</h3>
                <p class="text-xs text-slate-500">Mode Quest Tower sedang dinonaktifkan oleh guru. Silakan periksa tab Katalog Game.</p>
            </div>
        `;
    }

    const selectedModeId = forceModeId || window.__studentActiveTowerModeId || modes[0].id;
    const mode = modes.find(m => m.id === selectedModeId) || modes[0];

    const progressObj = getStudentProgressForMode(mode.id);
    const completedFloors = progressObj.completedFloors || [];

    const floors = Array.isArray(mode.floors) ? mode.floors : [];
    const allCompleted = floors.length > 0 && floors.every(f => completedFloors.includes(f.id));

    return `
        <div class="space-y-6 animate-fade-in">
            <!-- Header Banner -->
            <div class="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border-2 border-indigo-500/40 relative overflow-hidden">
                <div class="absolute -right-8 -bottom-8 text-8xl opacity-10 pointer-events-none">🏰</div>
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div>
                        <div class="flex items-center gap-2 mb-2">
                            <span class="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full tracking-wider shadow">
                                🏰 Mode Quest Menara (Tower System)
                            </span>
                            <span class="text-xs text-indigo-300 font-bold bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800">
                                Target: ${mode.classId || 'Semua Kelas'}
                            </span>
                        </div>
                        <h2 class="text-2xl sm:text-3xl font-black text-white leading-tight">${mode.title}</h2>
                        <p class="text-xs text-indigo-200 max-w-xl mt-1">${mode.description || 'Panjat lantai demi lantai menara quest!'}</p>
                    </div>

                    ${modes.length > 1 && !forceModeId ? `
                        <div class="bg-indigo-950/80 p-3 rounded-2xl border border-indigo-800 space-y-1 shrink-0 w-full sm:w-auto">
                            <label class="block text-[10px] font-extrabold text-indigo-300 uppercase">Pilih Menara Quest:</label>
                            <select onchange="window.__studentActiveTowerModeId=this.value; renderGameStudentModule(document.getElementById('view-container'));" class="w-full px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl border border-indigo-700 focus:outline-none cursor-pointer">
                                ${modes.map(m => `<option value="${m.id}" ${m.id === mode.id ? 'selected' : ''}>${m.title}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${allCompleted ? `
                <div class="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 rounded-3xl p-6 text-slate-950 text-center shadow-lg animate-bounce">
                    <div class="text-4xl mb-2">👑🏆</div>
                    <h3 class="text-xl font-black">Selamat! Puncak Menara Berhasil Ditaklukkan!</h3>
                    <p class="text-xs font-bold text-slate-900 mt-1">Kamu meraih gelar Master Menara Quest! Terus tingkatkan skor XP kamu.</p>
                </div>
            ` : ''}

            <!-- TOWER VERTICAL STRUCTURE -->
            <div class="bg-slate-900/90 rounded-3xl p-6 sm:p-8 border border-indigo-800 shadow-2xl relative space-y-6">
                <!-- Crown Peak -->
                <div class="bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 p-4 rounded-2xl border border-amber-500/40 text-center space-y-1">
                    <span class="text-2xl">👑</span>
                    <h3 class="text-sm font-black text-amber-300 uppercase tracking-widest">Puncak Menara Master TIK</h3>
                    <p class="text-[11px] text-slate-300">Taklukkan semua lantai dari bawah untuk meraih tahta puncak!</p>
                </div>

                <div class="max-w-2xl mx-auto space-y-4">
                    ${floors.length === 0 ? `
                        <div class="p-8 text-center text-slate-400 text-xs">
                            Belum ada lantai menara yang dikonfigurasi oleh guru.
                        </div>
                    ` : [...floors].reverse().map((flr, revIdx) => {
                        const actualIdx = floors.length - 1 - revIdx;
                        const isUnlocked = actualIdx === 0 || completedFloors.includes(floors[actualIdx - 1]?.id);
                        const isDone = completedFloors.includes(flr.id);
                        const assignedGame = games.find(g => g.id === flr.gameId) || { id: games[0]?.id || 'GAME_SEED_1', title: 'Tantangan Lantai', rewardXp: 100 };
                        const floorBgStyle = getTowerFloorBgStyle(flr, actualIdx, floors.length);

                        return `
                            <div class="p-5 rounded-2xl border-2 ${
                                isDone ? 'border-emerald-500/80 ring-2 ring-emerald-500/20' :
                                isUnlocked ? 'border-amber-400 shadow-xl ring-2 ring-amber-400/40' :
                                'border-slate-800/80 opacity-60'
                            } transition duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden" style="background: ${floorBgStyle};">
                                
                                <div class="flex items-center space-x-4 z-10">
                                    <div class="w-12 h-12 rounded-2xl ${
                                        isDone ? 'bg-emerald-600 text-white font-black' :
                                        isUnlocked ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30' : 'bg-slate-800 text-slate-500'
                                    } flex items-center justify-center text-base shadow-md shrink-0 border border-white/20">
                                        L${actualIdx + 1}
                                    </div>

                                    <div>
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="px-2.5 py-0.5 bg-slate-950/80 text-amber-400 font-extrabold text-[10px] rounded-full uppercase border border-amber-500/30 backdrop-blur-xs">
                                                Lantai #${actualIdx + 1}
                                            </span>
                                            ${isDone ? '<span class="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700">✓ Ditaklukkan</span>' : ''}
                                            ${!isUnlocked ? '<span class="text-[10px] font-bold text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-700">🔒 Terkunci</span>' : ''}
                                        </div>

                                        <h4 class="font-extrabold text-white text-base mt-1 drop-shadow-md">${flr.name}</h4>
                                        <p class="text-xs text-slate-200 line-clamp-1 drop-shadow-xs">${flr.desc || assignedGame.title}</p>
                                    </div>
                                </div>

                                <div class="w-full sm:w-auto text-right shrink-0 z-10">
                                    ${isUnlocked ? `
                                        <button type="button" onclick="launchInteractiveGameModal('${assignedGame.id}', ${isPreview}, { modeId: '${mode.id}', floorId: '${flr.id}', floorName: '${flr.name}', floorBg: '${floorBgStyle}' })" class="w-full sm:w-auto px-6 py-2.5 ${isDone ? 'bg-slate-900/80 hover:bg-slate-900 text-white border border-white/20' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/30'} font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2">
                                            <span>${isDone ? 'Panjat Lagi' : 'Panjat Lantai Ini'}</span>
                                            <i class="fa-solid fa-chess-rook text-xs"></i>
                                        </button>
                                    ` : `
                                        <button type="button" disabled class="w-full sm:w-auto px-5 py-2.5 bg-slate-950/70 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed border border-slate-800">
                                            <i class="fa-solid fa-lock mr-1"></i> Terkunci
                                        </button>
                                    `}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// LEADERBOARD MODAL (WITH CLASS FILTER)
// ============================================================================
window.openGameLeaderboardModal = async function() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const classes = Array.isArray(appState.classes) ? appState.classes : [];

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
                <div class="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center text-xl font-black shadow-md">
                            🏆
                        </div>
                        <div>
                            <h3 class="font-extrabold text-base">Papan Peringkat (Leaderboard)</h3>
                            <p class="text-xs text-slate-400">Peringkat perolehan XP dan akumulasi poin game edukasi.</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-white p-2 text-lg">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Filter Per Kelas Bar -->
                <div class="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-filter text-indigo-600"></i>
                        <span class="font-bold text-slate-700">Filter Berdasarkan Kelas:</span>
                    </div>
                    <select id="leaderboard-class-select" onchange="fetchAndRenderLeaderboard(this.value)" class="px-3.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs cursor-pointer">
                        <option value="all">🌟 Semua Kelas</option>
                        ${classes.map(c => `<option value="${c.id || c.name}">${c.name || c.className || c.id}</option>`).join('')}
                    </select>
                </div>

                <div class="p-6 overflow-y-auto space-y-4 text-xs">
                    <div id="leaderboard-table-container">
                        <div class="p-8 text-center text-slate-400 font-semibold">Memuat papan peringkat...</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.fetchAndRenderLeaderboard = async function(classFilter = 'all') {
        const tableContainer = document.getElementById('leaderboard-table-container');
        if (!tableContainer) return;
        tableContainer.innerHTML = `<div class="p-8 text-center text-slate-400 font-semibold"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memuat papan peringkat...</div>`;

        try {
            const url = classFilter && classFilter !== 'all' ? `/api/games/leaderboard?classId=${encodeURIComponent(classFilter)}` : '/api/games/leaderboard';
            const res = await fetch(url);
            const data = await res.json();
            const rankings = data.rankings || [];

            if (rankings.length === 0) {
                tableContainer.innerHTML = `<div class="p-8 text-center text-slate-400 font-semibold">Belum ada data skor game untuk kelas ini.</div>`;
                return;
            }

            tableContainer.innerHTML = `
                <div class="space-y-2">
                    ${rankings.map((r, idx) => {
                        const isTop1 = idx === 0;
                        const isTop2 = idx === 1;
                        const isTop3 = idx === 2;

                        return `
                            <div class="flex items-center justify-between p-3.5 rounded-2xl border ${
                                isTop1 ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-sm' :
                                isTop2 ? 'bg-slate-100/90 border-slate-300 text-slate-900' :
                                isTop3 ? 'bg-amber-900/10 border-amber-800/30 text-amber-900' :
                                'bg-slate-50 border-slate-200/80 text-slate-800'
                            }">
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                                        isTop1 ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300' :
                                        isTop2 ? 'bg-slate-400 text-white' :
                                        isTop3 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'
                                    }">
                                        ${idx === 0 ? '👑 1' : idx + 1}
                                    </div>
                                    <div>
                                        <h4 class="font-extrabold text-sm">${r.name}</h4>
                                        <span class="text-[10px] text-slate-500 font-bold bg-white/80 px-2 py-0.5 rounded-md border border-slate-200 inline-block mt-0.5">${r.className || 'Siswa'} &middot; Lvl ${r.level}</span>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <span class="block font-black text-amber-600 text-sm">${r.xp} XP</span>
                                    <span class="text-[10px] text-slate-400 font-semibold">🔥 ${r.dailyStreak || 1} Hari Streak</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } catch (err) {
            if (tableContainer) tableContainer.innerHTML = `<div class="p-4 text-center text-rose-500">Gagal memuat papan peringkat.</div>`;
        }
    };

    fetchAndRenderLeaderboard('all');
};

// ============================================================================
// INTERACTIVE GAME PLAY LAUNCHER (CONTAINING THE 15 GAME ENGINES)
// ============================================================================
window.launchGamePlayPreview = function(gameId) {
    window.launchInteractiveGameModal(gameId, true);
};

window.launchInteractiveGameModal = function(gameId, isPreview = false, modeOptions = null) {
    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = [...SAMPLE_SEED_GAMES];
    }
    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) {
        showToast("Game tidak ditemukan", "error");
        return;
    }

    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    activeGameSession = {
        game,
        startTime: Date.now(),
        score: 0,
        userAnswer: '',
        userInputs: [],
        isPreview,
        modeOptions: modeOptions || null
    };

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 animate-fade-in">
            <div id="active-game-window" class="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
                <!-- Top Game Header Bar -->
                <div class="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-md">
                            <i class="fa-solid fa-gamepad"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-sm sm:text-base leading-snug line-clamp-1">${gameEscapeHtml(game.title)}</h3>
                            <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider mr-2">+${game.rewardXp || 100} XP</span>
                        </div>
                    </div>

                    <div class="flex items-center space-x-3">
                        <div id="game-timer-display" class="px-3 py-1.5 bg-slate-800 text-amber-300 border border-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5">
                            <i class="fa-solid fa-clock"></i> <span id="game-timer-seconds">${game.timeLimit || 120}s</span>
                        </div>
                        <button type="button" onclick="closeActiveGameSession()" class="text-slate-400 hover:text-white p-2 text-lg cursor-pointer">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- Main Interactive Game View Body -->
                <div id="game-session-body" class="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center space-y-6 text-center">
                    <!-- Engine dynamically loaded -->
                </div>
            </div>
        </div>
    `;

    // Start Timer Countdown
    let timeLeft = game.timeLimit || 120;
    if (activeGameTimer) clearInterval(activeGameTimer);

    activeGameTimer = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById('game-timer-seconds');
        if (timerEl) timerEl.innerText = `${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(activeGameTimer);
            showToast("Waktu habis!", "warning");
            submitGameSessionAnswer();
        }
    }, 1000);

    // Render Game Specific Engine UI
    renderGameEngineUI(game);
};

window.closeActiveGameSession = function() {
    if (activeGameTimer) clearInterval(activeGameTimer);
    activeGameSession = null;
    document.getElementById('modal-container').innerHTML = '';
};

// ============================================================================
// GAME ENGINES RENDERER (ALL 15 INTERACTIVE GAME MODES)
// ============================================================================
function renderGameEngineUI(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const gameType = game.gameType || 'tebak_kata';

    // ENGINE 1: TEBAK KATA / SIAPA AKU / LENGKAPI KATA
    if (gameType === 'tebak_gambar') {
        renderTebakGambarEngineUI(game);
        return;
    }
    if (gameType === 'tebak_kata') {
        const rawKey = String(game.answerKey || 'KEYBOARD').trim().toUpperCase();
        const cleanKeyNoSpace = rawKey.replace(/[^A-Z0-9]/g, '');
        const answerLength = cleanKeyNoSpace.length || 8;

        container.innerHTML = `
            <div class="space-y-4 max-w-lg mx-auto w-full animate-fade-in">
                <!-- Prompt Card -->
                <div class="bg-emerald-50/90 p-5 rounded-2xl border border-emerald-200 space-y-2 text-center">
                    <span class="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider bg-emerald-200/70 px-3 py-1 rounded-full inline-block">
                        <i class="fa-solid fa-lightbulb mr-1"></i> Soal Tantangan
                    </span>
                    <p class="text-sm font-extrabold text-slate-800 leading-relaxed">${gameEscapeHtml(game.prompt || 'Selesaikan kata yang tepat.')}</p>
                    ${gameSafeImageUrl(game.imageUrl) ? `<img src="${gameEscapeAttr(gameSafeImageUrl(game.imageUrl))}" class="w-52 h-36 object-cover rounded-2xl border-2 border-emerald-300 mx-auto mt-3 shadow-sm">` : ''}
                    
                    ${game.hints && game.hints.length > 0 ? `
                        <div class="pt-2">
                            <button type="button" onclick="document.getElementById('hint-box-display').classList.toggle('hidden')" class="text-[11px] font-bold text-amber-700 hover:underline inline-flex items-center gap-1 cursor-pointer">
                                <i class="fa-solid fa-key text-amber-500"></i> Lihat Clue / Petunjuk
                            </button>
                            <div id="hint-box-display" class="hidden mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-semibold text-center">
                                ${game.hints.map(h => gameEscapeHtml(h)).join(' • ')}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Letter Boxes Array -->
                <div class="flex items-center justify-center gap-1.5 sm:gap-2 my-5 flex-wrap" id="letter-boxes-wrapper">
                    ${Array.from({ length: answerLength }).map((_, idx) => `
                        <div id="letter-box-${idx}" class="w-10 h-12 sm:w-12 sm:h-14 bg-white border-2 border-slate-300 rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-black text-slate-800 shadow-xs transition-all duration-200">
                        </div>
                    `).join('')}
                </div>

                <!-- Direct Input Box (Alternative option) -->
                <div class="max-w-xs mx-auto">
                    <input type="text" id="direct-letter-input" oninput="syncDirectInputToBoxes(this.value)" placeholder="Atau ketik di sini..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold uppercase focus:bg-white focus:ring-2 focus:ring-emerald-500">
                </div>

                <!-- Action Controls -->
                <div class="flex items-center justify-center gap-2 pt-1">
                    <button type="button" onclick="clearLetterBoxesInput()" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">
                        <i class="fa-solid fa-rotate-left mr-1"></i> Reset
                    </button>
                    <button type="button" onclick="backspaceLetterBoxInput()" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">
                        <i class="fa-solid fa-delete-left mr-1"></i> Hapus
                    </button>
                    <button type="button" onclick="submitGameSessionAnswer()" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer">
                        🚀 Submit
                    </button>
                </div>

                <!-- On-Screen Virtual Keyboard -->
                <div class="pt-3 grid grid-cols-10 gap-1 sm:gap-1.5 max-w-md mx-auto">
                    ${['Q','W','E','R','T','Y','U','I','O','P','A','S','D','F','G','H','J','K','L','Z','X','C','V','B','N','M'].map(key => `
                        <button type="button" onclick="appendLetterBoxInput('${key}')" class="py-2.5 bg-slate-100 hover:bg-emerald-600 hover:text-white font-black text-xs sm:text-sm rounded-lg border border-slate-200 transition cursor-pointer active:scale-95">
                            ${key}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        window.onkeydown = function(e) {
            if (!e || !e.key) return;
            const key = String(e.key).toUpperCase();
            if (key >= 'A' && key <= 'Z' && key.length === 1) {
                appendLetterBoxInput(key);
            } else if (e.key === 'Backspace') {
                backspaceLetterBoxInput();
            } else if (e.key === 'Enter') {
                submitGameSessionAnswer();
            }
        };
    }
    // ENGINE 2: SUSUN KATA (ANAGRAM)
    else if (gameType === 'susun_kata') {
        const rawKey = String(game.answerKey || 'MANDIRI').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const letters = rawKey.split('');
        const scrambled = [...letters].sort(() => 0.5 - Math.random());

        activeGameSession.scrambledPool = scrambled;
        activeGameSession.selectedTiles = [];

        container.innerHTML = `
            <div class="space-y-6 max-w-lg mx-auto w-full animate-fade-in text-center">
                <div class="bg-violet-50 p-5 rounded-2xl border border-violet-200 space-y-2">
                    <span class="text-[10px] font-extrabold text-violet-800 uppercase tracking-wider bg-violet-200/60 px-3 py-1 rounded-full inline-block">
                        🔀 Susun Huruf
                    </span>
                    <p class="text-sm font-extrabold text-slate-800">${gameEscapeHtml(game.prompt || 'Susun huruf-huruf di bawah ini menjadi kata yang benar!')}</p>
                </div>

                <!-- Answer Slots -->
                <div class="flex items-center justify-center gap-2 min-h-[60px] p-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex-wrap" id="anagram-slots-container">
                    <span id="anagram-placeholder" class="text-xs font-bold text-slate-400">Klik huruf di bawah untuk menyusun...</span>
                </div>

                <!-- Scrambled Tile Buttons -->
                <div class="flex items-center justify-center gap-2 flex-wrap max-w-md mx-auto" id="anagram-tiles-container">
                    ${scrambled.map((char, idx) => `
                        <button type="button" id="tile-btn-${idx}" onclick="pickAnagramTile(${idx}, '${char}')" class="w-12 h-14 bg-white hover:bg-violet-600 hover:text-white border-2 border-slate-200 text-slate-800 font-black text-xl rounded-2xl shadow-sm transition active:scale-95 cursor-pointer">
                            ${char}
                        </button>
                    `).join('')}
                </div>

                <div class="flex items-center justify-center gap-3 pt-2">
                    <button type="button" onclick="resetAnagramTiles()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">
                        <i class="fa-solid fa-rotate-left mr-1"></i> Reset
                    </button>
                    <button type="button" onclick="submitGameSessionAnswer()" class="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-extrabold rounded-xl text-xs shadow-md transition cursor-pointer">
                        🚀 Submit Jawaban
                    </button>
                </div>
            </div>
        `;
    }
    // ENGINE 3: BENAR ATAU SALAH
    else if (gameType === 'true_false') {
        container.innerHTML = `
            <div class="space-y-6 max-w-md mx-auto w-full animate-fade-in text-center">
                <div class="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3 shadow-xs">
                    <span class="text-xs font-extrabold text-sky-800 uppercase tracking-wider bg-sky-100 px-3 py-1 rounded-full">
                        🎯 Pernyataan Evaluasi
                    </span>
                    <p class="text-base font-extrabold text-slate-800 leading-relaxed">${gameEscapeHtml(game.prompt)}</p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <button type="button" onclick="selectTrueFalseAnswer('BENAR')" class="py-6 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-lg rounded-2xl shadow-lg transition cursor-pointer flex flex-col items-center justify-center gap-1">
                        <i class="fa-solid fa-circle-check text-2xl"></i>
                        <span>BENAR</span>
                    </button>
                    <button type="button" onclick="selectTrueFalseAnswer('SALAH')" class="py-6 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-lg rounded-2xl shadow-lg transition cursor-pointer flex flex-col items-center justify-center gap-1">
                        <i class="fa-solid fa-circle-xmark text-2xl"></i>
                        <span>SALAH</span>
                    </button>
                </div>
            </div>
        `;
    }
    // ENGINE 4: MEMORY MATCH
    else if (gameType === 'memory_match') {
        renderMemoryMatchEngineUI(game);
        return;
    }
    // ENGINE 5: PUZZLE GAMBAR (3x3 IMAGE PUZZLE)
    else if (gameType === 'image_puzzle') {
        renderImagePuzzleEngineUI(game);
        return;
    }
    // ENGINE 6: CARI KATA (WORD SEARCH)
    else if (gameType === 'word_search') {
        renderWordSearchEngineUI(game);
        return;
    }
    // ENGINE 7: TEKA-TEKI SILANG (CROSSWORD)
    else if (gameType === 'crossword') {
        renderCrosswordEngineUI(game);
        return;
    }
    // ENGINE 8: LABIRIN BENANG KUSUT
    else if (gameType === 'labirin') {
        renderLabirinEngineUI(game);
        return;
    }
    // FALLBACK / GENERAL GAME ENGINE (SPOT DIFFERENCE, PUZZLE GAMBAR, WORD PUZZLE, ETC)
    else {
        container.innerHTML = `
            <div class="space-y-5 max-w-md mx-auto w-full animate-fade-in text-center">
                <div class="bg-emerald-50 p-6 rounded-3xl border border-emerald-200 space-y-2">
                    <span class="text-xs font-extrabold text-emerald-800 uppercase tracking-wider bg-emerald-200/60 px-3 py-1 rounded-full">
                        🧩 Soal Permainan
                    </span>
                    <p class="text-sm font-extrabold text-slate-800">${gameEscapeHtml(game.prompt || 'Selesaikan permainan ini!')}</p>
                    ${gameSafeImageUrl(game.imageUrl) ? `<img src="${gameEscapeAttr(gameSafeImageUrl(game.imageUrl))}" class="w-48 h-32 object-cover rounded-xl border border-slate-200 mx-auto mt-2">` : ''}
                </div>

                <div class="space-y-3">
                    <input type="text" id="fallback-answer-input" placeholder="Ketik jawaban di sini..." class="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl font-black uppercase text-center text-emerald-800 focus:ring-2 focus:ring-emerald-500">
                    <button type="button" onclick="submitGameSessionAnswer()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition cursor-pointer">
                        🚀 Submit Jawaban
                    </button>
                </div>
            </div>
        `;
    }
}

// ============================================================================
// GAME ENGINE HANDLERS (ANAGRAM, LETTER BOXES, MEMORY, MATCH PAIRS)
// ============================================================================
window.appendLetterBoxInput = function(letter) {
    if (!activeGameSession) return;

    const rawKey = String(activeGameSession.game.answerKey || 'KEYBOARD').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const answerLength = rawKey.length || 8;

    if (activeGameSession.userInputs.length < answerLength) {
        activeGameSession.userInputs.push(letter);
        updateLetterBoxesVisual();
    }
};

window.backspaceLetterBoxInput = function() {
    if (!activeGameSession) return;
    activeGameSession.userInputs.pop();
    updateLetterBoxesVisual();
};

window.clearLetterBoxesInput = function() {
    if (!activeGameSession) return;
    activeGameSession.userInputs = [];
    const directEl = document.getElementById('direct-letter-input');
    if (directEl) directEl.value = '';
    updateLetterBoxesVisual();
};

window.syncDirectInputToBoxes = function(val) {
    if (!activeGameSession) return;
    const clean = String(val || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    activeGameSession.userInputs = clean.split('');
    updateLetterBoxesVisual();
};

function updateLetterBoxesVisual() {
    if (!activeGameSession) return;

    const rawKey = String(activeGameSession.game.answerKey || 'KEYBOARD').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const answerLength = rawKey.length || 8;

    for (let i = 0; i < answerLength; i++) {
        const box = document.getElementById(`letter-box-${i}`);
        if (box) {
            const char = activeGameSession.userInputs[i] || '';
            box.innerText = char;
            if (char) {
                box.classList.add('border-emerald-500', 'bg-emerald-50');
            } else {
                box.classList.remove('border-emerald-500', 'bg-emerald-50');
            }
        }
    }
}

// Anagram Tile Picker
window.pickAnagramTile = function(idx, char) {
    if (!activeGameSession) return;
    const tileBtn = document.getElementById(`tile-btn-${idx}`);
    if (!tileBtn || tileBtn.disabled) return;

    tileBtn.disabled = true;
    tileBtn.classList.add('opacity-30', 'cursor-not-allowed');

    activeGameSession.selectedTiles.push({ idx, char });
    renderAnagramSlotsVisual();
};

function renderAnagramSlotsVisual() {
    const slotsContainer = document.getElementById('anagram-slots-container');
    if (!slotsContainer || !activeGameSession) return;

    const selected = activeGameSession.selectedTiles || [];
    if (selected.length === 0) {
        slotsContainer.innerHTML = `<span id="anagram-placeholder" class="text-xs font-bold text-slate-400">Klik huruf di bawah untuk menyusun...</span>`;
        return;
    }

    slotsContainer.innerHTML = selected.map((item, sIdx) => `
        <button type="button" onclick="removeAnagramSlotTile(${sIdx})" class="w-11 h-13 bg-violet-600 text-white font-black text-xl rounded-xl shadow-xs hover:bg-violet-700 transition cursor-pointer">
            ${item.char}
        </button>
    `).join('');
}

window.removeAnagramSlotTile = function(sIdx) {
    if (!activeGameSession || !activeGameSession.selectedTiles) return;
    const removed = activeGameSession.selectedTiles.splice(sIdx, 1)[0];
    if (removed) {
        const tileBtn = document.getElementById(`tile-btn-${removed.idx}`);
        if (tileBtn) {
            tileBtn.disabled = false;
            tileBtn.classList.remove('opacity-30', 'cursor-not-allowed');
        }
    }
    renderAnagramSlotsVisual();
};

window.resetAnagramTiles = function() {
    if (!activeGameSession) return;
    activeGameSession.selectedTiles = [];
    renderAnagramSlotsVisual();
    if (activeGameSession.scrambledPool) {
        activeGameSession.scrambledPool.forEach((_, idx) => {
            const tileBtn = document.getElementById(`tile-btn-${idx}`);
            if (tileBtn) {
                tileBtn.disabled = false;
                tileBtn.classList.remove('opacity-30', 'cursor-not-allowed');
            }
        });
    }
};

window.selectTrueFalseAnswer = function(answer) {
    if (!activeGameSession) return;
    activeGameSession.userAnswer = answer;
    submitGameSessionAnswer();
};

let selectedMemoryCard1 = null;
window.flipMemoryCardTile = function(idx, pairId) {
    const cardEl = document.getElementById(`card-tile-${idx}`);
    if (!cardEl || cardEl.classList.contains('matched')) return;

    const textEl = cardEl.querySelector('.card-text');
    const coverEl = cardEl.querySelector('.card-cover');

    textEl.classList.remove('hidden');
    coverEl.classList.add('hidden');
    cardEl.classList.add('bg-indigo-600', 'border-indigo-400');

    if (!selectedMemoryCard1) {
        selectedMemoryCard1 = { idx, pairId, cardEl };
    } else {
        if (selectedMemoryCard1.pairId === pairId && selectedMemoryCard1.idx !== idx) {
            cardEl.classList.add('matched', 'bg-emerald-600');
            selectedMemoryCard1.cardEl.classList.add('matched', 'bg-emerald-600');
            showToast("Pasangan Cocok!", "success");
            selectedMemoryCard1 = null;

            if (activeGameSession) {
                activeGameSession.matchedPairsCount = (activeGameSession.matchedPairsCount || 0) + 1;
                if (activeGameSession.matchedPairsCount >= (activeGameSession.totalPairsCount || 2)) {
                    setTimeout(() => {
                        submitGameSessionAnswer('COMPLETED', true);
                    }, 500);
                }
            }
        } else {
            setTimeout(() => {
                textEl.classList.add('hidden');
                coverEl.classList.remove('hidden');
                cardEl.classList.remove('bg-indigo-600', 'border-indigo-400');

                if (selectedMemoryCard1 && selectedMemoryCard1.cardEl) {
                    const text1 = selectedMemoryCard1.cardEl.querySelector('.card-text');
                    const cover1 = selectedMemoryCard1.cardEl.querySelector('.card-cover');
                    if (text1) text1.classList.add('hidden');
                    if (cover1) cover1.classList.remove('hidden');
                    selectedMemoryCard1.cardEl.classList.remove('bg-indigo-600', 'border-indigo-400');
                }
                selectedMemoryCard1 = null;
            }, 700);
        }
    }
};

window.selectMatchPairTerm = function(idx) {
    if (!activeGameSession) return;
    activeGameSession.selectedTermIdx = idx;
    document.querySelectorAll('[id^="term-btn-"]').forEach((btn, bIdx) => {
        if (bIdx === idx) {
            btn.classList.add('border-emerald-500', 'bg-emerald-50');
        } else {
            btn.classList.remove('border-emerald-500', 'bg-emerald-50');
        }
    });
};

window.selectMatchPairDef = function(matchIdx, pairId) {
    if (!activeGameSession || activeGameSession.selectedTermIdx === null) {
        showToast("Pilih istilah di kolom kiri dulu!", "warning");
        return;
    }

    const termIdx = activeGameSession.selectedTermIdx;
    activeGameSession.matchedPairsMap[termIdx] = pairId;

    const matchBtn = document.getElementById(`match-btn-${matchIdx}`);
    if (matchBtn) {
        matchBtn.classList.add('border-emerald-500', 'bg-emerald-50');
    }
    showToast(`Istilah ${termIdx+1} terhubung!`, "info");
    activeGameSession.selectedTermIdx = null;
};

window.submitMatchPairsAnswer = function() {
    submitGameSessionAnswer('COMPLETED', true);
};

window.toggleMarkWordFound = function(idx) {
    const chip = document.getElementById(`word-chip-${idx}`);
    if (!chip) return;
    chip.classList.toggle('bg-emerald-600');
    chip.classList.toggle('text-white');
    chip.classList.toggle('line-through');
};

// ============================================================================
// SUBMIT GAME SESSION & VALIDATE ON SERVER
// ============================================================================
window.submitGameSessionAnswer = async function(overrideAns = null, overridePassed = false, customXp = null) {
    if (!activeGameSession) return;
    if (activeGameTimer) clearInterval(activeGameTimer);

    let submittedAnswer = overrideAns || activeGameSession.userAnswer;

    if (!submittedAnswer && activeGameSession.selectedTiles && activeGameSession.selectedTiles.length > 0) {
        submittedAnswer = activeGameSession.selectedTiles.map(t => t.char).join('');
    }
    if (!submittedAnswer && activeGameSession.userInputs && activeGameSession.userInputs.length > 0) {
        submittedAnswer = activeGameSession.userInputs.join('');
    }
    const directInput = document.getElementById('direct-letter-input');
    if (!submittedAnswer && directInput && directInput.value) {
        submittedAnswer = (directInput.value || '').trim().toUpperCase();
    }
    const fallbackInput = document.getElementById('fallback-answer-input');
    if (!submittedAnswer && fallbackInput && fallbackInput.value) {
        submittedAnswer = (fallbackInput.value || '').trim().toUpperCase();
    }
    const cwInput = document.getElementById('crossword-input-box');
    if (!submittedAnswer && cwInput && cwInput.value) {
        submittedAnswer = (cwInput.value || '').trim().toUpperCase();
    }
    const escapeInput = document.getElementById('escape-passcode-input');
    if (!submittedAnswer && escapeInput && escapeInput.value) {
        submittedAnswer = (escapeInput.value || '').trim().toUpperCase();
    }

    const game = activeGameSession.game;
    const studentId = appState.currentUser ? appState.currentUser.id : 'STUDENT_GUEST';

    try {
        const res = await fetch(`/api/games/${game.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                submittedAnswer,
                studentId,
                isPreview: activeGameSession.isPreview,
                passed: overridePassed,
                customXp: customXp
            })
        });
        const data = await res.json();

        const container = document.getElementById('game-session-body');
        if (!container) return;

        if (data.isCorrect) {
            if (appState.currentUser) {
                appState.currentUser.gameXp = data.newTotalXp || ((appState.currentUser.gameXp || 0) + (data.earnedXp || 100));
                appState.currentUser.dailyStreak = data.dailyStreak || appState.currentUser.dailyStreak || 1;
                safeSetLocalStorage('madrasah_current_user', appState.currentUser);
            }

            // Record Mode progression if played from Adventure or Tower mode or Catalog
            if (activeGameSession.modeOptions && activeGameSession.modeOptions.modeId) {
                const modeId = activeGameSession.modeOptions.modeId;
                const prog = getStudentProgressForMode(modeId);
                if (activeGameSession.modeOptions.locationId) {
                    if (!prog.completedLocations.includes(activeGameSession.modeOptions.locationId)) {
                        prog.completedLocations.push(activeGameSession.modeOptions.locationId);
                    }
                }
                if (activeGameSession.modeOptions.floorId) {
                    if (!prog.completedFloors.includes(activeGameSession.modeOptions.floorId)) {
                        prog.completedFloors.push(activeGameSession.modeOptions.floorId);
                    }
                }
                safeSetLocalStorage('madrasah_student_game_progress', appState.studentGameProgress);
            } else if (activeGameSession.gameId) {
                const catProg = getStudentProgressForMode('CATALOG');
                if (!catProg.completedCatalogGames) catProg.completedCatalogGames = [];
                if (!catProg.completedCatalogGames.includes(activeGameSession.gameId)) {
                    catProg.completedCatalogGames.push(activeGameSession.gameId);
                }
                safeSetLocalStorage('madrasah_student_game_progress', appState.studentGameProgress);
            }

            container.innerHTML = `
                <div class="space-y-5 animate-fade-in text-center py-4">
                    <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-lg shadow-emerald-500/20 border-4 border-emerald-500">
                        🎉
                    </div>
                    <h2 class="text-2xl font-black text-emerald-800">Jawaban Benar! Hebat!</h2>
                    <p class="text-xs font-bold text-slate-600">Kamu mendapatkan <span class="text-amber-600 font-extrabold">+${data.earnedXp || 100} XP</span></p>

                    <button type="button" onclick="closeActiveGameSession(); if(window.renderGameStudentModule) renderGameStudentModule(document.getElementById('view-container'));" class="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-lg transition cursor-pointer">
                        Lanjutkan Belajar
                    </button>
                </div>
            `;
        } else {
            const answerReveal = game.correctAnswer || game.answerKey || '-';

            container.innerHTML = `
                <div class="space-y-5 animate-fade-in text-center py-4">
                    <div class="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto border-4 border-rose-500">
                        ❌
                    </div>
                    <h2 class="text-2xl font-black text-rose-800">Jawaban Belum Tepat</h2>
                    <p class="text-xs text-slate-500">Jawabanmu: <span class="font-bold text-slate-800">${submittedAnswer || '-'}</span></p>
                    <p class="text-xs font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl inline-block border border-emerald-200">
                        Kunci Jawaban: <span class="font-black">${answerReveal}</span>
                    </p>

                    <div class="pt-2">
                        <button type="button" onclick="launchInteractiveGameModal('${game.id}', ${activeGameSession.isPreview})" class="px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-2xl shadow transition cursor-pointer">
                            Coba Lagi
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        showToast("Gagal memproses jawaban game", "error");
    }
};

// ============================================================================
// CROSSWORD (TTS) INTERACTIVE BOARD & GRID CALCULATOR
// ============================================================================
export function buildCrosswordGrid(cluesInput) {
    let clues = Array.isArray(cluesInput) && cluesInput.length > 0 ? cluesInput : [
        { number: 1, direction: 'across', row: 1, col: 1, clue: 'Otak pemroses utama pada komputer (3 Huruf)', answer: 'CPU', points: 30, initialHint: true },
        { number: 2, direction: 'down', row: 1, col: 1, clue: 'Perangkat keras pengolah data utama (8 Huruf)', answer: 'COMPUTER', points: 50, initialHint: true },
        { number: 3, direction: 'across', row: 3, col: 1, clue: 'Modulasi sinyal jaringan internet (5 Huruf)', answer: 'MODEM', points: 30, initialHint: true },
        { number: 4, direction: 'across', row: 4, col: 1, clue: 'Perangkat pencetak dokumen kertas (7 Huruf)', answer: 'PRINTER', points: 40, initialHint: true }
    ];

    const processedClues = clues.map((c, idx) => ({
        id: `clue_${idx}`,
        number: parseInt(c.number, 10) || (idx + 1),
        direction: c.direction === 'down' ? 'down' : 'across',
        row: parseInt(c.row, 10) || 1,
        col: parseInt(c.col, 10) || 1,
        clue: c.clue || 'Petunjuk teka-teki silang',
        answer: String(c.answer || 'JAWABAN').trim().toUpperCase().replace(/[^A-Z]/g, ''),
        points: parseInt(c.points, 10) || Math.max(10, (String(c.answer || '').length * 10)),
        initialHint: c.initialHint !== false
    }));

    let maxRow = 8;
    let maxCol = 8;

    processedClues.forEach(c => {
        const len = c.answer.length;
        if (c.direction === 'across') {
            maxRow = Math.max(maxRow, c.row);
            maxCol = Math.max(maxCol, c.col + len - 1);
        } else {
            maxRow = Math.max(maxRow, c.row + len - 1);
            maxCol = Math.max(maxCol, c.col);
        }
    });

    const grid = {};
    for (let r = 1; r <= maxRow; r++) {
        for (let c = 1; c <= maxCol; c++) {
            grid[`${r}_${c}`] = {
                row: r,
                col: c,
                isCell: false,
                expected: '',
                number: null,
                clues: [],
                isInitialHint: false
            };
        }
    }

    processedClues.forEach(clue => {
        const len = clue.answer.length;
        for (let i = 0; i < len; i++) {
            const r = clue.direction === 'across' ? clue.row : clue.row + i;
            const c = clue.direction === 'across' ? clue.col + i : clue.col;
            const key = `${r}_${c}`;

            if (grid[key]) {
                grid[key].isCell = true;
                grid[key].expected = clue.answer[i];
                if (i === 0) {
                    if (!grid[key].number) grid[key].number = clue.number;
                    if (clue.initialHint) grid[key].isInitialHint = true;
                }
                if (!grid[key].clues.includes(clue.id)) {
                    grid[key].clues.push(clue.id);
                }
            }
        }
    });

    return { grid, maxRow, maxCol, clues: processedClues };
}

function renderCrosswordEngineUI(game) {
    const rawClues = game.crosswordData?.clues;
    const { grid, maxRow, maxCol, clues } = buildCrosswordGrid(rawClues);

    activeGameSession.crosswordState = {
        grid,
        maxRow,
        maxCol,
        clues,
        activeClueId: clues[0]?.id || null,
        userCells: {},
        completedClues: {},
        totalScore: 0,
        maxPossibleScore: clues.reduce((acc, c) => acc + (c.points || 20), 0)
    };

    // Pre-fill initial hint letters
    Object.values(grid).forEach(cell => {
        if (cell.isCell && cell.isInitialHint && cell.expected) {
            activeGameSession.crosswordState.userCells[`${cell.row}_${cell.col}`] = cell.expected;
        }
    });

    renderCrosswordSessionLayout();
}

function renderCrosswordSessionLayout() {
    const container = document.getElementById('game-session-body');
    if (!container || !activeGameSession || !activeGameSession.crosswordState) return;

    const state = activeGameSession.crosswordState;
    const { grid, maxRow, maxCol, clues, activeClueId, userCells, completedClues, totalScore, maxPossibleScore } = state;

    const activeClue = clues.find(c => c.id === activeClueId) || clues[0];
    const acrossClues = clues.filter(c => c.direction === 'across');
    const downClues = clues.filter(c => c.direction === 'down');

    container.innerHTML = `
        <div class="space-y-4 max-w-4xl mx-auto w-full animate-fade-in text-left">
            
            <!-- Header Score & Target Banner -->
            <div class="bg-indigo-950 text-white p-4 rounded-2xl border border-indigo-800/80 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-xs">
                        🧩
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 bg-indigo-500/30 text-indigo-300 font-extrabold uppercase text-[10px] rounded-full">
                                Teka-Teki Silang (TTS)
                            </span>
                            <span class="text-amber-400 font-extrabold">${Object.keys(completedClues).length} / ${clues.length} Kolom Selesai</span>
                        </div>
                        <h4 class="font-bold text-sm text-slate-100 mt-0.5">${activeGameSession.game.prompt || 'Isi kolom mendatar dan menurun berikut!'}</h4>
                    </div>
                </div>

                <div class="flex items-center space-x-3 bg-slate-900/80 px-4 py-2 rounded-xl border border-indigo-700/50">
                    <div class="text-right">
                        <span class="text-[10px] font-bold text-slate-400 block uppercase">Total Nilai XP</span>
                        <span class="font-black text-amber-400 text-sm" id="cw-live-score">+${totalScore} / ${maxPossibleScore} XP</span>
                    </div>
                </div>
            </div>

            <!-- Main Crossword Area: Grid + Clues List -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                <!-- LEFT/TOP: THE INTERACTIVE 2D TTS GRID (7 Columns in LG) -->
                <div class="lg:col-span-7 bg-slate-950 p-4 sm:p-5 rounded-3xl border-2 border-indigo-900/50 shadow-2xl flex flex-col items-center justify-center space-y-3 overflow-x-auto">
                    
                    <span class="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest bg-indigo-950 px-3 py-1 rounded-full border border-indigo-800">
                        <i class="fa-solid fa-table-cells mr-1"></i> Board Kolom TTS (${maxRow}x${maxCol})
                    </span>

                    <!-- Grid Table -->
                    <div class="grid gap-1.5 p-2 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-inner max-w-full overflow-x-auto" style="grid-template-columns: repeat(${maxCol}, minmax(0, 1fr));">
                        ${Array.from({ length: maxRow }).flatMap((_, rIdx) => {
                            const r = rIdx + 1;
                            return Array.from({ length: maxCol }).map((_, cIdx) => {
                                const c = cIdx + 1;
                                const key = `${r}_${c}`;
                                const cell = grid[key];

                                if (!cell || !cell.isCell) {
                                    return `<div class="w-8 h-8 sm:w-10 sm:h-10 bg-slate-950/60 rounded-xl border border-slate-900/80 pointer-events-none"></div>`;
                                }

                                const val = userCells[key] || '';
                                const isInitial = cell.isInitialHint && cell.expected;
                                const isActiveClueCell = activeClue && cell.clues.includes(activeClue.id);

                                return `
                                    <div class="relative w-8 h-8 sm:w-10 sm:h-10">
                                        ${cell.number ? `<span class="absolute top-0.5 left-1 text-[8px] font-black text-indigo-400 z-10 pointer-events-none">${cell.number}</span>` : ''}
                                        
                                        <input type="text"
                                               maxlength="1"
                                               data-row="${r}"
                                               data-col="${c}"
                                               id="cw-cell-${r}-${c}"
                                               value="${val}"
                                               onfocus="highlightCrosswordCell(${r}, ${c})"
                                               oninput="onCrosswordCellInputChange(this, ${r}, ${c})"
                                               onkeydown="onCrosswordCellKeyDown(event, ${r}, ${c})"
                                               class="w-full h-full text-center font-black text-sm sm:text-base uppercase rounded-xl border-2 transition-all duration-150 focus:outline-none ${
                                                   isActiveClueCell
                                                       ? 'bg-amber-100 border-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                                                       : isInitial
                                                           ? 'bg-indigo-950/80 border-indigo-500 text-emerald-300 font-extrabold'
                                                           : 'bg-slate-800 border-slate-700 text-white focus:bg-white focus:text-slate-950 focus:border-indigo-500'
                                               }">
                                    </div>
                                `;
                            });
                        }).join('')}
                    </div>

                    <!-- Selected Active Clue Input Quick Bar -->
                    ${activeClue ? `
                        <div class="w-full bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-2 text-left">
                            <div class="flex items-center justify-between text-xs">
                                <span class="font-extrabold text-amber-400 uppercase">
                                    ${activeClue.direction === 'across' ? '↔️ Mendatar' : '↕️ Menurun'} No. ${activeClue.number}
                                </span>
                                <span class="font-bold text-slate-400 text-[11px]">+${activeClue.points || 20} XP &middot; ${activeClue.answer.length} Kolom Huruf</span>
                            </div>
                            <p class="text-xs font-bold text-slate-200">${activeClue.clue}</p>
                            
                            <div class="flex items-center gap-2 pt-1">
                                <input type="text"
                                       id="cw-active-word-input"
                                       value="${getTypedWordForClue(activeClue)}"
                                       oninput="syncCrosswordWordInput(this.value)"
                                       placeholder="Ketik jawaban di sini..."
                                       class="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-extrabold uppercase text-xs focus:ring-2 focus:ring-indigo-500">
                                
                                <button type="button" onclick="checkCrosswordWord('${activeClue.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md transition cursor-pointer">
                                    <i class="fa-solid fa-check mr-1"></i> Periksa
                                </button>
                            </div>
                        </div>
                    ` : ''}

                </div>

                <!-- RIGHT: DAFTAR PETUNJUK MENDATAR & MENURUN (5 Columns in LG) -->
                <div class="lg:col-span-5 space-y-4">
                    
                    <!-- TAB 1: MENDATAR (ACROSS) -->
                    <div class="bg-indigo-50/80 p-4 rounded-3xl border border-indigo-200 space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="font-extrabold text-indigo-950 uppercase text-xs flex items-center gap-1.5">
                                <i class="fa-solid fa-arrows-left-right text-indigo-600"></i> Mendatar (${acrossClues.length})
                            </h4>
                            <span class="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">Soal Horizontal</span>
                        </div>

                        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                            ${acrossClues.map(c => renderClueCard(c, activeClueId, completedClues)).join('')}
                        </div>
                    </div>

                    <!-- TAB 2: MENURUN (DOWN) -->
                    <div class="bg-amber-50/80 p-4 rounded-3xl border border-amber-200 space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="font-extrabold text-amber-950 uppercase text-xs flex items-center gap-1.5">
                                <i class="fa-solid fa-arrows-up-down text-amber-600"></i> Menurun (${downClues.length})
                            </h4>
                            <span class="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Soal Vertikal</span>
                        </div>

                        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                            ${downClues.map(c => renderClueCard(c, activeClueId, completedClues)).join('')}
                        </div>
                    </div>

                    <!-- Submit All Button -->
                    <div class="pt-2">
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-xs cursor-pointer">
                            <span>🚀 Selesai & Submit Jawaban TTS</span>
                        </button>
                    </div>

                </div>

            </div>
        </div>
    `;
}

function renderClueCard(c, activeClueId, completedClues) {
    const isCompleted = completedClues[c.id];
    const isActive = activeClueId === c.id;

    return `
        <div onclick="selectCrosswordClue('${c.id}')"
             class="p-3 rounded-2xl border transition-all cursor-pointer ${
                 isCompleted
                     ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                     : isActive
                         ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400'
                         : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-400'
             }">
            <div class="flex items-center justify-between gap-2">
                <span class="font-black text-xs">No. ${c.number} (${c.answer.length} Kolom)</span>
                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isCompleted
                        ? 'bg-emerald-200 text-emerald-800'
                        : isActive
                            ? 'bg-indigo-800 text-amber-300'
                            : 'bg-slate-100 text-amber-700'
                }">
                    ${isCompleted ? '✓ Selesai (+ ' + c.points + ' XP)' : '+' + c.points + ' XP'}
                </span>
            </div>
            <p class="text-xs font-semibold mt-1 leading-snug ${isActive ? 'text-indigo-100' : 'text-slate-700'}">${c.clue}</p>
        </div>
    `;
}

function getTypedWordForClue(clue) {
    if (!activeGameSession || !activeGameSession.crosswordState) return '';
    const { userCells } = activeGameSession.crosswordState;
    let word = '';
    for (let i = 0; i < clue.answer.length; i++) {
        const r = clue.direction === 'across' ? clue.row : clue.row + i;
        const c = clue.direction === 'across' ? clue.col + i : clue.col;
        word += (userCells[`${r}_${c}`] || '');
    }
    return word;
}

window.selectCrosswordClue = function(clueId) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    activeGameSession.crosswordState.activeClueId = clueId;
    renderCrosswordSessionLayout();
};

window.highlightCrosswordCell = function(r, c) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const { grid } = activeGameSession.crosswordState;
    const key = `${r}_${c}`;
    const cell = grid[key];
    if (cell && cell.clues.length > 0) {
        if (!cell.clues.includes(activeGameSession.crosswordState.activeClueId)) {
            activeGameSession.crosswordState.activeClueId = cell.clues[0];
            renderCrosswordSessionLayout();
        }
    }
};

window.onCrosswordCellInputChange = function(inputEl, r, c) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const state = activeGameSession.crosswordState;
    const val = String(inputEl.value || '').toUpperCase().replace(/[^A-Z]/g, '');
    inputEl.value = val;

    state.userCells[`${r}_${c}`] = val;

    const activeClue = state.clues.find(clue => clue.id === state.activeClueId);
    if (activeClue) {
        const typed = getTypedWordForClue(activeClue);
        if (typed.length === activeClue.answer.length) {
            checkCrosswordWord(activeClue.id);
        } else if (val) {
            const nextR = activeClue.direction === 'across' ? r : r + 1;
            const nextC = activeClue.direction === 'across' ? c + 1 : c;
            const nextEl = document.getElementById(`cw-cell-${nextR}-${nextC}`);
            if (nextEl) nextEl.focus();
        }
    }

    const activeWordInput = document.getElementById('cw-active-word-input');
    if (activeWordInput && activeClue) {
        activeWordInput.value = getTypedWordForClue(activeClue);
    }
};

window.onCrosswordCellKeyDown = function(e, r, c) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const state = activeGameSession.crosswordState;
    const activeClue = state.clues.find(clue => clue.id === state.activeClueId);

    if (e.key === 'Backspace' && !state.userCells[`${r}_${c}`]) {
        if (activeClue) {
            const prevR = activeClue.direction === 'across' ? r : r - 1;
            const prevC = activeClue.direction === 'across' ? c - 1 : c;
            const prevEl = document.getElementById(`cw-cell-${prevR}-${prevC}`);
            if (prevEl) prevEl.focus();
        }
    }
};

window.syncCrosswordWordInput = function(val) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const state = activeGameSession.crosswordState;
    const activeClue = state.clues.find(clue => clue.id === state.activeClueId);
    if (!activeClue) return;

    const clean = String(val || '').toUpperCase().replace(/[^A-Z]/g, '');

    for (let i = 0; i < activeClue.answer.length; i++) {
        const r = activeClue.direction === 'across' ? activeClue.row : activeClue.row + i;
        const c = activeClue.direction === 'across' ? activeClue.col + i : activeClue.col;
        const char = clean[i] || '';
        state.userCells[`${r}_${c}`] = char;

        const cellInput = document.getElementById(`cw-cell-${r}-${c}`);
        if (cellInput) cellInput.value = char;
    }
};

window.checkCrosswordWord = function(clueId) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const state = activeGameSession.crosswordState;
    const clue = state.clues.find(c => c.id === clueId);
    if (!clue) return;

    const typed = getTypedWordForClue(clue);

    if (typed === clue.answer) {
        if (!state.completedClues[clue.id]) {
            state.completedClues[clue.id] = true;
            state.totalScore += (clue.points || 20);
            showToast(`🎉 Jawaban TTS ${clue.direction === 'across' ? 'Mendatar' : 'Menurun'} No. ${clue.number} BENAR! (+${clue.points || 20} XP)`, "success");

            const liveScoreEl = document.getElementById('cw-live-score');
            if (liveScoreEl) liveScoreEl.innerText = `+${state.totalScore} / ${state.maxPossibleScore} XP`;

            if (Object.keys(state.completedClues).length >= state.clues.length) {
                setTimeout(() => {
                    submitGameSessionAnswer('COMPLETED', true);
                }, 600);
            } else {
                renderCrosswordSessionLayout();
            }
        } else {
            showToast("Kolom ini sudah diselesaikan!", "info");
        }
    } else {
        showToast(`Jawaban No. ${clue.number} belum tepat! Periksa kembali huruf pada kolom.`, "warning");
    }
};

window.onkeydown = null;

// ============================================================================
// IMAGE FILE UPLOAD HELPERS FOR GAME EDITORS
// ============================================================================
window.handleImageFileUpload = function(event, previewImgId, hiddenInputId) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        if (window.showToast) window.showToast('File harus berupa gambar (JPG, PNG, WebP).', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const rawDataUrl = e.target.result;

        // Compress image using canvas down to max 800px & 0.75 quality to keep payloads light
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxDim = 800;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);

            const hiddenInput = document.getElementById(hiddenInputId);
            if (hiddenInput) hiddenInput.value = compressedDataUrl;

            const previewImg = document.getElementById(previewImgId);
            if (previewImg) {
                previewImg.src = compressedDataUrl;
                previewImg.classList.remove('hidden');
            }

            const previewContainer = document.getElementById(previewImgId + '-container');
            if (previewContainer) previewContainer.classList.remove('hidden');

            if (window.showToast) window.showToast('Foto berhasil diunggah!', 'success');
        };
        img.onerror = function() {
            // Fallback if image load fails
            const hiddenInput = document.getElementById(hiddenInputId);
            if (hiddenInput) hiddenInput.value = rawDataUrl;

            const previewImg = document.getElementById(previewImgId);
            if (previewImg) {
                previewImg.src = rawDataUrl;
                previewImg.classList.remove('hidden');
            }
        };
        img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
};

window.clearUploadedImage = function(previewImgId, hiddenInputId) {
    const hiddenInput = document.getElementById(hiddenInputId);
    if (hiddenInput) hiddenInput.value = '';

    const previewImg = document.getElementById(previewImgId);
    if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
    }

    const previewContainer = document.getElementById(previewImgId + '-container');
    if (previewContainer) previewContainer.classList.add('hidden');

    const fileInput = document.getElementById(previewImgId + '-file-input');
    if (fileInput) fileInput.value = '';
};

// ============================================================================
// ENGINE TEBAK GAMBAR PROGRESIF (1/4 QUADRANT + 4 CLUES + DYNAMIC SCORE)
// ============================================================================
window.renderTebakGambarEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const rawHints = Array.isArray(game.hints) ? game.hints : [game.hints || ''];
    const hints = [];
    for (let i = 0; i < 4; i++) {
        hints.push((rawHints[i] || `Petunjuk ${i + 1}`).trim());
    }

    activeGameSession.tebakGambarState = {
        game,
        revealedCount: 1, // Opens 1/4 first
        hints,
        baseXp: Number(game.rewardXp) || 100,
        rawKey: String(game.answerKey || game.correctAnswer || '').trim().toUpperCase(),
        typedLetters: []
    };

    renderTebakGambarLayout();
};

window.renderTebakGambarLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.tebakGambarState;
    if (!state) return;

    const game = state.game;
    const revealed = state.revealedCount; // 1, 2, 3, or 4
    const baseXp = state.baseXp;
    
    // XP multiplier: 1 tile = 100%, 2 tiles = 75%, 3 tiles = 50%, 4 tiles = 25%
    const multiplier = (5 - revealed) / 4;
    const potentialXp = Math.max(10, Math.round(baseXp * multiplier));

    const isCovered1 = revealed < 1;
    const isCovered2 = revealed < 2;
    const isCovered3 = revealed < 3;
    const isCovered4 = revealed < 4;

    container.innerHTML = `
        <div class="space-y-5 max-w-lg mx-auto w-full animate-fade-in">
            <!-- Header status & XP Badge -->
            <div class="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
                <div>
                    <span class="text-[10px] uppercase tracking-wider font-extrabold bg-white/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
                        🖼️ Tebak Gambar Progresif
                    </span>
                    <h3 class="text-sm font-black">${gameEscapeHtml(game.title || 'Tebak Gambar')}</h3>
                </div>
                <div class="text-right">
                    <span class="text-[10px] text-emerald-100 font-bold block">Potensi Nilai/XP</span>
                    <span class="text-lg font-black text-amber-300 bg-black/30 px-3 py-1 rounded-xl inline-block border border-amber-400/30">
                        +${potentialXp} XP
                    </span>
                </div>
            </div>

            <!-- Image with 4 Quadrant Cover Overlays -->
            <div class="relative w-full aspect-square max-w-[300px] mx-auto rounded-3xl overflow-hidden border-4 border-slate-800 shadow-xl bg-slate-900">
                ${game.imageUrl ? `
                    <img src="${gameEscapeAttr(gameSafeImageUrl(game.imageUrl))}" class="w-full h-full object-cover">
                ` : `
                    <div class="w-full h-full flex items-center justify-center text-slate-500 font-bold text-xs p-4 text-center">
                        (Gambar tidak tersedia)
                    </div>
                `}

                <!-- Quadrant 1 (Top-Left) -->
                <div class="absolute top-0 left-0 w-1/2 h-1/2 border-r border-b border-white/20 flex items-center justify-center transition-all duration-500 ${isCovered1 ? 'bg-slate-950/95 backdrop-blur-md' : 'bg-transparent pointer-events-none'}">
                    ${isCovered1 ? '<span class="text-2xl font-black text-slate-500">🔒 1</span>' : '<span class="text-[10px] font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded-full absolute top-2 left-2">Bagian 1</span>'}
                </div>

                <!-- Quadrant 2 (Top-Right) -->
                <div class="absolute top-0 right-0 w-1/2 h-1/2 border-l border-b border-white/20 flex items-center justify-center transition-all duration-500 ${isCovered2 ? 'bg-slate-950/95 backdrop-blur-md' : 'bg-transparent pointer-events-none'}">
                    ${isCovered2 ? '<span class="text-2xl font-black text-slate-500">🔒 2</span>' : '<span class="text-[10px] font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded-full absolute top-2 right-2">Bagian 2</span>'}
                </div>

                <!-- Quadrant 3 (Bottom-Left) -->
                <div class="absolute bottom-0 left-0 w-1/2 h-1/2 border-r border-t border-white/20 flex items-center justify-center transition-all duration-500 ${isCovered3 ? 'bg-slate-950/95 backdrop-blur-md' : 'bg-transparent pointer-events-none'}">
                    ${isCovered3 ? '<span class="text-2xl font-black text-slate-500">🔒 3</span>' : '<span class="text-[10px] font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded-full absolute bottom-2 left-2">Bagian 3</span>'}
                </div>

                <!-- Quadrant 4 (Bottom-Right) -->
                <div class="absolute bottom-0 right-0 w-1/2 h-1/2 border-l border-t border-white/20 flex items-center justify-center transition-all duration-500 ${isCovered4 ? 'bg-slate-950/95 backdrop-blur-md' : 'bg-transparent pointer-events-none'}">
                    ${isCovered4 ? '<span class="text-2xl font-black text-slate-500">🔒 4</span>' : '<span class="text-[10px] font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded-full absolute bottom-2 right-2">Bagian 4</span>'}
                </div>
            </div>

            <!-- Reveal Control Button -->
            <div class="text-center space-y-1">
                ${revealed < 4 ? `
                    <button type="button" onclick="revealNextTebakGambarTile()" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer inline-flex items-center gap-2">
                        <span>🔓 Buka Gambar Ke-${revealed + 1} & Clue Ke-${revealed + 1}</span>
                        <span class="bg-amber-950/20 px-2 py-0.5 rounded-md text-[10px] text-amber-950 font-bold">-25% XP</span>
                    </button>
                    <p class="text-[10px] font-semibold text-slate-500">Membuka bagian gambar baru akan membuka clue berikutnya, namun nilai berkurang 25%.</p>
                ` : `
                    <span class="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl inline-block">
                        ✨ Seluruh 4 bagian gambar & 4 clue telah terbuka!
                    </span>
                `}
            </div>

            <!-- Clues Section (4 Clues) -->
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 class="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <i class="fa-solid fa-lightbulb text-amber-500"></i> Petunjuk & Clue Progresif (${revealed}/4 Terbuka)
                </h4>
                <div class="grid grid-cols-1 gap-2">
                    ${state.hints.map((hint, idx) => {
                        const isUnlocked = idx < revealed;
                        return `
                            <div class="p-2.5 rounded-xl text-xs transition-all ${isUnlocked ? 'bg-amber-50/90 border border-amber-300 text-amber-950 font-medium' : 'bg-slate-100 border border-slate-200 text-slate-400 italic'}">
                                <div class="flex items-center justify-between">
                                    <span class="font-extrabold ${isUnlocked ? 'text-amber-800' : 'text-slate-400'}">Clue ${idx + 1}:</span>
                                    <span class="text-[10px] font-bold ${isUnlocked ? 'text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full' : 'text-slate-400'}">
                                        ${isUnlocked ? 'Terbuka' : 'Terkunci 🔒'}
                                    </span>
                                </div>
                                <p class="mt-1 text-[11px] ${isUnlocked ? 'font-semibold text-slate-800' : 'text-slate-400'}">
                                    ${isUnlocked ? (hint || `Petunjuk bagian ${idx + 1}`) : `Buka bagian gambar ke-${idx + 1} untuk melihat clue ini.`}
                                </p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Answer Input Section -->
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-center">
                <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Masukkan Jawaban Tebak Gambar
                </label>

                <input type="text" id="tebak-gambar-input-box" value="${state.typedLetters.join('')}" oninput="activeGameSession.tebakGambarState.typedLetters = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').split(''); updateTebakGambarDisplay();" placeholder="Ketik jawaban di sini..." class="w-full text-center tracking-widest font-black text-lg p-3 border-2 border-emerald-400 focus:border-emerald-600 rounded-xl outline-none uppercase bg-emerald-50/30 text-emerald-950">

                <div class="flex items-center justify-center gap-2 pt-1">
                    <button type="button" onclick="activeGameSession.tebakGambarState.typedLetters = []; updateTebakGambarDisplay();" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer">
                        Reset
                    </button>
                    <button type="button" onclick="submitTebakGambarAnswer()" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer">
                        Kirim Jawaban (+${potentialXp} XP)
                    </button>
                </div>
            </div>
        </div>
    `;
};

window.revealNextTebakGambarTile = function() {
    const state = activeGameSession.tebakGambarState;
    if (!state) return;
    if (state.revealedCount < 4) {
        state.revealedCount++;
        renderTebakGambarLayout();
        if (window.showToast) {
            window.showToast(`Bagian gambar ${state.revealedCount} & Clue ${state.revealedCount} terbuka! (Nilai sekarang: ${Math.round(state.baseXp * ((5 - state.revealedCount) / 4))} XP)`, "info");
        }
    }
};

window.updateTebakGambarDisplay = function() {
    const state = activeGameSession.tebakGambarState;
    if (!state) return;
    const inputEl = document.getElementById('tebak-gambar-input-box');
    if (inputEl) {
        inputEl.value = state.typedLetters.join('');
    }
};

window.submitTebakGambarAnswer = function() {
    const state = activeGameSession.tebakGambarState;
    if (!state) return;

    const inputEl = document.getElementById('tebak-gambar-input-box');
    const userAns = inputEl ? inputEl.value.trim().toUpperCase() : state.typedLetters.join('').trim().toUpperCase();

    if (!userAns) {
        if (window.showToast) window.showToast('Ketikkan jawabanmu terlebih dahulu!', 'warning');
        return;
    }

    const revealed = state.revealedCount;
    const baseXp = state.baseXp;
    const multiplier = (5 - revealed) / 4;
    const earnedXp = Math.max(10, Math.round(baseXp * multiplier));

    submitGameSessionAnswer(userAns, false, earnedXp);
};

// ============================================================================
// ENGINE CARI KATA (WORD SEARCH WITH CLUE & DYNAMIC GRID GENERATOR)
// ============================================================================
window.generateWordSearchGrid = function(wordsToFind) {
    const cleanWords = (Array.isArray(wordsToFind) ? wordsToFind : [])
        .map(w => String(w || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
        .filter(w => w.length > 0);

    if (cleanWords.length === 0) {
        cleanWords.push('MONITOR', 'KEYBOARD', 'MOUSE');
    }

    let maxLen = 0;
    cleanWords.forEach(w => { if (w.length > maxLen) maxLen = w.length; });

    const rows = Math.max(10, Math.min(12, maxLen + 2));
    const cols = Math.max(10, Math.min(12, maxLen + 2));

    const grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push('');
        }
        grid.push(row);
    }

    const directions = [
        [0, 1],   // Horizontal L->R
        [1, 0],   // Vertical T->B
        [1, 1],   // Diagonal TL->BR
        [0, -1],  // Horizontal R->L
        [-1, 0],  // Vertical B->T
        [-1, 1],  // Diagonal BL->TR
    ];

    const placedWordsInfo = [];

    cleanWords.forEach(word => {
        let placed = false;
        let attempts = 0;
        const maxAttempts = 150;

        while (!placed && attempts < maxAttempts) {
            attempts++;
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const dr = dir[0];
            const dc = dir[1];

            const minR = dr < 0 ? word.length - 1 : 0;
            const maxR = dr > 0 ? rows - word.length : rows - 1;
            const minC = dc < 0 ? word.length - 1 : 0;
            const maxC = dc > 0 ? cols - word.length : cols - 1;

            if (minR > maxR || minC > maxC) continue;

            const startR = Math.floor(Math.random() * (maxR - minR + 1)) + minR;
            const startC = Math.floor(Math.random() * (maxC - minC + 1)) + minC;

            let canPlace = true;
            for (let i = 0; i < word.length; i++) {
                const r = startR + dr * i;
                const c = startC + dc * i;
                const existing = grid[r][c];
                if (existing !== '' && existing !== word[i]) {
                    canPlace = false;
                    break;
                }
            }

            if (canPlace) {
                const coords = [];
                for (let i = 0; i < word.length; i++) {
                    const r = startR + dr * i;
                    const c = startC + dc * i;
                    grid[r][c] = word[i];
                    coords.push({ r, c, char: word[i] });
                }
                placedWordsInfo.push({ word, coords });
                placed = true;
            }
        }

        if (!placed) {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c <= cols - word.length; c++) {
                    let canPlace = true;
                    for (let i = 0; i < word.length; i++) {
                        if (grid[r][c + i] !== '' && grid[r][c + i] !== word[i]) {
                            canPlace = false;
                            break;
                        }
                    }
                    if (canPlace) {
                        const coords = [];
                        for (let i = 0; i < word.length; i++) {
                            grid[r][c + i] = word[i];
                            coords.push({ r, c: c + i, char: word[i] });
                        }
                        placedWordsInfo.push({ word, coords });
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
        }
    });

    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] === '') {
                grid[r][c] = alpha[Math.floor(Math.random() * alpha.length)];
            }
        }
    }

    return { grid, placedWordsInfo, words: cleanWords, rows, cols };
};

window.renderWordSearchEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const rawWords = Array.isArray(game.wordsToFind) && game.wordsToFind.length > 0 
        ? game.wordsToFind 
        : ['MONITOR', 'KEYBOARD', 'MOUSE'];

    const clueText = (game.hints && game.hints[0]) || game.prompt || 'Hardware Computer';
    const gridData = generateWordSearchGrid(rawWords);

    activeGameSession.wordSearchState = {
        game,
        gridData,
        clueText,
        foundWords: [],
        foundCells: [],
        selectedCells: [],
    };

    renderWordSearchLayout();
};

window.renderWordSearchLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.wordSearchState;
    if (!state) return;

    const { gridData, clueText, foundWords, foundCells, selectedCells } = state;
    const { grid, words, rows, cols } = gridData;

    const totalWords = words.length;
    const foundCount = foundWords.length;
    const isAllFound = foundCount >= totalWords;

    const currentSelectedWord = selectedCells.map(cell => cell.char).join('');

    container.innerHTML = `
        <div class="space-y-4 max-w-lg mx-auto w-full animate-fade-in text-center">
            
            <!-- Clue Header Banner -->
            <div class="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-4 rounded-2xl shadow-md border border-purple-500/30 text-left">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] uppercase font-black bg-white/20 px-2.5 py-0.5 rounded-full tracking-wider">
                        🔍 Cari Kata (Word Search)
                    </span>
                    <span class="text-xs font-black text-purple-200 bg-black/30 px-3 py-1 rounded-xl">
                        ${foundCount} / ${totalWords} Kata Ditemukan
                    </span>
                </div>

                <div class="mt-2 space-y-0.5">
                    <span class="text-[10px] font-bold text-purple-200 block uppercase tracking-wide">Petunjuk / Clue Utama:</span>
                    <h3 class="text-base font-black text-amber-300 flex items-center gap-2">
                        <i class="fa-solid fa-lightbulb text-amber-400"></i> ${clueText}
                    </h3>
                </div>
            </div>

            <!-- Target Words Status -->
            <div class="bg-purple-50 p-3.5 rounded-2xl border border-purple-200 space-y-2">
                <p class="text-xs font-bold text-slate-700 flex items-center justify-center gap-1">
                    <span>Temukan ${totalWords} kata tersembunyi berdasarkan clue di atas:</span>
                </p>
                <div class="flex items-center justify-center gap-2 flex-wrap">
                    ${words.map((w, idx) => {
                        const isFound = foundWords.includes(w);
                        return `
                            <span class="px-3 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1.5 ${isFound ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs'}">
                                <span>${isFound ? '✅ ' + w : '🔒 Kata ' + (idx + 1)}</span>
                                <span class="text-[10px] font-semibold ${isFound ? 'text-emerald-200' : 'text-slate-400'}">(${w.length} hrf)</span>
                            </span>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Currently Selected Word Box -->
            <div class="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-2 shadow-inner">
                <div class="flex-1 text-left px-2">
                    <span class="text-[10px] text-slate-400 font-bold block uppercase">Kata Terpilih Saat Ini:</span>
                    <span class="text-sm font-black text-amber-300 tracking-widest min-h-[20px] inline-block font-mono">
                        ${currentSelectedWord || '<span class="text-slate-600 font-sans text-xs italic font-normal">Tekan huruf pada papan untuk membentuk kata...</span>'}
                    </span>
                </div>
                ${selectedCells.length > 0 ? `
                    <div class="flex items-center gap-1">
                        <button type="button" onclick="clearWordSearchSelection()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer">
                            Reset
                        </button>
                        <button type="button" onclick="checkSelectedWordSearch()" class="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer">
                            Cek Kata
                        </button>
                    </div>
                ` : ''}
            </div>

            <!-- Interactive Letter Grid -->
            <div class="bg-slate-950 p-3.5 rounded-3xl border-4 border-slate-800 shadow-xl max-w-sm mx-auto">
                <div class="grid gap-1" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">
                    ${grid.flatMap((rowArr, r) => rowArr.map((char, c) => {
                        const cellKey = `${r}-${c}`;
                        const isFound = foundCells.includes(cellKey);
                        const isSelected = selectedCells.some(cell => cell.r === r && cell.c === c);

                        let btnClass = "aspect-square w-full font-black text-xs sm:text-sm rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-center select-none ";
                        
                        if (isFound) {
                            btnClass += "bg-emerald-500 text-white font-extrabold shadow-md ring-2 ring-emerald-300 animate-pulse";
                        } else if (isSelected) {
                            btnClass += "bg-amber-400 text-slate-950 font-extrabold scale-105 shadow-md ring-2 ring-amber-300";
                        } else {
                            btnClass += "bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95";
                        }

                        return `
                            <button type="button" onclick="toggleSelectWordSearchCell(${r}, ${c})" class="${btnClass}">
                                ${char}
                            </button>
                        `;
                    })).join('')}
                </div>
            </div>

            <!-- Action Area -->
            <div class="pt-2">
                ${isAllFound ? `
                    <div class="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-900 space-y-2">
                        <div class="text-sm font-black flex items-center justify-center gap-2 text-emerald-700">
                            <span>🎉 SELAMAT! SEMUA KATA TERSEMBUNYI BERHASIL DITEMUKAN!</span>
                        </div>
                        <p class="text-xs font-semibold text-emerald-800">Kamu mendapatkan poin penuh +${state.game.rewardXp || 120} XP!</p>
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer inline-flex items-center gap-2">
                            <span>🚀 Klaim Hasil & Selesaikan Game</span>
                        </button>
                    </div>
                ` : `
                    <button type="button" onclick="submitGameSessionAnswer('INCOMPLETE', ${foundCount === totalWords})" class="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer">
                        Selesaikan Game (${foundCount}/${totalWords} Kata)
                    </button>
                `}
            </div>
        </div>
    `;
};

window.toggleSelectWordSearchCell = function(r, c) {
    const state = activeGameSession.wordSearchState;
    if (!state) return;

    const cellKey = `${r}-${c}`;
    if (state.foundCells.includes(cellKey)) {
        if (window.showToast) window.showToast('Huruf ini sudah menjadi bagian dari kata yang kamu temukan!', 'info');
        return;
    }

    const char = state.gridData.grid[r][c];

    const existingIdx = state.selectedCells.findIndex(cell => cell.r === r && cell.c === c);
    if (existingIdx >= 0) {
        if (existingIdx === state.selectedCells.length - 1) {
            state.selectedCells.pop();
        } else {
            state.selectedCells = state.selectedCells.slice(0, existingIdx);
        }
    } else {
        state.selectedCells.push({ r, c, char });
    }

    renderWordSearchLayout();
    checkSelectedWordSearch(true);
};

window.clearWordSearchSelection = function() {
    const state = activeGameSession.wordSearchState;
    if (!state) return;
    state.selectedCells = [];
    renderWordSearchLayout();
};

window.checkSelectedWordSearch = function(isSilent = false) {
    const state = activeGameSession.wordSearchState;
    if (!state || state.selectedCells.length === 0) return;

    const formedWord = state.selectedCells.map(c => c.char).join('');
    const reversedFormedWord = formedWord.split('').reverse().join('');

    const targetWords = state.gridData.words;
    
    let matchedWord = null;
    targetWords.forEach(w => {
        if (!state.foundWords.includes(w)) {
            if (formedWord === w || reversedFormedWord === w) {
                matchedWord = w;
            }
        }
    });

    if (matchedWord) {
        state.foundWords.push(matchedWord);
        
        state.selectedCells.forEach(cell => {
            const key = `${cell.r}-${cell.c}`;
            if (!state.foundCells.includes(key)) {
                state.foundCells.push(key);
            }
        });

        state.selectedCells = [];

        if (window.showToast) {
            window.showToast(`✨ Hore! Kamu menemukan kata '${matchedWord}'!`, 'success');
        }

        renderWordSearchLayout();

        if (state.foundWords.length >= targetWords.length) {
            if (window.showToast) {
                window.showToast('🏆 Luar biasa! Semua kata tersembunyi berhasil ditemukan!', 'success');
            }
        }
    } else if (!isSilent) {
        if (window.showToast) {
            window.showToast(`Kata '${formedWord}' belum tepat. Coba susun huruf kembali!`, 'warning');
        }
    }
};

// ============================================================================
// ENGINE MEMORY MATCH (KARTU MEMORI FLIP MATCHING)
// ============================================================================
window.renderMemoryMatchEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const rawPairs = Array.isArray(game.pairs) && game.pairs.length > 0 
        ? game.pairs 
        : [
            { term: 'CPU', match: 'Otak Utama Komputer' },
            { term: 'KEYBOARD', match: 'Alat Papan Ketik' },
            { term: 'MONITOR', match: 'Layar Tampilan Visual' },
            { term: 'PRINTER', match: 'Pencetak Dokumen' }
        ];

    const rawCards = [];
    rawPairs.forEach((pair, pairIdx) => {
        const termText = String(pair.term || '').trim();
        const matchText = String(pair.match || '').trim();
        if (termText && matchText) {
            rawCards.push({ id: `term_${pairIdx}`, text: termText, cardType: 'Istilah', pairId: pairIdx });
            rawCards.push({ id: `match_${pairIdx}`, text: matchText, cardType: 'Definisi', pairId: pairIdx });
        }
    });

    if (rawCards.length === 0) {
        rawCards.push(
            { id: 'term_0', text: 'CPU', cardType: 'Istilah', pairId: 0 },
            { id: 'match_0', text: 'Otak Utama Komputer', cardType: 'Definisi', pairId: 0 },
            { id: 'term_1', text: 'KEYBOARD', cardType: 'Istilah', pairId: 1 },
            { id: 'match_1', text: 'Alat Papan Ketik', cardType: 'Definisi', pairId: 1 }
        );
    }

    const shuffledCards = rawCards.sort(() => Math.random() - 0.5).map((c, index) => ({
        idx: index,
        id: c.id,
        text: c.text,
        cardType: c.cardType,
        pairId: c.pairId,
        isFlipped: false,
        isMatched: false
    }));

    activeGameSession.memoryMatchState = {
        game,
        cards: shuffledCards,
        pairsCount: Math.floor(rawCards.length / 2),
        selectedIndices: [],
        isLock: false,
        attempts: 0,
        matchedPairsCount: 0
    };

    renderMemoryMatchLayout();
};

window.renderMemoryMatchLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.memoryMatchState;
    if (!state) return;

    const { game, cards, pairsCount, attempts, matchedPairsCount } = state;
    const isCompleted = matchedPairsCount >= pairsCount;

    container.innerHTML = `
        <div class="space-y-5 max-w-lg mx-auto w-full animate-fade-in text-center">
            
            <!-- Header Scoreboard & Instruction -->
            <div class="bg-gradient-to-r from-pink-600 via-rose-600 to-purple-700 text-white p-4 rounded-2xl shadow-md border border-pink-400/30 text-left flex items-center justify-between">
                <div>
                    <span class="text-[10px] uppercase font-black bg-white/20 px-2.5 py-0.5 rounded-full tracking-wider inline-block mb-1">
                        🧠 Memory Match (Kartu Memori)
                    </span>
                    <h3 class="text-sm font-black text-amber-200">${gameEscapeHtml(game.title || 'Cocokkan Kartu Memori')}</h3>
                    <p class="text-xs text-pink-100 font-medium mt-0.5">${gameEscapeHtml(game.prompt || 'Balikkan 2 kartu untuk menemukan pasangan istilah dan definisi!')}</p>
                </div>
                <div class="text-right space-y-1">
                    <span class="text-[10px] text-pink-200 font-bold block uppercase">Pasangan</span>
                    <span class="text-sm font-black text-amber-300 bg-black/30 px-3 py-1 rounded-xl inline-block border border-amber-300/30">
                        ${matchedPairsCount} / ${pairsCount}
                    </span>
                    <span class="text-[10px] text-pink-200 block font-semibold">Mencoba: ${attempts}x</span>
                </div>
            </div>

            <!-- Memory Card Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                ${cards.map((c, idx) => {
                    if (c.isMatched) {
                        return `
                            <div class="min-h-[100px] p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-2 border-emerald-300 flex flex-col items-center justify-center text-center shadow-md scale-98 transition-all">
                                <span class="text-[9px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full mb-1 text-emerald-100">
                                    ✓ ${c.cardType}
                                </span>
                                <span class="text-xs font-black leading-tight">${c.text}</span>
                            </div>
                        `;
                    } else if (c.isFlipped) {
                        return `
                            <div class="min-h-[100px] p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-2 border-amber-400 flex flex-col items-center justify-center text-center shadow-lg scale-102 transition-all">
                                <span class="text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full mb-1">
                                    ${c.cardType}
                                </span>
                                <span class="text-xs font-black leading-tight text-amber-200">${c.text}</span>
                            </div>
                        `;
                    } else {
                        return `
                            <button type="button" onclick="handleMemoryCardClick(${idx})" class="min-h-[100px] p-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-slate-300 border-2 border-slate-700 hover:border-pink-500/50 flex flex-col items-center justify-center text-center shadow-md transition-all duration-200 cursor-pointer active:scale-95 group">
                                <span class="text-2xl mb-1 group-hover:scale-110 transition-transform">🎴</span>
                                <span class="text-[10px] font-extrabold text-slate-400 group-hover:text-pink-300">Kartu #${idx + 1}</span>
                            </button>
                        `;
                    }
                }).join('')}
            </div>

            <!-- Controls & Completion -->
            <div class="pt-2">
                ${isCompleted ? `
                    <div class="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-900 space-y-2 animate-bounce-short">
                        <div class="text-sm font-black text-emerald-800 flex items-center justify-center gap-2">
                            <span>🎉 SEMUA KARTU MEMORI BERHASIL DICOCOKKAN!</span>
                        </div>
                        <p class="text-xs font-semibold text-emerald-700">Kamu menyelesaikan seluruh ${pairsCount} pasangan kartu dalam ${attempts}x percobaan!</p>
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer inline-flex items-center gap-2">
                            <span>🚀 Klaim XP (+${game.rewardXp || 100} XP)</span>
                        </button>
                    </div>
                ` : `
                    <div class="flex items-center justify-center gap-3">
                        <button type="button" onclick="renderMemoryMatchEngineUI(activeGameSession.memoryMatchState.game)" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer">
                            🔄 Kocok & Ulangi
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
};

window.handleMemoryCardClick = function(cardIdx) {
    const state = activeGameSession.memoryMatchState;
    if (!state || state.isLock) return;

    const card = state.cards[cardIdx];
    if (!card || card.isMatched || card.isFlipped) return;

    card.isFlipped = true;
    state.selectedIndices.push(cardIdx);

    renderMemoryMatchLayout();

    if (state.selectedIndices.length === 2) {
        state.isLock = true;
        state.attempts++;

        const [idx1, idx2] = state.selectedIndices;
        const card1 = state.cards[idx1];
        const card2 = state.cards[idx2];

        if (card1.pairId === card2.pairId) {
            setTimeout(() => {
                card1.isMatched = true;
                card2.isMatched = true;
                state.selectedIndices = [];
                state.isLock = false;
                state.matchedPairsCount++;

                if (window.showToast) {
                    window.showToast('✨ Pasangan Cocok!', 'success');
                }

                renderMemoryMatchLayout();

                if (state.matchedPairsCount >= state.pairsCount) {
                    if (window.showToast) {
                        window.showToast('🏆 Luar biasa! Semua kartu memori berhasil dicocokkan!', 'success');
                    }
                }
            }, 300);
        } else {
            setTimeout(() => {
                card1.isFlipped = false;
                card2.isFlipped = false;
                state.selectedIndices = [];
                state.isLock = false;

                renderMemoryMatchLayout();
            }, 900);
        }
    }
};

// ============================================================================
// ENGINE PUZZLE GAMBAR (3x3 IMAGE PUZZLE SWAPPER)
// ============================================================================
window.renderImagePuzzleEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const imageUrl = gameSafeImageUrl(game.imageUrl) || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';

    // Shuffle 9 tiles (0..8)
    let board = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
    while (board.every((val, idx) => val === idx)) {
        board = board.sort(() => Math.random() - 0.5);
    }

    activeGameSession.imagePuzzleState = {
        game,
        imageUrl,
        board,
        selectedIndex: null,
        moves: 0,
        isCompleted: false
    };

    renderImagePuzzleLayout();
};

window.renderImagePuzzleLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.imagePuzzleState;
    if (!state) return;

    const { game, imageUrl, board, selectedIndex, moves, isCompleted } = state;

    container.innerHTML = `
        <div class="space-y-4 max-w-md mx-auto w-full animate-fade-in text-center">
            
            <!-- Header Banner with Small Reference Image in Top Corner -->
            <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 text-white p-4 rounded-3xl shadow-xl border border-slate-700/80 text-left flex items-center justify-between gap-3">
                <div class="flex-1 space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] uppercase font-black bg-lime-400 text-slate-950 px-2.5 py-0.5 rounded-full tracking-wider">
                            🧩 Puzzle Gambar (3x3 Grid)
                        </span>
                        <span class="text-[10px] font-bold text-amber-300 bg-black/40 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                            Langkah: ${moves}x
                        </span>
                    </div>
                    <h3 class="text-sm font-black text-white">${gameEscapeHtml(game.title || 'Susun Gambar Utuh')}</h3>
                    <p class="text-[11px] text-slate-300 font-medium leading-tight">
                        ${gameEscapeHtml(game.prompt || 'Klik 1 bagian gambar lalu klik bagian lain untuk bertukar posisi!')}
                    </p>
                </div>

                <!-- Acuan Gambar Utuh Kecil di Pojok Atas -->
                <div class="flex flex-col items-center shrink-0 bg-slate-950/80 p-2 rounded-2xl border border-lime-400/50 shadow-inner group cursor-pointer" onclick="showReferenceImageModal(decodeURIComponent('${gameEncodedArg(imageUrl)}'))" title="Klik untuk memperbesar acuan gambar">
                    <span class="text-[8px] font-extrabold text-lime-300 uppercase tracking-widest mb-1 block">
                        🔍 Acuan Gambar
                    </span>
                    <img src="${gameEscapeAttr(imageUrl)}" class="w-14 h-14 object-cover rounded-xl border border-lime-400 shadow-sm group-hover:scale-105 transition-transform">
                </div>
            </div>

            <!-- Instruction Hint -->
            <div class="bg-lime-50 p-3 rounded-2xl border border-lime-200 text-xs font-bold text-lime-950 flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                    <i class="fa-solid fa-hand-pointer text-lime-600"></i>
                    ${selectedIndex !== null 
                        ? '<span class="text-amber-700 font-black">Bagian dipilih! Klik bagian lain untuk menukarnya.</span>' 
                        : 'Klik salah satu bagian gambar untuk mulai menukar.'}
                </span>
                <button type="button" onclick="showReferenceImageModal(decodeURIComponent('${gameEncodedArg(imageUrl)}'))" class="text-[10px] bg-lime-600 hover:bg-lime-700 text-white px-2.5 py-1 rounded-lg font-black transition cursor-pointer">
                    Lihat Acuan
                </button>
            </div>

            <!-- 3x3 Tile Grid -->
            <div class="bg-slate-950 p-3.5 rounded-3xl border-4 border-slate-800 shadow-2xl max-w-xs sm:max-w-sm mx-auto">
                <div class="grid grid-cols-3 gap-1.5">
                    ${board.map((origIdx, slotIdx) => {
                        const row = Math.floor(origIdx / 3);
                        const col = origIdx % 3;
                        const bgX = col * 50;
                        const bgY = row * 50;

                        const isSelected = selectedIndex === slotIdx;
                        const isCorrectPos = origIdx === slotIdx;

                        let borderStyle = "border-slate-700/80 hover:border-lime-400";
                        if (isSelected) {
                            borderStyle = "border-amber-400 ring-4 ring-amber-300 scale-105 shadow-2xl z-20";
                        } else if (isCorrectPos) {
                            borderStyle = "border-emerald-400/90 shadow-xs";
                        }

                        return `
                            <button type="button" onclick="handleImagePuzzleTileClick(${slotIdx})" class="aspect-square w-full rounded-2xl relative overflow-hidden transition-all duration-200 border-2 ${borderStyle} cursor-pointer active:scale-95 group shadow-md" style="background-image: url('${gameEscapeAttr(imageUrl)}'); background-size: 300% 300%; background-position: ${bgX}% ${bgY}%;">
                                ${isSelected ? `
                                    <span class="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                                        <span class="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                                            Dipilih
                                        </span>
                                    </span>
                                ` : ''}
                                ${isCorrectPos && !isCompleted ? `
                                    <span class="absolute top-1 right-1 w-3.5 h-3.5 bg-emerald-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-xs">
                                        ✓
                                    </span>
                                ` : ''}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Controls / Completion -->
            <div class="pt-2">
                ${isCompleted ? `
                    <div class="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-900 space-y-2 animate-bounce-short">
                        <div class="text-sm font-black text-emerald-800 flex items-center justify-center gap-2">
                            <span>🎉 SELAMAT! GAMBAR BERHASIL DISUSUN SEMPURNA!</span>
                        </div>
                        <p class="text-xs font-semibold text-emerald-700">Kamu menyelesaikan puzzle 9 bagian gambar dalam ${moves}x langkah!</p>
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer inline-flex items-center gap-2">
                            <span>🚀 Klaim XP (+${game.rewardXp || 120} XP)</span>
                        </button>
                    </div>
                ` : `
                    <div class="flex items-center justify-center gap-3">
                        <button type="button" onclick="renderImagePuzzleEngineUI(activeGameSession.imagePuzzleState.game)" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer">
                            🔄 Acak Ulang Gambar
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
};

window.handleImagePuzzleTileClick = function(slotIdx) {
    const state = activeGameSession.imagePuzzleState;
    if (!state || state.isCompleted) return;

    if (state.selectedIndex === null) {
        state.selectedIndex = slotIdx;
        renderImagePuzzleLayout();
    } else if (state.selectedIndex === slotIdx) {
        state.selectedIndex = null;
        renderImagePuzzleLayout();
    } else {
        const firstSlot = state.selectedIndex;
        const secondSlot = slotIdx;

        const temp = state.board[firstSlot];
        state.board[firstSlot] = state.board[secondSlot];
        state.board[secondSlot] = temp;

        state.selectedIndex = null;
        state.moves++;

        const isSolved = state.board.every((val, idx) => val === idx);
        if (isSolved) {
            state.isCompleted = true;
            if (window.showToast) {
                window.showToast('🎉 Luar Biasa! Gambar berhasil disusun sempurna!', 'success');
            }
        }

        renderImagePuzzleLayout();
    }
};

window.showReferenceImageModal = function(imgUrl) {
    const existing = document.getElementById('puzzle-reference-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'puzzle-reference-modal';
    overlay.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in cursor-pointer';
    overlay.onclick = function() { overlay.remove(); };
    overlay.innerHTML = `
        <div class="bg-white p-4 rounded-3xl max-w-sm w-full shadow-2xl border-4 border-lime-400 space-y-3 text-center" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between">
                <h4 class="font-extrabold text-xs uppercase text-slate-800 flex items-center gap-1.5">
                    <i class="fa-solid fa-eye text-lime-600"></i> Acuan Kunci Gambar Utuh
                </h4>
                <button type="button" onclick="document.getElementById('puzzle-reference-modal').remove()" class="text-slate-400 hover:text-slate-700 font-black text-lg cursor-pointer">&times;</button>
            </div>
            <div class="p-2 bg-slate-900 rounded-2xl border border-slate-800">
                <img src="${imgUrl}" class="w-full max-h-72 object-contain rounded-xl shadow-md">
            </div>
            <p class="text-[10px] font-bold text-slate-500">Susun 9 bagian gambar hingga persis seperti gambar acuan ini.</p>
        </div>
    `;
    document.body.appendChild(overlay);
};

// ============================================================================
// ENGINE LABIRIN BENANG KUSUT (TANGLED MAZE MATCHING WITH AVATAR ANIMATION)
// ============================================================================
window.renderLabirinEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    // Get prompt/soal
    const prompt = game.prompt || game.title || 'Otak komputer adalah...';

    // Get finish options at top (e.g., ['CPU', 'RAM', 'Printer'])
    let options = Array.isArray(game.options) && game.options.length > 0 
        ? game.options.filter(o => typeof o === 'string' && o.trim() !== '')
        : [];

    if (options.length === 0) {
        if (Array.isArray(game.pairs) && game.pairs.length > 0) {
            options = game.pairs.map(p => p.match || p.term).filter(Boolean);
        }
    }

    if (options.length < 2) {
        options = ['CPU', 'RAM', 'Printer'];
    }

    // Determine correct answer key
    let answerKey = game.answerKey || options[0];
    if (!options.map(o => o.trim().toUpperCase()).includes(answerKey.trim().toUpperCase())) {
        answerKey = options[0];
    }

    // Prepare top finish items
    const topFinishItems = options.map((optText, idx) => ({
        id: idx,
        text: optText,
        isCorrect: optText.trim().toUpperCase() === answerKey.trim().toUpperCase()
    }));

    // Create permuted mapping from bottom START buttons (0..N-1) to TOP finish items (0..N-1)
    const topIndicesShuffled = topFinishItems.map((_, idx) => idx).sort(() => Math.random() - 0.5);

    const startToTopMap = {};
    topIndicesShuffled.forEach((topIdx, startIdx) => {
        startToTopMap[startIdx] = topIdx;
    });

    activeGameSession.labirinState = {
        game,
        prompt,
        options,
        answerKey,
        topFinishItems,
        startToTopMap,
        activeStartIdx: null,
        animating: false,
        characterPos: null,
        activePathD: null,
        visitedStarts: {}, // { [startIdx]: { topIdx, isCorrect } }
        isCompleted: false
    };

    renderLabirinLayout();
};

window.renderLabirinLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.labirinState;
    if (!state) return;

    const { game, prompt, topFinishItems, startToTopMap, animating, characterPos, activePathD, visitedStarts, isCompleted } = state;
    const totalCount = topFinishItems.length;

    container.innerHTML = `
        <div class="space-y-4 max-w-2xl mx-auto w-full animate-fade-in text-center select-none">
            
            <!-- Question Banner -->
            <div class="bg-gradient-to-r from-amber-900 via-amber-800 to-slate-900 text-white p-4.5 rounded-3xl shadow-xl border border-amber-500/40 text-left flex items-center justify-between gap-3">
                <div class="space-y-1.5 flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] uppercase font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                            <i class="fa-solid fa-route"></i> Labirin Benang Kusut
                        </span>
                        <span class="text-[10px] font-bold text-amber-200 bg-black/40 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                            Finish: ${totalCount} Pilihan
                        </span>
                    </div>
                    <h3 class="text-xs uppercase font-extrabold text-amber-300 tracking-wider">Soal Pertanyaan:</h3>
                    <p class="text-base sm:text-lg font-black text-white leading-snug">${prompt}</p>
                </div>
                <div class="hidden sm:block text-4xl">🏃‍♂️</div>
            </div>

            <!-- Instruction Hint -->
            <div class="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs font-bold text-amber-950 flex items-center justify-between">
                <span class="flex items-center gap-1.5 text-left">
                    <i class="fa-solid fa-compass text-amber-600 text-sm"></i>
                    <span>Telusuri benang dari <strong class="text-amber-800">START (Bawah)</strong> menuju jawaban <strong class="text-amber-800">FINISH (Atas)</strong> yang benar!</span>
                </span>
                <span class="text-[10px] bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-black shrink-0">
                    ${isCompleted ? '🎉 Berhasil!' : 'Pilih Jalur!'}
                </span>
            </div>

            <!-- LABIRIN BOARD CONTAINER -->
            <div class="bg-slate-900 p-4 sm:p-5 rounded-3xl border-4 border-slate-800 shadow-2xl relative overflow-hidden">
                
                <!-- BARIS ATAS (FINISH OPTIONS) -->
                <div class="mb-2 relative z-10">
                    <div class="text-[10px] font-black uppercase text-amber-400/90 tracking-widest mb-1.5 flex items-center justify-center gap-1">
                        <i class="fa-solid fa-flag-checkered text-amber-400"></i> BARIS ATAS (FINISH / PILIHAN JAWABAN)
                    </div>
                    <div class="grid gap-2.5" style="grid-template-columns: repeat(${totalCount}, minmax(0, 1fr));">
                        ${topFinishItems.map((item, topIdx) => {
                            const visitedBy = Object.entries(visitedStarts).find(([_, info]) => info.topIdx === topIdx);
                            const isCorrect = visitedBy && visitedBy[1].isCorrect;
                            const isWrong = visitedBy && !visitedBy[1].isCorrect;

                            let cardStyle = "bg-slate-800/90 text-slate-100 border-slate-700 shadow-md";
                            if (isCorrect) {
                                cardStyle = "bg-emerald-600 text-white border-emerald-300 ring-4 ring-emerald-400/50 font-black shadow-xl scale-105";
                            } else if (isWrong) {
                                cardStyle = "bg-rose-950/80 text-rose-300 border-rose-700/80 line-through opacity-80";
                            }

                            return `
                                <div class="p-3 rounded-2xl border-2 text-xs sm:text-sm font-extrabold transition-all duration-300 flex flex-col items-center justify-center gap-1 ${cardStyle}">
                                    <span class="text-[9px] uppercase tracking-wider font-black text-amber-300/80">Finish #${topIdx + 1}</span>
                                    <span class="line-clamp-2">${item.text}</span>
                                    ${isCorrect ? '<span class="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full font-black border border-emerald-400">✓ BENAR!</span>' : ''}
                                    ${isWrong ? '<span class="text-[9px] text-rose-400 font-bold">❌ Salah</span>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- MIDDLE SVG CANVAS (TANGLED THREADS / BENANG KUSUT) -->
                <div class="relative w-full h-48 sm:h-56 bg-slate-950 rounded-2xl border border-slate-800/80 my-3 overflow-hidden shadow-inner">
                    <svg id="labirin-svg" class="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 500 200" preserveAspectRatio="none">
                        
                        <!-- Ambient Tangled Thread Lines -->
                        ${Object.entries(startToTopMap).map(([startStr, topIdx]) => {
                            const startIdx = parseInt(startStr, 10);
                            const startX = ((startIdx + 0.5) / totalCount) * 500;
                            const topX = ((topIdx + 0.5) / totalCount) * 500;

                            const cX1 = startX + (startIdx % 2 === 0 ? 70 : -70);
                            const cX2 = topX + (topIdx % 2 === 0 ? -70 : 70);

                            const visitedInfo = visitedStarts[startIdx];
                            const isVisitedCorrect = visitedInfo && visitedInfo.isCorrect;
                            const isVisitedWrong = visitedInfo && !visitedInfo.isCorrect;

                            let strokeColor = "#334155";
                            let strokeWidth = "2";
                            let dashArray = "4,4";
                            let opacity = "0.45";

                            if (isVisitedCorrect) {
                                strokeColor = "#10b981";
                                strokeWidth = "4";
                                dashArray = "none";
                                opacity = "1";
                            } else if (isVisitedWrong) {
                                strokeColor = "#f43f5e";
                                strokeWidth = "2.5";
                                dashArray = "none";
                                opacity = "0.6";
                            }

                            return `
                                <path 
                                    d="M ${startX},190 C ${cX1},130 ${cX2},70 ${topX},10" 
                                    fill="none" 
                                    stroke="${strokeColor}" 
                                    stroke-width="${strokeWidth}" 
                                    stroke-dasharray="${dashArray}" 
                                    opacity="${opacity}" 
                                />
                            `;
                        }).join('')}

                        <!-- Active Animating Path -->
                        ${activePathD ? `
                            <path 
                                d="${activePathD}" 
                                fill="none" 
                                stroke="#f59e0b" 
                                stroke-width="5" 
                                stroke-linecap="round"
                                class="animate-pulse"
                            />
                        ` : ''}
                    </svg>

                    <!-- ANIMATED RUNNING AVATAR CHARACTER -->
                    ${characterPos ? `
                        <div class="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 pointer-events-none"
                             style="left: ${characterPos.x}%; top: ${characterPos.y}%;">
                            <div class="bg-amber-400 text-slate-950 p-2 rounded-full shadow-2xl border-2 border-white text-base sm:text-xl animate-bounce flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12">
                                🏃‍♂️
                            </div>
                        </div>
                    ` : ''}

                    <!-- Center Label / Prompt -->
                    ${!animating && Object.keys(visitedStarts).length === 0 ? `
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span class="bg-slate-900/90 text-amber-300 border border-amber-500/30 text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg backdrop-blur-xs flex items-center gap-2">
                                <i class="fa-solid fa-route animate-spin"></i> Benang Kusut Siap Ditelusuri Dari Bawah!
                            </span>
                        </div>
                    ` : ''}
                </div>

                <!-- BARIS BAWAH (START BUTTONS) -->
                <div class="mt-2 relative z-10">
                    <div class="text-[10px] font-black uppercase text-amber-400/90 tracking-widest mb-1.5 flex items-center justify-center gap-1">
                        <i class="fa-solid fa-play text-amber-400"></i> BARIS BAWAH (START / PILIH JALUR MULTI-START)
                    </div>
                    <div class="grid gap-2.5" style="grid-template-columns: repeat(${totalCount}, minmax(0, 1fr));">
                        ${topFinishItems.map((_, startIdx) => {
                            const visited = visitedStarts[startIdx];
                            const isCorrect = visited && visited.isCorrect;
                            const isWrong = visited && !visited.isCorrect;

                            let btnStyle = "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 font-black shadow-lg hover:scale-105";
                            if (isCorrect) {
                                btnStyle = "bg-emerald-600 text-white border-emerald-300 font-black shadow-md cursor-default";
                            } else if (isWrong) {
                                btnStyle = "bg-slate-800 text-slate-400 border-slate-700 opacity-60 cursor-default";
                            }

                            return `
                                <button type="button" 
                                    onclick="handleLabirinStartClick(${startIdx})"
                                    ${visited || animating || isCompleted ? 'disabled' : ''}
                                    class="p-3 rounded-2xl border-2 text-xs font-extrabold transition-all duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer ${btnStyle}">
                                    <span class="text-[9px] uppercase tracking-wider text-slate-900/80 font-black">START #${startIdx + 1}</span>
                                    <span class="line-clamp-1">🚀 Jalur ${startIdx + 1}</span>
                                    ${isCorrect ? '<span class="text-[9px] text-emerald-200 font-bold">✓ Tepat!</span>' : ''}
                                    ${isWrong ? '<span class="text-[9px] text-rose-400 font-bold">❌ Salah</span>' : ''}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

            </div>

            <!-- Footer / Claim XP Banner -->
            <div class="pt-2">
                ${isCompleted ? `
                    <div class="p-5 bg-emerald-50 border-2 border-emerald-400 rounded-3xl text-emerald-900 space-y-3 animate-bounce-short shadow-xl">
                        <div class="text-base font-black text-emerald-800 flex items-center justify-center gap-2">
                            <span>🎉 SELAMAT! KAMU MENEMUKAN JALUR JAWABAN BENAR!</span>
                        </div>
                        <p class="text-xs font-semibold text-emerald-700">Karakter berhasil menelusuri benang kusut menuju <strong>"${state.answerKey}"</strong>!</p>
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-lg transition cursor-pointer inline-flex items-center gap-2">
                            <span>🚀 Klaim Rewards (+${game.rewardXp || 150} XP)</span>
                        </button>
                    </div>
                ` : `
                    <div class="flex items-center justify-center gap-3">
                        <button type="button" onclick="renderLabirinEngineUI(activeGameSession.labirinState.game)" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-arrows-rotate"></i> Acak Ulang Jalur Benang
                        </button>
                    </div>
                `}
            </div>

        </div>
    `;
};

window.handleLabirinStartClick = function(startIdx) {
    const state = activeGameSession.labirinState;
    if (!state || state.animating || state.visitedStarts[startIdx] || state.isCompleted) return;

    const topIdx = state.startToTopMap[startIdx];
    const targetItem = state.topFinishItems[topIdx];
    const isCorrect = targetItem.isCorrect;

    state.animating = true;
    state.activeStartIdx = startIdx;

    // SVG coordinates (0..500 for X, 0..200 for Y)
    const totalCount = state.topFinishItems.length;
    const startX = ((startIdx + 0.5) / totalCount) * 500;
    const topX = ((topIdx + 0.5) / totalCount) * 500;

    const cX1 = startX + (startIdx % 2 === 0 ? 70 : -70);
    const cX2 = topX + (topIdx % 2 === 0 ? -70 : 70);

    state.activePathD = `M ${startX},190 C ${cX1},130 ${cX2},70 ${topX},10`;

    // Percentage coordinates for avatar position
    const pStartPct = { x: ((startIdx + 0.5) / totalCount) * 100, y: 95 };
    const pTopPct = { x: ((topIdx + 0.5) / totalCount) * 100, y: 5 };
    const pCX1Pct = { x: pStartPct.x + (startIdx % 2 === 0 ? 15 : -15), y: 65 };
    const pCX2Pct = { x: pTopPct.x + (topIdx % 2 === 0 ? -15 : 15), y: 35 };

    function getCubicBezierPoint(t, p0, p1, p2, p3) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        let x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
        let y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
        return { x, y };
    }

    let startTime = null;
    const duration = 1400; // 1.4s animation

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        let progress = Math.min(elapsed / duration, 1);

        const point = getCubicBezierPoint(progress, pStartPct, pCX1Pct, pCX2Pct, pTopPct);
        state.characterPos = point;

        renderLabirinLayout();

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            setTimeout(() => {
                state.visitedStarts[startIdx] = { topIdx, isCorrect };

                if (isCorrect) {
                    state.isCompleted = true;
                    if (window.showToast) window.showToast(`🎉 HORE! Jalur Start ${startIdx + 1} menuntun kamu ke "${targetItem.text}" (JAWABAN BENAR)!`, 'success');
                } else {
                    if (window.showToast) window.showToast(`❌ Jalur Start ${startIdx + 1} mengarah ke "${targetItem.text}" (KURANG TEPAT). Coba telusuri jalur Start lainnya!`, 'warning');
                }

                state.animating = false;
                state.characterPos = null;
                state.activePathD = null;

                renderLabirinLayout();
            }, 300);
        }
    }

    requestAnimationFrame(step);
};

// ============================================================================
// GAME MONITORING DASHBOARD (LIVE GAME MONITORING - MIRRORING CBT MONITORING)
// ============================================================================
let gameMonitoringPollTimer = null;

window.openGameMonitoringDashboardModal = function() {
    window.__adminGameSubTab = 'monitoring';

    if (!appState.gameMonitoringClassId) appState.gameMonitoringClassId = 'all';
    if (!appState.gameMonitoringGameId) appState.gameMonitoringGameId = 'all';
    if (!appState.gameMonitoringStatus) appState.gameMonitoringStatus = 'all';
    if (!appState.gameMonitoringSearch) appState.gameMonitoringSearch = '';
    if (!appState.gameMonitoringLivecamMode) appState.gameMonitoringLivecamMode = 'gambar';
    if (!appState.gameMonitoringStudentModes) appState.gameMonitoringStudentModes = {};

    const viewContainer = document.getElementById('view-container');
    if (viewContainer) {
        renderGameAdminModule(viewContainer);
    } else {
        renderGameMonitoringDashboard();
    }
};

window.closeGameMonitoringDashboardModal = function() {
    if (gameMonitoringPollTimer) {
        clearInterval(gameMonitoringPollTimer);
        gameMonitoringPollTimer = null;
    }
    window.__adminGameSubTab = 'kelola';
    const viewContainer = document.getElementById('view-container');
    if (viewContainer) {
        renderGameAdminModule(viewContainer);
    } else {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
    }
};

window.toggleGameMonitoringLivecamMode = function() {
    const targetMode = (appState.gameMonitoringLivecamMode || 'gambar') === 'gambar' ? 'video' : 'gambar';
    if (targetMode === 'video') {
        if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
            window.promptVideoDurationAndDeductTokens((minutes) => {
                appState.gameMonitoringLivecamMode = 'video';
                if (typeof window.openGameMonitoringDashboardModal === 'function') {
                    window.openGameMonitoringDashboardModal();
                } else {
                    renderGameMonitoringDashboard();
                }
            });
        } else {
            appState.gameMonitoringLivecamMode = 'video';
            renderGameMonitoringDashboard();
        }
    } else {
        appState.gameMonitoringLivecamMode = 'gambar';
        renderGameMonitoringDashboard();
        showToast("Mode kamera diubah ke: Foto Absen", "info");
    }
};

window.toggleStudentGameLivecamMode = function(studentId) {
    if (!appState.gameMonitoringStudentModes) appState.gameMonitoringStudentModes = {};
    const cur = appState.gameMonitoringStudentModes[studentId] || appState.gameMonitoringLivecamMode || 'gambar';
    const targetMode = cur === 'video' ? 'gambar' : 'video';
    if (targetMode === 'video') {
        if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
            window.promptVideoDurationAndDeductTokens((minutes) => {
                appState.gameMonitoringStudentModes[studentId] = 'video';
                if (typeof window.openGameMonitoringDashboardModal === 'function') {
                    window.openGameMonitoringDashboardModal();
                } else {
                    renderGameMonitoringDashboard();
                }
            });
        } else {
            appState.gameMonitoringStudentModes[studentId] = 'video';
            renderGameMonitoringDashboard();
        }
    } else {
        appState.gameMonitoringStudentModes[studentId] = 'gambar';
        renderGameMonitoringDashboard();
    }
};

window.refreshGameMonitoringData = async function(showToastNotice = true) {
    await renderGameMonitoringDashboard();
    if (showToastNotice) showToast("Data monitoring game diperbarui", "success");
};

window.renderGameMonitoringDashboard = async function() {
    const container = document.getElementById('game-monitoring-content');
    if (!container) return;

    const students = Array.isArray(appState.students) ? appState.students : [];
    const classes = Array.isArray(appState.classes) ? appState.classes : [];
    const games = Array.isArray(appState.eduGames) ? appState.eduGames : [];

    // Fetch active game sessions from server
    let serverSessions = {};
    try {
        const res = await fetch('/api/game/active-sessions');
        const data = await res.json();
        serverSessions = data.sessions || {};
    } catch (e) {}

    const localSessions = JSON.parse(localStorage.getItem('madrasah_active_game_sessions') || '{}');
    const mergedSessions = { ...localSessions, ...serverSessions };

    // Filter students by class
    let filteredStudents = students;
    if (appState.gameMonitoringClassId && appState.gameMonitoringClassId !== 'all') {
        filteredStudents = filteredStudents.filter(s => 
            String(s.classId) === String(appState.gameMonitoringClassId) || 
            String(s.className) === String(appState.gameMonitoringClassId)
        );
    }

    // Filter by game
    if (appState.gameMonitoringGameId && appState.gameMonitoringGameId !== 'all') {
        filteredStudents = filteredStudents.filter(s => {
            const sess = mergedSessions[s.id] || mergedSessions[String(s.id)];
            return sess && String(sess.gameId) === String(appState.gameMonitoringGameId);
        });
    }

    // Filter by status
    if (appState.gameMonitoringStatus && appState.gameMonitoringStatus !== 'all') {
        filteredStudents = filteredStudents.filter(s => {
            const sess = mergedSessions[s.id] || mergedSessions[String(s.id)];
            const isOnlineApp = s.isOnline || (s.lastActive && (Date.now() - new Date(s.lastActive).getTime() < 300000));
            if (appState.gameMonitoringStatus === 'online') return isOnlineApp;
            if (appState.gameMonitoringStatus === 'playing') return sess && sess.status === 'playing';
            if (appState.gameMonitoringStatus === 'completed') return sess && sess.status === 'completed';
            if (appState.gameMonitoringStatus === 'idle') return !sess || sess.status !== 'playing';
            return true;
        });
    }

    // Filter by search query
    if (appState.gameMonitoringSearch && appState.gameMonitoringSearch.trim() !== '') {
        const q = appState.gameMonitoringSearch.toLowerCase().trim();
        filteredStudents = filteredStudents.filter(s => 
            (s.name && s.name.toLowerCase().includes(q)) || 
            (s.nis && String(s.nis).toLowerCase().includes(q))
        );
    }

    // Compute stats
    const totalStudents = students.length;
    const onlineAppCount = students.filter(s => s.isOnline || (s.lastActive && (Date.now() - new Date(s.lastActive).getTime() < 300000))).length;
    const playingCount = Object.values(mergedSessions).filter(s => s && s.status === 'playing').length;
    const completedCount = Object.values(mergedSessions).filter(s => s && s.status === 'completed').length;
    const totalXpEarned = students.reduce((acc, s) => acc + (Number(s.gameXp) || 0), 0);

    container.innerHTML = `
        <!-- Top Stats Row -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 shadow-sm">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Siswa</span>
                <span class="text-xl sm:text-2xl font-black text-white mt-1 block">${totalStudents}</span>
            </div>
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-emerald-900/40 shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Login Aplikasi</span>
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <span class="text-xl sm:text-2xl font-black text-emerald-300 mt-1 block">${onlineAppCount}</span>
            </div>
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-indigo-900/40 shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Sedang Main</span>
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping"></span>
                </div>
                <span class="text-xl sm:text-2xl font-black text-indigo-300 mt-1 block">${playingCount}</span>
            </div>
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-amber-900/40 shadow-sm">
                <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Game Selesai</span>
                <span class="text-xl sm:text-2xl font-black text-amber-300 mt-1 block">${completedCount}</span>
            </div>
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-purple-900/40 shadow-sm col-span-2 sm:col-span-1">
                <span class="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Total Akumulasi XP</span>
                <span class="text-xl sm:text-2xl font-black text-purple-300 mt-1 block">${totalXpEarned} XP</span>
            </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
            <div class="flex items-center gap-2 flex-wrap flex-1">
                <!-- Class filter -->
                <div class="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <i class="fa-solid fa-graduation-cap text-indigo-400 text-xs"></i>
                    <select onchange="appState.gameMonitoringClassId = this.value; renderGameMonitoringDashboard();" class="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer">
                        <option value="all" class="bg-slate-900 text-white">🌟 Semua Kelas</option>
                        ${classes.map(c => `<option value="${c.id || c.name}" ${String(appState.gameMonitoringClassId) === String(c.id || c.name) ? 'selected' : ''} class="bg-slate-900 text-white">${c.name || c.className || c.id}</option>`).join('')}
                    </select>
                </div>

                <!-- Game filter -->
                <div class="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <i class="fa-solid fa-gamepad text-emerald-400 text-xs"></i>
                    <select onchange="appState.gameMonitoringGameId = this.value; renderGameMonitoringDashboard();" class="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer">
                        <option value="all" class="bg-slate-900 text-white">🎮 Semua Game</option>
                        ${games.map(g => `<option value="${g.id}" ${String(appState.gameMonitoringGameId) === String(g.id) ? 'selected' : ''} class="bg-slate-900 text-white">${gameEscapeHtml(g.title)}</option>`).join('')}
                    </select>
                </div>

                <!-- Status filter -->
                <div class="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <i class="fa-solid fa-filter text-amber-400 text-xs"></i>
                    <select onchange="appState.gameMonitoringStatus = this.value; renderGameMonitoringDashboard();" class="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer">
                        <option value="all" ${appState.gameMonitoringStatus === 'all' ? 'selected' : ''} class="bg-slate-900 text-white">Semua Status</option>
                        <option value="playing" ${appState.gameMonitoringStatus === 'playing' ? 'selected' : ''} class="bg-slate-900 text-white">🕹️ Sedang Main Game</option>
                        <option value="online" ${appState.gameMonitoringStatus === 'online' ? 'selected' : ''} class="bg-slate-900 text-white">🟢 Online Aplikasi</option>
                        <option value="completed" ${appState.gameMonitoringStatus === 'completed' ? 'selected' : ''} class="bg-slate-900 text-white">🏆 Selesai Game</option>
                        <option value="idle" ${appState.gameMonitoringStatus === 'idle' ? 'selected' : ''} class="bg-slate-900 text-white">⏳ Belum Main Game</option>
                    </select>
                </div>
            </div>

            <!-- Search input -->
            <div class="relative min-w-[200px] md:w-64">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                <input type="text" value="${appState.gameMonitoringSearch || ''}" oninput="appState.gameMonitoringSearch = this.value; renderGameMonitoringDashboard();" placeholder="Cari nama atau NIS siswa..." class="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </div>
        </div>

        <!-- Student Cards Grid -->
        ${filteredStudents.length === 0 ? `
            <div class="bg-slate-950/60 p-12 rounded-3xl border border-slate-800 text-center space-y-3 max-w-md mx-auto shadow-sm">
                <div class="w-16 h-16 bg-slate-800 text-slate-500 rounded-full flex items-center justify-center mx-auto text-xl">
                    <i class="fa-solid fa-user-slash"></i>
                </div>
                <h4 class="font-bold text-slate-300 text-sm">Tidak Ada Siswa Terpantau</h4>
                <p class="text-xs text-slate-500">Tidak ditemukan data siswa berdasarkan filter kelas, status, atau kata kunci yang dipilih.</p>
            </div>
        ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${filteredStudents.map(st => {
                    const sess = mergedSessions[st.id] || mergedSessions[String(st.id)] || null;
                    const isPlaying = sess && sess.status === 'playing';
                    const isCompleted = sess && sess.status === 'completed';
                    const isOnlineApp = st.isOnline || (st.lastActive && (Date.now() - new Date(st.lastActive).getTime() < 300000));
                    
                    const stCamMode = (appState.gameMonitoringStudentModes && appState.gameMonitoringStudentModes[st.id]) 
                        ? appState.gameMonitoringStudentModes[st.id] 
                        : (appState.gameMonitoringLivecamMode || 'gambar');
                    const isVideo = stCamMode === 'video';

                    // Find student photo from attendance records or profile
                    const attRecord = (appState.attendance || []).slice().reverse().find(a => 
                        String(a.studentId || a.student_id) === String(st.id) || 
                        (st.nis && String(a.nis) === String(st.nis))
                    );
                    const attPhoto = attRecord ? (attRecord.photo || attRecord.imageUrl || attRecord.facePhoto || attRecord.photoUrl || attRecord.image) : null;
                    const studentPhoto = attPhoto || st.photo || st.facePhoto || st.image || st.avatar;

                    const studentXp = Number(st.gameXp) || (sess ? (sess.score || 0) : 0);
                    const streakCount = Number(st.dailyStreak) || 1;

                    return `
                        <div onclick="focusGameStudentLivecam('${st.id}')" class="relative bg-slate-950 text-white rounded-3xl shadow-xl flex flex-col justify-between overflow-hidden border ${
                            isPlaying ? 'border-indigo-500/80 ring-2 ring-indigo-500/30 shadow-indigo-950/50' :
                            isCompleted ? 'border-amber-500/80 ring-2 ring-amber-500/20' :
                            isOnlineApp ? 'border-emerald-500/50' : 'border-slate-800'
                        } min-h-[310px] cursor-pointer hover:scale-[1.02] transition-transform duration-300">
                            
                            <!-- Background Frame (Photo or Live WebRTC Video) -->
                            <div class="absolute inset-0 z-0 bg-slate-950 overflow-hidden">
                                ${isVideo ? (isPlaying || isOnlineApp ? `
                                    <video id="game-webrtc-video-${st.id}" autoplay playsinline muted class="w-full h-full object-cover"></video>
                                    <div id="game-webrtc-fallback-${st.id}" class="absolute inset-0 flex items-center justify-center pointer-events-none bg-slate-950">
                                        ${studentPhoto ? `
                                            <img src="${studentPhoto}" alt="Foto Absen" class="w-full h-full object-cover opacity-75">
                                        ` : `
                                            <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                                                <i class="fa-solid fa-video text-indigo-400 animate-pulse text-3xl mb-2"></i>
                                            </div>
                                        `}
                                        <div class="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-950/85 backdrop-blur-md text-indigo-300 border border-indigo-500/30 text-[9px] font-bold rounded-full flex items-center space-x-1.5 shadow-lg whitespace-nowrap">
                                            <i class="fa-solid fa-circle-notch fa-spin text-indigo-400"></i>
                                            <span>Menghubungkan Live Video...</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                                        <i class="fa-solid fa-video-slash text-slate-700 text-3xl mb-2"></i>
                                        <span class="text-xs font-bold text-slate-500">Siswa Sedang Offline</span>
                                    </div>
                                `) : `
                                    ${studentPhoto ? `
                                        <img src="${studentPhoto}" alt="Foto Siswa" class="w-full h-full object-cover">
                                    ` : `
                                        <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                                            <div class="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-300 text-xl font-black uppercase mb-2 shadow">
                                                ${gameEscapeHtml(st.name ? st.name.charAt(0) : '?')}
                                            </div>
                                            <span class="text-xs text-slate-300 font-bold">${gameEscapeHtml(st.name)}</span>
                                            <span class="text-[10px] text-slate-500 mt-1 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">Foto Absensi Siswa</span>
                                        </div>
                                    `}
                                `}
                                <!-- Dark gradient overlay -->
                                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/80 pointer-events-none"></div>
                            </div>

                            <!-- Floating Content Overlay (Z-10) -->
                            <div class="relative z-10 p-4 flex flex-col justify-between h-full space-y-3 min-h-[310px]">
                                <!-- Top Bar: Student Name, NIS, & Online Badges -->
                                <div class="flex justify-between items-start gap-2">
                                    <div class="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-md max-w-[65%]">
                                        <span class="text-xs text-white font-black block truncate" title="${gameEscapeHtml(st.name)}">${gameEscapeHtml(st.name)}</span>
                                        <span class="text-[10px] text-slate-400 font-mono block truncate">${gameEscapeHtml(st.className || 'Kelas')} &middot; NIS: ${gameEscapeHtml(st.nis || '-')}</span>
                                    </div>

                                    <!-- Status Badges -->
                                    <div class="flex items-center space-x-1.5">
                                        <!-- App Login Indicator -->
                                        <span title="${isOnlineApp ? 'Login di Aplikasi' : 'Offline'}" class="w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg backdrop-blur-md ${isOnlineApp ? 'bg-emerald-500 text-slate-950 border border-emerald-300' : 'bg-slate-800/80 text-slate-500 border border-white/10'}">
                                            <i class="fa-solid fa-mobile-screen-button"></i>
                                        </span>

                                        <!-- Game Activity Indicator -->
                                        <span title="${isPlaying ? `Sedang Main: ${sess.gameTitle || 'Game'}` : (isCompleted ? 'Selesai Game' : 'Belum Main Game')}" class="w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg backdrop-blur-md ${
                                            isPlaying ? 'bg-indigo-600 text-white font-bold animate-pulse border border-indigo-400' : 
                                            isCompleted ? 'bg-amber-500 text-slate-950 border border-amber-300' : 
                                            'bg-slate-800/80 text-slate-400 border border-white/10'
                                        }">
                                            <i class="fa-solid ${isPlaying ? 'fa-gamepad' : (isCompleted ? 'fa-trophy' : 'fa-hourglass-start')}"></i>
                                        </span>
                                    </div>
                                </div>

                                <!-- Middle Center Info (Game Title / Status Banner) -->
                                <div class="my-auto text-center">
                                    ${isPlaying ? `
                                        <div class="inline-block bg-indigo-950/90 border border-indigo-500/50 px-3 py-1.5 rounded-2xl backdrop-blur-md shadow-lg text-left max-w-full">
                                            <span class="text-[9px] font-black uppercase text-indigo-400 tracking-wider block">🕹️ Sedang Mengerjakan:</span>
                                            <p class="text-xs font-black text-white truncate">${sess.gameTitle || 'Game Edukasi'}</p>
                                            ${sess.floorName ? `<span class="text-[9px] text-amber-300 font-bold block mt-0.5">${sess.floorName}</span>` : ''}
                                        </div>
                                    ` : (isCompleted ? `
                                        <div class="inline-block bg-amber-950/90 border border-amber-500/50 px-3 py-1.5 rounded-2xl backdrop-blur-md shadow-lg text-center">
                                            <span class="text-[10px] font-extrabold text-amber-300 flex items-center justify-center gap-1">
                                                <i class="fa-solid fa-trophy text-xs"></i> Game Selesai Dituntaskan
                                            </span>
                                        </div>
                                    ` : `
                                        <div class="inline-block bg-slate-950/70 border border-slate-800 px-3 py-1 rounded-xl backdrop-blur-md">
                                            <span class="text-[10px] font-bold text-slate-400">Belum Memulai Game</span>
                                        </div>
                                    `)}
                                </div>

                                <!-- Bottom Section: XP Stats & Action Controls -->
                                <div class="space-y-2 bg-slate-950/90 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
                                    <!-- XP Score & Streak -->
                                    <div class="flex items-center justify-between text-[11px] font-extrabold border-b border-slate-800 pb-1.5">
                                        <span class="text-amber-400 flex items-center gap-1">
                                            <i class="fa-solid fa-bolt"></i> ${studentXp} XP
                                        </span>
                                        <span class="text-rose-400 font-bold text-[10px]">
                                            🔥 ${streakCount} Hari
                                        </span>
                                    </div>

                                    <!-- Action Buttons -->
                                    <div class="flex gap-1.5 pt-0.5">
                                        <!-- Send Message Button -->
                                        <button type="button" title="Kirim Pesan Langsung ke Siswa" onclick="event.stopPropagation(); openSendGameStudentMessageModal(decodeURIComponent('${gameEncodedArg(st.id)}'), decodeURIComponent('${gameEncodedArg(st.name)}'))" class="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center cursor-pointer transition">
                                            <i class="fa-solid fa-comment-dots"></i>
                                        </button>

                                        <!-- Toggle Video/Photo Button -->
                                        <button type="button" title="${isVideo ? 'Mode Foto Absen' : 'Mode Video Live'}" onclick="event.stopPropagation(); toggleStudentGameLivecamMode('${st.id}')" class="flex-1 py-1.5 ${isVideo ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'} rounded-xl text-xs font-bold shadow flex items-center justify-center cursor-pointer transition">
                                            <i class="fa-solid ${isVideo ? 'fa-video' : 'fa-image'}"></i>
                                        </button>

                                        <!-- Reset / Kesempatan Ulang Game -->
                                        <button type="button" title="Reset Sesi Game Siswa" onclick="event.stopPropagation(); confirmResetStudentGameSession(decodeURIComponent('${gameEncodedArg(st.id)}'), decodeURIComponent('${gameEncodedArg(st.name)}'))" class="flex-1 py-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 shadow flex items-center justify-center cursor-pointer transition">
                                            <i class="fa-solid fa-rotate-left"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `}
    `;
};

// ============================================================================
// MODAL: SEND DIRECT MESSAGE TO STUDENT IN GAME
// ============================================================================
window.openSendGameStudentMessageModal = function(studentId, studentName) {
    const existing = document.getElementById('send-game-msg-modal');
    if (existing) existing.remove();

    const html = `
        <div id="send-game-msg-modal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div class="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
                <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-base font-bold shadow">
                            💬
                        </div>
                        <div>
                            <h4 class="font-black text-sm text-white">Kirim Pesan ke Siswa</h4>
                            <p class="text-[11px] text-slate-400">Penerima: <strong class="text-indigo-300">${studentName}</strong></p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('send-game-msg-modal').remove()" class="text-slate-400 hover:text-white p-1 text-base">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="space-y-2">
                    <label class="block text-xs font-bold text-slate-300">Isi Pesan / Instruksi:</label>
                    <textarea id="game-msg-text-input" rows="4" placeholder="Contoh: Tetap fokus mengerjakan ya, baca petunjuk soal dengan cermat..." class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"></textarea>
                    
                    <!-- Quick Preset Templates -->
                    <div class="flex items-center gap-1.5 flex-wrap pt-1">
                        <button type="button" onclick="document.getElementById('game-msg-text-input').value='Semangat dan tetap fokus ya!'" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition cursor-pointer">
                            Semangat!
                        </button>
                        <button type="button" onclick="document.getElementById('game-msg-text-input').value='Harap tidak membuka tab atau aplikasi lain saat bermain.'" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition cursor-pointer">
                            Fokus Tab Game
                        </button>
                        <button type="button" onclick="document.getElementById('game-msg-text-input').value='Waktu sesi game hampir selesai, segera selesaikan quest kamu!'" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition cursor-pointer">
                            Pengingat Waktu
                        </button>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button type="button" onclick="document.getElementById('send-game-msg-modal').remove()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" onclick="sendGameStudentMessage('${studentId}')" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-paper-plane text-xs"></i>
                        <span>Kirim Pesan</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.sendGameStudentMessage = async function(studentId) {
    const textInput = document.getElementById('game-msg-text-input');
    const msgText = (textInput ? textInput.value : '').trim();
    if (!msgText) {
        showToast("Tulis pesan terlebih dahulu", "warning");
        return;
    }

    try {
        const res = await fetch('/api/game/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId,
                message: msgText,
                senderName: appState.currentUser?.name || 'Guru Pengawas'
            })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('send-game-msg-modal')?.remove();
            showToast("Pesan terkirim ke layar game siswa!", "success");
        } else {
            showToast("Gagal mengirim pesan", "error");
        }
    } catch (e) {
        showToast("Gagal mengirim pesan ke server", "error");
    }
};

// ============================================================================
// MODAL: BROADCAST MESSAGE TO ALL STUDENTS
// ============================================================================
window.openBroadcastGameMessageModal = function() {
    const existing = document.getElementById('send-broadcast-game-msg-modal');
    if (existing) existing.remove();

    const html = `
        <div id="send-broadcast-game-msg-modal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div class="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
                <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 bg-amber-500 text-slate-950 rounded-xl flex items-center justify-center text-base font-black shadow">
                            📢
                        </div>
                        <div>
                            <h4 class="font-black text-sm text-white">Kirim Pesan Siaran (Broadcast)</h4>
                            <p class="text-[11px] text-slate-400">Pesan akan muncul di layar semua siswa yang aktif.</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('send-broadcast-game-msg-modal').remove()" class="text-slate-400 hover:text-white p-1 text-base">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="space-y-2">
                    <label class="block text-xs font-bold text-slate-300">Isi Pengumuman / Pesan Siaran:</label>
                    <textarea id="game-broadcast-text-input" rows="4" placeholder="Ketik pesan siaran untuk seluruh peserta game..." class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none"></textarea>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button type="button" onclick="document.getElementById('send-broadcast-game-msg-modal').remove()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" onclick="sendBroadcastGameMessage()" class="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-bullhorn text-xs"></i>
                        <span>Kirim Siaran Sekarang</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.sendBroadcastGameMessage = async function() {
    const textInput = document.getElementById('game-broadcast-text-input');
    const msgText = (textInput ? textInput.value : '').trim();
    if (!msgText) {
        showToast("Tulis pesan siaran terlebih dahulu", "warning");
        return;
    }

    try {
        const res = await fetch('/api/game/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isBroadcast: true,
                message: msgText,
                senderName: appState.currentUser?.name || 'Guru Pengawas'
            })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('send-broadcast-game-msg-modal')?.remove();
            showToast("Pesan siaran berhasil dikirim ke seluruh siswa!", "success");
        } else {
            showToast("Gagal mengirim siaran", "error");
        }
    } catch (e) {
        showToast("Gagal mengirim pesan ke server", "error");
    }
};

// ============================================================================
// MODAL: FOCUS / ZOOM STUDENT LIVECAM
// ============================================================================
window.focusGameStudentLivecam = function(studentId) {
    if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
        window.promptVideoDurationAndDeductTokens((minutes) => {
            _executeFocusGameStudentLivecam(studentId);
        });
    } else {
        _executeFocusGameStudentLivecam(studentId);
    }
};

function _executeFocusGameStudentLivecam(studentId) {
    const students = Array.isArray(appState.students) ? appState.students : [];
    const st = students.find(s => String(s.id) === String(studentId));
    if (!st) return;

    const attRecord = (appState.attendance || []).slice().reverse().find(a => 
        String(a.studentId || a.student_id) === String(st.id) || 
        (st.nis && String(a.nis) === String(st.nis))
    );
    const attPhoto = attRecord ? (attRecord.photo || attRecord.imageUrl || attRecord.facePhoto || attRecord.photoUrl || attRecord.image) : null;
    const studentPhoto = attPhoto || st.photo || st.facePhoto || st.image || st.avatar;

    const existing = document.getElementById('focus-game-livecam-modal');
    if (existing) existing.remove();

    const html = `
        <div id="focus-game-livecam-modal" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div class="bg-slate-900 border border-slate-800 text-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl space-y-4">
                <div class="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold">
                            👤
                        </div>
                        <div>
                            <h4 class="font-black text-sm text-white">${gameEscapeHtml(st.name)}</h4>
                            <p class="text-xs text-slate-400 font-mono">${gameEscapeHtml(st.className || 'Kelas')} &middot; NIS: ${gameEscapeHtml(st.nis || '-')}</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('focus-game-livecam-modal').remove()" class="text-slate-400 hover:text-white p-2 text-lg">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-6 flex flex-col items-center justify-center space-y-4">
                    <div class="w-full max-w-md h-72 rounded-3xl overflow-hidden bg-slate-950 border-2 border-indigo-500/40 shadow-inner flex items-center justify-center relative">
                        ${studentPhoto ? `
                            <img src="${studentPhoto}" class="w-full h-full object-cover">
                        ` : `
                            <div class="text-center p-6 space-y-2">
                                <i class="fa-solid fa-user-circle text-slate-600 text-6xl"></i>
                                <p class="text-xs text-slate-400 font-bold">Foto Absen Belum Tersedia</p>
                            </div>
                        `}
                    </div>

                    <div class="grid grid-cols-2 gap-3 w-full max-w-md text-xs">
                        <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                            <span class="text-[10px] text-slate-400 block">Akumulasi XP Game:</span>
                            <span class="font-black text-amber-400 text-sm">${st.gameXp || 0} XP</span>
                        </div>
                        <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                            <span class="text-[10px] text-slate-400 block">Daily Streak:</span>
                            <span class="font-black text-rose-400 text-sm">🔥 ${st.dailyStreak || 1} Hari</span>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button type="button" onclick="openSendGameStudentMessageModal(decodeURIComponent('${gameEncodedArg(st.id)}'), decodeURIComponent('${gameEncodedArg(st.name)}'))" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-comment-dots text-xs"></i>
                        <span>Kirim Pesan</span>
                    </button>
                    <button type="button" onclick="document.getElementById('focus-game-livecam-modal').remove()" class="px-5 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer">
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
};

// ============================================================================
// RESET STUDENT ACTIVE GAME SESSION
// ============================================================================
window.confirmResetStudentGameSession = async function(studentId, studentName) {
    if (!confirm(`Reset sesi game untuk siswa "${studentName}"? Siswa akan dapat mengulang tantangan game dari awal.`)) return;

    try {
        const activeGameMap = JSON.parse(localStorage.getItem('madrasah_active_game_sessions') || '{}');
        delete activeGameMap[studentId];
        localStorage.setItem('madrasah_active_game_sessions', JSON.stringify(activeGameMap));

        await fetch('/api/game/active-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, sessionData: null })
        });

        showToast(`Sesi game untuk "${studentName}" berhasil direset`, "success");
        renderGameMonitoringDashboard();
    } catch (e) {
        showToast("Gagal mereset sesi", "error");
    }
};

// ============================================================================
// DISMISS IN-GAME TEACHER ALERT
// ============================================================================
window.dismissInGameTeacherAlert = async function(msgId, studentId) {
    const alertEl = document.getElementById('in-game-teacher-alert');
    if (alertEl) alertEl.remove();

    try {
        await fetch('/api/game/messages/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: msgId, studentId })
        });
    } catch (e) {}
};

