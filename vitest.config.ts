import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * ⚠️ **Vitest non legge `.env.local` da sé, Next sì.** `sanity/env.ts` fa
     * `assertValue` su `NEXT_PUBLIC_SANITY_PROJECT_ID` e **lancia** se manca:
     * qualsiasi test che importi, anche di rimbalzo, il builder delle immagini
     * moriva all'IMPORT, cioè con «0 test» e non con un test rosso. In CI non si
     * vedeva, perché `ci.yml` esporta quelle variabili a livello di workflow: il
     * guasto era solo locale, che è il posto peggiore dove averlo.
     *
     * Le tre righe qui sotto sono le STESSE di `ci.yml:16-18`, fallback
     * compresi: sono `NEXT_PUBLIC_*`, cioè valori che finiscono inlinati nel
     * bundle e visibili nell'HTML servito, non segreti. `loadEnv` di Vite
     * leggerebbe `.env.local` da sé, ma `vite` non è una dipendenza diretta di
     * questo progetto e `vitest/config` non lo riesporta: provato.
     */
    env: {
      NEXT_PUBLIC_SANITY_PROJECT_ID: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "mwlqc6ab",
      NEXT_PUBLIC_SANITY_DATASET: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
      NEXT_PUBLIC_SANITY_API_VERSION: process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2024-10-01",
    },
    environment: "jsdom",
    globals: true,
    /**
     * ⚠️ **Anche `scripts/`, e non è una comodità.** Gli strumenti di traduzione
     * stanno fuori dal bundle per scelta, ma la loro parte pura — i controlli
     * che decidono se una traduzione si può scrivere su Sanity — è esattamente
     * il codice che non deve sbagliare. Lasciandola fuori dall'`include`, i suoi
     * test esisterebbero e non girerebbero: il guasto peggiore, perché il file
     * c'è e sembra coperto.
     */
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    // `next-intl` va PROCESSATA da Vite, non esternalizzata: solo così l'alias
    // `next/navigation` qui sotto vale anche per i suoi import interni. Senza
    // questa riga l'alias non morde e il file di test fallisce all'import.
    // `next-sanity` per la stessa ragione: la guardia dei metadata importa la
    // pagina vera, che di rimbalzo tira dentro `next-sanity/image`, il quale
    // importa `next/image` senza estensione. Senza l'inline, l'alias qui sotto
    // non lo raggiunge e il file muore all'import, cioè con «0 test».
    server: { deps: { inline: ["next-intl", "next-sanity"] } },
  },
  resolve: {
    alias: {
      // ⚠️ **`@/sanity` va PRIMA di `@`, e l'ordine è tutto.** Vite scorre gli
      // alias in ordine di inserimento e si ferma al primo che combacia: con `@`
      // davanti, `@/sanity/lib/image` diventava `src/sanity/lib/image`, che non
      // esiste, e il file di test falliva all'IMPORT — cioè con «0 test», non con
      // un test rosso. In `tsconfig.json` non si nota perché TypeScript prende
      // sempre il pattern più specifico.
      "@/sanity": path.resolve(__dirname, "./sanity"),
      "@": path.resolve(__dirname, "./src"),
      // `createNavigation` di next-intl importa `next/navigation` senza
      // estensione. Il bundler di Next lo risolve, Vite in ambiente Node no, e
      // il file fallisce all'IMPORT con «Did you mean next/navigation.js?»,
      // quindi con «0 test» e non con un test rosso: senza questa riga un intero
      // file di test può sparire senza che nessuno se ne accorga.
      "next/navigation": path.resolve(__dirname, "./node_modules/next/navigation.js"),
      // Stesso difetto, altro modulo: `next-sanity/dist/image` importa
      // `next/image` senza estensione, e Vite risponde «Did you mean
      // next/image.js?». Vale per la guardia che importa la pagina vera.
      "next/image": path.resolve(__dirname, "./node_modules/next/image.js"),
    },
  },
});
