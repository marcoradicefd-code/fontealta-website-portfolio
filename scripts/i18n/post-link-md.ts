/**
 * I link aggiunti ai corpi dei post (Marco, 4/11/2026, Q16 del grill della c1): la parte pura di
 * `pnpm post:link`.
 *
 * Il file è il `.md` leggibile dell'export per Cowork (`post/leggibile/<lingua>/<slug>.md`): in testa
 * `_id`, `slug` e `lang` fra due righe `---`, poi `# titolo`, poi un paragrafo per blocco del corpo,
 * nell'ordine, separati da una riga vuota. Cowork aggancia `[testo](percorso)` a parole **già
 * presenti**; lo strumento aggiunge al blocco su Sanity **solo** l'annotazione del link.
 *
 * ⚠️ **Il testo non cambia mai.** Tolti i segni dei link e degli asterischi, ogni paragrafo deve
 * essere identico al testo del suo blocco su Sanity, carattere per carattere: se differisce il post
 * non si scrive. Un link già sul post che nel file manca, o è diverso, ferma il post (non si tolgono
 * link). I percorsi sono quelli della lingua del file (`/de/gartendusche`), perché il link del corpo
 * di un post è un URL semplice che nessuno traduce; si accettano solo rotte del sito che le FAQ
 * possono linkare, con lo slug che esiste.
 */

import { createHash } from "node:crypto";

import { routing } from "../../src/i18n/routing";
import { FAQ_LINK_ROUTES, type FaqLinkRoute } from "../../sanity/lib/faq-rules";

export interface PostFile {
  id: string;
  slug: string;
  lang: string;
  title: string;
  paragraphs: string[];
}

/** Il file letto. Un formato sbagliato è un errore, non un'eccezione. */
export function parsePostFile(source: string): { file?: PostFile; errors: string[] } {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") return { errors: ["manca l'intestazione fra due righe ---"] };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { errors: ["l'intestazione non si chiude con ---"] };
  const head = Object.fromEntries(
    lines
      .slice(1, end)
      .map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]),
  );
  const errors = ["_id", "slug", "lang"].filter((k) => !head[k]).map((k) => `manca «${k}»`);
  const rest = lines
    .slice(end + 1)
    .join("\n")
    .trim();
  if (!rest.startsWith("# ")) errors.push("manca la riga del titolo «# …»");
  const [titolo, ...corpo] = rest.split(/\n{2,}/);
  return {
    file: {
      id: head._id,
      slug: head.slug,
      lang: head.lang,
      title: (titolo ?? "").replace(/^# /, ""),
      paragraphs: corpo,
    },
    errors,
  };
}

/** Un blocco del corpo, quanto basta: testo, segni, link. */
export interface PostBlock {
  _type: string;
  _key?: string;
  style?: string;
  listItem?: string;
  level?: number;
  children?: Array<{ _type?: string; _key?: string; text?: string; marks?: string[] }>;
  markDefs?: Array<{ _key: string; _type: string; href?: string }>;
  [k: string]: unknown;
}

/** Il segno che l'export mette davanti al paragrafo, dallo stile del blocco. */
export function prefisso(b: PostBlock): string {
  if (b.listItem) return "- ";
  const h = /^h(\d)$/.exec(b.style ?? "");
  if (h) return `${"#".repeat(Number(h[1]))} `;
  return b.style === "blockquote" ? "> " : "";
}

/** Il testo di un blocco, come i pezzi lo compongono. */
const testoDi = (b: PostBlock) => (b.children ?? []).map((c) => c.text ?? "").join("");

/** I link di un paragrafo del file: il testo senza segni e, per ogni link, dove sta e dove porta. */
export function leggiParagrafo(p: string): {
  testo: string;
  link: Array<{ da: number; a: number; href: string }>;
} {
  const pulito = p.replace(/\*/g, "");
  const link: Array<{ da: number; a: number; href: string }> = [];
  let testo = "";
  let ultimo = 0;
  for (const m of pulito.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    testo += pulito.slice(ultimo, m.index);
    link.push({ da: testo.length, a: testo.length + m[1].length, href: m[2] });
    testo += m[1];
    ultimo = m.index + m[0].length;
  }
  return { testo: testo + pulito.slice(ultimo), link };
}

