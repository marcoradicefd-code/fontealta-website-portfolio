/**
 * scripts/parse-catalog.ts
 *
 * Sprint 2 — FASE 2.
 * Pure-function parser: docs/content/catalog-reference.md → scripts/seed-data/parsed-catalog.json
 * No Sanity calls, deterministic, idempotent.
 *
 * Spec: docs/SPRINT-2-PLAN.md §FASE 2, docs/TAXONOMY.md v1.0 (locked).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const CATALOG_PATH = resolve(REPO_ROOT, "docs/content/catalog-reference.md");
const OUTPUT_PATH = resolve(REPO_ROOT, "scripts/seed-data/parsed-catalog.json");

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

type ProductType =
  | "lavabo-miscelatore"
  | "lavabo-batteria"
  | "lavabo-incasso"
  | "lavabo-colonna"
  | "vasca-bordo"
  | "vasca-colonna"
  | "doccia-colonna"
  | "doccia-pannello"
  | "doccia-soffione"
  | "kit-doccia"
  | "controllo-termostatico"
  | "accessory";

type Ambient = "outdoor" | "indoor" | "kitchen" | "yacht" | "bagno" | null;

interface CollectionMeta {
  code: string;
  title: string;
  order: number;
}

interface ParsedCollection {
  code: string;
  title: string;
  slug: string;
  ambients: string[];
  order: number;
  articleCount: number; // post-inheritance (drives sito UX, /collezioni/[slug] count)
  articleCountNative: number; // catalog source only (analytics, sanity check vs riepilogo)
}

interface RawArticle {
  code: string;
  description: string;
  finishes: string[];
  isConcealed: boolean;
  isCrossMarker: boolean;
  sectionCode: string;
  sectionTitle: string;
}

interface ParsedModel {
  code: string;
  slug: string;
  name: { it: string; en: string };
  description: { it: string; en: string };
  productType: ProductType;
  ambient: Ambient;
  tags: string[];
  includesConcealedBody: boolean;
  availableFinishes: string[];
  collections: string[];
  isOutdoor: boolean;
  isCustomizable: boolean;
}

interface ParserStats {
  totalParsed: number;
  totalUnique: number;
  duplicates: number;
  byProductType: Record<string, number>;
  byAmbient: Record<string, number>;
  byCollection: Record<string, number>;
  inheritanceApplied: string[];
  inheritanceWarnings: string[];
  articlesWithoutFinishes: string[];
  crossSectionExplicit: string[];
}

interface ParsedCatalog {
  collections: ParsedCollection[];
  models: ParsedModel[];
  stats: ParserStats;
}

// ──────────────────────────────────────────────────────────────────────
// Lookup tables
// ──────────────────────────────────────────────────────────────────────

const SECTION_TO_COLLECTION: Record<string, CollectionMeta> = {
  "ILLE COLLECTION": { code: "ille", title: "ILLE", order: 10 },
  "FLAMINGO COLLECTION": { code: "flamingo", title: "Flamingo", order: 20 },
  "SKINNY COLLECTION": { code: "skinny", title: "Skinny", order: 30 },
  CLASSY: { code: "classy", title: "Classy", order: 40 },
  "TWIGGY COLLECTION": { code: "twiggy", title: "Twiggy", order: 50 },
  "BOSS COLLECTION": { code: "boss", title: "Boss", order: 60 },
  "BOSS WIDE": { code: "boss-wide", title: "Boss Wide", order: 70 },
  "ORIGO COLLECTION": { code: "origo", title: "Origo", order: 80 },
  CLUB: { code: "club", title: "Club", order: 90 },
  "CLUB LARGE": { code: "club-large", title: "Club Large", order: 100 },
  "ORIGO RAME": { code: "origo-rame", title: "Origo Rame", order: 110 },
  ONDA: { code: "onda", title: "Onda", order: 120 },
  ARKO: { code: "arko", title: "Arko", order: 130 },
  SQUARE: { code: "square", title: "Square", order: 140 },
  "IN&OUT": { code: "in-out", title: "In&Out", order: 150 },
  WATERLINE: { code: "waterline", title: "Waterline", order: 160 },
  SPRING: { code: "spring", title: "Spring", order: 170 },
  "KITCHEN COLLECTION": { code: "kitchen", title: "Kitchen", order: 180 },
  COMMUNITY: { code: "community", title: "Community", order: 190 },
  YACHT: { code: "yacht", title: "Yacht", order: 200 },
  ACCESSORIES: { code: "accessories", title: "Accessories", order: 210 },
};

// 16 "original" sections eligible as inheritance source (sec 1-15 + 17).
// Excludes WATERLINE (16), KITCHEN (18), COMMUNITY (19), YACHT (20), ACCESSORIES (21).
const ORIGINAL_SECTION_CODES = new Set<string>([
  "ille",
  "flamingo",
  "skinny",
  "classy",
  "twiggy",
  "boss",
  "boss-wide",
  "origo",
  "club",
  "club-large",
  "origo-rame",
  "onda",
  "arko",
  "square",
  "in-out",
  "spring",
]);

// Strip leading numbered-keycap emoji prefix from section header.
// Matches "1️⃣ " / "🔟 " / "1️⃣1️⃣ " / "2️⃣1️⃣ " etc.
const NUMBERED_SECTION_PREFIX = /^(?:[0-9]️⃣|🔟)+\s+/u;

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function slugifyCode(code: string): string {
  return code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripCleanCode(rawCode: string): string {
  return rawCode.replace(/`/g, "").replace(/🔗/g, "").trim();
}

function parseFinishes(rawFinishes: string): string[] {
  const cleaned = rawFinishes.trim();
  if (cleaned === "" || cleaned === "—" || cleaned === "-") return [];
  return cleaned
    .split(/\s*[·•]\s*/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

