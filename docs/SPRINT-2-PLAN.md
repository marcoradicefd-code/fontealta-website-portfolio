# Sprint 2 — "Catalog Live"

> Sito Fontealta — popolamento programmatico del catalogo completo + UI minimale per navigazione.

**Effort stimato**: 5-6 giorni operativi
**Versione spec**: ARCHITECTURE.md v2.3+ (post Sprint 1)
**Referenze**: `docs/content/catalog-reference.md` (R4 Apr 2026), `docs/TAXONOMY.md` (tassonomia consolidata)
**Obiettivo finale**: il capo apre `localhost:3000`, naviga `/collezioni`, vede tutte le 21 collezioni Fontealta cliccabili, dentro ognuna vede i modelli reali con codice + descrizione IT + tag + finiture disponibili.

---

## Filosofia Sprint 2

**Catalog-first, UX minimale**. Sprint 2 è **data-heavy, animation-zero**. Riusiamo i componenti del capo (`<Section>`, `<Button>`) e i token CSS senza scrivere nuovi componenti decorativi. Le animazioni complesse (hero stepped, fullscreen slider) sono **Sprint 3**.

### Vincoli operativi (regole ferree)

1. **Codice del capo intatto**: file Read-only di §0.5 ARCHITECTURE.md mai toccati
2. **Schema extension prima di seed**: nessun document seedato prima che lo schema sia esteso e validato
3. **Parser idempotente**: rilanciabile sempre, no duplicati
4. **Stop-points obbligatori**: dopo ogni fase critica un check con l'utente
5. **Tassonomia consolidata**: regole in TAXONOMY.md (locked)
6. **No animation, no form, no immagini reali in Sprint 2**: posporrate a Sprint 3-4
7. **Branch feature obbligatorio**: `sprint/2-catalog-live`, merge --ff-only a fine
8. **Niente UI custom non riusata**: solo `<Section>`, `<Button>`, `<Navigation>`, `<Footer>` del capo

---

## Decisioni prese in pianificazione

### Tassonomia (vedi TAXONOMY.md)
- 12 productType
- 5 ambient (outdoor/indoor/kitchen/yacht/bagno)
- N tags aperti (community, yacht, auto-stop, pull-out, ecc.)

### Schema extension — 4 campi nuovi
- `description: localizedString` (IT obbligatorio dal R4, EN da tradurre dopo)
- `availableFinishes: array of reference to finish` (constraint, non array libero)
- `includesConcealedBody: boolean` (marker 🔒)
- `productType: string enum` (12 valori)
- `tags: array of string` (aperto)
- `collections: array of reference` (N-to-N, sostituisce singolo `collection`)

### Immagini
**Niente immagini reali in Sprint 2**. Tutti i model con cover/images vuoti, fallback gradient `from-fa-navy to-fa-navy-light` come in Sprint 1. Pipeline immagini è Sprint 4 dedicato.

### Pagine UI in scope
- `/collezioni` (lista 21 sezioni)
- `/outdoor`, `/indoor`, `/kitchen` (filtrate per ambient)
- `/collezioni/[slug]` (detail collection con lista modelli)

NON in scope:
- `/collezioni/[slug]/[modelSlug]` (detail modello — Sprint 3-4)
- Search globale
- Filtri avanzati per tag

---

## 8 Fasi operative

### FASE 1 — Schema extension Sanity (0.5 giorni)

**Obiettivo**: aggiornare schema `model.ts` con i 4 campi nuovi + cambiare `collection` a `collections` (N-to-N).

