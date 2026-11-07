import type { BreadcrumbItem } from "@/components/ui/breadcrumb";
import { getPathname } from "@/i18n/navigation";
import type { ActiveLocale } from "@/i18n/routing";
import { buildBreadcrumbList } from "@/lib/breadcrumb-jsonld";
import { serializzaJsonLd } from "@/lib/json-ld";
import { siteUrl } from "@/lib/seo";

/**
 * `BreadcrumbList` per le pagine di catalogo, dalla STESSA lista che disegna il
 * breadcrumb visibile. È il punto di questo componente: se il markup e il dato
 * strutturato nascessero da due liste, prima o poi direbbero due percorsi diversi
 * e nessuno se ne accorgerebbe — un JSON-LD sbagliato non si vede sulla pagina.
 *
 * I percorsi li risolve `getPathname` di next-intl, non una concatenazione: le
 * route sono localizzate (`/collezioni/boss` ↔ `/en/collections/boss`) e cablarle
 * a mano vorrebbe dire tenere allineata una seconda mappa a quella vera.
 *
 * L'escape di `<` vive in `serializzaJsonLd`: i nomi arrivano da Sanity, e senza
 * escape un titolo che contenesse `</script>` chiuderebbe il tag. Era scritto qui
 * e nel blog; ora è in un posto solo, con il grafo del sito che lo usa a sua
 * volta.
 */
export function BreadcrumbJsonLd({
  items,
  locale,
}: {
  items: BreadcrumbItem[];
  locale: ActiveLocale;
}) {
  const ld = buildBreadcrumbList(
    items.map((i) => ({
      name: i.label,
      ...(i.href ? { path: getPathname({ href: i.href, locale }) } : {}),
    })),
    siteUrl(),
  );

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializzaJsonLd(ld) }} />
  );
}
