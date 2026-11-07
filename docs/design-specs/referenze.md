# Design spec — Referenze (`/referenze` archive + `/referenze/[slug]` detail)

> **Status: `composed-gap`** — NON esiste un frame Figma dedicato alle pagine Referenze.
> Questa spec è una **composizione tracciata** dal pattern teaser referenza già
> presente in altre pagine (sezione dark "Da Capalbio a Capri." in Collezioni),
> dalla colonna footer "Aziende → Progetti", dalle query/schema esistenti e dai
> pattern hero/grid riusabili (AmbientHero, CollectionCard, ModelCard).
> Ogni sezione cita un anchor. **Vincolo bloccante:** lo schema `projectReference`
> è **0 documenti popolati** → empty-state elegante obbligatorio.
> **Richiede STOP HARD + approvazione prima di scrivere codice** (vedi §10 / gaps).

---

## 1. Fonte & tracciabilità

| Elemento | Anchor / sorgente |
| --- | --- |
| Pattern teaser referenza (sezione dark, heading "Da Capalbio a Capri.", card "Villa · Origo ORSO" overlay su coverImage, mini-gallery orizzontale) | Screenshot `tmp/figma-discovery/single-1-770.png` (sezione dark in fondo a Collezioni/overview) + `~/Desktop/frame fonte alta/Collezioni.pdf` |
| Colonna footer "Aziende → Progetti" (link a `/referenze`) | `tmp/figma-discovery/finiture-1-2250.png` (footer, colonna "Aziende": Chi Siamo / Finiture / Progetti) — presente in tutti i footer |
| Hero archive (dark, eyebrow oro + H1 italic Satoshi + stat opzionali) | Pattern riusato da `src/components/heros/ambient-hero.tsx` + frame `tmp/figma-discovery/finiture-1-2250.png` (hero dark "Otto finiture.") |
| Card archetipo (cover + eyebrow + title + meta, hover lift, rounded 12) | Componente esistente `src/components/cards/collection-card.tsx` |
| Card overlay (testo su coverImage, scrim) | Teaser "Villa · Origo ORSO" in `single-1-770.png` |
| Detail: hero / gallery / story / collezioni usate | `REFERENCE_BY_SLUG_QUERY` (`sanity/lib/queries.ts:125`) + schema `sanity/schemas/documents/reference.ts` |
| Archive query (order year desc) | `REFERENCES_OVERVIEW_QUERY` (`sanity/lib/queries.ts:111`) |
| Routing (già presente in pathnames map) | `src/i18n/routing.ts:33-37` — `/referenze` IT ↔ `/projects` EN ; `/referenze/[slug]` ↔ `/projects/[slug]` |

**File usati (solo disco, nessun Figma MCP):** `single-1-770.png`, `finiture-1-2250.png`, `Collezioni.pdf`, schema `reference.ts`, `queries.ts`, `routing.ts`, `collection-card.tsx`, `model-card.tsx`, `ambient-hero.tsx`, `globals.css`.

---

## 2. Struttura sezioni

### `/referenze` (archive) — ISR via `ALL_REFERENCE_SLUGS_QUERY` non serve (lista), render con `REFERENCES_OVERVIEW_QUERY`

| # | Sezione | Anchor |
| --- | --- | --- |
| A1 | **Archive hero** — dark, eyebrow oro ("Referenze" / "Projects"), H1 italic Satoshi (es. "Progetti firmati Fontealta."), sottotitolo breve | Pattern `ambient-hero.tsx` + hero dark `finiture-1-2250.png` |
| A2 | **Grid referenze** — light section, griglia card (title, architect, location · year, coverImage). **Empty-state** quando 0 documenti | Teaser card `single-1-770.png` + griglia `collection-card.tsx` |
| A3 | **Footer** (globale, riuso) — la colonna "Aziende" evidenzia "Progetti" come voce attiva | `finiture-1-2250.png` footer |

### `/referenze/[slug]` (detail) — ISR, `generateStaticParams` da `ALL_REFERENCE_SLUGS_QUERY`

