import { Clock } from "lucide-react";

export function SkeletonSlots() {
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
