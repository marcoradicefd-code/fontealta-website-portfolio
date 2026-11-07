# La tavola dell'officina sul sito: le scelte di Marco

> **Stato: APPROVATA** da Marco il 27/10/2026, con tre correzioni dello stesso giorno: la 10.2 scritta come
> decisione in chat, i recinti della PR 1 verificati da Cowork su `bcfd4bc`, la soglia di Lighthouse su
> `/produzione`. Nessuna scelta aperta.
>
> Spec del 27 ottobre 2026. Grill e FASE 0 del 27/10, senza codice; il prompt è
> `tmp/prompts/2026-10-27-tavola-grill.md`. Entra in `docs/specs/tavola-officina.md` con la PR 1 del
> cantiere e fa fede finché il cantiere è aperto. Le misure sono del 27/10 e ogni PR le rifà.

## Da dove viene

- **La tavola** «Come nasce una colonna»: progetto in
  `…/Fonte alta cartella madre/12_Video/Produzione-animata/` (non sotto git), con il suo `CLAUDE.md`
  (dal 27/10, PR #311, il sorgente è in `tavola/` e quella cartella è congelata come
  `Produzione-animata_ARCHIVIO-vedi-repo/`, con `LEGGIMI.txt`),
  `HANDOFF.md` e le decisioni bloccate del 26/09-26/10. Sorgente `src.html` più `i18n/<lingua>.json`; il
  build (`build/i18n.py`, `build/build.py`) produce un file unico da 2,56 MB per fiera e video.
- **Il parere dei developer e le misure** del 22/10: `docs/history/2026-10-22-parere-dev-tavola-sul-sito.md`
  della tavola e il memo per il capo (artefatto privato).
- **I provini** del 27/10, sulla produzione vera, iniettati nel browser: `tmp/tavola/provini/`. Facciate
  candidate: `tmp/tavola/facciata/`. Misura del video 720p: `tmp/tavola/video/`.

## Le scelte

### Dove sta il codice (Q1)

- Il sorgente entra nel repo del sito in **`tavola/`**, alla radice. Non è mai servito.
- **`build:web`** scrive l'output leggero in **`public/officina-tavola/`**, che è committato: Vercel costruisce
  da git e non può lanciare Python. Il file da 2,56 MB per la fiera, i video e le prove stanno in `.gitignore`.
- **Restano sull'SSD, fuori da git**: video (~985 MB), `archivio/` (1,3 GB), `build/qc/` (71 MB), `ricerca/`
  (22 MB, le fonti dei fatti), `node_modules`, le librerie Python. Il `CLAUDE.md` della tavola dice dove.
- **Entra in git** (misurato il 27/10): circa 0,75 MB di sorgente (`src.html` 200 KB, `i18n` 80 KB, font
  239 KB, build e strumenti ~75 KB, documenti ~140 KB) più la voce sorgente (1,4 MB). Due file di JetBrains
  Mono sono doppioni e restano fuori. **Ogni nuova versione della voce aggiunge 1,4 MB alla storia di git:
  se la voce cambierà spesso, si rivaluta di tenerla solo su R2.**
- **Nessuna dipendenza propria** (proposta di Claude, approvata da Marco il 27/10/2026). Gli strumenti della
  tavola usano il `@playwright/test` del sito (stesso `chromium`; oggi la tavola ha Playwright 1.59.1, il sito
  1.64.1, e i video vanno comunque riesportati); nessun `package-lock.json`, nessun npm. Python solo per `segno` (il QR), installato con
  `pip install --target tavola/build/tools/pylib segno==1.6.6`, la cartella di oggi, che `i18n.py` trova da
  sé, in `.gitignore` (Marco, 27/10: nessuna modifica al sorgente). Gli strumenti chiamano
  `require('@playwright/test')`: `playwright` da solo non sta nella radice di pnpm. `pnpm -r ls` vede solo la
  radice (`pnpm-workspace.yaml` non ha `packages:`), e la CI non installa niente di nuovo.
