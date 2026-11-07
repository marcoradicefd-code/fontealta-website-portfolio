# Design spec — Chi siamo (`/chi-siamo` IT · `/about` EN)

> **Status:** `composed-gap`. Route non ancora implementata (`find src/app -ipath "*chi-siamo*"` → vuoto; pathname registrato in `src/i18n/routing.ts:30` `"/chi-siamo": { it: "/chi-siamo", en: "/about" }`). Spec design-backed dal frame Figma, ma composizione codice da costruire ex-novo riusando primitive Boss + utility `@layer components`.

---

## 1. Fonte & tracciabilità

- **Node Figma sorgente:** `195:1759` "Chi siamo" (artboard 1440 × 2802).
- **File usati (read-only su disco — NO Figma MCP):**
  - `/Users/mrc1/Desktop/frame fonte alta/Chi siamo.pdf` (pagina 1, render full-frame — copy verbatim estratta).
  - `/Users/mrc1/Desktop/frame fonte alta/Chi siamo.png` (1440 × 2802).
  - `/Volumes/PortableSSD/01_Clienti/sito fonte-alta/fontealta-website/tmp/figma-discovery/chisiamo-195-1759.png` (screenshot discovery).
- **Token reconciliation:** facts autoritativi forniti nel brief (file Figma `Due5MkbcyoGR51cExOI3Ve`) — non ri-queriati.
- **Anchor codice riusati:** `src/app/globals.css` (`@layer components`), `src/components/ui/section.tsx`, `src/components/ui/button.tsx`, `src/components/heros/ambient-hero.tsx` (pattern hero dark + scrim + `<Image fill>` poster), `src/components/layout/Footer`.

---

## 2. Struttura sezioni (ordine + gerarchia)

| # | Sezione | Sfondo | Anchor |
|---|---------|--------|--------|
| 1 | **Hero dark** — eyebrow logo monogram + H1 "Versatili come l'acqua." + sottotitolo, full-bleed su immagine stabilimento (scrim scuro) | dark (near-black) | Figma `195:1759` hero band (0–525px); pattern `ambient-hero.tsx` |
| 2 | **"Un legame inossidabile"** — split editoriale: immagine prodotto B/N a sx + eyebrow "Chi siamo" / H2 / paragrafo lungo storia AISI 316 a dx | dark | Figma `195:1759` band 525–1180px |
| 3 | **"Progettare in lungo e in largo"** — H2 centrato + form lead (DATI PERSONALI / EMAIL / TELEFONO / AZIENDA / DI COSA HAI BISOGNO) + CTA INVIA pill | dark | Figma `195:1759` band 1180–1560px |
| 4 | **Footer** — monogram + indirizzo/P.IVA + 4 colonne (Collezioni / Su di noi / Contatti / Legal + Area Riservata) + copyright | dark | Figma `195:1759` band 1560–2802px; componente Boss `Footer` |

Gerarchia headings: H1 hero (sez. 1) → H2 sez. 2 → H2 sez. 3. Una sola H1 per pagina.

---

## 3. Layout / grid

- **Container max:** `--container-max: 1200px` (`.fa-container`), centrato. Hero usa offset asimmetrico sx come `ambient-hero.tsx` (`marginLeft: max(24px, calc((100vw - 1240px)/2))`).
- **Sezione 1 (hero):** full-bleed 100vw, immagine `object-cover` con `<Image fill>`; contenuto testuale allineato a sinistra entro container; minHeight ~525px nel frame (proporzionalmente più contenuto del 100vh degli ambient hero — vedi §10 scostamento).
- **Sezione 2 (split):** 2 colonne desktop ≈ 5/7 — immagine sx (≈ 40% larghezza, card con `border-radius` ~`--radius-xl` 16px), testo dx (≈ 50%, max ~520px misura di lettura). Gap colonne `48px` (token L). Responsive: stack verticale < 768px (immagine sopra, testo sotto).
- **Sezione 3 (form):** contenuto centrato, max ~720px (`.fa-container.narrow` = 800px è il più vicino; usare 720px). Form grid 2 colonne (Nome/Cognome, Email/Telefono, Azienda/Di cosa hai bisogno) collassa a 1 colonna < 640px. CTA centrata.
- **Breakpoint:** allineati a `@layer components` — `1024px` (`.fa-section` padding step), `768px` / `640px` per stack form & split.
- **Section padding verticale:** `.fa-section` = `96px` mobile / `136px` desktop ≥1024px.

---

## 4. Tipografia

