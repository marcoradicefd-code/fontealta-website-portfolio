import { describe, expect, it } from "vitest";

import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import messaggiIt from "@/messages/it.json";

import {
  dataConArticoloIt,
  dataPerEsteso,
  parseLegalInline,
  riempiSegnaposto,
  valoriSocieta,
} from "./legal-sections";

describe("parseLegalInline", () => {
  it("separa il grassetto dal testo", () => {
    expect(
      parseLegalInline("<b>Il Sito non è un negozio online</b>: non consente acquisti."),
    ).toEqual([
      { kind: "bold", text: "Il Sito non è un negozio online" },
      { kind: "text", text: ": non consente acquisti." },
    ]);
  });

  it("riconosce l’email e l’indirizzo del Garante, e lascia il punto finale fuori dal link", () => {
    expect(
      parseLegalInline("Scrivere a info@fontealta.it. Reclamo al Garante (www.gpdp.it)."),
    ).toEqual([
      { kind: "text", text: "Scrivere a " },
      { kind: "email", text: "info@fontealta.it" },
      { kind: "text", text: ". Reclamo al Garante (" },
      { kind: "url", text: "www.gpdp.it" },
      { kind: "text", text: ")." },
    ]);
  });

  it("non trasforma in link un dominio senza www né un nome con il punto", () => {
    // «fontealta.it» nei termini d'uso è il nome del sito, non un invito a cliccare;
    // «S.r.l.» e «D.Lgs.» non sono indirizzi.
    const segmenti = parseLegalInline(
      "Il sito fontealta.it di Rubinetteria F & F L’Artigiana S.r.l., D.Lgs. 196/2003.",
    );
    expect(segmenti).toEqual([
      {
        kind: "text",
        text: "Il sito fontealta.it di Rubinetteria F & F L’Artigiana S.r.l., D.Lgs. 196/2003.",
      },
    ]);
  });

  it("un testo senza marcatori resta un solo segmento", () => {
    expect(parseLegalInline("Durata: di sessione.")).toEqual([
      { kind: "text", text: "Durata: di sessione." },
    ]);
  });
});

describe("sezione «societa» (26/10/2026)", () => {
  it("riempie i segnaposto noti e lascia quelli sconosciuti", () => {
    expect(riempiSegnaposto("REA {rea}, {ignoto}", { rea: "LU-166066" })).toBe(
      "REA LU-166066, {ignoto}",
    );
    // `constructor` è una chiave di ogni oggetto: non deve passare per un valore.
    expect(riempiSegnaposto("{constructor}", {})).toBe("{constructor}");
  });

  it("scrive la scadenza per esteso in ogni lingua, giorno prima del mese", () => {
    expect(dataPerEsteso("2027-06-11", "it")).toBe("11 giugno 2027");
    expect(dataPerEsteso("2027-06-11", "en")).toBe("11 June 2027");
    expect(dataPerEsteso("2027-06-11", "de")).toBe("11. Juni 2027");
    expect(dataPerEsteso("2027-06-11", "fr")).toBe("11 juin 2027");
    expect(dataPerEsteso("2027-06-11", "es")).toBe("11 de junio de 2027");
  });

  it("mette la preposizione italiana giusta: all’8, all’11, al 1°, al 3", () => {
    expect(dataConArticoloIt("2027-06-11")).toBe("all’11 giugno 2027");
    expect(dataConArticoloIt("2027-06-08")).toBe("all’8 giugno 2027");
    expect(dataConArticoloIt("2027-06-01")).toBe("al 1° giugno 2027");
    expect(dataConArticoloIt("2027-06-03")).toBe("al 3 giugno 2027");
  });

  it("riconosce la PEC, che ha un trattino basso, come indirizzo email", () => {
    expect(parseLegalInline("PEC fontealta_lartigiana@pec.it.")).toEqual([
      { kind: "text", text: "PEC " },
      { kind: "email", text: "fontealta_lartigiana@pec.it" },
      { kind: "text", text: "." },
    ]);
  });

  const DIZIONARI = { it: messaggiIt, en, de, fr, es } as const;
  for (const [lingua, d] of Object.entries(DIZIONARI)) {
    it(`${lingua}: nessun segnaposto resta vuoto, a parte i due PDF`, () => {
      const valori = valoriSocieta(lingua);
      for (const blocco of d.legale.sezioni.societa.blocchi) {
        const testo = Object.values(blocco)[0];
        const pieno = riempiSegnaposto(testo, valori).replaceAll(/\{(certificato|politica)\}/g, "");
        expect(pieno, testo).not.toMatch(/[{}]/);
      }
    });
  }
});
