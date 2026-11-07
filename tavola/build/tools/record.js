// Esporta la tavola in MP4: un fotogramma alla volta con l'orologio della pagina (?video=1), poi ffmpeg unisce la voce.
// uso: node record.js <url> <uscita.mp4> <sorgente-audio> [fps] [secondi-max]
// @playwright/test del sito: dalla cartella da cui si lancia, poi risalendo dallo script fino al node_modules della radice
const { chromium } = require(require.resolve('@playwright/test', { paths: [process.cwd(), __dirname] }));
const { spawn } = require('child_process');
const [url, out, audioSrc, fpsArg, maxArg] = process.argv.slice(2);
const FPS = +(fpsArg || 30);
(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__video);
  const info = await page.evaluate(() => ({ d: window.__video.duration, intro: window.__video.intro }));
  const total = Math.ceil(Math.min(info.d, +(maxArg || 1e9)) * FPS);
  const delay = Math.round(info.intro * 1000);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', audioSrc,
    // i JPEG arrivano a gamma piena (yuvj, matrice 601): li porto a gamma TV e BT.709, come si aspettano televisori e lettori
    '-filter_complex', `[0:v]scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709[v];[1:a]aresample=48000,adelay=${delay}|${delay},loudnorm=I=-14:TP=-1.5:LRA=11,apad[a]`,
    '-map', '[v]', '-map', '[a]', '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-level:v', '4.1', '-maxrate', '20M', '-bufsize', '40M', '-r', String(FPS),
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await page.evaluate(dt => window.__video.step(dt), 1 / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % (FPS * 10) === 0) console.log(`fotogramma ${i}/${total} · ${(i / FPS).toFixed(0)} s · ${((Date.now() - t0) / 1000).toFixed(0)} s reali`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('FATTO', out, ((Date.now() - t0) / 1000).toFixed(0), 's');
})().catch(e => { console.error('ERRORE', e); process.exit(1); });
