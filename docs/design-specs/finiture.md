# Spec di design — Pagina FINITURE (`/finiture`)

> Spec design-backed. Pagina overview delle 8 finiture Fontealta: hero scuro editoriale + griglia 2×4 di swatch card. I dati (codice, categoria, nome, colore swatch, descrizione) sono **content-driven da Sanity** (`finish` document), non hardcoded. Vedi §9 Mapping Sanity e §10 Gap & scostamenti.

---

## 1. Fonte & tracciabilità

| Elemento                | Riferimento                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Figma node sorgente     | `151:1723` "Finiture" — frame 1440×2772                                                                      |
| File Figma              | `Due5MkbcyoGR51cExOI3Ve`                                                                                     |
| PDF di riferimento      | `/Users/mrc1/Desktop/frame fonte alta/Finiture.pdf`                                                          |
| Screenshot discovery    | `tmp/figma-discovery/finiture-1-2250.png` (frame 1440×2772, AUTORITATIVO per node `151:1723`)               |
| Token reconciliation    | Vedi blocco "Figma → globals.css TOKEN RECONCILIATION" (facts già estratti, non ri-query Figma)             |
| Query dati esistente    | `FINISHES_OVERVIEW_QUERY` — `sanity/lib/queries.ts:99`                                                       |
| Schema dati             | `sanity/schemas/documents/finish.ts`                                                                         |
| Helper colore           | `getFinishHex(code, sanityHex)` + `FINISH_HEX_FALLBACK` — `src/lib/placeholders.ts:169-187`                  |

**Nota su due varianti di frame.** Il PDF `Finiture.pdf` (pagina 1) renderizza una variante più recente/estesa: nomi finiture in **italiano** (INOX SPECCHIO, INOX SPAZZOLATO, NERO OPACO, GREZZO CHIARO, OTTONE SCURO PVD, BRONZO BRUNITO, BRONZO SPAZZOLATO, RAME SPAZZOLATO), card con cover scura + label, e una sezione form contatti "Progettare in lungo e in largo." in coda. Lo screenshot discovery del node `151:1723` (1440×2772) mostra la variante **canonica per questo task**: nomi in inglese (Mirror Inox / Brushed Inox / Matt Black / Raw Light / Dark Brass / Antique Bronze / Burnished Bronze / Brushed Copper), card chiare senza form contatti. **Questa spec descrive il node `151:1723`** (screenshot discovery) come fonte primaria; le divergenze di naming sono irrilevanti per la spec perché i nomi sono Sanity-driven (vedi §9, §10). La sezione form del PDF NON fa parte di questo node ed è esclusa dallo scope.

---

## 2. Struttura sezioni (ordine + gerarchia)

| #   | Sezione                | Contenuto                                                                                       | Anchor                                  |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Navigation (globale)   | Nav Fontealta riusata (logo + menu + lang switch + Area Pro)                                     | node `151:1723` top bar / `src/components/layout/Navigation` (Boss baseline read-only) |
| 2   | Hero scuro             | Eyebrow "Materiali" + H1 "Otto finiture." + sottotitolo paragrafo                                | node `151:1723` (banda dark superiore)  |
| 3   | Griglia swatch 2×4     | 8 finish card (cover swatch + categoria + nome), 4 colonne × 2 righe                             | node `151:1723` (grid centrale)         |
| 4   | Footer (globale)       | Footer Fontealta riusato (4 colonne: brand / Collezioni / Azienda / Contatti + legal bar)        | node `151:1723` footer / `src/components/layout/Footer` (Boss baseline read-only) |

Gerarchia: Nav (sticky) → Hero (banda `fa-black`, full-width) → Griglia (banda chiara `fa-surface`/`fa-white`) → Footer (banda `fa-black`). Pattern dark→light→dark coerente con `/collezioni` overview e ambient pages.

---

## 3. Layout / grid

- **Container:** `.fa-container` → `--container-max: 1200px`, centrato, padding orizzontale 24px (via `.fa-section`).
- **Sezione padding:** `.fa-section` → `96px 24px` mobile, `136px 24px` da `min-width: 1024px`.
- **Griglia swatch:** 4 colonne su desktop (`grid-template-columns: repeat(4, 1fr)`), 2 righe (8 card). Gap allineato alla scala spacing Figma → **24px** (token `l`/`24`).
- **Responsive (proposto, non in Figma 1440):**
  - `≥ 1024px`: 4 colonne (2×4 come da Figma).
  - `640–1023px`: 2 colonne (4 righe).
  - `< 640px`: 1 colonna (8 righe stack).
