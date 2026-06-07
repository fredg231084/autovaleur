import { ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import type { Step } from "../types";

export function ActionBar({
  step,
  transitioning,
  submitted,
  submitting,
  busy,
  goBack,
  goNext,
  primaryCtaLabel,
  helperText,
  canComputeSlots,
}: {
  step: Step;
  transitioning: boolean;
  submitted: boolean;
  submitting: boolean;
  /** Async work in flight (e.g. gate creating the partial lead). */
  busy: boolean;
  goBack: () => void;
  goNext: () => void;
  primaryCtaLabel: string;
  helperText: string;
  canComputeSlots: boolean;
}) {
  const nextDisabled = transitioning || submitted || busy;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0 || transitioning || submitted || busy}
              className={
                "inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold ring-1 ring-inset transition " +
                (step === 0 || transitioning || submitted || busy
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
                  : step === 2
                  ? "Nom + téléphone — pour vous montrer le prix"
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
                disabled={nextDisabled}
                className={
                  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition " +
                  (nextDisabled ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:shadow-md")
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
