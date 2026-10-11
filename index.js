/*
 * Soundwalk Music — independently implemented audio companion for SillyTavern.
 * MIT License. No bundled songs, copyrighted artwork, or third-party player code.
 */
const ROOT_ID = 'soundwalk-player-root';
const STORE_KEY = 'soundwalk-player-v1';
const MAX_TRACKS = 300;
const MAX_FILE_SIZE = 60 * 1024 * 1024;
const ORB_EDGE = 8;
const ORB_SIZE = 56; // Transparent 56px touch target around a 52px pet head.
const DB_NAME = 'soundwalk-player-audio-v1';
const DB_STORE = 'tracks';

const icons = {
  music: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  previous: '<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zm3 7 10-7v14z"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM5 5l10 7-10 7z"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  volume: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M5 9H2v6h3l6 5V4zM15 9a5 5 0 010 6M18 6a9 9 0 010 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M5 9H2v6h3l6 5V4zM15 9l6 6m0-6-6 6"/></svg>'
};

const petAssets = Object.freeze({
  cat: new URL('./assets/pets/pet-cat-v123.png', import.meta.url).href,
  golden: new URL('./assets/pets/pet-golden-v123.png', import.meta.url).href,
  shepherd: new URL('./assets/pets/pet-shepherd-v123.png', import.meta.url).href,
});
const petIcons = {
  cat: `<img class="sw-pet-art sw-pet-raster" src="${petAssets.cat}" alt="软乎乎黑猫" draggable="false" decoding="async" />`,
  golden: `<img class="sw-pet-art sw-pet-raster" src="${petAssets.golden}" alt="萌萌金毛小狗" draggable="false" decoding="async" />`,
  shepherd: `<img class="sw-pet-art sw-pet-raster" src="${petAssets.shepherd}" alt="可爱德牧幼犬" draggable="false" decoding="async" />`
};

