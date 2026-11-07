import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { OG_DEFAULT_IMAGE } from "@/lib/open-graph";

/**
 * Guardie sulle due immagini di marca: la card OG e la favicon.
 *
 * Sono file binari, e i file binari sono la cosa più facile da sostituire per
 * sbaglio: un export rifatto, un ottimizzatore che passa, un merge che prende il
 * lato sbagliato. Nessun typecheck e nessun lint se ne accorge, e il difetto si
 * vede solo dove non lo guarda nessuno, cioè nell'anteprima di un link
 * condiviso su WhatsApp o nella linguetta del browser.
 *
 * ⚠️ **La lettura dei file sta DENTRO le funzioni chiamate dagli `it`,** e i
 * percorsi si risolvono da `process.cwd()`. Una `readFileSync` nel corpo di un
 * `describe`, o un percorso costruito con `import.meta.url`, fa fallire il file
 * in fase di RACCOLTA sotto jsdom: e un file che fallisce lì non diventa rosso,
 * sparisce, cioè si legge «0 test». È già successo quattro volte su questo repo.
 *
 * L'impronta è del file COMMITTATO. Che quello committato sia anche quello
 * SERVITO lo prova `tests/regression/immagini-di-marca.spec.ts`, che scarica i
 * byte dal server e li confronta col file su disco: due domande diverse, due
 * guardie diverse, e nessuna delle due ripete l'impronta dell'altra.
 */

/** Impronte dei file approvati da Marco il 10 settembre 2026: fondo `--fa-ink`
 *  (#0b1215), monogramma, wordmark Satoshi sulla card. */
const IMPRONTE = {
  og: "d303e9411cd3350e4e24c20c890ff5e480ee168a4ed24db1ee1d8879a36859b2",
  favicon: "bb115b4495a1933a723f7e2b9c5e05cdb31c97b12f8eb233c47bd26558654f09",
  icona: "d3da520ece9c8d0774937320760b4181a7e66299f74f3d4aeffd15e1fb00f097",
  apple: "026b5b4044410824e60e88affd5cd7bb737ac25e7f400bf87b96f3768584a427",
} as const;

const PERCORSI = {
  og: "public/og-default.jpg",
  favicon: "src/app/favicon.ico",
  icona: "src/app/icon.png",
  apple: "src/app/apple-icon.png",
} as const;

function bytes(chiave: keyof typeof PERCORSI): Buffer {
  return readFileSync(resolve(process.cwd(), PERCORSI[chiave]));
}

function impronta(chiave: keyof typeof PERCORSI): string {
  return createHash("sha256").update(bytes(chiave)).digest("hex");
}

/**
 * Larghezza e altezza di un JPEG, lette dal marcatore SOF.
 *
 * Scritta a mano invece di aggiungere una dipendenza: servono due numeri, una
 * volta sola, su un file che sta nel repo. I marcatori SOF sono `FFC0`-`FFCF`
 * tranne `FFC4` (tabelle di Huffman), `FFC8` e `FFCC`, che non descrivono un
 * fotogramma.
 */
function dimensioniJpeg(buf: Buffer): { larghezza: number; altezza: number } {
  if (buf.readUInt16BE(0) !== 0xffd8) throw new Error("non è un JPEG");
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marcatore = buf[i + 1];
    const sof = marcatore >= 0xc0 && marcatore <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcatore);
    if (sof) return { altezza: buf.readUInt16BE(i + 5), larghezza: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("marcatore SOF non trovato");
}

/**
 * Larghezza e altezza di un PNG: stanno nell'IHDR, che per definizione del
 * formato è il primo chunk e comincia sempre al byte 8. Due `readUInt32BE`, e
 * nessuna dipendenza.
 */
function dimensioniPng(buf: Buffer): { larghezza: number; altezza: number } {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("non è un PNG");
  return { larghezza: buf.readUInt32BE(16), altezza: buf.readUInt32BE(20) };
}

/** I lati dichiarati nella directory di un ICO. Lo zero vale 256: un byte non
 *  arriva a quel numero, ed è la convenzione del formato. */
function latiIco(buf: Buffer): number[] {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error("non è un ICO");
  const quante = buf.readUInt16LE(4);
  return Array.from({ length: quante }, (_, i) => buf[6 + 16 * i] || 256);
}

describe("immagini di marca", () => {
  it("la card OG è il file approvato", () => {
    expect(impronta("og")).toBe(IMPRONTE.og);
  });

  it("la favicon è il file approvato", () => {
    expect(impronta("favicon")).toBe(IMPRONTE.favicon);
  });

  /**
   * Il vincolo che lega il codice al file: `og:image:width` e `og:image:height`
   * escono da `OG_DEFAULT_IMAGE`, non dall'immagine. Se qualcuno sostituisce il
   * file con uno di forma diversa e non tocca la costante, l'HTML dichiara
   * misure che il file non ha, e i crawler social ritagliano su quelle.
   */
  it("le misure dichiarate nel codice sono quelle del file", () => {
    const { larghezza, altezza } = dimensioniJpeg(bytes("og"));
    expect({ larghezza, altezza }).toEqual({ larghezza: 1200, altezza: 630 });
    expect(OG_DEFAULT_IMAGE.width).toBe(larghezza);
    expect(OG_DEFAULT_IMAGE.height).toBe(altezza);
  });

  it("la costante punta al file che sta in `public/`", () => {
    expect(OG_DEFAULT_IMAGE.url).toBe(`/${PERCORSI.og.replace("public/", "")}`);
  });

  /**
   * Le quattro misure servono a quattro posti diversi: 16 la linguetta, 32 la
   * barra dei preferiti, 48 il collegamento sul desktop di Windows, 256 il
   * riquadro grande e ciò che Next scrive in `sizes` sul `<link rel="icon">`.
   * Un ICO con la sola 16 non è rotto, è solo sgranato ovunque tranne che nella
   * linguetta, e nessuno lo nota finché non lo guarda su uno schermo denso.
   */
  it("la favicon porta tutte e quattro le misure", () => {
    expect(latiIco(bytes("favicon")).sort((a, b) => a - b)).toEqual([16, 32, 48, 256]);
  });

  it("l'icona grande e quella di Apple sono i file approvati", () => {
    expect(impronta("icona")).toBe(IMPRONTE.icona);
    expect(impronta("apple")).toBe(IMPRONTE.apple);
  });

  /**
   * Le misure non sono intercambiabili: Next le legge dal file e le scrive nel
   * `sizes` del `<link>`, quindi un file di lato sbagliato non è solo più brutto,
   * fa dichiarare al browser una cosa falsa. 180 è la misura che iOS vuole per la
   * schermata home; 512 è quella che serve a un manifest e agli schermi densi.
   */
  it("l'icona grande è 512 e quella di Apple è 180", () => {
    expect(dimensioniPng(bytes("icona"))).toEqual({ larghezza: 512, altezza: 512 });
    expect(dimensioniPng(bytes("apple"))).toEqual({ larghezza: 180, altezza: 180 });
  });
});
