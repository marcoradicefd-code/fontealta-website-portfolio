# SEO delle pagine di contenuto: la checklist

> Spec al presente, aperta il 3/11/2026 con la PR c1a. Vale per le pagine d’uso (la prima è «doccia da esterno»,
> `code: outdoor-shower`) e, con le aggiunte del § 7, per gli approfondimenti della c2. Modello dei dati, FAQ e
> foto: `docs/specs/faq-pagine-uso.md` (§ 1, § 6, § 7). Le decisioni del grill del 3/11 sera sono in fondo.

Ogni punto dice **dove si controlla** (il caricatore, lo Studio, un test, l’audit) e **chi lo scrive**. Il
caricatore è `pnpm contenuti:carica --sezione=pagine-uso`; le regole del corpo sono pure, in
`sanity/lib/pagina-uso-rules.ts`, e le usano sia lo Studio sia il caricatore; quelle della pagina intera stanno in
`scripts/i18n/pagina-uso-md.ts`. Un **errore** ferma il file, un **avviso** resta nel rapporto e lo decide chi
rilegge.

## 1. Chi fa cosa, e in che ordine

- **Cowork** scrive i testi nei file `docs/content/pagine-uso/<lingua>/<code>.md`, dal brief
  (`tmp/pagina-uso/brief.md`), e indica nei commenti dove va una foto e cosa deve mostrare.
- **Claude** sceglie le foto fra le ambientazioni (spec FAQ § 6), le carica su Sanity solo col GO, mette nel file
  l’asset; Cowork scrive gli alt sulla foto scelta.
- **Marco** rilegge le cinque lingue. Poi il carico (dry-run, diff, codice di conferma, `--execute`), l’audit
  sull’anteprima lo stesso giorno, le correzioni (grill, Q1). **Nessun interruttore**: la pagina esce in tutte le
  lingue insieme, e il cancello (§ 5) tiene a 404 una lingua senza titolo.

## 2. Testi

| Regola | Soglia | Dove si controlla |
|---|---|---|
| `seo.title` con la keyword all’inizio | 38-48 caratteri (obiettivo 39-43; il sito aggiunge « \| Fontealta») | caricatore: errore sui limiti, avviso sulla keyword |
| `seo.description` con la keyword, unica sul sito nella lingua | 140-155 caratteri | caricatore: errore sui limiti e sul doppione, avviso sulla keyword |
| H1 unico, una domanda o una promessa, con la keyword, diverso dal title | uno | caricatore: errore se manca o se sono due, avviso sulla keyword e sul title uguale |
| Introduzione, testo semplice: 2-3 frasi che rispondono, una riga di credibilità **solo con fatti veri**, una definizione («X è…»); le prime 40-60 parole nominano Fontealta e la keyword | almeno 40 parole | caricatore: avviso; errore se c’è grassetto o un link; i fatti li controlla la rilettura |
| Box «In sintesi» subito dopo l’introduzione, in testa al corpo | uno, 3-4 voci di testo semplice | caricatore e Studio: errore se non sta in testa, se sono due o fuori da 3-4 voci; avviso se manca |
| H2 nell’ordine della struttura (Q19): «Colonna, a parete o pannello» con la tabella; «Come scegliere» con criteri numerati «se… allora…»; l’installazione con quattro H3 (acqua calda, scarico, base, inverno), nessun numero; idee e progetti con le foto; errori da evitare; uno con la keyword | 5 H2 | caricatore: avviso fuori da 4-6 e sulla keyword; l’ordine lo controlla la rilettura |
| Link interni in uscita | 3-5 | caricatore: avviso |
| **Corpo e FAQ non rispondono mai alla stessa domanda**: i temi del corpo non tornano nelle FAQ della pagina, e viceversa | 0 | caricatore (titoli uguali, errore); per il resto la rilettura di Marco |
| Nessun titolo uguale a una domanda delle FAQ della stessa pagina e lingua | 0 | caricatore: errore (legge `docs/content/pagine-uso/faq/<lingua>/<code>.md`) |
| Lunghezza del **solo corpo**, introduzione compresa, FAQ escluse (Q5) | 1.000-1.200 parole | caricatore: avviso |
| Alt di ogni foto nella lingua della pagina, descrittivo | da 3 a 125 caratteri | Studio e caricatore: errore se manca, avviso oltre 125 |
| Link interni verso le collezioni da esterno e `/finiture`, testo descrittivo | almeno uno | rilettura; il caricatore verifica che ogni percorso esista |
| Le collezioni a video, scelte a mano e in ordine (⚠️ dal 4/11/2026 le card sono automatiche e la riga del file dice solo le collezioni in evidenza: § 5) | nel solo file italiano | caricatore: errore se lo slug non esiste o se sta in un’altra lingua |

