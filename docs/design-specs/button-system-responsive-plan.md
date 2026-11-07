# Button System + Responsive — Piano (da eseguire col responsive)

> **Premessa.** Lo stato attuale è OK lato accessibilità base: **WCAG 2.2 SC 2.5.8 Target Size (Minimum), Livello AA — 24px = 100% pass** (target raccomandato; il minimo legale armonizzato resta **WCAG 2.1 AA**, vedi §2), **nessun overflow orizzontale a 375px su 6/6 pagine** testate, **nav mobile completa** (hamburger 44×44 + overlay + item `min-h-44`). Questo documento è **RIFINITURA**, non ricostruzione, ed è pensato per essere eseguito **in un colpo solo insieme al responsive** a fine progetto: tutti i punti convergono lì, così i bottoni si toccano **una volta sola**.
>
> _Fonte: audit read-only giugno 2026 (misure live Playwright a 375 / 768 / 1440)._

## 1. Scala bottoni a 4 taglie (desktop)

Oggi esistevano **8 altezze in banda 36–47px** + font **13/14/15/16** ravvicinati (rumore, non una scala). Sostituite con **4 taglie nette per RUOLO** (DECISE e applicate in preview):

- **S — 36px · font 14 · pad 16:** controlli — filtri (`.fa-pill`), paginazione, nav switcher / Area Riservata.
- **M — 44px · font 15 · pad 24:** CTA secondarie + submit form.
- **L — 48px · font 16 · pad 32:** CTA primarie — hero ("Parliamo del tuo progetto").
- **XL — 64px · font 17 · pad 40:** CTA grandi — featured ("Tutte le collezioni").

**Misure live attuali (riferimento, non target):**

| Elemento | W×H |
| --- | --- |
| Paginazione numero | 36×36 |
| Paginazione prev/next | ~124×36 |
| Filter / read-article pill | 66×39 |
| Submit form (×2) | 136×39 |
| Nav Area Riservata (desktop) | 143×37 |
| Nav switcher lingua | 144×39 |
| Button `default` | 181×46 |
| Hero CTA | 297×47 |
| Button `large` (featured) | 281×66 |
| Hamburger (mobile) | 44×44 |

**Numeri esatti — DECISI e applicati** (preview `preview/button-system`): altezza / font / padding-orizzontale su griglia 8px → **S 36/14/16 · M 44/15/24 · L 48/16/32 · XL 64/17/40**. Token `--btn-{height,pad,font}-{s,m,l,xl}` in `globals.css` = single source (Button `size="s|m|l|xl"` default `m`, `.fa-pill`, nav, paginazione). **Step percepibile** rispettato (≥4px tra le taglie).

**Metodo — _height-from-the-inside-out_:** le altezze NON si fissano come valori arbitrari, ma si **derivano** da type-scale + padding. Processo canonico: stabilire la **scala tipografica** → fissare l'**altezza target** → regolare **type + padding per componente** finché tornano. Coerente con lo **step percepibile** qui sopra. _(fonte: Nathan Curtis / EightShapes, "Size in Design Systems".)_

## 2. Invariante WCAG target-size

> **Requisito di legge:** l'EAA (in vigore dal 28 giu 2025) impone l'accessibilità tramite lo standard armonizzato EN 301 549. Il benchmark legale corrente è **WCAG 2.1 AA** (EN 301 549 v3.2.1, armonizzata). **WCAG 2.2 AA** non è ancora nello standard armonizzato — atteso con la v4.1.1 (2026) — ma è il target raccomandato da adottare ora (nessun breaking change rispetto a 2.1) → rafforza "mantenere AA 100%". _(Section 508 = riferimento USA, citato per analogia, non legge UE.)_

- **AA — 24px (WCAG 2.2, SC 2.5.8 _Target Size (Minimum)_):** già **100% rispettato** → mantenere. _NB: la soglia 24px è **nuova in WCAG 2.2**, non esiste in 2.1 (W3C WAI, Understanding 2.5.8)._
- **AAA — 44px (SC 2.5.5 _Target Size (Enhanced)_):** obiettivo. **7 controlli sotto soglia** (36–39px): paginazione, filtri, submit, nav desktop. _(W3C WAI, Understanding 2.5.5.)_
- **Soluzione:** estendere l'**AREA DI TOCCO** a **≥44px** via `@media (pointer:coarse)` — **solo su touch**, lasciando il bottone **visivamente fine** su desktop. _(`pointer:coarse` è **corretto e preferibile a `max-width`**: intercetta il **tipo di input** — dito vs mouse — non la larghezza del viewport.)_
  - Controlli piccoli (paginazione 36): **hit-area 44** con cerchio visivo 36 centrato → **[APPLICATO]** via `::after` trasparente espanso (`-inset-1`) su `@media (pointer:coarse)`; visivo 36 invariato su desktop/mouse. `.fa-pill` + nav S → `min-height:44` su `pointer:coarse`.
  - **Alternativa meno invasiva (spaziatura):** il SC 2.5.8 si soddisfa **anche** con **≥24px di spaziatura** tra target adiacenti, non solo con dimensione ≥24px. Per la paginazione (numeri piccoli e vicini) garantire **24px di gap** è meno invasivo sul design che gonfiare ogni numero → da tenere **accanto** alla hit-area 44, non al suo posto. _(W3C SC 2.5.8; TestParty.)_
  - **Critico su touch:** paginazione **36×36** è il bersaglio peggiore (entrambe le dimensioni sotto, si tocca col pollice).
