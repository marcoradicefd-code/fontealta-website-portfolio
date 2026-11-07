# CANTIERE INCASSI — design vivo

> ⚠️ **CHIUSO il 29 luglio 2026** con le PR 1→4 del cantiere INCASSI, collection
> pubblicata, strip a 22. Il titolo dice «design vivo» perche' cosi' e' nato: da qui in
> avanti e' un **verbale**, si legge al passato e non si corregge. Quel che descrive era
> vero alla sua data. ⚠️ In particolare, il `BackButton` citato al §7 **non esiste piu'**:
> rimosso con PR #146 (set 2026), quando la risalita e' diventata il breadcrumb. La
> decisione descritta li' regge, il componente no.

I 17 corpi a incasso passano da record tecnico senza pagina a oggetti con scheda propria
dentro `/collezioni`. Questo documento è la fonte per lo schema, le rotte, la scheda e la
sequenza; il precedente di formato è `front2-design.md`.

**Stato al 29/07/2026: CANTIERE CHIUSO.** PR 1 (schema), PR 2 (arricchimento), PR 3
(frontend) e PR 4 (link + guide) tutte fatte; il documento `collection` è pubblicato e
l'indice `/collezioni/corpi-a-incasso` è live, verificato con 33 asserzioni verdi
(17 card, filtri 7/12/5, somma 24).

⚠️ **Una lezione dal Publish**, valida oltre questo cantiere: il primo build dopo la
pubblicazione ha continuato a rendere **404**, perché la query dell'indice non era
cambiata dai build precedenti e la fetch-cache di Next ha riservito il `collection: null`
di quando era bozza. Si è risolto solo svuotando `.next/cache`. Il modo in cui fallisce
è indistinguibile da «non ancora pubblicata»: un 404 pulito, nessun errore. È il motivo
per cui il **redeploy senza build cache** va fatto, non solo previsto (§8 punto 2 dava
il caso per quasi-improbabile: per la query dell'indice era falso, perché quella query
nasce in PR 3 ed era già stata eseguita a bozza).

---

## 1 · Punto di partenza, verificato in produzione

| | |
|---|---|
| documenti `concealedBody` | **17**, creati il 20/07, **0 draft** |
| campi che avevano | `code`, `name`, `description` — nient'altro |
| modelli con `requiredConcealedBody` | **92** |
| refusi vivi nelle descrizioni | **4**: `Freetanding` su CW.1/CW.2 (it), `copuling` su W3MP.INC/W4MP.INC (en) |

**Dato sorgente:** `scripts/data/incassi-data-2026-07-28.json` (contenuto v3), immutabile
come gli altri one-shot. 17 righe, id `concealedBody-<slug>` conformi 17/17, somma
`used_by_articles` = 92 = le reference vive.

⚠️ **`article_mapping` dentro quel file è provenienza grezza dall'Excel, NON dato
autoritativo:** 100 righe contro 92, con lo scarto tutto su `MR.INC` (11 contro le 3
reference reali) e 2 articoli duplicati. Fanno fede `used_by_articles` e, più di tutto, le
reference in produzione. Il frontend deriva «Usato da» dalle reference vive, non da qui.

**Fuori scope, a verbale:** `includesConcealedBody` è dato morto — i 92 sono un
sottoinsieme dei 276, la dicitura «incluso» è stata rimossa in PR #56, e il campo è
proiettato in 3 query e letto da **zero** componenti. Candidato a un mini contract-cleanup
futuro, non tocca questo cantiere.

---

## 2 · Dove vivono — decisione del cliente

Andrea ha scelto: **dentro `/collezioni`**, come collezione vera fra le altre. Si crea un
documento `collection` «Corpi a incasso» (slug `corpi-a-incasso`), che compare nella
griglia, nel footer e nel contatore della strip home tramite la tubatura esistente. La
strip passerà da 21 a **22**: è voluto.

