import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import type { ActiveLocale } from "@/i18n/routing";

/**
 * Catch-all: instrada OGNI path locale sconosciuto (`/it/xyz`, `/en/foo`, e — con
 * `localePrefix: as-needed` — anche `/xyz` senza prefisso → IT) verso il 404
 * brandizzato `[locale]/not-found.tsx`. Senza questo, Next renderebbe il not-found
 * ROOT (non localizzato) per le route sconosciute. `setRequestLocale` prima di
 * `notFound()` così il not-found risolve il locale corretto.
 */
export default async function CatchAllNotFound({
  params,
}: {
  params: Promise<{ locale: ActiveLocale; rest: string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}
