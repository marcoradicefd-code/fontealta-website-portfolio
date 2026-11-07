// Tavola per il sito: scrive public/officina-tavola/ (pagina leggera, font in file, facciata, og, manifest) e la voce
// con l'impronta nel nome in tavola/build/r2/, da caricare su R2. Spec: docs/specs/tavola-officina.md.
// uso, dalla radice del repo: node tavola/build/tools/build-web.js
// Prima, se i testi sono cambiati: python3 tavola/build/i18n.py (scrive le lingue dentro src.html).
// Le immagini si scattano con l'orologio della modalità video (?video=1, window.__video.step), che avanza solo a comando (?video=1&facciata=1: vista d'insieme ferma, inquadrata come fuori dal video):
// due giri danno gli stessi byte. Con page.clock no: performance.now() all'avvio cambia di qualche ms a ogni giro, e le
// figure a 6 s stanno in punti appena diversi (misurato il 27/10).
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { chromium } = require(require.resolve('@playwright/test', { paths: [process.cwd(), __dirname] }));

const TAVOLA = path.resolve(__dirname, '../..');
const RADICE = path.dirname(TAVOLA);
const OUT = path.join(RADICE, 'public/officina-tavola');
const R2 = path.join(TAVOLA, 'build/r2');
const FONTS = path.join(TAVOLA, 'build/fonts');
const HOST_VOCE = 'https://media.fontealta.it/tavola/';
const BUCKET = 'fontealta-media';
const ISTANTE_MS = 6000; // la vista d'insieme a 6 s dall'apertura (Marco, 27/10/2026)

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const rel = (f, base = RADICE) => path.relative(base, f).split(path.sep).join('/');
const leggi = (f) => fs.readFileSync(f);
const scrivi = (f, b) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); };

// Font: gli stessi sottoinsiemi di build.py (latin e latin-ext di Archivo e JetBrains Mono), ma in file e non in base64.
function fontFaces() {
  const css = fs.readFileSync(path.join(FONTS, 'g.css'), 'utf8');
  const faces = [], file = [], visti = new Set();
  for (const [, sub, body] of css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face\s*{([^}]*)}/g)) {
    if (sub !== 'latin' && sub !== 'latin-ext') continue;
    const fam = body.match(/font-family: '([^']+)'/)[1];
    if (visti.has(fam + sub)) continue;
    visti.add(fam + sub);
    const fn = fs.readdirSync(FONTS).sort().find((f) => f.startsWith(fam.replace(/ /g, '') + '_' + sub + '_'));
    const wght = fam === 'Archivo' ? '400 900' : '400 600';
    const stretch = fam === 'Archivo' ? 'font-stretch:62% 125%;' : '';
    const ur = body.match(/unicode-range: ([^;]+);/)[1];
    faces.push(`@font-face{font-family:'${fam}';font-style:normal;font-weight:${wght};${stretch}font-display:swap;src:url(fonts/${fn}) format('woff2');unicode-range:${ur}}`);
    file.push(fn);
  }
  return { faces, file: [...file, 'Satoshi-Variable.woff2'] };
}

function pagina(nomeVoce, faces) {
  const s = fs.readFileSync(path.join(TAVOLA, 'src.html'), 'utf8');
  const fineTesta = s.indexOf('</style>') + '</style>'.length;
  let testa = s.slice(0, fineTesta), corpo = s.slice(fineTesta);
  testa = testa.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
  testa = testa.replace('<style>', '<style>\n' + faces.join('\n') + '\n');
  testa = testa.replace('url(build/fonts/Satoshi-Variable.woff2)', 'url(fonts/Satoshi-Variable.woff2)');
  corpo = corpo.replace('data-src="__AUDIO__"', `data-src="${HOST_VOCE}${nomeVoce}"`);
  if (!corpo.includes(HOST_VOCE + nomeVoce) || testa.includes('build/fonts/') || /fonts\.(googleapis|gstatic)/.test(testa))
    throw new Error('src.html non ha più la forma attesa: voce, font o link di Google');
  return '<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    + testa + '\n</head>\n<body>' + corpo + '\n</body>\n</html>\n';
}

