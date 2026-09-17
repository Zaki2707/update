(function () {
    const SHEET_URL = '/assets/game-arena-v2/characters/chibi-character-sheet.svg';
    const POSE_COLUMNS = Object.freeze({ idle: 0, run: 1, attack: 2, hit: 3, win: 4 });
    const MODE_SIZES = Object.freeze({
        laser_duel: { size: 118, minScale: 0.70 },
        tug_war: { size: 62, minScale: 0.68 },
        battle_royale: { size: 58, minScale: 0.72 },
        base_battle: { size: 48, minScale: 0.76 }
    });
    const AVATAR_ROW = Object.freeze({ bintang: 0, roket: 0, buku: 0, komet: 1, bulan: 1, petir: 1 });
    const REF_WIDTH = 820;
    let ready = false;
    let scheduled = false;

    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

    function parseCharacterId(image) {
        const src = String(image?.getAttribute('src') || image?.src || '');
        const match = src.match(/hero-(bintang|roket|buku|komet|bulan|petir)\.svg(?:$|[?#])/i);
        return match ? match[1].toLowerCase() : 'bintang';
    }

    function getMode(wrap) {
        return String(wrap?.closest?.('[data-arena-stage]')?.getAttribute('data-arena-stage') || '');
    }

    function teamRow(wrap, fallbackId) {
        if (wrap.closest('.arena-team-a') || wrap.closest('[data-arena-base-side="A"]')) return 0;
        if (wrap.closest('.arena-team-b') || wrap.closest('[data-arena-base-side="B"]')) return 1;
        const anchor = wrap.closest('[data-arena-stage] > div.absolute');
        const cls = String(anchor?.className || '');
        if (cls.includes('right-[') || cls.includes('scale-x-[-1]')) return 1;
        if (cls.includes('left-[')) return 0;
        return AVATAR_ROW[fallbackId] ?? 0;
    }

    function getPose(wrap, mode) {
        if (mode === 'laser_duel' || mode === 'tug_war' || mode === 'base_battle') return 'attack';
        if (mode === 'battle_royale') {
            const player = wrap.closest('[data-arena-player-id]');
            if (player?.classList.contains('opacity-45') || player?.classList.contains('grayscale')) return 'hit';
            return 'idle';
        }
        return 'idle';
    }

    function spritePosition(index, count) {
        return count <= 1 ? '0%' : `${(index / (count - 1)) * 100}%`;
    }

    function ensureSprite(wrap) {
        if (!ready || !wrap) return;
        const source = wrap.querySelector(':scope > .arena-character-core');
        if (!source) return;
        const id = parseCharacterId(source);
        let sprite = wrap.querySelector(':scope > .arena-sheet-sprite');
        if (!sprite) {
            sprite = document.createElement('span');
            sprite.className = 'arena-sheet-sprite';
            sprite.setAttribute('aria-hidden', 'true');
            wrap.appendChild(sprite);
        }
        const mode = getMode(wrap);
        const pose = getPose(wrap, mode);
        const row = teamRow(wrap, id);
        const col = POSE_COLUMNS[pose] ?? 0;
        sprite.style.backgroundPosition = `${spritePosition(col, 5)} ${spritePosition(row, 2)}`;
        wrap.dataset.arenaPose = pose;
        wrap.dataset.arenaCharacterRow = String(row);
        wrap.classList.add('arena-sheet-ready');
        source.classList.add('arena-character-source-fallback');
    }

    function tuneStage(stage) {
        if (!stage) return;
        const mode = String(stage.getAttribute('data-arena-stage') || '');
        const cfg = MODE_SIZES[mode];
        const width = Math.max(280, stage.getBoundingClientRect().width || 0);
        const scale = cfg ? clamp(width / REF_WIDTH, cfg.minScale, 1) : 1;
        stage.querySelectorAll('.arena-character-wrap').forEach(wrap => {
            ensureSprite(wrap);
            if (!cfg) return;
            let size = cfg.size * scale;
            if (mode === 'battle_royale' && String(wrap.className).includes('w-18')) size *= 1.08;
            wrap.style.width = `${Math.round(size)}px`;
            wrap.style.height = `${Math.round(size)}px`;
        });
        if (mode === 'tug_war') {
            const overlap = width <= 480 ? '-8px' : width <= 720 ? '-10px' : '-13px';
            ['.arena-team-a', '.arena-team-b'].forEach(selector => {
                stage.querySelectorAll(selector).forEach((player, index) => {
                    player.style.marginLeft = index ? overlap : '0px';
                });
            });
        }
        if (mode === 'quiz_race') {
            const raceScale = clamp(width / REF_WIDTH, 0.70, 1);
            stage.querySelectorAll('.arena-race-car img[src*="/vehicles/"]').forEach(vehicle => {
                vehicle.style.width = `${Math.round(88 * raceScale)}px`;
                vehicle.style.height = `${Math.round(52 * raceScale)}px`;
            });
        }
    }

    function enhanceAll() {
        scheduled = false;
        if (!ready) return;
        document.querySelectorAll('.arena-character-wrap').forEach(ensureSprite);
        document.querySelectorAll('[data-arena-stage]').forEach(tuneStage);
    }

    function scheduleEnhance() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(enhanceAll);
    }

    function injectStyles() {
        if (document.getElementById('arena-character-sheet-styles')) return;
        const style = document.createElement('style');
        style.id = 'arena-character-sheet-styles';
        style.textContent = `
            .arena-character-wrap.arena-sheet-ready{position:relative;overflow:visible}
            .arena-character-wrap.arena-sheet-ready>.arena-character-source-fallback{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;opacity:0!important;pointer-events:none!important}
            .arena-sheet-sprite{position:absolute;inset:0;display:block;background-image:url('${SHEET_URL}');background-size:500% 200%;background-repeat:no-repeat;pointer-events:none;transform-origin:50% 100%;filter:drop-shadow(0 6px 4px rgba(2,8,23,.35));will-change:transform}
            [data-arena-pose="idle"]>.arena-sheet-sprite{animation:arenaV2Idle 2.4s ease-in-out infinite}
            [data-arena-pose="attack"]>.arena-sheet-sprite{animation:arenaV2Attack .82s ease-in-out infinite}
            [data-arena-pose="hit"]>.arena-sheet-sprite{animation:arenaV2Hit .6s ease-in-out infinite}
            [data-arena-pose="win"]>.arena-sheet-sprite{animation:arenaV2Win 1s ease-in-out infinite}
            @keyframes arenaV2Idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
            @keyframes arenaV2Attack{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-3px) rotate(2deg)}}
            @keyframes arenaV2Hit{0%,100%{transform:translateX(0)}35%{transform:translateX(-3px) rotate(-2deg)}65%{transform:translateX(3px) rotate(2deg)}}
            @keyframes arenaV2Win{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
            @media(prefers-reduced-motion:reduce){.arena-sheet-sprite{animation:none!important}}
        `;
        document.head.appendChild(style);
    }

    function start() {
        injectStyles();
        const probe = new Image();
        probe.onload = () => { ready = true; window.__arenaCharacterSheetReady = true; scheduleEnhance(); };
        probe.onerror = () => { ready = false; window.__arenaCharacterSheetReady = false; console.warn('Game Arena V2 character sheet failed; using original characters.'); };
        probe.src = SHEET_URL;
        new MutationObserver(scheduleEnhance).observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', scheduleEnhance, { passive: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