function isConcealedMarker(raw: string): boolean {
  return raw.includes("🔒");
}

function getBaseStem(code: string): string {
  return code.split(".")[0];
}

function stripAstSuffix(code: string): string {
  return code.replace(/\.AST\b/g, "");
}

const MARINE_SUFFIX_RE = /\.(?:XYCWS|XYEWS|YCWS|YEWS|XY|Y)\b/g;
function stripMarineSuffix(code: string): string {
  return code.replace(MARINE_SUFFIX_RE, "");
}
function hasMarineSuffix(code: string): boolean {
  return /\.(?:XYCWS|XYEWS|YCWS|YEWS|XY|Y)\b/.test(code);
}

// ──────────────────────────────────────────────────────────────────────
// Inference
// ──────────────────────────────────────────────────────────────────────

function inferProductType(code: string, sectionCode: string): ProductType {
  // P1: hardcoded prefix overrides

  // Accessories
  if (/^FLX/.test(code)) return "accessory";
  if (/^PS\d/.test(code)) return "accessory";
  if (/^XQ|^XT/.test(code)) return "accessory";
  if (/^D\d/.test(code)) return "accessory";
  if (/^RE\d/.test(code)) return "accessory";
  if (/^S0\d/.test(code)) return "accessory"; // S02-S16 small handheld

  // Thermostatic / control
  if (/^TC(?:\b|\.)/.test(code)) return "controllo-termostatico";
  if (/^BJ(?:\b|\.)/.test(code)) return "controllo-termostatico";
  if (/^MR[123]?(?:\b|\.)/.test(code) && code !== "MRL" && !code.startsWith("WMRL"))
    return "controllo-termostatico";

  // Big rain showers / soffioni
  if (/^Q\d/.test(code)) return "doccia-soffione";
  if (/^R\d/.test(code)) return "doccia-soffione";
  if (/^SA\d/.test(code)) return "doccia-soffione";

  // Pannel
  if (/^P\d/.test(code) && !/^PS/.test(code)) return "doccia-pannello";
  if (/^PQ/.test(code)) return "doccia-pannello";

  // Kit doccia (any code with .SK suffix)
  if (/\.SK\b/.test(code)) return "kit-doccia";

  // P2: W-prefix decomposition (bagno/incasso/bordo)

  if (code === "WMRL") return "lavabo-incasso";
  if (/^WM\d/.test(code)) return "lavabo-incasso";
  if (/^WMP(?:\b|\.)/.test(code)) return "lavabo-incasso";
  if (/^W[2345]MP|^W[2345]MBP|^W[345]MBP/.test(code)) return "lavabo-incasso";
  if (/^W[345]P(?:\b|\.)/.test(code)) return "lavabo-incasso";

  // Vasca bordo (must come before W3 lavabo to catch W3B)
  if (/^W3B|^W4MB?(?:\b|\.)|^W5B/.test(code)) return "vasca-bordo";

  // Lavabo batteria 3 fori
  if (/^W3(?:\b|\.)/.test(code) && !/^W3[BPM]/.test(code)) return "lavabo-batteria";

  // Lavabo bordo singolo
  if (/^W2M/.test(code)) return "lavabo-miscelatore";

  // P3: base-modifier (L = lavabo, V = vasca)
  if (/^[A-Z]+\d+L(?:\b|\.)/.test(code)) return "lavabo-colonna";
  if (/^[A-Z]+\d+V(?:\b|\.)/.test(code)) return "vasca-colonna";

  // P4: section default
  switch (sectionCode) {
    case "kitchen":
      return "lavabo-miscelatore";
    case "accessories":
      return "accessory";
    case "waterline":
      return "doccia-soffione";
    case "ille":
    case "flamingo":
    case "skinny":
    case "twiggy":
    case "origo":
      // small basins like I30/I30B/I30H/F50/F50B/F50H → lavabo-miscelatore
      if (/^[A-Z]+30[BH]?$/.test(code)) return "lavabo-miscelatore";
      if (/^F50[BH]?$/.test(code)) return "lavabo-miscelatore";
      if (/^W\d/.test(code)) return "doccia-colonna";
      return "doccia-colonna";
    case "boss":
      if (/^B30[BH]?$/.test(code)) return "lavabo-miscelatore";
      if (/^B40$/.test(code)) return "lavabo-miscelatore";
      return "doccia-colonna";
    default:
      return "doccia-colonna";
  }
}

