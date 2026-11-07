import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ALL_LOCALES } from "../../src/i18n/routing";
import { LINGUE, validaLingua } from "./lib";

import {
  chiudiGiro,
  decidiDocumento,
  decidiRollback,
  draftsOwnedByOtherRuns,
  giroCorrente,
  giroPerScrivere,
  eBozza,
  giaFatti,
  idBozza,
  idNostriDistinti,
  idPubblicato,
  percorsoSicuro,
  perIlLog,
  radiceTraduzioni,
  registra,
  salvaManifest,
  type Manifest,
} from "./manifest";

const manifestCon = (voci: Manifest["voci"]): Manifest => ({
  lingua: "de",
  iniziato: "2026-09-11T00:00:00.000Z",
  aggiornato: "2026-09-11T00:00:00.000Z",
  voci,
});

const voce = (id: string, nostra = true): Manifest["voci"][number] => ({
  id,
  tipo: "model",
  nostra,
  campi: ["name.de"],
});

describe("le due forme dell'id", () => {
  it("riconosce una bozza dal prefisso", () => {
    expect(eBozza("drafts.model-b40l")).toBe(true);
    expect(eBozza("model-b40l")).toBe(false);
  });

  it("converte nei due versi ed è idempotente", () => {
    expect(idBozza("model-b40l")).toBe("drafts.model-b40l");
    expect(idBozza("drafts.model-b40l")).toBe("drafts.model-b40l");
    expect(idPubblicato("drafts.model-b40l")).toBe("model-b40l");
    expect(idPubblicato("model-b40l")).toBe("model-b40l");
  });

  it("non tocca un id che contiene «drafts» senza esserne prefissato", () => {
    expect(eBozza("model-drafts-01")).toBe(false);
    expect(idPubblicato("model-drafts-01")).toBe("model-drafts-01");
  });
});

describe("giaFatti restituisce id nella forma del PUBBLICATO", () => {
  /**
   * ⚠️ È il difetto misurato l'11/09/2026: il manifest registra `drafts.X`, il
   * filtro di ripresa cerca `X`, e i due insiemi non si toccano mai. Un filtro
   * che non filtra non dà nessun errore: dà solo un lavoro rifatto da capo.
   */
  it("combacia con gli id che l'export consegna", () => {
    const m = manifestCon([voce("drafts.model-b40l"), voce("drafts.model-b40v")]);
    const fatti = giaFatti(m);

    // Gli id dei documenti come arrivano dall'export: senza prefisso.
    expect(fatti.has("model-b40l")).toBe(true);
    expect(fatti.has("model-b40v")).toBe(true);
  });

  it("controprova: con la forma della bozza il filtro non filtrerebbe niente", () => {
    const m = manifestCon([voce("drafts.model-b40l")]);
    const daFare = ["model-b40l"].filter((id) => !giaFatti(m).has(id));
    expect(daFare).toEqual([]);

    // La forma sbagliata, quella di prima: l'insieme non contiene l'id cercato.
    const fattiSbagliati = new Set(m.voci.map((v) => v.id));
    expect(["model-b40l"].filter((id) => !fattiSbagliati.has(id))).toEqual(["model-b40l"]);
  });
});

/**
 * I cinque scenari del volume, esercitati sulle funzioni VERE.
 *
 * ⚠️ La simulazione che ha trovato questi difetti (`tmp/i18n/simula.py`) RICOPIAVA
 * la logica, quindi provava la copia. Qui il giro chiama `decidiDocumento` e
 * `registra`, che sono le stesse funzioni che chiama l'import: se qualcuno cambia
 * la regola, questi numeri si muovono.
 */
const N = 640;
const LOTTO = 50;
const MORTO_DOPO = 7; // lotti completati prima della morte → 350 bozze
const IDS = Array.from({ length: N }, (_, n) => `model-${String(n).padStart(4, "0")}`);

