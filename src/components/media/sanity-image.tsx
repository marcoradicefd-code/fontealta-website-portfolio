"use client";

import Image, { type ImageProps } from "next/image";
import { imageLoader } from "next-sanity/image";

/**
 * `<Image>` di Next che chiede le derivate DIRETTAMENTE al CDN di Sanity.
 *
 * PERCHE' ESISTE QUESTO WRAPPER, che sembra un giro inutile intorno a una prop.
 * `loader` e' una prop FUNZIONE, e una funzione non attraversa il confine RSC: la
 * documentazione di Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/
 * 02-components/image.md`, sezione `loader`) mostra l'esempio App Router con
 * `'use client'` in cima, ed e' obbligatorio. `ModelCard`, `ModelHero` e `UsedBy`
 * sono Server Component: da li' `loader={imageLoader}` non si puo' passare. Anche
 * `next-sanity/image` e' a sua volta un modulo `"use client"`. Il wrapper e' il
 * punto in cui la funzione resta dalla parte giusta del confine; chi lo usa passa
 * solo props serializzabili e resta server.
 *
 * PERCHE' NON `loaderFile` GLOBALE in `next.config.ts`: intercetterebbe anche
 * `/brand/fontealta-monogram-gray.png` (il fallback dei 32 modelli senza foto) e i
 * placeholder Unsplash, che non sono URL di Sanity — si romperebbero in silenzio.
 *
 * COSA CAMBIA NEI FATTI. Senza loader, l'URL interno che finisce dentro
 * `/_next/image?url=…` e' l'originale `?fit=max&auto=format` SENZA `w`: per ogni
 * larghezza del srcSet l'ottimizzatore di Vercel si scarica il file nativo
 * 3072x3072 (9,4 megapixel) e ridimensiona lui — misurato 1,4-1,9 s a freddo.
 * Con il loader il browser chiede `cdn.sanity.io/…?w=384&q=82`, e la riduzione la
 * fa Sanity all'edge: 0,31-0,45 s sulle stesse taglie mai viste prima. In piu' si
 * esce dal tetto di 5.000 trasformazioni/mese del piano Hobby.
 *
 * VINCOLO: `src` deve essere un URL ASSOLUTO su `cdn.sanity.io`. `imageLoader` fa
 * `new URL(src)` e su un percorso relativo lancia. Non e' un difetto da tappare con
 * un fallback: un `src` non-Sanity qui e' un errore di chiamata, e deve vedersi.
 * Il ramo monogramma dei chiamanti usa `next/image` normale, non questo componente.
 */
type Props = Omit<ImageProps, "loader">;

/**
 * `alt` e' estratto e riscritto esplicitamente invece di finire nello spread:
 * `jsx-a11y/alt-text` guarda le prop scritte sul tag e su un solo `{...props}`
 * segnala un warning, che sarebbe rumore permanente sulla baseline del lint.
 * Obbligatorio comunque: `ImageProps` lo richiede.
 */
export function SanityImage({ alt, ...rest }: Props) {
  return <Image loader={imageLoader} alt={alt} {...rest} />;
}
