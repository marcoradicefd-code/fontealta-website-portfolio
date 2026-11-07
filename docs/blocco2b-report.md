# Block 2b — Alimentation data + specs-row layout + type scale

**Date:** 2026-07-21 · **Branch:** `sprint/2-catalog-live` (built on Block 2 `ec1e2f0`, not yet pushed)

Block 2 shipped the `alimentationTypes` schema + the `AlimentationChips` component but left the field
**unpopulated** (chips invisible). Block 2b populates it from the verified listino map, then reworks the
model-detail **Specifiche** row so the water drops and the chips align to the specs grid, and folds two
stray hero font sizes into a 4-level type scale. Model **detail page only** — cards untouched (they carry
just the Block-1 concealed-body tag).

## Commits

| SHA | Type | What |
|---|---|---|
| `df2b2a9` | `chore(catalog)` | `scripts/import-alimentazioni.ts` (double-net, idempotent) + `scripts/data/blocco2b-alimentazione-data.json` + dry-run log. Populates `model.alimentationTypes` for 156 columns. |
| `78447f4` | `feat(catalog)` | Shared-grid specs row: water drops (cols 1-2) + chips (cols 3-4) aligned to the specs `<dl>`; `<dl>` forced to 4-col when markers render. `.fa-alim-chip` letter-spacing → `0.1em`. |
| `89c42ac` | `style(catalog)` | Hero → **max 4 type variants** (`ModelHero` + `FinishSelector`): L2 eyebrows unified to navy `fa-eyebrow`, L3 code de-monospaced = description, L4 finish caption = meta. **+ secondary text darkened** (`--fa-text-secondary` alpha 0.7→0.8, colour-only, global) + `·` separator repointed off tertiary → AA-clean. |

## Data (applied to `production`, MCP-verified, published perspective)

- **156** models got `alimentationTypes`, matched by exact `code`, written in canonical enum order
  (`standard`, `standard-plus`, `cw`, `ew`, `4s`). Source: `Mappa_Alimentazioni_Colonne.xlsx`
  (listini Edition V rev-002 + ILLE rev-07), **printed evidence only**.
- **Distribution by type-set:** `standard` 10 · `standard+cw` 72 · `standard+cw+4s` 10 ·
  `standard+cw+ew` 31 · `standard+cw+ew+4s` 28 · `standard+ew` 5.
- **`standard-plus` never used** — not printed on any article in the listini (kept in the enum, 0 records).
- **`cwBody` (CW.1/CW.2) NOT written** — informative only in the JSON, reserved for a future
  client-facing table; never patched, never rendered.
- Totals unchanged: **599** models. Block 2 `waterSupply` intact (**291**, no collateral).

## 🔒 Excluded cohorts — stay UNSET ("the catalogue is the Bible")

- **`skippedNoEvidence` (28)** — Yacht well-code columns (`C50AS.YCWS.M`, `BW50.YEWS.ME`, …). All 28
  exist as real models but carry **no** alimentation data: the supply variant lives on the shared well,
  not the article. No printed evidence → no chips.
- **`toVerifyOnListino` (8)** — the Flamingo `.D` PVD twins (`F60.D.M`, `F60V.D.RC`, …). All 8 exist
  (Block 1 created them) and stay **UNSET**: a `.D` twin can carry a **different** profile than its base
  (proven — `I40.D` drops the EW variant that `I40` has), so mirroring the base is unsafe. They wait for
  verification on listino pp. 12-13 / 22-23 (rev-002) or a client confirmation.
- **No second pass planned.** Activation path, if ever: move the entries to `apply[]` in
  `blocco2b-alimentazione-data.json` and re-run `import-alimentazioni.ts` (idempotent) — no schema/UI work.

## UI (model detail page only)

- **Shared-grid alignment** (`ModelSpecs`): the markers row and the specs `<dl>` share one 800px box and
  both use `grid-cols-4` (= `repeat(4, minmax(0,1fr))`) from `md` up. The **water block** spans cols 1-2
  (flush with *Tipologia*); the **chips** span cols 3-4 (flush with *Corpo a incasso*). When markers
  render, the `<dl>` is forced to 4-col even with < 4 rows so the "column 3" hairline stays put — the 15
  columns without a concealed-body row get sparse trailing columns (accepted). Non-marker models keep the
  previous `sm:2 / lg:{3,4}` behavior. Breakpoint `md` (not `lg`) so the alignment holds at the ~820/~900px
  widths a mockup review flagged for track desync; `minmax(0,1fr)` on both grids prevents it. Below `md`:
  1-col, chips wrap below the water block, left-aligned.
