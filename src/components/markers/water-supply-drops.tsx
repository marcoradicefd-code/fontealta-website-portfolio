/**
 * WaterSupplyDrops — catalogue hot/cold water "gocce" marker. Shared presentational
 * component (no state), used by the model detail specs (with a visible label) and by
 * ModelCard (icon-only). Teardrop path inlined from
 * scripts/data/icons/{drop-cold,drops-hot-cold}.svg; colours via --drop-* tokens;
 * order blue(cold) → coral(hot), matching the printed listino.
 *
 *  - value "cold" → one blue drop · "hot-cold" → blue + coral · anything else → null.
 *  - `label` PRESENT → renders the visible i18n label next to the drops; that label
 *    IS the accessible name (svg is aria-hidden). This is the detail-page behaviour.
 *  - `label` OMITTED → ICON-ONLY: a bare decorative svg (no wrapper span, no trailing
 *    gap). The CALLER must supply the accessible name — e.g. wrap in
 *    `role="img" aria-label={…}` — as ModelCard does.
 *    Icon-only also carries `.fa-drops-card` (globals.css) → height = 75% of the
 *    finish dot via `--fa-finish-dot-size`; the labelled variant keeps `height={28}`.
 */

// Teardrop path (viewBox unit 24×30), inlined from the reference SVG. A second drop
// is the same path translated +28 (matches drops-hot-cold.svg, viewBox 52×30).
const DROP =
  "M12 1C15.80 1.15 22.15 9.20 22.15 19.20C22.15 24.70 17.50 29 12 29C6.50 29 1.85 24.70 1.85 19.20C1.85 9.20 8.20 1.15 12 1Z";

export function WaterSupplyDrops({
  value,
  label,
}: {
  value: string | null | undefined;
  label?: string;
}) {
  if (value !== "cold" && value !== "hot-cold") return null;
  const hotCold = value === "hot-cold";
  const drops = (
    <svg
      className={label ? undefined : "fa-drops-card"}
      width={hotCold ? 46 : 22}
      height={28}
      viewBox={hotCold ? "0 0 52 30" : "0 0 24 30"}
      aria-hidden="true"
    >
      {hotCold ? (
        <>
          <path fill="var(--drop-cold)" d={DROP} />
          <path fill="var(--drop-hot)" transform="translate(28 0)" d={DROP} />
        </>
      ) : (
        <path fill="var(--drop-cold)" d={DROP} />
      )}
    </svg>
  );

  // Icon-only: bare decorative svg, no wrapper → no trailing gap. Caller names it.
  if (!label) return drops;

  // Labelled (detail page): the visible i18n label doubles as the accessible name.
  return (
    <span className="inline-flex items-center gap-3">
      {drops}
      <span style={{ margin: 0, fontWeight: 500, color: "var(--fa-text-primary)" }}>{label}</span>
    </span>
  );
}
