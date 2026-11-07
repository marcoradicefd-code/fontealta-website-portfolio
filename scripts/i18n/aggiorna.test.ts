import { describe, expect, it } from "vitest";

import { planUpdate, updateByFields, verifyUpdate, type UpdatePlan } from "./aggiorna";
import { blocco, LINGUE, scenario } from "./dataset-in-memoria";
import { decidiRollback, idBozza } from "./manifest";
import {
  planDocument,
  publishByFields,
  readPath,
  removePath,
  type OpenRun,
  type Operation,
} from "./publish";

const run = (runs: OpenRun[], lingua: string) => runs.find((r) => r.lingua === lingua)!.manifest;
const voce = (runs: OpenRun[], lingua: string, i: number) => run(runs, lingua).voci[i];
/** Il file corretto: la descrizione tedesca nuova, il nome uguale a quello già scritto. */
const corretto =
  (lingua: string, testo = "Neu") =>
  (id: string) => ({
    [`name.${lingua}`]: `Name ${lingua} ${id}`,
    [`description.${lingua}`]: blocco(`${testo} ${lingua} ${id}`),
  });

describe("a · correggere il tedesco su bozze firmate dallo spagnolo", () => {
  it("cambia solo description.de; il resto della bozza e il pubblicato restano; la firma passa allo spagnolo", async () => {
    const { ds, ids, runs } = scenario(3);
    const prima = new Map([...ds.docs].map(([k, v]) => [k, structuredClone(v)] as const));

    const plans = await updateByFields({
      ids,
      lingua: "de",
      valuesFor: corretto("de"),
      runs,
      io: ds.io(),
      now: () => "2026-09-15T16:00:00Z",
    });

    expect(plans.map((p) => p.action)).toEqual(["update", "update", "update"]);
    for (const [i, id] of ids.entries()) {
      expect(plans[i].set).toEqual({ "description.de": blocco(`Neu de ${id}`) });
      const bozza = ds.docs.get(idBozza(id))!;
      const vecchia = prima.get(idBozza(id))!;
      expect(readPath(bozza, "description.de")).toEqual(blocco(`Neu de ${id}`));
      for (const path of [
        "name.de",
        "name.fr",
        "description.fr",
        "description.es",
        "name.it",
        "primaryImage",
      ])
        expect(readPath(bozza, path)).toEqual(readPath(vecchia, path));
      expect(ds.docs.get(id)).toEqual(prima.get(id));
      expect(verifyUpdate(plans[i], bozza)).toEqual([]);

      // la firma: lo spagnolo la prende, il tedesco registra la correzione
      expect(voce(runs, "es", i).revDopo).toBe(bozza._rev);
      expect(voce(runs, "es", i).rifirmata).toBe("2026-09-15T16:00:00Z");
      expect(voce(runs, "de", i).revDopo).toBe("rev-de");
      expect(voce(runs, "de", i).aggiornamenti).toEqual([
        {
          quando: "2026-09-15T16:00:00Z",
          campi: ["description.de"],
          revPrima: "rev-es",
          revDopo: bozza._rev,
        },
      ]);
      expect(voce(runs, "fr", i).rifirmata).toBeUndefined();
    }
  });

  it("dopo la correzione il publish per campi riconosce ancora la bozza, e porta il tedesco nuovo", async () => {
    const { ds, ids, runs } = scenario(1);
    await updateByFields({
      ids,
      lingua: "de",
      valuesFor: corretto("de"),
      runs,
      io: ds.io(),
      now: () => "t",
    });
    const p = planDocument({
      id: ids[0],
      languages: ["de"],
      runs,
      draft: ds.docs.get(idBozza(ids[0])),
      published: ds.docs.get(ids[0]),
    });
    expect(p.action).toBe("publish");
    expect(readPath(p.expected!.published, "description.de")).toEqual(blocco(`Neu de ${ids[0]}`));
  });

  it("controprova: senza rifirma, il publish salterebbe la bozza come toccata da una persona", async () => {
    const { ds, ids, runs } = scenario(1);
    await updateByFields({
      ids,
      lingua: "de",
      valuesFor: corretto("de"),
      runs,
      io: ds.io(),
      now: () => "t",
    });
    voce(runs, "es", 0).revDopo = "rev-es";
    const p = planDocument({
      id: ids[0],
      languages: ["de"],
      runs,
      draft: ds.docs.get(idBozza(ids[0])),
      published: ds.docs.get(ids[0]),
    });
    expect(p.action).toBe("skip");
    expect(p.reason).toMatch(/modificata da altri/);
  });
});

