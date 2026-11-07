import { createImageUrlBuilder } from "@sanity/image-url";
import type { Image } from "sanity";

import { dataset, projectId } from "../env";

const builder = createImageUrlBuilder({ projectId, dataset });

export function urlFor(source: Image | { asset?: { _ref?: string } | null } | null | undefined) {
  if (!source) return undefined;
  return builder
    .image(source as Image)
    .auto("format")
    .fit("max");
}

/**
 * Returns LQIP base64 + dimensions when present in image metadata.
 * Sanity asset CDN ships LQIP natively (asset->metadata.lqip).
 *
 * La firma accetta `null` oltre a `undefined` su OGNI livello perche' e' la shape
 * che TypeGen genera davvero: `metadata: SanityImageMetadata | null`, e dentro
 * `dimensions` i numeri sono opzionali. Con la firma stretta di prima
 * (`metadata?: {...}`, width/height/aspectRatio obbligatori) nessuna proiezione
 * del progetto passava il typecheck, ed e' il motivo per cui la funzione e'
 * rimasta scritta e mai chiamata da agosto 2026 fino alla PR sugli scatti.
 */
export function pickLqip(
  image:
    | {
        metadata?: {
          lqip?: string | null;
          dimensions?: {
            width?: number | null;
            height?: number | null;
            aspectRatio?: number | null;
          } | null;
        } | null;
      }
    | null
    | undefined,
) {
  if (!image?.metadata) return null;
  return {
    lqip: image.metadata.lqip,
    width: image.metadata.dimensions?.width,
    height: image.metadata.dimensions?.height,
    aspectRatio: image.metadata.dimensions?.aspectRatio,
  };
}
