/**
 * SezioneTesto — sezione editoriale per la pagina Chi siamo (S2, S3, S4, S5).
 *
 * Griglia 2fr/3fr, la STESSA di StoriaSection: dove la S1 ha la foto, qui c'è il
 * titolo. I paragrafi stanno nella colonna destra a 540px, identica alla colonna
 * di testo della S1, così da S1 a S5 la lettura scende su un'unica colonna
 * allineata alla stessa x.
 *
 * Perché 540 e non 760: misurati in pagina, 760px a 18px davano 93-97 caratteri
 * per riga, fuori dalla forbice 45-75 e sopra il tetto di 80 di WCAG 1.4.8.
 * A 540 sono ~56, il punto ottimo di Ruder (50-60), lo stesso della S1.
 *
 * `pt-0`: due .fa-section consecutive sommano i padding (136+136=272), mentre
 * lo stacco hero -> S1 e' 136 perche' l'hero non ha padding sotto. Azzerando
 * quello superiore ogni intervallo torna a 136, uniforme.
 *
 * Non legge i18n: riceve i testi gia' risolti dal chiamante, come ProgettareCta.
 */
interface SezioneTestoProps {
  /** Sopratitolo piccolo maiuscolo. Omesso se non passato. */
  eyebrow?: string;
  titolo: string;
  paragrafi: string[];
}

export function SezioneTesto({ eyebrow, titolo, paragrafi }: SezioneTestoProps) {
  return (
    <section className="fa-section dark pt-0" style={{ background: "var(--fa-ink)" }}>
      <div className="fa-container">
        <div className="grid grid-cols-1 items-start gap-heading-intro-feature md:grid-cols-[2fr_3fr] md:gap-16">
          {/* Colonna sinistra: il titolo, dove la S1 ha la foto */}
          <div>
            {eyebrow ? (
              <span className="fa-eyebrow on-dark" style={{ color: "var(--fa-text-on-dark)" }}>
                {eyebrow}
              </span>
            ) : null}
            <h2
              className={eyebrow ? "fa-h2 mt-eyebrow-feature" : "fa-h2"}
              style={{ color: "var(--fa-text-on-dark)" }}
            >
              {titolo}
            </h2>
          </div>

          {/* Colonna destra: il testo, 540px come nella S1 */}
          <div style={{ maxWidth: 540 }}>
            {paragrafi.map((p, i) => (
              <p
                key={i}
                className={i > 0 ? "fa-body-lg mt-6" : "fa-body-lg"}
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
