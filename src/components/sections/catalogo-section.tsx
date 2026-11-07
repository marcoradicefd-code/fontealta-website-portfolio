import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import { elencoPaesi } from "@/lib/paesi";

import { CatalogoForm } from "./catalogo-form";

/**
 * La sezione del catalogo, su `/collezioni` e su `/contatti` (19/10/2026, Marco): testo e modulo
 * a sinistra, copertina a destra, su fondo chiaro. Era la sezione 3 di `/collezioni`, con due
 * bottoni al posto del modulo («Scarica il PDF», che portava al modulo generale, e «Richiedi
 * catalogo cartaceo», tolto: il cartaceo esce dal sito, Q8).
 *
 * `id="catalogo"` per i rimandi dei moduli generali (`rimando-catalogo.tsx`). I testi stanno nel
 * namespace solo-server `catalogo`; quelli del modulo, che è client, in `contatti.form`.
 */
export function CatalogoSection() {
  const t = useTranslations("catalogo");
  // Elenco dei Paesi calcolato qui, sul server, nella lingua della pagina (v. `src/lib/paesi.ts`).
  const locale = useLocale();

  return (
    <section id="catalogo" className="fa-section light overflow-hidden">
      <div className="fa-container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Colonna sinistra — testo + modulo */}
          <div>
            <span className="fa-eyebrow">{t("eyebrow")}</span>
            <h2
              className="m-0 mt-eyebrow"
              style={{
                fontSize: "var(--text-heading-2)",
                lineHeight: 1.08,
                letterSpacing: "-0.4px",
                fontWeight: 600,
              }}
            >
              {t("titolo")}
            </h2>
            {/* Sotto `sm` il sottotitolo non si mostra (Marco, 19/10/2026): il modulo sale. */}
            <p
              className="fa-body-lg mt-heading-intro hidden max-w-[460px] sm:block"
              style={{ color: "var(--fa-text-secondary)" }}
            >
              {t("sottotitolo")}
            </p>
            <CatalogoForm paesi={elencoPaesi(locale)} />
          </div>

          {/* Colonna destra — cover teal (placeholder, → asset M5) */}
          <div
            className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl shadow-(--shadow-product)"
            style={{ background: "#14a39a" }}
          >
            <div className="text-center">
              {/* Alto 80 px e largo in proporzione al file (1146 × 1241, circa 73,9 px): fino al
                  27/10/2026 era un quadrato e il disegno usciva stirato dell'8%. */}
              <Image
                src="/brand/fontealta-monogram-gray.png"
                alt=""
                width={74}
                height={80}
                aria-hidden
                className="mx-auto aspect-[1146/1241] h-20 w-auto opacity-(--fa-opacity-subdued)"
              />
              <div
                className="mt-6 text-micro-4 font-medium tracking-5 uppercase"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                {t("badgeAnno")}
              </div>
              <div
                className="mt-2 leading-none"
                style={{
                  fontSize: "var(--text-heading-3)",
                  fontWeight: 600,
                  letterSpacing: "-0.5px",
                  color: "#fcfffe",
                }}
              >
                {t("badgePagine")}
              </div>
              {/* Senza il peso (Marco, 19/10/2026): 20.040.385 byte sono 20 MB o 19 MiB secondo
                  la base, e cambierà col PDF più leggero. */}
              <div
                className="mt-2 text-micro-4 font-medium tracking-5 uppercase"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {t("badgeFormato")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
