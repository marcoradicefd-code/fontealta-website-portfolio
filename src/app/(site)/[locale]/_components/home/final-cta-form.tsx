"use client";

import { useTranslations } from "next-intl";

// Riuso dell'infra contatti condivisa (hook wiring + honeypot + server action Zapier).
// Cross-route import consapevole: evita di duplicare il wiring del form (cfr. M16).
import {
  CampoNote,
  CampoPaese,
  type CampoProps,
} from "@/app/(site)/[locale]/contatti/_components/campi-paese-note";
import { ConfermaContatto } from "@/app/(site)/[locale]/contatti/_components/conferma-invio";
import { CasellaNewsletter } from "@/app/(site)/[locale]/contatti/_components/casella-newsletter";
import { HoneypotFields } from "@/app/(site)/[locale]/contatti/_components/honeypot-fields";
import { RigaPrivacy } from "@/app/(site)/[locale]/contatti/_components/riga-privacy";
import { RimandoCatalogo } from "@/app/(site)/[locale]/contatti/_components/rimando-catalogo";
import { RICHIESTE_NEL_MENU } from "@/app/(site)/[locale]/contatti/_components/schema";
import { SubmitButton } from "@/app/(site)/[locale]/contatti/_components/submit-button";
import { useContactSubmit } from "@/app/(site)/[locale]/contatti/_components/use-contact-submit";
import { FormError } from "@/components/ui/form-error";
import type { ElencoPaesi } from "@/lib/paesi";

