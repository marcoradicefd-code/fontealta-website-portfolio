import { getRequestConfig } from "next-intl/server";

import { ACTIVE_LOCALES, routing, type ActiveLocale } from "./routing";

/**
 * next-intl 4.x in Next.js 16 requires the `locale` field to be RETURNED
 * EXPLICITLY from getRequestConfig — it is no longer inferred from
 * `requestLocale`. Missing this returns "Could not resolve locale" warnings
 * and falls back to the default at every request.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) ?? routing.defaultLocale;

  if (!ACTIVE_LOCALES.includes(locale as ActiveLocale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
