import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, CalendarClock, Clock, MessageCircle, Phone, Mail } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Field } from "../ui/Field";
import { SkeletonSlots } from "../ui/SkeletonSlots";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL, CONTACT_EMAIL } from "../../lib/constants";
import type { SlotType, TimeSlot } from "../../lib/slots";
import type { Errors } from "../../types";

export function SlotsStep({
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
}: {
  postal: string;
  setPostal: (v: string) => void;
  slotType: SlotType;
  setSlotType: (v: SlotType) => void;
  canComputeSlots: boolean;
  slotsLoading: boolean;
  slots: TimeSlot[];
  selectedSlotId: string;
  setSelectedSlotId: (v: string) => void;
  errors: Errors;
  setErrors: React.Dispatch<React.SetStateAction<Errors>>;
  refPostal: React.RefObject<HTMLDivElement>;
  refSlots: React.RefObject<HTMLDivElement>;
}) {
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
              setErrors((p) => ({ ...p, postal: undefined, slot: undefined }));
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
                ? selectedSlotId && slots.find((s) => s.id === selectedSlotId)?.label
                  ? slots.find((s) => s.id === selectedSlotId)?.label
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
              {slots.map((s) => {
                const selected = s.id === selectedSlotId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSlotId(s.id);
                      setErrors((p) => ({ ...p, slot: undefined }));
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

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <a
                href={`tel:${CONTACT_PHONE_TEL}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 ring-1 ring-inset ring-slate-200 hover:shadow-sm"
              >
                <Phone className="h-4 w-4" />
                {CONTACT_PHONE_DISPLAY}
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 ring-1 ring-inset ring-slate-200 hover:shadow-sm"
              >
                <Mail className="h-4 w-4" />
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