function inferAmbient(_code: string, sectionCode: string, productType: ProductType): Ambient {
  if (sectionCode === "kitchen") return "kitchen";
  if (sectionCode === "yacht") return "yacht";
  if (sectionCode === "community" || sectionCode === "spring") return "outdoor";
  if (sectionCode === "accessories") return null;
  if (sectionCode === "waterline") {
    if (productType === "controllo-termostatico") return "indoor";
    if (productType.startsWith("lavabo-")) return "indoor";
    return "outdoor";
  }
  return "indoor";
}

function inferTags(code: string, sectionCode: string, isConcealed: boolean): string[] {
  const tags = new Set<string>();

  // Section-derived label tags (only for "labeled" sections)
  if (sectionCode === "waterline") tags.add("waterline");
  if (sectionCode === "yacht") tags.add("yacht");
  if (sectionCode === "community") tags.add("community");

  // Marine suffix (longest pattern first)
  if (/\.XYCWS\b/.test(code)) {
    tags.add("cold-water");
    tags.add("yacht");
  } else if (/\.XYEWS\b/.test(code)) {
    tags.add("hot-water");
    tags.add("yacht");
  } else if (/\.YCWS\b/.test(code)) {
    tags.add("cold-water");
    tags.add("yacht");
  } else if (/\.YEWS\b/.test(code)) {
    tags.add("hot-water");
    tags.add("yacht");
  } else if (/\.CWS\b/.test(code)) {
    tags.add("cold-water");
  } else if (/\.EWS\b/.test(code)) {
    tags.add("hot-water");
  }

  // Hospitality
  if (/\.AST\b/.test(code)) {
    tags.add("community");
    tags.add("auto-stop");
  }

  // Pull-down (kitchen)
  if (/\.LTS?\b/.test(code)) tags.add("pull-down");

  // Pull-out (kitchen only)
  if (/\.S\b/.test(code) && sectionCode === "kitchen") tags.add("pull-out");

  // High-flow + multi-way (combined .HFn)
  if (/\.HF\d?\b/.test(code)) tags.add("high-flow");
  if (/\.HF[234]\b/.test(code)) tags.add("multi-way");
  if (/\.[234]\b/.test(code) && sectionCode !== "kitchen") tags.add("multi-way");

  // Mixer / shower / external / remote
  if (/\.ME\b/.test(code)) {
    tags.add("with-mixer");
    tags.add("with-shower");
  } else if (/\.M\b/.test(code)) {
    tags.add("with-mixer");
  }
  if (/\.E\b/.test(code) && !/\.ME\b/.test(code) && !/\.[XY]?[XY]?[CE]WS\b/.test(code)) {
    tags.add("external");
  }
  if (/\.D\b/.test(code)) tags.add("with-shower");
  if (/\.RC\b/.test(code)) tags.add("remote-control");

  // Concealed body marker (per TAXONOMY.md tags rule)
  if (isConcealed) tags.add("concealed-body");

  return Array.from(tags);
}

