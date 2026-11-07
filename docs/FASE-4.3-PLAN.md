# FASE 4.3 — Ambient Pages Plan

> ⚠️ **SUPERATO, e per intero.** Questo piano progettava le **pagine ambient**, che sono
> state **rimosse** dal sito con `8ef5cc4`. Lo stato «pre-implementation» in testa non
> descrive un lavoro in attesa: descrive un lavoro che non si fara' mai. Resta come
> verbale del ragionamento di allora.

> Stato: pre-implementation. Audit completato (FASE 4.3.1). Decisioni risolte. Sotto-fasi 4.3.2 / 4.3.3 / 4.3.4 pronte all'esecuzione.
>
> **Sprint**: 2 — Catalog UI
> **Branch**: `sprint/2-catalog-live` @ HEAD `9937eaf` (14 commits ahead `main`)
> **Audit data**: 2026-05-06

---

## Stato pre-FASE 4.3

- FASE 4.0 → 4.2 chiuse end-to-end (data layer + `/collezioni` overview + `/collezioni/[slug]` detail con filter Finitura+Ambiente)
- 47 SSG totali generati (5 base + 42 detail)
- PR draft #1 aperta, CI verde su push event + PR synchronize event
- Working tree pulito tranne `scripts/test-collection-detail.ts` (FASE 4.2.1 scratch, mai committare)
- Tech debt accumulati: M1-M13 + T1 (vedi `CLAUDE.md` § Tech debt registry)

---

## A1 — Ambient seed audit (Sanity dataset, verificato)

**4 documenti seedati** in production dataset:

| `_id`            | `parentMenu` | `slug.en` | `title.it` | `title.en` |
|------------------|--------------|-----------|------------|------------|
| `ambient-outdoor` | `outdoor`    | `outdoor` | Outdoor    | Outdoor    |
| `ambient-indoor`  | `indoor`     | `indoor`  | Indoor     | Indoor     |
| `ambient-kitchen` | `kitchen`    | `kitchen` | **Cucina** | Kitchen    |
| `ambient-yacht`   | `yacht`      | `yacht`   | Yacht      | Yacht      |

**Schema enum** (`sanity/schemas/documents/ambient.ts`) ammette **5 valori** con `bagno` come quinto. **Nessun documento `bagno` seedato.**

**Decisione**: drop schema enum value `bagno` come decisione strategica, **fuori scope FASE 4.3** (vedi M14 in § Tech debt registry update).

---

## A2 — Query existing audit

### Query trovate in `sanity/lib/queries.ts` (12 totali)

| Nome | Ambient-related | Note |
|---|---|---|
| `COLLECTIONS_OVERVIEW_QUERY` | ambient-aware | Proietta `ambient[]->{ ..., parentMenu, title[$locale] }` |
| `COLLECTION_BY_SLUG_QUERY` | ambient-aware | Nested ambient projection |
| `COLLECTIONS_BY_AMBIENT_QUERY` | **CORE** | Filtra `count(ambient[@->parentMenu == $menu]) > 0` |
| `MODELS_BY_AMBIENT_QUERY` | **CORE** | Filtra `model.ambient == $ambient` (string match) |
| `COLLECTION_DETAIL_QUERY` | ambient-aware | Computed `ambientLabels` array |
| `COLLECTION_SLUGS_QUERY`, altre | not ambient | — |

### `MODELS_BY_AMBIENT_QUERY` — verbatim

```groq
*[_type == "model" && ambient == $ambient] | order(code asc) {
  _id, code, name, "slug": slug.current,
  productType, ambient, tags, includesConcealedBody,
  "finishCount": count(availableFinishes),
  "collections": collections[]->{ _id, code, title, "slug": slug.current }
}
```

**Gap analysis**:
- ❌ Niente finish details (`colorHex`, `name`, `_id`) — solo `finishCount`. Bloccante per FilterBar Finitura derivation.
- ❌ Niente `primaryImage` per ModelCard cross-collection
- ❌ Niente lookup ambient document (slug localizzato, title localizzato per Hero)
- ✅ `collections[]->` proiettato (sufficient per facet Collezione)

### `COLLECTIONS_BY_AMBIENT_QUERY` — verbatim

```groq
*[_type == "collection"
  && language == $locale
  && count(ambient[@->parentMenu == $menu]) > 0
] | order(order asc) {
  _id, code, title, "slug": slug.current, tagline,
  coverImage { ..., "metadata": asset->metadata }
}
```

Solo collection meta. Utile come secondary lookup per facet derivation server-side, ma `MODELS_BY_AMBIENT_QUERY.collections[]` già ne fa il giro.

### Specifica nuova `AMBIENT_DETAIL_QUERY` (proposta FASE 4.3.2)

