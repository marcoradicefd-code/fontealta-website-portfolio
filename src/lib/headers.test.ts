import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Gli header di risposta, provati sulla funzione e non su due build.
 *
 * ⚠️ **`headers()` è una funzione pura di `VERCEL_ENV`**, come `robots()`:
 * costruire il sito due volte per leggere quattro stringhe costerebbe minuti. Il
 * servito si guarda a parte, con un server, perché è un'altra domanda: «arrivano
 * davvero al browser?».
 *
 * ⚠️ **La variabile del sito vale `https://fontealta.it/` in TUTTI i casi**, com'è
 * su Vercel per Production e Preview insieme: cambia solo l'ambiente. Col cancello
 * di prima, sulla variabile, un'anteprima risultava senza il NOSTRO `noindex`
 * (quello che Vercel aggiunge da sé alle anteprime c'è comunque, tranne quando a
 * un ramo è assegnato un dominio: è il caso che questa riga copre).
 */
const COMUNI = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

async function intestazioni(ambiente: string | undefined) {
  vi.stubEnv("VERCEL_ENV", ambiente);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fontealta.it/");
  vi.resetModules();
  const config = (await import("../../next.config")).default as {
    headers: () => Promise<
      Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    >;
  };
  const regole = await config.headers();
  const comeMappa = (i: number) =>
    Object.fromEntries((regole[i]?.headers ?? []).map((h) => [h.key, h.value]));
  return { config, regole, mappa: comeMappa(0), csp: comeMappa(1) };
}

