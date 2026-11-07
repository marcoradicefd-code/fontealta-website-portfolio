import { ChevronDown } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Fragment, type ReactNode } from "react";

import type { ActiveLocale } from "@/i18n/routing";
import { AZIENDA_DOCUMENTI } from "@/lib/azienda";
import {
  LEGAL_SECTIONS,
  parseLegalInline,
  riempiSegnaposto,
  valoriSocieta,
  type LegalBlock,
  type LegalSectionId,
} from "@/lib/legal-sections";
import { staticRouteMetadata } from "@/lib/route-metadata";

import { LegalDetailsSync } from "./_components/legal-details-sync";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: ActiveLocale }>;
}

interface LegalSectionCopy {
  titolo: string;
  aggiornato: string;
  blocchi: LegalBlock[];
  /** Solo «societa»: le etichette dei due PDF. */
  documenti?: { certificato: string; politica: string };
}

export const generateMetadata = staticRouteMetadata({
  namespace: "legale",
  href: "/menzioni-legali",
});

/**
 * «Menzioni legali»: termini d'uso, privacy, cookie e trasparenza AI in una pagina.
 *
 * ⚠️ **Accordion su `<details>` nativi, con l'H2 dentro il `<summary>`.** L'HTML lo
 * consente (il contenuto di `summary` ammette un elemento di intestazione), e il
 * nativo dà gratis tastiera, stato annunciato e la ricerca nella pagina, che nei
 * browser recenti apre da sola la sezione in cui trova il testo. Senza JavaScript
 * la pagina funziona lo stesso: le sezioni si aprono e si chiudono.
 *
 * La **prima** sezione è aperta di default: dal 26/10/2026 è «Dati societari e
 * certificazioni» (`#societa`), prima era «Termini».
 */
