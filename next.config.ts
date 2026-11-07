import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { ACTIVE_LOCALES } from "./src/i18n/routing";
import {
  redirectGuida316,
  redirectLegali,
  redirectPermanenti,
  redirectVecchioSito,
  rewriteDopoIFile,
} from "./src/lib/redirects";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * L'host dei video dell'hero. ⚠️ **Il video lo sceglie Sanity**: l'URL sta in un
 * campo del documento, quindi se un video passa a un altro host, quell'host va
 * aggiunto qui, o la CSP lo segnala (e dalla policy che blocca, lo ferma).
 * `R2_PUBLIC_URL` non la legge nessun file: per questo l'host è scritto a mano.
 */
const HOST_MEDIA = "https://media.fontealta.it";

/** Dove i browser mandano le violazioni: `report-uri` e `Reporting-Endpoints`. */
const ENDPOINT_CSP = "/api/csp-report";

/**
 * La Content Security Policy, direttiva per direttiva. Ogni sorgente viene
 * dall'inventario del servito del 15/10/2026 (85 pagine, 17 tipi × 5 lingue):
 * il verbale sta in `docs/history/2026-10-15-csp-report-only.md`.
 *
 * ⚠️ **`'unsafe-inline'` su script e stili non è una svista.** Il payload di Next
 * è fatto di `<script>` inline e le pagine portano attributi `style`: senza
 * nonce o hash, toglierlo spegnerebbe il sito. Il nonce vorrebbe dire tutte le
 * pagine dinamiche, cioè niente ISR e niente cache CDN (guida di Next, «Static vs
 * Dynamic Rendering with CSP»). Quello che la policy protegge sono le origini
 * ESTERNE: script, connessioni, frame, moduli e media da host non elencati.
 *
 * ⚠️ Plausible e Iubenda sono spenti (rule `legali-contatti`). Riaccenderli vuole
 * anche i loro host qui: `https://plausible.io` in `script-src` e `connect-src`,
 * e gli host di `cdn.iubenda.com`.
 */
