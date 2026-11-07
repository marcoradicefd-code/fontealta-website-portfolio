/**
 * Dichiarazioni dei moduli immagine (`*.webp`, `*.png`, …) per gli import
 * statici usati da next/image.
 *
 * NON e' ridondante con `next-env.d.ts`, che porta lo stesso reference: quel
 * file e' **gitignored** e viene rigenerato da `next build` / `next dev`.
 * In CI `typecheck` ha `needs: install` e gira PRIMA di `build`, quindi li'
 * `next-env.d.ts` non esiste e senza questo file `tsc` fallisce con TS2307 su
 * ogni import di immagine, pur passando in locale dove il build c'e' gia'
 * stato. Verificato il 26/08/2026 sulla PR #116.
 */
/// <reference types="next/image-types/global" />
