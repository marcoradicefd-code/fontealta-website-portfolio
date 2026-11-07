// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ALL_LOCALES } from "../../src/i18n/routing";
import { schemaTypes } from "../../sanity/schemas";

import { LOCALIZED_DOCUMENT_TYPES } from "./tipi";

/**
 * L'elenco dei tipi esportati per la traduzione contro lo schema vero.
 *
 * ⚠️ **Ambiente `node`, non jsdom**: il pacchetto `sanity` legge `CSS.supports` all'import, e in
 * jsdom il file moriva in raccolta con «0 test» invece che rosso.
 *
 * ⚠️ **Il localizzato si riconosce dalla FORMA, non dal nome.** Un tipo oggetto è una stringa
 * localizzata se i suoi campi sono tutti codici di lingua (`localizedString`, `localizedText`,
 * `localizedPortableText` e le varianti facoltative). Un tipo che li **contiene**, anche dentro un
 * oggetto (`seoFields`) o un array, è localizzato a sua volta: si ricava per punto fisso, così un
 * oggetto nuovo annidato non sfugge.
 */

type Campo = { name?: string; type?: string; fields?: Campo[]; of?: Campo[] };
type Tipo = Campo & { name: string };

const tipi = schemaTypes as unknown as Tipo[];
const perNome = new Map(tipi.map((t) => [t.name, t]));
const lingue = new Set<string>(ALL_LOCALES);

function localizzatiPrimitivi(): Set<string> {
  return new Set(
    tipi
      .filter((t) => t.type === "object" && (t.fields ?? []).length > 0)
      .filter((t) => (t.fields ?? []).every((f) => lingue.has(String(f.name))))
      .map((t) => t.name),
  );
}

/** Vero se nei campi, a qualunque profondità, compare un tipo dell'insieme. */
function contiene(campi: Campo[] | undefined, insieme: Set<string>): boolean {
  return (campi ?? []).some(
    (c) =>
      (c.type !== undefined && insieme.has(c.type)) ||
      contiene(c.fields, insieme) ||
      contiene(c.of, insieme),
  );
}

function tipiDiDocumentoLocalizzati(): string[] {
  const localizzati = localizzatiPrimitivi();
  // Punto fisso: gli oggetti che contengono localizzati diventano localizzati a loro volta.
  for (let cambiato = true; cambiato;) {
    cambiato = false;
    for (const t of tipi) {
      if (t.type === "object" && !localizzati.has(t.name) && contiene(t.fields, localizzati)) {
        localizzati.add(t.name);
        cambiato = true;
      }
    }
  }
  return tipi
    .filter((t) => t.type === "document" && contiene(t.fields, localizzati))
    .map((t) => t.name)
    .sort();
}

describe("tipi localizzati: schema contro export", () => {
  it("riconosce i tipi localizzati primitivi, e non sono pochi per sbaglio", () => {
    // La controprova della sonda: se la forma cambiasse e non riconoscesse più niente, il
    // confronto sotto passerebbe su due insiemi vuoti.
    const primitivi = localizzatiPrimitivi();
    expect(primitivi.has("localizedString")).toBe(true);
    expect(primitivi.has("localizedText")).toBe(true);
    expect(primitivi.size).toBeGreaterThanOrEqual(5);
  });

  it("export-content esporta esattamente i tipi di documento con campi localizzati", () => {
    expect(tipiDiDocumentoLocalizzati()).toEqual([...LOCALIZED_DOCUMENT_TYPES].sort());
  });

  it("l’elenco non ha tipi che lo schema non conosce", () => {
    for (const nome of LOCALIZED_DOCUMENT_TYPES) expect(perNome.has(nome), nome).toBe(true);
  });
});
