import { SanityImage } from "@/components/media/sanity-image";

import { urlFor } from "@/sanity/lib/image";
import type { REFERENCE_BY_SLUG_QUERY_RESULT } from "@/sanity/types.gen";

type Gallery = NonNullable<NonNullable<REFERENCE_BY_SLUG_QUERY_RESULT>["gallery"]>;

interface Props {
  gallery: Gallery;
}

/**
 * ReferenceGallery — Server Component. Griglia regolare 2 colonne desktop / 1
 * mobile di immagini `imageWithMeta` (spec §D3 / §10.3 default griglia regolare,
 * non mosaico). Gated sul caller: questo componente assume gallery non vuota.
 */
export function ReferenceGallery({ gallery }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {gallery.map((img) => {
        const url = urlFor(img)?.width(1200).height(900).url() ?? null;
        if (!url) return null;
        return (
          <figure key={img._key} className="m-0">
            <div
              className="relative aspect-[4/3] overflow-hidden rounded-lg"
              style={{ background: "var(--fa-card-cover)" }}
            >
              <SanityImage
                src={url}
                alt={img.alt ?? ""}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            {img.caption && (
              <figcaption className="mt-2 text-micro-2 tracking-1 text-fa-text-tertiary">
                {img.caption}
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}
