import { describe, expect, it } from "vitest";

import { LINGUE, scenario } from "./dataset-in-memoria";
import { decidiRollback, idBozza } from "./manifest";
import {
  contentOf,
  deepEqual,
  planDocument,
  publishByFields,
  readPath,
  removePath,
  runIsComplete,
  verifyPlan,
  writePath,
  type OpenRun,
  type Operation,
  type SanityDocument,
} from "./publish";

const foto = (doc: SanityDocument | undefined) => readPath(doc, "primaryImage.asset._ref");
const run = (runs: OpenRun[], lingua: string) => runs.find((r) => r.lingua === lingua)!.manifest;

describe("percorsi e uguaglianza", () => {
  it("legge, scrive creando gli intermedi, e toglie a un percorso a punti", () => {
    const doc: Record<string, unknown> = { name: { it: "A" } };
    writePath(doc, "seo.metaTitle.de", "Titel");
    expect(readPath(doc, "seo.metaTitle.de")).toBe("Titel");
    expect(readPath(doc, "name.it")).toBe("A");
    expect(readPath(doc, "name.de")).toBeUndefined();
    removePath(doc, "seo.metaTitle.de");
    expect(readPath(doc, "seo.metaTitle.de")).toBeUndefined();
  });

  it("l'uguaglianza profonda ignora l'ordine delle chiavi e vede le differenze negli array", () => {
    expect(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
  });
});

describe("a · pubblicare il tedesco su bozze con tedesco, francese e spagnolo", () => {
  it("il pubblicato prende il tedesco e tiene la foto nuova; la bozza resta con FR ed ES, riallineata", async () => {
    const { ds, ids, runs } = scenario();
    const plans = await publishByFields({
      ids,
      languages: ["de"],
      runs,
      io: ds.io(),
      now: () => "2026-09-15T12:00:00Z",
    });

    expect(plans.filter((p) => p.action === "publish")).toHaveLength(120);
    for (const id of ids) {
      const pub = ds.docs.get(id)!;
      const bozza = ds.docs.get(idBozza(id))!;
      expect(readPath(pub, "name.de")).toBe(`Name de ${id}`);
      expect(readPath(pub, "name.fr")).toBeUndefined();
      expect(foto(pub)).toBe("foto-nuova");
      expect(readPath(bozza, "name.fr")).toBe(`Name fr ${id}`);
      expect(readPath(bozza, "name.es")).toBe(`Name es ${id}`);
      expect(foto(bozza)).toBe("foto-nuova");
    }
    // Il giro DE è finito, FR ed ES no, e la loro firma è la _rev nuova della bozza.
    expect(runIsComplete(run(runs, "de"))).toBe(true);
    expect(runIsComplete(run(runs, "fr"))).toBe(false);
    const bozza0 = ds.docs.get(idBozza(ids[0]))!;
    expect(run(runs, "fr").voci[0].revDopo).toBe(bozza0._rev);
    expect(run(runs, "es").voci[0].revDopo).toBe(bozza0._rev);
    // La verifica sul dataset riletto torna su tutti.
    for (const p of plans)
      expect(
        verifyPlan(p, { published: ds.docs.get(p.id), draft: ds.docs.get(idBozza(p.id)) }),
      ).toEqual([]);
  });

  it("controprova: pubblicare la bozza INTERA riporterebbe la foto vecchia", () => {
    const { ds, ids } = scenario(1);
    const vecchioModo = contentOf(ds.docs.get(idBozza(ids[0]))!);
    expect(readPath(vecchioModo, "primaryImage.asset._ref")).toBe("foto-vecchia");
  });

  it("controprova: la verifica se ne accorge, se il pubblicato torna indietro", async () => {
    const { ds, ids, runs } = scenario(1);
    const [plan] = await publishByFields({
      ids,
      languages: ["de"],
      runs,
      io: ds.io(),
      now: () => "t",
    });
    const rovinato = structuredClone(ds.docs.get(ids[0])!);
    writePath(rovinato, "primaryImage.asset._ref", "foto-vecchia");
    expect(
      verifyPlan(plan, { published: rovinato, draft: ds.docs.get(idBozza(ids[0])) }),
    ).toHaveLength(1);
  });
});

describe("b · pubblicare le tre lingue insieme", () => {
  it("il pubblicato ha tre lingue e la foto nuova, le bozze sono scartate, i tre giri finiti", async () => {
    const { ds, ids, runs } = scenario();
    await publishByFields({
      ids,
      languages: ["de", "fr", "es"],
      runs,
      io: ds.io(),
      now: () => "t",
    });
    for (const id of ids) {
      const pub = ds.docs.get(id)!;
      for (const l of LINGUE) expect(readPath(pub, `name.${l}`)).toBe(`Name ${l} ${id}`);
      expect(foto(pub)).toBe("foto-nuova");
      expect(ds.docs.has(idBozza(id))).toBe(false);
    }
    for (const l of LINGUE) expect(runIsComplete(run(runs, l))).toBe(true);
  });

  it("e lo stesso risultato, in due tempi: prima DE, poi FR ed ES", async () => {
    const { ds, ids, runs } = scenario();
    await publishByFields({ ids, languages: ["de"], runs, io: ds.io(), now: () => "t1" });
    await publishByFields({ ids, languages: ["fr", "es"], runs, io: ds.io(), now: () => "t2" });
    for (const id of ids) {
      expect(ds.docs.has(idBozza(id))).toBe(false);
      expect(readPath(ds.docs.get(id), "name.es")).toBe(`Name es ${id}`);
      expect(foto(ds.docs.get(id))).toBe("foto-nuova");
    }
  });

  it("controprova: senza aggiornare la firma delle lingue che restano, il secondo tempo salterebbe tutto", async () => {
    const { ds, ids, runs } = scenario(3);
    await publishByFields({ ids, languages: ["de"], runs, io: ds.io(), now: () => "t1" });
    for (const v of [...run(runs, "fr").voci, ...run(runs, "es").voci]) v.revDopo = "rev-es";
    const secondo = await publishByFields({
      ids,
      languages: ["fr", "es"],
      runs,
      io: ds.io(),
      now: () => "t2",
    });
    expect(secondo.every((p) => p.action === "skip")).toBe(true);
  });
});

describe("c · una bozza toccata da una persona", () => {
  it("si salta e si registra: pubblicato e bozza restano come sono", async () => {
    const { ds, ids, runs } = scenario(3);
    const toccata = ds.docs.get(idBozza(ids[1]))!;
    writePath(toccata, "name.it", "Nome corretto da Andrea");
    toccata._rev = "rev-andrea";
    const primaPub = structuredClone(ds.docs.get(ids[1]));

    const plans = await publishByFields({
      ids,
      languages: ["de"],
      runs,
      io: ds.io(),
      now: () => "t",
    });
    expect(plans[1].action).toBe("skip");
    expect(plans[1].reason).toMatch(/modificata da altri/);
    expect(ds.docs.get(ids[1])).toEqual(primaPub);
    expect(ds.docs.get(idBozza(ids[1]))!._rev).toBe("rev-andrea");
    expect(run(runs, "de").voci[1].publishSkipped).toMatch(/modificata da altri/);
    expect(run(runs, "de").voci[1].publishedAt).toBeUndefined();
    expect(runIsComplete(run(runs, "de"))).toBe(false);
    // Gli altri due passano.
    expect(plans.filter((p) => p.action === "publish")).toHaveLength(2);
  });

  it("controprova: con la _rev ancora firmata, lo stesso documento si pubblicherebbe", () => {
    const { ds, ids, runs } = scenario(1);
    const plan = planDocument({
      id: ids[0],
      languages: ["de"],
      runs,
      draft: ds.docs.get(idBozza(ids[0])),
      published: ds.docs.get(ids[0]),
    });
    expect(plan.action).toBe("publish");
  });
});

describe("d · il pubblicato cambia fra la lettura e il commit", () => {
  it("la transazione fallisce, si rilegge, e il tedesco va sul pubblicato NUOVO senza sovrascriverlo", async () => {
    const { ds, ids, runs } = scenario(3);
    ds.beforeCommit = () => {
      const pub = ds.docs.get(ids[2])!;
      pub.primaryImage = { _type: "imageWithMeta", asset: { _ref: "foto-ancora-piu-nuova" } };
      pub._rev = "pub3";
    };
    const conflitti: number[] = [];
    await publishByFields({
      ids,
      languages: ["de"],
      runs,
      io: ds.io(),
      now: () => "t",
      onConflict: (_i, attempt) => conflitti.push(attempt),
    });
    expect(conflitti).toEqual([1]);
    expect(foto(ds.docs.get(ids[2]))).toBe("foto-ancora-piu-nuova");
    expect(readPath(ds.docs.get(ids[2]), "name.de")).toBe(`Name de ${ids[2]}`);
  });

  it("e se il conflitto non passa entro i tentativi, si ferma invece di insistere", async () => {
    const { ds, ids, runs } = scenario(1);
    const io = ds.io();
    const sempreConflitto = {
      ...io,
      commit: async () => {
        throw Object.assign(new Error("revisione"), { statusCode: 409 });
      },
    };
    await expect(
      publishByFields({
        ids,
        languages: ["de"],
        runs,
        io: sempreConflitto,
        now: () => "t",
        attempts: 2,
      }),
    ).rejects.toThrow("revisione");
    expect(readPath(ds.docs.get(ids[0]), "name.de")).toBeUndefined();
  });

  it("controprova: una patch senza ifRevisionId sul pubblicato letto prima riporterebbe la foto indietro", () => {
    const { ds, ids } = scenario(1);
    const letto = structuredClone(ds.docs.get(ids[0])!);
    ds.docs.get(ids[0])!.primaryImage = { asset: { _ref: "foto-ancora-piu-nuova" } };
    // Scrivere il documento letto prima, invece dei soli campi, è la sovrascrittura.
    ds.docs.set(ids[0], letto);
    expect(foto(ds.docs.get(ids[0]))).toBe("foto-nuova");
  });
});

describe("e · rollback dopo un publish parziale", () => {
  it("il tedesco pubblicato non si tocca; dal francese si tolgono solo i suoi campi", async () => {
    const { ds, ids, runs } = scenario(2);
    await publishByFields({ ids, languages: ["de"], runs, io: ds.io(), now: () => "t" });

    const bozza = ds.docs.get(idBozza(ids[0]))!;
    const vDe = run(runs, "de").voci[0];
    const vFr = run(runs, "fr").voci[0];
    expect(decidiRollback(vDe, bozza._rev).azione).toBe("niente");
    const fr = decidiRollback(vFr, bozza._rev);
    expect(fr.azione).toBe("togli-campi");

    for (const path of vFr.campi) removePath(bozza, path);
    expect(readPath(bozza, "name.fr")).toBeUndefined();
    expect(readPath(bozza, "name.es")).toBe(`Name es ${ids[0]}`);
    expect(readPath(ds.docs.get(ids[0]), "name.de")).toBe(`Name de ${ids[0]}`);
  });

  it("controprova: senza publishedAt, il rollback toglierebbe il tedesco anche dalla bozza", async () => {
    const { ds, ids, runs } = scenario(1);
    await publishByFields({ ids, languages: ["de"], runs, io: ds.io(), now: () => "t" });
    const vDe = { ...run(runs, "de").voci[0], publishedAt: undefined };
    expect(decidiRollback(vDe, ds.docs.get(idBozza(ids[0]))!._rev).azione).toBe("togli-campi");
  });
});

describe("le regole di contorno", () => {
  it("un campo del manifest assente nella bozza fa saltare il documento, non pubblicare a metà", () => {
    const { ds, ids, runs } = scenario(1);
    const bozza = ds.docs.get(idBozza(ids[0]))!;
    removePath(bozza, "description.de");
    const plan = planDocument({
      id: ids[0],
      languages: ["de"],
      runs,
      draft: bozza,
      published: ds.docs.get(ids[0]),
    });
    expect(plan.action).toBe("skip");
    expect(plan.reason).toMatch(/description\.de/);
    expect(plan.operations).toEqual([]);
  });

  it("nessuna operazione è mai un publish della bozza: solo patch con ifRevisionId e delete", async () => {
    const { ds, ids, runs } = scenario(4);
    const viste: Operation[] = [];
    const io = ds.io();
    await publishByFields({
      ids,
      languages: ["de", "fr"],
      runs,
      io: { ...io, commit: async (ops) => (viste.push(...ops), io.commit(ops)) },
      now: () => "t",
    });
    expect(viste.length).toBeGreaterThan(0);
    for (const op of viste) {
      expect(["patch", "delete"]).toContain(op.kind);
      if (op.kind === "patch") expect(op.ifRevisionId).toBeTruthy();
    }
  });

  it("i lotti sono da 50: 120 documenti fanno tre transazioni", async () => {
    const { ds, ids, runs } = scenario(120);
    const lotti: Array<string | undefined> = [];
    await publishByFields({
      ids,
      languages: ["de"],
      runs,
      io: ds.io(),
      now: () => "t",
      onBatch: (_i, _p, tx) => lotti.push(tx),
    });
    expect(lotti).toHaveLength(3);
  });
});