- **Fuori dai controlli del sito** (recinti verificati da Cowork su `bcfd4bc`, 27/10):
  - `@source not` per `tavola/` e per `public/officina-tavola/` in `globals.css`;
  - `tsconfig.json`: `tavola` nell'`exclude` (l'`include` prende ogni `**/*.ts` e `**/*.mts`);
  - Sonar: `tavola/**` e `public/officina-tavola/**` in `sonar.exclusions` e in `sonar.cpd.exclusions`, perché
    le righe contano sul tetto dell'organizzazione;
  - `.prettierignore`: `tavola/` (`public` c'è già); ESLint: le due cartelle in `globalIgnores`;
  - `vercel-ignore-build.sh`: `^tavola/` fra i percorsi che non costruiscono, col suo caso in
    `vercel-ignore-build.test.ts`; `public/officina-tavola/` **continua a costruire**;
  - grafo.
- **Per la firma è codice, non documenti.** La divisione è obbligata: `e2e-firma.test.ts` (il test «sono
  esattamente i percorsi dei @source not di globals.css») pretende che i `@source not` coincidano coi percorsi
  «soli documenti». Il test distingue «fuori dal CSS» da «documenti», con un elenco esplicito delle cartelle di
  codice fuori dal CSS. Una PR che tocca solo `tavola/` non costruisce su Vercel ma gira l'e2e intero.

### La pagina della tavola (Q2, rivista il 27/10)

- **Una pagina del sito**, col suo header, in cinque lingue: `/officina`, `/en/workshop`, `/de/werkstatt`,
  `/fr/atelier`, `/es/taller` (chiave nuova in `routing.ts`).
- **Niente footer** (provino `officina-1440-con-footer.png`: col footer la pagina scorre).
- **La griglia** sta sul contenitore della pagina: `grid-template-rows: var(--fa-nav-h) 1fr`. La prima riga è
  lo spazio dell'header, che resta `fixed` e non si tocca; la seconda è l'iframe. Nessuna altezza scritta a mano.
- **`body:has(...)` in `globals.css`**: `html` e `body` a `height: 100vh; height: 100dvh; overflow: hidden;
  overscroll-behavior: none`, il footer in `display: none`. Niente JavaScript, layout del sito invariato.
- **Lenis: nessun codice.** La rotella sopra l'iframe va al documento dell'iframe; sopra l'header Lenis ha
  limite 0. Lo custodisce un e2e su `scrollY`.
- **L'iframe**: `src="/officina-tavola/index.html?embed=1&lang=<locale>"`, `title` tradotto, `key={locale}`
  (un `src` che cambia lascerebbe una voce nella cronologia dell'iframe: Indietro tornerebbe alla tavola nella
  lingua di prima). **Nessun `sandbox`**: senza `allow-same-origin` i font non arrivano (richieste CORS con
  `Origin: null`) e Safari rallenta il disegno; con `allow-same-origin` non protegge più niente (MDN).
- **Lingua**: comanda l'header. `embed=1` nasconde il selettore interno, **anche sul telefono** (provino
  `officina-390.png`, `officina-390-menu.png`), e non salva `fa-lingua`. Nessun `postMessage` per la lingua.
  Al cambio di lingua l'iframe si ricrea: voce e punto del giro ripartono, ed è accettato.
