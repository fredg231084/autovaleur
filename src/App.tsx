import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  Hash,
  MapPin,
  CalendarClock,
  ShieldCheck,
  CreditCard,
  Banknote,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Info,
  Mail,
  Phone,
  Clock,
  MessageCircle,
  Sparkles,
  BadgeCheck,
  Scale,
  Search,
} from "lucide-react";
import { submitLead } from './lib/api';

const MAKES = [
  "Acura",
  "Audi",
  "BMW",
  "Chevrolet",
  "Dodge",
  "Ford",
  "GMC",
  "Honda",
  "Hyundai",
  "Jeep",
  "Kia",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "Nissan",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const MODELS_BY_MAKE: Record<string, string[]> = {
  Acura: ["MDX", "RDX", "TLX", "ILX", "Integra"],
  Audi: ["A3", "A4", "A5", "A6", "Q3", "Q5", "Q7"],
  BMW: ["3 Series", "5 Series", "X1", "X3", "X5", "i3", "i4", "iX"],
  Chevrolet: ["Cruze", "Malibu", "Equinox", "Traverse", "Tahoe", "Silverado"],
  Dodge: ["Charger", "Challenger", "Durango", "Grand Caravan"],
  Ford: ["F-150", "Escape", "Edge", "Explorer", "Mustang", "Ranger"],
  GMC: ["Sierra", "Terrain", "Acadia", "Yukon"],
  Honda: ["Civic", "Accord", "CR-V", "HR-V", "Pilot", "Odyssey"],
  Hyundai: ["Elantra", "Sonata", "Tucson", "Santa Fe", "Kona", "Palisade"],
  Jeep: ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Renegade"],
  Kia: ["Forte", "Optima", "K5", "Sportage", "Sorento", "Telluride"],
  Lexus: ["IS", "ES", "RX", "NX", "GX"],
  Mazda: ["Mazda3", "Mazda6", "CX-3", "CX-5", "CX-9"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLA", "GLC", "GLE"],
  Nissan: ["Sentra", "Altima", "Rogue", "Murano", "Pathfinder"],
  Subaru: ["Impreza", "Crosstrek", "Forester", "Outback", "WRX"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X"],
  Toyota: ["Corolla", "Camry", "RAV4", "Highlander", "Tacoma", "Prius"],
  Volkswagen: ["Jetta", "Golf", "Tiguan", "Atlas", "Passat"],
  Volvo: ["S60", "S90", "XC40", "XC60", "XC90"],
};

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const YEARS = Array.from({ length: 22 }, (_, i) => String(CURRENT_YEAR - i));

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatCad(n: number) {
  try {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)} $`;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateFR(d: Date) {
  const weekday = d.toLocaleDateString("fr-CA", { weekday: "long" });
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = pad2(d.getFullYear() % 100);
  return `${weekday} ${dd}/${mm}/${yy}`;
}

function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function nextBusinessDay(from: Date) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return d;
}

export type SlotType = "today" | "tomorrow" | "week";
export type TimeSlot = { id: string; start: Date; label: string };

export function generateTimeSlots(slotType: SlotType, postalRaw: string, now = new Date()): TimeSlot[] {
  const postal = (postalRaw || "").trim().toUpperCase();
  if (postal.length < 3) return [];

  const seed = postal
    .slice(0, 3)
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  const base = new Date(now);
  base.setHours(12, 0, 0, 0);

  let startDay: Date;
  if (slotType === "today") startDay = nextBusinessDay(base);
  else if (slotType === "tomorrow") {
    const t = nextBusinessDay(base);
    t.setDate(t.getDate() + 1);
    startDay = nextBusinessDay(t);
  } else {
    startDay = nextBusinessDay(base);
  }

  const days: Date[] = [];
  if (slotType === "week") {
    let d = new Date(startDay);
    while (days.length < 5) {
      if (!isWeekend(d)) days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
  } else {
    days.push(new Date(startDay));
  }

  const hours = [9, 10, 11, 13, 14, 15, 16];

  const slots: TimeSlot[] = [];
  for (const day of days) {
    for (const h of hours) {
      const start = new Date(day);
      start.setHours(h, 0, 0, 0);

      const ampm = h < 12 ? "AM" : "PM";
      const displayH = h <= 12 ? h : h - 12;
      const timeLabel = `${displayH}:00 ${ampm}`;

      slots.push({
        id: `${day.toISOString().slice(0, 10)}-${h}`,
        start,
        label: `${formatDateFR(day)} • ${timeLabel}`,
      });
    }
  }

  const rotateBy = seed % Math.max(1, slots.length);
  const rotated = slots.slice(rotateBy).concat(slots.slice(0, rotateBy));

  if (slotType === "today") return rotated.slice(0, 6);
  if (slotType === "tomorrow") return rotated.slice(0, 8);
  return rotated.slice(0, 12);
}

function normalizePostal(p: string) {
  return p.toUpperCase().replace(/\s+/g, "").slice(0, 6);
}

function isValidPostal(p: string) {
  return normalizePostal(p).length >= 3;
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function prettyKm(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const toneCls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : tone === "red"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-slate-50 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${toneCls}`}>
      {children}
    </span>
  );
}

