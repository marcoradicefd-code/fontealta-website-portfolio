# Spec di design — Homepage `/` (FASE 5)

> Stato: **design-backed** (frame Figma 1440×4209 disponibile).
> Vincolo FASE 5: riusa `CollectionCard` **senza modificarla**; la sezione "featured collections" usa una **query nuova** (`featured == true`, `[0...6]`).

---

## 1. Fonte & tracciabilità

| Elemento | Riferimento |
| --- | --- |
| Node sorgente | Figma `55:207` "Home Page" (1440×4209), clean board `55:206` |
| File primario | `/Users/mrc1/Desktop/frame fonte alta/Home Page .jpg` (riferimento di layout autoritativo) |
| File secondario | `/Users/mrc1/Desktop/frame fonte alta/Home Page.pdf` |
| Screenshot legacy (solo confronto) | `tmp/figma-discovery/home-1-1275.png` (versione html.to.design, NON autoritativo) |
| Token globali | `src/app/globals.css` (`@theme inline` + `:root` + `@layer components`) |
| Token Figma riconciliati | vedi tabella "Figma → globals.css TOKEN RECONCILIATION" del brief (file `Due5MkbcyoGR51cExOI3Ve`) |
| Pattern di pagina di riferimento | `src/app/(site)/[locale]/collezioni/page.tsx` (struttura 4-section atelier-cinema, FASE 4.1) |

Ogni sezione sotto cita il node `55:207` o una sotto-area distinguibile dal JPG. Nessuna sezione inventata: la struttura riflette 1:1 il frame.

---

## 2. Struttura sezioni (ordine + gerarchia)

Ordine verticale dal JPG `55:207` (top → bottom):

1. **Navigation** (sticky, riuso `src/components/layout/navigation.tsx`) — anchor `55:207` top bar.
2. **Hero** — full-bleed dark con foto ambiente, eyebrow `Indoor · No Limits`, H1 grande "Design / e Colore.", paragrafo descrittivo, **stat bar 4 voci** (`25` Anni / `21` Collezioni / `500+` Articoli / `Italy` Made in). Anchor: `55:207 › Hero`.
3. **Featured collections** — eyebrow "Le collezioni", H2 "Ogni collezione, una storia da raccontare.", intro, **slider/grid di card collezione** + CTA "Scopri le collezioni". Anchor: `55:207 › Collezioni storytelling`.
4. **AISI 316 (dark)** — eyebrow, H2 "AISI 316. / Un legame inossidabile.", paragrafo, **stat row 4 voci** (`316` / `500+` / `21` / `8`), **riga 8 swatch finiture** con label codice+nome. Anchor: `55:207 › AISI 316`.
5. **Teaser team (dark)** — eyebrow "Chi siamo", H2 "Alta qualità, / Altamente umano.", paragrafo, CTA "Scopri la nostra storia", **foto team** a destra. Anchor: `55:207 › High Quality Highly Human`.
6. **CTA / Contact form (light)** — H2 "Progettare in lungo e in largo.", **form a 2 colonne** (Dati personali: Nome, Email, Telefono / Azienda / "Di cosa hai bisogno" select) + bottone "INVIA". Anchor: `55:207 › Progettare in lungo e in largo`.
7. **Footer** (riuso `src/components/layout/footer.tsx`) — colonne Collezioni / Su di noi / Contatti / Legal + Area riservata. Anchor: `55:207 › Footer`.

---

## 3. Layout / grid

- **Container**: `.fa-container` → `--container-max: 1200px`, centrato (`margin: 0 auto`). Coerente con tutte le pagine Sprint 2.
- **Section padding**: `.fa-section` → `96px 24px` mobile, `136px 24px` ≥1024px. La Hero usa `min-h-screen` full-bleed (pattern da `collezioni/page.tsx` SECTION 1).
- **Breakpoints** (Tailwind default usati nel repo): `sm 640` / `lg 1024` / `xl 1280`.
- **Featured collections grid**: il frame mostra **3 card affiancate con frecce slider** (carosello). Per il vincolo "riusa CollectionCard senza modificarla" il layout consigliato è una **grid responsive identica a `collezioni/page.tsx`**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, con al massimo 6 card (`featured [0...6]`). Lo slider/freccia del Figma è uno **scostamento** gestito in §10 (deferito a motion Sprint 3+).
- **Stat bar Hero**: riga orizzontale a 4 colonne separate da divider verticale 1px (`--fa-border-dark` su dark). Su mobile → 2×2.
- **Swatch finiture AISI**: riga flex di 8 elementi (dot + label), wrap su 4×2 sotto `sm`.
- **Contact form**: grid 2 colonne ≥`lg`, single-column sotto; container `.fa-container.narrow` (max 800px) per il blocco form.

