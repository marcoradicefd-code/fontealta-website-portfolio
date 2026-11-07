// @vitest-environment node
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALES, routing } from "@/i18n/routing";

/**
 * La tavola dell'officina servita dal sito, `public/officina-tavola/`, la scrive
 * `tavola/build/tools/build-web.js` (spec `docs/specs/tavola-officina.md`). Qui si
 * controlla che l'output sia quello del sorgente di oggi: un sorgente cambiato senza
 * ricostruire, o un'uscita ritoccata a mano, fanno rosso.
 */
const ROOT = process.cwd();
const OUT = "public/officina-tavola";

const read = (file: string) => readFileSync(path.join(ROOT, file));
const sha256 = (file: string) => createHash("sha256").update(read(file)).digest("hex");

type Manifest = { voce: string; sorgenti: Record<string, string>; uscite: Record<string, string> };
const manifest = () => JSON.parse(read(`${OUT}/manifest.json`).toString("utf8")) as Manifest;
const page = () => read(`${OUT}/index.html`).toString("utf8");

/** Tutti i file sotto una cartella, coi percorsi relativi a lei. */
function files(dir: string, base = dir): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(path.join(dir, e.name), base)
      : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")],
  );
}

describe("tavola dell'officina · manifest", () => {
  it("le impronte dei sorgenti sono quelle di oggi: si ricostruisce dopo ogni modifica", () => {
    for (const [file, hash] of Object.entries(manifest().sorgenti))
      expect(sha256(file), file).toBe(hash);
  });

  it("nel manifest ci sono src.html, la voce, lo script e ogni lingua", () => {
    const sources = Object.keys(manifest().sorgenti);
    const languages = files("tavola/i18n").map((f) => `tavola/i18n/${f}`);
    expect(sources).toEqual(
      expect.arrayContaining([
        "tavola/src.html",
        "tavola/voce.mp3",
        "tavola/build/tools/build-web.js",
        ...languages,
      ]),
    );
  });

  it("le uscite sono tutte e sole quelle del manifest, e nessuna è ritoccata a mano", () => {
    const { uscite } = manifest();
    expect(
      files(OUT)
        .filter((f) => f !== "manifest.json")
        .sort(),
    ).toEqual(Object.keys(uscite).sort());
    for (const [file, hash] of Object.entries(uscite))
      expect(sha256(`${OUT}/${file}`), file).toBe(hash);
  });
});

describe("tavola dell'officina · voce su R2", () => {
  it("indirizzo su media.fontealta.it/tavola/ con l'impronta della voce sorgente", () => {
    const { voce } = manifest();
    expect(voce).toMatch(/^https:\/\/media\.fontealta\.it\/tavola\/voce-it-[0-9a-f]{8}\.mp3$/);
    expect(voce).toContain(`voce-it-${sha256("tavola/voce.mp3").slice(0, 8)}.mp3`);
  });

  it("la pagina chiede quella voce e non incorpora né la voce né i font di Google", () => {
    const html = page();
    expect(html).toContain(`data-src="${manifest().voce}"`);
    expect(html).not.toContain('id="voce-data"');
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });
});

describe("tavola dell'officina · QR verso /produzione", () => {
  it("in ogni lingua la pagina del QR è /produzione di routing.ts", () => {
    const block = page().match(/\/\*I18N\*\/([\s\S]*?)\/\*\/I18N\*\//)?.[1];
    expect(block).toBeTruthy();
    const languages = JSON.parse(block!) as Record<string, { lingua: { pagina: string } }>;
    expect(Object.keys(languages).sort()).toEqual([...ACTIVE_LOCALES].sort());
    for (const locale of ACTIVE_LOCALES) {
      const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
      const expected = `https://fontealta.it${prefix}${routing.pathnames["/produzione"][locale]}`;
      expect(languages[locale].lingua.pagina, locale).toBe(expected);
    }
  });
});

describe("tavola dell'officina · eventi verso il sito", () => {
  it("manda solo i tre eventi suoi, e solo alla stessa origine", () => {
    const html = page();
    const names = [...html.matchAll(/ev\('(officina_\w+)'/g)].map((m) => m[1]);
    expect([...new Set(names)].sort()).toEqual([
      "officina_giro",
      "officina_reparto",
      "officina_voce",
    ]);
    const sends = [...html.matchAll(/postMessage\(([^)]*)\)/g)].map((m) => m[1]);
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatch(/,location\.origin$/);
  });
});
