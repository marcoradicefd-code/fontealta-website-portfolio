import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";

type WebhookBody = {
  _type: string;
  slug?: { current: string };
};

/**
 * Sanity → Next.js webhook for ISR on-demand revalidation.
 *
 * LIVE config (sanity.io/manage → project → API → Webhooks), verified in prod:
 *   URL:        https://fontealta-website-sigma.vercel.app/api/revalidate
 *               (→ https://fontealta.it/api/revalidate at domain go-live)
 *   Dataset:    production
 *   Trigger:    Create / Update / Delete
 *   Filter:     NONE — fires on every document type (so post/author/category
 *               also trigger, not just the catalog types)
 *   Projection: { _type, slug }  (slug projected as the object → body.slug.current;
 *               this is what the granular `${_type}:${slug}` tags match)
 *   Secret:     same value as SANITY_REVALIDATE_SECRET in .env.local
 *   Drafts:     excluded (published perspective only)
 *
 * parseBody's 3rd arg (waitForContentLakeEventualConsistency) defaults to true
 * → a 3s wait for CDN consistency before we revalidate.
 * Next.js 16 note: revalidateTag requires a cacheLife profile as the second
 * argument. We use "default" (matches the default ISR window).
 */
export async function POST(req: NextRequest) {
  const { isValidSignature, body } = await parseBody<WebhookBody>(
    req,
    process.env.SANITY_REVALIDATE_SECRET,
  );

  if (!isValidSignature) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (!body?._type) {
    return Response.json({ error: "Missing _type" }, { status: 400 });
  }

  revalidateTag(body._type, "default");
  if (body.slug?.current) {
    revalidateTag(`${body._type}:${body.slug.current}`, "default");
  }

  /**
   * ⚠️ **Qui NON va un `revalidatePath("/sitemap.xml")`. C'è stato, in #164, ed
   * è stato tolto in #165 dopo averlo misurato.**
   *
   * Faceva quello che dice: la rotta si ricostruiva davvero (lettura alle
   * 12:02:36Z, `MISS` con `age 0`). Ma serviva comunque un `lastmod` vecchio di
   * un publish, perché il dato veniva dalla cache dati di Next, non dalla
   * rotta. Da #165 `/sitemap.xml` è `force-dynamic` e la sua query gira con
   * `cache: "no-store"`: non esiste più niente da invalidare, e marcare un
   * percorso che non ha cache è una promessa vuota — peggio di nessuna
   * promessa, perché il prossimo che legge questo file crede che il rinfresco
   * sia coperto da qui.
   *
   * I `revalidateTag` qui sopra restano, e non sono la stessa cosa: servono
   * alle PAGINE, che sono cacheate e taggate. È solo la sitemap a non avere
   * più bisogno di essere invalidata.
   */
  return Response.json({ revalidated: true, body });
}
