import { Sparkles, BadgeCheck, CalendarClock, Banknote, Info } from "lucide-react";

export function IntroStep() {
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
            title: "Estimation réelle",
            desc: "Basée sur notre table de prix du marché québécois — pas un chiffre inventé.",
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
            L'estimation affichée est une fourchette. Le montant final est confirmé
            après vérification sur place (état + kilométrage).
          </div>
        </div>
      </div>
    </div>
  );
}
