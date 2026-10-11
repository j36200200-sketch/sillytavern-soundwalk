/*
 * Soundwalk Music — independently implemented audio companion for SillyTavern.
 * MIT License. No bundled songs, copyrighted artwork, or third-party player code.
 */
const ROOT_ID = 'soundwalk-player-root';
const STORE_KEY = 'soundwalk-player-v1';
const MAX_TRACKS = 300;
const MAX_FILE_SIZE = 60 * 1024 * 1024;
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
  if (kind === 'url') {
    const src = safeUrl(raw.src);
    return src ? { id: cleanText(raw.id, 100) || uid(), title, artist, kind, src } : null;
  }
  return { id: cleanText(raw.id, 100) || uid(), title, artist, kind };
}
function readSettings() {
  const defaults = { tracks: [], index: 0, mode: 'all', volume: 0.72 };
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
      volume: Number.isFinite(data.volume) ? Math.max(0, Math.min(1, data.volume)) : 0.72
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
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = settings.volume;

  const root = document.createElement('section');
  root.id = ROOT_ID;
  root.setAttribute('aria-label', '听风音乐播放器');
  root.innerHTML = `
    <button class="sw-orb" type="button" aria-label="打开听风音乐播放器" aria-expanded="false">
      ${icons.music}<span class="sw-orb-pulse" aria-hidden="true"></span>
    </button>
    <div class="sw-panel" role="region" aria-label="听风播放器" hidden>
      <header class="sw-header">
        <div class="sw-brand"><span class="sw-brand-dot"></span><div><strong>听风</strong><small>SOUNDWALK · 在故事里听歌</small></div></div>
        <button class="sw-icon sw-close" type="button" aria-label="关闭播放器">${icons.close}</button>
      </header>
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
    </div>`;
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
  let messageTimer;

  function notice(message) {
    const el = $('.sw-notice');
    el.textContent = message;
    el.classList.add('sw-show');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => el.classList.remove('sw-show'), 3800);
  }
  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({tracks: settings.tracks, index: currentIndex, mode, volume: audio.volume}));
    } catch { notice('无法保存偏好：请检查浏览器存储权限或剩余空间'); }
  }
  function showPanel(show) {
    panel.hidden = !show;
    orb.setAttribute('aria-expanded', String(show));
    if (show) $('.sw-close').focus();
    else orb.focus();
  }
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
  function renderNow() {
    const track = settings.tracks[currentIndex];
    $('.sw-title').textContent = track ? track.title : '歌单还是空的';
    $('.sw-artist').textContent = track ? `${track.artist} · ${track.kind === 'file' ? '本地音频' : '网络音频'}` : '添加链接或本地音频开始播放';
    $('.sw-count').textContent = String(settings.tracks.length);
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
    settings.tracks.forEach((track, index) => {
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
      sub.textContent = `${track.artist} · ${track.kind === 'file' ? '本地' : '链接'}`;
      select.append(trackName, sub);
      select.addEventListener('click', () => selectTrack(index, true));
      const actions = document.createElement('div');
      actions.className = 'sw-track-actions';
      if (track.kind === 'url') {
        actions.append(actionBtn('✎', `编辑 ${track.title}`, () => editTrack(track.id)));
      }
      actions.append(actionBtn('×', `删除 ${track.title}`, () => deleteTrack(track.id)));
      item.append(select, actions);
      list.append(item);
    });
    if (!settings.tracks.length) {
      const empty = document.createElement('li');
      empty.className = 'sw-empty';
      empty.textContent = '还没有歌曲。你可以添加合法音频直链，也可以选择手机上的音频文件。';
      list.append(empty);
    }
    renderNow();
  }
  function resetProgress() {
    seek.value = '0';
    $('.sw-elapsed').textContent = '0:00';
    $('.sw-duration').textContent = '0:00';
  }
  async function selectTrack(index, shouldPlay = false) {
    const nextTrack = settings.tracks[index];
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
    if (!settings.tracks.length) { notice('请先添加歌曲'); return; }
    if (!audio.src) { await selectTrack(currentIndex, true); return; }
    try { await audio.play(); }
    catch { notice('无法播放：检查链接、音频格式或浏览器播放限制'); }
    renderTransport();
  }
  function nextIndex(direction) {
    const length = settings.tracks.length;
    if (!length) return -1;
    if (mode === 'shuffle' && length > 1) {
      return (currentIndex + 1 + Math.floor(Math.random() * (length - 1))) % length;
    }
    return (currentIndex + direction + length) % length;
  }
  function advance(direction, fromEnded = false) {
    if (!settings.tracks.length) return;
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
      void selectTrack(Math.min(currentIndex, settings.tracks.length - 1), false);
    } else { renderList(); persist(); }
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
      settings.tracks.push({ id: uid(), kind: 'url', title, artist, src });
      if (wasEmpty) void selectTrack(0, false);
    }
    hideForm(); renderList(); persist(); notice('歌曲已保存');
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
        settings.tracks.push({id, kind:'file', title, artist:'本地文件'});
        added += 1;
        if (wasEmpty) void selectTrack(0, false);
      } catch { notice(`无法保存 ${file.name}：可能存储空间不足`); }
    }
    fileInput.value = '';
    renderList(); persist();
    if (added) notice(`已导入 ${added} 首本地音频`);
  });
  $('.sw-export').addEventListener('click', () => {
    const tracks = settings.tracks.filter(item => item.kind === 'url').map(({title, artist, src}) => ({title, artist, src}));
    const data = {format:'soundwalk-playlist', version:1, tracks};
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = '听风-网络歌单.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice('已导出网络歌单；本地音频文件不会包含在 JSON 中');
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
      const existing = new Set(settings.tracks.filter(t => t.kind === 'url').map(t => t.src));
      let count = 0;
      for (const item of data.tracks) {
        if (settings.tracks.length >= MAX_TRACKS) break;
        const parsed = validateTrack({ ...item, kind:'url', id: uid() });
        if (!parsed || existing.has(parsed.src)) continue;
        settings.tracks.push(parsed); existing.add(parsed.src); count++;
      }
      if (settings.tracks.length && !audio.src) void selectTrack(currentIndex, false);
      renderList(); persist(); notice(`已导入 ${count} 首网络歌曲`);
    } catch (error) { notice(error.message || '歌单导入失败'); }
    finally { jsonInput.value = ''; }
  });
  orb.addEventListener('click', () => showPanel(panel.hidden));
  $('.sw-close').addEventListener('click', () => showPanel(false));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) showPanel(false); });
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
  // Preserve playback when switching chats: this extension is mounted once per page.
  renderTransport(); renderList();
  if (settings.tracks.length) void selectTrack(currentIndex, false);
  // Mobile browsers may pause sound when placed in the background; the extension cannot override OS policy.
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
else init();