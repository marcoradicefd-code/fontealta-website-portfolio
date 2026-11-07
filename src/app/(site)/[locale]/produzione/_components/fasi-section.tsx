import { getTranslations } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";

import type { Fase } from "./fase-card";
import { FasiAccordion } from "./fasi-accordion";

// Import statici: danno a next/image width/height e blurDataURL senza doverli
// scrivere a mano. I file restano in public/ perché sono contenuto editoriale
// della pagina, non asset di build.
import f1 from "../../../../../../public/produzione/01-la-barra.webp";
import f2 from "../../../../../../public/produzione/02-il-taglio.webp";
import f3 from "../../../../../../public/produzione/03-la-piega.webp";
import f4 from "../../../../../../public/produzione/04-i-componenti.webp";
import f5 from "../../../../../../public/produzione/05-la-saldatura.webp";
import f6 from "../../../../../../public/produzione/06-la-pulimentatura.webp";
import f7 from "../../../../../../public/produzione/07-la-finitura.webp";
import f8 from "../../../../../../public/produzione/08-l-essiccazione.webp";
import f9 from "../../../../../../public/produzione/09-impianto-collaudo-imballo.webp";

const FOTO = [f1, f2, f3, f4, f5, f6, f7, f8, f9];

/** Paragrafi per fase, nell'ordine del PDF §3. Indice 0 = fase 01. */
const PARAGRAFI_PER_FASE = [2, 2, 2, 2, 1, 3, 1, 3, 2];

interface FasiSectionProps {
  locale: ActiveLocale;
}

export async function FasiSection({ locale }: FasiSectionProps) {
  const t = await getTranslations({ locale, namespace: "produzione" });

  const fasi: Fase[] = FOTO.map((image, i) => {
    const n = i + 1;
    return {
      n: String(n).padStart(2, "0"),
      title: t(`f${n}Title`),
      spec: t(`f${n}Spec`),
      alt: t(`f${n}Alt`),
      image,
      paragraphs: Array.from({ length: PARAGRAFI_PER_FASE[i] }, (_, k) => t(`f${n}P${k + 1}`)),
    };
  });

  return (
    <section aria-label={t("fasiAria")} className="fa-section dark">
      <div className="fa-container">
        <FasiAccordion fasi={fasi} />
      </div>
    </section>
  );
}
