import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCad, prettyKm } from '../../lib/format';
import {
  fetchLeads,
  fetchLeadMetrics,
  updateLeadStatus,
  FUNNEL_STATUSES,
  STATUS_META,
  type LeadMetrics,
  type LeadRow,
  type LeadStatus,
} from '../leads';
import { MetricCard, Pill, Spinner, ErrorNote, EmptyState } from '../ui';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-CA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-CA', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

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

export function LeadsScreen() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, m] = await Promise.all([fetchLeads(), fetchLeadMetrics()]);
      setLeads(rows);
      setMetrics(m);
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

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <Spinner />
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
