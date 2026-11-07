# FAQ, pagine d’uso, approfondimenti e guide: la spec

> **Stato: approvata da Marco il 30/10/2026.** Le scelte A-H sono del 29/10 sera, la forma delle lingue (A) e i
> punti I-T del 30/10. Resta aperto solo il prefisso della rotta degli approfondimenti, che si decide con la prima
> pagina (§ 8).
> Prompt: `tmp/prompts/2026-10-29-seo-faq-pagine-uso.md` e `tmp/prompts/2026-10-30-grill-spec-faq.md`.
> **Entra nel repo subito, con una PR di soli documenti** (firma «soli documenti») **che apre il cantiere** (Marco,
> 30/10, punto P), e fa fede finché il cantiere è aperto; chiuso il cantiere, diventa un verbale.

## Da dove viene

- **La mappa keyword** del giro 3 con le correzioni di Marco del 29/10 sera: `tmp/ricerca/mappa-giro-3-v2.md`
  (l’originale `mappa-giro-3.md` resta com’era). Le FAQ per collezione, per la pagina d’uso e per la home stanno lì.
  Le keyword principali di DE, FR ed ES per collezione: `tmp/ricerca/mappa-giro-2.md` § A.
- **Le misure del 29/10 sera** (Keyword Surfer nel Chrome di Marco, 14 ricerche, 0 crediti): `tmp/seo-faq/fase-1.md`,
  coi grezzi in `tmp/seo-faq/serp/`.
- **L’inventario delle foto** estratte dai cataloghi: `tmp/seo-faq/foto/inventario-foto.tsv` (file in
  `tmp/seo-faq/foto/estratte/`, provini in `tmp/seo-faq/foto/provini/`, ritagli in `tmp/seo-faq/foto/ritagli/`).
- **Cosa c’è oggi** (FASE 0, 29/10): nessun campo FAQ, né nello schema né sul dataset (0 documenti); nessun tipo
  `page`, perché home, chi siamo, finiture, produzione e contatti stanno nei messaggi i18n più `siteSettings`; due
  accordion già in casa, `<details>` nelle menzioni legali e `<h3><button aria-expanded aria-controls>` nelle card
  di `/produzione` (`fase-card.tsx`). Le collezioni sono **22 documenti `collection`** (i corpi a incasso compresi,
  slug `corpi-a-incasso`), tutti con `language: "it"` e le lingue nei campi (letto il 30/10).

## Le regole che non si discutono qui

Niente misure dei modelli; **niente prezzi nelle FAQ e negli approfondimenti** (Marco, 30/10); mai «tutto in AISI
316»; niente certificazioni né «alimentare»; FAQ inglesi nuove in
inglese americano, testi inglesi del sito invariati; fontealta.de non si tocca. Publish delle lingue per campi
(rule `i18n-sanity`). Nessun caricamento su Sanity e nessuna scrittura sul dataset senza GO di Marco.

## 1. Il modello su Sanity

### 1.1 Un tipo solo: `contentPage` (Marco, scelta A)

Pagine principali, pagine d’uso, approfondimenti e guide sono **un tipo di documento**, `contentPage`:
identificatori in inglese (regola del repo), etichette di Studio in italiano («Pagina di contenuto», «Codice»,
«Tipo»…).

| Campo | Tipo | Note |
|---|---|---|
| `code` | stringa | stabile, minuscolo: `home`, `outdoor-shower`, … ; lega il documento alla rotta del codice |
| `kind` | `main` · `use` · `deepDive` · `guide` | etichette «Principale» · «Uso» · «Approfondimento» · «Guida» |
| `title`, `intro` | per lingua | |
| `body` | Portable Text per lingua, coi blocchi `figure` e `figurePair` (§ 6) | |
| `faq` | § 1.3 | |
| `author` | `andrea` · `alma` | solo `deepDive`, obbligatorio; etichette coi nomi |
| `updatedAt` | data | solo `deepDive`, obbligatoria, **visibile a video** |
| `slug` | per lingua | solo `deepDive` (§ 8) |
| `seo` | `seoFields` | quello di sempre |

- **Validazione condizionale** (Marco, 30/10, punto O): `title`, `intro`, `body` e le immagini sono obbligatori
  solo per `use`, `deepDive` e `guide`. Una `main` porta le sole FAQ (e `code`).
- **Le pagine principali hanno un `contentPage` ciascuna, con le sole FAQ**: `home`, `about` (chi siamo),
  `finishes`, `production`, `contact`. Così **tutte le FAQ stanno su Sanity**, e le guardie dei doppioni (§ 1.3)
  le vedono tutte. Le 22 collezioni le portano nel loro documento `collection`.
- **Lingue del documento**: per `main`, `use` e `guide` valgono le lingue di `ACTIVE_LOCALES`; un `deepDive` esiste
  **solo nelle lingue dove `title` è compilato** (§ 8), e lì `intro`, `body`, immagini e `slug` diventano
  obbligatori.
- La rotta resta nel codice (`routing.pathnames`); il documento dà solo il contenuto. `collection` riceve il
  campo `faq`, nient’altro.

### 1.2 La forma delle lingue: campi per lingua (Marco, 30/10, scelta A)

**Campi per lingua, come `tagline`** (`faq.it`, `body.de`…): coerente con `pnpm i18n:publish` (publish per campi),
con l’agente `traduttore`, `tipi.test.ts` e `parita.test.ts`, che riconoscono già questa forma. Scartati
l’array internazionalizzato (~120 attributi, ma una dipendenza nuova e `scripts/i18n/` da estendere) e il
documento per lingua per `contentPage` (~255, ma niente publish per campi e due forme di traduzione).