**Steps**:
1. Estendi `sanity/schemas/documents/model.ts`:
   - `description: localizedPortableText` (riusa l'oggetto esistente)
   - `availableFinishes: array of reference to finish` con validation `min(1).max(8)`
   - `includesConcealedBody: boolean` con default `false`
   - `productType: string` con `options.list = [12 valori da TAXONOMY.md]`
   - `tags: array of string` con `options.predefined = [lista tag noti]` ma aperto
   - **BREAKING**: cambia `collection: reference` in `collections: array of reference` (N-to-N)
2. Genera nuovi types:
   ```
   pnpm typegen
   ```
3. Verify nessun errore di build:
   ```
   pnpm typecheck && pnpm build
   ```
4. **MIGRATION del singolo doc Boss-related esistente** (Sprint 1 seed):
   - I 2 model esistenti (`model-b76m`, `model-c90m`) hanno il campo old `collection`
   - Lo script di migrazione li converte: `collections: [{_ref: "collection-boss-it", _key: "..."}]`
   - Esegui `pnpm migrate:sprint-2-schema` (script da scrivere — dedicated, NON nel seed principale)
5. Verify documenti migrati nello Studio: campo `collection` sparito, `collections` array presente

**Output atteso**: schema esteso, types rigenerati, 2 model esistenti migrati al nuovo campo.

**STOP**: utente verifica visivamente nello Studio che B76.M e C90.M sono ancora visibili e linkati a Boss.

---

### FASE 2 — Parser catalog MD → JSON normalizzato (1.5 giorni)

**Obiettivo**: scrivere `scripts/parse-catalog.ts` che legge `docs/content/catalog-reference.md` e produce `scripts/seed-data/parsed-catalog.json` con TUTTI i 591 articoli normalizzati secondo la tassonomia.

**Architettura del parser**:

```
docs/content/catalog-reference.md
        ↓
   parse-catalog.ts
   - tokenizer markdown
   - section detector (## 1️⃣ ILLE → ## 2️⃣1️⃣ ACCESSORIES)
   - sub-section detector (### 🚿 Lavabo / ### 🛁 Vasca / ...)
   - row parser per ogni tabella
   - suffix-to-tag rules (TAXONOMY.md tabella tags)
   - productType inference (TAXONOMY.md edge cases)
   - ambient inference (collection → ambient lookup)
   - dedup cross-section (lista 23 articoli condivisi)
        ↓
scripts/seed-data/parsed-catalog.json
   {
     "collections": [21 entries],
     "models": [591 entries deduplicati],
     "stats": {
       "totalParsed": 614,
       "totalUnique": 591,
       "duplicates": 23,
       "byProductType": { "lavabo-miscelatore": N, ... },
       "byAmbient": { "outdoor": N, "indoor": N, ... }
     }
   }
```

**Steps**:
1. Crea `scripts/parse-catalog.ts` con TypeScript strict
2. Implementa lookup tables (in cima al file, hardcoded):
   - `SECTION_TO_COLLECTION` (21 mapping: "1️⃣ ILLE COLLECTION" → `{ id: "ille", title: "ILLE", ambient: "indoor" }`)
   - `SUBSECTION_TO_PRODUCTTYPE` (regole: "### 🚿 Lavabo — Miscelatori" → `lavabo-miscelatore`, ecc.)
   - `SUFFIX_TO_TAG` (Map suffixes a tag, basato su TAXONOMY.md)
   - `CROSS_SECTION_ARTICLES` (lista 23 codici condivisi: ["WMRL", "MR", "WX75.SK", ...])
   - `PRODUCT_TYPE_BY_CODE_PREFIX` (override esplicite per edge case: es. "S0" prefix → accessory)
3. Implementa `parseMD(content: string): ParsedCatalog`:
   - Split per `^## ` (sezioni)
   - Per ogni sezione: trova sotto-sezioni `^### `
   - Per ogni sotto-sezione: trova tabelle markdown `| Codice | ... |`
   - Per ogni riga tabella: estrai code, finiture, descrizione, marker 🔒
4. Implementa `inferProductType(code, section, subsection): ProductType`:
   - Priorità 1: lookup esplicito per code (override edge case)
   - Priorità 2: subsection → productType (es. "Doccia — Colonne" → `doccia-colonna`)
   - Priorità 3: section context fallback (default per sezione)
5. Implementa `inferTags(code, section): string[]`:
   - Parsa suffisso `.AST`, `.Y`, `.XCW`, ecc. da regex
   - Aggiungi tag di sezione (`waterline`, `community`, `yacht`)
   - Aggiungi `concealed-body` se 🔒 presente
6. Implementa `dedupeCrossSection(models): Model[]`:
   - Group by `code`
   - Merge `collections[]` per duplicati (1 model con N collections)
7. Output JSON in `scripts/seed-data/parsed-catalog.json`
8. Aggiungi script `parse:catalog` al package.json
9. Run + check stats:
   ```
   pnpm parse:catalog
   ```
   Output atteso console:
   ```
   ✓ Parsed 21 collections
   ✓ Parsed 614 raw articles
   ✓ Deduplicated to 591 unique
   ✓ Distribution productType:
     - doccia-colonna: 87
     - lavabo-miscelatore: 64
     ...
   ✓ JSON written to scripts/seed-data/parsed-catalog.json (~250KB)
   ```
10. **Verify manuale**: apri `parsed-catalog.json`, controlla a campione 5-10 articoli. Verifica che:
    - B76.M ha `productType: "doccia-colonna"`, `ambient: "indoor"`, `tags: ["with-mixer"]`
    - B76.AST ha `productType: "doccia-colonna"`, `ambient: "outdoor"`, `tags: ["community", "auto-stop"]`
    - Q500 ha `productType: "doccia-soffione"`, `tags: ["waterline"]`
    - K35.S ha `productType: "lavabo-miscelatore"`, `ambient: "kitchen"`, `tags: ["pull-out"]`

**Output atteso**: JSON parsato e validato a campione.

**STOP**: utente verifica a campione il JSON. Se ci sono errori di classificazione, parser va corretto PRIMA di procedere a fase 3.

---

### FASE 3 — Script seed completo (1 giorno)

**Obiettivo**: `scripts/seed-sprint-2.ts` legge `parsed-catalog.json` e popola Sanity con 21 collezioni + 591 modelli.

**Architettura**:

```
parsed-catalog.json
        ↓
   seed-sprint-2.ts
   - Validation runtime con Zod (schema match)
   - Connect Sanity client (SANITY_WRITE_TOKEN)
   - Idempotent: createOrReplace con _id deterministici
   - Batch inserts (50 docs per transaction per performance)
   - Progress logging
        ↓
Sanity dataset (production)
   - 21 collection documents (con language: "it")
   - 591 model documents
```

**Steps**:
1. Crea `scripts/seed-sprint-2.ts`:
   - Importa `parsed-catalog.json`
   - Importa `createClient` da @sanity/client
   - Definisci Zod schema per validation
   - Validate JSON contro Zod schema (fail fast se malformato)
   - Crea client con `SANITY_WRITE_TOKEN`
2. Implementa `seedCollections(parsedCollections)`:
   - Per ogni collection in JSON: `_id: collection-{slug}-it`, `language: "it"`, `code`, `title`, `slug`, `tagline` (vuoto se non noto), `ambient` (lookup), `order` (progressivo)
   - Batch in transaction da 21
3. Implementa `seedModels(parsedModels)`:
   - Per ogni model: `_id: model-{slugified-code}` (es. "B76.M" → "model-b76-m")
   - Tutti i campi popolati: code, name (IT), description (IT), productType, ambient, tags[], collections[] (refs), availableFinishes[] (refs), includesConcealedBody
   - **availableFinishes**: lookup dal catalog string "AB · BB · BC ..." → array di `{_ref: "finish-{code-lowercase}"}`
   - **collections**: array di reference (per i 23 cross-section, articoli appartengono a 2+ collections)
   - Batch da 50 alla volta per performance (12 batch totali per 591)
4. Logging progressivo:
   ```
   ✓ Seeded 21 collections (1.2s)
   → Seeding models batch 1/12 (50 of 591)...
   → Seeding models batch 2/12 (100 of 591)...
   ...
   ✓ Seeded 591 models (24.5s total)
   ```
5. Aggiungi script `seed:sprint2` al package.json
6. Run + verify in Studio:
   ```
   pnpm seed:sprint2
   ```
7. Apri `localhost:3000/studio` e verifica:
   - Sidebar Collections: 22 documenti (21 + Boss che era già lì? O Boss viene replaced? Decidere prima — probabilmente replaced, dato che Sprint 1 Boss era seed di test)
   - Sidebar Models: 591 documenti (o 591 + 2 di Sprint 1 = 593 — decidere se mantengo o purge i 2 di Sprint 1)
   - Apri qualche model: verifica fields popolati

**STOP**: utente verifica nel Studio a campione 5-10 model. Se OK, procedi.

**Decisione operativa**: il seed di Sprint 1 (1 ambient + 8 finishes + 1 collection Boss + 2 models) **deve essere preservato** o **rimpiazzato** dal seed di Sprint 2?

Mia raccomandazione: **rimpiazzato**. Sprint 2 è il "vero" seed completo. Sprint 1 era PoC. Lo script Sprint 2 prima fa purge documenti con `_id` iniziante per `model-` o `collection-`, poi rifa tutto. Le 8 finishes restano (sono universali). L'ambient Outdoor resta (è universale), e si aggiungono altri ambient: Indoor, Kitchen, Yacht (4 totali).

---

### FASE 4 — Pagine UI dinamiche `/collezioni`, `/outdoor`, `/indoor`, `/kitchen` (1.5 giorni)

**Obiettivo**: 4 pagine sito che mostrano collezioni filtrate per ambient.

**Architettura URL** (next-intl pathnames già configurati in routing.ts):

| URL IT | URL EN | Server Component | Filtro |
|---|---|---|---|
| `/collezioni` | `/collections` | `(site)/[locale]/collezioni/page.tsx` | Tutte le 21 |
| `/outdoor` | `/outdoor` | `(site)/[locale]/outdoor/page.tsx` | `ambient: "outdoor"` |
| `/indoor` | `/indoor` | `(site)/[locale]/indoor/page.tsx` | `ambient: "indoor"` |
| `/kitchen` | `/kitchen` | `(site)/[locale]/kitchen/page.tsx` | `ambient: "kitchen"` |

**Steps**:
1. Crea `src/app/(site)/[locale]/collezioni/page.tsx`:
   - Server Component async
   - `getCollections({ locale })` da `src/lib/content.ts` — già esiste da Sprint 1
   - Render in grid 3-col × 7-row (21 collection)
   - Riusa `<Section theme="dark">` del capo
   - Card per collection: titolo + tagline + numero modelli + cover (gradient fallback)
   - Click su card → `/collezioni/[slug]`
2. Crea `src/app/(site)/[locale]/outdoor/page.tsx`:
   - Server Component async
   - Estendi `getCollections` con filtro: `getCollections({ locale, ambient: "outdoor" })`
   - Render stessa grid ma filtrata
3. Idem per `/indoor` e `/kitchen`
4. Estendi `src/lib/content.ts` con:
   ```ts
   getCollections({ locale, ambient? }: { locale: Locale, ambient?: Ambient })
   getCollection(slug, locale)  // detail con models linkati
   ```
5. Aggiungi GROQ query in `sanity/lib/queries.ts`:
   ```groq
   *[_type == "collection" && language == $locale && (!defined($ambient) || $ambient in ambients[]->parentMenu)]
   | order(order asc) {
     _id, code, title, slug, tagline,
     "modelsCount": count(*[_type == "model" && references(^._id)]),
     ambients[]->{_id, parentMenu, title}
   }
   ```
6. Verify nel browser:
   - `/collezioni` → 21 cards
   - `/outdoor` → solo collection outdoor (~3-4 sezioni)
   - `/indoor` → ~16 sezioni
   - `/kitchen` → 1 sezione (KITCHEN)

**STOP**: utente verifica visivamente le 4 pagine. Mandami screenshot.

---

### FASE 5 — Pagina detail collection `/collezioni/[slug]` (0.5 giorni)

**Obiettivo**: pagina che mostra TUTTI i modelli di una specifica collezione.

**Architettura**:

URL `/collezioni/boss` mostra:
- Hero con title collection + tagline
- Grid 3-col di model cards
- Ogni card: code + name + finiture (8 swatches) + tag badges

**Steps**:
1. Crea `src/app/(site)/[locale]/collezioni/[slug]/page.tsx`:
   - Server Component async
   - `getCollection(slug, locale)` con expanded models linkati
   - `generateStaticParams` per pre-render delle 21 collezioni × 2 lingue = 42 pagine statiche
2. GROQ query per detail:
   ```groq
   *[_type == "collection" && slug.current == $slug && language == $locale][0] {
     _id, code, title, tagline, ambients[]->,
     "models": *[_type == "model" && references(^._id)] | order(code asc) {
       _id, code, name, slug, description,
       productType, ambient, tags, includesConcealedBody,
       availableFinishes[]->{code, name, category}
     }
   }
   ```
3. Render layout:
   - `<Section theme="dark">` con title + tagline
   - `<Section theme="light">` con grid model cards
4. Card model semplice (NON nuovo componente custom, riuso pattern):
   ```jsx
   <article className="border border-fa-stroke rounded-md p-6 bg-fa-paper">
     <p className="font-mono text-sm text-fa-text-muted">{code}</p>
     <h3 className="text-card-title mt-2">{name[locale]}</h3>
     <p className="text-body-sm mt-2 line-clamp-3">{description[locale]}</p>
     <div className="flex gap-2 mt-4">
       {availableFinishes.map(f => <span className="finish-swatch" data-finish={f.code} />)}
     </div>
     {tags.length > 0 && (
       <div className="flex gap-1 mt-3 flex-wrap">
         {tags.map(t => <span className="text-xs bg-fa-surface px-2 py-1 rounded">{t}</span>)}
       </div>
     )}
   </article>
   ```
   `finish-swatch` è già nei token CSS del capo (verificare in globals.css).

**STOP**: utente verifica `/collezioni/boss` mostra B76.M e C90.M con tutti i campi popolati.

---

### FASE 6 — Filtri ambient + finitura sulle pagine ambient (0.5 giorni)

**Obiettivo**: nelle pagine `/outdoor`, `/indoor`, `/kitchen` aggiungere filtri client per finitura. Tag-based filtering invece resta server-side via URL param.

**Steps**:
1. Estendi `[ambient]/page.tsx` per accettare `?finish=AB,BB&tag=community` query params
2. Filtro server-side con GROQ extension
3. UI filtri inline: pills cliccabili per ogni finitura disponibile + tag attivi
4. Filtri client-side opzionali per finezza (es. live update senza reload)

**Decisione operativa**: client filters complicano. Per Sprint 2 preferisco **server-only via URL params**. Più semplice, più SEO-friendly.

**STOP**: utente verifica filtri funzionano.

---

### FASE 7 — Aggiornamento UI homepage + Footer + Navigation (0.5 giorni)

**Obiettivo**: la homepage del capo (`(site)/[locale]/page.tsx`) ora mostra solo Boss in grid Collezioni. Estenderla per mostrare TUTTE le 21 collezioni? O lasciamo le 6 placeholder + link "Vedi tutte" → `/collezioni`?

**Decisione**: lasciamo grid 6-cards placeholder come è (preserva struttura visiva del capo), ma sostituiamo le 6 hardcoded con le 6 collezioni più popolari (priority manuale: ILLE, BOSS, ORIGO, SKINNY, FLAMINGO, TWIGGY) + bottone "Vedi tutte le 21 collezioni" → `/collezioni`.

**Steps**:
1. Estendi `getCollections` con parametro `featured: true` (TODO: aggiungi campo `featured: boolean` al collection schema in fase 1)
2. Marca le 6 collezioni featured nel seed (Sprint 2 fase 3 update)
3. Update homepage per usare `getCollections({ locale, featured: true })`
4. Aggiungi `<Button>Vedi tutte le 21 collezioni</Button>` linkato a `/collezioni`
5. Footer link Collezioni → al posto di hardcoded link, le 6 featured

**STOP**: utente verifica homepage mostra 6 collezioni reali + CTA.

---

### FASE 8 — Tooling, CI, commit, PR (0.5 giorni)

**Obiettivo**: chiusura sprint, commit atomici, push branch, merge --ff-only.

**Steps**:
1. Aggiorna `.env.example` con eventuali nuove env vars
2. Aggiorna `TODO.md` con pendenti Sprint 3+
3. Aggiorna `ARCHITECTURE.md` a v2.4 con:
   - Tassonomia consolidata (riferimento a TAXONOMY.md)
   - Schema esteso (4 campi nuovi)
   - Pattern parser MD (link a `scripts/parse-catalog.ts`)
   - Sprint 2 = COMPLETED
4. Run finale verify:
   ```
   pnpm lint && pnpm typecheck && pnpm typegen && pnpm build
   ```
5. Smoke test browser su tutte le 4 pagine + detail Boss
6. Commit atomici (~15-20 commit):
   - `feat(sanity): extend model schema with productType, tags, availableFinishes, etc`
   - `feat(seed): migrate Sprint 1 models to new schema`
   - `feat(parser): catalog MD → JSON parser with taxonomy rules`
   - `feat(seed): Sprint 2 full catalog seed (21 collections + 591 models)`
   - `feat(pages): /collezioni listing with all sections`
   - `feat(pages): /outdoor /indoor /kitchen filtered by ambient`
   - `feat(pages): /collezioni/[slug] detail with model grid`
   - `feat(home): featured collections in homepage`
   - `feat(filters): server-side filter by finish + tag via URL params`
   - `docs: TAXONOMY.md (locked v1.0)`
   - `docs: ARCHITECTURE.md v2.4 — Sprint 2 lessons consolidate`
   - `docs: TODO.md updated with Sprint 3+ backlog`
7. Push branch `sprint/2-catalog-live`
8. Merge --ff-only a main (manuale dall'utente, harness policy)

---

## Fasi: tabella riepilogativa

| # | Fase | Effort | Stop point | Output |
|---|---|---|---|---|
| 1 | Schema extension | 0.5g | Studio mostra B76.M migrato | Schema esteso, types rigenerati |
| 2 | Parser MD → JSON | 1.5g | JSON validato a campione | parsed-catalog.json (~250KB) |
| 3 | Seed completo | 1.0g | Studio mostra 21 collection + 591 models | Sanity popolato |
| 4 | Pagine UI ambient | 1.5g | 4 pagine browser OK | /collezioni, /outdoor, /indoor, /kitchen |
| 5 | Detail collection | 0.5g | /collezioni/boss mostra modelli | /collezioni/[slug] |
| 6 | Filtri | 0.5g | URL params filtrano | Filtri server-side |
| 7 | Homepage update | 0.5g | Homepage mostra 6 featured + CTA | Homepage live |
| 8 | Commit + PR | 0.5g | Branch pushato, ready merge | Sprint 2 chiuso |
| **TOTALE** | **5.5 giorni operativi** | | |

---

## Definition of Done — Sprint 2

Sprint 2 si considera chiuso quando TUTTI questi check passano:

- [ ] `pnpm lint` passa
- [ ] `pnpm typecheck` passa
- [ ] `pnpm typegen` idempotente
- [ ] `pnpm build` zero errors zero warnings
- [ ] `localhost:3000/studio` mostra 21 collections + 591 models
- [ ] `localhost:3000/collezioni` lista 21 sections cliccabili
- [ ] `localhost:3000/outdoor` filtra (~3-4 sezioni)
- [ ] `localhost:3000/indoor` filtra (~16 sezioni)
- [ ] `localhost:3000/kitchen` filtra (1 sezione: KITCHEN)
- [ ] `localhost:3000/collezioni/boss` mostra modelli Boss reali
- [ ] `localhost:3000` homepage mostra 6 featured + CTA
- [ ] Filtri URL params funzionanti
- [ ] Switcher IT/EN funziona su tutte le pagine
- [ ] DevTools console pulita
- [ ] git diff su file Read-only del capo: VUOTO
- [ ] Branch `sprint/2-catalog-live` pushato
- [ ] ARCHITECTURE.md v2.4 + TAXONOMY.md committed

---

## Pendenti per Sprint 3+

Dopo chiusura Sprint 2, questi sono i task naturali per gli sprint successivi:

### Sprint 3 — "Animation + Forms" (~4-5 giorni)
- 4 pattern GSAP sopra design del capo (hero stepped, fullscreen slider, pinned, reveal)
- Form contatto definitivo (Resend + Zod + honeypot + rate limit)
- 404/500 custom con DrawSVG su logo "ff"
- LocaleSwitcher per pagine [slug] dinamiche
- Page transitions Barba.js o View Transitions API

### Sprint 4 — "Immagini + UX Detail" (~5-6 giorni)
- Pipeline Dropbox → Sanity asset upload (65 link ILLE come PoC)
- Pagine dettaglio prodotto `/collezioni/[slug]/[modelSlug]`
- Search globale con Algolia o GROQ search
- Filtri avanzati per tag + finish + productType combinati
- Image lazy-load con LQIP

### Sprint 5 — "Production-ready" (~3-4 giorni)
- Iubenda + Plausible env vars production
- Custom domain `fontealta.it` su Vercel
- Lighthouse final audit (LCP <1.8s, perf ≥95)
- Smoke test E2E Playwright completo
- SEO multi-tipo schema.org (Organization, Product, CreativeWork)
- Handoff documentation per il capo

---

*Spec versione 1.0 — locked 4 maggio 2026 dopo chiusura Sprint 1.*
*Da rivedere e aggiornare a v1.1+ se emergono spec drift durante esecuzione.*
