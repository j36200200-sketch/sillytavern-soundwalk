// Delayed native media plus deterministic media-event/Promise fault injection.
// Invoked by regression.cjs; no real user storage or third-party runtime code.
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

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
    Object.defineProperty(audio,'buffered',{configurable:true,get:()=>{
      const ranges=window.mediaHarness.buffered.map(pair=>[...pair]);
      return {length:ranges.length,start:i=>ranges[i][0],end:i=>ranges[i][1]};
    }});
    audio.load=()=>{Object.assign(state,{currentSrc:window.mediaHarness.holdCurrentSrc?state.currentSrc:audio.src,readyState:0,currentTime:0,error:null,ended:false});audio.dispatchEvent(new Event('loadstart'));};
    audio.pause=()=>{state.paused=true;audio.dispatchEvent(new Event('pause'));};
    audio.play=()=>{
      state.paused=false;audio.dispatchEvent(new Event('play'));
      if(window.mediaHarness.noPromise)return undefined;
      return new Promise((resolve,reject)=>requests.push({resolve,reject,src:audio.src}));
    };
    window.mediaHarness={state,requests,noPromise:false,buffered:[],
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

  async function startMock() {
    await mock.evaluate(()=>{
      Object.assign(window.mediaHarness.state,{seeking:false,readyState:4,error:null,ended:false,currentTime:1});
      window.mediaHarness.buffered=[[0,20],[90,110]];
    });
    await mock.locator('.sw-main-play').click();
    await mock.evaluate(()=>{
      window.mediaHarness.emit('playing',{paused:false,readyState:4});
      window.mediaHarness.requests.at(-1).resolve();
    });
    await until(async()=>(await label(mock))==='暂停');
  }
  await test('unbuffered seeking shows buffering without waiting/stalled and seeked is not playback',async()=>{
    await startMock();
    await mock.evaluate(()=>window.mediaHarness.emit('seeking',{currentTime:60,seeking:true,readyState:1}));
    assert.equal(await busy(mock),'true');assert.equal(await text(mock),'正在缓冲…');
    await mock.evaluate(()=>window.mediaHarness.emit('seeked',{seeking:false,readyState:2}));
    assert.equal(await status(mock),true);
    await mock.evaluate(()=>window.mediaHarness.emit('canplay',{readyState:3}));
    assert.equal(await status(mock),true);
    await mock.evaluate(()=>window.mediaHarness.emit('playing',{readyState:4}));
    assert.equal(await status(mock),false);assert.equal(await label(mock),'暂停');
  });
  await test('buffered jumps do not flash loading even if seeking briefly lowers readyState',async()=>{
    await mock.evaluate(()=>window.mediaHarness.emit('seeking',{currentTime:100,seeking:true,readyState:1}));
    await mock.evaluate(()=>{window.mediaHarness.emit('waiting');window.mediaHarness.emit('stalled');});
    assert.equal(await status(mock),false);assert.equal(await label(mock),'暂停');
    await mock.evaluate(()=>window.mediaHarness.emit('seeked',{seeking:false,readyState:4}));
    await mock.clock.runFor(200);assert.equal(await status(mock),false);
  });
  await test('seek input catches delayed readiness without media events and actual progress clears it',async()=>{
    await mock.evaluate(()=>Object.assign(window.mediaHarness.state,{seeking:true,readyState:4}));
    await range(mock,'.sw-seek',500);assert.equal(await status(mock),false);
    await mock.evaluate(()=>window.mediaHarness.state.readyState=1);
    await mock.clock.runFor(200);assert.equal(await text(mock),'正在缓冲…');assert.equal(await status(mock),true);
    await mock.evaluate(()=>Object.assign(window.mediaHarness.state,{seeking:false,readyState:4}));
    await mock.clock.runFor(1100);assert.equal(await status(mock),true,'Ready data without progress must not fake playback');
    await mock.evaluate(()=>window.mediaHarness.state.currentTime+=.5);
    await mock.clock.runFor(1100);assert.equal(await status(mock),false);assert.equal(await label(mock),'暂停');
  });
  await test('buffering seek keeps graded hints and cancel/paused seek never calls play',async()=>{
    await mock.evaluate(()=>window.mediaHarness.emit('seeking',{currentTime:60,seeking:true,readyState:1}));
    await mock.clock.runFor(5000);assert.equal(await text(mock),'网络较慢，正在努力加载…');
    await mock.clock.runFor(10000);assert.equal(await text(mock),'网络似乎不太稳定，仍在尝试加载');
    await mock.clock.runFor(5000);assert.equal(await text(mock),'加载较久，可取消后重试');assert.equal(await busy(mock),'true');
    await mock.locator('.sw-main-play').click();const count=await mock.evaluate(()=>window.mediaHarness.requests.length);
    await range(mock,'.sw-seek',600);
    await mock.evaluate(()=>{window.mediaHarness.emit('seeking');window.mediaHarness.emit('seeked',{seeking:false});});
    await mock.clock.runFor(30000);assert.equal(await status(mock),false);assert.equal(await label(mock),'播放');
    assert.equal(await mock.evaluate(()=>window.mediaHarness.requests.length),count);
    assert.equal(await mock.evaluate(()=>window.testAudio.paused),true);
  });
  await test('seek checks and buffering cannot leak across cancel, track switch or media error',async()=>{
    await startMock();
    await range(mock,'.sw-seek',500); // Schedules a readiness check while data is still ready.
    await mock.locator('.sw-main-play').click();
    await mock.evaluate(()=>Object.assign(window.mediaHarness.state,{seeking:true,readyState:1}));
    await mock.clock.runFor(200);assert.equal(await status(mock),false);assert.equal(await label(mock),'播放');
    await startMock();await range(mock,'.sw-seek',500);
    await mock.locator('.sw-next').click();
    assert.equal(await text(mock),'正在加载音乐…');
    await mock.clock.runFor(200);assert.equal(await text(mock),'正在加载音乐…');
    await mock.evaluate(()=>window.mediaHarness.emit('error',{error:{code:2}}));
    await mock.clock.runFor(30000);assert.equal(await status(mock),false);assert.equal(await label(mock),'播放');
  });
  const local=await fixture(browser,origin,{...raw,tracks:[{id:'seek-local',title:'Local seek',kind:'file'}]},true);await open(local);
  await test('native local playing/paused seeks keep their intent and never show network loading',async()=>{
    await local.locator('.sw-main-play').click();await until(()=>local.evaluate(()=>window.testAudio.currentTime>0));
    await range(local,'.sw-seek',500);await until(()=>local.evaluate(()=>!window.testAudio.seeking&&window.testAudio.currentTime>5));
    assert.equal(await status(local),false);assert.equal(await label(local),'暂停');
    await local.locator('.sw-main-play').click();await range(local,'.sw-seek',250);
    await until(()=>local.evaluate(()=>!window.testAudio.seeking));
    assert.equal(await local.evaluate(()=>window.testAudio.paused),true);assert.equal(await status(local),false);
    assert.equal(await label(local),'播放');
  });

  // A real partial HTTP response: only the first sixteen seconds arrive until
  // released. Suppress waiting/stalled handlers to reproduce the mobile gap.
  const streamWav=Buffer.alloc(44+(wav.length-44)*6);
  wav.copy(streamWav,0,0,44);
  for(let i=0;i<6;i++)wav.copy(streamWav,44+(wav.length-44)*i,44);
  streamWav.writeUInt32LE(streamWav.length-8,4);streamWav.writeUInt32LE(streamWav.length-44,40);
  let releaseSeek;
  const seekGate=new Promise(resolve=>releaseSeek=resolve);
  const rangesRequested=[];
  const stream=http.createServer(async(req,res)=>{
    rangesRequested.push(req.headers.range||'full');
    const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
    const start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),streamWav.length-1):streamWav.length-1;
    res.writeHead(match?206:200,{'Content-Type':'audio/wav','Accept-Ranges':'bytes',
      'Content-Length':end-start+1,...(match?{'Content-Range':`bytes ${start}-${end}/${streamWav.length}`}:{})});
    const split=Math.min(44+16000*16,end+1);
    if(start<split)res.write(streamWav.subarray(start,split));
    if(split<=end)await seekGate;
    if(!res.destroyed)res.end(streamWav.subarray(Math.max(start,split),end+1));
  });
  await new Promise(resolve=>stream.listen(0,'127.0.0.1',resolve));
  try {
    const native=await fixture(browser,origin,raw,false);
    await native.addInitScript(()=>{
      const add=HTMLMediaElement.prototype.addEventListener;
      HTMLMediaElement.prototype.addEventListener=function(type,...args){
        if(type==='waiting'||type==='stalled')return;
        return add.call(this,type,...args);
      };
    });
    await native.reload();await open(native);
    await upload(native,'.sw-json-input',Buffer.from(JSON.stringify({format:'soundwalk-playlist',version:2,
      tracks:[{title:'Partial stream',src:`http://127.0.0.1:${stream.address().port}/seek.wav`}]})));
    await until(async()=>(await native.locator('.sw-title').textContent())==='Partial stream');
    await test('native partial network seek buffers and resumes without waiting/stalled handlers',async()=>{
      await native.locator('.sw-main-play').click();
      await until(()=>native.evaluate(()=>window.testAudio.currentTime>0&&window.testAudio.readyState>=3)).catch(async error=>{
        error.message+=' '+JSON.stringify({rangesRequested,media:await native.evaluate(()=>{
          const a=window.testAudio;return {paused:a.paused,seeking:a.seeking,ready:a.readyState,time:a.currentTime,duration:a.duration,error:a.error?.code,
            buffered:Array.from({length:a.buffered.length},(_,i)=>[a.buffered.start(i),a.buffered.end(i)])};
        })});throw error;
      });
      assert.equal(await status(native),false);
      assert(await native.evaluate(()=>window.testAudio.buffered.end(0)<48),'Target must really be unbuffered');
      await range(native,'.sw-seek',800);
      await until(()=>status(native));assert.equal(await text(native),'正在缓冲…');
      assert.equal(await label(native),'取消加载');
      await native.screenshot({path:path.join(artifacts,'network-seek-buffering.png'),animations:'disabled'});
      releaseSeek();
      await until(()=>native.evaluate(()=>!window.testAudio.seeking&&window.testAudio.currentTime>48.05));
      assert.equal(await status(native),false);assert.equal(await label(native),'暂停');
      await native.locator('.sw-main-play').click();
    });
  } finally {
    releaseSeek();stream.closeAllConnections();await new Promise(resolve=>stream.close(resolve));
  }
};
