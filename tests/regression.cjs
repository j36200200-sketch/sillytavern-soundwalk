// Browser regression tests against the actual extension, using disposable data.
// Install playwright for development; optionally set CHROMIUM_EXECUTABLE_PATH.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const {crc32} = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const manifest = require('../manifest.json');
const KEY = 'soundwalk-player-v1';
const WALL = '__soundwalk_panel_wallpaper_v1__';
const ROLE = 'avatar:regression-a.png';
const OTHER = 'avatar:regression-b.png';
const errors = [];
const results = [];
const contexts = [];
const servers = [];
const wav = Buffer.alloc(44 + 8000 * 2 * 10);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let i=44; i<wav.length; i+=2) wav.writeInt16LE(Math.round(Math.sin((i-44)/2*2*Math.PI*220/8000)*1500), i);

async function server() {
  const s = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/blank') { res.end('<!doctype html><title>Fixture setup</title>'); return; }
    if (url.pathname === '/') {
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Soundwalk regression</title>
        <style>body{margin:0;background:repeating-linear-gradient(#59005d 0 30px,#f93 30px 60px);font-family:sans-serif;}main{padding:20px;color:white;min-height:1500px;}</style>
        <link rel="stylesheet" href="/${manifest.css}"><main>测试聊天背景 · Testing chat backdrop</main><script type="module" src="/${manifest.js}"></script>`);
      return;
    }
    if (url.pathname.endsWith('.wav')) { res.setHeader('Content-Type','audio/wav'); res.end(wav); return; }
    const filename = path.resolve(ROOT, '.' + url.pathname);
    if (!filename.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const type = {'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(filename)];
      if(type) res.setHeader('Content-Type',type);
      res.end(await fs.readFile(filename));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  servers.push(s);
  return `http://127.0.0.1:${s.address().port}`;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) {
  for(let i=0;i<80;i++) { if(await fn()) return; await sleep(50); }
  throw new Error('Timed out waiting for extension state');
}
async function settings(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY); }
async function notice(page) { return page.locator('.sw-notice').textContent(); }
async function test(name, fn) { await fn(); results.push(name); console.log('PASS ' + name); }
async function range(page, selector, value) {
  await page.locator(selector).evaluate((el, value) => {el.value=String(value); el.dispatchEvent(new Event('input',{bubbles:true}));}, value);
}
async function open(page) { await page.locator('.sw-orb').click(); await page.locator('.sw-panel').waitFor({state:'visible'}); }
async function expand(page) {
  await page.locator('.sw-advanced > summary').click();
  await page.locator('.sw-role-manage').click();
  await page.locator('.sw-storage > summary').click();
}
async function upload(page, selector, buffer, name='fixture.json') {
  await page.locator(selector).setInputFiles({name,mimeType:name.endsWith('.json')?'application/json':'application/octet-stream',buffer});
}
async function download(page, selector) {
  const pending=page.waitForEvent('download');
  await page.locator(selector).click();
  const d=await pending;
  return fs.readFile(await d.path());
}
async function media(page) {
  return page.evaluate(async () => {
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('soundwalk-player-audio-v1',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const output={};
    for(const name of ['tracks','covers']) {
      const pairs=await new Promise((resolve,reject)=>{
        const store=db.transaction(name).objectStore(name), out=[];
        const r=store.openCursor();r.onerror=()=>reject(r.error);
        r.onsuccess=()=>{const c=r.result;if(c){out.push([c.key,c.value]);c.continue();}else resolve(out);};
      });
      output[name]=await Promise.all(pairs.map(async([key,blob])=>[key,blob.type,Array.from(new Uint8Array(await blob.arrayBuffer()))]));
    }
    db.close();return output;
  });
}
async function fixture(browser, origin, raw, withMedia=true, viewport={width:360,height:800}) {
  const context=await browser.newContext({viewport,acceptDownloads:true}); contexts.push(context);
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.addInitScript(() => {
    const Native=window.Audio;
    window.Audio=function(...args){const audio=new Native(...args);window.testAudio=audio;return audio;};
    const listeners={};
    window.testContext={characterId:0,characters:[{avatar:'regression-a.png',name:'测试角色A'},{avatar:'regression-b.png',name:'测试角色B'}],
      event_types:{CHAT_CHANGED:'chat'},eventSource:{on:(key,fn)=>{listeners[key]=fn;}}};
    window.SillyTavern={getContext:()=>window.testContext};
    window.testSwitchRole=id=>{window.testContext.characterId=id;listeners.chat?.();};
  });
  await page.goto(origin+'/blank');
  await page.evaluate(async ({raw,wav,withMedia,key,wall}) => {
    localStorage.setItem(key,JSON.stringify(raw));
    if(!withMedia)return;
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open('soundwalk-player-audio-v1',2);
      r.onupgradeneeded=()=>{r.result.createObjectStore('tracks');r.result.createObjectStore('covers');};
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=800;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#09a44d';ctx.fillRect(0,0,600,800);ctx.fillStyle='#09cfff';ctx.fillRect(0,400,600,400);
    ctx.fillStyle='#ffff40';ctx.fillRect(0,0,120,800);
    const art=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(['tracks','covers'],'readwrite');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
      for(const track of raw.tracks||[]) {
        if(track.kind==='file')tx.objectStore('tracks').put(new Blob([new Uint8Array(wav)],{type:'audio/wav'}),track.id);
        tx.objectStore('covers').put(art,track.id);
      }
      tx.objectStore('covers').put(art,wall);
    });db.close();
  },{raw,wav:Array.from(wav),withMedia,key:KEY,wall:WALL});
  await page.goto(origin+'/');
  await page.locator('.sw-orb').waitFor();
  if(withMedia)await until(()=>page.locator('.sw-panel').evaluate(el=>el.classList.contains('sw-wallpaper-on')));
  return page;
}

(async()=>{
  const origin=await server(), target=await server();
  const artifacts=process.env.TEST_ARTIFACTS || await fs.mkdtemp(path.join(os.tmpdir(),'soundwalk-test-'));
  await fs.mkdir(artifacts,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,
    args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    if(process.env.NETWORK_ONLY==='1') {
      await require('./network-playback.cjs')({browser,origin,fixture,test,until,range,open,upload,wav,artifacts});
      assert.deepEqual(errors,[]);console.log(`${results.length} network regression checks passed`);return;
    }
    if(process.env.SMART_ONLY==='1') {
      await require('./smart-loading.cjs')({browser,origin,fixture,test,until,open,upload,download,media,settings,wav,artifacts});
      assert.deepEqual(errors,[]);console.log(`${results.length} smart loading checks passed`);return;
    }
    const tracks=[
      {id:'local-1',title:'Local A',artist:'本地文件',kind:'file',bindings:[ROLE,OTHER]},
      {id:'local-2',title:'Local B',artist:'本地文件',kind:'file',bindings:[ROLE]},
      {id:'net-1',title:'Network A',artist:'Test',kind:'url',src:origin+'/a.wav',bindings:[ROLE,OTHER]},
      {id:'net-2',title:'Network B',artist:'Test',kind:'url',src:origin+'/b.wav',bindings:[ROLE]}
    ];
    const raw={tracks,index:0,volume:.4,mode:'all',orbPosition:{x:.8,y:.94},panelOpacity:100,frostBlur:0,
      characterLabels:{[ROLE]:'测试角色A',[OTHER]:'测试角色B'},roleOrders:{[ROLE]:['local-2','net-2','local-1','net-1'],[OTHER]:['net-1','local-1']},closedPet:'owl',openPet:'shepherd'};
    const page=await fixture(browser,origin,raw); await open(page);
    await test('v1.3.6 settings, wallpaper, songs and media survive upgrade',async()=>{
      const s=await settings(page); assert.deepEqual(s.tracks,tracks);assert.deepEqual(s.roleOrders,raw.roleOrders);
      assert.deepEqual(s.wallpaperView,{zoom:100,x:50,y:50});assert.equal(s.panelOpacity,100);assert.equal(s.frostBlur,0);
    });
    await test('wallpaper remains fixed through fully expanded and scrolled content',async()=>{
      await expand(page);
      const metrics=await page.locator('.sw-panel-content').evaluate(el=>({height:el.clientHeight,total:el.scrollHeight}));
      assert(metrics.total>metrics.height);
      assert.equal(await page.locator('.sw-panel').evaluate(el=>getComputedStyle(el).overflowY),'hidden');
      await page.locator('.sw-panel-content').evaluate(el=>{el.style.visibility='hidden';el.scrollTop=0;});
      await page.locator('.sw-notice').evaluate(el=>el.style.visibility='hidden');
      const before=await page.locator('.sw-panel').screenshot();
      await page.locator('.sw-panel-content').evaluate(el=>el.scrollTop=el.scrollHeight);
      const after=await page.locator('.sw-panel').screenshot();
      assert(before.equals(after),'Wallpaper pixels moved or disappeared while scrolling');
      await page.locator('.sw-panel-content').evaluate(el=>el.style.visibility='');
      await page.locator('.sw-notice').evaluate(el=>el.style.visibility='');
      await page.screenshot({path:path.join(artifacts,'mobile-expanded.png')});
    });
    await test('wallpaper zoom and both positions save across reload',async()=>{
      await page.locator('.sw-appearance-toggle').click();
      await range(page,'.sw-wallpaper-zoom',175);await range(page,'.sw-wallpaper-x',20);await range(page,'.sw-wallpaper-y',80);
      await range(page,'.sw-panel-opacity',75);await range(page,'.sw-frost-blur',16);
      await page.reload();await until(()=>page.locator('.sw-panel').evaluate(el=>el.classList.contains('sw-wallpaper-on')));
      const s=await settings(page);assert.deepEqual(s.wallpaperView,{zoom:175,x:20,y:80});assert.equal(s.panelOpacity,75);assert.equal(s.frostBlur,16);
      await open(page);await page.locator('.sw-appearance-toggle').click();
      assert.equal(await page.locator('.sw-wallpaper-zoom').inputValue(),'175');
      await page.screenshot({path:path.join(artifacts,'wallpaper-controls.png')});
    });
    await test('portrait, narrow phone, landscape and desktop keep panel within viewport',async()=>{
      for(const viewport of [{width:320,height:720},{width:800,height:360},{width:1280,height:900},{width:360,height:800}]){
        await page.setViewportSize(viewport);await sleep(100);
        const box=await page.locator('.sw-panel').boundingBox();
        assert(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
        assert(await page.locator('.sw-panel-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
      }
    });
    await test('all 24 original and new stickers load and new choices persist independently',async()=>{
      if(await page.locator('.sw-appearance').isVisible())await page.locator('.sw-appearance-toggle').click();
      await page.locator('.sw-pet-settings-toggle').click();
      assert.equal(await page.locator('.sw-pet-closed-choices button').count(),24);
      const choices={rabbit:'rabbit-v138',whiteCat:'white-cat-v138',fox:'fox-v138',bear:'bear-v138',deer:'deer-v138',otter:'otter-v138',penguin:'penguin-v138',parrot:'parrot-v138',peacock:'peacock-v138',peacockFan:'peacock-fan-v138',jellyfish:'jellyfish-v139',spider:'spider-v139',beagle:'beagle-v139',orca:'orca-v139',octopus:'octopus-v139',blackOctopus:'black-octopus-v139'};
      await until(()=>page.locator('.sw-pet-thumb img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)));
      await page.screenshot({path:path.join(artifacts,'pet-wardrobe.png')});
      for(const [id,file] of Object.entries(choices)){
        await page.locator(`.sw-pet-choice[data-pet="${id}"]`).click();
        assert.equal((await settings(page)).closedPet,id);
        assert.match(await page.locator('.sw-orb-pet img').getAttribute('src'),/pet-shepherd-v123/);
        await page.locator('.sw-close').click();
        assert((await page.locator('.sw-orb-pet img').getAttribute('src')).endsWith(`pet-${file}.webp`));
        await page.reload();assert.equal((await settings(page)).closedPet,id);
        assert((await page.locator('.sw-orb-pet img').getAttribute('src')).endsWith(`pet-${file}.webp`));
        await open(page);await page.locator('.sw-pet-settings-toggle').click();
      }
      await page.locator('.sw-pet-choice[data-pet="owl"]').click();
      await page.locator('.sw-pet-settings-toggle').click();
    });
    await test('versioned entry points refresh stale script and stylesheet URLs',async()=>{
      const cache=await fixture(browser,target,{tracks:[],orbPosition:{x:.8,y:.94}},false);
      const requested=[];cache.on('request',r=>requested.push(r.url()));
      await cache.route('**/*',route=>{
        const u=new URL(route.request().url());
        if(u.pathname==='/index.js'&&!u.search)return route.fulfill({contentType:'text/javascript',body:'throw new Error("Stale unversioned script loaded");'});
        if(u.pathname==='/style.css'&&!u.search)return route.fulfill({contentType:'text/css',body:'dialog.sw-panel {overflow-y:auto!important;}'});
        return route.continue();
      });
      await cache.reload();await open(cache);
      assert.equal(await cache.locator('.sw-version').textContent(),'v'+manifest.version);
      assert.equal(await cache.locator('#soundwalk-player-root').getAttribute('data-soundwalk-version'),manifest.version);
      assert(requested.some(url=>url.endsWith('/index.js?v='+manifest.version)));
      assert(requested.some(url=>url.endsWith('/style.css?v='+manifest.version)));
      assert.equal((await settings(cache)).closedPet,'cat');
    });
    await test('late legacy dialog/theme styles cannot scroll the wallpaper layer',async()=>{
      await page.addStyleTag({content:`
        #soundwalk-player-root dialog.sw-panel {overflow-y:auto!important;}
        #soundwalk-player-root dialog.sw-panel.sw-wallpaper-on::before {content:'';position:absolute;inset:0;}
        #soundwalk-player-root dialog > * {position:relative!important;}
      `});
      assert.equal(await page.locator('.sw-panel').evaluate(el=>getComputedStyle(el).overflowY),'hidden');
      assert.equal(await page.locator('.sw-wallpaper-layer').evaluate(el=>getComputedStyle(el).position),'absolute');
      assert.equal(await page.locator('.sw-panel').evaluate(el=>getComputedStyle(el,'::before').display),'none');
      await page.locator('.sw-advanced > summary').click();await page.locator('.sw-role-manage').click();
      await page.locator('.sw-panel-content').evaluate(el=>{el.scrollTop=0;el.style.visibility='hidden';});
      await page.locator('.sw-notice').evaluate(el=>el.style.visibility='hidden');
      const before=await page.locator('.sw-panel').screenshot();
      await page.locator('.sw-panel-content').evaluate(el=>el.scrollTop=el.scrollHeight);
      const after=await page.locator('.sw-panel').screenshot();assert(before.equals(after));
      const panel=await page.locator('.sw-panel').boundingBox(),wall=await page.locator('.sw-wallpaper-layer').boundingBox();
      assert(Math.abs(wall.height-(panel.height-2))<=1);
      await page.locator('.sw-panel-content').evaluate(el=>el.style.visibility='');
      await page.locator('.sw-notice').evaluate(el=>el.style.visibility='');
      await page.locator('.sw-advanced > summary').click();
    });
    let backup,network;
    await page.locator('.sw-storage > summary').click();
    await test('full backup includes all audio, covers, wallpaper, bindings, order and framing',async()=>{
      backup=await download(page,'.sw-backup-export');
      const length=Number(backup.subarray(6,18).toString()),meta=JSON.parse(backup.subarray(18,18+length));
      assert.equal(meta.version,3);assert.equal(meta.entries.length,7);assert.deepEqual(meta.settings.tracks,tracks);
      assert.deepEqual(meta.settings.wallpaperView,{zoom:175,x:20,y:80});assert.deepEqual(meta.settings.roleOrders,raw.roleOrders);
    });
    const dest=await fixture(browser,target,{tracks:[],orbPosition:{x:.8,y:.94}},false);await open(dest);
    await test('full backup restores byte-identical media on independent origin',async()=>{
      const before=await media(page);await upload(dest,'.sw-backup-input',backup,'fixture.swbackup');
      await until(async()=>/安全恢复完成/.test(await notice(dest)));
      const s=await settings(dest);assert.deepEqual(s.tracks,tracks);assert.deepEqual(s.roleOrders,raw.roleOrders);
      assert.deepEqual(s.wallpaperView,{zoom:175,x:20,y:80});assert.equal(s.closedPet,'owl');assert.equal(s.openPet,'shepherd');
      assert.equal(s.volume,.4);assert.equal(s.panelOpacity,75);assert.equal(s.frostBlur,16);
      assert.deepEqual(await media(dest),before);
    });
    await test('new pet choice survives full backup restore and reload',async()=>{
      const length=Number(backup.subarray(6,18).toString()),meta=JSON.parse(backup.subarray(18,18+length));
      delete meta.metadataCrc32;meta.settings.closedPet='blackOctopus';
      meta.metadataCrc32=crc32(Buffer.from(JSON.stringify(meta))).toString(16).padStart(8,'0');
      const bytes=Buffer.from(JSON.stringify(meta));
      const updated=Buffer.concat([Buffer.from('SWBK1\n'+String(bytes.length).padStart(12,'0')),bytes,backup.subarray(18+length)]);
      const pet=await fixture(browser,target,{tracks:[],orbPosition:{x:.8,y:.94}},false);await open(pet);
      await upload(pet,'.sw-backup-input',updated,'pet.swbackup');await until(async()=>/安全恢复完成/.test(await notice(pet)));
      await pet.reload();assert.equal((await settings(pet)).closedPet,'blackOctopus');
      assert.match(await pet.locator('.sw-orb-pet img').getAttribute('src'),/pet-black-octopus-v139/);
    });
    await test('restored local audio really plays, pauses, seeks, changes tracks and volume',async()=>{
      await dest.locator('.sw-main-play').click();await until(()=>dest.evaluate(()=>!window.testAudio.paused&&window.testAudio.currentTime>0));
      await dest.locator('.sw-main-play').click();assert(await dest.evaluate(()=>window.testAudio.paused));
      await range(dest,'.sw-seek',500);assert(await dest.evaluate(()=>window.testAudio.currentTime>=4));
      await dest.locator('.sw-next').click();assert.equal(await dest.locator('.sw-title').textContent(),'Local B');
      await dest.locator('.sw-prev').click();assert.equal(await dest.locator('.sw-title').textContent(),'Local A');
      await range(dest,'.sw-volume',33);assert.equal((await settings(dest)).volume,.33);
      await dest.locator('.sw-mute').click();assert.equal((await settings(dest)).volume,0);await dest.locator('.sw-mute').click();
      await dest.locator('.sw-mode').click();assert.equal((await settings(dest)).mode,'one');
      await dest.locator('.sw-mode').click();assert.equal((await settings(dest)).mode,'shuffle');
      await dest.locator('.sw-sleep').selectOption('15');assert.match(await notice(dest),/15/);await dest.locator('.sw-sleep').selectOption('0');
    });
    await test('character follow, ordered autoplay and independent switches still work',async()=>{
      await dest.locator('.sw-advanced > summary').click();await dest.locator('.sw-role-follow').check();
      assert.equal(await dest.locator('.sw-track .sw-track-name').first().textContent(),'Local B');
      await dest.locator('.sw-role-autoplay').check();await until(()=>dest.evaluate(()=>!window.testAudio.paused));
      assert.equal(await dest.locator('.sw-title').textContent(),'Local B');
      assert(await dest.locator('.sw-role-follow').isEnabled());await dest.locator('.sw-role-follow').uncheck();
      await dest.evaluate(()=>window.testSwitchRole(1));await until(async()=>(await dest.locator('.sw-title').textContent())==='Network A');
      await dest.locator('.sw-role-autoplay').uncheck();await dest.locator('.sw-main-play').click();
    });
    await test('corrupted backup fails before altering existing songs or media',async()=>{
      const before=await media(dest),previous=await settings(dest),bad=Buffer.from(backup);bad[bad.length-1]^=1;
      await upload(dest,'.sw-backup-input',bad,'broken.swbackup');await until(async()=>/校验失败/.test(await notice(dest)));
      assert.deepEqual((await settings(dest)).tracks,previous.tracks);assert.deepEqual(await media(dest),before);
    });
    await test('failed media write rolls back the entire restore transaction',async()=>{
      const before=await media(dest),previous=await settings(dest);
      await dest.evaluate(()=>{
        const put=IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put=function(...args){
          if(this.name==='covers') {IDBObjectStore.prototype.put=put;throw new DOMException('Forced test quota failure','QuotaExceededError');}
          return put.apply(this,args);
        };
      });
      await upload(dest,'.sw-backup-input',backup,'fixture.swbackup');
      await until(async()=>/Forced test quota failure/.test(await notice(dest)));
      assert.deepEqual(await settings(dest),previous);assert.deepEqual(await media(dest),before);
    });
    await test('network JSON exports stable IDs and excludes local IDs from role orders',async()=>{
      network=await download(page,'.sw-export');const data=JSON.parse(network);
      assert.deepEqual(data.tracks.map(t=>t.id),['net-1','net-2']);assert.deepEqual(data.roleOrders[ROLE],['net-2','net-1']);
    });
    const fresh=await fixture(browser,target,{tracks:[],orbPosition:{x:.8,y:.94}},false);await open(fresh);
    await test('network import maps new IDs and restores each character order',async()=>{
      await upload(fresh,'.sw-json-input',network);await until(async()=>(await settings(fresh)).tracks.length===2);
      const s=await settings(fresh);const ids=Object.fromEntries(s.tracks.map(t=>[t.title,t.id]));
      assert.deepEqual(s.roleOrders[ROLE],[ids['Network B'],ids['Network A']]);assert.deepEqual(s.roleOrders[OTHER],[ids['Network A']]);
      await fresh.locator('.sw-advanced > summary').click();await fresh.locator('.sw-role-follow').check();
      assert.equal(await fresh.locator('.sw-track .sw-track-name').first().textContent(),'Network B');
    });
    await test('repeat network imports reuse existing IDs without overwriting role order',async()=>{
      const s=await settings(fresh);await upload(fresh,'.sw-json-input',network);await until(async()=>/已在歌单中/.test(await notice(fresh)));
      const next=await settings(fresh);assert.equal(next.tracks.length,2);assert.deepEqual(next.roleOrders,s.roleOrders);assert.deepEqual(next.tracks.map(t=>t.id),s.tracks.map(t=>t.id));
    });
    await test('legacy v1/v2 network playlists import without erasing existing role order',async()=>{
      const previous=(await settings(fresh)).roleOrders;
      for(const version of [1,2]){
        await upload(fresh,'.sw-json-input',Buffer.from(JSON.stringify({format:'soundwalk-playlist',version,roleOrders:{[ROLE]:['missing-legacy-id']},tracks:[{title:'Legacy '+version,src:target+'/legacy'+version+'.wav',bindings:[ROLE]}]})));
        await until(async()=>(await settings(fresh)).tracks.some(t=>t.title==='Legacy '+version));
        assert.deepEqual((await settings(fresh)).roleOrders,previous);
      }
    });
    await test('empty legacy JSON points to full backup and leaves all settings intact',async()=>{
      const previous=await settings(fresh);await upload(fresh,'.sw-json-input',Buffer.from(JSON.stringify({format:'soundwalk-playlist',version:2,tracks:[],roleOrders:{[ROLE]:[]},characterLabels:{[ROLE]:'wrong'}})));
      await until(async()=>/没有可导入/.test(await notice(fresh)));assert.deepEqual(await settings(fresh),previous);
    });
    const local=await fixture(browser,target,{...raw,tracks:tracks.slice(0,2)},true);await open(local);await local.locator('.sw-storage > summary').click();
    await test('local-only songs cannot produce misleading empty network download',async()=>{
      let downloaded=false;local.on('download',()=>downloaded=true);await local.locator('.sw-export').click();
      assert.match(await notice(local),/都是本地音频.*完整备份/);await sleep(100);assert.equal(downloaded,false);
    });
    await test('v1/v2 full backups and v3 without framing restore centered defaults',async()=>{
      const length=Number(backup.subarray(6,18).toString()),original=JSON.parse(backup.subarray(18,18+length)),bytes=backup.subarray(18+length);
      for(const version of [1,2,3]){
        const meta=structuredClone(original);meta.version=version;delete meta.metadataCrc32;delete meta.settings.wallpaperView;delete meta.settings.networkAcceleration;
        if(version===1){meta.entries=meta.entries.filter(e=>e.kind!=='wallpaper');delete meta.settings.panelOpacity;delete meta.settings.frostBlur;}
        if(version===3)meta.metadataCrc32=crc32(Buffer.from(JSON.stringify(meta))).toString(16).padStart(8,'0');
        const data=Buffer.from(JSON.stringify(meta));const size=meta.entries.reduce((sum,e)=>sum+e.size,0);
        const old=Buffer.concat([Buffer.from('SWBK1\n'+String(data.length).padStart(12,'0')),data,bytes.subarray(0,size)]);
        await upload(local,'.sw-backup-input',old,'old.swbackup');await until(async()=>/安全恢复完成/.test(await notice(local)));
        assert.deepEqual((await settings(local)).wallpaperView,{zoom:100,x:50,y:50});assert.equal((await settings(local)).networkAcceleration,false);
        assert.equal(await local.locator('.sw-panel').evaluate(el=>el.classList.contains('sw-wallpaper-on')),version>=2);
      }
    });
    await test('restore defaults clears only wallpaper and framing, preserving audio and covers',async()=>{
      await local.locator('.sw-appearance-toggle').click();const before=await media(local);
      await local.locator('.sw-wallpaper-reset').click();await until(async()=>/已恢复默认/.test(await notice(local)));
      const after=await media(local);assert.deepEqual(after.tracks,before.tracks);
      assert.deepEqual(after.covers,before.covers.filter(([id])=>id!==WALL));
      const s=await settings(local);assert.deepEqual(s.wallpaperView,{zoom:100,x:50,y:50});assert.equal(s.panelOpacity,100);assert.equal(s.frostBlur,0);
    });
    await require('./network-playback.cjs')({browser,origin,fixture,test,until,range,open,upload,wav,artifacts});
    await require('./smart-loading.cjs')({browser,origin,fixture,test,until,open,upload,download,media,settings,wav,artifacts});
    assert.deepEqual(errors,[]);
    console.log(`${results.length} browser regression checks passed; artifacts: ${artifacts}`);
  }finally{for(const ctx of contexts)await ctx.close();await browser.close();for(const s of servers)s.close();}
})().catch(e=>{console.error(e);process.exitCode=1;for(const s of servers)s.close();});