// ──────────────────────────────────────────────────────────────────────
// Markdown parsing
// ──────────────────────────────────────────────────────────────────────

interface SectionBlock {
  rawHeader: string;
  cleanName: string;
  collection: CollectionMeta | undefined;
  body: string;
}

function makeBlock(rawHeader: string, body: string): SectionBlock {
  const cleanName = rawHeader.replace(NUMBERED_SECTION_PREFIX, "").trim();
  const collection = SECTION_TO_COLLECTION[cleanName];
  return { rawHeader, cleanName, collection, body };
}

function splitIntoSections(md: string): SectionBlock[] {
  const lines = md.split("\n");
  const blocks: SectionBlock[] = [];
  let currentHeader: string | null = null;
  let currentBody: string[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentHeader !== null) {
        blocks.push(makeBlock(currentHeader, currentBody.join("\n")));
      }
      currentHeader = line.replace(/^##\s+/, "").trim();
      currentBody = [];
    } else if (currentHeader !== null) {
      currentBody.push(line);
    }
  }
  if (currentHeader !== null) {
    blocks.push(makeBlock(currentHeader, currentBody.join("\n")));
  }
  return blocks;
}

interface TableHeader {
  codeIdx: number;
  descIdx: number; // -1 if absent (ILLE)
  finishesIdx: number;
  lockIdx: number; // -1 if absent
}

function splitRow(line: string): string[] {
  return line
    .split("|")
    .map((c) => c.trim())
    .filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""));
}

function findTableHeaders(body: string): { lineIdx: number; header: TableHeader }[] {
  const lines = body.split("\n");
  const out: { lineIdx: number; header: TableHeader }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) continue;
    if (!/\|\s*#\s*\|/.test(line)) continue;
    const cols = splitRow(line);
    let codeIdx = -1;
    let descIdx = -1;
    let finishesIdx = -1;
    let lockIdx = -1;
    cols.forEach((col, idx) => {
      if (col === "Codice") codeIdx = idx;
      else if (col === "Descrizione") descIdx = idx;
      else if (col === "Finiture") finishesIdx = idx;
      else if (col === "🔒") lockIdx = idx;
    });
    if (codeIdx >= 0 && finishesIdx >= 0) {
      out.push({ lineIdx: i, header: { codeIdx, descIdx, finishesIdx, lockIdx } });
    }
  }
  return out;
}