| # | Sezione | Anchor |
| --- | --- | --- |
| D1 | **Detail hero** — dark, coverImage full-bleed + scrim, eyebrow (category), H1 title italic, meta riga (architect · location · country · year) | Teaser overlay "Villa · Origo ORSO" `single-1-770.png` + `ambient-hero.tsx` scrim |
| D2 | **Story** — light section, PortableText (block[]), container narrow editoriale | `story` field, schema `reference.ts:83` |
| D3 | **Gallery** — array immagini `imageWithMeta`, layout a griglia/righe; **empty-state** se vuoto | `gallery` field, schema `reference.ts:77` + mini-gallery teaser `single-1-770.png` |
| D4 | **Collezioni usate** — riga di CollectionCard (riuso) linkate a `/collezioni/[slug]` | `collectionsUsed[]->` `REFERENCE_BY_SLUG_QUERY:140` |
| D5 | **Footer** (globale, riuso) | `finiture-1-2250.png` |

---

## 3. Layout / grid

- **Container:** `--container-max: 1200px` via `.fa-container` (riuso). Detail story usa `.fa-container.narrow` (800px) per leggibilità editoriale.
- **Archive hero (A1):** allineamento sx come `ambient-hero.tsx` (`marginLeft: max(24px, calc((100vw - 1240px) / 2))`, blocco max ~720px), min-height ridotto rispetto all'ambient hero (NO 100vh — è archive, non landing): `clamp(60vh, 70vh, 720px)`.
- **Grid referenze (A2):**
  - Desktop ≥1024px: 3 colonne `grid-template-columns: repeat(3, 1fr)`, gap 24/48.
  - Tablet 768–1023px: 2 colonne.
  - Mobile <768px: 1 colonna.
  - Card aspect: **`4/5`** (coerente con `collection-card.tsx`) per la cover.
- **Detail hero (D1):** full-bleed coverImage `<Image fill priority sizes="100vw">`, blocco testo sx come ambient hero. min-height `clamp(70vh, 80vh, 820px)`.
- **Gallery (D3):** griglia 2 colonne desktop, 1 mobile; immagini `imageWithMeta` con `sizes` responsive. Layout a mosaico opzionale (riga larga + 2 quadrati) ispirato alla mini-gallery del teaser — **MA** vedi §10: il teaser mostra una row orizzontale, non specificato per detail → default griglia regolare.
- **Breakpoint:** allineati al resto del sito (`1024px` desktop switch in `.fa-section`).

---

## 4. Tipografia

| Testo | Token / scala | Note |
| --- | --- | --- |
| Eyebrow archive/detail | `.fa-eyebrow.on-dark` (uppercase, letter-spacing, colore `--fa-navy-bright`) — variante oro `#c4a35a` come in `ambient-hero.tsx` se su hero dark | Riuso classe esistente |
| H1 archive | Satoshi **italic** 500, `clamp(64px,11vw,128px)`, lineHeight 0.92, letterSpacing -0.02em (pattern `ambient-hero.tsx`) — **NO Cormorant** (anti-pattern DESIGN-SYSTEM §11) | Mapping a "display-hero" |
| H1 detail (su cover) | come archive ma ridotto `clamp(48px,8vw,96px)` per non sovrastare la foto | |
| Card title (A2) | "Card Title" Figma = Satoshi Bold **22 / lineHeight 1.2 / letterSpacing -0.2** → mappa a `.fa-h4` (1.5rem ≈ 24px, lh 1.20, ls -0.2px). Anchor: variabile tipo Figma "Card Title". | Match diretto `.fa-h4` |
| Card meta (architect · location · year) | micro-label uppercase 10–11px, letter-spacing 0.4–0.5px, opacità ridotta — pattern meta `model-card.tsx` (code/collection label) | |
| Story body | `.fa-body-lg` (1.125rem / lh 1.65) per paragrafi PortableText | |
| Section heading interne (Story / Gallery / Collezioni usate eyebrow) | "Section Heading" Figma = Satoshi Bold **36 / lh 1.12 / ls -0.5** → mappa a `.fa-h3` (2.25rem ≈ 36px, lh 1.12, ls -0.3px) o `.fa-h2`. Anchor: variabile Figma "Section Heading". | |

