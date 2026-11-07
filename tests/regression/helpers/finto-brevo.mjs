/**
 * Finto Brevo per la suite di regressione (19/10/2026, PR del catalogo; Q18 del grill).
 *
 * `playwright.regression.config.ts` lo avvia accanto al finto Zapier e passa al sito
 * `BREVO_API_URL=http://127.0.0.1:3998` più una chiave finta: `indirizzoBrevo` accetta solo un host
 * locale, quindi la chiave finta non esce dalla macchina. Le spec leggono da `GET /ricevuti`
 * cosa è arrivato (template, destinatario, parametri; la chiave no).
 *
 * Errori a comando, dall'indirizzo email: `+brevo400-invalid` → 400 `invalid_parameter`,
 * `+brevo400-duplicate` → 400 `duplicate_parameter`, `+brevo500` → 500, `+brevotimeout` → nessuna
 * risposta per 8 s (il sito si ferma a 5). Tutto in memoria, niente su disco né nei log.
 */
import http from "node:http";

const PORTA = Number(process.env.FINTO_BREVO_PORTA ?? 3998);
const ricevuti = [];
const contatti = [];
const aggiunte = [];

function rispondi(res, stato, corpo) {
  res.writeHead(stato, { "content-type": "application/json" });
  res.end(JSON.stringify(corpo));
}

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/smtp/email") {
      let corpo = "";
      req.on("data", (c) => (corpo += c));
      req.on("end", () => {
        let invio;
        try {
          invio = JSON.parse(corpo);
        } catch {
          invio = { nonJson: corpo };
        }
        ricevuti.push({ ...invio, conChiave: Boolean(req.headers["api-key"]) });
        if (!req.headers["api-key"]) return rispondi(res, 401, { code: "unauthorized" });
        const email = String(invio?.to?.[0]?.email ?? "");
        if (email.includes("+brevotimeout")) return setTimeout(() => rispondi(res, 201, {}), 8000);
        if (email.includes("+brevo500")) return rispondi(res, 500, { message: "errore" });
        if (email.includes("+brevo400-invalid"))
          return rispondi(res, 400, { code: "invalid_parameter", message: "email" });
        if (email.includes("+brevo400-duplicate"))
          return rispondi(res, 400, { code: "duplicate_parameter", message: "email" });
        return rispondi(res, 201, { messageId: `<finto-${ricevuti.length}@smtp-relay>` });
      });
      return;
    }
    // Iscrizione alla newsletter (19/10/2026): `POST /contacts` con `updateEnabled: false`. Il primo
    // invio di un indirizzo crea il contatto (201); uno già visto risponde 400 `duplicate_parameter`,
    // come Brevo per un contatto esistente, e il sito lo aggiunge alle sole liste (sotto). La
    // risposta del modulo deve restare la stessa nei due casi. `+brevo500` e `+brevotimeout` come sopra.
    if (req.method === "POST" && req.url === "/contacts") {
      let corpo = "";
      req.on("data", (c) => (corpo += c));
      req.on("end", () => {
        let contatto;
        try {
          contatto = JSON.parse(corpo);
        } catch {
          contatto = { nonJson: corpo };
        }
        const email = String(contatto?.email ?? "");
        const giaVisto = contatti.some((c) => c.email === email);
        contatti.push({ ...contatto, conChiave: Boolean(req.headers["api-key"]) });
        if (!req.headers["api-key"]) return rispondi(res, 401, { code: "unauthorized" });
        if (email.includes("+brevotimeout")) return setTimeout(() => rispondi(res, 201, {}), 8000);
        if (email.includes("+brevo500")) return rispondi(res, 500, { message: "errore" });
        if (giaVisto && contatto?.updateEnabled === false) {
          return rispondi(res, 400, {
            code: "duplicate_parameter",
            message: "Contact already exist",
          });
        }
        return rispondi(res, 201, { id: contatti.length });
      });
      return;
    }
    if (req.method === "GET" && req.url === "/contatti") return rispondi(res, 200, contatti);
    // Aggiunta di un contatto esistente a una lista, senza attributi (`POST /contacts/lists/{id}/contacts/add`).
    const lista = /^\/contacts\/lists\/(\d+)\/contacts\/add$/.exec(req.url ?? "");
    if (req.method === "POST" && lista) {
      let corpo = "";
      req.on("data", (c) => (corpo += c));
      req.on("end", () => {
        let dati;
        try {
          dati = JSON.parse(corpo);
        } catch {
          dati = { nonJson: corpo };
        }
        aggiunte.push({
          listId: Number(lista[1]),
          corpo: dati,
          conChiave: Boolean(req.headers["api-key"]),
        });
        return rispondi(res, 201, { contacts: { success: dati?.emails ?? [], failure: [] } });
      });
      return;
    }
    if (req.method === "GET" && req.url === "/aggiunte") return rispondi(res, 200, aggiunte);
    if (req.method === "GET" && req.url === "/ricevuti") return rispondi(res, 200, ricevuti);
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200);
      res.end("finto brevo");
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORTA, "127.0.0.1");
