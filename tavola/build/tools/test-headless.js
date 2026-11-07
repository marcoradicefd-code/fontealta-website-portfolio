// Banco di prova senza browser: esegue i 12 reparti, il muletto e il carrello su migliaia di istanti
// con un canvas finto e segnala ogni errore JavaScript.
// uso: node test-headless.js ../../src.html            (modalità normale)
//      node test-headless.js ../../src.html "?kiosk=1" (modalità fiera)
//      node test-headless.js ../../src.html "?video=1" (modalità video)
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
let js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const noop = () => {};
const ctxStub = new Proxy({}, { get: (o, k) => {
  if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  if (k === 'measureText') return () => ({ width: 10 });
  if (k === 'createPattern') return () => ({ setTransform: noop });
  if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
  if (k in o) return o[k]; return noop;
}, set: (o, k, v) => { o[k] = v; return true; } });
const el = () => new Proxy({ style: { setProperty: noop }, dataset: {}, classList: { add: noop, remove: noop, toggle: () => false, contains: () => false },
  getContext: () => ctxStub, getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 }),
  setAttribute: noop, removeAttribute: noop, appendChild: noop, addEventListener: noop, setPointerCapture: noop, load: noop,
  querySelectorAll: () => [], querySelector: () => el(), focus: noop, play: () => Promise.resolve(), pause: noop },
  { get: (o, k) => k in o ? o[k] : (k === 'offsetHeight' || k === 'clientWidth' || k === 'clientHeight' ? 800 : k === 'lastChild' || k === 'firstChild' ? el() : undefined), set: (o, k, v) => { o[k] = v; return true; } });
global.document = { getElementById: el, querySelector: el, querySelectorAll: () => [], createElement: el, documentElement: el(), fonts: { ready: Promise.resolve() } };
global.window = global; global.location = { search: process.argv[3] || '' }; global.innerWidth = 1280; global.innerHeight = 800;
global.navigator = {}; global.setInterval = noop; global.addEventListener = noop; global.matchMedia = () => ({ matches: false });
global.devicePixelRatio = 1; global.requestAnimationFrame = noop; global.setTimeout = noop;
global.ResizeObserver = class { observe() {} }; global.DOMMatrix = class { rotateSelf() { return this } scaleSelf() { return this } };
global.performance = { now: () => 0 }; global.Path2D = class { constructor(d) { this.d = d } }; global.CanvasRenderingContext2D = class {};
// espone reparti e mezzi dei corridoi prima dell'avvio del ciclo
const hook = 'window.__S=S;window.__trolley=trolley;window.__fork=forklift;window.__setT=v=>{T=v};';
js = js.replace(/if\(!VIDEO\)requestAnimationFrame\(frame\);\s*\n\/\* ---------- sottotitoli/, m => hook + m);
if (!js.includes(hook)) { const ix = js.lastIndexOf('requestAnimationFrame(frame);'); js = js.slice(0, ix) + hook + js.slice(ix); }
// eval è voluto: esegue lo script della NOSTRA pagina (src.html del progetto), solo in locale, per testarlo.
eval(js);
const errs = {};
const times = [0.8, 3.8, 8.5, ...Array.from({ length: 3000 }, (_, j) => j * 0.041)];
if (window.__S) for (let i = 0; i < 12; i++) for (const t of times) {
  try { __setT(t); __S[i](Math.max(0, t)); } catch (e) { const k = 'S' + (i + 1) + ': ' + e.message; if (!errs[k]) errs[k] = t.toFixed(2); }
}
if (window.__trolley) for (let t = 0; t < 80; t += 0.05) { try { __trolley(t); __fork(t); } catch (e) { errs['corridoi: ' + e.message] = t; } }
// giro completo in modalità video, fino alla chiusura con il QR (lì una funzione nascosta da un parametro ha fermato i video del 21/10)
if (window.__video) { try { for (let t = 0; t < window.__video.duration; t += 0.1) window.__video.step(0.1) } catch (e) { errs['giro completo: ' + e.message] = 'fine' } }
console.log(Object.keys(errs).length ? errs : (window.__S ? 'nessun errore' : 'avvio ok (reparti non esposti in questa modalità)'));
