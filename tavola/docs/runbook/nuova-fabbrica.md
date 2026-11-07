# Guida · rifare «Come nasce una colonna» per un'altra fabbrica

Scritta il 29/09/2026 a partire dal progetto FonteAlta (25–29/09/2026). Serve a chi deve raccontare il processo produttivo di un'altra azienda con la stessa tecnica: tavola isometrica animata, tutta disegnata dal codice, con persone al lavoro, voce, sottotitoli, modalità fiera ed esportazione video.

Il progetto di riferimento è in questa cartella: `CLAUDE.md` (regole e comandi), `HANDOFF.md` (stato, decisioni, errori), `docs/history/2026-09-25-verbale-revisione.md` (ogni correzione con la data). Questa guida non li ripete: li usa come esempio.

> **La regola che vale più di tutte le altre:** si disegna solo ciò che si è **visto o letto in una fonte**. Il primo giro di FonteAlta, disegnato a memoria del video, conteneva più di dieci errori di fatto. Ogni elemento senza fonte si segna come «illustrativo», e la lista va al cliente.

---

## 0. Cosa si ottiene, in quanto tempo

**Consegne tipiche:**
- una pagina HTML unica, offline (2–3 MB), con font e voce incorporati;
- modalità fiera (`?kiosk=1`);
- due video MP4 1080p (stile matita e stile a colori);
- i documenti: `CLAUDE.md`, `HANDOFF.md`, verbale, `PRODUCT.md`.

**Tempi realistici** (FonteAlta, con Claude e un responsabile che decide in giornata):

| Fase | Tempo |
|---|---|
| Ricerca e tabella dei fatti | ½ giornata |
| Prima tavola con 12 reparti | ½ giornata |
| Revisioni (fedeltà, movimenti, UX, eventi) e correzioni | 1 giornata |
| Design system del cliente, controllo completo, video | ½ giornata |
| Documenti | 2–3 ore |
| Un'esportazione video | 6–10 minuti di macchina |

Con una fabbrica nuova e il motore già pronto, la parte di codice generico si risparmia: il tempo va quasi tutto in ricerca, scene e revisioni.

---

## 1. Prima di iniziare: cosa chiedere alla fabbrica

Mandare la lista **prima** di disegnare. Ogni risposta che manca diventa un elemento «illustrativo» da dichiarare.

**Materiale**
1. Un video girato in officina, anche dal telefono, che segua il pezzo dall'inizio alla fine. È la fonte principale: macchine, colori, divise, gesti, ordine delle fasi.
2. Foto delle macchine con marca e modello leggibili.
3. L'elenco delle fasi con i numeri veri: dimensioni del materiale, tempi, pressioni, temperature, lotti. E cosa si fa **fuori** (verniciatura, trattamenti, galvanica…).
4. Una foto della marcatura o dell'etichetta del materiale grezzo. Su FonteAlta la stampa sul tubo conteneva colata, norma, ordine di lavoro e data: va letta carattere per carattere.
5. Il sito, le pagine «produzione» e «chi siamo», il blog, i cataloghi.
6. Se esiste già una voce narrante: il file audio **alla qualità originale** (non uno estratto da un video compresso).

**Persone**
7. Chi compare e con che nome; chi non vuole comparire.
8. Divise, colori, DPI (guanti, cuffie, maschere, occhiali), caschi o berretti. Su FonteAlta **nessuno porta il cappellino**: disegnarlo sarebbe stato un errore.
9. Gesti tipici di ogni mestiere, meglio se in un video.

**Marchio e interfaccia**
10. Logo in vettoriale (SVG o PDF); monogramma; colori ufficiali; font con licenza.
11. Il design system, se c'è (su FonteAlta: esportazione di Claude Design, `…/00_Download/…/Fontealta Design System-handoff.zip`). Chiarire subito **dove** vale: su FonteAlta vale sull'interfaccia, mentre il gioco (la scena disegnata) tiene la sua palette.
12. Colori vietati. Su FonteAlta «niente arancione nell'interfaccia».

