// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/csp-report/route";
import { LIMITE_BYTE, MAX_CARATTERI, MAX_RIGHE, righeDaRichiesta } from "./csp-report";

/**
 * L'endpoint dei rapporti CSP riceve POST da chiunque: queste prove tengono
 * fermi i limiti (tipo, dimensione, righe, caratteri), il filtro del rumore delle
 * estensioni e la pulizia degli URL. La rotta risponde 204 in ogni caso.
 */
const URL_ENDPOINT = "https://fontealta.it/api/csp-report";

function richiesta(tipo: string, corpo: string, intestazioni: Record<string, string> = {}) {
  return new Request(URL_ENDPOINT, {
    method: "POST",
    headers: { "content-type": tipo, ...intestazioni },
    body: corpo,
  });
}

const vecchio = (r: Record<string, unknown>) =>
  richiesta("application/csp-report", JSON.stringify({ "csp-report": r }));

const nuovo = (bodies: Array<Record<string, unknown>>, tipo = "csp-violation") =>
  richiesta(
    "application/reports+json",
    JSON.stringify(bodies.map((body) => ({ type: tipo, url: "https://fontealta.it/", body }))),
  );

afterEach(() => vi.restoreAllMocks());

describe("csp-report · i due formati", () => {
  it("report-uri (application/csp-report): una riga coi campi a trattini", async () => {
    const righe = await righeDaRichiesta(
      vecchio({
        "effective-directive": "img-src",
        "blocked-uri": "https://evil.example/x.png",
        "document-uri": "https://fontealta.it/collezioni",
        disposition: "report",
      }),
    );
    expect(righe).toEqual([
      "[csp-report] img-src bloccato=https://evil.example/x.png pagina=https://fontealta.it/collezioni report",
    ]);
  });

  it("report-to (application/reports+json): una riga per ogni csp-violation, gli altri tipi no", async () => {
    const req = richiesta(
      "application/reports+json",
      JSON.stringify([
        {
          type: "csp-violation",
          body: {
            effectiveDirective: "script-src-elem",
            blockedURL: "inline",
            documentURL: "https://fontealta.it/",
            sourceFile: "https://fontealta.it/_next/static/chunks/a.js",
            disposition: "report",
          },
        },
        { type: "deprecation", body: { id: "x" } },
        {
          type: "csp-violation",
          body: {
            effectiveDirective: "media-src",
            blockedURL: "https://altro.example/v.mp4",
            documentURL: "https://fontealta.it/chi-siamo",
            disposition: "report",
          },
        },
      ]),
    );
    expect(await righeDaRichiesta(req)).toEqual([
      "[csp-report] script-src-elem bloccato=inline pagina=https://fontealta.it/ sorgente=https://fontealta.it/_next/static/chunks/a.js report",
      "[csp-report] media-src bloccato=https://altro.example/v.mp4 pagina=https://fontealta.it/chi-siamo report",
    ]);
  });

  /**
   * La forma catturata da WebKit (Safari 26.5) il 15/10/2026: `application/csp-report`
   * ma UN rapporto della Reporting API, senza involucro e senza array. Con il formato
   * deciso dal content type, i 70 rapporti di una visita arrivavano e sparivano.
   */
  it("WebKit: application/csp-report con un solo rapporto camelCase", async () => {
    const req = richiesta(
      "application/csp-report",
      JSON.stringify({
        type: "csp-violation",
        url: "http://localhost:3200/collezioni",
        body: {
          documentURL: "http://localhost:3200/collezioni",
          disposition: "report",
          referrer: "",
          effectiveDirective: "img-src",
          blockedURL:
            "https://cdn.sanity.io:443/images/mwlqc6ab/production/4601f528ef9560d274561a263d2374c053d15d24-896x1200.png?fit=max&auto=format&w=384&q=82",
          originalPolicy: "default-src 'self'; img-src 'self' data:",
          statusCode: 200,
          sample: "",
        },
      }),
    );
    expect(await righeDaRichiesta(req)).toEqual([
      "[csp-report] img-src bloccato=https://cdn.sanity.io/images/mwlqc6ab/production/4601f528ef9560d274561a263d2374c053d15d24-896x1200.png pagina=http://localhost:3200/collezioni report",
    ]);
  });

  it("il content type con parametri passa", async () => {
    const req = richiesta(
      "application/csp-report; charset=utf-8",
      JSON.stringify({ "csp-report": { "violated-directive": "img-src", "blocked-uri": "data" } }),
    );
    expect(await righeDaRichiesta(req)).toHaveLength(1);
  });
});