---

## 4. Tipografia

Tutti i valori mappati su scale di `globals.css` (`@theme` + `@layer components`). Font: `--font-sans` (Satoshi Variable).

| Testo | Scala / token | size · line-height · weight · letter-spacing |
| --- | --- | --- |
| Hero H1 "Design e Colore." | scala `display-hero` / `.fa-h1` clamp | `clamp(2.5rem,6vw+1rem,4rem)` · 1.05 · 500–600 · -0.5px |
| Hero eyebrow "Indoor · No Limits" | `.fa-eyebrow.on-dark` | 13px · — · 500 · 0.5px · uppercase |
| Hero paragrafo | `.fa-body-lg` | 1.125rem · 1.65 · 400 |
| Stat number (Hero + AISI) | `--text-display-secondary` / custom | ~2.25–3rem · 1.08 · 600 · -0.4px |
| Stat label | `--text-micro` | 0.6875rem · 1.45 · 500 · 0.2px · uppercase |
| Section H2 ("Ogni collezione…", "AISI 316.", "Alta qualità…", "Progettare…") | `--text-section-heading` / `.fa-h2`–`.fa-h3` (Figma "Section Heading" = 36/1.12/-0.5) | 2.25rem · 1.12 · 600 · -0.3/-0.5px |
| Eyebrow di sezione | `.fa-eyebrow` (light) / `.fa-eyebrow.on-dark` | 13px · 500 · 0.5px · uppercase |
| Intro paragrafi sezione | `.fa-body-lg` | 1.125rem · 1.65 · 400 |
| Card title (collezione) | `--text-card-title` / `.fa-h4` (Figma "Card Title" = 22/1.2/-0.2) | 1.5rem · 1.2 · 600 · -0.2px — **gestito da CollectionCard, non ridefinire** |
| Swatch label codice | `--text-micro` | 0.6875rem · 1.45 · 500 |
| Bottone "INVIA" / "Scopri" | `--text-button` | 0.9375rem · 1 · 500 · 0.3px |
| Form label / input | `--text-caption` | 0.8125rem · 1.4 · 0.1px |

Regole tipografiche brand (LOCKED): sentence case nei heading, apostrofo curly `’` (U+2019), interpunct `·` (U+00B7) nell'eyebrow "Indoor · No Limits". No Cormorant — Satoshi italic per accenti editoriali.

---

## 5. Colori & superfici (token riconciliati / nuovi proposti)

