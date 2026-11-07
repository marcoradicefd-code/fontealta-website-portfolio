/**
 * La parte pura di `contenuti-carica.ts`: leggere i file di Cowork e controllarli (spec
 * `docs/specs/contenuti-per-lingua.md` § C). Niente rete, niente Sanity: si prova coi test.
 *
 * Forma dei file (come le FAQ): front matter con `sezione` e `lang`, poi una voce per `## <chiave>`.
 * I commenti `<!-- -->` non arrivano mai su Sanity. Nelle collezioni le righe sono
 * `tagline: …`, `metaTitle: …`, `metaDescription: …`; nelle altre sezioni il testo è il corpo.
 */

import {
  ATTACCHI,
  CHIAVI_MISURA,
  formaDellaRiga,
  type ChiaveMisura,
  type FamigliaMisure,
} from "../../sanity/schemas/objects/misure-chiavi";

/** Le sezioni dei file di Cowork; `misure` legge l'estrazione dei disegni, non un file `.md`. */
export const SEZIONI_MD = ["collezioni", "alt-blog", "alt-autori", "descrizioni"] as const;
export const SEZIONI = [...SEZIONI_MD, "misure"] as const;
export type Sezione = (typeof SEZIONI)[number];
export type LinguaFile = "it" | "en" | "de" | "fr" | "es";

export interface Voce {
  chiave: string;
  campi: Record<string, string>;
}
export interface FileContenuti {
  sezione: Sezione;
  lang: LinguaFile;
  voci: Voce[];
}
export interface Problema {
  livello: "errore" | "avviso";
  chiave: string;
  campo: string;
  messaggio: string;
}

const SEGNAPOSTO = /^(TAGLINE|TITOLO|DESCRIZIONE|ALT|TESTO)$/;