**Uso**
13. Dove si userà: sito, fiera (schermo in corridoio e/o chiosco touch), social, commerciali. Cambia durata, formato e audio.
14. Per la fiera: quale fiera, regolamento sul suono, misure dello schermo e distanza del pubblico, hardware (mini-PC, schermo touch), chi sta allo stand.
15. Lingue: italiano, inglese, altre.
16. Chi approva e chi decide. Una persona sola: su FonteAlta è Marco.
17. Licenze: voce AI (piano attivo alla data di generazione), musica, font.
18. Pubblicazione: si può mettere online? Con quali nomi?

---

## 2. Ricerca: come si fa bene

**Strumenti** (tutto su `/Volumes/PortableSSD`, mai sul disco interno):
- **Fotogrammi dal video:** `ffmpeg -i video.mp4 -vf "fps=1/5,scale=1280:-1" ricerca/fotogrammi/f_%03d.jpg`. Poi provini: `ffmpeg -i ricerca/fotogrammi/f_%03d.jpg -vf "scale=480:-1,tile=5x4" ricerca/provini/sheet_%d.jpg`.
- **Dettagli piccoli** (targhe, stampe, etichette): estrarre il fotogramma alla risoluzione piena e ritagliare (`-vf "crop=w:h:x:y,scale=iw*3:-1"`). Leggere, non indovinare.
- **Trascrizione della voce:**
  1. `ffmpeg -i voce.mp4 -ar 16000 -ac 1 ricerca/voce-16k.wav`;
  2. `whisper-cli -m /Volumes/PortableSSD/whisper-models/ggml-large-v3-turbo.bin -f ricerca/voce-16k.wav -l it -osrt -of build/tempi`.

  Il WAV a 16 kHz serve **solo** a Whisper. Il video finale usa l'audio originale.
- **Pagine del sito:** salvarle in `ricerca/pagine-sito-salvate/` (restano anche se il sito cambia).
- **YouTube:** `yt-dlp` può essere bloccato (429/403). In quel caso si aprono i fotogrammi nel browser integrato.
- **Ricerca parallela:** con Claude si possono lanciare più agenti in parallelo, per esempio «gesti e DPI di ogni mestiere», «macchine e marche», «norme sul materiale». Ogni agente deve riportare le fonti con l'indirizzo.

**La tabella dei fatti** (modello in `HANDOFF.md` § 10): tema · fatto · fonte (video, voce, sito, registro, foto). Ogni riga deve avere una fonte. Più una lista degli elementi **illustrativi** e una delle **fonti da non usare**.

**Trappole viste su FonteAlta:**
- Una foto ufficiale del sito era **generata con l'AI** (l'essiccazione): colori e ambiente falsi. Guardare le foto con sospetto (luci impossibili, oggetti fusi, testi senza senso).
- Un numero letto male: «COLATA 10642» era in realtà «WO 10642», l'ordine di lavoro. La colata era «Heat n° E251265».
- Il prototipo della pagina «Produzione» aveva indirizzo e P.IVA segnaposto.
- Ciò che la voce dice non coincide sempre con l'officina: la fabbrica **non** fa la verniciatura né la marcatura del grezzo. Chiedere.
- Il sito può contraddirsi: «AISI 316, solo quello» e poi una collezione in rame.

---

## 3. Sceneggiatura, voce e tempi

1. **Prima la voce, poi le scene.** L'ordine dei reparti segue la voce; se l'officina lavora in un altro ordine, lo si dichiara nella scheda finale (su FonteAlta: «fresatura e saldatura vengono prima…»).
2. **Tempi dei reparti** (`CUES_V`): l'inizio di ogni reparto in secondi, preso dalla trascrizione con i tempi. `END_V` è la fine della voce.
3. **Tempi di lettura** (`CUES_R`): se la voce è spenta, la durata di ogni reparto si calcola dal numero di parole del testo (è già nel codice).
4. **Giro breve per la fiera** (`CUES_S`): 4,5 s per reparto, 54 s in tutto.
5. **Sottotitoli** (`CAPS`): dalla trascrizione con i tempi, **corretti a orecchio** prima di pubblicare. Su FonteAlta resta un dubbio («TIG a raggio V»).
6. **Testi della scheda** (`TXT`): per ogni reparto titolo (≤ 5 parole), riga dati (numeri veri, separati da «·»), testo di 40–60 parole. `INTRO` e `OUTRO` per la tavola intera.
7. **Voce generata con l'AI:** verificare la licenza commerciale del piano attivo alla data di generazione (su ElevenLabs solo i piani a pagamento).

