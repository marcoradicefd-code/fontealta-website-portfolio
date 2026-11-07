# Spec di design — Scheda modello singolo `/modello/[slug]` (FASE 4.4)

> **Status: `composed-gap`.** Non esiste un frame Figma dedicato alla scheda
> modello. La pagina è una **composizione tracciata** dai componenti del design
> system Figma + dal pattern pagina Boss (collection detail) + dal codice
> esistente. Ogni sezione cita un anchor esplicito (component node-id Figma o path
> codice). Nessuna sezione è inventata senza anchor.
>
> ⚠️ **STOP HARD richiesto.** Questa spec è un deliverable di design read-only.
> L'apertura del codice feature (FASE 4.4.2) è subordinata all'approvazione
> esplicita di questa spec + delle 5 decisioni in coda a `docs/FASE-4.4-PLAN.md`
> (routing key, hero layout, SSG strategy, related fallback, specs gap/M17).

---

## 1 · Fonte & tracciabilità

**Natura:** pagina composta, nessun frame pagina sorgente.

| Anchor | Tipo | Uso |
| --- | --- | --- |
| Figma node `3:927` "H1 / Hero" | componente DS | scala tipografica heading hero (H1) |
| Figma node `3:1172` "Hero meta-bar" (1100×101) | componente DS | pattern barra stat/meta hero modello (code · tipo · ambient · n° finiture) |
| Figma node `3:1659` "Card/Modello" | componente DS | card prodotto → related grid (reuse via ModelCard) |
| Figma node `248:3097` pagina Boss (collection detail) | frame pattern | pattern hero prodotto, swatch finiture, layout card, sezione scura footer-prodotto |
| `tmp/figma-discovery/frame1-51-1202.png` | screenshot Boss | hero scuro + barra meta + griglia card + swatch |
| `tmp/figma-discovery/frame2-51-1490.png` | screenshot Boss | variante con card "destacada" su pannello scuro (riquadro prodotto) |
| `tmp/figma-discovery/frame3-89-542.png` | screenshot Boss | full-bleed scuro, griglia densa, footer scuro |
| `src/components/cards/model-card.tsx` | codice esistente | ModelCard reuse (related, `showCollection`), token cover `#ece9e3`, `fa-dot`, `fa-tag` |
| `src/app/(site)/[locale]/collezioni/[slug]/_components/collection-hero.tsx` | codice esistente | pattern hero (ispirazione, **NON reuse** — A4/A5 FASE-4.4-PLAN) |
| `src/app/globals.css` | codice esistente | token `@theme` + `@layer components` (`fa-eyebrow/h*/tag/dot/pill/section/container`) |
| `sanity/schemas/documents/model.ts` | schema | campi `model.*` + `specs` object (riga 199-218) |
| `docs/FASE-4.4-PLAN.md` | piano | decisioni LOCKED (routing slug, hero B text-forward, ISR on-demand, related +productType, specs render condizionale + M17) |

**Note metodologiche:** colori espressi come **token name** riconciliati a
`globals.css`. Hex loose ammesso solo nelle proposte di nuovo token (sezione 5).
Mapping Sanity per ogni sezione in sezione 9; empty-state segnalati dove il campo
è 0/591 popolato.

---

## 2 · Struttura sezioni (ordine + gerarchia)

Ordine verticale, mobile = stack. Ogni voce cita l'anchor.