// Server minimo su public/officina-tavola/: i font da file:// sarebbero richieste senza origine.
function servi() {
  const tipi = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2' };
  const srv = http.createServer((req, res) => {
    const f = path.join(OUT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(OUT + path.sep) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': tipi[path.extname(f)] || 'application/octet-stream' });
    res.end(leggi(f));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

// La tavola senza interfaccia, inquadrata su tutta la finestra (come la sonda del 27/10), all'istante ISTANTE_MS.
async function scatta(browser, url, viewport, deviceScaleFactor, opzioni) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, reducedMotion: 'no-preference' });
  const p = await ctx.newPage();
  const errori = [];
  p.on('pageerror', (e) => errori.push(e.message));
  await p.goto(url);
  // tutti i font prima del primo passo: il canvas li chiede al primo disegno
  await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load())); await document.fonts.ready; });
  await p.addStyleTag({ content: '#app > *:not(#scene){visibility:hidden!important}' });
  await p.keyboard.press('s');
  await p.evaluate(() => {
    const finto = (r) => () => new DOMRect(r.x, r.y, r.w, r.h);
    document.getElementById('card').getBoundingClientRect = finto({ x: -8, y: 0, w: 0, h: 0 });
    document.querySelector('.mast').getBoundingClientRect = finto({ x: 0, y: -8, w: 0, h: 0 });
    document.querySelector('.index ol').getBoundingClientRect = finto({ x: 0, y: innerHeight + 8, w: 0, h: 0 });
    dispatchEvent(new Event('resize'));
  });
  await p.keyboard.press('s');
  // due fotogrammi veri perché gli osservatori delle misure finiscano, poi i passi tutti in un evaluate solo
  await p.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  await p.evaluate((n) => { for (let i = 0; i < n; i++) window.__video.step(1 / 30); }, Math.round(ISTANTE_MS / 1000 * 30));
  const img = await p.screenshot(opzioni);
  await ctx.close();
  if (errori.length) throw new Error('errori nella pagina: ' + errori.join(' · '));
  return img;
}

(async () => {
  const voce = leggi(path.join(TAVOLA, 'voce.mp3'));
  const nomeVoce = `voce-it-${sha(voce).slice(0, 8)}.mp3`;
  scrivi(path.join(R2, nomeVoce), voce);

  const { faces, file: fontFile } = fontFaces();
  for (const fn of fontFile) scrivi(path.join(OUT, 'fonts', fn), leggi(path.join(FONTS, fn)));
  scrivi(path.join(OUT, 'index.html'), pagina(nomeVoce, faces));

  const srv = await servi();
  const url = `http://127.0.0.1:${srv.address().port}/index.html?lang=it&video=1&facciata=1`;
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
  try {
    scrivi(path.join(OUT, 'facciata.png'), await scatta(browser, url, { width: 1280, height: 720 }, 2, { type: 'png' }));
    scrivi(path.join(OUT, 'og.jpg'), await scatta(browser, url, { width: 1200, height: 630 }, 1, { type: 'jpeg', quality: 85 }));
  } finally {
    await browser.close();
    srv.close();
  }

  // Il manifest: impronte dei sorgenti e delle uscite. Lo ricontrolla scripts/officina-tavola.test.ts.
  const sorgenti = ['src.html', 'voce.mp3', 'build/tools/build-web.js', 'build/fonts/g.css',
    ...fs.readdirSync(path.join(TAVOLA, 'i18n')).filter((f) => f.endsWith('.json')).map((f) => 'i18n/' + f),
    ...fontFile.map((f) => 'build/fonts/' + f)].map((f) => path.join(TAVOLA, f));
  const uscite = ['index.html', 'facciata.png', 'og.jpg', ...fontFile.map((f) => 'fonts/' + f)].map((f) => path.join(OUT, f));
  const impronte = (lista, base) => Object.fromEntries(lista.map((f) => [rel(f, base), sha(leggi(f))]).sort(([a], [b]) => a.localeCompare(b)));
  const manifest = {
    nota: 'Generato da tavola/build/tools/build-web.js: non si modifica a mano.',
    voce: HOST_VOCE + nomeVoce,
    sorgenti: impronte(sorgenti, RADICE),
    uscite: impronte(uscite, OUT),
  };
  scrivi(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const peso = uscite.concat(path.join(OUT, 'manifest.json')).reduce((t, f) => t + fs.statSync(f).size, 0);
  console.log(`${rel(OUT)}: ${uscite.length + 1} file, ${peso} byte`);
  console.log(`voce: ${rel(path.join(R2, nomeVoce))} → ${HOST_VOCE}${nomeVoce}`);
  console.log('caricamento su R2 (lo fa Marco, dalla radice del repo):');
  console.log(`pnpm dlx wrangler r2 object put ${BUCKET}/tavola/${nomeVoce} --file=${rel(path.join(R2, nomeVoce))} --content-type audio/mpeg --cache-control "public, max-age=31536000, immutable" --remote`);
})().catch((e) => { console.error('ERRORE', e.message); process.exit(1); });
