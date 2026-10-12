// Real native playback with injected optional network/visibility capabilities.
// Uses disposable songs/storage, never the user's browser data.
const assert=require('node:assert/strict');
const path=require('node:path');

module.exports=async function smartChecks({browser,origin,fixture,test,until,open,upload,download,media,settings,wav,artifacts}) {
  const raw={tracks:[0,1,2].map(i=>({id:'smart-'+i,title:'Smart '+i,artist:'未知歌手',kind:'url',src:origin+'/smart-'+i+'.wav',bindings:['avatar:regression-a.png']})),
    networkAcceleration:true,orbPosition:{x:.8,y:.94}};
  async function setup(data=raw) {
    const p=await fixture(browser,origin,data,false);
    await p.addInitScript(()=>{
      const connection=new EventTarget();
      Object.assign(connection,{saveData:false,effectiveType:'4g',rtt:50,downlink:10,type:'cellular'});
      window.preloadHarness={connection,missing:false,visible:true,loads:0,instances:0,trackWrites:0};
      Object.defineProperty(navigator,'connection',{configurable:true,get:()=>window.preloadHarness.missing?undefined:connection});
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.preloadHarness.visible?'visible':'hidden'});
      const Native=window.Audio;
      window.Audio=function(...args){window.preloadHarness.instances++;return new Native(...args);};
      const load=HTMLMediaElement.prototype.load;
      HTMLMediaElement.prototype.load=function(){window.preloadHarness.loads++;return load.call(this);};
      const put=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(...args){if(this.name==='tracks')window.preloadHarness.trackWrites++;return put.apply(this,args);};
    });
    await p.reload();await until(()=>p.evaluate(()=>Boolean(window.testAudio?.src)||JSON.parse(localStorage.getItem('soundwalk-player-v1')).tracks.length===0));
    return p;
  }
  const hint=p=>p.evaluate(()=>window.testAudio.preload);
  const counts=p=>p.evaluate(()=>({loads:window.preloadHarness.loads,instances:window.preloadHarness.instances}));
  const p=await setup();
  const requested=[];p.on('request',r=>{if(r.url().endsWith('.wav'))requested.push({url:r.url(),method:r.method()});});
  await test('history and role changes stay conservative until manual preparation',async()=>{
    assert.equal(await hint(p),'metadata');assert(await p.evaluate(()=>window.testAudio.paused));
    await p.evaluate(()=>window.testSwitchRole(1)); // History/character UI alone is not play intent.
    assert.equal(await hint(p),'metadata');assert.equal((await counts(p)).instances,1);
    assert.equal(await p.locator('.sw-main-play').getAttribute('aria-label'),'播放');
  });
  await test('manual open prepares only the selected source with no load or second Audio',async()=>{
    const before=await counts(p);await open(p);await until(async()=>(await hint(p))==='auto');
    assert.deepEqual(await counts(p),before);assert(await p.evaluate(()=>window.testAudio.paused));
    assert.equal(await p.locator('.sw-main-play').getAttribute('aria-busy'),'false');
    assert(requested.every(r=>r.url===raw.tracks[0].src&&r.method==='GET'));
    assert.deepEqual((await media(p)).tracks,[]);assert.deepEqual(await p.evaluate(()=>caches.keys()),[]);
    assert.equal(await p.evaluate(()=>window.preloadHarness.trackWrites),0);
    await p.locator('.sw-close').click();assert.equal(await hint(p),'metadata');
  });
  await test('data saver, poor quality and unknown network information disable active preload',async()=>{
    await open(p);const before=await counts(p);
    for(const patch of [{saveData:true},{saveData:false,effectiveType:'slow-2g'},
      {effectiveType:'2g'},{effectiveType:'3g'},{effectiveType:'4g',rtt:500},
      {rtt:50,downlink:.2},{downlink:10,effectiveType:undefined}]) {
      await p.evaluate(patch=>{Object.assign(window.preloadHarness.connection,patch);window.preloadHarness.connection.dispatchEvent(new Event('change'));},patch);
      assert.equal(await hint(p),'metadata');
    }
    await p.evaluate(()=>{window.preloadHarness.missing=true;window.dispatchEvent(new Event('online'));});
    assert.equal(await hint(p),'metadata');assert.deepEqual(await counts(p),before);
    // Missing API still permits immediate native user-gesture playback.
    await p.locator('.sw-main-play').click();await until(()=>p.evaluate(()=>!window.testAudio.paused&&window.testAudio.currentTime>0));
    assert.equal(await hint(p),'metadata');assert.equal(await p.locator('.sw-main-play').getAttribute('aria-label'),'暂停');
    await p.locator('.sw-main-play').click();
  });
  await test('background downgrade preserves actual playing and returning does not start preload',async()=>{
    await p.evaluate(()=>{window.preloadHarness.missing=false;Object.assign(window.preloadHarness.connection,{saveData:false,effectiveType:'4g',rtt:50,downlink:10});});
    const resumedFrom=await p.evaluate(()=>window.testAudio.currentTime);
    await p.locator('.sw-main-play').click();await until(()=>p.evaluate(time=>!window.testAudio.paused&&window.testAudio.currentTime>time+.02,resumedFrom));assert.equal(await hint(p),'auto');
    await until(async()=>(await p.locator('.sw-main-play').getAttribute('aria-label'))==='暂停');
    const before=await counts(p),time=await p.evaluate(()=>window.testAudio.currentTime);
    await p.evaluate(()=>{window.preloadHarness.visible=false;document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await hint(p),'metadata');assert.equal(await p.locator('.sw-main-play').getAttribute('aria-label'),'暂停');
    await until(()=>p.evaluate(time=>window.testAudio.currentTime>time+.1,time));
    await p.evaluate(()=>{window.preloadHarness.visible=true;document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await hint(p),'metadata');assert.deepEqual(await counts(p),before);
    await p.locator('.sw-main-play').click();
  });
  await test('rapid manual track changes keep one Audio and do not fetch upcoming songs',async()=>{
    requested.length=0;
    await p.locator('.sw-main-play').click();
    for(let i=0;i<5;i++){await p.locator('.sw-next').click();await p.locator('.sw-prev').click();}
    await until(()=>p.evaluate(()=>!window.testAudio.paused&&window.testAudio.currentTime>0));
    assert.equal(await p.locator('.sw-title').textContent(),'Smart 0');
    assert.equal(await p.evaluate(()=>window.testAudio.src),raw.tracks[0].src);
    assert.equal((await counts(p)).instances,1);assert.equal(await hint(p),'auto');
    assert(requested.every(r=>[raw.tracks[0].src,raw.tracks[1].src].includes(r.url)&&r.method==='GET'));
    assert.deepEqual((await media(p)).tracks,[]);assert.deepEqual(await p.evaluate(()=>caches.keys()),[]);
    await p.locator('.sw-main-play').click();assert.equal(await hint(p),'metadata');
  });
  let backup;
  await test('off switch restores metadata without losing buffers and persists in full backup',async()=>{
    await p.locator('.sw-advanced > summary').click();
    await p.locator('.sw-network-acceleration').selectOption('off');const before=await counts(p);
    await p.locator('.sw-network-acceleration').selectOption('smart');assert.equal(await hint(p),'auto');
    const buffer=await p.evaluate(()=>{const b=window.testAudio.buffered;return Array.from({length:b.length},(_,i)=>[b.start(i),b.end(i)]);});
    await p.locator('.sw-network-acceleration').selectOption('off');assert.equal(await hint(p),'metadata');assert.deepEqual(await counts(p),before);
    assert.deepEqual(await p.evaluate(()=>{const b=window.testAudio.buffered;return Array.from({length:b.length},(_,i)=>[b.start(i),b.end(i)]);}),buffer);
    await p.locator('.sw-storage > summary').click();backup=await download(p,'.sw-backup-export');
    const length=Number(backup.subarray(6,18).toString()),meta=JSON.parse(backup.subarray(18,18+length));
    assert.equal(meta.settings.networkAcceleration,false);assert.equal(meta.entries.length,0);
    await p.reload();await open(p);assert.equal(await hint(p),'metadata');assert.equal((await settings(p)).networkAcceleration,false);
  });
  await test('backup restore carries the option and old backup defaults stay compatible',async()=>{
    const dest=await setup();await open(dest);
    await upload(dest,'.sw-backup-input',backup,'smart-off.swbackup');await until(async()=>/安全恢复完成/.test(await dest.locator('.sw-notice').textContent()));
    assert.equal((await settings(dest)).networkAcceleration,false);assert.equal(await dest.locator('.sw-network-acceleration').inputValue(),'off');
    assert.deepEqual((await settings(dest)).tracks,raw.tracks);assert.deepEqual((await media(dest)).tracks,[]);
    await dest.locator('.sw-advanced > summary').click();
    await dest.screenshot({path:path.join(artifacts,'smart-acceleration-setting.png')});
  });
  await test('passive preload failure has no autoplay/retry loop and manual play retries normally',async()=>{
    const fail=await setup({tracks:[],networkAcceleration:true,orbPosition:raw.orbPosition});await open(fail);let requests=0;const requestHints=[];
    await fail.route('**/recover-preparation.wav',async route=>{
      requests++;requestHints.push(await fail.evaluate(()=>window.testAudio.preload));if(requests===1)await route.fulfill({status:503,body:'Temporary test failure'});
      else await route.fulfill({contentType:'audio/wav',body:wav});
    });
    await fail.locator('.sw-add-link').click();await fail.locator('.sw-name').fill('Retry preparation');
    await fail.locator('.sw-url').fill(origin+'/recover-preparation.wav');await fail.locator('.sw-save').click();
    await until(()=>fail.evaluate(()=>Boolean(window.testAudio.error)));assert.equal(await hint(fail),'metadata');
    assert.equal(await fail.locator('.sw-main-play').getAttribute('aria-label'),'播放');assert.equal(requests,1);assert.equal(requestHints[0],'auto');
    await fail.locator('.sw-main-play').click();await until(()=>fail.evaluate(()=>!window.testAudio.paused&&window.testAudio.currentTime>0));
    assert.equal(await fail.locator('.sw-main-play').getAttribute('aria-busy'),'false');assert(requests>=2);
    await fail.locator('.sw-main-play').click();
  });
};
