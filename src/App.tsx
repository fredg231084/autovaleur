import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";

import { clamp, isValidEmail, isValidPhone, isValidPostal } from "./lib/format";
import { generateTimeSlots, type SlotType, type TimeSlot } from "./lib/slots";
import { MODELS_BY_MAKE } from "./lib/vehicles";
import {
  createPartialLead,
  completeLead,
  LeadRateLimitError,
} from "./lib/api";
import { getVehicleEstimate, type VehicleEstimate } from "./lib/estimate";
import { TERMS_URL, PRIVACY_URL } from "./lib/constants";
import type { Step, Errors } from "./types";

import { Badge } from "./components/ui/Badge";
import { ActionBar } from "./components/ActionBar";
import { Footer } from "./components/Footer";
import { IntroStep } from "./components/steps/IntroStep";
import { CarDetailsStep } from "./components/steps/CarDetailsStep";
import { GateStep } from "./components/steps/GateStep";
import { RevealStep } from "./components/steps/RevealStep";
import { SlotsStep } from "./components/steps/SlotsStep";
import { FinishStep } from "./components/steps/FinishStep";

// Persisted across a refresh so the gate's partial lead is reused (never a
// duplicate PARTIAL) until the booking completes. Per-tab; cleared on success.
const LEAD_ID_KEY = "av_lead_id";

