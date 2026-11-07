import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { ComponentProps } from "react";

import {
  bodyTypes,
  internalLinkMark,
  type BlocchiLabels,
} from "@/components/content/blocchi-corpo";

type PortableTextValue = ComponentProps<typeof PortableText>["value"];

/**
 * ArticleBody — Blog Portable Text serializer.
 *
 * Modelled on ModelDescription (FASE 4.4.2) but with the Blog article styling
 * from the mockup: editorial body, h2/h3 subheads, and a pull quote with NO side
 * bar — a navy opening-quote mark + large italic (decision locked; gold until
 * 20/10/2026, when gold left the design system). Reuses the
 * href XSS-guard for links. Tokens only (no hardcoded hex), Satoshi throughout.
 *
 * Esportati perché il corpo delle pagine d'uso (`doccia-da-esterno/_components/use-body.tsx`, c1b)
 * prende gli stessi paragrafi, titoli ed elenchi: una tipografia sola per i testi lunghi.
 */
export const ARTICLE_COMPONENTS: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p
        className="fa-body-lg m-0 mb-6"
        style={{ lineHeight: 1.8, color: "var(--fa-text-primary)" }}
      >
        {children}
      </p>
    ),
    h2: ({ children }) => (
      <h2 className="fa-h4 mx-0 mt-12 mb-4" style={{ color: "var(--fa-black)" }}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className="mx-0 mt-9 mb-3 text-sub-heading"
        style={{
          fontWeight: 600,
          color: "var(--fa-black)",
        }}
      >
        {children}
      </h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="mx-0 my-12" style={{ padding: 0, maxWidth: "60ch" }}>
        <span
          aria-hidden
          style={{
            display: "block",
            height: "24px",
            fontSize: "46px",
            lineHeight: 0,
            fontWeight: 600,
            color: "var(--fa-navy)",
          }}
        >
          {"“"}
        </span>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: "clamp(1.375rem, 2.6vw, 1.6875rem)",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 1.4,
            color: "var(--fa-black)",
          }}
        >
          {children}
        </p>
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul
        className="fa-body-lg mt-0 mr-0 mb-6 ml-5"
        style={{
          listStyle: "disc",
          lineHeight: 1.8,
          color: "var(--fa-text-primary)",
        }}
      >
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol
        className="fa-body-lg mt-0 mr-0 mb-6 ml-5"
        style={{
          listStyle: "decimal",
          lineHeight: 1.8,
          color: "var(--fa-text-primary)",
        }}
      >
        {children}
      </ol>
    ),
  },
  marks: {
    strong: ({ children }) => (
      <strong className="font-(--fa-strong-font-weight)" style={{ color: "var(--fa-black)" }}>
        {children}
      </strong>
    ),
    em: ({ children }) => <em>{children}</em>,
    link: ({ children, value }) => {
      // Validate the href schema (Sanity PortableText link): block javascript:/data:
      // etc. Only http(s)/mailto/tel/relative/anchor allowed (reuse 4.4.2 guard).
      const raw = typeof value?.href === "string" ? value.href : "";
      const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(raw) ? raw : undefined;
      return (
        <a
          href={safe}
          rel="noopener noreferrer"
          style={{ color: "var(--fa-navy)", textDecoration: "underline" }}
        >
          {children}
        </a>
      );
    },
  },
};

export function ArticleBody({ blocks, labels }: { blocks: unknown; labels: BlocchiLabels }) {
  // GROQ `body[$locale]` returns the block array at runtime; TypeGen mis-types it
  // as the localizedPortableText wrapper (quirk M6) → cast (as ModelDescription).
  const value = blocks as PortableTextValue;
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  // Dal 5/11/2026 il corpo dell'articolo ha anche i blocchi della pagina d'uso (box «In sintesi»,
  // foto, tabella, video) e il link interno che scrive `pnpm post:carica`: stessa resa, un file solo.
  const components: PortableTextComponents = {
    ...ARTICLE_COMPONENTS,
    marks: { ...ARTICLE_COMPONENTS.marks, internalLink: internalLinkMark },
    types: bodyTypes(labels),
  };
  return (
    <div style={{ maxWidth: "66ch" }}>
      <PortableText value={value} components={components} />
    </div>
  );
}
