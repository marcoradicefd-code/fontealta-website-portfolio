"use client";

import { useState } from "react";

import type { ActiveLocale, Locale } from "@/i18n/routing";
import { composeFinishLabel } from "@/lib/finish-label";
import { getFinishHex, getFinishImageSrc } from "@/lib/placeholders";

interface FinishOption {
  _id: string;
  code: string | null;
  colorHex: string | null;
  name: unknown;
}

interface Props {
  finishes: FinishOption[];
  locale: ActiveLocale;
  label: string;
}

/**
 * FinishSelector — Client Component (FASE 4.4.3). Fonde gli swatch statici
 * dell'hero in un selettore interattivo: click → stato visuale (anello attivo)
 * + nome finitura mostrato. Visual-only, NESSUN URL param (M13, Sprint 4+).
 */
export function FinishSelector({ finishes, locale, label }: Props) {
  const [activeId, setActiveId] = useState<string | null>(finishes[0]?._id ?? null);

  if (!finishes || finishes.length === 0) return null;

  const active = finishes.find((f) => f._id === activeId) ?? finishes[0];
  // Formato e trappole del `.trim()` sono documentati in `composeFinishLabel`, che dal
  // 29/07 è la sorgente unica: la stessa etichetta serve anche alle pill dei filtri.
  const activeLabel = active ? composeFinishLabel(active, locale) : "";

  return (
    <div className="mt-8">
      {/* Livello 2: identico alla series-eyebrow dell'hero (fa-eyebrow puro, navy) —
          nessun override colore (max 4 varianti tipo nell'hero, Block 2b). */}
      <span className="fa-eyebrow mb-3" style={{ display: "block" }}>
        {label}
      </span>
      <div className="gap-3" style={{ display: "flex", flexWrap: "wrap" }}>
        {finishes.map((f) => {
          const isActive = f._id === activeId;
          const fName = f.name as Partial<Record<Locale, string>> | null;
          const tooltip = fName?.[locale] ?? fName?.it ?? f.code ?? "";
          const swatch = getFinishImageSrc(f.code);
          return (
            <button
              key={f._id}
              type="button"
              // Bersaglio a 44 col `::before`, il cerchio resta da 36 (set 2026):
              // 4 px per lato non arrivano al vicino, che sta a 12.
              className="fa-finish-dot relative before:absolute before:-inset-1 before:rounded-full before:content-['']"
              aria-pressed={isActive}
              aria-label={tooltip}
              title={tooltip}
              onClick={() => setActiveId(f._id)}
              style={{
                // Dot ingranditi LOCALMENTE 26→36 solo nel FinishSelector: override
                // inline > `.fa-finish-dot` globale (26px) → ModelCard/RelatedModels restano 26.
                // Box quadrato 36×36 → resta cerchio (border-radius:50% da .fa-finish-dot).
                width: "36px",
                height: "36px",
                background: swatch
                  ? `center / cover no-repeat url(${swatch})`
                  : getFinishHex(f.code, f.colorHex),
                border: "none",
                padding: 0,
                transform: isActive ? "scale(1.15)" : undefined,
                boxShadow: isActive
                  ? "0 0 0 2px var(--fa-navy), 0 0 0 1px var(--fa-border-light) inset"
                  : undefined,
              }}
            />
          );
        })}
      </div>
      {/* Fuso in Livello 2: stile fa-eyebrow (navy 13/500/0.5px) come la riga meta —
          UNICA eccezione text-transform none. La label è "CODICE-Descrizione" VERBATIM
          da Sanity (spec cliente 24/07): niente sentence-case qui. */}
      <div className="fa-eyebrow mt-3" style={{ textTransform: "none" }} aria-live="polite">
        {activeLabel}
      </div>
    </div>
  );
}
