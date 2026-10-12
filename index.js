/*
 * Soundwalk Music — independently implemented audio companion for SillyTavern.
 * MIT License. No bundled songs, copyrighted artwork, or third-party player code.
 */
const ROOT_ID = 'soundwalk-player-root';
const VERSION = '1.3.14';
const STORE_KEY = 'soundwalk-player-v1';
const MAX_TRACKS = 300;
const MAX_FILE_SIZE = 60 * 1024 * 1024;
const ORB_EDGE = 8;
const ORB_SIZE = 56; // Transparent 56px touch target around a 52px pet head.
const DB_NAME = 'soundwalk-player-audio-v1';
const DB_STORE = 'tracks';
const COVER_STORE = 'covers';
const COVER_MAX_BYTES = 12 * 1024 * 1024;
const WALLPAPER_KEY = '__soundwalk_panel_wallpaper_v1__';
const WALLPAPER_MAX_BYTES = 16 * 1024 * 1024;

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

const brandAssets = Object.freeze({
  cat: new URL('./assets/brand/brand-cat-v126.png', import.meta.url).href,
  paw: new URL('./assets/brand/brand-paw-v126.png', import.meta.url).href,
});

const petAssets = Object.freeze({
  cat: new URL('./assets/pets/pet-cat-v123.png', import.meta.url).href,
  golden: new URL('./assets/pets/pet-golden-v123.png', import.meta.url).href,
  shepherd: new URL('./assets/pets/pet-shepherd-v123.png', import.meta.url).href,
  owl: new URL('./assets/pets/pet-owl-v136.webp', import.meta.url).href,
  raven: new URL('./assets/pets/pet-raven-v136.webp', import.meta.url).href,
  snake: new URL('./assets/pets/pet-snake-v136.webp', import.meta.url).href,
  wolf: new URL('./assets/pets/pet-wolf-v136.webp', import.meta.url).href,
  samoyed: new URL('./assets/pets/pet-samoyed-v136.webp', import.meta.url).href,
  rabbit: new URL('./assets/pets/pet-rabbit-v138.webp', import.meta.url).href,
  whiteCat: new URL('./assets/pets/pet-white-cat-v138.webp', import.meta.url).href,
  fox: new URL('./assets/pets/pet-fox-v138.webp', import.meta.url).href,
  bear: new URL('./assets/pets/pet-bear-v138.webp', import.meta.url).href,
  parrot: new URL('./assets/pets/pet-parrot-v138.webp', import.meta.url).href,
  deer: new URL('./assets/pets/pet-deer-v138.webp', import.meta.url).href,
  otter: new URL('./assets/pets/pet-otter-v138.webp', import.meta.url).href,
  penguin: new URL('./assets/pets/pet-penguin-v138.webp', import.meta.url).href,
  peacock: new URL('./assets/pets/pet-peacock-v138.webp', import.meta.url).href,
  peacockFan: new URL('./assets/pets/pet-peacock-fan-v138.webp', import.meta.url).href,
  jellyfish: new URL('./assets/pets/pet-jellyfish-v139.webp', import.meta.url).href,
  spider: new URL('./assets/pets/pet-spider-v139.webp', import.meta.url).href,
  beagle: new URL('./assets/pets/pet-beagle-v139.webp', import.meta.url).href,
  orca: new URL('./assets/pets/pet-orca-v139.webp', import.meta.url).href,
  octopus: new URL('./assets/pets/pet-octopus-v139.webp', import.meta.url).href,
  blackOctopus: new URL('./assets/pets/pet-black-octopus-v139.webp', import.meta.url).href,
});
const petIcons = {
  cat: `<img class="sw-pet-art sw-pet-raster" src="${petAssets.cat}" alt="软乎乎黑猫" draggable="false" decoding="async" />`,
  golden: `<img class="sw-pet-art sw-pet-raster" src="${petAssets.golden}" alt="萌萌金毛小狗" draggable="false" decoding="async" />`,
  shepherd: `<img class="sw-pet-art sw-pet-raster" src="${petAssets.shepherd}" alt="可爱德牧幼犬" draggable="false" decoding="async" />`,
  owl: `<img class="sw-pet-art" src="${petAssets.owl}" alt="胖乎乎雪鸮" draggable="false" decoding="async" />`,
  raven: `<img class="sw-pet-art" src="${petAssets.raven}" alt="细长小乌鸦" draggable="false" decoding="async" />`,
  snake: `<img class="sw-pet-art" src="${petAssets.snake}" alt="软萌小蛇" draggable="false" decoding="async" />`,
  wolf: `<img class="sw-pet-art" src="${petAssets.wolf}" alt="蓬松小狼" draggable="false" decoding="async" />`,
  samoyed: `<img class="sw-pet-art" src="${petAssets.samoyed}" alt="雪白萨摩耶" draggable="false" decoding="async" />`,
  rabbit: `<img class="sw-pet-art" src="${petAssets.rabbit}" alt="抱胡萝卜的小兔子" draggable="false" decoding="async" />`,
  whiteCat: `<img class="sw-pet-art" src="${petAssets.whiteCat}" alt="软乎乎小白猫" draggable="false" decoding="async" />`,
  fox: `<img class="sw-pet-art" src="${petAssets.fox}" alt="蓬松尾巴小狐狸" draggable="false" decoding="async" />`,
  bear: `<img class="sw-pet-art" src="${petAssets.bear}" alt="抱蜂蜜罐的小熊" draggable="false" decoding="async" />`,
  parrot: `<img class="sw-pet-art" src="${petAssets.parrot}" alt="彩色小鹦鹉" draggable="false" decoding="async" />`,
  deer: `<img class="sw-pet-art" src="${petAssets.deer}" alt="软萌小鹿" draggable="false" decoding="async" />`,
  otter: `<img class="sw-pet-art" src="${petAssets.otter}" alt="抱贝壳的小水獭" draggable="false" decoding="async" />`,
  penguin: `<img class="sw-pet-art" src="${petAssets.penguin}" alt="张开翅膀的小企鹅" draggable="false" decoding="async" />`,
  peacock: `<img class="sw-pet-art" src="${petAssets.peacock}" alt="收着尾巴的小孔雀" draggable="false" decoding="async" />`,
  peacockFan: `<img class="sw-pet-art" src="${petAssets.peacockFan}" alt="开屏小孔雀" draggable="false" decoding="async" />`,
  jellyfish: `<img class="sw-pet-art" src="${petAssets.jellyfish}" alt="透明粉色小水母" draggable="false" decoding="async" />`,
  spider: `<img class="sw-pet-art" src="${petAssets.spider}" alt="毛茸茸长腿小蜘蛛" draggable="false" decoding="async" />`,
  beagle: `<img class="sw-pet-art" src="${petAssets.beagle}" alt="抬爪比格小狗" draggable="false" decoding="async" />`,
  orca: `<img class="sw-pet-art" src="${petAssets.orca}" alt="黑白小虎鲸" draggable="false" decoding="async" />`,
  octopus: `<img class="sw-pet-art" src="${petAssets.octopus}" alt="橙色小章鱼" draggable="false" decoding="async" />`,
  blackOctopus: `<img class="sw-pet-art" src="${petAssets.blackOctopus}" alt="长触手黑色章鱼" draggable="false" decoding="async" />`
};
const CLOSED_PETS = Object.freeze(['cat', 'golden', 'shepherd', 'owl', 'raven', 'snake', 'wolf', 'samoyed',
  'rabbit', 'whiteCat', 'fox', 'bear', 'deer', 'otter', 'penguin', 'parrot', 'peacock', 'peacockFan',
  'jellyfish', 'spider', 'beagle', 'orca', 'octopus', 'blackOctopus']);
const PET_LABELS = Object.freeze({
  cat: '小黑猫', golden: '金毛小狗', shepherd: '黑背德牧', owl: '雪鸮',
  raven: '乌鸦', snake: '小蛇', wolf: '小狼', samoyed: '萨摩耶',
  rabbit: '小兔子', whiteCat: '小白猫', fox: '小狐狸', bear: '小熊', deer: '小鹿',
  otter: '水獭', penguin: '企鹅', parrot: '鹦鹉', peacock: '孔雀', peacockFan: '开屏孔雀',
  jellyfish: '水母', spider: '小蜘蛛', beagle: '比格犬', orca: '虎鲸', octopus: '小章鱼', blackOctopus: '黑章鱼'
});

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
function normalizeRoleOrders(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key,value]) =>
    key.startsWith('avatar:') && key.length <= 310 && Array.isArray(value)).slice(0,300)
    .map(([key,ids]) => [key,[...new Set(ids.filter(id => typeof id === 'string' && id.length <= 150))].slice(0,MAX_TRACKS)]));
}
function normalizeWallpaperView(raw) {
  const bounded = (value, min, max, fallback) => Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
  return {
    zoom: bounded(raw?.zoom, 100, 300, 100),
    x: bounded(raw?.x, 0, 100, 50),
    y: bounded(raw?.y, 0, 100, 50)
  };
}
function readSettings() {
  const defaults = { tracks: [], index: 0, mode: 'all', volume: 0.72, orbPosition: {x: 0, y: 0.37}, followCharacter: false, autoRolePlayback: false, networkAcceleration: false, manualFilter: 'all', characterLabels: {}, roleOrders: {}, openPet: 'golden', closedPet: 'cat', brandIcon: 'cat', panelOpacity: 100, frostBlur: 0, wallpaperView: normalizeWallpaperView() };
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
      autoRolePlayback: data.autoRolePlayback === true,
      networkAcceleration: data.networkAcceleration === true,
      roleOrders: normalizeRoleOrders(data.roleOrders),
      openPet: data.openPet === 'shepherd' ? 'shepherd' : 'golden',
      closedPet: CLOSED_PETS.includes(data.closedPet) ? data.closedPet : 'cat',
      brandIcon: data.brandIcon === 'paw' ? 'paw' : 'cat',
      panelOpacity: Number.isFinite(data.panelOpacity) ? Math.max(0, Math.min(100, Math.round(data.panelOpacity))) : 100,
      wallpaperView: normalizeWallpaperView(data.wallpaperView),
      // Older semi-transparent skins automatically gain a gentle frost once.
      // Fully opaque skins retain their original clear artwork on upgrade.
      frostBlur: Number.isFinite(data.frostBlur) ? Math.max(0, Math.min(30, Math.round(data.frostBlur))) :
        (Number.isFinite(data.panelOpacity) && data.panelOpacity < 100 ? 12 : 0),
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
    // IndexedDB v2 adds a separate artwork store; the original audio store is untouched.
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      if (!db.objectStoreNames.contains(COVER_STORE)) db.createObjectStore(COVER_STORE);
    };
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
      tx.oncomplete = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('本地音频读写失败'));
      tx.onabort = () => reject(tx.error || new Error('本地存储事务失败'));
    });
  } finally { db.close(); }
}
// Covers live in IndexedDB as blobs, keyed by the existing track ID.
// They never enter localStorage (which also stores the user's song list).
async function coverAction(type, key, value) {
  const db = await openAudioDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(COVER_STORE, type === 'get' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore(COVER_STORE);
      const request = type === 'put' ? store.put(value, key) : store[type](key);
      transaction.oncomplete = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('封面读写失败'));
      transaction.onabort = () => reject(transaction.error || new Error('封面存储事务失败'));
    });
  } finally { db.close(); }
}
async function makeCoverBlob(file) {
  if (!file || file.size > COVER_MAX_BYTES) throw new Error('封面图片不能超过12MB');
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('这张图片无法读取，请换一张 JPG 或 PNG'));
      img.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('图片尺寸无效');
    // Resize once to a 512px square JPEG: efficient for phone storage and thumbnails.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器不支持图片处理');
    ctx.fillStyle = '#f5efe0';
    ctx.fillRect(0, 0, 512, 512);
    const source = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - source) / 2, (img.naturalHeight - source) / 2,
      source, source, 0, 0, 512, 512);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
    if (!(blob instanceof Blob)) throw new Error('封面图片转换失败');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

