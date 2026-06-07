import { ShieldCheck, CalendarClock, BadgeCheck } from "lucide-react";

export function Footer() {
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
