// Optional live smoke check. Network conditions and remote resources can vary.
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),manifest=require('../manifest.json');
const urls=['https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3','https://www.w3schools.com/html/horse.mp3'];

(async()=>{
  const server=http.createServer(async(req,res)=>{
    const u=new URL(req.url,'http://localhost');
    if(process.env.PUBLIC_MP3_FIXTURES&&/^\/fixture-[01]\.mp3$/.test(u.pathname)) {
      const name=u.pathname.includes('fixture-0')?'public-soundhelix-sample.mp3':'public-horse.mp3';
      try{res.setHeader('Content-Type','audio/mpeg');res.end(await fs.readFile(path.join(process.env.PUBLIC_MP3_FIXTURES,name)));}catch{res.writeHead(404).end();}return;
    }
    if(u.pathname==='/'){
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Public MP3 smoke check</title><link rel="stylesheet" href="/${manifest.css}"><script>const NativeAudio=window.Audio;window.Audio=function(...args){const a=new NativeAudio(...args);window.testAudio=a;return a;};</script><script type="module" src="/${manifest.js}"></script>`);return;
    }
    const file=path.resolve(root,'.'+u.pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try{const type={'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'}[path.extname(file)];if(type)res.setHeader('Content-Type',type);res.end(await fs.readFile(file));}
    catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    let proxy;
    if(process.env.HTTPS_PROXY&&!process.env.PUBLIC_MP3_FIXTURES){const p=new URL(process.env.HTTPS_PROXY);proxy={server:p.origin,bypass:'127.0.0.1,localhost'};if(p.username)proxy.username=decodeURIComponent(p.username);if(p.password)proxy.password=decodeURIComponent(p.password);}
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,proxy,
      args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const results=await Promise.allSettled(urls.map(async(url,index)=>{
      const ctx=await browser.newContext({viewport:{width:360,height:800}}),page=await ctx.newPage();
      const started=Date.now(),failedRequests=[];
      page.on('requestfailed',r=>{if(r.url()===url)failedRequests.push(r.failure()?.errorText);});
      try{
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.locator('.sw-orb').click();await page.locator('.sw-add-link').click();
        const source=process.env.PUBLIC_MP3_FIXTURES?`http://127.0.0.1:${server.address().port}/fixture-${index}.mp3`:url;
        await page.locator('.sw-name').fill('Live MP3 check');await page.locator('.sw-url').fill(source);await page.locator('.sw-save').click();
        await page.locator('.sw-main-play').click();
        await page.waitForFunction(()=>window.testAudio&&!window.testAudio.paused&&window.testAudio.currentTime>.15,null,{timeout:25000});
        if(await page.locator('.sw-main-play').getAttribute('aria-busy')!=='false')throw new Error('Loading status did not clear');
        const media=await page.evaluate(()=>({currentTime:window.testAudio.currentTime,duration:window.testAudio.duration,error:window.testAudio.error?.code||null}));
        await page.locator('.sw-main-play').click();
        return {url,mode:process.env.PUBLIC_MP3_FIXTURES?'downloaded-sample':'live-url',passed:true,elapsedMs:Date.now()-started,media};
      }catch(error){return {url,mode:process.env.PUBLIC_MP3_FIXTURES?'downloaded-sample':'live-url',passed:false,elapsedMs:Date.now()-started,failedRequests,message:(await page.locator('.sw-notice').textContent().catch(()=>''))||error.message};}
      finally{await ctx.close();}
    }));
    for(const result of results){console.log(JSON.stringify(result.status==='fulfilled'?result.value:{passed:false,message:String(result.reason)}));}
    if(results.some(r=>r.status!=='fulfilled'||!r.value.passed))process.exitCode=1;
  }finally{if(browser)await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