/** I link già sul blocco, per posizione nel testo: pezzi consecutivi con lo stesso link sono uno. */
export function linkDelBlocco(b: PostBlock): Array<{ da: number; a: number; href: string }> {
  const defs = new Map(
    (b.markDefs ?? []).filter((d) => d._type === "link").map((d) => [d._key, d.href ?? ""]),
  );
  const out: Array<{ da: number; a: number; href: string; key: string }> = [];
  let pos = 0;
  for (const c of b.children ?? []) {
    const t = c.text ?? "";
    for (const m of c.marks ?? []) {
      if (!defs.has(m)) continue;
      const prima = out.at(-1);
      if (prima && prima.key === m && prima.a === pos) prima.a = pos + t.length;
      else out.push({ da: pos, a: pos + t.length, href: defs.get(m)!, key: m });
    }
    pos += t.length;
  }
  return out.map(({ da, a, href }) => ({ da, a, href }));
}

/**
 * La rotta di un percorso scritto nella lingua del file (`/de/gartendusche`), fra quelle che i link
 * delle FAQ possono raggiungere. L'italiano non ha prefisso.
 */
export function rottaNellaLingua(
  href: string,
  lang: string,
): { route: FaqLinkRoute; slug?: string } | null {
  const prefix = lang === "it" ? "" : `/${lang}`;
  const path = href.split("#")[0].replace(/\/$/, "") || "/";
  if (prefix && path !== prefix && !path.startsWith(`${prefix}/`)) return null;
  const resto = path.slice(prefix.length) || "/";
  const nomi = routing.pathnames as Record<string, string | Record<string, string>>;
  for (const route of Object.keys(FAQ_LINK_ROUTES) as FaqLinkRoute[]) {
    const voce = nomi[route];
    const forma = typeof voce === "string" ? voce : (voce?.[lang] ?? route);
    if (!forma.includes("[slug]")) {
      if (forma === resto) return { route };
      continue;
    }
    const inizio = forma.replace("/[slug]", "/");
    const slug = resto.startsWith(inizio) ? resto.slice(inizio.length) : "";
    if (/^[a-z0-9-]+$/.test(slug)) return { route, slug };
  }
  return null;
}

const chiave = (seme: string) => createHash("sha256").update(seme).digest("hex").slice(0, 12);

/**
 * Il blocco con i link nuovi: i pezzi si spezzano ai bordi del link, e i pezzi dentro prendono la
 * sua chiave. Le chiavi nascono dal contenuto, così due giri danno lo stesso blocco.
 */
export function conLink(
  b: PostBlock,
  nuovi: ReadonlyArray<{ da: number; a: number; href: string }>,
  seme: string,
): PostBlock {
  if (!nuovi.length) return b;
  const defs = nuovi.map((l) => ({ ...l, _key: chiave(`${seme}:${l.da}:${l.a}:${l.href}`) }));
  const tagli = new Set(defs.flatMap((d) => [d.da, d.a]));
  const children: NonNullable<PostBlock["children"]> = [];
  let pos = 0;
  for (const c of b.children ?? []) {
    const t = c.text ?? "";
    const punti = [
      0,
      ...[...tagli]
        .filter((x) => x > pos && x < pos + t.length)
        .map((x) => x - pos)
        .sort((x, y) => x - y),
      t.length,
    ];
    for (let i = 0; i < punti.length - 1; i++) {
      const pezzo = t.slice(punti[i], punti[i + 1]);
      const inizio = pos + punti[i];
      const marks = [
        ...(c.marks ?? []),
        ...defs.filter((d) => inizio >= d.da && inizio < d.a).map((d) => d._key),
      ];
      children.push({
        ...c,
        _key: i === 0 ? c._key : `${c._key}-${chiave(`${seme}:${inizio}`).slice(0, 6)}`,
        text: pezzo,
        marks,
      });
    }
    pos += t.length;
  }
  return {
    ...b,
    children,
    markDefs: [
      ...(b.markDefs ?? []),
      ...defs.map((d) => ({ _key: d._key, _type: "link", href: d.href })),
    ],
  };
}

