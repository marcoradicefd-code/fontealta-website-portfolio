import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * StoriaSection — SEZIONE 1 della pagina Chi siamo, "Due mestieri, un'idea."
 *
 * Split editoriale dark: foto prodotto B/N a sinistra (asset locale
 * public/chi-siamo/storia.webp — uomo + miscelatore, già monocromatica) +
 * eyebrow / H2 / quattro paragrafi a destra. Stack verticale < 768px.
 *
 * La foto è ancorata a QUESTA sezione e non a un'altra: il paragrafo sul padre
 * di Andrea, che sapeva far scorrere l'acqua dentro un corpo di metallo, è
 * esattamente ciò che l'immagine mostra. Le sezioni 2-5 sono di solo testo
 * (SezioneTesto) — lo split spezza il ritmo qui, dove serve.
 */
const STORY_IMAGE = "/chi-siamo/storia.webp";

export function StoriaSection() {
  const t = useTranslations("chiSiamo");

  const paragraphs = [t("s1P1"), t("s1P2"), t("s1P3"), t("s1P4")];

  return (
    <section className="fa-section dark" style={{ background: "var(--fa-ink)" }}>
      <div className="fa-container">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[2fr_3fr] md:gap-16">
          {/* Immagine prodotto B/N */}
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: "var(--radius-xl)",
              aspectRatio: "4 / 5",
              background: "var(--fa-card-cover)",
            }}
          >
            <Image
              src={STORY_IMAGE}
              alt={t("s1ImageAlt")}
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
            />
          </div>

          {/* Testo sezione 1 */}
          <div style={{ maxWidth: 540 }}>
            <span className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("s1Eyebrow")}
            </span>
            <h2 className="fa-h2 mt-eyebrow-feature" style={{ color: "var(--fa-text-on-dark)" }}>
              {t("s1H2")}
            </h2>
            {paragraphs.map((p, i) => (
              <p
                key={i}
                className={i === 0 ? "fa-body-lg mt-heading-intro-feature" : "fa-body-lg mt-6"}
                style={{ color: "var(--fa-text-on-dark)" }}
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