async function makeWallpaperBlob(file) {
  if (!file || file.size > WALLPAPER_MAX_BYTES) throw new Error('壁纸不能超过16MB');
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) throw new Error('请选择 JPG、PNG、WebP 或 GIF 壁纸');
  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve,reject) => {
      img.onload=resolve;
      img.onerror=()=>reject(new Error('无法读取这张壁纸'));
      img.src=sourceUrl;
    });
    const w=img.naturalWidth,h=img.naturalHeight;
    if (!w || !h || w*h>80000000) throw new Error('图片尺寸过大或无效');
    const ratio=Math.min(1,1600/Math.max(w,h));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(w*ratio));
    canvas.height=Math.max(1,Math.round(h*ratio));
    const ctx=canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器无法处理壁纸');
    ctx.fillStyle='#f5efe0';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
    if (!(blob instanceof Blob)) throw new Error('保存壁纸失败');
    return blob;
  } finally { URL.revokeObjectURL(sourceUrl); }
}

// Backup checksums detect accidental corruption; they are not signatures.
// Streaming CRC-32 reads small chunks, avoiding a 60MB buffer per audio file.
const BACKUP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i=0;i<256;i++) {
    let value=i;
    for (let j=0;j<8;j++) value=(value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[i]=value >>> 0;
  }
  return table;
})();
function checksumBytes(bytes, initial=0xffffffff) {
  let crc=initial;
  for (let i=0;i<bytes.length;i++) crc=BACKUP_CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return crc >>> 0;
}
function checksumHex(bytes) {
  return ((checksumBytes(bytes) ^ 0xffffffff) >>> 0).toString(16).padStart(8,'0');
}
async function checksumBlob(blob) {
  let crc=0xffffffff;
  for (let offset=0;offset<blob.size;offset+=256*1024) {
    const bytes=new Uint8Array(await blob.slice(offset,Math.min(blob.size,offset+256*1024)).arrayBuffer());
    crc=checksumBytes(bytes,crc);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8,'0');
}

