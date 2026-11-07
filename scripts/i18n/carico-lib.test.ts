// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SanityClient } from "@sanity/client";
import { describe, expect, it } from "vitest";

import {
  assetMancanti,
  codiceConferma,
  compattaUnset,
  operazione,
  ripristinaCampi,
  scriviCampi,
  unisciPerDocumento,
  type Operazione,
} from "./carico-lib";

/**
 * Un client che registra la transazione e rilegge quello che si è «scritto». `iniziale` è il
 * documento letto (piatto, per percorso); `ignoraUnset` simula un Sanity che non toglie niente,
 * per la controprova della verifica.
 */
function clientFinto(iniziale: Record<string, unknown> = {}, { ignoraUnset = false } = {}) {
  const passi: string[] = [];
  let scritto: Record<string, unknown> = { ...iniziale };
  const patch = (id: string) => {
    const p = {
      ifRevisionId: (rev: string) => (passi.push(`${id} ifRevisionId ${rev}`), p),
      setIfMissing: (v: object) => (passi.push(`${id} setIfMissing ${Object.keys(v)}`), p),
      set: (v: Record<string, unknown>) => {
        passi.push(`${id} set ${Object.keys(v)}`);
        scritto = { ...scritto, ...v };
        return p;
      },
      unset: (percorsi: string[]) => {
        passi.push(`${id} unset ${percorsi}`);
        if (!ignoraUnset)
          scritto = Object.fromEntries(
            Object.entries(scritto).filter(
              ([k]) => !percorsi.some((q) => k === q || k.startsWith(`${q}.`)),
            ),
          );
        return p;
      },
      commit: async () => (passi.push("commit"), {}),
    };
    return p;
  };
  const client = {
    transaction: () => {
      const tx = {
        create: (doc: { _id: string }) => (passi.push(`create ${doc._id}`), tx),
        patch: (id: string, fn: (p: ReturnType<typeof patch>) => unknown) => (fn(patch(id)), tx),
        commit: async () => (passi.push("commit"), {}),
      };
      return tx;
    },
    patch,
    fetch: async (q: string) =>
      q.includes("_rev")
        ? [{ _id: "contentPage-x", _rev: "r-dopo", _type: "collection", slug: "x" }]
        : [{ _id: "contentPage-x", ...espandi(scritto) }],
  };
  return { client: client as unknown as SanityClient, passi, scritto: () => scritto };
}

/** `{ "title.it": "x" }` → `{ title: { it: "x" } }`, per la verifica che rilegge per percorso. */
function espandi(piatto: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [p, v] of Object.entries(piatto)) {
    const k = p.split(".");
    let o = out;
    for (const x of k.slice(0, -1)) o = (o[x] ??= {}) as Record<string, unknown>;
    o[k.at(-1)!] = v;
  }
  return out;
}

describe("scriviCampi", () => {
  it("un documento nuovo: create e poi i campi, senza revisione da confrontare", async () => {
    const { client, passi } = clientFinto();
    const op: Operazione = {
      id: "contentPage-x",
      rev: "",
      label: "x (it)",
      set: { "title.it": "Titolo" },
      crea: { _id: "contentPage-x", _type: "contentPage", title: { _type: "t" } },
    };
    const dir = mkdtempSync(join(tmpdir(), "carico-"));
    const r = await scriviCampi(client, "pagine-uso", [op], dir, new Map());
    expect(passi).toEqual(["create contentPage-x", "contentPage-x set title.it", "commit"]);
    expect(r.problemi).toBe(0);
  });

  it("un documento che c'è: la revisione letta, sul primo passo della transazione", async () => {
    const { client, passi } = clientFinto();
    const op: Operazione = {
      id: "contentPage-x",
      rev: "r1",
      label: "x (en)",
      set: { "title.en": "Title" },
      setIfMissing: { title: { _type: "t" } },
    };
    const dir = mkdtempSync(join(tmpdir(), "carico-"));
    await scriviCampi(client, "pagine-uso", [op], dir, new Map());
    expect(passi).toEqual([
      "contentPage-x ifRevisionId r1",
      "contentPage-x setIfMissing title",
      "contentPage-x set title.en",
      "commit",
    ]);
  });
});

/**
 * Togliere un campo (4/11/2026, Marco: le tagline delle collezioni tornano com'erano prima del 2/11).
 * Una tagline vuota nel file diventa un `unset`: nel diff, nel codice, nel verbale e nella verifica,
 * e `--ripristina` la rimette.
 */