**Il principio che tiene tutto insieme:** l'**indice** della collezione è **identico** alle
altre pagine collezione — stesso template, stesso hero, stessa `FilterBar`, stessa
griglia, stesse card. Unica differenza sulla card: niente pallini finiture, perché per un
corpo non esistono. **La diversità di design vive esclusivamente nella scheda del singolo
corpo**, dove l'oggetto *è* il corpo e non un articolo che lo richiede.

---

## 3 · L'asimmetria da conoscere: l'indice interroga il TIPO

Le altre collezioni elencano i propri articoli con `*[_type=="model" && references(^._id)]`.
**L'indice dei corpi no:** interroga `*[_type=="concealedBody"]`, e la collection non ha
reference in ingresso.

**Perché:**

- **un corpo nuovo compare da solo**, senza che qualcuno ricordi di aggiungere una
  reference alla collection;
- **il one-shot di PR 2 è indipendente dall'`_id` del documento collection**, che Marco
  crea a mano in Studio e che avrà un UUID, non il deterministico `collection-*-it` dei
  documenti da seed. Legare i 17 corpi a quell'UUID significherebbe leggerlo, passarlo
  allo script e sperare che nessuno ricrei il documento.

**Il prezzo:** la card in griglia deriva conteggio ed etichette dai *model* della
collection, che qui sono **zero**. La card «Corpi a incasso» mostra quindi il solo
titolo, senza etichette e senza sottotitolo.

### ⛔ CHIUSO — il sottotitolo sulla card NON si fa

Questo documento prescriveva «un bivio nella card, sottotitolo dal `count()` dinamico
dei `concealedBody`». **Decisione di Marco del 29/07/2026: non si fa, né ora né in
futuro.** Non è rinviato, non è un debito, non è «quando avremo tempo»: è omesso
deliberatamente.

**Il perché, così nessuno lo ripropone fra sei mesi:** il conteggio dei corpi **c'è
già**, ed è dinamico — è la stat «Corpi» nell'hero di `/collezioni/corpi-a-incasso`,
alimentata da `bodies.length`. Ripeterlo sulla card della griglia significherebbe due
punti da tenere allineati per dire lo stesso numero, e la card è quello che si vede per
primo e si aggiorna per ultimo. Una fonte sola, nel posto dove il numero serve davvero.

La banda della card resta quindi più vuota delle altre. **È l'aspetto voluto**, non un
lavoro lasciato a metà.

---

## 4 · Schema (PR 1)

Cinque campi aggiunti a `concealedBody`:

| campo | tipo | note |
|---|---|---|
| `slug` | `slug`, source `code` | URL della scheda |
| `servesMacros` | `array<string>` su `PRODUCT_MACROS` | `min(1)`. **Niente `MACRO_SUBTYPES`**: un corpo non è un `model`, non ha sottotipo |
| `waterSupply` | `string` su `WATER_SUPPLY` | lista **condivisa** con `model` |
| `image` | `imageWithMeta` | vuoto → placeholder monogramma |
| `order` | `number` | ordine del riepilogo pag. 214 |

**`WATER_SUPPLY` estratto, non duplicato.** Era una const locale in `model.ts`; ora vive in
`sanity/schemas/documents/water-supply.ts` e i due schemi la importano. Due copie della
stessa lista divergono al primo ritocco, e la divergenza si manifesta come un valore che
uno schema accetta e l'altro rifiuta — invisibile finché qualcuno non salva. È la stessa
ragione del LOCK di `model-taxonomy.ts`.

**Typegen:** `ConcealedBody` guadagna i 5 campi, **`types.gen.ts` cresce di +5 righe e
basta** — zero impatto sui 595 model, e l'estrazione di `WATER_SUPPLY` non produce alcuna
variazione di tipo (stessi valori).

⚠️ **`servesMacros` resta `Array<string>` nei tipi**, non una union: typegen non restringe
gli array con `options.list` (stesso comportamento di `tags` e `alimentationTypes` su
`model`). L'enum vale **in Studio**, non nel compilatore — quindi le guardie dello script
one-shot devono validare i valori a runtime contro `PRODUCT_MACROS`, non fidarsi dei tipi.

