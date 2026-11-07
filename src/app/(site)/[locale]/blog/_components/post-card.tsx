import { SanityImage } from "@/components/media/sanity-image";

import { IntentLink } from "@/components/ui/intent-link";

/** View-model built server-side (page.tsx) — all strings resolved; no body
 *  shipped to the client. Shared by PostCard + the featured card. */
export interface BlogCardVM {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** First category title — shown as the eyebrow. */
  category: string;
  /** All category _ids — used by the client filter. */
  categoryIds: string[];
  /**
   * La data ISO di pubblicazione, per l'attributo `dateTime` del `<time>`.
   * `null` sui post senza `publishedAt`, dove il tag non si scrive affatto:
   * un `<time>` senza `dateTime` non dichiara niente.
   */
  dateIso: string | null;
  /** La data come si legge in pagina, già formattata nella lingua. */
  dateLabel: string;
  /** Il resto della riga: "author · X min read", senza la data. */
  meta: string;
  coverUrl: string | null;
  coverAlt: string;
  /** `"it"` quando l'alt è l'italiano salvato e la pagina è in un'altra lingua. */
  coverAltLang?: "it";
}

/**
 * La riga di meta con la data in un `<time>`.
 *
 * ⚠️ **Sta qui, condivisa fra la card e la featured**, perché sono due punti che
 * mostrano la stessa riga: scritta due volte, una delle due prima o poi resta
 * indietro. A video è identica al carattere alla stringa unica di prima, il
 * separatore compreso: cambia solo che la data ha il suo tag.
 */
export function MetaConData({ post }: { post: BlogCardVM }) {
  const conData = Boolean(post.dateIso && post.dateLabel);
  return (
    <>
      {conData ? <time dateTime={post.dateIso ?? undefined}>{post.dateLabel}</time> : null}
      {conData && post.meta ? ` · ${post.meta}` : post.meta}
    </>
  );
}

/**
 * PostCard — grid card for the Blog listing (dark section). Whole card is a
 * link to the article. Cover (rounded) + category eyebrow + title (2-line clamp)
 * + excerpt (3-line clamp) + meta. Tokens only.
 */
export function PostCard({ post }: { post: BlogCardVM }) {
  return (
    <IntentLink
      href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }}
      className="group flex flex-col rounded-lg transition-transform duration-(--dur-standard) ease-out-expo hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-(--fa-navy-bright) focus-visible:ring-offset-4 focus-visible:ring-offset-(--fa-ink) focus-visible:outline-none"
    >
      <div
        className="relative mb-5 w-full overflow-hidden rounded-lg"
        style={{ aspectRatio: "3 / 2", background: "var(--fa-card-cover)" }}
      >
        {post.coverUrl ? (
          <SanityImage
            src={post.coverUrl}
            alt={post.coverAlt}
            lang={post.coverAltLang}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.04]"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(120deg, var(--color-fa-steel-bx) 0%, var(--color-fa-steel-mx) 50%, var(--color-fa-steel-bx) 100%)",
            }}
          />
        )}
      </div>

      {post.category ? (
        <p
          className="m-0 mb-2 text-micro-2 font-semibold uppercase"
          style={{ letterSpacing: "0.16em", color: "var(--fa-text-on-dark)" }}
        >
          {post.category}
        </p>
      ) : null}

      <h3
        className="m-0 line-clamp-2 text-display-1 font-semibold"
        style={{
          lineHeight: "var(--leading-tight)",
          letterSpacing: "-0.2px",
          color: "var(--fa-text-on-dark)",
        }}
      >
        {post.title}
      </h3>

      {post.excerpt ? (
        <p
          className="mt-6 line-clamp-3 text-body-1 lg:mt-10"
          style={{ lineHeight: 1.6, color: "var(--fa-text-on-dark)" }}
        >
          {post.excerpt}
        </p>
      ) : null}

      <p
        className="mt-6 text-micro-3 font-medium uppercase lg:mt-10"
        style={{ letterSpacing: "0.08em", color: "var(--fa-text-on-dark)" }}
      >
        <MetaConData post={post} />
      </p>
    </IntentLink>
  );
}
