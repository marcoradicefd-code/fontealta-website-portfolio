import type { ActiveLocale, Locale } from "@/i18n/routing";
import { getFinishImageSrc } from "@/lib/placeholders";
import { urlFor } from "@/sanity/lib/image";
import type { FINISHES_OVERVIEW_QUERY_RESULT } from "@/sanity/types.gen";

type Finish = FINISHES_OVERVIEW_QUERY_RESULT[number];
type FinishCategory = NonNullable<Finish["category"]>;

interface Props {
  finish: Finish;
  locale: ActiveLocale;
  /**
   * Localized label for the finish category enum (natural / mirror / painted /
   * pvd). Resolved by the page via `t("finiture.category.<enum>")` and passed
   * down so this Server Component stays free of the i18n hook (kept presentational).
   */
  categoryLabel: string;
}

/**
 * FinishCard — Server Component, presentational only. Redesign giu 2026 (Figma
 * Finiture dark): card scura + bordino bianco sottile + angoli arrotondati,
 * swatch 4:3 in alto (non 1:1: il perché nel commento sopra lo swatch), fascia
 * testo sotto con categoria + nome.
 *  - Swatch: immagine Sanity `swatchImage` se popolata, altrimenti asset locale
 *    `getFinishImageSrc` (`/finiture/{CODE}.webp`). NON cliccabile (no detail
 *    route per le finiture, coerente con M9): niente `<Link>`.
 *
 * M10 LOCKED: NOME = `finish.name[$locale]` (Sanity autoritativo), categoria =
 * enum Sanity → label i18n. Possono divergere dai nomi del mockup Figma (es.
 * Figma "Inox Specchio"/"Ottone Scuro PVD" vs Sanity "Lucido Supermirror"/"PVD
 * Polished Deep Black"): divergenza documentata, NON si hardcodano i nomi Figma
 * → pagina name-agnostic. Il nome è reso UPPERCASE via CSS (dato Sanity invariato).
 *
 * TypeGen quirk M6: `name` è tipato `Array<localizedString>` ma a runtime ritorna
 * stringa via `name[$locale]` projection → gestiamo entrambe le shape.
 */
export function FinishCard({ finish, locale, categoryLabel }: Props) {
  // FINISHES_OVERVIEW_QUERY proietta `name[$locale]` → a runtime è GIÀ una stringa
  // localizzata (NON l'oggetto raw {it,en} del model). TypeGen la tipa come array
  // (quirk M6). Gestiamo entrambe le shape per robustezza.
  const rawName = finish.name as unknown;
  const displayName =
    (typeof rawName === "string"
      ? rawName
      : (rawName as Partial<Record<Locale, string>> | null)?.[locale]) ??
    finish.code ??
    "";

  // Swatch: immagine Sanity (urlFor) se popolata, altrimenti asset locale
  // ottimizzato `/finiture/{CODE}.webp` (getFinishImageSrc).
  const swatchUrl = finish.swatchImage
    ? urlFor(finish.swatchImage)?.width(800).url()
    : getFinishImageSrc(finish.code);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border-(length:--fa-stroke) border-(--fa-stroke-color) bg-fa-ink shadow-card transition-[transform,box-shadow] duration-(--dur-standard) ease-out-expo hover:-translate-y-1 hover:shadow-(--shadow-product)">
      {/* Card ~302×365 (Figma): swatch 4:3 (proporzione Figma, NON 1:1 — un
          quadrato 302 non lascerebbe spazio al nome 36px) + fascia testo → card
          ≈ 0.827 di proporzione. Angoli top arrotondati via overflow-hidden.
          Hover identico alle card collezioni: l'immagine zooma (group-hover:scale). */}
      <div
        className="relative"
        style={{ aspectRatio: "4 / 3", backgroundColor: "var(--color-fa-card-cover)" }}
      >
        <div
          className="absolute inset-0 transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.04]"
          style={{
            backgroundImage: swatchUrl ? `url(${swatchUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden
        />
        {/* Codice (es. "MX") — chip scuro semi-trasparente, leggibile su ogni tinta */}
        {finish.code && (
          <span
            className="absolute top-3 left-3 rounded-[4px] px-2 py-0.5 text-micro-1 tracking-4 uppercase"
            style={{
              fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
              background: "rgba(11,18,21,0.4)",
              color: "rgba(246,244,240,0.9)",
            }}
          >
            {finish.code}
          </span>
        )}
      </div>

      <div className="px-5 pt-4 pb-5">
        <div className="fa-eyebrow" style={{ color: "rgba(246,244,240,0.5)" }}>
          {categoryLabel}
        </div>
        <h3
          className="mt-2"
          style={{
            textTransform: "uppercase",
            color: "var(--fa-text-on-dark)",
            fontSize: "var(--text-heading-3)" /* 36px — Figma */,
            lineHeight: 1.05,
            letterSpacing: "-0.2px",
            fontWeight: 500,
            // I nomi Sanity (M10) sono più lunghi dei nomi corti del mockup
            // Figma → a 36px alcuni eccedono la card: break-word spezza solo i
            // token che non entrano (es. "RAL/PANTONE/NCS"), gli altri a capo
            // per parola in modo pulito.
            overflowWrap: "break-word",
          }}
        >
          {displayName}
        </h3>
      </div>
    </div>
  );
}

export type { FinishCategory };