/** Un giro dell'import, senza rete: le stesse chiamate, in ordine. */
function giro(m: Manifest, suSanity: Set<string>, ids: string[]) {
  const fatti = giaFatti(m);
  const daFare = ids.filter((id) => !fatti.has(id));
  let creati = 0;
  let saltati = 0;
  let giaNostre = 0;
  for (const id of daFare) {
    const esito = decidiDocumento({
      id,
      tipo: "model",
      campi: ["name.de"],
      bozzaEsiste: suSanity.has(idBozza(id)),
      pubblicatoEsiste: true,
    });
    if (esito.azione === "crea") suSanity.add(idBozza(id));
    const registrata = registra(m, esito.voce);
    if (esito.azione === "crea") creati += 1;
    else if (registrata === "declassamento-evitato") giaNostre += 1;
    else saltati += 1;
  }
  return { creati, saltati, giaNostre };
}

/** La guardia finale dell'import. */
const guardia = (m: Manifest, suSanity: Set<string>) => {
  const attese = idNostriDistinti(m);
  return { attese: attese.length, trovate: attese.filter((id) => suSanity.has(id)).length };
};

/** Il rollback. */
function rollback(m: Manifest, suSanity: Set<string>) {
  const da = idNostriDistinti(m);
  for (const id of da) suSanity.delete(id);
  return da.length;
}

const vuoto = (): Manifest => manifestCon([]);

describe("i cinque scenari del volume, su 640 documenti e lotti da 50", () => {
  it("A · muore al lotto 7 e riprende: guardia verde, rollback completo", () => {
    const m = vuoto();
    const s = new Set<string>();
    expect(giro(m, s, IDS.slice(0, MORTO_DOPO * LOTTO)).creati).toBe(350);

    const secondo = giro(m, s, IDS);
    expect(secondo.creati).toBe(290);
    // Le 350 del giro morto NON si riattraversano: il filtro ora filtra.
    expect(secondo.giaNostre).toBe(0);
    expect(secondo.saltati).toBe(0);

    expect(m.voci).toHaveLength(640);
    expect(guardia(m, s)).toEqual({ attese: 640, trovate: 640 });
    expect(rollback(m, s)).toBe(640);
    expect(s.size).toBe(0);
  });

  it("B · una bozza già presente e NON nostra non viene mai rivendicata", () => {
    const m = vuoto();
    const s = new Set<string>();
    // Andrea ha una bozza aperta su tre documenti.
    for (const id of IDS.slice(0, 3)) s.add(idBozza(id));

    const primo = giro(m, s, IDS);
    expect(primo.creati).toBe(637);
    expect(primo.saltati).toBe(3);

    expect(guardia(m, s)).toEqual({ attese: 637, trovate: 637 });
    expect(rollback(m, s)).toBe(637);
    // Le tre di Andrea restano.
    expect([...s].sort()).toEqual(IDS.slice(0, 3).map(idBozza).sort());
  });

  it("C · giro intero, rollback, e nuovo giro: la guardia resta verde", () => {
    const m = vuoto();
    const s = new Set<string>();
    giro(m, s, IDS);
    rollback(m, s);

    // Dopo un rollback il giro è chiuso: il manifest del giro nuovo riparte vuoto.
    const m2 = vuoto();
    expect(giro(m2, s, IDS).creati).toBe(640);
    expect(guardia(m2, s)).toEqual({ attese: 640, trovate: 640 });
  });

  it("D · il declassamento è RIFIUTATO, che è ciò che salva il rollback", () => {
    const m = vuoto();
    const nostra = { id: "drafts.model-0001", tipo: "model", nostra: true, campi: ["name.de"] };
    expect(registra(m, nostra)).toBe("aggiunta");

    // Il giro successivo la trova già presente e proverebbe a dirla di altri.
    const esito = decidiDocumento({
      id: "model-0001",
      tipo: "model",
      campi: ["name.de"],
      bozzaEsiste: true,
      pubblicatoEsiste: true,
    });
    expect(esito.voce.nostra).toBe(false);
    expect(registra(m, esito.voce)).toBe("declassamento-evitato");

    expect(m.voci).toHaveLength(1);
    expect(m.voci[0].nostra).toBe(true);
    expect(m.voci[0].saltata).toBeUndefined();
    expect(idNostriDistinti(m)).toEqual(["drafts.model-0001"]);
  });

  it("E · e una bozza altrui che sparisce e viene creata da noi diventa nostra", () => {
    const m = vuoto();
    const altrui = decidiDocumento({
      id: "model-0002",
      tipo: "model",
      campi: ["name.de"],
      bozzaEsiste: true,
      pubblicatoEsiste: true,
    });
    registra(m, altrui.voce);
    expect(idNostriDistinti(m)).toEqual([]);

    // La persona cancella la sua bozza, il giro dopo la creiamo noi.
    const nostra = decidiDocumento({
      id: "model-0002",
      tipo: "model",
      campi: ["name.de"],
      bozzaEsiste: false,
      pubblicatoEsiste: true,
    });
    expect(nostra.azione).toBe("crea");
    registra(m, nostra.voce);

    expect(m.voci).toHaveLength(1);
    expect(idNostriDistinti(m)).toEqual(["drafts.model-0002"]);
  });

  it("il manifest non accumula mai: N voci per N documenti, comunque si rilanci", () => {
    const m = vuoto();
    const s = new Set<string>();
    for (let i = 0; i < 5; i += 1) giro(m, s, IDS);
    expect(m.voci).toHaveLength(640);
    expect(new Set(m.voci.map((v) => v.id)).size).toBe(640);
  });

  it("un pubblicato assente si salta e si registra, senza diventare nostro", () => {
    const m = vuoto();
    const esito = decidiDocumento({
      id: "model-fantasma",
      tipo: "model",
      campi: ["name.de"],
      bozzaEsiste: false,
      pubblicatoEsiste: false,
    });
    expect(esito.azione).toBe("salta");
    expect(esito.voce.saltata).toBe("pubblicato assente");
    registra(m, esito.voce);
    expect(idNostriDistinti(m)).toEqual([]);
  });
});

