"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Error boundary 500 brandizzato (Client obbligatorio). Reso dentro il layout
 * `[locale]` → dentro `NextIntlClientProvider` → `useTranslations` client OK.
 * `reset()` ritenta il render del segmento; `console.error(error)` per il logging.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPages.error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="fa-section dark flex min-h-[max(520px,70vh)] items-center">
      <div className="fa-container narrow text-center">
        <h1 className="fa-h2" style={{ color: "var(--fa-text-on-dark)" }}>
          {t("title")}
        </h1>
        <p
          className="fa-body-lg mx-auto mt-title-text max-w-[54ch]"
          style={{ color: "var(--fa-text-on-dark)" }}
        >
          {t.rich("body", {
            mail: (chunks) => (
              <a
                href="mailto:info@fontealta.it"
                className="underline underline-offset-4"
                style={{ color: "var(--fa-text-on-dark)" }}
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        <div className="mt-text-action-feature flex flex-col items-center gap-5">
          <Button variant="secondary" dark size="l" onClick={() => reset()}>
            {t("ctaRetry")}
          </Button>
          <Link
            href="/collezioni"
            className="text-caption-1 font-medium tracking-link uppercase underline-offset-4 hover:underline"
            style={{ color: "var(--fa-text-on-dark)" }}
          >
            {t("ctaSecondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
