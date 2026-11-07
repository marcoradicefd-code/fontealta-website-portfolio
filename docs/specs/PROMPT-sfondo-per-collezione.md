# Prompt per Claude Code — lo sfondo giusto sulle card dei 12 multi-collezione

> **STATO al 31 agosto 2026 — CHIUSO.** Il lavoro è stato fatto in due tempi,
> come previsto qui sotto.
>
> | tempo | PR | esito |
> |---|---|---|
> | 1 · bonifica dei 23 alt di galleria | #139 | em dash 23 → 0; nessuna delle due passate precedenti li leggeva |
> | 2 · sfondo di collezione sulle card | #142 | `src/lib/card-image.ts`, 10 test; 6 hash su 6 verificati in produzione |
>
> Il conteggio giusto è **23**, non 34 — la correzione era già dentro il corpo
> (vedi CORREZIONE poco sotto) e resta lì: questo è un documento datato.


> Lancia `claude` dentro `fontealta-website` e digli: `segui docs/specs/PROMPT-sfondo-per-collezione.md`

---

## Il fatto, verificato in produzione il 28 agosto

12 modelli stanno in più collezioni, e per ognuno esiste su Sanity **una
composizione per collezione con lo sfondo di quella collezione**: la prima
collezione è la `primaryImage`, le altre stanno nella galleria `images` (34
immagini in tutto, verificate una per una). Ma la card mostra sempre e solo la
`primaryImage`, quindi **22 posizioni hanno lo sfondo di un'altra collezione**:
su /collezioni/classy WX30.SK esce con lo sfondo Skinny, su /collezioni/boss-wide
WX44.SK con lo sfondo Boss, su /collezioni/club-large WX54.SK con lo sfondo Club.

Verificato con gli hash degli asset contro l'HTML servito: le tre pagine di prova
servono tutte la primary. `COLLECTION_DETAIL_QUERY` proietta solo `primaryImage`.

I 12 codici: WX75.SK (5 collezioni), MR (5), WMRL (5), WX83.SK (4),
WX30.SK / WX32.SK (Skinny+Classy), WX44.SK / WX47C.SK / WX4A6.SK (Boss+Boss Wide),
WX54.SK / WX57C.SK / WX5A6.SK (Club+Club Large).

> **CORREZIONE (verifica sul dato vivo, 28 ago).** Tre fatti di questo prompt
> erano sbagliati, verificati via GROQ: **(a)** le immagini di galleria sono
> **23, non 34** (34 sommava le primary), e le posizioni con lo sfondo sbagliato
> sono **23, non 22** — una per immagine di galleria, per costruzione;
> **(b)** i 23 alt di galleria hanno ancora l'**em dash** — la bonifica ha
> toccato `primaryImage.alt` e `image.alt`, non `images[].alt` — quindi **prima
> si bonificano i 23** (one-shot via `images[_key=="…"].alt`, em dash → virgola,
> stessa classe della bonifica precedente) e **poi** il matcher usa
> **`", collezione "`**, non il trattino: costruire codice su un difetto di dati
> vietato dalla regola tipografica del progetto è la cosa da non fare;
> **(c)** il title di ILLE è maiuscolo e la coda dell'alt dice «Ille»: il
> confronto va fatto **case-insensitive**. (Oggi ILLE sta solo in primary, mai
> in galleria, quindi il fallback avrebbe comunque mostrato l'immagine giusta —
> ma la difesa è corretta a prescindere.)
> Le sezioni sotto vanno lette con queste tre sostituzioni.

## La chiave di abbinamento: l'alt, con due trappole note

Ogni immagine di galleria porta la sua collezione **in coda all'alt**:
`«… — collezione Boss Wide»`. È il dato di abbinamento, scritto apposta dal
caricatore. Ma:

1. **⛔ NIENTE `match` di GROQ.** `match` ragiona per parole: sulla pagina Boss il
   pattern «collezione Boss» combacia anche con «collezione Boss Wide» — e la card
   di Boss prenderebbe lo sfondo Boss Wide. Idem Club / Club Large. Il confronto
   deve essere **esatto sulla coda della stringa**, in TypeScript:
   `alt.endsWith("— collezione " + collectionTitle)`. L'endsWith esatto distingue
   le coppie: «…collezione Boss Wide» NON termina con «collezione Boss».