describe("csp-report · cosa si scarta", () => {
  /**
   * ⚠️ Il corpo è nel formato di report-to, cioè uno che SAREBBE accettato: con
   * il formato vecchio questa prova passava anche senza il controllo del tipo,
   * perché un oggetto non è un array (misurato togliendo il controllo).
   */
  it.each(["application/json", "text/plain", ""])("content type %j: niente righe", async (tipo) => {
    const corpo = JSON.stringify([
      {
        type: "csp-violation",
        body: { effectiveDirective: "img-src", blockedURL: "https://x.example" },
      },
    ]);
    expect(await righeDaRichiesta(richiesta(tipo, corpo))).toEqual([]);
  });

  it("JSON rotto: niente righe", async () => {
    expect(await righeDaRichiesta(richiesta("application/csp-report", "{non è json"))).toEqual([]);
  });

  it(`oltre ${LIMITE_BYTE} byte senza content-length: il corpo si abbandona`, async () => {
    const enorme = JSON.stringify({
      "csp-report": { "blocked-uri": "x".repeat(LIMITE_BYTE + 10) },
    });
    expect(await righeDaRichiesta(richiesta("application/csp-report", enorme))).toEqual([]);
  });

  it("content-length oltre il limite: non si legge nemmeno", async () => {
    const piccolo = JSON.stringify({ "csp-report": { "blocked-uri": "https://x.example" } });
    const req = richiesta("application/csp-report", piccolo, {
      "content-length": String(LIMITE_BYTE + 1),
    });
    expect(await righeDaRichiesta(req)).toEqual([]);
  });

  describe.each([
    "chrome-extension:",
    "moz-extension:",
    "safari-extension:",
    "safari-web-extension:",
  ])("rumore delle estensioni (%s)", (schema) => {
    it("scartato se viene da blocked-uri", async () => {
      const req = vecchio({
        "effective-directive": "script-src",
        "blocked-uri": `${schema}//abc/x.js`,
      });
      expect(await righeDaRichiesta(req)).toEqual([]);
    });
    it("scartato se viene da sourceFile", async () => {
      const req = nuovo([
        {
          effectiveDirective: "style-src",
          blockedURL: "inline",
          sourceFile: `${schema}//abc/c.js`,
        },
      ]);
      expect(await righeDaRichiesta(req)).toEqual([]);
    });
  });
});

describe("csp-report · quello che finisce nel log", () => {
  /**
   * Log injection (CWE-117): il corpo lo scrive chi vuole, e un a capo dentro un campo
   * aggiungerebbe una riga finta, indistinguibile da un rapporto vero.
   */
  it("un a capo in un campo NON produce una seconda riga, in nessuno dei campi", async () => {
    const finto = "\n[csp-report] script-src bloccato=https://finto.example pagina=/ report";
    const req = nuovo([
      {
        effectiveDirective: `img-src${finto}`,
        blockedURL: `inline\r${finto}`,
        documentURL: `https://fontealta.it/${finto}`,
        sourceFile: `x\u2028${finto}`,
        disposition: `report\u0085${finto}`,
      },
    ]);
    const righe = await righeDaRichiesta(req);
    expect(righe).toHaveLength(1);
    expect(righe[0]).not.toMatch(/[\r\n\u0085\u2028\u2029]/);
  });

  it("query e frammento tolti dagli URL, le parole chiave restano", async () => {
    const req = nuovo([
      {
        effectiveDirective: "img-src",
        blockedURL: "https://cdn.example/a.png?token=segreto#x",
        documentURL: "https://fontealta.it/contatti?nome=Mario&email=m@x.it",
        sourceFile: "https://fontealta.it/_next/a.js?v=1",
      },
    ]);
    const [riga] = await righeDaRichiesta(req);
    expect(riga).not.toMatch(/segreto|Mario|m@x\.it|v=1|#x/);
    expect(riga).toContain("bloccato=https://cdn.example/a.png");
    expect(riga).toContain("pagina=https://fontealta.it/contatti");
  });

  it(`ogni riga è troncata a ${MAX_CARATTERI} caratteri`, async () => {
    const req = nuovo([
      { effectiveDirective: "img-src", blockedURL: `https://x.example/${"a".repeat(1000)}` },
    ]);
    const [riga] = await righeDaRichiesta(req);
    expect(riga).toHaveLength(MAX_CARATTERI);
  });

  it(`al più ${MAX_RIGHE} righe per richiesta`, async () => {
    const tante = Array.from({ length: 25 }, (_, i) => ({
      effectiveDirective: "img-src",
      blockedURL: `https://x.example/${i}`,
    }));
    expect(await righeDaRichiesta(nuovo(tante))).toHaveLength(MAX_RIGHE);
  });
});

describe("csp-report · la rotta", () => {
  it("risponde 204 e scrive una riga per violazione", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST(
      vecchio({ "effective-directive": "img-src", "blocked-uri": "https://evil.example/x.png" }),
    );
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("risponde 204 anche a un corpo che scarta, senza scrivere niente", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST(richiesta("text/html", "<script>"));
    expect(res.status).toBe(204);
    expect(log).not.toHaveBeenCalled();
  });
});