describe("unset: togliere un campo", () => {
  const conTagline = {
    _id: "collection-flamingo-it",
    _rev: "r1",
    tagline: { _type: "localizedTextOptional", it: "Becco", en: "Beak" },
  };

  it("operazione: toglie solo ciò che c'è; senza niente da togliere la voce è invariata", () => {
    expect(operazione(conTagline, "flamingo (it)", {}, {}, ["tagline.it"])).toEqual({
      id: "collection-flamingo-it",
      rev: "r1",
      label: "flamingo (it)",
      set: {},
      unset: ["tagline.it"],
    });
    // Un carico rifatto con gli stessi file: la tagline non c'è più, quindi niente da scrivere.
    const senza = { _id: "collection-flamingo-it", _rev: "r2" };
    expect(operazione(senza, "flamingo (it)", {}, {}, ["tagline.it"])).toBeNull();
  });

  it("compattaUnset: tolte tutte le lingue si toglie il campo intero, altrimenti no", () => {
    const tutte: Operazione = {
      ...operazione(conTagline, "f", {}, {}, ["tagline.it", "tagline.en"])!,
    };
    expect(compattaUnset(tutte, conTagline, "tagline").unset).toEqual(["tagline"]);
    const una = operazione(conTagline, "f", {}, {}, ["tagline.it"])!;
    expect(compattaUnset(una, conTagline, "tagline").unset).toEqual(["tagline.it"]);
    const rimessa: Operazione = { ...tutte, set: { "tagline.de": "Schnabel" } };
    expect(compattaUnset(rimessa, conTagline, "tagline").unset).toEqual([
      "tagline.it",
      "tagline.en",
    ]);
  });

  it("unisciPerDocumento: gli unset delle lingue finiscono nella stessa scrittura", () => {
    const [op] = unisciPerDocumento([
      operazione(conTagline, "f (it)", {}, {}, ["tagline.it"])!,
      operazione(conTagline, "f (en)", {}, {}, ["tagline.en"])!,
    ]);
    expect(op.unset).toEqual(["tagline.it", "tagline.en"]);
    expect(op.label).toBe("f (it) + f (en)");
  });

  it("codiceConferma: l'unset cambia il codice; senza unset il codice è quello di prima", () => {
    const base: Operazione = { id: "a", rev: "r", label: "a", set: { "x.it": "y" } };
    const vecchio = createHash("sha256")
      .update(`a|r|null|null|${JSON.stringify(base.set)}\n`)
      .digest("hex")
      .slice(0, 8);
    expect(codiceConferma([base])).toBe(vecchio);
    expect(codiceConferma([{ ...base, unset: ["t.it"] }])).not.toBe(vecchio);
  });

  it("scriviCampi: unset con la revisione, il verbale tiene il testo di prima, la verifica passa", async () => {
    const { client, passi } = clientFinto({ "tagline.it": "Becco" });
    const op: Operazione = {
      id: "contentPage-x",
      rev: "r1",
      label: "x",
      set: {},
      unset: ["tagline"],
    };
    const dir = mkdtempSync(join(tmpdir(), "carico-"));
    const docs = new Map<string, unknown>([["contentPage-x", conTagline]]);
    const r = await scriviCampi(client, "collezioni", [op], dir, docs);
    expect(passi).toEqual([
      "contentPage-x ifRevisionId r1",
      "contentPage-x unset tagline",
      "commit",
    ]);
    expect(r.problemi).toBe(0);
    const verbale = JSON.parse(readFileSync(r.verbale, "utf-8"));
    expect(verbale.voci[0].prima).toEqual({ tagline: conTagline.tagline });
  });

  it("controprova: se su Sanity il campo c'è ancora, la verifica lo conta come problema", async () => {
    const { client } = clientFinto({ "tagline.it": "Becco" }, { ignoraUnset: true });
    const op: Operazione = {
      id: "contentPage-x",
      rev: "r1",
      label: "x",
      set: {},
      unset: ["tagline"],
    };
    const dir = mkdtempSync(join(tmpdir(), "carico-"));
    const r = await scriviCampi(
      client,
      "collezioni",
      [op],
      dir,
      new Map([["contentPage-x", conTagline]]),
    );
    expect(r.problemi).toBe(1);
  });

  it("--ripristina rimette la tagline tolta, col valore del verbale", async () => {
    const { client, scritto } = clientFinto();
    const radice = mkdtempSync(join(tmpdir(), "carico-"));
    const file = join(radice, "verbale.json");
    writeFileSync(
      file,
      JSON.stringify({
        sezione: "collezioni",
        quando: "x",
        voci: [
          {
            id: "contentPage-x",
            label: "x",
            prima: { tagline: conTagline.tagline },
            revDopo: "r-dopo",
          },
        ],
      }),
    );
    expect(await ripristinaCampi(client, file, radice, true)).toBe(0);
    expect(scritto()).toEqual({ tagline: conTagline.tagline });
    expect(readdirSync(radice)).toEqual(["verbale.json"]);
  });
});

