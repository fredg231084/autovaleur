import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  MessageCircle,
  MapPin,
  Mail,
  CreditCard,
  Banknote,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Field } from "../ui/Field";
import { formatCad, prettyKm } from "../../lib/format";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL, CONTACT_EMAIL } from "../../lib/constants";
import type { VehicleEstimate } from "../../lib/estimate";
import type { TimeSlot } from "../../lib/slots";
import type { Errors } from "../../types";

function estimateText(estimate: VehicleEstimate | null): string {
  if (estimate?.found) return `${formatCad(estimate.low)} – ${formatCad(estimate.high)}`;
  return "À confirmer par téléphone";
}

export function FinishStep({
  submitted,
  vehicleLabel,
  km,
  drivable,
  estimate,
  selectedSlot,
  payPref,
  setPayPref,
  address,
  setAddress,
  email,
  setEmail,
  consentFinish,
  setConsentFinish,
  marketingOptIn,
  setMarketingOptIn,
  honeypot,
  setHoneypot,
  errors,
  setErrors,
  refAddress,
  refConsent,
  termsHref,
  privacyHref,
}: {
  submitted: boolean;
  vehicleLabel: string;
  km: number;
  drivable: "oui" | "non";
  estimate: VehicleEstimate | null;
  selectedSlot: TimeSlot | null;
  payPref: "interac" | "cash";
  setPayPref: (v: "interac" | "cash") => void;
  address: string;
  setAddress: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  consentFinish: boolean;
  setConsentFinish: (v: boolean) => void;
  marketingOptIn: boolean;
  setMarketingOptIn: (v: boolean) => void;
  honeypot: string;
  setHoneypot: (v: string) => void;
  errors: Errors;
  setErrors: React.Dispatch<React.SetStateAction<Errors>>;
  refAddress: React.RefObject<HTMLDivElement>;
  refConsent: React.RefObject<HTMLDivElement>;
  termsHref: string;
  privacyHref: string;
}) {
  if (submitted) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-700" />
          <div className="w-full">
            <div className="text-lg font-extrabold text-emerald-900">Évaluation réservée ✅</div>
            <div className="mt-1 text-sm text-emerald-800">
              Un évaluateur se déplacera à votre adresse pour confirmer l'état du véhicule et finaliser l'offre.
            </div>

            <div className="mt-4 rounded-2xl bg-white/70 p-4 ring-1 ring-inset ring-emerald-200">
              <div className="text-xs font-semibold text-emerald-900">Résumé</div>
              <div className="mt-2 grid gap-2 text-sm text-emerald-900 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-emerald-800">Véhicule</div>
                  <div className="font-semibold">{vehicleLabel || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-800">Kilométrage</div>
                  <div className="font-semibold">{prettyKm(km)} km</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-800">Estimation</div>
                  <div className="font-semibold">{estimateText(estimate)}</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-800">Créneau</div>
                  <div className="font-semibold">{selectedSlot ? selectedSlot.label : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-800">Paiement</div>
                  <div className="font-semibold">{payPref === "cash" ? "Comptant" : "Virement Interac"}</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-800">Adresse</div>
                  <div className="font-semibold">{address || "—"}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-inset ring-emerald-200">
                <div className="text-xs font-semibold text-emerald-900">À préparer (checklist)</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-emerald-900">
                  <li>Clés (et 2e clé si disponible)</li>
                  <li>Immatriculation / documents du véhicule</li>
                  <li>Pièce d'identité</li>
                  <li>Info utile (pneus, réparations récentes, etc.)</li>
                </ul>
                <div className="mt-2 text-xs text-emerald-800">
                  Le kilométrage et l'état réel seront vérifiés sur place avant confirmation du montant final.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-100/60 p-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 text-emerald-800" />
                <div className="text-sm text-emerald-900">
                  Besoin d'ajuster l'heure ? Appelez{" "}
                  <a className="font-bold underline" href={`tel:${CONTACT_PHONE_TEL}`}>
                    {CONTACT_PHONE_DISPLAY}
                  </a>{" "}
                  ou écrivez à{" "}
                  <a className="font-bold underline" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </a>
                  .
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Honeypot mirror on the finish form too. */}
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

      <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-600">Votre estimation</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              {estimateText(estimate)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Le prix final est confirmé après vérification sur place (état + kilométrage).
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Paiement jour même</Badge>
            <Badge>Sans obligation</Badge>
          </div>
        </div>
      </div>

      <div ref={refAddress}>
        <Field
          label="Adresse complète"
          icon={MapPin}
          error={errors.address}
          hint="Où l'évaluateur se déplace"
        >
          <input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setErrors((p) => ({ ...p, address: undefined }));
            }}
            placeholder="Numéro, rue, ville"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
            autoComplete="street-address"
          />
        </Field>
      </div>

      <Field label="Courriel (optionnel)" icon={Mail} error={errors.email} hint="Pour la confirmation écrite">
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

      <Field label="Préférence de paiement" icon={CreditCard}>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPayPref("interac")}
            className={
              "rounded-2xl border p-4 text-left shadow-sm transition " +
              (payPref === "interac"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:shadow-md")
            }
          >
            <div className="flex items-center gap-2">
              <CreditCard className={"h-4 w-4 " + (payPref === "interac" ? "text-white/80" : "text-slate-500")} />
              <div className="text-sm font-semibold">Virement Interac</div>
            </div>
            <div className={"mt-1 text-xs " + (payPref === "interac" ? "text-white/80" : "text-slate-600")}>
              Rapide, sans argent comptant
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPayPref("cash")}
            className={
              "rounded-2xl border p-4 text-left shadow-sm transition " +
              (payPref === "cash"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:shadow-md")
            }
          >
            <div className="flex items-center gap-2">
              <Banknote className={"h-4 w-4 " + (payPref === "cash" ? "text-white/80" : "text-slate-500")} />
              <div className="text-sm font-semibold">Comptant</div>
            </div>
            <div className={"mt-1 text-xs " + (payPref === "cash" ? "text-white/80" : "text-slate-600")}>
              Paiement sur place (si disponible)
            </div>
          </button>
        </div>
      </Field>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-extrabold text-slate-900">Dernière confirmation</div>
            <div className="mt-1 text-sm text-slate-600">Clair, simple, sans piège.</div>
          </div>
          <Badge>Données sécurisées</Badge>
        </div>

        <div className="mt-5 grid gap-3">
          {/* Single required consent — terms + on-site inspection combined. */}
          <div ref={refConsent} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consentFinish}
                onChange={(e) => {
                  setConsentFinish(e.target.checked);
                  setErrors((p) => ({ ...p, consent: undefined }));
                }}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <div className="w-full">
                <div className="text-sm font-semibold text-slate-900">
                  J'accepte les{" "}
                  <a href={termsHref} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                    conditions
                  </a>
                  , la{" "}
                  <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                    politique de confidentialité
                  </a>{" "}
                  et la vérification sur place (état + kilométrage). <span className="text-rose-600">*</span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  L'estimation est une fourchette. Le montant final est confirmé après l'inspection gratuite à domicile.
                </div>
              </div>
            </label>

            <AnimatePresence>
              {errors.consent ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
                >
                  {errors.consent}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Optional marketing opt-in — stays separate from the required consent. */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <div className="w-full">
                <div className="text-sm font-semibold text-slate-900">
                  (Optionnel) Recevoir des offres / rappels par SMS ou courriel
                </div>
                <div className="mt-1 text-xs text-slate-600">Vous pouvez vous désinscrire en tout temps.</div>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-700" />
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Important :</span> On ne partage jamais vos informations à des tiers.
              Objectif: traiter votre demande + planifier la visite.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-600">Récapitulatif</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">Ce que vous réservez</div>
          </div>
          <Badge tone="green">Gratuit</Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-slate-200">
            <div className="text-xs font-semibold text-slate-600">Véhicule</div>
            <div className="mt-1 text-sm font-bold text-slate-900">{vehicleLabel || "—"}</div>
            <div className="mt-1 text-xs text-slate-500">{prettyKm(km)} km • {drivable === "oui" ? "Roule" : "Ne roule pas"}</div>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-slate-200">
            <div className="text-xs font-semibold text-slate-600">Estimation</div>
            <div className="mt-1 text-xl font-extrabold text-slate-900">{estimateText(estimate)}</div>
            <div className="mt-1 text-xs text-slate-500">Confirmée après vérification sur place</div>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-slate-200">
            <div className="text-xs font-semibold text-slate-600">Créneau</div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              {selectedSlot ? selectedSlot.label : "—"}
            </div>
            <div className="mt-1 text-xs text-slate-500">Semaine • 9h–17h</div>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-slate-200">
            <div className="text-xs font-semibold text-slate-600">Paiement</div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              {payPref === "cash" ? "Comptant" : "Virement Interac"}
            </div>
            <div className="mt-1 text-xs text-slate-500">Préférence (selon disponibilité)</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-inset ring-slate-200">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-slate-600" />
            <div className="text-sm text-slate-700">
              Vous recevrez une confirmation par téléphone ou courriel. Besoin de modifier? Appelez{" "}
              <a className="font-bold underline" href={`tel:${CONTACT_PHONE_TEL}`}>
                {CONTACT_PHONE_DISPLAY}
              </a>
              .
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