Token scale da `globals.css @theme` + `@layer components`. Font: Satoshi variable (`--font-sans`).

| Elemento | Token / classe | Size | line-height | weight | letter-spacing | Note |
|----------|----------------|------|-------------|--------|----------------|------|
| Hero eyebrow (monogram lockup) | `.fa-eyebrow.on-dark` | 13px | — | 500 | 0.5px | uppercase; logo "FONTEALTA" monogram + wordmark |
| **H1 hero** "Versatili come l'acqua." | `.fa-h1` (clamp 2.5→4rem) | `--text-display-hero` 4rem | 1.05 | 600 | -0.5px | Sentence case; **NON italic** (vedi §10 vs ambient-hero) |
| Hero sottotitolo | `.fa-body-lg` | `--text-body-lg` 1.125rem | 1.65 | 400 | — | colore on-dark secondary |
| Sez.2 eyebrow "Chi siamo" | `.fa-eyebrow.on-dark` | 13px | — | 500 | 0.5px | uppercase |
| **H2** "Un legame inossidabile" | `.fa-h2` (clamp 2→3rem) | `--text-display-secondary` 3rem | 1.08 | 600 | -0.4px | Figma "Section Heading" = 36/1.12/-0.5 → usare `.fa-h3` (2.25rem/1.12/-0.3) se si vuole aderenza esatta al token Figma; default spec `.fa-h2` per coerenza con altre pagine (vedi §10) |
| Sez.2 paragrafo storia | `.fa-body-lg` | 1.125rem | 1.65 | 400 | — | misura ~520px |
| **H2** "Progettare in lungo e in largo." | `.fa-h2` | 3rem | 1.08 | 600 | -0.4px | centrato |
| Form label (DATI PERSONALI, EMAIL…) | `.fa-eyebrow.on-dark` o `--text-micro` | 11px | 1.45 | 500 | 0.2–0.4px | uppercase |
| Form input placeholder / value | `--text-body-sm` | 0.875rem | 1.55 | 400 | — | colore on-dark secondary per placeholder |
| CTA "INVIA" | `--text-button` | 0.9375rem | 1 | 500 | 0.3px | uppercase (pill) |
| Footer headings colonne | `--text-caption`/`.fa-eyebrow` | 13px | 1.4 | 500 | uppercase | componente Boss |

Regole tipografiche locked: apostrofo curly `'` (U+2019) in "l'acqua" / "dall'", sentence case headings, NO Cormorant.

---

## 5. Colori & superfici (token riconciliati)

Tutte le superfici della pagina sono **dark** (la pagina non ha sezioni light).

