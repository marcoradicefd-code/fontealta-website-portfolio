"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import type { ElencoPaesi } from "@/lib/paesi";

import { CampoNote, CampoPaese, type CampoProps } from "./campi-paese-note";
import { CAMPI_SCURI_CSS } from "./campi-scuri";
import { ConfermaContatto } from "./conferma-invio";
import { CasellaNewsletter } from "./casella-newsletter";
import { HoneypotFields } from "./honeypot-fields";
import { RigaPrivacy } from "./riga-privacy";
import { RimandoCatalogo } from "./rimando-catalogo";
import { RICHIESTE_NEL_MENU, type ContactFormValues } from "./schema";
import { SubmitButton } from "./submit-button";
import { useContactSubmit, type ModelloDelModulo } from "./use-contact-submit";
import { FormError } from "@/components/ui/form-error";

/**
 * ContactForm — Client Component (spec §7).
 *
 * react-hook-form + Zod 4 resolver. Underline-only inputs su dark.
 * Submit → Server Action submitContact (DRY-RUN gate lato server).
 * Stati: idle / pending (useTransition) / success / error.
 * Errori validazione → `FormError` col rosso su scuro, messaggi i18n.
 */
export function ContactForm({
  paesi,
  modello,
}: {
  paesi: ElencoPaesi;
  /** Solo nelle schede modello: va a Zapier col lead, non si vede nel modulo. */
  modello?: ModelloDelModulo;
}) {
  const t = useTranslations("contatti");

  // Preselezione del menu da `?richiesta=`, validata contro le voci del MENU: dal 19/10/2026
  // `?richiesta=catalogo` non preseleziona più niente: il catalogo ha il suo modulo, e chi arriva
  // da un vecchio link ci finisce per l'effetto di `catalogo-form.tsx`.
  const searchParams = useSearchParams();
  const richiestaParam = searchParams.get("richiesta");
  const initialRichiesta = (RICHIESTE_NEL_MENU as readonly string[]).includes(richiestaParam ?? "")
    ? (richiestaParam as ContactFormValues["richiesta"])
    : undefined;

  const {
    register,
    errors,
    onSubmit,
    submitState,
    stato,
    bloccato,
    inviato,
    nuovaRichiesta,
    regolaNote,
    etichettaNote,
    lunghezzaNote,
  } = useContactSubmit(initialRichiesta, modello);

  const err = (key?: string) => (key ? t(`form.errors.${key}`) : "");

  return (
    // `method="post"` (7/10/2026): con il JS idratato non cambia niente, perché
    // `handleSubmit` chiama `preventDefault`. Senza, un clic su «Invia» prima
    // dell'idratazione faceva un GET nativo con nome ed email nell'URL e nei log.
    <form method="post" onSubmit={onSubmit} noValidate aria-busy={stato === "pending"}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-7 sm:grid-cols-2">
        <Field label={t("form.nome")} error={err(errors.nome?.message)}>
          <input
            type="text"
            autoComplete="given-name"
            className="fa-contact-input"
            aria-invalid={Boolean(errors.nome)}
            {...register("nome")}
            readOnly={bloccato}
          />
        </Field>

        <Field label={t("form.cognome")} error={err(errors.cognome?.message)}>
          <input
            type="text"
            autoComplete="family-name"
            className="fa-contact-input"
            aria-invalid={Boolean(errors.cognome)}
            {...register("cognome")}
            readOnly={bloccato}
          />
        </Field>

        <Field label={t("form.email")} error={err(errors.email?.message)}>
          <input
            type="email"
            autoComplete="email"
            className="fa-contact-input"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
            readOnly={bloccato}
          />
        </Field>

        <Field label={t("form.telefono")} error={err(errors.telefono?.message)}>
          <input
            type="tel"
            autoComplete="tel"
            className="fa-contact-input"
            {...register("telefono")}
            readOnly={bloccato}
          />
        </Field>

        <Field label={t("form.azienda")} error={err(errors.azienda?.message)}>
          <input
            type="text"
            autoComplete="organization"
            className="fa-contact-input"
            {...register("azienda")}
            readOnly={bloccato}
          />
        </Field>

        <CampoPaese
          register={register}
          errors={errors}
          classe="fa-contact-input"
          Campo={Field}
          paesi={paesi}
          bloccato={bloccato}
        />

        <RimandoCatalogo
          className="fa-body-sm sm:col-span-2"
          style={{ color: "var(--fa-text-on-dark)" }}
        />

        <Field
          label={t("form.richiesta")}
          error={err(errors.richiesta?.message)}
          className="block sm:col-span-2"
        >
          <select
            className="fa-contact-input"
            defaultValue={initialRichiesta ?? ""}
            aria-invalid={Boolean(errors.richiesta)}
            {...register("richiesta")}
            disabled={bloccato}
          >
            <option value="" disabled>
              {t("form.richiestaPlaceholder")}
            </option>
            {RICHIESTE_NEL_MENU.map((type) => (
              <option key={type} value={type} className="text-fa-black">
                {t(`form.richiestaOptions.${type}`)}
              </option>
            ))}
          </select>
        </Field>

        <CampoNote
          register={register}
          errors={errors}
          classe="fa-contact-input"
          Campo={Field}
          obbligatorie={regolaNote !== null}
          etichetta={etichettaNote}
          lunghezza={lunghezzaNote}
          bloccato={bloccato}
        />
      </div>

      <HoneypotFields register={register} />

      <div className="mt-7">
        <CasellaNewsletter campo={register("newsletter")} bloccato={bloccato} scuro />
      </div>

      <div className="mt-7 flex flex-col items-center gap-4">
        {/* ContactForm è sempre su sezioni SCURE (contact-section + ProgettareCta):
            submit outlined bianco (Button secondary dark) → "INVIA"/"SEND" maiuscolo,
            hover bg-white/10 (= il secondary di collezioni). Su sfondo chiaro la home
            (FinalCtaForm) usa invece la pill navy piena. Dal 14/10 il bottone stesso
            diventa la conferma (`submit-button.tsx`). */}
        <SubmitButton
          stato={stato}
          variant="secondary"
          dark
          testi={{
            invia: t("form.submit"),
            inviato: t("form.inviato"),
            invioInCorso: t("form.invioInCorso"),
          }}
        />
        {inviato ? (
          <ConfermaContatto
            inviato={inviato}
            coloreRiga="var(--fa-text-on-dark)"
            coloreLink="var(--fa-text-on-dark)"
            onNuova={nuovaRichiesta}
          />
        ) : null}

        <RigaPrivacy
          className="fa-body-sm text-center"
          style={{ color: "var(--fa-text-on-dark-secondary)" }}
          classeLink="underline underline-offset-2 hover:opacity-(--fa-opacity-hover)"
          stileLink={{ color: "var(--fa-text-on-dark)" }}
        />

        {submitState === "error" ? (
          <FormError tone="dark" kind="alert">
            {t("form.errorGeneric")}
          </FormError>
        ) : null}
      </div>

      <style>{`${CAMPI_SCURI_CSS}
        select.fa-contact-input { height: var(--fa-field-h-1); }
        select.fa-contact-input option { color: #1a1a18; }
        textarea.fa-contact-input { resize: vertical; }
        /* Il menu disabled non va in grigio: stesso colore di sempre (anche WebKit, che usa il fill). */
        select.fa-contact-input:disabled {
          cursor: default; opacity: 1; color: var(--fa-text-on-dark); -webkit-text-fill-color: var(--fa-text-on-dark);
        }
      `}</style>
    </form>
  );
}

function Field({ label, error, errorId, className, children }: CampoProps) {
  return (
    <label className={className ?? "block"}>
      <span
        className="block text-micro-1 font-semibold tracking-3 uppercase"
        style={{ color: "var(--fa-text-on-dark)" }}
      >
        {label}
      </span>
      <span className="mt-2 block">{children}</span>
      {error ? (
        <FormError tone="dark" id={errorId}>
          {error}
        </FormError>
      ) : null}
    </label>
  );
}
