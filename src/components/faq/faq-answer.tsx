import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { ComponentProps } from "react";

import { IntentLink } from "@/components/ui/intent-link";
import { internalLinkHref, type FaqAnswerBlock } from "@/lib/faq";

type PortableTextValue = ComponentProps<typeof PortableText>["value"];

/** Il link nel testo: navy e sottolineato, come nell'articolo del blog. */
export const FAQ_TEXT_LINK = "text-fa-navy underline";

/**
 * La risposta di una FAQ (spec § 4, § 5): paragrafi, grassetto dal ruolo
 * `--fa-strong-font-weight` e mai sottolineato (sul sito il sottolineato è un link), link
 * interni tradotti nella lingua della pagina, link esterni con la guardia di `article-body`.
 *
 * Link interni con `IntentLink`, il prefetch su intenzione delle card (rule `cache-isr`): quasi
 * tutti puntano a una scheda modello, che nasce su richiesta.
 */
const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p className="m-0">{children}</p>,
  },
  marks: {
    strong: ({ children }) => (
      <strong className="font-(--fa-strong-font-weight) text-fa-text-primary">{children}</strong>
    ),
    em: ({ children }) => <em>{children}</em>,
    internalLink: ({ children, value }) => {
      const href = internalLinkHref(value?.route, value?.slug);
      if (!href) return <>{children}</>;
      return (
        <IntentLink href={href} className={FAQ_TEXT_LINK}>
          {children}
        </IntentLink>
      );
    },
    link: ({ children, value }) => {
      const raw = typeof value?.href === "string" ? value.href : "";
      if (!/^(https?:|mailto:|tel:)/i.test(raw)) return <>{children}</>;
      return (
        <a href={raw} rel="noopener noreferrer" className={FAQ_TEXT_LINK}>
          {children}
        </a>
      );
    },
  },
};

export function FaqAnswer({ blocks }: { blocks: FaqAnswerBlock[] }) {
  return (
    <div className="fa-body-lg flex max-w-[66ch] flex-col gap-4 text-fa-text-secondary">
      <PortableText value={blocks as unknown as PortableTextValue} components={components} />
    </div>
  );
}