| Uso | Token riconciliato | Note |
|-----|--------------------|------|
| Sfondo sezioni dark | `--color-fa-black` (#1a1a18) | **PROPOSTA:** valutare `--color-fa-ink` (#0B1215) — il dark del frame Figma è percettivamente più freddo/profondo del `fa-black`. Vedi §nuovi token |
| Testo on-dark primario (H1/H2, valori) | `--color-fa-text-on-dark` (#F6F4F0) | MATCH Figma Text/on-dark |
| Testo on-dark secondario (sottotitolo, paragrafo, placeholder) | `--fa-text-on-dark-secondary` rgba(246,244,240,0.65) | |
| Eyebrow on-dark | `--fa-navy-bright` (#3D5F99) via `.fa-eyebrow.on-dark` | MATCH color/azure/42. NB: `ambient-hero` usa override oro #c4a35a (= `--color-fa-steel-bb`) per eyebrow — decidere se Chi siamo segue navy-bright (default classe) o oro brand |
| Bordi input form (underline) | `--fa-border-dark` rgba(246,244,240,0.12) / `--fa-border-dark-medium` (0.25) | underline-only inputs nel frame |
| Scrim hero su immagine | gradient nero (pattern `ambient-hero.tsx`: `linear-gradient(180/90deg rgba(10,10,9,…))` | nessun token colore — overlay funzionale |
| CTA pill bordo | `--fa-border-dark-medium` rgba(246,244,240,0.25) | outline pill, hover → fill |

Nessun hex sciolto nel body design tranne i token NUOVI proposti (§ dedicata).

---

## 6. Spacing (scala 6 / 8 / 12 / 24 / 48)

- **Padding verticale sezioni:** `.fa-section` 96px (mobile) → 136px (≥1024px). Padding orizzontale 24px.
- **Gap colonne split (sez. 2):** `48px` (token L).
- **Gap interno blocco testo (eyebrow → H2 → paragrafo):** eyebrow→H2 `24px`; H2→paragrafo `24px`.
- **Hero eyebrow→H1:** `16px` (`mt-4` come ambient-hero); H1→sottotitolo `24px`.
- **Form:** gap riga `24px`, gap colonna `24px`, label→input `8px` (token xs), H2→form `48px`, form→CTA `48px`.
- **Footer:** gap colonne `48px`, gap link verticale `8–12px`.
- Micro-spazi label/icone `6px`.

---

## 7. Componenti usati (reuse vs nuovo)

| Componente | Reuse / Nuovo | Anchor |
|------------|---------------|--------|
| **Hero dark** | Riuso pattern `src/components/heros/ambient-hero.tsx` (struttura `<section fa-section dark>` + `<Image fill priority>` poster + doppio scrim gradient). NUOVO wrapper `ChiSiamoHero` (no stats, sottotitolo invece di counter) | `ambient-hero.tsx` |
| **Section wrapper** | Riuso `<Section>` Boss + classi `.fa-section.dark` / `.fa-container` | `src/components/ui/section.tsx`, `globals.css:212` |
| **Eyebrow / H1 / H2 / body** | Riuso utility `.fa-eyebrow`, `.fa-h1`, `.fa-h2`, `.fa-body-lg` | `globals.css:192-209` |
| **Immagine split B/N** | NUOVO blocco `<Image>` Next con `border-radius` `--radius-xl`. Empty-state placeholder (M5) | — |
| **Form lead** | **NUOVO** componente client `LeadForm` (react-hook-form + Zod 4 + Resend, già in stack ma nessun form esiste: `find src -iname "*form*"` → vuoto). Inputs underline-only, select "Di cosa hai bisogno" | stack CLAUDE.md |
| **CTA "INVIA"** | Riuso `<Button>` Boss variante pill outline on-dark | `src/components/ui/button.tsx` |
| **Footer** | Riuso componente Boss `Footer` (read-only baseline) | `src/components/layout/Footer` |

---

## 8. Stati & motion (solo CSS + IntersectionObserver, NO GSAP)

- **Scroll reveal:** `.reveal` / `.reveal.visible` (`globals.css:148-167`) su blocchi sez.2 e sez.3, guidato da `useScrollReveal` (`src/hooks/use-scroll-reveal.ts`, state-based, `prefers-reduced-motion` via `useSyncExternalStore`). Stagger leggero immagine→testo.
- **Hero poster:** statico (`<Image fill priority>`), nessun parallax Sprint 2 (M15 — `<video>` rimosso, R2 swap-in futuro).
- **Form input focus:** underline `--fa-border-dark` → `--fa-border-dark-medium` o `--fa-navy-bright`, transizione `--dur-micro` (200ms) `--ease-out-expo`.
- **CTA INVIA hover:** outline pill → fill `--fa-navy` + testo on-dark, `--dur-micro`. Pattern `.fa-pill`/`.fa-pill.active` (`globals.css:245-267`).
- **Footer link hover:** opacità/colore on-dark secondary → on-dark primary, `--dur-micro`.
- `prefers-reduced-motion: reduce` → reveal disabilitato (opacity 1, no transform).

---

## 9. Mapping Sanity (campo → sezione, empty-state)

> Principio Sanity-first: copy editoriale lungo destinato ad Andrea va in Sanity, NON i18n. Micro-label UI (form labels, CTA, eyebrow) vanno in i18n namespace `chiSiamo` (da creare in `src/messages/it.json` + `en.json` — attualmente esiste solo `nav.chiSiamo` label).

| Sezione / elemento | Fonte contenuto | Campo | Empty-state |
|--------------------|-----------------|-------|-------------|
| Hero H1 "Versatili come l'acqua." | **GAP Sanity** — proposta `siteSettings` o nuovo doc `aboutPage`. Schema corrente NON ha campo storia/hero (`siteSettings` ha solo companyName/tagline/address/phone/email/social/footerColumns/seo). Fallback: i18n `chiSiamo.heroH1` | Se campo Sanity assente → i18n verbatim |
| Hero sottotitolo "Da venticinque anni…" | i18n `chiSiamo.heroSub` (copy breve) o campo Sanity `aboutPage.heroLead` | i18n fallback |
| Sez.2 eyebrow "Chi siamo" | i18n `chiSiamo.storiaEyebrow` | — |
| Sez.2 H2 "Un legame inossidabile" | i18n `chiSiamo.storiaH2` o `aboutPage.storyTitle` (localizedString) | — |
| Sez.2 paragrafo storia AISI 316 (testo lungo) | **PROPOSTA campo Sanity** `aboutPage.storyBody` (localizedPortableText) — copy editoriale = dominio Andrea | Se non popolato → render copy i18n placeholder + flag empty |
| Sez.2 immagine prodotto B/N | **GAP M5** — `aboutPage.storyImage` (imageWithMeta). Andrea popola | Placeholder grigio `--color-fa-card-cover` (#ECE9E3 proposto) / Unsplash fallback come hero (M5) |
| Hero immagine stabilimento | **GAP M5** — `aboutPage.heroImage` (imageWithMeta) | Poster Unsplash fallback (pattern `ambient-hero.tsx` POSTER_FALLBACK_URL) |
| Sez.3 H2 "Progettare in lungo e in largo." | i18n `chiSiamo.formH2` | — |
| Sez.3 form labels (Nome, Cognome, Email, Telefono, Azienda, Di cosa hai bisogno, INVIA) | i18n `chiSiamo.form.*` | — |
| Sez.3 select opzioni ("Preventivo, consulenza") | i18n `chiSiamo.form.bisognoOptions[]` | — |
| Footer indirizzo / P.IVA / contatti | `siteSettings.address`, `siteSettings.phone`, `siteSettings.email`, `siteSettings.companyName` | Già in schema — popolare |
| Footer colonne / link | `siteSettings.footerColumns[]` (localizedString label + href) | Già in schema |
| Footer social | `siteSettings.socialLinks` | — |

**Empty-state catalog-wide (flag):** `model.primaryImage` 0/591 popolati, `model.specs` 0/591 — non usati in questa pagina ma rilevanti se sez. prodotto si espande. `finish.colorHex`/`swatchImage` non popolati (M5) — non usati qui.

---

## 10. Gap & scostamenti Figma

1. **Route inesistente:** `/chi-siamo` non implementata. Pathname whitelisted (`routing.ts:30`) ma nessun `page.tsx`. → pagina `composed-gap`, build ex-novo.
2. **Namespace i18n `chiSiamo` assente:** `src/messages/it.json` ha solo `skip/nav/footer/brand/collezioni/dettaglio/ambient`. Da creare namespace `chiSiamo` (hero, storia, form labels). EN mirror IT verbatim (T1 Sprint 5-6).
3. **Schema Sanity senza copy About:** `siteSettings` non ha campi storia/hero/about. Copy editoriale lungo ("Siamo nati tra gli stabilimenti balneari…") è dominio Andrea → **proposta nuovo documento `aboutPage`** (singleton) con `heroLead`, `storyTitle`, `storyBody` (localizedPortableText), `heroImage`, `storyImage`. Senza questo, copy resta i18n-hardcoded (anti Sanity-first).
4. **H1 hero NON italic:** il frame mostra H1 dritto bold (`.fa-h1`), diverso dall'`ambient-hero.tsx` che usa Satoshi *italic* clamp 64-128px. Chi siamo segue lo stile `.fa-h1` standard del design system (sentence case, bold dritto).
5. **Eyebrow color ambiguità:** classe `.fa-eyebrow.on-dark` → navy-bright #3D5F99, ma `ambient-hero` override oro #c4a35a (steel-bb). Frame Chi siamo eyebrow appare chiaro/neutro — default spec = navy-bright, da confermare con Andrea/design se oro brand.
6. **Section Heading token mismatch:** Figma "Section Heading" = 36px / 1.12 / -0.5 (≈ `.fa-h3` 2.25rem/1.12/-0.3). Spec default usa `.fa-h2` (3rem) per coerenza con altre pagine Sprint 2 — se si vuole match pixel-perfect Figma usare `.fa-h3`. Scostamento dichiarato.
7. **Form lead net-new:** nessun componente form esiste in `src/`. Va costruito (react-hook-form + Zod + Resend già in stack). Frame mostra underline-only inputs, 3 righe a 2 colonne, select "Di cosa hai bisogno", CTA pill "INVIA".
8. **Hero height:** frame hero ~525px su 2802 (≈19%), proporzionalmente meno del `100vh` minHeight degli ambient hero. Spec: hero più contenuto (~60-70vh) per non spingere troppo in basso il contenuto editoriale.
9. **Dark surface token:** frame usa near-black freddo coerente con Figma Brand/black #0B1215, mentre `--color-fa-black` = #1a1a18 (più caldo). Proposta token `--color-fa-ink` per le dark section di questa pagina (vedi §nuovi token) — altrimenti accettare `fa-black` come scostamento minore.