describe("il rollback guarda il _rev, e nel dubbio non cancella", () => {
  const nostra = (extra: Partial<Manifest["voci"][number]> = {}): Manifest["voci"][number] => ({
    id: "drafts.model-b40l",
    tipo: "model",
    nostra: true,
    campi: ["name.de", "description.de"],
    revDopo: "N40f4AVZPKSrcmVly0qloS",
    ...extra,
  });

  it("nostra e intatta: si cancella", () => {
    expect(decidiRollback(nostra(), "N40f4AVZPKSrcmVly0qloS")).toEqual({
      azione: "cancella",
      ragione: "nostra e intatta",
    });
  });

  it("⚠️ _rev cambiato da altri: il documento NON si cancella", () => {
    const esito = decidiRollback(nostra(), "unAltraRevisioneScrittaDaQualcunAltro");
    expect(esito.azione).toBe("togli-campi");
    expect(esito.ragione).toBe("modificata da altri dopo di noi");
  });

  it("senza revDopo non si cancella: il dubbio decide per la prudenza", () => {
    const esito = decidiRollback(nostra({ revDopo: undefined }), "qualsiasiCosa");
    expect(esito.azione).toBe("togli-campi");
  });

  it("una bozza già sparita non è un errore: niente da fare", () => {
    expect(decidiRollback(nostra(), undefined).azione).toBe("niente");
  });

  it("una bozza NON nostra non si tocca, nemmeno se il _rev combacia", () => {
    const altrui = nostra({ nostra: false, saltata: "bozza già presente" });
    expect(decidiRollback(altrui, "N40f4AVZPKSrcmVly0qloS").azione).toBe("niente");
  });

  it("una voce nostra ma saltata non si tocca", () => {
    const saltata = nostra({ saltata: "pubblicato assente" });
    expect(decidiRollback(saltata, "N40f4AVZPKSrcmVly0qloS").azione).toBe("niente");
  });
});