function parseTableRows(body: string, header: TableHeader, headerLineIdx: number): RawArticle[] {
  const lines = body.split("\n");
  const rows: RawArticle[] = [];
  let i = headerLineIdx + 1;
  if (i < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i])) i++;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) break;
    if (line.trim() === "") break;
    const cols = splitRow(line);
    if (cols.length === 0) continue;
    if (header.codeIdx >= cols.length || header.finishesIdx >= cols.length) continue;
    const codeRaw = cols[header.codeIdx];
    const code = stripCleanCode(codeRaw);
    if (!code) continue;
    if (!/^[A-Z]/.test(code)) continue; // skip rows that aren't real codes
    const description =
      header.descIdx >= 0 && header.descIdx < cols.length ? cols[header.descIdx] : "";
    const finishes = parseFinishes(cols[header.finishesIdx]);
    const lockCol = header.lockIdx >= 0 && header.lockIdx < cols.length ? cols[header.lockIdx] : "";
    const isConcealed = isConcealedMarker(lockCol);
    const isCrossMarker = codeRaw.includes("🔗");
    rows.push({
      code,
      description,
      finishes,
      isConcealed,
      isCrossMarker,
      sectionCode: "",
      sectionTitle: "",
    });
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────────
// Inheritance (Option C)
// ──────────────────────────────────────────────────────────────────────

interface InheritanceResult {
  collections: string[];
  warning?: string;
  applied: boolean;
}

