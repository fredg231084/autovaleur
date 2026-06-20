import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { formatCad } from '../../lib/format';
import { fmtDate } from '../format';
import {
  fetchPricingConfig,
  fetchVehiclePrices,
  updatePricingConfig,
  upsertVehiclePrice,
  updateVehiclePrice,
  refreshStalePrices,
  isPriceStale,
  type PricingConfig,
  type PricingConfigPatch,
  type VehiclePrice,
} from '../pricing';
import { Pill, Spinner, ErrorNote, EmptyState } from '../ui';

function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {children}
    </div>
  );
}

// ---- One price row, with inline-editable market value ----
function PriceRow({
  p,
  staleDays,
  onSaved,
}: {
  p: VehiclePrice;
  staleDays: number;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(p.market_value));
  const [saving, setSaving] = useState(false);
  const stale = isPriceStale(p.priced_at, staleDays);

  async function save() {
    const n = parseInt(val.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(n) || n <= 0) {
      setVal(String(p.market_value));
      setEditing(false);
      return;
    }
    if (n === p.market_value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateVehiclePrice(p.id, n);
      onSaved();
    } catch {
      setVal(String(p.market_value));
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 font-medium capitalize text-slate-900">{p.make}</td>
      <td className="px-4 py-3 capitalize text-slate-700">{p.model}</td>
      <td className="px-4 py-3 tabular-nums text-slate-700">{p.year}</td>
      <td className="px-4 py-3">
        {editing ? (
          <input
            type="number"
            value={val}
            autoFocus
            disabled={saving}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
              if (e.key === 'Escape') {
                setVal(String(p.market_value));
                setEditing(false);
              }
            }}
            className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="rounded px-1 font-semibold tabular-nums text-slate-900 hover:bg-slate-100"
            title="Modifier"
          >
            {formatCad(p.market_value)}
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-400">{p.source}</td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
        <div className="flex items-center gap-2">
          {fmtDate(p.priced_at)}
          {stale && <Pill tone="rose">Périmé</Pill>}
        </div>
      </td>
    </tr>
  );
}

// ---- Add-a-car inline form ----
function AddCarForm({ onAdded }: { onAdded: () => void }) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const yearNum = parseInt(year, 10);
  const valueNum = parseInt(value.replace(/[^\d]/g, ''), 10);
  const valid =
    !!make.trim() &&
    !!model.trim() &&
    Number.isFinite(yearNum) &&
    yearNum > 1950 &&
    Number.isFinite(valueNum) &&
    valueNum > 0;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    try {
      await upsertVehiclePrice({ make, model, year: yearNum, market_value: valueNum });
      setMake('');
      setModel('');
      setYear('');
      setValue('');
      onAdded();
    } catch {
      setErr("Impossible d'ajouter ce véhicule.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Ajouter un véhicule
      </h2>
      <div className="flex flex-wrap items-end gap-2">
        <input className={`${inputClass} w-32`} placeholder="Marque" value={make} onChange={(e) => setMake(e.target.value)} />
        <input className={`${inputClass} w-36`} placeholder="Modèle" value={model} onChange={(e) => setModel(e.target.value)} />
        <input className={`${inputClass} w-24`} placeholder="Année" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
        <input className={`${inputClass} w-32`} placeholder="Valeur marché $" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
        <button
          onClick={() => void submit()}
          disabled={!valid || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {saving ? 'Ajout…' : 'Ajouter'}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
    </div>
  );
}

// ---- pricing_config knobs ----
const KNOBS: { key: keyof PricingConfigPatch; label: string; hint?: string; step: string }[] = [
  { key: 'buy_factor', label: "Facteur d'achat", hint: 'fraction de la valeur marché payée', step: '0.01' },
  { key: 'monthly_depreciation', label: 'Dépréciation mensuelle', hint: '0.010 ≈ 1 %/mois', step: '0.001' },
  { key: 'km_adjust_per_10k', label: 'Ajustement km / 10 000 km ($)', step: '50' },
  { key: 'expected_km_per_year', label: 'Km attendus par an', step: '1000' },
  { key: 'display_low_factor', label: 'Facteur affichage — bas', step: '0.01' },
  { key: 'display_high_factor', label: 'Facteur affichage — haut', step: '0.01' },
  { key: 'min_estimate', label: 'Estimation minimale ($)', step: '50' },
  { key: 'round_to', label: 'Arrondir à ($)', step: '50' },
  { key: 'stale_after_days', label: 'Périmé après (jours)', step: '10' },
];

function ConfigForm({ config, onSaved }: { config: PricingConfig; onSaved: () => void }) {
  const seed = useCallback(
    () => Object.fromEntries(KNOBS.map((k) => [k.key, String(config[k.key])])) as Record<string, string>,
    [config],
  );
  const [form, setForm] = useState<Record<string, string>>(seed);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setForm(seed());
  }, [seed]);

  async function save() {
    const patch: PricingConfigPatch = {};
    for (const k of KNOBS) {
      const n = parseFloat(form[k.key]);
      if (!Number.isFinite(n)) {
        setErr(`Valeur invalide : ${k.label}.`);
        return;
      }
      (patch[k.key] as number) = n;
    }
    setSaving(true);
    setErr(null);
    setDone(false);
    try {
      await updatePricingConfig(patch);
      setDone(true);
      onSaved();
    } catch {
      setErr('Impossible d’enregistrer la configuration.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">
        Configuration du moteur de prix
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        S’applique à toutes les estimations. Modifié le {fmtDate(config.updated_at)}.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KNOBS.map((k) => (
          <label key={k.key} className="block">
            <span className="text-xs font-semibold text-slate-600">{k.label}</span>
            {k.hint && <span className="block text-[11px] text-slate-400">{k.hint}</span>}
            <input
              type="number"
              step={k.step}
              value={form[k.key] ?? ''}
              onChange={(e) => {
                setForm((f) => ({ ...f, [k.key]: e.target.value }));
                setDone(false);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {done && <span className="text-sm font-medium text-emerald-600">Enregistré ✓</span>}
        {err && <span className="text-sm text-rose-600">{err}</span>}
      </div>
    </div>
  );
}

export function PrixScreen() {
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [prices, setPrices] = useState<VehiclePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [refreshErr, setRefreshErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, rows] = await Promise.all([fetchPricingConfig(), fetchVehiclePrices()]);
      setConfig(cfg);
      setPrices(rows);
    } catch {
      setError('Impossible de charger les prix.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    setRefreshMsg(null);
    setRefreshErr(null);
    try {
      const r = await refreshStalePrices();
      if (r.mode === 'auto') {
        const failed = Array.isArray(r.failures) ? r.failures.length : 0;
        setRefreshMsg(
          `${r.refreshed} prix re-évalués sur ${r.stale_count} périmés` +
            (failed ? ` · ${failed} échec(s)` : '') +
            '.',
        );
      } else if (r.mode === 'list') {
        setRefreshMsg(
          r.stale_count === 0
            ? 'Aucun prix périmé.'
            : `${r.stale_count} prix périmé(s) à mettre à jour manuellement (voir badges ci-dessous).`,
        );
      } else {
        setRefreshMsg(`${r.upserted} prix mis à jour.`);
      }
      await load();
    } catch (e) {
      setRefreshErr(e instanceof Error ? e.message : 'Échec du rafraîchissement.');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) return <Spinner />;
  if (error || !config) return <ErrorNote>{error ?? 'Configuration introuvable.'}</ErrorNote>;

  const staleCount = prices.filter((p) => isPriceStale(p.priced_at, config.stale_after_days)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Prix</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {prices.length} véhicule(s) · {staleCount} périmé(s)
          </p>
        </div>
        <button
          onClick={() => void onRefresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Rafraîchissement…' : 'Rafraîchir les prix périmés'}
        </button>
      </div>

      {refreshMsg && <SuccessNote>{refreshMsg}</SuccessNote>}
      {refreshErr && <ErrorNote>{refreshErr}</ErrorNote>}

      <AddCarForm onAdded={() => void load()} />

      {prices.length === 0 ? (
        <EmptyState>Aucun prix enregistré. Ajoutez un véhicule ci-dessus.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Marque</th>
                <th className="px-4 py-3">Modèle</th>
                <th className="px-4 py-3">Année</th>
                <th className="px-4 py-3">Valeur marché</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Évalué le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prices.map((p) => (
                <PriceRow key={p.id} p={p} staleDays={config.stale_after_days} onSaved={() => void load()} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfigForm config={config} onSaved={() => void load()} />
    </div>
  );
}