function uid() {
  return (globalThis.crypto?.randomUUID?.() || `sw-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}
function safeUrl(value) {
  if (typeof value !== 'string') return '';
  try {
    const parsed = new URL(value.trim());
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}
function cleanText(value, max = 90) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function validateTrack(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = cleanText(raw.title);
  const artist = cleanText(raw.artist || '未知歌手', 70);
  const kind = raw.kind === 'file' ? 'file' : 'url';
  if (!title) return null;
  const bindings = Array.isArray(raw.bindings)
    ? [...new Set(raw.bindings.filter(x => typeof x === 'string' && x.startsWith('avatar:') && x.length <= 310))].slice(0, 80)
    : [];
  if (kind === 'url') {
    const src = safeUrl(raw.src);
    return src ? { id: cleanText(raw.id, 100) || uid(), title, artist, kind, src, bindings } : null;
  }
  return { id: cleanText(raw.id, 100) || uid(), title, artist, kind, bindings };
}
function readSettings() {
  const defaults = { tracks: [], index: 0, mode: 'all', volume: 0.72, orbPosition: {x: 0, y: 0.37}, followCharacter: false, manualFilter: 'all', characterLabels: {}, openPet: 'golden' };
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!data || typeof data !== 'object') return defaults;
    const seen = new Set();
    const tracks = (Array.isArray(data.tracks) ? data.tracks : [])
      .slice(0, MAX_TRACKS).map(validateTrack).filter(track => {
        if (!track || seen.has(track.id)) return false;
        seen.add(track.id); return true;
      });
    return {
      tracks,
      index: Math.max(0, Math.min(tracks.length - 1, Number.isInteger(data.index) ? data.index : 0)),
      mode: ['all', 'one', 'shuffle'].includes(data.mode) ? data.mode : 'all',
      volume: Number.isFinite(data.volume) ? Math.max(0, Math.min(1, data.volume)) : 0.72,
      followCharacter: data.followCharacter === true,
      openPet: data.openPet === 'shepherd' ? 'shepherd' : 'golden',
      manualFilter: typeof data.manualFilter === 'string' && data.manualFilter.length <= 320 ? data.manualFilter : 'all',
      characterLabels: Object.fromEntries(Object.entries(data.characterLabels && typeof data.characterLabels === 'object' && !Array.isArray(data.characterLabels) ? data.characterLabels : {})
        .filter(([k,v]) => k.startsWith('avatar:') && k.length <= 310 && typeof v === 'string').slice(0,300)
        .map(([k,v]) => [k, cleanText(v,70)])),
      orbPosition: {
        x: Number.isFinite(data.orbPosition?.x) ? Math.max(0, Math.min(1, data.orbPosition.x)) : 0,
        y: Number.isFinite(data.orbPosition?.y) ? Math.max(0, Math.min(1, data.orbPosition.y)) : 0.37
      }
    };
  } catch { return defaults; }
}
function openAudioDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('浏览器不支持本地音频存储'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开音频库'));
  });
}
async function fileAction(type, key, value) {
  const db = await openAudioDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, type === 'get' ? 'readonly' : 'readwrite');
      const request = tx.objectStore(DB_STORE)[type](...(type === 'put' ? [value, key] : [key]));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('本地音频读写失败'));
      tx.onerror = () => reject(tx.error || new Error('本地存储事务失败'));
    });
  } finally { db.close(); }
}

function init() {
  if (document.getElementById(ROOT_ID)) return;
  const settings = readSettings();
  let currentIndex = settings.index;
  let mode = settings.mode;
  let previousVolume = settings.volume || 0.72;
  let playSequence = 0;
  let objectUrl = null;
  let sleepHandle = null;
  let sleepDeadline = 0;
  let editId = null;
  let orbPosition = {...settings.orbPosition};
  let followCharacter = settings.followCharacter;
  let openPet = settings.openPet;
  let manualFilter = settings.manualFilter;
  let currentCharacter = null;
  let lastRoleSignature = '';
  let manageBindingsOpen = false;
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = settings.volume;

  const root = document.createElement('section');
  root.id = ROOT_ID;
  root.setAttribute('aria-label', '听风音乐播放器');
  root.innerHTML = `
    <button class="sw-orb" type="button" aria-label="打开听风音乐播放器" aria-expanded="false">
      <span class="sw-orb-pet" aria-hidden="true">${petIcons.cat}</span><span class="sw-orb-pulse" aria-hidden="true"></span>
    </button>
    <dialog id="soundwalk-player-modal" class="sw-panel" aria-label="听风播放器">
      <header class="sw-header">
        <div class="sw-brand"><span class="sw-brand-dot"></span><div><strong>听风</strong><small>SOUNDWALK · 在故事里听歌</small></div></div>
        <div class="sw-header-actions"><button class="sw-icon sw-pet-settings-toggle" type="button" aria-label="宠物图标设置" title="宠物图标设置" aria-expanded="false" aria-controls="soundwalk-pet-settings">🐾</button>
        <button class="sw-icon sw-close" type="button" aria-label="关闭播放器">${icons.close}</button></div>
      </header>
      <section id="soundwalk-pet-settings" class="sw-pet-settings" aria-label="宠物图标设置" hidden>
        <div class="sw-pet-info"><strong>宠物图标</strong><span>收起是软乎乎黑猫 · 展开是萌萌小狗 · 贴纸头像无方形底框</span></div>
        <div class="sw-pet-choices" role="group" aria-label="打开时的小狗图标">
          <button class="sw-pet-choice" type="button" data-pet="golden" aria-pressed="true"><span class="sw-pet-thumb">${petIcons.golden}</span><span>金毛小狗</span></button>
          <button class="sw-pet-choice" type="button" data-pet="shepherd" aria-pressed="false"><span class="sw-pet-thumb">${petIcons.shepherd}</span><span>黑背德牧</span></button>
        </div>
      </section>
      <div class="sw-now">
        <div class="sw-scene" aria-hidden="true"><span class="sw-sun"></span><span class="sw-hill sw-hill-a"></span><span class="sw-hill sw-hill-b"></span><span class="sw-stars">✧</span></div>
        <div class="sw-now-title"><strong class="sw-title">歌单还是空的</strong><span class="sw-artist">添加链接或本地音频开始播放</span></div>
      </div>
      <div class="sw-progress-area">
        <input class="sw-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="播放进度" />
        <div class="sw-times"><span class="sw-elapsed">0:00</span><span class="sw-duration">0:00</span></div>
      </div>
      <div class="sw-controls">
        <button class="sw-icon sw-mode" type="button" aria-label="当前列表循环，点击切换播放模式" title="播放模式">↻</button>
        <button class="sw-icon sw-prev" type="button" aria-label="上一首">${icons.previous}</button>
        <button class="sw-main-play" type="button" aria-label="播放">${icons.play}</button>
        <button class="sw-icon sw-next" type="button" aria-label="下一首">${icons.next}</button>
        <button class="sw-icon sw-mute" type="button" aria-label="静音">${icons.volume}</button>
      </div>
      <div class="sw-volume-row"><span>音量</span><input class="sw-volume" aria-label="音量" type="range" min="0" max="100" value="72"/><label for="sw-sleep-select">定时停止</label><select id="sw-sleep-select" class="sw-sleep" aria-label="定时停止"><option value="0">关闭</option><option value="15">15分钟</option><option value="30">30分钟</option><option value="60">60分钟</option></select></div>
      <div class="sw-list-head"><strong>我的播放列表 <span class="sw-count">0</span></strong><div class="sw-tools"><button type="button" class="sw-text-button sw-add-link">+ 链接</button><button type="button" class="sw-text-button sw-add-file">+ 本地</button></div></div>
      <section class="sw-roles" aria-label="角色歌单设置">
        <div class="sw-role-line"><span class="sw-role-current">当前角色：识别中</span><label class="sw-role-toggle"><input class="sw-role-follow" type="checkbox" /> 随角色切换歌单</label></div>
        <div class="sw-role-tools"><label>歌单分组 <select class="sw-role-filter" aria-label="选择歌单分组"><option value="all">全部歌曲</option></select></label><button class="sw-text-button sw-role-manage" type="button" aria-expanded="false">管理角色绑定</button></div>
        <div class="sw-role-manager" hidden><p class="sw-role-hint">勾选歌曲，绑定到当前角色；取消勾选即解除绑定。一首歌可以绑定多个角色。</p><div class="sw-role-bind-items"></div></div>
      </section>
      <ol class="sw-list" aria-label="播放列表"></ol>
      <div class="sw-form" hidden>
        <label>歌名<input class="sw-name" type="text" maxlength="90" placeholder="例如：夜航"/></label>
        <label>歌手<input class="sw-singer" type="text" maxlength="70" placeholder="可选"/></label>
        <label>音频直链<input class="sw-url" type="url" placeholder="https://example.com/song.mp3"/></label>
        <div class="sw-form-actions"><button type="button" class="sw-cancel">取消</button><button type="button" class="sw-save">保存歌曲</button></div>
      </div>
      <footer class="sw-footer"><div class="sw-file-tools"><button class="sw-export" type="button">导出歌单</button><button class="sw-import" type="button">导入歌单</button></div><span>仅本机保存 · 无内置曲库</span></footer>
      <input class="sw-file-input" type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac" multiple hidden />
      <input class="sw-json-input" type="file" accept="application/json,.json" hidden />
      <p class="sw-notice" role="status" aria-live="polite"></p>
    </dialog>`;
  document.body.append(root);
  const $ = selector => root.querySelector(selector);
  const orb = $('.sw-orb');
  const panel = $('.sw-panel');
  const list = $('.sw-list');
  const form = $('.sw-form');
  const seek = $('.sw-seek');
  const playButton = $('.sw-main-play');
  const fileInput = $('.sw-file-input');
  const jsonInput = $('.sw-json-input');
  const roleFilterSelect = $('.sw-role-filter');
  const roleManager = $('.sw-role-manager');
  const roleManagerItems = $('.sw-role-bind-items');
  let messageTimer;

  // Keep the floating control fully inside the current viewport, even after
  // orientation changes. Coordinates are normalized so they persist on mobile.
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function viewportRoom() {
    const width = Math.max(ORB_SIZE + ORB_EDGE * 2, window.innerWidth || document.documentElement.clientWidth);
    const height = Math.max(ORB_SIZE + ORB_EDGE * 2, window.innerHeight || document.documentElement.clientHeight);
    return {
      width: Math.max(0, width - ORB_SIZE - ORB_EDGE * 2),
      height: Math.max(0, height - ORB_SIZE - ORB_EDGE * 2)
    };
  }
  function setOrbXY(left, top) {
    const room = viewportRoom();
    orbPosition = {
      x: room.width ? clamp((left - ORB_EDGE) / room.width, 0, 1) : 0,
      y: room.height ? clamp((top - ORB_EDGE) / room.height, 0, 1) : 0
    };
    positionOrb();
  }
  function positionOrb() {
    const room = viewportRoom();
    root.style.setProperty('--sw-orb-left', `${Math.round(ORB_EDGE + room.width * orbPosition.x)}px`);
    root.style.setProperty('--sw-orb-top', `${Math.round(ORB_EDGE + room.height * orbPosition.y)}px`);
  }
  positionOrb();
  window.addEventListener('resize', () => {
    positionOrb();
    if (isPanelOpen()) requestAnimationFrame(positionPanelNearOrb);
  });
  window.visualViewport?.addEventListener('resize', () => {
    if (isPanelOpen()) requestAnimationFrame(positionPanelNearOrb);
  });

  // A tap opens the panel. A drag moves the orb without opening the panel.
  // Pointer events cover both mouse and touchscreen; no separate touch handlers
  // means a finger gesture cannot accidentally trigger two actions.
  let drag = null;
  let lastDragEnd = 0;
  let lastPointerTapAt = 0;
  orb.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const box = orb.getBoundingClientRect();
    drag = {id:event.pointerId, startX:event.clientX, startY:event.clientY,
      left:box.left, top:box.top, moved:false};
    // Touchscreen browsers provide implicit capture; request explicit capture
    // only after a drag has started. Capturing simple taps can suppress click.
    event.stopPropagation();
  });
  orb.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 7) {
      drag.moved = true;
      orb.classList.add('sw-dragging');
      try { orb.setPointerCapture(event.pointerId); } catch {}
    }
    if (!drag.moved) return;
    setOrbXY(drag.left + dx, drag.top + dy);
    event.preventDefault();
    event.stopPropagation();
  });
  function finishDrag(event, cancelled = false) {
    if (!drag || event.pointerId !== drag.id) return;
    const wasDrag = drag.moved;
    drag = null;
    orb.classList.remove('sw-dragging');
    try { if (orb.hasPointerCapture(event.pointerId)) orb.releasePointerCapture(event.pointerId); } catch {}
    if (wasDrag) {
      lastDragEnd = Date.now();
      persist();
    } else if (!cancelled) {
      // Open directly on pointerup. Some Android WebViews/browsers don't send
      // the follow-up click after pointer capture or gesture interception.
      lastPointerTapAt = Date.now();
      showPanel(!isPanelOpen());
    }
    event.stopPropagation();
  }
  orb.addEventListener('pointerup', event => finishDrag(event));
  orb.addEventListener('pointercancel', event => finishDrag(event, true));

  function notice(message) {
    const el = $('.sw-notice');
    el.textContent = message;
    el.classList.add('sw-show');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => el.classList.remove('sw-show'), 3800);
  }
  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({tracks: settings.tracks, index: currentIndex, mode, volume: audio.volume, orbPosition,
        followCharacter, manualFilter, characterLabels:settings.characterLabels, openPet}));
    } catch { notice('无法保存偏好：请检查浏览器存储权限或剩余空间'); }
  }
  // A non-modal dialog enters the top layer without inerting the page.
  // This keeps the actual floating cat/dog head visible and clickable even
  // while the playlist is open, so tapping the dog head can close it again.
  // The player stays above SillyTavern themes without a dark modal backdrop.
  const dialogSupported = typeof panel.show === 'function';
  function isPanelOpen() {
    return (dialogSupported && panel.open) || panel.classList.contains('sw-fallback-open');
  }
  function syncPetChoices() {
    root.querySelectorAll('.sw-pet-choice').forEach(button => {
      const selected = button.dataset.pet === openPet;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('sw-selected', selected);
    });
  }
  function syncPanelState() {
    const open = isPanelOpen();
    $('.sw-orb-pet').innerHTML = open ? petIcons[openPet] : petIcons.cat;
    orb.classList.toggle('sw-open', open);
    orb.setAttribute('aria-expanded', String(open));
    orb.setAttribute('aria-label', open ? '关闭听风音乐播放器' : '打开听风音乐播放器');
  }
  // Follow the movable pet head. Keep the panel inside the screen:
  // below the head when possible, above it near the bottom, and aligned
  // with the head itself when neither side has room for the full player.
  // Coordinates are recalculated each time the player opens and on resize.
  function positionPanelNearOrb() {
    if (!isPanelOpen()) return;
    const gap = 10;
    const edge = 8;
    const width = window.visualViewport?.width || window.innerWidth;
    const height = window.visualViewport?.height || window.innerHeight;
    const viewportLeft = window.visualViewport?.offsetLeft || 0;
    const viewportTop = window.visualViewport?.offsetTop || 0;
    const orbRect = orb.getBoundingClientRect();

    // Keep the little dog fully exposed rather than placing the dialog on top
    // of it. When there is not room for the entire playlist, shorten the
    // *scrolling panel* instead of stealing the pet head's hit area.
    const spaceBelow = Math.max(0, viewportTop + height - edge - (orbRect.bottom + gap));
    const spaceAbove = Math.max(0, orbRect.top - gap - (viewportTop + edge));
    const putBelow = spaceBelow >= spaceAbove;
    const available = putBelow ? spaceBelow : spaceAbove;
    panel.style.setProperty('max-height', `${Math.max(80, Math.min(680, available))}px`, 'important');
    const rect = panel.getBoundingClientRect();
    const panelWidth = rect.width || Math.min(365, width - edge * 2);
    const panelHeight = rect.height || Math.min(500, available);
    const left = clamp(orbRect.left, viewportLeft + edge,
      Math.max(viewportLeft + edge, viewportLeft + width - panelWidth - edge));
    const top = putBelow ? orbRect.bottom + gap : orbRect.top - panelHeight - gap;
    panel.style.setProperty('left', `${Math.round(left)}px`, 'important');
    panel.style.setProperty('top', `${Math.round(clamp(top, viewportTop + edge, viewportTop + height - panelHeight - edge))}px`, 'important');
    panel.style.setProperty('right', 'auto', 'important');
    panel.style.setProperty('bottom', 'auto', 'important');
  }
  function showPanel(show) {
    if (show === isPanelOpen()) return;
    if (dialogSupported) {
      try {
        if (show) panel.show();
        else panel.close();
      } catch (error) {
        // Keep an accessible fallback if the browser forbids modal dialogs.
        panel.classList.toggle('sw-fallback-open', show);
        panel.hidden = !show;
      }
    } else {
      panel.classList.toggle('sw-fallback-open', show);
      panel.hidden = !show;
    }
    syncPanelState();
    if (show) {
      positionPanelNearOrb();
      // A following frame accounts for dynamic font sizing / top-layer layout.
      requestAnimationFrame(positionPanelNearOrb);
    }
    const focusTarget = show ? $('.sw-close') : orb;
    try { focusTarget.focus({preventScroll:true}); }
    catch { focusTarget.focus(); }
  }
  // Forms and binding manager can change modal height after it opens.
  // Reposition whenever its box changes so controls never fall below screen.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => { if (isPanelOpen()) requestAnimationFrame(positionPanelNearOrb); }).observe(panel);
  }
  panel.addEventListener('cancel', event => {
    event.preventDefault();
    showPanel(false);
  });
  panel.addEventListener('close', syncPanelState);
  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }
  function renderTransport() {
    const playing = !audio.paused && !audio.ended;
    playButton.innerHTML = playing ? icons.pause : icons.play;
    playButton.setAttribute('aria-label', playing ? '暂停' : '播放');
    orb.classList.toggle('sw-active', playing);
    $('.sw-mute').innerHTML = audio.volume === 0 ? icons.mute : icons.volume;
    $('.sw-volume').value = String(Math.round(audio.volume * 100));
    const labels = {all: '列表循环', one: '单曲循环', shuffle: '随机播放'};
    $('.sw-mode').textContent = ({all:'↻', one:'①', shuffle:'⤨'})[mode];
    $('.sw-mode').setAttribute('aria-label', `${labels[mode]}，点击切换播放模式`);
    $('.sw-mode').title = labels[mode];
  }
  // SillyTavern characterId is only an array index, not a permanent ID.
  // Avatar filename is normally stable for the installed character card.
  // All associations stay inside Soundwalk storage, not character card data.
  function getActiveCharacter() {
    try {
      const ctx = globalThis.SillyTavern?.getContext?.();
      const id = ctx?.characterId;
      if (id === undefined || id === null || id === '' || ctx?.groupId !== undefined && ctx.groupId !== null) return null;
      const character = ctx.characters?.[id];
      const avatar = typeof character?.avatar === 'string' ? character.avatar : '';
      if (!avatar) return null;
      return { key: `avatar:${avatar}`, name:cleanText(character.name || character.data?.name || '未命名角色',70) };
    } catch {return null;}
  }
  function roleFilterKey() {
    return followCharacter ? (currentCharacter ? currentCharacter.key : 'all') : manualFilter;
  }
  function visibleIndices() {
    const key = roleFilterKey();
    return settings.tracks.flatMap((track,index) => {
      const bindings = track.bindings || [];
      const visible = key === 'all' || (key === 'unassigned' ? !bindings.length : bindings.includes(key));
      return visible ? [index] : [];
    });
  }
  function updateRoleView() {
    const status = $('.sw-role-current');
    status.textContent = currentCharacter ? `当前角色：${currentCharacter.name}` : '当前：无单人角色（群聊可手动选分组）';
    status.title = status.textContent;
    $('.sw-role-follow').checked = followCharacter;
    const choices = [{key:'all',name:'全部歌曲'}, {key:'unassigned',name:'未绑定歌曲'}];
    const roles = new Set(settings.tracks.flatMap(t => t.bindings || []));
    if (currentCharacter) roles.add(currentCharacter.key);
    for(const key of roles) choices.push({key,name:settings.characterLabels[key] || (currentCharacter?.key === key ? currentCharacter.name : '未知角色')});
    const selected = roleFilterKey();
    roleFilterSelect.replaceChildren();
    choices.forEach(c => {
      const option = document.createElement('option');
      option.value = c.key;
      option.textContent = c.key === 'all' || c.key === 'unassigned' ? c.name : `🎵 ${c.name}`;
      roleFilterSelect.append(option);
    });
    if (!choices.some(c=>c.key===selected)) {
      const option = document.createElement('option');
      option.value = selected; option.textContent = settings.characterLabels[selected] || '曾经绑定的角色';
      roleFilterSelect.append(option);
    }
    roleFilterSelect.value = selected;
    roleFilterSelect.disabled = followCharacter;
    roleFilterSelect.title = followCharacter ? '关闭随角色切换后可自由查看分组' : '选择要查看的歌单分组';
    $('.sw-role-manage').textContent = manageBindingsOpen ? '收起绑定管理' : '管理角色绑定';
    $('.sw-role-manage').setAttribute('aria-expanded', String(manageBindingsOpen));
    roleManager.hidden = !manageBindingsOpen;
    if (manageBindingsOpen) renderBindingManager();
  }
  function renderBindingManager() {
    roleManagerItems.replaceChildren();
    if (!currentCharacter) {
      const message = document.createElement('p');
      message.textContent = '请先进入一个单人角色聊天，再管理绑定。';
      roleManagerItems.append(message); return;
    }
    if (!settings.tracks.length) {
      const message = document.createElement('p');
      message.textContent = '先添加歌曲，然后可以在这里勾选。';
      roleManagerItems.append(message); return;
    }
    settings.tracks.forEach(track => {
      const label = document.createElement('label');
      label.className = 'sw-role-bind-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = (track.bindings || []).includes(currentCharacter.key);
      input.setAttribute('aria-label', `将 ${track.title} 绑定到 ${currentCharacter.name}`);
      input.addEventListener('change', () => toggleTrackBinding(track.id, input.checked));
      const title = document.createElement('span');
      title.textContent = `${track.title} · ${track.artist}`;
      label.append(input, title);
      roleManagerItems.append(label);
    });
  }
  function toggleTrackBinding(id, bound) {
    if (!currentCharacter) {notice('请先打开单人角色聊天'); return;}
    const track = settings.tracks.find(t => t.id === id);
    if (!track) return;
    const old = track.bindings || [];
    track.bindings = bound ? [...new Set([...old,currentCharacter.key])] : old.filter(k => k !== currentCharacter.key);
    settings.characterLabels[currentCharacter.key] = currentCharacter.name;
    refreshFilter();
    notice(bound ? `已绑定到「${currentCharacter.name}」` : `已解除「${currentCharacter.name}」的绑定`);
  }
  function refreshFilter() {
    const visible = visibleIndices();
    if (!visible.includes(currentIndex)) void selectTrack(visible[0] ?? -1, false);
    else {renderList(); persist();}
  }
  function syncActiveCharacter() {
    const role = getActiveCharacter();
    const signature = `${role?.key || ''}|${role?.name || ''}`;
    if (lastRoleSignature === signature) return;
    lastRoleSignature = signature;
    currentCharacter = role;
    if (role) settings.characterLabels[role.key] = role.name;
    if (followCharacter) refreshFilter();
    else {renderList();persist();}
  }
  function subscribeCharacterEvents() {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx?.eventSource?.on || !ctx?.event_types) return;
    for (const type of ['CHAT_CHANGED','CHARACTER_EDITED','CHARACTER_DELETED','APP_READY']) {
      const event = ctx.event_types[type];
      if (event) ctx.eventSource.on(event, () => syncActiveCharacter());
    }
  }
  function renderNow() {
    const visible = visibleIndices();
    const track = visible.includes(currentIndex) ? settings.tracks[currentIndex] : null;
    $('.sw-title').textContent = track ? track.title : (settings.tracks.length ? '当前分组暂无歌曲' : '歌单还是空的');
    $('.sw-artist').textContent = track ? `${track.artist} · ${track.kind === 'file' ? '本地音频' : '网络音频'}` : '添加链接或本地音频开始播放';
    $('.sw-count').textContent = `${visible.length}/${settings.tracks.length}`;
  }
  function actionBtn(label, title, handler) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sw-track-action';
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.addEventListener('click', handler);
    return btn;
  }
  function renderList() {
    list.replaceChildren();
    visibleIndices().forEach(index => {
      const track = settings.tracks[index];
      const item = document.createElement('li');
      item.className = 'sw-track';
      if (index === currentIndex) item.classList.add('sw-current');
      const select = document.createElement('button');
      select.className = 'sw-track-choice';
      select.type = 'button';
      select.title = `播放 ${track.title}`;
      const trackName = document.createElement('span');
      trackName.className = 'sw-track-name';
      trackName.textContent = track.title;
      const sub = document.createElement('small');
      sub.textContent = `${track.artist} · ${track.kind === 'file' ? '本地' : '链接'} · ${(track.bindings || []).length ? `已绑定${track.bindings.length}个角色` : '未绑定'}`;
      select.append(trackName, sub);
      select.addEventListener('click', () => selectTrack(index, true));
      const actions = document.createElement('div');
      actions.className = 'sw-track-actions';
      if (currentCharacter) {
        const assigned = (track.bindings || []).includes(currentCharacter.key);
        const bindingButton = actionBtn(assigned ? '♥' : '♡', `${assigned ? '取消' : '绑定'}「${currentCharacter.name}」的歌曲 ${track.title}`,
          () => toggleTrackBinding(track.id, !assigned));
        bindingButton.classList.toggle('sw-bound', assigned);
        bindingButton.setAttribute('aria-pressed', String(assigned));
        actions.append(bindingButton);
      }
      if (track.kind === 'url') {
        actions.append(actionBtn('✎', `编辑 ${track.title}`, () => editTrack(track.id)));
      }
      actions.append(actionBtn('×', `删除 ${track.title}`, () => deleteTrack(track.id)));
      item.append(select, actions);
      list.append(item);
    });
    if (!visibleIndices().length) {
      const empty = document.createElement('li');
      empty.className = 'sw-empty';
      empty.textContent = !settings.tracks.length
        ? '还没有歌曲。你可以添加合法音频直链，也可以选择手机上的音频文件。'
        : '这个分组还没有歌曲。关闭「随角色切换」查看全部，再点击♡绑定，或使用「管理角色绑定」批量勾选。';
      list.append(empty);
    }
    renderNow();
    updateRoleView();
  }
  function resetProgress() {
    seek.value = '0';
    $('.sw-elapsed').textContent = '0:00';
    $('.sw-duration').textContent = '0:00';
  }
  async function selectTrack(index, shouldPlay = false) {
    const nextTrack = visibleIndices().includes(index) ? settings.tracks[index] : null;
    const seq = ++playSequence;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    currentIndex = index;
    resetProgress();
    renderList();
    renderTransport();
    persist();
    if (!nextTrack) return;
    try {
      if (nextTrack.kind === 'file') {
        const blob = await fileAction('get', nextTrack.id);
        if (seq !== playSequence) return;
        if (!(blob instanceof Blob)) throw new Error('音频文件不存在，可能是浏览器存储已清理');
        objectUrl = URL.createObjectURL(blob);
        audio.src = objectUrl;
      } else {
        audio.src = nextTrack.src;
      }
      audio.load();
      if (shouldPlay) await play();
    } catch (err) {
      if (seq === playSequence) notice(err.message || '无法读取歌曲');
    }
  }
  async function play() {
    const visible = visibleIndices();
    if (!visible.length) { notice('当前分组没有歌曲，请先绑定或切换分组'); return; }
    if (!visible.includes(currentIndex)) {await selectTrack(visible[0], true); return;}
    if (!audio.src) { await selectTrack(currentIndex, true); return; }
    try { await audio.play(); }
    catch { notice('无法播放：检查链接、音频格式或浏览器播放限制'); }
    renderTransport();
  }
  function nextIndex(direction) {
    const indices = visibleIndices();
    if (!indices.length) return -1;
    if (mode === 'shuffle' && indices.length > 1) {
      const candidates = indices.filter(index => index !== currentIndex);
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    const index = indices.indexOf(currentIndex);
    return indices[(index + direction + indices.length) % indices.length];
  }
  function advance(direction, fromEnded = false) {
    if (!visibleIndices().length) return;
    if (fromEnded && mode === 'one') {
      audio.currentTime = 0;
      void play();
      return;
    }
    void selectTrack(nextIndex(direction), true);
  }
  function showForm(track = null) {
    editId = track?.id || null;
    $('.sw-name').value = track?.title || '';
    $('.sw-singer').value = track?.artist === '未知歌手' ? '' : (track?.artist || '');
    $('.sw-url').value = track?.src || '';
    $('.sw-save').textContent = track ? '保存修改' : '添加歌曲';
    form.hidden = false;
    requestAnimationFrame(positionPanelNearOrb);
    $('.sw-name').focus();
  }
  function hideForm() {
    form.hidden = true;
    editId = null;
  }
  function editTrack(id) {
    const track = settings.tracks.find(item => item.id === id && item.kind === 'url');
    if (track) showForm(track);
  }
  async function deleteTrack(id) {
    const index = settings.tracks.findIndex(track => track.id === id);
    if (index < 0) return;
    const [removed] = settings.tracks.splice(index, 1);
    if (removed.kind === 'file') {
      try { await fileAction('delete', removed.id); }
      catch { notice('歌曲已移出列表，但本地存储清理失败'); }
    }
    const wasCurrent = index === currentIndex;
    if (index < currentIndex) currentIndex -= 1;
    if (wasCurrent || currentIndex >= settings.tracks.length) {
      currentIndex = -1;
    }
    refreshFilter();
  }
  $('.sw-save').addEventListener('click', () => {
    const title = cleanText($('.sw-name').value);
    const artist = cleanText($('.sw-singer').value || '未知歌手', 70);
    const src = safeUrl($('.sw-url').value);
    if (!title || !src) { notice('请填写歌名和有效的 http(s) 音频直链'); return; }
    if (!editId && settings.tracks.length >= MAX_TRACKS) { notice('歌单最多支持 300 首'); return; }
    if (editId) {
      const idx = settings.tracks.findIndex(track => track.id === editId);
      if (idx < 0) return;
      settings.tracks[idx] = { ...settings.tracks[idx], title, artist, src };
      if (idx === currentIndex) void selectTrack(idx, false);
    } else {
      const wasEmpty = settings.tracks.length === 0;
      settings.tracks.push({ id: uid(), kind: 'url', title, artist, src, bindings: followCharacter && currentCharacter ? [currentCharacter.key] : [] });
      if (wasEmpty) void selectTrack(0, false);
    }
    hideForm(); refreshFilter(); notice('歌曲已保存');
  });
  $('.sw-add-link').addEventListener('click', () => showForm());
  $('.sw-cancel').addEventListener('click', hideForm);
  $('.sw-add-file').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    let added = 0;
    for (const file of Array.from(fileInput.files || [])) {
      if (settings.tracks.length >= MAX_TRACKS) { notice('歌单最多支持 300 首'); break; }
      if (file.size > MAX_FILE_SIZE) { notice(`跳过 ${file.name}：单个文件不能超过 60MB`); continue; }
      if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|ogg|wav|flac|aac)$/i.test(file.name)) {
        notice(`跳过 ${file.name}：不是支持的音频文件`); continue;
      }
      const id = uid();
      try {
        await fileAction('put', id, file);
        const title = cleanText(file.name.replace(/\.[^.]+$/, '')) || '本地音频';
        const wasEmpty = settings.tracks.length === 0;
        settings.tracks.push({id, kind:'file', title, artist:'本地文件', bindings: followCharacter && currentCharacter ? [currentCharacter.key] : []});
        added += 1;
        if (wasEmpty) void selectTrack(0, false);
      } catch { notice(`无法保存 ${file.name}：可能存储空间不足`); }
    }
    fileInput.value = '';
    refreshFilter();
    if (added) notice(`已导入 ${added} 首本地音频`);
  });
  $('.sw-export').addEventListener('click', () => {
    const tracks = settings.tracks.filter(item => item.kind === 'url').map(({title, artist, src, bindings}) => ({title, artist, src, bindings}));
    const data = {format:'soundwalk-playlist', version:2, characterLabels:settings.characterLabels, tracks};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = '听风-网络歌单.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice('已导出网络歌单和绑定；分享 JSON 前请注意内含角色名称，本地音频文件不包含');
  });
  $('.sw-import').addEventListener('click', () => jsonInput.click());
  jsonInput.addEventListener('change', async () => {
    const file = jsonInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error('歌单文件过大');
      const data = JSON.parse(await file.text());
      if (data?.format !== 'soundwalk-playlist' || !Array.isArray(data?.tracks)) {
        throw new Error('不是听风歌单 JSON 文件');
      }
      if (data.version === 2 && data.characterLabels && typeof data.characterLabels === 'object') {
        for(const [key,name] of Object.entries(data.characterLabels).slice(0,300)) {
          if (key.startsWith('avatar:') && key.length<=310 && typeof name === 'string') settings.characterLabels[key] = cleanText(name,70);
        }
      }
      const existing = new Map(settings.tracks.filter(t => t.kind === 'url').map(t => [t.src,t]));
      let count = 0;
      let rebound = 0;
      for (const item of data.tracks.slice(0, MAX_TRACKS)) {
        const parsed = validateTrack({ ...item, kind:'url', id: uid() });
        if (!parsed) continue;
        const duplicate = existing.get(parsed.src);
        if (duplicate) {
          const oldCount = (duplicate.bindings || []).length;
          duplicate.bindings = [...new Set([...(duplicate.bindings || []), ...parsed.bindings])];
          if (duplicate.bindings.length > oldCount) rebound++;
          continue;
        }
        if (settings.tracks.length >= MAX_TRACKS) break;
        settings.tracks.push(parsed); existing.set(parsed.src,parsed); count++;
      }
      refreshFilter(); notice(`已导入 ${count} 首网络歌曲，更新 ${rebound} 首的角色绑定`);
    } catch (error) { notice(error.message || '歌单导入失败'); }
    finally { jsonInput.value = ''; }
  });
  $('.sw-role-follow').addEventListener('change', e => {
    if (e.target.checked && !currentCharacter) {
      e.target.checked = false;
      notice('请先进入一个单人角色聊天');
      return;
    }
    followCharacter = e.target.checked;
    refreshFilter();
    notice(followCharacter ? `已开启：跟随「${currentCharacter.name}」` : '已关闭自动跟随，可以自由选分组');
  });
  roleFilterSelect.addEventListener('change', e => {
    if (followCharacter) return;
    manualFilter = e.target.value;
    refreshFilter();
  });
  $('.sw-role-manage').addEventListener('click', () => {
    manageBindingsOpen = !manageBindingsOpen;
    updateRoleView();
    requestAnimationFrame(positionPanelNearOrb);
  });
  orb.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    // Pointerup already handled taps. Keep click for keyboard activation and
    // older browsers that don't expose Pointer Events, but never double-toggle.
    if (event.detail !== 0 && Date.now() - lastPointerTapAt < 750) return;
    if (event.detail !== 0 && Date.now() - lastDragEnd < 750) return;
    showPanel(!isPanelOpen());
  });
  const petSettings = $('.sw-pet-settings');
  const petSettingsToggle = $('.sw-pet-settings-toggle');
  petSettingsToggle.addEventListener('click', () => {
    petSettings.hidden = !petSettings.hidden;
    petSettingsToggle.setAttribute('aria-expanded', String(!petSettings.hidden));
    if (!petSettings.hidden) syncPetChoices();
    requestAnimationFrame(positionPanelNearOrb);
  });
  root.querySelectorAll('.sw-pet-choice').forEach(button => button.addEventListener('click', () => {
    openPet = button.dataset.pet === 'shepherd' ? 'shepherd' : 'golden';
    syncPetChoices();
    syncPanelState();
    persist();
    notice(openPet === 'shepherd' ? '已选黑背德牧 · 收起后仍显示黑猫' : '已选金毛小狗 · 收起后仍显示黑猫');
  }));
  $('.sw-close').addEventListener('click', () => showPanel(false));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && isPanelOpen()) showPanel(false); });
  playButton.addEventListener('click', () => audio.paused ? void play() : audio.pause());
  $('.sw-prev').addEventListener('click', () => advance(-1));
  $('.sw-next').addEventListener('click', () => advance(1));
  $('.sw-mode').addEventListener('click', () => {
    mode = ({all:'one', one:'shuffle', shuffle:'all'})[mode];
    renderTransport(); persist(); notice(({all:'列表循环', one:'单曲循环', shuffle:'随机播放'})[mode]);
  });
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = (+seek.value / 1000) * audio.duration;
  });
  $('.sw-volume').addEventListener('input', e => {
    audio.volume = +e.target.value / 100;
    if (audio.volume > 0) previousVolume = audio.volume;
    renderTransport(); persist();
  });
  $('.sw-mute').addEventListener('click', () => {
    audio.volume = audio.volume > 0 ? 0 : previousVolume;
    renderTransport(); persist();
  });
  $('.sw-sleep').addEventListener('change', e => {
    clearTimeout(sleepHandle);
    const minutes = Number(e.target.value);
    sleepDeadline = minutes ? Date.now() + minutes * 60000 : 0;
    if (minutes) sleepHandle = setTimeout(() => {
      audio.pause(); sleepDeadline = 0; $('.sw-sleep').value = '0';
      notice('定时结束，音乐已暂停');
    }, minutes * 60000);
    notice(minutes ? `将在 ${minutes} 分钟后暂停` : '已关闭定时停止');
  });
  audio.addEventListener('play', renderTransport);
  audio.addEventListener('pause', renderTransport);
  audio.addEventListener('ended', () => advance(1, true));
  audio.addEventListener('timeupdate', () => {
    $('.sw-elapsed').textContent = formatTime(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) seek.value = String(Math.round(audio.currentTime / audio.duration * 1000));
  });
  audio.addEventListener('durationchange', () => $('.sw-duration').textContent = formatTime(audio.duration));
  audio.addEventListener('error', () => {
    if (audio.src) notice('音频加载失败：该链接可能已过期或格式不支持');
    renderTransport();
  });
  // Per-character associations are local to the player's browser, and
  // switching chats updates the active view without rewriting any cards.
  subscribeCharacterEvents();
  syncActiveCharacter();
  renderTransport(); renderList();
  if (visibleIndices().length) void selectTrack(visibleIndices().includes(currentIndex) ? currentIndex : visibleIndices()[0], false);
  else currentIndex = -1;
  // Some extensions initialize before ST has populated its active chat.
  for (const delay of [350, 1200, 3000]) setTimeout(syncActiveCharacter, delay);
  // Mobile browsers may pause sound when placed in the background; the extension cannot override OS policy.
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
else init();
