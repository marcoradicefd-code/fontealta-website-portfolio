"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

/**
 * La riga sotto il bottone di ogni modulo (19/10/2026, Marco): «Inviando la richiesta dichiari di
 * aver letto l’informativa sulla privacy.», col link in una scheda nuova. Nessuna casella: per
 * rispondere la base è l'art. 6.1.b e il consenso non serve. L'informativa si dà quando i dati si
 * raccolgono (art. 13 GDPR). Prima c'erano tre copie di questa riga, una per modulo.
 */
export function RigaPrivacy({
  className,
  style,
  classeLink,
  stileLink,
}: {
  className: string;
  style?: CSSProperties;
  classeLink: string;
  stileLink?: CSSProperties;
}) {
  const t = useTranslations("contatti.form");
  return (
    <p className={className} style={style}>
      {t.rich("privacyRiga", {
        link: (chunks) => (
          <Link
            href={{ pathname: "/menzioni-legali", hash: "privacy" }}
            target="_blank"
            rel="noopener"
            className={classeLink}
            style={stileLink}
          >
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