1. **Breadcrumb / back-link** — `Collezione → Modello`. _Anchor: pattern nav
   pagina Boss `248:3097` (header light) + `src/components/layout` convention._
   Minimale, opzionale Sprint 2 (può confluire nell'eyebrow hero).
2. **ModelHero** — eyebrow (collezione primaria) · H1 nome · code mono · meta-bar
   (productType · ambient · n° finiture) · swatch finiture · riquadro monogram
   placeholder. _Anchor: H1 `3:927` + meta-bar `3:1172` + hero Boss `248:3097` +
   `collection-hero.tsx` (ispirazione, layout B text-forward — A5)._
3. **ModelDescription** — corpo PortableText (527/591). _Anchor: pattern corpo
   testo pagina Boss `248:3097` (paragrafo intro sotto hero) + `.fa-body-lg` /
   `.fa-container.narrow` globals._
4. **ModelSpecs** — render condizionale: facts sempre disponibili (productType,
   tags, concealed body 🔒, customizable, n° finiture, collezioni) + dimensioni/
   peso/materiali solo se `defined`. _Anchor: meta-bar `3:1172` (pattern coppie
   label/valore) + `.fa-tag` globals._
5. **FinishSelector** — swatch finiture cliccabili, stato visuale only (client).
   _Anchor: swatch finiture pagina Boss `248:3097` + `.fa-dot` globals +
   `getFinishHex` `placeholders.ts`._
6. **RelatedModels** — grid max 4 ModelCard (stessa collezione, fallback
   productType). _Anchor: Card/Modello `3:1659` + griglia card pagina Boss
   `248:3097` + `model-card.tsx` reuse._

> Gerarchia visiva: Hero (dominante, full-width) → Description (narrow,
> editoriale) → Specs (strutturato) → FinishSelector (interazione) → Related
> (chiusura, griglia). FinishSelector può essere integrato dentro l'hero
> (swatch hero = selector) per coerenza con pattern Boss; in tal caso resta una
> sola istanza swatch e la sezione 5 si fonde nella 2 — **decisione di
> implementazione 4.4.3**, segnalata in gap §10.

---

## 3 · Layout / grid

- **Container:** `--container-max: 1200px` (`.fa-container`). Corpo testuale
  (Description) usa `.fa-container.narrow` (max 800px) per misura di lettura
  editoriale. _Anchor: globals `.fa-container` + pattern Boss `248:3097`._
- **Hero (layout B text-forward Split-ready — A5 LOCKED):**
  - Desktop ≥1024px: griglia 2 colonne asimmetrica — **pannello info ~60%**
    (eyebrow/H1/code/meta/swatch) + **riquadro monogram ~40%** (contenuto, non
    full-bleed). Upgrade automatico a Split 60/40 image quando Andrea popola
    `primaryImage` (M5).
  - Mobile <1024px: stack verticale (info sopra, riquadro monogram sotto o
    omesso). _Anchor: `collection-hero.tsx` responsive pattern (Tailwind stack)._
  - **NON full-bleed 100vh dark** come CollectionHero/AmbientHero: l'assenza di
    `primaryImage` (0/591) renderebbe debole un hero immagine-dominante (A5).
- **Specs:** griglia coppie label/valore, 2-3 colonne desktop (auto-fit minmax),
  1 colonna mobile. _Anchor: meta-bar `3:1172` (101px tall, label sopra valore)._
- **Related grid:** `repeat(auto-fill, minmax(240px, 1fr))` o 4 colonne fisse
  desktop / 2 colonne tablet / 1 colonna mobile — coerente con ModelsSection
  (4.2.4) e griglia card Boss. _Anchor: griglia card `248:3097` + `3:1659`._
- **Breakpoint guida:** 1024px (`.fa-section` padding switch 96px→136px), 768px
  (collasso griglie), coerenti con globals esistenti.

---

## 4 · Tipografia

Token scale da `globals.css @theme` + `@layer components`. Satoshi variable.
Apostrofi curly `’`, interpunct `·` verbatim. Sentence case headings.

| Elemento | Token / scala | Size | line-height | weight | letter-spacing |
| --- | --- | --- | --- | --- | --- |
| Eyebrow hero (collezione) | `.fa-eyebrow` | 13px | — | 500 | 0.5px, uppercase |
| H1 nome modello | `--text-display-secondary` (`.fa-h2`) / vedi nota | clamp 2→3rem | 1.08 | 600 | -0.4px |
| Code prodotto (mono) | `--text-caption` + `--font-mono` | 13px | 1.4 | 400 | 0.4px (pattern card 11px mono) |
| Meta-bar label | `--text-micro` | 11px | 1.45 | 500 | 0.2px uppercase |
| Meta-bar valore | `--text-sub-heading` | 1.25rem | 1.3 | 600 | -0.1px |
| Body description | `.fa-body-lg` | 1.125rem | 1.65 | 400 | — |
| Specs label | `--text-micro` | 11px | 1.45 | 500 | uppercase |
| Specs valore | `--text-body-sm` / `--text-caption` | 0.875rem | 1.55 | 500 | — |
| Tag | `.fa-tag` | 10px | — | 500 | 0.4px uppercase |
| Section heading (Related/Specs) | `--text-section-heading` (`.fa-h3`) | 2.25rem | 1.12 | 600 | -0.3px |
| Card title (related) | `--text-card-title` riusato da ModelCard (17px) | 17px | 1.2 | 600 | tight |

> **Nota H1 — divergenza Figma vs decisione progetto.** Il componente Figma
> `3:927` + Figma var "Section Heading" definiscono Satoshi Bold 36 / 1.12 /
> -0.5. CollectionHero usa Satoshi **italic** display gigante (clamp 64→128px).
> Per il **model detail** (hero text-forward, non editoriale full-bleed) si
> raccomanda **`--text-display-secondary` (clamp 2→3rem, weight 600, NON italic)**:
> il nome modello è informativo (es. "Boss B40L.M"), non un titolo cinematografico.
> Cormorant serif resta anti-pattern (usare Satoshi). Scelta finale = approvazione
> §10.

---

## 5 · Colori & superfici (token riconciliati / nuovi proposti)

**Token esistenti riusati (riconciliati a Figma — MATCH confermati nel brief):**

- Hero pannello info: superficie chiara `--color-fa-surface` (#FAF8F5) **oppure**
  pannello scuro `--color-fa-black`. _Pattern Boss `248:3097` usa hero scuro;
  layout B text-forward su chiaro è alternativa graceful senza immagine — vedi §10._
- Testo primario: `--color-fa-text-primary` / `--color-fa-black` (#1A1A18, MATCH
  Figma Text/primary).
- Testo on-dark: `--color-fa-text-on-dark` / `--color-fa-white` (#F6F4F0, MATCH
  Figma Text/on-dark).
- Accento eyebrow / dettagli: `--color-fa-navy` famiglia (#1B2E4A / `-light`
  #2A4570 / `-bright` #3D5F99, MATCH Figma azure/30 e azure/42).
- Swatch finiture: token steel code-named `--color-fa-steel-{mx,bx,mb,rl,ab,bb,bc,db}`
  via `getFinishHex(code, colorHex)` (`placeholders.ts`). Fallback
  `FINISH_HEX_FALLBACK` finché `finish.colorHex` 0/8 popolato (M5).
- Bordi: `--fa-border-light` / `--fa-border-medium` (rgba black) per superfici
  chiare; `--fa-border-dark*` per pannelli scuri.
- Ombre: `--shadow-card` (related ModelCard) / `--shadow-product` (riquadro hero
  / specs panel).

**Nuovi token proposti (additivi — NON applicati in questa spec, da inserire in
`globals.css @theme` in 4.4.2 solo se approvati):**

| Token proposto | Hex | Rationale |
| --- | --- | --- |
| `--color-fa-card-cover` | `#ECE9E3` | Background riquadro cover/monogram. Oggi **hardcoded inline** in `model-card.tsx` (`background: "#ece9e3"`) e nel placeholder hero. Figma grey/91. Centralizza il token già duplicato. |
| `--color-fa-ink` | `#0B1215` | Figma Brand/black, near-black più freddo/scuro di `--fa-black` #1A1A18. Usato dalle dark sections Boss (pannello prodotto scuro frame2/frame3). Solo se l'hero/footer-prodotto adotta il pannello scuro. |
| `--color-fa-white-warm` | `#FCFAF5` | Figma Brand/white, tra `--fa-paper` #FFF e `--fa-surface` #FAF8F5. Opzionale per superficie hero chiara più calda. Basso valore aggiunto Sprint 2 — proporre solo se serve stacco da `--fa-surface`. |

> ⚠️ Hex loose ammessi **solo** in questa tabella (proposta token). Nel corpo
> spec i colori restano token name. `--color-fa-card-cover` ha la priorità più
> alta (rimuove duplicazione esistente reale).

---

## 6 · Spacing (scala 6/8/12/24/48)

Scala item-spacing Figma estratta: **6 / 8(xs) / 12 / 24 / 48(l)**. Mappa su
spacing Tailwind/globals.

- **Padding sezione:** `.fa-section` = 96px mobile / 136px desktop (≥1024px).
  Coerente con tutte le sezioni Sprint 2. _Anchor: globals `.fa-section`._
- **Hero padding:** orizzontale 24px (gutter base) → centrato in container 1200px.
  Verticale generoso (clamp ~120→200px top come CollectionHero, ridotto se layout
  chiaro non-100vh). _Anchor: `collection-hero.tsx` padding pattern._
- **Gap meta-bar (stat):** 24→48px tra coppie label/valore (`clamp(24px,3vw,48px)`,
  scala L). _Anchor: `collection-hero.tsx` stat gap + Figma 48(l)._
- **Gap swatch finiture:** 10-12px (`fa-dot` gap 2.5 = 10px in ModelCard; 12 =
  scala media). _Anchor: `model-card.tsx` `gap-2.5`._
- **Gap tag:** 6-8px (`gap-1.5` = 6px in ModelCard, scala xs). _Anchor: card._
- **Related grid gap:** 24px (scala L, coerente ModelsSection 4.2.4).
- **Spacing interno blocchi hero:** eyebrow→H1 16px (mt-4), H1→meta 24-48px,
  meta→swatch 24px. _Anchor: `collection-hero.tsx` (mt-4 / mt-12 / mt-6)._

---

## 7 · Componenti usati (reuse vs nuovo)

| Componente | Reuse / Nuovo | Anchor | Note |
| --- | --- | --- | --- |
| `ModelCard` | **REUSE** | `3:1659` + `model-card.tsx` | Related grid; `showCollection=false` (stessa collezione primaria). In 4.4.3 wrap `<Link>` + reintroduzione hover-lift (chiude M9). |
| `ModelHero` | **NUOVO** (Server) | H1 `3:927` + meta-bar `3:1172` + Boss `248:3097` | Layout B text-forward, monogram placeholder gray. NON reuse CollectionHero (full-bleed 100vh editoriale). |
| `ModelSpecs` | **NUOVO** (Server) | meta-bar `3:1172` + `.fa-tag` | Render condizionale (vedi §9 empty-state). |
| `ModelDescription` | **NUOVO** (Server) | Boss `248:3097` corpo + `.fa-body-lg` | **Primo uso `@portabletext/react`** del progetto (dep `^6.0.3` mai usata). Serializers heading/list coerenti col DS. |
| `FinishSelector` | **NUOVO** (Client) | swatch Boss `248:3097` + `.fa-dot` | `useState<string>` activeFinishId, visual-only, NO URL (M13). |
| `RelatedModels` | **NUOVO** (Server) | griglia Boss `248:3097` + `3:1659` | Wrapper grid + section heading; delega a ModelCard. |
| `.fa-eyebrow` / `.fa-tag` / `.fa-dot` / `.fa-h*` / `.fa-section` / `.fa-container` | **REUSE** | globals `@layer components` | Utility classes esistenti, no nuovo CSS. |
| Monogram placeholder | **REUSE asset** | `/public/brand/fontealta-monogram-gray.png` | Stesso asset ModelCard. Variante green per cover chiare (vedi `placeholders.ts` nota contrasto). |

> **Gotcha union ModelCard (A3 FASE-4.4-PLAN):** `relatedModels[]` da
> `MODEL_DETAIL_QUERY` genera un result type NON presente nella union
> `ModelData = CollectionDetailModel | AmbientDetailModel` (`model-card.tsx:13-15`).
> 4.4.3 deve **estendere la union** con `RelatedModel` (projection include
> `finishes` + `collections` → strutturalmente compatibile con AmbientDetailModel).

---

## 8 · Stati & motion (solo CSS + IntersectionObserver, NO GSAP)

GSAP/Lenis locked-out Sprint 2 (decisione progetto). Solo CSS transitions +
IntersectionObserver.

- **Scroll reveal sezioni:** `useScrollReveal` (`src/hooks/use-scroll-reveal.ts`,
  state-based, `useSyncExternalStore` per `prefers-reduced-motion`) o classList
  `.reveal`/`.visible` (globals). Fade+translateY 30px, 0.6s `--ease-out-expo`.
- **Swatch finiture (`fa-dot`):** hover `transform: scale(1.15)` 0.25s ease
  (esistente in globals). Stato **active** FinishSelector: anello/ring più
  marcato (es. `box-shadow` ring navy + scale) — nuovo stato visuale, additivo,
  NO nuovo token colore (riusa `--fa-navy`).
- **ModelCard related (post-M9):** reintrodurre hover-lift `transform: translateY`
  + `--shadow-product`, transition `--dur-standard` `--ease-out-expo`. Solo dopo
  wrap `<Link>` (no falso affordance prima).
- **CTA / link:** transition `--dur-micro` (200ms). Pattern `.fa-pill` se serve
  filtro/CTA pill.
- **prefers-reduced-motion: reduce** → `.reveal { opacity:1; transform:none }`
  (già gestito globals). FinishSelector resta funzionale (interazione, non motion).

---

## 9 · Mapping Sanity (campo → sezione, empty-state)

Query: nuova `MODEL_DETAIL_QUERY` (slug-based, no filtro `language`, `description`
proiettata `description[$locale]`, `name` raw → cast M6) + `MODEL_SLUGS_QUERY`
(generateStaticParams). _Anchor: `docs/FASE-4.4-PLAN.md` A3._

| Campo Sanity | Sezione | Stato popolamento | Empty-state |
| --- | --- | --- | --- |
| `model.code` | Hero (mono) | ✅ 591/591 | sempre presente |
| `model.name` (localizedString) | Hero H1 | ✅ 591/591 | cast `as unknown as {it?,en?}`, fallback `it` → `code` |
| `model.slug` | routing | ✅ 591/591 unici | — |
| `model.description` (localizedPortableText) | ModelDescription | **527/591** | 64/591 vuoto → **omettere sezione** (no blocco vuoto). EN mirror IT pre-T1; valutare fallback IT se `[$locale]` vuoto (follow-up A4-plan §4). |
| `model.productType` (enum 12) | Hero meta + Specs | ✅ 591/591 | sempre |
| `model.ambient` (enum string) | Hero meta + Specs | ✅ 591/591 | sempre (nota M14: `bagno` in enum schema ma 0 doc seed) |
| `model.tags` (string[]) | Specs (fa-tag) | ✅ (variabile) | array vuoto → no tag chips |
| `model.includesConcealedBody` (bool 🔒) | Specs | ✅ 591/591 | sempre (mostra solo se `true`, oppure label esplicita) |
| `model.isCustomizable` (bool) | Specs | ✅ | sempre |
| `model.availableFinishes[]->` | Hero swatch + FinishSelector | ✅ refs | min 1 (ORIGO RAME natural può essere vuoto) → no swatch |
| `model.collections[]->` | Hero eyebrow + Specs + related query | ✅ min 1 | primaria = `[0]` |
| `model.specs.heightMm/widthMm/depthMm/weightKg` | ModelSpecs | **0/591** | **render condizionale** — invisibili finché `defined` (curation Andrea, M17/M5) |
| `model.specs.materials[]` | ModelSpecs | **0/591** | idem condizionale |
| `model.primaryImage` (imageWithMeta) | Hero riquadro | **0/591** | **monogram placeholder gray** `/brand/fontealta-monogram-gray.png` (graceful no-image, A5/M5) |
| `model.images[]` | (gallery futura) | **0/591** | non renderizzata Sprint 2 |
| `finish.colorHex` | swatch hex | **0/8** | `getFinishHex` fallback `FINISH_HEX_FALLBACK` (M5) |
| `finish.name` (localizedString) | swatch tooltip | ✅ | cast M6, fallback `code` |

> **Sanity-first:** nessun contenuto testuale modello hardcoded — tutto da
> `model.*`. Stringhe UI (eyebrow label, stat label, "Modelli correlati",
> "Specifiche") da namespace i18n **nuovo `modello`** in `it.json` + `en.json`
> (en mirror it, T1). Specs dimensionali/materiali = curation Andrea (M17), NON
> hardcoded.

---

## 10 · Gap & scostamenti Figma (cosa manca o diverge)

1. **Nessun frame pagina Figma per il model-detail.** L'intera spec è composta da
   componenti DS + pattern Boss + codice. Status `composed-gap`. **Richiede STOP
   HARD + approvazione design prima del codice (4.4.2).**
2. **Hero layout — divergenza vincolata da asset.** Figma/Boss `248:3097`
   mostrano hero **scuro full-bleed con immagine prodotto** + swatch. Realtà:
   `primaryImage` 0/591 (M5). Si adotta **layout B text-forward Split-ready**
   (monogram placeholder, NON immagine 60%), upgrade a Split post-M5. Scelta
   chiaro-vs-scuro del pannello hero = decisione da confermare (§5 propone sia
   `--fa-surface` chiaro sia `--fa-ink`/`--fa-black` scuro Boss-style).
3. **Specs dimensionali assenti dal contenuto.** Schema `model.specs` contiene
   `heightMm/widthMm/depthMm/weightKg/materials` ma **0/591 popolati** → render
   condizionale Sprint 2. Manca del tutto: flow rate, pressione, disegno tecnico
   PDF, materiale AISI 316 strutturato (gap reale → **M17**, Sprint 4+).
4. **FinishSelector vs swatch hero — possibile doppione.** Boss `248:3097` ha una
   sola riga swatch nell'hero. Se FinishSelector è l'unico swatch, le sezioni 2 e
   5 si fondono (decisione implementazione 4.4.3). Da chiarire per evitare due
   set di swatch.
5. **H1 weight/style divergente** da Figma "Section Heading" (Bold 36 -0.5) e da
   CollectionHero (italic 64-128px). Raccomandato `--text-display-secondary`
   non-italic per nome informativo (§4). Da confermare.
6. **Token nuovi proposti non applicati.** `--color-fa-card-cover` (#ECE9E3),
   `--color-fa-ink` (#0B1215), `--color-fa-white-warm` (#FCFAF5) sono **proposte**:
   questa spec NON modifica `globals.css`. `--color-fa-card-cover` ha priorità
   (rimuove hardcode inline reale in `model-card.tsx`).
7. **`@portabletext/react` mai usato** nel progetto: primo renderer. Serializers
   custom (heading/list/strong) da definire coerenti col DS in 4.4.2 (follow-up
   A4-plan §4).
8. **EN content = IT mirror (T1).** Description EN mirror IT pre-T1; valutare
   fallback IT esplicito quando `description[$locale]` vuoto.