**Misurato il 29/10/2026 sera** (`GET https://mwlqc6ab.api.sanity.io/v1/data/stats/production`, dal connettore
Sanity con la sua autenticazione; il token di `.env.local` non è stato letto): **`fields.count` 427 su 2.000**,
piano **Free**. I limiti (doc https://www.sanity.io/docs/content-lake/technical-limits): **2.000 attributi
unici nel dataset** sul Free (10.000 su Growth ed Enterprise), **1.000 attributi per documento** sul Free e su
Growth (8.000 su Enterprise). Un attributo è una coppia percorso + tipo di dato; un array conta uno per sé più
uno per ogni tipo che contiene. Conta la forma, non il numero delle pagine: guide e approfondimenti in più non
costano attributi se hanno la stessa forma.

Stima della forma di questa spec (contata a mano sulla struttura, da rimisurare): `faq` ~29 per lingua, ~150 per
5 lingue; `figure` e `figurePair` ~245; campi propri di `contentPage` ~15, più `author`, `updatedAt` e `slug`
~10: **~420-550 in più, ~850-980 su 2.000**. Nel documento, una collezione con le FAQ in cinque lingue prende
~150 attributi in più di oggi; il documento più pesante di oggi non è misurato, lo misura la guardia al primo
giro.

**La guardia, doppia, come script di rito e non in CI** (Marco, 30/10): `pnpm sanity:attributi`.

- **Dataset:** `fields.count` dall’endpoint delle statistiche; **rosso sopra 1.500 su 2.000**.
- **Documento:** lo script scarica i documenti (pubblicati e bozze) e conta per ciascuno le coppie percorso +
  tipo con la definizione della doc (indici degli array tolti dal percorso, un attributo per l’array e uno per
  ogni tipo che contiene); stampa i dieci più pesanti; **rosso sopra 750 su 1.000** nel più pesante.
- **Controprova della sonda** (rule `misure-e-test`): l’unione dei percorsi di tutti i documenti, contata dallo
  script, deve dare lo stesso numero di `fields.count`; se non lo dà, la definizione dello script è sbagliata, e
  il conteggio per documento non fa fede finché non combacia.
- **Quando:** prima e dopo ogni ondata (§ 10), e dopo ogni cambio di schema che aggiunge campi. Il token lo legge
  lo script dall’env, come gli altri script di `scripts/`; mai in chat né su file.

### 1.3 Il campo FAQ

Un elenco di elementi `faqItem` per lingua:

| Campo | Tipo | Note |
|---|---|---|
| `question` | stringa | obbligatoria; sentence case; niente em dash |
| `answer` | Portable Text (`faqBlocks`, § 4) | vuota = la domanda **non si pubblica** (§ 2) |
| `keyword` | stringa | la keyword principale, dalla mappa; non compare a video |
| `deepDive` | referenza a un `contentPage` con `kind: deepDive` | facoltativa; in Studio «Approfondisci» (§ 8) |

- **Le domande non sono traduzioni le une delle altre**, né nelle pagine d’uso né nelle collezioni (§ 2.1). `en` =
  inglese americano.
- **Tetto di 5 per lingua per pagina** (`Rule.max(5)`): un tetto, non un obiettivo.
- **Nessuna domanda in due pagine**: validazione asincrona in Studio (`context.getClient`) sulla domanda
  normalizzata (minuscole, senza punteggiatura, senza il nome della collezione), contro tutte le FAQ della stessa
  lingua, pubblicate e bozze, in `collection` e `contentPage`; e lo stesso controllo nel rito (`pnpm faq:doppie`,
  dalla logica di `tmp/ricerca/controlla-faq-g3.py`), prima di ogni scrittura (§ 11). In Studio è un **errore**.
  - **Corretto il 30/10 (Marco, #331): il controllo fra pagine vale solo per le domande generiche.** Una domanda
    che contiene il nome della **sua** collezione è una domanda di prodotto e non è un doppione («In quali
    finiture si fa Arko?» e «…Onda?» sono domande diverse): sulla sua pagina si confronta per intero. Le domande
    che non nominano la propria collezione (e tutte quelle delle `contentPage`) si confrontano dopo aver tolto i
    nomi di **tutte** le collezioni, così le domande generiche restano uniche in tutto il sito
    (`duplicateKey` in `sanity/lib/faq-rules.ts`). Togliendo i nomi a tutte, il primo dry-run dava come doppioni
    «Che differenza c’è tra Onda e Square?» e «…tra Club e Club Large?».
- **`deepDive`** deve puntare a una pagina che esiste **nella stessa lingua** della domanda (validazione).
- ⚠️ **Corretto il 4/11/2026 (Marco, grill della c1, Q2-Q4; `feat/c1-completamento`):** `deepDive` **non è una
  referenza a un `contentPage` `deepDive`** ma un **link interno**, con la forma del link nel testo (rotta di
  `FAQ_LINK_ROUTES` e, se la rotta ha uno slug, il documento) più il **testo del link** (`label`), scritto lingua
  per lingua. Errore: due righe nella stessa domanda, percorso o documento che non c'è, link alla pagina della FAQ
  stessa; avviso: la stessa pagina già linkata nel testo della risposta. Il testo: da 3 a 12 parole, niente em
  dash, apostrofo tipografico, in francese lo spazio unificatore (`checkDeepDiveLabel`, la stessa regola in Studio
  e nel caricatore). La pagina d'uso vale come destinazione, e una pagina `deepDive` futura entra aggiungendo la sua
  rotta. **Regola editoriale:** «Approfondisci» solo se la pagina di arrivo tratta per intero la domanda (pagina
  d'uso, post, futura pagina di approfondimento); per collezioni e modelli si usano i link nel testo.

## 2. Le regole delle FAQ

- **Niente domande slogan** (le «cosa vuol dire <tagline>»): tolte dalla mappa v2.
- **Al massimo una domanda generica per collezione** (generica = vale per qualsiasi marca; fonte PAA o ricerca, non
  il catalogo). Si tiene quella con più dati (prima un volume misurato, poi una PAA; a parità, la più vicina al
  prodotto). Le altre vanno a una pagina d’uso solo se combaciano con le sue FAQ senza duplicarle, altrimenti si
  tolgono. Applicata il 29/10 sera: 12 tolte in 11 collezioni, nessuna spostata (tabella nella mappa v2).
- **Le domande che aspettano Fontealta si pubblicano solo con la risposta**: la query serve solo gli elementi con
  `answer` non vuota, quindi la domanda aspetta in Studio senza bloccare il publish del documento. Studio mostra
  un **avviso** («domanda senza risposta: non compare sul sito»).

### 2.1 FAQ delle collezioni in DE, FR, ES: domande per mercato (Marco, 30/10, punto I)

- **Domande del mercato, non traduzioni dell’italiano.** Si parte dalla keyword principale della collezione nel
  giro 2 (`tmp/ricerca/mappa-giro-2.md` § A) e si leggono le domande della SERP e di Keyword Surfer.
- **Un mercato per sessione, circa 20 ricerche, 0 crediti**, con gli accorgimenti del 29/10 (`gl`/`hl` del mercato,
  `pws=0`, pausa fra le ricerche, stop al primo CAPTCHA, URL e volumi salvati in `tmp/`). Il prompt di ogni
  sessione si salva prima in `tmp/prompts/`.
- **Dove la collezione non ha keyword nel giro 2** (per esempio in DE Arko, Onda, Origo, Square), si traducono le
  domande **di prodotto** italiane (quelle dal catalogo, non le generiche).
- **Le ricerche sono fatte** (corretto il 2/11/2026: prima diceva «non sono fatte»): DE, FR ed ES il 2/11, una sessione
  per mercato con lo STOP di Marco fra l’una e l’altra, 70 ricerche, 0 CAPTCHA, 0 crediti. Mappe in
  `tmp/seo-faq/mappa-faq-<de|fr|es>.md`, riepilogo in `tmp/seo-faq/riepilogo-faq-de-fr-es.md`.
- **La keyword principale di una pagina** (Marco, 2/11/2026, decisione Z): resta quella del giro 2, salvo due casi.
  - **Copertura del prodotto, sempre**: se il prodotto non copre la principale del giro 2 (verificato in
    `docs/content/catalog-reference.md` con i codici), si passa alla migliore keyword coperta, anche con meno volume.
    Eccezione decisa da Marco: i corpi a incasso tengono la principale del giro 2.
  - **Principale a 0**: un’alternativa sale solo se il prodotto la copre **e** ha almeno il triplo del volume della
    principale del giro 2.
  - In tutti e due i casi l’alternativa ha un volume vero, scritto nella mappa, e non è la principale di un’altra pagina
    (cannibalizzazione); la principale che scende resta come secondaria.

### 2.2 La risposta (Marco, 30/10, punto J)

- **Circa 90 parole per lingua**, contate in parole, non in caratteri.
- **Le prime 40-50 parole rispondono da sole**: nominano Fontealta o la collezione e hanno la **keyword in
  grassetto** (§ 5). È il pezzo che un motore o un assistente può citare staccato dal resto.
- **Il resto porta un fatto concreto** (un codice, una finitura, un dato del listino; **mai misure, mai prezzi**)
  **e un link interno** (§ 4).
- **Lo controlla lo script di caricamento** (§ 11), non a occhio: parole totali (avviso fuori da 75-105), keyword in
  grassetto e nome (Fontealta o collezione) entro le prime 50, almeno un `internalLink`; una cifra accanto a un
  simbolo di valuta (€, $, £) o a «prezzo» nella lingua del file ferma il documento. In Studio la lunghezza è un
  avviso.

## 3. Il componente

**Accordion secondo il pattern del W3C APG** (https://www.w3.org/WAI/ARIA/apg/patterns/accordion/; Marco,
scelta B):

- ogni intestazione è un **heading del livello giusto per la pagina** (di norma `h3` sotto l’H2 «Domande
  frequenti») che ha come **unico figlio** un `<button type="button">` col testo della domanda;
- il bottone ha **`aria-expanded`** (`false` a pannello chiuso, `true` aperto) e **`aria-controls`** verso l’`id`
  del pannello;
- il pannello ha `role="region"` e `aria-labelledby` verso il bottone (facoltativo per l’APG; qui i pannelli
  sono al più 5);
- **la risposta è nell’HTML anche a pannello chiuso**: il pannello chiuso ha `hidden="until-found"`, così Google
  e chi non ha JS la leggono, e la ricerca nella pagina la apre (evento `beforematch` → stato aperto);
- tastiera: **Invio e Spazio** aprono e chiudono; Tab e Maiusc+Tab passano da un bottone all’altro e restano nella
  sequenza della pagina; nessuna scorciatoia da un carattere (WCAG 2.1.4); tutte chiuse all’arrivo, più aperte
  insieme ammesse (quindi niente `aria-disabled`);
- **token del design system**, nessun valore a mano: testo `--color-fa-text-primary` e `-secondary` sul crema,
  separatori e bordi con `--fa-stroke-color-on-light` (navy) dove devono passare il 3:1 di WCAG 1.4.11, fuoco navy
  da 3 px; icona `ChevronDown` di lucide `aria-hidden`, che ruota con `--dur-*` e `--ease-out-cubic`, ferma con
  `prefers-reduced-motion`; bersaglio da 44 px (`--fa-touch-min`). Contrasti misurati sui glifi a DPR 2 (rule
  `misure-e-test`);
- **«Approfondisci»**: se l’elemento ha `deepDive`, sotto la risposta un link testuale alla pagina, con la sua
  etichetta per lingua nei messaggi i18n;
  ⚠️ **corretto il 4/11/2026 (Marco, Q3):** niente etichetta fissa nei messaggi (Google sconsiglia i testi
  generici come «leggi di più»): il testo è quello descrittivo del file, nello stile dei link delle FAQ, con la
  freccia nascosta ai lettori di schermo. Non entra nel JSON-LD. Al clic `faq_approfondisci` di Vercel Web
  Analytics con due proprietà, `pagina` e `destinazione` (sul piano Pro un evento ne porta al più 2; dalla stessa
  data `faq_apri` porta `pagina` e `domanda`, e `pagina` è il percorso, che contiene la lingua);
- **JSON-LD `FAQPage` solo per le domande visibili**: la stessa lista che rende l’accordion produce `mainEntity`
  (`Question` · `acceptedAnswer` · `Answer.text`), serializzata con `serializzaJsonLd`; nessuna domanda senza
  risposta, nessuna di un’altra lingua. **Perché resta** (Marco, scelta G): costa poco e corrisponde al testo
  visibile. **Non promette snippet**: Google non mostra più i risultati arricchiti delle FAQ, per nessun sito, dal
  **7/05/2026** (Search Central: «This feature will no longer appear in Google Search starting May 7, 2026»,
  nota dell’8/05/2026; documentazione tolta il 15/06/2026).

**Provini prima del merge della PR b)** (Marco, 30/10/2026): niente produzione senza il suo OK sul design.

- L’accordion chiuso e con una risposta aperta, su una collezione (Boss) e sulla home, a 1440, 1024 e 390, DPR 2;
  in più il fuoco da tastiera su un bottone;
- con le risposte vere dei file di Cowork, mai un testo di riempimento;
- ogni provino accanto alla pagina com’è su `main`, e i contrasti misurati sui glifi (rule `misure-e-test`);
- i provini in `tmp/provini-faq/`, poi STOP fino all’OK.

**Sul sito, PR b) (Marco, 30/10/2026, decisione X).**

- **Dove:** sulla scheda della collezione una sezione chiara dopo la griglia, prima del piè di pagina (anche sui
  corpi a incasso, che hanno la loro rotta); sulla home fra il team e il modulo finale. Colonna sola centrata
  (`.fa-container.narrow`), H2 centrato.
- **Spazi, sulla scala del design system:** sopra e sotto un passo di sezione (96 px, 136 da 1024); dove la
  sezione tocca un’altra sezione chiara lo spazio fra le due lo dà una sola (sulla collezione la griglia, sulla home
  il modulo), perché due imbottiture sullo stesso crema si sommano. Titolo → prima domanda 48 px (`space-12`),
  domanda → risposta 32 (`space-8`), riga «Non trovi la risposta?» 32 sotto le domande.
- **«Non trovi la risposta? Scrivici»** con link a `/contatti`, sotto le domande, **solo sulla collezione**, che
  finisce senza modulo; sulla home no, perché il modulo arriva subito dopo. Titolo e riga nel namespace `faq`, letto
  solo dal server.
- **Pratiche di UX** (Nielsen Norman Group, GOV.UK Design System, Smashing Magazine, LogRocket): `ChevronDown` a
  destra, che ruota verso l’alto da aperta, mai il «+»; tutta la riga è il bottone; le domande non sembrano link
  (niente sottolineato né colore dei link), hover su desktop col velo navy all’8% del bottone secondario su chiaro
  (`bg-fa-navy/8`, DESIGN-SYSTEM.md § 9.1), domanda e freccia navy; più domande
  aperte insieme, nessuna chiusura automatica; apertura in 200 ms con `--dur-micro` e la curva di
  `--ease-out-cubic`, ferma con `prefers-reduced-motion`; in stampa tutte le risposte aperte. Niente «apri tutto»,
  niente stato ricordato, niente righe di riepilogo.
- **Link diretto a ogni domanda:** `#faq-<testo della domanda>`, scritto nell’URL all’apertura con `replaceState`;
  l’indirizzo con l’hash apre la domanda e la ferma sotto la barra fissa (`scroll-margin-top: var(--fa-nav-h)`, rule
  `nav-hero-scroll`). L’id viene dal testo e non dalla `_key`, che `faq:carica` calcola dal seme del giro.
- **Statistiche:** l’evento `faq_apri` di Vercel Web Analytics (pagina, lingua, id della domanda) al clic che apre
  (⚠️ dal 5/11/2026, #358: pagina e id della domanda; il piano Pro ammette 2 proprietà. `pagina` è il percorso, che
  porta la lingua; prima era un nome come `collezione:boss`, con `lingua` a parte),
  senza cookie; `@vercel/analytics` e `track()` c’erano già, la CSP non cambia.
- **Ordine:** le domande di prodotto prima, la generica (al massimo una) per ultima. Lo script di caricamento non
  cambia l’ordine: lo cambia Marco nei file, e `faq:carica` lo riscrive (il `set` sostituisce).
- **Link nelle risposte** col sottolineato dei link del sito (navy, come nell’articolo del blog); il grassetto delle
  keyword resta senza.
- ⚠️ **Corretto il 30/10/2026 (PR b): il server non può scrivere `hidden="until-found"`.** React 19 tratta `hidden`
  come booleano e scrive `hidden=""` per qualunque stringa (provato con `renderToString`). Il server scrive `hidden`,
  e uno script in linea subito dopo i pannelli li porta a `until-found` mentre la pagina si legge: senza, un link
  `#:~:text=` caricato da zero non apriva il pannello 8 volte su 10, perché il browser cerca il testo prima
  dell’idratazione. L’accordion, all’idratazione, tiene aperto un pannello che il browser ha già aperto. La
  risposta è nell’HTML servito in ogni caso; la ricerca nella pagina la apre solo con JavaScript attivo.

### 3.1 Le spaziature del sito (stessa PR, Marco, 30/10/2026)

Nate dai provini delle FAQ, valgono per le 16 pagine. Scala da 4 px più ruoli in `@theme` (strada B), sezione
responsive e `clamp()` degli hero in `:root`, guardia di lint su mezzi passi e valori fra parentesi quadre; i numeri
del design system stanno in `DESIGN-SYSTEM.md` § 3.

- **Regola sui provini della sera (Marco): nessuno spazio scende rispetto a `main`.** Dove il valore di prima sta
  sulla scala resta quello; dove non ci sta sale al gradino sopra, mai a quello sotto; se il gradino sopra non ha un
  ruolo se ne crea uno, mai un valore scritto a mano. Gli spazi che crescono o restano uguali restano come sono.
- **Ruoli** (classi `mt-<ruolo>`, `gap-<ruolo>`):

  | Ruolo | Valore | Uso |
  |---|---|---|
  | `eyebrow` | 16 | occhiello → titolo (nelle card resta 8) |
  | `eyebrow-feature` | 24 | occhiello → titolo: hero di `/collezioni`, sezioni di `/chi-siamo` |
  | `title-text` | 24 | H1 → paragrafo degli hero |
  | `title-text-hero` | 32 | titolo display → paragrafo: home, `/collezioni`, referenze |
  | `heading-intro` | 20 | H2 → introduzione |
  | `heading-intro-feature` | 24 | titolo → testo nelle sezioni di `/chi-siamo` |
  | `intro-content` | 48 | introduzione, o titolo senza, → contenuto |
  | `intro-feature` | 64 | introduzione → contenuto nei blocchi in evidenza (AISI della home) |
  | `text-action` | 32 | testo → bottone |
  | `text-action-feature` | 40 | testo → bottone nei blocchi da soli (team della home, stato vuoto delle referenze) e nelle pagine di messaggio (area riservata, 404, errore); sulla scheda modello sotto `sm`, didascalia delle finiture → «Richiedi informazioni» (prossimità: più dei 12 dentro il selettore e dei 32 fra i blocchi; da `sm` il bottone torna a `text-action`, 32, lo stacco fra i blocchi della colonna), e sotto `lg` 48 fra il bottone e la foto |

- Fuori dai ruoli, sulla scala: le righe dei link del piè di pagina a 12; i 10 px di `main` salgono a 12 (bandiera
  e tendina della barra, lingua nel menu, filtri del blog, gocce dell’acqua), i 14 a 16, i 18 a 20; l’unico 10 che
  resta è il gap dei pallini delle finiture (rule `catalogo`). I bottoni crescono a 44.

## 4. I link nelle risposte

Due annotazioni in `faqBlocks`:

- **`internalLink`** (in Studio «Link interno»): la rotta come chiave di `routing.pathnames` (`/collezioni`,
  `/collezioni/[slug]`, `/modello/[slug]`, `/finiture`, `/blog/[slug]`, le pagine d’uso…) più, per le rotte con
  slug, una **referenza** al documento. A video passa da `Link`/`getPathname` di `src/i18n/navigation.ts`, quindi
  `/collezioni/boss` in italiano diventa `/en/collections/boss` in inglese senza scriverlo. Un elenco chiuso di
  rotte in Studio, non un campo libero.
- **`link`** esterno, quello di oggi (URL assoluto, con la guardia contro `javascript:` di `article-body.tsx`).

**Dove punta il link interno di una FAQ** (Marco, 30/10, punto K): collezione, modello, pagina d’uso o un post del
blog **che esiste già**. La pagina di approfondimento non si linka dal testo: ci porta il campo «Approfondisci»
(§ 8).

Oggi `localizedPortableText` ha solo il link a URL assoluto: le FAQ hanno i loro blocchi, i campi esistenti non
cambiano.

## 5. Le parole chiave in grassetto

- keyword principale e secondarie col mark **`strong`** del Portable Text, **una volta per sezione** (per risposta,
  e per sezione nelle pagine d’uso e negli approfondimenti); Studio avvisa se la stessa parola è in grassetto due
  volte nella stessa risposta;
- **mai sottolineate**: sul sito il sottolineato è un link;
- **peso dal token**: un ruolo nuovo `--fa-strong-font-weight` in `@theme`, alias di `--font-weight-semibold`
  (600, il valore che `article-body.tsx` oggi scrive a mano), classe `font-(--fa-strong-font-weight)`. Stessa forma
  di `--fa-error-font-weight` (#324). Il blog passa al token nella stessa PR, a zero pixel.

## 6. Le immagini nelle pagine d’uso, negli approfondimenti e nelle guide

- **Almeno 2 per pagina, sempre ambientazioni**: le scontornate del Dropbox no, e **nemmeno le foto «set in
  studio»** (prodotto su parete colorata), che restano per le collezioni (Marco, scelta D).
- **Fonti, per ora:** a) le ambientazioni dei PDF dei cataloghi, estratte alla risoluzione nativa con `pdfimages
  -all`; b) foto del sito già su Sanity, solo per un formato o una scena che i PDF non hanno.
