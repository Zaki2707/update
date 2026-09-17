(function () {
    const SHEET_URL = '/assets/game-arena/characters/arena-character-sheet.svg';
    const CHARACTER_ROWS = Object.freeze({ bintang: 0, roket: 1, buku: 2, komet: 3, bulan: 4, petir: 5 });
    const POSE_COLUMNS = Object.freeze({ idle: 0, action: 1, impact: 2, victory: 3 });
    const MODE_SIZES = Object.freeze({
        laser_duel: { width: 112, height: 140, minScale: 0.72 },
        tug_war: { width: 54, height: 70, minScale: 0.70 },
        battle_royale: { width: 50, height: 64, minScale: 0.72 },
        base_battle: { width: 40, height: 52, minScale: 0.78 }
    });
    const RESIZE_REFERENCE = 820;
    let sheetReady = false;
    let scheduled = false;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function parseCharacterId(image) {
        const src = String(image?.getAttribute('src') || image?.src || '');
        const match = src.match(/hero-(bintang|roket|buku|komet|bulan|petir)\.svg(?:$|[?#])/i);
        return match ? match[1].toLowerCase() : '';
    }

    function getMode(wrap) {
        return String(wrap?.closest?.('[data-arena-stage]')?.getAttribute('data-arena-stage') || '');
    }

    function getPose(wrap, mode) {
        if (mode === 'laser_duel' || mode === 'tug_war' || mode === 'base_battle') return 'action';
        if (mode === 'battle_royale') {
            const player = wrap.closest('[data-arena-player-id]');
            if (player?.classList.contains('opacity-45') || player?.classList.contains('grayscale')) return 'impact';
            if (String(wrap.className).includes('w-18')) return 'action';
        }
        return 'idle';
    }

    function spritePosition(index, count) {
        if (count <= 1) return '0%';
        return `${(index / (count - 1)) * 100}%`;
    }

    function ensureSprite(wrap) {
        if (!sheetReady || !wrap) return;
        const source = wrap.querySelector(':scope > .arena-character-core');
        if (!source) return;
        const id = parseCharacterId(source);
        if (!(id in CHARACTER_ROWS)) return;

        let sprite = wrap.querySelector(':scope > .arena-sheet-sprite');
        if (!sprite) {
            sprite = document.createElement('span');
            sprite.className = 'arena-sheet-sprite';
            sprite.setAttribute('aria-hidden', 'true');
            wrap.appendChild(sprite);
        }

        const mode = getMode(wrap);
        const pose = getPose(wrap, mode);
        const col = POSE_COLUMNS[pose] ?? 0;
        const row = CHARACTER_ROWS[id] ?? 0;
        sprite.style.backgroundPosition = `${spritePosition(col, 4)} ${spritePosition(row, 6)}`;
        sprite.dataset.characterId = id;
        sprite.dataset.pose = pose;
        wrap.dataset.arenaCharacterId = id;
        wrap.dataset.arenaPose = pose;
        wrap.classList.add('arena-sheet-ready');
        source.classList.add('arena-character-source-fallback');
    }

    function modeScale(stage, config) {
        const width = Math.max(280, stage.getBoundingClientRect().width || 0);
        return clamp(width / RESIZE_REFERENCE, config.minScale, 1);
    }

    function rememberStyle(element, property, datasetKey) {
        if (!element || element.dataset[datasetKey] !== undefined) return;
        element.dataset[datasetKey] = element.style[property] || '';
    }

    function restoreStyle(element, property, datasetKey) {
        if (!element || element.dataset[datasetKey] === undefined) return;
        element.style[property] = element.dataset[datasetKey];
    }

    function tuneSafeZone(stage, mode, stageWidth) {
        const desktopOverlay = stageWidth > 720 && stage.closest('.arena-ref-wrap')?.querySelector(':scope > .arena-ref-bottom');

        if (mode === 'laser_duel') {
            const anchors = Array.from(stage.querySelectorAll(':scope > div.absolute')).filter(el => el.querySelector('.arena-character-wrap'));
            anchors.forEach(anchor => {
                rememberStyle(anchor, 'bottom', 'arenaOriginalBottom');
                if (desktopOverlay) anchor.style.bottom = '36%';
                else restoreStyle(anchor, 'bottom', 'arenaOriginalBottom');
            });
        }

        if (mode === 'tug_war') {
            const groups = Array.from(stage.querySelectorAll(':scope > div.absolute')).filter(el => el.querySelector('.arena-team-a, .arena-team-b'));
            groups.forEach(group => {
                rememberStyle(group, 'bottom', 'arenaOriginalBottom');
                if (desktopOverlay) group.style.bottom = '36%';
                else restoreStyle(group, 'bottom', 'arenaOriginalBottom');
            });
        }

        if (mode === 'battle_royale') {
            stage.querySelectorAll('[data-arena-player-id]').forEach(player => {
                if (player.dataset.arenaOriginalTop === undefined) player.dataset.arenaOriginalTop = player.style.top || '';
                const original = Number.parseFloat(player.dataset.arenaOriginalTop || '');
                if (desktopOverlay && Number.isFinite(original)) {
                    player.style.top = `${clamp(15 + (original - 18) * 0.64, 15, 58)}%`;
                } else {
                    player.style.top = player.dataset.arenaOriginalTop || '';
                }
            });
        }

        if (mode === 'quiz_race') {
            const firstCar = stage.querySelector('.arena-race-car');
            const track = firstCar?.parentElement?.parentElement;
            if (track) {
                rememberStyle(track, 'bottom', 'arenaOriginalBottom');
                if (desktopOverlay) track.style.bottom = '38%';
                else restoreStyle(track, 'bottom', 'arenaOriginalBottom');
            }
        }
    }

    function tuneTugSpacing(stage, stageWidth) {
        const overlap = stageWidth <= 480 ? '-9px' : stageWidth <= 720 ? '-12px' : '-14px';
        ['.arena-team-a', '.arena-team-b'].forEach(selector => {
            stage.querySelectorAll(selector).forEach((player, index) => {
                if (index === 0) player.style.marginLeft = '0px';
                else player.style.marginLeft = overlap;
            });
        });
    }

    function tuneBaseBattle(stage, scale) {
        stage.querySelectorAll('.arena-castle-img').forEach(castle => {
            castle.style.width = `${Math.round(132 * scale)}px`;
            castle.style.height = `${Math.round(148 * scale)}px`;
        });
        stage.querySelectorAll('.arena-shield-fx').forEach(shield => {
            const size = Math.round(148 * scale);
            shield.style.width = `${size}px`;
            shield.style.height = `${size}px`;
        });
    }

    function tuneRace(stage, stageWidth) {
        const scale = clamp(stageWidth / RESIZE_REFERENCE, 0.72, 1);
        const width = Math.round(82 * scale);
        const height = Math.round(48 * scale);
        stage.querySelectorAll('.arena-race-car img[src*="/vehicles/"]').forEach(vehicle => {
            vehicle.style.width = `${width}px`;
            vehicle.style.height = `${height}px`;
        });
        stage.querySelectorAll('.arena-race-car img[src$="speed-lines.svg"]').forEach(lines => {
            lines.style.width = `${Math.round(54 * scale)}px`;
            lines.style.height = `${Math.round(40 * scale)}px`;
        });
    }

    function tuneStage(stage) {
        if (!stage) return;
        const mode = String(stage.getAttribute('data-arena-stage') || '');
        const stageWidth = Math.max(280, stage.getBoundingClientRect().width || 0);
        const config = MODE_SIZES[mode];

        stage.querySelectorAll('.arena-character-wrap').forEach(wrap => {
            ensureSprite(wrap);
            if (!config) return;
            let scale = modeScale(stage, config);
            if (mode === 'battle_royale' && String(wrap.className).includes('w-18')) scale *= 1.12;
            wrap.style.width = `${Math.round(config.width * scale)}px`;
            wrap.style.height = `${Math.round(config.height * scale)}px`;
        });

        if (mode === 'tug_war') tuneTugSpacing(stage, stageWidth);
        if (mode === 'base_battle' && config) tuneBaseBattle(stage, modeScale(stage, config));
        if (mode === 'quiz_race') tuneRace(stage, stageWidth);
        tuneSafeZone(stage, mode, stageWidth);
    }

    function enhanceAll() {
        scheduled = false;
        if (!sheetReady) return;

        document.querySelectorAll('.arena-character-wrap').forEach(ensureSprite);
        document.querySelectorAll('[data-arena-stage]').forEach(stage => {
            tuneStage(stage);
            if (!stage.dataset.arenaCharacterSheetObserved && typeof ResizeObserver === 'function') {
                stage.dataset.arenaCharacterSheetObserved = 'true';
                const resizeObserver = new ResizeObserver(() => scheduleEnhance());
                resizeObserver.observe(stage);
            }
        });
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
            .arena-character-wrap.arena-sheet-ready { position: relative; }
            .arena-character-wrap.arena-sheet-ready > .arena-character-source-fallback {
                position: absolute !important;
                inset: 0 !important;
                width: 100% !important;
                height: 100% !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            .arena-sheet-sprite {
                position: absolute;
                inset: 0;
                display: block;
                background-image: url('${SHEET_URL}');
                background-size: 400% 600%;
                background-repeat: no-repeat;
                background-color: transparent;
                pointer-events: none;
                transform-origin: 50% 100%;
                filter: drop-shadow(0 7px 5px rgba(2, 8, 23, .3));
                will-change: transform;
            }
            [data-arena-pose="idle"] > .arena-sheet-sprite { animation: arenaSheetIdle 2.8s ease-in-out infinite; }
            [data-arena-pose="action"] > .arena-sheet-sprite { animation: arenaSheetAction 1.05s ease-in-out infinite; }
            [data-arena-pose="impact"] > .arena-sheet-sprite { animation: arenaSheetImpact .78s ease-in-out infinite; }
            [data-arena-pose="victory"] > .arena-sheet-sprite { animation: arenaSheetVictory 1.05s ease-in-out infinite; }
            @keyframes arenaSheetIdle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
            @keyframes arenaSheetAction { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-3px) rotate(1.5deg)} }
            @keyframes arenaSheetImpact { 0%,100%{transform:translateX(0)} 35%{transform:translateX(-2px) rotate(-1deg)} 65%{transform:translateX(2px) rotate(1deg)} }
            @keyframes arenaSheetVictory { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-5px) scale(1.025)} }
            @media (max-width: 720px) {
                [data-arena-stage] .arena-avatar-tag { max-width: 58px; font-size: 8px !important; padding: 2px 5px !important; }
                [data-arena-stage="laser_duel"] .arena-explosion-img,
                [data-arena-stage="base_battle"] .arena-explosion-img { width: 5rem !important; height: 5rem !important; }
                [data-arena-stage="battle_royale"] .arena-shield-fx { inset: -.35rem !important; width: calc(100% + .7rem) !important; height: calc(100% + .7rem) !important; }
                [data-arena-stage="base_battle"] .arena-hud-glass { padding: .5rem !important; }
            }
            @media (prefers-reduced-motion: reduce) {
                .arena-sheet-sprite { animation: none !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function start() {
        injectStyles();
        const probe = new Image();
        probe.onload = () => {
            sheetReady = true;
            window.__arenaCharacterSheetReady = true;
            scheduleEnhance();
        };
        probe.onerror = () => {
            sheetReady = false;
            window.__arenaCharacterSheetReady = false;
            console.warn('Game Arena character sheet failed to load; using original character SVGs.');
        };
        probe.src = SHEET_URL;

        const observer = new MutationObserver(scheduleEnhance);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', scheduleEnhance, { passive: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
