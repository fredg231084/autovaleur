import React from "react";
import { Car, Hash, ShieldCheck } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Field } from "../ui/Field";
import { Combobox } from "../ui/Combobox";
import { prettyKm } from "../../lib/format";
import { MAKES, YEARS } from "../../lib/vehicles";
import type { Errors } from "../../types";

export function CarDetailsStep({
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
  drivable,
  setDrivable,
  modelsForMake,
  errors,
  setErrors,
  refYear,
  refMake,
  refModel,
  refKm,
  refDrivable,
}: {
  year: string;
  setYear: (v: string) => void;
  make: string;
  setMake: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  vin: string;
  setVin: (v: string) => void;
  km: number;
  setKm: (v: number) => void;
  drivable: "oui" | "non";
  setDrivable: (v: "oui" | "non") => void;
  modelsForMake: string[];
  errors: Errors;
  setErrors: React.Dispatch<React.SetStateAction<Errors>>;
  refYear: React.RefObject<HTMLDivElement>;
  refMake: React.RefObject<HTMLDivElement>;
  refModel: React.RefObject<HTMLDivElement>;
  refKm: React.RefObject<HTMLDivElement>;
  refDrivable: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <div ref={refYear}>
          <Field label="Année" icon={Car} error={errors.year}>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setErrors((p) => ({ ...p, year: undefined }));
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
              setErrors((p) => ({ ...p, make: undefined, model: undefined }));
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
              setErrors((p) => ({ ...p, model: undefined }));
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
                setErrors((p) => ({ ...p, km: undefined }));
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

      <div ref={refDrivable}>
        <Field label="Le véhicule peut-il rouler ?" icon={Car} error={errors.drivable}>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setDrivable("oui");
                setErrors((p) => ({ ...p, drivable: undefined }));
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
                setErrors((p) => ({ ...p, drivable: undefined }));
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
      </div>

      <Field label="VIN (optionnel)" hint="Accélère certaines vérifications" icon={Hash}>
        <input
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          placeholder="17 caractères (optionnel)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-900/10 focus:ring-4"
          autoComplete="off"
        />
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
