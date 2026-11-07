# Block 3a — Catalog reading order

**Date:** 2026-07-21 · **Branch:** `sprint/2-catalog-live` (synced onto `323217d`, not yet pushed)

The site now browses like the printed catalogue: product order on collection pages = the price
list's reading order (client decision, 21/07, locked). One global integer field on `model`,
populated from the listino by an idempotent import, consumed by a single GROQ `order()` rule.

## Commits

| SHA | Type | What |
|---|---|---|
| `5f4e100` | `feat(catalog)` | `model.catalogOrder` — number, integer+positive, optional, `readOnly`, specs group ("gestito dallo script di import, non editare a mano"). Schema deployed to `fontealta-studio`; types regenerated. |
| `4727366` | `chore(catalog)` | `scripts/import-catalog-order.ts` (dry-run/`--execute`, double-net, idempotent) + `scripts/data/blocco3-ordine-data.json` (515 items) + run log. |
| `77496ed` | `feat(catalog)` | Both collection model listings — `COLLECTION_DETAIL_QUERY` (live) + `COLLECTION_BY_SLUG_QUERY` (unused) — order by `coalesce(catalogOrder, 999999) asc, code asc`. |

## Data (applied to `production`, MCP-verified, published perspective)

- **515** models got `catalogOrder` = listino position (matched by exact `code`), **0 skipped**.
- **84** models stay **unset** (accessories / kitchen / Spring / shared-code leftovers) → they sort
  **after** positioned articles, **alphabetically by code**. They never disappear from any list.
- Coverage/bounds: total **599** · withOrder **515** · withoutOrder **84** · distinct orders **515** ·
  min **1** · max **515** · none `< 1`.
- **3 print-anomaly corrections** imported like any other item (provenance `insertedFrom:
  "proposedAdditions"` in the JSON): `P60`@371, `C50AS.YEWS.M`@423, `C50AS.YEWS.ME`@427.
- **12 shared codes** (`MR`, `WMRL`, `.SK` kits) keep the position of their **first print** — accepted
  cosmetic tradeoff, not special-cased (e.g. `boss` opens `WMRL`(9) → `MR`(29) → `CD35`(169)…).
- ILLE block sits at the tail (positions **452..515**); the 8 Flamingo `.D` PVD sit right after their base.

## Locked client decision — order = the listino

- **Single global integer** `catalogOrder` on `model` (no orderRank plugin, no per-collection arrays).
  Managed exclusively by the import script (`readOnly` in Studio; the API script still writes it).
- Sort rule everywhere models are listed: `order(coalesce(catalogOrder, 999999) asc, code asc)` —
  positioned first in listino order, unpositioned tail alphabetical. Done in **GROQ, not JS**.
- `autoRelatedByCollection` (dormant, not rendered) left on `code asc`; `FLX03/FLX04` out of scope.

## Sorting (queries only — no component changes)

- `sanity/lib/queries.ts`: the two `"models": *[…references(^._id)] | order(…)` back-refs switched to the
  new rule. `COLLECTION_BY_SLUG_QUERY` is currently unused (dead `getCollection()`), updated anyway so
  one consistent rule governs both.
- `ModelsSection` **filters** the already-sorted list (`collection.models.filter(...)`, no JS re-sort);
  `FilterBar` is presentational. `types.gen.ts` diff is only the embedded query text — result types
  are byte-identical, zero consumer impact.

## Verification — three independent nets + prod prerender

- **Import double-net** (`--execute`): 11 batches / 515 patched / 0 skipped; then count == 515,
  none outside the set, **full value-match** (every stored `catalogOrder` == its data position, 0
  mismatch), spot-checks `F50`=1 / `F60.D.M`=50 / `I30`=452 / `I40.D.ME`=515.
- **Independent MCP GROQ** (published): 599 / 515 / 84, 515 distinct, min 1/max 515; head asc
  `F50→F50H→F50B→W3.F→W2M.F…`; tail desc `I40.D.ME(515)→…→I40.D.RC(511)`; anomalies 371/423/427.
- **Per-collection sequence proof** (render rule vs JSON, code sequence strict-equal): **flamingo** 52
  (all positioned) ✓ · **boss** 54 ✓ · **spring** 2 positioned + 15 tail ✓ — all `seq==JSON`, monotonic,
  tail-contiguous.
- **Prod prerender** (`.next` SSG HTML): `it/collezioni/flamingo` renders `f50 → f50h → f50b → w3-f …`;
  `it/collezioni/spring` renders `col90-ast(344) → col90-ast-l(345)` then the 15 unpositioned
  alphabetically; **EN parity** `en/collezioni/flamingo` = same 52 in same order with `/en/model/` links.
- **Five-check green:** `format:check` / `typecheck` / `lint` (0 err) / `test` **32/32** / `build`
  (42 collection pages prerendered in the new order).

## Notes & follow-ups

- **Production:** the data mutation is live in the content lake now, but the **order change is invisible
  on the live site until this branch merges to `main` and deploys** (nothing read `catalogOrder` before
  C3). Prod stays no-index until go-live.
- **Run log:** `scripts/migration/catalog-order-dryrun-log.json` records the **applied EXECUTE run**
  (mode `EXECUTE`, pre-apply baseline `definedBefore: 0`, all 515 patches) — kept as the provenance
  record, name follows the earlier blocks' `*-dryrun-log.json` pattern.
- **Import tool reusable + idempotent:** re-running `--execute` re-sets identical values (skips when
  already fully applied with matching values). To change order later: edit `blocco3-ordine-data.json`
  and re-run — no schema or query work needed.
- **CI / SonarCloud:** core pipeline (`install`/`lint`/`typecheck`/`test`/`build`) + lighthouse + Vercel
  preview all green. SonarCloud (Automatic Analysis) flagged 6.0% duplication on new code, traced (via
  the duplication view + local jscpd) to the **generated** `sanity/types.gen.ts` (near-identical
  `*_RESULT` blocks; C3 touched its lines) — not hand-written logic. Resolved by adding `**/*.gen.ts`
  + `scripts/**` to the SonarCloud UI Duplication Exclusions (Analysis Scope); Automatic Analysis
  ignores a repo-side `sonar-project.properties`, so the exclusion is UI-side. Shipped
  `import-alimentazioni.ts` left untouched.
- **Remaining:** push → PR → CI → merge (no-squash) → confirm prod (a collection page order matches the
  listino) → `/context-save`.