Keyword della prima pagina (spec FAQ § 7 e passo 0 del 3/11): IT «doccia da esterno» (+ «doccia da giardino»), EN
«outdoor shower» (+ «outdoor shower ideas»), DE «Gartendusche» (+ «Außendusche», «Gartendusche Ideen»), FR «douche
extérieure» (+ «douche de jardin»), ES «ducha exterior» (+ «ducha de jardín»).

## 3. Il formato del file

In testa, fra due righe `---`: `code`, `kind: use`, `lang`, `keyword`, `seo.title`, `seo.description` e, nel solo
file italiano, `collezioni` (gli slug, nell’ordine). Poi l’H1 (`# `), l’introduzione, il corpo. Il formato intero,
con un esempio, sta in testa a `scripts/i18n/pagina-uso-md.ts`.

**Ammessi** (Marco, grill del 3/11, Q15):

- **H2**, e **H3 solo dentro un H2** (un H3 prima del primo H2 è un salto di livello); niente H4;
- **paragrafi**; **elenchi puntati** (`- `) e **numerati** (`1. `), un livello, una voce per riga;
- il **box «In sintesi»**: una riga `[[in sintesi]]` subito dopo l’introduzione e sotto 3-4 voci `- ` di testo
  semplice;
- **link interni** col percorso italiano di `routing.pathnames` (`[Club](/collezioni/club)`, `/finiture`,
  `/blog/<slug>`), risolti dal caricatore in `internalLink` con la referenza (Q14);
- **grassetto al massimo uno per sezione**, sulla frase chiave del paragrafo: mai una frase intera, mai lo stesso
  testo due volte nella pagina, avviso oltre 8 parole. La **sezione** è il testo sotto un H2, con le sue H3;
  l’introduzione non ha grassetto (Q7, come cambiata dalla Q15);
- **foto**: `[[foto: <asset> | alt]]` (un’orizzontale) e `[[coppia: <asset> | alt || <asset> | alt]]` (due
  verticali, controllate sulle misure dell’asset); finché la foto non è scelta, un commento
  `<!-- foto: cosa mostra -->`;
- **una tabella di confronto**, al massimo una per pagina: vera tabella con riga di intestazione, da 2 a 4 colonne,
  da 1 a 8 righe, ogni riga con tutte le celle piene (criteri uguali in ogni riga), testo semplice nelle celle,
  **subito dopo una frase che la introduce**, niente misure né prezzi. Nella pagina d’uso al più «colonna, a parete o
  pannello»; nella c2 «materiale e finitura».

**Vietati**, e il caricatore li rifiuta anche a metà riga: link esterni e URL nudi, elenchi annidati o con `+`, voci vuote, citazioni, codice, corsivo e barrato, immagini markdown, HTML, titoli sottolineati o scritti
senza spazio, righe di separazione, una seconda tabella, un segnaposto di foto dentro il testo o scritto male, il
segnaposto `TESTO` (anche nell’intestazione), un commento con «da verificare», chiavi sconosciute o valori fra
virgolette nell’intestazione, una collezione due volte. I commenti `<!-- -->` non arrivano mai su Sanity. Una foto
sola è un’orizzontale; due verticali vanno in coppia. In una cella una barra verticale si scrive `\|`.
Limite noto: il grassetto attorno a un link (`**[Club](…)**`) è rifiutato; si scrive `[**Club**](…)`.

## 4. Lingua e contenuto

- **Inglese americano per tutta la pagina d’uso** (title, description, H1, H2, testo, alt, FAQ): la keyword
  principale è americana. Si evitano le parole che si scrivono diverse in UK e US quando non sono la keyword
  («finish», non «color/colour»). Il resto del sito resta britannico. Caricatore: avviso su una parola britannica.
