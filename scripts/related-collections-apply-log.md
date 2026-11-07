# relatedCollections — apply log

**Date:** 2026-07-02
**Script:** `scripts/populate-related-collections.ts --apply`
**Dataset:** `mwlqc6ab/production` · perspective `published` · language `it`
**Source:** official affinity mapping from Alma (editorial, unidirectional, no reciprocity, no fallback).

## Applied — 7 source documents, 11 reference links

| Source (`_id`) | Ordered targets |
| --- | --- |
| ille · `collection-ille-it` | Waterline |
| flamingo · `collection-flamingo-it` | Waterline |
| skinny · `collection-skinny-it` | Classy, Waterline |
| classy · `collection-classy-it` | Skinny |
| twiggy · `collection-twiggy-it` | Waterline |
| boss · `collection-boss-it` | Boss Wide, Waterline |
| origo · `collection-origo-it` | Club, Club Large, Waterline |

**Untouched (no affinities):** Origo Rame + every other collection (incl. Waterline — targeted 7× but zero outgoing — and Accessories, not in the mapping). No empty-array writes.

## Independent verification (separate GROQ, not the script's return value)

- Per-source `count(relatedCollections)` + dereferenced target titles **in order** matched the mapping exactly (boss 2, classy 1, flamingo 1, ille 1, origo 3, skinny 2, twiggy 1 = 11).
- `count(*[_type=="collection" && defined(relatedCollections)])` = **7**, and the set of slugs with the field = exactly `{boss, classy, flamingo, ille, origo, skinny, twiggy}` → nothing outside the 7 sources was touched.
- Spot-check: `origo-rame`, `waterline`, `accessories` → `defined(relatedCollections) == false`.

Idempotent: re-running `--apply` overwrites with the same deterministically-keyed arrays (no-op).