**Commento corretto:** la descrizione di `code` diceva «never shown as a photo on the
site», che le immagini generate rendono falso.

---

## 5 · Rotte e cache

`/collezioni/corpi-a-incasso` (indice) · `/collezioni/corpi-a-incasso/[slug]` (scheda).

**Via scelta: cartella statica**, non un bivio nel template condiviso. Next dà priorità al
segmento statico sul dinamico fratello, quindi `collezioni/[slug]` non viene mai raggiunto
per questo percorso e il template delle collezioni resta senza condizionali.

⚠️ **Da verificare in PR 3, non dare per scontato:** entrambi i percorsi vanno dichiarati
in `routing.ts` (`localePrefix: "as-needed"` + mappa `pathnames`, dove ciò che non è
mappato dà 404), e va confermato che la voce letterale prevalga su `/collezioni/[slug]` in
entrambe le lingue. È il punto dove questa rotta può rompersi in silenzio.

**Tag cache: `["concealedBody", "model"]` su entrambe.** Il `model` non è zelo: la sezione
«Usato da» dipende dai modelli, quindi un publish di modello deve invalidare la scheda —
stesso pattern di `getCollection`. Sbagliarlo produce una lista stantia che nessuno nota.

---

## 6 · Filtri sull'indice

`FilterBar` identica alle altre, **solo gruppo Ambiente**: 3 pill `Lavabo · Doccia · Vasca`
(le sole macro usate). Niente gruppo Finitura, niente pill a zero risultati.

⚠️ **Semantica ARRAY, non uguaglianza:** il match è `servesMacros.includes(macro)`. Un corpo
multi-ambiente compare sotto **ogni** ambiente servito. Il predicato delle collezioni
esistenti è `activeTypes.has(resolveMacro(m))`, cioè valore singolo: va verificato se
`FilterBar` regge l'array o serve l'estensione minima.

**Conteggi attesi, dal dato:** **Lavabo 7 · Doccia 12 · Vasca 5**, somma **24 > 17** per
multi-appartenenza. Vanno nel visual check **col commento**, così una regressione a
uguaglianza stretta (che darebbe somma 17) si urla da sola.

---

## 7 · Scheda corpo — il negativo del template modello

Riferimento di mercato: **iBox universal Hansgrohe** — scheda propria, zero finiture,
compatibilità come cuore della pagina, narrativa «installa il corpo ora, scegli l'esterno
dopo».

**VIA** (ci sono nel template modello, qui no):

- selettore, pallini e conteggio finiture
- riga «Corpo incasso» — un corpo non richiede sé stesso
- riga Tipologia `macro — sottotipo`, sostituita dai **badge ambito** da `servesMacros`
  con le label `productCategories` esistenti («Lavabo · Doccia»)
- «Personalizzabile»

**SOLO QUI:**

- sezione **«Usato da»**: GROQ inversa `*[_type=="model" && references(^._id)]` con
  **`order(code asc)` esplicito** — il reverse lookup non preserva ordine — e card-link ai
  modelli. **CW.1 e CW.2 hanno zero reference: sezione NASCOSTA, non vuota.**
- ~~intro editoriale breve (i18n it/en) in tono Fontealta~~ → **RIMOSSA su verdetto
  estetico di Marco, 29/07/2026**, insieme all'intro dell'indice e alla didascalia di
  «Usato da»: l'indice torna pienamente identico alle altre collezioni, e la sezione
  «Usato da» resta titolo + griglia. Chiavi i18n `introTitle`, `intro` e `usedByIntro`
  cancellate in entrambe le lingue, più `backToIndex` che era orfana dalla nascita (la
  risalita usa il `BackButton` condiviso con la sua `nav.back`). Il namespace
  `corpiIncasso` resta di sole 7 chiavi, tutte con esattamente un consumatore.
  **Resta** la `description` del corpo nell'hero: è dato di catalogo, non copy nostro.