- **Due blocchi nel corpo:** `figure` (una foto) e `figurePair` (due foto). L’orientamento si legge da
  `asset->metadata.dimensions` nella query, non da un campo scritto a mano:
  - un’orizzontale (`figure`) occupa tutta la larghezza del testo, ritaglio 3:2 dal punto caldo;
  - due verticali (`figurePair`) stanno sulla stessa riga, ritaglio 2:3 tutte e due, quindi **stessa altezza**, e
    insieme occupano lo spazio di un’orizzontale; sotto `sm` si impilano;
  - una `figurePair` che non ha due verticali si rende come due `figure` impilate, e Studio lo segnala.
- **Ritaglio:** da un’orizzontale si ricava una verticale e viceversa solo se il prodotto resta intero e leggibile
  (inventario, colonne «formati possibili» e «orizzontale da ritaglio»). Il ritaglio lo fa l’URL di Sanity con
  `fit=crop` sul punto caldo.
- **Risoluzione minima** (colonna del testo da 760 px, come l’articolo del blog): larghezza piena **1.520 px**
  (760 × DPR 2); mezza larghezza **1.080 px** di larghezza nel ritaglio 2:3 (sul desktop ne bastano 744 a DPR 2;
  da mobile la verticale va a tutta larghezza, 358 px a DPR 3). Sotto soglia → originali ad Alma.