function Field({
  label,
  hint,
  icon: Icon,
  error,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ComponentType<any>;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
          <label className="text-sm font-semibold text-slate-800">{label}</label>
        </div>
        {hint ? (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Info className="h-3.5 w-3.5" />
            <span>{hint}</span>
          </div>
        ) : null}
      </div>

      {children}

      <AnimatePresence>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SkeletonSlots() {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <Clock className="h-4 w-4" />
        <span>Chargement des créneaux disponibles…</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function Combobox({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  options,
  allowManual = true,
  error,
  hint,
  onPick,
  emptyLabel = "Aucun résultat",
}: {
  label: string;
  icon?: React.ComponentType<any>;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allowManual?: boolean;
  error?: string;
  hint?: string;
  onPick?: (v: string) => void;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const boxRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options
      .filter((o) => o.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, options]);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const el = boxRef.current;
      if (!el) return;
      if (!el.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function commit(v: string) {
    onChange(v);
    onPick?.(v);
    setOpen(false);
  }

  return (
    <div ref={boxRef}>
      <Field label={label} icon={Icon} error={error} hint={hint}>
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                if (allowManual) onChange(e.target.value);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
            />
          </div>

          <AnimatePresence>
            {open ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
              >
                {filtered.length ? (
                  <div className="max-h-64 overflow-auto p-2">
                    {filtered.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => commit(o)}
                        className={
                          "w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-50 " +
                          (o === value ? "bg-slate-900 text-white hover:bg-slate-900" : "text-slate-900")
                        }
                      >
                        {o}
                      </button>
                    ))}
                    {allowManual ? (
                      <div className="mt-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-600">
                        Pas dans la liste ? Vous pouvez écrire manuellement.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-slate-600">{emptyLabel}</div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </Field>
    </div>
  );
}

type Step = 0 | 1 | 2 | 3 | 4 | 5;

type Errors = Partial<
  Record<
    | "year"
    | "make"
    | "model"
    | "km"
    | "drivable"
    | "postal"
    | "slot"
    | "name"
    | "phone"
    | "email"
    | "address"
    | "terms"
    | "inspection",
    string
  >
>;

export default function AutoValeurWidget() {
  const [step, setStep] = useState<Step>(0);

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vin, setVin] = useState("");
  const [km, setKm] = useState<number>(120000);

  const [drivable, setDrivable] = useState<"oui" | "non">("oui");

  const [postal, setPostal] = useState("");
  const [slotType, setSlotType] = useState<SlotType>("today");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [payPref, setPayPref] = useState<"interac" | "cash">("interac");

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [inspectionAccepted, setInspectionAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [stageKey, setStageKey] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const refYear = useRef<HTMLDivElement | null>(null);
  const refMake = useRef<HTMLDivElement | null>(null);
  const refModel = useRef<HTMLDivElement | null>(null);
  const refKm = useRef<HTMLDivElement | null>(null);
  const refPostal = useRef<HTMLDivElement | null>(null);
  const refSlots = useRef<HTMLDivElement | null>(null);
  const refName = useRef<HTMLDivElement | null>(null);
  const refPhone = useRef<HTMLDivElement | null>(null);
  const refEmail = useRef<HTMLDivElement | null>(null);
  const refAddress = useRef<HTMLDivElement | null>(null);
  const refTerms = useRef<HTMLDivElement | null>(null);
  const refInspection = useRef<HTMLDivElement | null>(null);

  const canComputeSlots = useMemo(() => isValidPostal(postal), [postal]);

  const vehicleLabel = useMemo(() => [year, make, model].filter(Boolean).join(" "), [year, make, model]);

  const upTo = useMemo(() => {
    const y = parseInt(year || String(CURRENT_YEAR - 8), 10);
    const age = clamp(CURRENT_YEAR - y, 0, 20);
    const base = 22000 - age * 900;
    const mk = (make?.length || 4) * 130;
    const md = (model?.length || 5) * 90;

    const mileagePenalty = clamp((km - 140000) / 9000, -6, 10) * 110;
    const drivableAdj = drivable === "non" ? -1800 : 0;

    const ura = base + mk + md - mileagePenalty;
    const ubo = ura - 4200 - 2000 - 900 + drivableAdj;

    const rounded = Math.round(clamp(ubo, 1200, 65000) / 500) * 500;
    return rounded;
  }, [year, make, model, km, drivable]);

  const comparison = useMemo(() => {
    const seed = normalizePostal(postal || "H2X")
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0);
    const autoValeur = clamp(72 + (seed % 17), 70, 90);
    const prive = clamp(autoValeur - 18, 40, 70);
    const dealer = clamp(prive - 18, 20, 55);
    return { dealer, prive, autoValeur };
  }, [postal]);

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

  function validateStep(currentStep: Step): Errors {
    const e: Errors = {};

    if (currentStep >= 1) {
      if (!year) e.year = "Choisissez une année.";
      if (!make.trim()) e.make = "Choisissez une marque (ou écrivez-la).";
      if (!model.trim()) e.model = "Choisissez un modèle (ou écrivez-le).";
      if (km === null || km === undefined || km < 0) e.km = "Indiquez le kilométrage.";
    }

    if (currentStep >= 2) {
      if (!drivable) e.drivable = "Choisissez si le véhicule roule.";
    }

    if (currentStep >= 4) {
      if (!isValidPostal(postal)) e.postal = "Entrez un code postal (au moins 3 caractères).";
      if (isValidPostal(postal) && !selectedSlotId) e.slot = "Choisissez une heure d'arrivée.";
    }

    if (currentStep >= 5) {
      if (!name.trim()) e.name = "Entrez votre nom.";
      if (!phone.trim()) e.phone = "Entrez votre téléphone.";
      if (!email.trim()) e.email = "Entrez votre courriel.";
      else if (!isValidEmail(email)) e.email = "Courriel invalide.";
      if (!address.trim()) e.address = "Entrez votre adresse complète.";

      if (!termsAccepted) e.terms = "Veuillez accepter les conditions et la politique de confidentialité.";
      if (!inspectionAccepted) e.inspection = "Veuillez accepter la vérification sur place.";
    }

    return e;
  }

  function firstErrorRef(e: Errors): React.RefObject<HTMLDivElement> | null {
    if (e.year) return refYear;
    if (e.make) return refMake;
    if (e.model) return refModel;
    if (e.km) return refKm;
    if (e.postal) return refPostal;
    if (e.slot) return refSlots;
    if (e.name) return refName;
    if (e.phone) return refPhone;
    if (e.email) return refEmail;
    if (e.address) return refAddress;
    if (e.terms) return refTerms;
    if (e.inspection) return refInspection;
    return null;
  }

  async function magicNavigate(nextStep: Step) {
    setTransitioning(true);
    await new Promise((r) => setTimeout(r, 260));
    setStep(nextStep);
    setStageKey((k) => k + 1);
    await new Promise((r) => setTimeout(r, 360));
    setTransitioning(false);

    window.setTimeout(() => {
      if (nextStep === 4) scrollToRef(refPostal);
      if (nextStep === 5) scrollToRef(refName);
    }, 120);
  }

  function goNext() {
    const nextStep = clamp(step + 1, 0, 5) as Step;

    const e = validateStep(step);
    setErrors(e);

    const blocking =
      (step === 1 && (e.year || e.make || e.model || e.km)) ||
      (step === 2 && e.drivable) ||
      (step === 4 && (e.postal || e.slot));

    if (blocking) {
      const r = firstErrorRef(e);
      if (r) scrollToRef(r);
      return;
    }

    magicNavigate(nextStep);
  }

  function goBack() {
    setErrors({});
    const prev = clamp(step - 1, 0, 5) as Step;
    magicNavigate(prev);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateStep(5);
    setErrors(v);

    if (Object.keys(v).length) {
      const r = firstErrorRef(v);
      if (r) scrollToRef(r);
      return;
    }

    try {
      setSubmitting(true);

      const leadData = {
        vehicle_year: year,
        vehicle_make: make,
        vehicle_model: model,
        vin: vin,
        km: km,
        drivable: drivable === 'oui',
        up_to: upTo,
        postal_code: postal,
        slot_type: slotType,
        selected_slot_id: selectedSlotId,
        selected_slot_datetime: selectedSlot?.start.toISOString() || '',
        client_name: name,
        client_phone: phone,
        client_email: email,
        client_address: address,
        payment_preference: payPref,
        terms_accepted: termsAccepted,
        inspection_accepted: inspectionAccepted,
        marketing_opt_in: marketingOptIn,
      };

      await submitLead(leadData);
      setSubmitted(true);
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSlot = useMemo(() => slots.find((s) => s.id === selectedSlotId) || null, [slots, selectedSlotId]);
  const modelsForMake = useMemo(() => MODELS_BY_MAKE[make] || [], [make]);

  const primaryCtaLabel = useMemo(() => {
    if (step === 0) return "Commencer";
    if (step === 3) return "Choisir mon créneau d'évaluation gratuite";
    if (step === 4) return "Continuer";
    if (step === 5) return submitting ? "Envoi en cours..." : "Réserver l'évaluation gratuite à domicile";
    return "Continuer";
  }, [step, submitting]);

  const helperText = useMemo(() => {
    if (step === 0) return "60 secondes • Sans obligation";
    if (step === 1) return "Détails du véhicule";
    if (step === 2) return "État du véhicule";
    if (step === 3) return "Votre estimation AutoValeur";
    if (step === 4) return "Choisir une plage horaire";
    if (step === 5) return "Infos + consentements";
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
                    <VehicleStep
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
                      modelsForMake={modelsForMake}
                      errors={errors}
                      setErrors={setErrors}
                      refYear={refYear}
                      refMake={refMake}
                      refModel={refModel}
                      refKm={refKm}
                    />
                  )}
                  {step === 2 && (
                    <EtatStep drivable={drivable} setDrivable={setDrivable} errors={errors} setErrors={setErrors} />
                  )}
                  {step === 3 && <PriceStep upTo={upTo} comparison={comparison} />}
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
                    <BookingStep
                      submitted={submitted}
                      vehicleLabel={vehicleLabel}
                      km={km}
                      upTo={upTo}
                      selectedSlot={selectedSlot}
                      payPref={payPref}
                      address={address}
                      name={name}
                      setName={setName}
                      phone={phone}
                      setPhone={setPhone}
                      email={email}
                      setEmail={setEmail}
                      setAddress={setAddress}
                      setPayPref={setPayPref}
                      termsAccepted={termsAccepted}
                      setTermsAccepted={setTermsAccepted}
                      inspectionAccepted={inspectionAccepted}
                      setInspectionAccepted={setInspectionAccepted}
                      marketingOptIn={marketingOptIn}
                      setMarketingOptIn={setMarketingOptIn}
                      errors={errors}
                      setErrors={setErrors}
                      refName={refName}
                      refPhone={refPhone}
                      refEmail={refEmail}
                      refAddress={refAddress}
                      refTerms={refTerms}
                      refInspection={refInspection}
                      drivable={drivable}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <ActionBar
                step={step}
                transitioning={transitioning}
                submitted={submitted}
                submitting={submitting}
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

function IntroStep() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 sm:p-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <Sparkles className="h-4 w-4" />
        Expérience premium • ~60 secondes
      </div>

      <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        Vendez votre auto — simplement, rapidement
      </div>
      <div className="mt-2 max-w-2xl text-sm text-slate-600">
        Donnez quelques détails, découvrez votre estimation <span className="font-semibold">AutoValeur</span>,
        puis réservez une visite gratuite à domicile pour confirmer l'offre.
      </div>

      <div className="mt-6 grid gap-3">
        {[
          {
            icon: BadgeCheck,
            title: "Estimation instantanée",
            desc: "On affiche une estimation optimiste (« jusqu'à ») en quelques secondes.",
          },
          {
            icon: CalendarClock,
            title: "Créneaux réalistes",
            desc: "Choisissez une plage horaire (semaine 9h–17h).",
          },
          {
            icon: Banknote,
            title: "Paiement sur place",
            desc: "Comptant ou virement Interac, selon votre préférence.",
          },
        ].map((row) => (
          <div
            key={row.title}
            className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-inset ring-slate-200"
          >
            <div className="mt-0.5 rounded-2xl bg-slate-900 p-2 text-white">
              <row.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900">{row.title}</div>
              <div className="mt-1 text-sm text-slate-600">{row.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 text-slate-600" />
          <div className="text-sm text-slate-700">
            L'estimation affichée est un <span className="font-semibold">"jusqu'à"</span>. Le montant final est confirmé
            après vérification sur place (état + kilométrage).
          </div>
        </div>
      </div>
    </div>
  );
}

function VehicleStep({
  year,
  setYear,
  make,
  setMake,
  model,
  setModel,
  vin,
  setVin,
  km,
  setKm,
  modelsForMake,
  errors,
  setErrors,
  refYear,
  refMake,
  refModel,
  refKm,
}: any) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <div ref={refYear}>
          <Field label="Année" icon={Car} error={errors.year}>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setErrors((p: any) => ({ ...p, year: undefined }));
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
            >
              <option value="">Choisir</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div ref={refMake}>
          <Combobox
            label="Marque"
            icon={Car}
            value={make}
            onChange={(v) => {
              setMake(v);
              setErrors((p: any) => ({ ...p, make: undefined, model: undefined }));
              if (v !== make) setModel("");
            }}
            options={MAKES}
            placeholder="Chercher une marque (ex: Toyota)"
            hint="Liste contrôlée + saisie manuelle possible"
            error={errors.make}
            onPick={(v) => {
              setMake(v);
              setModel("");
            }}
          />
        </div>

        <div ref={refModel}>
          <Combobox
            label="Modèle"
            icon={Car}
            value={model}
            onChange={(v) => {
              setModel(v);
              setErrors((p: any) => ({ ...p, model: undefined }));
            }}
            options={modelsForMake.length ? modelsForMake : ["(Choisissez d'abord une marque)"]}
            placeholder={make ? "Chercher un modèle (ex: RAV4)" : "Choisissez d'abord une marque"}
            hint={make ? "Liste contrôlée + saisie manuelle possible" : "Sélectionnez une marque"}
            error={errors.model}
            allowManual={!!make}
            emptyLabel={make ? "Aucun modèle trouvé — écrivez-le manuellement" : "Choisissez une marque"}
          />
        </div>
      </div>

      <div ref={refKm}>
        <Field label="Kilométrage (approx.)" hint="Glissez pour arrondir" icon={Hash} error={errors.km}>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">{prettyKm(km)} km</div>
              <Badge>{km <= 80000 ? "Bas" : km <= 160000 ? "Moyen" : "Élevé"}</Badge>
            </div>
            <input
              type="range"
              min={0}
              max={350000}
              step={5000}
              value={km}
              onChange={(e) => {
                setKm(parseInt(e.target.value, 10));
                setErrors((p: any) => ({ ...p, km: undefined }));
              }}
              className="mt-3 w-full"
            />
            <div className="mt-2 flex justify-between text-[11px] text-slate-500">
              <span>0</span>
              <span>175k</span>
              <span>350k</span>
            </div>
          </div>
        </Field>
      </div>

      <Field label="VIN (optionnel)" hint="Accélère certaines vérifications" icon={Hash}>
        <input
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          placeholder="17 caractères (optionnel)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
          autoComplete="off"
        />
        <p className="mt-2 text-xs text-slate-500">
          Optionnel. Utilisé uniquement pour confirmer certains détails (ex: caractéristiques). Pas obligatoire.
        </p>
      </Field>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-700" />
          <div>
            <div className="text-sm font-semibold text-slate-900">Données propres = meilleure estimation</div>
            <div className="mt-1 text-sm text-slate-600">
              On contrôle marque/modèle pour optimiser la précision et la rapidité du processus.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EtatStep({ drivable, setDrivable, errors, setErrors }: any) {
  return (
    <div className="grid gap-5">
      <Field label="Le véhicule peut-il rouler ?" icon={Car} error={errors.drivable}>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setDrivable("oui");
              setErrors((p: any) => ({ ...p, drivable: undefined }));
            }}
            className={
              "rounded-2xl border p-4 text-left shadow-sm transition " +
              (drivable === "oui"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:shadow-md")
            }
          >
            <div className="text-sm font-semibold">Oui, il roule</div>
            <div className={"mt-1 text-xs " + (drivable === "oui" ? "text-white/80" : "text-slate-600")}>
              Évaluation standard, paiement rapide
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setDrivable("non");
              setErrors((p: any) => ({ ...p, drivable: undefined }));
            }}
            className={
              "rounded-2xl border p-4 text-left shadow-sm transition " +
              (drivable === "non"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:shadow-md")
            }
          >
            <div className="text-sm font-semibold">Non, il ne roule pas</div>
            <div className={"mt-1 text-xs " + (drivable === "non" ? "text-white/80" : "text-slate-600")}>
              On peut quand même évaluer — selon le cas
            </div>
          </button>
        </div>
      </Field>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-600">Prochaine étape</div>
            <div className="mt-1 text-sm font-bold text-slate-900">On vous dévoile votre estimation AutoValeur.</div>
            <div className="mt-1 text-xs text-slate-500">Le montant final sera confirmé après vérification sur place.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Visite gratuite</Badge>
            <Badge>Sans obligation</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceStep({ upTo, comparison }: any) {
  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 sm:p-7">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Sparkles className="h-4 w-4" />
          Primeur • Estimation AutoValeur
        </div>

        <div className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          Bonne nouvelle — votre estimation est prête
        </div>
        <div className="mt-2 text-sm text-slate-600">
          Basée sur vos informations et le marché actuel (dans votre région).
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold text-slate-600">Votre estimation (optimiste)</div>
          <div className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Jusqu'à {formatCad(upTo)}
          </div>
          <div className="mt-2 text-sm text-slate-700">
            Paiement possible le jour même — <span className="font-semibold">comptant</span> ou{" "}
            <span className="font-semibold">virement Interac</span>.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="green">Sans obligation</Badge>
            <Badge tone="green">Visite gratuite</Badge>
            <Badge tone="amber">Très demandé</Badge>
            <Badge>Données sécurisées</Badge>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 text-slate-600" />
              <div className="text-sm text-slate-700">
                Le montant final est confirmé après vérification sur place (état réel + kilométrage).
                Vous êtes libre d'accepter ou de refuser.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <Scale className="h-5 w-5" />
            Comment ça se situe ?
          </div>
          <div className="mt-2 text-sm text-slate-600">
            Comparaison indicative — chaque offre dépend du véhicule et de son état réel.
          </div>

          <div className="mt-4 space-y-3">
            {[
              { label: "Reprise concession", value: comparison.dealer, note: "Souvent plus bas" },
              { label: "Vente privée", value: comparison.prive, note: "Plus élevé, mais plus long/risqué" },
              { label: "AutoValeur", value: comparison.autoValeur, note: "Rapide, sécurisé", strong: true },
            ].map((row) => (
              <div key={row.label} className="grid gap-2">
                <div className="flex items-center justify-between text-xs">
                  <div className={"font-semibold " + (row.strong ? "text-slate-900" : "text-slate-700")}>
                    {row.label} {row.strong ? "✅" : ""}
                  </div>
                  <div className="text-slate-500">{row.note}</div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
                  <div
                    className={"h-2.5 rounded-full " + (row.strong ? "bg-slate-900" : "bg-slate-400")}
                    style={{ width: `${row.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-slate-500">
            *Comparaison indicative — ne constitue pas une offre ferme.
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotsStep({
  postal,
  setPostal,
  slotType,
  setSlotType,
  canComputeSlots,
  slotsLoading,
  slots,
  selectedSlotId,
  setSelectedSlotId,
  errors,
  setErrors,
  refPostal,
  refSlots,
}: any) {
  return (
    <div className="grid gap-5">
      <div ref={refPostal}>
        <Field
          label="Code postal"
          hint="Obligatoire pour déverrouiller les créneaux"
          icon={MapPin}
          error={errors.postal}
        >
          <input
            value={postal}
            onChange={(e) => {
              const next = e.target.value.toUpperCase();
              setPostal(next);
              setErrors((p: any) => ({ ...p, postal: undefined, slot: undefined }));
            }}
            placeholder="Ex: H2X 1Y4"
            inputMode="text"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
            autoComplete="postal-code"
          />
          <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
            <span className="font-semibold">Important :</span> entrez votre code postal d'abord. Ensuite, les disponibilités
            se chargent automatiquement (2–5 secondes).
          </div>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { id: "today" as const, title: "Aujourd'hui", sub: "Disponibilité limitée", badge: "Rapide", tone: "green" as const },
          { id: "tomorrow" as const, title: "Demain", sub: "Très demandé", badge: "Populaire", tone: "amber" as const },
          { id: "week" as const, title: "Cette semaine", sub: "Plusieurs options", badge: "Flexible", tone: "neutral" as const },
        ].map((card) => {
          const selected = slotType === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setSlotType(card.id)}
              className={
                "group w-full rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md " +
                (selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={"text-sm font-semibold " + (selected ? "text-white" : "text-slate-900")}>
                    {card.title}
                  </div>
                  <div className={"mt-1 text-xs " + (selected ? "text-white/80" : "text-slate-600")}>
                    {card.sub}
                  </div>
                </div>
                <div className="shrink-0">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset " +
                      (selected
                        ? "bg-white/15 text-white ring-white/20"
                        : card.tone === "green"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : card.tone === "amber"
                        ? "bg-amber-50 text-amber-700 ring-amber-200"
                        : "bg-slate-50 text-slate-700 ring-slate-200")
                    }
                  >
                    {card.badge}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <CalendarClock className={"h-4 w-4 " + (selected ? "text-white/80" : "text-slate-500")} />
                <span className={selected ? "text-white/80" : "text-slate-600"}>Heures: 9h à 17h (semaine)</span>
              </div>
            </button>
          );
        })}
      </div>

      <div
        ref={refSlots}
        className={
          "rounded-2xl border bg-white p-4 transition " +
          (canComputeSlots ? "border-slate-200" : "border-slate-200 opacity-60")
        }
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-600">Créneau d'arrivée</div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              {canComputeSlots
                ? selectedSlotId && slots.find((s: any) => s.id === selectedSlotId)?.label
                  ? slots.find((s: any) => s.id === selectedSlotId)?.label
                  : "Choisissez un créneau"
                : "🔒 Déverrouillez en entrant votre code postal"}
            </div>
            <div className="mt-1 text-xs text-slate-500">Heures: 9:00 AM à 5:00 PM (semaine seulement).</div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-2">
            <Badge tone="green">Gratuit</Badge>
            <Badge tone="amber">Confirmation sur place</Badge>
          </div>
        </div>

        <AnimatePresence>
          {errors.slot ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
            >
              {errors.slot}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {canComputeSlots ? (
          slotsLoading ? (
            <SkeletonSlots />
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {slots.map((s: any) => {
                const selected = s.id === selectedSlotId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSlotId(s.id);
                      setErrors((p: any) => ({ ...p, slot: undefined }));
                    }}
                    className={
                      "rounded-2xl border px-3 py-3 text-left text-sm font-semibold shadow-sm transition " +
                      (selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:shadow-md")
                    }
                  >
                    <div className={selected ? "text-white" : "text-slate-900"}>{s.label}</div>
                    <div className={"mt-1 flex items-center gap-2 text-xs " + (selected ? "text-white/80" : "text-slate-600")}>
                      <Clock className="h-4 w-4" />
                      <span>Arrivée prévue</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Entrez votre code postal pour afficher des créneaux.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 text-slate-700" />
          <div className="w-full">
            <div className="text-sm font-semibold text-slate-900">Aucune plage ne vous convient ?</div>
            <div className="mt-1 text-sm text-slate-600">
              Contactez-nous — réponse instantanée ou rappel en <span className="font-semibold">15 minutes</span>.
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <a
                href="tel:5141234567"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 ring-1 ring-inset ring-slate-200 hover:shadow-sm"
              >
                <Phone className="h-4 w-4" />
                514-123-4567
              </a>
              <a
                href="mailto:info@autovaleur.ca"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 ring-1 ring-inset ring-slate-200 hover:shadow-sm"
              >
                <Mail className="h-4 w-4" />
                info@autovaleur.ca
              </a>
              <button
                type="button"
                onClick={() => alert("Chat: branchez votre widget (Intercom, Crisp, Tawk, etc.).")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:shadow-md"
              >
                <MessageCircle className="h-4 w-4" />
                Démarrer un chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingStep({
  submitted,
  vehicleLabel,
  km,
  upTo,
  selectedSlot,
  payPref,
  address,
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail,
  setAddress,
  setPayPref,
  termsAccepted,
  setTermsAccepted,
  inspectionAccepted,
  setInspectionAccepted,
  marketingOptIn,
  setMarketingOptIn,
  errors,
  setErrors,
  refName,
  refPhone,
  refEmail,
  refAddress,
  refTerms,
  refInspection,
  drivable,
}: any) {
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
                  <div className="font-semibold">Jusqu'à {formatCad(upTo)}</div>
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
                  <a className="font-bold underline" href="tel:5141234567">
                    514-123-4567
                  </a>{" "}
                  ou écrivez à{" "}
                  <a className="font-bold underline" href="mailto:info@autovaleur.ca">
                    info@autovaleur.ca
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
      <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-600">Votre estimation</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Jusqu'à {formatCad(upTo)}
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div ref={refName}>
          <Field label="Nom" icon={ShieldCheck} error={errors.name}>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((p: any) => ({ ...p, name: undefined }));
              }}
              placeholder="Votre nom"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
              autoComplete="name"
            />
          </Field>
        </div>

        <div ref={refPhone}>
          <Field label="Téléphone" icon={Phone} error={errors.phone}>
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setErrors((p: any) => ({ ...p, phone: undefined }));
              }}
              placeholder="Ex: 514-555-1234"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>
        </div>
      </div>

      <div ref={refEmail}>
        <Field label="Courriel" icon={Mail} error={errors.email}>
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((p: any) => ({ ...p, email: undefined }));
            }}
            placeholder="Ex: vous@email.com"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
            inputMode="email"
            autoComplete="email"
          />
        </Field>
      </div>

      <div ref={refAddress}>
        <Field
          label="Adresse complète"
          icon={MapPin}
          error={errors.address}
          hint="Autocomplete possible (à brancher Google Places si voulu)"
        >
          <input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setErrors((p: any) => ({ ...p, address: undefined }));
            }}
            placeholder="Numéro, rue, ville"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
            autoComplete="street-address"
          />
          <div className="mt-2 text-xs text-slate-500">
            Astuce: sur mobile, le clavier confirme souvent l'adresse plus vite grâce à l'autocomplete du navigateur.
          </div>
        </Field>
      </div>

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
            <div className="text-sm font-extrabold text-slate-900">Consentements</div>
            <div className="mt-1 text-sm text-slate-600">
              Obligatoires pour réserver. Clair, simple, sans piège.
            </div>
          </div>
          <Badge>Données sécurisées</Badge>
        </div>

        <div className="mt-5 grid gap-3">
          <div ref={refTerms} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  setErrors((p: any) => ({ ...p, terms: undefined }));
                }}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <div className="w-full">
                <div className="text-sm font-semibold text-slate-900">
                  J'accepte les conditions & la politique de confidentialité <span className="text-rose-600">*</span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Utilisation des données uniquement pour traiter votre demande et vous contacter.
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href="#"
                    onClick={(ev) => {
                      ev.preventDefault();
                      alert("Lien à brancher: Conditions d'utilisation");
                    }}
                    className="text-xs font-bold text-slate-900 underline"
                  >
                    Lire les conditions
                  </a>
                  <a
                    href="#"
                    onClick={(ev) => {
                      ev.preventDefault();
                      alert("Lien à brancher: Politique de confidentialité");
                    }}
                    className="text-xs font-bold text-slate-900 underline"
                  >
                    Lire la politique
                  </a>
                </div>
              </div>
            </label>

            <AnimatePresence>
              {errors.terms ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
                >
                  {errors.terms}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div ref={refInspection} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={inspectionAccepted}
                onChange={(e) => {
                  setInspectionAccepted(e.target.checked);
                  setErrors((p: any) => ({ ...p, inspection: undefined }));
                }}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <div className="w-full">
                <div className="text-sm font-semibold text-slate-900">
                  J'accepte la vérification sur place (état + kilométrage) <span className="text-rose-600">*</span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  L'estimation affichée est un "jusqu'à". Le montant final est confirmé après inspection gratuite à
                  domicile.
                </div>
              </div>
            </label>

            <AnimatePresence>
              {errors.inspection ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
                >
                  {errors.inspection}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

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
            <div className="mt-1 text-xl font-extrabold text-slate-900">Jusqu'à {formatCad(upTo)}</div>
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
              <a className="font-bold underline" href="tel:5141234567">
                514-123-4567
              </a>
              .
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ActionBar({ step, transitioning, submitted, submitting, goBack, goNext, primaryCtaLabel, helperText, canComputeSlots }: any) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0 || transitioning || submitted}
              className={
                "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold ring-1 ring-inset transition " +
                (step === 0 || transitioning || submitted
                  ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-slate-200"
                  : "bg-white text-slate-900 ring-slate-200 hover:shadow-sm")
              }
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </button>

            <div className="sm:hidden text-right">
              <div className="text-[11px] font-semibold text-slate-500">Étape</div>
              <div className="text-sm font-extrabold text-slate-900">{step + 1}/6</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-slate-600">{helperText}</div>
              <div className="text-[11px] text-slate-500">
                {step === 0
                  ? "Sans obligation"
                  : step === 3
                  ? "Votre estimation est prête"
                  : step === 4
                  ? canComputeSlots
                    ? "Sélectionnez un créneau"
                    : "Entrez votre code postal"
                  : step === 5
                  ? "Vérifiez vos infos"
                  : "Continuez"}
              </div>
            </div>

            {step === 5 ? (
              <button
                type="submit"
                disabled={transitioning || submitted || submitting}
                className={
                  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition " +
                  (transitioning || submitted || submitting ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:shadow-md")
                }
              >
                <CheckCircle2 className="h-5 w-5" />
                {primaryCtaLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={transitioning || submitted}
                className={
                  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition " +
                  (transitioning || submitted ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:shadow-md")
                }
              >
                {primaryCtaLabel}
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {step === 5 && !submitted ? (
          <div className="mt-2 text-[11px] text-slate-500">
            En réservant, vous confirmez vos consentements. Aucun frais. Vous pouvez refuser l'offre après la visite.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {[
        { icon: ShieldCheck, title: "Sécurisé", desc: "HTTPS, données minimales, usage limité." },
        { icon: CalendarClock, title: "Rapide", desc: "Réservation en ligne, visite gratuite." },
        { icon: BadgeCheck, title: "Sans pression", desc: "Vous décidez après inspection." },
      ].map((it) => (
        <div key={it.title} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-900 p-2 text-white">
              <it.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900">{it.title}</div>
              <div className="mt-1 text-sm text-slate-600">{it.desc}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
