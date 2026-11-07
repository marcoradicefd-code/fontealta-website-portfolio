/**
 * I rapporti di violazione della CSP, da una richiesta a righe di log.
 *
 * Tutto quello che arriva qui viene da un browser qualsiasi, e chiunque può
 * mandare un POST: per questo i limiti sono qui e non nella rotta. Non si salva
 * niente, si scrivono al più `MAX_RIGHE` righe troncate, senza query string né
 * frammento negli URL, senza user agent e senza IP.
 *
 * Tre forme del corpo, perché la policy dichiara tutti e due i meccanismi:
 * - `report-uri` → `application/csp-report`, un oggetto `{ "csp-report": {…} }`
 *   coi campi a trattini (`blocked-uri`, `source-file`…), CSP3 §5.3;
 * - `report-to` → `application/reports+json`, un ARRAY di
 *   `{ type: "csp-violation", body: {…} }` coi campi camelCase (W3C Reporting §2.2);
 * - WebKit: `application/csp-report` con UN rapporto camelCase senza array (v. `violazioni`).
 */

export const LIMITE_BYTE = 8192;
export const MAX_RIGHE = 10;
export const MAX_CARATTERI = 300;

const TIPI_AMMESSI = new Set(["application/csp-report", "application/reports+json"]);

/** Il rumore delle estensioni del browser (metodo Dropbox): non sono violazioni nostre. */
const SCHEMI_ESTENSIONI = [
  "chrome-extension:",
  "moz-extension:",
  "safari-extension:",
  "safari-web-extension:",
];

type Violazione = {
  direttiva: string;
  bloccato: string;
  pagina: string;
  sorgente: string;
  disposizione: string;
};

/**
 * Un campo del rapporto come testo di UNA riga: i caratteri di controllo (a capo
 * compresi) e i separatori di riga Unicode diventano spazi. Il corpo lo scrive chi
 * vuole, e un `\n` dentro `blocked-uri` aggiungerebbe al log una riga finta,
 * indistinguibile da un rapporto vero (log injection, CWE-117).
 */
const testo = (v: unknown): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ") : "";

/** Il corpo, letto a pezzi e abbandonato oltre il limite: `content-length` può mancare. */
async function leggiCorpo(req: Request): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? 0) > LIMITE_BYTE) return null;
  if (!req.body) return null;
  const lettore = req.body.getReader();
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > LIMITE_BYTE) {
      await lettore.cancel();
      return null;
    }
    pezzi.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(pezzi));
}

/**
 * Il formato si riconosce dal CORPO, non dal content type: WebKit (Safari 26.5,
 * misurato il 15/10/2026) manda `application/csp-report` con dentro UN rapporto
 * nel formato della Reporting API, `{ type: "csp-violation", body: {…} }`, né
 * l'involucro `csp-report` né un array. Il content type resta solo il cancello.
 */
function violazioni(corpo: unknown): Violazione[] {
  const vecchio = (corpo as { "csp-report"?: Record<string, unknown> } | null)?.["csp-report"];
  if (vecchio && typeof vecchio === "object") {
    return [
      {
        direttiva: testo(vecchio["effective-directive"]) || testo(vecchio["violated-directive"]),
        bloccato: testo(vecchio["blocked-uri"]),
        pagina: testo(vecchio["document-uri"]),
        sorgente: testo(vecchio["source-file"]),
        disposizione: testo(vecchio.disposition),
      },
    ];
  }
  const rapporti = Array.isArray(corpo) ? corpo : [corpo];
  return (rapporti as Array<{ type?: unknown; body?: Record<string, unknown> } | null>)
    .flatMap((r) =>
      r?.type === "csp-violation" && r.body && typeof r.body === "object" ? [r.body] : [],
    )
    .map((b) => ({
      direttiva: testo(b.effectiveDirective),
      bloccato: testo(b.blockedURL),
      pagina: testo(b.documentURL),
      sorgente: testo(b.sourceFile),
      disposizione: testo(b.disposition),
    }));
}

const daEstensione = (v: string) => SCHEMI_ESTENSIONI.some((s) => v.startsWith(s));

/** Di un URL http(s) restano origine e percorso: una query può portare dati di chi visita. */
function senzaQuery(v: string): string {
  if (!/^https?:/i.test(v)) return v;
  try {
    const u = new URL(v);
    return u.origin + u.pathname;
  } catch {
    return v.split(/[?#]/)[0];
  }
}

/**
 * Le righe da scrivere nel log per questa richiesta: vuoto se il tipo non è
 * ammesso, se il corpo supera `LIMITE_BYTE`, se il JSON è rotto o se tutto è
 * rumore di estensioni. Non lancia mai: la rotta risponde 204 in ogni caso.
 */
export async function righeDaRichiesta(req: Request): Promise<string[]> {
  const tipo = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!TIPI_AMMESSI.has(tipo)) return [];
  const grezzo = await leggiCorpo(req).catch(() => null);
  if (grezzo === null) return [];
  let corpo: unknown;
  try {
    corpo = JSON.parse(grezzo);
  } catch {
    return [];
  }
  return violazioni(corpo)
    .filter((v) => !daEstensione(v.bloccato) && !daEstensione(v.sorgente))
    .slice(0, MAX_RIGHE)
    .map((v) =>
      [
        "[csp-report]",
        v.direttiva || "?",
        `bloccato=${senzaQuery(v.bloccato) || "?"}`,
        `pagina=${senzaQuery(v.pagina) || "?"}`,
        v.sorgente ? `sorgente=${senzaQuery(v.sorgente)}` : "",
        v.disposizione,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, MAX_CARATTERI),
    );
}