```groq
*[_type == "ambient" && slug[$locale].current == $slug][0] {
  _id,
  parentMenu,
  "title": title[$locale],
  "modelsCount": count(*[_type == "model" && ambient == ^.parentMenu]),
  "collectionsCount": count(*[_type == "collection" && language == $locale && count(ambient[@->parentMenu == ^.^.parentMenu]) > 0]),
  "finishesCount": count(array::unique(*[_type == "model" && ambient == ^.parentMenu].availableFinishes[]._ref)),
  "models": *[_type == "model" && ambient == ^.parentMenu] | order(code asc) {
    _id, code, name, "slug": slug.current,
    productType, ambient, tags, includesConcealedBody,
    primaryImage { ..., "metadata": asset->metadata },
    "finishes": availableFinishes[]->{ _id, code, name, colorHex },
    "collections": collections[]->{ _id, code, title, "slug": slug.current }
  }
}
```

**E nuova `AMBIENT_SLUGS_QUERY`** per `generateStaticParams`:
```groq
*[_type == "ambient" && defined(slug[$locale].current)]{ "slug": slug[$locale].current }
```

---

## A3 — Component reuse decisions

| Componente | Path | Decisione | Razionale |
|---|---|---|---|
| `CollectionHero` | `[slug]/_components/collection-hero.tsx` | **NEW `AmbientHero`** | Props tipo `COLLECTION_DETAIL_QUERY_RESULT` non riusabile. Stats semantica diversa (collezioni + modelli + finiture vs modelli + finiture + ambient). |
| `FilterBar` | stesso path | **REUSE as-is** | Presentational puro, props generic `{label, options[], active, onToggle}`. |
| `ModelsSection` | stesso path | **NEW `AmbientModelsSection`** | Filter dimensions diverse (Collezione facet vs Ambiente). useMemo derivations diverse. Pattern OR + Set state stesso. |
| `ModelCard` | `src/components/cards/model-card.tsx` | **EXTEND** con `showCollection?: boolean` prop | Cross-collection ambient page deve mostrare nome collezione. Default `false` per non rompere FASE 4.2 consumers. |

---

## A4 — Routing pathnames

### Stato attuale `src/i18n/routing.ts`

```ts
"/outdoor": "/outdoor",   // monolingual (string shorthand)
"/indoor": "/indoor",     // monolingual
"/kitchen": "/kitchen",   // monolingual
// /yacht ASSENTE
// /cucina ASSENTE
```

### Decisione (locked utente)

Convertire tutte e 4 le entry a **object form** per consistency, no string mixing. `kitchen` IT canonical → `cucina`:

```ts
"/outdoor": { it: "/outdoor", en: "/outdoor" },
"/indoor":  { it: "/indoor",  en: "/indoor"  },
"/yacht":   { it: "/yacht",   en: "/yacht"   },
"/cucina":  { it: "/cucina",  en: "/kitchen" },
```

**Razionale `outdoor/indoor/yacht` IT-EN parity**: termini brand-vocabulary luxury italiano (cfr. memory "outdoor solutions" come parte DNA Fontealta). Italianizzarli (`/esterno`, `/interno`) tradisce voce brand.

**Razionale `cucina ↔ kitchen`**: unica route effettivamente localizzata, perché il termine `kitchen` in italiano non è brand-DNA né naturale. `/cucina` IT canonical risolve.

### Pre-step verifica obbligatoria (PRE-4.3.3)

Prima di refactor le 3 entry esistenti (`/outdoor`, `/indoor`, `/kitchen`), eseguire:

```bash
grep -rn "/outdoor\|/indoor\|/kitchen" src/ sanity/ docs/
```

Verifica nessun riferimento attivo (`Link href="/kitchen"`, ecc.) che si rompe col refactor a object form. Se presenti, aggiornare i call site coerentemente nel commit refactor.

⚠️ **Cleanup `/kitchen` → `/cucina`**: la route monolingual `/kitchen` esistente diventa **non più matchata** dopo la rinomina IT canonical. Eventuali link interni esistenti vanno aggiornati (verificato via grep).

---

## A5 — Asset placeholder strategy

### Pattern attuale (FASE 4.2.2)

`CollectionHero` usa video Mixkit hardcoded fallback come default per tutte le 21 collezioni:

```ts
const VIDEO_FALLBACK_URL =
  "https://assets.mixkit.co/videos/preview/mixkit-water-flowing-from-a-stainless-steel-faucet-3093-large.mp4";
```

### Decisione (locked utente — Opzione B pragmatic)

**Riuso del singolo URL Mixkit per tutti 4 ambient pages** in Sprint 2.

- Pro: zero curation overhead, decisione zero, consistency con CollectionHero pattern
- Contro: visual identico cross-route (tutti acqua su acciaio)
- Compensazione: testo Hero (eyebrow + h1 italic + stats) differenzia chiaramente le 4 pagine

