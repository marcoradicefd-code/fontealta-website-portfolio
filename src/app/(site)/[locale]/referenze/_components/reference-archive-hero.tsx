import { useTranslations } from "next-intl";

/**
 * ReferenceArchiveHero — Server Component, presentational only.
 *
 * Variante presentazionale dell'AmbientHero (baseline FASE 4.3, read-only):
 * stesse classi/scrim ma NO 100vh (è un archive, non una landing) e NO stat
 * semantici (l'archivio referenze non ha metriche ovvie). Eyebrow bianco
 * (--fa-text-on-dark), H1 Satoshi italic. Nessuna animazione di entrata sul fold.
 *
 * Spec: docs/design-specs/referenze.md §A1 / §10.4 (no stat) / §10.8 (nuovo
 * componente per non modificare AmbientHero baseline 4.3).
 */
export function ReferenceArchiveHero() {
  const t = useTranslations("referenze");

  return (
    <section
      className="fa-section dark relative flex items-center overflow-hidden"
      style={{
        minHeight: "clamp(60vh, 70vh, 720px)",
        padding: "var(--fa-space-hero-top) calc(var(--spacing) * 6) var(--fa-space-hero-bottom)",
      }}
    >
      {/* Surface scura senza poster: l'archivio non ha cover full-bleed.
          Background piatto fa-ink per il tono Figma più freddo (spec §5). */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--fa-ink)", zIndex: 0 }}
        aria-hidden
      />
      {/* Scrim verticale leggero per profondità */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(11,18,21,0) 40%, rgba(11,18,21,0.6) 100%)",
          zIndex: 1,
        }}
        aria-hidden
      />

      <div
        className="fa-container relative w-full"
        style={{
          zIndex: 2,
          maxWidth: 720,
          marginRight: "auto",
          marginLeft: "var(--fa-space-hero-inset)",
        }}
      >
        <span
          className="fa-eyebrow on-dark"
          style={{ color: "var(--fa-text-on-dark)", fontSize: "clamp(11px, 0.85vw, 13px)" }}
        >
          {t("heroEyebrow")}
        </span>

        {/* H1 Satoshi italic — NO Cormorant (DESIGN-SYSTEM §11) */}
        <h1
          className="m-0 mt-eyebrow"
          style={{
            color: "var(--fa-text-on-dark)",
            fontStyle: "italic",
            fontSize: "clamp(64px, 11vw, 128px)",
            fontWeight: 500,
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
          }}
        >
          {t("heroTitle")}
        </h1>

        <p
          className="fa-body-lg mt-title-text-hero mb-0"
          style={{ color: "var(--fa-text-on-dark-secondary)", maxWidth: 560 }}
        >
          {t("heroSubtitle")}
        </p>
      </div>
    </section>
  );
}
