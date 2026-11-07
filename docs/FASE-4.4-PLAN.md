# FASE 4.4 — Single model detail page (`/modello/[slug]`)

> ⚠️ **REALIZZATO.** «Zero codice feature scritto» era vero il giorno in cui e' stato
> scritto: oggi `/modello/[slug]` serve **595 schede** in due lingue, con breadcrumb,
> JSON-LD e og:image per tipo. Verbale, si legge al passato.

> **Stato documento:** AUDIT + PLAN (FASE 4.4.1). Zero codice feature scritto.
> Deliverable read-only. Apertura sotto-fasi 4.4.2 subordinata alle **5 decisioni**
> in coda al documento.

---

## 0 · Stato pre-4.4

| Voce | Valore |
| --- | --- |
| Branch | `sprint/2-catalog-live` |
| HEAD | `3bceeef` (chore docs FASE 4.3 closure) |
| Commit ahead `main` | 18 |
| Backup | `backup/sprint-2-post-4.2` |
| Working tree | pulito (solo `scripts/test-collection-detail.ts` untracked) |
| Route esistenti | `/`, `/collezioni`, `/collezioni/[slug]`, `/{outdoor,indoor,yacht,cucina}` |
| FASE 4.3 | chiusa — ambient pages cross-collection |

**Obiettivo 4.4:** route prodotto singolo `/modello/[slug]` (IT) / `/model/[slug]` (EN).
Chiude **M9** (ModelCard → click target navigabile).

### Nota ambiente (FASE 4.4.1)

La sessione gira sul checkout **PortableSSD** (`/Volumes/PortableSSD/…`), non sul
Desktop assunto dal brief (path inesistente). Il filesystem SSD non preserva il bit
exec Unix → con `core.fileMode=true` git segnalava 103 file come "modified"
(filemode-only, **zero contenuto**) + 92 sidecar AppleDouble `._*`. Identità repo
intatta (branch/log/count corretti). Risolto con `git config core.fileMode false`
(locale, reversibile). **Follow-up:** aggiungere pattern `._*` / `.DS_Store` a
`.gitignore` se il checkout SSD diventa permanente; valutare APFS.

---

## 1 · Findings audit A1–A11

### A1 — Slug vs code routing ✅ slug-based confermato

```
591 model · 591 slug definiti · 591 slug distinti · 0 mancanti
```

- `slug.current` = `code.toLowerCase().replace(/[^a-z0-9]+/g,"-")` (vedi `model.ts:94`).
  Es. `B40L.M → b40l-m`, `B40L.RC → b40l-rc`, `B76.M → b76-m`.
- **Univoco e completo** su tutti i 591 articoli → `generateStaticParams` sicuro.
- Slug URL-safe (no dot/encoding). Slug-based evita `B76.M → /modello/B76%2EM`.
- `_id` (`model-b40lm`) ≠ slug (`b40l-m`) → per routing si usa **sempre `slug.current`**.

> ⚠️ I commenti M9 in codice citano `/modello/[code]` — il piano adotta `[slug]`.

### A2 — Routing pathnames map — greenfield

Nessuna route `/modello`|`/model` esiste. Unici riferimenti = commenti tech-debt M9
(`model-card.tsx:31`, `ambient-models-section.tsx:39`). `routing.ts` pathnames già
contiene il pattern dinamico (`/collezioni/[slug]`, `/referenze/[slug]`).

**Entry da aggiungere** (coerente con `/cucina ↔ /kitchen`, `/referenze ↔ /projects`):
```ts
"/modello/[slug]": { it: "/modello/[slug]", en: "/model/[slug]" },
```
Ricorda whitelist: path non in map → 404 middleware. (Turbopack HMR non rileva
modifiche a `routing.ts` → restart dev obbligatorio in 4.4.2.)

### A3 — Query Sanity — nuova MODEL_DETAIL + slugs

Esiste solo `MODELS_BY_AMBIENT_QUERY` (`queries.ts:187`). Nessuna `MODEL_DETAIL`/
`MODEL_SLUGS`. **Non modificare** `AMBIENT_DETAIL_QUERY` / `MODELS_BY_AMBIENT_QUERY`.

Pattern da rispettare (da `COLLECTION_DETAIL_QUERY` `queries.ts:202`):
- slug-based, **nessun filtro `language`** (model = i18n field-level),
- `name` proiettato **raw** (localizedString array) → cast M6 `as unknown as {it?,en?}`,
- media: `primaryImage { ..., "metadata": asset->metadata }`, `images[]`,
- `description` proiettato come `description[$locale]` (PortableText localizzato).

