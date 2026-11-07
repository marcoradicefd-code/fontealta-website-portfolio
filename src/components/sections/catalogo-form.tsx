"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { CAMPI_CHIARI_CSS, Field } from "@/app/(site)/[locale]/_components/home/final-cta-form";
import { FormError } from "@/components/ui/form-error";
import { CampoNote, CampoPaese } from "@/app/(site)/[locale]/contatti/_components/campi-paese-note";
import { ConfermaContatto } from "@/app/(site)/[locale]/contatti/_components/conferma-invio";
import { CasellaNewsletter } from "@/app/(site)/[locale]/contatti/_components/casella-newsletter";
import { HoneypotFields } from "@/app/(site)/[locale]/contatti/_components/honeypot-fields";
import { RigaPrivacy } from "@/app/(site)/[locale]/contatti/_components/riga-privacy";
import { SubmitButton } from "@/app/(site)/[locale]/contatti/_components/submit-button";
import { useContactSubmit } from "@/app/(site)/[locale]/contatti/_components/use-contact-submit";
import type { ElencoPaesi } from "@/lib/paesi";

/**
 * Il modulo del catalogo (19/10/2026, decisioni di Marco): nome, cognome (dal 20/10/2026, Marco),
 * email e Paese, e le note solo con «Altro Paese», dove servono a scrivere il Paese (`regolaNote`).
 * Niente menu della richiesta: la richiesta è fissa a `catalogo`, nei `defaultValues` del hook.
 *
 * Stessa Server Action e stesse difese dei moduli generali (`submitContact`, honeypot, `_ts`,
 * regola WAF). La `source` è quella della rotta, come per ogni modulo: il lead del catalogo si
 * riconosce da `richiesta: "catalogo"` (D1 del 19/10). La casella della newsletter è anche qui,
 * come in tutti i moduli (Marco, 19/10: D4 revocata).
 *
 * Senza `useSearchParams`: il modulo è nell'HTML servito, non dietro un `<Suspense>`. Dopo l'invio
 * restano la conferma e «Scarica subito il PDF», senza «Invia un’altra richiesta» (Marco, 19/10).
 */
export function CatalogoForm({ paesi }: { paesi: ElencoPaesi }) {
  const tForm = useTranslations("contatti.form");
  const {
    register,
    errors,
    onSubmit,
    submitState,
    stato,
    bloccato,
    inviato,
    regolaNote,
    etichettaNote,
    lunghezzaNote,
  } = useContactSubmit("catalogo");

  /**
   * I vecchi link `?richiesta=catalogo#progettare` (il bottone «Scarica il PDF» fino al 19/10)
   * portano qui e perdono la query (D5). Un redirect in `next.config.ts` non poteva farlo: lì la
   * query passa alla destinazione, e il redirect ricadrebbe su sé stesso. Prezzo accettato: chi
   * arriva da un vecchio link vede il salto a `#progettare` e poi quello a `#catalogo`.
   */
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("richiesta") !== "catalogo") return;
    query.delete("richiesta");
    const resto = query.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${resto ? `?${resto}` : ""}#catalogo`,
    );
    document.getElementById("catalogo")?.scrollIntoView();
  }, []);

  const err = (key?: string) => (key ? tForm(`errors.${key}`) : "");

  return (
    // `method="post"`: niente dati nell'URL se si invia prima dell'idratazione (`contact-form.tsx`).
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      aria-busy={stato === "pending"}
      className="mt-intro-content"
    >
      <div className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <Field label={tForm("nome")} error={err(errors.nome?.message)}>
          <input
            type="text"
            autoComplete="given-name"
            className="fa-home-input"
            aria-invalid={Boolean(errors.nome)}
            {...register("nome")}
            readOnly={bloccato}
          />
        </Field>
        <Field label={tForm("cognome")} error={err(errors.cognome?.message)}>
          <input
            type="text"
            autoComplete="family-name"
            className="fa-home-input"
            aria-invalid={Boolean(errors.cognome)}
            {...register("cognome")}
            readOnly={bloccato}
          />
        </Field>
        <Field label={tForm("email")} error={err(errors.email?.message)}>
          <input
            type="email"
            autoComplete="email"
            className="fa-home-input"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
            readOnly={bloccato}
          />
        </Field>
        <div>
          <CampoPaese
            register={register}
            errors={errors}
            classe="fa-home-input"
            Campo={Field}
            paesi={paesi}
            bloccato={bloccato}
          />
        </div>
        {regolaNote ? (
          <CampoNote
            register={register}
            errors={errors}
            classe="fa-home-input"
            Campo={Field}
            obbligatorie
            etichetta={etichettaNote}
            lunghezza={lunghezzaNote}
            bloccato={bloccato}
          />
        ) : null}
      </div>

      <HoneypotFields register={register} />

      <div className="mt-8">
        <CasellaNewsletter campo={register("newsletter")} bloccato={bloccato} scuro={false} />
      </div>

      {/* Centrato sotto `sm`, come il bottone; da `sm` allineato alla colonna del testo. */}
      <div className="mt-8 flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
        <SubmitButton
          stato={stato}
          variant="primary"
          testi={{
            invia: tForm("catalogoRicevi"),
            inviato: tForm("inviato"),
            invioInCorso: tForm("invioInCorso"),
          }}
        />
        {inviato ? (
          <ConfermaContatto
            inviato={inviato}
            coloreRiga="var(--fa-text-secondary)"
            coloreLink="var(--fa-text-primary)"
            allineamento="items-center text-center sm:items-start sm:text-left"
          />
        ) : null}
        <RigaPrivacy
          className="fa-body-sm"
          style={{ color: "var(--fa-text-secondary)" }}
          classeLink="text-fa-black underline underline-offset-2 hover:opacity-(--fa-opacity-hover)"
        />
        {submitState === "error" && (
          <FormError tone="light" kind="alert">
            {tForm("errorGeneric")}
          </FormError>
        )}
      </div>

      <style>{CAMPI_CHIARI_CSS}</style>
    </form>
  );
}
