import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { ComponentProps } from "react";

import { ARTICLE_COMPONENTS } from "@/app/(site)/[locale]/blog/[slug]/_components/article-body";
import { bodyTypes, internalLinkMark } from "@/components/content/blocchi-corpo";

type PortableTextValue = ComponentProps<typeof PortableText>["value"];

/**
 * Il corpo di una pagina d'uso (spec `docs/specs/seo-pagine-contenuto.md` § 3 e § 5, c1b).
 *
 * Paragrafi, titoli ed elenchi sono quelli dell'articolo del blog (`ARTICLE_COMPONENTS`): una
 * tipografia sola per i testi lunghi. In più i tipi del corpo d'uso: il box «In sintesi», la foto
 * orizzontale, la coppia di verticali, la tabella di confronto e il link interno.
 *
 * ⚠️ **Tutte le foto sono pigre** (Marco, 4/11/2026, c1b): nei testi la prima foto sta sotto
 * l'H2 delle idee, molto sotto la piega, e l'LCP è un testo dell'apertura (misurato il 4/11: il
 * paragrafo d'introduzione). Quando arriverà un'orizzontale all'aperto
 * in apertura, quella avrà la priorità.
 */
export function UseBody({
  blocks,
  labels,
}: {
  blocks: unknown;
  labels: { inSintesi: string; tabella: string };
}) {
  const value = blocks as PortableTextValue;
  if (!value || (Array.isArray(value) && value.length === 0)) return null;

  const components: PortableTextComponents = {
    ...ARTICLE_COMPONENTS,
    marks: {
      ...ARTICLE_COMPONENTS.marks,
      // Il percorso lo compone il sito nella lingua della pagina, dalla rotta dell'annotazione
      // e dallo slug del documento: la stessa regola delle risposte delle FAQ.
      internalLink: internalLinkMark,
    },
    // I blocchi stanno in `blocchi-corpo.tsx`, comuni con l'articolo del blog (5/11/2026).
    types: bodyTypes(labels),
  };

  // `data-corpo-uso`: l'aggancio dell'e2e sui soli link del corpo (le briciole stanno nello stesso articolo).
  return (
    <div data-corpo-uso style={{ maxWidth: "66ch" }}>
      <PortableText value={value} components={components} />
    </div>
  );
}
