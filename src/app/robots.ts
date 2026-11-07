import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";

/**
 * robots.txt — aperto SOLO sul deploy di produzione, chiuso su tutti gli altri.
 *
 * ⚠️ **Il cancello è `VERCEL_ENV === "production"`, non `NEXT_PUBLIC_SITE_URL`**
 * (17/09/2026, al cutover). Fino a qui decideva la variabile: indicizzabile se
 * l'host era `fontealta.it`. Ma su Vercel la variabile è UNA, impostata per
 * Production **e** per Preview, e dal giorno in cui vale `https://fontealta.it`
 * anche ogni anteprima avrebbe servito `Allow: /`. La variabile dice dove sta il
 * sito; se un deploy è quello pubblico lo dice solo l'ambiente. In locale
 * `VERCEL_ENV` non esiste, quindi il file è chiuso anche con `pnpm start`.
 *
 * ⚠️ **La riga `Sitemap:` compare SOLO quando il sito è indicizzabile**, e non
 * per simmetria estetica con `allow`. Dichiarare una sitemap dentro un
 * `Disallow: /` è una contraddizione che i motori risolvono come vogliono: la
 * sitemap è un invito a visitare, il disallow è il divieto di farlo. In
 * anteprima il file resta quindi il solo disallow, mentre `/sitemap.xml`
 * continua a esistere e a rispondere.
 *
 * ⚠️ **Niente riga `Host:`.** È una direttiva non standard, che Google ignora e
 * che l'unico motore che la leggeva ha dismesso; il dominio canonico lo dicono già
 * i `canonical` delle pagine e il 308 da `www.fontealta.it` verso il dominio nudo.
 * La riga c'era e valeva `https://fontealta.it`: toglierla non cambia l'host
 * canonico, toglie una dichiarazione che nessuno legge.
 */
/**
 * I crawler dei motori e degli assistenti AI, nominati uno per uno.
 *
 * ⚠️ **Nominarli serve anche quando la risposta è «sì».** `User-Agent: *` li
 * copre già tutti: una riga esplicita non cambia il permesso, cambia il fatto che
 * la scelta sia **dichiarata**. Il giorno che si vuole spegnerne uno, la riga
 * c'è già e si gira una parola; senza, bisogna prima decidere come si scrive.
 *
 * ⚠️ **Sono due mestieri diversi, e la distinzione è tutta la variante B.**
 * `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot` e `ClaudeBot` leggono per
 * **rispondere a una domanda ora**, e citano la fonte: sono il modo in cui un
 * sito compare in una risposta. `GPTBot`, `Google-Extended`, `CCBot`,
 * `Applebot-Extended` e `anthropic-ai` raccolgono per **addestrare**, e non
 * portano nessun visitatore. Chi vuole essere citato ma non usato come materiale
 * apre i primi e chiude i secondi.
 */
const CRAWLER_CITAZIONE = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot"] as const;
const CRAWLER_ADDESTRAMENTO = [
  "GPTBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
  "anthropic-ai",
] as const;

/**
 * ⚠️ **La leva sta qui, ed è una parola sola.** `"citazione"` apre i crawler che
 * citano e chiude quelli che addestrano; `"tutti"` apre tutto. Al 10/09/2026 la
 * scelta è `"tutti"`, decisa da Marco: il sito non è ancora indicizzato e il
 * primo obiettivo è comparire.
 *
 * ⚠️ **Nessuna delle due varianti tocca l'anteprima**: lì vale `Disallow: /` per
 * tutti, perché il cancello M20 viene prima di qualunque politica sui crawler.
 * Una regola `allow` su un sito che non deve essere letto sarebbe una
 * contraddizione dichiarata, come la riga `Sitemap:` dentro un disallow.
 */
const POLITICA_AI: "tutti" | "citazione" = "tutti";

function regoleAi(): Array<{ userAgent: string; allow?: string; disallow?: string }> {
  return [
    ...CRAWLER_CITAZIONE.map((userAgent) => ({ userAgent, allow: "/" })),
    ...CRAWLER_ADDESTRAMENTO.map((userAgent) =>
      POLITICA_AI === "tutti" ? { userAgent, allow: "/" } : { userAgent, disallow: "/" },
    ),
  ];
}

export default function robots(): MetadataRoute.Robots {
  const indexable = process.env.VERCEL_ENV === "production";
  return {
    rules: [
      {
        userAgent: "*",
        ...(indexable ? { allow: "/" } : { disallow: "/" }),
      },
      // In anteprima nessuna regola per nome: il `Disallow: /` di `*` vale per
      // tutti, e aggiungere righe che dicono «sì» sotto un divieto generale è il
      // tipo di contraddizione che i motori risolvono come vogliono.
      ...(indexable ? regoleAi() : []),
    ],
    ...(indexable ? { sitemap: `${siteUrl()}/sitemap.xml` } : {}),
  };
}
