import { getTranslations } from "next-intl/server";

import { CARD_PRIORITARIE, ModelCard } from "@/components/cards/model-card";
import type { ActiveLocale } from "@/i18n/routing";
import { conAltComposto, messaggiAlt } from "@/lib/messaggi-alt";
import type { CONCEALED_BODY_BY_SLUG_QUERY_RESULT } from "@/sanity/types.gen";

type Body = NonNullable<CONCEALED_BODY_BY_SLUG_QUERY_RESULT>;

/**
 * «Usato da» — gli articoli che richiedono questo corpo, venduto a parte. È il cuore
 * della scheda: il corpo esiste in funzione loro.
 *
 * I dati arrivano da un lookup INVERSO (`references(^._id)`) con `order(code asc)`
 * ESPLICITO nella query: il reverse lookup non preserva ordine di suo, e senza
 * l'ordine la lista cambierebbe disposizione a ogni rebuild.
 *
 * ⚠️ SEZIONE NASCOSTA, NON VUOTA, quando non c'è nessun articolo: CW.1 e CW.2 hanno
 * zero reference oggi (verificato sul dato vivo), e un titolo «Usato da» sopra il
 * nulla si legge come un errore di caricamento invece che come un fatto.
 *
 * La projection dei modelli è identica a quella di COLLECTION_DETAIL_QUERY.models,
 * quindi `ModelCard` li rende sul suo ramo modello senza guardie aggiuntive.
 */
export async function UsedBy({ body, locale }: { body: Body; locale: ActiveLocale }) {
  if ((body.usedBy ?? []).length === 0) return null;
  // L'alt delle card composto sul server, con la collezione di ogni articolo (spec
  // contenuti-per-lingua § A).
  const models = conAltComposto(
    body.usedBy ?? [],
    (m) => m.collectionTitle,
    locale,
    await messaggiAlt(locale),
  );

  const t = await getTranslations({ locale, namespace: "corpiIncasso" });

  return (
    <section className="fa-section light" style={{ paddingTop: 0 }}>
      <div className="fa-container">
        <h2 className="fa-h3 mb-8">{t("usedByTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {models.map((m, i) => (
            <ModelCard key={m._id} model={m} locale={locale} priority={i < CARD_PRIORITARIE} />
          ))}
        </div>
      </div>
    </section>
  );
}