export default async function MenzioniLegaliPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legale" });
  const sezioni = t.raw("sezioni") as Record<LegalSectionId, LegalSectionCopy>;
  const valori = valoriSocieta(locale);
  const documenti = sezioni.societa.documenti;

  return (
    <>
      <section
        className="fa-section light"
        style={{ paddingBottom: "var(--fa-space-legal-bottom)" }}
      >
        <div className="fa-container narrow">
          <span className="fa-eyebrow">{t("eyebrow")}</span>
          <h1 className="fa-h1 mt-eyebrow text-fa-black">{t("title")}</h1>
          <p className="fa-body-lg mt-title-text" style={{ color: "var(--fa-text-secondary)" }}>
            {t("intro")}
          </p>
        </div>
      </section>

      <section className="fa-section light" style={{ paddingTop: 0 }}>
        <div className="fa-container narrow">
          <div style={{ borderBottom: "var(--fa-stroke-hairline) solid var(--fa-border-light)" }}>
            {LEGAL_SECTIONS.map((id, indice) => {
              const sezione = sezioni[id];
              return (
                <details
                  key={id}
                  id={id}
                  data-legal-section=""
                  open={indice === 0}
                  className="group"
                  style={{ borderTop: "var(--fa-stroke-hairline) solid var(--fa-border-light)" }}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                    {/* `fa-h4` come i titoli di sezione dell'articolo del blog, che è l'altra
                        pagina di lettura del sito. Con `fa-h3` (36px) a 390 «Nutzungsbedingungen»
                        era più largo della colonna e spingeva la freccia fuori pagina: misurato,
                        scroll orizzontale in tedesco. `min-w-0` lascia restringere il titolo accanto
                        alla freccia, `hyphens-auto` spezza le parole composte con la lingua di `<html>`. */}
                    <h2 className="fa-h4 min-w-0 hyphens-auto text-fa-black">{sezione.titolo}</h2>
                    <ChevronDown
                      aria-hidden
                      size={22}
                      className="shrink-0 text-fa-black transition-transform duration-(--dur-micro) group-open:rotate-180"
                    />
                  </summary>
                  <div className="pb-10">
                    {/* Secondario e non terziario: `--fa-text-tertiary` sul fondo chiaro misura
                        2,84:1, sotto il 4,5 che serve a un testo di 14px. Le vecchie legali lo
                        usavano, ed era un difetto ereditato, non una scelta. */}
                    <p className="fa-body-sm" style={{ color: "var(--fa-text-secondary)" }}>
                      {sezione.aggiornato}
                    </p>
                    <Blocchi
                      blocchi={sezione.blocchi}
                      rendi={
                        id === "societa" && documenti
                          ? (testo) => (
                              <TestoSocieta
                                testo={testo}
                                valori={valori}
                                documenti={documenti}
                                locale={locale}
                              />
                            )
                          : undefined
                      }
                    />
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <LegalDetailsSync ids={LEGAL_SECTIONS} />
    </>
  );
}

const TESTO = {
  fontSize: "1rem",
  lineHeight: 1.7,
  color: "var(--fa-text-secondary)",
} as const;

/**
 * I blocchi di una sezione. Le voci `li` consecutive diventano una lista sola.
 * `rendi` sostituisce `Inline` per una sezione che ha bisogno di più (oggi «societa»).
 */
function Blocchi({
  blocchi,
  rendi = (testo) => <Inline testo={testo} />,
}: {
  blocchi: LegalBlock[];
  rendi?: (testo: string) => ReactNode;
}) {
  const gruppi: Array<
    { tipo: "h3"; testo: string } | { tipo: "p"; testo: string } | { tipo: "ul"; voci: string[] }
  > = [];
  for (const blocco of blocchi) {
    if ("li" in blocco) {
      const ultimo = gruppi.at(-1);
      if (ultimo?.tipo === "ul") ultimo.voci.push(blocco.li);
      else gruppi.push({ tipo: "ul", voci: [blocco.li] });
    } else if ("h3" in blocco) gruppi.push({ tipo: "h3", testo: blocco.h3 });
    else gruppi.push({ tipo: "p", testo: blocco.p });
  }

  return (
    <div className="mt-6 space-y-4">
      {gruppi.map((g, i) => {
        if (g.tipo === "h3")
          return (
            <h3
              key={i}
              className="pt-4 leading-snug font-semibold text-fa-black"
              style={{ fontSize: "var(--text-body-lg)" }}
            >
              {rendi(g.testo)}
            </h3>
          );
        if (g.tipo === "p")
          return (
            <p key={i} style={TESTO}>
              {rendi(g.testo)}
            </p>
          );
        return (
          <ul key={i} className="space-y-2">
            {g.voci.map((voce, j) => (
              <li key={j} className="relative pl-5" style={TESTO}>
                <span aria-hidden className="absolute left-0">
                  ·
                </span>
                {rendi(voce)}
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

const LINK = "text-fa-black underline underline-offset-2 hover:opacity-(--fa-opacity-hover)";

function Inline({ testo }: { testo: string }): ReactNode {
  return parseLegalInline(testo).map((s, i) => {
    switch (s.kind) {
      case "bold":
        return (
          <strong key={i} className="font-semibold text-fa-black">
            {s.text}
          </strong>
        );
      case "email":
        return (
          <a key={i} href={`mailto:${s.text}`} className={LINK}>
            {s.text}
          </a>
        );
      case "url":
        return (
          <a key={i} href={`https://${s.text}`} className={LINK} rel="noopener noreferrer">
            {s.text}
          </a>
        );
      default:
        return <Fragment key={i}>{s.text}</Fragment>;
    }
  });
}

/**
 * Una riga della sezione «societa»: i segnaposto si riempiono coi valori di
 * `@/lib/azienda`, e `{certificato}` e `{politica}` diventano i link ai due PDF su R2.
 * La politica per la qualità esiste in italiano e in inglese: l'inglese vale per en,
 * de, fr ed es. I PDF si aprono in una scheda nuova, e «(PDF)» sta nel testo del link.
 */
function TestoSocieta({
  testo,
  valori,
  documenti,
  locale,
}: {
  testo: string;
  valori: Record<string, string>;
  documenti: { certificato: string; politica: string };
  locale: ActiveLocale;
}): ReactNode {
  const pdf = {
    "{certificato}": { href: AZIENDA_DOCUMENTI.certificatoIso9001, testo: documenti.certificato },
    "{politica}": {
      href: AZIENDA_DOCUMENTI.politicaQualita[locale === "it" ? "it" : "en"],
      testo: documenti.politica,
    },
  } as const;
  return testo.split(/(\{certificato\}|\{politica\})/).map((parte, i) => {
    if (parte === "{certificato}" || parte === "{politica}") {
      const d = pdf[parte];
      return (
        <a key={i} href={d.href} className={LINK} target="_blank" rel="noopener">
          {d.testo}
        </a>
      );
    }
    return <Inline key={i} testo={riempiSegnaposto(parte, valori)} />;
  });
}
