import Image from "next/image";
import { useTranslations } from "next-intl";

import { SanityImage } from "@/components/media/sanity-image";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { pickLqip, urlFor } from "@/sanity/lib/image";
import type { CONCEALED_BODY_BY_SLUG_QUERY_RESULT } from "@/sanity/types.gen";
import type { AltRisolto } from "@/lib/alt-composto";

/**
 * Stessa geometria del riquadro di `ModelHero`: la colonna `2fr` di
 * `lg:grid-cols-[3fr_2fr]` con `gap-16` dentro `.fa-container` (max 1200), cioe'
 * (1200 - 64) x 2/5 = 454,4px da `lg` in su; sotto, una colonna a tutta
 * larghezza. La costante e' ripetuta e non importata dall'altro hero: sono due
 * pagine diverse, e se un giorno una delle due griglie cambia l'altra non deve
 * seguirla per inerzia.
 */
const FOTO_SIZES = "(max-width: 1023px) calc(100vw - 48px), 455px";

interface Props {
  breadcrumb: { items: BreadcrumbItem[]; ariaLabel: string };
  body: NonNullable<CONCEALED_BODY_BY_SLUG_QUERY_RESULT>;
  /** L'alt della foto nella lingua della pagina, risolto dalla pagina (`altProdotto`). */
  fotoAlt: AltRisolto;
}

/**
 * BodyHero — il NEGATIVO dell'hero modello (docs/incassi-design.md §7). Stesso
 * layout B «text-forward»: pannello info ~60% + riquadro monogramma ~40%.
 *
 * Via rispetto al modello: selettore finiture (un corpo non ne ha) e riga meta
 * «tipologia · N finiture» (un corpo non ha né l'una né le altre; gli ambiti serviti
 * stanno nelle specifiche, come riga propria).
 *
 * ⚠️ L'H1 è il CODICE, non `name`. Sui 17 documenti `name` è un doppione esatto del
 * codice: è uno slot per un eventuale nome parlante futuro e il titolo nello Studio.
 * Chi lo trova popolato e non a schermo non stia cercando un bug.
 */
export function BodyHero({ body, breadcrumb, fotoAlt }: Props) {
  const t = useTranslations("corpiIncasso");

  // `description[$locale]` a runtime è l'array di block (quirk typegen M6 → cast);
  // è sempre un paragrafo di plain text, come sui modelli. Flatten dei children.
  const descBlocks = body.description as unknown as Array<{
    children?: Array<{ text?: string }> | null;
  } | null> | null;
  const descText = (descBlocks ?? [])
    .flatMap((b) => (b?.children ?? []).map((c) => c?.text ?? ""))
    .join("")
    .trim();

  // Foto del corpo: l'alt arriva risolto dalla pagina (`altI18n`, composto, italiano).
  // Guardia LQIP come sugli altri due: `lqip` e' opzionale nei metadata.
  const fotoUrl = body.image?.asset ? urlFor(body.image)?.url() : undefined;
  const fotoLqip = pickLqip(body.image)?.lqip ?? undefined;

  return (
    <section className="fa-section light" style={{ paddingBottom: "var(--fa-space-sheet-bottom)" }}>
      <div className="fa-container">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div>
            {/* Risalita all'indice dei corpi, non all'archivio collezioni: è il
                livello immediatamente sopra. */}
            <Breadcrumb {...breadcrumb} className="mb-8" />

            <span className="fa-eyebrow mb-4" style={{ display: "block" }}>
              {t("eyebrow")}
            </span>

            <h1 className="fa-h2" style={{ fontStyle: "normal", color: "var(--fa-text-primary)" }}>
              {body.code}
            </h1>

            {descText && (
              <div
                className="mt-3"
                style={{
                  fontWeight: 500,
                  color: "var(--fa-text-primary)",
                }}
              >
                {descText}
              </div>
            )}
          </div>

          {/* Riquadro foto 1:1, come sulla scheda modello. La foto e' `image` da
              Sanity: al 28 agosto 2026 la hanno tutti e 17 i corpi, misurato sul
              dataset. E' above-the-fold ed e' l'LCP della pagina, quindi
              `priority`. Il monogramma resta come fallback per un corpo nuovo
              inserito senza immagine. */}
          <div
            className="relative flex items-center justify-center overflow-hidden"
            style={{
              aspectRatio: "1 / 1",
              background: "var(--color-fa-card-cover)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            {fotoUrl ? (
              <SanityImage
                src={fotoUrl}
                alt={fotoAlt.alt}
                lang={fotoAlt.lang}
                fill
                sizes={FOTO_SIZES}
                quality={82}
                priority
                placeholder={fotoLqip ? "blur" : undefined}
                blurDataURL={fotoLqip}
                className="object-cover"
              />
            ) : (
              <Image
                src="/brand/fontealta-monogram-gray.png"
                alt=""
                width={400}
                height={400}
                aria-hidden
                className="h-auto w-1/2 opacity-(--fa-opacity-watermark)"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
