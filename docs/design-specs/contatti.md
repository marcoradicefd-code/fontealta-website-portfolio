# Spec di design — Contatti `/contatti`

> Pagina contatti Fontealta. Status: **design-backed** (frame Figma dedicato 187:1759, 1440×2911).
> Route IT canonica `/contatti` · EN `/contact` (già in `src/i18n/routing.ts` pathnames map).
> Namespace i18n: `contatti` (da creare in `src/messages/{it,en}.json`).

---

## 1. Fonte & tracciabilità

| Voce | Riferimento |
| --- | --- |
| Figma node sorgente | `187:1759` "Contatti" (frame 1440×2911) — file `Due5MkbcyoGR51cExOI3Ve` |
| File usati | `/Users/mrc1/Desktop/frame fonte alta/Contatti.pdf` (render pagina 1) + screenshot `tmp/figma-discovery/contatti-187-1759.png` |
| Token reconciliation | sezione "Figma → globals.css TOKEN RECONCILIATION" del brief (autoritativa, non ri-queryata) |
| Codice di riferimento riusato | `src/components/heros/ambient-hero.tsx` (pattern hero dark poster), `src/components/ui/button.tsx`, `src/components/layout/footer.tsx`, `src/app/globals.css` (`@layer components`) |

**NOTA scope:** il blocco CTA "Sei un progettista? Accedi / Registrati" è presente nel design ed è in-scope come **teaser visivo**; la destinazione Area Pro (auth, `/area-pro`) è **FASE 8 fuori scope** — i due bottoni linkano a `/area-pro` placeholder (route già in pathnames map) senza implementare login.

---

## 2. Struttura sezioni (ordine + gerarchia)

| # | Sezione | Sfondo | Anchor Figma | Note |
| --- | --- | --- | --- | --- |
| 0 | Navigation (globale) | trasparente su hero | riuso `Navigation` | non parte del frame contenuto, layout-level |
| 1 | **Hero dark** — eyebrow "Consulenza personalizzata" + H1 "Parliamo del tuo progetto." + sottotitolo | immagine porto Viareggio scura | `187:1759` (banda 0–~510px del frame) | full-bleed, poster image |
| 2 | **Contatti + Form** — colonna sx dati sede ("Fontealta S.r.l." + indirizzo/telefono/email), colonna dx titolo "Progettare in lungo e in largo." + form | dark | `187:1759` (banda ~510–1010px) | layout 2 colonne desktop |
| 3 | **Mappa** — embed Google Maps Viareggio (pin "Fontealta") | mappa (chiara) | `187:1759` (banda ~1010–1350px) | iframe statico full-bleed |
| 4 | **CTA Area Pro teaser** — "Sei un progettista?" + testo + 2 bottoni (Accedi / Registrati) | dark | `187:1759` (banda ~1350–1620px) | centrato, teaser FASE 8 |
| 5 | Footer (globale) | dark | riuso `Footer` | layout-level, non re-spec'd qui |

Gerarchia titoli: H1 = Hero (`Parliamo del tuo progetto.`) · H2 = Form (`Progettare in lungo e in largo.`) · H2 = CTA (`Sei un progettista?`).

---

## 3. Layout / grid

- **Container max:** `--container-max` (1200px), centrato. Hero e Mappa sono **full-bleed** (100vw); il contenuto hero rientra nel container con allineamento a sinistra come `AmbientHero`.
- **Breakpoint:** mobile-first; desktop ≥1024px (coerente con `.fa-section` padding switch a 1024px). Frame Figma = 1440px.
- **Sezione 2 (Contatti + Form):** grid 2 colonne desktop.
  - Colonna sx (dati sede): ~33% (≈1fr).
  - Colonna dx (form): ~58% (≈2fr) con gap ampio (≈48px = spacing `l`).
  - Mobile: stack 1 colonna, dati sede sopra il form.
  - Il form interno è griglia 2 colonne: riga 1 = Nome / Cognome, riga 2 = Email / Telefono, riga 3 = Azienda / Tipo di progetto, riga 4 = Messaggio (full-width), riga 5 = bottone Invia (centrato sotto). Mobile → tutti i campi full-width single column.
- **Sezione 3 (Mappa):** full-bleed, altezza fissa ~340px desktop (ratio del frame), ~260px mobile.
- **Sezione 4 (CTA):** contenuto centrato, max-width testo ~`.fa-container.narrow` (800px); i 2 bottoni in fila orizzontale (gap `24`), su mobile in colonna.

