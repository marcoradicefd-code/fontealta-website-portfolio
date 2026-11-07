# Architecture map (overview)

Stable structural reference for the Fontealta codebase, moved out of the always-loaded CLAUDE.md to keep it light. **Read this before exploring the codebase.** Project history, tech debt, and lessons live in `docs/history.md`, che dal 31/08/2026 è l'**indice**: le voci dal 31 agosto in poi sono un file ciascuna in `docs/history/`, quelle precedenti sono rimaste nel corpo.

## Architecture

- **App Router** with route groups:
  - `src/app/(site)/[locale]/` — public site, i18n via next-intl
  - `src/app/studio/[[...tool]]/` — embedded Sanity Studio (standalone root layout; dynamic import + `ssr:false` per Studio client)
  - `src/app/api/` — draft mode + revalidate routes
  - **Rotte che non sono pagine**: `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/llms.txt/route.ts` (10/09/2026). Le ultime due stanno **fuori da ogni cache** (`force-dynamic` + `client.fetch` senza cache): si ricostruiscono a ogni richiesta per dire la verità alla prima lettura dopo un publish.
  - **Icone dalle convenzioni di file**: `src/app/favicon.ico`, `icon.png` (512), `apple-icon.png` (180). Next le serve con l'impronta del file nell'href e scrive il `sizes` leggendo il file.
