# Block 1 — Flamingo freestanding split + concealed bodies

**Date:** 2026-07-20 · **Branch:** `sprint/2-catalog-live` (3 commits ahead of `main`, not pushed)

Price list Edition V rev-002: split the Flamingo freestanding columns (existing columns keep the
4 non-PVD finishes, 8 new `.D` twins carry the 4 PVD), and introduce a dedicated concealed-body
axis so the site never conflates "requires a body sold separately" with "body included".

## Commits

| SHA | Type | What |
|---|---|---|
| `a603d1c` | `chore(schema)` | New `concealedBody` doc type + optional `model.requiredConcealedBody` reference (taxonomy group); registered before `model`; desk item. Schema deployed to `fontealta-studio`. |
| `0503621` | `chore(catalog)` | `scripts/import-blocco1.ts` + verified `scripts/data/blocco1-data.json` + dry-run log. Double-net migrator (dry-run default, `--execute` gate, `visibility:sync`, per-op guards, resume-by-state, fail-closed validation). |
| `591a9ec` | `feat(catalog)` | Card tag "Richiede corpo incasso / Requires concealed body" driven ONLY by `requiredConcealedBody`. `requiredConcealedBody->{code}` added to `COLLECTION_DETAIL_QUERY`; `dettaglio.tagRichiedeCorpoIncasso` i18n (it/en); `"in"`-guarded render in `model-card.tsx`. |

## Data mutation (applied to `production`, independently verified via MCP GROQ, published perspective)

- **17** `concealedBody` docs (`CW.1`…`W4MP.INC` → `concealedBody-*` ids; name = code, description = PortableText it/en).
- **92** models patched with `requiredConcealedBody` (the association articles; **0** skipped, **0** conflicts, **0** dangling refs). `MR` + `WMRL` are cross-collection → patched once each.
- **8** Flamingo columns (`F60{,L,V}.{M,ME,RC}`) reduced to 4 non-PVD finishes `[MX,BX,MB,RL]`.
- **8** new `.D` models created (4 PVD `[BB,BC,AB,DB]`, it+en description, `productType`/tags/flags copied from base, flamingo collection, imageless like all Flamingo).
- Totals: **concealedBody 17 · models with req 92 · flamingo 44→52 · total models 591→599**. All confirmed.

## UI — semantic split proven in prerendered HTML

Rendered `fa-tag` count per collection (IT build):

| flamingo | boss | ille | origo | skinny | twiggy | waterline | classy | yacht |
|---|---|---|---|---|---|---|---|---|
| 16 | 16 | 16 | 16 | 16 | 16 | 4 | **0** | **0** |

`classy`/`yacht` carry `includesConcealedBody:true` freestanding models yet render **0** tags → the tag
is driven strictly by `requiredConcealedBody`, never the boolean. Pages with no product cards
(privacy/finiture/contatti) render 0 (the `total=1` grep hit is next-intl's message blob, not a tag).

## Verification run

- Five-check: `format:check` (C1/C3 files clean; residual warnings only on the gitignored `.claude/settings.local.json` and the Block-2 data file) · `typecheck` ✓ · `lint` ✓ (0 errors; 1 pre-existing `collection-hero` warning) · `build` ✓ · `test` 26/26 ✓.
- e2e: `pnpm test:e2e` 2/2 (scroll-Lenis regression, unaffected).
- Data: independent MCP GROQ (separate auth from the write client).

## Manual spot-check (recommended, local)

Local dev reads live Sanity fresh. After the recent builds, run `rm -rf .next && pnpm dev`, then (IT, non-prefixed URLs):

- `/collezioni/flamingo` — 52 models; association cards (`ST.F`, `MR3.F`, `W3P.F`) show the tag; the 8 columns (`F60.M`, `F60L.M`…) do **not**; the 8 `.D` twins (`F60L.D.M`…) appear.
- `/modello/f60-m` — updated column: 4 finishes MX/BX/MB/RL.
- `/modello/f60l-d-m` — new `.D`: description present + 4 PVD finishes.
- `/collezioni/classy` — **0** tags (boolean-not-driving proof).
- `/modello/st-f` — detail page unchanged (no new concealed-body rendering this block).

## Notes & follow-ups

- **Production:** the data mutation is live now; the webhook revalidated the affected model/collection pages. The **tag** only renders on prod once this branch merges to `main` and deploys (Vercel). Not pushed yet — awaiting OK.
- **Block 2 out of scope:** `scripts/data/blocco2-gocce-data.json` + `scripts/data/icons/` remain untracked, untouched.
- **Doc-sync (separate `chore(docs)`):** CLAUDE.md should note the new `concealedBody` type + `requiredConcealedBody` field + the 599-model total; TAXONOMY.md is already flagged drifting.
- **Idempotent re-run:** `pnpm tsx scripts/import-blocco1.ts` (dry-run) / `--execute` is safe to re-run — resume-by-state skips completed ops.