- **Alt obbligatorio in ogni lingua della pagina**: un oggetto immagine nuovo, `useImage`, con `alt` per lingua;
  obbligatorio su tutte le lingue di `ACTIVE_LOCALES` per `use` e `guide`, e sulle sole lingue in cui la pagina
  esiste per `deepDive`. `imageWithMeta` (alt solo italiano, rule `seo-meta`) non cambia.
  ⚠️ **Corretto il 3/11/2026 (c1a):** con il corpo per lingua (§ 1.2, scelta A) la foto sta nel corpo di ogni
  lingua, e `useImage` porta un `alt` **solo**, nella lingua di quel corpo: l'alt per lingua c'è sempre, senza un
  oggetto a cinque lingue ripetuto in ogni lista. Regole del corpo in `docs/specs/seo-pagine-contenuto.md`.
- **`next/image`** con `width` e `height` dal ritaglio (niente CLS) e `sizes`: piena `(max-width: 820px)
  calc(100vw - 32px), 760px`; mezza `(max-width: 639px) calc(100vw - 32px), 372px`.
- Nessun caricamento su Sanity senza GO; le foto estratte restano in `tmp/`.

### Inventario delle foto dei PDF (29/10/2026)

235 immagini estratte da CATALOGUE, KITCHEN, PROFILE e ILLE brochure (12 sono maschere); il listino Edition V ha
3.340 immagini, quasi tutte scontornate sotto gli 800 px, e non entra. Classificate a occhio sui provini:

| Categoria | Quante | Note |
|---|---|---|
| **Ambientazioni** | **75** | 44 CATALOGUE, 24 KITCHEN, 7 PROFILE; 2 duplicati PROFILE = CATALOGUE tolti |
| Set in studio, dettagli, texture, simboli, disegni tecnici | 106 dei 183 con lato corto ≥ 300 px | non usati: set su parete colorata, finiture, foglia, sabbia, conchiglia, mano, 17 disegni di Kitchen |
| Sotto i 300 px di lato corto | 40 | icone e miniature, non guardate |

**Sotto soglia: 11 su 75 (15%)**, tutte verticali sui 1.100-1.500 px di altezza: CATALOGUE p14 #023 (ILLE),
p36 #062 (Twiggy), p48 #082 (Boss), p54 #093 e p58 #101 (Origo), p68 #119 (In&Out), p69 #121 (Spring); KITCHEN
p6 #011, p9 #018, p9 #019, p12 #025. Per queste si chiedono gli originali ad Alma.

**Orizzontali da ritaglio** (Marco, scelta E): sulle 50 verticali larghe almeno 1.520 px, il ritaglio 3:2 (alto,
centro, basso) tiene il prodotto intero in **11, forse in 5** (colonna «orizzontale da ritaglio» dell’inventario).
Le colonne doccia quasi mai: il taglio porta via soffione o base. **Per la doccia da esterno l’unica candidata
sicura è PROFILE p17 #021** (doccia intera sul ponte di uno yacht, ritaglio al centro); forse PROFILE p14 #015
(doccia sotto l’arco) e CATALOGUE p34 #060 (colonna vista dall’alto sulla battigia). Le altre sicure sono cucine,
lavabi e bordo vasca. **Le orizzontali all’aperto si chiedono ad Alma**; intanto la pagina usa coppie di
verticali.

## 7. La prima pagina d’uso: «doccia da esterno»

- **Un intento, una pagina** in IT, ES e FR (3-4 URL identici in prima pagina, `tmp/seo-faq/fase-1.md`). **In DE una
  pagina sola** con «Gartendusche» principale e «Außendusche» secondaria nel testo (Marco, scelta C, senza seconda
  misura: 1 URL identico su 4 organici non era conclusivo).
- **Termine principale per lingua e slug** (nuova voce di `routing.pathnames`, in fondo all’elenco; `code` del
  documento `outdoor-shower`):

