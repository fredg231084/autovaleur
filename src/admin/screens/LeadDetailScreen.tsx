import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatCad, prettyKm } from '../../lib/format';
import { fmtDate, fmtDateTime, fmtDateTimeLong } from '../format';
import {
  fetchLead,
  fetchLeadNotes,
  fetchStatusHistory,
  addLeadNote,
  updateLeadStatus,
  FUNNEL_STATUSES,
  STATUS_META,
  type LeadDetail,
  type LeadNote,
  type LeadStatus,
  type StatusHistoryEntry,
} from '../leads';
import { Pill, Spinner, ErrorNote } from '../ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value || '—'}</span>
    </div>
  );
}

const yesno = (b: boolean) => (b ? 'Oui' : 'Non');

export function LeadDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [l, n, h] = await Promise.all([
        fetchLead(id),
        fetchLeadNotes(id),
        fetchStatusHistory(id),
      ]);
      setLead(l);
      setNotes(n);
      setHistory(h);
    } catch {
      setError('Impossible de charger ce lead.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!lead) return;
    const next = e.target.value as LeadStatus;
    if (next === lead.status) return;
    const prev = lead.status;
    setLead({ ...lead, status: next });
    setSavingStatus(true);
    try {
      await updateLeadStatus(lead.id, prev, next);
      setHistory(await fetchStatusHistory(lead.id));
    } catch {
      setLead({ ...lead, status: prev });
    } finally {
      setSavingStatus(false);
    }
  }

  async function onAddNote() {
    if (!id || !noteText.trim()) return;
    setSavingNote(true);
    try {
      await addLeadNote(id, noteText.trim());
      setNoteText('');
      setNotes(await fetchLeadNotes(id));
    } catch {
      setError("Impossible d'ajouter la note.");
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) return <Spinner />;
  if (error && !lead) return <ErrorNote>{error}</ErrorNote>;
  if (!lead) return <ErrorNote>Lead introuvable.</ErrorNote>;

  const isPartial = lead.status === 'PARTIAL';
  const statusOptions = FUNNEL_STATUSES.includes(lead.status)
    ? FUNNEL_STATUSES
    : [lead.status, ...FUNNEL_STATUSES];

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Tous les leads
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {lead.vehicle_year} {lead.vehicle_make} {lead.vehicle_model}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span>Créé le {fmtDate(lead.created_at)}</span>
            <Pill tone={isPartial ? 'slate' : 'green'}>
              {isPartial ? 'Capture partielle' : 'Réservation complète'}
            </Pill>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">Statut</span>
          <select
            value={lead.status}
            onChange={onStatusChange}
            disabled={savingStatus}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:border-slate-900 focus:outline-none disabled:opacity-50"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Section title="Client">
            <Row label="Nom" value={lead.client_name} />
            <Row
              label="Téléphone"
              value={<a className="text-blue-600 hover:underline" href={`tel:${lead.client_phone}`}>{lead.client_phone}</a>}
            />
            <Row
              label="Courriel"
              value={lead.client_email ? <a className="text-blue-600 hover:underline" href={`mailto:${lead.client_email}`}>{lead.client_email}</a> : '—'}
            />
            <Row label="Adresse" value={lead.client_address} />
          </Section>

          <Section title="Véhicule">
            <Row label="Année / marque / modèle" value={`${lead.vehicle_year} ${lead.vehicle_make} ${lead.vehicle_model}`} />
            <Row label="VIN" value={lead.vin} />
            <Row label="Kilométrage" value={`${prettyKm(lead.km)} km`} />
            <Row label="État" value={lead.drivable ? 'Roule' : 'Ne roule pas'} />
          </Section>

          <Section title="Rendez-vous">
            <Row label="Date et heure" value={fmtDateTimeLong(lead.selected_slot_datetime)} />
            <Row label="Plage" value={lead.slot_type} />
            <Row label="Code postal" value={lead.postal_code} />
          </Section>

          <Section title="Estimation et paiement">
            <Row
              label="Estimation (serveur)"
              value={lead.up_to ? formatCad(lead.up_to) : 'À confirmer par téléphone'}
            />
            <Row
              label="Paiement préféré"
              value={lead.payment_preference === 'cash' ? 'Comptant' : lead.payment_preference === 'interac' ? 'Virement Interac' : '—'}
            />
          </Section>

          <Section title="Consentements">
            <Row label="Conditions acceptées" value={yesno(lead.terms_accepted)} />
            <Row label="Inspection acceptée" value={yesno(lead.inspection_accepted)} />
            <Row label="Marketing" value={yesno(lead.marketing_opt_in)} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Notes">
            <div className="flex flex-col gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Ajouter une note interne…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              />
              <button
                onClick={() => void onAddNote()}
                disabled={savingNote || !noteText.trim()}
                className="self-end rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {savingNote ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune note.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="whitespace-pre-wrap text-slate-800">{n.note_text}</div>
                    <div className="mt-1 text-xs text-slate-400">{fmtDateTime(n.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Historique de statut">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun changement enregistré.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700">
                      {(h.old_status || '—')} → <span className="font-semibold">{h.new_status}</span>
                    </span>
                    <span className="text-xs text-slate-400">{fmtDateTime(h.changed_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Tracking (première visite)">
            <Row label="Source" value={lead.source_first} />
            <Row label="Medium" value={lead.medium_first} />
            <Row label="Campagne" value={lead.campaign_first} />
            <Row label="Contenu" value={lead.content_first} />
            <Row label="Terme" value={lead.term_first} />
            <Row label="Référent" value={lead.referrer_first} />
            <Row label="Page d'atterrissage" value={lead.landing_page_first} />
            <Row label="Première visite" value={fmtDateTime(lead.first_seen_at)} />
            <Row label="CTA" value={lead.cta} />
            <Row label="Page d'entrée" value={lead.entry_page} />
            <Row label="URL d'entrée" value={lead.app_entry_url} />
            <Row label="Flow" value={lead.flow_id} />
          </Section>
        </div>
      </div>
    </div>
  );
}
