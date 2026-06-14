import { supabase } from '../lib/supabase';

// Mirrors the lead_status enum (20260119053221 + PARTIAL 222002 + CONTACTED 222006).
export type LeadStatus =
  | 'PARTIAL'
  | 'NEW'
  | 'CONTACTED'
  | 'ASSIGNED'
  | 'VISIT_SCHEDULED'
  | 'EVALUATED'
  | 'OFFER_MADE'
  | 'BOUGHT'
  | 'LOST'
  | 'CANCELLED';

export type Tone = 'slate' | 'blue' | 'amber' | 'green' | 'rose';

export const STATUS_META: Record<LeadStatus, { label: string; tone: Tone }> = {
  PARTIAL: { label: 'Partiel', tone: 'slate' },
  NEW: { label: 'Nouveau', tone: 'blue' },
  CONTACTED: { label: 'Contacté', tone: 'amber' },
  ASSIGNED: { label: 'Assigné', tone: 'slate' },
  VISIT_SCHEDULED: { label: 'Visite planifiée', tone: 'slate' },
  EVALUATED: { label: 'Évalué', tone: 'slate' },
  OFFER_MADE: { label: 'Offre faite', tone: 'slate' },
  BOUGHT: { label: 'Acheté', tone: 'green' },
  LOST: { label: 'Perdu', tone: 'rose' },
  CANCELLED: { label: 'Annulé', tone: 'rose' },
};

// The simplified CRM funnel the admin flips a lead through.
export const FUNNEL_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'BOUGHT', 'LOST'];

export interface LeadRow {
  id: string;
  created_at: string;
  status: LeadStatus;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  km: number;
  drivable: boolean;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  postal_code: string | null;
  slot_type: string | null;
  selected_slot_datetime: string | null;
  up_to: number | null;
  source_first: string;
  medium_first: string;
  campaign_first: string;
  cta: string;
}

const LIST_COLUMNS =
  'id, created_at, status, vehicle_year, vehicle_make, vehicle_model, km, drivable, ' +
  'client_name, client_phone, client_email, postal_code, slot_type, selected_slot_datetime, ' +
  'up_to, source_first, medium_first, campaign_first, cta';

export async function fetchLeads(limit = 200): Promise<LeadRow[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as LeadRow[];
}

export interface LeadMetrics {
  total: number;
  partial: number;
  new: number;
  contacted: number;
  bought: number;
  lost: number;
}

async function count(filter?: LeadStatus): Promise<number> {
  let q = supabase.from('leads').select('id', { count: 'exact', head: true });
  if (filter) q = q.eq('status', filter);
  const { count: c, error } = await q;
  if (error) throw error;
  return c ?? 0;
}

export async function fetchLeadMetrics(): Promise<LeadMetrics> {
  const [total, partial, n, contacted, bought, lost] = await Promise.all([
    count(),
    count('PARTIAL'),
    count('NEW'),
    count('CONTACTED'),
    count('BOUGHT'),
    count('LOST'),
  ]);
  return { total, partial, new: n, contacted, bought, lost };
}

// Full lead record for the detail screen (everything the list omits).
export interface LeadDetail extends LeadRow {
  vin: string;
  client_address: string | null;
  payment_preference: string | null;
  terms_accepted: boolean;
  inspection_accepted: boolean;
  marketing_opt_in: boolean;
  selected_slot_id: string | null;
  status_updated_at: string | null;
  updated_at: string | null;
  // First-touch tracking block.
  content_first: string;
  term_first: string;
  referrer_first: string;
  landing_page_first: string;
  first_seen_at: string | null;
  entry_page: string;
  app_entry_url: string;
  flow_id: string;
}

export interface LeadNote {
  id: string;
  note_text: string;
  created_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  old_status: string;
  new_status: string;
  changed_at: string;
  notes: string;
}

export async function fetchLead(id: string): Promise<LeadDetail | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as LeadDetail) ?? null;
}

export async function fetchLeadNotes(id: string): Promise<LeadNote[]> {
  const { data, error } = await supabase
    .from('lead_notes')
    .select('id, note_text, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LeadNote[];
}

export async function addLeadNote(id: string, text: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData.user?.id;
  if (!createdBy) throw new Error('Not authenticated');
  const { error } = await supabase.from('lead_notes').insert({
    lead_id: id,
    created_by: createdBy, // required by the INSERT policy (= auth.uid())
    note_text: text,
  });
  if (error) throw error;
}

export async function fetchStatusHistory(id: string): Promise<StatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('lead_status_history')
    .select('id, old_status, new_status, changed_at, notes')
    .eq('lead_id', id)
    .order('changed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as StatusHistoryEntry[];
}

// Flip a lead's status and record it in lead_status_history. The history INSERT
// policy requires changed_by = auth.uid(), so we read the current user first.
export async function updateLeadStatus(
  leadId: string,
  oldStatus: LeadStatus,
  newStatus: LeadStatus
): Promise<void> {
  const { error: updErr } = await supabase
    .from('leads')
    .update({ status: newStatus, status_updated_at: new Date().toISOString() })
    .eq('id', leadId);
  if (updErr) throw updErr;

  const { data: userData } = await supabase.auth.getUser();
  const changedBy = userData.user?.id;
  if (!changedBy) return; // update already landed; skip history if somehow signed out

  await supabase.from('lead_status_history').insert({
    lead_id: leadId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
  });
}