function applyInheritance(
  code: string,
  sectionCode: string,
  baseStemToOriginalSections: Map<string, Set<string>>,
): InheritanceResult {
  const isAst = sectionCode === "community" && /\.AST\b/.test(code);
  const isMarine = sectionCode === "yacht" && hasMarineSuffix(code);
  if (!isAst && !isMarine) {
    return { collections: [sectionCode], applied: false };
  }
  const stripped = isAst ? stripAstSuffix(code) : stripMarineSuffix(code);
  const stem = getBaseStem(stripped);
  const candidates = baseStemToOriginalSections.get(stem);
  if (!candidates || candidates.size === 0) {
    return {
      collections: [sectionCode],
      warning: `${code}: no inheritance candidate (stem=${stem})`,
      applied: false,
    };
  }
  if (candidates.size === 1) {
    const inherited = Array.from(candidates)[0];
    return { collections: [inherited, sectionCode], applied: true };
  }
  return {
    collections: [sectionCode],
    warning: `${code}: ambiguous inheritance (stem=${stem}, candidates=${[...candidates].sort().join(",")})`,
    applied: false,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Main parse
// ──────────────────────────────────────────────────────────────────────

function parseCatalog(md: string): ParsedCatalog {
  const blocks = splitIntoSections(md);

  // Pass 1: collect raw articles per section
  const rawArticlesBySection = new Map<string, RawArticle[]>();
  const sectionMetaByCode = new Map<string, CollectionMeta>();

  for (const block of blocks) {
    if (!block.collection) continue;
    const headers = findTableHeaders(block.body);
    if (headers.length === 0) continue;
    const articles: RawArticle[] = [];
    for (const h of headers) {
      const rows = parseTableRows(block.body, h.header, h.lineIdx);
      for (const row of rows) {
        row.sectionCode = block.collection.code;
        row.sectionTitle = block.collection.title;
        articles.push(row);
      }
    }
    rawArticlesBySection.set(block.collection.code, articles);
    sectionMetaByCode.set(block.collection.code, block.collection);
  }

  // Build base-stem → set<originalSection> map (for inheritance lookup)
  const baseStemToOriginalSections = new Map<string, Set<string>>();
  for (const [sectionCode, articles] of rawArticlesBySection) {
    if (!ORIGINAL_SECTION_CODES.has(sectionCode)) continue;
    for (const a of articles) {
      const stem = getBaseStem(a.code);
      if (!baseStemToOriginalSections.has(stem)) baseStemToOriginalSections.set(stem, new Set());
      baseStemToOriginalSections.get(stem)!.add(sectionCode);
    }
  }

  // Linearize all raw articles
  const allRaw: RawArticle[] = [];
  for (const articles of rawArticlesBySection.values()) {
    for (const a of articles) allRaw.push(a);
  }
  const totalParsed = allRaw.length;

  // Dedup by code (cross-section: WMRL/MR/WX*.SK appear in 2+ original sections)
  type Bucket = { article: RawArticle; collections: string[] };
  const byCode = new Map<string, Bucket>();
  for (const a of allRaw) {
    const existing = byCode.get(a.code);
    if (existing) {
      if (!existing.collections.includes(a.sectionCode)) existing.collections.push(a.sectionCode);
      if (!existing.article.description && a.description)
        existing.article.description = a.description;
      if (existing.article.finishes.length === 0 && a.finishes.length > 0)
        existing.article.finishes = a.finishes;
      existing.article.isConcealed = existing.article.isConcealed || a.isConcealed;
    } else {
      byCode.set(a.code, { article: { ...a }, collections: [a.sectionCode] });
    }
  }

  const totalUnique = byCode.size;
  const duplicates = totalParsed - totalUnique;

  // Build models with productType, ambient, tags, inheritance
  const models: ParsedModel[] = [];
  const inheritanceApplied: string[] = [];
  const inheritanceWarnings: string[] = [];
  const articlesWithoutFinishes: string[] = [];
  const crossSectionExplicit: string[] = [];

  // Track per-code which collections are NATIVE (catalog source) vs INHERITED.
  // Used to compute `articleCountNative` per collection.
  const nativeMap = new Map<string, Set<string>>();

  for (const { article, collections: rawCollections } of byCode.values()) {
    nativeMap.set(article.code, new Set(rawCollections));

    let collections: string[];
    if (rawCollections.length > 1) {
      collections = [...rawCollections];
      crossSectionExplicit.push(`${article.code}: [${rawCollections.join(", ")}]`);
    } else {
      const inh = applyInheritance(article.code, rawCollections[0], baseStemToOriginalSections);
      collections = inh.collections;
      if (inh.applied) inheritanceApplied.push(`${article.code}: ${inh.collections.join(" + ")}`);
      if (inh.warning) inheritanceWarnings.push(inh.warning);
    }

    // Primary collection (first in list) drives `name`
    const primaryMeta = sectionMetaByCode.get(collections[0]);
    if (!primaryMeta) continue;

    // Origin section (last in list when inheritance applied) drives ambient/tags
    const originSection =
      collections.length > 1 ? collections[collections.length - 1] : collections[0];

    const productType = inferProductType(article.code, originSection);
    const ambient = inferAmbient(article.code, originSection, productType);
    const tags = inferTags(article.code, originSection, article.isConcealed);

    const name = `${primaryMeta.title} ${article.code}`;
    if (article.finishes.length === 0) articlesWithoutFinishes.push(article.code);

    models.push({
      code: article.code,
      slug: slugifyCode(article.code),
      name: { it: name, en: name },
      description: { it: article.description, en: "" },
      productType,
      ambient,
      tags,
      includesConcealedBody: article.isConcealed,
      availableFinishes: article.finishes,
      collections,
      isOutdoor: ambient === "outdoor",
      isCustomizable: true,
    });
  }

  // Sort deterministically
  models.sort((a, b) => a.code.localeCompare(b.code));

  // Build collections array (counts + ambients union)
  const collections: ParsedCollection[] = [];
  for (const meta of Object.values(SECTION_TO_COLLECTION).sort((a, b) => a.order - b.order)) {
    const articleCount = models.filter((m) => m.collections.includes(meta.code)).length;
    const articleCountNative = models.filter((m) => nativeMap.get(m.code)?.has(meta.code)).length;
    const ambients = new Set<string>();
    for (const m of models) {
      if (m.collections.includes(meta.code) && m.ambient) ambients.add(m.ambient);
    }
    collections.push({
      code: meta.code,
      title: meta.title,
      slug: meta.code,
      ambients: Array.from(ambients).sort(),
      order: meta.order,
      articleCount,
      articleCountNative,
    });
  }

  // Stats
  const byProductType: Record<string, number> = {};
  const byAmbient: Record<string, number> = {};
  const byCollection: Record<string, number> = {};
  for (const m of models) {
    byProductType[m.productType] = (byProductType[m.productType] || 0) + 1;
    const ambKey = m.ambient ?? "null";
    byAmbient[ambKey] = (byAmbient[ambKey] || 0) + 1;
    for (const c of m.collections) byCollection[c] = (byCollection[c] || 0) + 1;
  }

  return {
    collections,
    models,
    stats: {
      totalParsed,
      totalUnique,
      duplicates,
      byProductType,
      byAmbient,
      byCollection,
      inheritanceApplied,
      inheritanceWarnings,
      articlesWithoutFinishes,
      crossSectionExplicit,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Output + entry
// ──────────────────────────────────────────────────────────────────────

function printStats(parsed: ParsedCatalog, outputBytes: number): void {
  const { stats, collections, models } = parsed;
  console.log("");
  console.log(`✓ Parsed ${collections.length} collections`);
  console.log(`✓ Parsed ${stats.totalParsed} raw articles`);
  console.log(
    `✓ Deduplicated to ${stats.totalUnique} unique (${stats.duplicates} duplicates removed)`,
  );

  console.log("");
  console.log("✓ Distribution productType:");
  for (const [k, v] of Object.entries(stats.byProductType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(24)} ${String(v).padStart(4)}`);
  }

  console.log("");
  console.log("✓ Distribution ambient:");
  for (const [k, v] of Object.entries(stats.byAmbient).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(10)} ${String(v).padStart(4)}`);
  }

  console.log("");
  console.log("✓ Distribution per collection (post-inheritance / native):");
  for (const c of collections) {
    const inh = c.articleCount - c.articleCountNative;
    const inhMarker = inh > 0 ? ` (+${inh} inherited)` : "";
    console.log(
      `    ${c.code.padEnd(15)} ${String(c.articleCount).padStart(4)} / ${String(c.articleCountNative).padStart(4)}${inhMarker}`,
    );
  }

  console.log("");
  console.log(
    `✓ Cross-section explicit (multi-section dedup): ${stats.crossSectionExplicit.length}`,
  );
  for (const e of stats.crossSectionExplicit) console.log(`    ${e}`);

  console.log("");
  console.log(`✓ Inheritance applied (Option C): ${stats.inheritanceApplied.length}`);
  for (const e of stats.inheritanceApplied) console.log(`    ${e}`);

  console.log("");
  console.log(`✓ Inheritance warnings (full list): ${stats.inheritanceWarnings.length}`);
  for (const w of stats.inheritanceWarnings) console.log(`    ${w}`);

  console.log("");
  console.log(`✓ Articles without finishes: ${stats.articlesWithoutFinishes.length}`);
  if (stats.articlesWithoutFinishes.length > 0)
    console.log(`    ${stats.articlesWithoutFinishes.join(", ")}`);

  console.log("");
  console.log(
    `✓ JSON written to scripts/seed-data/parsed-catalog.json (${(outputBytes / 1024).toFixed(1)} KB)`,
  );

  console.log("");
  console.log("─── 6 SAMPLE ARTICLES (PRETTY-PRINTED) ───");
  const samples = ["B76.M", "B76.AST", "BW50.YCWS.M", "Q500", "TC.HF2", "K35.S"];
  for (const code of samples) {
    const m = models.find((x) => x.code === code);
    console.log(`\n► ${code}`);
    if (m) console.log(JSON.stringify(m, null, 2));
    else console.log("    NOT FOUND IN PARSED OUTPUT");
  }
  console.log("");
}

function main(): void {
  const md = readFileSync(CATALOG_PATH, "utf8");
  const parsed = parseCatalog(md);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  const json = JSON.stringify(parsed, null, 2);
  writeFileSync(OUTPUT_PATH, json, "utf8");
  printStats(parsed, Buffer.byteLength(json, "utf8"));
}

main();
