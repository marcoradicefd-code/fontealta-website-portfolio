import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseWorkshopEvent } from "@/lib/workshop-events";

const ORIGINE = "https://fontealta.it";
const msg = (data: unknown, origin = ORIGINE) => ({ origin, data });
const tavola = (nome: string, dati: unknown) => ({ tipo: "fa-officina", nome, dati });

describe("parseWorkshopEvent", () => {
  it("accetta i tre eventi della tavola, con le sole proprietà attese", () => {
    expect(parseWorkshopEvent(msg(tavola("officina_voce", { lingua: "de" })), ORIGINE)).toEqual({
      name: "officina_voce",
      props: { lingua: "de" },
    });
    expect(
      parseWorkshopEvent(msg(tavola("officina_giro", { lingua: "it", voce: false })), ORIGINE),
    ).toEqual({ name: "officina_giro", props: { lingua: "it", voce: false } });
    expect(parseWorkshopEvent(msg(tavola("officina_reparto", { reparto: 12 })), ORIGINE)).toEqual({
      name: "officina_reparto",
      props: { reparto: 12 },
    });
  });

  it("un'altra origine non passa, nemmeno con un messaggio perfetto", () => {
    const buono = tavola("officina_voce", { lingua: "it" });
    expect(parseWorkshopEvent(msg(buono, "https://evil.example"), ORIGINE)).toBeNull();
    expect(parseWorkshopEvent(msg(buono, "null"), ORIGINE)).toBeNull();
  });

  it("l'elenco è chiuso: un nome fuori elenco o un tipo diverso si ignorano", () => {
    expect(parseWorkshopEvent(msg(tavola("officina_apri", { lingua: "it" })), ORIGINE)).toBeNull();
    expect(parseWorkshopEvent(msg(tavola("pageview", {})), ORIGINE)).toBeNull();
    expect(
      parseWorkshopEvent(
        msg({ tipo: "altro", nome: "officina_voce", dati: { lingua: "it" } }),
        ORIGINE,
      ),
    ).toBeNull();
    for (const data of [null, undefined, "officina_voce", 42, []]) {
      expect(parseWorkshopEvent(msg(data), ORIGINE)).toBeNull();
    }
  });

  it("dati del tipo sbagliato o fuori dominio si ignorano", () => {
    expect(parseWorkshopEvent(msg(tavola("officina_voce", { lingua: "xx" })), ORIGINE)).toBeNull();
    expect(parseWorkshopEvent(msg(tavola("officina_voce", null)), ORIGINE)).toBeNull();
    expect(
      parseWorkshopEvent(msg(tavola("officina_giro", { lingua: "it", voce: "sì" })), ORIGINE),
    ).toBeNull();
    for (const reparto of [0, 13, 1.5, "3", Number.NaN]) {
      expect(parseWorkshopEvent(msg(tavola("officina_reparto", { reparto })), ORIGINE)).toBeNull();
    }
  });

  it("le chiavi in più nei dati non diventano proprietà", () => {
    const e = parseWorkshopEvent(
      msg(tavola("officina_voce", { lingua: "fr", email: "x@y.z", __proto__: { a: 1 } })),
      ORIGINE,
    );
    expect(e).toEqual({ name: "officina_voce", props: { lingua: "fr" } });
  });

  it("i nomi accettati sono esattamente quelli che la tavola manda", () => {
    // La lettura del file sta dentro l'`it`: in raccolta un errore farebbe sparire il file
    // con «0 test» (rule `misure-e-test`).
    const html = readFileSync(join(process.cwd(), "public/officina-tavola/index.html"), "utf8");
    const nomi = [...new Set([...html.matchAll(/ev\('(officina_\w+)'/g)].map((m) => m[1]))].sort();
    expect(nomi).toEqual(["officina_giro", "officina_reparto", "officina_voce"]);
    const datiDi = {
      officina_giro: { lingua: "it", voce: true },
      officina_reparto: { reparto: 1 },
      officina_voce: { lingua: "it" },
    };
    for (const nome of nomi) {
      expect(
        parseWorkshopEvent(msg(tavola(nome, datiDi[nome as keyof typeof datiDi])), ORIGINE)?.name,
      ).toBe(nome);
    }
  });
});