- **Materiali: mai «tutto inox» né «tutto in AISI 316»**, in nessuna lingua: D03.Q e S05 sono in ottone cromato,
  D04, S08 e S16 in ottone lucido naturale, Origo Rame è rame e ottone. Si scrive «quasi tutto in AISI 316, alcune
  doccette e soffioni in ottone», e quella frase passa in tutte le lingue: un qualificatore subito prima («quasi»,
  «almost», «fast», «presque», «casi») toglie l’assoluto. Caricatore (corpo, H1, introduzione, `seo`, alt, FAQ) e
  Studio (corpo, titolo, introduzione): errore. Limiti noti: una frase vera detta di un modello solo («la colonna è
  tutta in acciaio inox») è rifiutata e si riscrive col nome del materiale; il tedesco «ganz aus Edelstahl» non si
  controlla, perché lo si dice anche di una colonna sola.
- **Nessuna misura, nessun prezzo** (decisione R, estesa alla pagina d’uso dalla Q4), nel corpo, nell’H1,
  nell’introduzione, nei campi `seo`, negli alt e nelle FAQ della pagina: una cifra con un’unità in simbolo (mm, cm,
  m, m², ft, bar…, minuscoli) o in parola nelle cinque lingue (metri, meters, Meter, mètres, metros, gradi…), i gradi
  col segno («40 °C», «360°»), una cifra con una valuta in simbolo o in parola («1.200 euro», «1,200 dollars»), una
  parola del prezzo seguita da vicino da una cifra («prezzo di 900») sono errori. Non lo sono «AISI 316», «316L»,
  «24h», «2 persone», «AISI 316 in finitura lucida», «Edition 5 M», «il prezzo riflette la qualità».
- **Niente prezzi, niente nomi di clienti o di progetti, niente video** (Marco, 3/11 sera, Q20): le idee si
  descrivono per tipo di luogo (giardino, piscina, terrazza, yacht). Un video o un progetto nominato si decidono di
  nuovo dopo la misura di Search Console.
- **Niente permessi né consigli legali**, nessuna legge o norma per nome. Le FAQ sui permessi (IT, EN, DE)
  rispondono «dipende dal Comune, informati lì» (US «local building codes», DE «Gemeinde») e poi restano sui fatti di
  prodotto. Per lo scarico una frase sola, nella forma
  del mercato (Q17): IT «informati presso il Comune», US «check your local building codes», DE «bei der Gemeinde
  nachfragen», FR «renseignez-vous auprès de votre mairie», ES «consulta en tu ayuntamiento». Rilettura.
- **Tipografia del sito**: apostrofo `’`, niente em dash, niente doppio spazio, in francese U+00A0 prima di
  `? : ; ! »` e dopo `«` (`tipografia()` di `contenuti-md.ts` per lo spazio normale, `checkUsePage` per lo spazio
  che manca del tutto). Caricatore: errore.

## 5. Tecnica (c1b)

