/**
 * Supply markers (Block 2) — model DETAIL page, presentational (no state).
 *
 * AlimentationChips: STATIC, non-interactive marker pills (spans, no button/hover/
 * cursor) for freestanding supply variants — `.fa-alim-chip` = .fa-pill S sizing +
 * `--alim-*` background. Renders nothing until model.alimentationTypes is populated.
 *
 * NB: WaterSupplyDrops (gocce hot/cold) è stato promosso a componente condiviso
 * (`@/components/markers/water-supply-drops`) perché usato anche da ModelCard.
 */

const ALIM_TOKEN: Record<string, string> = {
  standard: "var(--alim-standard)",
  "standard-plus": "var(--alim-standard-plus)",
  cw: "var(--alim-cw)",
  ew: "var(--alim-ew)",
  "4s": "var(--alim-4s)",
};
const ALIM_CODE: Record<string, string> = {
  standard: "STANDARD",
  "standard-plus": "XT/XQ",
  cw: "CW",
  ew: "EW",
  "4s": "4S",
};

export function AlimentationChips({
  types,
  labels,
}: {
  types: readonly string[] | null | undefined;
  labels: Record<string, string>;
}) {
  const known = (types ?? []).filter((t) => t in ALIM_TOKEN);
  if (known.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {known.map((t) => (
        <span
          key={t}
          className="fa-alim-chip"
          style={{ background: ALIM_TOKEN[t] }}
          title={labels[t]}
        >
          {ALIM_CODE[t]}
        </span>
      ))}
    </span>
  );
}