export function FinalCtaForm({ paesi }: { paesi: ElencoPaesi }) {
  const tForm = useTranslations("contatti.form");
  const tHome = useTranslations("home");

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
  } = useContactSubmit();

  const err = (key?: string) => (key ? tForm(`errors.${key}`) : "");

  return (
    // `method="post"`: niente dati nell'URL se si invia prima dell'idratazione
    // (vedi `contact-form.tsx`).
    <form
      method="post"
      onSubmit={onSubmit}
      noValidate
      aria-busy={stato === "pending"}
      className="mx-auto mt-12 max-w-[860px]"
    >
      {/* Dati personali (Nome / Cognome, placeholder-only) */}
      <span className="fa-home-flabel">{tHome("formPersonal")}</span>
      <div className="mt-3 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <div>
          <input
            type="text"
            placeholder={tForm("nome")}
            aria-label={tForm("nome")}
            autoComplete="given-name"
            className="fa-home-input"
            aria-invalid={Boolean(errors.nome)}
            {...register("nome")}
            readOnly={bloccato}
          />
          {errors.nome && <FormError tone="light">{err(errors.nome.message)}</FormError>}
        </div>
        <div>
          <input
            type="text"
            placeholder={tForm("cognome")}
            aria-label={tForm("cognome")}
            autoComplete="family-name"
            className="fa-home-input"
            aria-invalid={Boolean(errors.cognome)}
            {...register("cognome")}
            readOnly={bloccato}
          />
          {errors.cognome && <FormError tone="light">{err(errors.cognome.message)}</FormError>}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <Field label={tForm("email")} error={err(errors.email?.message)}>
          <input
            type="email"
            placeholder="mario@mail.com"
            autoComplete="email"
            className="fa-home-input"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
            readOnly={bloccato}
          />
        </Field>
        <Field label={tForm("telefono")} error={err(errors.telefono?.message)}>
          <input
            type="tel"
            placeholder="+39 333 3333333"
            autoComplete="tel"
            className="fa-home-input"
            {...register("telefono")}
            readOnly={bloccato}
          />
        </Field>
        <Field label={tForm("azienda")} error={err(errors.azienda?.message)}>
          <input
            type="text"
            placeholder="ABC s.r.l."
            autoComplete="organization"
            className="fa-home-input"
            {...register("azienda")}
            readOnly={bloccato}
          />
        </Field>
        <CampoPaese
          register={register}
          errors={errors}
          classe="fa-home-input"
          Campo={Field}
          paesi={paesi}
          bloccato={bloccato}
        />
        <RimandoCatalogo
          className="fa-body-sm sm:col-span-2"
          style={{ color: "var(--fa-text-primary)" }}
        />
        <Field
          label={tHome("formNeed")}
          error={err(errors.richiesta?.message)}
          className="block sm:col-span-2"
        >
          <select
            className="fa-home-input"
            defaultValue=""
            aria-invalid={Boolean(errors.richiesta)}
            {...register("richiesta")}
            disabled={bloccato}
          >
            <option value="" disabled>
              {tForm("richiestaPlaceholder")}
            </option>
            {RICHIESTE_NEL_MENU.map((type) => (
              <option key={type} value={type}>
                {tForm(`richiestaOptions.${type}`)}
              </option>
            ))}
          </select>
        </Field>
        <CampoNote
          register={register}
          errors={errors}
          classe="fa-home-input"
          Campo={Field}
          obbligatorie={regolaNote !== null}
          etichetta={etichettaNote}
          lunghezza={lunghezzaNote}
          bloccato={bloccato}
        />
      </div>

      <HoneypotFields register={register} />

      <div className="mt-8">
        <CasellaNewsletter campo={register("newsletter")} bloccato={bloccato} scuro={false} />
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        {/* Home su sezione CHIARA: submit navy PIENO (Button primary) + hover
            navy-light. Stessa size "submit" (22px/UPPERCASE/39px/min-136) del
            submit outlined su scuro → forma identica, trattamento colore diverso. */}
        <SubmitButton
          stato={stato}
          variant="primary"
          testi={{
            invia: tForm("submit"),
            inviato: tForm("inviato"),
            invioInCorso: tForm("invioInCorso"),
          }}
        />
        {inviato ? (
          <ConfermaContatto
            inviato={inviato}
            coloreRiga="var(--fa-text-secondary)"
            coloreLink="var(--fa-text-primary)"
            onNuova={nuovaRichiesta}
          />
        ) : null}
        <RigaPrivacy
          className="fa-body-sm text-center"
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

/**
 * Gli stili dei campi su fondo CHIARO, condivisi col modulo del catalogo (19/10/2026), che sta
 * anche lui su una sezione chiara: una costante, così la home serve lo stesso testo di prima.
 */
export const CAMPI_CHIARI_CSS = `
        .fa-home-flabel {
          display:block; font-size:var(--fa-field-label-font); font-weight:600; letter-spacing:var(--fa-field-label-tracking);
          text-transform:uppercase; color:var(--fa-text-primary);
        }
        .fa-home-input {
          width:100%; background:transparent; border:0;
          border-bottom:var(--fa-field-border) solid var(--fa-field-border-color-light);
          padding:var(--fa-field-pad-y) 0;
          font-size:var(--fa-field-font-2); line-height:var(--fa-field-leading-1);
          color:var(--fa-text-primary); border-radius:0;
          transition:border-color var(--dur-micro) var(--ease-out-expo, ease);
        }
        .fa-home-input::placeholder { color:var(--fa-text-tertiary); }
        .fa-home-input:focus { outline:none; border-bottom-color:var(--fa-navy); }
        /* in errore il filo passa a 1,5 px col rosso su chiaro; il mezzo pixel si toglie dal padding, così il campo non cresce */
        .fa-home-input[aria-invalid="true"] { border-bottom:1.5px solid var(--fa-error); padding-bottom:calc(var(--fa-field-pad-y) - 0.5px); }
        select.fa-home-input { height:var(--fa-field-h-2); }
        select.fa-home-input option { color:#1a1a18; }
        textarea.fa-home-input { resize:vertical; }
        .fa-home-input[readonly] { cursor: default; }
        /* Il menu disabled non va in grigio: stesso colore di sempre (anche WebKit, che usa il fill). */
        select.fa-home-input:disabled {
          cursor: default; opacity: 1; color: var(--fa-text-primary); -webkit-text-fill-color: var(--fa-text-primary);
        }
      `;

/** Il campo con etichetta su fondo chiaro: lo usa anche il modulo del catalogo. */
export function Field({ label, error, errorId, className, children }: CampoProps) {
  return (
    <label className={className ?? "block"}>
      <span className="fa-home-flabel">{label}</span>
      <span className="mt-2 block">{children}</span>
      {error ? (
        <FormError tone="light" id={errorId}>
          {error}
        </FormError>
      ) : null}
    </label>
  );
}