**M5 follow-up**: quando Andrea consegna asset reali Cloudflare R2 per ognuno dei 4 ambient (pool/spa/yacht/kitchen scenes specifici), swap on-demand. La query AMBIENT_DETAIL_QUERY proietta già `coverImage` per fallback poster.

### Implementazione AmbientHero

Stessa pattern conditional sources di CollectionHero:
```tsx
<video autoPlay muted loop playsInline poster={posterUrl}>
  {ambient.heroVideo && <source src={ambient.heroVideo} type="video/webm" />}
  <source src={ambient.heroVideoMp4 ?? VIDEO_FALLBACK_URL} type="video/mp4" />
</video>
```

⚠️ **Schema gap**: ambient document NON ha campi `heroVideo`/`heroVideoMp4`/`coverImage` (verificato A1). Per ora solo Mixkit fallback hardcoded. Future asset work via M5: aggiungere campi Sanity → swap a per-ambient asset.

---

## A6 — Filter dimensions

**Default locked utente: 2 facet — Finitura + Collezione.**

| Facet | Source | Pill count | Filter rule |
|---|---|---|---|
| **Finitura** | `useMemo` derivation: unique `_id` da tutti `model.finishes[]` | ≤ 8 | `model.finishes.some(f => activeFinishes.has(f._id))` |
| **Collezione** | `useMemo` derivation: unique `_id` da tutti `model.collections[]` | ≤ 21 (ma realistic 3-8 per ambient) | `model.collections.some(c => activeCollections.has(c._id))` |

**Filter logic**: stessa OR composition FASE 4.2.4 (locked):
```ts
(activeFinishes.size === 0 || model.finishes.some(...)) &&
(activeCollections.size === 0 || model.collections.some(...))
```

**State**: client-side `useState<Set<string>>` (locked, M13 deferred).

**Defer**: ProductType (12 valori) e Tag (17 predefined) → Sprint 4+ se utenti chiedono granularità.

---

## A7 — Sotto-fasi 4.3.2 / 4.3.3 / 4.3.4 breakdown

### 4.3.2 — Data layer + AmbientHero + 1 route esempio (`/outdoor` first)

**Deliverables**:
1. Estendere `MODELS_BY_AMBIENT_QUERY` con `finishes[]->` projection + `primaryImage` OPPURE creare nuova `AMBIENT_DETAIL_QUERY` slug-based (vedi specifica § A2)
2. Aggiungere `AMBIENT_SLUGS_QUERY` per `generateStaticParams`
3. `pnpm typegen` rigenerazione + commit dummy verify
4. `AmbientHero` Server Component nuovo (template cinematic come `CollectionHero` ma stats: collezioni / modelli / finiture)
5. Route `src/app/(site)/[locale]/outdoor/page.tsx` (slug hardcoded `"outdoor"`, NON dynamic)
6. Pathnames map update: 1 entry `/outdoor` con object form IT-EN parity
7. i18n keys nuovi namespace `ambient` (heroEyebrow + heroTitleSuffix + statCollezioni + statModelli + statFiniture)
8. Visual check Playwright: hero render desktop + mobile + console.error check + Mixkit URL 200

**Atomic boundary**: 4.3.2 è isolato da 4.3.3 — `/outdoor` deve essere completamente funzionante (Hero rendered, stats popolati) PRIMA di iniziare le 3 route restanti.

### 4.3.3 — Composition + filter pattern + 3 route restanti

**Deliverables**:
1. **PRE-step grep verification** (vedi § A4): `grep -rn "/outdoor\|/indoor\|/kitchen" src/ sanity/ docs/` — verifica nessun call site rompibile
2. `AmbientModelsSection` Client Component nuovo (riuso FilterBar + ModelCard con `showCollection={true}`)
3. Filter Finitura + Collezione + filter logic OR (stesso pattern FASE 4.2.4)
4. ModelCard extend: nuovo prop `showCollection?: boolean` (default `false`)
5. 3 route restanti: `src/app/(site)/[locale]/{indoor,yacht,cucina}/page.tsx` (4 file totali)
6. Pathnames map completo: aggiungere `/yacht`, `/cucina`, refactor `/outdoor`+`/indoor`+`/kitchen` esistenti a object form (cleanup `/kitchen` rinomina a `/cucina` — vedi A4 cleanup nota)
7. Visual check Playwright cross-route: 4 ambient × desktop + mobile = 8 screenshot + filter interactivity 1× per ambient

**Atomic boundary**: 4.3.3 chiude refactor pathnames + tutte 4 ambient pages (overflow se split mantenuto).

### 4.3.4 — Visual check finale + commit atomic

