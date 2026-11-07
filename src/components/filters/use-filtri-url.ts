"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  leggiFiltri,
  ribalta,
  scriviFiltri,
  svuota,
  type GruppoFiltro,
  type StatoFiltri,
} from "@/lib/filtri-url";

/**
 * Lo stato dei filtri, letto e scritto nell'URL. Unica sorgente per desktop e
 * mobile: le due interfacce leggono da qui, non da due `useState` da tenere
 * allineati.
 *
 * ⚠️ NON usa `useSearchParams`, ed è una scelta obbligata, misurata.
 * `useSearchParams` in un client component fa uscire la route dalla generazione
 * statica: il build fallisce con «useSearchParams() should be wrapped in a
 * suspense boundary», e l'unico rimedio — avvolgere la sezione in `<Suspense>` —
 * toglierebbe dall'HTML statico la GRIGLIA DEI MODELLI, che è il contenuto della
 * pagina. Le 105 pagine statiche sono una baseline del progetto, non un dettaglio.
 *
 * Quindi si legge `window.location.search` con `useSyncExternalStore`, lo stesso
 * pattern che il progetto usa già per `prefers-reduced-motion`: snapshot server
 * `""`, il client si riallinea all'hydration. Evita anche il setState-in-effect
 * che il lint del progetto vieta.
 *
 * **Conseguenza da sapere:** aprendo un link CON filtri, il primo fotogramma
 * mostra la griglia non filtrata e i filtri entrano all'hydration. È il prezzo
 * di una pagina statica con filtri in query string, e l'alternativa (Suspense)
 * costa la griglia nell'HTML — molto peggio per LCP e indicizzazione.
 *
 * SCRITTURA con `window.history.replaceState`, che la documentazione di Next
 * indica come la via per aggiornare la query senza navigare (e che si integra
 * col router). Due decisioni che si sentono usando la pagina:
 *  - `replaceState` e non `pushState`: il tasto indietro riporta alla pagina
 *    PRECEDENTE, non al filtro precedente. Con `push`, uscire da una collezione
 *    dopo cinque tocchi vorrebbe dire premere indietro sei volte;
 *  - nessuna navigazione del router, quindi nessun rifetch e nessun salto di
 *    scroll: la pagina che si sta filtrando resta dov'è.
 */

const ascoltatori = new Set<() => void>();

function notifica() {
  for (const a of ascoltatori) a();
}

function iscrivi(callback: () => void) {
  ascoltatori.add(callback);
  // `popstate` copre il tasto indietro/avanti; `replaceState` non lo emette,
  // quindi le nostre scritture notificano a mano.
  window.addEventListener("popstate", callback);
  return () => {
    ascoltatori.delete(callback);
    window.removeEventListener("popstate", callback);
  };
}

const istantanea = () => window.location.search;
const istantaneaServer = () => "";

export function useFiltriUrl(gruppi: GruppoFiltro[]) {
  const search = useSyncExternalStore(iscrivi, istantanea, istantaneaServer);

  const stato = useMemo(() => leggiFiltri(new URLSearchParams(search), gruppi), [search, gruppi]);

  const applica = useCallback(
    (prossimo: StatoFiltri) => {
      const q = scriviFiltri(prossimo, gruppi);
      window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
      notifica();
    },
    [gruppi],
  );

  const attivaOpzione = useCallback(
    (chiave: string, valore: string) => applica(ribalta(stato, chiave, valore)),
    [applica, stato],
  );

  const azzera = useCallback(() => applica(svuota(gruppi)), [applica, gruppi]);

  return { stato, applica, attivaOpzione, azzera };
}