---

## 4. Tipografia

Token scala da `globals.css` `@theme` / `@layer components`. Sentence case ovunque (regola brand). Apostrofi curly `’` verbatim. Font: **Satoshi** variabile.

| Testo | Scala / classe | Size · line-height · weight · letter-spacing |
| --- | --- | --- |
| Hero eyebrow "Consulenza personalizzata" | `.fa-eyebrow.on-dark` | 13px · — · 500 · 0.5px, uppercase, colore navy-bright/oro |
| Hero H1 "Parliamo del tuo progetto." | `display-hero` (`.fa-h1`) | clamp(2.5rem→4rem) · 1.05 · 600 · -0.5px — NON italic (display dritto, vedi §10) |
| Hero sottotitolo | `body-lg` (`.fa-body-lg`) | 1.125rem · 1.65 · 400 — colore on-dark-secondary |
| Sede "Fontealta S.r.l." (label bold) | `card-title` (`.fa-h4`) o sub-heading | 1.5rem · 1.2 · 600 · -0.2px |
| Sede indirizzo/telefono/email | `body-sm` (`.fa-body-sm`) | 0.875rem · 1.55 · 400 |
| Form H2 "Progettare in lungo e in largo." | `section-heading` (`.fa-h3`) | Figma 36px · 1.12 · 700 · -0.5px (Satoshi Bold) |
| Form field label (DATI PERSONALI, NOME, EMAIL…) | `micro` | 10px · 1.45 · 600 · 0.2px (Figma base 10 micro-label) uppercase |
| Form input text / placeholder | `body-sm` | 0.875rem · 1.55 · 400 — placeholder colore tertiary |
| Bottone "Invia" | `button` (`<Button>`) | text-button · 1 · 500 · 0.3px uppercase |
| CTA H2 "Sei un progettista?" | `section-heading` (`.fa-h3`) | 36px · 1.12 · 700 · -0.5px |
| CTA testo descrittivo | `body-lg` | 1.125rem · 1.65 · 400 — on-dark-secondary |
| CTA bottoni "Accedi" / "Registrati" | `button` | come Invia |

---

## 5. Colori & superfici (token riconciliati / nuovi)