**INVARIATI, da riusare:** hero codice + eyebrow, `WaterSupplyDrops` con label, griglia
specifiche, componenti card.

⚠️ **`name` non si renderizza.** Sui 17 documenti è un **doppione del `code`**
(`"CW.1"`/`"CW.1"` in it e en). L'H1 della scheda è il **codice**; `name` resta come slot
per un eventuale nome parlante futuro e come titolo nello Studio. Chi lo trova popolato e
non a schermo non stia cercando un bug.

**Mai prezzi**, coerente con tutto il catalogo. **Mai finiture**: i corpi non ne hanno.

---

## 8 · PR 2 — arricchimento dei 17, e la trappola del Portable Text

Lo script valorizza i 5 campi nuovi dal JSON e corregge i **4 refusi vivi**.

⚠️ **Il fix dei refusi NON è un `set` di stringa.** `description` è
`localizedPortableText` vero: un array di block, ciascuno con `children` di span, ognuno
con la propria `_key`. Un `set` alla cieca sull'oggetto rigenererebbe le chiavi e
riscriverebbe la struttura.

**Patch chirurgica** sul solo testo, con path **filtrati per `_key`** —
`description.{lang}[_key=="…"].children[_key=="…"].text` — così le chiavi non si toccano
per costruzione. **Non per indice `[0]`**: la doc Sanity dice esplicitamente «avoid array
indices», perché la posizione è instabile appena qualcuno riordina.

### `diffMatchPatch` valutato e scartato, col perché

L'operazione dedicata al testo esiste e sarebbe la più chirurgica in astratto. Non si usa
qui, per tre ragioni verificate sulla doc ufficiale:

- **Sull'API HTTP vuole una stringa di patch unidiff**
  (`"@@ -1,13 +1,12 @@\n The \n-rabid\n+nice\n  dog\n"`), **non il testo nuovo**. Il
  `diffMatchPatch(value: string)` che accetta una stringa piana è l'helper di **Studio**,
  per gli input component. Generare l'unidiff richiederebbe la libreria
  `diff-match-patch` → **una dipendenza nuova per un one-shot**, contro la postura del
  progetto.
- **I suoi due vantaggi dichiarati non si applicano.** La doc li elenca: «modificare
  stringhe enormi con patch piccole» — qui sono ~90 caratteri — e «comporre bene quando
  più utenti o script modificano lo stesso testo» — qui è una finestra controllata, con la
  guardia I8 sulla struttura e la lettura del testo esatto immediatamente prima di
  scrivere.
- **La tolleranza alla concorrenza è un rischio, non un pregio, in questo contesto.**
  «Generally giving sane results» significa applicazione fuzzy: se qualcuno avesse
  modificato in parallelo, preferisco che l'operazione fallisca sulla verifica invece che
  fondersi in un testo che non ha scritto nessuno.

La doc di Studio, per parte sua, dice «it's preferable to avoid creating diff match
patches» fuori dagli input component.

⚠️ **Rischio residuo del `set` per `_key`:** la sintassi del path si esercita solo con
`--execute` (un `set` su path che non matcha è un no-op silenzioso, non un errore). Lo
copre la verifica post-scrittura, che riasserisce il testo **e** la sopravvivenza delle
`_key`: se il path fosse sbagliato, abortisce con report e il backup è già su disco.

**Guardia strutturale prima di scrivere:** se un documento non ha **esattamente 1 block e
1 span** per lingua → **ABORT** con report. Verificato che oggi la condizione vale
**17/17 × 2 lingue**, quindi la guardia non scatterà mai su dati integri: è un tripwire
anti-modifica-concorrente nello spirito di `U3b` del cantiere PR-B, non un controllo di
routine.

