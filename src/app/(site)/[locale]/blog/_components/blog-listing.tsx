"use client";

import { SanityImage } from "@/components/media/sanity-image";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { IntentLink } from "@/components/ui/intent-link";

import { MetaConData, PostCard, type BlogCardVM } from "./post-card";

interface CategoryVM {
  id: string;
  title: string;
}

interface Labels {
  all: string;
  readArticle: string;
  prev: string;
  next: string;
  empty: string;
}

interface Props {
  /** All published posts, publishedAt desc (view-models). */
  posts: BlogCardVM[];
  /** The featured post id (featured:true → most recent fallback). */
  featuredId: string | null;
  categories: CategoryVM[];
  labels: Labels;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 3; // 1 riga sulla 3-col → niente righe vuote; 5 post in "Tutti" → 2 pagine

/**
 * BlogListing — client filter + pagination over the published posts.
 *
 * "Tutti": featured shown large on top, excluded from the grid; grid = the rest.
 * Category filter active: featured hidden, grid = ALL posts of that category
 * (the previously-featured post reappears in the grid if it belongs). Filter is
 * by category _id; changing it resets to page 1. Pagination shows only if >1
 * page. Tokens only; dark section.
 */
export function BlogListing({
  posts,
  featuredId,
  categories,
  labels,
  pageSize = DEFAULT_PAGE_SIZE,
}: Props) {
  const [activeCat, setActiveCat] = useState<string | null>(null); // null = "Tutti"
  const [page, setPage] = useState(1);
  // Altezza riservata = quella della 1ª pagina (la più piena). Le pagine corte
  // mantengono questa min-height → il layout NON collassa, la sezione resta
  // ferma e la barra non "scatta" al cambio pagina (nessuno scroll). Ricalcolata
  // a ogni cambio filtro (reset a undefined).
  const gridRef = useRef<HTMLDivElement>(null);
  const [reservedH, setReservedH] = useState<number>();

  const isAll = activeCat === null;
  const featured = isAll && featuredId ? (posts.find((p) => p.id === featuredId) ?? null) : null;

  const gridPosts = useMemo(() => {
    if (isAll) return posts.filter((p) => p.id !== featuredId);
    return posts.filter((p) => p.categoryIds.includes(activeCat));
  }, [posts, isAll, featuredId, activeCat]);

  const totalPages = Math.max(1, Math.ceil(gridPosts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = gridPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Cattura l'altezza della 1ª pagina (min-height da riservare) una volta per filtro.
  useLayoutEffect(() => {
    if (currentPage === 1 && reservedH === undefined && gridRef.current) {
      setReservedH(gridRef.current.offsetHeight);
    }
  }, [currentPage, reservedH, pageItems.length]);

  const selectCat = (id: string | null) => {
    setActiveCat(id);
    setPage(1);
    setReservedH(undefined); // ricalcola la riserva per il nuovo filtro
  };

  return (
    <section className="fa-section dark">
      <div className="fa-container">
        {/* Filtri categoria */}
        <div className="mb-22 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className={`fa-pill on-dark ${isAll ? "active" : ""}`}
            aria-pressed={isAll}
            onClick={() => selectCat(null)}
          >
            {labels.all}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`fa-pill on-dark ${activeCat === c.id ? "active" : ""}`}
              aria-pressed={activeCat === c.id}
              onClick={() => selectCat(c.id)}
            >
              {c.title}
            </button>
          ))}
        </div>

        {/* Featured (solo in "Tutti") */}
        {featured ? <FeaturedCard post={featured} readLabel={labels.readArticle} /> : null}