- **Hero:** banda full-width `fa-black`; contenuto allineato a sinistra dentro `.fa-container` (eyebrow + H1 + paragrafo in colonna, allineamento a sinistra come nello screenshot discovery).
  - _Nota:_ il PDF mostra hero **centrato** con immagine di sfondo (foglia/acqua scura). Il node `151:1723` (screenshot discovery) ha hero **allineato a sinistra senza immagine di sfondo** → la spec segue il node canonico. Vedi §10.

---

## 4. Tipografia

Font unico: **Satoshi Variable** (`next/font/local`). Sentence case per tutti gli heading (no Title Case — regola locked).

| Testo                       | Token / scala                                | Size / lineHeight / weight / letterSpacing                           | Note |
| --------------------------- | -------------------------------------------- | -------------------------------------------------------------------- | ---- |
| Eyebrow "Materiali"         | `.fa-eyebrow.on-dark`                         | micro/nav scale, uppercase, letter-spacing ampio; colore `fa-navy-bright` | "Materiali" IT / "Materials" EN |
| H1 "Otto finiture."         | `.fa-h1`                                      | `clamp(2.5rem, 6vw+1rem, 4rem)` / lh 1.05 / weight 600 / ls -0.5px    | corrisponde a Figma "Section Heading" (Satoshi Bold 36/1.12/-0.5) ma scala più grande nell'hero del node |
| Sottotitolo hero            | `.fa-body-lg` (su dark, colore secondario)    | body large, lh comoda                                                | "Naturale, verniciata, PVD. Personalizzazione su richiesta in qualsiasi RAL, PANTONE, NCS." |
| Card — codice (es. "MX")    | micro-label (base 10px Figma)                 | Satoshi, ~10–11px, uppercase, colore tenue su cover                  | overlay in alto a sinistra sullo swatch |
| Card — categoria            | micro-label / `.fa-eyebrow`-like              | ~10–12px, weight medio, colore secondario                            | "Natural" / "Painted" / "PVD" (Sanity `category`, vedi §9-10) |
| Card — nome finitura        | "Card Title" Figma                            | Satoshi Bold 22 / lh 1.2 / ls -0.2px                                 | es. "Mirror Inox" — proporre util `.fa-card-title` se non esiste |

**Token nuovo proposto:** `.fa-card-title` (Satoshi 22/1.2/-0.2, weight 600) — vedi `newTokensProposed`. Riusa `.fa-eyebrow` per categoria.

---

## 5. Colori & superfici (token riconciliati / nuovi proposti)

