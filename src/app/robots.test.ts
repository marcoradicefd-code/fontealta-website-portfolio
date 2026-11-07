import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ⚠️ **I due casi non si provano con due build, si provano cambiando l'ambiente.**
 * `robots()` è una funzione pura di `VERCEL_ENV` (il cancello) e di
 * `NEXT_PUBLIC_SITE_URL` (la base della sitemap), e costruire il sito due volte per
 * leggere un file di testo costerebbe minuti per dire quello che una `vi.stubEnv`
 * dice in millisecondi.
 *
 * ⚠️ **La variabile del sito vale `https://fontealta.it/` in TUTTI i casi**, slash
 * finale compreso, perché è così che sta su Vercel: una sola, per Production e
 * Preview. È proprio la condizione in cui il cancello di prima (la variabile)
 * apriva anche le anteprime; qui l'unica cosa che cambia da un caso all'altro è
 * l'ambiente.
 */
const CITAZIONE = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot"];
const ADDESTRAMENTO = ["GPTBot", "Google-Extended", "CCBot", "Applebot-Extended", "anthropic-ai"];
const SITO_SU_VERCEL = "https://fontealta.it/";

async function robots(ambiente: string | undefined) {
  vi.stubEnv("VERCEL_ENV", ambiente);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITO_SU_VERCEL);
  vi.resetModules();
  const mod = await import("./robots");
  return mod.default();
}

const regole = (r: Awaited<ReturnType<typeof robots>>) =>
  (Array.isArray(r.rules) ? r.rules : [r.rules]) as Array<{
    userAgent?: string | string[];
    allow?: string | string[];
    disallow?: string | string[];
  }>;

afterEach(() => vi.unstubAllEnvs());

// `preview` è l'anteprima di Vercel, `development` è `vercel dev`, `undefined` è il
// build locale: in nessuno dei tre il deploy è quello pubblico.
describe.each(["preview", "development", undefined])(
  "robots · VERCEL_ENV = %s: nessuno entra",
  (ambiente) => {
    it("`*` è disallow, e non c'è nessuna regola per nome", async () => {
      const r = regole(await robots(ambiente));
      expect(r).toHaveLength(1);
      expect(r[0].userAgent).toBe("*");
      expect(r[0].disallow).toBe("/");
      expect(r[0].allow).toBeUndefined();
    });

    it("nessun crawler AI è nominato: sarebbe un «sì» sotto un divieto", async () => {
      const r = regole(await robots(ambiente));
      const nomi = r.map((x) => x.userAgent);
      for (const bot of [...CITAZIONE, ...ADDESTRAMENTO]) expect(nomi).not.toContain(bot);
    });

    it("niente riga `Sitemap:` sotto un disallow, e niente `Host:`", async () => {
      const r = await robots(ambiente);
      expect(r.sitemap).toBeUndefined();
      expect(r.host).toBeUndefined();
    });
  },
);

describe("robots · VERCEL_ENV = production: aperto, variante A", () => {
  it("`*` è allow e la sitemap è quella del dominio, senza doppio slash", async () => {
    const r = await robots("production");
    const [primo] = regole(r);
    expect(primo.userAgent).toBe("*");
    expect(primo.allow).toBe("/");
    expect(primo.disallow).toBeUndefined();
    expect(r.sitemap).toBe("https://fontealta.it/sitemap.xml");
  });

  it("niente riga `Host:`", async () => {
    expect((await robots("production")).host).toBeUndefined();
  });

  it("tutti e nove i crawler sono nominati, uno per riga", async () => {
    const r = regole(await robots("production"));
    const nomi = r.map((x) => x.userAgent);
    for (const bot of [...CITAZIONE, ...ADDESTRAMENTO]) expect(nomi).toContain(bot);
    // `*` più i nove: nessuna riga in più, nessun doppione.
    expect(r).toHaveLength(1 + CITAZIONE.length + ADDESTRAMENTO.length);
    expect(new Set(nomi).size).toBe(nomi.length);
  });

  it("nella variante attiva TUTTI hanno allow, addestramento compreso", async () => {
    const r = regole(await robots("production"));
    for (const bot of [...CITAZIONE, ...ADDESTRAMENTO]) {
      const regola = r.find((x) => x.userAgent === bot);
      expect(regola?.allow, `${bot} dovrebbe essere allow`).toBe("/");
      expect(regola?.disallow, `${bot} non deve avere disallow`).toBeUndefined();
    }
  });
});

describe("robots · il cancello è l'ambiente, non la variabile", () => {
  it("con la stessa variabile, anteprima chiusa e produzione aperta", async () => {
    const anteprima = regole(await robots("preview"))[0];
    const produzione = regole(await robots("production"))[0];
    expect(anteprima.disallow).toBe("/");
    expect(produzione.allow).toBe("/");
  });
});

/**
 * ⚠️ **La variante B si prova leggendo il sorgente, non eseguendolo.** È dietro
 * una costante letterale: TypeScript restringe il tipo e il ramo `disallow`
 * diventa irraggiungibile per il compilatore, quindi da un test non lo si può
 * far girare senza riscrivere il modulo. Quello che si può custodire è che il
 * ramo **esista** e che i due elenchi siano quelli decisi: il giorno che Marco
 * gira la parola, il comportamento è già scritto e questi test lo descrivono.
 */
/**
 * ⚠️ **Il percorso si risolve da `process.cwd()`, non da `import.meta.url`.**
 * L'ambiente è jsdom, dove `import.meta.url` è un URL `http://` e la lettura
 * risponde «no such file or directory, open '/src/app/robots.ts'». È il quarto
 * modo di far sparire un file di test con «0 test», già a registro: la lettura
 * sta dentro una funzione chiamata dagli `it`, non nel corpo del `describe`.
 */
const sorgente = () => readFileSync(resolve(process.cwd(), "src/app/robots.ts"), "utf-8");

describe("robots · la variante B è pronta e dichiarata", () => {
  it("la leva è una costante sola, con i due valori", async () => {
    const src = sorgente();
    expect(src).toContain('const POLITICA_AI: "tutti" | "citazione"');
    expect(src).toContain('POLITICA_AI === "tutti"');
    expect(src).toContain('{ userAgent, disallow: "/" }');
  });

  it("i due elenchi sono quelli decisi, e non si sovrappongono", async () => {
    const src = sorgente();
    for (const bot of CITAZIONE) expect(src).toContain(`"${bot}"`);
    for (const bot of ADDESTRAMENTO) expect(src).toContain(`"${bot}"`);
    expect(CITAZIONE.filter((b) => ADDESTRAMENTO.includes(b))).toEqual([]);
  });
});
