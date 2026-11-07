import { defineField, defineType } from "sanity";

/**
 * Author — blog post author (FASE 1 blog foundations).
 * `name` is language-agnostic (a person's name); `bio` is field-level localized
 * (IT mandatory, EN best-effort) consistently with the rest of the blog model.
 */
export const author = defineType({
  name: "author",
  title: "Author",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "photo",
      title: "Photo",
      type: "imageWithMeta",
      description: "Headshot shown next to the byline. Optional.",
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "localizedText",
      description: "Short biography. Optional. IT mandatory if filled; EN best-effort.",
    }),
    /**
     * Il ruolo, che finisce in due posti: sotto la firma in pagina e come
     * `jobTitle` della `Person` nel dato strutturato.
     *
     * ⚠️ **Localizzato, perché è una parola e non un nome proprio**: «Titolare»
     * non è «Owner», e un ruolo italiano su una pagina inglese è la stessa
     * svista che questa PR ha curato sul resto del sito.
     */
    defineField({
      name: "role",
      title: "Role",
      type: "localizedString",
      description:
        "Ruolo, es. «Titolare» / «Owner». Compare sotto la firma e come jobTitle nel dato strutturato.",
    }),
    /**
     * ⚠️ **Un solo profilo, e deve essere LinkedIn.** `sameAs` afferma
     * un'identità: qui vale la stessa regola già scritta per l'azienda. La
     * validazione accetta le due forme che LinkedIn usa davvero, `/in/` per una
     * persona e `/company/` per un'organizzazione, e nient'altro: un URL
     * incollato a metà o un profilo di un altro social dichiarerebbe un'identità
     * che non è quella.
     */
    defineField({
      name: "linkedin",
      title: "LinkedIn",
      type: "url",
      description: "Profilo LinkedIn, es. https://www.linkedin.com/in/nome-cognome. Facoltativo.",
      validation: (Rule) =>
        Rule.uri({ scheme: ["https"] }).custom((valore) => {
          if (!valore) return true;
          return /^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[^/\s]+\/?$/.test(String(valore))
            ? true
            : "Deve essere un profilo LinkedIn: /in/… per una persona, /company/… per un'azienda.";
        }),
    }),
    /**
     * ⚠️ **Lo slug c'è ma la pagina no, ed è deliberato.** `/autori/[slug]` non
     * si costruisce ora: il campo esiste perché il giorno che si farà, gli autori
     * hanno già il loro indirizzo e non bisogna inventarlo a posteriori su
     * documenti già pubblicati. Finché quella rotta non esiste, nessuno lo legge.
     */
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      description: "Per una futura pagina autore. Non usato dal sito oggi.",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "role.it", media: "photo" },
    prepare: ({ title, subtitle, media }) => ({
      title: title || "(unnamed author)",
      subtitle,
      media,
    }),
  },
});
