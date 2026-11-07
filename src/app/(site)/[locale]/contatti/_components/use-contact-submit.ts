"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { usePathname } from "@/i18n/navigation";

import { submitContact } from "./actions";
import { caricaAnimazioni } from "./carica-animazioni";
import { contactSchema, etichettaNote, regolaNote, type ContactFormValues } from "./schema";
import type { StatoInvio } from "./submit-button";

export type SubmitState = Exclude<StatoInvio, "pending">;

/** Il modello della scheda che ospita il modulo (16/10/2026): codice e nome nella lingua della pagina. */
export interface ModelloDelModulo {
  codice: string;
  nome: string;
}

/**
 * useContactSubmit — wiring condiviso da ContactForm (contatti + ProgettareCta) e
 * FinalCtaForm (home). Estrae la parte byte-identica dei due form: react-hook-form
 * + Zod resolver, la state machine idle/pending/success/error, il timestamp-trap
 * e il submit verso `submitContact` con try/catch. I wrapper restano thin: solo
 * CSS, variante Button, preselect searchParams e namespace i18n divergono.
 */
export function useContactSubmit(
  initialRichiesta?: ContactFormValues["richiesta"],
  modello?: ModelloDelModulo,
) {
  const [isPending, startTransition] = useTransition();
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  // Epoch ms del mount del form → timestamp-trap lato server (lazy init: una sola
  // volta, non a ogni render). Iniettato nel payload al submit, non è un campo DOM.
  const [mountedAt] = useState(() => Date.now());
  // Lingua in cui la persona guarda il sito: come `_ts`, va nel payload e non nel DOM.
  const lingua = useLocale();
  // Chiave interna della rotta (`/contatti` in ogni lingua): dice al server da che pagina
  // arriva il lead anche quando il browser non manda il referer. Non va a Zapier.
  const pagina = usePathname();
  const ridotto = usePrefersReducedMotion();
  // Chi ha inviato: il nome, per la riga di conferma e solo lì (14/10/2026). Col catalogo anche
  // l'email, che la sua riga ripete (eccezione di Marco del 19/10), e l'esito di Brevo.
  const [inviato, setInviato] = useState<{
    nome: string;
    email: string;
    catalogo?: "inviato" | "ripiego";
    /** La casella era spuntata: la riga della newsletter dipende SOLO da questo, mai da Brevo. */
    newsletter: boolean;
  } | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      telefono: "",
      azienda: "",
      richiesta: initialRichiesta,
      note: "",
      // La casella della newsletter parte sempre NON spuntata (19/10/2026).
      newsletter: false,
      _gotcha: "",
    },
  });

  // Etichetta e obbligo delle note seguono i due select, subito (13/10/2026).
  const [richiesta, paese, note] = useWatch({
    control: form.control,
    name: ["richiesta", "paese", "note"],
  });
  const regola = regolaNote(richiesta, paese);
  const { isSubmitted } = form.formState;
  const { trigger } = form;

  // Dopo il primo invio, cambiare uno dei due select rivalida le note: se diventano
  // facoltative l'errore già mostrato sparisce, se diventano obbligatorie compare.
  useEffect(() => {
    if (isSubmitted) void trigger("note");
  }, [richiesta, paese, isSubmitted, trigger]);

  // Dopo un invio riuscito il modulo resta pieno e bloccato, così si vede cosa si è mandato
  // (14/10/2026). Si svuota solo con «Invia un'altra richiesta».
  const bloccato = submitState === "success";

  const invia = form.handleSubmit((values) => {
    // I plugin dell'animazione si chiedono al primo invio valido, insieme alla Server Action.
    if (!ridotto) void caricaAnimazioni();
    setSubmitState("idle");
    startTransition(async () => {
      try {
        // `pagina` e `lingua` si leggono a ogni invio: valgono anche dopo «Invia un'altra
        // richiesta» (aggiunta 4 di Marco, e2e in `modulo-conferma.spec.ts`).
        // Il modello solo dalle schede: gli altri moduli mandano esattamente il payload di prima.
        const delModello = modello ? { modello: modello.codice, modelloNome: modello.nome } : {};
        const result = await submitContact({
          ...values,
          ...delModello,
          _ts: mountedAt,
          lingua,
          pagina,
        });
        if (result.status === "success") {
          setInviato({
            nome: values.nome,
            email: values.email,
            catalogo: result.catalogo,
            newsletter: values.newsletter === true,
          });
          setSubmitState("success");
        } else {
          setSubmitState("error");
        }
      } catch {
        // submitContact non dovrebbe throware (ritorna sempre un result), ma se
        // la Server Action fallisce a livello di trasporto → stato error, mai crash.
        setSubmitState("error");
      }
    });
  });

  // Durante l'invio e dopo il successo il bottone è `aria-disabled` e non `disabled`, perché il
  // fuoco resti su di lui: i clic si fermano qui.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (isPending || bloccato) {
      e.preventDefault();
      return;
    }
    return invia(e);
  };

  const nuovaRichiesta = () => {
    form.reset();
    setInviato(null);
    setSubmitState("idle");
    requestAnimationFrame(() => form.setFocus("nome"));
  };

  const stato: StatoInvio = isPending ? "pending" : submitState;

  return {
    register: form.register,
    errors: form.formState.errors,
    onSubmit,
    isPending,
    submitState,
    stato,
    bloccato,
    inviato,
    nuovaRichiesta,
    regolaNote: regola,
    etichettaNote: etichettaNote(richiesta, paese),
    lunghezzaNote: (note ?? "").length,
  };
}
