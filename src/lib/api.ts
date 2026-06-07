import { supabase } from './supabase';
import { getTrackingData } from './tracking';

/**
 * create-lead is called in two modes (see supabase/functions/create-lead):
 *  - partial  : early capture at the gate (vehicle + name + phone). Status PARTIAL.
 *  - complete : full booking. Enriches the SAME row to NEW when lead_id is passed,
 *               otherwise inserts a complete lead directly.
 * The server derives the estimate itself and ignores any client-sent price.
 */

export interface PartialLeadInput {
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vin?: string;
  km: number;
  drivable: boolean;
  client_name: string;
  client_phone: string;
  client_email?: string;
  marketing_opt_in?: boolean;
  /** Hidden honeypot field value; bots fill it, humans leave it blank. */
  honeypot?: string;
}

export interface CompleteLeadInput extends PartialLeadInput {
  /** Present to enrich the partial row created at the gate. */
  lead_id?: string;
  postal_code: string;
  slot_type?: string;
  selected_slot_id?: string;
  selected_slot_datetime: string;
  client_address: string;
  payment_preference: 'cash' | 'interac';
  terms_accepted: boolean;
  inspection_accepted: boolean;
}

export interface LeadResult {
  lead_id: string;
  status: string;
}

/** Thrown when the edge function rate-limits the caller (HTTP 429). */
export class LeadRateLimitError extends Error {
  constructor() {
    super('RATE_LIMITED');
    this.name = 'LeadRateLimitError';
  }
}

/** Thrown for any other create-lead failure (network, validation, 5xx). */
export class LeadRequestError extends Error {
  constructor(message = 'LEAD_REQUEST_FAILED') {
    super(message);
    this.name = 'LeadRequestError';
  }
}

async function invokeCreateLead(body: Record<string, unknown>): Promise<LeadResult> {
  const { data, error } = await supabase.functions.invoke('create-lead', { body });

  if (error) {
    // supabase-js wraps non-2xx as FunctionsHttpError with the Response in `context`.
    const status = (error as { context?: { status?: number } })?.context?.status;
    if (status === 429) throw new LeadRateLimitError();
    console.error('create-lead error:', error);
    throw new LeadRequestError();
  }

  if (!data?.success) {
    throw new LeadRequestError(data?.error || 'LEAD_REQUEST_FAILED');
  }

  return data.data as LeadResult;
}

/** Early capture at the gate. Returns the new lead_id to enrich later. */
export async function createPartialLead(input: PartialLeadInput): Promise<LeadResult> {
  return invokeCreateLead({
    mode: 'partial',
    vehicle_year: input.vehicle_year,
    vehicle_make: input.vehicle_make,
    vehicle_model: input.vehicle_model,
    vin: input.vin || '',
    km: input.km,
    drivable: input.drivable,
    client_name: input.client_name,
    client_phone: input.client_phone,
    client_email: input.client_email || undefined,
    marketing_opt_in: input.marketing_opt_in ?? false,
    tracking: getTrackingData(),
    honeypot: input.honeypot || '',
  });
}

/**
 * Final booking. Pass lead_id to enrich the gate's partial row to NEW;
 * omit it to insert a standalone complete lead (e.g. partial creation failed).
 */
export async function completeLead(input: CompleteLeadInput): Promise<LeadResult> {
  return invokeCreateLead({
    mode: 'complete',
    lead_id: input.lead_id || undefined,
    vehicle_year: input.vehicle_year,
    vehicle_make: input.vehicle_make,
    vehicle_model: input.vehicle_model,
    vin: input.vin || '',
    km: input.km,
    drivable: input.drivable,
    postal_code: input.postal_code,
    slot_type: input.slot_type || '',
    selected_slot_id: input.selected_slot_id || '',
    selected_slot_datetime: input.selected_slot_datetime,
    client_name: input.client_name,
    client_phone: input.client_phone,
    client_email: input.client_email || undefined,
    client_address: input.client_address,
    payment_preference: input.payment_preference,
    terms_accepted: input.terms_accepted,
    inspection_accepted: input.inspection_accepted,
    marketing_opt_in: input.marketing_opt_in ?? false,
    tracking: getTrackingData(),
    honeypot: input.honeypot || '',
  });
}