Un test per ogni punto dove si può. La pagina risponde 200 ed è indicizzabile agli slug di spec FAQ § 7
(`/doccia-da-esterno`, `/outdoor-shower`, `/gartendusche`, `/douche-exterieure`, `/ducha-exterior`); canonical a sé;
hreflang delle cinque lingue più `x-default`, reciproci; sitemap con `lastmod`; `llms.txt`. **Cancello**: senza
documento o senza titolo nella lingua → 404, fuori da sitemap e `llms.txt`, e nessuna lingua punta a una che manca.
`<title>` e description dai campi `seo`, nei limiti di `meta.test.ts`; `og:title`, `og:description`, `og:image`
con `og:image:alt` nella lingua, `og:locale`, `twitter:card`; `html lang`. Un solo H1, gerarchia senza salti,
briciole visibili (Home › pagina) e `BreadcrumbList`; FAQ in fondo col componente della #335 (risposte nell’HTML
anche chiuse), senza «Scrivici», poi `ProgettareCta` (Q12), l’unica CTA della pagina. Il box «In sintesi» si vede
come un riquadro dopo l’introduzione, con le voci in elenco. JSON-LD solo di contenuto visibile: `BreadcrumbList`,
`FAQPage`, `WebPage` (name, description, inLanguage, url, isPartOf il WebSite, publisher l’Organization, stessi
`@id`), **senza `dateModified`** e senza data a video (Q6), e un test che confronta il JSON-LD con ciò che è a
video. Apertura come il blog: nav piena, H1, introduzione, `sizes` della colonna, nessun CLS (Q8). **Tutte le foto
sono pigre, e l'LCP è un testo dell'apertura** (misurato il 4/11 in cinque lingue a 1440: il paragrafo d'introduzione; Marco, 4/11/2026, PR della c1b): qui c'era «prima foto nella colonna da 760 px con
priorità (LCP), le altre lazy», ma nei testi di Cowork la prima foto sta sotto l'H2 delle idee, molto sotto la piega.
Quando Alma manderà un'orizzontale all'aperto, andrà in apertura come prima foto, con priorità. La tabella è leggibile su telefono (scorrimento orizzontale
o schede impilate). Le card delle collezioni scelte prima delle FAQ (Q9). Lighthouse sopra le soglie, nessun link
rotto. Ingressi: le FAQ delle collezioni da esterno, la colonna delle collezioni del piè di pagina (Q11) e il post
sulla doccia da esterno, e 3-5 link in entrata dai post del blog (Q19); nessuna voce di menu; i testi dei link li
decide Marco.
⚠️ **Corretto il 4/11/2026 (Marco, grill della c1, Q1):** la voce del piè di pagina è **tolta**, in tutte le lingue
(`feat/c1-completamento`): ci portano le FAQ delle collezioni (link nel testo e «Approfondisci») e i post, caricati
prima del merge, così la pagina non resta mai orfana.
⚠️ **Card automatiche dal 4/11/2026 (Marco, Q6-Q8):** ogni collezione con almeno una colonna doccia (un modello di
sottotipo colonna o colonna-divisibile con la descrizione italiana che non comincia per «Colonna per lavabo» o
«Colonna per vasca»; un modello senza descrizione non conta), più le collezioni **in evidenza** (`collections[]`,
la riga `collezioni:` del file italiano), che vengono prima nell'ordine del campo e compaiono anche senza colonne;
le altre nell'ordine del catalogo (`order`). Nessun cancello e nessun tetto in più di `/collezioni`. Una collezione
nuova con una colonna compare col solo webhook (tag `collection` e `model`). Sottotipi dedicati (`colonna-lavabo`,
`colonna-vasca`) a registro.

## 6. Audit prima del merge (c1b)

Sull’anteprima col contenuto vero, nelle cinque lingue: plugin claude-seo installato **fuori dal repo** (mai
`.claude/skills`) oppure seo-council; Rich Results Test su `FAQPage` e `BreadcrumbList`; validator schema.org sul
`WebPage`; hreflang reciproco. Rapporto con rilievi e chiusure. ⚠️ **Corretto il 4/11/2026 (#355)**: il Rich Results
Test non mostra le FAQ per questo sito, nemmeno sulla home di produzione che il `FAQPage` ce l'ha; il `FAQPage` si valida
con lo Schema Markup Validator (validator.schema.org), il Rich Results Test vale per il `BreadcrumbList`. Con
l'anteprima protetta e senza `FAQ_SITO`, l'HTML si prende da un build locale con `FAQ_SITO=1` e si usa la modalità
«Codice».

## 7. I dati su Sanity

- `contentPage` con `kind: "use"` e id fisso `contentPage-<code>` (`USE_PAGES` in `sanity/lib/faq-rules.ts`):
  `title`, `intro`, `body` (`localizedUseBody`), `seo` (`seoFields`) per lingua, `collections[]`, `faq`,
  `loadedHashes`. Codice e tipo in sola lettura; la pagina **nasce dal caricatore**, non da Studio (Q16), e in
  Studio sta sotto «Pagine d’uso» senza «crea».
- Il corpo per lingua contiene le foto (`figure`, `figurePair` di `useImage`, con l’alt in quella lingua) e la
  tabella (`comparisonTable`).
- **Impronta**: `loadedHashes` tiene, per lingua, l’impronta di titolo, introduzione, corpo e `seo` al caricamento.
  Nell’impronta italiana entrano anche le collezioni. Una lingua cambiata in Studio dopo il caricamento non si
  sovrascrive: si riporta la modifica nel file, e quando file e Sanity coincidono il caricatore riscrive la sola
  impronta.
- **Scrittura**: sul pubblicato, per campi e lingua, con `ifRevisionId`, verbale e ripristino
  (`tmp/contenuti-scritture/`), l’export del dataset del giorno, **diff e codice di conferma** (lo stesso diff dà lo
  stesso codice; il codice copre anche gli oggetti creati), un diff per giro in
  `tmp/contenuti-scritture/diff/<data>/`, e prima della scrittura il controllo che ogni foto esista su Sanity. Le
  FAQ della pagina con `pnpm faq:carica <lingua> --dir docs/content/pagine-uso/faq`.
- `pnpm sanity:attributi` prima e dopo il carico (rule `i18n-sanity`, soglie della spec FAQ § 1.2).
- c2: gli approfondimenti aggiungono `Article` con autore e data visibili; la stessa checklist vale per il resto.

## Decisioni di Marco

**3/11/2026 sera, grill della c1**

| | Decisione |
|---|---|
| Q1 | Nessun secondo interruttore; Marco rilegge le cinque lingue → carico → audit sull’anteprima lo stesso giorno → correzioni |
| Q2 | Corpo e FAQ della pagina d’uso versionati in `docs/content/pagine-uso/`, con impronta, diff e codice di conferma; in `tmp/` solo il brief; le FAQ delle collezioni in manutenzione |
| Q3 | Due PR: c1a (schema, caricatori, file) e c1b (rotta, pagina, metadati, JSON-LD, ingressi, test, provini, audit) |
| Q4 | Nessuna misura, nessun prezzo, niente permessi né consigli legali |
| Q5 | 1.000-1.200 parole del solo corpo, FAQ escluse |
| Q6 | Niente data a video, niente `dateModified`; freschezza dal `lastmod` |
| Q7 | Keyword in title, description, H1, prime 40-60 parole e un H2; grassetto come da Q15 |
| Q8 | Apertura come il blog, senza hero |
| Q9 | Card delle collezioni scelte a mano; proposta Club, Club Large, Spring, Origo Rame, In&Out, Community, Waterline, da confermare ai provini |
| Q10 | Briciole Home › pagina, a video e in `BreadcrumbList` |
| Q11 | Voce nella colonna delle collezioni del piè di pagina; etichette da concordare (⚠️ tolta il 4/11/2026, Marco: § 5) |
| Q12 | FAQ senza «Scrivici», poi `ProgettareCta` |
| Q13 | Cowork dice dove va una foto e cosa mostra; Claude sceglie; gli alt li scrive Cowork sulla foto scelta |
| Q14 | Link interni col percorso italiano, risolti dal caricatore |
| Q15 | H2, H3 dentro un H2, paragrafi, elenchi di un livello (numerati dalla Q19), link interni, foto, un grassetto per sezione, una tabella di confronto; vietato il resto |
| Q16 | Documento fisso, creato dal caricatore |
| Q17 | Per lo scarico una frase sola nella forma del mercato, nessuna legge o norma per nome |
| Q19 | Struttura della pagina, dal modello della ricerca Reddit: H1 domanda o promessa con la keyword; introduzione di 2-3 frasi che rispondono, una riga di credibilità solo con fatti veri, una definizione; box «In sintesi» (3-4 voci); H2 «Colonna, a parete o pannello» con la tabella; H2 «Come scegliere» con criteri numerati «se… allora…»; H2 installazione con H3 acqua calda, scarico, base, inverno, nessun numero; H2 idee e progetti con le foto; H2 errori da evitare; FAQ; una CTA (`ProgettareCta`); 3-5 link interni in uscita e 3-5 in entrata dai post. Il caricatore ammette gli elenchi numerati e il box |
| Q20 | Niente prezzi (come da regola), niente nomi di progetti o clienti, niente video per ora |
| Q18 | Corpo e FAQ non rispondono mai alla stessa domanda: il corpo copre idee, installazione (H3 acqua calda, scarico, base, inverno) e la tabella «a muro, a colonna o pannello»; nelle FAQ della pagina le domande su questi temi si sostituiscono con domande vere che il corpo non tratta (candidate in `tmp/pagina-uso/faq-candidate.md`), scritte da Cowork e rilette da Marco |

**4/11/2026, provini della c1b**

| | Decisione |
|---|---|
| P1 | Colonna centrata a 1440, sull'asse di card e FAQ, in tutte le lingue |
| P2 | Coppie di verticali affiancate anche a 390; la tabella a 390 scorre nel suo riquadro |
| P3 | Card: ogni collezione con almeno una colonna doccia a terra (tutte le collezioni sono da interno e da esterno), 17 al 4/11; prima Club, Club Large, Spring, Origo Rame, Community, poi l'ordine del catalogo. In&Out e Waterline restano linkate nel testo. Cover di collezione invariate |
| P4 | `og:image`: la riserva del sito con l'alt nella lingua; un'immagine 1200×630 fatta apposta, come `seo.ogImage`, dopo il merge |
| P5 | Tutte le foto pigre, l'LCP è un testo dell'apertura (misurato: il paragrafo d'introduzione, § 5); un'orizzontale all'aperto di Alma andrà in apertura con priorità |
