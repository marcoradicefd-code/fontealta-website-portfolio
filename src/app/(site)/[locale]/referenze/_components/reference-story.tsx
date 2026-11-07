import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { ComponentProps } from "react";

import type { REFERENCE_BY_SLUG_QUERY_RESULT } from "@/sanity/types.gen";

type PortableTextValue = ComponentProps<typeof PortableText>["value"];

/**
 * ReferenceStory — Server Component. Render PortableText del campo `story`
 * (block[]) in container narrow editoriale (spec §D2). Serializers allineati a
 * ModelDescription (read-only pattern), inclusa validazione href anti-XSS.
 * Gated: ritorna null se story vuota (no blocco vuoto).
 */

const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="fa-body-lg mb-6" style={{ color: "var(--fa-text-secondary)" }}>
        {children}
      </p>
    ),
    h2: ({ children }) => <h2 className="fa-h3 mt-10 mb-4">{children}</h2>,
    h3: ({ children }) => <h3 className="fa-h4 mt-8 mb-3">{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote
        className="fa-body-lg mx-0 my-8 pl-5"
        style={{
          borderLeft: "2px solid var(--fa-navy)",
          fontStyle: "italic",
          color: "var(--fa-text-primary)",
        }}
      >
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul
        className="fa-body-lg mt-0 mr-0 mb-6 ml-5"
        style={{
          listStyle: "disc",
          color: "var(--fa-text-secondary)",
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
          color: "var(--fa-text-secondary)",
        }}
      >
        {children}
      </ol>
    ),
  },
  marks: {
    strong: ({ children }) => (
      <strong style={{ fontWeight: 600, color: "var(--fa-text-primary)" }}>{children}</strong>
    ),
    em: ({ children }) => <em>{children}</em>,
    link: ({ children, value }) => {
      // Valida lo schema href (PortableText link da Sanity): consenti solo
      // http(s)/mailto/tel/relativi/anchor per evitare XSS (javascript:/data:).
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

export function ReferenceStory({
  story,
}: {
  story: NonNullable<REFERENCE_BY_SLUG_QUERY_RESULT>["story"];
}) {
  const blocks = story as unknown as PortableTextValue;
  if (!blocks || (Array.isArray(blocks) && blocks.length === 0)) return null;

  return (
    <section className="fa-section light">
      <div className="fa-container narrow">
        <PortableText value={blocks} components={components} />
      </div>
    </section>
  );
}
