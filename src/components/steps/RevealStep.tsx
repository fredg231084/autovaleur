import { Sparkles, Info, Phone } from "lucide-react";
import { Badge } from "../ui/Badge";
import { formatCad } from "../../lib/format";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "../../lib/constants";
import type { VehicleEstimate } from "../../lib/estimate";

/**
 * Reveals the real range from get_vehicle_estimate(). When the car isn't priced
 * yet (found === false) or the lookup failed (estimate === null), we fall back to
 * "on confirme par téléphone" — the PARTIAL lead already captured the car, so the
 * admin can price it from the unpriced-car queue (leads with up_to = null).
 */
export function RevealStep({
  estimate,
  estimateLoading,
}: {
  estimate: VehicleEstimate | null;
  estimateLoading: boolean;
}) {
  const found = !!estimate?.found;

  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 sm:p-7">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Sparkles className="h-4 w-4" />
          Estimation AutoValeur
        </div>

        {estimateLoading ? (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-4 w-40 rounded bg-slate-100" />
            <div className="mt-3 h-12 w-72 max-w-full animate-pulse rounded-2xl bg-slate-100" />
            <div className="mt-3 h-3 w-56 rounded bg-slate-100" />
          </div>
        ) : found ? (
          <>
            <div className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Votre estimation est prête
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Estimation basée sur le marché actuel — le prix final est confirmé à l'inspection.
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold text-slate-600">Fourchette estimée</div>
              <div className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                {formatCad(estimate!.low)} – {formatCad(estimate!.high)}
              </div>
              <div className="mt-2 text-sm text-slate-700">
                Paiement possible le jour même — <span className="font-semibold">comptant</span> ou{" "}
                <span className="font-semibold">virement Interac</span>.
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="green">Sans obligation</Badge>
                <Badge tone="green">Visite gratuite</Badge>
                <Badge>Données sécurisées</Badge>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 text-slate-600" />
                  <div className="text-sm text-slate-700">
                    Le prix final est confirmé après vérification sur place (état réel + kilométrage).
                    Vous êtes libre d'accepter ou de refuser.
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              On confirme votre prix par téléphone
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Votre véhicule demande une évaluation personnalisée. Un conseiller vous donne
              une fourchette précise — sans obligation.
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-700">
                Réservez quand même votre visite gratuite : on confirme l'estimation lors de
                l'appel de préparation, puis le prix final sur place.
              </div>
              <div className="mt-4">
                <a
                  href={`tel:${CONTACT_PHONE_TEL}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:shadow-md"
                >
                  <Phone className="h-4 w-4" />
                  Nous joindre : {CONTACT_PHONE_DISPLAY}
                </a>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="green">Sans obligation</Badge>
                <Badge tone="green">Visite gratuite</Badge>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