        {/* Griglia */}
        {pageItems.length === 0 ? (
          <p className="fa-body-lg text-center" style={{ color: "var(--fa-text-on-dark)" }}>
            {labels.empty}
          </p>
        ) : (
          <div
            key={currentPage}
            ref={gridRef}
            className="fa-fade-in grid grid-cols-1 content-start gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
            style={{ minHeight: reservedH ? `${reservedH}px` : undefined }}
          >
            {pageItems.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}

        {/* Paginazione (solo se >1 pagina) */}
        {totalPages > 1 ? (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPage={setPage}
            prevLabel={labels.prev}
            nextLabel={labels.next}
          />
        ) : null}
      </div>
    </section>
  );
}

function FeaturedCard({ post, readLabel }: { post: BlogCardVM; readLabel: string }) {
  return (
    <IntentLink
      href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }}
      className="group mb-18 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-center lg:gap-14"
    >
      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: "4 / 5", background: "var(--fa-card-cover)" }}
      >
        {post.coverUrl ? (
          <SanityImage
            src={post.coverUrl}
            alt={post.coverAlt}
            lang={post.coverAltLang}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 420px"
            className="object-cover transition-transform duration-(--dur-standard) ease-out-expo group-hover:scale-[1.03]"
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

      <div>
        {post.category ? (
          <p
            className="m-0 mb-4 text-micro-4 font-semibold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--fa-text-on-dark)" }}
          >
            {post.category}
          </p>
        ) : null}
        <h2
          className="m-0 text-display-5 font-semibold"
          style={{ lineHeight: 1.08, letterSpacing: "-0.3px", color: "var(--fa-text-on-dark)" }}
        >
          {post.title}
        </h2>
        {post.excerpt ? (
          <p
            className="fa-body-lg mt-heading-intro max-w-[52ch]"
            style={{ color: "var(--fa-text-on-dark)" }}
          >
            {post.excerpt}
          </p>
        ) : null}
        <p
          className="mt-5 text-micro-4 font-medium uppercase"
          style={{ letterSpacing: "0.08em", color: "var(--fa-text-on-dark)" }}
        >
          <MetaConData post={post} />
        </p>
        <span className="fa-pill active mt-7">{readLabel} →</span>
      </div>
    </IntentLink>
  );
}

/** Windowed page list with ellipsis: always show first/last + current ±1. */
function pageList(current: number, total: number): (number | "…")[] {
  const delta = 1;
  const out: (number | "…")[] = [];
  const start = Math.max(1, current - delta);
  const end = Math.min(total, current + delta);
  if (start > 1) {
    out.push(1);
    if (start > 2) out.push("…");
  }
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total) {
    if (end < total - 1) out.push("…");
    out.push(total);
  }
  return out;
}

/**
 * «← Precedente» e «Successivo →» (set 2026).
 * - Sotto `sm` solo la freccia: l'etichetta resta ai lettori di schermo. In italiano
 *   la barra era larga 414 px e a 390 allargava la viewport a 402, cioè la pagina
 *   intera rimpiccioliva e scorreva di lato; in DE, FR ed ES stava a 3-4 px dal bordo.
 * - Bersaglio a 44 su touch col `::after`, come i numeri qui sotto: la barra non cresce.
 * - Da disabilitata niente hover, e il focus è l'anello bianco dei fondi scuri (era oro
 *   fino al 20/10/2026): quello
 *   di default del browser, blu, misurava 2,28:1 sul navy.
 */
const FRECCIA =
  "relative inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition-colors enabled:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fa-stroke-color) disabled:cursor-not-allowed disabled:opacity-(--fa-opacity-disabled) pointer-coarse:after:absolute pointer-coarse:after:-inset-1 pointer-coarse:after:content-['']";

function Pagination({
  page,
  totalPages,
  onPage,
  prevLabel,
  nextLabel,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <nav className="mt-16 flex justify-center px-4" aria-label="Pagination">
      {/* Barra unica navy a forma di pill/stadio (rounded-pill, NON rounded-full
          che in questo theme = 50% → ellisse), testo bianco (design Marco). */}
      <div
        className="inline-flex items-center gap-1 rounded-pill px-2 py-2"
        style={{ background: "var(--fa-navy)", color: "var(--fa-text-on-dark)" }}
      >
        <button
          type="button"
          className={FRECCIA}
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          <span aria-hidden>←</span> <span className="sr-only sm:not-sr-only">{prevLabel}</span>
        </button>
        {pageList(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} aria-hidden className="px-2 text-sm select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`relative flex size-9 items-center justify-center rounded-pill text-sm transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fa-stroke-color) pointer-coarse:after:absolute pointer-coarse:after:-inset-1 pointer-coarse:after:content-[''] ${
                p === page ? "bg-white/15 font-semibold" : "font-normal"
              }`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={FRECCIA}
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
        >
          <span className="sr-only sm:not-sr-only">{nextLabel}</span> <span aria-hidden>→</span>
        </button>
      </div>
    </nav>
  );
}
