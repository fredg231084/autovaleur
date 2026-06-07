import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { Field } from "./Field";

export function Combobox({
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
  icon?: React.ComponentType<{ className?: string }>;
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
      if (!el.contains(e.target as Node)) setOpen(false);
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
