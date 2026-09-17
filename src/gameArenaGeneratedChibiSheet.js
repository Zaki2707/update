(function () {
  const SHEET_TEXT_URL = '/assets/game-arena-v5/chibi-sheet/part0.txt';
  const SHEET_W = 240;
  const SHEET_H = 216;
  const CELL_W = 60;
  const CELL_H = 72;

  const FRAMES = Object.freeze({
    tug_war: { A: [0, 0], B: [1, 0] },
    base_battle: { A: [2, 0], B: [3, 0] },
    battle_royale: { A: [0, 1], B: [1, 1] },
    quiz_race: { blue: [2, 1], red: [3, 1], green: [0, 2], yellow: [1, 2] },
    laser_duel: { A: [2, 2], B: [3, 2] }
  });

  let sheetUrl = '';
  let scheduled = false;

  function modeOf(node) {
    return String(node?.closest?.('[data-arena-stage]')?.getAttribute('data-arena-stage') || '');
  }

  function hash(value) {
    const text = String(value || '');
    let out = 0;
    for (let i = 0; i < text.length; i++) out = ((out << 5) - out + text.charCodeAt(i)) | 0;
    return Math.abs(out);
  }

  function sideOf(wrap) {
    const current = String(wrap?.dataset?.arenaV3Side || '');
    if (current === 'A' || current === 'B') return current;
    if (wrap.closest('.arena-team-a,[data-arena-base-side="A"]')) return 'A';
    if (wrap.closest('.arena-team-b,[data-arena-base-side="B"]')) return 'B';
    const stage = wrap.closest('[data-arena-stage]');
    if (!stage) return 'A';
    const mode = modeOf(wrap);
    if (mode === 'laser_duel') {
      const wraps = Array.from(stage.querySelectorAll('.arena-character-wrap'));
      return wraps.indexOf(wrap) <= 0 ? 'A' : 'B';
    }
    const player = wrap.closest('[data-arena-player-id]');
    return hash(player?.getAttribute('data-arena-player-id') || Array.from(stage.querySelectorAll('.arena-character-wrap')).indexOf(wrap)) % 2 ? 'B' : 'A';
  }

  function targetWidth(stage, mode) {
    const w = Math.max(280, stage?.getBoundingClientRect?.().width || 0);
    const compact = w <= 430;
    const mobile = w <= 720;
    if (mode === 'tug_war') return compact ? 44 : mobile ? 50 : 62;
    if (mode === 'base_battle') return compact ? 38 : mobile ? 44 : 52;
    if (mode === 'battle_royale') return compact ? 40 : mobile ? 46 : 54;
    if (mode === 'laser_duel') return compact ? 68 : mobile ? 76 : 88;
    return compact ? 44 : mobile ? 50 : 58;
  }

  function applyFrame(el, frame, width) {
    if (!sheetUrl || !frame) return;
    const scale = width / CELL_W;
    const [col, row] = frame;
    el.style.width = `${Math.round(CELL_W * scale)}px`;
    el.style.height = `${Math.round(CELL_H * scale)}px`;
    el.style.backgroundImage = `url("${sheetUrl}")`;
    el.style.backgroundSize = `${Math.round(SHEET_W * scale)}px ${Math.round(SHEET_H * scale)}px`;
    el.style.backgroundPosition = `${Math.round(-col * CELL_W * scale)}px ${Math.round(-row * CELL_H * scale)}px`;
  }

  function enhanceCharacter(wrap) {
    if (!sheetUrl || !wrap) return;
    const stage = wrap.closest('[data-arena-stage]');
    if (!stage) return;
    const mode = modeOf(wrap);
    if (!FRAMES[mode] || mode === 'quiz_race') return;
    const side = sideOf(wrap);
    const frame = FRAMES[mode][side] || FRAMES[mode].A;
    let sprite = wrap.querySelector(':scope > .arena-generated-chibi');
    if (!sprite) {
      sprite = document.createElement('span');
      sprite.className = 'arena-generated-chibi';
      sprite.setAttribute('aria-hidden', 'true');
      wrap.appendChild(sprite);
    }
    const width = targetWidth(stage, mode);
    applyFrame(sprite, frame, width);
    wrap.style.width = `${width}px`;
    wrap.style.height = `${Math.round(width * CELL_H / CELL_W)}px`;
    wrap.dataset.arenaGeneratedSide = side;
    wrap.classList.add('arena-generated-chibi-ready');
  }

  function enhanceRace(stage) {
    if (!sheetUrl) return;
    const colors = ['blue', 'red', 'green', 'yellow'];
    const mobile = Math.max(280, stage.getBoundingClientRect().width || 0) <= 720;
    Array.from(stage.querySelectorAll('.arena-race-car')).forEach((car, index) => {
      const color = colors[index % colors.length];
      let sprite = car.querySelector(':scope > .arena-generated-kart');
      if (!sprite) {
        sprite = document.createElement('span');
        sprite.className = 'arena-generated-kart';
        sprite.setAttribute('aria-hidden', 'true');
        car.appendChild(sprite);
      }
      applyFrame(sprite, FRAMES.quiz_race[color], mobile ? 78 : 96);
      car.dataset.arenaGeneratedKart = color;
    });
  }

  function enhanceAll() {
    scheduled = false;
    if (!sheetUrl) return;
    document.querySelectorAll('.arena-character-wrap').forEach(enhanceCharacter);
    document.querySelectorAll('[data-arena-stage="quiz_race"]').forEach(enhanceRace);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhanceAll);
  }

  function injectStyles() {
    if (document.getElementById('arena-generated-chibi-styles')) return;
    const style = document.createElement('style');
    style.id = 'arena-generated-chibi-styles';
    style.textContent = `
      .arena-character-wrap.arena-generated-chibi-ready>.arena-character-core,
      .arena-character-wrap.arena-generated-chibi-ready>.arena-sheet-sprite,
      .arena-character-wrap.arena-generated-chibi-ready>.arena-v3-character{display:none!important;visibility:hidden!important;opacity:0!important}
      .arena-character-wrap.arena-generated-chibi-ready{position:relative!important;overflow:visible!important;display:block!important}
      .arena-generated-chibi{position:absolute;left:50%;bottom:0;display:block;background-repeat:no-repeat;transform:translateX(-50%);transform-origin:50% 100%;pointer-events:none;user-select:none;filter:drop-shadow(0 6px 4px rgba(0,0,0,.36));z-index:8}
      [data-arena-stage="tug_war"] [data-arena-generated-side="A"]>.arena-generated-chibi{animation:arenaGeneratedPullA .78s ease-in-out infinite}
      [data-arena-stage="tug_war"] [data-arena-generated-side="B"]>.arena-generated-chibi{animation:arenaGeneratedPullB .78s ease-in-out infinite}
      [data-arena-stage="base_battle"] .arena-generated-chibi{animation:arenaGeneratedCombat .85s ease-in-out infinite}
      [data-arena-stage="battle_royale"] .arena-generated-chibi{animation:arenaGeneratedCombat 1.2s ease-in-out infinite}
      [data-arena-stage="laser_duel"] .arena-generated-chibi{animation:arenaGeneratedLaser .72s ease-in-out infinite}
      [data-arena-stage="quiz_race"] .arena-race-car>.arena-v3-kart,
      [data-arena-stage="quiz_race"] .arena-race-car>img[src*="/vehicles/"]{display:none!important;visibility:hidden!important}
      .arena-race-car{position:absolute!important}
      .arena-generated-kart{position:absolute;left:50%;bottom:-3px;display:block;background-repeat:no-repeat;transform:translateX(-50%);transform-origin:50% 100%;pointer-events:none;filter:drop-shadow(0 6px 4px rgba(0,0,0,.4));z-index:6;animation:arenaGeneratedKart .44s ease-in-out infinite}
      @keyframes arenaGeneratedPullA{0%,100%{transform:translateX(-50%) rotate(-2deg)}50%{transform:translateX(calc(-50% - 3px)) rotate(-6deg)}}
      @keyframes arenaGeneratedPullB{0%,100%{transform:translateX(-50%) rotate(2deg)}50%{transform:translateX(calc(-50% + 3px)) rotate(6deg)}}
      @keyframes arenaGeneratedCombat{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-3px)}}
      @keyframes arenaGeneratedLaser{0%,100%{transform:translate(-50%,0) scale(1)}50%{transform:translate(-50%,-2px) scale(1.02)}}
      @keyframes arenaGeneratedKart{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-2px)}}
      @media(prefers-reduced-motion:reduce){.arena-generated-chibi,.arena-generated-kart{animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  async function loadSheet() {
    try {
      const response = await fetch(SHEET_TEXT_URL, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const base64 = (await response.text()).replace(/\s+/g, '');
      const candidate = `data:image/webp;base64,${base64}`;
      await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = () => reject(new Error('invalid generated chibi sheet'));
        image.src = candidate;
      });
      sheetUrl = candidate;
      window.GAME_ARENA_GENERATED_CHIBI_SHEET = candidate;
      window.GAME_ARENA_GENERATED_CHIBI_FRAMES = FRAMES;
      document.documentElement.dataset.arenaGeneratedChibi = 'ready';
      schedule();
      window.dispatchEvent(new CustomEvent('madrasah:game-arena-chibi-ready'));
    } catch (error) {
      console.warn('Generated Game Arena chibi sheet unavailable; keeping current fallback characters.', error);
    }
  }

  function start() {
    injectStyles();
    loadSheet();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
