/**
 * Lighthouse CI config — mobile, 3 runs. Budget allineati agli standard Google
 * (M12): perf >= 90 (banda "good" 90-100), LCP <= 2.5s (Core Web Vitals "Good"),
 * a11y >= 95, CLS <= 0.1. SEO: gate per-audit (9 audit a minScore 1; `canonical`
 * escluso perché host-dependent localhost/CI — vedi nota nel blocco assertions).
 */
module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/en",
        "http://localhost:3000/blog",
        "http://localhost:3000/en/blog",
        "http://localhost:3000/blog/aisi-316-contro-304-parte-1",
        // La pagina d'uso (c1b, 4/11/2026): apertura come il blog, foto tutte pigre.
        "http://localhost:3000/doccia-da-esterno",
      ],
      startServerCommand: "pnpm start",
      startServerReadyPattern: "Ready",
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        emulatedFormFactor: "mobile",
        throttlingMethod: "simulate",
        // Audita ogni pagina nella propria lingua, al proprio URL (200), senza il
        // 307 di locale-detection: il Chrome del runner manda Accept-Language: en →
        // `/blog` (IT, prefix-less per localePrefix:as-needed) rediregerebbe a
        // `/en/blog`, e auditare via redirect rompe l'audit SEO `canonical`
        // ("Points to another hreflang location"). Forzando `it`, `/blog` resta IT
        // 200 e le route `/en*` restano EN (prefisso esplicito). NON è un fix del
        // canonical (già self-referential e corretto), ma del setup di test.
        extraHeaders: { "Accept-Language": "it" },
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        // SEO: gate PER-AUDIT (sostituisce `categories:seo`) per escludere SOLO
        // l'audit `canonical`, strutturalmente incompatibile con l'host-split
        // localhost(CI)/dominio(prod): in CI la pagina vive su localhost ma il
        // canonical/hreflang sono sul dominio → l'audit scatta in laboratorio. In
        // produzione (host==canonical) passa — canonical verificato self-referential
        // e corretto, da validare via Search Console. Tutti gli altri 9 audit SEO
        // (Lighthouse 12.6.1) restano a `error` con minScore 1 (budget NON abbassati).
        // `structured-data` è weight 0 / manuale → non gating, omesso.
        "is-crawlable": ["error", { minScore: 1 }],
        "document-title": ["error", { minScore: 1 }],
        "meta-description": ["error", { minScore: 1 }],
        "http-status-code": ["error", { minScore: 1 }],
        "link-text": ["error", { minScore: 1 }],
        "crawlable-anchors": ["error", { minScore: 1 }],
        "robots-txt": ["error", { minScore: 1 }],
        "image-alt": ["error", { minScore: 1 }],
        hreflang: ["error", { minScore: 1 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
