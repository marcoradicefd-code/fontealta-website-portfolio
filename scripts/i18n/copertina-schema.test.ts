// @vitest-environment node
import { describe, expect, it } from "vitest";

import { schemaTypes } from "../../sanity/schemas";

import { ALT_MINIMO, copertinaNuova } from "./articolo-md";

/**
 * La copertina che `pnpm post:carica` scrive su un post nuovo, contro lo schema vero (6/11/2026). Fino
 * a questa guardia il caricatore la creava `_type: "image"` senza `alt`, e T1 e T2 nascevano con un
 * errore di validazione in Studio che nessun test vedeva: il sito legge `altI18n` per primo e a video
 * non cambiava niente.
 *
 * ⚠️ **Ambiente `node`, non jsdom**: il pacchetto `sanity` legge `CSS.supports` all'import, e in
 * jsdom il file morirebbe in raccolta con «0 test» (come `tipi.test.ts`).
 */

type Campo = {
  name: string;
  type: string;
  fields?: Campo[];
  validation?: (r: unknown) => unknown;
};
const tipi = schemaTypes as unknown as Campo[];
const tipo = (nome: string) => tipi.find((t) => t.name === nome);

describe("post:carica: la copertina di un post nuovo segue lo schema", () => {
  const copertina = copertinaNuova(
    "image-cccc-3840x2160-jpg",
    "Colonna doccia in acciaio a bordo piscina",
  );

  it("ha il tipo del campo coverImage di post", () => {
    const campo = tipo("post")?.fields?.find((f) => f.name === "coverImage");
    expect(campo?.type).toBeDefined();
    expect(copertina._type).toBe(campo!.type);
  });

  it("porta solo campi che il suo tipo conosce, e l'alt obbligatorio", () => {
    const t = tipo(copertina._type);
    const campi = new Set((t?.fields ?? []).map((f) => f.name));
    expect(campi.has("alt")).toBe(true);
    for (const k of Object.keys(copertina).filter((k) => !["_type", "asset"].includes(k)))
      expect(campi, `campo «${k}»`).toContain(k);
    expect(copertina.alt.length).toBeGreaterThanOrEqual(ALT_MINIMO);
  });

  it("altI18n ha il tipo del campo dello schema", () => {
    const campo = tipo(copertina._type)?.fields?.find((f) => f.name === "altI18n");
    expect(copertina.altI18n._type).toBe(campo?.type);
  });
});
