import {
  defineArrayMember,
  defineField,
  defineType,
  type CustomValidatorResult,
  type ValidationContext,
} from "sanity";

import {
  checkAnswer,
  duplicateIndexes,
  duplicateKey,
  FAQ_LANGUAGES,
  FAQ_MAX_ITEMS,
  type FaqBlock,
  type FaqLanguage,
  type FaqProblemLevel,
} from "../../lib/faq-rules";

interface Item {
  _key: string;
  question?: string;
  keyword?: string;
  answer?: FaqBlock[];
}

const TITLES: Record<FaqLanguage, string> = {
  it: "Italiano",
  en: "English (US)",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

/** Il titolo della collezione; le pagine di contenuto non ne hanno. */
function ownTitle(context: ValidationContext): string | undefined {
  const title = (context.document as { title?: unknown } | undefined)?.title;
  return typeof title === "string" && title ? title : undefined;
}

/** I nomi che valgono come «nome» nelle prime 50 parole: Fontealta e il titolo della collezione. */
function namesFor(context: ValidationContext): string[] {
  const title = ownTitle(context);
  return title ? ["Fontealta", title] : ["Fontealta"];
}

/** I controlli della risposta di § 2.2, del livello chiesto, con il percorso dell'elemento. */
function answerProblems(
  items: Item[] | undefined,
  context: ValidationContext,
  level: FaqProblemLevel,
) {
  const out = (items ?? []).flatMap((item) =>
    checkAnswer(
      { question: item.question ?? "", keyword: item.keyword, answer: item.answer },
      namesFor(context),
    )
      .filter((p) => p.level === level)
      .map((p) => ({ message: p.message, path: [{ _key: item._key }] })),
  );
  return out.length ? out : true;
}

/**
 * Nessuna domanda generica in due pagine (spec § 1.3): la domanda normalizzata contro le FAQ della
 * stessa lingua di tutte le collezioni e le pagine di contenuto, pubblicate e bozze, tranne questa.
 * Le domande che nominano la propria collezione si confrontano solo sulla pagina (`duplicateKey`).
 */
async function duplicates(
  items: Item[] | undefined,
  context: ValidationContext,
  language: FaqLanguage,
): Promise<CustomValidatorResult> {
  const list = items ?? [];
  if (list.length === 0) return true;
  const id = String(context.document?._id ?? "").replace(/^(drafts|versions\.[^.]+)\./, "");
  const data = await context.getClient({ apiVersion: "2024-10-01" }).fetch<{
    names: string[];
    others: Array<{ label: string; own: string | null; questions: string[] | null }>;
  }>(
    `{
        "names": *[_type == "collection"].title,
        "others": *[_type in ["collection", "contentPage"] && !(_id in [$id, $draft])]{
          "label": coalesce(title, code),
          "own": select(_type == "collection" => title),
          "questions": faq[$language][].question
        }
      }`,
    { id, draft: `drafts.${id}`, language },
  );
  const names = data.names.filter(Boolean);
  const elsewhere = new Map<string, string>();
  for (const other of data.others) {
    for (const q of other.questions ?? []) {
      const { scope, key } = duplicateKey(q, other.own ?? undefined, names);
      if (scope === "site") elsewhere.set(key, other.label);
    }
  }
  const own = ownTitle(context);
  const questions = list.map((i) => i.question ?? "");
  const problems = [
    ...duplicateIndexes(questions, own, names).map((i) => ({
      message: "Domanda già presente in questa lingua, su questa pagina",
      path: [{ _key: list[i]._key }],
    })),
    ...list.flatMap((item) => {
      const { scope, key } = duplicateKey(item.question ?? "", own, names);
      const where = scope === "site" ? elsewhere.get(key) : undefined;
      return where
        ? [{ message: `Domanda già presente su «${where}»`, path: [{ _key: item._key }] }]
        : [];
    }),
  ];
  return problems.length ? problems : true;
}

/**
 * Le FAQ di una pagina, un elenco per lingua (spec § 1.2: campi per lingua, come `tagline`). Le
 * domande di una lingua non sono la traduzione di quelle di un'altra (§ 2.1).
 */
export const localizedFaq = defineType({
  name: "localizedFaq",
  title: "Domande frequenti",
  type: "object",
  fields: FAQ_LANGUAGES.map((language) =>
    defineField({
      name: language,
      title: TITLES[language],
      type: "array",
      of: [defineArrayMember({ type: "faqItem" })],
      validation: (Rule) => [
        Rule.max(FAQ_MAX_ITEMS),
        Rule.custom((items: Item[] | undefined, context) =>
          answerProblems(items, context, "error"),
        ),
        Rule.custom((items: Item[] | undefined, context) => duplicates(items, context, language)),
        Rule.custom((items: Item[] | undefined, context) =>
          answerProblems(items, context, "warning"),
        ).warning(),
      ],
    }),
  ),
});
