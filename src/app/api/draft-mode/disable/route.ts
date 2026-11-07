import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Disable Sanity Draft Mode and redirect home.
 *
 * ⚠️ **Non usa `siteUrl()`, ed è deliberato.** Il consolidamento M24-bis unifica
 * le basi che compongono URL PUBBLICI: canonical, alternates, sitemap, JSON-LD.
 * Questa non è una di quelle. Qui serve rimandare l'editor alla home
 * **dell'origine da cui è arrivato**, che in anteprima è un dominio di preview e
 * in locale è `localhost`. Puntandola a `siteUrl()` un editor che esce dalla
 * modalità bozza su una preview verrebbe sbalzato in produzione, e in locale su
 * `fontealta.it`.
 *
 * Il vecchio codice ripiegava su `http://localhost:3000`, che in produzione
 * sarebbe stato sbagliato. La cura non è unificare la base: è **non averne una**.
 * `request.url` è l'origine reale della richiesta, quindi è giusta ovunque senza
 * bisogno di sapere dove gira.
 */
export async function GET(request: Request) {
  (await draftMode()).disable();
  return NextResponse.redirect(new URL("/", request.url));
}
