/**
 * Scritture di massa su Sanity: transazioni, throttle, backoff, manifest.
 *
 * Condiviso da `import-content`, `discard-content` e `publish-content`, perché le
 * tre cose scrivono con le STESSE regole e tre copie divergerebbero alla prima
 * modifica.
 *
 * ⚠️ **I limiti non sono nostri, sono di Sanity**: 25 richieste al secondo per le
 * mutazioni, 100 mutazioni concorrenti per dataset, corpo sotto 4 MB, transazione
 * consigliata sotto 500 kB. Da qui le tre scelte di questo modulo: transazioni da
 * 50 documenti, coda a **concorrenza 1**, intervallo minimo fra due commit.
 *
 * ⚠️ **Niente `p-queue`.** Servono venti righe di coda seriale con un intervallo:
 * una dipendenza nuova porta lockfile, superficie Dependabot e un major da
 * seguire, per una logica che sta in un `for` con un `await`.
 */

import type { SanityClient, Transaction } from "@sanity/client";

/** Documenti per transazione. Sotto il tetto dei 500 kB con i campi di una lingua. */
export const PER_TRANSAZIONE = 50;

/**
 * Intervallo minimo fra due commit. Con concorrenza 1 e transazioni da 50 siamo
 * ordini di grandezza sotto le 25 req/s: questo è il freno di sicurezza, non il
 * collo di bottiglia.
 */
const INTERVALLO_MS = 120;

/** Tentativi su 429 e 5xx. Oltre, si ferma e si riporta: non si insiste al buio. */
const TENTATIVI = 5;

const dormi = (ms: number) => new Promise((r) => setTimeout(r, ms));

function stato(e: unknown): number | undefined {
  const x = e as { statusCode?: number; response?: { statusCode?: number } };
  return x?.statusCode ?? x?.response?.statusCode;
}

function retryAfterMs(e: unknown): number | undefined {
  const h = (e as { response?: { headers?: Record<string, string> } })?.response?.headers;
  const v = h?.["retry-after"] ?? h?.["Retry-After"];
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n * 1000 : undefined;
}

/**
 * Esegue una transazione con backoff esponenziale.
 *
 * ⚠️ **`Retry-After` vince sul nostro calcolo quando c'è**: è il server a sapere
 * quanto sta soffrendo, e ignorarlo per una formula nostra è il modo di farsi
 * bloccare più a lungo.
 */
export async function commitConBackoff(
  tx: Transaction,
  opzioni: { visibility: "sync" | "deferred" },
): Promise<string> {
  let attesa = 500;
  for (let tentativo = 1; tentativo <= TENTATIVI; tentativo += 1) {
    try {
      // ⚠️ **Il `transactionId` È il `_rev` dei documenti scritti dalla transazione.**
      // Verificato l'11/09/2026 su Sanity: commit e rilettura danno lo stesso
      // valore. Per questo `revDopo` non costa una query: lo restituisce il commit.
      const esito = await tx.commit({
        visibility: opzioni.visibility,
        autoGenerateArrayKeys: false,
      });
      return esito.transactionId;
    } catch (e) {
      const s = stato(e);
      const ritentabile = s === 429 || (typeof s === "number" && s >= 500);
      if (!ritentabile || tentativo === TENTATIVI) throw e;
      const ms = retryAfterMs(e) ?? attesa;
      console.log(`      ${s}: attendo ${ms} ms e riprovo (${tentativo}/${TENTATIVI - 1})`);
      await dormi(ms);
      attesa *= 2;
    }
  }
  // Irraggiungibile: il ciclo o restituisce o rilancia. Sta qui perché TypeScript
  // non lo sa, e un `as` direbbe la stessa cosa nascondendola.
  throw new Error("commit non riuscito dopo tutti i tentativi");
}

/** I lotti, nell'ordine in cui arrivano. L'ordine è stabile: un lotto ripreso è lo stesso. */
export function aLotti<T>(voci: T[], quanti = PER_TRANSAZIONE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < voci.length; i += quanti) out.push(voci.slice(i, i + quanti));
  return out;
}

/**
 * Esegue i lotti in **sequenza**, con l'intervallo minimo fra uno e l'altro, e
 * chiama `perLotto` per costruire la transazione.
 *
 * ⚠️ **Concorrenza 1 e non «poche»**: con più scritture in volo, un 429 arriva a
 * tutte insieme e il backoff di ciascuna si somma agli altri. In sequenza il
 * freno è uno solo e si capisce dove è arrivato.
 */
export async function eseguiLotti<T>(
  client: SanityClient,
  lotti: T[][],
  perLotto: (tx: Transaction, lotto: T[]) => void,
  opzioni: {
    visibility: "sync" | "deferred";
    onFatto?: (i: number, lotto: T[], transactionId: string) => void;
  },
): Promise<void> {
  for (const [i, lotto] of lotti.entries()) {
    const tx = client.transaction();
    perLotto(tx, lotto);
    const transactionId = await commitConBackoff(tx, { visibility: opzioni.visibility });
    opzioni.onFatto?.(i, lotto, transactionId);
    if (i < lotti.length - 1) await dormi(INTERVALLO_MS);
  }
}

/**
 * L'attesa prima della rilettura di verifica.
 *
 * ⚠️ Serve perché la scrittura usa `visibility: "deferred"`, che **ritorna prima
 * che l'indice sia aggiornato**: è la scelta giusta per il volume, ma vuol dire
 * che una query lanciata subito dopo può non vedere quello che abbiamo scritto.
 * Quindici secondi, e la rilettura va fatta con `perspective: "raw"`, che è
 * l'unica che vede le bozze.
 */
export const ATTESA_RILETTURA_MS = 15_000;
export const attendiIndice = () => dormi(ATTESA_RILETTURA_MS);