export interface EsitoPost {
  /** Il corpo nuovo della lingua, o `null` se non cambia niente. */
  body: PostBlock[] | null;
  nuovi: Array<{ testo: string; href: string }>;
  errori: string[];
  avvisi: string[];
}

/**
 * Il confronto di un file col corpo su Sanity nella sua lingua, e il corpo coi link nuovi.
 * `esiste(tipo, slug)` dice se il documento di una rotta con slug c'è.
 */
export function aggiungiLink(
  file: PostFile,
  sanity: { title?: string | null; body?: PostBlock[] | null },
  esiste: (type: string, slug: string) => boolean,
): EsitoPost {
  const errori: string[] = [];
  const avvisi: string[] = [];
  const nuovi: EsitoPost["nuovi"] = [];
  const body = sanity.body ?? [];
  if ((sanity.title ?? "") !== file.title)
    avvisi.push("il titolo nel file è diverso da quello su Sanity: si ignora, non si scrive");
  if (file.paragraphs.length !== body.length)
    return {
      body: null,
      nuovi,
      errori: [`${file.paragraphs.length} paragrafi nel file, ${body.length} blocchi su Sanity`],
      avvisi,
    };
  const fuori = body.map((b, i) => {
    const n = i + 1;
    const p = file.paragraphs[i];
    if (b._type !== "block") {
      if (p !== `[blocco ${b._type}]`)
        errori.push(`blocco ${n}: un ${b._type}, il file non lo riporta`);
      return b;
    }
    const pre = prefisso(b);
    if (!p.startsWith(pre)) {
      errori.push(`blocco ${n}: il segno «${pre.trim()}» davanti al paragrafo manca`);
      return b;
    }
    const sanityTesto = testoDi(b);
    if (sanityTesto.includes("*")) {
      errori.push(`blocco ${n}: un asterisco nel testo su Sanity, il link va messo a mano`);
      return b;
    }
    const { testo, link } = leggiParagrafo(p.slice(pre.length));
    if (testo !== sanityTesto) {
      let k = 0;
      while (k < testo.length && testo[k] === sanityTesto[k]) k++;
      errori.push(
        `blocco ${n}: il testo è diverso da Sanity al carattere ${k + 1} («…${sanityTesto.slice(Math.max(0, k - 20), k + 20)}…» su Sanity, «…${testo.slice(Math.max(0, k - 20), k + 20)}…» nel file)`,
      );
      return b;
    }
    const gia = linkDelBlocco(b);
    const uguale = (x: { da: number; a: number; href: string }, y: typeof x) =>
      x.da === y.da && x.a === y.a && x.href === y.href;
    for (const g of gia)
      if (!link.some((l) => uguale(l, g)))
        errori.push(
          `blocco ${n}: il link «${sanityTesto.slice(g.da, g.a)}» → ${g.href} su Sanity manca o è diverso nel file (i link non si tolgono)`,
        );
    const daAggiungere = link.filter((l) => !gia.some((g) => uguale(l, g)));
    for (const l of daAggiungere) {
      if (gia.some((g) => l.da < g.a && g.da < l.a))
        errori.push(
          `blocco ${n}: il link «${testo.slice(l.da, l.a)}» si sovrappone a uno già sul post`,
        );
      const hit = rottaNellaLingua(l.href, file.lang);
      if (!hit) {
        errori.push(`blocco ${n}: «${l.href}» non è un percorso del sito in «${file.lang}»`);
        continue;
      }
      const tipo = FAQ_LINK_ROUTES[hit.route];
      if (tipo && hit.slug && !esiste(tipo, hit.slug))
        errori.push(`blocco ${n}: «${l.href}»: nessun ${tipo} con slug «${hit.slug}»`);
      nuovi.push({ testo: testo.slice(l.da, l.a), href: l.href });
    }
    return conLink(b, daAggiungere, `${file.id}:${file.lang}:${b._key ?? i}`);
  });
  return { body: errori.length || nuovi.length === 0 ? null : fuori, nuovi, errori, avvisi };
}