Query proposta (slug-based + related):
```groq
// MODEL_DETAIL_QUERY
*[_type == "model" && slug.current == $slug][0] {
  _id, code, "slug": slug.current, name,
  "description": description[$locale],
  productType, ambient, tags, includesConcealedBody, isCustomizable,
  primaryImage { ..., "metadata": asset->metadata },
  images[]{ ..., "metadata": asset->metadata },
  specs,
  "finishes": availableFinishes[]->{ _id, code, category, colorHex, name },
  "collections": collections[]->{ _id, code, title, "slug": slug.current },
  "relatedModels": *[
    _type == "model" && _id != ^._id && references(^.collections[0]._ref)
  ] | order(code asc) [0...4] {
    _id, code, "slug": slug.current, name, productType, ambient,
    "finishes": availableFinishes[]->{ _id, code, name, colorHex },
    "collections": collections[]->{ _id, code, title, "slug": slug.current }
  }
}

// MODEL_SLUGS_QUERY (generateStaticParams)
*[_type == "model" && defined(slug.current)]{ "slug": slug.current }
```
Post-edit: `pnpm typegen` (types.gen.ts committato).

> ⚠️ **TypeGen / ModelCard union (gotcha 4.4.3):** `MODEL_DETAIL_QUERY` genera un
> nuovo result type; `relatedModels[]` element NON sarà in
> `ModelData = CollectionDetailModel | AmbientDetailModel` (`model-card.tsx:13-15`).
> Passare related a `<ModelCard>` darà errore TS. Soluzione: **estendere la union**
> ModelCard con `RelatedModel` (stesso pattern di accomodamento già usato 4.3.3).
> La projection related include `finishes` + `collections` → strutturalmente
> compatibile con `AmbientDetailModel` (richiede `showCollection`).

### A4 — Component reuse

| Componente | Decisione | Razionale |
| --- | --- | --- |
| `ModelCard` (4.2.3 + `showCollection` 4.3.3) | **REUSE** in related grid | presentational; `showCollection=false` (stessa collezione primaria) |
| `CollectionHero` / `AmbientHero` | **NO reuse** | hero editoriali full-bleed 100vh (vedi A5), layout/stat diversi |
| `ModelHero` (Server) | **NEW** | hero prodotto |
| `ModelSpecs` (Server) | **NEW** | sezione specifiche (vedi A8) |
| `RelatedModels` (Server) | **NEW** | grid max 4 card |
| `FinishSelector` (Client) | **NEW** | swatch click → visual state |
| `ModelDescription` (Server) | **NEW** | render PortableText (vedi A8) |

### A5 — Hero layout — ⚠️ vincolato dall'assenza immagini

`CollectionHero` (`collection-hero.tsx`) e `AmbientHero` sono **full-bleed dark
100vh** con poster `<Image fill>` (Unsplash fallback), scrim, eyebrow + H1 Satoshi
italic + tagline + 3 stat. **Non sono split product hero.**

> ⚠️ **Realtà asset:** `primaryImage` popolato su **0/591** modelli (M5). Un hero
> "Split image 60% / info 40%" mostrerebbe il **monogram placeholder** su 60%
> dell'area → visivamente debole. La scelta layout interagisce con questo vincolo.

Opzioni:
- **A · Split** (image 60% sx + info 40% dx) — standard luxury B2B, ma assume
  imagery prodotto assente Sprint 2 → 60% monogram placeholder.
- **B · Text-forward / asymmetric** — pannello info dominante (code · nome · type ·
  finishes · CTA) + riquadro monogram contenuto, coerente con la realtà no-image,
  upgrade automatico a Split quando Andrea popola `primaryImage` (M5).
- **C · Scroll-revealed cinematic** — posticipato Sprint 3+ (GSAP/Lenis locked-out).

Mobile: stack verticale via Tailwind in tutti i casi.
**Raccomandato: B** (Split-ready ma graceful senza immagini), upgrade a A post-M5.

### A6 — FinishSelector behavior

Sprint 2: solo visual state, `useState<string>` `activeFinishId`. NO URL update
(M13 deferred Sprint 4+). Client Component; riceve `finishes` via props dal Server
parent. Swatch hex via `getFinishHex(code, colorHex)` (`placeholders.ts`, già usato
da ModelCard) — `finish.colorHex` non popolato → fallback `FINISH_HEX_FALLBACK`.

### A7 — Related models strategy

- Primario: max 4 modelli `references(^.collections[0]._ref)`, `_id != ^._id`,
  `order(code asc)`.
