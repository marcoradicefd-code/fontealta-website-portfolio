import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONSENSO_VERSIONE,
  LISTA_ISCRITTI_SITO,
  LISTA_NEWSLETTER,
  indirizzoBrevo,
  inviaCatalogo,
  iscriviNewsletter,
  nomePerEmail,
} from "./brevo";

const VERO = "https://api.brevo.com/v3";
const LEAD = { email: "mario@example.com", nome: "Mario", paese: "DE" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** La guardia sulla destinazione, non sull'ambiente (Q18, Marco): i casi del grill. */
describe("indirizzoBrevo", () => {
  it.each([
    ["http://localhost:3998", "http://localhost:3998"],
    ["http://127.0.0.1:3998/", "http://127.0.0.1:3998"],
  ])("%s → accettato", (valore, atteso) => {
    expect(indirizzoBrevo(valore)).toBe(atteso);
  });

  it.each([
    "http://localhost.evil.com",
    "http://127.0.0.1.evil.com",
    "http://user@evil.com",
    "http://localhost@evil.com",
    "non è un URL",
    "https://api.brevo.com.evil.com/v3",
  ])("%s → indirizzo vero, con una riga di log", (valore) => {
    expect(indirizzoBrevo(valore)).toBe(VERO);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("assente → indirizzo vero, senza log", () => {
    expect(indirizzoBrevo(undefined)).toBe(VERO);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

function stubFetch(impl: (url: string, init: RequestInit) => unknown) {
  const fn = vi.fn(async (url: string, init: RequestInit) => impl(url, init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const risposta = (status: number, corpo: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

/** Nessuna riga di log porta l'email o il nome. */
function logPuliti() {
  const righe = [...vi.mocked(console.error).mock.calls, ...vi.mocked(console.info).mock.calls].map(
    (c) => c.join(" "),
  );
  for (const r of righe) {
    expect(r).not.toContain("mario");
    expect(r).not.toContain("Mario");
  }
  return righe;
}

describe("inviaCatalogo", () => {
  it("201 → inviato, col template della lingua del PAESE, il link e il nome", async () => {
    vi.stubEnv("BREVO_API_KEY", "chiave-di-prova");
    const fetchMock = stubFetch(() => risposta(201, { messageId: "<x@smtp>" }));

    expect(await inviaCatalogo(LEAD)).toBe("inviato");

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe(`${VERO}/smtp/email`);
    expect(init.method).toBe("POST");
    expect(init.headers["api-key"]).toBe("chiave-di-prova");
    expect(JSON.parse(init.body as string)).toEqual({
      templateId: 99, // DE → tedesco
      to: [{ email: "mario@example.com", name: "Mario" }],
      params: {
        CATALOGO_URL: "https://media.fontealta.it/catalogo/fontealta-catalogo.pdf",
        NOME: "Mario",
      },
    });
  });

  it("202 (programmata) → inviato", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(() => risposta(202));
    expect(await inviaCatalogo(LEAD)).toBe("inviato");
  });

  it("chiave assente → ripiego, nessuna chiamata, riga di dry-run", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const fetchMock = stubFetch(() => risposta(201));
    expect(await inviaCatalogo(LEAD)).toBe("ripiego");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logPuliti()).toContain("[brevo] dry-run: chiave assente");
  });

  it("BREVO_API_URL locale → la chiamata va lì", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    vi.stubEnv("BREVO_API_URL", "http://127.0.0.1:3998");
    const fetchMock = stubFetch(() => risposta(201));
    await inviaCatalogo(LEAD);
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:3998/smtp/email");
  });

  it.each([
    [
      400,
      { code: "invalid_parameter", message: "email non valida" },
      "[brevo] errore: 400 invalid_parameter",
    ],
    [
      401,
      { code: "unauthorized" },
      "[brevo] errore: 401 unauthorized (chiave non valida o IP bloccato)",
    ],
    [500, "non json", "[brevo] errore: 500"],
  ])("%s → ripiego, una riga col codice e senza dati personali", async (status, corpo, riga) => {
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(() => risposta(status as number, corpo));
    expect(await inviaCatalogo(LEAD)).toBe("ripiego");
    expect(logPuliti()).toContain(riga);
  });

  it("timeout → ripiego", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(() => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    expect(await inviaCatalogo(LEAD)).toBe("ripiego");
    expect(logPuliti()).toContain("[brevo] errore: timeout");
  });

  it("rete giù → ripiego", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    expect(await inviaCatalogo(LEAD)).toBe("ripiego");
    expect(logPuliti()).toContain("[brevo] errore: rete");
  });
});

/** Il nome nell'email solo se è un nome (revisione di sicurezza, 19/10/2026). */
describe("nomePerEmail", () => {
  it.each([
    ["Mario", "Mario"],
    ["  Anna   Maria ", "Anna Maria"],
    ["D’Angelo", "D’Angelo"],
    ["O'Brien", "O'Brien"],
    ["Jean-Luc", "Jean-Luc"],
    ["J. R. R.", "J. R. R."],
    ["José", "José"],
    ["Jose\u0301", "José"], // e + accento combinante → NFKC lo compone
    ["Zoë", "Zoë"],
    ["Łukasz", "Łukasz"],
    ["Σοφία", "Σοφία"],
    ["山田", "山田"],
  ])("%s → %s", (nome, atteso) => {
    expect(nomePerEmail(nome)).toBe(atteso);
  });

  it.each([
    "https://evil.example",
    "Vinci www.evil.com",
    "evil.com",
    "Mario.Rossi",
    "evil.\u0301com", // segno combinante dopo il punto
    "evil\uFF0Ecom", // punto a larghezza piena: NFKC lo rende «.»
    "\u0301Mario", // segno combinante in testa
    "Mario\u200Bwww.evil.com", // spazio di larghezza zero
    "Mario..",
    "evil\uA4F8com", // lettera modificatrice che sembra un punto (Lm)
    "Mario\u02B9", // altra Lm, primo
    "Mario <b>",
    "Mario: clicca qui",
    "Mario 123",
    "@mario",
    "-Mario",
    "",
    "   ",
  ])("%s → omesso", (nome) => {
    expect(nomePerEmail(nome)).toBeUndefined();
  });

  it("un nome che non passa non arriva a Brevo: niente `name` né `NOME`", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => risposta(201));
    expect(await inviaCatalogo({ ...LEAD, nome: "Vinci su https://evil.example" })).toBe("inviato");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: [{ email: "mario@example.com" }],
      params: { CATALOGO_URL: "https://media.fontealta.it/catalogo/fontealta-catalogo.pdf" },
    });
    expect(init.body as string).not.toContain("evil");
  });
});

/**
 * L'iscrizione alla newsletter (19/10/2026): niente doppia conferma; `POST /v3/contacts` con
 * `updateEnabled: false`, e per un contatto che c'è già (400 `duplicate_parameter`) le sole liste,
 * senza attributi. Mai `emailBlacklisted`. Dal 20/10/2026 ogni iscrizione entra anche nella 25.
 */
describe("iscriviNewsletter", () => {
  const ISCRIZIONE = {
    email: "mario@example.com",
    nome: "Mario",
    cognome: "Rossi",
    lingua: "it" as const,
    source: "contatti",
    consensoAl: "2026-10-19T18:00:00.000Z",
  };

  it("le liste sono le cinque principali, una per lingua, più «Iscritti dal sito»", () => {
    expect(LISTA_NEWSLETTER).toEqual({ it: 19, en: 23, de: 21, fr: 20, es: 22 });
    expect(LISTA_ISCRITTI_SITO).toBe(25);
  });

  it.each([
    ["IT", 19],
    ["DE", 21],
    ["AT", 21],
    ["CH", 21],
    ["FR", 20],
    ["ES", 22],
    ["US", 23],
    ["ZZ", 23],
  ])("%s → liste %i e 25, una sola chiamata a /contacts", async (paese, lista) => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => risposta(201));
    await iscriviNewsletter({ ...ISCRIZIONE, paese });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${VERO}/contacts`);
    expect(JSON.parse(init.body as string).listIds).toEqual([lista, 25]);
  });

  it("contatto nuovo: una chiamata, updateEnabled false, attributi del 16/10 col COGNOME (20/10), niente emailBlacklisted", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => risposta(201, { id: 7 }));
    await iscriviNewsletter({ ...ISCRIZIONE, paese: "FR" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const corpo = JSON.parse(init.body as string);
    expect(corpo).toEqual({
      email: "mario@example.com",
      listIds: [20, 25],
      updateEnabled: false,
      attributes: {
        NOME: "Mario",
        COGNOME: "Rossi",
        PAESE: "FR",
        LOCALE: "it",
        SOURCE: "contatti",
        GDPR_CONSENT_AT: "2026-10-19T18:00:00.000Z",
        CONSENSO_VERSIONE,
      },
    });
    expect(init.body as string).not.toContain("emailBlacklisted");
    expect(CONSENSO_VERSIONE).toBe("newsletter-2026-10-v1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("contatto esistente (400 duplicate_parameter): le due liste, SOLO l'email, senza attributi", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch((url) =>
      url.endsWith("/contacts")
        ? risposta(400, { code: "duplicate_parameter", message: "Contact already exist" })
        : risposta(201, { contacts: { success: ["mario@example.com"], failure: [] } }),
    );
    await iscriviNewsletter({ ...ISCRIZIONE, paese: "DE" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const aggiunte = (fetchMock.mock.calls.slice(1) as [string, RequestInit][]).map(
      ([url, init]) => [url, JSON.parse(init.body as string)],
    );
    expect(aggiunte).toEqual([
      [`${VERO}/contacts/lists/21/contacts/add`, { emails: ["mario@example.com"] }],
      [`${VERO}/contacts/lists/25/contacts/add`, { emails: ["mario@example.com"] }],
    ]);
    // Il duplicato non è un errore: nessuna riga «errore», una riga informativa senza dati personali.
    const righe = logPuliti();
    expect(righe.some((r) => r.startsWith("[brevo] errore"))).toBe(false);
    expect(righe).toContain("[brevo] contatto già presente: solo le liste");
  });

  it("contatto esistente già nella lista della lingua: la 25 entra lo stesso", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch((url) =>
      url.endsWith("/contacts")
        ? risposta(400, { code: "duplicate_parameter", message: "Contact already exist" })
        : url.includes("/lists/19/")
          ? risposta(400, { code: "invalid_parameter", message: "Contact already in list" })
          : risposta(201, { contacts: { success: ["mario@example.com"], failure: [] } }),
    );
    await iscriviNewsletter({ ...ISCRIZIONE, paese: "IT" });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      `${VERO}/contacts`,
      `${VERO}/contacts/lists/19/contacts/add`,
      `${VERO}/contacts/lists/25/contacts/add`,
    ]);
  });

  it.each([
    [400, { code: "invalid_parameter" }],
    [500, {}],
  ])(
    "un altro errore (%i) non tocca la lista: una chiamata e una riga d'errore",
    async (status, corpo) => {
      vi.stubEnv("BREVO_API_KEY", "k");
      const fetchMock = stubFetch(() => risposta(status, corpo));
      await iscriviNewsletter({ ...ISCRIZIONE, paese: "IT" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(logPuliti().some((r) => r.startsWith(`[brevo] errore: ${status}`))).toBe(true);
    },
  );

  it("un nome o un cognome che non è un nome non va negli attributi", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => risposta(201));
    await iscriviNewsletter({ ...ISCRIZIONE, paese: "IT", nome: "www.evil.com" });
    await iscriviNewsletter({ ...ISCRIZIONE, paese: "IT", cognome: "evil.com/x" });
    const attributi = (fetchMock.mock.calls as [string, RequestInit][]).map(
      ([, init]) => JSON.parse(init.body as string).attributes,
    );
    expect(attributi[0]).not.toHaveProperty("NOME");
    expect(attributi[0]).toHaveProperty("COGNOME", "Rossi");
    expect(attributi[1]).not.toHaveProperty("COGNOME");
    expect(attributi[1]).toHaveProperty("NOME", "Mario");
  });

  it("senza Paese (piè di pagina): la lista della lingua della pagina, e niente PAESE", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => risposta(201));
    await iscriviNewsletter({ ...ISCRIZIONE, lingua: "es", source: "footer" });
    const corpo = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(corpo.listIds).toEqual([22, 25]);
    expect(corpo.attributes).not.toHaveProperty("PAESE");
    expect(corpo.attributes).toMatchObject({ LOCALE: "es", SOURCE: "footer" });
  });

  it("chiave assente → nessuna chiamata, riga di dry-run", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const fetchMock = stubFetch(() => risposta(201));
    await iscriviNewsletter({ ...ISCRIZIONE, paese: "IT" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logPuliti()).toContain("[brevo] dry-run: chiave assente");
  });

  it("errore di Brevo → una riga «[brevo] errore: <status>», senza dati personali, e non lancia", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(() => risposta(400, { code: "invalid_parameter" }));
    await expect(iscriviNewsletter({ ...ISCRIZIONE, paese: "IT" })).resolves.toBeUndefined();
    expect(logPuliti()).toContain("[brevo] errore: 400 invalid_parameter");
  });
});
