import type { ComponentProps } from "react";

import type { Link } from "@/i18n/navigation";
import { FAQ_LINK_ROUTES, type FaqBlock, type FaqLinkRoute } from "@/sanity/lib/faq-rules";

/**
 * Le FAQ sul sito, pure: id dei link diretti e percorsi dei link interni (spec
 * `docs/specs/faq-pagine-uso.md` § 3, § 4). Il testo delle risposte per il JSON-LD lo dà
 * `blocksToText` di `faq-rules.ts`, la stessa funzione che conta le parole nel rito.
 */

type LinkHref = ComponentProps<typeof Link>["href"];

/** Un blocco della risposta come lo proietta `FAQ_QUERY`: il link interno porta lo slug. */
export interface FaqAnswerBlock extends FaqBlock {
  _key: string;
  style?: string;
  markDefs?: Array<{
    _key: string;
    _type: string;
    route?: string;
    slug?: string | null;
    href?: string;
  }>;
}

export interface FaqEntry {
  _key: string;
  question: string;
  answer: FaqAnswerBlock[];
  /** «Approfondisci» (4/11/2026): rotta, slug del documento se la rotta lo vuole, testo del link. */
  deepDive?: { route?: string | null; slug?: string | null; label?: string | null } | null;
}

/**
 * Il percorso italiano di un link interno (`/blog/inox-al-mare`): la destinazione che
 * `faq_approfondisci` manda alle statistiche, uguale in tutte le lingue. `null` come
 * `internalLinkHref`.
 */
export function internalLinkPath(route: unknown, slug: unknown): string | null {
  const href = internalLinkHref(route, slug);
  if (!href) return null;
  if (typeof href === "string") return href;
  const { pathname, params } = href as { pathname: string; params?: { slug?: string } };
  return pathname.replace("[slug]", params?.slug ?? "");
}

/**
 * L'id del link diretto di una domanda: `faq-` più il testo in minuscolo, senza accenti e
 * con i trattini (`#faq-perche-l-acciaio-inox-aisi-316-e-non-il-304`).
 *
 * ⚠️ Dal testo e non dalla `_key`: la `_key` la calcola `faq:carica` dal seme del giro, e
 * riordinare un file la cambierebbe. Il testo cambia solo se cambia la domanda, e allora un
 * link vecchio apre la pagina senza aprire niente, che è il comportamento giusto.
 */
export function faqAnchorId(question: string): string {
  const slug = question
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .replaceAll("ß", "ss")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
  return `faq-${slug || "domanda"}`;
}

/** Gli id di tutte le domande di una pagina: due domande col testo uguale prendono `-2`. */
export function faqAnchorIds(questions: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return questions.map((q) => {
    const base = faqAnchorId(q);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/**
 * L'href di un link interno, nella forma che `Link` di next-intl traduce nella lingua della
 * pagina (`/collezioni/boss` → `/en/collections/boss`). `null` se la rotta non è fra quelle
 * ammesse o se una rotta con slug non ce l'ha (referenza a un documento tolto): il testo
 * resta, senza link.
 */
export function internalLinkHref(route: unknown, slug: unknown): LinkHref | null {
  if (typeof route !== "string" || !Object.hasOwn(FAQ_LINK_ROUTES, route)) return null;
  const key = route as FaqLinkRoute;
  if (FAQ_LINK_ROUTES[key] === null) return key as LinkHref;
  if (typeof slug !== "string" || slug === "") return null;
  return { pathname: key, params: { slug } } as LinkHref;
}