2. **La primary usa la virgola, la galleria il trattino** («, collezione Flamingo»
   vs «— collezione Skinny»). Quindi: si cerca **solo nella galleria**, e se
   nessuna voce combacia si usa la `primaryImage`. Mai confrontare l'alt della
   primary col matcher.

C'è una terza differenza di grafia da verificare: la primary di WX75.SK dice
«collezione Ille» mentre il documento collection ha `title` «ILLE». Non tocca il
matcher (la primary è il fallback, non si matcha), ma **controlla che i `title`
delle collezioni in galleria combacino con gli alt per tutti e 12** prima di
fidarti — un `console.warn` in dev sul mancato match è benvenuto, un fallimento
silenzioso no: il fallback alla primary è comunque un'immagine giusta del
prodotto, solo con l'altro sfondo.

## L'intervento

1. **Query** (`sanity/lib/queries.ts`, `COLLECTION_DETAIL_QUERY.models`):
   proietta anche la galleria, ma **solo quando serve** — i 569 mono-collezione
   non devono pagare peso per niente:

   ```groq
   "gallery": select(
     count(collections) > 1 => images[]{ ..., "metadata": asset->metadata },
     null
   ),
   ```

   (verifica la sintassi `select` sul conteggio; se non regge, proietta
   `images[]` e basta — è vuota per i mono-collezione, il costo è zero comunque.)

2. **Scelta dell'immagine** — una funzione pura, testabile, in `src/lib/`
   (es. `card-image.ts`): dati `gallery`, `primaryImage` e `collectionTitle`,
   torna la voce di galleria il cui alt termina con `"— collezione " + title`,
   altrimenti la primary. **Test unitari** con i casi veri: Boss vs Boss Wide,
   Club vs Club Large, il modello mono-collezione senza galleria, il titolo che
   non matcha nulla.

3. **Card** (`model-card.tsx`): usa la funzione al posto dell'accesso diretto a
   `primaryImage`. `collectionTitle` è già proiettato (`^.title`, riga ~342).
   Attenzione alla union: la funzione entra nel solo ramo collection-detail;
   correlati e usedBy restano sulla primary (lì non c'è una collezione di pagina
   univoca, e va bene così).

4. **`pnpm typegen`** dopo la query, poi il five-check.

## Cosa NON fare

- Niente `match` GROQ sull'alt (trappola Boss/Boss Wide, sopra).
- Su Sanity si tocca SOLO la bonifica dei 23 alt di galleria (em dash → virgola,
  vedi CORREZIONE in cima): one-shot, con conteggio prima e dopo (23 → 0 em
  dash in `images[].alt`). Nessun'altra scrittura. Ogni altro alt sbagliato si
  riporta e si corregge alla fonte, non con un caso speciale nel sito.
- Non toccare la scheda modello (`/modello/[slug]`): lì la primary è la scelta
  giusta, la pagina non appartiene a una collezione.
- Il wrapper `SanityImage`, la LQIP e il loader restano come sono: qui cambia
  solo QUALE immagine si passa, non come la si serve.

## Verifica in produzione (dopo il deploy)

La prova che vale è **sugli hash degli asset**, non a occhio. Per ciascuna delle
tre coppie campione, scarica l'HTML e verifica quale hash compare:

| pagina | card | hash atteso |
|---|---|---|
| /collezioni/classy | WX30.SK | `80d1b99421` (galleria Classy) — NON `45cbca0307` (primary Skinny) |
| /collezioni/boss-wide | WX44.SK | `cf8ec9c68d` — NON `7cb37fbbbf` |
| /collezioni/club-large | WX54.SK | `718a2378ba` — NON `c8087c6f40` |

E le controprove nell'altra direzione, che sono il test delle trappole:

- su **/collezioni/boss**, WX44.SK deve mostrare la **primary** (`7cb37fbbbf`):
  se mostra `cf8ec9c68d` il matcher è caduto nella trappola Boss/Boss Wide;
- su **/collezioni/club**, WX54.SK deve mostrare `c8087c6f40`;
- su **/collezioni/skinny**, WX30.SK deve mostrare `45cbca0307`;
- una pagina mono-collezione qualsiasi (es. /collezioni/ille) deve essere
  **byte-identica** a prima sul blocco card, a parte eventuali ordini di attributi.

Chiudi aggiornando lo STATO in `docs/specs/PROMPT-immagini-a-scatti.md`: la voce
«galleria dei multi-collezione» va riformulata — le card ora scelgono per
collezione; resta aperto solo l'eventuale carosello sulla scheda modello.
