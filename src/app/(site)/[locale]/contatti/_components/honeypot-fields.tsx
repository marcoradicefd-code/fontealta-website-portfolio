"use client";

import { useTranslations } from "next-intl";
import type { UseFormRegister } from "react-hook-form";

import type { ContactFormValues } from "./schema";

/**
 * HoneypotFields — campo esca `_gotcha` condiviso dai due form.
 *
 * Reso OFF-SCREEN (position absolute + left:-9999px) e NON `display:none`: i bot
 * che ignorano gli hidden lo compilano comunque, mentre resta invisibile agli
 * utenti. Escluso da screen reader (`aria-hidden`), da tastiera (`tabindex -1`) e
 * da autofill (`autocomplete off`). Assoluto → fuori dal flow → zero impatto sul
 * layout dei form. Se valorizzato al submit, il server ritorna fake-success senza
 * inoltrare a Zapier (vedi submitContact).
 *
 * L'etichetta è nella lingua della pagina (`contatti.form.esca`, 4/11/2026): fino ad allora era
 * italiana in tutte le lingue. Il campo resta nascosto a tutti, come prima.
 */
export function HoneypotFields({ register }: { register: UseFormRegister<ContactFormValues> }) {
  const t = useTranslations("contatti.form");
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        top: "auto",
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <label>
        {t("esca")}
        <input type="text" tabIndex={-1} autoComplete="off" {...register("_gotcha")} />
      </label>
    </div>
  );
}
