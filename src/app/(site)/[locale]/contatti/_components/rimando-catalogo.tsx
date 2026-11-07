"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

/** Le rotte che hanno la sezione `#catalogo` (`CatalogoSection`). */
const CON_IL_CATALOGO: readonly string[] = ["/collezioni", "/contatti"];

/**
 * «Cerchi il catalogo? Ricevilo subito via email →», sopra il menu della richiesta di ogni
 * modulo generale (19/10/2026, Marco): il catalogo non è più una voce del menu.
 *
 * Dove la sezione c'è, un frammento della stessa pagina, che prende il listener del
 * `LenisProvider`; altrove `/contatti#catalogo` nella lingua della pagina. L'atterraggio sotto la
 * nav lo dà `scroll-margin-top` su `#catalogo` in `globals.css`, la leva unica.
 */
export function RimandoCatalogo({
  className,
  style,
}: {
  className: string;
  style?: CSSProperties;
}) {
  const t = useTranslations("contatti.form");
  // Chiave interna della rotta, uguale in tutte le lingue (`/contatti` anche su `/en/contact`).
  const pagina = usePathname();
  // Grassetto col peso delle etichette del design system (Marco, 19/10/2026); la sottolineatura
  // resta, così il link si riconosce come link anche senza il colore.
  const classi = "font-semibold underline underline-offset-2 hover:opacity-(--fa-opacity-hover)";

  return (
    <p className={className} style={style}>
      {CON_IL_CATALOGO.includes(pagina) ? (
        <a href="#catalogo" className={classi}>
          {t("catalogoRimando")}
        </a>
      ) : (
        <Link href={{ pathname: "/contatti", hash: "catalogo" }} className={classi}>
          {t("catalogoRimando")}
        </Link>
      )}
    </p>
  );
}