| Uso                                  | Token globals.css                              | Match Figma |
| ------------------------------------ | ---------------------------------------------- | ----------- |
| Hero background                      | `--color-fa-black` (#1A1A18)                    | Text/primary MATCH. _Figma dark sections usano Brand/black #0B1215 (più freddo)_ → vedi proposta `--color-fa-ink` |
| Hero testo principale                | `--color-fa-white` (#F6F4F0)                    | Text/on-dark MATCH |
| Eyebrow accent                       | `--color-fa-navy-bright` (#3D5F99)              | color/azure/42 MATCH |
| Banda griglia (superficie chiara)    | `--color-fa-surface` (#FAF8F5) o `fa-white`     | Brand/surface MATCH. _Figma usa anche Brand/white #FCFAF5_ → proposta `--color-fa-white-warm` |
| Card background                      | `--color-fa-surface` / `--color-fa-paper`       | — |
| Card cover (sfondo dietro swatch)    | **PROPOSTO `--color-fa-card-cover` (#ECE9E3)**  | color/grey/91 — oggi hardcoded inline `#ece9e3` in `model-card.tsx:53` |
| Swatch colore finitura               | **render da Sanity** `getFinishHex(code, finish.colorHex)` → fallback `FINISH_HEX_FALLBACK` (8 token `--color-fa-steel-*`) | vedi §10 divergenza M10 |
| Card testo (nome/categoria)          | `--color-fa-black` / `--color-fa-text-secondary` | — |
| Footer                               | `--color-fa-black` + `--color-fa-white`         | MATCH |

**Swatch — regola autoritativa (M10).** Il colore renderizzato di ogni swatch NON deriva dal nome Figma. Ordine di precedenza:
1. `finish.swatchImage` da Sanity (quando popolata da Andrea — M5, oggi 0/8).
2. `finish.colorHex` da Sanity.
3. Fallback `FINISH_HEX_FALLBACK[code]` (8 token `--color-fa-steel-*` di globals.css).

I 4 swatch "metallici" del Figma (gradiente conico argento/oro/rame) sono un effetto visivo di mockup: con fallback hex si renderizza una tinta piatta. Lo swatch realistico arriverà via `swatchImage` (M5). Vedi §10.

---

## 6. Spacing (scala 6 / 8 / 12 / 24 / 48)

- **Sezione hero / griglia:** padding verticale `.fa-section` (96 mobile / 136 desktop). Coerente con il sistema; la scala Figma item-spacing (6/8/12/24/48) regola gli spazi interni.
- **Griglia swatch gap:** **24px** (token `l`-adiacente / `24`).
- **Card interna:**
  - cover → blocco testo: gap **12px**.
  - codice overlay padding: **8px** (xs) dai bordi cover.
  - categoria → nome: gap **6px** (micro).
  - padding contenuto card sotto la cover: **12–24px**.
- **Hero:** eyebrow → H1 gap **12px**; H1 → sottotitolo gap **24px**.
- **Card radius:** `rounded-[12px]` (coerente con `model-card.tsx` e shadow `--shadow-card`).

---

## 7. Componenti usati (reuse vs nuovo)

| Componente            | Stato      | Note |
| --------------------- | ---------- | ---- |
| `Navigation`          | **reuse**  | Boss baseline (`src/components/layout/`) — read-only |
| `Footer`              | **reuse**  | Boss baseline — read-only |
| `.fa-section` / `.fa-container` / `.fa-eyebrow` / `.fa-h1` / `.fa-body-lg` | **reuse** | utility `@layer components` esistenti |
| **FinishCard** (swatch card) | **NUOVO** | Server Component presentational. Pattern molto vicino a `ModelCard` (`src/components/cards/model-card.tsx`): cover quadrata/rettangolare con radius 12px + shadow-card, overlay codice, blocco categoria+nome. Differenza: la cover è lo **swatch finitura** (image o tinta hex via `getFinishHex`), non il monogram. Riusare `getFinishHex` + token `--color-fa-card-cover`. |
| `getFinishHex` helper | **reuse**  | `src/lib/placeholders.ts:180` |

**Raccomandazione:** collocare `FinishCard` in `src/components/cards/` accanto a `ModelCard`/`CollectionCard`, e la sezione griglia come `_components/finishes-grid.tsx` sotto la route `(site)/[locale]/finiture/`. (Allineato a M16: evitare component route-scoped condivisi.)

---

## 8. Stati & motion (solo CSS + IntersectionObserver, NO GSAP)

- **Card hover:** lieve sollevamento — `transform: translateY(-2px)` + intensificazione `--shadow-card`, transizione `--dur-standard` `--ease-out-expo`. _Opzionale_, da valutare con M9: le card finitura non sono cliccabili (no detail route) quindi l'hover lift potrebbe dare falsa affordance di click. Consigliato hover **statico** (nessun lift) o solo leggero glow sullo swatch, coerente con la scelta `ModelCard` (lift omesso intenzionalmente).
- **Scroll reveal:** entrata fade/translate via `useScrollReveal` (`src/hooks/use-scroll-reveal.ts`, state-based, rispetta `prefers-reduced-motion`). Stagger leggero sulle card della griglia.
- **Reduced motion:** tutte le transizioni disabilitate via `prefers-reduced-motion: reduce` (gestito dall'hook + CSS guard).
- **Nessun GSAP/Lenis** (posticipati Sprint 3+).

---

## 9. Mapping Sanity (campo → sezione, empty-state)

Query: `FINISHES_OVERVIEW_QUERY` (`sanity/lib/queries.ts:99`), parametro `$locale`. Schema: `finish` (8 documenti).

| Campo Sanity              | Sezione/elemento            | Tipo                         | Empty-state |
| ------------------------- | --------------------------- | ---------------------------- | ----------- |
| `finish.code`             | Card — codice overlay (MX…) | string uppercase             | sempre presente (required) |
| `finish.category`         | Card — label categoria      | enum natural/mirror/painted/pvd | required; renderizzare label localizzata (vedi §10: enum value ≠ display Figma) |
| `finish.name[$locale]`    | Card — nome finitura        | localizedString → `{it,en}`  | required. Cast `as unknown as {it?,en?}` (M6). Fallback `name.it` se locale assente |
| `finish.colorHex`         | Swatch tinta (fallback)     | string `#RRGGBB`             | **0/8 popolati** → fallback `FINISH_HEX_FALLBACK[code]` (M5). NON hardcodare colore |
| `finish.swatchImage`      | Swatch cover (immagine)     | imageWithMeta                | **0/8 popolati** (M5) → fallback a tinta hex |
| `finish.description[$locale]` | (opzionale) tooltip/testo card | localizedText            | opzionale; il node Figma NON mostra description nelle card → non renderizzata in v1, riservata per detail/tooltip futuro |
| `finish.order`            | ordinamento griglia         | number                       | `order asc` → determina sequenza MX, BX, MB, RL, DB, AB, BB, BC |

**Hero — contenuto.** Eyebrow / H1 / sottotitolo dell'hero NON hanno un campo Sanity dedicato in v1 (nessun `siteSettings.finiturePage`). Sono testo localizzato statico dai messaggi next-intl (file `it.json`/`en.json`). Flag come gap: se Andrea vuole editare hero copy → proporre campi in `siteSettings` (vedi §10).

**Conteggio "Otto / 8".** Il numero nel titolo è statico nel design. Idealmente derivato da `count(*[_type=="finish"])` per evitare drift se il catalogo cambia. In v1 testo statico ("Otto finiture." IT / "Eight finishes." EN) — flag gap.

---

## 10. Gap & scostamenti Figma

1. **M10 CRITICO — divergenza naming/colore finiture Figma ↔ Sanity ↔ globals.** Il codice `DB` è l'esempio cardine:
   - **globals.css:** `--color-fa-steel-db: #1c1c1a` commento "PVD Polished Deep Black" (near-black scuro).
   - **Figma node 151:1723:** swatch `DB` = oro caldo, nome "Dark Brass".
   - **Sanity:** `finish[code=="DB"].name` + `colorHex` sono **autoritativi**.
   - **Regola spec:** i NOMI mostrati derivano da `finish.name[$locale]`, i COLORI da `finish.swatchImage`/`finish.colorHex` con fallback `FINISH_HEX_FALLBACK`. Il design Figma è indicativo. Stessa cautela su tutti gli 8 codici: il mockup mostra 4 swatch metallici a gradiente conico (effetto render) e nomi che variano tra IT (PDF) ed EN (node) — irrilevante perché content-driven. **Azione:** finché M10 non è risolto con Andrea, il fallback hex potrebbe non combaciare col nome Sanity (es. fallback DB scuro vs nome "Dark Brass"/oro). Documentato; risoluzione = popolare `finish.colorHex`/`swatchImage` (M5) o riconciliare i token globals (M10).

2. **Swatch metallico vs tinta piatta.** Figma mostra gradienti conici metallici fotorealistici. Con fallback hex si renderizza tinta piatta. Realismo arriva da `finish.swatchImage` (M5, 0/8 oggi). Empty-state v1 = tinta piatta `getFinishHex`.

3. **Hero: allineamento e background.** Node `151:1723` (screenshot discovery) = hero **allineato a sinistra, sfondo dark piatto, senza immagine**. PDF = hero **centrato con immagine di sfondo** (foglia/acqua) + numero "8" invece di "Otto". La spec segue il node canonico (sinistra, no immagine). Se si preferisce la variante PDF (immagine hero), richiede asset M5 + decisione di allineamento.

4. **Sezione form contatti.** Presente nel PDF ("Progettare in lungo e in largo." + form Dati personali) ma NON nel node `151:1723`. Esclusa dallo scope di questa pagina; appartiene a un frame/route diverso (probabile pattern CTA condiviso o pagina Contatti).

5. **`--color-fa-ink #0B1215`.** Le dark section Figma usano un near-black più freddo del `fa-black #1a1a18`. Proposto token additivo `--color-fa-ink`. Non bloccante: hero v1 può usare `fa-black` esistente.

6. **`--color-fa-card-cover #ECE9E3` hardcoded.** Oggi `#ece9e3` inline in `model-card.tsx:53`. Proposto token per riuso in `FinishCard` ed eliminare l'hardcode.

7. **Categoria label localizzata.** Enum Sanity `category` ha value tecnici (`natural`/`mirror`/`painted`/`pvd`). Il Figma mostra label capitalizzate ("Natural"/"Painted"/"PVD"). Serve una mappa value→label localizzata (IT: "Naturale"/"Specchio"/"Verniciato"/"PVD"; EN: "Natural"/"Mirror"/"Painted"/"PVD") — non esiste ancora. Gap di i18n da definire nei messaggi next-intl.

8. **Hero copy non in Sanity.** Eyebrow/H1/sottotitolo statici (next-intl). Se editabili da Andrea → proporre `siteSettings.finiturePage.{eyebrow,title,subtitle}`. Numero "8" idealmente da `count()` per evitare drift.
