// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Il paragrafo delle schede della tavola (`.body` in `tavola/src.html`) usa i token del
 * paragrafo su chiaro del sito: `--text-body-lg` con la sua interlinea, il colore
 * `--color-fa-text-secondary` e `--font-sans` (Marco, 28/10/2026). La tavola sta in un
 * iframe, un documento a parte, e le variabili di `globals.css` non le vede: i valori
 * sono copiati, e questa prova fa rosso se le due copie divergono.
 */
const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

/** Il valore di una custom property, la prima dichiarazione del file. */
function variabile(css: string, nome: string): string {
  const m = new RegExp(`${nome.replace(/-/g, "\\-")}\\s*:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`${nome} non c'è`);
  return m[1].replace(/\/\*.*?\*\//g, "").trim();
}

/** Le dichiarazioni di una regola con quel selettore esatto, al primo livello del foglio. */
function regola(css: string, selettore: string): Record<string, string> {
  const m = new RegExp(`(?:^|[}\\n])${selettore.replace(/\./g, "\\.")}\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`la regola ${selettore} non c'è`);
  return Object.fromEntries(
    m[1].split(";").flatMap((d) => {
      const i = d.indexOf(":");
      return i < 0 ? [] : [[d.slice(0, i).trim(), d.slice(i + 1).trim()]];
    }),
  );
}

/** Una lunghezza in px: `1.125rem` → 18 (rem del sito = 16 px), `18px` → 18. */
function px(v: string): number {
  const m = /^([\d.]+)(px|rem)$/.exec(v.trim());
  if (!m) throw new Error(`lunghezza non letta: ${v}`);
  return Number(m[1]) * (m[2] === "rem" ? 16 : 1);
}

/** Un colore `rgba(…)`/`rgb(…)`/`#rrggbb` come [r, g, b, alfa]. */
function rgba(v: string): number[] {
  const hex = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
  const m = /^rgba?\(([^)]+)\)$/.exec(v.trim());
  if (!m) throw new Error(`colore non letto: ${v}`);
  const n = m[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  return n.length === 3 ? [...n, 1] : n;
}

/** Una pila di font senza virgolette né spazi superflui. */
const pila = (v: string) =>
  v
    .split(",")
    .map((f) => f.trim().replace(/^["']|["']$/g, ""))
    .join(",");

describe("tavola dell'officina · paragrafo delle schede sui token del sito", () => {
  const sito = () => read("src/app/globals.css");
  const tavola = () => {
    const html = read("tavola/src.html");
    return html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  };
  /** Un valore della tavola, risolvendo un `var(--x)` sul `:root` della tavola. */
  const risolvi = (css: string, v: string) => {
    const m = /^var\((--[\w-]+)\)$/.exec(v);
    return m ? variabile(css, m[1]) : v;
  };

  it("taglia e interlinea = --text-body-lg", () => {
    const body = regola(tavola(), ".body");
    expect(px(body["font-size"])).toBe(px(variabile(sito(), "--text-body-lg")));
    expect(Number(body["line-height"])).toBe(
      Number(variabile(sito(), "--text-body-lg--line-height")),
    );
  });

  it("colore = --color-fa-text-secondary", () => {
    const css = tavola();
    expect(rgba(risolvi(css, regola(css, ".body").color))).toEqual(
      rgba(variabile(sito(), "--color-fa-text-secondary")),
    );
  });

  it("font = --font-sans", () => {
    const css = tavola();
    const famiglia = regola(css, "body")["font-family"];
    expect(pila(risolvi(css, famiglia))).toBe(pila(variabile(sito(), "--font-sans")));
  });
});
