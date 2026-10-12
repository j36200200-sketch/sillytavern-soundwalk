// Delayed native media plus deterministic media-event/Promise fault injection.
// Invoked by regression.cjs; no real user storage or third-party runtime code.
const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function networkChecks({browser,origin,fixture,test,until,range,open,upload,wav,artifacts}) {
  async function addSongs(page, suffix='') {
    await upload(page,'.sw-json-input',Buffer.from(JSON.stringify({format:'soundwalk-playlist',version:2,tracks:[
      {title:'Slow A',src:origin+'/slow-a'+suffix+'.wav'},
      {title:'Slow B',src:origin+'/slow-b'+suffix+'.wav'}
    ]})));
    await until(async()=>(await page.locator('.sw-title').textContent())==='Slow A');
  }
  const busy = page => page.locator('.sw-main-play').getAttribute('aria-busy');
  const label = page => page.locator('.sw-main-play').getAttribute('aria-label');
  const text = page => page.locator('.sw-load-text').textContent();
  const status = page => page.locator('.sw-load-status').isVisible();
  const raw={tracks:[],orbPosition:{x:.8,y:.94}};

  const slow=await fixture(browser,origin,raw,false);await open(slow);
  await slow.clock.install();
  let release;const gate=new Promise(resolve=>release=resolve);
  await slow.route('**/slow-a-native.wav',async route=>{
    await gate;
    try {await route.fulfill({contentType:'audio/wav',body:wav});} catch { /* Canceled native requests can close the route. */ }
  });
  await addSongs(slow,'-native');
  await test('network click shows immediate loading and graded 5/15/20s hints without canceling',async()=>{
    await slow.locator('.sw-main-play').click();
    assert.equal(await busy(slow),'true');assert.equal(await label(slow),'取消加载');assert(await status(slow));
    assert.equal(await text(slow),'正在加载音乐…');
    await slow.clock.runFor(5000);assert.equal(await text(slow),'网络较慢，正在努力加载…');
    await slow.clock.runFor(10000);assert.equal(await text(slow),'网络似乎不太稳定，仍在尝试加载');
    await slow.clock.runFor(5000);assert.equal(await text(slow),'加载较久，可取消后重试');
    assert.equal(await busy(slow),'true');assert.equal(await label(slow),'取消加载');
    assert.equal(await slow.evaluate(()=>window.testAudio.paused),false);
    await slow.screenshot({path:path.join(artifacts,'network-loading.png'),animations:'disabled'});
  });
  await test('second click cancels native pending play and late data does not restart it',async()=>{
    await slow.locator('.sw-main-play').click();
    assert.equal(await busy(slow),'false');assert.equal(await label(slow),'播放');assert.equal(await status(slow),false);
    release();await slow.clock.runFor(100);
    await until(()=>slow.evaluate(()=>window.testAudio.readyState>=3));
    assert(await slow.evaluate(()=>window.testAudio.paused));
    await slow.clock.runFor(30000);assert.equal(await status(slow),false);
  });
  await test('native network playback really starts after buffering and clears status',async()=>{
    await slow.locator('.sw-main-play').click();
    await until(()=>slow.evaluate(()=>!window.testAudio.paused&&window.testAudio.currentTime>0));
    assert.equal(await busy(slow),'false');assert.equal(await status(slow),false);assert.equal(await label(slow),'暂停');
    await slow.locator('.sw-main-play').click();
    await range(slow,'.sw-seek',500);await slow.clock.runFor(100);
    assert(await slow.evaluate(()=>window.testAudio.paused));assert.equal(await label(slow),'播放');
    await slow.locator('.sw-main-play').click();await until(()=>slow.evaluate(()=>!window.testAudio.paused));
    await slow.locator('.sw-main-play').click();
  });

  const mock=await fixture(browser,origin,raw,false);await open(mock);await mock.clock.install();
  await mock.evaluate(()=>{
    const audio=window.testAudio;
    audio.preload='none';
    const state={paused:true,ended:false,readyState:0,seeking:false,error:null,currentSrc:'',currentTime:0,duration:120};
    const requests=[];
    for(const key of Object.keys(state))Object.defineProperty(audio,key,{configurable:true,get:()=>state[key],
      set:value=>{state[key]=value;}});
    audio.load=()=>{Object.assign(state,{currentSrc:window.mediaHarness.holdCurrentSrc?state.currentSrc:audio.src,readyState:0,currentTime:0,error:null,ended:false});audio.dispatchEvent(new Event('loadstart'));};
    audio.pause=()=>{state.paused=true;audio.dispatchEvent(new Event('pause'));};
    audio.play=()=>{
      state.paused=false;audio.dispatchEvent(new Event('play'));
      if(window.mediaHarness.noPromise)return undefined;
      return new Promise((resolve,reject)=>requests.push({resolve,reject,src:audio.src}));
    };
    window.mediaHarness={state,requests,noPromise:false,
      emit:(name,patch={})=>{Object.assign(state,patch);audio.dispatchEvent(new Event(name));},
      fail:(index,name)=>requests[index].reject(new DOMException('Injected '+name,name)),
      resolve:index=>requests[index].resolve()};
  });
  await addSongs(mock,'-mock');
  await test('metadata and canplay do not pretend music is already playing',async()=>{
    await mock.locator('.sw-main-play').click();
    await mock.evaluate(()=>window.mediaHarness.emit('loadedmetadata',{readyState:1}));
    assert.equal(await busy(mock),'true');
    await mock.evaluate(()=>window.mediaHarness.emit('canplay',{readyState:3}));
    assert.equal(await busy(mock),'true');assert.equal(await label(mock),'取消加载');
    assert.equal(await mock.locator('.sw-orb').evaluate(el=>el.classList.contains('sw-active')),false);
  });
  await test('cancel/resume ignores the old rejected or resolved play Promise',async()=>{
    await mock.locator('.sw-main-play').click();assert.equal(await label(mock),'播放');
    await mock.locator('.sw-main-play').click();assert.equal(await busy(mock),'true');
    await mock.evaluate(()=>window.mediaHarness.fail(0,'AbortError'));
    await mock.clock.runFor(10);assert.equal(await busy(mock),'true');assert.equal(await label(mock),'取消加载');
    await mock.locator('.sw-main-play').click();await mock.locator('.sw-main-play').click();
    await mock.evaluate(()=>window.mediaHarness.resolve(1));await mock.clock.runFor(10);
    assert.equal(await busy(mock),'true');assert.equal(await label(mock),'取消加载');
    await mock.evaluate(()=>{window.mediaHarness.emit('playing',{readyState:4,paused:false});window.mediaHarness.resolve(2);});
    await until(async()=>(await busy(mock))==='false');assert.equal(await label(mock),'暂停');
  });
  await test('short stalls, ready data, seeking and resumed playing preserve intent',async()=>{
    await mock.evaluate(()=>window.mediaHarness.emit('waiting',{readyState:2}));assert.equal(await busy(mock),'true');
    await mock.clock.runFor(5000);assert.equal(await text(mock),'网络较慢，正在努力加载…');
    await range(mock,'.sw-seek',500);assert.equal(await label(mock),'取消加载');
    await mock.evaluate(()=>window.mediaHarness.emit('canplay',{readyState:3}));assert.equal(await busy(mock),'true');
    await mock.evaluate(()=>window.mediaHarness.emit('playing',{readyState:4}));assert.equal(await label(mock),'暂停');
    await mock.locator('.sw-main-play').click();await range(mock,'.sw-seek',250);
    await mock.evaluate(()=>{window.mediaHarness.emit('waiting',{readyState:2});window.mediaHarness.emit('canplay',{readyState:4});});
    assert.equal(await busy(mock),'false');assert.equal(await label(mock),'播放');
  });
  await test('rapid track changes isolate stale Promises and media events and restart the timer',async()=>{
    const old=await mock.evaluate(()=>window.mediaHarness.requests.length);
    await mock.locator('.sw-main-play').click();await mock.clock.runFor(16000);
    await mock.evaluate(()=>window.mediaHarness.holdCurrentSrc=true);
    await mock.locator('.sw-next').click();assert.equal(await mock.locator('.sw-title').textContent(),'Slow B');
    assert.equal(await text(mock),'正在加载音乐…');
    await mock.evaluate(old=>{window.mediaHarness.fail(old,'NotSupportedError');window.mediaHarness.emit('playing',{readyState:0});window.mediaHarness.emit('error',{error:null});},old);
    await mock.clock.runFor(1100);assert.equal(await busy(mock),'true');assert.equal(await label(mock),'取消加载');
    assert.equal(await mock.locator('.sw-orb').evaluate(el=>el.classList.contains('sw-active')),false);
    await mock.evaluate(()=>{window.mediaHarness.holdCurrentSrc=false;window.mediaHarness.emit('playing',{readyState:4,currentSrc:window.testAudio.src});window.mediaHarness.requests.at(-1).resolve();});
    await until(async()=>(await busy(mock))==='false');assert.equal(await label(mock),'暂停');
  });
  await test('autoplay rejection is explicit and never leaves a permanent spinner',async()=>{
    await mock.locator('.sw-main-play').click();await mock.locator('.sw-main-play').click();
    await mock.evaluate(()=>window.mediaHarness.fail(window.mediaHarness.requests.length-1,'NotAllowedError'));
    await until(async()=>(await label(mock))==='播放');assert.equal(await busy(mock),'false');assert.equal(await status(mock),false);
    assert.match(await mock.locator('.sw-notice').textContent(),/浏览器限制了自动播放，请手动点击播放/);
  });
  await test('network/media errors stop loading with cautious error messages and allow retry',async()=>{
    await mock.locator('.sw-main-play').click();await mock.evaluate(()=>window.mediaHarness.emit('error',{error:{code:2}}));
    assert.equal(await busy(mock),'false');assert.equal(await label(mock),'播放');
    assert.match(await mock.locator('.sw-notice').textContent(),/音乐获取失败.*检查网络或链接/);
    await mock.locator('.sw-main-play').click();assert.equal(await busy(mock),'true');
    await mock.evaluate(()=>window.mediaHarness.emit('error',{error:{code:4}}));
    assert.equal(await label(mock),'播放');assert.equal(await status(mock),false);
    assert.match(await mock.locator('.sw-notice').textContent(),/检查音频格式、网络和链接有效性/);
  });
  await test('missing playing event/legacy play return recover only from real timeline progress',async()=>{
    await mock.evaluate(()=>window.mediaHarness.noPromise=true);
    await mock.locator('.sw-main-play').click();
    await mock.evaluate(()=>window.mediaHarness.emit('canplay',{readyState:3,paused:false}));
    assert.equal(await busy(mock),'true');
    await mock.evaluate(()=>window.mediaHarness.state.currentTime=1);
    await mock.clock.runFor(1100);
    assert.equal(await busy(mock),'false',JSON.stringify(await mock.evaluate(()=>({...window.mediaHarness.state,src:window.testAudio.src}))));
    assert.equal(await label(mock),'暂停');
    await mock.evaluate(()=>window.mediaHarness.emit('pause',{paused:true}));assert.equal(await label(mock),'播放');
  });
  await test('sleep timer also cancels a pending network request and late Promise',async()=>{
    await mock.evaluate(()=>window.mediaHarness.noPromise=false);await mock.locator('.sw-main-play').click();
    await mock.locator('.sw-sleep').selectOption('15');await mock.clock.runFor(15*60000);
    assert.equal(await label(mock),'播放');assert.equal(await status(mock),false);
    await mock.evaluate(()=>window.mediaHarness.requests.at(-1).resolve());await mock.clock.runFor(10);
    assert.equal(await label(mock),'播放');assert.equal(await busy(mock),'false');
  });
};
