import type { ActiveLocale, Locale } from "@/i18n/routing";

/**
 * Label inline «N articoli / N articles» della banda card collezione. Copy
 * lowercase inline (distinta dalle label stat capitalizzate `statArticoli`/
 * `stat2Label`). Condivisa in modo che FeaturedCollectionCard (home) e
 * CollectionCard (/collezioni + affini) usino la STESSA stringa — niente
 * accoppiamento card→card (nessuna card importa un const dall'altra).
 */
export const ARTICLES_LABEL = {
  it: "articoli",
  en: "articles",
  de: "Artikel",
  fr: "articles",
  es: "artículos",
} as const satisfies Record<Locale, string>;

/**
 * Per-collection presentation tokens (gradient cover + tagline IT/EN).
 * Used as deterministic visual identity until Andrea uploads coverImage
 * assets in Sanity. Keys match the lowercase kebab-case `collection.code`
 * values seeded by the catalog parser.
 *
 * Source: ~/Desktop/fontealta-design-system/project/ui_kits/website-v2/CollectionsLuxury.jsx
 */
type CollectionPresentation = {
  gradient: string;
  taglineIt: string;
  taglineEn: string;
};

export const COLLECTION_PRESENTATION = {
  ille: {
    gradient: "linear-gradient(160deg,#1b2e4a,#3d5f99)",
    taglineIt: "Minimalismo esclusivo.",
    taglineEn: "Exclusive minimalism.",
  },
  flamingo: {
    gradient: "linear-gradient(160deg,#b07040,#6e4a30)",
    taglineIt: "Natura come fonte di ispirazione.",
    taglineEn: "Nature as inspiration.",
  },
  skinny: {
    gradient: "linear-gradient(160deg,#c4a35a,#8a6a3a)",
    taglineIt: "Innata eleganza.",
    taglineEn: "Innate elegance.",
  },
  classy: {
    gradient: "linear-gradient(160deg,#2c2c2a,#0b1215)",
    taglineIt: "Un pezzo unico.",
    taglineEn: "A unique piece.",
  },
  twiggy: {
    gradient: "linear-gradient(160deg,#0b1215,#2c2c2a)",
    taglineIt: "Eterno numero uno.",
    taglineEn: "Eternal number one.",
  },
  boss: {
    gradient: "linear-gradient(160deg,#1b2e4a,#2a4570)",
    taglineIt: "Linea di spessore.",
    taglineEn: "A collection of substance.",
  },
  "boss-wide": {
    gradient: "linear-gradient(160deg,#3d5f99,#1b2e4a)",
    taglineIt: "Contemporaneo e avvolgente.",
    taglineEn: "Contemporary and captivating.",
  },
  origo: {
    gradient: "linear-gradient(160deg,#b8b6b0,#8a8780)",
    taglineIt: "Tributo al classico.",
    taglineEn: "A tribute to the classic.",
  },
  club: {
    gradient: "linear-gradient(160deg,#2c2c2a,#0b1215)",
    taglineIt: "Icona nel mondo.",
    taglineEn: "A global icon.",
  },
  "club-large": {
    gradient: "linear-gradient(160deg,#0b1215,#3d5f99)",
    taglineIt: "Gocce di benessere.",
    taglineEn: "Drops of wellness.",
  },
  "origo-rame": {
    gradient: "linear-gradient(160deg,#b07040,#8a6a3a)",
    taglineIt: "Eccezionale per natura.",
    taglineEn: "Naturally exceptional.",
  },
  onda: {
    gradient: "linear-gradient(160deg,#3d5f99,#1b2e4a)",
    taglineIt: "Come un’onda inaspettata.",
    taglineEn: "Like an unexpected wave.",
  },
  arko: {
    gradient: "linear-gradient(160deg,#8a8780,#3d5f99)",
    taglineIt: "L’armonia di mille riflessi.",
    taglineEn: "The harmony of a thousand reflections.",
  },
  square: {
    gradient: "linear-gradient(160deg,#0b1215,#8a8780)",
    taglineIt: "Indole imponente.",
    taglineEn: "Majestic nature.",
  },
  "in-out": {
    gradient: "linear-gradient(160deg,#3d5f99,#b8b6b0)",
    taglineIt: "Il rituale, dentro e fuori.",
    taglineEn: "The ritual, indoor and outdoor.",
  },
  waterline: {
    gradient: "linear-gradient(160deg,#1b2e4a,#8a8780)",
    taglineIt: "Oasi creativa.",
    taglineEn: "Creative oasis.",
  },
  spring: {
    gradient: "linear-gradient(160deg,#6e8a4a,#3d5f99)",
    taglineIt: "Tra estetica e funzionalità.",
    taglineEn: "Between aesthetics and function.",
  },
  kitchen: {
    gradient: "linear-gradient(160deg,#2c2c2a,#b07040)",
    taglineIt: "Atomi di vita quotidiana.",
    taglineEn: "Atoms of everyday life.",
  },
  community: {
    gradient: "linear-gradient(160deg,#8a8780,#0b1215)",
    taglineIt: "Storie di collettività.",
    taglineEn: "Stories of community.",
  },
  yacht: {
    gradient: "linear-gradient(160deg,#1b2e4a,#3d5f99)",
    taglineIt: "Pronti a imbarcare i desideri.",
    taglineEn: "Ready to set sail.",
  },
  accessories: {
    gradient: "linear-gradient(160deg,#0b1215,#3d5f99)",
    taglineIt: "Scelte che lasciano il segno.",
    taglineEn: "Choices that leave their mark.",
  },
} as const satisfies Record<string, CollectionPresentation>;