/** La policy in forma «direttiva → sorgenti», per asserire una direttiva alla volta. */
function direttive(politica: string) {
  return Object.fromEntries(
    politica.split(";").map((d) => {
      const [nome, ...sorgenti] = d.trim().split(/\s+/);
      return [nome, sorgenti];
    }),
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("header · i quattro comuni valgono in ogni ambiente", () => {
  it.each(["production", "preview", undefined])(
    "con VERCEL_ENV = %s ci sono tutti e quattro i comuni",
    async (ambiente) => {
      const { mappa } = await intestazioni(ambiente);
      for (const [k, v] of Object.entries(COMUNI)) expect(mappa[k], k).toBe(v);
    },
  );

  it("tre regole: i comuni su tutti i percorsi, la CSP a parte, il noindex della tavola", async () => {
    const { regole } = await intestazioni("production");
    expect(regole).toHaveLength(3);
    expect(regole[0].source).toBe("/:path*");
    expect(regole[0].headers.map((h) => h.key)).not.toContain(
      "Content-Security-Policy-Report-Only",
    );
  });
});

describe("header · la CSP in Report-Only", () => {
  it("c'è in Report-Only e NON in forma che blocca, in ogni ambiente", async () => {
    for (const ambiente of ["production", "preview", undefined]) {
      const { mappa, csp } = await intestazioni(ambiente);
      expect(csp["Content-Security-Policy-Report-Only"], String(ambiente)).toBeTruthy();
      expect(csp["Content-Security-Policy"]).toBeUndefined();
      expect(mappa["Content-Security-Policy"]).toBeUndefined();
    }
  });

  it("in produzione, le direttive dell'inventario del 15/10 e niente altro", async () => {
    const { csp } = await intestazioni("production");
    expect(direttive(csp["Content-Security-Policy-Report-Only"])).toEqual({
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https://cdn.sanity.io", "https://images.unsplash.com"],
      "media-src": ["'self'", "https://media.fontealta.it"],
      "font-src": ["'self'"],
      "connect-src": ["'self'"],
      "frame-src": ["'self'", "https://www.google.com"],
      "frame-ancestors": ["'self'"],
      "form-action": ["'self'"],
      "base-uri": ["'self'"],
      "object-src": ["'none'"],
      "report-uri": ["/api/csp-report"],
      "report-to": ["csp-endpoint"],
    });
  });

  it("`upgrade-insecure-requests` e `'unsafe-eval'` NON ci sono: il primo arriva con la policy che blocca", async () => {
    const { csp } = await intestazioni("production");
    expect(csp["Content-Security-Policy-Report-Only"]).not.toContain("upgrade-insecure-requests");
    expect(csp["Content-Security-Policy-Report-Only"]).not.toContain("unsafe-eval");
  });

  it("l'endpoint dei rapporti è dichiarato col nome usato da report-to", async () => {
    const { csp } = await intestazioni("production");
    expect(csp["Reporting-Endpoints"]).toBe('csp-endpoint="/api/csp-report"');
  });

  it("la toolbar di Vercel solo fuori dalla produzione, stesso cancello di X-Robots-Tag", async () => {
    const prod = (await intestazioni("production")).csp["Content-Security-Policy-Report-Only"];
    expect(prod).not.toContain("vercel.live");
    for (const ambiente of ["preview", "development", undefined]) {
      const d = direttive(
        (await intestazioni(ambiente)).csp["Content-Security-Policy-Report-Only"],
      );
      expect(d["script-src"]).toContain("https://vercel.live");
      expect(d["connect-src"]).toEqual(
        expect.arrayContaining(["https://vercel.live", "wss://ws-us3.pusher.com"]),
      );
      expect(d["frame-src"]).toContain("https://vercel.live");
      expect(d["font-src"]).toEqual(
        expect.arrayContaining(["https://vercel.live", "https://assets.vercel.com"]),
      );
    }
  });

  /**
   * ⚠️ Il `source` si prova con la funzione con cui il build lo compila
   * (`buildCustomRoute`), non leggendo la stringa: la domanda è quali percorsi
   * prendono l'header, e la risposta la dà solo la regex vera.
   */
  it("lo Studio resta fuori; tutto il resto, `/studiox` compreso, la prende", async () => {
    const { regole } = await intestazioni("production");
    const { buildCustomRoute } = await import("next/dist/lib/build-custom-route");
    const { regex } = buildCustomRoute("header", regole[1]) as { regex: string };
    const prende = (p: string) => new RegExp(regex).test(p);
    for (const p of ["/", "/en", "/en/about", "/collezioni/boss", "/api/csp-report", "/studiox"])
      expect(prende(p), p).toBe(true);
    for (const p of ["/studio", "/studio/", "/studio/structure", "/studio/structure/model"])
      expect(prende(p), p).toBe(false);
  });

  it("`x-powered-by` spento", async () => {
    const { config } = await intestazioni("production");
    expect((config as unknown as { poweredByHeader?: boolean }).poweredByHeader).toBe(false);
  });
});

describe("header · X-Robots-Tag segue il cancello dell'ambiente", () => {
  it("VERCEL_ENV = production: NON c'è", async () => {
    const { mappa } = await intestazioni("production");
    expect(mappa["X-Robots-Tag"]).toBeUndefined();
  });

  // `preview` è l'anteprima di Vercel, `development` è `vercel dev`, `undefined` è il
  // build locale.
  it.each(["preview", "development", undefined])(
    "VERCEL_ENV = %s: c'è, e vale noindex",
    async (ambiente) => {
      const { mappa } = await intestazioni(ambiente);
      expect(mappa["X-Robots-Tag"]).toBe("noindex");
    },
  );

  it("con la stessa variabile del sito, anteprima noindex e produzione senza", async () => {
    expect((await intestazioni("preview")).mappa["X-Robots-Tag"]).toBe("noindex");
    expect((await intestazioni("production")).mappa["X-Robots-Tag"]).toBeUndefined();
  });

  // La tavola dell'officina è noindex in OGNI ambiente: sta dentro l'iframe di /officina.
  it.each(["production", "preview", undefined])(
    "VERCEL_ENV = %s: /officina-tavola/… è noindex, e solo quel percorso",
    async (ambiente) => {
      const { regole } = await intestazioni(ambiente);
      const tavola = regole.find((r) => r.source === "/officina-tavola/:path*");
      expect(tavola?.headers).toEqual([{ key: "X-Robots-Tag", value: "noindex" }]);
      // oltre alla regola comune (che lo porta solo fuori dalla produzione), nessun altro percorso
      const conNoindex = regole
        .slice(1)
        .filter((r) => r.headers.some((h) => h.key === "X-Robots-Tag"));
      expect(conNoindex.map((r) => r.source)).toEqual(["/officina-tavola/:path*"]);
    },
  );
});

describe("header · le cose che NON devono esserci", () => {
  it("nessun HSTS scritto da noi: lo mette Vercel", async () => {
    const { mappa } = await intestazioni("production");
    expect(mappa["Strict-Transport-Security"]).toBeUndefined();
  });

  /**
   * ⚠️ La riga che protegge il video dell'hero. `hero-media-bg.tsx` è
   * `autoPlay muted loop playsInline`: una direttiva `autoplay=()` lo
   * fermerebbe, e il difetto si vedrebbe solo aprendo la home.
   */
  it("`Permissions-Policy` NON nomina autoplay, fullscreen o picture-in-picture", async () => {
    const { mappa } = await intestazioni("production");
    const pp = mappa["Permissions-Policy"];
    expect(pp).not.toContain("autoplay");
    expect(pp).not.toContain("fullscreen");
    expect(pp).not.toContain("picture-in-picture");
  });

  it("`X-Frame-Options` NON è DENY: lo Studio incornicia il sito", async () => {
    const { mappa } = await intestazioni("production");
    expect(mappa["X-Frame-Options"]).not.toBe("DENY");
  });
});
