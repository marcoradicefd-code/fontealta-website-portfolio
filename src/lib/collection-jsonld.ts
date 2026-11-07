/**
 * `CollectionPage` con l'`ItemList` di ciò che la pagina mostra davvero.
 *
 * Puro e senza dipendenze da React o da next-intl, come `breadcrumb-jsonld.ts`:
 * riceve nomi e URL già risolti. È la parte che può sbagliare — ordine,
 * `position`, conteggio che non combacia con la griglia — e isolata si testa
 * senza montare niente.
 *
 * ⚠️ **`ListItem` e non `Product`, ed è la scelta che regge tutto il resto.**
 * Un `Product` chiede prezzo, disponibilità, identificativi: dichiararli senza
 * averli è markup che descrive un negozio che non c'è, e dichiararne uno solo
 * («ha un prezzo, non si sa quale») è peggio. Qui la pagina è un elenco di
 * modelli, e `ItemList` dice esattamente quello: questi articoli, in
 * quest'ordine, a questi indirizzi. Niente misure e niente prezzi, per la stessa
 * decisione del 10/09/2026 che li tiene fuori dal sito.
 *
 * ⚠️ **L'elenco è quello VISIBILE, non quello del catalogo.** I filtri della
 * pagina sono client-side e non cambiano l'HTML servito, quindi le due cose
 * oggi coincidono; il giorno che una collezione paginasse la griglia, questa
 * lista deve seguire la griglia e non la query. Un `ItemList` che dichiara
 * cinquanta voci su una pagina che ne mostra dodici descrive una pagina che non
 * esiste.
 */

export interface CollectionListItem {
  /** Il nome come si legge sulla card, non il codice grezzo. */
  name: string;
  /** URL assoluto e già localizzato della scheda. */
  url: string;
}

export function buildCollectionPage({
  name,
  description,
  url,
  locale,
  websiteId,
  items,
}: {
  name: string;
  description?: string | null;
  url: string;
  locale: string;
  /** L'`@id` del `WebSite` della stessa lingua, per `isPartOf`. */
  websiteId: string;
  items: CollectionListItem[];
}) {
  const validi = items.filter((i) => i.name.trim() !== "" && i.url.trim() !== "");

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage" as const,
    name,
    // Chiave assente e non stringa vuota: la stessa regola di `sameAs` e di
    // `description` sull'azienda.
    ...(description?.trim() ? { description: description.trim() } : {}),
    url,
    inLanguage: locale,
    // Per riferimento, non ripetuto: il nodo `WebSite` sta già nel grafo del
    // layout, e una seconda copia sarebbe una seconda cosa da tenere allineata.
    isPartOf: { "@id": websiteId },
    // ⚠️ **Nessun `mainEntity` se la lista è vuota.** Un `ItemList` con zero voci
    // dichiara «questa pagina elenca il nulla», che è un'affermazione, non
    // un'assenza. Oggi non capita — ogni collezione ha almeno un modello — ma è
    // una forma di dato plausibile, non un ramo morto.
    ...(validi.length > 0
      ? {
          mainEntity: {
            "@type": "ItemList" as const,
            // Dichiarato e non lasciato dedurre: è il numero che un consumatore
            // confronta con quello che vede, ed è il primo a mentire se la
            // lista viene tagliata a monte.
            numberOfItems: validi.length,
            itemListElement: validi.map((item, i) => ({
              "@type": "ListItem" as const,
              position: i + 1,
              name: item.name,
              url: item.url,
            })),
          },
        }
      : {}),
  };
}
