import type { PortableTextComponents } from "@portabletext/react";
import { ArrowUpRight, Play } from "lucide-react";

import { SanityImage } from "@/components/media/sanity-image";
import { Link } from "@/i18n/navigation";
import { internalLinkHref } from "@/lib/faq";
import { urlFor } from "@/sanity/lib/image";

/**
 * I blocchi dei testi lunghi oltre a paragrafi, titoli ed elenchi: il box «In sintesi», la foto
 * orizzontale, la coppia di verticali, la tabella di confronto, il video e il link interno.
 * Nati per la pagina d'uso (c1b, `use-body.tsx`), dal 5/11/2026 li usa anche l'articolo del blog
 * (Marco, grill del 5/11, Q7, Q8, Q29, Q30): una resa sola per tutti e due.
 *
 * ⚠️ **Tutte le foto sono pigre** (Marco, 4/11/2026, c1b): nei testi la prima foto sta molto sotto
 * la piega, e l'LCP è un testo dell'apertura o la copertina dell'articolo.
 */

/** Una foto del corpo (`useImage`): l'asset e l'alt nella lingua della pagina. */
export type UseImage = { asset?: { _ref?: string } | null; alt?: string | null } | null | undefined;

export interface BlocchiLabels {
  inSintesi: string;
  tabella: string;
  /** Il testo del link del video («Guarda su YouTube»): serve solo all'articolo. */
  video?: string;
}

/** Il link interno di una risposta o di un testo: rotta e slug, composti nella lingua della pagina. */
export const internalLinkMark: NonNullable<PortableTextComponents["marks"]>[string] = ({
  children,
  value: mark,
}) => {
  const href = internalLinkHref(mark?.route, mark?.slug);
  if (!href) return <>{children}</>;
  return (
    <Link href={href} className="text-fa-navy underline">
      {children}
    </Link>
  );
};

/** I tipi del corpo, con le etichette nella lingua della pagina. */
export function bodyTypes(labels: BlocchiLabels): PortableTextComponents["types"] {
  return {
    keyPoints: ({ value: box }) => <InSintesi items={box?.items} label={labels.inSintesi} />,
    figure: ({ value: f }) => <Foto image={f?.image} />,
    figurePair: ({ value: c }) => <Coppia left={c?.left} right={c?.right} />,
    comparisonTable: ({ value: t }) => (
      <Tabella header={t?.header} rows={t?.rows} label={labels.tabella} />
    ),
    videoLink: ({ value: v }) =>
      labels.video ? (
        <VideoYoutube url={v?.url} title={v?.title} poster={v?.poster} label={labels.video} />
      ) : null,
  };
}

/** Il box «In sintesi»: un riquadro dopo l'introduzione, con le voci in elenco (spec § 5). */
function InSintesi({ items, label }: { items?: unknown; label: string }) {
  const voci = Array.isArray(items) ? items.filter((v): v is string => typeof v === "string") : [];
  if (voci.length === 0) return null;
  return (
    <aside
      aria-label={label}
      className="mb-10 rounded-xl bg-fa-surface px-6 py-6 shadow-card sm:px-8"
    >
      <p className="m-0 mb-3 text-micro-4 font-semibold tracking-5 text-fa-navy uppercase">
        {label}
      </p>
      <ul className="fa-body-lg m-0 ml-5 list-disc space-y-2 text-fa-text-primary">
        {voci.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </aside>
  );
}

/** La proporzione di una foto, letta dall'id dell'asset (`image-<hash>-<w>x<h>-<ext>`). */
const proporzione = (image: UseImage) => /-(\d+)x(\d+)-/.exec(image?.asset?._ref ?? "");

/** Una foto orizzontale, a tutta colonna, nella sua proporzione. */
function Foto({ image }: { image: UseImage }) {
  const url = image?.asset ? urlFor(image)?.width(1520).url() : undefined;
  const dims = proporzione(image);
  if (!url || !dims) return null;
  return (
    <figure className="mx-0 my-10">
      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: `${dims[1]} / ${dims[2]}` }}
      >
        <SanityImage
          src={url}
          alt={image?.alt ?? ""}
          fill
          sizes="(max-width: 920px) 100vw, 722px"
          className="object-cover"
        />
      </div>
    </figure>
  );
}

/**
 * Due verticali affiancate, ritagliate in 2:3 dall'URL sul punto caldo (il loader di
 * `next-sanity` tiene il rapporto quando l'URL porta larghezza e altezza).
 */