describe("gli asset mancanti delle pagine d'uso", () => {
  it("un errore per ogni file che usa l'asset, non solo per l'ultimo letto", () => {
    const usati = new Map([
      ["image-a", ["it/outdoor-shower.md", "en/outdoor-shower.md", "de/outdoor-shower.md"]],
      ["image-b", ["it/outdoor-shower.md"]],
    ]);
    expect(assetMancanti(usati, new Set(["image-b"]))).toEqual([
      { asset: "image-a", chiave: "it/outdoor-shower.md" },
      { asset: "image-a", chiave: "en/outdoor-shower.md" },
      { asset: "image-a", chiave: "de/outdoor-shower.md" },
    ]);
  });

  it("nessun errore se l'asset esiste, e un file che lo usa due volte conta una", () => {
    const usati = new Map([["image-a", ["fr/outdoor-shower.md", "fr/outdoor-shower.md"]]]);
    expect(assetMancanti(usati, new Set(["image-a"]))).toEqual([]);
    expect(assetMancanti(usati, new Set())).toEqual([
      { asset: "image-a", chiave: "fr/outdoor-shower.md" },
    ]);
  });
});

/**
 * Un documento creato dal caricatore (un post nuovo, c2, 5/11/2026): il verbale lo segna, e
 * `--ripristina` lo cancella invece di togliere i campi, che lascerebbero online un post vuoto. Se un
 * altro documento lo referenzia (un «Approfondisci»), si ferma senza toccare niente.
 */
describe("--ripristina di un documento creato", () => {
  /** Un client per il ripristino: la revisione attuale, chi referenzia il documento, l'esito del commit. */
  function clientRipristino({
    rev = "r-dopo",
    referenziato = [] as string[],
    rifiuta = false,
  } = {}) {
    const passi: string[] = [];
    const client = {
      fetch: async (q: string) =>
        q.includes("references")
          ? referenziato
          : [{ _id: "post-nuovo", _rev: rev, _type: "post", slug: "nuovo" }],
      transaction: () => {
        const tx = {
          patch: (id: string, fn: (p: unknown) => unknown) => {
            const p = {
              ifRevisionId: (r: string) => (passi.push(`${id} ifRevisionId ${r}`), p),
              unset: (x: string[]) => (passi.push(`${id} unset ${x}`), p),
            };
            fn(p);
            return tx;
          },
          delete: (id: string) => (passi.push(`delete ${id}`), tx),
          commit: async () => {
            if (rifiuta) throw Object.assign(new Error("referenced"), { statusCode: 409 });
            passi.push("commit");
            return {};
          },
        };
        return tx;
      },
      patch: () => {
        throw new Error("un documento creato non si patcha campo per campo");
      },
    };
    return { client: client as unknown as SanityClient, passi };
  }

  const verbaleCreato = () => {
    const radice = mkdtempSync(join(tmpdir(), "carico-"));
    const file = join(radice, "verbale.json");
    writeFileSync(
      file,
      JSON.stringify({
        sezione: "post",
        quando: "x",
        voci: [
          {
            id: "post-nuovo",
            label: "nuovo (it, nuovo)",
            prima: { "title.it": null },
            revDopo: "r-dopo",
            creato: true,
          },
        ],
      }),
    );
    return { radice, file };
  };

  it("scriviCampi segna nel verbale il documento creato", async () => {
    const { client } = clientFinto();
    const dir = mkdtempSync(join(tmpdir(), "carico-"));
    const op: Operazione = {
      id: "contentPage-x",
      rev: "",
      label: "x (it)",
      set: { "title.it": "Titolo" },
      crea: { _id: "contentPage-x", _type: "contentPage" },
    };
    const r = await scriviCampi(client, "post", [op], dir, new Map());
    const verbale = JSON.parse(readFileSync(r.verbale, "utf-8"));
    expect(verbale.voci[0].creato).toBe(true);
  });

  it("lo cancella, con la revisione controllata nella stessa transazione", async () => {
    const { client, passi } = clientRipristino();
    const { radice, file } = verbaleCreato();
    expect(await ripristinaCampi(client, file, radice, true)).toBe(0);
    expect(passi).toEqual([
      "post-nuovo ifRevisionId r-dopo",
      "post-nuovo unset _ripristino",
      "delete post-nuovo",
      "commit",
    ]);
  });

  it("in dry-run non cancella niente", async () => {
    const { client, passi } = clientRipristino();
    const { radice, file } = verbaleCreato();
    expect(await ripristinaCampi(client, file, radice, false)).toBe(0);
    expect(passi).toEqual([]);
  });

  it("referenziato da un altro documento: si ferma, non tocca niente, e lo dice", async () => {
    const { client, passi } = clientRipristino({ referenziato: ["contentPage-home"] });
    const { radice, file } = verbaleCreato();
    expect(await ripristinaCampi(client, file, radice, true)).toBe(1);
    expect(passi).toEqual([]);
  });

  it("toccato dopo la scrittura: si lascia, come i campi", async () => {
    const { client, passi } = clientRipristino({ rev: "r-altra" });
    const { radice, file } = verbaleCreato();
    expect(await ripristinaCampi(client, file, radice, true)).toBe(1);
    expect(passi).toEqual([]);
  });

  it("Sanity rifiuta la cancellazione: il documento resta e il ripristino conta il problema", async () => {
    const { client } = clientRipristino({ rifiuta: true });
    const { radice, file } = verbaleCreato();
    expect(await ripristinaCampi(client, file, radice, true)).toBe(1);
  });
});