**Rito completo:** dry-run di default · `--execute` col write token · guardie (17 doc · 0
draft · codici 1:1 col JSON, zero orfani per lato · macro validate a runtime contro
`PRODUCT_MACROS`, perché i tipi non le restringono · lo schema nel checkout dichiara già i
campi) · **backup dei 17 documenti prima di scrivere** · transazione unica
`visibility:"sync"` · verifica su GROQ fresche · tripla rete · commit post-esecuzione +
`.prettierignore`.

### ⚠️ Redeploy senza build cache — la verità a tre strati

La formulazione «qui è necessario, a differenza di PR-B» era **troppo netta**. Il quadro
reale, registrato dopo l'esecuzione (decisione Marco/Cowork, 28/07):

1. **Oggi l'effetto visibile è ZERO.** La scrittura è avvenuta, ma **nessuna pagina
   proietta** `slug`, `servesMacros`, `waterSupply` né la `description` dei corpi: i
   `concealedBody` non hanno ancora pagine, e le query dei modelli proiettano di quel tipo
   il solo `code` (`requiredConcealedBody->{ code }`). Anche le 4 descrizioni corrette non
   sono renderizzate da nessuna parte. Un redeploy immediato non cambierebbe un pixel.
2. **Quando arriverà PR 3, le sue query saranno nuove o a proiezione cambiata**, cioè con
   una **chiave di fetch-cache diversa**: dati freschi per costruzione. Il caso classico
   che la regola del redeploy serve a evitare — query invariata che continua a servire dati
   vecchi — qui **quasi non si presenta**.
3. **Il redeploy senza cache si fa COMUNQUE ORA**, per due ragioni che non riguardano il
   rendering: elimina la dipendenza dalla memoria futura, e copre quel «quasi» del punto 2
   (una query riusata tale e quale in PR 3 ricadrebbe nel caso classico). **Un redeploy
   superfluo oggi batte uno dimenticato nella finestra di PR 3.**

Nota di lettura: il corpo del commit `2470631` porta ancora la formulazione netta
«necessario e non assicurazione». Vale questa, che è più precisa; il commit non si
riscrive perché è già approvato.

---

## 9 · Il documento collection lo crea Marco — mini-guida

Regola dei tre attrezzi: un documento solo, a mano, in Studio. **Niente gemello EN** — le
21 collection esistenti sono tutte `language: 'it'`, zero gemelli.

### ⚠️ Tempistica: il Publish va COORDINATO col merge di PR 3, non fatto prima

Il documento si può **creare** quando si vuole, ma **pubblicarlo prima di PR 3 rompe una
pagina pubblica**. Due ragioni distinte, stessa regola:

1. **Card verso il vuoto.** La card comparirebbe subito nella griglia di `/collezioni` —
   quella query non filtra nulla — e il link porterebbe al template generico
   `collezioni/[slug]`, che elenca i *model* della collection. Zero model, quindi **una
   pagina collezione vuota, visibile a chiunque**, finché la cartella statica
   `corpi-a-incasso/` non esiste.
2. **Thin content / soft-404 per i motori.** Una pagina categoria senza contenuto è
   esattamente il pattern che i crawler classificano come soft-404: indicizzata mentre è
   vuota, si porta dietro il giudizio anche dopo che il contenuto arriva. E la produzione
   è indicizzabile (`NEXT_PUBLIC_SITE_URL = https://fontealta.it` → M20), quindi non c'è
   il paracadute del `noindex` delle preview.

Sequenza corretta: **merge di PR 3 e Publish nella stessa finestra**. Solo allora il
segmento statico intercetta il percorso e la card punta all'indice vero. La strip passa a
22 nello stesso momento, via webhook.

Il corollario è che PR 1 e PR 2 possono girare **senza** che il documento esista: lo
schema non lo richiede, e il one-shot lavora sui 17 `concealedBody` senza mai nominare la
collection (§3).