// `sizes` misurati il 4/11: il corpo è largo 722 px da 768 in su (66 caratteri), ogni foto della coppia 351;
// a 390 la formula dà 165, come a video.
function Coppia({ left, right }: { left: UseImage; right: UseImage }) {
  const foto = [left, right].filter((f) => f?.asset);
  if (foto.length !== 2) return null;
  return (
    <figure className="mx-0 my-10 grid grid-cols-2 gap-3 sm:gap-5">
      {foto.map((f) => {
        const url = urlFor(f)?.width(760).height(1140).fit("crop").url();
        if (!url) return null;
        return (
          <div
            key={f?.asset?._ref}
            className="relative aspect-[2/3] w-full overflow-hidden rounded-xl"
          >
            <SanityImage
              src={url}
              alt={f?.alt ?? ""}
              fill
              sizes="(max-width: 920px) calc((100vw - 60px) / 2), 352px"
              className="object-cover"
            />
          </div>
        );
      })}
    </figure>
  );
}

/**
 * La tabella di confronto: sul telefono scorre in orizzontale dentro il suo riquadro, che si
 * raggiunge da tastiera e ha un nome (WCAG 2.1.1); la pagina non sborda.
 */
function Tabella({ header, rows, label }: { header?: unknown; rows?: unknown; label: string }) {
  const intestazione = Array.isArray(header) ? (header as string[]) : [];
  const righe = Array.isArray(rows)
    ? (rows as Array<{ _key?: string; cells?: string[] }>).filter((r) => Array.isArray(r.cells))
    : [];
  if (intestazione.length === 0 || righe.length === 0) return null;
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="mx-0 mb-8 overflow-x-auto rounded-xl border border-(--fa-border-light) focus-visible:ring-2 focus-visible:ring-fa-navy focus-visible:outline-none"
    >
      <table className="w-full min-w-lg border-collapse text-left text-body-sm text-fa-text-primary">
        <thead className="bg-fa-surface">
          <tr>
            {intestazione.map((h, i) => (
              <th key={`${i}-${h}`} scope="col" className="px-4 py-3 font-semibold text-fa-black">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {righe.map((r, ri) => (
            <tr key={r._key ?? ri} className="border-t border-(--fa-border-light)">
              {(r.cells ?? []).map((c, ci) =>
                ci === 0 ? (
                  <th
                    key={`${ci}-${c}`}
                    scope="row"
                    className="px-4 py-3 font-semibold text-fa-black"
                  >
                    {c}
                  </th>
                ) : (
                  <td key={`${ci}-${c}`} className="px-4 py-3">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Lo stesso controllo dello schema (`videoLink`): solo un indirizzo di YouTube diventa un link. */
const YOUTUBE = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/;

/**
 * Il video (Q30 a): la copertina nostra e il titolo, in un link che apre YouTube in un'altra scheda.
 * Nessun iframe e nessuna richiesta a YouTube dalla pagina, quindi niente cookie di terze parti.
 */
function VideoYoutube({
  url,
  title,
  poster,
  label,
}: {
  url?: unknown;
  title?: unknown;
  poster: UseImage;
  label: string;
}) {
  if (typeof url !== "string" || !YOUTUBE.test(url)) return null;
  const titolo = typeof title === "string" ? title : "";
  const src = poster?.asset ? urlFor(poster)?.width(1520).url() : undefined;
  const dims = proporzione(poster);
  return (
    <div className="mx-0 my-10">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block text-fa-navy focus-visible:ring-2 focus-visible:ring-fa-navy focus-visible:outline-none"
      >
        {src && dims ? (
          <span
            className="relative block w-full overflow-hidden rounded-xl"
            style={{ aspectRatio: `${dims[1]} / ${dims[2]}` }}
          >
            <SanityImage
              src={src}
              alt={poster?.alt ?? ""}
              fill
              sizes="(max-width: 920px) 100vw, 722px"
              className="object-cover"
            />
            <span aria-hidden className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-fa-navy text-fa-paper">
                <Play size={28} />
              </span>
            </span>
          </span>
        ) : null}
        <span className="fa-body-lg mt-3 inline-flex items-center gap-2 underline">
          {titolo ? `${titolo} · ${label}` : label}
          <ArrowUpRight size={18} aria-hidden />
        </span>
      </a>
    </div>
  );
}
