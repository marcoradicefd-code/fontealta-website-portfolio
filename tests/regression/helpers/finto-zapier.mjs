/**
 * Finto webhook Zapier per la suite di regressione (13/10/2026).
 *
 * Con `next start` il modulo NON va in dry-run (`NODE_ENV=production`): senza webhook risponde
 * `error/config`, e con un webhook vero manderebbe un lead ad Andrea. Questo server prende il suo
 * posto: `playwright.regression.config.ts` lo avvia come primo `webServer` e passa il suo indirizzo
 * al sito in `ZAPIER_CONTACT_WEBHOOK_URL`. Le spec leggono quel che ha ricevuto da `GET /ricevuti`.
 *
 * Tiene tutto in memoria e non scrive niente su disco né nei log: dentro ci sono i dati di prova.
 */
import http from "node:http";

const PORTA = Number(process.env.FINTO_ZAPIER_PORTA ?? 3999);
const ricevuti = [];

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/hook") {
      let corpo = "";
      req.on("data", (c) => (corpo += c));
      req.on("end", () => {
        let lead;
        try {
          lead = JSON.parse(corpo);
        } catch {
          lead = { nonJson: corpo };
        }
        ricevuti.push(lead);
        // Errore a comando (14/10/2026): un'email con `+errore500` fa rispondere 500, per provare
        // l'errore di invio del modulo senza toccare Zapier vero. Il lead viene registrato lo stesso.
        if (String(lead.email ?? "").includes("+errore500")) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end('{"status":"error"}');
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end('{"status":"success"}');
      });
      return;
    }
    if (req.method === "GET" && req.url === "/ricevuti") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(ricevuti));
      return;
    }
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200);
      res.end("finto zapier");
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORTA, "127.0.0.1");