| campo | valore | perché |
|---|---|---|
| **Title** | `Corpi a incasso` | |
| **Slug** | `corpi-a-incasso` | verificato **libero**, nessuna collisione |
| **Code** | `corpi-incasso` | identificatore stabile, stile `boss` / `ille` |
| **Order** | **220** | verificato: il massimo attuale è Accessories **210**, poi Yacht 200. 220 la mette in coda col passo di 10 già in uso |
| **Featured** | `false` | come tutte le altre 21 |
| **Cover image** | placeholder, poi Magnific | la sezione non aspetta le immagini |
| **isOutdoor** | `false` | ⚠️ vedi sotto |
| **isCustomizable** | `false` | ⚠️ vedi sotto |

⚠️ **`language` NON è impostabile a mano:** sullo schema è `readOnly: true, hidden: true` e
lo scrive il plugin `documentInternationalization` (che copre `collection`) dal selettore
lingua nell'header del documento. **Dopo il salvataggio va verificato che valga `it`.** Se
restasse vuoto non romperebbe griglia, footer né contatore — nessuna di quelle query
filtra per lingua — ma resterebbe disallineato dai 21 esistenti.

⚠️ **`isOutdoor` e `isCustomizable` su `collection` non pilotano nulla:** sono proiettati in
`COLLECTIONS_OVERVIEW_QUERY` e letti da **zero** componenti. L'unico `isCustomizable` vivo
è quello dei **model** (`model-specs.tsx`). I valori prescritti sopra sono quindi igiene
semantica, non comportamento: `false/false` è ciò che è vero per dei corpi da incasso, se
un giorno qualcuno decidesse di renderizzarli.

### Stato: bozza creata il 28/07, verificata

`drafts.collection-corpi-a-incasso-it` esiste ed è **conforme alla tabella sopra** —
`code: corpi-incasso`, slug `corpi-a-incasso`, `order: 220`, `language: "it"`, `featured`,
`isOutdoor` e `isCustomizable` a `false`. Non pubblicata, quindi invisibile al sito: la
regola di tempistica regge. Senza `coverImage`, `heroImage` né `tagline`, quindi l'hero
renderizzerà col poster di fallback.

**Il caveat sull'`_id` DECADE.** Era: «lo Studio genererà un UUID invece del deterministico
`collection-*-it`». Il documento è stato creato via MCP e ha l'**`_id` deterministico**
come quelli da seed. Nessuna anomalia da spiegare a nessuno; la nota resta qui solo perché
chi legge una versione precedente di questo file non vada a cercare un UUID che non c'è.

**Verifica in sviluppo:** la bozza è interrogabile con `perspective` **esplicita**
(`drafts`), token e `useCdn: false`. Va impostata a mano nello script di check: con le API
version recenti il default è `published` e la bozza risulterebbe assente. Il **codice di
produzione resta published-only** — la perspective drafts vive solo nel visual check.

---

## 10 · Sequenza

| # | PR | dipende da | contenuto |
|---|---|---|---|
| 5 | `feat(home)` strip | — | contatore Collezioni dinamico *(fatta)* |
| **1** | `feat(sanity)` schema | — | 5 campi, `water-supply.ts`, typegen, questo documento, il JSON |
| 2 | `chore(scripts)` one-shot | 1 mergiata **e deployata** | arricchimento + fix dei 4 refusi *(fatta)* |
| 3 | `feat(corpi)` frontend | 2 | rotta, loader, indice, filtri, scheda — **+ Publish del documento collection nella stessa finestra** (§9) *(fatta)* |
| 4 | `feat(nav)` link | 3 | riga `model-specs` → scheda corpo (serve lo slug in `MODEL_DETAIL_QUERY`), footer *(fatta)* |

### PR 4 — cantiere CHIUSO (29/07/2026)

**Riga «Corpo incasso» cliccabile.** `MODEL_DETAIL_QUERY` proietta
`requiredConcealedBody->{ code, "slug": slug.current }`; lo slug serve **solo lì**, le
altre due proiezioni dello stesso campo alimentano la sola pill di presenza. Testo,
posizione e aspetto a riposo invariati: cambia la sola cliccabilità.