function politicaCsp(anteprima: boolean): string {
  const direttive: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    // `data:`: le anteprime sfocate di `next/image`. Unsplash: ripiego scritto nel
    // codice dell'indice delle collezioni e dell'hero di collezione.
    "img-src": ["'self'", "data:", "https://cdn.sanity.io", "https://images.unsplash.com"],
    "media-src": ["'self'", HOST_MEDIA],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    // `'self'`: la tavola dell'officina, in iframe su `/officina` (27/10/2026). Google:
    // la mappa di `/contatti`, le cui richieste DENTRO l'iframe le governa Google.
    "frame-src": ["'self'", "https://www.google.com"],
    // Come `X-Frame-Options: SAMEORIGIN`: lo Studio incornicia il sito.
    "frame-ancestors": ["'self'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };
  // La toolbar di Vercel vive solo sulle anteprime: stesso cancello di `robots.ts`.
  // Host presi alla lettera da https://vercel.com/docs/vercel-toolbar/managing-toolbar,
  // «Using a Content Security Policy».
  if (anteprima) {
    direttive["script-src"].push("https://vercel.live");
    direttive["connect-src"].push("https://vercel.live", "wss://ws-us3.pusher.com");
    direttive["img-src"].push("https://vercel.live", "https://vercel.com", "blob:");
    direttive["frame-src"].push("https://vercel.live");
    direttive["style-src"].push("https://vercel.live");
    direttive["font-src"].push("https://vercel.live", "https://assets.vercel.com");
  }
  // Tutti e due i meccanismi: chi supporta `report-to` ignora `report-uri`, e
  // `report-to` non è ancora supportato ovunque (MDN, `report-uri`).
  return [
    ...Object.entries(direttive).map(([nome, sorgenti]) => `${nome} ${sorgenti.join(" ")}`),
    `report-uri ${ENDPOINT_CSP}`,
    "report-to csp-endpoint",
  ].join("; ");
}

const nextConfig: NextConfig = {
  // `x-powered-by: Next.js` usciva sulle risposte dinamiche: dice il framework a
  // chi cerca bersagli, e a nessun altro serve.
  poweredByHeader: false,
  experimental: {
    // Una pagina che fallisce il prerender si ritenta fino a 3 volte prima di far cadere il build
    // (Marco, 3/11/2026). Il 2/11 due build di produzione su Vercel sono caduti su
    // `COLLECTION_DETAIL_QUERY`, la query più pesante del prerender (circa 2,7 MB per lingua),
    // con `ECONNRESET` verso apicdn.sanity.io e la cache dati fredda per quella query; i Redeploy
    // sono passati, e in locale il build passa sempre. ⚠️ Opzione SPERIMENTALE (doc di Next,
    // «staticGeneration*», `node_modules/next/dist/docs/01-app/03-api-reference/05-config/
    // 01-next-config-js/staticGeneration.md`): si ricontrolla a ogni aggiornamento di Next, e
    // se il build cade ancora si alleggerisce la query (rule `ci-deploy`).
    staticGenerationRetryCount: 3,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
    // Le due liste da cui next/image ricava i candidati del `srcSet`. Con `sizes`
    // presente le usa TUTTE — `[...imageSizes, ...deviceSizes]` — e coi default
    // (8 + 8) ogni foto prodotto portava 15 URL nell'HTML.
    //
    // Sono GLOBALI: non esiste una scala per-immagine, quindi tagliare in basso
    // spegnerebbe gli hero full-bleed, che a 1440 in DPR 2 chiedono 2880 px e
    // prendono 3840. Via solo le taglie che nessuno sceglie mai:
    //  - 16·32·48·64 — sotto i 96 px c'è il solo monogramma da 36 di nav e footer,
    //    che sale al gradino dopo per qualche centinaio di byte;
    //  - 750, che dista il 10% da 828;
    //  - 2048, che sta fra 1920 e 3840 e non è l'ottimo di nessun viewport.
    // Restano 1200 (390 px in DPR 3 = 1170) e 828 (414 in DPR 2): i due casi
    // mobile veri, che tagliati costerebbero banda proprio dove pesa di più.
    // Risultato: 15 candidati per foto → 10.
    deviceSizes: [640, 828, 1080, 1200, 1920, 3840],
    imageSizes: [96, 128, 256, 384],
    // Next 16: il default di `qualities` è [75]; un `quality` non in lista viene
    // coerciuto al più vicino. 90 per foto ad alto dettaglio (team-teaser
    // stabilimento); 82 per le cover collezione (CollectionCard) → meno doppia
    // compressione sui gradienti scuri. 75 resta il default altrove.
    qualities: [75, 82, 90],
  },
  // Doppioni di rotta, indirizzi legali ritirati e indirizzi fissi del vecchio sito,
  // intercettati PRIMA della riscrittura del proxy di next-intl: è l'unico punto in cui
  // si può, e il perché sta in `src/lib/redirects.ts`. `permanent: true` → 308; la parte 2
  // della guida 316/304 è un 301 esplicito (5/11/2026).
  redirects() {
    return [
      ...redirectPermanenti(ACTIVE_LOCALES),
      ...redirectLegali(ACTIVE_LOCALES),
      ...redirectGuida316(ACTIVE_LOCALES),
      ...redirectVecchioSito(),
    ];
  },
  // Icone Apple, schede del vecchio sito e percorsi senza lingua: dopo i file veri e
  // prima delle rotte dinamiche. Il perché, e la cura scartata, in `src/lib/redirects.ts`.
  rewrites() {
    return { beforeFiles: [], afterFiles: rewriteDopoIFile(ACTIVE_LOCALES), fallback: [] };
  },
  /**
   * Gli header di risposta: quattro **sempre**, più `X-Robots-Tag` in anteprima,
   * e la CSP in Report-Only su tutto tranne lo Studio.
   *
   * ⚠️ **Prima questa funzione restituiva `[]` in produzione**, cioè il sito
   * pubblico non mandava nessun header nostro: c'era solo il no-index dello
   * staging (M20). I cinque qui sotto valgono in tutti e due gli stati, e il
   * cancello M20 resta esattamente com'era.
   *
   * ⚠️ **`X-Frame-Options: SAMEORIGIN` e NON `DENY`.** Lo Studio vive in
   * `src/app/studio/[[...tool]]`, sullo stesso dominio, e la sua anteprima in
   * draft mode incornicia il sito: `DENY` blocca anche l'origine stessa, quindi
   * spegnerebbe una funzione che usiamo. `SAMEORIGIN` chiude i siti altrui e
   * lascia lavorare il nostro.
   *
   * ⚠️ **`Permissions-Policy` elenca solo quello che serve spegnere**, e non
   * `autoplay`, `fullscreen` o `picture-in-picture`: il video dell'hero è
   * `autoPlay muted loop playsInline` (`hero-media-bg.tsx:105`) e una direttiva
   * `autoplay=()` lo fermerebbe. Camera, microfono, geolocalizzazione e
   * pagamenti il sito non li usa in nessun punto, quindi negarli non toglie
   * niente e chiude una superficie.
   *
   * ⚠️ **`Strict-Transport-Security` NON si dichiara qui**: lo mette Vercel, e
   * riscriverlo vorrebbe dire decidere noi `max-age` e `preload`, cioè prendere
   * una decisione irreversibile (il preload si toglie con mesi di attesa) al
   * posto di chi la gestisce già.
   *
   * ⚠️ **La CSP è in `Report-Only`**: segnala, non blocca. La policy che blocca
   * arriva dopo una settimana senza violazioni, e lì entra anche
   * `upgrade-insecure-requests`. È **statica, senza nonce** (v. `politicaCsp`).
   *
   * ⚠️ **Lo Studio resta senza CSP** (decisione di Marco): il `source` esclude
   * `/studio` e `/studio/…`, con la stessa forma del matcher di `src/proxy.ts`.
   * `/studiox` invece la prende.
   *
   * ⚠️ **La tavola dell'officina è `noindex` anche in produzione**: è una pagina
   * statica, servita dentro l'iframe di `/officina`, e non deve finire nei risultati
   * da sola (spec `docs/specs/tavola-officina.md`).
   */
  headers() {
    const comuni = [
      // Il browser non tira a indovinare il tipo di un file: se il server dice
      // `text/plain`, resta testo anche se dentro c'è del JavaScript.
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      // L'origine sì, il percorso no, e verso `http` niente: un referrer che
      // porta l'URL intero rivela a terzi quale scheda prodotto si stava
      // guardando.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
    ];
    // ⚠️ Stesso cancello di `robots.ts`: l'ambiente, non `NEXT_PUBLIC_SITE_URL`, che
    // su Vercel è una sola variabile per Production e Preview. `noindex` su
    // anteprime, `vercel dev` e build locale; in produzione nessun header.
    const inAnteprima = process.env.VERCEL_ENV !== "production";
    const anteprima = inAnteprima ? [{ key: "X-Robots-Tag", value: "noindex" }] : [];
    return [
      { source: "/:path*", headers: [...comuni, ...anteprima] },
      {
        source: "/((?!studio(?:/|$)).*)",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: politicaCsp(inAnteprima) },
          // L'URL relativo vale: si risolve sull'URL della risposta (W3C Reporting, §3.3).
          { key: "Reporting-Endpoints", value: `csp-endpoint="${ENDPOINT_CSP}"` },
        ],
      },
      { source: "/officina-tavola/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
