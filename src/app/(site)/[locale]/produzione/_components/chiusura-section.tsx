import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { buttonClasses } from "@/components/ui/button";
import type { ActiveLocale } from "@/i18n/routing";

import { OfficinaLink } from "./officina-link";

interface ChiusuraSectionProps {
  locale: ActiveLocale;
}

/** La didascalia descrive il link della facciata: una sola facciata per pagina. */
const DIDASCALIA_ID = "produzione-facciata-didascalia";

/**
 * Il bottone sta sopra il crema dell'illustrazione: è il primario su chiaro, navy pieno col testo
 * chiaro, con l'ombra delle pill che galleggiano sopra un contenuto (`--shadow-floating-pill`,
 * quella della pill dei filtri). L'hover arriva dal link, che è tutta la figura (Marco, 27/10/2026).
 */
const BOTTONE_SUL_CHIARO = "shadow-(--shadow-floating-pill) group-hover:bg-fa-navy-light";

/**
 * ChiusuraSection — la coda della pagina: "Il tempo è un materiale." + testo, e da 1024 px la
 * facciata della tavola dell'officina, che porta a `/officina` (27/10/2026, PR 4 del cantiere,
 * spec `docs/specs/tavola-officina.md`, «La facciata su /produzione»).
 * Stesso fondo `--fa-ink` delle fasi e della ProgettareCta che segue, così
 * fra le tre bande non c'è giunzione visibile.
 *
 * `pt-0 pb-0`: due `.fa-section` consecutive sommano i padding, come annotato
 * in `sezione-testo.tsx` di chi-siamo. Con i 136 propri gli stacchi erano
 * 136 / 272 / 272; azzerandoli la sezione si appoggia a quelli dei vicini
 * (pb delle fasi e pt della ProgettareCta) e i tre intervalli tornano 136,
 * cioè il passo del design system. Nessun valore ad hoc.
 *
 * ⚠️ **La facciata solo da 1024 px** (Marco, 27/10/2026, dopo la prova su iPhone: sul telefono la
 * tavola si vede troppo piccola). Sotto, la chiusura è quella di prima: titolo e paragrafo
 * centrati, nessuna figura, nessun link. Lo decide la larghezza, in CSS: niente rilevamento del
 * dispositivo. L'immagine è pigra e, nascosta, il browser non la scarica (lo prova l'e2e a 390 e
 * 768). `/officina` resta raggiungibile dal telefono con l'indirizzo.
 *
 * Da 1024 px, come il riferimento RiFRA: titolo a sinistra e testo a destra, l'immagine sotto, la
 * didascalia centrata sotto l'immagine. Raggio delle card con la foto, SENZA traccia (Marco, 27/10,
 * scelta A sul confronto annotato). Un solo link per immagine e bottone: l'immagine è muta, il
 * nome del link è il testo del bottone, la freccia è nascosta ai lettori di schermo e la
 * didascalia descrive il link. Immagine pigra: Chrome la scarica quando arriva entro circa
 * 1250 px dalla vista su 4G, 2500 su reti lente; a priorità bassa, LCP e CLS invariati
 * (misurato, causa accettata da Marco il 27/10).
 */
export async function ChiusuraSection({ locale }: ChiusuraSectionProps) {
  const t = await getTranslations({ locale, namespace: "produzione" });

  return (
    <section className="fa-section dark pt-0 pb-0">
      <div className="fa-container">
        <div className="mx-auto max-w-[680px] text-center lg:grid lg:max-w-none lg:grid-cols-2 lg:items-end lg:gap-12 lg:text-left">
          <h2 className="fa-h2 m-0" style={{ color: "var(--fa-text-on-dark)" }}>
            {t("chiusuraH2")}
          </h2>
          <p
            className="fa-body-lg mx-auto mt-heading-intro max-w-[520px] lg:mx-0 lg:mt-0"
            style={{ color: "var(--fa-text-on-dark)" }}
          >
            {t("chiusuraP")}
          </p>
        </div>
        <figure className="m-0 mt-intro-content hidden lg:block">
          <OfficinaLink
            describedBy={DIDASCALIA_ID}
            className="group relative block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--fa-stroke-color)"
          >
            <Image
              src="/officina-tavola/facciata.png"
              alt=""
              width={2560}
              height={1440}
              sizes="(min-width: 1248px) 1200px, calc(100vw - 48px)"
              className="block h-auto w-full rounded-3xl"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span
                className={[
                  buttonClasses({ variant: "primary", size: "l" }),
                  BOTTONE_SUL_CHIARO,
                ].join(" ")}
              >
                {t("chiusuraCta")}
                <span aria-hidden="true">&nbsp;→</span>
              </span>
            </span>
          </OfficinaLink>
          <figcaption
            id={DIDASCALIA_ID}
            className="mt-4 text-center text-body-sm"
            style={{ color: "var(--fa-text-on-dark)" }}
          >
            {t("chiusuraDidascalia")}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