- **44 vs 48 — DECISO.** Hit-area touch e taglia **M = 44px** (AAA SC 2.5.5 min); il **48px** (6×8, Material) è usato come altezza **L** delle CTA primarie → entrambi nella scala, nessun trade-off da risolvere. _(valutati base-8 Tailwind + Android Material 48dp; fonte Steve Dennis.)_

## 3. Consolidare i 3 meccanismi paralleli

Oggi convivono **3 sistemi** per lo stesso oggetto "pill button":

1. `Button` (Tailwind, `components/ui/button.tsx`)
2. `.fa-pill` (CSS, `globals.css`)
3. hand-rolled (nav, paginazione)

`.fa-pill.active` **duplicava** hover-lighten + `scale(.97)` + 300ms di `Button` primary → **[RISOLTO]**: la `transition:300ms` non è più duplicata, vive solo nella base `.fa-pill` (single source). Hover/scale restano nella pill (è una classe CSS standalone).

**Obiettivo:** un meccanismo solo → taglie e target-size garantiti **in un punto unico**, non replicati. **[PARZIALE]** sizing unificato via token (fatto); il merge totale del **meccanismo interattivo** resta tech-debt (vedi `M-button-system-merge` sotto). _(Tech-debt `M-button-system`.)_

**Token come punto unico — CREATI:** `--btn-{height,pad,font}-{s,m,l,xl}` in `globals.css`, consumati da Button / `.fa-pill` / nav / paginazione (zero valori di taglia hardcoded). I token **`--btn-gap-*`** (spaziatura tra target adiacenti) **non** sono stati creati in questa fase — solo height/pad/font; deferred. La **spaziatura è una leva di accessibilità di pari rango** rispetto alla dimensione (vedi §2, eccezione spaziatura). Tokens Studio: agganciabile se nel workflow design.

**Tech-debt `M-button-system-merge` (fase 2):** merge completo `.fa-pill` → componente `Button`. Oggi i filtri restano `<button className="fa-pill">` con logica toggle (`aria-pressed` / stato) → **fuori scope** ora; il sizing è già unificato via token, manca solo unificare il **meccanismo interattivo** in un unico componente.

## 4. Fix puntuali (assorbiti in questo lavoro)

- **Area Riservata:** desktop 37px ≠ mobile 45px (stessa CTA, due taglie) → **[FATTO]** uniformate a S (36px) + hit-area 44 su touch.
- **`size="small"`** sul `Button`: dead code (0 usi) → **[FATTO]** rimosso (union ora `s|m|l|xl`).
- **Override inline fuori-scala:** home-hero `!py-4` (47px), read-article `padding: 10px 24px` → **[FATTO]** assorbiti nei token (hero → L 48px, read-article → S 36px).

## 5. Submit (decisione Marco — RISOLTA)

**Submit — RISOLTO → M (44px / font 15).** I 22px erano l'**effetto ottico** (facevano sembrare il submit "primario"), non la dimensione corretta: riallineato alla taglia **M** (CTA secondarie + submit), **uppercase mantenuto**, `min-w` per non far saltare il layout su "INVIO…". Non è più il font più grande del sito.

## 6. Responsive — gap residui

Stato: **sostanzialmente presente** (clamp ×45 + griglie responsive + nav mobile), **non rifinito**. Da chiudere:

- **(a)** verifica esplicita a **768px** (tablet) → **[VERIFICATO giu 2026]** Playwright su home/blog/contatti: zero overflow orizzontale, filtri S in wrap pulito, paginazione 36×36 senza overlap, CTA L/XL dentro il container. Gap chiuso.
- **(b)** ottimizzazioni fini (es. hero video portrait-crop → tech-debt `M-portrait-video`).

Non è ricostruzione, è **rifinitura**.
