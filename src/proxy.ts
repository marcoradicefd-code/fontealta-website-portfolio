import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * Next.js 16 routing layer.
 *
 * NB: Next 16 renamed `middleware.ts` → `proxy.ts`. The export name remains
 * `default` (not `proxy`), and the function signature is unchanged.
 * Reference: https://nextjs.org/docs/messages/middleware-to-proxy
 *
 * ARCHITECTURE.md §21.1 FASE 10 mentions `middleware.ts` — that doc will be
 * updated to v2.1 to match this Next 16 convention. See TODO.md.
 */
export default createMiddleware(routing);

export const config = {
  // Skip /api, /_next, /_vercel, the Sanity Studio, and any file with an extension.
  matcher: ["/((?!api|_next|_vercel|studio|.*\\..*).*)"],
};
