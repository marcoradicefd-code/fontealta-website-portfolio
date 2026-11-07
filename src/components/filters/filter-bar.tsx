"use client";

import type { OpzioneFiltro } from "@/lib/filtri-url";

interface Props {
  label: string;
  options: OpzioneFiltro[];
  active: Set<string>;
  onToggle: (valore: string) => void;
}

/**
 * Presentational filter bar — emits toggle events, does not own state.
 * State + filter logic live in the parent (page.tsx in 4.2.4).
 *
 * Shared component (M16): usato da ModelsSection (collection detail). Spostato qui da
 * collezioni/[slug]/_components/ per eliminare l'import cross-route route-scoped.
 *
 * ⚠️ Questa è la vista DESKTOP. Sotto `lg` la sostituiscono la barra compatta e il
 * bottom sheet: le pill a tutta larghezza occupavano 423px su 390, cioè metà
 * schermo prima della prima card. Le due viste leggono lo STESSO stato (l'URL).
 *
 * La regola «un gruppo si mostra solo con ≥ 2 opzioni» vive a monte, in
 * `gruppiVisibili()`: qui resta solo la guardia contro l'etichetta orfana.
 */
export function FilterBar({ label, options, active, onToggle }: Props) {
  // Nessuna opzione → non rendere il gruppo (niente label "Finitura"/"Ambiente"
  // orfana, es. collezioni con modelli a 0 finiture come origo-rame).
  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <span className="fa-eyebrow">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.valore}
            type="button"
            onClick={() => onToggle(opt.valore)}
            className={`fa-pill ${active.has(opt.valore) ? "active" : ""}`}
            aria-pressed={active.has(opt.valore)}
          >
            {opt.etichetta}
          </button>
        ))}
      </div>
    </div>
  );
}
