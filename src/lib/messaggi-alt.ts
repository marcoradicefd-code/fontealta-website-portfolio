import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  componiAltProdotto,
  risolviAlt,
  type AltRisolto,
  type ImmagineConAlt,
  type MessaggiAlt,
} from "@/lib/alt-composto";
import { misuraPrincipale, type SpecsInput } from "@/lib/misure";

/**
 * Il lato server dell'alt composto: i messaggi del namespace `immagini`, che il browser non
 * riceve (è fuori da `CLIENT_NAMESPACES`), legati alla lingua della pagina.
 *
 * ⚠️ L'alt delle card si calcola QUI, prima di passare i dati alla griglia (che è un componente
 * client): così i nomi delle misure non entrano nel payload di ogni pagina.
 */
export async function messaggiAlt(locale: Locale): Promise<MessaggiAlt> {
  const t = await getTranslations({ locale, namespace: "immagini" });
  return {
    prodotto: (v) => t("prodotto", v),
    prodottoConMisura: (v) => t("prodottoConMisura", v),
    collezione: (v) => t("collezione", v),
    misura: (v) => t("misura", v),
    nomeMisura: (chiave) => t(`misure.${chiave}`),
  };
}

export interface DatiAltProdotto {
  descrizioneAlt?: string | null;
  code?: string | null;
  specs?: SpecsInput | null;
}

/** L'alt di un'immagine di prodotto nella lingua della pagina, con la sua collezione. */
export function altProdotto(
  immagine: ImmagineConAlt | null | undefined,
  dati: DatiAltProdotto,
  collezione: string | null | undefined,
  locale: Locale,
  m: MessaggiAlt,
): AltRisolto {
  const composto = componiAltProdotto(
    {
      descrizione: dati.descrizioneAlt,
      codice: dati.code,
      collezione,
      misura: misuraPrincipale(dati.specs),
    },
    locale,
    m,
  );
  return risolviAlt(immagine, locale, composto);
}

/**
 * Aggiunge a ogni item della griglia la frase composta (`altComposto`), calcolata qui sul server.
 * La card poi applica l'ordine di `risolviAlt` sull'immagine che sceglie lei (`card-image.ts`):
 * l'`altI18n` scritto in Studio vince ancora, e la scelta della composizione non si sposta.
 */
export function conAltComposto<T extends DatiAltProdotto>(
  items: readonly T[],
  collezione: (item: T) => string | null | undefined,
  locale: Locale,
  m: MessaggiAlt,
): (T & { altComposto: string | null })[] {
  return items.map((item) => ({
    ...item,
    altComposto: componiAltProdotto(
      {
        descrizione: item.descrizioneAlt,
        codice: item.code,
        collezione: collezione(item),
        misura: misuraPrincipale(item.specs),
      },
      locale,
      m,
    ),
  }));
}
