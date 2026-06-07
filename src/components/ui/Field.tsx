import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";

export function Field({
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