Sezioni dark del frame usano un near-black più freddo del `--fa-black` (#1a1a18). Il brief identifica `Brand/black #0B1215` come token mancante: **propongo `--color-fa-ink: #0B1215`** per le sezioni dark di questa pagina (Hero scrim base, Sezione 2, Sezione 4). In attesa dell'aggiunta token, usare `--fa-black` come fallback con `.fa-section.dark`.

| Elemento | Token |
| --- | --- |
| Hero sfondo (immagine) + scrim | scrim su `--color-fa-ink` (PROPOSTO) / fallback `--fa-black`; gradiente sx→dx come `AmbientHero` |
| Hero H1 / sottotitolo | `--color-fa-text-on-dark` (#F6F4F0) / secondary `--fa-text-on-dark-secondary` |
| Sezione 2 sfondo | `--color-fa-ink` (PROPOSTO) / fallback `--fa-black` (`.fa-section.dark`) |
| Sede testo | `--color-fa-text-on-dark` (label) / `--fa-text-on-dark-secondary` (dettagli) |
| Form label micro | `--fa-text-on-dark-secondary` |
| Form input underline (border-bottom) | `--fa-border-dark-medium` (rgba 246,244,240,0.25); focus → `--color-fa-navy-bright` |
| Form input text | `--color-fa-text-on-dark`; placeholder `--fa-text-on-dark-tertiary` |
| Bottone Invia | `<Button variant="secondary" dark>` (outline chiaro su dark) — coerente con design pill outline |
| Mappa | iframe nativo Google (palette chiara fuori dai token, contenuto esterno) |
| CTA Sezione 4 sfondo | `--color-fa-ink` (PROPOSTO) / fallback `--fa-black` |
| CTA bottoni | `Accedi` = `<Button variant="primary">` su sfondo chiaro pill bianco (vedi §7 nota); `Registrati` = `<Button variant="secondary" dark>` outline |

**Token nuovo proposto (riepilogo):**

- `--color-fa-ink: #0B1215` — near-black più freddo/scuro del `--fa-black` per le sezioni dark del frame Contatti (e altre pagine con `Brand/black`). Rationale: Figma usa #0B1215 verbatim sulle bande scure; `--fa-black` #1a1a18 è percettibilmente più caldo/chiaro.

---

## 6. Spacing (scala 6 / 8 / 12 / 24 / 48)

- **Padding verticale sezioni dark:** `.fa-section` = 96px mobile / 136px desktop (≈ multipli della scala). Hero usa padding custom verticale grande come `AmbientHero` (clamp 120→200 top).
- **Padding orizzontale:** 24px (token `24`) coerente con `.fa-section`.
- **Sezione 2 gap colonne:** 48px desktop (token `l`), 24px tablet.
- **Form gap tra righe:** 24px verticale; gap orizzontale tra coppia campi 24px.
- **Form label → input gap:** 6–8px (token `6`/`xs 8`).
- **Hero H1 → sottotitolo:** ≈24px.
- **CTA titolo → testo:** 12px; testo → bottoni: 24–48px; gap tra bottoni: 24.
- **Bottone padding:** ereditato da `<Button>` (`px-8 py-3.5` default).

---

## 7. Componenti usati (reuse vs nuovo)

| Componente | Stato | Note |
| --- | --- | --- |
| `Navigation` | **reuse** (layout-level) | globale, non re-implementato |
| `Footer` | **reuse** | da `src/components/layout/footer.tsx`, alimentato da `siteSettings.footerColumns` |
| Hero dark poster | **reuse pattern** | clonare struttura `AmbientHero` (poster `<Image fill priority>` + doppio scrim) ma SENZA stats; nuovo componente leggero `ContactHero` o inline in `page.tsx`. Poster placeholder Unsplash porto/yacht finché M5 (asset Andrea) non popola immagine reale |
| `<Button>` | **reuse** | Invia (`variant="secondary" dark`), Accedi (`variant="primary"`), Registrati (`variant="secondary" dark`) |
| `.fa-eyebrow` / `.fa-h3` / `.fa-body-lg` | **reuse** | classi `@layer components` |
| **ContactForm** | **NUOVO** (client component) | react-hook-form + Zod 4 resolver. Campi: nome, cognome, email, telefono, azienda, tipoProgetto (select), messaggio (textarea). Vedi §9 + §8 stati |
| **Server Action** `submitContact` | **NUOVO** | `'use server'`. Valida con stesso Zod schema (server re-validation), invia via Resend. **DRY-RUN nei test: nessuna email reale** — gate su `process.env.NODE_ENV`/flag, log invece di `resend.emails.send`. Richiede `RESEND_API_KEY` (già in `.env.example`). Pattern Next.js 16: form `action={...}` o `onSubmit` + `useTransition` |
| **MapEmbed** | **NUOVO (leggero)** | iframe statico Google Maps Viareggio. NO dipendenze JS pesanti (no `@react-google-maps/api`). `<iframe loading="lazy" src="https://www.google.com/maps/embed?...">` con `title` per a11y. Valutare static map image come fallback no-JS |

**Nota select "Tipo di progetto":** opzioni dal design = "Residenziale, Hospitality" + (megayacht implicito dal hero). Enum suggerito i18n: Residenziale / Hospitality / Megayacht / Beach club / Altro. Da confermare con Andrea (non Sanity-backed, vive in i18n namespace `contatti`).

---

## 8. Stati & motion (solo CSS + IntersectionObserver, NO GSAP)

- **Hero:** poster statico (M15 — Mixkit `<video>` rimosso; `<Image>` only). Nessuna animazione entrata richiesta; opzionale reveal via `useScrollReveal` (`src/hooks/use-scroll-reveal.ts`, rispetta `prefers-reduced-motion`).
- **Form input focus:** border-bottom transition `--fa-border-dark-medium` → `--color-fa-navy-bright`, `transition: border-color var(--dur-micro)`.
- **Form input error:** border-bottom rosso/warning + messaggio micro sotto il campo (colore warning — nessun token errore esiste ancora, usare hex inline documentato o proporre `--color-fa-error`).
- **Bottoni:** hover/active ereditati da `<Button>` (`hover:bg-fa-navy-light active:scale-[0.97]` / outline `hover:bg-white/10`).
- **Submit:** stato pending (bottone disabilitato + label "Invio…") via `useTransition`/`isSubmitting`; stato success (messaggio conferma inline, form reset); stato error (messaggio inline). Tutto CSS, nessun GSAP.
- **Mappa:** `loading="lazy"`, nessuna animazione.
- **Reveal sezioni:** opzionale fade-up via IntersectionObserver coerente col resto del sito.

---

## 9. Mapping Sanity (campo → sezione, empty-state)

| Sezione / campo UI | Fonte dati | Empty-state |
| --- | --- | --- |
| Sede — ragione sociale | `siteSettings.companyName` (init "Fontealta S.r.l.") | sempre popolato (initialValue) |
| Sede — indirizzo | `siteSettings.address` (text) | **flag se vuoto** — fallback nascondi blocco o placeholder. Design mostra "Via Libeccio 13/15 55049 Viareggio (LU) — Italia" (≠ footer "Via dei Pescatori 14": discrepanza nota, vedi §10) |
| Sede — telefono | `siteSettings.phone` | flag se vuoto, nascondi riga |
| Sede — email | `siteSettings.email` (validato `Rule.email()`) | flag se vuoto, nascondi riga |
| Footer | `siteSettings.footerColumns` + `socialLinks` | gestito da `Footer` |
| Hero copy (eyebrow / H1 / sottotitolo) | **i18n** namespace `contatti` (NON Sanity) | testo statico tradotto |
| Form labels / placeholder / select options | **i18n** `contatti` | statico |
| Form destinatario email | env `RESEND_API_KEY` + indirizzo destinatario (`siteSettings.email` o env `CONTACT_TO`) | richiede config; DRY-RUN se assente |
| CTA Area Pro testo | **i18n** `contatti` | statico; link `/area-pro` |
| Mappa coordinate | **hardcoded** embed URL Viareggio (oppure derivare da `siteSettings.address`) | considerare campo Sanity `siteSettings.mapEmbedUrl` futuro (vedi §10) |

**Query:** riuso `SITE_SETTINGS_QUERY` (già proietta `address`, `phone`, `email`, `companyName`). Nessuna nuova query necessaria per i dati sede.

---

## 10. Gap & scostamenti Figma

1. **Token `--color-fa-ink` (#0B1215) mancante** in `globals.css`. Le sezioni dark del frame Contatti sono più scure/fredde del `--fa-black` #1a1a18. PROPOSTO additivo. Fallback: `.fa-section.dark` con `--fa-black` finché non aggiunto (non editare globals.css in questo task).
2. **Discrepanza indirizzo Hero vs Footer:** la colonna dati sede nel frame mostra "Via Libeccio 13/15" mentre il footer dello stesso frame mostra "Via dei Pescatori 14". Entrambi sono placeholder Figma → l'unica fonte autoritativa è `siteSettings.address`. Andrea deve popolare il valore reale; UI legge sempre da Sanity, mai hardcode.
3. **Mappa Google iframe:** il frame mostra un embed Google Maps reale. Scelta tecnica: `<iframe>` statico (zero dipendenze, no API key per embed base) vs static map image. PROPOSTO iframe lazy. Eventuale campo Sanity `siteSettings.mapEmbedUrl` per rendere l'URL editabile (non in scope, tech-debt nota).
4. **Select "Tipo di progetto":** il design mostra solo "Residenziale, Hospitality" come placeholder. Le opzioni complete (Megayacht, Beach club, ecc.) non sono enumerate nel frame → da confermare con Andrea. Vivono in i18n `contatti`, non Sanity.
5. **Stato errore form:** nessun token errore/warning in `globals.css`. Il design non mostra stati error. PROPOSTO `--color-fa-error` (additivo) o hex inline documentato.
6. **CTA Area Pro:** destinazione `/area-pro` è FASE 8 (auth) fuori scope. I bottoni Accedi/Registrati sono teaser e linkano a placeholder `/area-pro` (route già whitelisted). Nessun login implementato in questa pagina.
7. **Resend DRY-RUN:** vincolo hard — nei test NESSUNA email reale. La Server Action deve gateare `resend.emails.send` su env flag e loggare in dev/test. `RESEND_API_KEY` già presente in `.env.example`.
8. **Bottone "Accedi" su sfondo dark:** nel frame appare come pill bianco pieno (primary) su sezione scura — `<Button variant="primary">` ha `bg-fa-navy`. Verificare in visual check se serve variante `primary` chiara (bg bianco/text dark) per il contrasto desiderato; eventuale piccola estensione `<Button>` o override `className` (additivo, no edit baseline).
9. **`next-intl` whitelist:** `/contatti` (+ `/contact`) già presente in `routing.ts` pathnames — nessuna aggiunta necessaria. Namespace messaggi `contatti` da creare in `it.json` + `en.json` (EN mirror IT verbatim per Sprint 2, T1 per traduzione reale).
