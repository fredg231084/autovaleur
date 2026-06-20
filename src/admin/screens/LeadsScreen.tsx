import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag } from 'lucide-react';
import { formatCad, prettyKm } from '../../lib/format';
import { fmtDate, fmtDateTime } from '../format';
import {
  fetchLeads,
  fetchLeadMetrics,
  fetchUnpricedCars,
  updateLeadStatus,
  FUNNEL_STATUSES,
  STATUS_META,
  type LeadMetrics,
  type LeadRow,
  type LeadStatus,
  type UnpricedCar,
} from '../leads';
import { upsertVehiclePrice } from '../pricing';
import { MetricCard, Pill, Spinner, ErrorNote, EmptyState } from '../ui';

function StatusSelect({
  lead,
  onChanged,
}: {
  lead: LeadRow;
  onChanged: (id: string, next: LeadStatus) => void;
}) {
  const [saving, setSaving] = useState(false);
  // Always offer the funnel set; keep the current status visible even when it
  // isn't part of the funnel (e.g. PARTIAL, ASSIGNED).
  const options = FUNNEL_STATUSES.includes(lead.status)
    ? FUNNEL_STATUSES
    : [lead.status, ...FUNNEL_STATUSES];

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as LeadStatus;
    if (next === lead.status) return;
    const prev = lead.status;
    onChanged(lead.id, next); // optimistic
    setSaving(true);
    try {
      await updateLeadStatus(lead.id, prev, next);
    } catch {
      onChanged(lead.id, prev); // revert
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={lead.status}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      disabled={saving}
      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:border-slate-900 focus:outline-none disabled:opacity-50"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {STATUS_META[s].label}
        </option>
      ))}
    </select>
  );
}

// One row of the to-price queue, with an inline "price this car" action that
// upserts into vehicle_prices so the next estimate lookup for this car resolves.
function UnpricedRow({ car, onPriced }: { car: UnpricedCar; onPriced: () => void }) {
  const [pricing, setPricing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(false);

  const valueNum = parseInt(value.replace(/[^\d]/g, ''), 10);
  const valid = Number.isFinite(valueNum) && valueNum > 0;

  async function save() {
    if (!valid) return;
    setSaving(true);
    setErr(false);
    try {
      await upsertVehiclePrice({
        make: car.make,
        model: car.model,
        year: parseInt(car.year, 10),
        market_value: valueNum,
      });
      onPriced();
    } catch {
      setErr(true);
      setSaving(false);
    }
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-semibold capitalize text-slate-900">
          {car.year} {car.make} {car.model}
        </div>
        {err && <div className="text-xs text-rose-600">Échec de l’enregistrement.</div>}
      </td>
      <td className="px-4 py-3 tabular-nums text-slate-600">{car.count}</td>
      <td className="px-4 py-3 text-right">
        {pricing ? (
          <div className="inline-flex items-center gap-2">
            <input
              type="number"
              autoFocus
              inputMode="numeric"
              placeholder="Valeur marché $"
              value={value}
              disabled={saving}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void save();
                if (e.key === 'Escape') {
                  setPricing(false);
                  setValue('');
                }
              }}
              className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
            />
            <button
              onClick={() => void save()}
              disabled={!valid || saving}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? '…' : 'OK'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPricing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Tag className="h-4 w-4" /> Évaluer
          </button>
        )}
      </td>
    </tr>
  );
}

export function LeadsScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'unpriced'>('all');
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [unpriced, setUnpriced] = useState<UnpricedCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, m, cars] = await Promise.all([
        fetchLeads(),
        fetchLeadMetrics(),
        fetchUnpricedCars(),
      ]);
      setLeads(rows);
      setMetrics(m);
      setUnpriced(cars);
    } catch {
      setError('Impossible de charger les leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Local optimistic status patch (also nudges the relevant metric cards).
  function patchStatus(id: string, next: LeadStatus) {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: next } : l))
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Leads</h1>
        <button
          onClick={() => void load()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Rafraîchir
        </button>
      </div>

      {metrics && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Total" value={metrics.total} />
          <MetricCard label="Partiel" value={metrics.partial} tone="slate" />
          <MetricCard label="Nouveau" value={metrics.new} tone="blue" />
          <MetricCard label="Contacté" value={metrics.contacted} tone="amber" />
          <MetricCard label="Acheté" value={metrics.bought} tone="green" />
          <MetricCard label="Perdu" value={metrics.lost} tone="rose" />
        </div>
      )}

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm font-semibold shadow-sm">
        <button
          onClick={() => setTab('all')}
          className={`rounded-md px-3 py-1.5 ${tab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Tous les leads
        </button>
        <button
          onClick={() => setTab('unpriced')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === 'unpriced' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          À évaluer
          {unpriced.length > 0 && (
            <span
              className={`rounded-full px-1.5 text-xs ${tab === 'unpriced' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}
            >
              {unpriced.length}
            </span>
          )}
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <Spinner />
      ) : tab === 'unpriced' ? (
        unpriced.length === 0 ? (
          <EmptyState>Aucune voiture en attente d’évaluation.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Véhicule</th>
                  <th className="px-4 py-3">Leads en attente</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unpriced.map((car) => (
                  <UnpricedRow
                    key={`${car.make}|${car.model}|${car.year}`}
                    car={car}
                    onPriced={() => void load()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : leads.length === 0 ? (
        <EmptyState>Aucun lead pour le moment.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Véhicule</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">RDV</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Estimation</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => navigate(`/leads/${l.id}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {fmtDate(l.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">
                      {l.vehicle_year} {l.vehicle_make} {l.vehicle_model}
                    </div>
                    <div className="text-xs text-slate-500">
                      {prettyKm(l.km)} km · {l.drivable ? 'Roule' : 'Ne roule pas'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{l.client_name}</div>
                    <div className="text-xs text-slate-500">{l.client_phone}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {fmtDateTime(l.selected_slot_datetime)}
                    {l.postal_code ? (
                      <span className="block text-xs text-slate-400">{l.postal_code}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <div className="font-medium text-slate-700">{l.source_first}</div>
                    {l.campaign_first ? <div>{l.campaign_first}</div> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    {l.up_to ? formatCad(l.up_to) : <span className="text-slate-400">À confirmer</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l.status === 'PARTIAL' ? (
                      <div className="flex flex-col gap-1">
                        <Pill tone="slate">Partiel</Pill>
                        <StatusSelect lead={l} onChanged={patchStatus} />
                      </div>
                    ) : (
                      <StatusSelect lead={l} onChanged={patchStatus} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
