import { defineField, defineType } from "sanity";

/**
 * Avvisi di lunghezza, una lingua alla volta.
 *
 * ⚠️ **Avviso e non errore, deciso il 9/09/2026.** Le due regole precedenti erano
 * `Rule.max(70)` e `Rule.max(170)` **senza** `.warning()`, cioè errori che
 * bloccano il publish. Su Sanity una description è già a 173 caratteri
 * (`post-i-verniciatori-del-carnevale`): quel documento non era ripubblicabile
 * senza tagliarlo. Un limite SEO è un consiglio di Google, non una regola del
 * dominio, e non deve impedire a Marco di pubblicare.
 *
 * ⚠️ **La validazione sta sul campo e non dentro i tipi localizzati**, perché i
 * limiti sono diversi fra titolo e description mentre i tipi sono generici. E
 * itera sulle chiavi dell'oggetto invece di elencare le lingue: il giorno che la
 * PR i18n accende `de/fr/es`, questa funzione le copre senza modifiche.
 *
 * Le chiavi che iniziano per `_` si saltano: Sanity aggiunge `_type` agli
 * oggetti, e non è una lingua.
 */
function avvisiLunghezza(max: number, min = 20) {
  return (valore: unknown): true | string => {
    if (valore === null || typeof valore !== "object") return true;
    const problemi: string[] = [];
    for (const [lingua, testo] of Object.entries(valore as Record<string, unknown>)) {
      if (lingua.startsWith("_") || typeof testo !== "string") continue;
      const n = testo.trim().length;
      if (n === 0) continue;
      if (n > max) problemi.push(`${lingua.toUpperCase()} ${n} su ${max}, troppo lungo`);
      else if (n < min) problemi.push(`${lingua.toUpperCase()} ${n}, troppo corto`);
    }
    return problemi.length === 0 ? true : problemi.join(" · ");
  };
}

/**
 * I campi SEO che l'autore può compilare in Studio, **per lingua**.
 *
 * La regola del blocco, in una riga: **vuoto = template automatico, compilato =
 * questo testo, in questa lingua**. Non c'è ripiego fra lingue dentro `seo`: un
 * titolo scritto solo in italiano vale per l'italiano, e l'inglese va a template.
 * È la stessa regola del resto del sito, «una lingua è intera o è spenta»: un
 * titolo italiano su una pagina inglese è il difetto che questa PR cura, non un
 * comportamento da conservare.
 *
 * ⚠️ **`ogImage` NON è per lingua**, ed è deliberato: è una fotografia, non un
 * testo. Una per documento, buona per tutte le lingue.
 *
 * ⚠️ **`metaTitle` non porta il suffisso « | Fontealta»**: lo aggiunge
 * `title.template` del layout radice, come su ogni altra pagina del sito. I dodici
 * post che oggi ce l'hanno dentro al valore vengono ripuliti dalla migrazione
 * (C4.0), e il titolo servito resta identico al byte.
 */
export const seoFields = defineType({
  name: "seoFields",
  title: "SEO",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: "metaTitle",
      title: "Meta title",
      type: "localizedStringOptional",
      description:
        "Vuoto = titolo automatico. Compilato = questo testo, in questa lingua. Consigliati 50-60 caratteri, senza « | Fontealta»: lo aggiunge il sito.",
      validation: (Rule) => Rule.custom(avvisiLunghezza(70)).warning(),
    }),
    defineField({
      name: "metaDescription",
      title: "Meta description",
      type: "localizedTextOptional",
      description:
        "Vuoto = descrizione automatica. Compilato = questo testo, in questa lingua. Consigliati 140-155 caratteri.",
      validation: (Rule) => Rule.custom(avvisiLunghezza(170)).warning(),
    }),
    defineField({
      name: "ogImage",
      title: "Open Graph image",
      type: "imageWithMeta",
      description:
        "Immagine dell'anteprima quando la pagina viene condivisa, 1200×630. Vale per tutte le lingue. Vuoto = immagine della pagina, poi quella del sito.",
    }),
    defineField({
      name: "noIndex",
      title: "No index",
      type: "boolean",
      initialValue: false,
      description:
        "Acceso = la pagina esce dalla sitemap, dice ai motori di non indicizzarla e perde canonical e hreflang. Resta raggiungibile da chi ha il link.",
    }),
  ],
});
