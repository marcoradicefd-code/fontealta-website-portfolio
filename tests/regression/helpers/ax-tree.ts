import type { CDPSession, Page } from "@playwright/test";

/**
 * L'albero di accessibilità VERO di Chromium, non quello che calcola Playwright.
 *
 * ⚠️ **Perché serve.** `getByRole` implementa i ruoli per conto suo e non applica
 * le regole di annidamento di ARIA in HTML: mappa `aside` → `complementary` e
 * basta, mentre il browser dà `generic` a un `aside` dentro un elemento di
 * sezionamento e `complementary` **solo se ha un nome accessibile**. Misurato con
 * un provino sintetico l'11/09/2026: la guardia dei filtri scritta con `getByRole`
 * restava verde anche a `aria-label` rimosso, cioè proprio quando il landmark
 * smette di esistere.
 *
 * ⚠️ **Chromium-only**, perché il protocollo è suo: la stessa ragione per cui
 * `playwright.regression.config.ts` ha un solo progetto.
 *
 * ⚠️ **UN `nodeId` VALE SOLO DENTRO LA SESSIONE CHE L'HA PRODOTTO.** È la ragione
 * per cui qui c'è una funzione sola che fa entrambe le letture invece di due che
 * si passano l'identificativo: la prima stesura ne apriva una seconda per leggere
 * il DOM e moriva con `DOM.resolveNode: No node with given id found`, perché la
 * mappa dei nodi nasce con `DOM.getDocument` ed è privata della sessione. Sette
 * test rossi, e non si vede ragionando: si vede solo eseguendo.
 *
 * Nato estraendo il blocco che le guardie dei filtri e dei titoli ripetevano riga
 * per riga: SonarCloud lo aveva misurato al **9,3% di duplicazione sul codice
 * nuovo**, contro il 3% richiesto. Quella condizione è diversa dal rosso
 * strutturale della copertura, e lasciarla passare avrebbe insegnato a non leggere
 * più il gate.
 */

export interface NodoAccessibile {
  /** Il ruolo calcolato dal browser: `complementary`, `generic`, `heading`, … */
  ruolo: string;
  /** Il nome accessibile, quello che un lettore annuncia. */
  nome: string;
  /** Fuori dall'albero: succede a `display: none` e ad `aria-hidden`. Va sempre filtrato. */
  ignorato: boolean;
}

/** Lo stesso nodo letto dal DOM: è la lettura di chi concatena i nodi di testo. */
export interface NodoDom {
  tag: string;
  testo: string;
  html: string;
}

async function raccogli<T>(
  page: Page,
  selettore: string,
  perNodo: (cdp: CDPSession, nodeId: number, ax: NodoAccessibile) => Promise<T>,
): Promise<T[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Accessibility.enable");
    // `DOM.getDocument` non serve solo a trovare la radice: è la chiamata che
    // POPOLA la mappa dei nodi di questa sessione. Senza, ogni `nodeId` successivo
    // è sconosciuto.
    const doc = (await cdp.send("DOM.getDocument")) as { root: { nodeId: number } };
    const trovati = (await cdp.send("DOM.querySelectorAll", {
      nodeId: doc.root.nodeId,
      selector: selettore,
    })) as { nodeIds: number[] };

    const esiti: T[] = [];
    for (const nodeId of trovati.nodeIds) {
      const albero = (await cdp.send("Accessibility.getPartialAXTree", {
        nodeId,
        fetchRelatives: false,
      })) as {
        nodes: Array<{ role?: { value?: string }; name?: { value?: string }; ignored?: boolean }>;
      };
      const n = albero.nodes[0];
      esiti.push(
        await perNodo(cdp, nodeId, {
          ruolo: String(n?.role?.value ?? ""),
          nome: String(n?.name?.value ?? ""),
          ignorato: Boolean(n?.ignored),
        }),
      );
    }
    return esiti;
  } finally {
    // Nel `finally`: una sessione lasciata aperta da un test fallito resta
    // attaccata alla pagina, e il test dopo ne apre una seconda sullo stesso target.
    await cdp.detach();
  }
}

/** Ruolo, nome e stato di ogni elemento che combacia, in ordine di documento. */
export function leggiRuoli(page: Page, selettore: string): Promise<NodoAccessibile[]> {
  return raccogli(page, selettore, async (_cdp, _nodeId, ax) => ax);
}

/**
 * Le DUE letture dello stesso nodo, accostate: il nome accessibile e il testo che
 * estrarrebbe chi concatena i nodi.
 *
 * Vengono dallo STESSO nodo e dalla stessa sessione, non da due enumerazioni
 * correlate per indice: due elenchi che oggi combaciano e domani potrebbero non
 * farlo confronterebbero in silenzio elementi diversi.
 */
export function leggiRuoliEDom(
  page: Page,
  selettore: string,
): Promise<Array<NodoAccessibile & NodoDom>> {
  return raccogli(page, selettore, async (cdp, nodeId, ax) => {
    const risolto = (await cdp.send("DOM.resolveNode", { nodeId })) as {
      object: { objectId: string };
    };
    const letto = (await cdp.send("Runtime.callFunctionOn", {
      objectId: risolto.object.objectId,
      functionDeclaration:
        "function(){return JSON.stringify({t:this.textContent,h:this.innerHTML,g:this.tagName})}",
      returnByValue: true,
    })) as { result: { value: string } };
    const { t, h, g } = JSON.parse(letto.result.value) as { t: string; h: string; g: string };
    return { ...ax, tag: g.toLowerCase(), testo: t, html: h };
  });
}
