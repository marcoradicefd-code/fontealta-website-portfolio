import type { ActiveLocale } from "@/i18n/routing";
import { buildCollectionPage, type CollectionListItem } from "@/lib/collection-jsonld";
import { serializzaJsonLd, WEBSITE_ID } from "@/lib/json-ld";

/**
 * `CollectionPage` + `ItemList` per le pagine che elencano articoli: le 22
 * collezioni e l'indice dei corpi a incasso.
 *
 * Prima di questa PR quelle pagine emettevano un `BreadcrumbList` e i due nodi
 * di sito, e nient'altro: un consumatore leggeva il percorso per arrivarci ma
 * non che cosa contenessero. La lista arriva **dalla stessa collezione di dati
 * che disegna la griglia**, non da una seconda query, per lo stesso motivo per
 * cui `BreadcrumbJsonLd` riceve le briciole già pronte: due liste per la stessa
 * cosa finiscono per dirne due diverse, e un JSON-LD sbagliato non si vede.
 */
export function CollectionPageJsonLd({
  locale,
  name,
  description,
  url,
  items,
}: {
  locale: ActiveLocale;
  name: string;
  description?: string | null;
  url: string;
  items: CollectionListItem[];
}) {
  const ld = buildCollectionPage({
    name,
    description,
    url,
    locale,
    websiteId: WEBSITE_ID(locale),
    items,
  });

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializzaJsonLd(ld) }} />
  );
}
