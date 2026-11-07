// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * graphify legge `.graphifyignore` AL POSTO di `.gitignore`, non in aggiunta (`_load_graphifyignore`
 * in `detect.py` di graphify): una riga aggiunta solo a `.gitignore` rimetterebbe quei file nel grafo.
 */
function lines(file: string) {
  return readFileSync(path.resolve(process.cwd(), file), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

describe(".graphifyignore", () => {
  it("contiene ogni riga di .gitignore", () => {
    const ignored = new Set(lines(".graphifyignore"));
    expect(lines(".gitignore").filter((line) => !ignored.has(line))).toEqual([]);
  });

  it("tiene fuori la tavola, sorgente e output", () => {
    expect(lines(".graphifyignore")).toEqual(
      expect.arrayContaining(["tavola/", "public/officina-tavola/"]),
    );
  });
});
