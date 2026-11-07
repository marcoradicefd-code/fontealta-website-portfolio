# ARCHITECTURE — sito Fontealta

**Riscritto da zero il 27 agosto 2026**, su un inventario misurato dal repo, dal dataset
Sanity e dall'HTML di produzione. Non è una revisione del documento precedente: quello è
in `docs/archive/ARCHITECTURE-2026-06.md`.

> ## Regola di questo documento
>
> **Si aggiorna a ogni `chore(docs)`, oppure si dichiara stale in testa.** Non esiste la
> terza possibilità di lasciarlo invecchiare in silenzio: è esattamente ciò che è successo
> al precedente, che nominava 24 volte un campo rimosso mentre si dichiarava «fonte di
> verità per ogni linea di codice».
>
> Un documento si corregge **se afferma qualcosa al presente**. Un verbale datato non si
> tocca. Le affermazioni più pericolose sono le **rassicurazioni**: le frasi che dicono
> che qualcosa esiste o è rimasto.

**Riferimenti vivi:** `CLAUDE.md` (regole operative) · `docs/overview.md` (mappa breve) ·
`docs/history.md` (storia, debiti, lezioni) · `docs/manutenzione-log.md` (registro
interventi).

---

## 1. Stato reale al 31/08/2026

I fatti misurati che non erano scritti da nessuna parte. Stanno in testa apposta: sono le
cose che sorprenderebbero chi arriva. **Rimisurati il 31/08** — produzione via `curl`,
dataset via GROQ, repo via `git` — non riportati dalla stesura precedente.

1. ~~**`/area-pro` e `/en/pro-area` danno 404 in produzione.**~~ **CHIUSO l'8/09/2026
   (PR #157).** La chiave della mappa è diventata `/area-riservata` (l'URL EN resta
   `/pro-area`, perché le etichette inglesi dicono «Pro Area») e la pagina esiste: statica,
   «in lavorazione», con `robots: index false` sulla rotta. Rimisurato in produzione l'8/09:
   `/area-riservata` **200**, `/en/pro-area` **200**, il vecchio `/area-pro` **404**. I punti
   che ci linkavano sono ora link vivi, e sono **quattro** e non cinque: nav desktop, nav
   mobile, footer, e **un solo** bottone nel teaser di `/contatti`, dove i due disabilitati
   «Accedi» e «Registrati» sono stati sostituiti da uno che porta alla pagina.
   ⚠️ Quello che si rivede **dopo Cersaie** è l'**Area Pro vera**, cioè login, listini e
   schede tecniche, non la voce di menu.
2. **Iubenda e Plausible sono SPENTI** (rimisurato il 16/09/2026): zero tag `<script>`, zero
   richieste nel browser. La misura del 27/08 che li dava «LIVE» contava la **parola**
   nell'HTML, che c'era perché i messaggi viaggiano tutti nel payload del client. Il codice
   resta nel layout, **dormiente**, legato alle variabili d'ambiente: accenderle rende falsa
   la cookie policy, e si fa solo insieme a una PR sulle menzioni legali.