- Path alias: `@/*` → `src/*`, `@/sanity/*` → `sanity/*`
- **Dipendenze tolte il 10/09/2026**: `@splidejs/splide` e `@splidejs/react-splide`, zero import da quando il carosello è Swiper. `@gsap/react` è **adottato dal 23/09/2026** (#223): `useGSAP` nel box lingua del menu mobile e, dal 14/10/2026 (#251), nel bottone di invio dei moduli (`submit-button.tsx`, `conferma-invio.tsx`); `styled-components` resta perché è peer di `@sanity/ui` e `next-sanity`.
- **Moduli di `src/lib/` nati l'11 settembre 2026:** `route-metadata.ts` — `routeMetadata`
  costruisce i metadata di una rotta statica da una `href` sola, `staticRouteMetadata` è la
  fabbrica che restituisce la `generateMetadata` già pronta. ⚠️ Emette il blocco `openGraph`
  **intero**, perché dichiararne un campo sostituisce l'oggetto: da lì `canonical` e `og:url`
  non possono più divergere, e `og:title` smette di portare il marchio che `og:site_name`
  porta già. `og-fallback-image.ts` (`fallbackOgImages`; era `og-riserva.ts` fino al #211) tiene viva la leva `defaultSeo.ogImage` per le rotte che
  dichiarano un `openGraph` proprio.
- **i18n a cinque lingue, tutte accese dal 16/09/2026** (#201): `de/fr/es` hanno dizionari tradotti
  (#190), segmenti di rotta, tipi localizzati e testi Sanity **sul pubblicato**, compresi i post del blog
  in cinque lingue (l'inglese pubblicato il 16/09) e ruolo e biografia degli autori (#204). Il post del
  Salone di Venezia è **spubblicato** (unpublish, non delete). Spegnere una lingua è una riga in
  `ACTIVE_LOCALES`. Gli strumenti
  stanno in `scripts/i18n/`: `export-content`, `import-content`, `messages-diff`,
  `discard-content`, `publish-content`, con i controlli in `lib.ts` e il registro dei giri in
  `manifest.ts` (un manifest per giro, `sharedWith` per le bozze condivise fra lingue, rollback
  che toglie i soli campi della lingua). ⚠️ Il publish si fa **per campi** (#193): copia sul pubblicato i soli campi delle lingue, e non pubblica mai una bozza. La
  forma completa sta in `ARCHITECTURE.md` §6. ⚠️ Un segmento dichiarato in `pathnames` **non è inerte**:
  risponde anche senza prefisso con un 307, e può resuscitare un indirizzo ritirato.
- **Menzioni legali** (16/09/2026): `/menzioni-legali` sostituisce `/privacy-policy` e `/cookie-policy`, che
  rispondono 308 verso le ancore `#privacy` e `#cookie`. Cinque sezioni ad accordion (dati societari e
  certificazioni dal 26/10/2026, #308, poi termini d'uso, privacy, cookie, trasparenza AI), testi in
  `legale.*` dei dizionari, forma in `ARCHITECTURE.md` §3.
- **Moduli di `src/lib/` nati fra l'8 e il 10 settembre 2026:** `urls.ts` (URL assoluti e localizzati, sopra `getPathname`), `azienda.ts` (identità legale: ragione sociale, P.IVA, fax, fondazione, sede, e dal 26/10/2026 codice fiscale, REA, capitale, PEC, ISO 9001 e i PDF su R2 — **sorgente unica**), `seo-editoriale.ts` (`risolviSeo` e `indicizzazione`: campo compilato nella lingua vince, vuoto vuol dire template), `lingue.ts` (nomi delle lingue, estratti da `navigation.tsx` dove già esistevano).
- **Components:**
  - `src/components/` (radice) — `HeroScrim` (scrim di lettura degli hero) e **`HeroFade`** (sfumatura in fondo agli hero, 17/09/2026: finiture, home, collezione, chi siamo, contatti, produzione; non /blog)
  - `src/components/layout/` — Navigation (menu mobile **fisso** dal 17/09/2026), Footer (dal 20/10/2026 con la colonna della newsletter: `NewsletterForm` e la Server Action `submitNewsletter`, #274), LocaleFlag
  - `src/components/ui/` — Button polymorphic, Reveal, **Breadcrumb**, `center-underline.ts` e **`SectionHeading`** (elenco misurato il 23/09/2026 con `ls src/components/ui/`; ⚠️ **`Section` non esiste più**: zero import, tolto col #222) (l'intestazione invisibile delle pagine di collezione e dei corpi: riceve il testo già tradotto, non una chiave). ⚠️ **`BackButton` non esiste più**: il tasto «Indietro» è stato sostituito dal breadcrumb (PR #146, set 2026) e il file è stato rimosso. Ne restano solo due citazioni nei commenti di `breadcrumb.tsx`, che spiegano cosa quel componente aveva già imparato sulla fascia navy (verificato 8/09/2026: `ls src/components/ui/` dà cinque file, nessuno è BackButton)
  - `src/components/cards/` — CollectionCard (FASE 4.1.2), ModelCard (FASE 4.2.3; la prop `showCollection?` della FASE 4.3.3 non esiste più)
  - `src/components/heros/` — **CollectionHero** (spostato qui il 29/07: due consumatori, stesso motivo di FilterBar/M16), HeroMediaBg, HeroStatBar. ⚠️ `AmbientHero` **non esiste più** (`8ef5cc4`)
  - `src/components/filters/` — FilterBar (spostato qui da collezioni/[slug]/_components in M16/D4; oggi condiviso fra collezione singola e indice corpi)
  - `src/app/(site)/[locale]/_components/` — `home/` (componenti della homepage). `legal-page.tsx` è rimosso il 16/09/2026: le legali sono la pagina `menzioni-legali/`. ⚠️ `AmbientModelsSection` **rimosso** (`8ef5cc4`)
  - `src/app/(site)/[locale]/collezioni/_components/` — CollectionCardAnimated. ⚠️ **`FontealtaRowGallery` non esiste più**: rimossa con PR #171 (10/09/2026) perché nessun file la importava.
  - `src/app/(site)/[locale]/collezioni/[slug]/_components/` — **solo** ModelsSection (4.2.4): CollectionHero è passato in `src/components/heros/`
  - `src/app/(site)/[locale]/collezioni/corpi-a-incasso/` — indice corpi (`_components/bodies-section.tsx`) + scheda `[slug]/_components/` (BodyHero, BodySpecs, UsedBy)
- **Hooks (2 hooks, same name, different paths):**
  - `src/lib/use-scroll-reveal-classlist.ts` — Boss baseline, aggiunge `.visible` e lascia la transizione al CSS. ⚠️ **Rinominato il 10/09/2026** (era `use-scroll-reveal.ts`, esportava `useScrollReveal`): si chiamava come quello di `src/hooks/`, che fa un'altra cosa.
  - `src/hooks/use-scroll-reveal.ts` — FASE 4.1.2 state-based, returns `{ ref, isRevealed }`, uses `useSyncExternalStore` for `prefers-reduced-motion`
- **Routes implementate Sprint 2:**
  - `/[locale]` — homepage (FASE 5+7 closed): hero «Acciaio e Colore» (testo **flush-left**; dal 17/09/2026 scrim direzionale sulla fascia del testo più `HeroFade`, v. `ARCHITECTURE.md` §1) + CTA **"Parliamo del tuo progetto"** → `#progettare` con smooth scroll Lenis; altezza responsive, video `object-center`) + FeaturedCollections: coverflow `FeaturedCarousel` (Swiper) con `FeaturedCollectionCard`, card della home distinta da `CollectionCard` (FEATURED_COLLECTIONS_QUERY + fallback prime-6) + dark "AISI 316" stats/swatch + teaser team (**foto stabilimento** `stabilimento.webp`) + CTA. `_components/home/`
  - `/[locale]/collezioni` — overview 4-section atelier-cinema (FASE 4.1)
  - `/[locale]/collezioni/[slug]` — detail page Hero + Section 2 grid filter+model (FASE 4.2 closed)
  - ~~`/[locale]/{outdoor,indoor,yacht,cucina}` — ambient pages~~ **RIMOSSE** (`8ef5cc4` `feat(catalog): remove ambient display and orphan ambient routes`, lug 2026): eliminati le 4 page ambient (outdoor/indoor/yacht/cucina + EN `/kitchen`), `AmbientHero`, `AmbientModelsSection`, `MODELS_BY_AMBIENT_QUERY`/`AMBIENT_DETAIL_QUERY`, il display `model.ambient` e le entry `routing.ts`. ⚠️ Anche i documenti `ambient` sono spariti: **0 nel dataset** al 29/07/2026 (la versione precedente di questo file diceva che restavano). La narrativa FASE 4.3 sotto è **storica**.
  - `/[locale]/modello/[slug]` — single model detail (FASE 4.4 closed). EN `/model/[slug]` via pathnames map. ISR on-demand (`generateStaticParams→[]`, `revalidate=false` — regime on-demand lug 2026, vedi Sprint 2.2). ModelHero (layout B text-forward chiaro, monogram placeholder M5; la descrizione è resa QUI, non da un componente dedicato — ⚠️ `ModelDescription` non esiste più) + ModelSpecs (condizionale; dal 29/07 la riga «Corpo incasso» è un link alla scheda del corpo) + FinishSelector (Client) + **sezione «Affinità»** (`CollectionAffinities`, collezioni affini da `collections[0]->relatedCollections`). Componenti in `modello/[slug]/_components/`. **«Modelli correlati» (RelatedModels) rimosso dal rendering** (cleanup `ee5c8c6`, lug 2026 — schema+dati `relatedModels` intatti in Sanity). **Rework giu 2026 (PR #26/#27):** descrizione spostata nell'hero (`CODICE — descrizione`) + ModelSpecs left-aligned 3/4-col + tag pills rimosse dalle specs — dettaglio in narrativa Sprint 2 "migrazione tassonomia productType".
  - `/[locale]/finiture` ↔ `/finishes` — overview 8 finiture. **Redesign full-dark (PR #3, giu 2026):** hero con **immagine di sfondo webp** + scrim WCAG AA + contenuto centrato + sfumatura in fondo verso `--fa-ink` (#0b1215), dal 17/09/2026 il componente condiviso `HeroFade`; sezione griglia dark; `FinishCard` scura con **cornice bianca** (raggio 24 px, bordo `--fa-stroke` di `--fa-stroke-color`, il bianco puro delle card) + **hover collezioni-parity** (`group-hover:scale-[1.04]` swatch + `hover:-translate-y-1`), **swatch 4:3** (`swatchImage` Sanity → fallback locale `/finiture/{CODE}.webp`), **nome 36px UPPERCASE bianco** (`overflow-wrap:break-word`), categoria i18n + `name[$locale]`; griglia **3-col desktop / 2 tablet / 1 mobile**; sezione CTA "Progettare" (form condiviso riusato). 9 webp aggiunte (8 swatch + hero bg). **PR #6:** hero bg sostituito con immagine **water-macro** (`hero-bg.webp` 69KB q90) + altezza hero allineata alla scala home (vedi decisione locked).
  - `/[locale]/referenze` ↔ `/projects` (+`/[slug]` detail ISR) — archive con **empty-state** (`projectReference` 0 doc). Nuovi ReferenceArchiveHero/ReferenceCard.
  - `/[locale]/chi-siamo` ↔ `/about` — company story (copy via i18n `chiSiamo`, NO schema aboutPage).
  - `/[locale]/contatti` ↔ `/contact` — form RHF + Zod 4, `submitContact` → **webhook Zapier** (server-only; assente in DEV → dry-run, in PRODUZIONE → errore brandizzato + fallback `info@fontealta.it`) + sede da `azienda.ts` (dal 20/10/2026, #268) + sezione del catalogo + mappa iframe + Area Pro teaser. Campi: nome/cognome/email/telefono/azienda/`richiesta` (Preventivo·Consulenza·Altro dal 20/10/2026: il catalogo ha il suo modulo, #268), **Paese** obbligatorio e **note** (dal 13/10/2026, #248: regole e payload nella rule `legali-contatti`). **Hardening lug 2026 (LIVE):** wiring condiviso in hook `useContactSubmit()` + `HoneypotFields`; anti-abuse **honeypot `_gotcha`** + **timestamp-trap `_ts`** (<3s → fake-success, nessun invio); **shared-secret `_secret` nel BODY** (non header); `source` da `risolviSource`: la pagina interna dichiarata dal modulo, poi il referer, sulle rotte di `routing.pathnames` nelle cinque lingue (#249). Payload Zapier = campi + `lingua` + `source` + `timestamp` (+ `_secret` se env set); `_gotcha`, `_ts` e `pagina` strippati server-side. Dal 14/10/2026 (#251) a invio riuscito il bottone diventa «Inviato» e sotto compare la riga di conferma. `ContactForm` (in `<Suspense>`, legge `useSearchParams`) condiviso con `/collezioni` (Progettare), `/finiture`, `/blog`, `/chi-siamo` (via `ProgettareCta`) + home `FinalCtaForm`. **Smoke E2E validato in produzione (3 pagine OK + negativa scartata dalla trap).** **Dal 7/10/2026 (#241):** `_gotcha` e `_ts` **obbligatori** (se mancano → fake-success, log `[submitContact] scartato:`), `method="post"` sui `<form>` (senza JS niente dati nell'URL: su Vercel `POST /` risponde 405), rate limit WAF su `submitContact` dal pannello; BotID valutato e rimandato (`legali-contatti`). **Dal 20/10/2026:** casella della newsletter e riga privacy in tutti i moduli (#269), email «Richiesta ricevuta» via Brevo dopo ogni richiesta di contatto (#273), nome e cognome obbligatori anche nel modulo del catalogo (#274); regole, template e liste di Brevo nella rule `legali-contatti`.
  - `/[locale]/blog` (+`/[slug]` detail) — **Blog (PR #13 in main `77fe397`), slug uguale it/en.** Listing (sezione dark): hero full-bleed scala-locked (bg placeholder `public/blog/hero-bg.jpg`), filtri categoria client-side (Tutti + 4 reali, per `_id`), articolo **featured** (`featured:true` → fallback più recente; mostrato solo in "Tutti", escluso dalla griglia lì), griglia 1/2/3-col `publishedAt desc`, **barra paginazione navy pill** (`rounded-[100px]`, bottoni-numero **cerchi fissi** `size-9`, sotto `sm` frecce senza etichetta visibile (dal 17/09/2026, la barra allargava /blog a 402 px), ellissi, estremi disabled, `pageSize 3`), JSON-LD Blog. Detail (`/blog/[slug]`, ISR `revalidate=false` + `gSP→[]`): renderer Portable Text (`ArticleBody`: normal/h2/h3/strong/em/blockquote/liste; blockquote = virgoletta navy + corpo in corsivo grande, no barra; XSS-guard link riusato da `model-description`), **author sidebar** sticky (foto o iniziali su navy, bio omessa se vuota, **no social**), sezione `ContactForm` condiviso ("Progettare in lungo e in largo." via `collezioni.progettare*`), **generateMetadata** (PRIMO pattern canonical/openGraph/hreflang del progetto — vedi lessons), JSON-LD Article. Componenti in `blog/_components/` + `blog/[slug]/_components/`. Nav "Blog" abilitato (`href:/blog`). EN best-effort via coalesce nelle query (vedi sopra).

  **Route attive: i `page.tsx` sotto `(site)/[locale]`**, cioè le chiavi della mappa `pathnames` più il catch-all `[...rest]` (`find "src/app/(site)/[locale]" -name page.tsx`). Dinamiche: `collezioni/[slug]`, `collezioni/corpi-a-incasso/[slug]`, `modello/[slug]`, `referenze/[slug]` e `blog/[slug]`; quanti documenti servono lo dice il dataset, non questo file.

  - `/[locale]/area-riservata` ↔ `/pro-area`: pagina statica «in lavorazione» (PR #157, 8/09/2026). Nessuna query Sanity, nessuna immagine, nessun form: occhiello, H1 `.fa-h2` come il 404, paragrafo, un solo bottone verso `/contatti`. `robots: index false, follow true` **sulla rotta**, così resta fuori dall'indice anche ora che, dal cutover del 17/09/2026, la produzione è aperta agli indicizzatori. ⚠️ La chiave della mappa è `/area-riservata` ma **l'URL inglese resta `/pro-area`**, perché le etichette EN del sito dicono «Pro Area».
  - `/[locale]/officina` ↔ `/workshop` (DE `/werkstatt`, FR `/atelier`, ES `/taller`): la tavola dell'officina «Come nasce una colonna» in un iframe di `/officina-tavola/index.html?embed=1&lang=<lingua>`, sotto l'header, senza footer (27/10/2026, #313). `noindex, follow`, senza canonical né hreflang, fuori dalla sitemap. La porta è la facciata sulla chiusura di `/produzione`, solo da 1024 px (#315). Sorgente della tavola in `tavola/` (ha il suo `CLAUDE.md`), output in `public/officina-tavola/`; spec `docs/specs/tavola-officina.md`.
  - `/[locale]/doccia-da-esterno` ↔ `/outdoor-shower` (DE `/gartendusche`, FR `/douche-exterieure`, ES `/ducha-exterior`): la prima pagina d'uso (4/11/2026, #355), dal documento fisso `contentPage-outdoor-shower` (`kind: "use"`) con `USE_PAGE_QUERY` e `getUsePage`. Una lingua senza titolo dà 404 ed esce da hreflang, sitemap e `llms.txt` (`src/lib/pagina-uso.ts`); corpo in `_components/use-body.tsx`, card automatiche delle collezioni con una colonna doccia, prima quelle in evidenza sul documento (`ordinaCard`, dal 5/11/2026, #358), FAQ, `ProgettareCta`, JSON-LD `WebPage` e `BreadcrumbList`. Contenuto versionato in `docs/content/pagine-uso/`; spec `docs/specs/seo-pagine-contenuto.md`.
- **Guardie di regressione (`tests/regression/`)**, aggiunte l'11/09/2026, girate in locale e
  firmate dal 22/10/2026 (`pnpm e2e:firma`, stato «e2e (locale)»): `og:title` nudo e
  uguale al titolo meno il suffisso; l'**insieme dei nomi** dei tag `og:*`, non il conteggio;
  `/area-riservata` come eccezione **asserita**, che è anche la controprova della guardia
  sopra (dal 27/10/2026, #313, le pagine escluse sono un elenco: `/area-riservata` e `/officina`); il landmark dei filtri e i titoli letti dall'albero di accessibilità vero via
  `helpers/ax-tree.ts`. ⚠️ `getByRole` di Playwright **non** è quell'albero: non applica le
  regole di annidamento di ARIA in HTML, e una guardia scritta con quello resta verde proprio
  quando il landmark smette di esistere.
- **`/llms.txt`** sta fra le rotte che non sono pagine, insieme a `robots.ts` e `sitemap.ts`.

⚠️ **Nessun numero in questo documento**: conteggi, baseline e misure stanno in `CLAUDE.md`,
in un posto solo e con la data.

## Sanity / Content Model

**Schemas** (`sanity/schemas/documents/`):

- `model` — product article (**595 docs**, verificato 29/07/2026). Fields: `code`, `name` (localizedString), `slug`, `description` (localizedPortableText — **595/595 con EN**, verificato sul dataset il 22/09/2026: `WX47C.SK.K`, l'ultima vuota al 29/07, è compilata), **`productMacro` (enum 6) + `productSubtype` (enum 24)** — ⚠️ `productType` **NON ESISTE PIÙ** (rimosso da schema, codice e dati con PR-B, lug 2026; vedi `docs/front2-design.md`), `tags` (open string[]), `includesConcealedBody` (bool), **`requiredConcealedBody` (ref → `concealedBody`, opzionale — Block 1)**, **`waterSupply` (enum `cold`/`hot-cold`/`none`, opz. — Block 2)**, **`alimentationTypes` (array enum `standard`/`standard-plus`/`cw`/`ew`/`4s`, opz., UI-only non-popolato — Block 2)**, `availableFinishes` (refs to finish, max 8 / min 1 warning), `collections` (refs to collection, min 1), ⚠️ **`ambient` RIMOSSO** (`8ef5cc4`), `isOutdoor` (legacy bool), `isCustomizable` (bool). 5 field groups: identity / taxonomy / media / specs / links.
- `collection` — **22 docs** (IT) dal Publish di «Corpi a incasso» (28/07). Document-level i18n. Fields: `code`, `title`, `slug`, `tagline` (**per lingua**, dall'11/09/2026; lo stato sui documenti sta nella rule `i18n-sanity`), `description` (block[]), `isCustomizable`, `coverImage`, **`heroImage` (imageWithMeta — sfondo hero, distinto dalla cover; PR #2)**, `heroVideo*` (URL R2), `models[]` (refs back, **vuoto in seed Sprint 2** — query usa back-ref `*[references(^._id)]`), `seo`, `order`, `featured`.
- ~~`ambient`~~ — ⚠️ **0 documenti** (verificato 29/07/2026). Lo schema è stato smantellato con le route (`8ef5cc4`) e i documenti sono spariti dal dataset: la nota «i 4 doc ambient restano in Sanity» che questo file portava era **falsa**.
- `finish` — 8 docs: code uppercase MX/BX/MB/RL/AB/BB/BC/DB. Fields: `name` (localizedString), `category` (natural/mirror/painted/pvd), `swatchImage`, **`colorHex` (NOT `hex`)**, `description` (localizedText). Sanity production names autoritative — see M10 for DESIGN-SYSTEM.md bundle reconciliation. **Giu 2026:** tutte 8 `name.it` ≠ `name.en` (i 4 PVD, prima EN-only, tradotti **interim** via micro-migrazione one-off — traduzioni fedeli EN, NON i nomi Figma; vedi M10).
- `concealedBody` — **17 docs.** Non più un registro senza pagina: dal cantiere INCASSI (PR 1→4, lug 2026) ha `slug`, `servesMacros`, `waterSupply`, `image`, `order`, e una **scheda propria** sotto `/collezioni/corpi-a-incasso/[slug]`. L'indice interroga il TIPO, non le reference alla collection. Piano vivo: `docs/incassi-design.md`.
- `contentPage` — pagine con id fisso `contentPage-<code>` (`contentPageId` in `sanity/lib/faq-rules.ts`): le pagine principali (`MAIN_PAGES`, dal 30/10/2026, #330), che portano le sole FAQ, e le pagine d'uso (`USE_PAGES`, `kind: "use"`, dal 3/11/2026, #353), con titolo, introduzione, corpo e `seo` per lingua, più l'elenco delle collezioni in evidenza, che vengono prima nelle card automatiche; i campi delle pagine d'uso sono nascosti sulle principali. Le pagine previste le elencano le due costanti; il documento nasce col primo carico (al 4/11/2026 ne esistono due, `contentPage-home` e `contentPage-outdoor-shower`).
- `projectReference` — case-study / hospitality reference (was `reference`, renamed).
- `author` — dal 10/09/2026 ha `role` (localizzato), `linkedin` e `slug`. ⚠️ La validazione del LinkedIn accetta solo `linkedin.com/in/…` e `/company/…`: un sottodominio di paese (`it.linkedin.com`) viene **rifiutato**, e va normalizzato sull'host canonico. Dopo la Fase S restano due autori: i documenti «Fontealta» e «Matteo Rivolta» sono stati eliminati, e i post che firmavano sono passati a una persona vera.

**Campi trasversali (10/09/2026):**

- `seoFields` è **per lingua** (`localizedStringOptional` / `localizedTextOptional`, due tipi nati perché quelli generici richiedono l'italiano e qui il vuoto è la norma) più `noIndex`. Montato anche su `model` e `concealedBody`.
- `siteSettings.defaultSeo` porta la **sola `ogImage`**: titolo e description sono stati tolti perché nessuna pagina usava i default del layout.
- `siteSettings.socialLinks.instagram` è compilato; è ciò che alimenta `Organization.sameAs`.
- ⚠️ `post.author` ha `Rule.required()`: il ramo «nessun autore → firma l'azienda» esiste nel codice ma **non è raggiungibile** senza lasciare il documento in errore.
- `siteSettings` — singleton.
- **Blog (PR #13, giu 2026):** `post` — articolo. Fields: `title` (localizedString), `slug` (**`slug` semplice, NON localizzato**, `source: title.it`), `excerpt` (localizedText), `coverImage` (imageWithMeta), `body` (localizedPortableText), `categories[]` (refs to category, min 1), `author` (ref to author), `publishedAt` (datetime), `featured` (bool), `seo`. `author` — `name` (string), `photo` (imageWithMeta opz.), `bio` (localizedText opz.). `category` — `title` (localizedString), `slug` (**`slug` semplice** dal 15/09/2026: le 4 categorie portavano ancora `localizedSlug`, tolto dallo schema con #179, e sono state corrette su Sanity), `order`. **Contenuti:** i post pubblicati hanno i testi in cinque lingue sul pubblicato (dal 16/09/2026; verificato sul dataset il 22/09: `title.en` e `title.de` su tutti). Cover popolate da Marco; gli autori sono persone vere dal 10/09 (Fase S).

**Tassonomia viva: `productMacro` (6) + `productSubtype` (24)** — spec in `docs/front2-design.md`, tabelle LOCKED in `sanity/schemas/documents/model-taxonomy.ts`. `docs/TAXONOMY.md` è passata a **v2.0** ed è **documento storico** per `productType` e `ambient` (entrambi rimossi); resta viva la sola spec `tags`.

**Seed pipeline** (`scripts/`): parse-catalog.ts (14-step) → seed-sprint-2.ts (Zod-validated, batch 50, idempotent) → migrate-sprint-2-schema.ts + purge-finish-drafts.ts (one-shot, applied).

**TypeGen output**: `sanity/types.gen.ts` is **committed** (CI typechecks rely on it). Regenerate after schema/query edits with `pnpm typegen`.

**GROQ queries** (`sanity/lib/queries.ts`):

- `COLLECTIONS_OVERVIEW_QUERY` — overview con `articleCount`/`finishCount` computed (FASE 4.1.3a rimosso `language==$locale` filter)
- ⚠️ **`COLLECTION_BY_SLUG_QUERY` e `getCollection()` non esistono più**: rimossi il 9/09/2026, erano codice morto senza consumatori. Le pagine di collezione usano `COLLECTION_DETAIL_QUERY`.
- `COLLECTION_DETAIL_QUERY` (4.2.1) — slug-based detail, computed `modelsCount`/`finishesCount`. ⚠️ Nessun `ambientLabels`: non esiste (0 occorrenze nel file)
- `COLLECTION_SLUGS_QUERY` (4.2.1) — `generateStaticParams`
- ~~`MODELS_BY_AMBIENT_QUERY`, `COLLECTIONS_BY_AMBIENT_QUERY`, `AMBIENT_DETAIL_QUERY`~~ **rimosse** (`8ef5cc4`, ambient routes) · ~~`MODELS_BY_PRODUCTTYPE_QUERY`~~ **rimossa** (`ee5c8c6`, cleanup related-models)
- `MODEL_DETAIL_QUERY` — projection `collectionAffinities` (`collections[0]->relatedCollections`) per la sezione «Affinità»; projection `relatedModels` **rimossa** (`ee5c8c6`), `autoRelatedByCollection` **dormiente** lasciata (tech-debt `M-model-card-type-cleanup`)
- `FINISHES_OVERVIEW_QUERY`, `REFERENCES_OVERVIEW_QUERY`, `REFERENCE_BY_SLUG_QUERY`, `SITE_SETTINGS_QUERY`, `ALL_COLLECTION_SLUGS_QUERY`, `ALL_REFERENCE_SLUGS_QUERY`
- **Non documentate finora, esistono dal 29/07 o da prima:** `FEATURED_COLLECTIONS_QUERY`, `FOOTER_COLLECTIONS_QUERY`, `COLLECTIONS_COUNT_QUERY` (conteggio collezioni, alimenta le strip home e `/collezioni`), `MODEL_SLUGS_QUERY`, e le tre del cantiere INCASSI: `CONCEALED_BODIES_INDEX_QUERY`, `CONCEALED_BODY_BY_SLUG_QUERY`, `ALL_CONCEALED_BODY_SLUGS_QUERY`
- **⚠️ Ordine finiture:** ogni proiezione di `availableFinishes` fa `| order(order asc)` e **proietta** `order` (29/07). L'array nei documenti è alfabetico dal seed; l'ordine di listino vive su `finish.order`
- **Blog (PR #13):** `POSTS_QUERY` (lista, no `body`), `POST_BY_SLUG_QUERY` (detail, `body` completo + seo), `CATEGORIES_QUERY`. Tutte e 3 con **`coalesce(field[$locale], field.it)`** sui campi localizzati → EN best-effort: `/en` mostra l'IT finché non tradotto (auto-preferisce EN quando presente). Slug proiettato `slug.current` (non localizzato). Getter `getPosts/getPostBySlug/getCategories` in `content.ts`.

**TypeGen quirks (M6 documentato):** `localizedString` custom types tipati come `Array<{_type, it?, en?, …}>`, oggi con tutte e cinque le lingue — consumer cast `as unknown as { it?, en? }`. Enum schema (`parentMenu`) → TypeGen union narrowed.

## Design System (`globals.css`)

Tokens in `src/app/globals.css` `@theme` block + `:root` aliases + `@layer components`.

**Surfaces:** `fa-ink` (#0b1215, **nero UNICO per le sezioni scure** site-wide, refactor `9faddc7`), `fa-black` (#1a1a18, **solo** testo on-light/bordi/Boss baseline), `fa-white` (#f6f4f0, il crema: fondo delle pagine e testo su scuro, `--fa-text-on-dark`), `fa-paper` (#fff, il bianco puro: controlli e fondo delle card chiare, che è il ruolo `fa-surface`). Due chiari soli dal 23/10/2026 (#299): la regola per intero è nella rule `design-system`.

**Accents:** `fa-navy` (#1b2e4a), `fa-navy-light` (#2a4570), `fa-navy-bright` (#3d5f99)

**Steel finishes (post-FASE 4.2.3 — 8 codici Sanity-aligned, Option B hex):**

| Code | Hex       | Sanity name                          |
| ---- | --------- | ------------------------------------ |
| MX   | `#d4d4d0` | Polished Supermirror                 |
| BX   | `#b8b6b0` | Brushed natural                      |
| MB   | `#2c2c2a` | Matte Black painted                  |
| RL   | `#e8e6e1` | Painted RAL/PANTONE/NCS placeholder  |
| AB   | `#0a0a09` | PVD Brushed Absolute Black           |
| BB   | `#c4a35a` | PVD Brushed Brass                    |
| BC   | `#b07040` | PVD Brushed Copper                   |
| DB   | `#1c1c1a` | PVD Polished Deep Black              |

`FINISH_HEX_FALLBACK` mirror in `src/lib/placeholders.ts` + `getFinishHex(code, sanityHex)` helper. Fallback used until Andrea populates `finish.colorHex` (M5).

**Typography:** i token del design system, `display-hero` → `micro`/`nav`, con line-height e letter-spacing
accoppiati; accanto, dal #221, i **gradini di sola dimensione** `--text-{micro,caption,body,display}-N` (nessun
compagno: impostano il solo `font-size`) e, dal #222, `--leading-lede` e `--tracking-1…7` + `--tracking-link`;
`--leading-tight` vale 1,2 (#300), non l'1,25 di Tailwind.
Le classi non portano più valori scritti a mano: lo vieta la guardia di lint.

**Motion:** `--ease-out-expo`, `--ease-out-cubic`, `--dur-{micro,sheet,control,standard,reveal,hero}` (200 · 250 · 300 · 400 · 600 · 800 ms; le classi e il CSS li usano, GSAP no: vuole numeri), `--container-max: 1200px`.

**Raggi e ombre:** `--radius-lg` 12 · `--radius-xl` 16 · `--radius-3xl` 24 · `--radius-pill` · `--radius-full`; `--shadow-card`, `--shadow-product`, `--fa-text-shadow-photo` (testo sulle foto), `--fa-veil-hover-dark` (il velo di hover su scuro). Le lunghezze sulla griglia da 4 px si scrivono con la scala (#300). Le scelte e le soglie della Fase 2 dei token: `docs/specs/token-fase-2.md`.

**`@layer components` utilities (FASE 4.1.1 + 4.1.3b + 4.2.3):**

- `.fa-eyebrow` (+`.on-dark`), `.fa-h{1-4}`, `.fa-body-{lg,sm}`
- `.fa-section` (+`.dark`/`.light`), `.fa-container` (+`.narrow`)
- `.fa-tag` (+`.on-dark`), `.fa-finish-dot` (pallini delle finiture; quelli del carosello hanno `.fa-coverflow-dot` nel `<style>` del componente, #218), `.fa-pill` (+`.active`)
- Mobile fallback `[data-fa-gallery="row"]`, nato per FontealtaRowGallery (4.1.3b). ⚠️ Il componente è stato rimosso con #171: la regola CSS resta in `globals.css` senza più un consumatore
- **Traccia dei controlli a bordo (17/09/2026, PR #207):** `--fa-stroke` (3 px, solo CTA outline), `--fa-stroke-color` (bianco puro, fondi scuri), `--fa-stroke-color-on-light` (navy, fondi chiari) in `:root`; toggle, tab, chip e frecce hanno il colore dei token e lo spessore di prima.
- **Button sizing tokens (PR #29):** `--btn-{height,pad,font}-{s,m,l,xl}` in `:root` (S 36/14/16 · M 44/15/24 · L 48/16/32 · XL 64/17/40) = single source per `Button` (`size="s|m|l|xl"`, default `m`), `.fa-pill` (=S, dedup transition) e bottoni hand-rolled nav/paginazione. Hit-area touch ≥44px via `@media(pointer:coarse)`.

**Boss baseline** (Sprint 1) is **read-only** per la §0.5 dell'ARCHITECTURE di giugno, oggi in `docs/archive/ARCHITECTURE-2026-06.md` — `<Section>`, `<Button>`, `<Navigation>`, `<Footer>`, `useScrollReveal` (the `src/lib/` one), `globals.css` original tokens. Sprint 2+ extends additively, no edits. ⚠️ **Non vale più** (verificato 22/09/2026): `Button`, `Navigation`, `Footer` e `globals.css` si modificano normalmente da settembre (per esempio #207 e #218). Resta solo l'esclusione da prettier di `globals.css`, `button.tsx` e `src/app/fonts/` in `.prettierignore` (verificato 25/09/2026: le righe di `section.tsx`, tolto dal #222, e di `src/lib/use-scroll-reveal.ts`, rinominato il 10/09, sono uscite perché puntavano a file che non esistono).

## Dove guardare — documenti di riferimento

<!-- Spostata TALE E QUALE da CLAUDE.md § Reference docs il 23/09/2026, nel chore(docs) del giro (voce docs/history/2026-09-23-chore-docs.md): CLAUDE.md era contro il tetto dei 20 KB e questa è una mappa, cioè il genere di questo file. In CLAUDE.md resta una riga di rimando. -->

- `ARCHITECTURE.md` (root) — riscritto il 27/08/2026 su un inventario misurato; **si aggiorna a ogni `chore(docs)` o si dichiara stale**; §1 «Stato reale». Il precedente (giugno 2026), registro storico delle decisioni e del design system, è in `docs/archive/ARCHITECTURE-2026-06.md`.
- **`docs/history.md` è l'INDICE, non il registro: dal 31/08/2026 una voce = un file** in `docs/history/AAAA-MM-GG-slug.md`, e in `history.md` resta solo il rimando. Le voci **precedenti** al 31/08 restano dove sono — sono verbali datati, spostarle sarebbe solo rumore nel diff.
- `docs/archive/TODO-2026-06.md` — ex `TODO.md`, fermo dal 4/05/2026, archiviato il 27/08; i **2 rimandi in `docs/SPRINT-2-PLAN.md` restano**: è un verbale datato.
- `docs/SPRINT-2-PLAN.md` — Sprint 2 operational plan (8 phases originali, decomposed in FASE 4.0.x → 4.1.x → 4.2.x → 4.3+ runtime).
- `docs/TAXONOMY.md` **v2.0** (29 lug 2026) — **storico** per due dimensioni su tre: `productType` e `ambient` sono cancellati da schema, codice e dati, e le sezioni che li riguardano sono marcate. Resta **viva la sola spec `tags`** più la struttura del catalogo; la tassonomia operativa è in `docs/front2-design.md`.
- `docs/front2-design.md` — **tassonomia viva** (`productMacro` + `productSubtype`): schema, label map IT/EN dal listino, piano consumatori, sequenza PR-A → migrazione → PR-B, rischi. **Ciclo chiuso lug 2026:** PR-A #60, migrazione #61, PR-B + unset dei valori orfani.
- `docs/incassi-design.md` — **cantiere INCASSI, CHIUSO 29 lug 2026**: schema `concealedBody`, asimmetria dell'indice (§3), rotte e tag cache (§5), semantica array dei filtri (§6), scheda come negativo del template modello (§7), mini-guida del documento collection e tempistica del Publish (§9), sequenza PR 1→4 e resoconto di chiusura (§10).
- **Le due guide operative, per Marco operatore** (non per chi scrive codice) — coppia a fonte unica, si rimandano a vicenda e non si sovrappongono mai:
  - `docs/procedura-nuova-collezione-passo-passo.md` — «Andrea comunica una collezione nuova + la lista modelli»: checklist informazioni, creazione documento, cover 896×1200, publish, associazione dei modelli (a mano se ≤10, via MCP se di più), controprova, chiusura con Andrea.
  - `docs/guida-contenuti.md` — il singolo documento: corpo a incasso campo-per-campo, articolo, associazione corpo↔modello, immagini e hotspot, cosa-non-fare, e **cosa aspettarsi dopo il Publish** (tempi reali, i tre controlli prima di allarmarsi, e il caso della fetch-cache che fa rendere 404 una pagina nuova).
- `docs/content/catalog-reference.md` — catalog source of truth (R4 Apr 2026, 591 articles).
- **`docs/specs/` — le spec dei cantieri**, scritte prima del codice e committate con la prima PR del cantiere: `token-fase-2.md` (Fase 2 dei token, chiusa il 23/10/2026 con #297, #299 e #300: scelte di Marco, soglie per categoria, criteri di successo), `tavola-officina.md` (la tavola dell'officina sul sito, quattro PR dal 27/10/2026, #311-#315; al presente finché restano aperte le voci del cancello) e i due prompt-spec della pipeline delle immagini. Una spec decide; le voci di history dicono com'è andata.
- `09_Design-Figma/02_Design-System/` nella cartella madre, fuori dal repo — design system handoff (`DESIGN-SYSTEM.md`, `Token/`, `colors_and_type.css`). ⚠️ Il vecchio percorso `~/Desktop/fontealta-design-system/project/` non esiste più (verificato 22/09/2026). M10 reconciliation pending.
