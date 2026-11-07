/**
 * scripts/i18n/messages-diff.ts <locale>
 *
 * Elenca le chiavi di `messages/<locale>.json` il cui valore è ancora identico
 * a `en.json`, fuori dalle ammesse: cioè **quello che resta da tradurre**.
 *
 * ⚠️ Le ammesse vengono da `src/messages/allowed-identical.ts`, lo stesso modulo che usa
 * il cancello di `parita.test.ts`: le 44 comuni **più le eccezioni della lingua**, ognuna
 * con la sua ragione. Fino al 14/09/2026 la lista si estraeva tagliando il testo del file
 * di test, e in francese «Collections» o «Production» risultavano «da tradurre» pur
 * essendo la parola giusta.
 *
 * Uso:  pnpm i18n:diff de
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ALLOWED_IDENTICAL,
  ALLOWED_IDENTICAL_BY_LOCALE,
  allowedIdenticalFor,
} from "../../src/messages/allowed-identical";

import { daTradurre, foglieMessaggi, LINGUE } from "./lib";

// Il valore viene da `LINGUE`, non da `argv`: fuori dall'elenco resta `undefined`.
const lingua = LINGUE.find((l) => l === process.argv[2]);
if (!lingua) {
  console.error(`✖ Uso: pnpm i18n:diff <${LINGUE.join("|")}>`);
  process.exit(1);
}

const leggi = (f: string) =>
  JSON.parse(readFileSync(join(process.cwd(), "src", "messages", f), "utf-8")) as unknown;

const en = leggi("en.json");
const altra = leggi(`${lingua}.json`);
const eccezioni = Object.keys(ALLOWED_IDENTICAL_BY_LOCALE[lingua] ?? {}).length;
const elenco = daTradurre(en, altra, allowedIdenticalFor(lingua));
const totale = foglieMessaggi(altra).size;

console.log(
  `\n  ${lingua}.json · ${elenco.length} chiavi da tradurre su ${totale} · ammesse identiche: ${ALLOWED_IDENTICAL.size} comuni + ${eccezioni} della lingua`,
);
if (elenco.length === 0) {
  console.log("  Niente da fare: la lingua è intera.\n");
} else {
  const perNamespace = new Map<string, number>();
  for (const k of elenco) {
    const ns = k.split(".")[0];
    perNamespace.set(ns, (perNamespace.get(ns) ?? 0) + 1);
  }
  for (const [ns, n] of [...perNamespace].sort((a, b) => b[1] - a[1]))
    console.log(`    ${ns.padEnd(20)} ${n}`);
  console.log("");
  for (const k of elenco) console.log(`  ${k}`);
  console.log("");
}
