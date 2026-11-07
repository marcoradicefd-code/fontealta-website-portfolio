import { getTranslations } from "next-intl/server";

import { CollectionCard } from "@/components/cards/collection-card";
import type { ActiveLocale } from "@/i18n/routing";
import type { MODEL_DETAIL_QUERY_RESULT } from "@/sanity/types.gen";

type ModelData = NonNullable<MODEL_DETAIL_QUERY_RESULT>;
type Affinity = NonNullable<NonNullable<ModelData["collectionAffinities"]>[number]>;

/**
 * CollectionAffinities — «Collezioni affini» sulla pagina modello (PHASE 3).
 *
 * Sostituisce il rendering di «Modelli correlati»: mostra le collezioni che il
 * brand indica come affini alla collezione PRIMARIA del modello
 * (`model.collectionAffinities`, da `collections[0].relatedCollections`).
 *
 * Editoriale e UNIDIREZIONALE, NESSUN fallback: se la collezione primaria non ha
 * affinità (array vuoto/assente) la sezione NON viene renderizzata — la pagina
 * termina senza suggerimenti (intento editoriale del cliente).
 *
 * Riusa `CollectionCard` con `variant="featured"` → banda stile HOME
 * (eyebrow «N articoli» + titolo grande sentence-case, niente label categoria).
 */
export async function CollectionAffinities({
  model,
  locale,
}: {
  model: ModelData;
  locale: ActiveLocale;
}) {
  const affinities = (model.collectionAffinities ?? []).filter((c): c is Affinity => Boolean(c));

  if (affinities.length === 0) return null;

  const t = await getTranslations({ locale, namespace: "modello" });

  return (
    <section className="fa-section light" style={{ paddingTop: 0 }}>
      <div className="fa-container">
        <h2 className="fa-h3 mb-8">{t("collectionAffinitiesTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {affinities.map((collection) => (
            <CollectionCard
              key={collection._id}
              collection={collection}
              locale={locale}
              variant="featured"
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