3. ~~**La privacy policy elenca fornitori sbagliati**~~ **CORRETTO il 14/09/2026 (PR #188).**
   ~~Resta aperto il resto di **M26**: le pagine legali in bozza ma pubbliche.~~ **Chiuso il
   16/09/2026** con le menzioni legali: le due pagine sono confluite in `/menzioni-legali`, le
   note `_draft` sono tolte, e i fornitori sono quelli misurati (Vercel, Sanity, Zapier,
   Cloudflare R2 per i video, Google Ireland per la mappa di `/contatti`; dal 20/10/2026 anche
   Sendinblue SAS, cioè Brevo, per catalogo, conferme e newsletter, #268-#274). Manca la sezione
   societaria, che aspetta REA, capitale sociale e PEC.
4. ~~**Il namespace i18n `ambient` è codice morto.**~~ **CHIUSO il 31/08 (PR #143).**
   Rimosso da `it.json` e `en.json`: 21 namespace per lingua → **20**, elenchi identici.
   La verifica che conta non era il grep sui nomi delle chiavi — `heroEyebrow` vive in
   altri sei namespace — ma l'accesso al **namespace**, che qui è sempre letterale.
5. ~~**`de`, `fr`, `es` sono scaffolded in `routing.ts` ma non hanno file di messaggi.**~~
   **SUPERATO.** I file sono arrivati con #179 (11/09, copia dell'inglese) e le traduzioni
   vere con #190 (15/09); i contenuti Sanity delle tre lingue sono **sul pubblicato** dal
   16/09 (publish per campi di 634 documenti; erano in bozza dal #189). Sono **accese dal
   16/09** (#201): la forma sta in §6.
6. **Le dipendenze dirette inutilizzate non ci sono più** (31/08, PR #143): via `clsx` e
   `tailwind-merge`, entrambe a **zero call site** e richieste **solo dalla radice**
   (`pnpm why`), quindi togliendole non si è sfilato il tappeto a nessuna transitiva.
7. **`images.remotePatterns` ha due host, non quattro** (31/08, PR #143):
   `cdn.sanity.io` e `images.unsplash.com`. Tolti `picsum.photos` e `fastly.picsum.photos`
   **insieme** alla costante `PLACEHOLDER_IMAGES` che li generava, che era a zero import.
   ⚠️ Toglierne solo una delle due parti sarebbe stato peggio di lasciarle entrambe:
   `next/image` andrebbe in errore **a runtime**, e né `typecheck` né `lint` direbbero
   niente. **`images.unsplash.com` resta**: gli sfondi Unsplash delle pagine collezioni
   sono una scelta editoriale, non un segnaposto.
8. **La nav trasparente è sotto AA sulle voci, per decisione presa guardando la foto**
   (31/08, PR #138 · #140 · #141). Le route trasparenti sono **quattro** — `/`,
   `/collezioni`, `/chi-siamo`, `/produzione` — non due. Il trattamento è
   `text-shadow: 0 1px 2px` ink `.55`, la **stessa ombra dei paragrafi delle card di
   `/produzione`**; l'alone ×3 è revocato perché a 13 px si leggeva come un bordo. La
   **fascia esiste solo sotto `lg`**, cioè solo dove il menu è l'hamburger, e su desktop
   è stata revocata: p99 sui glifi **1,45-3,04 sulla home**. ⚠️ Il p99 **non si muove**
   cambiando il trattamento del bordo, perché campiona lo sfondo dentro il rettangolo dei
   glifi: per un contorno la metrica è l'alfa dell'alone al primo anello.
9. **L'hero della home ha uno scrim direzionale sulla fascia del testo, senza base sopra il
   video** (17/09, PR #207): da `sm` un orizzontale .60 pieno fino alla fine del testo e a
   zero in 24 punti, sotto `sm` una fascia verticale ancorata al blocco di testo, più
   `HeroFade`. Ha tolto il radiale centrato e (da `sm`) il verticale in basso, che insieme a
   `HeroFade` davano il «velo uniforme» visto da Marco. ⚠️ **Superati:** l'ellisse (revocata
   il 31/08, PR #138, perché si leggeva come una macchia) e il diagonale H2 che l'aveva
   sostituita (`100deg`, pianoro al 12%). Decisione, soglie per ruolo e numeri in `CLAUDE.md`.
10. **Le card dei 12 modelli multi-collezione scelgono l'immagine per CODA DELL'ALT**
    (31/08, PR #142) — `src/lib/card-image.ts`, pura e testata. Senza, **23 posizioni**
    uscivano con lo sfondo di un'altra collezione. ⛔ Niente `match` di GROQ: ragiona per
    **token**, quindi «collezione Boss» combacia dentro «collezione Boss Wide». La
    **posizione è la controprova, non la chiave**: l'ordine di `collections` è modificabile
    da Studio.
11. **`projectReference` è 0** (verificato 31/08 via GROQ): l'archivio referenze esiste
    come route e componenti, ma il dataset è vuoto.

Più due proprietà del processo che si dimenticano facilmente:

- **Le suite Playwright sono DUE, in due cartelle, con due config e due script, e
  NESSUNA delle due è in `ci.yml`** (0 occorrenze di entrambe, verificato 31/08 e
  ricontato l'8/09/2026; vero di nuovo dal 22/10/2026, dopo un giorno con il job `e2e`). Dal
  22/10/2026 l'e2e di regressione verde lo dice lo stato «e2e (locale)» della firma (§9).

  | cartella | config | script | file | test dichiarati | esecuzioni |
  |---|---|---|---|---|---|
  | `tests/regression/` | `playwright.regression.config.ts` | `pnpm test:e2e` | vedi CLAUDE.md | vedi CLAUDE.md | **tre** progetti: `chromium` su tutto, più `webkit-menu` e `webkit-coverflow` |
  | `tests/e2e/` | `playwright.config.ts` | `pnpm e2e` | 3 | 4 | 8 (due progetti: chromium-desktop, mobile-safari) |

  **La baseline che si cita nei report è quella di `tests/regression/`, e il numero vive
  in `CLAUDE.md`, sezione baseline.** ⚠️ Questa tabella diceva **21 su 4 file** ed era
  stale di cinque PR: al 9/09 sono altri numeri, misurati con
  `playwright test --list` e non col grep, che ne conta molti meno.
  ⚠️ **E la colonna «esecuzioni» diceva «un solo progetto, chromium»: era falsa dal
  17/09/2026**, quando il #207 ha aggiunto `webkit-menu`, e lo è diventata di più il
  22/09 col `webkit-coverflow` del #215. I due progetti WebKit sono **ristretti con
  `testMatch` a un file ciascuno**, perché su quel motore gira solo ciò che ha senso
  farci girare: il resto della suite resta su chromium. ⛔ Su `webkit-coverflow` la
  guardia è **strutturale e non di reso** — quel motore non dipinge la prospettiva
  nemmeno nel caso di controllo (v. `CLAUDE.md`, «Firme e trappole»). `tests/e2e/` è la suite generale, punta a
  `pnpm dev` e include un progetto mobile; `tests/regression/` è quella delle guardie,
  gira su un build di produzione con `NEXT_PUBLIC_E2E=1`.
- **`docs/history.md` è diventato un indice** (31/08): una voce = un file in
  `docs/history/AAAA-MM-GG-slug.md`. Le voci precedenti al 31/08 restano dov'erano.

**Baseline di collaudo: sta in `CLAUDE.md`, sezione «Baseline»,
datata.** ⚠️ **Questo blocco non ripete più i conteggi, ed è una regola** (9/09/2026): un
numero scritto in due posti ne ha uno vecchio, e qui ce n'erano quattro fermi all'8/09
mentre CLAUDE.md era già avanti. La regola vale anche per `docs/overview.md`.

Quel che resta qui è la **forma** della baseline, che non cambia: `lint` a 0 errori più
l'avviso noto · `test` · `build` · righe e query di `sanity/types.gen.ts`, dove il numero
di `defineQuery` esportate e quello di `_QUERY_RESULT` generati devono coincidere · alert
di sicurezza aperti, di cui zero critical.

**Dataset `production` al 31/08:** `model` **595** (594 con foto, unico senza è
`S60V.HF.ME`) · `collection` **22** · `concealedBody` 17 · `projectReference` 0.

---

## 2. Stack

| | |
|---|---|
| Framework | **Next.js 16.4.2** (App Router, Turbopack; dal 20/10/2026, #275) |
| Runtime | React **19.2.8** · Node **24** (cinque punti da muovere insieme, vedi CLAUDE.md) |
| Linguaggio | TypeScript strict, `@types/node` `^24` |
| Stile | Tailwind CSS 4, theme inline in `src/app/globals.css` via `@theme`, **nessun `tailwind.config`** |
| Font | **Satoshi** variabile, locale via `next/font/local` (`src/app/fonts/`) |
| CMS | **Sanity 6** (6.15.0 dal 16/10/2026, #256), Studio embedded su `/studio`, `next-sanity` 13 (13.3.4 dal 15/10/2026, #254), TypeGen |
| i18n | **next-intl 4.x**, `localePrefix: "as-needed"` + mappa `pathnames` |
| Form | Server Action → **webhook Zapier**, validazione Zod 4, `react-hook-form`; email e iscrizioni via **Brevo** (`src/lib/brevo.ts`, dal 20/10/2026); il modulo della newsletter nel piè di pagina è una Server Action a sé (`submitNewsletter`), senza react-hook-form |
| Animazioni | **GSAP** (core + plugin già nel bundle via `LenisProvider`; **MorphSVGPlugin e Flip solo a import dinamico**, al primo invio di un modulo, dal 14/10/2026, #251) + **Lenis** smooth-scroll; il grosso della UI resta CSS + IntersectionObserver |

Package manager **pnpm 11.0.4**, pinnato in `packageManager`: il banner «update available» si ignora.

---

## 3. Route

**17 pagine** sotto `src/app/(site)/[locale]/`, più `/studio` e la catch-all `[...rest]`.

Fuori dal gruppo `(site)` vivono le rotte che non sono pagine: **`/robots.txt`**,
**`/sitemap.xml`**, **`/llms.txt`** (dal 10/09), `/api/revalidate`, `/api/draft-mode/*`,
e le tre icone generate dalle convenzioni di file (`favicon.ico`, `icon.png`,
`apple-icon.png`).

La mappa `pathnames` in `src/i18n/routing.ts` ha **17 chiavi**. È una **whitelist**: un
percorso non presente dà 404.

| chiave | IT | EN | pagina |
|---|---|---|---|
| `/` | `/` | `/` | ✅ |
| `/collezioni` | `/collezioni` | `/collections` | ✅ |
| `/collezioni/corpi-a-incasso` | idem | `/collections/concealed-bodies` | ✅ |
| `/collezioni/corpi-a-incasso/[slug]` | idem | `…/[slug]` | ✅ |
| `/collezioni/[slug]` | idem | `/collections/[slug]` | ✅ |
| `/modello/[slug]` | idem | `/model/[slug]` | ✅ |
| **`/produzione`** | `/produzione` | **`/production`** | ✅ (PR #116) |
| `/finiture` | idem | `/finishes` | ✅ |
| `/blog`, `/blog/[slug]` | idem | idem | ✅ |
| `/chi-siamo` | idem | `/about` | ✅ |
| `/contatti` | idem | `/contact` | ✅ |
| **`/area-riservata`** | `/area-riservata` | `/pro-area` | ✅ (PR #157, «in lavorazione», `noindex`) |
| **`/officina`** | `/officina` | `/workshop` | ✅ (27/10/2026, #313: la tavola dell'officina in iframe, `noindex`, senza footer; DE `/werkstatt`, FR `/atelier`, ES `/taller`; spec `docs/specs/tavola-officina.md`) |
| **`/doccia-da-esterno`** | `/doccia-da-esterno` | `/outdoor-shower` | ✅ (4/11/2026, #355: la pagina d'uso, una lingua senza titolo dà 404; DE `/gartendusche`, FR `/douche-exterieure`, ES `/ducha-exterior`; spec `docs/specs/seo-pagine-contenuto.md`) |
| `/referenze`, `/referenze/[slug]` | idem | `/projects`, `/projects/[slug]` | ✅ (dataset vuoto) |
| **`/menzioni-legali`** | `/menzioni-legali` | `/legal-notice` | ✅ (16/09/2026; `/privacy-policy` e `/cookie-policy` → 308 alle ancore) |

**Menzioni legali** (16/09/2026). Una pagina sola con cinque sezioni su `<details>` nativi, l'H2 dentro
il `<summary>`: `#societa` (dal 26/10/2026, #308, la prima e quindi aperta all'arrivo), `#termini`,
`#privacy`, `#cookie`, `#ai`. Ordine e ancore stanno in `LEGAL_SECTIONS` (`src/lib/legal-sections.ts`),
i testi in `legale.sezioni.<id>` a blocchi `h3`/`p`/`li`, niente Sanity. In `#societa` i messaggi hanno
solo etichette e segnaposto: i valori (REA, capitale, PEC, ISO 9001, i PDF su R2) vengono da
`src/lib/azienda.ts`, la stessa sorgente del footer e del JSON-LD.
Un componente client (`LegalDetailsSync`) apre la sezione dell'ancora al caricamento, su `hashchange` e al
clic su un link della stessa pagina, perché il `LenisProvider` aggiorna l'URL con `replaceState`, che
`hashchange` non lo emette; in stampa le apre tutte. I vecchi `/privacy-policy` e `/cookie-policy`, in
ogni lingua attiva, rispondono **308 verso l'ancora** (`redirectLegali` in `src/lib/redirects.ts`, con
l'ancora conservata nel `Location`). La guardia è `src/messages/legale.test.ts`: niente parentesi quadre
(i dati societari mancanti non si pubblicano, e la sezione societaria resta fuori dai dizionari finché non
arrivano), niente em dash, niente apostrofi ASCII, data di aggiornamento in ogni sezione. La cookie policy
dichiara la **mappa di Google** su `/contatti` come contenuto di terzi senza cookie nella configurazione
adottata, e `tests/regression/cookie-terze-parti.spec.ts` lo custodisce: se diventa rosso serve il banner.
La sezione AI dice che **alcune** immagini di ambientazione sono generate dai render ufficiali, che
fotografie di prodotti, stabilimento e persone non lo sono, e non etichetta le singole immagini; la
clausola «prevale la versione italiana» sta nei termini d'uso.

**Corpi a incasso su cartella statica**: `collezioni/corpi-a-incasso/` sta accanto a
`collezioni/[slug]`, e Next dà priorità al segmento statico sul dinamico fratello, quindi
`[slug]` resta senza condizionali.

---

## 4. Rendering e cache

Il numero di pagine del build **sta in `CLAUDE.md`**, sezione baseline, con la data e col comando che lo produce. Qui resta la **forma**: le liste hanno un fondo di 24h, i dettagli si rinfrescano solo a tag, e due rotte stanno fuori da ogni cache.

- **Liste e pagine statiche**: `revalidate = 86400`, cioè un fondo di 24h. Quali sono lo dice `grep -rln "export const revalidate = 86400" "src/app/(site)/[locale]"` (al 4/11/2026: home, `/collezioni`, `/blog`, `/finiture`, `/referenze`, `/chi-siamo`, `/contatti`, `/produzione`, `/menzioni-legali`, `/area-riservata`, `/officina`, `/doccia-da-esterno`; prima mancavano le ultime tre).
- **Dettagli** (`/modello/[slug]`, `/collezioni/[slug]`, `/collezioni/corpi-a-incasso/*`, `/blog/[slug]`, `/referenze/[slug]`): `revalidate = false`, **solo on-demand**.
- `/studio`: `revalidate = 0`.
- **`/sitemap.xml` e `/llms.txt`: fuori da ogni cache.** Tutte e due `dynamic = "force-dynamic"` più `client.fetch` diretto con `cache: "no-store"` e `useCdn: false`. Si ricostruiscono a ogni richiesta, ed è il prezzo pagato per dire la verità alla **prima** lettura dopo un publish.
- **Le icone sono rotte prerenderizzate**: `/favicon.ico`, `/icon.png`, `/apple-icon.png`, generate dalle convenzioni di file di Next in `src/app/`.

La freschezza arriva dall'**invalidazione a tag**: `sanity/lib/live.ts` imposta
`fetchOptions: { revalidate: false }`, i 20 `sanityFetch` in `src/lib/content.ts` portano
**tag espliciti** (`["collection"]`, `["model"]`, `["collection:<slug>", "model"]`,
`["post","category","author"]`, …), e il webhook `POST /api/revalidate` chiama
`revalidateTag(body._type)` più `revalidateTag()` con il tag granulare `_type:slug`.

⚠️ Il footer è volutamente **narrow** su `["collection"]`: senza, ogni publish di un
model invaliderebbe tutto il sito passando di lì.

---

## 5. Contenuto (Sanity)

`projectId` `mwlqc6ab`, dataset `production`. I tipi documento stanno in `sanity/schemas/documents/` e gli object in `objects/`.

**Campi aggiunti fra l'8 e il 10 settembre**, tutti già vivi:

- **`seoFields` è per lingua** (`localizedStringOptional` / `localizedTextOptional`, due tipi nati apposta perché quelli generici hanno `Rule.required()` sull'italiano e qui il vuoto è il caso normale), più **`noIndex`**. Montato su `post`, `collection`, `projectReference`, e ora anche su **`model`** e **`concealedBody`**.
- **`siteSettings.defaultSeo` porta la sola `ogImage`**: titolo e description sono stati tolti perché nessuna pagina usava i default del layout.
- **`author` ha `role` (localizzato), `linkedin` e `slug`.** La validazione del LinkedIn accetta solo `linkedin.com/in/…` e `/company/…`: un URL su un sottodominio di paese viene rifiutato, e va normalizzato sull'host canonico.
- **`siteSettings.socialLinks.instagram`** compilato il 10/09; gli altri tre restano vuoti. È ciò che alimenta `Organization.sameAs`.

⚠️ **`post.author` ha `Rule.required()`**: un post senza autore è gestito dal codice (`Article.author` diventa l'`Organization`) ma **non è raggiungibile** senza lasciare il documento in errore di validazione. Per arrivarci servirebbe prima una modifica di schema.

Conteggi live al 27/08, tranne dove annotato:

| tipo | n |
|---|---|
| `model` | **595** |
| `collection` | **22** (di cui 2 contenitori di servizio) |
| `concealedBody` | 17 |
| `post` | 12 |
| `finish` | 8 |
| `author` | **2** (erano 4: «Fontealta» e «Matteo Rivolta» eliminati il 10/09) |
| `category` | 4 |
| `projectReference` | **0** |

**Il contatore pubblico delle collezioni è 20, non 22:** `COLLECTIONS_COUNT_QUERY` esclude
`corpi-a-incasso` e `accessories`. L'elenco degli slug è **a mano** nella query: una
collezione-contenitore nuova va aggiunta lì.

**Tassonomia prodotto:** due campi, `productMacro` (enum 6) + `productSubtype` (enum 24),
che compongono le 33 coppie reali. Le tabelle vivono in
`sanity/schemas/documents/model-taxonomy.ts`, **unica fonte** importata sia dallo schema
Studio sia dagli script di migrazione, che scrivono via `@sanity/client` bypassando la
validazione dello Studio.

**TypeGen:** `sanity/types.gen.ts`. **Righe e numero di query stanno in `CLAUDE.md`**,
per la regola dei numeri in una sede sola. ⚠️ Questo punto ha già mostrato due volte cosa
succede a duplicarli: diceva **1945** mentre la §1 dello stesso file diceva **1958** (era
il file a contraddirsi, non la misura), e poi entrambi sono rimasti a 1958 mentre le PR
SEO aggiungevano una query. Il **rapporto** invece resta qui, perché è la guardia:
se il numero cambia senza che qualcuno abbia toccato le query, qualcosa è andato storto —
e vale anche al contrario, perché `sanity typegen` **non fallisce** su un file di query
rotto: scrive un file da 620 righe con «0 queries» e esce 0.

---

## 6. i18n

`it` primaria, `en` attiva. I conteggi stanno in `CLAUDE.md`; qui la forma.

**Tedesco, francese e spagnolo sono accesi dal 16/09/2026** (#201). Hanno un dizionario vero
ciascuno in `src/messages/` (#190), un segmento di rotta proprio in `pathnames`, e i loro testi su
Sanity sono **sul pubblicato** di 639 documenti, più ruolo e biografia degli autori dal #204.
`ACTIVE_LOCALES` le comprende tutte e cinque, e **spegnerne una è una riga**, che spegne solo quella.
La rilettura umana dei post DE/FR/ES si fa a posteriori, sul pubblicato. I tipi localizzati di
Sanity coprono tutte e cinque le lingue.

⚠️ **«Una riga» era falso fino al #196, e ora lo tiene una guardia.** Misurato il 15/09 sul ramo di
anteprima: 15 errori di typecheck e 7 test rossi, più tre punti che avrebbero servito **inglese** in
tedesco senza un errore (date del blog, titoli dei post in `llms.txt`). Le tabelle per lingua sono
`Record<Locale, …>` su tutte e cinque, anche spente; i tipi dei campi localizzati sono
`Partial<Record<Locale, …>>`; i redirect per lingua esistono già e si dichiarano solo per le attive.
**`pnpm i18n:cinque-lingue`** fa girare typecheck e suite con `ACTIVE_LOCALES = ALL_LOCALES` in un
worktree di `HEAD` (`--build` aggiunge il build); in CI lo fa con `--qui` l'ultimo passo del job
`verifica` (dal 21/10/2026; prima era il job `cinque-lingue`), da cui dipende `build`. Chi scrive una tabella per `it` ed `en`, o un `locale === "it" ? … : …`, lo
scopre sulla sua PR e non il giorno dell'accensione.

⚠️ **Un segmento dichiarato in `pathnames` NON è inerte**: risponde anche senza
prefisso, con un 307 verso la lingua di default, e può **resuscitare un indirizzo
ritirato**. La costante `RITIRATI` nel test dei pathnames tiene il vincolo.

**Gli strumenti stanno in `scripts/i18n/`.** Quelli che scrivono su Sanity sono in dry-run
finché non ricevono `--execute`.

- `export-content` porta in `tmp/traduzioni/<lingua>/` i campi localizzati dei documenti
  **pubblicati**, uno JSON per documento; le bozze non si esportano mai. I tipi esportati stanno in
  `tipi.ts`, e `tipi.test.ts` li confronta con lo **schema vero**: fino al #204 l'elenco era a mano
  dentro lo script, e `author` mancava. `messages-diff`
  confronta un dizionario con l'inglese e con le ammesse di `src/messages/allowed-identical.ts`.
- `import-content` scrive una lingua **in bozza**: `--check-only` controlla, `--execute` scrive.
  La bozza nasce dal pubblicato (`createIfNotExists`, senza `_rev`) e riceve i soli campi della
  lingua, a transazioni. Riprende il giro aperto e salta i documenti che contiene: per **correggere**
  quello che un giro ha già scritto c'è `--aggiorna` (sotto).
- `lib.ts` ha i controlli puri, con i test: struttura, identico alla fonte, lunghezza,
  parole-spia, parole identiche all'italiano, ciascuno con la sua gravità per lingua. Ordine e
  ragioni in `CLAUDE.md`.
- `manifest.ts` tiene il registro: **un manifest per giro**, non per giorno, in
  `tmp/traduzioni/manifest/<lingua>/<giro>/`, con un puntatore `GIRO-CORRENTE` per lingua. Ogni
  voce dice se la bozza è **nostra**, con quale `_rev` l'abbiamo trovata e lasciata, e se è
  **condivisa** con un'altra lingua. ⚠️ `tmp/` è gitignored: senza i manifest il rollback non sa
  quali bozze sono nostre.
- `discard-content` fa il rollback, `publish-content` pubblica.

**Bozze condivise fra lingue** (#189). Una bozza già presente si **completa** solo se è firmata
da un giro **aperto** di un'altra lingua e la sua `_rev` è ancora il `revDopo` di quel giro; la
patch porta `ifRevisionId`. Altrimenti si salta: una bozza toccata da una persona non si
sovrascrive. La voce registra `sharedWith`, la lingua di cui ha trovato la firma.

**Correggere una bozza già scritta: `--aggiorna`** (strada C, 15/09/2026). La logica sta pura in
`aggiorna.ts`. Si scrive solo se la voce della lingua è aperta, nostra e non pubblicata, e la `_rev`
della bozza è la firma di un giro aperto di **qualunque** lingua; si patchano i **soli campi della
lingua che cambiano**, con `ifRevisionId`; la firma passa alla revisione nuova sulle sole voci che la
portavano, marcate `rifirmata`, e la voce della lingua registra la correzione in `aggiornamenti`.
Mai creare, togliere o cancellare. Dopo il commit, rilettura `raw` della bozza intera.

**Il rollback è per lingua.** `discard-content` cancella una bozza solo se è nostra, non
condivisa, **non rifirmata** e ancora alla `_rev` che le abbiamo lasciato; in ogni altro caso
**toglie i soli campi della lingua**. ⚠️ `rifirmata` c'è perché una firma passata dopo la scrittura
(publish per campi di un'altra lingua, `--aggiorna`) non prova più che la bozza sia com'era: senza,
la voce che ha creato la bozza cancellerebbe anche le lingue che restano. Annullare tutte le lingue lascia quindi bozze che copiano il pubblicato, da
scartare a parte.

**Il publish si fa per campi** (decisione del 15/09/2026). Le bozze sono copie del pubblicato al
momento della creazione più i campi delle lingue: tutto ciò che cambia sul pubblicato dopo — foto,
cover, testi italiani — nella bozza non c'è, e pubblicare la bozza intera lo riporterebbe indietro.
Quindi `publish-content` patcha il pubblicato com'è in quel momento con i **soli campi delle lingue**
del manifest presi dalla bozza, con `ifRevisionId` sul pubblicato, verifica, e scarta la bozza nostra.
Funziona per una lingua o per tre, e chiude tutti i giri che condividono la bozza. Nessuna bozza si
pubblica come tale. **Il cancello che decide cosa si vede resta `ACTIVE_LOCALES`.**

Lo script è `publish-content.ts`, e la logica sta **pura** in `publish.ts`, con lettura e scrittura
passate da fuori: i test la esercitano su un Sanity in memoria. Per documento: la `_rev` della bozza
deve essere la firma di un giro aperto, altrimenti si salta e si registra (`publishSkipped`); il
pubblicato riceve i campi con `ifRevisionId`; la bozza si scarta, o si riallinea al pubblicato nuovo
passando la firma alle lingue che restano, marcate `rifirmata`; sulle voci va `publishedAt`. Un conflitto di revisione fa
rileggere e rifare il piano. Dopo il commit, rilettura `raw` del documento **intero**. La `delete`
della bozza non accetta `ifRevisionId`: la stessa transazione la precede con una patch che lo porta.
Dry-run di default; `--execute` senza `--ids` vuole anche `--all`.

**Studio: la regola dei mancati salvataggi è decaduta il 16/09**, col publish per campi. Tutti i giri
sono **chiusi**, compreso l'inglese dei post (pubblicato il 16/09), e **nessuna bozza è firmata da un
manifest**: restano solo quella del post di Venezia, nata dall'unpublish, e l'orfana di giugno. Studio si
usa normalmente, foto comprese, e la rilettura delle lingue si fa lì sul pubblicato.

⚠️ **`pnpm typecheck` non vede né i JSON né le chiavi `t()` inesistenti**:
`src/i18n/request.ts:20` importa i messaggi con un percorso costruito a runtime e `tsc`
non apre mai quei file. La **parità delle chiavi** fra i cinque dizionari la tiene
`src/messages/parita.test.ts`, che contiene anche il gruppo «nessuna lingua attiva è a metà»:
gira sulle lingue di `ACTIVE_LOCALES` e cade se una ripete l'inglese fuori dalle ammesse. Le
chiavi `t()` inesistenti le vede solo **`build`**; il checkpoint sui JSON è `format:check`.

⚠️ Senza cookie, `Accept-Language` dirotta le rotte IT su EN: i test Playwright vanno
pinnati a `locale: "it-IT"`.

---

## 7. Componenti condivisi

In `src/components/` (elenco al 17/09/2026; si rilegge con `ls`, il conteggio non si scrive qui):

- radice — `hero-scrim` (lo scrim di lettura degli hero: varianti `centrato` e `sinistra`, scala a passi) e **`hero-fade`** (`HeroFade`, dal 17/09, #207: la sfumatura in fondo agli hero, 45% dell'altezza, `transparent → var(--fa-ink)`, dopo gli strati di sfondo e prima del contenuto; su finiture, home, collezione, chi siamo, contatti, produzione; /blog ha un velo suo e resta fuori). La **home** non usa `hero-scrim`: ha lo scrim direzionale in `home-hero.tsx`
- `cards/` — `collection-card`, `model-card` (esteso, non fotocopiato: il discriminante è la **shape del dato**, non una prop `variant`)
- `heros/` — `collection-hero`, `hero-media-bg`, `hero-stat-bar`
- `layout/` — `navigation` (⚠️ dal 17/09 il **menu mobile è fisso**: la visibilità la decide il render, niente GSAP sul pannello; GSAP resta solo sul box delle lingue), `footer` (dal 20/10/2026 con la colonna della newsletter: `newsletter-form`, `newsletter-action` con `submitNewsletter`), `locale-flag`
- `sections/` — `progettare-cta` (la CTA contatto di sei pagine; i testi arrivano via props già risolte)
- `ui/` — `breadcrumb`, `button` (**due varianti**: `primary` e `secondary`; la terza, `text`, è stata tolta il 10/09 perché aveva `px-0` che perdeva contro il padding della taglia), `center-underline`, `reveal`, `section` (⚠️ `back-button` **non esiste più**: rimosso con PR #146, set 2026, quando il tasto «Indietro» è diventato il breadcrumb)

⚠️ **Rimossi di recente, per non cercarli:** `fontealta-row-gallery.tsx` (PR #171: zero
importatori), `COLLECTION_BY_SLUG_QUERY` e `getCollection()` (9/09: codice morto).
- `filters/` — `filter-bar`, `filtri-mobile`, `filtri-sheet`, `use-filtri-url` · `markers/` — `water-supply-drops` · `media/` — `sanity-image` · `seo/` — `breadcrumb-json-ld`, `collection-page-json-ld`, `site-json-ld`
- `ui/section-heading` — l'intestazione **invisibile** che dà una gerarchia alle
  pagine di collezione e dei corpi. Riceve il testo già tradotto, non una chiave: le
  due sezioni hanno namespace diversi, e passare la chiave sposterebbe la scelta del
  namespace nel posto che ne sa meno. ⚠️ Nato da un blocco duplicato in cui **il
  markup era una riga e la spiegazione quattordici**: il valore ripetuto era il
  commento, e il posto giusto di una spiegazione ripetuta due volte è un posto solo.
- `seo/collection-page-json-ld` — `CollectionPage` + `ItemList` per le pagine che
  elencano articoli. L'elenco arriva dalla **stessa collezione di dati che disegna la
  griglia**, non da una seconda query.

**La traccia dei controlli a bordo** (17/09, #207) sta in tre token di `globals.css`:
`--fa-stroke` (3 px, lo spessore delle card, usato **solo** dai CTA outline del `Button`),
`--fa-stroke-color` (bianco puro, per ogni controllo a bordo sui fondi scuri) e
`--fa-stroke-color-on-light` (navy, sui chiari). Toggle, tab, chip e frecce del carosello
hanno il colore dei token e lo spessore di prima. Chi usa cosa è scritto nel commento dei
token, e la decisione in `CLAUDE.md`.

**I token, dopo la Fase 2 (23/10/2026, #297, #299, #300; spec `docs/specs/token-fase-2.md`).**
Due chiari soli: il crema `#f6f4f0` per il fondo delle pagine e il testo su scuro, il bianco puro per i
controlli e il fondo delle card chiare; i veli scuri sull'inchiostro `#0b1215`. Raggi, durate, interlinee,
ombre e opacità hanno un nome per gradino, le lunghezze sulla griglia da 4 px si scrivono con la scala, e la
guardia di lint vieta le forme numeriche dei valori che hanno preso un nome. Il dettaglio dei token sta in
`docs/overview.md` (§ Design System) e nella rule `design-system`.

**`src/lib/`**: il conteggio sta in `CLAUDE.md`; qui l'elenco, con la data della misura
(10/09/2026, più le aggiunte dell'11).

Moduli dell'11/09: **`route-metadata.ts`** — `routeMetadata` costruisce i metadata di
una rotta statica da una `href` sola, e `staticRouteMetadata` è la fabbrica che
restituisce la `generateMetadata` già pronta. ⚠️ Emette il blocco `openGraph`
**intero**, perché dichiararne un campo sostituisce l'oggetto: è il punto in cui
`canonical` e `og:url` diventano impossibili da far divergere, e in cui `og:title`
smette di portare il marchio che `og:site_name` porta già. **`collection-jsonld.ts`**,
**`product-jsonld.ts`**, **`model-measurements.ts`**, **`tagline.ts`** dal giro GEO;
**`og-fallback-image.ts`** (era `og-riserva.ts`, rinominato in `85cbe1b`), l'immagine di condivisione di riserva, che tiene viva la leva
`defaultSeo.ogImage` per le rotte che dichiarano un `openGraph` proprio. Moduli aggiunti fra l'8 e il 10 settembre: **`urls.ts`** (`absoluteUrl`,
`localizedUrls`, sopra `getPathname`), **`azienda.ts`** (identità legale, sorgente unica),
**`seo-editoriale.ts`** (`risolviSeo`, `indicizzazione`), **`lingue.ts`** (i nomi delle
lingue, estratti da `navigation.tsx` dove esistevano già).

⚠️ **`use-scroll-reveal.ts` non esiste più in `lib/`**: dal 10/09 si chiama
`use-scroll-reveal-classlist.ts` ed esporta `useScrollRevealClassList`. Si chiamava
`useScrollReveal` come quello di `src/hooks/`, che è un'altra cosa e resta dov'è: due
comportamenti diversi sotto lo stesso nome in due cartelle. **Non** sono stati unificati:
l'unico consumatore del primo è `fasi-accordion.tsx`, cioè le nove fasi di `/produzione`,
tarate al pixel.
⚠️ Questa riga diceva «20 file, 5 dei quali con il test accanto» e poi ne elencava **sei**:
si contraddiceva da sola. E il primo della lista era `back-target`, **cancellato** con PR
#146 insieme a `back-button`. I moduli con un test accanto li dice
`ls src/lib/*.test.ts` (29 il 27/10/2026 su `18bf12d`; qui c'era un elenco a mano di 16,
fermo da settimane: rule `documenti`, gli inventari non si scrivono a mano). Le guardie
fuori da `src/lib/`, rotte comprese, le dice `find src/app -name '*.test.ts'` (8 lo stesso giorno).

---

## 8. Media

**Immagini** — `next/image` su Sanity CDN. `urlFor` (`sanity/lib/image.ts`) applica
`.auto("format").fit("max")`. `next.config.ts` dichiara 4 `remotePatterns`
(`cdn.sanity.io`, `images.unsplash.com`, `picsum.photos`, `fastly.picsum.photos`) e
`qualities: [75, 82, 90]`.

**Formattazione delle classi:** `.prettierrc.json` dichiara `tailwindStylesheet`
(`./src/app/globals.css`) dal 10/09. Senza, il plugin non conosce le utility del tema
(`text-caption`, `bg-fa-navy`, `rounded-pill`) e le ordina come classi sconosciute.

⚠️ **`images.formats` NON è impostato**: vale il default `['image/webp']`. È il motivo per
cui l'advisory AVIF di agosto non ci ha toccati.

⚠️ **La fetch a monte non manda `Accept`** (`fetchExternalImage`), quindi il CDN Sanity
non negozia AVIF nonostante `.auto("format")`.

**Import statici**: **10**, tutti le foto di `/produzione` da `public/produzione/`. Sono
il motivo per cui esiste `src/types/image-imports.d.ts` — vedi §10.

**Video** — su **`media.fontealta.it`** (dietro c'è Cloudflare R2, ma l'host servito è il
dominio). Quattro URL popolati in `siteSettings`: home webm AV1 + mp4 H264, chi-siamo
webm + mp4. `collection.heroVideo` è popolato su **0 collezioni su 22**.
`homeHeroPoster` è **vuoto** → il poster resta Unsplash.

---

## 9. CI, gate e infrastruttura

**`.github/workflows/ci.yml`** (i conteggi stanno in `CLAUDE.md`):

```
verifica · build (+ Lighthouse) · sonar      tre job senza `needs`, in parallelo (dal 26/10/2026, #306)
```

Trigger: push su `main` e `sprint/**`, PR verso `main`. Lighthouse è un passo di `build` e gira solo
sulle PR non in bozza; `sonar` sulle PR e sui push a `main`.

- **`verifica`** (dal 21/10/2026, #283) fa in fila lint, `format:check`, `typegen`, typecheck, test e
  `i18n:cinque-lingue --qui`, quest'ultima per ultima. Il typecheck gira quindi in un job che il
  build non lo fa: ha una conseguenza non ovvia, vedi §10.
- **`build`** usa la cache di Turbopack (dal 22/10/2026, #284): solo `.next/cache/turbopack`, letta
  sempre, salvata solo dai push su `main`. Dal 26/10/2026 (#306) costruisce con l'env di produzione
  e, sulle PR non in bozza, lancia `lhci autorun` sul build appena fatto: un build solo invece di due,
  e un audit sotto soglia fa rosso `build`. Chiave e ragioni in `.claude/rules/ci-deploy.md`.
- **L'e2e non è un job**: le guardie di `tests/regression/` (`pnpm test:e2e`, col build E2E, il
  finto Zapier e il finto Brevo) girano sul Mac con `pnpm e2e:firma`, a due worker dal 26/10/2026
  (#309; `E2E_WORKERS=1` per uno), che pubblica sul commit lo
  stato «e2e (locale)», obbligatorio prima del merge (dal 22/10/2026; in CI solo quel giorno, col
  job `e2e` della #285). Un ramo di soli documenti (`docs/`, `.claude/`, i `.md`, `eslint.config.mjs`: i percorsi dei `@source not`
  tranne le due cartelle della tavola, che per la firma sono codice) non gira l'e2e e non si costruisce:
  il segno si scrive subito, perché quei file non entrano nel CSS servito (dal 22/10/2026, #294).
  Script e hook in `.claude/rules/ci-deploy.md`.
- **`SonarCloud Code Analysis` è rosso strutturale** (`0.0% Coverage on New Code`) sulle PR che aggiungono righe eseguibili: si ignora, e resta rosso per scelta. Una PR che cambia solo valori dentro istruzioni esistenti non ha righe nuove da coprire e passa (la #299). La duplicazione non conta `eslint.config.mjs`, che è un elenco di voci della stessa forma (#299). Dal 6/10/2026 (#236) i test sono dichiarati test e non contano nel LOC; TypeGen e gli script one-shot sono fuori dall'analisi (scope e regole in `.claude/rules/ci-deploy.md`). Il job `sonar` invece deve essere verde.
- **Dal 13/10/2026 (#245):** `concurrency` sulle PR (un push nuovo ferma il run precedente della stessa PR; i run su `main` e `sprint/**` non si cancellano), `timeout-minutes` su ogni job, `permissions: contents: read` per tutto il workflow. Valori, fonti e proposte scartate in `.claude/rules/ci-deploy.md`.
- Il ruleset «main-protection» esiste ma **non è enforced** (repo privato su piano Free): il gating è **procedurale**.

**Deploy:** progetto Vercel `fontealta-website`, production su push a `main`, preview su
ogni push di ramo. Le preview sono **no-index** e protette da SSO: non sono interrogabili in
anonimo, il confronto prima/dopo si fa contro la produzione.

**`vercel.json`** (17/09, #207) porta l'**Ignored Build Step**, `scripts/vercel-ignore-build.sh`:
salta il build dei push di soli `docs/`, `*.md`, `.claude/`, `tmp/` e dei rami
`dependabot/*`; costruisce su tutto il resto, `.github/` compreso, e su ogni dubbio. La base è
l'ultimo deploy riuscito del ramo (`VERCEL_GIT_PREVIOUS_SHA`), mai `HEAD^`. **Lo stato dei
deploy si legge dall'API di GitHub**, o dal connettore Vercel con `slug`/`teamId` del team
espliciti (dal 13/10/2026; prima non vedeva il progetto): un build
saltato è `success` con la descrizione «Canceled by Ignored Build Step» e nessun deployment.

**Form contatti** → webhook **Zapier** (`ZAPIER_CONTACT_WEBHOOK_URL`, server-only;
`ZAPIER_SHARED_SECRET` viaggia nel **body** come `_secret` perché il Catch Hook non filtra
gli header). **Brevo** (`src/lib/brevo.ts`, dal 20/10/2026): l'email del catalogo,
«Richiesta ricevuta» dopo i moduli di contatto, e le iscrizioni alla newsletter dalla casella
dei moduli e dal piè di pagina (`submitNewsletter`, che non passa da Zapier); tutto dopo il
successo di Zapier e in `after()`, tranne il catalogo, la cui email decide la riga di conferma.
Template, liste e automazione stanno su Brevo: elenco nella rule `legali-contatti`.

**Env var** (`.env.example`): i tre `NEXT_PUBLIC_SANITY_*`, `SANITY_API_READ_TOKEN`,
`SANITY_REVALIDATE_SECRET`, `ZAPIER_CONTACT_WEBHOOK_URL`,
`NEXT_PUBLIC_SITE_URL`, `IUBENDA_SITE_ID`, `IUBENDA_COOKIE_POLICY_ID`,
`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.

⚠️ **`NEXT_PUBLIC_SITE_URL` governa i canonical, e SOLO quelli, dal 17/09/2026** (#209).
Governava anche l'indicizzabilità, e questa riga diceva che le due cose vanno cambiate
nella stessa finestra: la finestra c'è stata, la variabile vale `https://fontealta.it`, e
il cancello dell'indicizzabilità è passato a **`VERCEL_ENV === "production"`** perché la
variabile ha un valore solo per Production e Preview insieme, e quindi apriva anche le
anteprime. `isIndexableSiteUrl` non esiste più in `src/lib/seo.ts`.

**SEO:** ⚠️ **Questo punto era falso in entrambe le sue affermazioni, ed è stato riscritto
il 9/09/2026.**

Diceva che `metadataBase` e `alternates` esistevano «in 3 file soltanto» e che
`src/app/sitemap.ts` «non esiste». Dopo **#162**: `metadataBase` sta **solo** nel layout
radice, canonical e hreflang sono su **16 rotte su 16**, `x-default` è EN con
`alternateLinks: false`, e `src/app/sitemap.ts` **esiste** e serve la sitemap del sito.
Gli helper degli URL assoluti e localizzati stanno in `src/lib/urls.ts`, sopra
`getPathname`; `siteUrl()` in `src/lib/seo.ts` normalizza la base togliendo lo slash
finale, che su Vercel la variabile ha.

Dopo **#165** la rotta è `dynamic = "force-dynamic"` e la sua query gira con
`client.fetch` diretto, `useCdn: false` e `cache: "no-store"`: nel tabellone del build
compare come `ƒ` e non come `○`. Il perché sta in `docs/history/2026-09-09-sitemap-dynamic.md`,
che porta le quattro misure.

⚠️ **`robots.ts` LA DICHIARA, dal 10/09/2026**, e questa riga ha detto il contrario per due
giorni. La storia in breve: fino all'8/09 il file **non** la dichiarava (quel che sembrava
una dichiarazione, a riga 9, era un commento), il check del 9/09 corresse l'affermazione
opposta, e **`2fdf8a4`** — la PR della sitemap — ha aggiunto la riga vera poco dopo. Oggi
`src/app/robots.ts` la aggiunge solo nel ramo indicizzabile, perché invitare a visitare
una sitemap sotto un `Disallow: /` è una contraddizione che ogni motore risolve come vuole.
Dal cutover quel ramo è quello che la produzione serve davvero: misurata sul dominio il
21/09, la riga `Sitemap:` c'è. ⚠️ La riga `Host:` invece è stata **tolta** dal #209.

**Crawler AI (dal 10/09, PR #171):** `robots.ts` nomina **nove** crawler oltre al `*`,
divisi fra quelli che citano (`OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`,
`ClaudeBot`) e quelli che addestrano (`GPTBot`, `Google-Extended`, `CCBot`,
`Applebot-Extended`, `anthropic-ai`). La scelta fra «tutti allow» e «chiusi i cinque che
addestrano» è la costante **`POLITICA_AI`**. ⚠️ Le regole per nome escono **solo** nel
ramo indicizzabile, che dal cutover è la produzione: sul dominio ci sono tutte e nove con
`Allow: /` (misurato il 21/09). In **anteprima** il file resta `* / Disallow: /`.

**Header (dal 10/09):** `headers()` in `next.config.ts` restituisce quattro header su ogni
risposta (`X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`,
`Permissions-Policy`) più `X-Robots-Tag: noindex` **solo fuori dall'ambiente di
produzione** (dal #209, stesso cancello del `robots.txt`; sul dominio l'header non c'è).
Prima restituiva `[]` in produzione. ⚠️ Nessuna **CSP**: è l'unico che può rompere il
modulo o un terzo, e si fa in un giro suo, in `Report-Only` prima. Il cutover, che era la
sua condizione, è passato.

**`/llms.txt` (dal 10/09):** `src/app/llms.txt/route.ts`, dinamica come la sitemap, con le
sezioni che iterano `ACTIVE_LOCALES`. È servita **anche** in anteprima, dove `robots.txt`
dice `Disallow: /`: sono due cose distinte.

---

## 10. Script, guardie e trappole

**Guardie aggiunte l'11/09/2026**, tutte in `tests/regression/`:
`og:title` nudo **e uguale al titolo meno il suffisso**; l'**insieme dei nomi** dei tag
`og:*`, non il conteggio; `/area-riservata` come **eccezione asserita** — niente
canonical, niente `og:url`, un tag in meno, titolo col suffisso — che è anche la
controprova della guardia sopra (dal 7/10, #240, anche `og:site_name`, `twitter:title` = `og:title` e
`og:image:alt` presente, sui 70 campioni; dal 27/10, #313, le pagine escluse sono un elenco, con `/officina`); il landmark dei filtri e i titoli, letti
dall'**albero di accessibilità vero** tramite `helpers/ax-tree.ts` e non da
`getByRole`, che non applica le regole di annidamento di ARIA in HTML; il focus dei
moduli, che aspetta `getAnimations()` invece di un cronometro.

⚠️ `/llms.txt` e `/sitemap.xml` stanno **fuori da ogni cache** e si ricostruiscono a
ogni richiesta: è l'unica configurazione in cui dicono la verità alla prima lettura
dopo un publish.


**npm scripts**: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`,
`e2e`, `test:e2e`, `format`, `format:check`, `typegen` (+`:extract`/`:generate`),
`history:index`, `seed:sprint1`, `seed:sprint2`, `migrate:sprint-2-schema`, `parse:catalog`,
`purge:finish-drafts`, `migra:seo-lingua`, e i cinque `i18n:` (`export`, `import`, `diff`,
`discard`, `publish`) descritti in §6. L'elenco vero lo dà `package.json`.

**`scripts/`**: utility TypeScript one-shot (import, migrazioni, popolamenti; `ls scripts/*.ts`)
più `i18n/`, `seed-data/`, `migration/` e un apply-log. Due pesano più delle altre e vanno nominate:
**`parse-catalog.ts`** (fra i nodi più connessi del grafo; i conteggi stanno in `CLAUDE.md`) è il
parser che trasforma `catalog-reference.md` nei 591 articoli, e **`import-blocco1.ts`** (35
archi) è l'import una-tantum del Blocco 1. Non sono script marginali: sono fra i punti più
connessi del progetto.

**`sanity/schemas/index.ts`** è il file che assembla i tipi documento e gli
object in un unico schema: ogni tipo nuovo passa di lì.

**Le trappole che costano tempo** — l'elenco vivo sta in CLAUDE.md, sezione «Firme e
trappole». Le tre che riguardano l'architettura:

1. **`src/types/image-imports.d.ts` non si cancella.** Sembra ridondante con
   `next-env.d.ts`, che è **gitignored** e rigenerato da `next build`. In CI il typecheck
   gira nel job `verifica`, che non fa il build: senza il file tracciato, ogni import statico di immagine dà
   `TS2307` in CI e verde in locale. Controprova: 10 errori senza, 0 con.
2. **`pnpm test:e2e` non riusa un server già acceso** (`reuseExistingServer: false` dal
   13/10/2026; prima `!CI`, e un `pnpm start` attivo senza `NEXT_PUBLIC_E2E=1` faceva
   fallire i test per il motivo sbagliato). Con la porta occupata la suite non parte:
   `pkill -f "next-server"` prima. Il sito riceve il webhook del finto Zapier nell'env.
3. **`pnpm dev` riscrive in `AGENTS.md` il blocco fra i marker `nextjs-agent-rules`**, e solo
   quando è diverso da quello della versione di Next installata: oggi coincide, quindi non
   sporca il diff. Tornerà a farlo dopo un aggiornamento di Next. Il testo fuori dai marker
   sopravvive.

---

## 11-bis. Orizzonte

Cosa aspetta, e dove sta scritto.

~~**Cantiere di ottobre, post-Cersaie — migrazione Sanity 6 / next-sanity 13.**~~ **FATTO**: next-sanity 13 il 15/10/2026 (#254), Sanity 6.15.0 il 16/10/2026 (#256); versioni e scelte in `CLAUDE.md` § Tech Stack. Il testo di allora, come verbale: tre pezzi
indipendenti: bump di `@sanity/client` (installato 7.27.0 al 15/09: il `^7.26.2` che next-sanity 13
richiede è già soddisfatto), **riprogettazione della cache senza `fetchOptions`** — rimosso da
`DefineLiveOptions`, quindi la dottrina va ripensata e non tradotta — e decisione su stega.
L'alert critical `tar` che questa riga citava è chiuso dal 27/08. Diagnosi completa
nel registro interventi, riga del 24/08.

**Dopo le lingue, cinque cantieri**, nell'ordine deciso con Marco il 16/09. Stanno qui perché
attraversano l'architettura; il dettaglio operativo sta nell'handoff.

1. ~~**Menzioni legali.**~~ **FATTO**: pagina ad accordion dal 16/09/2026, e dal 26/10/2026 (#308)
   la sezione `#societa` con REA, capitale, PEC e ISO 9001 (sopra, «Menzioni legali»; rule
   `legali-contatti`). Restano le traduzioni della #308 da far rileggere ad Alma (handoff).
2. ~~**Vercel Analytics, senza cookie.**~~ **FATTO il 21/09/2026** (#208): `<Analytics />` nel layout
   del sito, reso solo con `VERCEL_ENV === "production"`, senza cookie né identificatori persistenti e
   dichiarato nelle menzioni legali in cinque lingue. Il banner di consenso resta fuori, perché la
   condizione scritta in `CLAUDE.md` alla voce cookie — niente cookie di terzi, niente profilazione —
   regge.
3. ~~**Cutover.**~~ **FATTO il 17/09/2026**, tranne la Search Console e la privacy letta da
   Andrea, che restano: `NEXT_PUBLIC_SITE_URL` vale il dominio, il robots di produzione è
   aperto e quello delle anteprime chiuso sul cancello d'ambiente (#209). Il Pro non ne faceva parte
   (decisione del 16/09); **è attivo dal 7/10/2026**, e il limite per IP sul modulo è una regola WAF
   messa dal pannello (`legali-contatti`). Quella per `submitNewsletter`, il modulo del piè di
   pagina (#274), la aggiunge Marco: al 20/10 sera non è verificata.
4. **Pulizia B.** Una CI più leggera (il perimetro è in `CLAUDE.md`, §Manutenzione) più i piccoli
   debiti già a registro: la riserva di `og:image`, il dizionario inlined, le chiavi morte, le em
   dash servite in `cookie.sections` (**M26**) e l'aggiornamento di gstack. ✅ **Chiusi il 22-23/09/2026**:
   le classi `text-[…]` arbitrarie e gli altri valori scritti a mano, ora token di `@theme` con una
   guardia di lint (#221, #222), e `useGSAP` nell'unico effetto GSAP della nav (#223). ✅ **La CI,
   rifatta il 13/10 e il 21-22/10/2026** (#245, #283-#285, #287, #288, #290): `concurrency`, un job `verifica` al
   posto di cinque, la cache di Turbopack nel build e le prove e2e firmate in locale. Lo skip della CI per le
   PR di soli documenti è scartato (`.claude/rules/ci-deploy.md`).
5. ~~**CSP in `Report-Only`**~~ **FATTO il 15/10/2026** (#253), statica e senza nonce: la variante a
   nonce, che questa riga chiedeva, renderebbe dinamiche tutte le pagine (rule `seo-meta`). La policy
   che blocca la decide Marco: il 26/10 resta `Report-Only`.

**La tavola dell'officina** (27/10/2026, #311-#315, spec `docs/specs/tavola-officina.md`): sul sito, con
le voci del cancello ancora aperte nella spec (sottotitoli corretti a orecchio, dichiarazione di
accessibilità).

**Misure** (2/11/2026): in attesa delle schede tecniche di Alma → `docs/specs/misure.md`.

**Tre aperture sui pallini, dallo split di `.fa-dot`** (#218, 22/09/2026). Stanno qui e non
nell'handoff perché durano di più. Nessuna è entrata nella PR, che doveva muovere zero pixel:

- **Lo scale 1.15 in hover sui pallini del carosello** della home. È la collisione annotata il
  17/09, oggi scritta in chiaro in `.fa-coverflow-dot`: toglierlo è una riga, ed è una scelta di
  design.
- **`:hover` non limitato a `(hover: hover)`**, su `.fa-finish-dot` e `.fa-coverflow-dot`: su un
  dispositivo touch lo scale resta attaccato dopo il tocco.
- **Il fuoco del `FinishSelector`** della scheda modello è l'anello di default del browser
  (`outline: auto`, blu di sistema), senza uno stile nostro; il riferimento di casa è l'anello del
  `Button`, scelto secondo il fondo.

**Tutto il resto delle aperture vive nell'handoff corrente**, in `tmp/handoff/` (fuori da git; al
23/10/2026 `tmp/handoff/2026-10-23.md`, § «Aperture»), non in un file di tracking dentro il repo. Gli
handoff di settembre stanno in `~/Desktop/FonteAlta/file md/`. Le voci del vecchio `TODO.md`
sono state triate una a una il 27/08: la tabella sta in testa a
`docs/archive/TODO-2026-06.md` e vale **34 voci = 18 fatte + 6 obsolete + 10 aperte**.

## 10-bis. Accoppiamenti che nessuno strumento vede

Ricavati dal grafo di conoscenza il 27/08; i conteggi del grafo stanno in `CLAUDE.md`, datati. Sono relazioni **reali**
che non esistono come import e che quindi nessun `grep`, nessun AST e nessun refactor
automatico può seguire. Chi tocca uno dei due capi deve sapere dell'altro.

- **Il webhook e i tag di cache non si conoscono.** `api/revalidate/route.ts` chiama
  `revalidateTag(body._type)` e `revalidateTag()` con il tag granulare `_type:slug`; i 19 `tags:` in
  `src/lib/content.ts` sono **stringhe letterali**. L'accoppiamento è per coincidenza di
  stringa: nel grafo **non c'è nessun arco** fra i due file. Rinominare un tag da una parte
  senza l'altra rompe l'invalidazione **in silenzio** — nessun test e nessun tipo protegge
  questa giunzione.
- ~~**`it.json` e `en.json` non sono legati da niente.**~~ **Superato dall'11/09/2026**: il
  grafo li metteva in comunità separate, e l'allineamento delle chiavi era una convenzione
  tenuta a mano. Oggi `src/messages/parita.test.ts` verifica che tutti e cinque i dizionari
  abbiano le chiavi di `it.json`, e che nessuna lingua attiva ripeta l'inglese (§6). Il grafo
  continua a non vedere il legame, perché è un test e non un import.
- **`src/types/image-imports.d.ts` ha ZERO archi.** È uno dei **7 file isolati** del grafo,
  insieme alle config (`vitest`, `playwright`, `lighthouserc`) e alle due suite e2e. Il
  grafo conferma la trappola già a registro: quel file *sembra* cancellabile proprio perché
  strutturalmente non è collegato a niente, e cancellarlo rompe `typecheck` in CI.
- **Le suite in `tests/e2e/` sono isolate**, coerentemente col fatto che la loro config
  (`playwright.config.ts`, `pnpm e2e`) non è in `ci.yml` (§9): niente le tira, niente le esegue
  automaticamente. La config di regressione, `pnpm test:e2e`, gira invece in locale con la firma
  (dal 22/10/2026, §9).
  ⚠️ I file lì sono **tre** (`navigation`, `page-render`, `contact-form`) per **4 test
  dichiarati**, non due come diceva questo punto. Da non confondere con le **4 file / 21
  test** di `tests/regression/`: la spartizione fra le due cartelle è in §9.

⚠️ Un limite misurato **dello strumento**, non del codice: l'import
`content.ts → sanity/lib/live.ts` esiste nel sorgente ma **non compare** come arco, mentre
`content.ts → queries.ts` sì. Il grafo è una mappa molto buona, non il territorio: un arco
mancante non prova che la dipendenza non ci sia.

## 11. Debiti aperti

Il registro completo è in `docs/history.md`. I quattro che toccano l'architettura:

| ID | |
|---|---|
| ~~**M24**~~ | ~~`metadataBase` solo in 3 file~~ **CHIUSO con #162**: sta in **un solo** file, il layout radice (`grep -rln`, 10/09/2026) |
| ~~**M25**~~ | ~~sitemap assente~~ **CHIUSO con #162/#165**: `src/app/sitemap.ts` esiste, serve 1312 voci ed è dichiarata da `robots.ts:79` nel ramo indicizzabile |
| **M26** | pagine legali in bozza ma pubbliche. I fornitori sono corretti dal #188; restano **due em dash servite** in `cookie.sections.2.body`, uguali in tutte e cinque le lingue, da correggere **prima nell'italiano** |
| ~~**M27**~~ | ~~`NEXT_PUBLIC_SITE_URL` da cambiare nella stessa finestra del cutover~~ **CHIUSO il 17/09/2026**: vale `https://fontealta.it`, e l'indicizzabilità non dipende più da lei (#209) |

Più il cantiere **Sanity 6 / next-sanity 13**, previsto per ottobre. ⚠️ La riga diceva che
chiude «l'alert critical `tar`»: quel critical **è già chiuso** dal 27/08, e da allora i
critical sono **zero** (rimisurato il 10/09). Quel che il cantiere chiude è il grosso degli
alert **high e medium**, che arrivano transitivamente dalla toolchain Sanity — dipendenza
di produzione perché lo Studio è embedded.

⚠️ Debito nuovo, aperto il 10/09: **`post.author` è `Rule.required()`**, quindi il ramo
«nessun autore → firma l'`Organization`», che esiste nel codice, non è raggiungibile senza
lasciare il documento in errore di validazione.
