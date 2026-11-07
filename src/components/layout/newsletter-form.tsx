"use client";

import { useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { CAMPI_SCURI_CSS } from "@/app/(site)/[locale]/contatti/_components/campi-scuri";
import { FormError } from "@/components/ui/form-error";
import { CasellaNewsletter } from "@/app/(site)/[locale]/contatti/_components/casella-newsletter";
import { caricaAnimazioni } from "@/app/(site)/[locale]/contatti/_components/carica-animazioni";
import {
  SubmitButton,
  type StatoInvio,
} from "@/app/(site)/[locale]/contatti/_components/submit-button";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { submitNewsletter } from "./newsletter-action";

type NomeCampo = "nome" | "cognome" | "email";

/**
 * Il modulo della newsletter nel piè di pagina (20/10/2026, Marco): Nome e Cognome affiancati, Email
 * sotto, tutti obbligatori; la casella (obbligatoria, mai spuntata); «Iscriviti →».
 *
 * ⚠️ È su OGNI pagina, quindi niente react-hook-form né Zod nel browser: stato di React e la
 * validazione nativa dei campi (`required`, `type="email"`). La regola vera la fa lo schema di
 * `submitNewsletter` sul server. Riusa i pezzi dei moduli di contatto: lo stile dei campi su scuro,
 * la casella e il bottone di invio, che carica le sue animazioni solo al primo invio valido.
 *
 * I testi sono in `contatti`, che il browser riceve già: niente namespace nuovi nel payload.
 */
export function NewsletterForm() {
  const t = useTranslations("contatti");
  const lingua = useLocale();
  const ridotto = usePrefersReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [esito, setEsito] = useState<"idle" | "success" | "error">("idle");
  const [errori, setErrori] = useState<Partial<Record<NomeCampo | "casella", boolean>>>({});
  // Epoch ms del mount: la trappola dei 3 secondi, come `useContactSubmit`.
  const [mountedAt] = useState(() => Date.now());
  const id = useId();

  const bloccato = esito === "success";
  const stato: StatoInvio = isPending ? "pending" : esito;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending || bloccato) return;
    const form = e.currentTarget;
    const dati = new FormData(form);
    const testo = (k: string) => String(dati.get(k) ?? "").trim();
    // `validity` con `required` e `type="email"`; il trim per chi scrive solo spazi.
    const nonValido = (k: NomeCampo) => {
      const el = form.elements.namedItem(k);
      return testo(k) === "" || !(el instanceof HTMLInputElement && el.validity.valid);
    };
    const nuovi = {
      nome: nonValido("nome"),
      cognome: nonValido("cognome"),
      email: nonValido("email"),
      casella: dati.get("newsletter") !== "on",
    };
    setErrori(nuovi);
    const primo = (["nome", "cognome", "email"] as const).find((k) => nuovi[k]);
    if (primo) {
      (form.elements.namedItem(primo) as HTMLInputElement).focus();
      return;
    }
    if (nuovi.casella) return;
    if (!ridotto) void caricaAnimazioni();
    setEsito("idle");
    startTransition(async () => {
      try {
        const res = await submitNewsletter({
          nome: testo("nome"),
          cognome: testo("cognome"),
          email: testo("email"),
          consenso: true,
          lingua,
          _gotcha: String(dati.get("_gotcha") ?? ""),
          _ts: mountedAt,
        });
        if (res.status === "success") setEsito("success");
        else if (res.message === "validation") setErrori({ email: true });
        else setEsito("error");
      } catch {
        setEsito("error");
      }
    });
  };

  const campo = (
    nome: NomeCampo,
    etichetta: string,
    errore: string,
    attributi: { type: "text" | "email"; autoComplete: string; maxLength: number },
    classe = "block min-w-0",
  ) => (
    <label className={classe}>
      <span className="block text-micro-1 font-semibold tracking-3 text-fa-text-on-dark uppercase">
        {etichetta}
      </span>
      <input
        {...attributi}
        name={nome}
        required
        className="fa-contact-input mt-2"
        aria-invalid={errori[nome] || undefined}
        aria-describedby={errori[nome] ? `${id}-${nome}` : undefined}
        readOnly={bloccato}
        onChange={() => {
          if (errori[nome]) setErrori((v) => ({ ...v, [nome]: false }));
        }}
      />
      {errori[nome] ? (
        <FormError tone="dark" id={`${id}-${nome}`}>
          {errore}
        </FormError>
      ) : null}
    </label>
  );

  const erroreCasella = `${id}-casella`;

  return (
    // `method="post"`: senza JS il clic non mette l'email nell'URL (come gli altri moduli).
    <form method="post" onSubmit={onSubmit} noValidate aria-busy={isPending} className="mt-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        {campo("nome", t("form.nome"), t("form.errors.nomeRequired"), {
          type: "text",
          autoComplete: "given-name",
          maxLength: 80,
        })}
        {campo("cognome", t("form.cognome"), t("form.errors.cognomeRequired"), {
          type: "text",
          autoComplete: "family-name",
          maxLength: 80,
        })}
        {campo(
          "email",
          t("form.email"),
          t("form.errors.emailInvalid"),
          { type: "email", autoComplete: "email", maxLength: 120 },
          "col-span-2 block min-w-0",
        )}
      </div>

      {/* L'esca, fuori schermo come in `HoneypotFields`, che però è legata a react-hook-form. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
      >
        {/* L'etichetta dell'esca nella lingua della pagina, come nei moduli di contatto. */}
        <label>
          {t("form.esca")}
          <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="mt-4">
        <CasellaNewsletter
          campo={{
            name: "newsletter",
            "aria-invalid": errori.casella || undefined,
            "aria-describedby": errori.casella ? erroreCasella : undefined,
            onChange: (e) => {
              if (e.currentTarget.checked) setErrori((v) => ({ ...v, casella: false }));
            },
          }}
          bloccato={bloccato}
          scuro
        />
        {errori.casella ? (
          <FormError tone="dark" id={erroreCasella} announce>
            {t("newsletterFooter.casella")}
          </FormError>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col items-start gap-4">
        <SubmitButton
          stato={stato}
          variant="secondary"
          dark
          testi={{
            invia: t("newsletterFooter.iscriviti"),
            inviato: t("newsletterFooter.iscritto"),
            invioInCorso: t("form.invioInCorso"),
          }}
        />
        {bloccato ? (
          <output className="fa-body-sm block text-fa-text-on-dark">
            {t("form.newsletterConferma")}
          </output>
        ) : null}
        {esito === "error" ? (
          <FormError tone="dark" kind="alert">
            {t("form.errorGeneric")}
          </FormError>
        ) : null}
      </div>

      <style>{CAMPI_SCURI_CSS}</style>
    </form>
  );
}
