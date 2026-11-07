import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/headers fuori da una richiesta lancia: un referer inglese, per vedere quando conta.
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ referer: "https://fontealta.it/en/collections" })),
}));

// `after` raccoglie le callback: i test le fanno girare DOPO aver letto la risposta, come Vercel.
const callbackAfter: Array<() => Promise<void> | void> = [];
vi.mock("next/server", () => ({
  after: vi.fn((cb: () => Promise<void> | void) => {
    callbackAfter.push(cb);
  }),
}));

import { CONSENSO_VERSIONE } from "@/lib/brevo";

import { submitNewsletter } from "./newsletter-action";

const CONTACTS = "https://api.brevo.com/v3/contacts";

/** Quello che manda il modulo vero: `_gotcha` vuoto e `_ts` di dieci secondi fa. */
const inviato = (extra: Record<string, unknown> = {}) => ({
  nome: "Mario",
  cognome: "Rossi",
  email: "mario@example.com",
  consenso: true,
  lingua: "it",
  _gotcha: "",
  _ts: Date.now() - 10_000,
  ...extra,
});

function stubFetch(impl: (url: string) => Response) {
  const fn = vi.fn(async (url: string) => impl(url));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const risposta = (status: number, corpo: unknown = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

const chiamate = (m: { mock: { calls: unknown[] } }) =>
  m.mock.calls as unknown as Array<[string, { body: string }]>;

async function giraAfter() {
  for (const cb of callbackAfter.splice(0)) await cb();
}

beforeEach(() => {
  callbackAfter.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("submitNewsletter", () => {
  it.each([
    ["it", 19],
    ["en", 23],
    ["de", 21],
    ["fr", 20],
    ["es", 22],
  ])(
    "lingua della pagina %s → lista %i e 25, attributi del 16/10 senza PAESE, SOURCE footer",
    async (lingua, lista) => {
      vi.stubEnv("BREVO_API_KEY", "k");
      const fetchMock = stubFetch(() => risposta(201));
      const res = await submitNewsletter(inviato({ lingua }));
      expect(res).toEqual({ status: "success" });
      // Alla risposta Brevo non è ancora stato chiamato: tutto in `after()`.
      expect(fetchMock).not.toHaveBeenCalled();
      expect(callbackAfter).toHaveLength(1);
      await giraAfter();
      expect(chiamate(fetchMock).map((c) => c[0])).toEqual([CONTACTS]);
      const corpo = JSON.parse(chiamate(fetchMock)[0][1].body);
      expect(corpo).toEqual({
        email: "mario@example.com",
        listIds: [lista, 25],
        updateEnabled: false,
        attributes: {
          NOME: "Mario",
          COGNOME: "Rossi",
          LOCALE: lingua,
          SOURCE: "footer",
          GDPR_CONSENT_AT: expect.any(String),
          CONSENSO_VERSIONE,
        },
      });
      expect(JSON.stringify(corpo)).not.toContain("emailBlacklisted");
    },
  );

  it("contatto già presente → le due liste con la sola email, stessa risposta", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch((url) =>
      url.endsWith("/contacts")
        ? risposta(400, { code: "duplicate_parameter" })
        : risposta(201, { contacts: { success: ["mario@example.com"], failure: [] } }),
    );
    expect(await submitNewsletter(inviato({ lingua: "de" }))).toEqual({ status: "success" });
    await giraAfter();
    expect(chiamate(fetchMock).map((c) => [c[0], JSON.parse(c[1].body)])).toEqual([
      [CONTACTS, expect.objectContaining({ listIds: [21, 25] })],
      [`${CONTACTS}/lists/21/contacts/add`, { emails: ["mario@example.com"] }],
      [`${CONTACTS}/lists/25/contacts/add`, { emails: ["mario@example.com"] }],
    ]);
  });

  it("nome o cognome che non è un nome → iscrizione sì, ma senza quell'attributo", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => risposta(201));
    await submitNewsletter(inviato({ nome: "www.evil.com" }));
    await submitNewsletter(inviato({ cognome: "evil.com/x" }));
    await giraAfter();
    const [a, b] = chiamate(fetchMock).map((c) => JSON.parse(c[1].body).attributes);
    expect(a).not.toHaveProperty("NOME");
    expect(a).toHaveProperty("COGNOME", "Rossi");
    expect(b).not.toHaveProperty("COGNOME");
    expect(b).toHaveProperty("NOME", "Mario");
  });

  it("lingua che non è una lingua → quella del referer (en, lista 23)", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => risposta(201));
    await submitNewsletter(inviato({ lingua: "xx" }));
    await giraAfter();
    expect(JSON.parse(chiamate(fetchMock)[0][1].body)).toMatchObject({
      listIds: [23, 25],
      attributes: { LOCALE: "en" },
    });
  });

  it.each([
    ["senza consenso", { consenso: false }],
    ["consenso assente", { consenso: undefined }],
    ["nome vuoto", { nome: " " }],
    ["cognome assente", { cognome: undefined }],
    ["email non valida", { email: "mario@" }],
  ])("%s → errore di validazione, nessuna chiamata", async (_caso, extra) => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => risposta(201));
    expect(await submitNewsletter(inviato(extra))).toEqual({
      status: "error",
      message: "validation",
    });
    expect(callbackAfter).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["honeypot compilato", { _gotcha: "spam" }, "honeypot"],
    ["invio sotto i 3 secondi", { _ts: Date.now() - 500 }, "tempo"],
    ["campi anti-bot mancanti", { _gotcha: undefined, _ts: undefined }, "campi-antibot-mancanti"],
  ])("%s → finto successo, nessuna iscrizione, una riga di log", async (_caso, extra, motivo) => {
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => risposta(201));
    expect(await submitNewsletter(inviato(extra))).toEqual({ status: "success" });
    expect(callbackAfter).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(`[submitNewsletter] scartato: ${motivo}`);
  });

  it("Brevo in errore → stessa risposta, e il log non ha email né nome", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(() => risposta(500));
    expect(await submitNewsletter(inviato())).toEqual({ status: "success" });
    await giraAfter();
    const righe = vi.mocked(console.error).mock.calls.map((c) => c.join(" "));
    expect(righe).toContain("[brevo] errore: 500");
    expect(righe.join("\n")).not.toMatch(/mario|Mario/);
  });

  it("chiave assente (anteprime) → successo, nessuna chiamata a Brevo", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const fetchMock = stubFetch(() => risposta(201));
    expect(await submitNewsletter(inviato())).toEqual({ status: "success" });
    await giraAfter();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("non va a Zapier e non manda email: l'unico indirizzo chiamato è /contacts", async () => {
    vi.stubEnv("BREVO_API_KEY", "k");
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", "https://hooks.zapier.test/abc");
    const fetchMock = stubFetch(() => risposta(201));
    await submitNewsletter(inviato());
    await giraAfter();
    expect(chiamate(fetchMock).map((c) => c[0])).toEqual([CONTACTS]);
  });
});