- **Chip restyle** (`.fa-alim-chip`): locked filled pill — `letter-spacing 0.4px → 0.1em`; `--alim-*`
  background, `--radius-pill`, S-scale height, uppercase `STANDARD / CW / EW / 4S`, dark text, `title`
  tooltip from the i18n `modello.alim*` keys. STATIC, non-interactive (no hover/cursor/button).
- **Type scale — max 4 variants** (`ModelHero` + `FinishSelector`): client rule — the hero area folds
  onto **exactly 4 type styles** (Playwright-confirmed, count = 4); the Specifiche `<dl>` and the entire
  *Collezioni affini* section are untouched.
  - **L1** model title (`fa-h2`) — unchanged.
  - **L2** every small uppercase label = one `fa-eyebrow` (13px / 500 / `0.5px` / **navy**): the series
    eyebrow already was; the "FINITURE DISPONIBILI" label dropped its `--fa-text-secondary` override.
  - **L3** code + description = one style (body 16px / weight 500 / `--fa-text-primary`): the code loses
    its monospace family + `0.4px` letter-spacing → identical to the description (and to the spec-value `<dd>`).
  - **L4** meta (`type · finishes`) + selected-finish caption = one secondary style (`fa-body-sm` 14px /
    `--fa-text-secondary` / regular weight): the caption dropped `font-medium`, the meta its `fontWeight:450`.
- **Secondary text darkened** (global token, colour-only — design call, also clears WCAG AA):
  `--fa-text-secondary` alpha **`0.7 → 0.8`** → composites to ~`#464643` on `--fa-white` (**6.15:1 → 8.66:1**).
  The Specifiche `dt` labels darken with it (intended, consistent). The meta `·` separator repoints from
  `--fa-text-tertiary` to `--fa-text-secondary` (removes the page's last orphan grey; `aria-hidden`, so AA
  never required it, but it passes now too). Token change is site-wide — verified on every background it
  renders over (below).

## Verification

- **Data:** independent MCP GROQ (published) — `alimentationTypes` defined **== 156**; `F60.M`=`[standard,cw]`,
  `B76`=`[standard,cw,ew,4s]`, `C140.2`=`[standard]`, `C50R`=`[standard,ew]`; **8 `.D` twins UNSET**;
  Yacht column UNSET; **0 out-of-enum** values; `waterSupply` intact (291). Client ran a third-path GROQ —
  matches (156 / 0 `.D` / 0 Yacht, spots correct).
- **Layout (Playwright, `b76-2` canonical):** `water↔Tipologia` and `first-chip↔col3` delta **= 0** at
  1440 / 900 / 820 / 768px; at 375px the grid collapses (chips below water, both left-aligned @24px, **no
  horizontal overflow**). Edge cases: `c140-2` (no concealed → forced 4-col, sparse col 4) delta 0;
  `b40l` (chips, no water) chip delta 0; `bj-02` (no marker) → no markers row, `<dl>` 3-col **unchanged**.
- **Hero type (Playwright, `b76-2`, computed styles):** distinct type-variant count **= 4**;
  `series↔finiture` eyebrows, `code↔description`, and `meta↔caption` each match exactly.
- **Contrast (Playwright, WCAG AA, computed styles):** `modello/[slug]` = **25/25 pass, 0 fails** after the
  secondary darkening (was 1 fail — the `·` separator at 2.84:1, now 8.66:1). Darkened `--fa-text-secondary`
  (`#464643`) confirmed **≥ 8:1** on every background it renders over: `--fa-white` 8.66, `--fa-surface`
  ~8.75, `--fa-card-cover` ~8.1 (author-card); blog detail page confirmed live (8.66). No dark-bg usage;
  the footer uses on-dark tokens.
- **Five-check:** `format:check` (tracked files), `typecheck`, `lint` (0 errors), `test` **26/26**,
  `build` — all green. **e2e** (scroll-Lenis regression, `pnpm test:e2e`, `NEXT_PUBLIC_E2E` prod build):
  **2/2 passed** (`cintura` Lenis-limit 18.6s + `carousel` min-height) — no flake this run.

## Notes & follow-ups

- **Production:** the data mutation is live on `production` now; the chips + aligned layout render on prod
  only once this branch merges to `main` and deploys. Prod stays no-index until go-live.
- **Import tool reusable** (DRY-RUN default, `--execute` gated) for the excluded-cohort activation path.
- Block 2b closes the Sprint-2 catalogue-content work (Block 1 concealed bodies · Block 2 gocce ·
  Block 2b alimentation).
