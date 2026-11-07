# Block 2 — Water-supply drops + freestanding alimentation

**Date:** 2026-07-20 · **Branch:** `sprint/2-catalog-live` (built on Block 1 `bcd369a`, not yet pushed)

The catalogue's hot/cold water-supply drop symbols (gocce) surface on the model **detail page**
only; freestanding columns additionally carry an alimentation-type indicator. Schema + import +
UI, catalogue colour-coding kept exactly, icons redrawn to the design system.

## Commits

| SHA | Type | What |
|---|---|---|
| `e7b6437` | `chore(schema)` | `model.waterSupply` (enum `cold`/`hot-cold`/`none`) + `model.alimentationTypes` (array enum `standard`/`standard-plus`/`cw`/`ew`/`4s`), both optional, taxonomy group. Schema deployed to `fontealta-studio`. |
| `bbbb223` | `chore(catalog)` | `scripts/import-gocce.ts` (double-net, idempotent) + verified data. |
| `a60c45e` | `feat(catalog)` | `--drop-*`/`--alim-*` catalogue colour tokens; `WaterSupplyDrops` (detail page, cold-first) + static non-interactive `AlimentationChips`; `waterSupply`+`alimentationTypes` in `MODEL_DETAIL_QUERY`; i18n it/en. |

## Data (applied to `production`, MCP-verified, published perspective)

- **291** models got `waterSupply`: **cold 103 · hot-cold 145 · none 43** (matched by exact `code`;
  `confirmed`→its `water`, `noneConfirmed`→`none`).
- **2 skipped**: `YCWS`, `YEWS` — Yacht **shared-well (pozzetto)** codes, not full article codes. The
  drop is printed on the well in the catalogue, not on the article, so no model matches. Artifacts for
  matching → **never guessed, permanently skipped**.
- **alimentationTypes: 0 populated** (per-column mapping pending → chips invisible in prod).
- Totals unchanged: **599** models.

## 🔒 Locked client decision — "the catalogue is the Bible"

`pendingAndrea` (52) + `notInCatalog` (6) stay `waterSupply` **UNSET, permanently**. Rule: **no drop
printed in the catalogue → no drop on the site.** This also covers the **28 Yacht columns** whose drop
belongs to the shared well (pozzetto), not the article (the `YCWS`/`YEWS` well codes above).
**There is NO second pass planned.** If the client ever reverses: set `waterSupply` in Studio (single
model) or re-run `import-gocce.ts` against the now-confirmed entries in `blocco2-gocce-data.json`
(idempotent) — **no schema or UI work needed either way** (both already shipped).

## UI (model detail page only — cards untouched, they carry only the Block-1 concealed-body tag)

- **Drops** (`WaterSupplyDrops`, near the specs block): `cold` → 1 blue drop (`--drop-cold`);
  `hot-cold` → **cold (blue) then hot (coral)** — cold-first, client call, label synced
  ("Acqua fredda e calda" / "Cold and hot water"); `none`/absent → nothing. Teardrop path inlined from
  the reference SVGs (`scripts/data/icons/`), colours via tokens. Label uses the `<dd>` spec-value style
  (weight 500, `--fa-text-primary`).
- **Alimentation chips** (`AlimentationChips`): STATIC, non-interactive `<span>` pills (`.fa-alim-chip`
  = `.fa-pill` S sizing + `--alim-*` background; no hover/cursor/button). Render nothing until
  `alimentationTypes` is populated → invisible in prod this block.

## Verification

- Data: independent MCP GROQ (published) — 291 / cold 103 / hot-cold 145 / none 43; **0 pendingAndrea
  patched** (explicit query, all 52 codes); **0 notInCatalog patched**; alimentationTypes 0.
- Render: curl on the running server — `q86-2` (cold) 1 blue drop; `b76-2` (hot-cold) blue-then-coral
  (cold-first, byte-order confirmed); `b76-rc` (none) + `f50` (unset) render nothing; `alim-chips=0`.
- Five-check green (format/typecheck/lint/build/test 26/26) + e2e 2/2 (the transient `cintura` double-fail
  was a Slow-3G flake under back-to-back build load — proven: full suite passes 2/2 with the changes present).

## Notes & follow-ups

- **Production:** the data mutation is live now; the **drops** render on prod only once this branch merges
  to `main` and deploys. Prod stays no-index until go-live.
- **Import tool reusable** for the (unplanned) activation path; DRY-RUN default, `--execute` gated.
- Block 2 closes the current Sprint-2 catalogue-content work (Block 1 concealed bodies + Block 2 gocce).
