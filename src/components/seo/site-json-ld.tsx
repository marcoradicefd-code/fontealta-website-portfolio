import { getTranslations } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";
import { AZIENDA_EMAIL, AZIENDA_TELEFONO } from "@/lib/azienda";
import { getSiteSettings } from "@/lib/content";
import { serializzaJsonLd, siteGraphJsonLd } from "@/lib/json-ld";

/**
 * `Organization` e `WebSite`, una volta sola per pagina, dal layout.
 *
 * ⚠️ **Telefono ed email vengono da `azienda.ts`, come nel footer** (19/10/2026). Fino
 * ad allora tutti e due facevano `siteSettings?.x ?? costante`, con i campi su Sanity
 * vuoti: la regola era che si muovessero INSIEME, e ora si muovono insieme perché la
 * sorgente è una. Da `siteSettings` resta solo `socialLinks`, che una costante non ha.
 */
export async function SiteJsonLd({ locale }: { locale: ActiveLocale }) {
  const settings = await getSiteSettings(locale);
  // ⚠️ **La stessa chiave che apre `llms.txt`**, non una frase scritta qui: le
  // due sono la riga d'identità dell'azienda dette a due lettori automatici
  // diversi, e se nascessero in due posti divergerebbero in silenzio. Quando G7
  // porterà la frase approvata, si cambia `home.metaDescription` e si muovono
  // tutte e due.
  const tHome = await getTranslations({ locale, namespace: "home" });
  const ld = siteGraphJsonLd(locale, {
    description: tHome("metaDescription"),
    telefono: AZIENDA_TELEFONO,
    email: AZIENDA_EMAIL,
    // Nessun `??` con una costante: di profili social non ne esiste nessuno da
    // mettere come riserva, e inventarne uno sarebbe l'errore che `sameAs`
    // rende pubblico.
    social: settings?.socialLinks ?? null,
  });

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializzaJsonLd(ld) }} />
  );
}
