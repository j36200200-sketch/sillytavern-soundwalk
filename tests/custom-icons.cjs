// Synthetic images only; no personal artwork or account data is included.
const assert=require('node:assert/strict');
const path=require('node:path');
const {crc32}=require('node:zlib');
const PREFIX='__soundwalk_private_gallery_v1__:';
const key=(user,id)=>PREFIX+encodeURIComponent(user)+':'+id;
module.exports=async({browser,origin,target,fixture,test,until,open,upload,download,media,settings,artifacts})=>{
 const raw={tracks:[{id:'gallery-local',title:'Local',kind:'file',bindings:['avatar:regression-a.png']},{id:'gallery-net',title:'Network',kind:'url',src:origin+'/gallery.wav',bindings:[]}],closedPet:'owl',openPet:'shepherd',orbPosition:{x:0,y:.1}};
 const p=await fixture(browser,origin,raw,true,{width:320,height:720},{isMobile:true,hasTouch:true,extraHTTPHeaders:{'X-Test-User':'alice'}});
 const ready=page=>until(()=>page.locator('[data-custom-upload="closed"]').isEnabled());
 await ready(p);await open(p);await p.locator('.sw-pet-settings-toggle').tap();await ready(p);
 const originals=await media(p),requests=[];p.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 async function data(page,user='account:alice'){return page.evaluate(async k=>{const db=await new Promise(resolve=>{const r=indexedDB.open('soundwalk-player-audio-v1',2);r.onsuccess=()=>resolve(r.result);});const v=await new Promise(resolve=>{const r=db.transaction('covers').objectStore('covers').get(k);r.onsuccess=()=>resolve(r.result);});db.close();return v||{items:[],selections:{},revision:0};},key(user,'meta'));}
 async function bytes(page,id,user='account:alice'){return (await media(page)).covers.find(([k])=>k===key(user,id));}
 const imgs=[];
 for(let i=0;i<6;i++)imgs.push(Buffer.from(await p.evaluate(async i=>{const c=document.createElement('canvas');c.width=400;c.height=200;const ctx=c.getContext('2d');ctx.fillStyle=['red','blue','green','yellow','purple','orange'][i];ctx.fillRect(0,0,100,200);ctx.fillRect(300,0,100,200);const b=await new Promise(resolve=>c.toBlob(resolve,'image/png'));return Array.from(new Uint8Array(await b.arrayBuffer()));},i)));
 async function add(page,state,files){const wait=page.waitForEvent('filechooser');await page.locator(`[data-custom-upload="${state}"]`).click();await(await wait).setFiles(files);await until(()=>page.locator('.sw-custom-reset').isEnabled());}
 const file=(b,i=0,type='png')=>({name:'Private '+i+'.'+type,mimeType:'image/'+type,buffer:b});
 async function choose(page,id,state='closed'){await page.locator(`.sw-private-choice[data-state="${state}"][data-pet="private:${id}"]`).tap();await ready(page);assert.equal((await data(page)).selections[state],'private:'+id);}
 async function scope(page,user){await page.setExtraHTTPHeaders({'X-Test-User':user});await page.reload();await ready(page);await open(page);await page.locator('.sw-pet-settings-toggle').click();await ready(page);}
 await test('five consecutive private uploads are appended beside builtins; the sixth preserves all five',async()=>{
  for(let i=0;i<5;i++)await add(p,'closed',[file(imgs[i],i)]);
  const first=await data(p);assert.equal(first.items.length,5);assert.equal(await p.locator('.sw-pet-closed-choices .sw-private-choice').count(),5);assert.equal(await p.locator('.sw-pet-open-choices .sw-private-choice').count(),5);
  const before=await Promise.all(first.items.map(x=>bytes(p,x.id)));await add(p,'both',[file(imgs[5],5)]);
  const all=await data(p);assert.deepEqual(all.items.slice(0,5),first.items);assert.equal(all.items.length,6);
  assert.deepEqual(await Promise.all(first.items.map(x=>bytes(p,x.id))),before);assert.equal(all.selections.closed,all.selections.open);
  const now=await media(p);assert.deepEqual(now.tracks,originals.tracks);assert.deepEqual(now.covers.filter(([id])=>!id.startsWith(PREFIX)),originals.covers);
 });
 await test('any gallery image can be selected independently, renamed, restored after reload and reset without deletion',async()=>{
  const all=await data(p);await choose(p,all.items[1].id);await choose(p,all.items[3].id,'open');
  p.removeAllListeners('dialog');p.on('dialog',d=>d.type()==='prompt'?d.accept('My portrait'):d.accept());
  await p.locator(`[data-gallery-action="rename"][data-icon-id="${all.items[1].id}"]`).first().click();await ready(p);assert.equal((await data(p)).items[1].name,'My portrait');
  await p.reload();await ready(p);assert((await p.locator('.sw-orb-pet img').getAttribute('src')).startsWith('blob:'));await open(p);await p.locator('.sw-pet-settings-toggle').click();await ready(p);
  assert.equal((await data(p)).selections.open,'private:'+all.items[3].id);await p.locator('.sw-custom-reset').click();await ready(p);assert.equal((await data(p)).items.length,6);assert.equal((await data(p)).selections.closed,'cat');
  await choose(p,all.items[1].id);await choose(p,all.items[3].id,'open');
  await p.locator('.sw-custom-pets').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(artifacts,'private-gallery-mobile.png')});
  assert(await p.locator('.sw-panel-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await p.locator('.sw-close').click();assert((await p.locator('.sw-orb-pet img').getAttribute('src')).startsWith('blob:'));
  const orb=p.locator('.sw-orb'),before=await orb.boundingBox(),touch=await p.context().newCDPSession(p);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:before.x+28,y:before.y+28}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:before.x+98,y:before.y+68}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
  const after=await orb.boundingBox();assert(after.x>before.x+40);assert.equal(await p.locator('.sw-panel').isVisible(),false);
  await p.waitForTimeout(800);await orb.tap();assert.equal(await p.locator('.sw-panel').isVisible(),true);assert((await p.locator('.sw-orb-pet img').getAttribute('src')).startsWith('blob:'));
  await orb.tap();assert.equal(await p.locator('.sw-panel').isVisible(),false);await open(p);
 });
 await test('a second account on the same origin sees no first-account images and cannot alter its selection',async()=>{
  const a=await data(p);await scope(p,'bob');assert.equal((await data(p,'account:bob')).items.length,0);assert.equal(await p.locator('.sw-private-choice').count(),0);
  await add(p,'closed',[file(imgs[0],99)]);assert.equal((await data(p,'account:bob')).items.length,1);assert.deepEqual(await data(p),a);
  await scope(p,'alice');assert.equal((await data(p)).items.length,6);assert.equal(await p.locator('.sw-pet-closed-choices .sw-private-choice').count(),6);
  assert.equal((await data(p)).selections.open,a.selections.open);
 });
 await test('deleting a selected gallery record preserves other records, bytes and the other account',async()=>{
  const a=await data(p),b=await data(p,'account:bob'),id=a.items[1].id;
  await p.locator(`[data-gallery-action="delete"][data-icon-id="${id}"]`).first().click();await ready(p);
  const after=await data(p);assert.equal(after.items.length,5);assert.equal(after.selections.closed,'cat');assert.equal(after.selections.open,a.selections.open);assert.equal(await bytes(p,id),undefined);assert.deepEqual(await data(p,'account:bob'),b);
 });
 await test('PNG alpha and complete proportions survive; WebP and JPEG append records',async()=>{
  const first=(await data(p)).items[0];const values=await p.evaluate(async k=>{const db=await new Promise(resolve=>{const r=indexedDB.open('soundwalk-player-audio-v1',2);r.onsuccess=()=>resolve(r.result);});const b=await new Promise(resolve=>{const r=db.transaction('covers').objectStore('covers').get(k);r.onsuccess=()=>resolve(r.result);});db.close();const im=await createImageBitmap(b),c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);im.close();return [[0,128],[255,128],[128,0],[128,128]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));},key('account:alice',first.id));
  assert.deepEqual(values,[[255,0,0,255],[255,0,0,255],[0,0,0,0],[0,0,0,0]]);
  for(const type of ['webp','jpeg']){const b=Buffer.from(await p.evaluate(async type=>{const c=document.createElement('canvas');c.width=80;c.height=40;c.getContext('2d').fillRect(0,0,80,40);const b=await new Promise(resolve=>c.toBlob(resolve,'image/'+type));return Array.from(new Uint8Array(await b.arrayBuffer()));},type));await add(p,'open',[file(b,type,type)]);}
  assert.equal((await data(p)).items.length,7);
  assert(requests.every(r=>r.method==='GET'&&(r.url.startsWith(origin+'/')||r.url.startsWith('blob:'+origin+'/'))));
  assert(!(await p.evaluate(()=>localStorage.getItem('soundwalk-player-v1'))).includes('data:image'));
 });
 await test('bad images and quota failures preserve all gallery records and current selections atomically',async()=>{
  const before=await data(p),imagesBefore=(await media(p)).covers;
  await add(p,'both',[file(Buffer.from('<svg/>'))]);assert.deepEqual(await data(p),before);
  await p.evaluate(()=>{window.oldPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(String(k).startsWith('__soundwalk_private_gallery_v1__:')&&String(k).endsWith(':meta'))throw new DOMException('quota','QuotaExceededError');return window.oldPut.call(this,v,k);};});
  await add(p,'both',[file(imgs[0],10),file(imgs[1],11)]);assert.deepEqual(await data(p),before);assert.deepEqual((await media(p)).covers,imagesBefore);
  await p.evaluate(()=>{IDBObjectStore.prototype.put=window.oldPut;});
 });
 await test('capacity rejection does not replace existing records when many files are selected',async()=>{
  const before=await data(p);await add(p,'closed',Array.from({length:61},(_,i)=>file(imgs[0],i+100)));assert.deepEqual(await data(p),before);assert.match(await p.locator('.sw-custom-status').textContent(),/最多60张/);
 });
 let backup;
 await test('network JSON omits private gallery; full backup packs all names and images only from active account',async()=>{
  await p.locator('.sw-storage > summary').click();const j=JSON.parse((await download(p,'.sw-export')).toString());assert(!JSON.stringify(j).includes('privateGallery'));
  backup=await download(p,'.sw-backup-export');const n=Number(backup.subarray(6,18).toString()),m=JSON.parse(backup.subarray(18,18+n));assert.equal(m.version,5);assert.equal(m.settings.privateGallery.length,7);assert.equal(m.entries.filter(x=>x.kind==='privatePet').length,7);assert(!JSON.stringify(m).includes('account:alice'));assert(!JSON.stringify(m).includes('Private 99'));
 });
 const dest=await fixture(browser,target,{tracks:[],orbPosition:{x:0,y:.1}},false,undefined,{extraHTTPHeaders:{'X-Test-User':'recipient'}});await ready(dest);await open(dest);
 await test('v5 backup restores gallery, names and selections into recipient account; corrupt media cannot overwrite it',async()=>{
  await upload(dest,'.sw-backup-input',backup,'gallery.swbackup');await until(async()=>/安全恢复完成/.test(await dest.locator('.sw-notice').textContent()));
  const a=await data(p),d=await data(dest,'account:recipient');assert.deepEqual(d.items,a.items);assert.deepEqual(d.selections,a.selections);
  for(const item of a.items)assert.deepEqual((await bytes(dest,item.id,'account:recipient')).slice(1),(await bytes(p,item.id)).slice(1));
  const before=await media(dest),bad=Buffer.from(backup);bad[bad.length-1]^=1;await upload(dest,'.sw-backup-input',bad,'bad.swbackup');await until(async()=>/校验失败/.test(await dest.locator('.sw-notice').textContent()));assert.deepEqual(await media(dest),before);
  const directory=await data(dest,'account:recipient');
  await dest.evaluate(()=>{window.oldPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(String(k).startsWith('__soundwalk_private_gallery_v1__:')&&String(k).endsWith(':meta'))throw new DOMException('quota','QuotaExceededError');return window.oldPut.call(this,v,k);};});
  await upload(dest,'.sw-backup-input',backup,'quota.swbackup');await until(()=>dest.locator('.sw-backup-import').isEnabled());assert.deepEqual(await media(dest),before);assert.deepEqual(await data(dest,'account:recipient'),directory);
  await dest.evaluate(()=>{IDBObjectStore.prototype.put=window.oldPut;});
 });
 await test('previous v4 two-icon backups migrate to gallery records and preserve both selections',async()=>{
  const n=Number(backup.subarray(6,18).toString()),m=JSON.parse(backup.subarray(18,18+n));let offset=18+n;const parts=[];let count=0;
  m.entries=m.entries.flatMap(entry=>{const bytes=backup.subarray(offset,offset+entry.size);offset+=entry.size;if(entry.kind==='privatePet'){if(count>=2)return [];entry.id='__soundwalk_private_icon_'+(['closed','open'][count++])+'_v1__';}parts.push(bytes);return [entry];});
  m.version=4;delete m.settings.privateGallery;m.settings.closedPet=m.settings.openPet='custom';delete m.metadataCrc32;m.metadataCrc32=crc32(Buffer.from(JSON.stringify(m))).toString(16).padStart(8,'0');const info=Buffer.from(JSON.stringify(m));
  const legacy=Buffer.concat([Buffer.from('SWBK1\n'+String(info.length).padStart(12,'0')),info,...parts]);await upload(dest,'.sw-backup-input',legacy,'v4.swbackup');await until(async()=>/安全恢复完成/.test(await dest.locator('.sw-notice').textContent()));
  const d=await data(dest,'account:recipient');assert.equal(d.items.length,2);assert.equal(d.selections.closed,'private:icon-legacy-closed');assert.equal(d.selections.open,'private:icon-legacy-open');
 });
 await test('legacy unscoped files require explicit one-time import and are not assigned to a second account',async()=>{
  const old=await fixture(browser,target,{tracks:[],closedPet:'custom',openPet:'custom',orbPosition:{x:0,y:.1}},false,undefined,{extraHTTPHeaders:{'X-Test-User':'legacy-owner'}});await ready(old);
  const converted=await bytes(p,(await data(p)).items[0].id);
  await old.evaluate(async bytes=>{const db=await new Promise(resolve=>{const r=indexedDB.open('soundwalk-player-audio-v1',2);r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const tx=db.transaction('covers','readwrite');for(const state of ['closed','open'])tx.objectStore('covers').put(new Blob([new Uint8Array(bytes)],{type:'image/png'}),'__soundwalk_private_icon_'+state+'_v1__');tx.oncomplete=resolve;});db.close();},converted[2]);
  await old.evaluate(()=>{const v=JSON.parse(localStorage.getItem('soundwalk-player-v1'));v.closedPet=v.openPet='custom';localStorage.setItem('soundwalk-player-v1',JSON.stringify(v));});
  await old.reload();await ready(old);assert.equal((await settings(old)).closedPet,'custom');await old.reload();await ready(old);await open(old);await old.locator('.sw-pet-settings-toggle').click();await ready(old);assert.equal(await old.locator('.sw-private-choice').count(),0);assert(await old.locator('.sw-gallery-migrate').isVisible());
  const legacyFiles=(await media(old)).covers.filter(([id])=>id.startsWith('__soundwalk_private_icon_'));
  await old.locator('.sw-gallery-migrate').click();await ready(old);const migrated=await data(old,'account:legacy-owner');assert.equal(migrated.items.length,2);assert.equal(migrated.selections.closed,'private:'+migrated.items[0].id);assert.equal(migrated.selections.open,'private:'+migrated.items[1].id);assert.deepEqual((await media(old)).covers.filter(([id])=>id.startsWith('__soundwalk_private_icon_')),legacyFiles);
  await scope(old,'legacy-other');assert.equal(await old.locator('.sw-private-choice').count(),0);assert(await old.locator('.sw-gallery-migrate').isHidden());
 });
 await test('unknown account environment clearly warns about browser-only isolation',async()=>{
  const unknown=await fixture(browser,target,{tracks:[],orbPosition:{x:0,y:.1}},false);await ready(unknown);await open(unknown);await unknown.locator('.sw-pet-settings-toggle').click();await ready(unknown);assert.match(await unknown.locator('.sw-gallery-scope').textContent(),/不是严格账户隔离/);assert.equal(await unknown.locator('.sw-private-choice').count(),0);
 });
 await test('account changes during upload cannot append to or display the previous account gallery',async()=>{
  const a=await data(p);await p.setExtraHTTPHeaders({'X-Test-User':'bob'});await add(p,'closed',[file(imgs[0],777)]);assert.deepEqual(await data(p),a);assert.equal(await p.locator('.sw-private-choice').count(),0);assert.match(await p.locator('.sw-custom-status').textContent(),/账户状态变化/);
 });
};