| Area | Token | Note |
| --- | --- | --- |
| Hero background scrim | dark base — **PROPOSTO `--color-fa-ink` (#0B1215)** | Figma `Brand/black #0B1215` è più freddo/scuro di `--color-fa-black #1a1a18`; le sezioni dark del frame usano questo near-black. Riusare il pattern multi-scrim di `collezioni/page.tsx` (rgba 10,10,9). |
| Hero testo / eyebrow accent | `--color-fa-white` + accent oro `#c4a35a` (= `--color-fa-steel-bb`) | l'eyebrow Hero in `collezioni` usa già `#c4a35a`; coerente. |
| Sezione AISI 316 (dark) | `.fa-section.dark` → `--fa-black` / testo `--fa-text-on-dark` | oppure `--color-fa-ink` se si adotta il token nuovo. |
| Teaser team (dark) | `.fa-section.dark` | idem. |
| Sezione Featured + CTA form (light) | `.fa-section.light` → `--color-fa-white` (#f6f4f0) | superficie chiara. |
| Card collezione cover | gradient da `COLLECTION_PRESENTATION` (placeholders.ts) | gestito internamente da `CollectionCard`. |
| Card cover neutra (se usata) | **PROPOSTO `--color-fa-card-cover` (#ECE9E3)** | Figma `grey/91`, attualmente hardcoded inline in `model-card.tsx`. Non necessario per CollectionCard, ma proposto per allineare la palette. |
| Superficie "warm white" (form/paper alt) | **PROPOSTO `--color-fa-white-warm` (#FCFAF5)** | Figma `Brand/white #FCFAF5`, tra `--fa-paper #fff` e `--fa-surface #faf8f5`. Già usato inline (`#fcfaf5`) nella Hero di `collezioni/page.tsx`. |
| Swatch finiture (8) | `--color-fa-steel-{mx,bx,mb,rl,ab,bb,bc,db}` | 1:1 con i 8 codici Sanity, vedi §7. |
| Navy accent (bottone INVIA, dot attivi) | `--color-fa-navy` (#1b2e4a) | match Figma `Brand/navy`. |
| Divider stat bar | `--fa-border-dark` / `--fa-border-light` | secondo superficie. |

**Token nuovi proposti** (additivi, da aggiungere a `@theme` in futuro — NON in questa FASE):
- `--color-fa-ink: #0B1215` — dark sections più fredde del near-black esistente.
- `--color-fa-white-warm: #FCFAF5` — warm white per superfici paper editoriali.
- `--color-fa-card-cover: #ECE9E3` — background cover card neutro (rimuove hardcode in model-card.tsx).

---

## 6. Spacing (scala 6 / 8 / 12 / 24 / 48)

Scala item-spacing Figma: `6 / 8(xs) / 12 / 24 / 48(l)`. Mapping consigliato (Tailwind `gap-*`/`p-*` ≈ multipli di 4):

| Uso | Valore |
| --- | --- |
| Section vertical padding | `.fa-section` 96/136px (invariato) |
| Gap eyebrow → H2 | 24px (Figma `l/2`) — coerente con `mt-4`/`mt-6` di `collezioni` |
| Gap H2 → intro paragrafo | 24px |
| Gap blocco header → grid/contenuto | 48px+ (`mb-20` nel pattern esistente; mantieni respiro generoso) |
| Gap tra card grid | 24px (`gap-5`/`gap-6`) |
| Gap interno stat bar (number → label) | 8px |
| Gap tra swatch finiture | 12px |
| Padding interno form field | 12px verticale |
| Gap tra campi form | 24px |

Item spacing micro (icone, dot): 6/8px.

---

## 7. Componenti usati

| Componente | Riuso vs nuovo | Anchor / file |
| --- | --- | --- |
| `Navigation` | **riuso** read-only | `src/components/layout/navigation.tsx` |
| `Footer` | **riuso** read-only | `src/components/layout/footer.tsx` |
| `CollectionCard` | **riuso SENZA modifiche** (vincolo FASE 5) | `src/components/cards/collection-card.tsx` |
| `CollectionCardAnimated` (wrapper reveal) | **riuso** opzionale per stagger | `…/collezioni/_components/collection-card-animated.tsx` |
| `Button` polymorphic | **riuso** (variant primary/secondary, prop `dark`) | `src/components/ui/button.tsx` |
| `.fa-dot` | **riuso** per swatch finiture (default 26px, variante `.on-dark`) | `globals.css` `@layer components` |
| `.fa-eyebrow` / `.fa-h2-h4` / `.fa-body-*` / `.fa-section` / `.fa-container` | **riuso** classi utility | `globals.css` |
| **HomeHero** | **nuovo** (Server Component) — foto + scrim multi-layer + stat bar | sezione 2 |
| **FeaturedCollections** | **nuovo** (Server Component) — fetch query nuova + grid di `CollectionCard` | sezione 3 |
| **Aisi316Section** | **nuovo** — stat row + 8 `.fa-dot` con label | sezione 4 |
| **TeamTeaser** | **nuovo** — testo + foto | sezione 5 |
| **ContactForm** | **nuovo** (Client Component, react-hook-form + Zod + Resend) | sezione 6 — non bloccante per spec |

Swatch finiture: rendere 8 `.fa-dot.on-dark` con `background` = `getFinishHex(code, sanityHex)` (helper `placeholders.ts`), label codice+nome sotto. Allineato a §5 steel tokens.

---

## 8. Stati & motion (solo CSS + IntersectionObserver — NO GSAP)

- **Scroll reveal**: usare `.reveal`/`.reveal.visible` (`globals.css`) via hook `src/hooks/use-scroll-reveal.ts` per fade+translateY(30px). Stagger card via `CollectionCardAnimated` (`index` prop). `prefers-reduced-motion: reduce` → no transform.
- **CollectionCard hover**: già definito internamente (`hover:-translate-y-1`, shadow card→product, monogram `scale(1.04)`, `--ease-out-expo`, `--dur-standard` 400ms). Non ridefinire.
- **`.fa-dot` hover**: `transform: scale(1.15)` 0.25s ease (già in globals).
- **Button hover/focus**: gestito da `Button` (focus-visible ring `--fa-navy`).
- **Slider/frecce Featured (Figma)**: il carosello con frecce è motion-deferito (Sprint 3+ GSAP/Lenis). In FASE 5 → grid statica (vedi §10).
- **Easing/durate**: `--ease-out-expo`, `--dur-micro` 200ms, `--dur-standard` 400ms, `--dur-hero` 800ms.

---

## 9. Mapping Sanity (campo → sezione, empty-state)

| Sezione | Campo Sanity | Empty-state Sprint 2 |
| --- | --- | --- |
| Hero foto | nessun documento dedicato esiste → **placeholder** Unsplash (pattern `collezioni/page.tsx`) finché Andrea non popola un asset hero homepage | foto placeholder; flag asset M5 |
| Hero stat bar (25/21/500+/Italy) | valori **statici/derivati**: `21` = `count(collection)`, `500+`/`591` = totale articoli catalogo. Nessun campo Sanity dedicato → hardcode con commento o nuovo singleton `siteSettings` field (deferito) | numeri noti dal catalogo (591 art / 21 coll) |
| Featured collections | **query nuova** `*[_type=="collection" && language==$locale && featured==true] \| order(order asc)[0...6]` proiettando i campi consumati da `CollectionCard` (`_id, code, title, "slug": slug.current, featured, articleCount, …`). Campo sorgente: `collection.featured` (bool, default false) | se 0 featured → fallback alle prime 6 per `order`; flag a Andrea di settare `featured` |
| CollectionCard cover | `collection.coverImage` (imageWithMeta) | **0 popolati** → gradient `COLLECTION_PRESENTATION` + monogram (M1/M5) |
| CollectionCard tagline | `collection.tagline` | overridden da `COLLECTION_PRESENTATION.tagline*` finché vuoto |
| AISI stat `8` (finiture) | `count(finish)` = 8 | popolato |
| AISI stat `316`/`21`/`500+` | statici/derivati (lega AISI 316; 21 coll; 591 art) | numeri noti |
| Swatch finiture (8 dot) | `FINISHES_OVERVIEW_QUERY` → `finish.code`, `finish.name[$locale]`, `finish.colorHex`, `finish.swatchImage` | `colorHex` **0/8 popolati** → `getFinishHex()` fallback ai token steel; `swatchImage` 0/8 → dot colorato. Flag M5 |
| Teaser team foto | nessun campo → **placeholder** Unsplash finché Andrea fornisce foto team | flag M5 (asset) |
| Teaser team copy | hardcode IT/EN via `next-intl` messages (`home` namespace) finché non c'è campo Sanity dedicato | — |
| CTA / Contact form | submit via Resend; destinatario da `siteSettings.email` | `siteSettings` singleton da popolare |
| Footer | `SITE_SETTINGS_QUERY` → `companyName`, `footerColumns[]`, `socialLinks`, `address`, `phone`, `email` | footer già gestito dal componente riuso |

Nota Sanity-first: i numeri statici (anni/articoli) e la copy dei teaser sono gli unici contenuti potenzialmente "hardcoded" — segnalare a Andrea per eventuale promozione a campi `siteSettings` (deferito, non bloccante FASE 5).

---

## 10. Gap & scostamenti Figma

1. **Featured: slider 3-card vs grid 6-card.** Il frame `55:207` mostra un **carosello a 3 card con frecce ‹ ›**. Il vincolo FASE 5 (riuso `CollectionCard` + query `featured [0...6]`) e la decisione "motion deferita Sprint 3+" portano a implementare una **grid responsive statica** (max 6) come in `collezioni/page.tsx`. Frecce/slider → tech debt Sprint 3+ (GSAP/Lenis). Motivazione: nessuna animazione complessa in Sprint 2/FASE 5.
2. **Stat numbers senza campo Sanity.** Hero (25/21/500+/Italy) e AISI (316/500+/21/8): solo `21` e `8` sono derivabili da `count()`. Gli altri sono statici → proposta futura di field `siteSettings.stats[]` (non in FASE 5).
3. **Token dark non standard.** Le sezioni dark del Figma usano `#0B1215` (più freddo del `--fa-black #1a1a18`). Proposto `--color-fa-ink`; in FASE 5 si può temporaneamente usare `.fa-section.dark` esistente per non toccare `globals.css` (vincolo: NON editare globals.css). Scostamento cromatico minore tollerato fino all'aggiunta del token.
4. **Hero "Design e Colore." vs brief "Vestiamo l'acqua".** Il JPG autoritativo riporta **"Design / e Colore."** con eyebrow "Indoor · No Limits"; il brief testuale citava "Vestiamo l'acqua / collezioni storytelling". **Prevale il JPG** (fonte primaria). La copy esatta va confermata e gestita via `next-intl` messages.
5. **Foto Hero + team: nessun asset Sanity.** Placeholder Unsplash/Picsum finché Andrea popola (M5). Lo stile fotografico (bagno indoor caldo nel frame) è solo indicativo.
6. **CollectionCard non modificabile** → eventuali differenze di styling card tra frame e componente esistente NON vengono riconciliate in FASE 5 (vincolo). Il design del frame e il componente attuale sono entrambi card 4:5 con titolo + eyebrow + meta: scostamenti minori accettati.
