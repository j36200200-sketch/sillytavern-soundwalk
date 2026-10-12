// Repeatable native-media A/B benchmark. Original MP3 bytes are served locally
// with controlled latency/throughput; this is NOT a live public-URL benchmark.
// Supply PUBLIC_MP3_FIXTURES, CHROMIUM_EXECUTABLE_PATH and optional BENCH_OUTPUT.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const baseline='92b0aa96dbd377c7cce2a905daf8c5d6b300fd07'; // Public anonymous v1.3.11 only.
const files=['public-soundhelix-1.mp3','public-soundhelix-2.mp3','public-soundhelix-3.mp3','public-horse.mp3'];
const rounds=Number(process.env.BENCH_ROUNDS||3),latency=300,chunk=32768,chunkMs=125;
const sources=(process.env.BENCH_SOURCES||'0,1,2,3').split(',').map(Number);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
async function listen(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;}

(async()=>{
  if(!process.env.PUBLIC_MP3_FIXTURES)throw Error('PUBLIC_MP3_FIXTURES is required; no automatic remote downloads');
  const samples=await Promise.all(files.map(f=>fs.readFile(path.join(process.env.PUBLIC_MP3_FIXTURES,f))));
  const oldJS=execFileSync('git',['show',baseline+':index.js'],{cwd:root});
  const oldCSS=execFileSync('git',['show',baseline+':style.css'],{cwd:root});
  const transfers=new Map();let connections=0;
  const mediaServer=http.createServer(async(req,res)=>{
    const u=new URL(req.url,'http://localhost'),index=Number(u.pathname.match(/\d+/)?.[0]);
    if(!Number.isInteger(index)||!samples[index]){res.writeHead(404).end();return;}
    const key=u.searchParams.get('trial'),data=samples[index];
    const record=transfers.get(key);if(!record){res.writeHead(404).end();return;}
    record.requests++;record.methods.push(req.method);
    const m=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
    const start=m?Number(m[1]):0,end=m&&m[2]?Math.min(Number(m[2]),data.length-1):data.length-1;
    if(start>data.length-1){res.writeHead(416,{'Content-Range':`bytes */${data.length}`}).end();return;}
    await wait(latency);if(res.destroyed)return;
    res.writeHead(m?206:200,{'Content-Type':'audio/mpeg','Content-Length':end-start+1,'Accept-Ranges':'bytes',
      'Cache-Control':'public,max-age=3600',...(m?{'Content-Range':`bytes ${start}-${end}/${data.length}`}:{})});
    for(let offset=start;offset<=end&&!res.destroyed;offset+=chunk){
      const bytes=data.subarray(offset,Math.min(offset+chunk,end+1));record.bytes+=bytes.length;res.write(bytes);
      if(offset+chunk<=end)await wait(chunkMs);
    }
    if(!res.destroyed)res.end();
  });
  mediaServer.on('connection',()=>connections++);
  const mediaOrigin=await listen(mediaServer);
  const appServer=http.createServer(async(req,res)=>{
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/blank'){res.end('<!doctype html><title>Setup</title>');return;}
    if(u.pathname==='/'){
      const variant=u.searchParams.get('variant');
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preload A/B</title><link rel="stylesheet" href="/bench-style.css?variant=${variant}"><script type="module" src="/bench-extension.js?variant=${variant}"></script>`);return;
    }
    try{
      if(u.pathname==='/bench-extension.js'){res.setHeader('Content-Type','text/javascript');res.end(u.searchParams.get('variant')==='baseline'?oldJS:await fs.readFile(path.join(root,'index.js')));return;}
      if(u.pathname==='/bench-style.css'){res.setHeader('Content-Type','text/css');res.end(u.searchParams.get('variant')==='baseline'?oldCSS:await fs.readFile(path.join(root,'style.css')));return;}
      const filename=path.resolve(root,'.'+u.pathname);if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const type={'.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(filename)];if(type)res.setHeader('Content-Type',type);
      res.end(await fs.readFile(filename));
    }catch{res.writeHead(404).end();}
  });
  const origin=await listen(appServer);let browser;
  const results=[];
  async function playTiming(page){
    await page.evaluate(()=>{
      window.benchPlay=null;let start;
      const button=document.querySelector('.sw-main-play');
      button.addEventListener('click',()=>start=performance.now(),{capture:true,once:true});
      window.testAudio.addEventListener('playing',()=>{if(start!==undefined)window.benchPlay=performance.now()-start;},{once:true});
    });
    await page.locator('.sw-main-play').click();
    await page.waitForFunction(()=>window.benchPlay!==null,null,{timeout:15000});
    await page.waitForFunction(()=>!window.testAudio.paused&&window.testAudio.currentTime>0);
    return page.evaluate(()=>window.benchPlay);
  }
  async function seekTiming(page,target){
    await page.evaluate(target=>{
      const audio=window.testAudio,start=performance.now();window.benchSeek=null;
      const finish=()=>{
        if(audio.seeking||audio.paused||audio.currentTime<target-.05)return;
        window.benchSeek=performance.now()-start;audio.removeEventListener('playing',finish);audio.removeEventListener('timeupdate',progress);
      };
      const progress=()=>{if(audio.currentTime>target+.02)finish();};
      audio.addEventListener('playing',finish);audio.addEventListener('timeupdate',progress);
      const input=document.querySelector('.sw-seek');input.value=String(target/audio.duration*1000);input.dispatchEvent(new Event('input',{bubbles:true}));
    },target);
    await page.waitForFunction(()=>window.benchSeek!==null,null,{timeout:15000});
    return page.evaluate(()=>window.benchSeek);
  }
  async function snapshot(page){return page.evaluate(()=>{const a=window.testAudio,b=a.buffered;return {hint:a.preload,paused:a.paused,duration:a.duration,
    ranges:Array.from({length:b.length},(_,i)=>[b.start(i),b.end(i)])};});}
  async function trial(variant,scenario,index,round,preconnect=false){
    const key=`${variant}-${scenario}-${index}-${round}-${preconnect}`;
    const record={bytes:0,requests:0,methods:[]};transfers.set(key,record);
    const beforeConnections=connections;
    const ctx=await browser.newContext({viewport:{width:360,height:800}}),page=await ctx.newPage();
    const row={variant,scenario,index,round,preconnect};
    try{
      await page.addInitScript(()=>{
        const Native=window.Audio;window.Audio=function(...args){const a=new Native(...args);window.testAudio=a;return a;};
        // Controlled eligible-quality case; this is capability injection, not a phone network measurement.
        Object.defineProperty(navigator,'connection',{configurable:true,get:()=>({saveData:false,effectiveType:'4g',rtt:100,downlink:2})});
      });
      await page.goto(origin+'/blank');
      await page.evaluate(({src,smart})=>localStorage.setItem('soundwalk-player-v1',JSON.stringify({tracks:[{id:'bench',title:'Benchmark MP3',kind:'url',src}],networkAcceleration:smart,orbPosition:{x:.8,y:.94}})),{src:`${mediaOrigin}/sample-${index}.mp3?trial=${key}`,smart:variant==='smart'});
      await page.goto(origin+'/?variant='+variant);await page.locator('.sw-orb').click();
      if(preconnect)await page.evaluate(href=>{const link=document.createElement('link');link.rel='preconnect';link.href=href;document.head.append(link);},mediaOrigin);
      if(scenario==='prepared')await wait(5000);
      row.beforePlay=await snapshot(page);row.bytesBeforePlay=record.bytes;
      row.playMs=await playTiming(page);
      const beforeSeek=await snapshot(page),target=beforeSeek.duration*.75;
      row.farTargetBuffered=beforeSeek.ranges.some(([s,e])=>target>=s&&target<e);
      row.farSeekMs=await seekTiming(page,target);
      const buffered=await snapshot(page),interval=buffered.ranges.find(([s,e])=>e-s>.1);
      row.bufferedSeekMs=await seekTiming(page,interval[0]+Math.min(.2,(interval[1]-interval[0])/2));
      await page.locator('.sw-main-play').click();row.resumeMs=await playTiming(page);await page.locator('.sw-main-play').click();
      row.bytesAfterPlayback=record.bytes;
      // Same context and URL after playback/seek: record actual warm-cache transfer;
      // do not assume the browser cached every byte of the file.
      const beforeWarm=record.bytes;
      await page.reload();await page.locator('.sw-orb').click();await wait(500);
      row.warmBeforePlay=await snapshot(page);row.warmPlayMs=await playTiming(page);await page.locator('.sw-main-play').click();
      row.warmTransferredBytes=record.bytes-beforeWarm;row.passed=true;
    }catch(error){row.passed=false;row.error=error.message.split('\n')[0];}
    finally{row.requests=record.requests;row.methods=[...new Set(record.methods)];row.audioConnections=connections-beforeConnections;await ctx.close();}
    results.push(row);console.log(JSON.stringify(row));
  }
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,
      args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    for(let round=0;round<rounds;round++)for(const index of sources)for(const scenario of ['immediate','prepared']){
      // Alternate order to avoid always testing the candidate second.
      for(const variant of round%2?['smart','baseline']:['baseline','smart'])await trial(variant,scenario,index,round);
    }
    if(!process.env.BENCH_SOURCES)for(let round=0;round<rounds;round++)await trial('baseline','prepared',0,round,true);
    const summary=[];
    for(const variant of ['baseline','smart'])for(const scenario of ['immediate','prepared'])for(const index of sources){
      const rows=results.filter(r=>r.passed&&r.variant===variant&&r.scenario===scenario&&r.index===index&&!r.preconnect);
      if(!rows.length)continue;
      const r={variant,scenario,index,n:rows.length};
      for(const field of ['playMs','farSeekMs','bufferedSeekMs','resumeMs','warmPlayMs','bytesBeforePlay','bytesAfterPlayback','warmTransferredBytes'])r[field]=Math.round(median(rows.map(x=>x[field])));
      r.farTargetBuffered=rows.filter(x=>x.farTargetBuffered).length;summary.push(r);
    }
    const report={date:new Date().toISOString(),browser:browser.version(),baseline,rounds,
      mode:'controlled-local-original-MP3',network:{headerDelayMs:latency,bodyBytesPerSecond:chunk*1000/chunkMs,preparationMs:5000},
      samples:files.map((file,i)=>({file,bytes:samples[i].length,sha256:crypto.createHash('sha256').update(samples[i]).digest('hex')})),
      results,summary,failed:results.filter(x=>!x.passed).length};
    if(process.env.BENCH_OUTPUT)await fs.writeFile(process.env.BENCH_OUTPUT,JSON.stringify(report,null,2)+'\n');
    console.log('SUMMARY '+JSON.stringify({failed:report.failed,summary}));if(report.failed)process.exitCode=1;
  }finally{
    if(browser)await browser.close();for(const server of [appServer,mediaServer]){server.closeAllConnections();await new Promise(r=>server.close(r));}
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