- **Niente «← Produzione»**: c'è l'header, e l'Indietro nativo.
- **Accessibilità**: `<h1>` solo per lettori di schermo col titolo della pagina; skip link verso
  `#main-content`, poi il Tab entra nella tavola; Esc resta della tavola (vista d'insieme). Il logo è quello
  dell'header: la decisione della tavola «niente logo in alto» (26/09) resta valida.
- **CSP**: `frame-src 'self' https://www.google.com`. `X-Frame-Options: SAMEORIGIN` e `frame-ancestors 'self'`
  restano. Verifica sull'anteprima coi rapporti `[csp-report]`.

### SEO della pagina (Q2, Q7)

- **`robots: noindex, follow`**, **nessun canonical, nessun hreflang, nessun `og:url`**, fuori dalla sitemap:
  la forma di `/area-riservata`. I metadati li scrive la pagina, non `route-metadata.ts` (che crea canonical e
  hreflang per costruzione).
- **Testi IT approvati**: title «Come nasce una colonna» (più « | Fontealta» dal template), `og:title` nudo
  uguale, description «L’officina di Viareggio in dodici reparti, dalla barra d’acciaio alla colonna
  imballata.». Tradotti nelle cinque lingue.
- **`og:image`**: la tavola scattata a 1200×630 nello stesso istante della facciata, prodotta da `build:web`
  (corretto il 27/10, PR 2: era «il ritaglio 1200×630 della facciata»; un ritaglio del 1280×720 tagliava il muro
  in alto, scattata alla sua misura la camera si adatta da sola; scelta di Marco), con l'alt approvato
  «Tavola illustrata dell’officina Fontealta di Viareggio: i dodici reparti, dalla barra d’acciaio alla
  colonna imballata».
- **Le guardie si adattano**: in `metadata-indicizzabili.spec.ts` l'unica esclusa `AREA_RISERVATA` diventa un
  elenco di chiavi escluse (`/area-riservata`, `/officina`), con le stesse prove per tutte e due. Sitemap e
  `sitemap.test.ts` non cambiano (`ROTTE_STATICHE` è un elenco esplicito).
- **`X-Robots-Tag: noindex`** anche su `/officina-tavola/:path*`, da `headers()`.

### Peso e file (Q4)

- **Voce su R2, non in `public/`.** `build:web` scrive il file con l'impronta nel nome (`voce-it-<sha8>.mp3`)
  in una cartella ignorata da git, e in `data-src` l'indirizzo `https://media.fontealta.it/tavola/voce-it-<sha8>.mp3`.
  Una versione = un file nuovo, mai sovrascritto. Lo carica Marco, col comando che `build:web` stampa
  (`wrangler r2 object put … --content-type audio/mpeg --cache-control "public, max-age=31536000, immutable"`),
  oppure con una Transform Rule su `media.fontealta.it/tavola/*`. Prima dello STOP: `fetch` di Node, 200,
  `audio/mpeg`, 206 sul Range, `cache-control` giusto. Senza CORS (la tavola usa `<audio>`): verificato
  sull'anteprima. Oggi (27/10, sul catalogo PDF) il dominio dà 206 sul Range e `max-age=14400` senza metadati.
- **Font**: Archivo e JetBrains Mono restano (decisione del 26/09: la scena li usa), come file `woff2` in
  `public/officina-tavola/`; Satoshi copiato lì (42 KB; il sito lo serve da un indirizzo che cambia a ogni build).
- **Facciata**: la produce `build:web` (la tavola senza interfaccia, 1280×720 a DPR 2 = 2560×1440 nativi, come
  la sonda del 27/10), il sito la serve con `next/image` e `sizes`. PNG per la facciata, JPEG a 85 per la og
  (Marco, 27/10). Istante: la vista d'insieme a 6 s (Marco, 27/10), scattata con l'orologio della modalità video
  (`?video=1&facciata=1`: vista d'insieme ferma, inquadrata come fuori dal video), l'unico che dà gli stessi byte a
  ogni giro (PR 2, misurato).
- **La guardia del manifest**: `build:web` scrive `manifest.json` con le impronte sha256 dei sorgenti e
  l'indirizzo della voce; una prova Vitest le ricalcola e diventa rossa se il sorgente è cambiato senza ricostruire.

### La facciata su `/produzione` (decisione 1 di Marco, Q2, Q10)

- **Al posto della sezione di chiusura**, come il riferimento RiFRA: titolo a sinistra, testo a destra (sopra
  e sotto sul telefono), la facciata sotto, la didascalia sotto la facciata. Titolo «Il tempo è un materiale.»
  e paragrafo restano, con le traduzioni di oggi. Didascalia «Ricostruzione illustrata dell’officina di Viareggio.»
- **Raggio `--radius-3xl`**, come le card con la foto. **Senza traccia bianca**, deciso da Marco in chat il 27/10
  (scelta A sul confronto annotato `tmp/tavola/provini/confronto-traccia-10-2.png`): l'immagine arriva
  all'inchiostro senza bordo.
  ⚠️ È diverso dalla card collezione sul crema, che tiene la traccia (23/10): lì è una card, qui un'illustrazione.
- **Bottone «Esplora l’officina →» inverso** (`Button` primario `dark`), centrato sopra l'immagine. Il
  secondario scuro sul crema dell'immagine non si legge (provino).
  ⚠️ **Corretto il 27/10/2026 (PR #315, Marco sul provino):** il bottone sta sopra il crema dell'illustrazione ed è
  il primario su chiaro, navy pieno col testo chiaro, con `--shadow-floating-pill`. Didascalia centrata.
- ⚠️ **La facciata solo da 1024 px** (Marco, 27/10/2026, dopo la prova su iPhone: sul telefono la tavola si vede
  troppo piccola). Sotto 1024 la chiusura resta com'era: titolo e paragrafo centrati, nessuna figura, nessun link a
  `/officina`. Lo decide la larghezza, in CSS, senza rilevamento del dispositivo; l'immagine, pigra e nascosta, non
  si scarica (e2e a 390 e 768, Chromium e WebKit). `/officina` resta raggiungibile dal telefono con l'indirizzo.
- **Un solo link** che contiene immagine e bottone, nessun elemento interattivo annidato: l'immagine dentro il
  link ha `alt=""`, il nome del link è «Esplora l’officina», la freccia `aria-hidden`, la didascalia è
  `aria-describedby`. Porta alla pagina della tavola nella lingua corrente, stessa scheda.
- **La tavola non pesa finché non si apre**: su `/produzione` nessuna richiesta verso `/officina-tavola/`.

### Movimento e prestazioni (Q3, Q5)

- **Nessun codice nuovo per la pausa**: in una scheda nascosta il browser ferma già `requestAnimationFrame`;
  la voce continua come ogni audio. Movimento ridotto e «Ferma le animazioni» restano come sono. Il fermo per
  inattività resta della modalità fiera.
- **Nessun video al lancio.** Prova su iPhone vero e su un Android se c'è: almeno 24 fps nel giro, nessun
  blocco al tocco. Se non regge, un link «Guarda il video» (720p, CRF 26: 39,9 MB misurati sul video a puntini
  del 26/09, riferimento per il ripiego).
  ⚠️ **Aggiornato il 27/10/2026 (PR #315):** la prova su iPhone di Marco ha dato un motivo diverso dalle
  prestazioni: sul telefono la tavola si vede troppo piccola. La facciata quindi non c'è sotto 1024 px, e sul
  telefono `/produzione` non porta alla tavola. Il video di ripiego resta l'apertura per dare al telefono il racconto
  dell'officina in una forma che si legge a quella misura; si decide a parte.
  ⚠️ **Chiuso il 28/10/2026 (Marco, PR #318):** la prova su iPhone e Android, fluidità compresa, non serve più. Dal
  27/10 la facciata compare solo da 1024 px, quindi dal sito il telefono non arriva a `/officina`, che resta
  raggiungibile solo con l'indirizzo diretto.

### Statistiche (Q8)

- La visita a `/officina` la conta `<Analytics />` del layout. Quattro eventi personalizzati (Pro: inclusi,
  2 proprietà, 0,03 $ ogni 1.000, senza tetto):
  - `officina_apri {lingua}`: clic sulla facciata;
  - `officina_voce {lingua}`: voce accesa, una volta per visita;
  - `officina_giro {lingua, voce}`: giro completo;
  - `officina_reparto {reparto}`: clic su un reparto dell'indice.
- Dalla tavola alla pagina con `postMessage`; la pagina accetta solo `event.origin === location.origin` e solo
  quei quattro nomi, e chiama `track()`. Tutto il resto si ignora. Niente cookie: la cookie policy non cambia.

## Le PR

1. **Trasferimento** del sorgente in `tavola/`, coi recinti. Regole del CSS servito prima e dopo: uguali.
2. **Tavola web**: `build:web` (voce su R2, font, manifest, facciata 2560 e og 1200×630), i
   `postMessage` degli eventi, output in `public/officina-tavola/`. Nessun link verso l'output.
3. **Pagina `/officina`**: rotta in cinque lingue, iframe, CSS `:has()`, metadati noindex, CSP, guardie.
   Raggiungibile da chi conosce l'indirizzo: va bene.
4. **Facciata su `/produzione`**: il lancio.

### Cancello della PR 4 (il lancio)

La PR 4 parte solo dopo, tutti insieme:

- **OK di Andrea** sui contenuti della tavola (D1 dell'handoff della tavola), **ritratto compreso**: i parametri
  con cui la tavola lo disegna (`ANDREA` in `tavola/src.html`) restano finché li vede lui (Marco, 27/10);
- **rilettura delle traduzioni** EN/DE/FR/ES della tavola e della pagina (Alma);
- **licenza ElevenLabs verificata**: piano attivo il 28/05/2026, data di generazione della voce (D5);
- **OK del capo** alla tavola sul sito (D8);
- **sottotitoli corretti a orecchio**, «TIG a raggio V» compreso (Marco ascolta, Claude corregge);
- **rilettura della dichiarazione di accessibilità** della tavola (§ 9 dell'handoff, la rilegge Marco).

**Stato del cancello il 27/10/2026, PR #315** (riferito da Marco quel giorno, voce per voce):

- OK di Andrea sui contenuti e sul ritratto: **approvato**;
- OK del capo: **approvato**;
- traduzioni della tavola e di `/officina` riviste da Alma: **approvate**; i due testi nuovi della facciata (bottone e
  didascalia) entrano con questa PR e sono nella voce di history per la sua rilettura;
- licenza ElevenLabs: **verificata da Marco**;
- sottotitoli corretti a orecchio: **da fare** (il testo viene dalla trascrizione automatica, `tavola/build/tempi.srt`; Marco ascolta la voce con la tavola aperta, Claude corregge; il lancio non ne dipende);
- dichiarazione di accessibilità § 9: **da stendere sul modello ufficiale** (Decisione di esecuzione UE 2018/1523, modello AgID) a partire dagli appunti del § 9, poi la rilegge Marco;
- iPhone su rete cellulare: **fatta da Marco**, la tavola sul telefono si vede troppo piccola, quindi la facciata solo da
  1024 px (sopra, «La facciata su `/produzione`»); Android: **da fare** (Marco); fluidità sull'iPhone: da scrivere
  quando Marco la dà;
  ⚠️ **voce chiusa il 28/10/2026 come non più necessaria** (Marco, PR #318): dal 27/10 la facciata compare solo da
  1024 px, quindi dal sito il telefono non arriva a `/officina`; resta raggiungibile solo con l'indirizzo diretto.
  Sull'iPhone (27/10, rete cellulare) la tavola si vedeva troppo piccola, ed è il motivo della scelta. Android e
  fluidità non si provano più;
- `[csp-report]` nei log di Vercel: **nessuno** dalle 14:40 alle 17:06 del 27/10 (Cowork; corretto il 27/10/2026
  sera, nel `chore(docs)`: prima diceva «in corso»);
- `/officina` a 390, performance ≥ 90 e LCP ≤ 2,5 s: **causa accettata da Marco** (LCP osservato 39-52 ms; il resto è la
  simulazione di Lighthouse, che mette in catena le richieste della tavola).

## Criteri di successo

### Misure

- **Lighthouse su `/produzione`**, prima e dopo la PR 4: mediana di 3 corse, mobile come `lighthouserc.js`
  (Marco, 27/10). La facciata è sotto la piega e pigra.
  - minimi assoluti: performance ≥ 90, accessibilità ≥ 95, LCP ≤ 2,5 s, CLS ≤ 0,1;
  - rispetto a `main`: LCP al massimo +100 ms, CLS al massimo +0,01, nessun byte della facciata al caricamento.
    ⚠️ **Corretto il 27/10/2026 (PR 4, causa accettata da Marco):** la facciata è pigra, ma Chrome scarica le
    immagini pigre entro circa 1250 px dalla vista su 4G e 2500 su reti lente o non stimate (come il localhost di
    Lighthouse); a 2.007-2.510 px sotto la piega, nel laboratorio arriva al caricamento (51 KB a 1200 px, priorità
    bassa). Vale: LCP e CLS invariati entro le soglie, e la tavola (`/officina-tavola/`) mai richiesta prima del
    clic.
- **Lighthouse su `/officina`**, una volta a mano, fuori dalla CI, prima della PR 4: 1440 e 390 (mobile
  simulato), 3 corse, performance, accessibilità e best practices (SEO esclusa: noindex). Nel rapporto LCP,
  TBT, CLS e byte trasferiti, separati fra pagina e iframe. **Accessibilità sotto 95: STOP.**
- **CSS servito**: PR 1 invariato; PR 3 cresce delle regole di `:has()` più quella della griglia (corretto il
  27/10/2026, PR #313, OK di Marco: la riga diceva «esattamente delle regole di `:has()`», ma la griglia sul
  contenitore è una regola sua, in un'utility o in `globals.css`).
- **Invarianza**: PR 3, ogni pagina tranne la rotta nuova identica (testo, `<head>` come insieme, `<body>`
  senza script); PR 4, su `/produzione` cambia solo la sezione di chiusura (pixel contro il rumore di `main`).

### Prove

- **Vitest**: impronte del manifest; indirizzo della voce su `media.fontealta.it/tavola/` con l'impronta; link
  del QR della tavola uguali a `/produzione` di `routing.ts` nelle cinque lingue; elenco chiuso degli eventi.
- **e2e, Chromium e WebKit**:
  - `/officina` a 1440 e 390: iframe uguale alla finestra meno `--fa-nav-h`; footer non visibile; `scrollY` 0
    con la rotella su header e iframe; selettore interno nascosto; `lang` dell'iframe nelle cinque lingue;
    cambio lingua dall'header, poi Indietro, alla pagina di prima;
  - voce: nessuna richiesta a `media.fontealta.it` prima del clic, poi il file con l'impronta;
  - tastiera: skip link, Tab nella tavola, Esc; dal 28/10/2026 (PR #318, WCAG 2.1.4) le lettere e i numeri non
    fanno niente sul sito, e col chiosco (`?kiosk=1`) R e i numeri funzionano;
  - `/produzione`: il link nella lingua giusta, nessuna richiesta a `/officina-tavola/` prima del clic,
    immagine pigra, `<figcaption>`, clic su tutta la figura; a 390 e 768 nessuna facciata, nessuna richiesta della
    facciata né della tavola, nessun link a `/officina` (27/10/2026);
  - estese: `metadata-indicizzabili.spec` (pagine escluse), sonda CSP con `/officina` nelle cinque lingue,
    `cookie-terze-parti.spec` con `/officina`.
- **A mano**: iPhone e Android (24 fps); `test-headless` della tavola, tre volte «nessun errore», nelle PR che
  toccano `tavola/`.
  ⚠️ **Corretto il 28/10/2026 (PR #318):** iPhone e Android non si provano più (cancello, sopra); restano i tre
  `test-headless`.