describe("b · niente da cambiare", () => {
  it("con il file uguale alla bozza non si scrive niente: nessuna transazione, stessa _rev", async () => {
    const { ds, ids, runs } = scenario(2);
    const uguale = (id: string) => ({
      "name.de": `Name de ${id}`,
      "description.de": structuredClone(readPath(ds.docs.get(idBozza(id)), "description.de")),
    });
    const transazioni: Array<string | undefined> = [];
    const plans = await updateByFields({
      ids,
      lingua: "de",
      valuesFor: uguale,
      runs,
      io: ds.io(),
      now: () => "t",
      onBatch: (_i, _p, tx) => transazioni.push(tx),
    });
    expect(plans.map((p) => p.action)).toEqual(["nothing", "nothing"]);
    expect(transazioni).toEqual([undefined]);
    expect(ds.docs.get(idBozza(ids[0]))!._rev).toBe("rev-es");
    expect(voce(runs, "es", 0).rifirmata).toBeUndefined();
  });
});

describe("c · una bozza toccata da una persona", () => {
  it("si salta: bozza e manifest restano come sono; le altre si aggiornano", async () => {
    const { ds, ids, runs } = scenario(3);
    const toccata = ds.docs.get(idBozza(ids[1]))!;
    toccata._rev = "rev-andrea";
    const primaToccata = structuredClone(toccata);

    const plans = await updateByFields({
      ids,
      lingua: "de",
      valuesFor: corretto("de"),
      runs,
      io: ds.io(),
      now: () => "t",
    });
    expect(plans.map((p) => p.action)).toEqual(["update", "skip", "update"]);
    expect(plans[1].reason).toMatch(/modificata da altri/);
    expect(ds.docs.get(idBozza(ids[1]))).toEqual(primaToccata);
    expect(voce(runs, "de", 1).aggiornamenti).toBeUndefined();
  });

  it("controprova: con la _rev ancora firmata, lo stesso documento si aggiornerebbe", () => {
    const { ds, ids, runs } = scenario(1);
    const p = planUpdate({
      id: ids[0],
      lingua: "de",
      values: corretto("de")(ids[0]),
      runs,
      draft: ds.docs.get(idBozza(ids[0])),
    });
    expect(p.action).toBe("update");
  });
});

describe("d · la bozza cambia fra la lettura e il commit", () => {
  it("la transazione fallisce, si rilegge, e la bozza toccata si salta invece di essere sovrascritta", async () => {
    const { ds, ids, runs } = scenario(3);
    ds.beforeCommit = () => {
      const b = ds.docs.get(idBozza(ids[2]))!;
      b.name = { ...(b.name as object), it: "Nome corretto da Andrea" };
      b._rev = "rev-andrea";
    };
    const conflitti: number[] = [];
    const plans = await updateByFields({
      ids,
      lingua: "de",
      valuesFor: corretto("de"),
      runs,
      io: ds.io(),
      now: () => "t",
      onConflict: (_i, attempt) => conflitti.push(attempt),
    });
    expect(conflitti).toEqual([1]);
    expect(plans.map((p) => p.action)).toEqual(["update", "update", "skip"]);
    expect(readPath(ds.docs.get(idBozza(ids[2])), "name.it")).toBe("Nome corretto da Andrea");
    expect(readPath(ds.docs.get(idBozza(ids[2])), "description.de")).toEqual(
      blocco(`Beschreibung de ${ids[2]}`),
    );
  });
});

describe("e · mai creare, mai togliere, mai cancellare", () => {
  it("le operazioni sono solo patch con ifRevisionId e set dei campi della lingua", async () => {
    const { ds, ids, runs } = scenario(4);
    const viste: Operation[] = [];
    const io = ds.io();
    for (const lingua of LINGUE)
      await updateByFields({
        ids,
        lingua,
        valuesFor: corretto(lingua),
        runs,
        io: { ...io, commit: async (ops) => (viste.push(...ops), io.commit(ops)) },
        now: () => "t",
      });
    expect(viste).toHaveLength(12);
    for (const op of viste) {
      expect(op.kind).toBe("patch");
      if (op.kind !== "patch") continue;
      expect(op.ifRevisionId).toBeTruthy();
      expect(op.unset).toBeUndefined();
      expect(op.id.startsWith("drafts.")).toBe(true);
    }
  });

  it("una bozza assente si salta e non si crea", async () => {
    const { ds, ids, runs } = scenario(1);
    ds.docs.delete(idBozza(ids[0]));
    const [p] = await updateByFields({
      ids,
      lingua: "de",
      valuesFor: corretto("de"),
      runs,
      io: ds.io(),
      now: () => "t",
    });
    expect(p.action).toBe("skip");
    expect(p.reason).toMatch(/non si crea/);
    expect(ds.docs.has(idBozza(ids[0]))).toBe(false);
  });

  it("una voce già pubblicata, un campo di un'altra lingua o non scritto dal giro: si salta", () => {
    const { ds, ids, runs } = scenario(1);
    const draft = ds.docs.get(idBozza(ids[0]));
    const pubblicata = structuredClone(runs);
    voce(pubblicata, "de", 0).publishedAt = "t";
    expect(
      planUpdate({
        id: ids[0],
        lingua: "de",
        values: corretto("de")(ids[0]),
        runs: pubblicata,
        draft,
      }).reason,
    ).toMatch(/già pubblicata/);
    expect(
      planUpdate({ id: ids[0], lingua: "de", values: { "name.fr": "x" }, runs, draft }).reason,
    ).toMatch(/fuori lingua/);
    expect(
      planUpdate({ id: ids[0], lingua: "de", values: { "seo.metaTitle.de": "x" }, runs, draft })
        .reason,
    ).toMatch(/non scritto da questo giro/);
  });
});

