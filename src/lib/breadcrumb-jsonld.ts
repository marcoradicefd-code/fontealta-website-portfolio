/**
 * `BreadcrumbList` di schema.org per le pagine di catalogo.
 *
 * Puro e senza dipendenze da React o da next-intl: riceve nomi e percorsi già
 * risolti. È la parte che può sbagliare — ordine, `position`, forma dell'ultima
 * voce — e isolata si testa senza montare niente.
 *
 * FORMA SCELTA, UNA SOLA E OVUNQUE: l'ULTIMA VOCE OMETTE `item`. Google consente
 * entrambe, ma la voce corrente è la pagina in cui si è: darle un `item` che punta
 * a se stessa aggiunge un URL che nessuno seguirà, e mescolare le due forme fra
 * pagine diverse è il modo di ritrovarsi con due convenzioni e nessuna regola.
 * È lo stesso criterio che nel markup rende l'ultima voce non linkata.
 */
export interface BreadcrumbLdEntry {
  name: string;
  /** Percorso già localizzato e assoluto-izzabile, es. `/en/collections/boss`. */
  path?: string;
}

const senzaSlashFinale = (url: string) => (url.endsWith("/") ? url.slice(0, -1) : url);

export function buildBreadcrumbList(entries: BreadcrumbLdEntry[], base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.name,
      // `new URL` normalizza gli slash: concatenare a mano darebbe `//` o li
      // perderebbe a seconda che la base finisca con `/`, e il risultato sarebbe
      // un URL valido ma sbagliato, cioè il tipo che passa i validatori.
      //
      // ⚠️ Lo slash finale della RADICE si toglie, come fa `absoluteUrl`: `new
      // URL("/", base)` lo aggiunge, e la voce «Home» usciva
      // `https://fontealta.it/` mentre canonical e sitemap dicono
      // `https://fontealta.it`. Per la RFC è lo stesso URL, ma sono due nostre
      // dichiarazioni sulla stessa pagina che non combaciano, ed è proprio
      // quello che un dato strutturato non deve fare.
      ...(e.path ? { item: senzaSlashFinale(new URL(e.path, base).toString()) } : {}),
    })),
  };
}
