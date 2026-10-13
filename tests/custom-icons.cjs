// Only synthetic canvas pictures; no user artwork is stored in this repository.
const assert=require('node:assert/strict');
const path=require('node:path');
const {crc32}=require('node:zlib');
const KEYS={closed:'__soundwalk_private_icon_closed_v1__',open:'__soundwalk_private_icon_open_v1__'};
module.exports=async({browser,origin,target,fixture,test,until,open,upload,download,media,settings,artifacts})=>{
  const role='avatar:regression-a.png';
  const raw={tracks:[{id:'private-local',title:'Local music',kind:'file',bindings:[role]},{id:'private-net',title:'Network music',kind:'url',src:origin+'/private.wav',bindings:[role]}],index:0,closedPet:'owl',openPet:'shepherd',networkAcceleration:true,roleOrders:{[role]:['private-local','private-net']},orbPosition:{x:0,y:.1}};
  const p=await fixture(browser,origin,raw,true,{width:320,height:720},{isMobile:true,hasTouch:true});await open(p);
  const ready=page=>until(()=>page.locator('.sw-custom-reset').isEnabled());
  await ready(p);await p.locator('.sw-pet-settings-toggle').tap();
  const originals=await media(p),originalSettings=await settings(p),requests=[];
  p.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  const images={};
  for(const type of ['png','webp','jpeg'])images[type]=Buffer.from(await p.evaluate(async type=>{
    const c=document.createElement('canvas');c.width=400;c.height=200;
    const ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,100,200);ctx.fillStyle='#0000ff';ctx.fillRect(300,0,100,200);
    const b=await new Promise(resolve=>c.toBlob(resolve,'image/'+type));return Array.from(new Uint8Array(await b.arrayBuffer()));
  },type));
  async function choose(page,state,bytes=images.png,type='png'){
    const pending=page.waitForEvent('filechooser');
    await page.locator(`[data-custom-upload="${state}"]`).click();
    await (await pending).setFiles({name:'synthetic.'+(type==='jpeg'?'jpg':type),mimeType:'image/'+type,buffer:bytes});
    await ready(page);
  }
  const icons=async page=>(await media(page)).covers.filter(([id])=>Object.values(KEYS).includes(id));
  async function pixels(page,state){return page.evaluate(async key=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('soundwalk-player-audio-v1',2);r.onsuccess=()=>resolve(r.result);});
    const b=await new Promise(resolve=>{const r=db.transaction('covers').objectStore('covers').get(key);r.onsuccess=()=>resolve(r.result);});db.close();
    const img=await createImageBitmap(b),c=document.createElement('canvas');c.width=c.height=256;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0);img.close();
    return {type:b.type,size:b.size,width:c.width,points:[[0,128],[255,128],[128,0],[128,128]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data))};
  },KEYS[state]);}
  await test('private PNG/JPG uploads preserve complete contours, alpha and independent states',async()=>{
    await choose(p,'closed');assert.equal((await settings(p)).closedPet,'custom');assert.equal((await settings(p)).openPet,'shepherd');
    const png=await pixels(p,'closed');assert.equal(png.type,'image/png');assert.equal(png.width,256);
    assert.deepEqual(png.points,[[255,0,0,255],[0,0,255,255],[0,0,0,0],[0,0,0,0]]);
    await choose(p,'open',images.jpeg,'jpeg');assert.equal((await settings(p)).openPet,'custom');
    const jpeg=await pixels(p,'open');assert.equal(jpeg.points[2][3],0);assert.equal(jpeg.points[0][3],255);
    const src=await p.locator('.sw-orb-pet img').getAttribute('src');assert(src.startsWith('blob:'));
    await p.locator('.sw-close').tap();assert.notEqual(await p.locator('.sw-orb-pet img').getAttribute('src'),src);
    await open(p);await p.locator('.sw-pet-settings-toggle').tap();
    const now=await media(p);assert.deepEqual(now.tracks,originals.tracks);assert.deepEqual(now.covers.filter(([id])=>!Object.values(KEYS).includes(id)),originals.covers);
    const s=await settings(p);assert.deepEqual(s.tracks,originalSettings.tracks);assert.deepEqual(s.roleOrders,originalSettings.roleOrders);assert.equal(s.networkAcceleration,true);
  });
  await test('one transparent WebP can serve both states without uploading or Base64 preferences',async()=>{
    if(await p.locator('.sw-pet-settings').isHidden())await p.locator('.sw-pet-settings-toggle').tap();
    await choose(p,'both',images.webp,'webp');const data=await icons(p);assert.equal(data.length,2);assert.deepEqual(data[0].slice(1),data[1].slice(1));
    const s=await settings(p);assert.equal(s.closedPet,'custom');assert.equal(s.openPet,'custom');
    const text=await p.evaluate(()=>localStorage.getItem('soundwalk-player-v1'));assert(!text.includes('blob:'));assert(!text.includes('data:image'));
    assert(requests.every(r=>r.method==='GET'&&(r.url.startsWith(origin+'/')||r.url.startsWith('blob:'+origin+'/'))));
  });
  await test('custom choices coexist with builtin stickers and survive reload and default reset',async()=>{
    const saved=await icons(p);
    await p.locator('.sw-pet-choice[data-state="closed"][data-pet="userGhost"]').tap();assert.equal((await settings(p)).closedPet,'userGhost');
    await p.locator('.sw-custom-choice[data-state="closed"]').tap();assert.equal((await settings(p)).closedPet,'custom');
    await p.reload();await ready(p);assert.equal((await settings(p)).closedPet,'custom');assert.equal((await settings(p)).openPet,'custom');
    assert((await p.locator('.sw-orb-pet img').getAttribute('src')).startsWith('blob:'));
    await open(p);await p.locator('.sw-pet-settings-toggle').tap();
    await p.locator('.sw-custom-reset').tap();assert.equal((await settings(p)).closedPet,'cat');assert.equal((await settings(p)).openPet,'golden');assert.deepEqual(await icons(p),saved);
    await p.locator('.sw-custom-choice[data-state="closed"]').tap();await p.locator('.sw-custom-choice[data-state="open"]').tap();
    assert.equal(await p.locator('.sw-custom-choice[data-state="open"]').getAttribute('aria-pressed'),'true');
  });
  await test('320px mobile controls remain reachable and custom icon retains tap and drag behavior',async()=>{
    for(const selector of ['[data-custom-upload="closed"]','[data-custom-upload="open"]','[data-custom-upload="both"]','[data-custom-delete="closed"]','.sw-custom-reset']){
      await p.locator(selector).scrollIntoViewIfNeeded();const b=await p.locator(selector).boundingBox();assert(b.x>=0&&b.x+b.width<=320&&b.y>=0&&b.y+b.height<=720);
    }
    assert(await p.locator('.sw-panel-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await p.locator('.sw-custom-pets').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(artifacts,'custom-icons-mobile.png')});
    await p.locator('.sw-orb').tap();assert(await p.locator('.sw-panel').isHidden());
    const box=await p.locator('.sw-orb').boundingBox();
    await p.locator('.sw-orb').dispatchEvent('pointerdown',{pointerId:21,pointerType:'touch',isPrimary:true,clientX:box.x+28,clientY:box.y+28});
    await p.locator('.sw-orb').dispatchEvent('pointermove',{pointerId:21,pointerType:'touch',isPrimary:true,clientX:230,clientY:200});
    await p.locator('.sw-orb').dispatchEvent('pointerup',{pointerId:21,pointerType:'touch',isPrimary:true,clientX:230,clientY:200});
    assert(await p.locator('.sw-panel').isHidden());assert((await settings(p)).orbPosition.x>0);
    await p.locator('.sw-orb').tap();assert(await p.locator('.sw-panel').isVisible());
    if(await p.locator('.sw-pet-settings').isHidden())await p.locator('.sw-pet-settings-toggle').tap();
  });
  await test('bad, oversized and disguised image uploads leave existing icons intact',async()=>{
    const before=await icons(p),s=await settings(p);
    const huge=Buffer.alloc(8*1024*1024+1);images.png.copy(huge);
    const dimensions=Buffer.from(images.png);dimensions.writeUInt32BE(5000,16);dimensions.writeUInt32BE(5000,20);
    for(const [bytes,type] of [[Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://invalid.example/x"/></svg>'),'png'],[huge,'png'],[dimensions,'png'],[Buffer.from([255,216,255]),'jpeg'],[images.png,'gif']]){
      await choose(p,'both',bytes,type);assert.deepEqual(await icons(p),before);assert.equal((await settings(p)).closedPet,s.closedPet);assert.equal((await settings(p)).openPet,s.openPet);
      assert(!/已保存并使用/.test(await p.locator('.sw-custom-status').textContent()));
    }
  });
  await test('failed shared-icon storage rolls back both images and replacement releases old URLs',async()=>{
    const before=await icons(p);
    await p.evaluate(key=>{window.originalIconPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,id){if(id===key)throw new DOMException('Test quota','QuotaExceededError');return window.originalIconPut.call(this,value,id);};},KEYS.open);
    await choose(p,'both');assert.deepEqual(await icons(p),before);
    await p.evaluate(()=>{IDBObjectStore.prototype.put=window.originalIconPut;});
    const old=await p.locator('.sw-custom-choice[data-state="open"] img').getAttribute('src');
    await choose(p,'both');assert.equal(await p.evaluate(url=>fetch(url).then(()=>true,()=>false),old),false);
  });
  await test('deleting one private icon cleans only its local bytes and preserves the other state',async()=>{
    const saved=await icons(p),old=await p.locator('.sw-custom-choice[data-state="closed"] img').getAttribute('src');
    await p.locator('[data-custom-delete="closed"]').tap();await ready(p);
    assert.equal((await settings(p)).closedPet,'cat');assert.equal((await settings(p)).openPet,'custom');
    assert.deepEqual(await icons(p),saved.filter(([id])=>id===KEYS.open));assert(await p.locator('.sw-custom-choice[data-state="closed"]').isDisabled());
    assert.equal(await p.evaluate(url=>fetch(url).then(()=>true,()=>false),old),false);
    assert.deepEqual((await media(p)).tracks,originals.tracks);await choose(p,'both');
  });
  let backup;
  const unpack=b=>{const n=Number(b.subarray(6,18).toString());return {n,meta:JSON.parse(b.subarray(18,18+n))};};
  await test('network JSON excludes private pictures while explicit full backup includes checked icons',async()=>{
    await p.locator('.sw-storage > summary').click();const json=JSON.parse((await download(p,'.sw-export')).toString());
    assert.deepEqual(Object.keys(json).sort(),['characterLabels','format','roleOrders','tracks','version'].sort());assert(!JSON.stringify(json).includes('custom'));
    backup=await download(p,'.sw-backup-export');const {meta}=unpack(backup);assert.equal(meta.version,4);
    assert.equal(meta.settings.closedPet,'custom');assert.equal(meta.settings.openPet,'custom');assert.equal(meta.entries.filter(e=>e.kind==='privatePet').length,2);
  });
  const dest=await fixture(browser,target,{tracks:[],orbPosition:{x:0,y:.1}},false);await ready(dest);await open(dest);
  await test('v4 complete backup restores private icons and music byte for byte on another origin',async()=>{
    await upload(dest,'.sw-backup-input',backup,'private.swbackup');await until(async()=>/安全恢复完成/.test(await dest.locator('.sw-notice').textContent()));
    assert.deepEqual(await media(dest),await media(p));assert.equal((await settings(dest)).closedPet,'custom');assert.equal((await settings(dest)).openPet,'custom');
    await dest.reload();await ready(dest);assert((await dest.locator('.sw-orb-pet img').getAttribute('src')).startsWith('blob:'));await open(dest);
  });
  await test('corrupt icons and failed v4 restore cannot partially overwrite any media',async()=>{
    const before=await media(dest),s=await settings(dest),broken=Buffer.from(backup);broken[broken.length-1]^=1;
    await upload(dest,'.sw-backup-input',broken,'broken.swbackup');await until(async()=>/校验失败/.test(await dest.locator('.sw-notice').textContent()));
    assert.deepEqual(await media(dest),before);assert.deepEqual(await settings(dest),s);
    await dest.evaluate(key=>{window.originalIconPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,id){if(id===key)throw new DOMException('Test quota','QuotaExceededError');return window.originalIconPut.call(this,v,id);};},KEYS.open);
    await upload(dest,'.sw-backup-input',backup,'quota.swbackup');await until(()=>dest.locator('.sw-backup-import').isEnabled());
    assert.deepEqual(await media(dest),before);assert.deepEqual(await settings(dest),s);
    await dest.evaluate(()=>{IDBObjectStore.prototype.put=window.originalIconPut;});
  });
  await test('legacy v3 restore preserves recipient private storage and v4 removes absent state',async()=>{
    const {n,meta}=unpack(backup);delete meta.metadataCrc32;meta.version=3;meta.settings.closedPet='cat';meta.settings.openPet='golden';meta.entries=meta.entries.filter(e=>e.kind!=='privatePet');
    meta.metadataCrc32=crc32(Buffer.from(JSON.stringify(meta))).toString(16).padStart(8,'0');const bytes=Buffer.from(JSON.stringify(meta));
    const count=meta.entries.reduce((sum,e)=>sum+e.size,0),old=Buffer.concat([Buffer.from('SWBK1\n'+String(bytes.length).padStart(12,'0')),bytes,backup.subarray(18+n,18+n+count)]);
    const before=await icons(dest);await upload(dest,'.sw-backup-input',old,'v3.swbackup');await until(async()=>/安全恢复完成/.test(await dest.locator('.sw-notice').textContent()));
    assert.deepEqual(await icons(dest),before);assert.equal((await settings(dest)).closedPet,'cat');
    await p.locator('[data-custom-delete="open"]').click();await ready(p);
    const single=await download(p,'.sw-backup-export');await upload(dest,'.sw-backup-input',single,'single.swbackup');await until(async()=>/安全恢复完成/.test(await dest.locator('.sw-notice').textContent()));
    assert.equal((await icons(dest)).length,1);assert.equal((await settings(dest)).openPet,'golden');
  });
  await test('missing, corrupt or inaccessible local icons fall back without damaging music',async()=>{
    await choose(p,'both');
    await p.evaluate(async key=>{const db=await new Promise(resolve=>{const r=indexedDB.open('soundwalk-player-audio-v1',2);r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('covers','readwrite');tx.objectStore('covers').put(new Blob(['bad'],{type:'image/png'}),key);tx.oncomplete=resolve;});db.close();},KEYS.closed);
    await p.reload();await ready(p);assert.equal((await settings(p)).closedPet,'cat');assert.equal((await settings(p)).openPet,'custom');
    await open(p);await p.locator('.sw-pet-settings-toggle').tap();assert(await p.locator('[data-custom-delete="closed"]').isEnabled());
    await p.locator('[data-custom-delete="closed"]').tap();await ready(p);await choose(p,'both');
    await p.locator('.sw-orb-pet img').dispatchEvent('error');assert.equal((await settings(p)).openPet,'golden');
    await choose(p,'both');
    await p.evaluate(async keys=>{const db=await new Promise(resolve=>{const r=indexedDB.open('soundwalk-player-audio-v1',2);r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('covers','readwrite');for(const key of Object.values(keys))tx.objectStore('covers').delete(key);tx.oncomplete=resolve;});db.close();},KEYS);
    await p.reload();await ready(p);assert.equal((await settings(p)).closedPet,'cat');assert.equal((await settings(p)).openPet,'golden');
    await open(p);await p.locator('.sw-pet-settings-toggle').tap();await choose(p,'both');
    await p.evaluate(()=>{window.originalIconGet=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(key){if(String(key).startsWith('__soundwalk_private_icon_'))throw new Error('Test read denied');return window.originalIconGet.call(this,key);};});
    // Persist the access failure across reload without changing other stores.
    await p.addInitScript(()=>{const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(key){if(String(key).startsWith('__soundwalk_private_icon_'))throw new Error('Test read denied');return get.call(this,key);};});
    await p.reload();await ready(p);assert.equal((await settings(p)).closedPet,'cat');assert.equal((await settings(p)).openPet,'golden');
    assert.deepEqual((await media(p)).tracks,originals.tracks);await open(p);await p.locator('.sw-main-play').tap();await until(()=>p.evaluate(()=>!window.testAudio.paused&&window.testAudio.currentTime>0));
  });
};