---

## 5. Colori & superfici (token riconciliati)

| Uso | Token | Note |
| --- | --- | --- |
| Hero archive / detail (dark) | `--color-fa-black` (#1a1a18) via `.fa-section.dark` | **Proposta:** valutare `--color-fa-ink` (#0B1215, NEW da Figma `Brand/black`) per le sezioni dark più fredde — vedi §New tokens. Default attuale `fa-black`. |
| Grid section bg (light) | `--color-fa-surface` (#FAF8F5) via `.fa-section.light` | MATCH Figma `Brand/surface` |
| Card surface | `--color-fa-surface` (`bg-fa-surface`, riuso card) | |
| Card cover placeholder (empty / no coverImage) | **NEW** `--color-fa-card-cover` (#ECE9E3) — oggi hardcoded inline `model-card.tsx` `background:#ece9e3` | Anchor Figma `color/grey/91` |
| Testo on-dark | `--color-fa-text-on-dark` (#F6F4F0) | MATCH |
| Testo primario | `--color-fa-text-primary` (#1A1A18) | MATCH |
| Eyebrow accent | `--color-fa-navy-bright` (#3D5F99) o oro `#c4a35a` (già inline in `ambient-hero.tsx`) | il valore oro NON è ancora token — vedi gap §10 |
| Scrim hero/cover overlay | gradiente rgba su `fa-black`/`fa-ink` (pattern `ambient-hero.tsx` scrim sx→dx + bottom) | non-token (overlay) |
| Shadow card | `--shadow-card` (riuso), hover `--shadow-product` | come `collection-card.tsx` |

**Regola:** nessun hex sciolto nel codice tranne i token sopra; gli scrim sono overlay legittimi (gradiente, non superficie).

---

## 6. Spacing (scala 6 / 8 / 12 / 24 / 48)

- **Section padding:** `.fa-section` = 96px (mobile) / 136px (≥1024px) verticale, 24px orizzontale (riuso).
- **Grid gap referenze:** `24px` (colonne) / `48px` (righe) — scala Figma `24` / `48(l)`.
- **Card interna (cover→meta):** padding `px-4 pt-3.5 pb-4` (riuso `collection-card.tsx`) ≈ 16/14.
- **Meta gap (architect/location/year):** `6` / `8(xs)` tra micro-label e valore (scala Figma item-spacing).
- **Tag/pill gap (se category come pill):** `12` (scala Figma).
- **Hero blocco → stat/meta:** `mt-12` (48) tra H1 e meta-riga (pattern ambient hero).
- **Story paragraph rhythm:** gap `24` tra blocchi PortableText.

---

## 7. Componenti usati (reuse vs nuovo)

| Componente | Reuse / Nuovo | Note |
| --- | --- | --- |
| **Archive hero (A1)** | **Adatta** da `AmbientHero` | Variante presentazionale: stesse classi/scrim, ma stat opzionali/assenti (archive non ha stat semantici). Estrarre o duplicare? → decisione code-time, vedi gap. |
| **ReferenceCard (A2)** | **NUOVO** componente `src/components/cards/reference-card.tsx` | Basato su `CollectionCard`: stessa shell (`bg-fa-surface`, rounded-12, shadow-card, hover lift, aspect 4/5), MA cover = `coverImage` Sanity (non monogram gradient) + meta = architect / location · year invece di articleCount. Link a `/referenze/[slug]` via pathnames object form. |
| **Card overlay variant (D1 hero)** | **NUOVO** (parte di detail hero) | Testo (title + meta) overlaid su coverImage con scrim — pattern teaser "Villa · Origo ORSO". |
| **Story renderer (D2)** | **Riuso/NUOVO** PortableText renderer | Serve un `<PortableText>` component (verificare se già esiste; altrimenti nuovo, scope minimo block + ev. inline). |
| **Gallery (D3)** | **NUOVO** `reference-gallery` | Griglia `imageWithMeta` con `next/image` `fill`. |
| **CollectionCard (D4)** | **Riuso** `src/components/cards/collection-card.tsx` | Per "collezioni usate", linka `/collezioni/[slug]`. |
| **Footer / Navigation** | **Riuso** (Boss baseline) | Footer colonna "Aziende → Progetti" già prevista. |
| **Empty-state block** | **NUOVO** | Vedi §9; elegante, dark o light, copy da i18n (non hardcoded business copy). |
| **Pill category** (opzionale) | **Riuso** `.fa-pill` / `.fa-tag` | Per `category` (hospitality / residenziale / yacht / beach-club / spa-wellness). |

---

## 8. Stati & motion (solo CSS + IntersectionObserver, NO GSAP)

- **Card hover (A2 / D4):** `hover:-translate-y-1` + `hover:shadow-[var(--shadow-product)]`, transition `400ms var(--ease-out-expo)` (riuso esatto `collection-card.tsx`). Cover image `group-hover:scale-[1.04]`.
- **Focus:** `focus-visible:ring-2 ring-fa-navy ring-offset-4` (riuso pattern card).
- **Scroll reveal:** usare `useScrollReveal` (`src/hooks/use-scroll-reveal.ts`, state-based, rispetta `prefers-reduced-motion`) per fade-in grid card e sezioni detail. NO GSAP/Lenis (Sprint 2 locked).
- **Hero:** `<Image priority>` per LCP, nessuna animazione di entrata sul fold.
- **Empty-state:** statico, nessuna animazione richiesta.
- **prefers-reduced-motion:** disattiva translate/scale (gestito dal hook + media query globale).

---

## 9. Mapping Sanity (campo → sezione, empty-state)

Schema `projectReference` (`sanity/schemas/documents/reference.ts`) — **document-level i18n** (filtro `language == $locale`).

| Campo Sanity | Sezione | Empty-state |
| --- | --- | --- |
| `title` (string, required) | A2 card title, D1 hero H1 | n/a (required) |
| `slug` (slug, required) | routing `/referenze/[slug]` | n/a |
| `architect` (string) | A2 meta, D1 meta | nascondi riga se assente |
| `location` (string) | A2 meta (`location · year`), D1 meta | nascondi segmento |
| `country` (string) | D1 meta | nascondi segmento |
| `category` (enum: hospitality / residenziale / yacht / beach-club / spa-wellness) | D1 eyebrow, opzionale pill A2 | nascondi |
| `year` (number) | A2 meta, D1 meta, **ordinamento** (`order(year desc)`) | nascondi segmento |
| `coverImage` (imageWithMeta, **required**) | A2 cover, D1 hero bg | fallback `--color-fa-card-cover` + monogram se asset mancante (drafts) |
| `gallery` (imageWithMeta[]) | D3 | **empty-state**: ometti sezione gallery se array vuoto |
| `story` (block[]) | D2 | ometti sezione story se vuoto |
| `collectionsUsed` (ref[]→collection) | D4 | ometti sezione se vuoto |
| `seo` (seoFields) | `generateMetadata` | fallback a `siteSettings.defaultSeo` |
| `order` (number) | tie-break ordinamento dopo `year` | default 100 |

### Empty-state ARCHIVE (vincolo bloccante — 0 documenti popolati)

`REFERENCES_OVERVIEW_QUERY` ritorna `[]` finché Andrea non popola i 5 progetti dai sorgenti HTML. La pagina **deve** renderizzare un empty-state elegante (non una griglia vuota, non un 404):

- Hero A1 invariato (sempre presente).
- Al posto della grid A2: blocco centrato light/dark con eyebrow + frase placeholder + (opzionale) CTA "Contattaci" → `/contatti`.
- **Copy da i18n** (`messages/it.json` / `en.json`, namespace `referenze`), **non hardcoded** nel JSX. Esempio chiave: `referenze.emptyTitle`, `referenze.emptyBody`, `referenze.emptyCta`.
- Nessun dato business (nomi progetti, "Da Capalbio a Capri", "Villa · Origo ORSO") va hardcoded: sono contenuti Andrea/Sanity.

**Nota Sanity-first generale:** come per i model (`primaryImage` 0/591, `specs` 0/591), tutti i campi referenza sono **0/N popolati** oggi. Ogni sezione detail va gated su presenza dato.

---

## 10. Gap & scostamenti Figma

1. **NESSUN frame Figma dedicato a Referenze** — pagina interamente composta. Status `composed-gap`. Anchor solo da teaser + footer + pattern riusati. **→ Richiede STOP HARD + approvazione di Andrea/Marco prima di scrivere qualsiasi codice.**
2. **Layout detail (`/referenze/[slug]`) non disegnato** — story/gallery/collezioni-usate sono inferiti da schema + convenzioni del sito. Ordine sezioni (Story prima o dopo Gallery?) da confermare in approvazione.
3. **Gallery layout** — il teaser mostra una **row orizzontale** di mini-immagini; per il detail ho proposto griglia regolare (più robusta con N immagini variabile). Mosaico ispirato al teaser è opzionale → decisione design.
4. **Stat hero archive** — `AmbientHero` ha 3 stat (collezioni/articoli/finiture); l'archive referenze non ha stat semantici ovvi (potrebbe contare progetti/paesi/anni). Default: **nessuna stat**, solo eyebrow + H1 + sottotitolo. Da confermare.
5. **Token oro `#c4a35a`** usato inline in `ambient-hero.tsx` per eyebrow su dark NON è un token globals.css. Se l'eyebrow referenze lo riusa, va promosso a token (es. `--color-fa-gold`) o si usa `--fa-navy-bright`. Scostamento da risolvere.
6. **`category` enum → label localizzata** — i valori enum sono in inglese/italiano misto (`hospitality`, `residenziale`...). Servono label i18n per display; non mostrare il raw value.
7. **Empty-state copy** — non presente in Figma; va scritto come placeholder editoriale e approvato (tono "understated luxury").
8. **Riuso AmbientHero**: l'hero archive non è identico (no full-height 100vh, no stat). Decisione: parametrizzare `AmbientHero` (rischio toccare componente FASE 4.3, fuori scope read-only) **vs** nuovo `ReferenceArchiveHero`. Propongo nuovo componente per non modificare baseline 4.3.
9. **`ReferenceCard` nuovo** — non esiste; va creato. Scope: estende il pattern `CollectionCard` con cover Sanity invece di monogram-gradient.
10. **i18n namespace `referenze`** non ancora in `messages/*.json` — va aggiunto (eyebrow, hero copy, empty-state, label category, meta separators).

---

## Proposte nuovi token (da lista autorizzata Figma reconciliation)

| Token proposto | Hex | Rationale / anchor |
| --- | --- | --- |
| `--color-fa-card-cover` | `#ECE9E3` | Figma `color/grey/91`; oggi hardcoded inline in `model-card.tsx`. Usato come bg cover placeholder ReferenceCard quando coverImage manca. Promuovere a token elimina magic-hex. |
| `--color-fa-ink` (opzionale) | `#0B1215` | Figma `Brand/black` (near-black più freddo di `fa-black #1a1a18`). Candidato per hero dark referenze se si vuole il tono Figma; altrimenti restare su `fa-black`. Decisione design. |
| `--color-fa-white-warm` (opzionale) | `#FCFAF5` | Figma `Brand/white` (tra `fa-paper` e `fa-surface`). Eventuale bg sezione story per calore editoriale. Non strettamente necessario. |
| `--color-fa-gold` (da valutare) | `#c4a35a` | Già usato inline in `ambient-hero.tsx` per eyebrow su dark; NON in lista Figma autorizzata → proporre solo se confermato come accent referenze, altrimenti usare `--fa-navy-bright`. |