export function parseFile(testo: string): FileContenuti {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(testo);
  if (!fm) throw new Error("manca il front matter");
  const meta = Object.fromEntries(
    fm[1].split("\n").map((r) => r.split(":").map((x) => x.trim()) as [string, string]),
  );
  const sezione = meta.sezione as Sezione;
  const lang = meta.lang as LinguaFile;
  if (!(SEZIONI_MD as readonly string[]).includes(sezione))
    throw new Error(`sezione sconosciuta: ${sezione}`);
  const corpo = testo.slice(fm[0].length).replace(/<!--[\s\S]*?-->/g, "");
  const voci: Voce[] = [];
  for (const pezzo of corpo.split(/^## /m).slice(1)) {
    const [testa, ...resto] = pezzo.split("\n");
    const righe = resto.map((r) => r.trim()).filter(Boolean);
    const campi: Record<string, string> = {};
    if (sezione === "collezioni")
      for (const r of righe) {
        const m = /^(tagline|metaTitle|metaDescription):\s*(.*)$/.exec(r);
        if (m) campi[m[1]] = m[2].trim();
      }
    else campi.testo = righe.join(" ").trim();
    voci.push({ chiave: testa.trim(), campi });
  }
  return { sezione, lang, voci };
}

/** I controlli tipografici del sito su un testo di una lingua. */
export function tipografia(testo: string, lang: LinguaFile): string[] {
  const p: string[] = [];
  if (/'/.test(testo)) p.push("apostrofo dritto (va ’)");
  if (/—|–/.test(testo)) p.push("trattino lungo o medio");
  if (/ {2,}/.test(testo)) p.push("doppio spazio");
  if (lang === "fr") {
    if (/ [?:;!»]/.test(testo)) p.push("spazio normale prima di ? : ; ! » (va U+00A0)");
    if (/« /.test(testo)) p.push("spazio normale dopo « (va U+00A0)");
  }
  return p;
}

/** I limiti del title servito e della description (Marco, 2/11/2026). */
export const LIMITI = { metaTitle: [38, 48], metaDescription: [140, 155] } as const;

export function controllaFile(f: FileContenuti): Problema[] {
  const out: Problema[] = [];
  const visti = new Map<string, string>();
  for (const v of f.voci)
    for (const [campo, testo] of Object.entries(v.campi)) {
      const err = (messaggio: string) =>
        out.push({ livello: "errore", chiave: v.chiave, campo, messaggio });
      if (!testo) {
        // Una tagline vuota si toglie da Sanity (Marco, 4/11/2026): è una scelta, non un buco.
        // Title e description vuoti restano un errore.
        if (!(f.sezione === "collezioni" && campo === "tagline")) err("vuoto");
        continue;
      }
      if (SEGNAPOSTO.test(testo)) err("segnaposto non sostituito");
      for (const t of tipografia(testo, f.lang)) err(t);
      const limite = LIMITI[campo as keyof typeof LIMITI];
      const n = [...testo].length;
      if (limite && (n < limite[0] || n > limite[1]))
        err(`${n} caratteri, fuori da ${limite[0]}-${limite[1]}`);
      // Nessun doppione fra le voci di una lingua, campo per campo (title, description, tagline, alt).
      // Non nelle descrizioni: articoli di collezioni diverse hanno la stessa descrizione di catalogo.
      if (f.sezione === "descrizioni") continue;
      const firma = `${campo}|${testo.toLowerCase()}`;
      const gia = visti.get(firma);
      if (gia) err(`uguale a quello di «${gia}»`);
      else visti.set(firma, v.chiave);
    }
  return out;
}

/**
 * Le correzioni meccaniche delle descrizioni (decisione di Marco, 2/11/2026): «Aisi» → «AISI»,
 * apostrofo dritto → tipografico, maiuscola iniziale. Le misure nel testo restano.
 */
export function correzioniMeccaniche(testo: string, lang: LinguaFile): string {
  const t = testo.replace(/\bAisi\b/g, "AISI").replace(/'/g, "’");
  return t ? t.charAt(0).toLocaleUpperCase(lang) + t.slice(1) : t;
}

/** Un blocco di testo semplice di Portable Text: un solo blocco, un solo span, senza marks. */
interface Blocco {
  _key: string;
  _type: string;
  children?: Array<{ _key: string; _type: string; text?: string; marks?: string[] }>;
  [k: string]: unknown;
}

/** Il testo di una descrizione, se ha la forma semplice che lo script sa riscrivere. */
export function testoSemplice(blocchi: unknown): string | null {
  if (!Array.isArray(blocchi) || blocchi.length !== 1) return null;
  const b = blocchi[0] as Blocco;
  if (b._type !== "block" || b.children?.length !== 1 || (b.children[0].marks ?? []).length)
    return null;
  return b.children[0].text ?? "";
}

/** Gli stessi blocchi con il testo nuovo: chiavi e struttura invariate. */
export function conTesto(blocchi: unknown, testo: string): Blocco[] {
  const [b] = blocchi as Blocco[];
  const [s] = b.children ?? [];
  return [{ ...b, children: [{ ...s, text: testo }] }];
}

/**
 * La sezione `misure` (spec `docs/specs/misure.md`): le righe dell'estrazione dai disegni del
 * listino, `tmp/misure/<collezione>-misure.json`, nella forma di `specs`. Le quote senza un nome
 * certo («quota (N)») non si scrivono; un articolo senza nessuna misura con nome resta senza `specs`.
 */
export interface RigaEstrazione {
  code: string;
  collezione: string;
  /** `06-002` (listino Edition V / R4) o `ille` (listino ILLE REV_07-001). */
  fonte: string;
  stampata: number;
  tipo: string;
  misure: Array<{
    nome: string;
    valore?: number;
    min?: number;
    max?: number;
    tolleranza?: number;
    lati?: number[];
    nota?: string;
  }>;
  attacchi: string[];
}

interface RigaSpecs {
  _key: string;
  _type: "misura";
  chiave: ChiaveMisura;
  valore?: number;
  min?: number;
  max?: number;
  regolabile?: true;
  tolleranza?: number;
  lati?: number[];
}
export interface SpecsSanity {
  _type: "specsMisure";
  famiglia?: FamigliaMisure;
  misure: RigaSpecs[];
  attacchi?: string[];
  fonte: { documento: string; pagina: number };
  stato: "daVerificare";
}

// I nomi dell'estrazione, in italiano come nei disegni. «(lato)» è il lato di un quadrato.
const NOME_CHIAVE: Record<string, ChiaveMisura> = {
  "altezza totale": "altezzaTotale",
  "altezza bocca": "altezzaBocca",
  "altezza soffione": "altezzaSoffione",
  "altezza comando": "altezzaComando",
  "altezza doccetta": "altezzaDoccetta",
  altezza: "altezza",
  sporgenza: "sporgenza",
  "sporgenza bocca": "sporgenzaBocca",
  "Ø tubo": "diametroTubo",
  "Ø base": "diametroBase",
  base: "base",
  "base (lato)": "base",
  "spessore piano max": "spessorePianoMax",
  "Ø placca": "diametroPlacca",
  placca: "placca",
  "interasse attacchi": "interasseAttacchi",
  "Ø soffione": "diametroSoffione",
  soffione: "soffione",
  "soffione (lato)": "soffione",
  lunghezza: "lunghezza",
  larghezza: "larghezza",
  profondità: "profondita",
  Ø: "diametro",
};

// «altro» (i pannelli P22 e P9) non ha famiglia: senza famiglia non c'è misura principale.
const FAMIGLIA: Record<string, FamigliaMisure> = {
  colonna: "colonna",
  piano: "piano",
  incasso: "incasso",
  "gruppo a parete": "gruppoParete",
  "kit doccia": "kitDoccia",
  soffione: "soffione",
  accessorio: "accessorio",
  "corpo incasso": "corpoIncasso",
};

const DOCUMENTO: Record<string, string> = {
  "06-002": "listinoEditionV-06-002",
  ille: "listinoIlle-REV07-001",
};

/** `specs` di una riga, o `null` se non resta nessuna misura con nome. */
export function specsDaRiga(r: RigaEstrazione): {
  specs: SpecsSanity | null;
  problemi: Problema[];
} {
  const problemi: Problema[] = [];
  const p = (livello: Problema["livello"], campo: string, messaggio: string) =>
    problemi.push({ livello, chiave: r.code, campo, messaggio });
  const conNome = r.misure.filter((m) => !m.nome.startsWith("quota"));
  const perChiave = new Map<ChiaveMisura, typeof conNome>();
  for (const m of conNome) {
    const chiave = NOME_CHIAVE[m.nome];
    if (!chiave || !(CHIAVI_MISURA as readonly string[]).includes(chiave)) {
      p("errore", m.nome, "nome di misura sconosciuto");
      continue;
    }
    perChiave.set(chiave, [...(perChiave.get(chiave) ?? []), m]);
  }
  const misure: RigaSpecs[] = [];
  for (const [chiave, righe] of perChiave) {
    if (righe.length > 1) {
      // Due quote con lo stesso nome: quale sia quale lo dirà la scheda tecnica.
      p(
        "avviso",
        chiave,
        `chiave doppia (${righe.map((m) => m.valore).join(" / ")}), non si scrive`,
      );
      continue;
    }
    const [m] = righe;
    const riga: RigaSpecs = { _key: chiave, _type: "misura", chiave };
    if (m.lati) riga.lati = m.lati;
    else if (/\(lato\)$/.test(m.nome) && typeof m.valore === "number")
      riga.lati = [m.valore, m.valore];
    else if (typeof m.min === "number" || typeof m.max === "number") {
      Object.assign(riga, { min: m.min, max: m.max });
      if (/due valori/i.test(m.nota ?? "")) riga.regolabile = true;
    } else {
      riga.valore = m.valore;
      if (typeof m.tolleranza === "number") riga.tolleranza = m.tolleranza;
    }
    const forma = formaDellaRiga(riga);
    if (forma !== true) p("errore", chiave, forma);
    else misure.push(riga);
  }
  if (!misure.length) return { specs: null, problemi };

  const attacchi: string[] = [];
  for (const a of r.attacchi) {
    // «N°2 G1/2"»: due attacchi uguali.
    const n = /^N°(\d+) (.+)$/.exec(a);
    const [quanti, quale] = n ? [Number(n[1]), n[2]] : [1, a];
    if (!(ATTACCHI as readonly string[]).includes(quale))
      p("errore", "attacchi", `attacco sconosciuto: ${a}`);
    else attacchi.push(...Array<string>(quanti).fill(quale));
  }
  const famiglia = FAMIGLIA[r.tipo];
  if (!famiglia)
    p("avviso", "famiglia", `tipo «${r.tipo}»: nessuna famiglia, nessuna misura principale`);
  const documento = DOCUMENTO[r.fonte];
  if (!documento) p("errore", "fonte", `fonte sconosciuta: ${r.fonte}`);
  return {
    specs: {
      _type: "specsMisure",
      ...(famiglia ? { famiglia } : {}),
      misure,
      ...(attacchi.length ? { attacchi } : {}),
      fonte: { documento, pagina: r.stampata },
      stato: "daVerificare",
    },
    problemi,
  };
}

/**
 * Una riga per articolo: un codice in più collezioni ha una riga per collezione. Vale quella del
 * listino 06-002 con la pagina più bassa; `diverse` dice quali collezioni danno misure diverse.
 */
export function rigaPerArticolo(
  righe: RigaEstrazione[],
): Map<string, { riga: RigaEstrazione; diverse: string[] }> {
  const gruppi = new Map<string, RigaEstrazione[]>();
  for (const r of righe) gruppi.set(r.code, [...(gruppi.get(r.code) ?? []), r]);
  const firma = (r: RigaEstrazione) => {
    const s = specsDaRiga(r).specs;
    return JSON.stringify([s?.famiglia, s?.misure, s?.attacchi]);
  };
  const out = new Map<string, { riga: RigaEstrazione; diverse: string[] }>();
  for (const [code, g] of gruppi) {
    const [riga] = [...g].sort(
      (a, b) =>
        Number(b.fonte === "06-002") - Number(a.fonte === "06-002") || a.stampata - b.stampata,
    );
    const diverse = g.filter((r) => firma(r) !== firma(riga)).map((r) => r.collezione);
    out.set(code, { riga, diverse });
  }
  return out;
}
