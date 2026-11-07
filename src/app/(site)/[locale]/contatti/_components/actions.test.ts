import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/headers è server-only e throwa fuori da un request context → mock con un
// referer noto (/contatti → source "contatti").
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ referer: "https://fontealta.it/contatti" })),
}));

// `after` di next/server fuori da una richiesta lancia: qui raccoglie le callback, e i test le
// fanno girare quando vogliono, cioè DOPO aver letto la risposta (come fa Vercel).
const callbackAfter: Array<() => Promise<void> | void> = [];
vi.mock("next/server", () => ({
  after: vi.fn((cb: () => Promise<void> | void) => {
    callbackAfter.push(cb);
  }),
}));

import { headers } from "next/headers";

import { submitContact } from "./actions";
import { ALL_LOCALES, routing } from "@/i18n/routing";

import { SOURCE_PER_ROTTA, deriveSource, risolviLingua, risolviSource } from "./derive-source";

const WEBHOOK = "https://hooks.zapier.test/abc";

const validValues = {
  nome: "Mario",
  cognome: "Rossi",
  email: "mario@example.com",
  telefono: "",
  azienda: "",
  richiesta: "preventivo",
  paese: "IT",
  note: "",
} as const;

/**
 * Quello che il modulo vero manda sempre: `_gotcha` vuoto dai `defaultValues` e `_ts`
 * da `mountedAt` (dal 7/10/2026 i due campi sono obbligatori, e senza la richiesta è
 * scartata). Dieci secondi fa: fuori dalla trappola dei 3 s.
 */
const inviato = () => ({ ...validValues, _gotcha: "", _ts: Date.now() - 10_000, lingua: "it" });

