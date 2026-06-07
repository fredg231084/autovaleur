import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Phone, Mail, Lock, AlertTriangle } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Field } from "../ui/Field";
import type { Errors } from "../../types";

/**
 * The gate: the only PII collected before the price is revealed. Phone is the
 * hero field — it's how the team pre-qualifies. On submit the orchestrator
 * creates a PARTIAL lead (early capture), so even price-step bounces stay
 * contactable. Email is optional; a single Loi 25 consent covers contact + privacy.
 */
export function GateStep({
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  consentGate,
  setConsentGate,
  honeypot,
  setHoneypot,
  gateError,
  errors,
  setErrors,
  refName,
  refPhone,
  refConsent,
  termsHref,
  privacyHref,
}: {
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  consentGate: boolean;
  setConsentGate: (v: boolean) => void;
  honeypot: string;
  setHoneypot: (v: string) => void;
  gateError: string | null;
  errors: Errors;
  setErrors: React.Dispatch<React.SetStateAction<Errors>>;
  refName: React.RefObject<HTMLDivElement>;
  refPhone: React.RefObject<HTMLDivElement>;
  refConsent: React.RefObject<HTMLDivElement>;
  termsHref: string;
  privacyHref: string;
}) {
  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 sm:p-7">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Lock className="h-4 w-4" />
          Dernière étape avant votre estimation
        </div>
        <div className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          À qui envoie-t-on l'estimation ?
        </div>
        <div className="mt-2 text-sm text-slate-600">
          On vous montre votre fourchette de prix juste après. Un conseiller peut vous
          rappeler pour confirmer les détails.
        </div>
      </div>

      {/* Honeypot: hidden from humans, catnip for bots. Leave it empty. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Ne pas remplir
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      {/* Phone = hero field. */}
      <div ref={refPhone}>
        <Field label="Téléphone" icon={Phone} error={errors.phone} hint="On vous appelle pour confirmer">
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setErrors((p) => ({ ...p, phone: undefined }));
            }}
            placeholder="514 555-1234"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold outline-none ring-slate-900/10 focus:ring-4"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
          />
        </Field>
      </div>

      <div ref={refName}>
        <Field label="Nom" icon={ShieldCheck} error={errors.name}>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: undefined }));
            }}
            placeholder="Votre nom"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
            autoComplete="name"
          />
        </Field>
      </div>

      <Field label="Courriel (optionnel)" icon={Mail} error={errors.email} hint="Pour recevoir la confirmation">
        <input
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((p) => ({ ...p, email: undefined }));
          }}
          placeholder="vous@email.com (optionnel)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
          inputMode="email"
          autoComplete="email"
        />
      </Field>

      {/* Single Loi 25 consent line. */}
      <div ref={refConsent} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consentGate}
            onChange={(e) => {
              setConsentGate(e.target.checked);
              setErrors((p) => ({ ...p, consentGate: undefined }));
            }}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <div className="w-full">
            <div className="text-sm font-semibold text-slate-900">
              J'accepte d'être contacté(e) par AutoValeur au sujet de mon véhicule et que mes
              renseignements soient traités selon la{" "}
              <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                politique de confidentialité
              </a>{" "}
              (Loi 25). <span className="text-rose-600">*</span>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Utilisé uniquement pour traiter votre demande et vous contacter — jamais partagé à des tiers.{" "}
              <a href={termsHref} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                Conditions
              </a>
              .
            </div>
          </div>
        </label>

        <AnimatePresence>
          {errors.consentGate ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
            >
              {errors.consentGate}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="green">Sans obligation</Badge>
        <Badge>Données sécurisées</Badge>
        <Badge tone="amber">Très demandé</Badge>
      </div>

      {/* Friendly retry banner when partial creation fails (network / 429). */}
      <AnimatePresence>
        {gateError ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              {gateError}
              <div className="mt-1 text-xs font-medium text-amber-800">
                Vos informations sont conservées — appuyez de nouveau pour réessayer.
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