| Lingua | Principale | Dentro la pagina | Slug |
|---|---|---|---|
| it | doccia da esterno (5.400) | doccia da giardino (4.400) | `/doccia-da-esterno` |
| en | outdoor shower | garden shower | `/outdoor-shower` |
| de | Gartendusche (18.100) | Außendusche (5.400) | `/gartendusche` |
| fr | douche extérieure (9.900) | douche de jardin (1.600) | `/douche-exterieure` |
| es | ducha exterior (4.400) | ducha de jardín (1.600) | `/ducha-exterior` |

  ⚠️ Un segmento in `pathnames` risponde anche senza prefisso (307 verso l’italiano, rule `i18n-sanity`):
  nessuno dei cinque è fra i `RITIRATI` di `pathnames.test.ts`, e la PR lo verifica.
- **Title, description, canonical e hreflang da `route-metadata.ts`** (`staticRouteMetadata`), coi limiti di
  `meta.test.ts` (title per lingua da `BUDGET_TITOLO`, description 155 caratteri e 920 px); la pagina entra nella
  sitemap e in `llms.txt`.
- **Contenuto**: introduzione, sezioni con H2, almeno 2 immagini (§ 6), FAQ del mercato (mappa v2 § 1, al più 5),
  link alle collezioni da esterno con `internalLink`.
- **Inglese**: corpo della pagina **in inglese americano**, come le FAQ: è contenuto nuovo (Marco, scelta H). I
  testi inglesi già sul sito non cambiano.

## 8. Le pagine di approfondimento (Marco, 30/10, punto K)

**Quando nascono.** Solo dove la domanda di una FAQ **ha una ricerca sua** (un volume misurato o una domanda della
SERP) **e non è già coperta** da una collezione, un modello, una pagina d’uso o un post del blog. La prova (il
volume con la data, o la SERP salvata in `tmp/`) sta nel file della FAQ (§ 11), e lo script rifiuta un
«Approfondisci» senza prova.
⚠️ **Corretto il 4/11/2026 (Marco, Q2):** la prova della ricerca è la regola per **creare** una pagina di
approfondimento nuova, non sta più nella riga `approfondisci:` del file, che porta il percorso e il testo del link
(§ 1.3, § 11).

**Cos’è.** Una pagina di atterraggio, `contentPage` con `kind: deepDive` («Approfondimento»):

- **titolo = la domanda**; **da 600 a 1.200 parole, tarata sulla mediana del numero di parole dei primi 3-5 risultati
  di Google per la domanda, letto con Keyword Surfer; mai allungare per arrivare al numero** (Marco, 2/11/2026, decisione
  AA; prima diceva «circa 600 parole»). Quando si scelgono gli approfondimenti, accanto a ogni candidata si scrive la
  mediana delle parole dei primi 5 risultati; **la risposta nelle prime 40-50**, come nella FAQ;
- **espande la FAQ senza ripeterla**: la risposta breve sta nella FAQ, la pagina aggiunge il perché e il come;
- **linka la collezione e il modello** con `internalLink`;
- **esiste solo nelle lingue dei mercati dove la domanda si cerca**: niente traduzioni automatiche. Una lingua
  senza pagina non ha rotta (404), né voce di sitemap, né `hreflang`, né `llms.txt`; gli `hreflang` legano solo
  le lingue che esistono;
- **firmata da Andrea o da Alma** (`author`), con la **data di aggiornamento visibile** (`updatedAt`);
- **JSON-LD `Article`** (`headline` = il titolo, `author` = `Person` col nome, `dateModified` = la data visibile,
  `image` dalle foto della pagina) **più `BreadcrumbList`**; tutti e due dicono solo ciò che la pagina mostra. Le
  briciole seguono la forma del catalogo (rule `catalogo`): la lista si costruisce nella pagina, lato server, e
  la stessa lista rende le briciole a video e il JSON-LD; l’ultima voce omette `item`;
- nessuna misura e nessun prezzo, come nelle FAQ;
- immagini e alt come § 6.

**Rotta.** Un segmento dinamico in `routing.pathnames` con prefisso per lingua e `slug` per lingua dal documento.
**Il nome del prefisso nelle cinque lingue si decide con la prima pagina** (Marco, 30/10); nessun prefisso deve
cadere fra i `RITIRATI` di `pathnames.test.ts`.

**Link a doppio verso** (dalla ricerca, 30/10): FAQ → approfondimento (campo «Approfondisci») → collezione o
modello (link nel corpo). Le pagine di approfondimento entrano nella **sitemap** e in **`llms.txt`**, nelle sole
lingue in cui esistono.

**Escono con la loro FAQ**, nella stessa ondata (§ 10).

**Provini prima del merge della PR c)** (Marco, 30/10/2026): niente produzione senza il suo OK sul design.

- La pagina d’uso «doccia da esterno» e un approfondimento di prova, interi, a 1440 e 390, con le due griglie di
  immagini (un’orizzontale e una coppia di verticali) e il blocco FAQ in fondo;
- ogni provino accanto alla pagina com’è su `main`, dove esiste, e i contrasti misurati sui glifi;
- i provini in `tmp/provini-faq/`, poi STOP fino all’OK.

## 9. Le funzioni AI di Google e i crawler (dalla ricerca, 30/10)

**Google AI Overviews e AI Mode non hanno requisiti speciali.** Doc
https://developers.google.com/search/docs/appearance/ai-features: «There are no additional requirements to appear
in AI Overviews or AI Mode, nor other special optimizations necessary». Le pratiche che la stessa pagina elenca, e
cosa ne fa questa spec:

- **crawling permesso** da robots.txt e dalla CDN → verificato sotto;
- **contenuto trovabile coi link interni** → § 4 e § 8 (link a doppio verso);
- **contenuto importante in forma di testo** → risposta nell’HTML anche a pannello chiuso (§ 3);
- **immagini e video di qualità** a sostegno del testo → § 6 (soglie, ambientazioni);
- **dati strutturati uguali al testo visibile** → `FAQPage` (§ 3) e `Article` (§ 8) dalla stessa lista che rende la
  pagina, con la guardia di § 12;
- **buona esperienza della pagina** → nessun CLS dalle immagini, Lighthouse in CI.

**robots.txt oggi** (letto sul dominio il 30/10/2026; solo verifica, niente cambiato): `User-Agent: *` con
`Allow: /`, e per nome, tutti con `Allow: /`, i crawler che citano (`OAI-SearchBot`, `ChatGPT-User`,
`PerplexityBot`, `ClaudeBot`) e quelli che addestrano (`GPTBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`,
`anthropic-ai`), con `POLITICA_AI = "tutti"` in `src/app/robots.ts`; più la riga `Sitemap:`. **`Bingbot` e
`Applebot` non sono nominati**: li copre `*`, quindi sono ammessi (`Applebot-Extended` decide solo l’uso per
l’addestramento, non la ricerca di Apple). Le pagine `/` e `/collezioni/boss`, chieste con lo user agent di
Bingbot, Applebot, OAI-SearchBot e PerplexityBot, rispondono **200, senza `X-Robots-Tag`, con l’H1 nell’HTML**.
⚠️ Le richieste partivano dalla rete di Marco con lo user agent dei bot, non dagli IP dei bot: le regole del
firewall di Vercel per i bot verificati non si leggono dal connettore (rule `ci-deploy`). **La regola «AI Bots»
del firewall la verifica Marco dal pannello, prima della prima ondata** (§ 10).

