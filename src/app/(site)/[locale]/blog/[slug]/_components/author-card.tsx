import { SanityImage } from "@/components/media/sanity-image";

import type { Locale } from "@/i18n/routing";
import { risolviAlt } from "@/lib/alt-composto";
import { urlFor } from "@/sanity/lib/image";
import type { POST_BY_SLUG_QUERY_RESULT } from "@/sanity/types.gen";

type PostAuthor = NonNullable<POST_BY_SLUG_QUERY_RESULT>["author"];

/** Coerce a localized projection (runtime string; TypeGen mis-types as M6 array). */
function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "—"
  );
}

/**
 * AuthorCard — sticky sidebar (mockup). «Scritto da» + avatar (foto o iniziali su
 * navy) + nome + ruolo + bio. Le righe vuote non si disegnano.
 *
 * ⚠️ **Il ruolo è una reversione dichiarata.** Il commento qui diceva «NO role,
 * NO social (decision)», e quella decisione veniva dal mockup. Il 10/09/2026 è
 * stata rovesciata per una ragione che nel mockup non c'era: il ruolo è anche
 * `jobTitle` nella `Person` del dato strutturato, e un dato dichiarato ai motori
 * ma non mostrato al lettore è la definizione di markup che non descrive la
 * pagina. Il **social resta fuori**: `sameAs` è un'affermazione di identità per
 * le macchine, non un bottone.
 *
 * ⚠️ Al 10/09/2026 nessun autore ha `role`, quindi la card è INVARIATA: la riga
 * compare quando Marco lo compila in Studio.
 */
export function AuthorCard({
  author,
  label,
  locale,
}: {
  author: PostAuthor;
  label: string;
  locale: Locale;
}) {
  if (!author) return null;

  const name = author.name ?? "";
  const role = asText(author.role);
  const bio = asText(author.bio);
  const photoUrl = author.photo?.asset
    ? (urlFor(author.photo)?.width(116).height(116).url() ?? null)
    : null;
  // L'alt della foto (Marco, 2/11/2026): `altI18n`, poi l'italiano con `lang`, poi il nome.
  // Prima era sempre il nome, e l'alt scritto su Sanity non lo leggeva nessuno.
  const foto = risolviAlt(author.photo, locale);

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-xl p-7" style={{ background: "var(--fa-card-cover)" }}>
        <p
          className="m-0 mb-5 text-micro-2 font-semibold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--fa-text-tertiary)" }}
        >
          {label}
        </p>

        <div className="mb-5 flex items-center gap-4">
          {photoUrl ? (
            <SanityImage
              src={photoUrl}
              alt={foto.alt || name}
              lang={foto.alt ? foto.lang : undefined}
              width={58}
              height={58}
              className="h-[58px] w-[58px] flex-none rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-[58px] w-[58px] flex-none items-center justify-center rounded-full text-body-5 font-semibold"
              style={{ background: "var(--fa-navy)", color: "var(--fa-text-on-dark)" }}
            >
              {initials(name)}
            </span>
          )}
          {name ? (
            <div>
              <p className="m-0 text-body-2 font-semibold" style={{ color: "var(--fa-black)" }}>
                {name}
              </p>
              {role ? (
                <p className="m-0 text-caption-2" style={{ color: "var(--fa-text-tertiary)" }}>
                  {role}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {bio ? (
          <p
            className="m-0 text-caption-3"
            style={{ lineHeight: "var(--leading-lede)", color: "var(--fa-text-secondary)" }}
          >
            {bio}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