**Deliverables**:
1. Playwright suite estesa: empty state edge case (verifica almeno 1 ambient con 0 modelli — esiste? confermare con A1 dataset)
2. Cross-route smoke: link `/collezioni` → ambient page works (pattern Link `next-intl` typed o raw)
3. 404 verification: route ambient inesistente → 404
4. Atomic commit Hybrid B pattern (come FASE 4.1 e 4.2): 1 commit `feat(ambient-pages):` per le 4 route + componenti, opzionalmente 1 commit `chore(schema/queries):` separato per AMBIENT_DETAIL_QUERY se preferito atomic split (decisione utente fine 4.3.2)
5. Push fast-forward + CI verification (verde su push event + PR synchronize, lighthouse skipped via `a4cc421`)
6. Follow-up `chore(docs):` sync CLAUDE.md con FASE 4.3 closure (M11 ARCHITECTURE.md sync ancora pending Sprint 2 conclusion)

---

## Tech debt registry update

### M14 NEW — Bagno schema cleanup (deferred)

| Campo | Valore |
|---|---|
| **ID** | M14 |
| **Descrizione** | Drop `bagno` da `model.ambient` enum + `ambient.parentMenu` enum + sync `TAXONOMY.md` v1.1. Schema-level cleanup definitivo del 5° valore enum non seedato. |
| **Sprint stimato** | Sprint 4+ |
| **Status** | Open (require Andrea confirm pre-execution) |
| **Razionale** | Audit FASE 4.3.1 ha confermato: enum schema 5 valori (incluso `bagno`), seed 4 documenti (no bagno). Decisione strategica drop, MA fuori scope FASE 4.3 (deciso utente). Richiede `chore(schema):` standalone Sprint 4+ con conferma Andrea sull'intent futuro: `bagno` era pensato come ambient legacy / sub-section / planned ambient mai completato? |
| **Implementazione futura** | (1) `chore(schema): drop bagno from ambient enums` — modifica `model.ts` + `ambient.ts` schema files. (2) Migration script per audit modelli con `ambient: "bagno"` (atteso 0 per Sprint 2 audit). (3) `pnpm typegen` rigenerazione. (4) `TAXONOMY.md` update v1.1. |

### Aggiornamenti tabella esistente

- **M5** invariato (asset work Andrea) — relevant per M5 follow-up section A5 (per-ambient hero asset)
- **M11** invariato (ARCHITECTURE.md v2.4 sync Sprint 2 conclusion)
- **M13** invariato (Shareable filter URL search params Sprint 4+)

---

## Decisioni risolte (5/5 locked)

| # | Decisione | Status | Note |
|---|---|---|---|
| 1 | Pathnames IT canonical | ✅ Locked | `/cucina` IT + `/kitchen` EN parity, outdoor/indoor/yacht IT-EN identical, **all object form** (no string mixing). Pre-4.3.3 grep verification obbligatoria. |
| 2 | AmbientHero NEW vs CollectionHero extend | ✅ Locked | NEW component (props divergent, stats semantica diversa) |
| 3 | Bagno drop vs seed | ✅ Locked | Drop strategico, ma **fuori scope FASE 4.3** → M14 Sprint 4+ (require Andrea confirm) |
| 4 | Filter facets 2 vs 3 | ✅ Locked | 2 facet: Finitura + Collezione |
| 5 | Asset Mixkit | ✅ Locked | Opzione B pragmatic — riuso singolo URL CollectionHero per tutti 4 ambient. M5 swap a R2 per-ambient asset Andrea Sprint 4+ |

---

## Open follow-ups (post-FASE 4.3 closure)

- **M11 ARCHITECTURE.md v2.4 sync** — consolidate FASE 4.0+ findings (Sprint 2 conclusion or post-merge to main)
- **M14 bagno schema cleanup** — `chore(schema):` standalone Sprint 4+, require Andrea confirm
- **M5 per-ambient hero asset** — Andrea consegna 4 video Cloudflare R2, swap Mixkit fallback
- **Backup branch update** — `backup/sprint-2-post-4.2.2` 5 commit indietro post-FASE 4.2 closure, decisione separata rinomina vs preservare stale fallback

---

## Verification plan FASE 4.3 chiuso

End-to-end check post-4.3.4 push:

1. **Build pages count**: 47 → 47 + 4×2 (locale) = **55 SSG totali** (5 base + 42 detail collezioni + 8 ambient pages)
2. **Visual cross-check**: 4 ambient × IT/EN × desktop/mobile = 16 screenshot principali
3. **Filter interactivity**: 4 visual check per ambient (1 finish click + 1 collection click)
4. **CI verde**: push + PR synchronize, lighthouse skipped (a4cc421 fix attivo)
5. **i18n keys total post-FASE 4.3**: ~12-15 nuovi nel namespace `ambient` (titoli + 5 stats labels + filter labels + empty state)
6. **Tech debt status**: M5 + M14 nuovi/aggiornati documentati. Tutti tech debt esistenti M1-M13 + T1 invariati.