---

## 4. Il motore: cosa si riusa e cosa si rifà

Si parte da una copia di `src.html` di FonteAlta. Tutto sta in un solo file.

| Parte (sezione commentata in `src.html`) | Riuso | Cosa cambiare |
|---|---|---|
| inchiostri (`PAPER`, `INK`, `INK3`, retini, fuori registro) | ✅ | la palette del gioco, se il cliente la vuole diversa |
| primitive di stampa (`shp`, `box`, `cyl`, `pipe`, `band`, `dot`, `ptext`) | ✅ | niente |
| `jcol`, `jlie`, `jliePts` (colonne a J) | ❌ | forme del prodotto della nuova fabbrica |
| `wallLogo` + `LOGO` (logo dai tracciati SVG) | ✅ | rigenerare `LOGO` dal nuovo `logo.svg` (vedi § 6) |
| persone (`person()`, preset) | ✅ | preset delle divise (`ANDREA`, `GUANTI_FLUO`…) |
| animazione senza scatti (`kf`, `kfl`, `walkOf`, `strideOf`, `fadeT`) | ✅ | niente |
| etichette (`lab`, `drawLabels`) | ✅ | niente |
| 12 scene `S.push(t=>{…})` | ❌ | tutte: sono il racconto |
| capannone (`STATIONS`, `PITCH`, `BAY`, `HX`, `HY`, `NAMES`, `hall()`) | ⚠️ | numero e disposizione dei reparti, nomi, insegne sui muri |
| mezzi nei corridoi (muletto, carrello) | ⚠️ | percorsi, se cambia la pianta |
| camera, inquadrature, input, ciclo `frame()` | ✅ | niente |
| testi (`TXT`, `INTRO`, `OUTRO`, `CUES_V`, `END_V`), sottotitoli (`CAPS`) | ❌ | tutti |
| modalità fiera e video | ✅ | testo del QR e del riquadro |
| CSS dell'interfaccia | ⚠️ | token del design system del cliente |
| `build/build.py`, `build/tools/*` | ✅ | niente (percorsi relativi) |

**Pianta:** reparti di 12×12 unità (`BAY`), passo 14 (`PITCH`), capannone di 54×40 (`HX`, `HY`), 12 reparti su 3 file da 4. Con un numero diverso di reparti vanno cambiati `STATIONS`, `HX`/`HY`, il percorso nei corridoi (`route` in `hall()`) e i mezzi.

**Proiezione:** `P(x,y,z)` trasforma le unità del mondo in pixel (`U=16`, isometria a 30°). `x` va verso destra-giù, `y` verso sinistra-giù, `z` verso l'alto.

---

## 5. Disegnare le scene: regole che evitano gli errori