function init() {
  if (document.getElementById(ROOT_ID)) return;
  const settings = readSettings();
  let currentIndex = settings.index;
  let mode = settings.mode;
  let previousVolume = settings.volume || 0.72;
  let playSequence = 0;
  let playRequest = 0;
  let playIntent = false;
  let isPendingPlay = false;
  let expectedSource = '';
  let networkLoading = false;
  let loadingForSeek = false;
  let loadingSince = 0;
  let loadingTimer = null;
  let seekCheckTimer = null;
  let seekSequence = -1;
  let lastMediaTime = 0;
  let objectUrl = null;
  let sleepHandle = null;
  let sleepDeadline = 0;
  let editId = null;
  let orbPosition = {...settings.orbPosition};
  let followCharacter = settings.followCharacter;
  let autoRolePlayback = settings.autoRolePlayback;
  let networkAcceleration = settings.networkAcceleration;
  let preloadExpected = false;
  let openPet = settings.openPet;
  let closedPet = settings.closedPet;
  let brandIcon = settings.brandIcon;
  let panelOpacity = settings.panelOpacity;
  let frostBlur = settings.frostBlur;
  let wallpaperView = settings.wallpaperView;
  let wallpaperUrl = null;
  let wallpaperRevision = 0;
  let wallpaperSaving = false;
  let manualFilter = settings.manualFilter;
  let searchQuery = '';
  let currentCharacter = null;
  let lastRoleSignature = '';
  let manageBindingsOpen = false;
  let coverTargetId = null;
  const coverUrls = new Map(); // track ID -> object URL, or null for default artwork
  const coverPending = new Set();
  const coverQueue = [];
  let activeCoverReads = 0;
  const coverBusy = new Set();
  const coverRevision = new Map();
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = settings.volume;

  const root = document.createElement('section');
  root.id = ROOT_ID;
  root.dataset.soundwalkVersion = VERSION;
  root.setAttribute('aria-label', '听风音乐播放器');
  root.innerHTML = `
    <button class="sw-orb" type="button" aria-label="打开听风音乐播放器" aria-expanded="false">
      <span class="sw-orb-pet" aria-hidden="true">${petIcons[closedPet]}</span><span class="sw-orb-pulse" aria-hidden="true"></span>
    </button>
    <dialog id="soundwalk-player-modal" class="sw-panel" aria-label="听风播放器">
      <div class="sw-wallpaper-layer" aria-hidden="true"></div>
      <div class="sw-panel-content">
      <header class="sw-header">
        <div class="sw-brand"><button class="sw-brand-switch" type="button" aria-label="切换听风的小猫头和猫爪图标" title="点击切换猫头和猫爪"><img class="sw-brand-image" src="${brandAssets[brandIcon]}" alt="" draggable="false" decoding="async" /></button><div><strong>听风 <span class="sw-version">v${VERSION}</span></strong><small>SOUNDWALK · 在故事里听歌</small></div></div>
        <div class="sw-header-actions"><button class="sw-icon sw-appearance-toggle" type="button" aria-label="播放器外观装扮" title="透明度与壁纸" aria-expanded="false" aria-controls="soundwalk-appearance">🎨</button><button class="sw-icon sw-pet-settings-toggle" type="button" aria-label="宠物图标设置" title="宠物图标设置" aria-expanded="false" aria-controls="soundwalk-pet-settings">🐾</button>
        <button class="sw-icon sw-close" type="button" aria-label="关闭播放器">${icons.close}</button></div>
      </header>
      <section id="soundwalk-appearance" class="sw-appearance" aria-label="播放器外观装扮" hidden>
        <div class="sw-appearance-title"><strong>🎨 透明玻璃与自定义壁纸</strong><span>只影响播放器背景，不改变专辑封面</span></div>
        <div class="sw-wallpaper-actions"><button class="sw-wallpaper-select" type="button">从手机相册选择壁纸</button><button class="sw-wallpaper-reset" type="button">恢复默认背景</button></div>
        <fieldset class="sw-wallpaper-view" disabled>
          <legend>壁纸构图 · 等比缩放，自动铺满面板</legend>
          <label class="sw-opacity-label" for="sw-wallpaper-zoom"><span>壁纸缩放</span><output class="sw-wallpaper-zoom-value" for="sw-wallpaper-zoom">100%</output></label>
          <input id="sw-wallpaper-zoom" class="sw-wallpaper-zoom" type="range" min="100" max="300" step="5" value="100" aria-label="壁纸缩放" />
          <label class="sw-opacity-label" for="sw-wallpaper-x"><span>左右位置</span><output class="sw-wallpaper-x-value" for="sw-wallpaper-x">50%</output></label>
          <input id="sw-wallpaper-x" class="sw-wallpaper-x" type="range" min="0" max="100" step="1" value="50" aria-label="壁纸左右位置" />
          <label class="sw-opacity-label" for="sw-wallpaper-y"><span>上下位置</span><output class="sw-wallpaper-y-value" for="sw-wallpaper-y">50%</output></label>
          <input id="sw-wallpaper-y" class="sw-wallpaper-y" type="range" min="0" max="100" step="1" value="50" aria-label="壁纸上下位置" />
          <button class="sw-wallpaper-center sw-text-button" type="button">恢复居中与自动铺满</button>
        </fieldset>
        <label class="sw-opacity-label" for="sw-panel-opacity"><span>背景不透明度</span><output class="sw-opacity-value" for="sw-panel-opacity">100%</output></label>
        <input id="sw-panel-opacity" class="sw-panel-opacity" type="range" min="0" max="100" step="5" value="100" aria-label="播放器背景不透明度" />
        <label class="sw-opacity-label" for="sw-frost-blur"><span>毛玻璃虚化程度</span><output class="sw-blur-value" for="sw-frost-blur">0px</output></label>
        <input id="sw-frost-blur" class="sw-frost-blur" type="range" min="0" max="30" step="2" value="0" aria-label="壁纸与播放器背后的模糊程度" />
        <button class="sw-frost-preset" type="button">✨ 一键柔雾效果</button>
        <p class="sw-appearance-hint">透明度控制背景浓淡；虚化控制壁纸和聊天背景的模糊程度。0px 清晰，14～20px 柔雾感较强；音乐控件和文字不会变模糊。</p>
      </section>
      <section id="soundwalk-pet-settings" class="sw-pet-settings" aria-label="宠物图标设置" hidden>
        <div class="sw-pet-info"><strong>宠物头像衣橱</strong><span>收起和展开可独立选择 · 默认小黑猫 · 透明贴纸无方框</span></div>
        <div class="sw-pet-group-heading"><strong>收起时显示</strong><span>让喜欢的小动物守在聊天页旁边</span></div>
        <div class="sw-pet-choices sw-pet-closed-choices" role="group" aria-label="收起时的动物头像">
          ${CLOSED_PETS.map(pet => `<button class="sw-pet-choice" type="button" data-state="closed" data-pet="${pet}" aria-pressed="${String(pet === closedPet)}"><span class="sw-pet-thumb">${petIcons[pet]}</span><span>${PET_LABELS[pet]}</span></button>`).join('')}
        </div>
        <div class="sw-pet-group-heading"><strong>展开时显示</strong><span>保留原来的两只狗狗</span></div>
        <div class="sw-pet-choices sw-pet-open-choices" role="group" aria-label="展开时的小狗头像">
          <button class="sw-pet-choice" type="button" data-state="open" data-pet="golden" aria-pressed="true"><span class="sw-pet-thumb">${petIcons.golden}</span><span>金毛小狗</span></button>
          <button class="sw-pet-choice" type="button" data-state="open" data-pet="shepherd" aria-pressed="false"><span class="sw-pet-thumb">${petIcons.shepherd}</span><span>黑背德牧</span></button>
        </div>
      </section>
      <div class="sw-now">
        <button class="sw-scene" type="button" aria-label="放大专辑封面" title="点击放大专辑封面"><span class="sw-sun"></span><span class="sw-hill sw-hill-a"></span><span class="sw-hill sw-hill-b"></span><span class="sw-stars">✧</span><img class="sw-now-cover" alt="" hidden /></button>
        <div class="sw-now-title"><strong class="sw-title">歌单还是空的</strong><div class="sw-audio-meta"><span class="sw-artist">添加链接或本地音频开始播放</span><span class="sw-load-status" role="status" aria-live="polite" hidden><span class="sw-loading-spinner" aria-hidden="true"></span><span class="sw-load-text"></span></span></div><div class="sw-cover-controls"><button class="sw-cover-change" type="button">选择封面</button><button class="sw-cover-reset" type="button">恢复默认</button></div></div>
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
      <div class="sw-list-head"><strong>我的播放列表 <span class="sw-count">0</span></strong><div class="sw-tools"><button type="button" class="sw-text-button sw-add-link">+ 链接</button><button type="button" class="sw-text-button sw-add-file">+ 本地</button><button type="button" class="sw-text-button sw-add-batch" aria-expanded="false" title="批量导入音频直链">+ 批量</button><button type="button" class="sw-text-button sw-add-playlist" aria-expanded="false" title="识别酷狗分享歌单">+ 歌单</button></div></div>
      <div class="sw-search-row"><input class="sw-search" type="search" placeholder="搜索歌名 / 歌手" aria-label="搜索歌曲" maxlength="100" /><button class="sw-search-clear" type="button" aria-label="清除搜索" title="清除搜索">×</button></div>
      <details class="sw-advanced"><summary>⚙ 角色绑定与歌单设置</summary>
      <section class="sw-roles" aria-label="角色歌单设置">
        <div class="sw-role-line"><span class="sw-role-current">当前角色：识别中</span><label class="sw-role-toggle"><input class="sw-role-follow" type="checkbox" /> 随角色切换歌单</label></div>
        <div class="sw-role-auto-line"><label class="sw-role-auto-label"><input class="sw-role-autoplay" type="checkbox" /><span>进入角色自动播放</span></label><span class="sw-role-auto-hint">两个开关可任意顺序开启 · 绑定音乐按顺序播放</span></div>
        <div class="sw-role-tools"><label>歌单分组 <select class="sw-role-filter" aria-label="选择歌单分组"><option value="all">全部歌曲</option></select></label><button class="sw-text-button sw-role-manage" type="button" aria-expanded="false">管理角色绑定</button></div>
        <div class="sw-role-manager" hidden><p class="sw-role-hint">勾选歌曲，绑定到当前角色；取消勾选即解除绑定。一首歌可以绑定多个角色。</p><div class="sw-role-bind-items"></div></div>
        <div class="sw-role-tools"><label>网络音乐 <select class="sw-network-acceleration" aria-label="网络音乐智能加速"><option value="smart">智能加速</option><option value="off">关闭</option></select></label></div>
        <p class="sw-role-hint">默认关闭；开启后仅准备当前歌曲，可能提前读取整首。节省流量、弱网或网络信息不可用时保持保守。</p>
      </section>
      </details>
      <ol class="sw-list" aria-label="播放列表"></ol>
      <div class="sw-form" hidden>
        <label>歌名<input class="sw-name" type="text" maxlength="90" placeholder="例如：夜航"/></label>
        <label>歌手<input class="sw-singer" type="text" maxlength="70" placeholder="可选"/></label>
        <label>音频直链<input class="sw-url" type="url" placeholder="https://example.com/song.mp3"/></label>
        <div class="sw-form-actions"><button type="button" class="sw-cancel">取消</button><button type="button" class="sw-save">保存歌曲</button></div>
      </div>
      <section class="sw-external-form" aria-label="酷狗歌单分享链接识别" hidden>
        <label for="sw-external-link">识别酷狗音乐歌单分享链接</label>
        <textarea id="sw-external-link" class="sw-external-link" rows="3" maxlength="2200" spellcheck="false" placeholder="粘贴酷狗歌单分享链接或包含链接的分享文案"></textarea>
        <p class="sw-external-hint">点击识别时，公开歌单链接会发送给第三方 Playlist Out 解析服务。免登录可能只能预览前 10 首。不上传本地音乐、聊天或角色数据。</p>
        <div class="sw-form-actions"><button type="button" class="sw-external-cancel">关闭</button><button type="button" class="sw-external-fetch">识别歌单</button></div>
        <output class="sw-external-status" aria-live="polite"></output>
        <div class="sw-external-results" hidden>
          <strong class="sw-external-title"></strong>
          <p class="sw-external-summary"></p>
          <a class="sw-external-open" target="_blank" rel="noopener noreferrer" hidden>在酷狗打开歌单听歌 ↗</a>
          <p class="sw-external-hint">识别到的是曲目名称，不是音频。要在《听风》内部播放，请给想导入的歌曲填写合法音频直链。留空的歌曲不会导入。</p>
          <div class="sw-external-tracks"></div>
          <div class="sw-form-actions"><button type="button" class="sw-external-import">导入已填写的直链</button></div>
        </div>
      </section>
      <div class="sw-batch-form" hidden>
        <label for="sw-batch-text">批量导入音频直链（每行一首）</label>
        <textarea class="sw-batch-text" id="sw-batch-text" rows="6" maxlength="80000" spellcheck="false" placeholder="https://example.com/001.mp3&#10;歌名 | https://example.com/002.mp3&#10;歌名 | 歌手 | https://example.com/003.flac"></textarea>
        <p class="sw-batch-hint">支持纯直链、歌名 | 直链、歌名 | 歌手 | 直链，也支持 Tab 分隔。不支持酷狗等平台的歌单分享网页；只保存链接，不下载音乐。</p>
        <output class="sw-batch-preview" aria-live="polite">粘贴后预览导入数量</output>
        <div class="sw-form-actions"><button type="button" class="sw-batch-cancel">取消</button><button type="button" class="sw-batch-save" disabled>导入歌曲</button></div>
      </div>
      <details class="sw-storage"><summary>📦 备份、恢复与导入</summary><footer class="sw-footer"><div class="sw-file-tools"><button class="sw-backup-export" type="button">完整备份（含音乐、封面、壁纸）</button><button class="sw-backup-import" type="button">恢复完整备份</button><button class="sw-backup-check" type="button">校验已有备份</button><button class="sw-export" type="button">导出网络歌单</button><button class="sw-import" type="button">导入网络歌单</button></div><p class="sw-migration-hint">搬到另一个酒馆：在这里做「完整备份」，把 .swbackup 文件带过去，再点「恢复完整备份」。包含本地音乐、封面、壁纸、绑定、顺序和设置；恢复会替换目标歌单，请先备份目标数据。</p><p class="sw-migration-hint">网络歌单 JSON 只包含链接歌曲及其绑定和顺序，不含本地音频、图片或外观设置。角色头像文件名不同，需在目标酒馆重新绑定。</p><span>完整备份保存在你选择的本地文件中，不上传服务器</span></footer></details>
      <input class="sw-file-input" type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac" multiple hidden />
      <input class="sw-json-input" type="file" accept="application/json,.json" hidden />
      <input class="sw-backup-input" type="file" accept=".swbackup,application/octet-stream" hidden />
      <input class="sw-backup-check-input" type="file" accept=".swbackup,application/octet-stream" hidden />
      <input class="sw-cover-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden />
      <input class="sw-wallpaper-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden />
      </div>
      <p class="sw-notice" role="status" aria-live="polite"></p>
    </dialog>
    <dialog class="sw-cover-spotlight" aria-label="专辑封面欣赏">
      <button class="sw-spotlight-close" type="button" aria-label="关闭大封面">×</button>
      <div class="sw-spotlight-art"><img class="sw-spotlight-image" alt="大尺寸专辑封面" hidden /><div class="sw-spotlight-empty" hidden><span>♫</span><p>这首歌还没有专属封面</p><button type="button" class="sw-spotlight-choose">挑选一张图片</button></div></div>
      <div class="sw-spotlight-meta"><strong class="sw-spotlight-title"></strong><span class="sw-spotlight-artist"></span></div>
    </dialog>`;
  document.body.append(root);
  const $ = selector => root.querySelector(selector);
  const orb = $('.sw-orb');
  const panel = $('.sw-panel');
  // Keep host dialog themes and a previously cached stylesheet from making
  // the wallpaper's containing box scroll with its contents again.
  panel.style.setProperty('overflow', 'hidden', 'important');
  const list = $('.sw-list');
  const form = $('.sw-form');
  const seek = $('.sw-seek');
  const playButton = $('.sw-main-play');
  const fileInput = $('.sw-file-input');
  const jsonInput = $('.sw-json-input');
  const backupInput = $('.sw-backup-input');
  const backupCheckInput = $('.sw-backup-check-input');
  const spotlight = $('.sw-cover-spotlight');
  const coverInput = $('.sw-cover-input');
  const wallpaperInput = $('.sw-wallpaper-input');
  const roleFilterSelect = $('.sw-role-filter');
  const roleManager = $('.sw-role-manager');
  const roleManagerItems = $('.sw-role-bind-items');
  // Wallpaper Blob reuses the existing IndexedDB artwork store under a
  // reserved key. The tracks/covers schemas and saved songs remain untouched.
  const appearanceBox=$('.sw-appearance');
  const appearanceToggle=$('.sw-appearance-toggle');
  const opacitySlider=$('.sw-panel-opacity');
  const blurSlider=$('.sw-frost-blur');
  function applyAppearance() {
    panel.style.setProperty('--sw-panel-alpha', String(panelOpacity/100));
    panel.style.setProperty('--sw-frost-radius', `${frostBlur}px`);
    panel.style.setProperty('--sw-wallpaper-image', wallpaperUrl ? `url("${wallpaperUrl}")` : 'none');
    panel.style.setProperty('--sw-wallpaper-zoom', String(wallpaperView.zoom / 100));
    panel.style.setProperty('--sw-wallpaper-x', `${wallpaperView.x}%`);
    panel.style.setProperty('--sw-wallpaper-y', `${wallpaperView.y}%`);
    panel.classList.toggle('sw-wallpaper-on',Boolean(wallpaperUrl));
    opacitySlider.value=String(panelOpacity);
    $('.sw-opacity-value').textContent=`${panelOpacity}%`;
    blurSlider.value=String(frostBlur);
    $('.sw-blur-value').textContent=`${frostBlur}px`;
    $('.sw-wallpaper-select').disabled=wallpaperSaving;
    $('.sw-wallpaper-reset').disabled=wallpaperSaving || (!wallpaperUrl && panelOpacity===100 && frostBlur===0);
    $('.sw-wallpaper-view').disabled=wallpaperSaving || !wallpaperUrl;
    for (const [key, value] of Object.entries(wallpaperView)) {
      $(`.sw-wallpaper-${key}`).value=String(value);
      $(`.sw-wallpaper-${key}-value`).textContent=`${value}%`;
    }
  }
  for (const key of ['zoom', 'x', 'y']) {
    $(`.sw-wallpaper-${key}`).addEventListener('input', e => {
      wallpaperView=normalizeWallpaperView({...wallpaperView, [key]:Number(e.target.value)});
      applyAppearance();persist();
    });
  }
  $('.sw-wallpaper-center').addEventListener('click', () => {
    wallpaperView=normalizeWallpaperView();
    applyAppearance();persist();
  });
  appearanceToggle.addEventListener('click',()=>{
    appearanceBox.hidden=!appearanceBox.hidden;
    appearanceToggle.setAttribute('aria-expanded',String(!appearanceBox.hidden));
    requestAnimationFrame(positionPanelNearOrb);
  });
  opacitySlider.addEventListener('input',e=>{
    panelOpacity=Math.max(0,Math.min(100,Number(e.target.value)));
    applyAppearance();persist();
  });
  blurSlider.addEventListener('input',e=>{
    frostBlur=Math.max(0,Math.min(30,Number(e.target.value)));
    applyAppearance();persist();
  });
  $('.sw-frost-preset').addEventListener('click',()=>{
    panelOpacity=75;
    frostBlur=16;
    applyAppearance();persist();
    notice('柔雾效果已开启：75%背景 + 16px虚化，可继续细调');
  });
  $('.sw-wallpaper-select').addEventListener('click',()=>{
    wallpaperInput.value='';wallpaperInput.click();
  });
  wallpaperInput.addEventListener('change',async()=>{
    const file=wallpaperInput.files?.[0];
    wallpaperInput.value='';
    if (!file||wallpaperSaving) return;
    wallpaperSaving=true;applyAppearance();
    try {
      const blob=await makeWallpaperBlob(file);
      await coverAction('put',WALLPAPER_KEY,blob);
      wallpaperRevision++;
      const old=wallpaperUrl;
      wallpaperUrl=URL.createObjectURL(blob);
      wallpaperView=normalizeWallpaperView();
      applyAppearance();persist();
      if(old) URL.revokeObjectURL(old);
      if(!isPanelOpen()) showPanel(true);
      notice('壁纸已保存 ✨ 可调节缩放、位置、透明度与虚化');
    }catch(e){notice(e.message||'壁纸保存失败，可能本地空间不足');}
    finally{wallpaperSaving=false;applyAppearance();}
  });
  $('.sw-wallpaper-reset').addEventListener('click',async()=>{
    if(wallpaperSaving) return;
    wallpaperSaving=true;applyAppearance();
    try{
      await coverAction('delete',WALLPAPER_KEY);
      wallpaperRevision++;
      const old=wallpaperUrl;
      wallpaperUrl=null;panelOpacity=100;frostBlur=0;
      wallpaperView=normalizeWallpaperView();
      applyAppearance();persist();
      if(old) URL.revokeObjectURL(old);
      notice('已恢复默认墨绿色背景');
    }catch{notice('无法恢复默认背景，请检查存储权限');}
    finally{wallpaperSaving=false;applyAppearance();}
  });
  async function loadSavedWallpaper() {
    const rev=wallpaperRevision;
    try{
      const blob=await coverAction('get',WALLPAPER_KEY);
      if(rev!==wallpaperRevision) return;
      if(blob instanceof Blob) {
        const old=wallpaperUrl;
        wallpaperUrl=URL.createObjectURL(blob);
        if(old) URL.revokeObjectURL(old);
      }
      applyAppearance();
    }catch{/* Keep default background when storage unavailable. */}
  }
  applyAppearance();
  void loadSavedWallpaper();

  // Compact brand mascot (independent from the floating cat/dog button).
  const brandButton = $('.sw-brand-switch');
  const brandImage = $('.sw-brand-image');
  function updateBrandIcon() {
    brandImage.src = brandAssets[brandIcon];
    const current = brandIcon === 'cat' ? '小黑猫头' : '粉色猫爪';
    const next = brandIcon === 'cat' ? '粉色猫爪' : '小黑猫头';
    brandButton.setAttribute('aria-label', `当前是${current}，点击切换为${next}`);
    brandButton.title = `当前：${current} · 点击切换为${next}`;
  }
  brandButton.addEventListener('click', () => {
    brandIcon = brandIcon === 'cat' ? 'paw' : 'cat';
    updateBrandIcon();
    persist();
  });
  updateBrandIcon();
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
      showPanel(!isPanelOpen(), true);
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
        followCharacter, autoRolePlayback, networkAcceleration, manualFilter, characterLabels:settings.characterLabels, roleOrders:settings.roleOrders, openPet, closedPet, brandIcon, panelOpacity, frostBlur, wallpaperView}));
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
      const selected = button.dataset.pet === (button.dataset.state === 'closed' ? closedPet : openPet);
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('sw-selected', selected);
    });
  }
  function syncPanelState() {
    const open = isPanelOpen();
    $('.sw-orb-pet').innerHTML = open ? petIcons[openPet] : petIcons[closedPet];
    orb.classList.toggle('sw-open', open);
    orb.setAttribute('aria-expanded', String(open));
    orb.setAttribute('aria-label', open ? '关闭听风音乐播放器' : `打开听风音乐播放器，当前头像：${PET_LABELS[closedPet]}`);
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
  function updatePreload() {
    let hint = 'metadata';
    if (networkAcceleration && preloadExpected && isPanelOpen() && document.visibilityState === 'visible' &&
        navigator.onLine !== false && settings.tracks[currentIndex]?.kind === 'url') {
      try {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        // effectiveType describes estimated quality, not Wi-Fi. Unknown is conservative.
        if (connection?.saveData === false && connection.effectiveType === '4g' &&
            (!Number.isFinite(connection.rtt) || connection.rtt < 400) &&
            (!Number.isFinite(connection.downlink) || connection.downlink >= 1)) hint = 'auto';
      } catch { /* Missing/blocked network information keeps the original hint. */ }
    }
    // A hint only: no load(), second Audio, fetch, or persistent audio cache.
    if (audio.preload !== hint) audio.preload = hint;
  }
  $('.sw-network-acceleration').value = networkAcceleration ? 'smart' : 'off';
  $('.sw-network-acceleration').addEventListener('change', e => {
    networkAcceleration = e.target.value === 'smart';
    // Enabling is an explicit preparation for this selection only.
    preloadExpected = networkAcceleration;
    updatePreload();persist();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') preloadExpected = false;
    updatePreload();
  });
  window.addEventListener('online', updatePreload);
  window.addEventListener('offline', updatePreload);
  try {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    connection?.addEventListener?.('change', updatePreload);
  } catch { /* Optional capability; ordinary media playback still works. */ }
  function showPanel(show, prepare = false) {
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
    if (!show) preloadExpected = false;
    else if (prepare) preloadExpected = true;
    updatePreload();
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
    const playing = playIntent && !isPendingPlay && !networkLoading && !audio.paused && !audio.ended;
    playButton.innerHTML = playIntent ? icons.pause : icons.play;
    playButton.setAttribute('aria-label', networkLoading ? '取消加载' : playIntent ? '暂停' : '播放');
    playButton.setAttribute('aria-busy', String(networkLoading));
    playButton.title = networkLoading ? '正在加载，点击取消本次播放请求；取消后可再次点击重试' : playIntent ? '暂停' : '播放';
    orb.classList.toggle('sw-active', playing);
    $('.sw-mute').innerHTML = audio.volume === 0 ? icons.mute : icons.volume;
    $('.sw-volume').value = String(Math.round(audio.volume * 100));
    const labels = {all: '列表循环', one: '单曲循环', shuffle: '随机播放'};
    const roleSequence = Boolean(autoplayRoleKey());
    const effective = roleSequence ? 'all' : mode;
    $('.sw-mode').textContent = ({all:'↻', one:'①', shuffle:'⤨'})[effective];
    $('.sw-mode').setAttribute('aria-label', roleSequence ? '角色自动播放：按绑定歌单顺序循环' : `${labels[mode]}，点击切换播放模式`);
    $('.sw-mode').title = roleSequence ? '角色自动播放固定顺序播放，关闭自动开关即可更改播放模式' : labels[mode];
  }
  function hasCurrentMedia() {
    return Boolean(expectedSource && audio.src === expectedSource &&
      (!audio.currentSrc || audio.currentSrc === expectedSource));
  }
  function renderLoading() {
    const elapsed = networkLoading ? performance.now() - loadingSince : 0;
    const message = elapsed >= 20000 ? '加载较久，可取消后重试' : elapsed >= 15000
      ? '网络似乎不太稳定，仍在尝试加载' : elapsed >= 5000
      ? '网络较慢，正在努力加载…' : loadingForSeek ? '正在缓冲…' : '正在加载音乐…';
    const label = $('.sw-load-text');
    if (label.textContent !== message) label.textContent = message;
    $('.sw-load-status').hidden = !networkLoading;
    $('.sw-load-status').title = message;
    $('.sw-audio-meta').classList.toggle('sw-is-loading', networkLoading);
  }
  function clearNetworkLoading() {
    clearInterval(loadingTimer);loadingTimer = null;
    clearTimeout(seekCheckTimer);seekCheckTimer = null;seekSequence = -1;
    networkLoading = false;loadingForSeek = false;loadingSince = 0;
    renderLoading();
  }
  function confirmPlaying() {
    if (!playIntent || !hasCurrentMedia() || audio.paused || audio.ended || audio.seeking || audio.error) return;
    isPendingPlay = false;
    clearNetworkLoading();renderTransport();
  }
  function startNetworkLoading(forSeek = false) {
    if (!playIntent || settings.tracks[currentIndex]?.kind !== 'url' || !expectedSource || audio.src !== expectedSource) return;
    if (forSeek) loadingForSeek = true;
    if (!networkLoading) {
      networkLoading = true;loadingSince = performance.now();lastMediaTime = audio.currentTime;
      const seq = playSequence;
      loadingTimer = setInterval(() => {
        if (seq !== playSequence || !playIntent || audio.src !== expectedSource) {clearNetworkLoading();return;}
        // Real timeline progress also recovers browsers that omit playing.
        // canplay/metadata alone never count as successful playback.
        if (hasCurrentMedia() && !audio.paused && !audio.seeking && audio.readyState >= 3 && audio.currentTime > lastMediaTime) confirmPlaying();
        lastMediaTime = audio.currentTime;
        if (networkLoading) renderLoading();
      }, 1000);
    }
    renderLoading();renderTransport();
  }
  function inspectSeekLoading() {
    if (!playIntent || !hasCurrentMedia() || settings.tracks[currentIndex]?.kind !== 'url' || audio.ended || audio.error || audio.readyState >= 3) return;
    // Cached jumps can briefly lower readyState while the decoder seeks.
    // A completed seek with no future data really does need to wait.
    if (audio.seeking) {
      const buffered = audio.buffered, time = audio.currentTime;
      for (let i = 0; i < buffered.length; i++) {
        if (time >= buffered.start(i) && time < buffered.end(i)) return;
      }
    }
    startNetworkLoading(true);
  }
  function syncSeekLoading() {
    lastMediaTime = audio.currentTime;
    clearTimeout(seekCheckTimer);seekCheckTimer = null;
    if (!playIntent || !hasCurrentMedia() || settings.tracks[currentIndex]?.kind !== 'url') return;
    const seq = playSequence, request = playRequest;
    seekSequence = seq;
    inspectSeekLoading();
    // Some browsers update readiness after currentTime and omit waiting.
    // This only checks feedback; it never starts or resumes playback.
    seekCheckTimer = setTimeout(() => {
      seekCheckTimer = null;
      if (seq === playSequence && request === playRequest) inspectSeekLoading();
    }, 150);
  }
  function pausePlayback() {
    ++playRequest;playIntent = false;isPendingPlay = false;
    preloadExpected = false;updatePreload();
    clearNetworkLoading();audio.pause();renderTransport();
  }
  function playbackErrorMessage(error) {
    if (error?.name === 'NotAllowedError') return '浏览器限制了自动播放，请手动点击播放';
    if (error?.name === 'AbortError' || audio.error?.code === 1) return '播放请求已中断，请再次点击播放';
    if (error?.name === 'NetworkError' || audio.error?.code === 2) return '音乐获取失败，请检查网络或链接是否失效';
    return '无法读取这条音频，请检查音频格式、网络和链接有效性';
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
  // Auto mode scopes playback to this card's music, even if ordinary
  // "follow role" was off. Without bound songs, show all tracks for
  // deliberate manual playback, but never start any of them automatically.
  function autoplayRoleKey() {
    if (!autoRolePlayback || !currentCharacter) return null;
    const key = currentCharacter.key;
    return settings.tracks.some(track => (track.bindings || []).includes(key)) ? key : null;
  }
  function roleFilterKey() {
    if (autoRolePlayback) return autoplayRoleKey() || 'all';
    return followCharacter ? (currentCharacter ? currentCharacter.key : 'all') : manualFilter;
  }
  function visibleIndices() {
    const key = roleFilterKey();
    const indices = settings.tracks.flatMap((track,index) => {
      const bindings = track.bindings || [];
      const visible = key === 'all' || (key === 'unassigned' ? !bindings.length : bindings.includes(key));
      return visible ? [index] : [];
    });
    const order = key.startsWith('avatar:') ? settings.roleOrders[key] : null;
    if (!order?.length) return indices;
    const positions = new Map(order.map((id,i) => [id,i]));
    return indices.sort((a,b) => (positions.get(settings.tracks[a].id) ?? 999999) -
      (positions.get(settings.tracks[b].id) ?? 999999));
  }
  function moveTrackInList(id, direction) {
    const visible = visibleIndices();
    const position = visible.findIndex(i => settings.tracks[i].id === id);
    const destination = position + direction;
    if (position < 0 || destination < 0 || destination >= visible.length) return;
    const roleKey = roleFilterKey();
    if (roleKey.startsWith('avatar:')) {
      const reordered = visible.map(i => settings.tracks[i].id);
      [reordered[position],reordered[destination]] = [reordered[destination],reordered[position]];
      settings.roleOrders[roleKey] = reordered;
    } else {
      const activeId = settings.tracks[currentIndex]?.id;
      const a = visible[position], b = visible[destination];
      [settings.tracks[a],settings.tracks[b]] = [settings.tracks[b],settings.tracks[a]];
      currentIndex = settings.tracks.findIndex(t => t.id === activeId);
    }
    renderList();persist();
  }
  function updateRoleView() {
    const status = $('.sw-role-current');
    status.textContent = currentCharacter ? `当前角色：${currentCharacter.name}` : '当前：无单人角色（群聊可手动选分组）';
    status.title = status.textContent;
    $('.sw-role-follow').checked = followCharacter;
    // Both switches can now be toggled independently and in any order.
    $('.sw-role-follow').disabled = false;
    $('.sw-role-autoplay').checked = autoRolePlayback;
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
    roleFilterSelect.disabled = followCharacter || autoRolePlayback;
    roleFilterSelect.title = autoRolePlayback ? '自动播放模式下按当前角色选择歌曲' :
      (followCharacter ? '关闭随角色切换后可自由查看分组' : '选择要查看的歌单分组');
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
    const oldAutoKey = autoplayRoleKey();
    const old = track.bindings || [];
    track.bindings = bound ? [...new Set([...old,currentCharacter.key])] : old.filter(k => k !== currentCharacter.key);
    settings.characterLabels[currentCharacter.key] = currentCharacter.name;
    const nextAutoKey = autoplayRoleKey();
    if (autoRolePlayback && !oldAutoKey && nextAutoKey) {
      void selectTrack(visibleIndices()[0], true);
    } else if (autoRolePlayback && oldAutoKey && !nextAutoKey) {
      void selectTrack(-1, false);
    } else refreshFilter();
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
    const previousKey = currentCharacter?.key || null;
    lastRoleSignature = signature;
    currentCharacter = role;
    if (role) settings.characterLabels[role.key] = role.name;
    if (autoRolePlayback) {
      // Only a *real card change* restarts its playlist, not a role rename,
      // repeated APP_READY event or timer-based recheck.
      if (previousKey !== (role?.key || null)) {
        const indices = visibleIndices();
        if (autoplayRoleKey() && indices.length) void selectTrack(indices[0], true);
        else void selectTrack(-1, false);
      } else {renderList();persist();}
    } else if (followCharacter) refreshFilter();
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
  function selectedTrack() {
    return visibleIndices().includes(currentIndex) ? settings.tracks[currentIndex] : null;
  }
  function refreshSpotlight() {
    if (!spotlight.open) return;
    const track = selectedTrack();
    if (!track) {spotlight.close();return;}
    $('.sw-spotlight-title').textContent = track.title;
    $('.sw-spotlight-artist').textContent = track.artist;
    const url = coverUrls.get(track.id);
    const image = $('.sw-spotlight-image');
    image.hidden = !url;
    if (url) image.src = url;
    else image.removeAttribute('src');
    $('.sw-spotlight-empty').hidden = !!url;
  }
  $('.sw-scene').addEventListener('click', () => {
    if (!selectedTrack()) return notice('请先选择一首歌曲');
    if (typeof spotlight.showModal === 'function' && !spotlight.open) spotlight.showModal();
    else if (!spotlight.open) spotlight.show();
    refreshSpotlight();
  });
  $('.sw-spotlight-close').addEventListener('click', () => spotlight.close());
  $('.sw-spotlight-choose').addEventListener('click', () => {
    const id = selectedTrack()?.id;
    spotlight.close();
    if (id) chooseCover(id);
  });
  spotlight.addEventListener('click', e => {if (e.target === spotlight) spotlight.close();});
  function showTrackCover(id) {
    const coverUrl = id ? coverUrls.get(id) : null;
    const now = selectedTrack();
    if (now?.id === id || !id) {
      const image = $('.sw-now-cover');
      const visibleUrl = now ? coverUrls.get(now.id) : null;
      if (visibleUrl) image.src = visibleUrl;
      else image.removeAttribute('src');
      image.hidden = !visibleUrl;
      $('.sw-cover-reset').disabled = !visibleUrl;
      $('.sw-cover-change').disabled = !now;
    }
    if (spotlight.open) refreshSpotlight();
    root.querySelectorAll('.sw-track-cover').forEach(button => {
      if (button.dataset.coverId !== id) return;
      const img = button.querySelector('img');
      if (coverUrl) img.src = coverUrl;
      else img.removeAttribute('src');
      img.hidden = !coverUrl;
      button.querySelector('span').hidden = !!coverUrl;
    });
  }
  function processCoverQueue() {
    // Keep DB reads small even when the user has the maximum 300-song playlist.
    while (activeCoverReads < 3 && coverQueue.length) {
      const id = coverQueue.shift();
      const revision = coverRevision.get(id) || 0;
      activeCoverReads += 1;
      void (async () => {
        try {
          const blob = await coverAction('get', id);
          if (revision !== (coverRevision.get(id) || 0) || !settings.tracks.some(t => t.id === id)) return;
          coverUrls.set(id, blob instanceof Blob ? URL.createObjectURL(blob) : null);
          showTrackCover(id);
        } catch { /* A failed cover read must never stop song playback. */ }
        finally {
          coverPending.delete(id);
          activeCoverReads -= 1;
          processCoverQueue();
        }
      })();
    }
  }
  function getSavedCover(id) {
    if (!id || coverUrls.has(id) || coverPending.has(id)) return;
    coverPending.add(id);
    coverQueue.push(id);
    processCoverQueue();
  }
  function chooseCover(id) {
    if (!id || !settings.tracks.some(t => t.id === id)) return;
    coverTargetId = id;
    coverInput.value = '';
    coverInput.click();
  }
  async function resetCover(id) {
    if (!id || !settings.tracks.some(t => t.id === id)) return;
    if (coverBusy.has(id)) { notice('请等封面保存完成'); return; }
    coverBusy.add(id);
    try {
      await coverAction('delete', id);
      coverRevision.set(id, (coverRevision.get(id) || 0) + 1);
      const oldUrl = coverUrls.get(id);
      coverUrls.set(id, null);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      showTrackCover(id);
      notice('已恢复默认封面');
    } catch { notice('封面移除失败，请检查浏览器存储权限'); }
    finally { coverBusy.delete(id); }
  }
  coverInput.addEventListener('change', async () => {
    const file = coverInput.files?.[0];
    const id = coverTargetId;
    coverInput.value = '';
    coverTargetId = null;
    if (!file || !id || !settings.tracks.some(t => t.id === id)) return;
    if (coverBusy.has(id)) { notice('这首歌的封面正在处理，请稍后'); return; }
    coverBusy.add(id);
    try {
      const blob = await makeCoverBlob(file);
      if (!settings.tracks.some(t => t.id === id)) return;
      await coverAction('put', id, blob);
      if (!settings.tracks.some(t => t.id === id)) {
        await coverAction('delete', id);
        return;
      }
      coverRevision.set(id, (coverRevision.get(id) || 0) + 1);
      const oldUrl = coverUrls.get(id);
      coverUrls.set(id, URL.createObjectURL(blob));
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      showTrackCover(id);
      // Some mobile file pickers dismiss a non-modal dialog when returning.
      // Reopen only after a successful image selection so the result is visible.
      if (!isPanelOpen()) showPanel(true);
      notice('这首歌的专属封面已保存 ✨');
    } catch (error) { notice(error.message || '保存封面失败：可能存储空间不足'); }
    finally { coverBusy.delete(id); }
  });
  $('.sw-cover-change').addEventListener('click', () => chooseCover(selectedTrack()?.id));
  $('.sw-cover-reset').addEventListener('click', () => void resetCover(selectedTrack()?.id));
  function renderNow() {
    const visible = visibleIndices();
    const track = visible.includes(currentIndex) ? settings.tracks[currentIndex] : null;
    $('.sw-title').textContent = track ? track.title : (settings.tracks.length ? '当前分组暂无歌曲' : '歌单还是空的');
    $('.sw-artist').textContent = track ? `${track.artist} · ${track.kind === 'file' ? '本地音频' : '网络音频'}` : '添加链接或本地音频开始播放';
    $('.sw-count').textContent = `${visible.length}/${settings.tracks.length}`;
    showTrackCover(track?.id || null);
    if (track) getSavedCover(track.id);
    if (spotlight.open) refreshSpotlight();
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
    const search = searchQuery.trim().toLocaleLowerCase();
    const allVisible = visibleIndices();
    const matched = search ? allVisible.filter(index => {
      const track = settings.tracks[index];
      return (track.title + ' ' + track.artist).toLocaleLowerCase().includes(search);
    }) : allVisible;
    $('.sw-search-clear').hidden = !searchQuery;
    // Load the now-playing artwork ahead of any offscreen song thumbnails.
    getSavedCover(selectedTrack()?.id);
    matched.forEach(index => {
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
      select.addEventListener('click', () => selectTrack(index, true, true));
      const coverBtn = document.createElement('button');
      coverBtn.type = 'button';
      coverBtn.className = 'sw-track-cover';
      coverBtn.dataset.coverId = track.id;
      coverBtn.title = `选择「${track.title}」的本地专辑封面`;
      coverBtn.setAttribute('aria-label', coverBtn.title);
      const coverImg = document.createElement('img');
      coverImg.alt = '';
      coverImg.hidden = true;
      const defaultCover = document.createElement('span');
      defaultCover.textContent = '♫';
      coverBtn.append(coverImg, defaultCover);
      coverBtn.addEventListener('click', () => chooseCover(track.id));
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
      actions.append(actionBtn('↑', `上移 ${track.title}`, () => moveTrackInList(track.id, -1)));
      actions.append(actionBtn('↓', `下移 ${track.title}`, () => moveTrackInList(track.id, 1)));
      actions.append(actionBtn('×', `删除 ${track.title}`, () => deleteTrack(track.id)));
      item.append(coverBtn, select, actions);
      list.append(item);
      showTrackCover(track.id);
      getSavedCover(track.id);
    });
    if (!matched.length) {
      const empty = document.createElement('li');
      empty.className = 'sw-empty';
      empty.textContent = search ? '没找到匹配的歌曲，试试别的关键词' : !settings.tracks.length
        ? '还没有歌曲。你可以添加音频直链或手机上的音频文件。'
        : '这个分组还没有歌曲。展开「角色绑定与歌单设置」添加绑定。';
      list.append(empty);
    }
    renderNow();
    if (search) $('.sw-count').textContent = `${matched.length}/${allVisible.length} · 总${settings.tracks.length}`;
    updateRoleView();
  }
  $('.sw-search').addEventListener('input', e => {searchQuery = e.target.value; renderList();});
  $('.sw-search-clear').addEventListener('click', () => {$('.sw-search').value = '';searchQuery = '';renderList();$('.sw-search').focus();});
  function resetProgress() {
    seek.value = '0';
    $('.sw-elapsed').textContent = '0:00';
    $('.sw-duration').textContent = '0:00';
  }
  async function selectTrack(index, shouldPlay = false, prepare = false) {
    const nextTrack = visibleIndices().includes(index) ? settings.tracks[index] : null;
    const seq = ++playSequence;
    const request = ++playRequest;
    playIntent = Boolean(nextTrack && shouldPlay);
    isPendingPlay = playIntent;expectedSource = '';
    clearNetworkLoading();lastMediaTime = 0;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    currentIndex = index;
    preloadExpected = Boolean(prepare && nextTrack?.kind === 'url');
    updatePreload();
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
      expectedSource = audio.src;
      audio.load();
      if (shouldPlay && playIntent && request === playRequest) await play();
    } catch (err) {
      if (seq === playSequence && request === playRequest) {
        pausePlayback();notice(err.message || '无法读取歌曲');
      }
    }
  }
  async function play(prepare = false) {
    const visible = visibleIndices();
    if (!visible.length) { notice('当前分组没有歌曲，请先绑定或切换分组'); return; }
    if (!visible.includes(currentIndex)) {await selectTrack(visible[0], true, prepare); return;}
    if (!audio.src || audio.error) { await selectTrack(currentIndex, true, prepare); return; }
    if (prepare) preloadExpected = true;
    updatePreload();
    const seq = playSequence, request = ++playRequest;
    playIntent = true;isPendingPlay = true;
    startNetworkLoading();renderTransport();
    try {
      // Invoke immediately in the user gesture, with no readiness gate or timer.
      const pending = audio.play();
      if (pending?.then) await pending;
      if (seq !== playSequence || request !== playRequest || !playIntent) return;
      isPendingPlay = false;
      if (pending?.then) confirmPlaying();
      renderTransport();
    } catch (error) {
      // A canceled/replaced request must not pause or report errors for its successor.
      if (seq !== playSequence || request !== playRequest) return;
      const message = playbackErrorMessage(error);
      pausePlayback();notice(message);
    }
  }
  function nextIndex(direction) {
    const indices = visibleIndices();
    if (!indices.length) return -1;
    if (mode === 'shuffle' && !autoplayRoleKey() && indices.length > 1) {
      const candidates = indices.filter(index => index !== currentIndex);
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    const index = indices.indexOf(currentIndex);
    return indices[(index + direction + indices.length) % indices.length];
  }
  function advance(direction, fromEnded = false) {
    if (!visibleIndices().length) return;
    if (fromEnded && mode === 'one' && !autoplayRoleKey()) {
      audio.currentTime = 0;
      void play();
      return;
    }
    void selectTrack(nextIndex(direction), true, !fromEnded);
  }
  function showForm(track = null) {
    closeBatchForm();
    closeExternalForm();
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
    const target = settings.tracks[index];
    if (!window.confirm(`确定删除「${target.title}」吗？\n本地音乐和封面也会从此浏览器删除。建议先做完整备份。`)) return;
    const [removed] = settings.tracks.splice(index, 1);
    if (removed.kind === 'file') {
      try { await fileAction('delete', removed.id); }
      catch { notice('歌曲已移出列表，但本地存储清理失败'); }
    }
    // Deleting a song also deletes only that song's cover, not any other media.
    coverRevision.set(id, (coverRevision.get(id) || 0) + 1);
    const oldCover = coverUrls.get(id);
    coverUrls.delete(id);
    if (oldCover) URL.revokeObjectURL(oldCover);
    try { await coverAction('delete', id); }
    catch { notice('歌曲已移除，但封面缓存清理失败'); }
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
      if (idx === currentIndex) void selectTrack(idx, false, true);
    } else {
      const wasEmpty = settings.tracks.length === 0;
      settings.tracks.push({ id: uid(), kind: 'url', title, artist, src, bindings: followCharacter && currentCharacter ? [currentCharacter.key] : [] });
      if (wasEmpty) void selectTrack(0, false, true);
    }
    hideForm(); refreshFilter(); notice('歌曲已保存');
  });

  // v1.3.13: paste multiple audio URLs without downloading audio or touching backups.
  const batchForm = $('.sw-batch-form');
  const batchText = $('.sw-batch-text');
  const batchButton = $('.sw-add-batch');
  const batchPreview = $('.sw-batch-preview');
  const batchSave = $('.sw-batch-save');
  function closeBatchForm() {
    batchForm.hidden = true;
    batchButton.setAttribute('aria-expanded', 'false');
  }
  function suggestedBatchTitle(src, row) {
    try {
      const basename = decodeURIComponent(new URL(src).pathname.split('/').pop() || '');
      if (/\.(?:mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(basename)) {
        return cleanText(basename.replace(/\.(?:mp3|m4a|aac|wav|flac|ogg|opus)$/i, '')) || '网络歌曲 ' + row;
      }
    } catch { /* Fall back when the URL filename cannot be decoded. */ }
    return '网络歌曲 ' + row;
  }
  function inspectBatchInput() {
    const seen = new Set(settings.tracks.filter(track => track.kind === 'url').map(track => track.src));
    const entries = [];
    const lines = batchText.value.split(/\r?\n/);
    let total = 0, invalid = 0, duplicates = 0, exceeded = 0, tooMany = 0;
    for (const source of lines) {
      const line = source.trim();
      if (!line) continue;
      total++;
      if (total > 1000) { tooMany++; continue; }
      // Preserve pipes contained within a stand-alone URL.
      const parts = /^https?:\/\/\S+$/i.test(line) ? [line]
        : line.split(/\s*\|\s*|\t+/).map(part => part.trim()).filter(Boolean);
      if (!parts.length || parts.length > 3) { invalid++; continue; }
      const src = safeUrl(parts[parts.length - 1]);
      if (!src || (parts.length > 1 && !cleanText(parts[0]))) { invalid++; continue; }
      if (seen.has(src)) { duplicates++; continue; }
      seen.add(src);
      if (settings.tracks.length + entries.length >= MAX_TRACKS) { exceeded++; continue; }
      const title = parts.length > 1 ? cleanText(parts[0]) : suggestedBatchTitle(src, total);
      const artist = parts.length === 3 ? cleanText(parts[1], 70) || '未知歌手' : '未知歌手';
      entries.push({ id:uid(), kind:'url', title, artist, src,
        bindings:followCharacter && currentCharacter ? [currentCharacter.key] : [] });
    }
    return { entries, total, invalid, duplicates, exceeded, tooMany };
  }
  function updateBatchPreview() {
    const result = inspectBatchInput();
    batchSave.disabled = !result.entries.length;
    batchPreview.textContent = !result.total
      ? '粘贴后预览导入数量'
      : '可导入 ' + result.entries.length + ' 首 · 重复 ' + result.duplicates +
        ' 首 · 无效 ' + result.invalid + ' 行 · 容量不足 ' + result.exceeded +
        ' 首' + (result.tooMany ? ' · 超出单次1000行限制 ' + result.tooMany + ' 行' : '');
  }
  batchButton.addEventListener('click', () => {
    if (!batchForm.hidden) { closeBatchForm(); return; }
    hideForm();
    closeExternalForm();
    batchForm.hidden = false;
    batchButton.setAttribute('aria-expanded', 'true');
    updateBatchPreview();
    requestAnimationFrame(positionPanelNearOrb);
    batchText.focus();
  });
  $('.sw-batch-cancel').addEventListener('click', closeBatchForm);
  batchText.addEventListener('input', updateBatchPreview);
  batchSave.addEventListener('click', () => {
    const result = inspectBatchInput();
    if (!result.entries.length) { notice('没有可导入的直链，请检查格式或歌单剩余容量'); return; }
    const wasEmpty = !settings.tracks.length;
    settings.tracks.push(...result.entries);
    batchText.value = '';
    closeBatchForm();
    if (wasEmpty) void selectTrack(0, false, false);
    else refreshFilter();
    notice('已导入 ' + result.entries.length + ' 首网络歌曲；跳过重复 ' +
      result.duplicates + ' 首、无效 ' + result.invalid + ' 行、容量不足 ' +
      result.exceeded + ' 首' + (result.tooMany ? '、超过行数限制 ' + result.tooMany + ' 行' : ''));
  });

  // v1.3.14: optional public playlist metadata lookup; never treats platform
  // share URLs or catalogue IDs as playable media. No login or account tokens.
  const externalForm = $('.sw-external-form');
  const externalButton = $('.sw-add-playlist');
  const externalLink = $('.sw-external-link');
  const externalFetch = $('.sw-external-fetch');
  const externalStatus = $('.sw-external-status');
  const externalResults = $('.sw-external-results');
  const externalTracks = $('.sw-external-tracks');
  const externalImport = $('.sw-external-import');
  const externalOpen = $('.sw-external-open');
  let externalAbort = null;
  let externalRequestId = 0;
  let externalPlaylist = null;
  function closeExternalForm() {
    externalRequestId++;
    externalAbort?.abort();
    externalAbort = null;
    externalForm.hidden = true;
    externalButton.setAttribute('aria-expanded', 'false');
  }
  function extractKugouPlaylistUrl(text) {
    if (typeof text !== 'string' || text.length > 2200) return '';
    const match = text.match(/https?:\/\/[^\s\u3000，,）)}<>《》"']+/i);
    if (!match) return '';
    try {
      const link = new URL(match[0]);
      if (link.protocol !== 'https:' && link.protocol !== 'http:') return '';
      if (link.hostname !== 'kugou.com' && !link.hostname.endsWith('.kugou.com')) return '';
      if (link.username || link.password) return '';
      if (link.href.length > 1700) return '';
      return link.href;
    } catch { return ''; }
  }
  function normalizeExternalPlaylist(body) {
    const playlist = body?.data?.kind === 'playlist' ? body.data.result : body?.data;
    if (body?.success !== true || !playlist || !Array.isArray(playlist.tracks)) return null;
    const tracks = playlist.tracks.slice(0, MAX_TRACKS).map((song,index) => ({
      title: cleanText(song?.title || song?.name || '未命名歌曲 ' + (index + 1)),
      artist: cleanText(song?.artist || song?.author || '未知歌手',70)
    })).filter(song => song.title);
    return tracks.length ? {
      title: cleanText(playlist.name || playlist.title || '酷狗歌单'),
      creator: cleanText(playlist.creator || '',70),
      total: Number.isInteger(playlist.trackCount) ? playlist.trackCount : tracks.length,
      tracks
    } : null;
  }
  function renderExternalPlaylist(data,url) {
    externalTracks.replaceChildren();
    externalPlaylist = data;
    $('.sw-external-title').textContent = data.title;
    $('.sw-external-summary').textContent =
      (data.creator ? '创建者：' + data.creator + ' · ' : '') +
      '共 ' + data.total + ' 首，当前读取到 ' + data.tracks.length + ' 首' +
      (data.total > data.tracks.length ? '（公开预览可能不完整）' : '') + '。';
    externalOpen.href = url;
    externalOpen.hidden = false;
    data.tracks.forEach((track,index) => {
      const row = document.createElement('div');
      row.className = 'sw-external-row';
      const info = document.createElement('span');
      info.textContent = (index + 1) + '. ' + track.title + ' · ' + track.artist;
      info.title = info.textContent;
      const input = document.createElement('input');
      input.type = 'url';
      input.className = 'sw-external-audio';
      input.placeholder = '该曲音频直链（可选）';
      input.setAttribute('aria-label',track.title + ' 音频直链');
      row.append(info,input);
      externalTracks.append(row);
    });
    externalResults.hidden = false;
    externalStatus.textContent = '歌单识别成功；音源需要自行补充。';
  }
  externalButton.addEventListener('click', () => {
    if (!externalForm.hidden) {closeExternalForm();return;}
    hideForm();
    closeBatchForm();
    externalForm.hidden = false;
    externalButton.setAttribute('aria-expanded','true');
    externalStatus.textContent = '';
    requestAnimationFrame(positionPanelNearOrb);
    externalLink.focus();
  });
  $('.sw-external-cancel').addEventListener('click',closeExternalForm);
  externalFetch.addEventListener('click',async () => {
    const url = extractKugouPlaylistUrl(externalLink.value);
    if (!url) { externalStatus.textContent = '请粘贴酷狗音乐公开歌单的完整分享链接。'; return; }
    externalRequestId++;
    const requestId = externalRequestId;
    externalAbort?.abort();
    externalAbort = new AbortController();
    const controller = externalAbort;
    externalFetch.disabled = true;
    externalResults.hidden = true;
    externalPlaylist = null;
    externalStatus.textContent = '正在识别公开歌单…';
    const timeout = setTimeout(() => controller.abort(),22000);
    try {
      const endpoint = new URL('https://playlistout-api.lengxiqwq.com/api/v1/resolve');
      endpoint.searchParams.set('q',url);
      endpoint.searchParams.set('type','playlist');
      endpoint.searchParams.set('platform','kugou');
      const response = await fetch(endpoint.href,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}});
      if (requestId !== externalRequestId) return;
      if (!response.ok) {
        externalStatus.textContent = response.status === 429
          ? '请求过于频繁，请稍后重试。'
          : '歌单识别暂时失败（HTTP ' + response.status + '），请稍后再试。';
        return;
      }
      const data = normalizeExternalPlaylist(await response.json());
      if (requestId !== externalRequestId) return;
      if (!data) {
        externalStatus.textContent = '未能读取歌单歌曲，可能是歌单不公开、授权受限或服务暂时不可用。';
        return;
      }
      renderExternalPlaylist(data,url);
    } catch(e) {
      if (requestId !== externalRequestId) return;
      externalStatus.textContent = e?.name === 'AbortError'
        ? '识别超时，可以稍后重试。'
        : '请求失败。可能是网络、浏览器跨域限制或解析服务不可访问。';
    } finally {
      clearTimeout(timeout);
      if(requestId === externalRequestId){ externalFetch.disabled = false; externalAbort = null; }
    }
  });
  externalImport.addEventListener('click', () => {
    if (!externalPlaylist) return;
    const inputs = [...externalTracks.querySelectorAll('.sw-external-audio')];
    const existing = new Set(settings.tracks.filter(t => t.kind === 'url').map(t => t.src));
    let added=0, skipped=0, invalid=0;
    const wasEmpty = settings.tracks.length === 0;
    for(let i=0;i<inputs.length;i++) {
      const raw = inputs[i].value.trim();
      if (!raw) continue;
      const src = safeUrl(raw);
      if (!src) { invalid++; continue; }
      if(existing.has(src)) { skipped++; continue; }
      if(settings.tracks.length >= MAX_TRACKS) {skipped++; continue;}
      const song = externalPlaylist.tracks[i];
      settings.tracks.push({id:uid(),kind:'url',title:song.title,artist:song.artist,src,
        bindings:followCharacter && currentCharacter ? [currentCharacter.key] : []});
      existing.add(src);added++;
      inputs[i].value = '';
    }
    if (added) {
      if (wasEmpty) void selectTrack(0,false,false);
      else refreshFilter();
    }
    const message = '已导入 ' + added + ' 首可播放直链；跳过重复或容量不足 ' + skipped +
      ' 首、无效链接 ' + invalid + ' 条。';
    externalStatus.textContent = message;
    notice(message);
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
  // Lossless custom binary bundle: short UTF-8 header, metadata JSON and raw
  // blobs. Unlike JSON+base64, large imported audio is not expanded by 33%.

  // SWBK1 keeps the same 18-byte header. v3 adds CRC32 per media Blob and
  // a CRC32 for the metadata. v1/v2 backups remain readable (structure-only).
  async function exportFullBackup() {
    if (!window.confirm('完整备份包含本地音频、封面和壁纸，文件可能很大。确认生成校验版备份？')) return;
    $('.sw-backup-export').disabled=true;
    try {
      notice('正在检查本地音乐与图片，请勿关闭页面…');
      const entries=[],parts=[];
      let count=0;
      async function addChecked(kind,id,blob,label,maxSize) {
        if (!(blob instanceof Blob) || !blob.size || blob.size>maxSize)
          throw new Error('「'+label+'」数据缺失、为空或超过大小限制，备份已取消');
        const crc32=await checksumBlob(blob);
        entries.push({id,kind,size:blob.size,type:blob.type,crc32});
        parts.push(blob);
        if (++count % 8===0) notice('备份校验中：已核对 '+count+' 个音频或图片文件…');
      }
      for(const track of settings.tracks) {
        if(track.kind==='file') {
          const song=await fileAction('get',track.id);
          await addChecked('audio',track.id,song,track.title,MAX_FILE_SIZE);
        }
        const cover=await coverAction('get',track.id);
        if(cover!==undefined && cover!==null)
          await addChecked('cover',track.id,cover,track.title+' 的封面',COVER_MAX_BYTES);
      }
      const wallpaper=await coverAction('get',WALLPAPER_KEY);
      if(wallpaper!==undefined && wallpaper!==null)
        await addChecked('wallpaper',WALLPAPER_KEY,wallpaper,'播放器壁纸',WALLPAPER_MAX_BYTES);
      const unsigned={format:'soundwalk-complete',version:3,createdAt:new Date().toISOString(),
        settings:{tracks:settings.tracks,characterLabels:settings.characterLabels,roleOrders:settings.roleOrders,
          mode,volume:audio.volume,followCharacter,autoRolePlayback,networkAcceleration,manualFilter,openPet,closedPet,brandIcon,orbPosition,panelOpacity,frostBlur,wallpaperView},entries};
      const metadataCrc32=checksumHex(new TextEncoder().encode(JSON.stringify(unsigned)));
      const meta={...unsigned,metadataCrc32};
      const payload=new TextEncoder().encode(JSON.stringify(meta));
      if(payload.length>5000000) throw new Error('备份信息过大，请减少歌曲数量');
      const prefix='SWBK1\n'+String(payload.length).padStart(12,'0');
      const archive=new Blob([prefix,payload,...parts],{type:'application/octet-stream'});
      if(archive.size!==18+payload.length+entries.reduce((sum,e)=>sum+e.size,0))
        throw new Error('生成备份时大小校验失败，请重试');
      const url=URL.createObjectURL(archive);
      const link=document.createElement('a');
      link.href=url;link.download='听风完整备份-'+new Date().toISOString().slice(0,10)+'.swbackup';
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),120000);
      notice('完整备份校验成功：'+settings.tracks.length+' 首歌曲、'+entries.length+' 个本地媒体文件已打包 ✓');
    }catch(e){notice(e.message||'完整备份失败，现有歌曲未更改');}
    finally{$('.sw-backup-export').disabled=false;}
  }
  async function verifyFullBackup(file) {
    if(!(file instanceof Blob)||file.size<20) throw new Error('备份文件过小或无法读取');
    const header=new TextDecoder().decode(await file.slice(0,18).arrayBuffer());
    if(!/^SWBK1\n[0-9]{12}$/.test(header)) throw new Error('不是有效的听风完整备份文件');
    const length=Number(header.slice(6));
    if(!Number.isSafeInteger(length)||length<2||length>5000000||file.size<18+length)
      throw new Error('备份元数据缺失或文件已截断');
    let meta;
    try{meta=JSON.parse(new TextDecoder().decode(await file.slice(18,18+length).arrayBuffer()));}
    catch{throw new Error('备份信息损坏，无法解析');}
    if(meta?.format!=='soundwalk-complete'||![1,2,3].includes(meta.version)||
        !Array.isArray(meta.settings?.tracks)||!Array.isArray(meta.entries))
      throw new Error('备份格式不受支持');
    if(meta.version===3){
      const {metadataCrc32,...unsigned}=meta;
      if(typeof metadataCrc32!=='string'|| !/^[0-9a-f]{8}$/.test(metadataCrc32)||
          checksumHex(new TextEncoder().encode(JSON.stringify(unsigned)))!==metadataCrc32)
        throw new Error('备份目录校验失败：歌单或文件信息可能已损坏');
    }
    const rawTracks=meta.settings.tracks;
    if(rawTracks.length>MAX_TRACKS||meta.entries.length>MAX_TRACKS*2+1)
      throw new Error('备份文件的歌曲数量超出限制');
    const tracks=rawTracks.map(validateTrack);
    if(tracks.some(t=>!t)||new Set(tracks.map(t=>t.id)).size!==tracks.length)
      throw new Error('备份歌曲资料损坏或存在重复标识');
    const byId=new Map(tracks.map(t=>[t.id,t]));
    const pieces=[],keys=new Set();
    let offset=18+length;
    for(const entry of meta.entries){
      const {id,kind,size}=entry||{};
      const mark=kind+':'+id;
      const target=byId.get(id);
      const valid=kind==='wallpaper'
        ? (meta.version>=2&&id===WALLPAPER_KEY)
        : (kind==='audio' ? target?.kind==='file' : kind==='cover'&&Boolean(target));
      const max=kind==='audio'?MAX_FILE_SIZE:kind==='wallpaper'?WALLPAPER_MAX_BYTES:COVER_MAX_BYTES;
      if(!valid||keys.has(mark)||!Number.isSafeInteger(size)||size<1||size>max||offset+size>file.size)
        throw new Error('备份缺少音频、封面或壁纸，或媒体文件不完整');
      if(meta.version===3&&(typeof entry.crc32!=='string'||!/^[0-9a-f]{8}$/.test(entry.crc32)))
        throw new Error('备份缺少媒体文件校验码');
      keys.add(mark);
      pieces.push({id,kind,blob:file.slice(offset,offset+size,entry.type||'application/octet-stream'),crc32:entry.crc32});
      offset+=size;
    }
    if(offset!==file.size||tracks.some(t=>t.kind==='file'&&!keys.has('audio:'+t.id)))
      throw new Error('备份文件长度不一致，或部分本地音乐缺失');
    if(meta.version===3){
      for(let i=0;i<pieces.length;i++){
        const piece=pieces[i];
        if(i%8===0)notice('正在逐项验证备份 '+(i+1)+'/'+pieces.length+'…');
        if(await checksumBlob(piece.blob)!==piece.crc32){
          const name=byId.get(piece.id)?.title||'播放器壁纸';
          throw new Error('「'+name+'」校验失败：文件内容有损坏，已停止恢复');
        }
      }
    }
    return {meta,tracks,pieces,keys,verified:meta.version===3};
  }
  // The two media stores are updated in ONE IndexedDB transaction. If quota
  // or write errors occur, the browser rolls back the whole media restore.
  async function commitBackupMedia(pieces,tracks,oldTracks,keys){
    const db=await openAudioDb();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction([DB_STORE,COVER_STORE],'readwrite');
        const songs=tx.objectStore(DB_STORE),art=tx.objectStore(COVER_STORE);
        tx.oncomplete=()=>resolve();
        tx.onabort=()=>reject(tx.error||new Error('存储空间不足，恢复已回滚，请检查容量'));
        try{
          for(const piece of pieces)
            (piece.kind==='audio'?songs:art).put(piece.blob,piece.id);
          const next=new Map(tracks.map(t=>[t.id,t]));
          for(const old of oldTracks){
            if(old.kind==='file'&&next.get(old.id)?.kind!=='file') songs.delete(old.id);
            if(!next.has(old.id)||!keys.has('cover:'+old.id)) art.delete(old.id);
          }
          if(!keys.has('wallpaper:'+WALLPAPER_KEY)) art.delete(WALLPAPER_KEY);
        }catch(error){try{tx.abort();}catch{} reject(error);}
      });
    }finally{db.close();}
  }
  async function importFullBackup(file) {
    if(!file)return;
    $('.sw-backup-import').disabled=true;
    try{
      notice('恢复前先校验备份，请稍候…');
      const {meta,tracks,pieces,keys,verified}=await verifyFullBackup(file);
      const warning=verified ? '媒体文件和备份目录的校验码全部通过。' :
        '这是旧版备份：结构检查通过，但没有媒体校验码，无法证明文件内容完好。';
      if(!window.confirm(warning+'\n确认用这 '+tracks.length+' 首歌曲替换听风现有歌单与设置？\n建议先备份当前歌单。'))return;
      notice('正在安全恢复媒体文件，请不要关闭酒馆…');
      const oldTracks=settings.tracks.slice();
      await commitBackupMedia(pieces,tracks,oldTracks,keys);
      // Only after all media writes commit do we update the playlist/settings.
      pausePlayback();
      settings.tracks=tracks;
      settings.roleOrders=normalizeRoleOrders(meta.settings.roleOrders);
      settings.characterLabels=Object.fromEntries(Object.entries(meta.settings.characterLabels||{})
        .filter(([k,v])=>k.startsWith('avatar:')&&k.length<=310&&typeof v==='string')
        .slice(0,300).map(([k,v])=>[k,cleanText(v,70)]));
      mode=['all','one','shuffle'].includes(meta.settings.mode)?meta.settings.mode:'all';
      audio.volume=Number.isFinite(meta.settings.volume)?Math.max(0,Math.min(1,meta.settings.volume)):.72;
      followCharacter=meta.settings.followCharacter===true;
      autoRolePlayback=meta.settings.autoRolePlayback===true;
      networkAcceleration=meta.settings.networkAcceleration===true;
      $('.sw-network-acceleration').value=networkAcceleration?'smart':'off';
      manualFilter=typeof meta.settings.manualFilter==='string'?meta.settings.manualFilter:'all';
      openPet=meta.settings.openPet==='shepherd'?'shepherd':'golden';
      closedPet=CLOSED_PETS.includes(meta.settings.closedPet)?meta.settings.closedPet:'cat';
      brandIcon=meta.settings.brandIcon==='paw'?'paw':'cat';
      panelOpacity=Number.isFinite(meta.settings.panelOpacity)?Math.max(0,Math.min(100,Math.round(meta.settings.panelOpacity))):100;
      frostBlur=Number.isFinite(meta.settings.frostBlur)?Math.max(0,Math.min(30,Math.round(meta.settings.frostBlur))):(panelOpacity<100?12:0);
      wallpaperView=normalizeWallpaperView(meta.settings.wallpaperView);
      if(meta.settings.orbPosition&&Number.isFinite(meta.settings.orbPosition.x)&&Number.isFinite(meta.settings.orbPosition.y)){
        orbPosition={x:Math.max(0,Math.min(1,meta.settings.orbPosition.x)),y:Math.max(0,Math.min(1,meta.settings.orbPosition.y))};
        positionOrb();
      }
      for(const id of new Set([...oldTracks, ...tracks].map(t=>t.id)))
        coverRevision.set(id,(coverRevision.get(id)||0)+1);
      for(const url of coverUrls.values())if(url)URL.revokeObjectURL(url);
      coverUrls.clear();coverPending.clear();coverQueue.length=0;
      currentIndex=-1;lastRoleSignature='';
      searchQuery='';$('.sw-search').value='';
      wallpaperRevision++;
      if(wallpaperUrl){URL.revokeObjectURL(wallpaperUrl);wallpaperUrl=null;}
      const wallpaperPiece=pieces.find(p=>p.kind==='wallpaper');
      if(wallpaperPiece)wallpaperUrl=URL.createObjectURL(wallpaperPiece.blob);
      applyAppearance();updateBrandIcon();syncPetChoices();syncPanelState();
      await selectTrack(-1,false);
      renderTransport();refreshFilter();persist();
      notice('安全恢复完成：'+tracks.length+' 首歌曲'+(verified?'，校验通过 ✓':'（旧版备份）'));
    }catch(e){notice(e.message||'恢复失败，已保留现有歌单');}
    finally{$('.sw-backup-import').disabled=false;}
  }
    $('.sw-backup-export').addEventListener('click',()=>void exportFullBackup());

  $('.sw-backup-check').addEventListener('click',()=>backupCheckInput.click());
  backupCheckInput.addEventListener('change',async()=>{
    const file=backupCheckInput.files?.[0];backupCheckInput.value='';
    if(!file)return;
    $('.sw-backup-check').disabled=true;
    try{
      notice('检查备份结构与媒体校验码中…');
      const {tracks,pieces,verified}=await verifyFullBackup(file);
      notice(verified
        ? '校验通过 ✓ '+tracks.length+' 首歌曲，'+pieces.length+' 个媒体文件完整'
        : '旧版备份结构检查通过（'+tracks.length+' 首）；无校验码，建议重新备份');
    }catch(e){notice(e.message||'备份检查失败，请换一份文件');}
    finally{$('.sw-backup-check').disabled=false;}
  });
  $('.sw-backup-import').addEventListener('click',()=>backupInput.click());
  backupInput.addEventListener('change',async()=>{
    const file = backupInput.files?.[0];backupInput.value='';
    if (!file) return;
    try {await importFullBackup(file);} catch(e) {notice(e.message || '恢复备份失败，请检查文件');}
  });
  $('.sw-export').addEventListener('click', () => {
    const tracks = settings.tracks.filter(item => item.kind === 'url').map(({id, title, artist, src, bindings}) => ({id, title, artist, src, bindings}));
    const localCount = settings.tracks.length - tracks.length;
    if (!tracks.length) {
      notice(localCount ? `这 ${localCount} 首都是本地音频，请使用「完整备份」搬到另一个酒馆；网络歌单不包含本地音乐。` : '歌单还没有歌曲，请先添加音乐');
      return;
    }
    if (localCount && !window.confirm(`仅导出 ${tracks.length} 首网络歌曲。\n${localCount} 首本地音频及所有封面、壁纸、设置不会包含在 JSON 中。\n搬到另一个酒馆请取消并选择「完整备份」。继续只导出网络歌单？`)) return;
    const ids = new Set(tracks.map(t => t.id));
    const roles = new Set(tracks.flatMap(t => t.bindings || []));
    const roleOrders = Object.fromEntries(Object.entries(normalizeRoleOrders(settings.roleOrders))
      .filter(([key]) => roles.has(key)).map(([key, order]) => [key, order.filter(id => ids.has(id))]));
    const characterLabels = Object.fromEntries(Object.entries(settings.characterLabels).filter(([key]) => roles.has(key)));
    // Keep v2 readable by older extensions; stable IDs are an additive field.
    const data = {format:'soundwalk-playlist', version:2, characterLabels, roleOrders, tracks};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = '听风-网络歌单.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice(`已导出 ${tracks.length} 首网络歌曲及绑定、顺序；本地音乐与图片请用完整备份迁移`);
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
      const validItems = data.tracks.slice(0, MAX_TRACKS).map(item => ({
        sourceId:cleanText(item?.id, 100), track:validateTrack({ ...item, kind:'url', id:uid() })
      })).filter(item => item.track);
      if (!validItems.length) {
        notice('这个 JSON 没有可导入的网络歌曲。本地音乐迁移请在原酒馆做「完整备份」，再在这里恢复 .swbackup 文件。');
        return;
      }
      if (data.version === 2 && data.characterLabels && typeof data.characterLabels === 'object') {
        for(const [key,name] of Object.entries(data.characterLabels).slice(0,300)) {
          if (key.startsWith('avatar:') && key.length<=310 && typeof name === 'string') settings.characterLabels[key] = cleanText(name,70);
        }
      }
      const existing = new Map(settings.tracks.filter(t => t.kind === 'url').map(t => [t.src,t]));
      let count = 0;
      let rebound = 0;
      let duplicates = 0;
      let skipped = data.tracks.length - validItems.length;
      const idMap = new Map();
      for (const {sourceId, track:parsed} of validItems) {
        const duplicate = existing.get(parsed.src);
        if (duplicate) {
          duplicates++;
          const oldCount = (duplicate.bindings || []).length;
          duplicate.bindings = [...new Set([...(duplicate.bindings || []), ...parsed.bindings])];
          if (duplicate.bindings.length > oldCount) rebound++;
          if (sourceId) idMap.set(sourceId,duplicate.id);
          continue;
        }
        if (settings.tracks.length >= MAX_TRACKS) { skipped++; continue; }
        settings.tracks.push(parsed); existing.set(parsed.src,parsed); count++;
        if (sourceId) idMap.set(sourceId,parsed.id);
      }
      if (data.version === 2) {
        const byId = new Map(settings.tracks.map(t => [t.id,t]));
        for (const [role, order] of Object.entries(normalizeRoleOrders(data.roleOrders))) {
          const mapped = [...new Set(order.map(id => idMap.get(id)).filter(id => byId.get(id)?.bindings.includes(role)))];
          if (!mapped.length) continue; // Legacy JSON without IDs cannot map its old order.
          // Preserve this browser's existing order, append new tracks in imported order.
          const previous = settings.roleOrders[role] || [];
          settings.roleOrders[role] = [...new Set([...previous,...mapped])].slice(0,MAX_TRACKS);
        }
      }
      refreshFilter(); notice(`${count ? `已导入 ${count} 首网络歌曲` : `这 ${duplicates} 首网络歌曲已在歌单中`}，更新 ${rebound} 首的角色绑定${skipped ? `；跳过 ${skipped} 首无效或超出容量的歌曲` : ''}`);
    } catch (error) { notice(error.message || '歌单导入失败'); }
    finally { jsonInput.value = ''; }
  });
  $('.sw-role-autoplay').addEventListener('change', e => {
    autoRolePlayback = e.target.checked;
    if (autoRolePlayback) {
      const indices = visibleIndices();
      if (autoplayRoleKey() && indices.length) {
        // The toggle itself is a user gesture: try playing right away.
        void selectTrack(indices[0], true);
        notice('已开启自动播放：从当前角色第一首开始，按顺序播放');
      } else {
        void selectTrack(-1, false);
        notice('已开启自动播放：此角色未绑定音乐，将保持静音；仍可手动点歌');
      }
    } else {
      // Revert to the independent manual/follow settings already saved.
      refreshFilter();
      notice('已关闭自动播放，恢复手动播放');
    }
    renderTransport();
    updateRoleView();
    persist();
  });
  $('.sw-role-follow').addEventListener('change', e => {
    // Allow setting follow before entering a character or while auto plays.
    followCharacter = e.target.checked;
    if (autoRolePlayback) {
      updateRoleView();
      persist();
      notice(followCharacter
        ? '已开启歌单跟随；自动播放期间依然按当前角色顺序播放'
        : '已关闭歌单跟随；自动播放仍有效，关闭后恢复手动分组');
      return;
    }
    refreshFilter();
    notice(followCharacter
      ? (currentCharacter ? `已开启：跟随「${currentCharacter.name}」` : '歌单跟随已开启：进入角色卡后自动切换')
      : '已关闭歌单跟随，可以自由选分组');
  });
  roleFilterSelect.addEventListener('change', e => {
    if (followCharacter || autoRolePlayback) return;
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
    showPanel(!isPanelOpen(), true);
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
    const pet = button.dataset.pet;
    if (button.dataset.state === 'closed') {
      if (!CLOSED_PETS.includes(pet)) return;
      closedPet = pet;
    } else {
      if (!['golden', 'shepherd'].includes(pet)) return;
      openPet = pet;
    }
    syncPetChoices();
    syncPanelState();
    persist();
    notice(button.dataset.state === 'closed'
      ? `收起头像已换成${PET_LABELS[closedPet]} · 下次打开仍会保留`
      : `展开头像已换成${PET_LABELS[openPet]}`);
  }));
  $('.sw-close').addEventListener('click', () => showPanel(false));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && isPanelOpen()) showPanel(false); });
  playButton.addEventListener('click', () => playIntent ? pausePlayback() : void play(true));
  $('.sw-prev').addEventListener('click', () => advance(-1));
  $('.sw-next').addEventListener('click', () => advance(1));
  $('.sw-mode').addEventListener('click', () => {
    if (autoplayRoleKey()) { notice('角色自动播放固定按顺序播放；关闭自动开关后可更改模式'); return; }
    mode = ({all:'one', one:'shuffle', shuffle:'all'})[mode];
    renderTransport(); persist(); notice(({all:'列表循环', one:'单曲循环', shuffle:'随机播放'})[mode]);
  });
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = (+seek.value / 1000) * audio.duration;
      syncSeekLoading();
    }
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
      pausePlayback(); sleepDeadline = 0; $('.sw-sleep').value = '0';
      notice('定时结束，音乐已暂停');
    }, minutes * 60000);
    notice(minutes ? `将在 ${minutes} 分钟后暂停` : '已关闭定时停止');
  });
  audio.addEventListener('play', renderTransport);
  for (const event of ['loadstart', 'waiting', 'stalled']) {
    audio.addEventListener(event, () => {
      if (hasCurrentMedia() && playIntent && (isPendingPlay || audio.readyState < 3)) {
        if (audio.seeking && !isPendingPlay) inspectSeekLoading();
        else startNetworkLoading();
      }
    });
  }
  audio.addEventListener('canplay', renderTransport);
  audio.addEventListener('playing', () => {if (audio.readyState >= 3) confirmPlaying();});
  audio.addEventListener('pause', () => {
    // load()/rapid track changes may queue a pause event for an older source.
    if (hasCurrentMedia() && audio.paused && playIntent && !isPendingPlay) pausePlayback();
    else renderTransport();
  });
  audio.addEventListener('ended', () => {
    if (!hasCurrentMedia() || !audio.ended) return;
    ++playRequest;playIntent = false;isPendingPlay = false;clearNetworkLoading();
    advance(1, true);
  });
  audio.addEventListener('seeking', () => {if (audio.seeking) syncSeekLoading();});
  audio.addEventListener('seeked', () => {if (seekSequence === playSequence) syncSeekLoading();});
  audio.addEventListener('timeupdate', () => {
    if (networkLoading && !audio.seeking && audio.readyState >= 3 && audio.currentTime > lastMediaTime) confirmPlaying();
    lastMediaTime = audio.currentTime;
    $('.sw-elapsed').textContent = formatTime(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) seek.value = String(Math.round(audio.currentTime / audio.duration * 1000));
  });
  audio.addEventListener('durationchange', () => $('.sw-duration').textContent = formatTime(audio.duration));
  audio.addEventListener('error', () => {
    if (!hasCurrentMedia() || !audio.error) return;
    if (!playIntent && networkAcceleration && settings.tracks[currentIndex]?.kind === 'url') {
      // Failed preparation is not a failed play request. A manual play retries
      // the same source through the existing error/reselection path.
      preloadExpected = false;updatePreload();return;
    }
    const message = playbackErrorMessage();
    pausePlayback();notice(message);
  });
  // Per-character associations are local to the player's browser, and
  // switching chats updates the active view without rewriting any cards.
  subscribeCharacterEvents();
  syncActiveCharacter();
  renderTransport(); renderList();
  // Startup auto playback (if enabled) is handled only by syncActiveCharacter.
  // Never override it with a second, paused selectTrack request.
  if (!autoRolePlayback) {
    if (visibleIndices().length) void selectTrack(visibleIndices().includes(currentIndex) ? currentIndex : visibleIndices()[0], false);
    else currentIndex = -1;
  }
  // Some extensions initialize before ST has populated its active chat.
  for (const delay of [350, 1200, 3000]) setTimeout(syncActiveCharacter, delay);
  // Mobile browsers may pause sound when placed in the background; the extension cannot override OS policy.
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
else init();