**IndexNow: quanto costerebbe** (solo stima, niente fatto; doc https://www.indexnow.org/documentation e /faq):

- **il protocollo non ha costi indicati**; un invio vale per tutti i motori che lo adottano (la FAQ elenca Amazon,
  Bing, Naver, Seznam, Yandex, Yep). **Google non è nell’elenco**;
- **sul sito:** un file `public/<chiave>.txt` con la chiave (8-128 caratteri; pubblica per costruzione, quindi
  niente variabile d’ambiente) e un `POST` JSON a `https://api.indexnow.org/indexnow` con `host`, `key` e
  `urlList` (fino a 10.000 URL per richiesta; risposte 200/202, 403 chiave, 422 host, 429 troppe richieste);
- **la forma più economica è uno script di rito** (`pnpm indexnow` dopo ogni ondata, con gli URL dell’ondata):
  una trentina di righe più un test, nessun codice servito. La forma automatica, dal webhook di
  `/api/revalidate` a ogni publish, costa di più (raggruppare gli URL, gestire il 429, test sulla rotta, rule
  `cache-isr`) e manda richieste anche per correzioni minime. **Raccomandata, se si fa: lo script.**

## 10. L’ordine: ondate per lingua (Marco, 30/10, punto L)

1. **IT ed EN**: tutte e 22 le collezioni, le cinque pagine principali e la pagina d’uso «doccia da esterno»;
2. **DE**; 3. **FR**; 4. **ES**, ciascuna dopo la sua sessione di ricerche (§ 2.1).

- **Le pagine di approfondimento escono con la loro FAQ**, nella stessa ondata.
- **Prima di ogni ondata, la foto di Search Console degli ultimi 28 giorni** (pagine e query, per la lingua
  dell’ondata), salvata con la data in `tmp/seo-faq/gsc/`; **il confronto dopo 4-8 settimane**, con lo stesso
  filtro. Senza la foto di prima l’ondata non parte.
- **`pnpm sanity:attributi` prima e dopo ogni ondata** (§ 1.2).
- **Prima della prima ondata**, Marco verifica dal pannello di Vercel la regola «AI Bots» del firewall (§ 9).
- **Le FAQ vanno online solo con tutte e cinque le lingue** (Marco, 30/10/2026, decisione Y). Un interruttore senza
  Sanity, `faqOnline()` in `src/lib/faq-online.ts`, spegne sezione e JSON-LD `FAQPage` in tutte le lingue; si accende
  con `FAQ_SITO=1` nell'ambiente del build. Spento di default: le ondate su Sanity restano invisibili finché è
  spento. **L'accensione arriva dopo le ondate DE, FR ed ES**, e **il giorno dell'accensione si rifà la foto di
  Search Console come «prima»** (tipo Web, ultimi 28 giorni): il confronto a 4-8 settimane parte da lì, non dal merge
  della PR b).

**Verbale della prima ondata, IT ed EN (30/10/2026).**

- **Caricata il 30/10**, dopo la prova su boss (scrittura, ripristino identico all’export della mattina,
  riscrittura, inglese): `faq:carica --execute --all`, prima IT poi EN. **23 documenti**: le 22 collezioni e
  `contentPage-home`, creata dal giro italiano. **102 domande in italiano e 102 in inglese**; `faq:verifica` a
  zero differenze nelle due lingue, nessuna bozza nuova, nessun 409. Restano fuori la pagina d’uso
  `outdoor-shower`, che arriva con la PR c), e le altre quattro pagine principali, che non hanno ancora i file.
  **Il sito non le mostra fino alla PR b).** Testi: versione 4 di Cowork (48 file), in `tmp/faq-ondata-1/`;
  verbali delle scritture in `tmp/faq-scritture/`; export del dataset prima della scrittura in
  `tmp/backup/production-2026-10-30.tar.gz` (422,7 MB, 676 documenti). `sanity:attributi` dopo l’ondata: 483 su
  2.000 (427 prima), documento più pesante 148 su 1.000.
- **Le foto di Search Console** (tipo Web, export CSV con query, pagine, paesi e dispositivi, in
  `tmp/seo-faq/gsc/`; i dati finiscono il 28/10, quindi l’ondata non c’è dentro):
  - **«dal lancio»**: l’export «Last 16 months», che copre i 43 giorni dal 16/09 al 28/10:
    **927 clic e 7.503 impressioni**, CTR 12,4%; cartella `2026-10-30-web-16mesi`;
  - **«prima» della prima ondata**: «Last 28 days», dal 01/10 al 28/10: **595 clic e 4.816 impressioni**, CTR
    12,4%, 372 query; cartella `2026-10-30-web-28g`. ⚠️ Le pagine sono al tetto delle 1.000 righe dell’export.
  - **Il confronto si fa 4-8 settimane dopo l’accensione delle FAQ** (prima diceva «dopo il merge della PR b)»:
    corretto il 30/10, decisione Y), con lo stesso filtro (Marco, 30/10): tipo
    Web e ultimi 28 giorni. L’export non ha filtri di paese o lingua (`Filters.csv`), quindi copre IT ed EN
    insieme e non «la lingua dell’ondata» di cui parla il punto sopra: la lingua si separa dai CSV, per pagina.

**Verbale della seconda ondata, DE, FR, ES, e dell’accensione (2/11/2026).**

- **Caricata il 2/11**, dopo la #340 (segnaposto `RISPOSTA` e risposte sotto le 40 parole sono errori di
  `faq:carica`): `faq:carica --execute --all`, una lingua per volta, DE, FR, ES, ciascuna col suo dry-run e il GO di
  Marco. **23 pagine per lingua**, le stesse della prima ondata; **100 domande in tedesco, 99 in francese, 100 in
  spagnolo**; `faq:verifica` a zero differenze in ogni lingua, e IT, EN, DE, FR riverificate invariate dopo ES. Resta
  fuori `outdoor-shower` (PR c). Testi di Cowork riletti da Alma, in `tmp/faq-ondata-2/<de|fr|es>/`; verbali in
  `tmp/faq-scritture/`; export prima della scrittura `tmp/backup/production-2026-11-02.tar.gz` (677 documenti).
  `sanity:attributi`: 510 dopo DE, 537 dopo FR, **564 su 2.000** dopo ES; documento più pesante 166 su 1.000.
- **Francese**: prima della scrittura 181 spazi normali sono diventati U+00A0 (prima di `?`, `:`, `;`, `!`, `»`,
  dopo `«`), la regola di `fr.json`; `faq:carica` oggi non lo controlla (PR di manutenzione).
- **La foto «prima» dell’accensione** (2/11, tipo Web, «Last 28 days», dal 04/10 al 31/10): **580 clic e 4.637
  impressioni**, CTR 12,5%, 347 query; cartella `tmp/seo-faq/gsc/2026-11-02-web-28g`. ⚠️ Pagine al tetto delle 1.000
  righe. Di Bing nessun export. **Il confronto a 4-8 settimane parte da questa foto.**
- **Accensione il 2/11/2026**: `FAQ_SITO=1` su Vercel, solo Production, e redeploy di `e8d6d1f` (Marco). Verifica in
  sola lettura su fontealta.it: home, Boss e Flamingo nelle cinque lingue con tutte le risposte nell’HTML e un solo
  `FAQPage` uguale alle domande visibili; chi siamo, contatti e una scheda modello senza FAQ; in Chrome il link
  diretto `#faq-…`, l’accordion e «Scrivici» solo sulle collezioni. `FAQ_SITO` resta come kill switch fino alla misura
  di fine dicembre (`CLAUDE.md`, decisioni).

## 11. Il caricamento: da file, con uno script (Marco, 30/10, punto M)

**Lo script** (`pnpm faq:carica <lingua> [--execute]`, in `scripts/i18n/` perché resti analizzato da Sonar e
riusi export, manifest e publish che ci sono già):

- **senza `--execute` mostra cosa scriverebbe e non scrive niente**: per documento, le domande, le parole, i
  controlli di § 2.2 e i doppioni;
- **scrive solo con `--execute` e il GO di Marco**, e scrive **bozze** coi soli percorsi `faq.<lingua>` (come
  `i18n:import`: bozza creata copiando il pubblicato, bozza già esistente saltata e registrata);