/** Mock fetch che ritorna una response 2xx/errore senza dipendere da undici. */
function stubFetch(impl: () => unknown) {
  const fn = vi.fn(async () => impl());
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("submitContact", () => {
  it("webhook set → POST con JSON esatto (senza _gotcha/_ts) + _secret nel body → success", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("ZAPIER_SHARED_SECRET", "s3cr3t");
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact(inviato());

    expect(res).toEqual({ status: "success" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe(WEBHOOK);
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body as string);
    expect(body).toMatchObject({
      nome: "Mario",
      cognome: "Rossi",
      email: "mario@example.com",
      telefono: "",
      azienda: "",
      richiesta: "preventivo",
      paese: "IT",
      note: "",
      lingua: "it",
      // Fuori dalle schede modello i due campi ci sono, vuoti (16/10/2026).
      modello: "",
      modelloNome: "",
      source: "contatti", // deriva dal referer mockato
    });
    expect(typeof body.timestamp).toBe("string");
    expect(body._secret).toBe("s3cr3t");
    expect(body).not.toHaveProperty("_gotcha");
    expect(body).not.toHaveProperty("_ts");
  });

  /** Note, Paese e lingua (13/10/2026): arrivano a Zapier così come Andrea li deve leggere. */
  it("note, paese ZZ e lingua arrivano nel body", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact({ ...inviato(), paese: "ZZ", note: "Kosovo", lingua: "de" });

    expect(res).toEqual({ status: "success" });
    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({ paese: "ZZ", note: "Kosovo", lingua: "de" });
    expect(body).not.toHaveProperty("_gotcha");
    expect(body).not.toHaveProperty("_ts");
  });

  it.each([
    ["lingua non valida", "xx"],
    ["lingua maiuscola", "EN"],
    ["lingua assente", undefined],
    ["lingua di 50 caratteri", "x".repeat(50)],
    ["lingua di tipo sbagliato", 42],
  ])("%s → si ripiega sulla lingua del referer, mai un rifiuto", async (_caso, lingua) => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact({ ...inviato(), lingua });

    expect(res).toEqual({ status: "success" });
    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    // Referer mockato: https://fontealta.it/contatti → nessun prefisso → italiano.
    expect(JSON.parse(opts.body).lingua).toBe("it");
  });

  it("pagina dichiarata e referer ASSENTE → source dalla pagina, e pagina non va a Zapier", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.mocked(headers).mockResolvedValueOnce(new Headers() as never);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    await submitContact({ ...inviato(), pagina: "/produzione" });

    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const body = JSON.parse(opts.body);
    expect(body.source).toBe("produzione");
    expect(body).not.toHaveProperty("pagina");
  });

  it.each([
    ["inventata", "/pagina-inventata"],
    ["di tipo sbagliato", { x: 1 }],
  ])("pagina %s → source dal referer, e il lead NON è rifiutato", async (_caso, pagina) => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact({ ...inviato(), pagina });

    expect(res).toEqual({ status: "success" });
    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(opts.body).source).toBe("contatti"); // dal referer mockato
  });

  /** Il modello della scheda (16/10/2026): arriva com'è, con la source della rotta. */
  it("dalla scheda modello → modello, modelloNome e source «modello»", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.mocked(headers).mockResolvedValueOnce(
      new Headers({ referer: "https://fontealta.it/en/model/b40l" }) as never,
    );
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    await submitContact({ ...inviato(), modello: "B40L", modelloNome: "Boss B40L", lingua: "en" });

    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(opts.body)).toMatchObject({
      modello: "B40L",
      modelloNome: "Boss B40L",
      source: "modello",
      lingua: "en",
    });
  });

  it.each([
    ["codice di 41 caratteri", { modello: "X".repeat(41) }, { modello: "" }],
    ["nome di 121 caratteri", { modelloNome: "x".repeat(121) }, { modelloNome: "" }],
    ["codice di tipo sbagliato", { modello: 42 }, { modello: "" }],
    ["nome di tipo sbagliato", { modelloNome: { x: 1 } }, { modelloNome: "" }],
  ])("%s → campo vuoto, e il lead NON è rifiutato", async (_caso, cambio, atteso) => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact({ ...inviato(), ...cambio });

    expect(res).toEqual({ status: "success" });
    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(opts.body)).toMatchObject(atteso);
  });

  it("note assenti → stringa vuota, come telefono", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));
    const senzaNote: Record<string, unknown> = inviato();
    delete senzaNote.note;

    await submitContact(senzaNote);

    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(opts.body).note).toBe("");
  });

  it.each([
    ["«altro» senza note", { richiesta: "altro" }],
    ["paese assente", { paese: undefined }],
    ["paese minuscolo", { paese: "it" }],
  ])("%s → error/validation anche lato server, nessun invio", async (_caso, cambio) => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact({ ...inviato(), ...cambio });

    expect(res).toEqual({ status: "error", message: "validation" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("secret assente → nessun campo _secret nel body", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("ZAPIER_SHARED_SECRET", "");
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    await submitContact(inviato());

    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const body = JSON.parse(opts.body);
    expect(body).not.toHaveProperty("_secret");
  });

  it("webhook assente in PRODUZIONE → error/config (mai fake-success), no fetch", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", "");
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact(inviato());

    expect(res).toEqual({ status: "error", message: "config" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("webhook assente in DEV → dry-run success, no fetch", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", "");
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact(inviato());

    expect(res).toEqual({ status: "success" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("payload invalido → error/validation", async () => {
    const res = await submitContact({ nome: "", email: "non-una-email" });
    expect(res).toEqual({ status: "error", message: "validation" });
  });

  it("webhook non-2xx → error/send", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    stubFetch(() => ({ ok: false, status: 500 }));
    const res = await submitContact(inviato());
    expect(res).toEqual({ status: "error", message: "send" });
  });

  it("fetch throws → error/send", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    stubFetch(() => {
      throw new Error("network");
    });
    const res = await submitContact(inviato());
    expect(res).toEqual({ status: "error", message: "send" });
  });

  it("honeypot _gotcha compilato → fake-success, no fetch", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact({ ...inviato(), _gotcha: "http://spam.example" });

    expect(res).toEqual({ status: "success" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("timestamp-trap: submit < 3s dal mount → fake-success, no fetch", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    // _ts appena impostato → elapsed ~0 < 3000
    const res = await submitContact({ ...inviato(), _ts: Date.now() });

    expect(res).toEqual({ status: "success" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ I campi anti-bot sono OBBLIGATORI dal 7/10/2026. Prima le due trappole qui sopra
   * scattavano solo se il campo c'era, quindi una chiamata diretta alla Server Action
   * senza `_ts` né `_gotcha` arrivava a Zapier.
   */
  it.each([
    ["senza _ts", () => ({ ...validValues, _gotcha: "" })],
    ["senza _gotcha", () => ({ ...validValues, _ts: Date.now() - 10_000 })],
    ["senza tutti e due", () => ({ ...validValues })],
  ])("%s → fake-success, no fetch, log dello scarto", async (_caso, valori) => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 }));

    const res = await submitContact(valori());

    expect(res).toEqual({ status: "success" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith("[submitContact] scartato: campi-antibot-mancanti");
  });

  it("ogni scarto lascia una riga di log col motivo, e nessun dato personale", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    stubFetch(() => ({ ok: true, status: 200 }));

    await submitContact({ ...inviato(), _gotcha: "x" });
    await submitContact({ ...inviato(), _ts: Date.now() });

    const righe = vi.mocked(console.info).mock.calls.map((c) => c.join(" "));
    expect(righe).toEqual([
      "[submitContact] scartato: honeypot",
      "[submitContact] scartato: tempo",
    ]);
    for (const riga of righe) {
      expect(riga).not.toContain(validValues.email);
      expect(riga).not.toContain(validValues.nome);
    }
  });
});

/**
 * La source dalla pagina dichiarata dal modulo (14/10/2026): `usePathname` di next-intl, cioè
 * la chiave INTERNA di `routing.pathnames`. Vale solo se è una chiave della mappa; altrimenti
 * si ripiega sul referer, che può mancare (`Referrer-Policy: no-referrer`).
 */
/**
 * Il catalogo (19/10/2026): prima Zapier, poi Brevo, e solo con `richiesta: "catalogo"`. Il lead del
 * catalogo ha la source della ROTTA (D1 di Marco) e si riconosce dalla richiesta.
 */
describe("submitContact · catalogo", () => {
  const BREVO = "https://api.brevo.com/v3/smtp/email";
  const dalMiniModulo = () => ({
    nome: "Mario",
    cognome: "Rossi",
    email: "mario@example.com",
    paese: "FR",
    richiesta: "catalogo",
    _gotcha: "",
    _ts: Date.now() - 10_000,
    lingua: "en",
    pagina: "/collezioni",
  });

  /** Le chiamate a `fetch`, con l'URL e il corpo (il mock di `stubFetch` non ha parametri tipizzati). */
  const chiamate = (m: { mock: { calls: unknown[] } }) =>
    m.mock.calls as unknown as Array<[string, { body: string }]>;

  function stubDue(brevo: { ok: boolean; status: number }) {
    return stubFetch(() => ({ ok: true, status: 200 })).mockImplementation(
      async (...args: unknown[]) =>
        String(args[0]) === BREVO
          ? { ...brevo, json: async () => ({}) }
          : { ok: true, status: 200 },
    );
  }

  it("mini-modulo → Zapier col lead (col cognome dal 20/10, source della rotta), POI Brevo → inviato", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubDue({ ok: true, status: 201 });

    const res = await submitContact(dalMiniModulo());

    expect(res).toEqual({ status: "success", catalogo: "inviato" });
    expect(chiamate(fetchMock).map((c) => c[0])).toEqual([WEBHOOK, BREVO]);
    const zapier = JSON.parse(chiamate(fetchMock)[0][1].body);
    expect(zapier).toMatchObject({
      nome: "Mario",
      cognome: "Rossi",
      richiesta: "catalogo",
      paese: "FR",
      lingua: "en",
      source: "collezioni",
    });
    // La lingua dell'email viene dal Paese (FR → 100), non dalla pagina (en).
    const brevo = JSON.parse(chiamate(fetchMock)[1][1].body);
    expect(brevo.templateId).toBe(100);
  });

  it("modulo generale con «catalogo» (pagina in cache) → Zapier e Brevo, come il mini-modulo", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubDue({ ok: true, status: 201 });

    const res = await submitContact({ ...inviato(), richiesta: "catalogo" });

    expect(res).toEqual({ status: "success", catalogo: "inviato" });
    expect(chiamate(fetchMock).map((c) => c[0])).toEqual([WEBHOOK, BREVO]);
    expect(JSON.parse(chiamate(fetchMock)[0][1].body)).toMatchObject({
      cognome: "Rossi",
      richiesta: "catalogo",
      source: "contatti",
    });
  });

  it("Brevo in errore → successo col ripiego: il lead è già su Zapier", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    stubDue({ ok: false, status: 500 });
    expect(await submitContact(dalMiniModulo())).toEqual({
      status: "success",
      catalogo: "ripiego",
    });
  });

  it("chiave Brevo assente → successo col ripiego, una sola chiamata (Zapier)", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "");
    const fetchMock = stubDue({ ok: true, status: 201 });
    expect(await submitContact(dalMiniModulo())).toEqual({
      status: "success",
      catalogo: "ripiego",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Zapier in errore → errore, e il catalogo NON parte", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => ({ ok: false, status: 500 }));
    expect(await submitContact(dalMiniModulo())).toEqual({ status: "error", message: "send" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("le altre richieste: niente email del catalogo, e il risultato resta { status: success }", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubDue({ ok: true, status: 201 });
    expect(await submitContact(inviato())).toEqual({ status: "success" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("una trappola anti-bot scatta anche col catalogo: nessun invio", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubDue({ ok: true, status: 201 });
    expect(await submitContact({ ...dalMiniModulo(), _gotcha: "bot" })).toEqual({
      status: "success",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * La newsletter (19/10/2026): con la casella, l'iscrizione su Brevo in `after()`, dopo la
 * risposta e solo dopo il successo di Zapier. La risposta è la stessa con e senza casella.
 */
describe("submitContact · newsletter", () => {
  const CONTACTS = "https://api.brevo.com/v3/contacts";
  const chiamate = (m: { mock: { calls: unknown[] } }) =>
    m.mock.calls as unknown as Array<[string, { body: string }]>;

  beforeEach(() => {
    callbackAfter.length = 0;
  });

  it("casella spuntata → stessa risposta, newsletterRichiesta «sì», e Brevo SOLO dentro after()", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => ({ ok: true, status: 201, json: async () => ({}) }));

    const res = await submitContact({ ...inviato(), newsletter: true });

    expect(res).toEqual({ status: "success" });
    // Alla risposta Brevo non è ancora stato chiamato: c'è solo Zapier.
    expect(chiamate(fetchMock).map((c) => c[0])).toEqual([WEBHOOK]);
    expect(JSON.parse(chiamate(fetchMock)[0][1].body)).toMatchObject({ newsletterRichiesta: "sì" });
    expect(JSON.parse(chiamate(fetchMock)[0][1].body)).not.toHaveProperty("newsletter");

    // Due callback: l'iscrizione e l'email di conferma della richiesta (20/10/2026).
    expect(callbackAfter).toHaveLength(2);
    await callbackAfter[0]();
    expect(chiamate(fetchMock).map((c) => c[0])).toEqual([WEBHOOK, CONTACTS]);
    const corpo = JSON.parse(chiamate(fetchMock)[1][1].body);
    expect(corpo).toMatchObject({
      email: "mario@example.com",
      listIds: [19, 25],
      updateEnabled: false,
      attributes: { NOME: "Mario", PAESE: "IT", LOCALE: "it", SOURCE: "contatti" },
    });
    // Dal 20/10/2026 anche il cognome (Marco), col filtro del nome.
    expect(corpo.attributes).toHaveProperty("COGNOME", "Rossi");
    expect(JSON.stringify(corpo)).not.toContain("emailBlacklisted");
  });

  it("casella NON spuntata → stessa risposta, newsletterRichiesta «no», nessuna iscrizione", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => ({ ok: true, status: 201, json: async () => ({}) }));

    const res = await submitContact(inviato());

    expect(res).toEqual({ status: "success" });
    expect(JSON.parse(chiamate(fetchMock)[0][1].body)).toMatchObject({ newsletterRichiesta: "no" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // In `after()` c'è solo l'email di conferma, e nessuna chiamata a `/contacts`.
    expect(callbackAfter).toHaveLength(1);
    await callbackAfter[0]();
    expect(chiamate(fetchMock).map((c) => c[0])).not.toContain(CONTACTS);
  });

  it("Zapier in errore → errore, e nessuna iscrizione", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(() => ({ ok: false, status: 500 }));
    expect(await submitContact({ ...inviato(), newsletter: true })).toEqual({
      status: "error",
      message: "send",
    });
    expect(callbackAfter).toHaveLength(0);
  });

  it("una trappola anti-bot → nessuna iscrizione", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    stubFetch(() => ({ ok: true, status: 200 }));
    await submitContact({ ...inviato(), newsletter: true, _gotcha: "bot" });
    expect(callbackAfter).toHaveLength(0);
  });

  it("catalogo e casella insieme → l'email del catalogo attesa, l'iscrizione dopo la risposta", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => ({ ok: true, status: 201, json: async () => ({}) }));
    const res = await submitContact({ ...inviato(), richiesta: "catalogo", newsletter: true });
    expect(res).toEqual({ status: "success", catalogo: "inviato" });
    expect(chiamate(fetchMock).map((c) => c[0])).toEqual([
      WEBHOOK,
      "https://api.brevo.com/v3/smtp/email",
    ]);
    // Solo l'iscrizione: il catalogo ha la sua email, niente conferma della richiesta.
    expect(callbackAfter).toHaveLength(1);
    await callbackAfter[0]();
    expect(chiamate(fetchMock).at(-1)?.[0]).toBe(CONTACTS);
  });
});

/**
 * L'email «Richiesta ricevuta» (20/10/2026): per ogni richiesta che non è il catalogo, via Brevo in
 * `after()`, solo dopo il successo di Zapier; template della lingua del PAESE, `NOME` come unico
 * parametro, nessun attributo e nessuna lista.
 */
describe("submitContact · conferma della richiesta", () => {
  const SMTP = "https://api.brevo.com/v3/smtp/email";
  const chiamate = (m: { mock: { calls: unknown[] } }) =>
    m.mock.calls as unknown as Array<[string, { body: string }]>;
  const ok = () => ({ ok: true, status: 201, json: async () => ({}) });

  beforeEach(() => {
    callbackAfter.length = 0;
  });

  async function inviaEConferma(valori: Record<string, unknown>) {
    const fetchMock = stubFetch(ok);
    const res = await submitContact(valori);
    // Alla risposta c'è solo Zapier: la conferma parte dopo.
    expect(chiamate(fetchMock).map((c) => c[0])).toEqual([WEBHOOK]);
    for (const cb of callbackAfter) await cb();
    return { res, fetchMock };
  }

  for (const [paese, template] of [
    ["IT", 112],
    ["US", 113],
    ["ZZ", 113],
    ["AT", 114],
    ["CH", 114],
    ["FR", 115],
    ["ES", 116],
  ] as const) {
    it(`Paese ${paese} → template ${template}, a chi ha scritto, col solo NOME`, async () => {
      vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
      vi.stubEnv("BREVO_API_KEY", "k");
      const note = paese === "ZZ" ? "Kosovo" : "";
      const { res, fetchMock } = await inviaEConferma({ ...inviato(), paese, note });

      expect(res).toEqual({ status: "success" });
      expect(chiamate(fetchMock).map((c) => c[0])).toEqual([WEBHOOK, SMTP]);
      expect(JSON.parse(chiamate(fetchMock)[1][1].body)).toEqual({
        templateId: template,
        to: [{ email: "mario@example.com", name: "Mario" }],
        params: { NOME: "Mario" },
      });
    });
  }

  it("dal modulo del catalogo → nessuna conferma (ha la sua email)", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(ok);
    await submitContact({
      nome: "Mario",
      email: "mario@example.com",
      paese: "IT",
      richiesta: "catalogo",
      _gotcha: "",
      _ts: Date.now() - 10_000,
      lingua: "it",
      pagina: "/collezioni",
    });
    expect(callbackAfter).toHaveLength(0);
  });

  it("Zapier in errore → nessuna conferma: la richiesta non è arrivata", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(() => ({ ok: false, status: 500 }));
    expect(await submitContact(inviato())).toEqual({ status: "error", message: "send" });
    expect(callbackAfter).toHaveLength(0);
  });

  it("una trappola anti-bot → nessuna conferma", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    stubFetch(ok);
    await submitContact({ ...inviato(), _gotcha: "bot" });
    expect(callbackAfter).toHaveLength(0);
  });

  it("chiave assente (anteprime) → nessuna chiamata a Brevo", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "");
    const { fetchMock } = await inviaEConferma(inviato());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Brevo in errore → la risposta non cambia, e il log non ha email né nome", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const fetchMock = stubFetch(() => ({ ok: true, status: 200 })).mockImplementation(
      async (...args: unknown[]) =>
        String(args[0]) === SMTP
          ? { ok: false, status: 500, json: async () => ({}) }
          : { ok: true, status: 200 },
    );
    expect(await submitContact(inviato())).toEqual({ status: "success" });
    await callbackAfter[0]();
    expect(chiamate(fetchMock).map((c) => c[0])).toEqual([WEBHOOK, SMTP]);
    const righe = vi.mocked(console.error).mock.calls.map((c) => c.join(" "));
    expect(righe).toContain("[brevo] errore: 500");
    expect(righe.join("\n")).not.toMatch(/mario|Mario/);
  });

  it("un nome che non è un nome → niente NOME né name: il template saluta in modo generico", async () => {
    vi.stubEnv("ZAPIER_CONTACT_WEBHOOK_URL", WEBHOOK);
    vi.stubEnv("BREVO_API_KEY", "k");
    const { fetchMock } = await inviaEConferma({ ...inviato(), nome: "www.evil.com" });
    expect(JSON.parse(chiamate(fetchMock)[1][1].body)).toEqual({
      templateId: 112,
      to: [{ email: "mario@example.com" }],
    });
  });
});

describe("risolviSource", () => {
  it.each([
    ["/contatti", "contatti"],
    ["/collezioni", "collezioni"],
    ["/collezioni/[slug]", "collezioni"],
    ["/collezioni/corpi-a-incasso/[slug]", "collezioni"],
    ["/finiture", "finiture"],
    ["/chi-siamo", "chi-siamo"],
    ["/blog/[slug]", "blog"],
    ["/produzione", "produzione"],
    ["/", "home"],
    // Dal 16/10/2026 la scheda ha il modulo: prima la sua chiave dava «other».
    ["/modello/[slug]", "modello"],
    // Dal 4/11/2026 (c1b): la pagina d'uso nell'elenco, e il ripiego dal primo segmento della chiave.
    ["/doccia-da-esterno", "doccia-da-esterno"],
    ["/referenze/[slug]", "referenze"],
    ["/menzioni-legali", "menzioni-legali"],
  ])("pagina %s SENZA referer → %s", (pagina, attesa) => {
    expect(risolviSource(pagina, null)).toBe(attesa);
  });

  it.each([
    ["sconosciuta", "/pagina-inventata"],
    ["localizzata, non interna", "/de/kontakt"],
    ["chiave dell'oggetto", "constructor"],
    ["prototipo", "__proto__"],
    ["numero", 42],
    ["assente", undefined],
  ])("pagina %s → si ripiega sul referer", (_caso, pagina) => {
    expect(risolviSource(pagina, "https://fontealta.it/es/contacto")).toBe("contatti");
    expect(risolviSource(pagina, null)).toBe("unknown");
  });

  it("la pagina vince sul referer quando è valida", () => {
    expect(risolviSource("/produzione", "https://fontealta.it/contatti")).toBe("produzione");
  });
});

describe("risolviLingua", () => {
  it.each([
    ["en", "https://fontealta.it/contatti", "en"],
    ["xx", "https://fontealta.it/de/kontakt", "de"],
    [undefined, "https://fontealta.it/fr", "fr"],
    [undefined, "https://fontealta.it/collezioni", "it"],
    [undefined, null, "it"],
    [undefined, "not-a-url", "it"],
  ])("dichiarata %s, referer %s → %s", (dichiarata, referer, attesa) => {
    expect(risolviLingua(dichiarata, referer)).toBe(attesa);
  });
});

describe("deriveSource", () => {
  it.each([
    ["https://fontealta.it/collezioni", "collezioni"],
    ["https://fontealta.it/en/collections", "collezioni"],
    ["https://fontealta.it/finiture", "finiture"],
    ["https://fontealta.it/en/finishes", "finiture"],
    ["https://fontealta.it/chi-siamo", "chi-siamo"],
    ["https://fontealta.it/en/about", "chi-siamo"],
    ["https://fontealta.it/blog", "blog"],
    ["https://fontealta.it/blog/aisi-316-contro-304-parte-1", "blog"],
    ["https://fontealta.it/en/blog", "blog"],
    ["https://fontealta.it/contatti", "contatti"],
    ["https://fontealta.it/en/contact", "contatti"],
    ["https://fontealta.it/", "home"],
    ["https://fontealta.it/en", "home"],
    ["https://fontealta.it/referenze", "referenze"],
    ["https://fontealta.it/modello/b40l", "modello"],
  ])("%s → %s", (referer, expected) => {
    expect(deriveSource(referer)).toBe(expected);
  });

  /**
   * Le cinque lingue (14/10/2026). Fino al 13/10 la mappa conosceva solo i prefissi `it|en`,
   * e tutti questi casi davano «other». `produzione` è la sola source nuova.
   */
  it.each([
    ["https://fontealta.it/de/kontakt", "contatti"],
    ["https://fontealta.it/fr/contact", "contatti"],
    ["https://fontealta.it/es/contacto", "contatti"],
    ["https://fontealta.it/de/kollektionen", "collezioni"],
    ["https://fontealta.it/de/kollektionen/boss", "collezioni"],
    ["https://fontealta.it/fr/collections/twiggy", "collezioni"],
    ["https://fontealta.it/es/colecciones", "collezioni"],
    ["https://fontealta.it/de/oberflaechen", "finiture"],
    ["https://fontealta.it/fr/finitions", "finiture"],
    ["https://fontealta.it/es/acabados", "finiture"],
    ["https://fontealta.it/de/ueber-uns", "chi-siamo"],
    ["https://fontealta.it/fr/a-propos", "chi-siamo"],
    ["https://fontealta.it/es/sobre-nosotros", "chi-siamo"],
    ["https://fontealta.it/de/blog", "blog"],
    ["https://fontealta.it/fr/blog/un-post", "blog"],
    ["https://fontealta.it/produzione", "produzione"],
    ["https://fontealta.it/en/production", "produzione"],
    ["https://fontealta.it/de/produktion", "produzione"],
    ["https://fontealta.it/fr/production", "produzione"],
    ["https://fontealta.it/es/produccion", "produzione"],
    ["https://fontealta.it/de", "home"],
    ["https://fontealta.it/fr/", "home"],
    ["https://fontealta.it/es", "home"],
    ["https://fontealta.it/it", "home"],
    ["https://fontealta.it/de/referenzen", "referenze"],
    ["https://fontealta.it/es/modelo/b40l", "modello"],
    ["https://fontealta.it/fr/mentions-legales", "menzioni-legali"],
    ["https://fontealta.it/collezionismo", "other"],
  ])("%s → %s", (referer, expected) => {
    expect(deriveSource(referer)).toBe(expected);
  });

  /**
   * La scheda modello (16/10/2026): rotta DINAMICA, quindi conta il prefisso prima di `/[` e
   * solo con qualcosa dopo. Prima `/modello/b40l` non combaciava mai con `/modello/[slug]`.
   */
  it.each([
    ["https://fontealta.it/modello/b40l", "modello"],
    ["https://fontealta.it/en/model/b40l", "modello"],
    ["https://fontealta.it/de/modell/b40l", "modello"],
    ["https://fontealta.it/fr/modele/b40l", "modello"],
    ["https://fontealta.it/es/modelo/b40l", "modello"],
    ["https://fontealta.it/modello/b40l/", "modello"],
    ["https://fontealta.it/modello/b40l?x=1#progettare", "modello"],
    ["https://fontealta.it/modello", "other"],
    ["https://fontealta.it/modello/", "other"],
    ["https://fontealta.it/en/model", "other"],
    ["https://fontealta.it/modelli/b40l", "other"],
    ["https://fontealta.it/en/models/b40l", "other"],
  ])("%s → %s", (referer, expected) => {
    expect(deriveSource(referer)).toBe(expected);
  });

  /**
   * La pagina d'uso (4/11/2026, c1b): le cinque rotte localizzate danno la stessa source. Fino
   * alla c1b non era nell'elenco e il ripiego non c'era: arrivava come «other».
   */
  it.each([
    ["https://fontealta.it/doccia-da-esterno", "doccia-da-esterno"],
    ["https://fontealta.it/en/outdoor-shower", "doccia-da-esterno"],
    ["https://fontealta.it/de/gartendusche", "doccia-da-esterno"],
    ["https://fontealta.it/fr/douche-exterieure", "doccia-da-esterno"],
    ["https://fontealta.it/es/ducha-exterior/", "doccia-da-esterno"],
  ])("%s → %s", (referer, expected) => {
    expect(deriveSource(referer)).toBe(expected);
  });

  /**
   * Il ripiego (4/11/2026): una rotta di `routing.ts` che l'elenco non nomina prende il primo
   * segmento della sua chiave italiana, in ogni lingua; «other» resta per ciò che non è una rotta.
   */
  it.each([
    ["https://fontealta.it/en/projects/villa-x", "referenze"],
    ["https://fontealta.it/en/workshop", "officina"],
    ["https://fontealta.it/en/pro-area", "area-riservata"],
    // Non sono rotte del sito: una 404 e un segmento in più. Le voci dell'ELENCO invece valgono
    // anche per le sottopagine (`/blog/un-post`), come prima del 4/11.
    ["https://fontealta.it/fr/page-inexistante", "other"],
    ["https://fontealta.it/en/workshop/x", "other"],
    ["https://fontealta.it/referenze/villa-x/x", "other"],
  ])("%s → %s", (referer, expected) => {
    expect(deriveSource(referer)).toBe(expected);
  });

  it("una pagina futura prende la sua etichetta senza toccare l'elenco", () => {
    const pathnames = routing.pathnames as Record<string, string | Record<string, string>>;
    pathnames["/rubinetto-cucina"] = {
      it: "/rubinetto-cucina",
      en: "/kitchen-tap",
      de: "/kuechenarmatur",
      fr: "/robinet-cuisine",
      es: "/grifo-cocina",
    };
    try {
      expect(deriveSource("https://fontealta.it/de/kuechenarmatur")).toBe("rubinetto-cucina");
      expect(deriveSource("https://fontealta.it/rubinetto-cucina")).toBe("rubinetto-cucina");
      expect(risolviSource("/rubinetto-cucina", null)).toBe("rubinetto-cucina");
    } finally {
      delete pathnames["/rubinetto-cucina"];
    }
    expect(deriveSource("https://fontealta.it/de/kuechenarmatur")).toBe("other");
  });

  it("le source sono quelle che lo Zap conosce, più produzione, modello e doccia-da-esterno", () => {
    expect(Object.values(SOURCE_PER_ROTTA).sort()).toEqual([
      "blog",
      "chi-siamo",
      "collezioni",
      "contatti",
      "doccia-da-esterno",
      "finiture",
      "modello",
      "produzione",
    ]);
  });

  /**
   * Guardia: la tabella rotte → source legge `routing.ts`. Una rotta rinominata o tolta da
   * `pathnames` fa rosso qui (e già nel typecheck), invece di dare «other» in silenzio.
   */
  it.each(Object.keys(SOURCE_PER_ROTTA))(
    "%s esiste in routing.pathnames in tutte le lingue",
    (rotta) => {
      const voce = (routing.pathnames as Record<string, string | Record<string, string>>)[rotta];
      expect(voce, `${rotta} manca da routing.pathnames`).toBeDefined();
      expect(typeof voce === "string" ? ALL_LOCALES : Object.keys(voce).sort()).toEqual(
        [...ALL_LOCALES].sort(),
      );
    },
  );

  it("referer null → unknown", () => {
    expect(deriveSource(null)).toBe("unknown");
  });

  it("referer non parsabile → unknown", () => {
    expect(deriveSource("not-a-url")).toBe("unknown");
  });
});
