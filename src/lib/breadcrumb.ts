import type { BreadcrumbItem } from "@/components/ui/breadcrumb";

/**
 * Il TRONCO del percorso di catalogo, scritto una volta sola.
 *
 * Le quattro pagine di catalogo condividono le prime due voci — `Home` e
 * `Collezioni` — e differiscono solo nella coda. Costruirle a mano su quattro file
 * significherebbe quattro punti in cui una può restare indietro, e una voce
 * sbagliata in un breadcrumb non rompe niente: si legge male e basta, che è il
 * genere di difetto che sopravvive a lungo.
 *
 * ⚠️ È un percorso di TASSONOMIA, non di URL. La scheda modello vive a
 * `/modello/[slug]`, non sotto `/collezioni/[slug]`: `Home › Collezioni › Boss ›
 * B40L` descrive l'appartenenza, non l'indirizzo. Google accetta i breadcrumb
 * logici; chi legge il codice deve saperlo perché è una discrepanza vera.
 */
export function breadcrumbCatalogo(
  etichette: { home: string; collezioni: string },
  ...coda: BreadcrumbItem[]
): BreadcrumbItem[] {
  return [
    { label: etichette.home, href: "/" },
    { label: etichette.collezioni, href: "/collezioni" },
    ...coda,
  ];
}