export default function AutoValeurWidget() {
  const [step, setStep] = useState<Step>(0);

  // Vehicle (step 1)
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vin, setVin] = useState("");
  const [km, setKm] = useState<number>(120000);
  const [drivable, setDrivable] = useState<"oui" | "non">("oui");

  // Contact (gate, step 2)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consentGate, setConsentGate] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  // Early-capture lead + estimate
  const [leadId, setLeadId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<VehicleEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Slots (step 4)
  const [postal, setPostal] = useState("");
  const [slotType, setSlotType] = useState<SlotType>("today");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  // Finish (step 5)
  const [address, setAddress] = useState("");
  const [payPref, setPayPref] = useState<"interac" | "cash">("interac");
  const [consentFinish, setConsentFinish] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [stageKey, setStageKey] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const refYear = useRef<HTMLDivElement>(null);
  const refMake = useRef<HTMLDivElement>(null);
  const refModel = useRef<HTMLDivElement>(null);
  const refKm = useRef<HTMLDivElement>(null);
  const refDrivable = useRef<HTMLDivElement>(null);
  const refName = useRef<HTMLDivElement>(null);
  const refPhone = useRef<HTMLDivElement>(null);
  const refConsentGate = useRef<HTMLDivElement>(null);
  const refPostal = useRef<HTMLDivElement>(null);
  const refSlots = useRef<HTMLDivElement>(null);
  const refAddress = useRef<HTMLDivElement>(null);
  const refConsentFinish = useRef<HTMLDivElement>(null);

  // Reuse a partial lead created earlier this tab session (survives refresh).
  useEffect(() => {
    try {
      const id = sessionStorage.getItem(LEAD_ID_KEY);
      if (id) setLeadId(id);
    } catch {
      // sessionStorage unavailable — fine, we just can't dedupe across refresh.
    }
  }, []);

  const canComputeSlots = useMemo(() => isValidPostal(postal), [postal]);
  const vehicleLabel = useMemo(() => [year, make, model].filter(Boolean).join(" "), [year, make, model]);
  const modelsForMake = useMemo(() => MODELS_BY_MAKE[make] || [], [make]);
  const selectedSlot = useMemo(() => slots.find((s) => s.id === selectedSlotId) || null, [slots, selectedSlotId]);

  useEffect(() => {
    if (!canComputeSlots) {
      setSlots([]);
      setSelectedSlotId("");
      setSlotsLoading(false);
      return;
    }

    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlotId("");

    const delayMs = 2000 + Math.floor(Math.random() * 3001);
    const t = window.setTimeout(() => {
      const next = generateTimeSlots(slotType, postal);
      setSlots(next);
      setSelectedSlotId(next[0]?.id || "");
      setSlotsLoading(false);
    }, delayMs);

    return () => window.clearTimeout(t);
  }, [slotType, postal, canComputeSlots]);

  function scrollToRef(ref: React.RefObject<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---- Validation (per step) ----
  function validateCar(): Errors {
    const e: Errors = {};
    if (!year) e.year = "Choisissez une année.";
    if (!make.trim()) e.make = "Choisissez une marque (ou écrivez-la).";
    if (!model.trim()) e.model = "Choisissez un modèle (ou écrivez-le).";
    if (km === null || km === undefined || km < 0) e.km = "Indiquez le kilométrage.";
    return e;
  }

  function validateGate(): Errors {
    const e: Errors = {};
    if (!name.trim()) e.name = "Entrez votre nom.";
    if (!phone.trim()) e.phone = "Entrez votre téléphone.";
    else if (!isValidPhone(phone)) e.phone = "Numéro invalide (10 chiffres).";
    if (email.trim() && !isValidEmail(email)) e.email = "Courriel invalide.";
    if (!consentGate) e.consentGate = "Veuillez accepter pour voir votre estimation.";
    return e;
  }

  function validateSlots(): Errors {
    const e: Errors = {};
    if (!isValidPostal(postal)) e.postal = "Entrez un code postal (au moins 3 caractères).";
    if (isValidPostal(postal) && !selectedSlotId) e.slot = "Choisissez une heure d'arrivée.";
    return e;
  }

  function validateFinish(): Errors {
    const e: Errors = {};
    if (!address.trim()) e.address = "Entrez votre adresse complète.";
    if (email.trim() && !isValidEmail(email)) e.email = "Courriel invalide.";
    if (!consentFinish) e.consent = "Veuillez accepter pour réserver.";
    return e;
  }

  function firstErrorRef(e: Errors): React.RefObject<HTMLDivElement> | null {
    if (e.year) return refYear;
    if (e.make) return refMake;
    if (e.model) return refModel;
    if (e.km) return refKm;
    if (e.drivable) return refDrivable;
    if (e.name) return refName;
    if (e.phone) return refPhone;
    if (e.consentGate) return refConsentGate;
    if (e.postal) return refPostal;
    if (e.slot) return refSlots;
    if (e.address) return refAddress;
    if (e.consent) return refConsentFinish;
    return null;
  }

  function scrollFirst(e: Errors) {
    const r = firstErrorRef(e);
    if (r) scrollToRef(r);
  }

  async function magicNavigate(nextStep: Step) {
    setTransitioning(true);
    await new Promise((r) => setTimeout(r, 260));
    setStep(nextStep);
    setStageKey((k) => k + 1);
    await new Promise((r) => setTimeout(r, 360));
    setTransitioning(false);

    window.setTimeout(() => {
      if (nextStep === 2) scrollToRef(refPhone);
      if (nextStep === 4) scrollToRef(refPostal);
      if (nextStep === 5) scrollToRef(refAddress);
    }, 120);
  }

  // Gate submit: create the PARTIAL lead (early capture) and fetch the real
  // estimate, then advance to the reveal. Reuses an existing lead_id so going
  // Back and forward never inserts a second PARTIAL.
  async function submitGate(): Promise<boolean> {
    const e = validateGate();
    setErrors(e);
    if (e.name || e.phone || e.email || e.consentGate) {
      scrollFirst(e);
      return false;
    }

    setGateError(null);
    setGateSubmitting(true);
    try {
      if (!leadId) {
        const res = await createPartialLead({
          vehicle_year: year,
          vehicle_make: make,
          vehicle_model: model,
          vin,
          km,
          drivable: drivable === "oui",
          client_name: name,
          client_phone: phone,
          client_email: email.trim() || undefined,
          marketing_opt_in: marketingOptIn,
          honeypot,
        });
        setLeadId(res.lead_id);
        try {
          sessionStorage.setItem(LEAD_ID_KEY, res.lead_id);
        } catch {
          // ignore storage failures
        }
      }

      // Real range from the SECURITY DEFINER RPC. Best-effort: a null/failed
      // lookup just shows the "on confirme par téléphone" fallback at reveal.
      setEstimateLoading(true);
      const est = await getVehicleEstimate(make, model, year, km).catch(() => null);
      setEstimate(est);
      setEstimateLoading(false);
      return true;
    } catch (err) {
      if (err instanceof LeadRateLimitError) {
        setGateError("Trop de tentatives. Patientez une minute puis réessayez.");
      } else {
        setGateError("Connexion impossible pour le moment.");
      }
      return false;
    } finally {
      setGateSubmitting(false);
    }
  }

  async function goNext() {
    if (transitioning || gateSubmitting) return;

    if (step === 1) {
      const e = validateCar();
      setErrors(e);
      if (e.year || e.make || e.model || e.km) {
        scrollFirst(e);
        return;
      }
      magicNavigate(2);
      return;
    }

    if (step === 2) {
      const ok = await submitGate();
      if (ok) magicNavigate(3);
      return;
    }

    if (step === 4) {
      const e = validateSlots();
      setErrors(e);
      if (e.postal || e.slot) {
        scrollFirst(e);
        return;
      }
      magicNavigate(5);
      return;
    }

    // Steps 0 and 3 just advance.
    magicNavigate(clamp(step + 1, 0, 5) as Step);
  }

  function goBack() {
    setErrors({});
    setGateError(null);
    magicNavigate(clamp(step - 1, 0, 5) as Step);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();

    // The form wraps every step, so an Enter keypress in any field fires this.
    // On non-final steps, advance instead of running the finish submission.
    if (step !== 5) {
      goNext();
      return;
    }

    const v = validateFinish();
    setErrors(v);
    if (v.address || v.email || v.consent) {
      scrollFirst(v);
      return;
    }

    try {
      setSubmitting(true);
      await completeLead({
        lead_id: leadId || undefined,
        vehicle_year: year,
        vehicle_make: make,
        vehicle_model: model,
        vin,
        km,
        drivable: drivable === "oui",
        postal_code: postal,
        slot_type: slotType,
        selected_slot_id: selectedSlotId,
        selected_slot_datetime: selectedSlot?.start.toISOString() || "",
        client_name: name,
        client_phone: phone,
        client_email: email.trim() || undefined,
        client_address: address,
        payment_preference: payPref,
        terms_accepted: consentFinish,
        inspection_accepted: consentFinish,
        marketing_opt_in: marketingOptIn,
        honeypot,
      });
      try {
        sessionStorage.removeItem(LEAD_ID_KEY);
      } catch {
        // ignore
      }
      setSubmitted(true);
    } catch (err) {
      console.error("Submission failed:", err);
      if (err instanceof LeadRateLimitError) {
        alert("Trop de tentatives. Patientez une minute puis réessayez.");
      } else {
        alert("Une erreur est survenue. Veuillez réessayer.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const primaryCtaLabel = useMemo(() => {
    if (step === 0) return "Commencer";
    if (step === 2) return gateSubmitting ? "Un instant…" : "Voir mon estimation";
    if (step === 3) return "Choisir mon créneau d'évaluation gratuite";
    if (step === 5) return submitting ? "Envoi en cours..." : "Réserver l'évaluation gratuite à domicile";
    return "Continuer";
  }, [step, submitting, gateSubmitting]);

  const helperText = useMemo(() => {
    if (step === 0) return "60 secondes • Sans obligation";
    if (step === 1) return "Votre véhicule";
    if (step === 2) return "Vos coordonnées";
    if (step === 3) return "Votre estimation";
    if (step === 4) return "Choisir une plage horaire";
    if (step === 5) return "Finaliser la réservation";
    return "";
  }, [step]);

  return (
    <div className="w-full bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:px-6 sm:pb-28 sm:pt-8">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
              <ShieldCheck className="h-4 w-4" />
              AutoValeur • Évaluation à domicile (Québec)
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Estimation cash + réservation en ligne
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              UX premium, rapide, sans pression. Paiement possible <span className="font-semibold">le jour même</span>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Sans obligation</Badge>
            <Badge tone="amber">Très demandé</Badge>
            <Badge>Données sécurisées</Badge>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Sparkles className="h-4 w-4" />
                <span>{helperText}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="green">Visite gratuite</Badge>
                <Badge>Heures: semaine 9h–17h</Badge>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <form onSubmit={submit}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${step}-${stageKey}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: transitioning ? 0 : 1, y: transitioning ? -6 : 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28 }}
                  className="space-y-6"
                >
                  {step === 0 && <IntroStep />}
                  {step === 1 && (
                    <CarDetailsStep
                      year={year}
                      setYear={setYear}
                      make={make}
                      setMake={setMake}
                      model={model}
                      setModel={setModel}
                      vin={vin}
                      setVin={setVin}
                      km={km}
                      setKm={setKm}
                      drivable={drivable}
                      setDrivable={setDrivable}
                      modelsForMake={modelsForMake}
                      errors={errors}
                      setErrors={setErrors}
                      refYear={refYear}
                      refMake={refMake}
                      refModel={refModel}
                      refKm={refKm}
                      refDrivable={refDrivable}
                    />
                  )}
                  {step === 2 && (
                    <GateStep
                      name={name}
                      setName={setName}
                      phone={phone}
                      setPhone={setPhone}
                      email={email}
                      setEmail={setEmail}
                      consentGate={consentGate}
                      setConsentGate={setConsentGate}
                      honeypot={honeypot}
                      setHoneypot={setHoneypot}
                      gateError={gateError}
                      errors={errors}
                      setErrors={setErrors}
                      refName={refName}
                      refPhone={refPhone}
                      refConsent={refConsentGate}
                      termsHref={TERMS_URL}
                      privacyHref={PRIVACY_URL}
                    />
                  )}
                  {step === 3 && (
                    <RevealStep estimate={estimate} estimateLoading={estimateLoading} />
                  )}
                  {step === 4 && (
                    <SlotsStep
                      postal={postal}
                      setPostal={setPostal}
                      slotType={slotType}
                      setSlotType={setSlotType}
                      canComputeSlots={canComputeSlots}
                      slotsLoading={slotsLoading}
                      slots={slots}
                      selectedSlotId={selectedSlotId}
                      setSelectedSlotId={setSelectedSlotId}
                      errors={errors}
                      setErrors={setErrors}
                      refPostal={refPostal}
                      refSlots={refSlots}
                    />
                  )}
                  {step === 5 && (
                    <FinishStep
                      submitted={submitted}
                      vehicleLabel={vehicleLabel}
                      km={km}
                      drivable={drivable}
                      estimate={estimate}
                      selectedSlot={selectedSlot}
                      payPref={payPref}
                      setPayPref={setPayPref}
                      address={address}
                      setAddress={setAddress}
                      email={email}
                      setEmail={setEmail}
                      consentFinish={consentFinish}
                      setConsentFinish={setConsentFinish}
                      marketingOptIn={marketingOptIn}
                      setMarketingOptIn={setMarketingOptIn}
                      honeypot={honeypot}
                      setHoneypot={setHoneypot}
                      errors={errors}
                      setErrors={setErrors}
                      refAddress={refAddress}
                      refConsent={refConsentFinish}
                      termsHref={TERMS_URL}
                      privacyHref={PRIVACY_URL}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <ActionBar
                step={step}
                transitioning={transitioning}
                submitted={submitted}
                submitting={submitting}
                busy={gateSubmitting}
                goBack={goBack}
                goNext={goNext}
                primaryCtaLabel={primaryCtaLabel}
                helperText={helperText}
                canComputeSlots={canComputeSlots}
              />
            </form>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