describe("f · rollback dopo --aggiorna", () => {
  it("nessuna voce cancella la bozza: tutte tolgono solo i campi loro", async () => {
    const { ds, ids, runs } = scenario(1);
    await updateByFields({
      ids,
      lingua: "de",
      valuesFor: corretto("de"),
      runs,
      io: ds.io(),
      now: () => "t",
    });
    const rev = ds.docs.get(idBozza(ids[0]))!._rev;
    for (const l of LINGUE)
      expect(decidiRollback(voce(runs, l, 0), rev).azione).toBe("togli-campi");
  });

  it("controprova: una voce con la firma giusta, senza sharedWith e senza rifirmata, cancellerebbe", async () => {
    const { ds, ids, runs } = scenario(1);
    await updateByFields({
      ids,
      lingua: "de",
      valuesFor: corretto("de"),
      runs,
      io: ds.io(),
      now: () => "t",
    });
    const rev = ds.docs.get(idBozza(ids[0]))!._rev;
    const nuda = { ...voce(runs, "es", 0), sharedWith: undefined, rifirmata: undefined };
    expect(decidiRollback(nuda, rev).azione).toBe("cancella");
  });
});

describe("g · il rischio del publish per campi: la voce che ha creato la bozza, rifirmata", () => {
  it("pubblicato il francese, il tedesco resta in bozza con la firma nuova e al rollback NON cancella", async () => {
    const { ds, ids, runs } = scenario(1);
    await publishByFields({ ids, languages: ["fr"], runs, io: ds.io(), now: () => "t" });
    const bozza = ds.docs.get(idBozza(ids[0]))!;
    const de = voce(runs, "de", 0);
    expect(de.sharedWith).toBeUndefined();
    expect(de.revDopo).toBe(bozza._rev);
    const esito = decidiRollback(de, bozza._rev);
    expect(esito.azione).toBe("togli-campi");

    // e togliendo i soli campi tedeschi, lo spagnolo resta
    for (const path of de.campi) removePath(bozza, path);
    expect(readPath(bozza, "name.es")).toBe(`Name es ${ids[0]}`);
  });

  it("controprova: senza rifirmata, quella voce cancellerebbe la bozza con lo spagnolo dentro", async () => {
    const { ds, ids, runs } = scenario(1);
    await publishByFields({ ids, languages: ["fr"], runs, io: ds.io(), now: () => "t" });
    const de = { ...voce(runs, "de", 0), rifirmata: undefined };
    expect(decidiRollback(de, ds.docs.get(idBozza(ids[0]))!._rev).azione).toBe("cancella");
  });
});

describe("h · tre lingue in fila sulla stessa bozza", () => {
  it("tedesco, francese, spagnolo: tre correzioni, la firma segue, e il publish delle tre torna", async () => {
    const { ds, ids, runs } = scenario(2);
    const tutti: UpdatePlan[] = [];
    for (const lingua of LINGUE)
      tutti.push(
        ...(await updateByFields({
          ids,
          lingua,
          valuesFor: corretto(lingua),
          runs,
          io: ds.io(),
          now: () => `t-${lingua}`,
        })),
      );
    expect(tutti.every((p) => p.action === "update")).toBe(true);
    for (const [i, id] of ids.entries()) {
      const bozza = ds.docs.get(idBozza(id))!;
      for (const l of LINGUE)
        expect(readPath(bozza, `description.${l}`)).toEqual(blocco(`Neu ${l} ${id}`));
      expect(voce(runs, "es", i).revDopo).toBe(bozza._rev);
    }
    const piani = await publishByFields({
      ids,
      languages: [...LINGUE],
      runs,
      io: ds.io(),
      now: () => "p",
    });
    expect(piani.every((p) => p.action === "publish")).toBe(true);
    expect(readPath(ds.docs.get(ids[0]), "description.fr")).toEqual(blocco(`Neu fr ${ids[0]}`));
  });
});
