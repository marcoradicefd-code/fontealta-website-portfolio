import { useTranslations } from "next-intl";

/**
 * MapEmbed — sez. 3 (spec §7). Server Component.
 *
 * iframe statico Google Maps Viareggio, loading="lazy", zero dipendenze JS
 * pesanti. URL hardcoded (q=Viareggio,LU). Tech debt: campo Sanity futuro
 * siteSettings.mapEmbedUrl per renderlo editabile (spec §10.3).
 */
const MAP_SRC = "https://www.google.com/maps?q=Viareggio,Lucca,Italia&output=embed";

export function MapEmbed() {
  const t = useTranslations("contatti");

  return (
    <section aria-label={t("mapAriaLabel")} style={{ background: "var(--fa-ink)" }}>
      <iframe
        title={t("mapTitle")}
        src={MAP_SRC}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block w-full border-0"
        style={{ height: "clamp(260px, 38vw, 360px)", filter: "grayscale(0.2)" }}
      />
    </section>
  );
}