- Fallback `<4`: stesso `productType` cross-collection (decisione #4).
- Empty state: nessun related (modello unico in collezione singola senza pari
  productType) → sezione omessa, non grid vuota.
- Esempi: `B76.M` (Boss) → fratelli Boss; modello unico → fallback productType.

### A8 — Specs section — ⚠️ correzione assunzione brief

Il brief A8 afferma "dimensions/material/weight NON in schema". **Errato.** Lo
schema `model.specs` (`model.ts:199-218`) **contiene già**:
`heightMm`, `widthMm`, `depthMm`, `weightKg`, `materials[]`.

Quadro reale (verificato via query count):

| Campo | In schema | Popolato seed | Note |
| --- | --- | --- | --- |
| `code` `productType` `tags` `includesConcealedBody` `isCustomizable` `ambient` | ✅ | ✅ | sempre disponibili |
| `availableFinishes` `collections` | ✅ | ✅ | refs |
| `description` (PortableText) | ✅ | **527/591** | renderizzabile |
| `specs.{height,width,depth}Mm` `weightKg` `materials` | ✅ | **0/591** | curation Andrea |
| `primaryImage` `images[]` | ✅ | **0/591** | M5 asset |
| flow rate · pressure · disegno tecnico PDF · materiale (AISI 316) strutturato | ❌ | — | gap reale |

**Sprint 2:** `ModelSpecs` renderizza **condizionalmente** (solo campi `defined`):
- sempre: productType, tags, concealed body 🔒, customizable, n° finiture, collezioni;
- se popolato: dimensioni/peso/materiali (graceful — invisibili finché vuoti);
- `ModelDescription` (PortableText, 527/591) come corpo testuale principale.

→ Vedi **M17** (riformulato): non "aggiungere dimensions" (esistono) ma
(a) **popolare** specs esistenti [curation, affine M5] + (b) opzionale aggiungere
flow/pressure/drawingPdf.

### A9 — Build / SSG strategy — ⚠️ il vero leva è generateStaticParams

591 slug × 2 locale = **1182 pagine**. La convenzione progetto esistente
(`collezioni/[slug]/page.tsx:11`, referenze) è **`export const revalidate = 60`**,
NON 3600 come da default brief.

> ⚠️ **Nota tecnica:** ISR `revalidate` da solo **non riduce il build time** se
> `generateStaticParams` ritorna tutti i 591 slug (li pre-renderizza comunque al
> build). La leva reale per build veloce è il **valore di ritorno di
> `generateStaticParams`** (con `dynamicParams=true` default = ISR on-demand):

| Strategia | generateStaticParams | revalidate | Build | Note |
| --- | --- | --- | --- | --- |
| Full SSG | tutti 591 | n/a o 60 | ~10-15 min | tutto pre-reso |
| **ISR on-demand** | `[]` | 60 | ~1-2 min | prima visita render+cache |
| Hybrid | top-N featured | 60 | medio | top instant, resto on-demand |

**Raccomandato:** ISR on-demand (`generateStaticParams → []` o top-N) +
`revalidate = 60` (coerenza progetto). Funziona su Vercel Hobby. Mantiene
`perspective:"published", stega:false` in generateStaticParams (pattern esistente).

### A10 — ModelCard click target (chiude M9)

`Link` esportato da `@/i18n/navigation` (`createNavigation(routing)`) supporta
object-form href. ModelCard è Server Component (no onClick) → wrap in `<Link>`
(renderizza `<a>`) compatibile.
```tsx
import { Link } from "@/i18n/navigation";
<Link href={{ pathname: "/modello/[slug]", params: { slug: model.slug } }}>
  <article>…</article>
</Link>
```
Verificare sintassi typed-routes in 4.4.3 (affine M3). Reintrodurre hover-lift
transform (oggi omesso intenzionalmente per non dare falso affordance pre-M9).

### A11 — Plan sotto-fasi

**4.4.2 — Data layer + hero (1 modello esempio `/modello/b76-m`)**
- `MODEL_DETAIL_QUERY` + `MODEL_SLUGS_QUERY` in `queries.ts`; `pnpm typegen`.
- `getModel(slug, locale)` + `getAllModelSlugs()` in `content.ts` (pattern `sanityFetch`).
- `ModelHero` + `ModelSpecs` + `ModelDescription` (Server, `@portabletext/react`
  già in deps `^6.0.3` ma **mai usato** → primo renderer del progetto).
- `page.tsx` + `generateStaticParams` (strategia A9) + `generateMetadata` + `revalidate`.
- `routing.ts` +1 entry (restart dev). Namespace i18n `modello` in it.json + en.json
  (en mirror it, T1). Namespace esistenti: skip/nav/footer/brand/collezioni/dettaglio/ambient.
- Visual check 1 modello desktop+mobile + console.error scoped.

**4.4.3 — Interazione + related + M9**
- `FinishSelector` (Client, A6).
- `RelatedModels` (A7) + **estensione union ModelCard** con `RelatedModel` (A3 gotcha).
- ModelCard wrap `<Link>` (A10, chiude M9) + reintroduzione hover-lift.
- Visual check cross-route 3 modelli (Boss `b76-m`, + 2 altri) × IT/EN × desktop/mobile.

**4.4.4 — Finale + ship**
- Visual check: empty-state related (fallback productType), 404 slug inesistente,
  smoke link `/it/collezioni/boss` → ModelCard click → `/it/modello/b76-m`.
- Four-check (format:check / typecheck / lint / build) exit 0.
- Commit atomico `feat(model-detail-page):` + push + CI + `chore(docs):` sync
  CLAUDE.md/ARCHITECTURE.md (M9 closed, M17 new).

---

## 2 · Tech debt update

| ID | Aggiornamento |
| --- | --- |
| **M9** | *In closure track* — chiuso da 4.4.3 (ModelCard `<Link>` → `/modello/[slug]`). |
| **M17 (NEW)** | Specs prodotto: (a) **popolare** `specs.{h,w,d}Mm/weightKg/materials` esistenti [curation Andrea, affine M5]; (b) opzionale **estendere schema** con flow rate / pressure / `technicalDrawingPdf` + materiale AISI 316 strutturato. Sprint 4+, richiede curation + estrazione dati da catalog PDF. *NON* è "aggiungere dimensions" (già in schema). |
| M3 | toccato in 4.4.3 (typed-routes Link object form) — verifica, non chiusura. |
| M5 | `primaryImage`/`images` 0/591 + `finish.colorHex` vuoti → hero/card usano monogram + FINISH_HEX_FALLBACK. Detail page upgrade-ready. |
| M13 | confermato: FinishSelector visual-state only, no URL params. |
| M16 | invariato (FilterBar non coinvolta in 4.4). |

Sequenza tech debt esistente M14/M15/M16 invariata; M17 nuovo in coda.

---

## 3 · 5 DECISIONI da confermare PRIMA di 4.4.2

| # | Decisione | Opzioni | Raccomandato | Evidenza audit |
| --- | --- | --- | --- | --- |
| 1 | **Routing key** | slug-based `[slug]` / code-based `[code]` | **slug** | 591/591 slug unici, URL-safe, no encoding (A1) |
| 2 | **Hero layout** | A Split / **B Text-forward Split-ready** / C cinematic | **B** | `primaryImage` 0/591 → Split puro = 60% monogram (A5) |
| 3 | **SSG strategy** | Full SSG / **ISR on-demand** / Hybrid | **ISR on-demand** (`gSP→[]` + `revalidate=60`) | build 1182 pagine; leva = generateStaticParams, non revalidate; convenzione progetto = 60 (A9) |
| 4 | **Related fallback** | solo collezione / **+ productType cross-collection** | **+ productType** | modelli unici in collezione singola (A7) |
| 5 | **Specs gap** | M17 approvato (Sprint 4+) / specs omessa Sprint 2 | **M17 approvato** + render condizionale Sprint 2 | schema specs esiste ma 0/591 popolato; description 527/591 (A8) |

---

## 4 · Open follow-ups

- `.gitignore` pattern AppleDouble se checkout SSD permanente (vedi nota ambiente §0).
- `description` localizedPortableText: confermare resa PortableText custom serializers
  (heading/list) coerenti col design system in 4.4.2.
- Decidere se `ModelDescription` mostra fallback IT quando `[$locale]` vuoto
  (64/591 senza description, e EN mirror IT pre-T1).
- Hover-lift transform: riattivare in ModelCard solo dopo wrap `<Link>` (no affordance
  fuorviante prima).

---

## 5 · Verification plan post-4.4.4

1. **Four-check** format:check → typecheck → lint → build, tutti exit 0.
2. **TypeGen** rigenerato e committato (CI typecheck dipende da `types.gen.ts`).
3. **Visual check Playwright** (`tmp/visual-check-4.4.x/`, gitignored):
   - render hero + specs + description + finish swatches (b76-m);
   - FinishSelector click → cambio visual state, no console error;
   - related grid (4 card) + fallback productType + empty-state;
   - cross-route smoke: collezione → ModelCard `<a>` click → `/modello/[slug]`;
   - 404 su slug inesistente;
   - IT/EN parity (`/modello/b76-m` ↔ `/model/b76-m`) + desktop/mobile.
4. **CI** PR draft #1 verde (6 job).
5. **M9** verificato chiuso (ModelCard navigabile).
