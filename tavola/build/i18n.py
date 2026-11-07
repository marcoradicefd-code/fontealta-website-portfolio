# Lingue della tavola: controlla i18n/<lingua>.json e li copia in src.html fra /*I18N*/ e /*/I18N*/.
# Uso (dalla cartella del progetto): PYTHONPATH=build/tools/pylib python3 build/i18n.py
# Esce con 1 se una lingua ha un errore di struttura o di segnaposto; gli avvisi non fermano.
import json, re, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tools', 'pylib'))
import segno

LINGUE = ['it', 'en', 'de', 'fr', 'es']
UTM = '?utm_source=cersaie&utm_medium=totem'
# testi che possono restare uguali all'italiano (codici, sigle, la stampa sul tubo, nomi propri)
UGUALI_AMMESSI = {'etichette.stampaTubo', 'etichette.almandino', 'lingua.pagina', 'ui.pausa', 'reparti.0', 'schede.1.dati'}
# velocità di lettura massima dei sottotitoli, caratteri al secondo (Netflix Timed Text Style Guides)
CPS = {'it': 17, 'en': 20, 'de': 17, 'fr': 17, 'es': 17}
NBSP = ' '
errori, avvisi = [], []

def a_capo(o):
    """Gli a capo delle etichette devono essere veri a capo, non il testo «\\n»."""
    if isinstance(o, dict): return {k: a_capo(v) for k, v in o.items()}
    if isinstance(o, list): return [a_capo(v) for v in o]
    return o.replace('\\n', '\n') if isinstance(o, str) else o

def apostrofi(o):
    """Apostrofo tipografico ’ al posto di ' (regola di scrittura del design system FonteAlta)."""
    if isinstance(o, dict): return {k: apostrofi(v) for k, v in o.items()}
    if isinstance(o, list): return [apostrofi(v) for v in o]
    return o.replace("'", '’') if isinstance(o, str) and not o.startswith('http') else o

def francese(o):
    """Spazio non separabile prima di : ; ? ! » e dopo « (regola del sito, rule i18n-sanity)."""
    if isinstance(o, dict): return {k: francese(v) for k, v in o.items()}
    if isinstance(o, list): return [francese(v) for v in o]
    if not isinstance(o, str) or o.startswith('http'): return o
    o = re.sub(r' ([:;?!»])', NBSP + r'\1', o)
    return re.sub(r'« ', '«' + NBSP, o)

def confronta(src, tr, lang, path=''):
    if isinstance(src, dict):
        if not isinstance(tr, dict) or set(src) != set(tr):
            errori.append(f'{lang}: chiavi diverse in {path or "radice"}: {sorted(set(src) ^ set(tr or {}))}'); return
        for k in src: confronta(src[k], tr[k], lang, f'{path}.{k}' if path else k)
    elif isinstance(src, list):
        if not isinstance(tr, list) or len(src) != len(tr):
            errori.append(f'{lang}: {path} ha {len(tr) if isinstance(tr, list) else "?"} elementi invece di {len(src)}'); return
        for i, (a, b) in enumerate(zip(src, tr)): confronta(a, b, lang, f'{path}.{i}')
    else:
        if not isinstance(tr, str) or not tr.strip(): errori.append(f'{lang}: {path} vuoto'); return
        if sorted(re.findall(r'\{\w+\}', src)) != sorted(re.findall(r'\{\w+\}', tr)):
            errori.append(f'{lang}: segnaposto diversi in {path}')
        if lang != 'it' and src == tr and path not in UGUALI_AMMESSI and not path.startswith(('lingua.', 'scritte.')):
            avvisi.append(f'{lang}: {path} è identico all\'italiano')
        if path.startswith('etichette.') and src.count('\n') != tr.count('\n'):
            avvisi.append(f'{lang}: {path} ha {tr.count(chr(10))} a capo invece di {src.count(chr(10))}')
        if path.startswith('sottotitoli.') and len(tr) > len(src) * 1.3 + 5:
            avvisi.append(f'{lang}: sottotitolo {path} lungo {len(tr)} contro {len(src)} caratteri')

def qr(url):
    q = segno.make(url, error='m', boost_error=False)
    m = [list(r) for r in q.matrix]; n = len(m); b = 2
    d = []
    for y, riga in enumerate(m):
        x = 0
        while x < n:
            if riga[x]:
                x0 = x
                while x < n and riga[x]: x += 1
                d.append(f'M{x0 + b} {y + b}h{x - x0}v1h-{x - x0}z')
            else: x += 1
    return {'n': n + 2 * b, 'd': ''.join(d)}

radice = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dati = {}
for l in LINGUE:
    f = os.path.join(radice, 'i18n', l + '.json')
    if not os.path.exists(f):
        avvisi.append(f'{l}: manca {f}, la lingua resta spenta'); continue
    d = apostrofi(a_capo(json.load(open(f, encoding='utf-8'))))
    if any('—' in t for t in re.findall(r'"([^"]*)"', json.dumps(d, ensure_ascii=False))): avvisi.append(f'{l}: c’è una lineetta lunga — (il design system non la vuole nei testi)')
    if l == 'fr': d = francese(d)
    json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)   # riscrive normalizzato
    dati[l] = d
for l, d in dati.items():
    if l != 'it': confronta(dati['it'], d, l)
# i sottotitoli seguono i tempi della voce italiana: si controlla che si leggano in quel tempo
m = re.search(r'const CAPS=(\[.*?\]);', open(os.path.join(radice, 'src.html'), encoding='utf-8').read())
tempi = json.loads(m.group(1)) if m else []
for l, d in dati.items():
    lenti = [i for i, (t, (a, b)) in enumerate(zip(d['sottotitoli'], tempi)) if len(t) / max(b - a, .5) > CPS[l] * 1.25]
    if lenti: avvisi.append(f'{l}: {len(lenti)} sottotitoli oltre {CPS[l]} car/s di più del 25% ({", ".join(map(str, lenti[:8]))}{"…" if len(lenti) > 8 else ""})')
for l, d in dati.items():
    d['qr'] = qr(d['lingua']['pagina'] + UTM)

for a in avvisi: print('avviso:', a)
for e in errori: print('ERRORE:', e)
if errori: sys.exit(1)

src = os.path.join(radice, 'src.html')
s = open(src, encoding='utf-8').read()
blocco = json.dumps(dati, ensure_ascii=False, separators=(',', ':'))
s2, n = re.subn(r'/\*I18N\*/.*?/\*/I18N\*/', lambda m: '/*I18N*/' + blocco + '/*/I18N*/', s, count=1, flags=re.S)
if n != 1: print('ERRORE: segnaposto /*I18N*/ non trovato in src.html'); sys.exit(1)
open(src, 'w', encoding='utf-8').write(s2)
print('lingue:', ', '.join(dati), '·', len(blocco) // 1024, 'KB di testi ·', len(avvisi), 'avvisi')