**Fedeltà**
- Macchine: forma, colore e protezioni come nel video. Su FonteAlta la piegatrice era antracite con carter gialli, non tutta gialla.
- Materiali: nessun colore «da ottone» se il pezzo è in acciaio; nessun rame verniciato.
- Ogni cosa scritta in un'etichetta deve comparire nella tabella dei fatti.
- Niente effetti inventati: scintille solo dove ci sono davvero (su FonteAlta, alla levigatura c'è polvere, non scintille).

**Persone** (`person(x, y, opzioni)`)
- Chi lavora su un pezzo **alle sue spalle** rispetto alla vista si disegna **di schiena** (`view:-1`). Di fronte sembra lavorare nel vuoto.
- Distanza dal pezzo: un avambraccio. Statura: `PS=1.05`. Nella v1 gli omini erano alti l'equivalente di 2,05 m.
- Le braccia hanno una lunghezza massima: non si allungano per raggiungere un pezzo lontano, si sposta la persona.
- Divise e DPI dal video (preset); nessun accessorio inventato.
- Gesti: ciclo del mestiere vero (presa, spinta, controllo), preso dalle schede di sicurezza o dai video.
- Opzioni utili: `face`, `view`, `walk`, `stride`, `hands`, `hb`, `lean`, `crouch`, `bow`, `shirt`, `pants`, `gloves`, `gear` (`'weld'`, `'mask'`), `muffs`, `glasses`, `beard`, `hair`, `valve`, `hoodie`, `sit`, `z`.

**Movimento senza scatti**
- Ogni ciclo deve finire **esattamente** come comincia. Quando un pezzo esce di scena, si fonde con una pila identica e ne ricompare uno uguale all'inizio.
- `kf` per chiavi con rallentamento; `kfl` per velocità quasi costante (niente corse a 3 volte la media).
- Il passo segue la strada percorsa (`walkOf`) e l'ampiezza la velocità (`strideOf`): i piedi non pattinano.
- Velocità realistiche: su FonteAlta una corsa a 9 m/s è sfuggita alla prima versione.
- Verificare con una misura: un banco che campiona le posizioni dei giunti e degli oggetti e segnala salti sopra una soglia. Su FonteAlta 55 px → 0 dopo le correzioni. Il banco è andato perso: ricrearlo in `build/tools/` all'inizio del progetto.

**Ordine di disegno** (il canvas non ha profondità: vince chi è disegnato dopo)
- Dal fondo al davanti: `x+y` crescente.
- Ciò che sta **sopra** (una trave) si disegna **dopo** ciò che sta sotto (la testa appesa).
- Ciò che sta **a terra** (riquadri, percorsi, evidenziazioni) si disegna **prima** di tutto il resto del reparto, mai alla fine.
- Ogni oggetto appoggiato deve toccare qualcosa. Su FonteAlta i binari del waterjet stavano a fianco della vasca, sospesi nel vuoto.
- Nulla fuori dai bordi: un foro del waterjet cadeva fuori dalla lamiera.
- Controllo: zoom su ogni macchina in stile 3D a colori, dove gli errori si vedono meglio.

**Scritte**
- Nella scena solo insegne grandi (logo, nome del reparto a terra). Tutto il resto va in etichette a schermo (`lab(x, y, z, 'testo', dx, dy)`), ≥ 12,5 px, che non si sovrappongono e non finiscono sotto i sottotitoli.
- Insegne sui muri: brevi. Su FonteAlta «AISI 316. SOLO QUELLO.» è diventato «AISI 316».

---

## 6. Interfaccia e marchio

- **Design system del cliente solo dove il cliente lo vuole.** Su FonteAlta: interfaccia (titolo, scheda, pulsanti, indice, sottotitoli, QR, invito al tocco) nel design system di Claude Design; il gioco nello stile risograph. Chiedere prima: «vale anche per l'illustrazione?». Su FonteAlta il primo tentativo l'ha applicato anche al gioco e si è dovuto tornare indietro.
- I token (colori, font, raggi, ombre, easing) stanno nelle variabili CSS in cima allo stile. Il gioco ha le sue costanti `INK`/`INK3`/`PAPER`.
- **Logo sul muro:**
  1. copiare il `logo.svg` ufficiale in `build/brand/`;
  2. estrarre i tracciati e le matrici dei gruppi `<g transform>`, come si è fatto per FonteAlta con uno script Python, in `const LOGO=[{m:[a,0,0,d,e,f],d:['M…']}]`;
  3. disegnarli con `wallLogo(x, y, z, altezza)`.

  Mai ridisegnare un logo a mano.
- **Niente logo doppio:** su FonteAlta Marco ha tolto quello in alto a sinistra, perché il logo stava già sull'insegna.
- **Font:** incorporati da `build.py` (base64). Controllare la licenza: Satoshi (Fontshare/ITF), Archivo e JetBrains Mono (SIL OFL).
- **QR:**
  1. `PYTHONPATH=build/tools/pylib python3 -c "import segno; segno.make('URL?utm_source=…&utm_medium=…', error='m').save('build/qr.svg', border=4)"`;
  2. **aggiungere `viewBox`** all'SVG, altrimenti resta minuscolo come su FonteAlta (37 px invece di 120);
  3. provarlo con un telefono.

---

## 6 bis. Più lingue (fatto su FonteAlta il 20/10/2026)

- **Dal primo giorno, nessun testo nel codice.** Tutti i testi in `i18n/<lingua>.json`, con chiavi stabili; `build/i18n.py` li controlla e li copia nella pagina. Su FonteAlta si è dovuto estrarre tutto dopo: 37 etichette, 61 sottotitoli, ~35 testi d'interfaccia.
- **Glossario dal sito del cliente**, se è già tradotto, e traduzioni dalla lingua sorgente (non passando dall'inglese). Poi una revisione di un madrelingua del settore.
- **Selettore:** nome della lingua nella lingua stessa (bandierine solo se il sito le usa già), `lang` su ogni voce, `html lang` aggiornato. Dentro il sito del cliente la tavola segue la lingua del sito (`?lang=xx&embed=1`) e non mostra un secondo selettore.
- **Fiera:** pulsanti di lingua grandi sulla schermata d'attesa; dopo l'inattività si torna alla lingua iniziale.
- **Sottotitoli tradotti sui tempi della voce:** al massimo 42 caratteri per riga e 17 caratteri al secondo (20 in inglese), controllati da script.
- **Lunghezze:** il tedesco allunga fino al 30–40%. Pulsanti e titoli devono andare a capo, mai finire sotto altri elementi. Provare sempre su telefono in verticale e in orizzontale.
- **Voce:** decidere presto se doppiare. Altrimenti voce originale con i sottotitoli tradotti, dichiarato sul pulsante.

## 7. Accessibilità e fiera (numeri da rispettare)

**Pagina (WCAG 2.2 AA):**
- tastiera completa con focus visibile;
- «Ferma le animazioni» (2.2.2);
- rispetto di `prefers-reduced-motion`;
- contrasto ≥ 4,5:1 sul testo;
- pulsanti ≥ 44 px al tocco (56 px nel chiosco);
- testi per lettori di schermo per ogni reparto;
- sottotitoli nei video;
- nessun lampeggio oltre 3 al secondo.

**Chiosco:**
- giro breve che gira da solo e racconto al tocco;
- reset dopo 45 s senza tocchi, **mai durante il racconto**;
- avviso «Sei ancora lì?» con ≥ 20 s per prolungare (manca su FonteAlta);
- blocco di menu contestuale e zoom;
- comandi tra 380 e 1.220 mm da terra;
- pulsante principale ≥ 75 mm;
- voce muta.

**Schermo in fiera:**
- controllare il regolamento sul suono (Cersaie di norma lo vieta);
- video corto e muto, 60–90 s;
- sottotitoli o testi ≥ 38 px su 1080p per 5 m su un 65";
- QR sempre visibile, ~1 cm ogni 10 cm di distanza, margine di 4 moduli;
- LCD meglio di OLED;
- due chiavette e un portatile di riserva.

**Hardware:** piano di prova in `HANDOFF.md` § 6: avvio a freddo, crash, blackout, 8–12 h, aggiornamenti di Windows e del browser fermi, QR con 3 telefoni.

Fonti e dettagli: `HANDOFF.md` § 5, § 6 e «Fonti principali».

---

## 8. Costruire, provare, esportare

Comandi completi in `CLAUDE.md` § Comandi e in `HANDOFF.md` § 12. In sintesi:

1. **Prova senza browser:** `cd build/tools && npm run test`. Tre volte «nessun errore». Il banco inserisce un gancio prima della riga `if(!VIDEO)requestAnimationFrame(frame);`: se si cambia quella riga, aggiornare `test-headless.js`.
2. **Pagina finale:** `npm run build`. Solo così: font incorporati, `<head>` corretto, audio in fondo.
3. **Controllo visivo:** `node controlli/check.js <cartella>` (server su 8765): 12 reparti in matita e 3D, tavola, fiera, telefono verticale e orizzontale, errori della console. Guardare **tutte** le immagini.
4. **Video:** server dedicato (`python3 -m http.server 8766 --bind 127.0.0.1`), poi `node record.js "<url>?video=1" <uscita.mp4> <voce originale> 30`, e `?video=3d` per i colori. Prova breve con un quinto argomento in secondi.
5. **Controlli sul video:**

| Controllo | Valore atteso |
|---|---|
| `ffprobe` | `level=41`, `yuv420p`, `color_range=tv`, `bt709` |
| `ebur128` | −14 LUFS ±1, picco ≤ −1 dBTP |
| `blackdetect` | nessun nero |
| QR | letto sul fotogramma finale anche ridotto a un terzo, e da un telefono |

6. **Impronte:** `shasum -a 256 … > CONSEGNE.sha256`.

**Perché il video si fa così:** la pagina ha un orologio pilotato dall'esterno (`window.__video.step(dt)`). Playwright avanza di 1/30 s, fa uno screenshot JPEG e lo passa a ffmpeg, che converte a gamma TV BT.709 livello 4.1, aggiunge la voce con 3 s di ritardo, la normalizza a −14 LUFS e scrive l'MP4 con faststart. Il risultato è identico ogni volta: il master è il progetto.

---

## 9. Revisioni: quali, in che ordine

Ognuna trova errori diversi. Su FonteAlta ognuna ne ha trovati.

1. **Fedeltà** (dopo la prima tavola): confronto riga per riga con il video e la tabella dei fatti. Due passate.
2. **Skill di design** (`impeccable`, `ui-ux-pro-max`, `design-review`): leggibilità, misure dei pulsanti, contrasti, pausa.
3. **Senior UX engineer:** schermi bassi, zoom 200%, telefono verticale e orizzontale, pulsanti ambigui.
4. **Senior UX game engineer:** salti, telecamera, pizzico, clic sbagliati, piedi che pattinano, **misurati**.
5. **UX engineer per eventi:** fiera, chiosco, suono, QR, affidabilità.
6. **Ricerca sulle buone pratiche** di handoff, video in fiera, chioschi e produzione video: ha trovato il QR illeggibile e i colori del video.
7. **Controllo completo finale** (`check.js` + zoom sulle macchine): ha trovato il portale del waterjet, il riquadro sopra gli oggetti, la fila irraggiungibile sul telefono in orizzontale, le etichette sotto i sottotitoli.

Ogni revisione va nel verbale, con la data, cosa ha trovato e cosa si è corretto.

---

## 10. Errori da non ripetere (tutti quelli di FonteAlta)

**Contenuti**
- Disegnare a memoria del video. → Tabella dei fatti prima di disegnare.
- Leggere male una stampa (colata/ordine di lavoro). → Ingrandire il fotogramma.
- Usare una foto AI come fonte. → Controllare le foto.
- Mettere in officina ciò che si fa fuori (verniciatura, marcatura del grezzo). → Chiedere.
- Colori delle macchine inventati; pezzi color ottone per un pezzo in acciaio; rame verniciato. → Dal video.
- Cappellini, grane, scintille, calibro inventati. → Nulla senza fonte.
- Proporzioni del prodotto sbagliate (colonne a forcina invece che a J). → Misure del catalogo.
- Numeri sbagliati («parete oltre 3 mm» con la stampa che dice 3,00). → Copiare i numeri dalla fonte.

**Animazione**
- Tutti di fronte, braccia elastiche fino a 5 volte la lunghezza, omini lontani e giganti.
- Cicli che scattano, corse troppo veloci, piedi che pattinano.
- Oggetti sospesi, fuori dai bordi, disegnati nell'ordine sbagliato.

**Interfaccia**
- Pulsanti da 31 px e testi da 11 px; pausa che non ferma la scena; scritte a retino illeggibili.
- Suggerimento iniziale che il cliente non vuole: chiedere prima.
- In una fila con scorrimento orizzontale, `justify-content:flex-end` rende irraggiungibili i primi elementi.
- Etichette che finiscono sotto i sottotitoli.
- Elementi della fiera visibili fuori dalla fiera: serve la regola `[hidden]{display:none!important}`.

**Tecnica**
- Primo intervallo di tempo negativo → pagina bloccata: limitare `dt` a [0; 0,05].
- SVG senza `viewBox` → QR minuscolo.
- Video a gamma piena BT.601 livello 5.0 → colori sbagliati sulle TV: tenere il filtro di `record.js`.
- Stile salvato nel browser dalla modalità fiera → il video usciva in 3D nelle prove: la modalità video forza lo stile.
- Pannello del browser nascosto → animazioni ferme, sembra un bug e non lo è.
- `python -m http.server` senza Range → la voce separata non salta: provare il file finale.
- `src.html` servito senza `<meta charset>` → «Â·» (lo aggiunge `build.py`).
- zsh non spezza le variabili sugli spazi → `bash -c` per i cicli.
- `grep " I:"` sull'uscita di `ebur128` stampa migliaia di righe → escludere `Parsed_ebur`.
- Il server del pannello del Code tab può essere fermato dall'app → per le esportazioni un server dedicato.
- Più agenti nello stesso browser → una scheda per agente.

**Metodo**
- Strumenti in cartelle temporanee, persi il giorno dopo → tutto in `build/tools/` dal primo giorno.
- Materiale fuori dalla cartella del cliente → tutto nella cartella del progetto; mai file pesanti sul disco interno.
- Eliminare file → nella cartella madre FonteAlta non si elimina: si sposta in `archivio/` e si traccia in un TSV.
- Interpretare in largo una richiesta ambigua di stile → chiedere «vale anche per l'illustrazione?».

---

## 11. Checklist prima di consegnare

- [ ] Tabella dei fatti completa; lista degli illustrativi mandata al cliente.
- [ ] `npm run test` → 3 × «nessun errore».
- [ ] `npm run build` rifatto dopo l'ultima modifica.
- [ ] `check.js`: tutte le immagini guardate; zoom su ogni macchina in 3D.
- [ ] Movimenti misurati: 0 salti.
- [ ] Fiera: niente sovrapposizioni, QR leggibile, reset corretto.
- [ ] Telefono verticale e orizzontale: tutti i comandi raggiungibili.
- [ ] Video: `ffprobe`, `ebur128`, `blackdetect`, QR ridotto e da telefono, sottotitoli riletti.
- [ ] `CONSEGNE.sha256` aggiornato.
- [ ] Verbale con la voce del giorno; `HANDOFF.md` e `CLAUDE.md` § Baseline aggiornati.
- [ ] Decisioni aperte del cliente elencate (uso, pubblicazione, licenze).
- [ ] Niente pubblicato senza il via del cliente.

---

## 12. Come avviare il lavoro con Claude (traccia della prima richiesta)

> Nuovo progetto: tavola isometrica animata del processo produttivo di <FABBRICA>, sul modello di «Come nasce una colonna» di FonteAlta (`…/FonteAlta/Fonte alta cartella madre/12_Video/Produzione-animata/`, leggi `CLAUDE.md`, `HANDOFF.md` e `docs/runbook/nuova-fabbrica.md`).
> Materiale: video in officina `<percorso>`, sito `<url>`, logo `<percorso>`, design system `<percorso>` (vale solo per l'interfaccia / anche per il gioco), voce `<percorso>`.
> Crea la cartella `<cliente>/…/Produzione-animata/` con `src.html` copiato da FonteAlta, `build/`, `ricerca/`, `archivio/`. Tutto sull'SSD.
> Prima fai la tabella dei fatti con le fonti e la lista delle domande aperte, e fermati per la mia revisione. Poi le scene.
> Uso: <sito / fiera / social>; lingua: <…>; chi decide: <nome>.

Poi, in ordine: tabella dei fatti → approvazione → testi e tempi → scene → prova senza browser → revisioni del § 9 → interfaccia col design system → controllo completo → video → documenti.

---

## 13. Struttura della cartella da replicare

```
<cliente>/…/Produzione-animata/
├── CLAUDE.md  HANDOFF.md  docs/history/2026-09-25-verbale-revisione.md  PRODUCT.md  CONSEGNE.sha256
├── src.html   voce.mp3    <nome>.html  <nome>.mp4  <nome>-colori.mp4
├── build/     build.py  fonts/  brand/  qr.svg  tempi.srt  qc/  tools/ (package.json, node_modules, test-headless.js, record.js, controlli/, pylib/)
├── ricerca/   fotogrammi/  foto-sito/  pagine-sito-salvate/  provini/  voce-16k.wav
└── archivio/  versioni precedenti, datate e con il motivo nel nome
```

`CLAUDE.md` sotto 200 righe e 20 KB, fatto con la skill `docs-progetto`: indice, comandi, decisioni, trappole, numeri con la data. Tutto il resto nei documenti a cui rimanda.
