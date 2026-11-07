"use client";

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { ALTRO_PAESE, type ElencoPaesi } from "@/lib/paesi";

import { NOTE_MAX, type ContactFormValues } from "./schema";

/**
 * Paese e note, condivisi dai tre moduli (13/10/2026): `/contatti`, `ProgettareCta` e la home.
 * Ogni modulo passa la SUA classe di input e il SUO `Field`, così i due campi nuovi hanno
 * etichetta, errore e focus identici a quelli che stanno accanto, su fondo scuro e su chiaro.
 */

/** Il contatore compare solo vicino al limite: sotto, è rumore. */
const CONTATORE_DA = 800;

/** Separatore del menu: un `<option disabled>`, non selezionabile. */
const SEPARATORE = "──────────";

export interface CampoProps {
  label: ReactNode;
  error?: string;
  errorId?: string;
  className?: string;
  children: ReactNode;
}

interface Comuni {
  register: UseFormRegister<ContactFormValues>;
  errors: FieldErrors<ContactFormValues>;
  classe: string;
  Campo: (props: CampoProps) => ReactNode;
  /** Dopo un invio riuscito: il menu `disabled`, le note `readonly` (14/10/2026). */
  bloccato?: boolean;
}

export function CampoPaese({
  register,
  errors,
  classe,
  Campo,
  paesi,
  bloccato = false,
}: Comuni & { paesi: ElencoPaesi }) {
  const t = useTranslations("contatti.form");
  const errore = errors.paese?.message;
  const errorId = useId();

  return (
    <Campo label={t("paese")} error={errore ? t(`errors.${errore}`) : undefined} errorId={errorId}>
      <select
        className={classe}
        defaultValue=""
        autoComplete="country"
        aria-invalid={Boolean(errore)}
        aria-describedby={errore ? errorId : undefined}
        {...register("paese")}
        disabled={bloccato}
      >
        <option value="" disabled>
          {t("paesePlaceholder")}
        </option>
        {paesi.inTesta.map((p) => (
          <option key={p.codice} value={p.codice}>
            {p.nome}
          </option>
        ))}
        <option disabled>{SEPARATORE}</option>
        {paesi.altri.map((p) => (
          <option key={p.codice} value={p.codice}>
            {p.nome}
          </option>
        ))}
        <option disabled>{SEPARATORE}</option>
        <option value={ALTRO_PAESE}>{t("paeseAltro")}</option>
      </select>
    </Campo>
  );
}

export function CampoNote({
  register,
  errors,
  classe,
  Campo,
  obbligatorie,
  etichetta,
  lunghezza,
  bloccato = false,
}: Comuni & {
  obbligatorie: boolean;
  etichetta: "noteFacoltative" | "noteAltro" | "noteAltroPaese" | "notePaese";
  lunghezza: number;
}) {
  const t = useTranslations("contatti.form");
  const errore = errors.note?.message;
  const errorId = useId();
  const contatoreId = useId();
  const contatore = lunghezza > CONTATORE_DA;
  const descritto = [errore ? errorId : null, contatore ? contatoreId : null].filter(Boolean);

  return (
    <Campo
      className="block sm:col-span-2"
      label={
        <>
          {t(etichetta)}
          {/* L'asterisco non è l'unico segnale: lo dicono il testo e `aria-required`. */}
          {obbligatorie ? <span aria-hidden="true"> *</span> : null}
        </>
      }
      error={errore ? t(`errors.${errore}`) : undefined}
      errorId={errorId}
    >
      <textarea
        rows={3}
        maxLength={NOTE_MAX}
        className={classe}
        aria-required={obbligatorie}
        aria-invalid={Boolean(errore)}
        aria-describedby={descritto.length ? descritto.join(" ") : undefined}
        {...register("note")}
        readOnly={bloccato}
      />
      {contatore ? (
        <span id={contatoreId} className="mt-1 block text-right text-micro-2">
          {t("noteContatore", { n: lunghezza, max: NOTE_MAX })}
        </span>
      ) : null}
    </Campo>
  );
}