- **pubblica per campi** con `pnpm i18n:publish`, mai la bozza intera; ⚠️ da verificare nella PR che il manifest
  accetti `faq` come campo;
  - **Decisione W (Marco, 30/10/2026, #331): niente bozza, la scrittura è già il publish per campi.** Motivo,
    verificato nella PR: `i18n:publish` non accetta l’italiano («l’italiano è la fonte») e non crea pagine, e una
    pagina principale che non esiste non ha un pubblicato da patchare. Quindi `faq:carica --execute` scrive sul
    **pubblicato** il solo `faq.<lingua>`, e crea le pagine principali che mancano coi soli `code`, `kind` e
    `faq`. I freni:
    - **blocco ottimistico**: `ifRevisionId` sul `_rev` letto, `create` per le pagine nuove; un **409 ferma quel
      documento** e non si riprova (client con `maxRetries: 0`), le altre pagine proseguono;
    - **salta le pagine con una bozza o una versione**, che pubblicate dopo porterebbero via le FAQ;
    - vuole `--solo=<code>` o `--all`; **con `--solo` mostra il diff esatto** di `faq.<lingua>`, prima e dopo, e
      chiede conferma (a terminale, o `--conferma=<codice>` stampato dal giro che mostra il diff);
    - **`--all` si rifiuta senza l’export del dataset del giorno** (`pnpm sanity:export` →
      `tmp/backup/production-AAAA-MM-GG.tar.gz`), e ne riporta la dimensione;
    - salva prima in `tmp/faq-scritture/` cosa c’era, e `--ripristina=<file>` lo rimette dove la revisione è
      ancora la sua, senza cancellare documenti;
    - **`pnpm faq:verifica <lingua>`**, in sola lettura, confronta le FAQ pubblicate coi file domanda per
      domanda (sparite, cambiate, in più): dopo ogni ondata e una settimana dopo.

    Fonti: https://www.sanity.io/docs/content-lake/important-considerations-for-schema-and-content-migrations e
    https://www.sanity.io/docs/archive/http-mutations (Marco, 30/10).

    **Verbale delle correzioni trovate nella prova (30/10/2026).** La #332: il verbale della prima scrittura su
    boss diceva che `faq` c’era già, perché la proiezione GROQ dà `faq: null` quando il campo manca; ora `hasFaq` si
    legge con `!= null`, e il ripristino toglie `faq` intero solo se prima il campo non c’era e su Sanity non ci
    sono altre lingue. Quel solo verbale è stato corretto a mano, con l’OK di Marco e la nota che rimanda
    all’export. La #333: il dry-run di `--all` confrontava il file di boss con boss già su Sanity; ora i doppioni
    si cercano solo fra pagine diverse, le FAQ già su Sanity si tolgono dal confronto solo per la pagina e la
    lingua che il giro scrive, e la scrittura è rilanciabile (`set` che sostituisce, mai `insert` o `append`; lo
    stesso giro due volte lascia le stesse domande e il secondo salta la pagina come «già uguale»).
- **controlla i doppioni prima di scrivere** (`pnpm faq:doppie` sul file più quello che c’è già su Sanity, nella
  stessa lingua); un doppione ferma tutto il giro;
- **un documento con un solo problema non si scrive** (la regola di `import-content.ts`), con un’eccezione
  (Marco, 30/10, #331): **una risposta con «DA VERIFICARE» ferma solo la sua domanda**, e le altre del file passano;
- **i commenti `<!-- … -->` dei file sono note per chi scrive**: lo script li toglie prima di contare le parole e
  di convertire, e non arrivano mai su Sanity (#331);
- **dopo il caricamento fa fede Sanity**: lo script salva l’impronta di ciò che ha scritto e rifiuta di
  sovrascrivere una risposta cambiata in Studio dopo l’ultimo caricamento.

**Formato e posizione dei file: markdown, un file per pagina e per lingua, in
`docs/content/faq/<lingua>/<code>.md`, versionato** (Marco, 30/10, punto Q).
⚠️ **Corretto il 3/11/2026 (c1a):** la cartella `docs/content/faq/` non è mai nata; le FAQ delle collezioni e
delle pagine principali stanno ancora in `tmp/faq-ondata-1/` e `tmp/faq-ondata-2/`, e si spostano in un giro di
manutenzione (Marco, grill del 3/11, Q2b). Quelle della pagina d'uso sono versionate dalla c1a in
`docs/content/pagine-uso/faq/<lingua>/<code>.md`, accanto al corpo (`docs/content/pagine-uso/<lingua>/<code>.md`).

- In testa `code`, `kind` e lingua; per ogni domanda un `##` col testo, una riga `keyword:`, eventualmente
  `approfondisci:` con la prova (volume e data, o il file della SERP), poi la risposta: `**…**` per il grassetto,
  ⚠️ **corretto il 4/11/2026 (Marco, Q3):** la riga è `approfondisci: <percorso italiano> | <testo del link>`, al
  più una per domanda, subito dopo `keyword:` (es. `approfondisci: /doccia-da-esterno | Approfondisci: la guida
  alla doccia da esterno`);
  `[testo](/collezioni/boss)` per i link interni (riconosciuti se il percorso combacia con `routing.pathnames`),
  un URL assoluto per gli esterni.
- Lo leggono e lo scrivono Marco, Cowork e Alma; ogni ondata è una PR di soli documenti, con un diff leggibile;
  `docs/` è già fuori da Tailwind (`@source not` in `globals.css`), quindi le parole delle risposte non generano
  classi; le parole si contano sul testo.
- Il prezzo: lo script converte il markdown in Portable Text, e per un tempo ci sono due copie (il file e
  Sanity). Per questo vale la regola dell’impronta qui sopra: **lo script non sovrascrive una risposta cambiata in
  Studio** (confermato da Marco).
- Scartati: il JSON del Portable Text in `tmp/faq/`, la forma di `i18n:import` (fuori da git, nessuna revisione in
  PR, non lo rilegge una persona), e un foglio CSV per ondata (a capo e virgolette fragili nelle celle, nessun diff
  vero).

⚠️ Se un giorno i file finissero fuori da `docs/` ma dentro il repo, andrebbero aggiunti ai `@source not` di
`globals.css`: Tailwind legge ogni file tracciato, e una parola delle risposte con la forma di una classe
finirebbe nel CSS servito (CLAUDE.md, «Firme e trappole»).

## 12. I test

- `metadata-indicizzabili.spec.ts`: i campioni della pagina d’uso nelle cinque lingue (le forme si derivano da
  `routing.pathnames`, quindi senza campioni la guardia diventa rossa da sola), e degli approfondimenti nelle
  lingue in cui esistono;
- `routing-lingua-url.spec.ts`: le cinque forme della rotta, e la forma nuda che dà 307; per un approfondimento,
  404 nelle lingue in cui non esiste;
- **e2e dell’accordion** (`faq-accordion.spec.ts`), sul pattern APG: il bottone è l’unico figlio di un heading del
  livello atteso; Tab arriva ai bottoni in ordine; Invio e Spazio cambiano `aria-expanded` e la visibilità del
  pannello; `aria-controls` punta all’`id` del pannello giusto, e il pannello ha `aria-labelledby` verso il
  bottone; il fuoco resta sul bottone; la risposta di un pannello chiuso è nell’HTML servito; la ricerca nella
  pagina apre un pannello chiuso (Chromium); contrasti sui glifi a DPR 2; su WebKit con Alt+Tab (rule
  `misure-e-test`);
- **e2e della griglia** (`immagini-uso.spec.ts`): un’orizzontale larga quanto la colonna del testo; due verticali
  sulla stessa riga con la stessa altezza e la stessa somma di larghezze di un’orizzontale; a 390 impilate;
  `width`/`height` presenti e nessuno spostamento di layout dopo il caricamento (attesa sulle immagini caricate,
  non su un cronometro);
- **guardie JSON-LD** (unità e e2e): l’insieme delle `Question.name` di `FAQPage` è uguale all’insieme dei testi
  dei bottoni visibili, nella lingua della pagina; una domanda senza risposta non compare in nessuno dei due;
  sull’approfondimento, `headline`, autore e `dateModified` di `Article` sono quelli a video, e `BreadcrumbList`
  segue le briciole visibili;
- **sitemap e `llms.txt`**: un approfondimento compare solo nelle lingue in cui esiste;
- unità: normalizzazione delle domande e controllo dei doppioni; `internalLink` → percorso per le cinque lingue;
  scelta del formato dalle dimensioni dell’asset; il conteggio degli attributi di `sanity:attributi` su documenti
  sintetici (array, oggetti annidati, lo stesso campo con due tipi); il controllo della risposta di § 2.2
  (parole, grassetto e nome entro le prime 50, link interno); la conversione dal formato dei file (§ 11).

## 13. Note per altri documenti e altre pagine

- **`docs/content/catalog-reference.md`, Onda: 35 SKU contro 30** (da correggere in una PR a parte, non ora). Il
  listino Edition V dà 30 codici con prezzo: 5 articoli (D50, D50.E, D50.M, D50.ME, D50.RC) × 3 configurazioni
  (colonna sola, XCW, EW) × 2 finiture (MX, BX). Il 35 viene dall’Excel R4, che ha in più le 5 righe-articolo
  senza finitura. Con la definizione del documento stesso («SKU unici = articolo × finitura») Onda farebbe 10:
  XCW ed EW non sono finiture. Dettaglio in `tmp/seo-faq/fase-1.md`, punto e.
- **Flamingo: «floor mount tub filler» va alla pagina d’uso della vasca freestanding, non a Flamingo.** Ha 3 URL
  identici in prima pagina con «freestanding tub filler» (Kohler, Brizo, Signature Hardware; misura del 29/10
  sera), quindi è lo stesso intento della pagina d’uso, e su Flamingo lo cannibalizzerebbe.
- **ILLE, «ILLE ha la colonna a pavimento per il lavabo?»: resta.** Il listino Edition V R4 (Excel di ILLE) descrive
  I40L come «Colonna per lavabo con rubinetto d’arresto», col corpo incasso a pavimento CW.1, e ha anche I40L.M,
  I40L.RC e le .D in PVD. Il PDF `Fontealta_PriceList_Edition_V_lr_06.pdf` non ha codici ILLE nel testo.

## 14. Fuori dalla spec

I testi delle risposte e degli approfondimenti (li scrive Cowork, firmano Andrea o Alma), la rilettura nelle
lingue (Alma; ⚠️ per la pagina d'uso la rilegge **Marco** nelle cinque lingue, prima del carico: grill del
3/11/2026, Q1), le sessioni di ricerca di DE, FR ed ES (§ 2.1), le guide oltre al modello di dati, IndexNow (§ 9,
solo stimato). **Le pagine pillar sono fuori, per ora** (Marco, 2/11/2026, decisione AB): i temi pillar del giro 2
(`tmp/ricerca/mappa-giro-2.md` § C) non entrano in questo cantiere.

## Decisioni di Marco

**29/10/2026 sera**

| | Decisione |
|---|---|
| A | Un tipo solo, `contentPage` (identificatori in inglese, etichette di Studio in italiano) |
| B | Bottone con `aria-expanded` nell’heading, risposta nell’HTML anche a pannello chiuso (pattern APG) |
| C | DE: una pagina, «Gartendusche» principale, «Außendusche» secondaria nel testo; niente seconda misura |
| D | Le foto «set in studio» non contano come ambientazioni |
| E | Orizzontali all’aperto da Alma; intanto coppie di verticali; le verticali che reggono un ritaglio orizzontale col prodotto intero sono segnate nell’inventario |
| F | Si tiene la generica con più dati; le altre a una pagina d’uso solo se combaciano senza duplicare, altrimenti tolte |
| G | JSON-LD `FAQPage` sì, senza promettere snippet (risultati arricchiti delle FAQ spenti dal 7/05/2026) |
| H | Corpo della pagina d’uso in inglese americano; i testi inglesi già sul sito non cambiano |

**30/10/2026 mattina, grill della spec**

| | Decisione |
|---|---|
| A | Forma delle lingue: **campi per lingua**, come `tagline`; guardia doppia di rito, rosso sopra 1.500 su 2.000 nel dataset e sopra 750 su 1.000 nel documento più pesante; si rimisura dopo ogni ondata (§ 1.2) |
| I | FAQ delle collezioni in DE, FR, ES: domande per mercato dalla keyword del giro 2, un mercato per sessione, ~20 ricerche, 0 crediti; senza keyword, traduzione delle domande di prodotto italiane; ricerche non ora (§ 2.1) |
| M | Caricamento da file con uno script: dry-run, `--execute` col GO, publish per campi, doppioni prima di scrivere (§ 11) |
| J | Risposta di ~90 parole; le prime 40-50 rispondono da sole, col nome e la keyword in grassetto; poi un fatto concreto e un link interno (§ 2.2) |
| K | «Approfondisci» facoltativo verso una pagina `deepDive`, solo con una ricerca sua e senza copertura altrove; le altre FAQ linkano collezione, modello, pagina d’uso o un post esistente (§ 4, § 8) |
| L | Ondate per lingua: IT ed EN su tutte le 22 collezioni, poi DE, FR, ES; approfondimenti con la loro FAQ; foto di Search Console a 28 giorni prima, confronto a 4-8 settimane (§ 10) |
| O | Tutte le FAQ su Sanity: un `contentPage` `main` per pagina principale con le sole FAQ; titolo, introduzione, corpo e immagini obbligatori solo per `use`, `deepDive`, `guide` (§ 1.1) |
| P | La spec entra subito con una PR di soli documenti, che apre il cantiere; commit e push solo dopo l’OK |
| Q | File delle FAQ in markdown, uno per pagina e per lingua, in `docs/content/faq/<lingua>/<code>.md`; lo script non sovrascrive le risposte cambiate in Studio (§ 11) |
| R | Niente prezzi nelle FAQ e negli approfondimenti: fatto concreto = codice, finitura, dato del listino; mai misure, mai prezzi |
| S | Il prefisso della rotta degli approfondimenti si decide con la prima pagina (§ 8) |
| T | La regola «AI Bots» del firewall di Vercel la verifica Marco dal pannello, prima della prima ondata (§ 9, § 10) |

**30/10/2026, avvio delle PR di codice**

| | Decisione |
|---|---|
| U | Tre PR: a) schema e script, b) accordion e FAQ sul sito, c) pagina d’uso e approfondimenti; in a) `contentPage` ha solo i campi delle pagine principali, le cinque pagine sono documenti fissi con id stabile, «Approfondisci» entra con c), l’impronta è un campo nascosto della FAQ (`loadedHash`), l’export per il traduttore salta le FAQ |
| V | Prima del merge di b) e di c), i provini e l’OK di Marco sul design (§ 3, § 8) |
| W | Doppioni fra pagine solo per le domande generiche: chi nomina la propria collezione è una domanda di prodotto (§ 1.3); i commenti dei file non arrivano su Sanity, «DA VERIFICARE» ferma la sola domanda, «keyword non tutta nel grassetto» resta un avviso (§ 11); `seo` su `contentPage` entra con la pagina d’uso; la scrittura su Sanity in una PR piccola prima della b): diretta sul pubblicato del solo `faq.<lingua>`, perché `i18n:publish` non accetta l’italiano e non crea pagine, con blocco ottimistico, diff e conferma con `--solo`, export del dataset prima di `--all`, ripristino e `faq:verifica` (§ 11); prova su un documento col GO a ogni passo |
| X | PR b), sul sito (§ 3): sezione dopo la griglia della collezione (corpi a incasso compresi) e fra il team e il modulo sulla home; colonna sola centrata; «Non trovi la risposta? Scrivici» solo sulla collezione; tag `contentPage` sulla home, senza toccare il webhook; provini coi separatori navy e chiari affiancati e lo stacco fra due sezioni chiare (spazio o bianco); pratiche di UX, link diretto `#faq-…`, evento `faq_apri`, ordine prodotto prima e generica per ultima, link sottolineati e grassetto no |
| Y | Le FAQ vanno online solo con tutte e cinque le lingue: interruttore `FAQ_SITO=1`, spento di default, senza Sanity; accensione dopo le ondate DE, FR, ES, con la foto di Search Console del giorno come «prima» (§ 10) |

**2/11/2026, dopo le ricerche DE, FR, ES**

| | Decisione |
|---|---|
| Z | Keyword principale: resta quella del giro 2, salvo copertura del prodotto (sempre: se non è coperta si passa alla migliore coperta, anche con meno volume; corpi a incasso esclusi) e principale a 0 (sale un’alternativa coperta con almeno il triplo del volume); l’alternativa ha un volume vero e non è la principale di un’altra pagina (§ 2.1) |
| AA | Approfondimenti da 600 a 1.200 parole, tarati sulla mediana delle parole dei primi 3-5 risultati di Google per la domanda, letta con Keyword Surfer; mai allungare per arrivare al numero (§ 8) |
| AB | Pagine pillar fuori, per ora (§ 14) |

**3/11/2026 sera, grill della c1 (pagina d'uso)**: le decisioni stanno in `docs/specs/seo-pagine-contenuto.md`
§ «Decisioni di Marco», che fa fede per la pagina d'uso; qui le due che correggono questa spec, § 6 e § 11, sono
scritte al loro posto con la data.