**Underline che nasce dal centro** — primo del progetto: l'audit ha trovato solo
`hover:underline` statici, quindi questo è ora il riferimento. Pseudo-elemento a
larghezza piena, `origin-center` + `scale-x-0 → 100`, `--dur-micro` (200ms, la famiglia
degli hover di nav e footer) con `--ease-out-expo`, colore `currentColor`, offset 4px
come `underline-offset-4` già in uso. **`motion-safe:` su transizione e timing**: in
reduced-motion la linea compare comunque all'hover, ma di scatto — l'affordance resta,
il movimento no.

**Footer: NO-OP.** La voce «Corpi a incasso» era già in produzione dal Publish del 28:
`FOOTER_COLLECTIONS_QUERY` interroga `*[_type == "collection"]` senza filtri, quindi è
arrivata gratis. Verificato sul sito live, 22 voci.

**Verifica:** 23 asserzioni DOM verdi (hover, reduced-motion, EN, touch, destinazione).
Byte-diff sul campione di 12 schede: i modelli **senza** corpo sono identici **sia nel
markup sia nei byte grezzi** (delta 0 — il brief prevedeva un flight RSC diverso ovunque,
ma su un riferimento nullo lo slug in più non serializza niente); quelli **con** corpo
differiscono in **una sola regione**, il `<dd>` della riga, con +418/419 byte di markup e
+1089/1103 di risposta.

⚠️ **Trappola trovata e registrata:** un **backtick** dentro un commento **dentro** una
query chiude il template literal. Typegen si ferma sul file intero, perde tutte le query
ed esce **0** stampando «Successfully generated types», riscrivendo `types.gen.ts`
svuotato (−1284 righe). Avviso in cima a `sanity/lib/queries.ts`.

### Cosa ha aggiunto PR 3, in breve

`ModelCard` estesa col **ramo corpo** (union a 4 membri, discriminante `"servesMacros" in
model` — la shape del dato, non una prop, così non può contraddirla); `CollectionHero`
con **prop `stats` opzionale** (senza, deriva come sempre: le 21 collezioni esistenti non
si muovono di un byte); `src/lib/concealed-body-filter.ts` col predicato ad appartenenza
d'array e 8 test sulla fixture dei 17 corpi reali; cartella statica
`collezioni/corpi-a-incasso/` con indice e scheda. `CollectionHero` è stata **spostata in
`src/components/heros/`** perché ora ha due consumatori — stesso motivo per cui `FilterBar`
si era spostata (M16): un import cross-route da una cartella `_components` è un legame che
si rompe al primo spostamento di pagina.

**Verifica:** 27 asserzioni DOM sul build di produzione + 18 sul dato vivo, tutte verdi;
i 3 contesti modello di `ModelCard` **identici byte a byte** col metodo di PR-B (zero
normalizzazioni applicate, quindi confronto su byte grezzi).

**Perché 1 prima di 2:** lo script scrive via `@sanity/client` **bypassando la validazione
dello Studio**. Se girasse prima, i 17 documenti avrebbero campi che lo schema non dichiara
e Andrea vedrebbe «unknown fields» — lo specchio esatto del banner di PR-B.

---

## 11 · i18n

Nuovo namespace `corpiIncasso` (it/en) + voce `nav` per il footer. `desc_fr/es/de` restano
nel JSON per la fase i18n di fine progetto, **congelata**: non entrano in Sanity ora perché
`description` è `localizedPortableText` a due lingue e accoglierne altre è una modifica di
schema — stesso vincolo già noto per `finish.name`.

---

## 12 · Domande aperte con Andrea

1. **Schede proprie**: confermate?
2. **`W3MP.INC`**: l'Excel dice `VASCA/DOCCIA`, il riepilogo pag. 214 dice solo Vasca.
   Default adottato **`['vasca','doccia']`** (l'Excel è più ricco), da confermare.
3. `CW.1` a 240,00 vs 252,00 nei due listini — irrilevante per il sito (niente prezzi), ma
   va chiuso a monte.
