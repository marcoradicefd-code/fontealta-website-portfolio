import { inflateSync } from "node:zlib";

/**
 * Decodifica di un PNG di Playwright in pixel RGB, senza dipendenze.
 *
 * ⚠️ **Perché non `sharp`.** C'è nel `node_modules`, ma come dipendenza di Next e
 * non nostra: con pnpm non è risolvibile per nome dalla radice, e appoggiarsi a una
 * transitiva vuol dire un test che si rompe il giorno che Next la cambia. Gli
 * screenshot di Playwright sono PNG a 8 bit, RGB o RGBA, non interlacciati: bastano
 * i cinque filtri di riga dello standard.
 */
export interface Immagine {
  larghezza: number;
  altezza: number;
  /** Tre byte per pixel, riga per riga. */
  rgb: Uint8Array;
}

export function decodificaPng(png: Buffer): Immagine {
  let pos = 8;
  let larghezza = 0;
  let altezza = 0;
  let canali = 0;
  const idat: Buffer[] = [];
  while (pos < png.length) {
    const lung = png.readUInt32BE(pos);
    const tipo = png.toString("ascii", pos + 4, pos + 8);
    const dati = png.subarray(pos + 8, pos + 8 + lung);
    if (tipo === "IHDR") {
      larghezza = dati.readUInt32BE(0);
      altezza = dati.readUInt32BE(4);
      const profondita = dati[8];
      const colore = dati[9];
      if (profondita !== 8 || (colore !== 2 && colore !== 6) || dati[12] !== 0)
        throw new Error(
          `PNG non gestito: profondità ${profondita}, colore ${colore}, interlacciato ${dati[12]}`,
        );
      canali = colore === 6 ? 4 : 3;
    } else if (tipo === "IDAT") idat.push(dati);
    else if (tipo === "IEND") break;
    pos += 12 + lung;
  }
  const grezzo = inflateSync(Buffer.concat(idat));
  const riga = larghezza * canali;
  const pixel = new Uint8Array(altezza * riga);
  for (let y = 0; y < altezza; y++) {
    const filtro = grezzo[y * (riga + 1)];
    const inizio = y * (riga + 1) + 1;
    for (let x = 0; x < riga; x++) {
      const a = x >= canali ? pixel[y * riga + x - canali] : 0;
      const b = y > 0 ? pixel[(y - 1) * riga + x] : 0;
      const c = y > 0 && x >= canali ? pixel[(y - 1) * riga + x - canali] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const predetto = [0, a, b, (a + b) >> 1, paeth][filtro];
      pixel[y * riga + x] = (grezzo[inizio + x] + predetto) & 0xff;
    }
  }
  const rgb = new Uint8Array(larghezza * altezza * 3);
  for (let i = 0, j = 0; i < pixel.length; i += canali, j += 3)
    rgb.set(pixel.subarray(i, i + 3), j);
  return { larghezza, altezza, rgb };
}

/** Luminanza media (0-255, pesi Rec. 709) di un rettangolo dell'immagine. */
export function luminanzaMedia(
  img: Immagine,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let somma = 0;
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * img.larghezza + x) * 3;
      somma += 0.2126 * img.rgb[i] + 0.7152 * img.rgb[i + 1] + 0.0722 * img.rgb[i + 2];
      n++;
    }
  return somma / n;
}

/** Il colore di un pixel, come terna. */
export function pixel(img: Immagine, x: number, y: number): [number, number, number] {
  const i = (y * img.larghezza + x) * 3;
  return [img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]];
}
