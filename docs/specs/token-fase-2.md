# Token, Fase 2: le scelte di Marco

> Spec del 23 ottobre 2026. Decisioni di Marco sull'inventario dei token e sui prototipi dello stesso
> giorno. È un verbale datato: i conteggi sono quelli misurati il 23/10 su `main` a `19fbdcd`, e ogni
> PR li rimisura prima di toccare il codice.

## Da dove viene

- **Fase 1** (#282, 21/10): primitivi, ruoli e nomi, a zero pixel. Voce `docs/history/2026-10-21-token-fase1.md`.
- **Inventario** del 23/10, in sola lettura: ogni valore di `src/`, risolto e raggruppato per ruolo.
  Strumenti e tabelle in `tmp/inventario-token-2026-10-23/` (fuori da git).
- **Prototipi** guardati da Marco: `tmp/token-fase-2/prototipo/` (prima e dopo per categoria) e
  `tmp/token-fase-2/ombra/` (l'ombra delle card, il bordo della card collezione).
- **Il testo delle scelte**: `tmp/prompts/2026-10-23-token-fase2-scelte.md`.

## Come si misura la vicinanza

- **Colori**: ΔE CIEDE2000 sul colore risultante, sul fondo su cui il colore sta davvero. Per un
  trasparente si prende il fondo peggiore. Sotto 1 si unifica; fra 1 e 2 serve il provino; sopra 2
  decide Marco. Si fondono solo valori con lo stesso ruolo (testo, fondo, velo, bordo, scrim, ombra).
- **Opacità**: lo stesso ΔE, misurato sul testo che l'elemento contiene.
- **Ombre**: stessa geometria entro 1 px, e il colore steso al pieno sotto ΔE 1.
- **Raggi**: lo spostamento dell'arco a 45°, cioè 0,29 × Δr.
- **Durate**: la differenza relativa, sotto il 5% indistinguibili, fino al 15% con provino.
- **Curve**: lo scarto massimo di avanzamento, sotto 0,02.
- **Spaziature**: sotto mezzo pixel indistinguibili; fino a 2 px e al 10% con provino.
- **Interlinea**: 0,3 px per riga.
- **Spaziatura delle lettere**: 0,1 px.

## Le scelte

| categoria | versione | PR |
|---|---|---|
| opacità, spessori, curve, taglie, spaziatura delle lettere | (a) solo indistinguibili | PR 1, tutte insieme |
| colori | (b) fino alla soglia | PR 2, da sola |
| raggi, spaziature, durate, interlinea, ombre | (b) fino alla soglia | PR 3, tutte insieme |
| scala minima (c) | nessuna | — |

Le PR «b» sono due (decisione di Marco, 23/10/2026, dopo la PR 1): **i colori da soli**, poi **una PR
sola per raggi, spaziature, durate, interlinea e ombre**, con un provino unico diviso per categoria.
Prima l'ordine era una PR per categoria: colori, raggi, spaziature, durate, interlinea, ombre.

## PR 1: le «a», a zero pixel

- **Opacità: un nome a tutti e sette i gradini.** Oggi sono numeri scritti nelle classi e nel CSS.

  | valore | ruolo | usi |
  |---|---|---|
  | 0,4 | controllo disabilitato | 2 |
  | 0,5 | bandiera della lingua spenta | 2 |
  | 0,55 | immagine in filigrana (schede modello e corpo, card modello) | 3 |
  | 0,6 | attenuato (linea del bottone di invio, conteggio del foglio dei filtri) | 2 |
  | 0,7 | link in hover | 10 |
  | 0,85 | immagine e voce attenuate (monogramma, collezioni usate, briciole) | 4 |
  | 0,9 | immagine della card collezione | 2 |

  Stanno in `:root`, con nomi in inglese come ogni identificatore nuovo. Tailwind non ha un namespace di
  tema per l'opacità.
- **Spessori.**
  - Il bordo `0.2rem` delle card (4 usi) passa a `--fa-stroke`. Il repo ha già misurato che quel bordo
    vale 3 px nel computed style e nei pixel, a DPR 1, 2 e 3 (commento di `--fa-stroke` in `globals.css`).
  - `--fa-field-border` (1 px) diventa un alias di `--fa-stroke-hairline`, lo stesso ruolo.
- **Curve.** `cubic-bezier(0.33, 1, 0.68, 1)` di `fase-card.tsx` prende un nome, `--ease-out-cubic`. È la
  curva che GSAP chiama `power2.out` (scarto 0,003): lo dice il commento accanto al token, e il codice
  GSAP resta com'è (corretto all'audit del 23/10).
- **Taglie.** Le 14 taglie scritte a mano che valgono già un token lo usano, passando la sola taglia:
  - in `globals.css`: l'occhiello (13 px), il tag (10 px), il «+N» delle finiture (11 px);
  - in `CAMPI_CHIARI_CSS`: 10 e 11 px;
  - i titoli di `featured-collections`, `final-cta` e `catalogo-section` scrivono il clamp di
    `--text-heading-2`;
  - `reference-detail-hero` scrive il clamp di `--text-display-hero`;
  - negli `style` 22 px (`--text-card-title`), 2,25 rem due volte (`--text-heading-3`), 1,25 rem
    (`--text-sub-heading`) e 1,125 rem (`--text-body-lg`).

  **`--text-micro` si toglie**, con i suoi due compagni: zero usi. La guardia di lint ne vieterà il
  nome, come per i token tolti dalla Fase 1.
  **I mezzi pixel restano per ora** (11,5 · 12,5 · 13,5 · 14,5 · 16,5 · 16,8).
- **Spaziatura delle lettere.** Le 12 forme scritte a mano prendono il loro token (l'inventario ne
  contava 13: la tredicesima sta nelle pagine d'errore globali, che restano escluse; corretto all'audit):
  - 0,5 px sei volte → `--tracking-4`;
  - 0,3 px → `--tracking-2`;
  - 0,4 px due volte → `--tracking-3`;
  - 1,5 px tre volte → `--tracking-5`.

  Negli `style` diventano classi `tracking-N`.

**Come si scrivono**, deciso all'audit: con `@theme inline` una variabile esiste nel foglio solo se il
CSS di `globals.css` la richiama. Gli `style` usano quindi solo variabili già emesse, oppure una classe;
il CSS scritto in una costante (`CAMPI_CHIARI_CSS`) passa da token della famiglia `--fa-field-*` in
`:root`, come i campi del 14/10.

## Le PR «b»

### Colori, con le tre decisioni

- **Decisione 1: il fondo delle card chiare è il bianco puro** (rivista da Marco il 23/10 sul provino,
  variante E).
  - `--color-fa-surface` (`#faf8f5`) esce dai primitivi: il ruolo «fondo della card» richiama
    `--color-fa-paper` (`#ffffff`). Card sulla pagina: ΔE 3,00, contro lo 0,98 di prima.
  - Cambiano le 3 card che lo usano: la card modello, la card referenza e le collezioni usate di una
    referenza. Lo spazio dell'anello di fuoco di queste ultime due sta sulla pagina, quindi passa al
    crema (`ring-offset-fa-white`): col ruolo diventato bianco sarebbe un alone.
  - Precedente nel sistema: la pill dei filtri sul crema è bianca, perché il crema non stacca dal crema.
  - La prima scelta era la strada A, card nel crema della pagina e stacco dato solo dall'ombra. Sul
    provino Marco ha visto più contrasto nelle card di `main` e ha scelto il bianco. Scartate: card crema
    con l'ombra +50% (0,12 è l'alfa dell'hover, e alzarla si porta dietro `--shadow-product`) e card
    `#faf8f5` con l'ombra +10% (sotto ΔE 1, la soglia con cui la spec unifica).
- **L'ombra delle card, +10% di opacità**, nella stessa PR, decisa con la strada A e tenuta col bianco. `--shadow-card` passa da
  `0 4px 24px rgba(26, 26, 24, 0.08)` a `0 4px 24px rgba(26, 26, 24, 0.088)`.
  - Il build scrive l'alfa in esadecimale: oggi `#1a1a1814` (0,078), poi `#1a1a1816` (0,086).
  - Misurata a 4 px sotto la card modello, a 1440: da ΔE 1,88 a 2,10.
  - Vale per tutte e cinque le card che la usano. Sulle card scure non si vede.
  - Grandezze maggiori provate per le collezioni affini (`0 5px 28px`, `0 6px 32px`, `0 8px 36px`):
    a occhio non si distinguono, e si resta al +10%.
- **Il bordo bianco della card collezione resta ovunque**, anche sul crema delle collezioni affini, dove
  vale 1,1:1 (decisione del 23/10, per coerenza con l'ombra). Provate e scartate: senza bordo, bordo color
  card, bordo navy.
- **Decisione 2: testo su scuro, un crema solo, `#f6f4f0`.**
  - I 29 usi di `--fa-white-warm` (`#fcfaf5`) come testo passano a `--fa-text-on-dark`.
  - I `text-white` delle scritte sulle card collezione passano a `--fa-text-on-dark`: sono 5
    (`collection-card` e `featured-collection-card`). L'inventario ne contava 7: gli altri 2 sono
    le frecce del carosello, che sono controlli e restano in bianco puro (corretto il 23/10, PR 2).
  - I gradini trasparenti del crema: 80, 82 e 85% vanno all'82%; 90 e 92% al 90%.
  - **La regola dei due chiari, per intero** (Marco, 23/10, dopo la decisione 1 rivista):
    - testo su scuro = crema `#f6f4f0` (`--fa-text-on-dark`);
    - fondo delle pagine = crema `#f6f4f0` (`--fa-white`);
    - bianco puro `#ffffff` (`--fa-paper`) = controlli (traccia, anelli di focus, bottone inverso,
      pallini del carosello) e fondo delle card chiare (`--color-fa-surface`).
  - **I pallini del carosello passano al bianco puro** (decisione di Marco, 23/10): il pallino attivo e
    il suo anello di focus usano `--fa-white-warm`, ma sono controlli, quindi prendono `--fa-paper`
    (ΔE 2,68). Si vedono al provino di questa PR.
  - `--fa-white-warm` si toglie se non resta nessun uso.
- **Decisione 3: il velo dell'hero di collezione va sull'inchiostro del sito.** I sei gradini del
  gradiente in `collection-hero.tsx` passano dal nero di PVD Absolute Black, `rgb(10 10 9)`, a
  `--color-fa-ink`, con le stesse trasparenze.
- **Lo scrim di `contatti-hero.tsx`** passa da `rgb(9 14 17)` all'inchiostro del sito (ΔE 1,42 fra le
  basi), con le stesse trasparenze.
- **Il velo scuro al 40%**: il nero puro del fondo del riquadro delle lingue nel menu mobile e il nero
  della finitura sull'etichetta di `finish-card.tsx` (ΔE 1,32) diventano l'inchiostro al 40%.
- **Fuori**: il teal `#14a39a` della cover del catalogo e il suo `#fcfffe` (segnaposto, in attesa
  dell'asset M5), i colori delle finiture e delle bandiere, le leve misurate (`--fa-nav-scrim-a`,
  `--fa-nav-pill-a`, `--card-text-*`, i gradini `--fa-sc*`), i valori scritti della 404 globale e di
  `global-error.tsx`, che non caricano `globals.css`.

### Raggi

| oggi | dopo | dove |
|---|---|---|
| 14 px | **12 px, `--radius-lg`** (il valore principale del prototipo) | immagine della card del blog |
| 18 px | 16 px, `--radius-xl` | riquadro in evidenza del blog, articolo, scheda autore |
| 26 px | 24 px | riquadro delle lingue del menu mobile |
| `border-radius: 100px` scritto 5 volte, un `50%` | `--radius-pill`, `--radius-full` | CSS |
| il raggio `2xl` di Tailwind, 2 usi (16 px) | resta `2xl` | tendina delle lingue, cover del catalogo |

I 24 px delle card, scritti a mano 3 volte, prendono il token **`--radius-3xl`** (decisione di Marco,
23/10): nella scala di Tailwind `3xl` vale 24 px e `2xl` 16 px. Così i due usi di `2xl` restano a
16 px e non si sposta niente.

### Spaziature

| oggi | dopo | dove |
|---|---|---|
| 5,6 px (`0.35rem`) | 6 px | specifiche della scheda modello e corpo |
| 22 px | 24 | sotto l'occhiello dell'articolo |
| 26 px (`1.625rem`) | 24 | sotto il titolo dell'articolo |
| 38 px | 40 | card del blog su desktop, sopra estratto e data |
| 46 px (`2.875rem`) | 48 | sopra e sotto le citazioni dell'articolo |

Le 55 lunghezze scritte a mano che stanno già sulla griglia da 4 px passano a scala o token, con lo
stesso valore.

### Durate

| oggi | dopo | dove |
|---|---|---|
| 240 ms | 250, `--dur-sheet` | entrata della zona del testo di `/produzione` |
| 580 ms | 600, `--dur-reveal` | `fase-card` |
| 350 ms | 400, `--dur-standard` | bottone di invio (GSAP, 2 usi) |
| 450 ms | 400 | entrata del carosello |
| 900 ms | 800, `--dur-hero` | bottone di invio, il disegno |

I 45 usi scritti a mano che valgono già un token lo usano. Fuori: lo 0 del movimento ridotto, i
3500 ms dell'autoplay di Swiper e la durata calcolata di `fase-card`.

### Interlinea

| oggi | dopo | dove |
|---|---|---|
| 1,04 · 1,06 | 1,05 | titoli |
| 1,62 | 1,6 | scheda autore |
| 0,95 | 0,92 | display delle Referenze |
| 1,1 | 1,08 | titolo del blog |
| 1,25 | 1,2 | titoli e righe delle card collezione e della card del blog, didascalia AISI |
| 1,42 | 1,4 | corpo dell'articolo |
| 1,55 | 1,5 | `--text-body-sm` e i campi del modulo |
| 1,65 | 1,6 | `--text-body-lg` |

**I campi su fondo scuro si abbassano di 0,7 px** (decisione di Marco, 23/10): 1,55 → 1,5 è anche
l'interlinea dei campi, e `--fa-field-h-1` la usa nel calcolo dell'altezza (da 38,7 a 38 px). Il `select`
resta allineato all'input per costruzione. Si vedono al provino di questa PR.

### Ombre

- **Il pallino AISI**: l'anello interno nero all'8% passa a `--fa-border-light`; l'ombra
  `0 3px 10px` nera al 14% passa a `--shadow-card`.
- **L'ombra del testo sulle foto**, `0 1px 2px` inchiostro al 55% (4 usi in tre grafie), prende un nome.
  A zero pixel.
- **L'hover delle frecce del carosello**, un `box-shadow` interno bianco al 10%, usa il token del velo di
  hover su scuro, che ha lo stesso valore. ⚠️ Corretto il 23/10, PR delle altre «b»: quel token non
  esisteva. Il bianco al 10% era scritto 11 volte, 9 come `hover:bg-white/10` e 2 come `rgb()` in
  `globals.css`. La PR lo crea, `--fa-veil-hover-dark` in `:root` (approvato da Marco), e lo usano le
  frecce e le due regole CSS. Le 9 classi restano: col modificatore di opacità Tailwind scrive il colore
  in un altro formato.

### Com'è andata la PR delle altre «b» (23/10)

- **Provino approvato da Marco** (prima, dopo e dove, diviso per categoria, a 1440 e 390). La sonda,
  su 120 casi col rumore `main`-`main` a zero, vede solo i cambi delle tabelle qui sopra, più le altezze
  dei contenitori che si accorciano; nessuna proprietà fuori elenco.
- **Raggi**: `--radius-3xl: 24px` in `@theme`, letto dalle tre card con la foto e dal riquadro delle
  lingue. **Interlinea**: `--leading-tight` passa a 1,2 nel nostro `@theme`, al posto dell'1,25 di
  Tailwind; la scheda autore legge `--leading-lede`. **Ombre**: il pallino AISI usa le classi
  `shadow-card` e `inset-ring` col bordo chiaro (`--shadow-card` non è emesso in `:root`, quindi non si
  legge da uno `style`); l'ombra del testo sulle foto è `--fa-text-shadow-photo`.
- **A zero pixel, dopo l'approvazione**: le lunghezze sulla griglia da 4 px scritte negli `style` sono
  passate alle classi della scala, quelle del CSS a `calc(var(--spacing) * N)`; i `clamp()`, i `max()` e
  i valori fuori griglia restano. Le durate scritte nelle classi e nel CSS che valgono un token lo usano
  (30 usi). **Le durate di GSAP restano numeri in secondi**: GSAP non legge le variabili CSS, e una
  costante JS con gli stessi valori sarebbe una seconda fonte.
- **La guardia di lint** vieta i raggi 14, 18, 24 e 26 px scritti a mano e le durate col numero che
  hanno un token; tutte le regex della guardia sono in `String.raw`.
- **La guardia degli hero misura anche riga per riga** (vedi il criterio 3), con la controprova del
  difetto del 22/10. Il minimo di `/chi-siamo` a 1440 è ribasato da 10,4 a 10,1, approvato da Marco:
  l'interlinea di `--text-body-lg` accorcia il paragrafo sotto il titolo e l'H1 scende di 1,3 px sulla
  foto.

## Criteri di successo

### PR 1, le «a»: zero pixel

La prova è la stessa della Fase 1:

1. il diff del CSS servito, spiegato regola per regola;
2. il computed style di tutti gli elementi identico, con il rumore `main`-`main` a zero;
3. i pixel identici sui provini a DPR 2, con le transizioni spente e anche con
   `prefers-reduced-motion: reduce`;
4. gli asset serviti confrontati prima di leggere una differenza come codice.

Più five-check a zero ed e2e firmato (`pnpm e2e:firma`) verde. Una famiglia che non regge lo zero pixel
esce dalla PR, e va nella PR «b» della sua categoria.

### PR «b»: solo i cambi approvati

1. **Provini prima e dopo** sulle pagine vere, a 1440 e 390 e a DPR 2, guardati da Marco. **STOP prima
   dell'apply.**
2. **La sonda vede solo i cambi approvati**: ogni elemento con computed style o pixel diversi da `main`
   sta nell'elenco di quella PR. Una differenza fuori elenco ferma la PR.
3. **Contrasti mai sotto le soglie**, misurati sui glifi renderizzati a DPR 2 (p95, come dice la rule
   `misure-e-test`):
   - testo 4,5:1, e 3:1 dai 24 px (o dai 18,66 px in grassetto);
   - bordi dei componenti e anelli di focus 3:1;
   - sugli hero il pavimento già misurato dalle guardie, su tutte le rotte trasparenti.

   **Le soglie WCAG non si toccano mai.** Le soglie delle guardie misurate (per esempio i minimi di
   `hero-sopra-scrim.spec.ts`, che sono misure arrotondate e non soglie di accessibilità) si ribasano
   solo dopo un cambio approvato, quando la misura nuova ne è spiegata per intero, e con la
   **controprova del difetto** che la guardia custodisce: reintrodotto in locale e mai committato, la
   guardia deve tornare rossa. Il commento accanto alla soglia dice data, motivo e controprova (corretto
   il 23/10, PR dei colori: l'H1 di `/collezioni` dal bianco caldo al crema, minimi 5,0 → 4,7 e 7,6 → 7,2).

   **Il contrasto degli hero si misura anche riga per riga** (dalla PR delle altre «b», 23/10): il p95
   dell'H1 intero prende la riga più chiara, e una riga che resta fuori dallo scrim tiene alto il numero
   anche col difetto (su `/collezioni` a 390, 4,75 con e senza). Ogni riga ha il suo minimo; col difetto
   reintrodotto le prime righe scendono sotto (4,36 contro 6,0 sulla prima riga di `/collezioni` a 390,
   8,10 contro 9,1 su `/chi-siamo`). Sopra `xl` lo scrim non arriva all'H1: lì il difetto lo prende il
   controllo sulla struttura.
4. Five-check a zero ed e2e firmato verde, come ogni PR di codice.