const FALLBACK_PRESENTATION: CollectionPresentation = {
  gradient: "linear-gradient(160deg,#2c2c2a,#0b1215)",
  taglineIt: "",
  taglineEn: "",
};

/**
 * Codes whose gradient is light enough that the gray monogram has insufficient
 * contrast. The green monogram variant is rendered for these instead.
 *
 * Tech debt M1: move to a Sanity field `collection.monogramVariant` during the
 * next schema migration so editors can override per-collection.
 */
const GREEN_MONOGRAM_CODES = new Set(["origo", "arko", "in-out"]);

export function getMonogramVariant(code: string): "gray" | "green" {
  return GREEN_MONOGRAM_CODES.has(code.toLowerCase()) ? "green" : "gray";
}

/**
 * Fallback hex map for finish.colorHex (null in Sprint 2 — Sanity not yet populated).
 * Hex placeholder semantically aligned with finish.name Sanity (production source
 * of truth). Sostituire con swatchImage da Sanity quando Andrea popolerà il campo
 * (M5 asset work). DESIGN-SYSTEM.md bundle ha naming/hex divergenti — vedi M10
 * tech debt per reconciliation.
 *
 * Mirrors the 8 `--color-fa-steel-*` tokens defined in globals.css.
 */
export const FINISH_HEX_FALLBACK: Record<string, string> = {
  MX: "#d4d4d0", // Polished Supermirror
  BX: "#b8b6b0", // Brushed natural
  MB: "#2c2c2a", // Matt Black painted
  RL: "#e8e6e1", // Painted RAL/PANTONE/NCS placeholder
  AB: "#0a0a09", // PVD Brushed Absolute Black
  BB: "#c4a35a", // PVD Brushed Brass
  BC: "#b07040", // PVD Brushed Copper
  DB: "#1c1c1a", // PVD Polished Deep Black
};

export function getFinishHex(
  code: string | null | undefined,
  sanityHex: string | null | undefined,
): string {
  if (sanityHex) return sanityHex;
  if (!code) return "#999999";
  return FINISH_HEX_FALLBACK[code.toUpperCase()] ?? "#999999";
}

/**
 * Path locale dello swatch finitura — render metallico quadrato WebP ottimizzato
 * in `public/finiture/{CODE}.webp` (8 codici: MX/BX/MB/RL/AB/BB/BC/DB). Sostituisce
 * la tinta piatta `getFinishHex` su tutto il sito. Dove la query proietta
 * `finish.swatchImage`, l'immagine Sanity (via `urlFor`) ha precedenza; altrove
 * si usa questo path. Ritorna null se il codice manca (→ fallback colore).
 */
export function getFinishImageSrc(code: string | null | undefined): string | null {
  if (!code) return null;
  return `/finiture/${code.toUpperCase()}.webp`;
}

export function getCollectionPresentation(
  code: string | null | undefined,
  locale: ActiveLocale,
): { gradient: string; tagline: string } {
  if (!code) {
    return { gradient: FALLBACK_PRESENTATION.gradient, tagline: "" };
  }
  const entry = (COLLECTION_PRESENTATION as Record<string, CollectionPresentation>)[code];
  if (!entry) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[placeholders] No COLLECTION_PRESENTATION entry for code "${code}" — falling back to neutral gradient.`,
      );
    }
    return { gradient: FALLBACK_PRESENTATION.gradient, tagline: "" };
  }
  return {
    gradient: entry.gradient,
    // ⚠️ Nessun chiamante legge `tagline` (15/09/2026: le due card prendono solo `gradient`), e
    // per DE, FR ed ES questa riga darebbe l'inglese. Resta a registro e non si cura qui: se un
    // giorno servisse, va scritta per lingua, non allungando il ternario.
    tagline: locale === "it" ? entry.taglineIt : entry.taglineEn,
  };
}
