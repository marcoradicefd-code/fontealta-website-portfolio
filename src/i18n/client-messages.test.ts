import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CLIENT_NAMESPACES, pickClientMessages } from "./client-messages";

/**
 * La guardia dell'elenco dei namespace passati al browser.
 *
 * ⚠️ Non basta guardare i file con `"use client"`: un componente senza il direttivo,
 * importato da uno che ce l'ha, viene compilato come client lo stesso. `model-card.tsx`
 * è esattamente questo caso, e usa due namespace che l'elenco «dei file con il direttivo»
 * non conterrebbe. Quindi qui si ricostruisce la **chiusura transitiva degli import** e si
 * cercano i `useTranslations("…")` dentro tutta quella chiusura.
 *
 * ⚠️ Le letture di file stanno DENTRO le funzioni chiamate dagli `it`, e i percorsi si
 * risolvono da `process.cwd()`: una lettura nel corpo di un `describe`, o un
 * `new URL(..., import.meta.url)`, fa morire il file in raccolta e il rosso diventa
 * «0 test», che è la firma peggiore perché somiglia al verde.
 */

const SRC = path.join(process.cwd(), "src");
const ESTENSIONI = [".ts", ".tsx"];

function fileSorgente(): string[] {
  const out: string[] = [];
  const giu = (dir: string) => {
    for (const voce of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, voce.name);
      if (voce.isDirectory()) giu(p);
      else if (ESTENSIONI.includes(path.extname(p)) && !p.includes(".test.")) out.push(p);
    }
  };
  giu(SRC);
  return out;
}

function risolvi(da: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(da), spec)
      : null;
  if (!base) return null;
  for (const cand of [
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/** I file che finiscono nel bundle del browser: quelli con il direttivo, più ciò che importano. */
function chiusuraClient(): string[] {
  const file = fileSorgente();
  const testo = new Map(file.map((f) => [f, readFileSync(f, "utf8")]));
  const importati = (f: string) =>
    [...(testo.get(f) ?? "").matchAll(/from\s+["']([^"']+)["']/g)]
      .map((m) => risolvi(f, m[1]))
      .filter((x): x is string => x !== null);

  const dentro = new Set(file.filter((f) => /^\s*["']use client["']/m.test(testo.get(f) ?? "")));
  const coda = [...dentro];
  while (coda.length) {
    for (const q of importati(coda.pop()!)) {
      if (!dentro.has(q)) {
        dentro.add(q);
        coda.push(q);
      }
    }
  }
  return [...dentro];
}

/** I namespace radice usati nella chiusura, con il file che li usa. */
function namespaceDelClient(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of chiusuraClient()) {
    const t = readFileSync(f, "utf8");
    for (const m of t.matchAll(/useTranslations\(\s*["']([^"']+)["']/g)) {
      const radice = m[1].split(".")[0];
      out.set(radice, [...(out.get(radice) ?? []), path.relative(process.cwd(), f)]);
    }
  }
  return out;
}

describe("i messaggi passati al browser", () => {
  it("copre ogni namespace usato nella chiusura client, compresi i file senza direttivo", () => {
    const usati = namespaceDelClient();
    const mancanti = [...usati.entries()]
      .filter(([ns]) => !(CLIENT_NAMESPACES as readonly string[]).includes(ns))
      .map(([ns, dove]) => `${ns} (${dove.join(", ")})`);
    expect(mancanti).toEqual([]);
  });

  it("non elenca namespace che nessun componente client usa più", () => {
    const usati = new Set(namespaceDelClient().keys());
    const inutili = CLIENT_NAMESPACES.filter((ns) => !usati.has(ns));
    expect(inutili).toEqual([]);
  });

  it("trova davvero i componenti client per IMPORTAZIONE, non solo quelli col direttivo", () => {
    // Controprova del metodo: model-card non ha "use client" e deve comunque comparire.
    const chiusura = chiusuraClient().map((f) => path.relative(process.cwd(), f));
    const card = "src/components/cards/model-card.tsx";
    expect(readFileSync(path.join(process.cwd(), card), "utf8")).not.toMatch(
      /^\s*["']use client["']/m,
    );
    expect(chiusura).toContain(card);
  });

  it("il setaccio tiene i namespace elencati e butta gli altri", () => {
    const dizionario = { home: { a: 1 }, legale: { b: 2 }, nav: { c: 3 } };
    expect(pickClientMessages(dizionario)).toEqual({ home: { a: 1 }, nav: { c: 3 } });
  });

  it("un namespace assente dal dizionario viene saltato, non inventato", () => {
    expect(pickClientMessages({ home: { a: 1 } })).toEqual({ home: { a: 1 } });
  });
});
