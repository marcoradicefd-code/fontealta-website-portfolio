import { describe, expect, it, vi, afterEach } from "vitest";

import { scegliImmagineCard } from "./card-image";

/** Casi VERI, presi dal dataset il 31/08/2026 — non inventati: sono le coppie che
 *  fanno cadere un matcher scritto con `match` o senza case-insensitive. */
// `alt` tipizzato nullable: sul dataset può mancare, e il generico deve
// accomodarlo senza che il test lo aggiri con un cast.
const img = (alt: string): { alt: string | null } => ({ alt });

afterEach(() => vi.restoreAllMocks());

describe("scegliImmagineCard", () => {
  it("sceglie la composizione della collezione di pagina (WX30.SK su Classy)", () => {
    const primary = img("Colonna doccia WX30.SK, collezione Skinny");
    const classy = img("Colonna doccia WX30.SK, collezione Classy");
    expect(
      scegliImmagineCard({
        primary,
        gallery: [classy],
        collectionTitle: "Classy",
        collectionTitles: ["Skinny", "Classy"],
      }),
    ).toBe(classy);
  });

  // ⛔ LA TRAPPOLA. Con `match` di GROQ o con un `includes`, «collezione Boss»
  // combacerebbe dentro «collezione Boss Wide» e la pagina Boss mostrerebbe lo
  // sfondo di Boss Wide. L'endsWith esatto sulla coda le distingue.
  it("Boss NON prende la galleria di Boss Wide: torna la primary", () => {
    const primary = img("Colonna doccia WX44.SK, collezione Boss");
    const bossWide = img("Colonna doccia WX44.SK, collezione Boss Wide");
    expect(
      scegliImmagineCard({
        primary,
        gallery: [bossWide],
        collectionTitle: "Boss",
        collectionTitles: ["Boss", "Boss Wide"],
      }),
    ).toBe(primary);
  });

  it("Boss Wide prende la sua galleria", () => {
    const primary = img("Colonna doccia WX44.SK, collezione Boss");
    const bossWide = img("Colonna doccia WX44.SK, collezione Boss Wide");
    expect(
      scegliImmagineCard({
        primary,
        gallery: [bossWide],
        collectionTitle: "Boss Wide",
        collectionTitles: ["Boss", "Boss Wide"],
      }),
    ).toBe(bossWide);
  });

  it("Club NON prende la galleria di Club Large, e Club Large sì", () => {
    const primary = img("Colonna doccia WX54.SK, collezione Club");
    const clubLarge = img("Colonna doccia WX54.SK, collezione Club Large");
    const base = { primary, gallery: [clubLarge], collectionTitles: ["Club", "Club Large"] };
    expect(scegliImmagineCard({ ...base, collectionTitle: "Club" })).toBe(primary);
    expect(scegliImmagineCard({ ...base, collectionTitle: "Club Large" })).toBe(clubLarge);
  });

  // Il documento ILLE ha title «ILLE», gli alt dicono «Ille».
  it("combacia a prescindere dal caso (ILLE / Ille)", () => {
    const primary = img("Miscelatore I30, collezione Skinny");
    const ille = img("Miscelatore I30, collezione Ille");
    expect(
      scegliImmagineCard({
        primary,
        gallery: [ille],
        collectionTitle: "ILLE",
        collectionTitles: ["Skinny", "ILLE"],
      }),
    ).toBe(ille);
  });

  it("mono-collezione senza galleria: torna la primary", () => {
    const primary = img("Miscelatore I30, collezione ILLE");
    expect(scegliImmagineCard({ primary, gallery: null, collectionTitle: "ILLE" })).toBe(primary);
    expect(scegliImmagineCard({ primary, gallery: [], collectionTitle: "ILLE" })).toBe(primary);
  });

  it("nessuna coda combacia: torna la primary e avvisa", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = img("Colonna WX99, collezione Skinny");
    const altra = img("Colonna WX99, collezione Twiggy");
    expect(
      scegliImmagineCard({ primary, gallery: [altra], collectionTitle: "Origo", id: "model-wx99" }),
    ).toBe(primary);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("model-wx99");
  });

  // La posizione è la CONTROPROVA, non la chiave: se discordano vince la coda
  // dell'alt, e si fa rumore.
  it("posizione discorde: usa comunque la coda dell'alt, ma avvisa", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = img("Colonna WX83.SK, collezione Skinny");
    const origo = img("Colonna WX83.SK, collezione Origo");
    const scelta = scegliImmagineCard({
      primary,
      gallery: [origo],
      collectionTitle: "Origo",
      // collections riordinate da Studio: in posizione 1 non c'è più Origo
      collectionTitles: ["Skinny", "Twiggy", "Origo"],
      id: "model-wx83sk",
    });
    expect(scelta).toBe(origo);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("discordi");
  });

  it("posizione concorde: nessun avviso", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = img("Colonna WX83.SK, collezione Skinny");
    const classy = img("Colonna WX83.SK, collezione Classy");
    expect(
      scegliImmagineCard({
        primary,
        gallery: [classy],
        collectionTitle: "Classy",
        collectionTitles: ["Skinny", "Classy"],
      }),
    ).toBe(classy);
    expect(warn).not.toHaveBeenCalled();
  });

  it("alt con spazi in coda o assente non rompe nulla", () => {
    const primary = img("Colonna WX30.SK, collezione Skinny");
    const classy: { alt: string | null } = { alt: "  Colonna WX30.SK, collezione Classy  " };
    expect(scegliImmagineCard({ primary, gallery: [classy], collectionTitle: "Classy" })).toBe(
      classy,
    );
    const senzaAlt: { alt: string | null } = { alt: null };
    expect(scegliImmagineCard({ primary, gallery: [senzaAlt], collectionTitle: "Classy" })).toBe(
      primary,
    );
  });
});