describe("il manifest è del GIRO, non del giorno", () => {
  /**
   * Una radice usa-e-getta, dentro la cartella di lavoro: niente scritture altrove.
   *
   * ⚠️ **`tmp/` va CREATA, non data per esistente.** È gitignored, quindi in un
   * checkout pulito non c'è: `mkdtemp` falliva con `ENOENT` e cinque prove
   * uscivano rosse in CI mentre erano verdi sul disco di chi le aveva scritte.
   * L'ha trovato il worktree, che compila il contenuto del commit e non il disco.
   */
  function radiceTemporanea() {
    const tmp = join(process.cwd(), "tmp");
    mkdirSync(tmp, { recursive: true });
    return mkdtempSync(join(tmp, "prova-giro-"));
  }

  it("una ripresa RIPRENDE lo stesso giro, anche se la data è cambiata", () => {
    const base = radiceTemporanea();
    try {
      const primo = giroPerScrivere(base, "de", new Date("2026-09-11T23:50:00.000Z"));
      expect(primo.ripreso).toBe(false);
      salvaManifest(primo.giro.manifest, {
        lingua: "de",
        iniziato: "x",
        aggiornato: "x",
        voci: [],
      });

      // Dieci minuti dopo, ma è un altro giorno.
      const secondo = giroPerScrivere(base, "de", new Date("2026-09-12T00:10:00.000Z"));
      expect(secondo.ripreso).toBe(true);
      expect(secondo.giro.id).toBe(primo.giro.id);
      expect(secondo.giro.manifest).toBe(primo.giro.manifest);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("controprova: con un percorso datato i due giri finirebbero in cartelle diverse", () => {
    const datato = (d: Date) => `manifest-${d.toISOString().slice(0, 10)}`;
    expect(datato(new Date("2026-09-11T23:50:00.000Z"))).not.toBe(
      datato(new Date("2026-09-12T00:10:00.000Z")),
    );
  });

  it("un giro chiuso non si riprende: il lavoro dopo un rollback è un giro nuovo", () => {
    const base = radiceTemporanea();
    try {
      const primo = giroPerScrivere(base, "de");
      const m: Manifest = { lingua: "de", iniziato: "x", aggiornato: "x", voci: [] };
      salvaManifest(primo.giro.manifest, m);
      expect(giroCorrente(base, "de")?.id).toBe(primo.giro.id);

      chiudiGiro(primo.giro.manifest, m);
      expect(giroCorrente(base, "de")).toBeNull();

      const secondo = giroPerScrivere(base, "de");
      expect(secondo.ripreso).toBe(false);
      expect(secondo.giro.id).not.toBe(primo.giro.id);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("senza puntatore non c'è giro corrente", () => {
    const base = radiceTemporanea();
    try {
      expect(giroCorrente(base, "de")).toBeNull();
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("un puntatore che indica un giro senza manifest non vale", () => {
    const base = radiceTemporanea();
    try {
      const { giro } = giroPerScrivere(base, "de");
      // Il puntatore c'è, il manifest non è mai stato scritto.
      expect(giro.id).toMatch(/^giro-\d{8}-\d{6}-[0-9a-f]{4}$/);
      expect(giroCorrente(base, "de")).toBeNull();
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("lingue diverse hanno giri diversi", () => {
    const base = radiceTemporanea();
    try {
      const de = giroPerScrivere(base, "de");
      const fr = giroPerScrivere(base, "fr");
      expect(de.giro.id).not.toBe(fr.giro.id);
      expect(de.giro.manifest).not.toBe(fr.giro.manifest);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("sicurezza: la lingua si valida, il percorso resta dentro tmp/traduzioni", () => {
  it("1 · una lingua valida passa e torna tipata", () => {
    expect(validaLingua("de")).toBe("de");
    expect(validaLingua("fr")).toBe("fr");
    expect(validaLingua("it")).toBe("it");
  });

  it("2 · «..» non esce dalla radice", () => {
    const radice = radiceTraduzioni();
    expect(() => percorsoSicuro(join(radice, "..", "..", "etc", "passwd"))).toThrow(
      /percorso fuori da/,
    );
    expect(() => percorsoSicuro("tmp/traduzioni/../../.env.local")).toThrow(/percorso fuori da/);
  });

  it("3 · un percorso assoluto fuori dalla radice viene rifiutato", () => {
    expect(() => percorsoSicuro("/etc/passwd")).toThrow(/percorso fuori da/);
    expect(() => percorsoSicuro("/tmp/manifest.json")).toThrow(/percorso fuori da/);
  });

  it("4 · una lingua inventata viene rifiutata, e il messaggio dice quali sono", () => {
    expect(() => validaLingua("klingon")).toThrow(/lingua non valida/);
    expect(() => validaLingua("")).toThrow(/lingua non valida/);
    expect(() => validaLingua(undefined)).toThrow(/lingua non valida/);
    expect(() => validaLingua("de/../../etc")).toThrow(/lingua non valida/);
    expect(() => validaLingua("klingon")).toThrow(/it, en, de, fr, es/);
  });

  it("un percorso DENTRO la radice passa, e torna risolto", () => {
    const dentro = join(radiceTraduzioni(), "manifest", "de", "giro-x", "manifest.json");
    expect(percorsoSicuro(dentro)).toBe(dentro);
  });

  it("⚠️ una cartella che COMINCIA come la radice non è dentro la radice", () => {
    // `tmp/traduzioni-altro` supera un confronto fatto con `startsWith` sulla
    // stringa nuda: il separatore in coda è quello che lo ferma.
    expect(() => percorsoSicuro(`${radiceTraduzioni()}-altro/manifest.json`)).toThrow(
      /percorso fuori da/,
    );
  });

  it("LINGUE e ALL_LOCALES sono lo stesso elenco, non due copie", () => {
    expect([...LINGUE]).toEqual([...ALL_LOCALES]);
  });
});

describe("il puntatore del giro non è fidato", () => {
  it("⚠️ un puntatore che risale le cartelle non viene seguito", () => {
    const tmp = join(process.cwd(), "tmp");
    mkdirSync(tmp, { recursive: true });
    const base = mkdtempSync(join(tmp, "prova-punt-"));
    try {
      const { giro } = giroPerScrivere(base, "de");
      const vuoto: Manifest = { lingua: "de", iniziato: "x", aggiornato: "x", voci: [] };
      salvaManifest(giro.manifest, vuoto);
      expect(giroCorrente(base, "de")).not.toBeNull();

      // ⚠️ Il bersaglio della risalita deve ESISTERE, con dentro un manifest
      // valido: altrimenti la prova passa per la ragione sbagliata — `existsSync`
      // fallisce comunque — e resterebbe verde anche togliendo la validazione.
      // Misurato: la prima versione di questa prova era verde in tutti e due i casi.
      const fuori = join(base, "fuori-dalla-cartella-dei-giri");
      mkdirSync(fuori, { recursive: true });
      salvaManifest(join(fuori, "manifest.json"), vuoto);
      expect(existsSync(join(fuori, "manifest.json"))).toBe(true);

      writeFileSync(
        join(base, "de", "GIRO-CORRENTE"),
        join("..", "fuori-dalla-cartella-dei-giri"),
        "utf-8",
      );
      expect(giroCorrente(base, "de")).toBeNull();

      // E nemmeno un id di forma diversa passa, anche se la cartella c'è.
      const finto = join(base, "de", "giro-di-prova");
      mkdirSync(finto, { recursive: true });
      salvaManifest(join(finto, "manifest.json"), vuoto);
      writeFileSync(join(base, "de", "GIRO-CORRENTE"), "giro-di-prova", "utf-8");
      expect(giroCorrente(base, "de")).toBeNull();
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("il percorso mostrato a video è relativo, non assoluto", () => {
    const dentro = join(process.cwd(), "tmp", "traduzioni", "manifest", "de", "x.json");
    expect(perIlLog(dentro)).toBe(join("tmp", "traduzioni", "manifest", "de", "x.json"));
    expect(perIlLog(dentro).startsWith("/")).toBe(false);
  });
});

/**
 * ⚠️ **Le bozze CONDIVISE fra lingue** (15/09/2026). Dopo `--execute de` tutte e 640 le bozze
 * esistevano, e con la sola regola «bozza già presente → si salta» il francese non avrebbe
 * scritto niente: 640 saltate, zero scritte, guardia verde su zero attese. Una bozza si
 * completa solo se è NOSTRA in un giro APERTO di un'altra lingua e nessuno l'ha toccata dopo,
 * cioè se la sua `_rev` è ancora il `revDopo` registrato da quel giro.
 */
describe("bozze condivise fra lingue", () => {
  const fr = {
    id: "model-b40l",
    tipo: "model",
    campi: ["name.fr", "description.fr"],
    bozzaEsiste: true,
    pubblicatoEsiste: true,
  };

  it("una bozza nostra di un altro giro e intatta si COMPLETA coi campi della lingua", () => {
    const esito = decidiDocumento({
      ...fr,
      revBozza: "revDE",
      otherRuns: [{ lingua: "de", revDopo: "revDE" }],
    });
    expect(esito.azione).toBe("aggiungi");
    expect(esito.voce).toEqual({
      id: "drafts.model-b40l",
      tipo: "model",
      nostra: true,
      campi: ["name.fr", "description.fr"],
      revPrima: "revDE",
      sharedWith: "de",
    });
  });

  it("⚠️ toccata da una persona dopo l'altro giro: si SALTA, come prima", () => {
    const esito = decidiDocumento({
      ...fr,
      revBozza: "revScrittaDaAndrea",
      otherRuns: [{ lingua: "de", revDopo: "revDE" }],
    });
    expect(esito.azione).toBe("salta");
    expect(esito.voce.nostra).toBe(false);
  });

  it("una bozza che nessun giro registra resta di una persona: si SALTA", () => {
    expect(decidiDocumento({ ...fr, revBozza: "revDE" }).azione).toBe("salta");
    expect(decidiDocumento({ ...fr, revBozza: "revDE", otherRuns: [] }).azione).toBe("salta");
  });

  it("senza la _rev della bozza non c'è prova: si SALTA", () => {
    const esito = decidiDocumento({ ...fr, otherRuns: [{ lingua: "de", revDopo: "revDE" }] });
    expect(esito.azione).toBe("salta");
  });

  it("la catena: lo spagnolo riconosce la _rev scritta dal francese sopra il tedesco", () => {
    const esito = decidiDocumento({
      ...fr,
      campi: ["name.es"],
      revBozza: "revFR",
      otherRuns: [
        { lingua: "de", revDopo: "revDE" },
        { lingua: "fr", revDopo: "revFR" },
      ],
    });
    expect(esito.azione).toBe("aggiungi");
    expect(esito.voce.sharedWith).toBe("fr");
  });

  it("⚠️ il rollback di una bozza condivisa toglie i campi e non la cancella MAI, nemmeno intatta", () => {
    const condivisa = {
      id: "drafts.model-b40l",
      tipo: "model",
      nostra: true,
      campi: ["name.fr"],
      revDopo: "revFR",
      sharedWith: "de",
    };
    const esito = decidiRollback(condivisa, "revFR");
    expect(esito.azione).toBe("togli-campi");
    // controprova: la stessa voce senza sharedWith si cancellerebbe
    expect(decidiRollback({ ...condivisa, sharedWith: undefined }, "revFR").azione).toBe(
      "cancella",
    );
  });

  it("la guardia dell'import conta le condivise fra le nostre", () => {
    const m = vuoto();
    registra(
      m,
      decidiDocumento({ ...fr, revBozza: "revDE", otherRuns: [{ lingua: "de", revDopo: "revDE" }] })
        .voce,
    );
    expect(idNostriDistinti(m)).toEqual(["drafts.model-b40l"]);
  });

  it("legge solo i giri APERTI delle ALTRE lingue, e solo le voci nostre con revDopo", () => {
    const tmp = join(process.cwd(), "tmp");
    mkdirSync(tmp, { recursive: true });
    const base = mkdtempSync(join(tmp, "prova-condivise-"));
    try {
      const de = giroPerScrivere(base, "de");
      salvaManifest(de.giro.manifest, {
        lingua: "de",
        iniziato: "x",
        aggiornato: "x",
        voci: [
          { id: "drafts.a", tipo: "model", nostra: true, campi: ["name.de"], revDopo: "r1" },
          { id: "drafts.b", tipo: "model", nostra: true, campi: ["name.de"] },
          {
            id: "drafts.c",
            tipo: "model",
            nostra: false,
            campi: [],
            saltata: "bozza già presente",
          },
        ],
      });
      const es = giroPerScrivere(base, "es");
      const mEs: Manifest = {
        lingua: "es",
        iniziato: "x",
        aggiornato: "x",
        voci: [{ id: "drafts.a", tipo: "model", nostra: true, campi: ["name.es"], revDopo: "r9" }],
      };
      salvaManifest(es.giro.manifest, mEs);
      chiudiGiro(es.giro.manifest, mEs);

      const letti = draftsOwnedByOtherRuns(base, ["de", "es"]);
      expect([...letti.keys()]).toEqual(["drafts.a"]);
      // Una voce pubblicata col publish per campi ha passato la firma alle lingue rimaste.
      const mDe = JSON.parse(readFileSync(de.giro.manifest, "utf-8")) as Manifest;
      mDe.voci[0].publishedAt = "2026-09-15T12:00:00Z";
      salvaManifest(de.giro.manifest, mDe);
      expect(draftsOwnedByOtherRuns(base, ["de"]).size).toBe(0);
      mDe.voci[0].publishedAt = undefined;
      salvaManifest(de.giro.manifest, mDe);
      expect(letti.get("drafts.a")).toEqual([{ lingua: "de", revDopo: "r1" }]);
      // controprova: la lingua corrente non si legge da sé
      expect(draftsOwnedByOtherRuns(base, ["es"]).size).toBe(0);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("F · tre lingue sulle stesse 640 bozze, con le funzioni vere", () => {
  /** Sanity in memoria: id della bozza → `_rev`. Ogni scrittura cambia la `_rev`. */
  function giroLingua(
    lingua: string,
    m: Manifest,
    sanity: Map<string, string>,
    altri: ReadonlyArray<{ lingua: string; m: Manifest }>,
  ) {
    const firme = new Map<string, Array<{ lingua: string; revDopo: string }>>();
    for (const g of altri)
      for (const v of g.m.voci)
        if (v.nostra && !v.saltata && v.revDopo)
          firme.set(v.id, [...(firme.get(v.id) ?? []), { lingua: g.lingua, revDopo: v.revDopo }]);
    const conta = { crea: 0, aggiungi: 0, salta: 0 };
    for (const id of IDS) {
      const bozza = idBozza(id);
      const esito = decidiDocumento({
        id,
        tipo: "model",
        campi: [`name.${lingua}`],
        bozzaEsiste: sanity.has(bozza),
        pubblicatoEsiste: true,
        revBozza: sanity.get(bozza),
        otherRuns: firme.get(bozza),
      });
      conta[esito.azione] += 1;
      if (esito.azione !== "salta") {
        const rev = `rev-${lingua}-${id}`;
        sanity.set(bozza, rev);
        esito.voce.revDopo = rev;
      }
      registra(m, esito.voce);
    }
    return conta;
  }

  it("DE crea, FR e ES completano; una bozza toccata da Andrea dopo DE resta fuori", () => {
    const sanity = new Map<string, string>();
    const de = vuoto();
    expect(giroLingua("de", de, sanity, [])).toEqual({ crea: 640, aggiungi: 0, salta: 0 });

    // Andrea apre una bozza in Studio dopo il tedesco.
    sanity.set(idBozza(IDS[5]), "rev-andrea");

    const fr = { ...vuoto(), lingua: "fr" };
    expect(giroLingua("fr", fr, sanity, [{ lingua: "de", m: de }])).toEqual({
      crea: 0,
      aggiungi: 639,
      salta: 1,
    });
    const es = { ...vuoto(), lingua: "es" };
    expect(
      giroLingua("es", es, sanity, [
        { lingua: "de", m: de },
        { lingua: "fr", m: fr },
      ]),
    ).toEqual({ crea: 0, aggiungi: 639, salta: 1 });

    // Il rollback di FR non cancella nessuna bozza: sono tutte condivise.
    const azioniFr = fr.voci.map((v) => decidiRollback(v, sanity.get(v.id)).azione);
    expect(azioniFr.filter((a) => a === "cancella")).toHaveLength(0);
    expect(azioniFr.filter((a) => a === "togli-campi")).toHaveLength(639);
    // Il rollback di DE non cancella le bozze che FR ed ES hanno completato dopo.
    const azioniDe = de.voci.map((v) => decidiRollback(v, sanity.get(v.id)).azione);
    expect(azioniDe.filter((a) => a === "cancella")).toHaveLength(0);
  });
});
