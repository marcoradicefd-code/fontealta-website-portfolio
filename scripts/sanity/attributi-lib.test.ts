// @vitest-environment node
import { describe, expect, it } from "vitest";

import { attributi, unione } from "./attributi-lib";

describe("il conteggio degli attributi", () => {
  it("una coppia percorso + tipo per nodo, con gli indici degli array tolti", () => {
    const doc = {
      _id: "a",
      faq: { it: [{ question: "Uno?" }, { question: "Due?", keyword: "k" }] },
    };
    expect([...attributi(doc)].sort()).toEqual([
      "_id|string",
      "faq.it[].keyword|string",
      "faq.it[].question|string",
      "faq.it[]|object",
      "faq.it|array",
      "faq|object",
    ]);
  });

  it("lo stesso campo con due tipi conta due volte, lo stesso tipo in due documenti una", () => {
    expect(unione([{ x: "a" }, { x: 1 }, { x: "b" }])).toBe(2);
  });
});
